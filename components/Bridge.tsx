/**
 * Bridge Component - CCTP Cross-Chain USDC Transfer
 *
 * Professional UI for bidirectional bridging via Circle CCTP V2:
 * - Arc → Base Sepolia
 * - Base Sepolia → Arc
 */

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useCircleWallet } from '../contexts/CircleWalletContext';
import { useBridge } from '../contexts/BridgeContext';
import { SpinnerIcon } from './Icons';
import { formatUnits, parseUnits } from 'ethers';

// Balance refresh interval (15 seconds)
const BALANCE_REFRESH_INTERVAL = 15_000;

type BridgeDirection = 'arc-to-base' | 'base-to-arc';

const DIRECTIONS: { id: BridgeDirection; label: string; description: string }[] = [
  {
    id: 'arc-to-base',
    label: 'Arc → Base',
    description: 'Burn USDC on Arc and mint on Base Sepolia',
  },
  {
    id: 'base-to-arc',
    label: 'Base → Arc',
    description: 'Burn USDC on Base Sepolia and mint on Arc',
  },
];

// Progress step type
type ProgressStep =
  | 'checking-balance'
  | 'calculating-fee'
  | 'approving-usdc'
  | 'burning-usdc'
  | 'waiting-attestation'
  | 'attestation-received'
  | 'minting-usdc'
  | 'completed'
  | 'error';

const Bridge: React.FC = () => {
  const { address, isConnected, getTokenBalance, getTokenBalanceOnChain } = useCircleWallet();
  const {
    isLoading,
    error,
    destinationChains,
    executeBridge,
    executeInboundBridge,
    clearError,
  } = useBridge();

  const [direction, setDirection] = useState<BridgeDirection>('arc-to-base');
  const [amount, setAmount] = useState('');
  const [amountError, setAmountError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [statusVariant, setStatusVariant] = useState<'info' | 'error' | 'success'>('info');
  const [progressStep, setProgressStep] = useState<ProgressStep | null>(null);
  const [sourceTxHash, setSourceTxHash] = useState<string | null>(null);
  const [destTxHash, setDestTxHash] = useState<string | null>(null);
  const [arcBalance, setArcBalance] = useState<string | null>(null);
  const [baseBalance, setBaseBalance] = useState<string | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);

  const ARC_USDC = '0x3600000000000000000000000000000000000000';
  const BASE_SEPOLIA_USDC = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';

  // Fetch balances - memoized callback for reuse
  const fetchBalances = useCallback(async (showLoading = true) => {
    if (!address || !isConnected) return;

    if (showLoading) setIsLoadingBalance(true);
    try {
      // Get Arc balance
      const arcBal = await getTokenBalance(ARC_USDC);
      setArcBalance(formatUnits(arcBal, 6));

      // Get Base Sepolia balance
      try {
        const baseBal = await getTokenBalanceOnChain(84532, BASE_SEPOLIA_USDC);
        setBaseBalance(formatUnits(baseBal, 6));
      } catch (baseErr) {
        console.error('Failed to fetch Base Sepolia balance:', baseErr);
        setBaseBalance('0.00');
      }
    } catch (err) {
      console.error('Failed to fetch balances:', err);
      setArcBalance('0.00');
      setBaseBalance('0.00');
    } finally {
      if (showLoading) setIsLoadingBalance(false);
    }
  }, [address, isConnected, getTokenBalance, getTokenBalanceOnChain]);

  // Initial fetch + periodic refresh
  useEffect(() => {
    fetchBalances();

    // Set up periodic refresh every 15 seconds
    const intervalId = setInterval(() => {
      fetchBalances(false); // Silent refresh (no loading spinner)
    }, BALANCE_REFRESH_INTERVAL);

    return () => clearInterval(intervalId);
  }, [fetchBalances]);

  // Get source chain balance based on direction
  const sourceBalance = direction === 'arc-to-base' ? arcBalance : baseBalance;

  const normalizeAmount = (raw: string): string | null => {
    if (raw == null) return null;
    let s = String(raw).trim();
    s = s.replace(/[\s_]/g, '');
    if (s.includes(',') && !s.includes('.')) {
      s = s.replace(/,/g, '.');
    } else {
      s = s.replace(/,/g, '');
    }
    if (s === '') return null;
    if (s.startsWith('.')) s = '0' + s;
    if (s.endsWith('.')) s = s + '0';
    const num = Number(s);
    if (!Number.isFinite(num) || num <= 0) return null;
    const [int, frac = ''] = s.split('.');
    const clamped = frac.length > 6 ? `${int}.${frac.slice(0, 6)}` : s;
    return Number(clamped).toFixed(2);
  };

  const canSubmit = useMemo(() => {
    if (!isConnected) return false;
    if (isSubmitting || isLoading) return false;

    const normalized = normalizeAmount(amount);
    if (!normalized) return false;
    const numeric = Number(normalized);
    return Number.isFinite(numeric) && numeric > 0;
  }, [isConnected, amount, isSubmitting, isLoading]);

  // Calculate estimated fee
  const feeInfo = useMemo(() => {
    const normalized = normalizeAmount(amount);
    if (!normalized) return null;

    const feePercentage = '0.50'; // 0.5% fee
    const amountNum = parseFloat(normalized);
    const fee = (amountNum * 0.005).toFixed(4);
    const netAmount = (amountNum - parseFloat(fee)).toFixed(4);

    return { fee, netAmount, feePercentage };
  }, [amount]);

  const handleBridge = async () => {
    if (!isConnected) {
      setStatusVariant('error');
      setStatusMessage('Please connect your wallet first.');
      return;
    }

    const normalized = normalizeAmount(amount);
    if (!normalized) {
      setStatusVariant('error');
      setStatusMessage('Please enter a valid amount greater than zero.');
      setAmountError('Use digits and , or . for decimals. Example: 1.5 or 1,5');
      return;
    }
    setAmountError(null);

    // Check balance
    if (sourceBalance && Number(normalized) > Number(sourceBalance)) {
      setStatusVariant('error');
      setStatusMessage(`Insufficient balance. You have ${sourceBalance} USDC on ${direction === 'arc-to-base' ? 'Arc' : 'Base Sepolia'}.`);
      return;
    }

    setIsSubmitting(true);
    setStatusVariant('info');
    setStatusMessage('Starting bridge transaction...');
    setProgressStep('checking-balance');
    setSourceTxHash(null);
    setDestTxHash(null);

    try {
      // Update progress
      setProgressStep('burning-usdc');
      setStatusMessage('Burning USDC on source chain (sign with passkey)...');

      let result;
      if (direction === 'arc-to-base') {
        // Arc → Base Sepolia
        const baseChain = destinationChains.find(c => c.name.includes('Base'));
        if (!baseChain) throw new Error('Base Sepolia chain not found');

        result = await executeBridge(normalized, baseChain.chainId);
      } else {
        // Base Sepolia → Arc
        const baseChain = destinationChains.find(c => c.name.includes('Base'));
        if (!baseChain) throw new Error('Base Sepolia chain not found');

        result = await executeInboundBridge(normalized, baseChain.chainId);
      }

      if (result.burnTxHash) {
        setSourceTxHash(result.burnTxHash);
        setProgressStep('waiting-attestation');
        setStatusMessage('Waiting for Circle attestation...');
      }

      // The bridge service handles polling and auto-claim
      // We just need to show success
      setProgressStep('completed');
      setStatusVariant('success');
      setStatusMessage('Bridge initiated successfully! Your USDC will arrive shortly.');
      setAmount('');

      // Refresh balances after successful bridge
      // Small delay to allow transaction to propagate
      setTimeout(() => fetchBalances(), 2000);
      // Refresh again after attestation might complete
      setTimeout(() => fetchBalances(), 10000);

    } catch (err: any) {
      const message = err?.message || 'Bridge transaction failed';
      setStatusVariant('error');
      setStatusMessage(message);
      setProgressStep('error');
      console.error('Bridge failed:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const directionDetails = useMemo(
    () => DIRECTIONS.find((item) => item.id === direction),
    [direction]
  );

  const getProgressMessage = () => {
    switch (progressStep) {
      case 'checking-balance': return 'Checking USDC balance...';
      case 'calculating-fee': return 'Calculating bridge fee...';
      case 'approving-usdc': return 'Approving USDC (sign with passkey)...';
      case 'burning-usdc': return 'Burning USDC on source chain...';
      case 'waiting-attestation': return 'Waiting for Circle attestation (~2-3 min)...';
      case 'attestation-received': return 'Attestation received from Circle!';
      case 'minting-usdc': return 'Minting USDC on destination chain...';
      case 'completed': return 'Bridge completed successfully!';
      case 'error': return 'An error occurred';
      default: return '';
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-6 py-10 space-y-10">
      <div className="mb-8 text-center">
        <h2 className="text-white text-4xl font-black leading-tight tracking-[-0.03em]">
          Bridge USDC
        </h2>
        <p className="text-slate-400 text-base mt-2">
          Transfer USDC between{' '}
          <span className="text-blue-400 font-semibold">Arc Testnet</span> and{' '}
          <span className="text-blue-400 font-semibold">Base Sepolia</span> using Circle CCTP.
        </p>
      </div>

      {/* Wallet Status */}
      {!isConnected && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-center">
          <p className="text-amber-400 font-medium">Wallet Required</p>
          <p className="text-amber-300/70 text-sm mt-1">
            Please connect your wallet to use the bridge.
          </p>
        </div>
      )}

      {isConnected && (
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-400 font-medium">Wallet Connected</p>
              <p className="text-slate-400 text-sm font-mono">
                {address?.slice(0, 10)}...{address?.slice(-8)}
              </p>
            </div>
            <div className="flex gap-4">
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${direction === 'arc-to-base' ? 'bg-blue-500/10 border border-blue-500/30' : 'bg-slate-800/50'}`}>
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#6c7cff] to-[#4aa9ff]" />
                <div className="text-right">
                  <p className="text-slate-400 text-[10px]">Arc</p>
                  <p className={`font-semibold text-sm ${direction === 'arc-to-base' ? 'text-blue-400' : 'text-white'}`}>
                    {isLoadingBalance ? '...' : arcBalance ? `${parseFloat(arcBalance).toFixed(2)}` : '0.00'} USDC
                  </p>
                </div>
              </div>
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${direction === 'base-to-arc' ? 'bg-blue-500/10 border border-blue-500/30' : 'bg-slate-800/50'}`}>
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#0052FF] to-[#0039B3]" />
                <div className="text-right">
                  <p className="text-slate-400 text-[10px]">Base</p>
                  <p className={`font-semibold text-sm ${direction === 'base-to-arc' ? 'text-blue-400' : 'text-white'}`}>
                    {isLoadingBalance ? '...' : baseBalance ? `${parseFloat(baseBalance).toFixed(2)}` : '0.00'} USDC
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6">
        {/* Direction Selection */}
        <div className="rounded-xl border border-slate-500/50 bg-slate-900/60 backdrop-blur-sm p-6 space-y-4">
          <p className="text-sm font-medium text-slate-400">Bridge Direction</p>
          <div className="grid sm:grid-cols-2 gap-3">
            {DIRECTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  setDirection(option.id);
                  setAmount('');
                  setStatusMessage('');
                  setProgressStep(null);
                  clearError();
                }}
                disabled={isSubmitting}
                className={`rounded-xl border px-4 py-4 text-left transition-all ${
                  option.id === direction
                    ? 'border-blue-400 bg-blue-400/10 text-blue-400 shadow-[0_0_15px_rgba(96,165,250,0.2)]'
                    : 'border-slate-500/30 bg-transparent text-slate-300 hover:border-blue-400/50 hover:bg-blue-400/5'
                } disabled:opacity-50`}
              >
                <p className="text-base font-semibold">{option.label}</p>
                <p className="text-xs text-slate-400 mt-1">{option.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Token & Amount */}
        <div className="rounded-xl border border-slate-500/50 bg-slate-900/60 backdrop-blur-sm p-6 space-y-4">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-400">Token</label>
              <div className="mt-1 w-full rounded-lg border border-slate-500/30 bg-slate-900/40 px-4 py-3 text-slate-100 flex items-center gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#2775ca] flex items-center justify-center">
                    <span className="text-white font-bold text-sm">$</span>
                  </div>
                  <div>
                    <p className="font-semibold text-base">USDC</p>
                    <p className="text-xs text-slate-400">USD Coin</p>
                  </div>
                </div>
                <div className="ml-auto text-xs text-slate-300 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
                  Arc Testnet ↔ Base Sepolia
                </div>
              </div>
            </div>

            <label className="flex flex-col gap-2">
              <div className="flex justify-between">
                <span className="text-sm font-medium text-slate-400">Amount (USDC)</span>
                {sourceBalance && (
                  <button
                    type="button"
                    onClick={() => setAmount(sourceBalance)}
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    Max: {parseFloat(sourceBalance).toFixed(2)}
                  </button>
                )}
              </div>
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                disabled={isSubmitting}
                className="form-input h-12 rounded-lg border border-slate-500/50 bg-slate-900/40 px-4 text-white focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 transition-all placeholder:text-slate-500 disabled:opacity-50"
                placeholder="e.g. 10.00"
              />
              {amountError && (
                <span className="text-xs text-red-400">{amountError}</span>
              )}
            </label>

            {/* Fee Estimation Display */}
            {feeInfo && (
              <div className="rounded-lg border p-4 space-y-2 bg-slate-800/50 border-slate-600/30">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">You send</span>
                  <span className="text-white font-medium">{normalizeAmount(amount)} USDC</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Bridge fee ({feeInfo.feePercentage}%)</span>
                  <span className="text-slate-300">-{feeInfo.fee} USDC</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Estimated time</span>
                  <span className="text-slate-300">~2-3 min</span>
                </div>
                <div className="border-t border-slate-600/30 pt-2 flex justify-between text-sm">
                  <span className="text-slate-400">You receive</span>
                  <span className="font-semibold text-blue-400">{feeInfo.netAmount} USDC</span>
                </div>
              </div>
            )}

            <div className="rounded-lg p-3 bg-blue-500/10 border border-blue-500/30">
              <p className="text-xs text-blue-300">
                Bridge uses your smart wallet. You'll be prompted to sign with your passkey for each step.
              </p>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <button
          onClick={handleBridge}
          disabled={!canSubmit}
          className="flex items-center justify-center gap-2 h-14 rounded-lg text-lg font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white shadow-[0_0_20px_rgba(99,102,241,0.2)] hover:shadow-[0_0_30px_rgba(99,102,241,0.3)]"
        >
          {isSubmitting && <SpinnerIcon size={20} />}
          <span>
            {isSubmitting
              ? 'Bridging USDC…'
              : `Bridge USDC ${directionDetails?.label ?? ''}`}
          </span>
        </button>

        {/* Status Messages */}
        {(statusMessage || error) && (
          <div
            className={`rounded-lg border px-4 py-3 text-sm text-left ${
              statusVariant === 'error' || error
                ? 'border-red-400/50 bg-red-500/10 text-red-200'
                : statusVariant === 'success'
                ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200'
                : 'border-white/10 bg-white/5 text-slate-300'
            }`}
            onClick={() => { clearError(); setStatusMessage(''); }}
          >
            {error || statusMessage}
            {progressStep && progressStep !== 'completed' && progressStep !== 'error' && (
              <div className="mt-1 text-xs text-slate-400">{getProgressMessage()}</div>
            )}
          </div>
        )}

        {/* Transaction Links */}
        {(sourceTxHash || destTxHash) && (
          <div className="rounded-lg border border-slate-500/30 bg-slate-900/40 p-4 space-y-2">
            <p className="text-sm font-medium text-slate-400">Transaction Links</p>
            {sourceTxHash && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Source (Burn):</span>
                <a
                  href={direction === 'arc-to-base'
                    ? `https://testnet.arcscan.app/tx/${sourceTxHash}`
                    : `https://sepolia.basescan.org/tx/${sourceTxHash}`
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-blue-400 hover:text-blue-300 font-mono"
                >
                  {sourceTxHash.slice(0, 10)}...{sourceTxHash.slice(-8)} ↗
                </a>
              </div>
            )}
            {destTxHash && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Destination (Mint):</span>
                <a
                  href={direction === 'arc-to-base'
                    ? `https://sepolia.basescan.org/tx/${destTxHash}`
                    : `https://testnet.arcscan.app/tx/${destTxHash}`
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-blue-400 hover:text-blue-300 font-mono"
                >
                  {destTxHash.slice(0, 10)}...{destTxHash.slice(-8)} ↗
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Bridge;
