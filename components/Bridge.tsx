import React, { useMemo, useState, useEffect, useRef } from 'react';
import { usePasskeyAccount } from '../contexts/PasskeyAccountContext';
import { useActivity } from '../contexts/ActivityContext';
import { TransactionStatus, TransactionType } from '../types';
import { SpinnerIcon } from './Icons';
import { getAllSupportedTokens, TokenInfo } from '../config/tokens';
import {
  bridgeUsdcWithPasskey,
  getUsdcBalance,
  estimateBridgeTime,
  type BridgeDirection,
  type BridgeProgressStep,
} from '../services/passkeyBridgeService';
import { TX_EXPLORER_URL } from '../config/app.config';
import { PasskeyAccountManager } from '@arc/wallet-sdk';

// Sepolia config for PasskeyAccountManager
// Uses our own bundler running on backend (not Pimlico)
const SEPOLIA_PASSKEY_CONFIG = {
  factoryAddress: import.meta.env.VITE_SEPOLIA_PASSKEY_FACTORY_ADDRESS || '0x9AE89FbF3C32F976Db2A668d5a5c7B00032BD14a',
  entryPointAddress: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
  rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
  bundlerUrl: `${import.meta.env.VITE_BACKEND_URL || 'https://arcwallet-backend.onrender.com'}/api/bundler/rpc`,
  backendUrl: import.meta.env.VITE_BACKEND_URL || 'https://arcwallet-backend.onrender.com',
  rpId: window.location.hostname || 'app.arcwallet.network',
  rpName: 'Arc Wallet',
  chainId: 11155111, // Sepolia
};

const DIRECTIONS: { id: BridgeDirection; label: string; description: string; disabled?: boolean }[] = [
  {
    id: 'arc-to-sepolia',
    label: 'Arc → Sepolia',
    description: 'Burn USDC on Arc and mint on Sepolia',
  },
  {
    id: 'sepolia-to-arc',
    label: 'Sepolia → Arc',
    description: 'Burn USDC on Sepolia and mint on Arc',
  },
];

const Bridge: React.FC = () => {
  // PasskeyAccount - Smart Wallet (single wallet system)
  const {
    address,
    isConnected: passkeyConnected,
    manager: passkeyManager,
  } = usePasskeyAccount();
  const { addActivity } = useActivity();

  const [direction, setDirection] = useState<BridgeDirection>('arc-to-sepolia');
  const [selectedToken] = useState<TokenInfo>(
    getAllSupportedTokens().find(t => t.symbol === 'USDC') || getAllSupportedTokens()[0]
  );
  const [amount, setAmount] = useState('');
  const [amountError, setAmountError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [statusVariant, setStatusVariant] = useState<'info' | 'error' | 'success'>('info');
  const [progressItem, setProgressItem] = useState<string>('');
  const [sourceTxHash, setSourceTxHash] = useState<string | null>(null);
  const [destTxHash, setDestTxHash] = useState<string | null>(null);
  const [arcBalance, setArcBalance] = useState<string | null>(null);
  const [sepoliaBalance, setSepoliaBalance] = useState<string | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);

  // Create Sepolia PasskeyManager for sepolia-to-arc direction
  const sepoliaManagerRef = useRef<PasskeyAccountManager | null>(null);

  // Initialize Sepolia manager when we have credentials from Arc manager
  useEffect(() => {
    if (passkeyManager && passkeyConnected) {
      const credential = passkeyManager.getCurrentCredential();
      if (credential) {
        // Create Sepolia manager with same credentials
        const sepoliaManager = new PasskeyAccountManager(SEPOLIA_PASSKEY_CONFIG);
        // Restore the credential to Sepolia manager (same passkey, different chain)
        sepoliaManager.restoreFromCredential(credential).then(() => {
          sepoliaManagerRef.current = sepoliaManager;
          console.log('[Bridge] Sepolia PasskeyManager initialized');
        }).catch(err => {
          console.error('[Bridge] Failed to init Sepolia manager:', err);
        });
      }
    }
  }, [passkeyManager, passkeyConnected]);

  // Fetch balances on both chains
  React.useEffect(() => {
    const fetchBalances = async () => {
      if (!address) return;

      setIsLoadingBalance(true);
      try {
        console.log('[Bridge] Fetching balances for:', address);
        const [arcBal, sepoliaBal] = await Promise.all([
          getUsdcBalance(address, 'arc'),
          getUsdcBalance(address, 'sepolia'),
        ]);
        console.log('[Bridge] Balances fetched - Arc:', arcBal, 'Sepolia:', sepoliaBal);
        setArcBalance(arcBal);
        setSepoliaBalance(sepoliaBal);
      } catch (error) {
        console.error('[Bridge] Failed to fetch balances:', error);
        // Set 0 on error instead of leaving null
        setArcBalance('0.00');
        setSepoliaBalance('0.00');
      } finally {
        setIsLoadingBalance(false);
      }
    };

    fetchBalances();
  }, [address]);

  // Get source chain balance based on direction
  const sourceBalance = direction === 'arc-to-sepolia' ? arcBalance : sepoliaBalance;

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
    // For PasskeyAccount - check if connected and manager available
    if (!passkeyConnected || !passkeyManager) {
      return false;
    }
    if (isSubmitting) return false;

    const normalized = normalizeAmount(amount);
    if (!normalized) return false;
    const numeric = Number(normalized);
    return Number.isFinite(numeric) && numeric > 0;
  }, [passkeyConnected, passkeyManager, amount, isSubmitting]);

  const handleProgressUpdate = (step: BridgeProgressStep) => {
    switch (step.type) {
      case 'checking-balance':
        setProgressItem('Checking USDC balance...');
        break;
      case 'approving-usdc':
        setProgressItem(step.txHash
          ? `USDC approved! Tx: ${step.txHash.slice(0, 10)}...`
          : 'Approving USDC (sign with passkey)...'
        );
        break;
      case 'burning-usdc':
        setProgressItem(step.txHash
          ? `USDC burned! Tx: ${step.txHash.slice(0, 10)}...`
          : 'Burning USDC on source chain (sign with passkey)...'
        );
        if (step.txHash) setSourceTxHash(step.txHash);
        break;
      case 'waiting-attestation':
        setProgressItem(`Waiting for Circle attestation (10-20 min)...`);
        break;
      case 'attestation-received':
        setProgressItem('Attestation received from Circle!');
        break;
      case 'minting-usdc':
        setProgressItem(step.txHash
          ? `USDC minted! Tx: ${step.txHash.slice(0, 10)}...`
          : 'Minting USDC on destination (sign with passkey)...'
        );
        if (step.txHash) setDestTxHash(step.txHash);
        break;
      case 'completed':
        setProgressItem('Bridge completed successfully!');
        if (step.sourceTxHash) setSourceTxHash(step.sourceTxHash);
        if (step.destinationTxHash) setDestTxHash(step.destinationTxHash);
        break;
      case 'error':
        setProgressItem(`Error: ${step.message}`);
        break;
    }
  };

  const handleBridge = async () => {
    if (!passkeyConnected || !passkeyManager) {
      setStatusVariant('error');
      setStatusMessage('Please connect your passkey wallet first.');
      return;
    }

    // For sepolia-to-arc, we need the Sepolia manager
    if (direction === 'sepolia-to-arc' && !sepoliaManagerRef.current) {
      setStatusVariant('error');
      setStatusMessage('Sepolia wallet not initialized. Please wait and try again.');
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
      setStatusMessage(`Insufficient balance. You have ${sourceBalance} USDC on ${direction === 'arc-to-sepolia' ? 'Arc' : 'Sepolia'}.`);
      return;
    }

    setIsSubmitting(true);
    setStatusVariant('info');
    setStatusMessage('Starting bridge transaction...');
    setProgressItem('');
    setSourceTxHash(null);
    setDestTxHash(null);

    try {
      const result = await bridgeUsdcWithPasskey({
        passkeyManager,
        sepoliaPasskeyManager: sepoliaManagerRef.current || undefined,
        amount: normalized,
        direction,
        onProgress: handleProgressUpdate,
      });

      if (result.success) {
        setStatusVariant('success');
        setStatusMessage('Bridge completed successfully!');

        const amountNumber = Number(normalized);
        const now = new Date();

        // Add to activity feed
        if (result.sourceTxHash) {
          addActivity({
            id: result.sourceTxHash,
            type: TransactionType.Bridge,
            description: direction === 'arc-to-sepolia'
              ? `Bridge ${selectedToken.symbol} from Arc to Sepolia`
              : `Bridge ${selectedToken.symbol} from Sepolia to Arc`,
            timestamp: 'Just now',
            date: now,
            amount: direction === 'arc-to-sepolia' ? -amountNumber : amountNumber,
            currency: selectedToken.symbol,
            usdValue: amountNumber,
            status: TransactionStatus.Completed,
            hash: result.sourceTxHash,
            from: address || '',
            to: direction === 'arc-to-sepolia' ? 'Sepolia' : 'Arc Testnet',
            networkFee: 0,
            approvals: { required: 0, list: [] },
          });
        }
      } else {
        throw new Error(result.error || 'Bridge failed');
      }
    } catch (error: any) {
      const message = error?.message || 'Bridge transaction failed';
      setStatusVariant('error');
      setStatusMessage(message);
      setProgressItem('');
      console.error('Bridge failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const directionDetails = useMemo(
    () => DIRECTIONS.find((item) => item.id === direction),
    [direction]
  );

  return (
    <div className="w-full max-w-3xl mx-auto px-6 py-10 space-y-10">
      <div className="mb-8 text-center">
        <h2 className="text-white text-4xl font-black leading-tight tracking-[-0.03em]">
          Bridge USDC
        </h2>
        <p className="text-slate-400 text-base mt-2">
          Transfer USDC between{' '}
          <span className="text-blue-400 font-semibold">Arc Testnet</span> and{' '}
          <span className="text-blue-400 font-semibold">Ethereum Sepolia</span> using Circle CCTP.
        </p>
        <p className="text-slate-500 text-sm mt-1">
          Estimated time: {estimateBridgeTime(direction)}
        </p>
      </div>

      {/* Passkey Wallet Status */}
      {!passkeyConnected && (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-center">
          <p className="text-yellow-400 font-medium">Passkey Wallet Required</p>
          <p className="text-yellow-300/70 text-sm mt-1">
            Please connect your passkey wallet to use the bridge.
          </p>
        </div>
      )}

      {passkeyConnected && (
        <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-400 font-medium">Passkey Wallet Connected</p>
              <p className="text-green-300/70 text-sm font-mono">
                {address?.slice(0, 10)}...{address?.slice(-8)}
              </p>
            </div>
            <div className="flex gap-4">
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${direction === 'arc-to-sepolia' ? 'bg-blue-500/10 border border-blue-500/30' : 'bg-slate-800/50'}`}>
                <img src="/arcwalletlogo.png" alt="Arc" className="w-5 h-5 rounded-full" />
                <div className="text-right">
                  <p className="text-slate-400 text-[10px]">Arc</p>
                  <p className={`font-semibold text-sm ${direction === 'arc-to-sepolia' ? 'text-blue-400' : 'text-white'}`}>
                    {isLoadingBalance ? '...' : arcBalance ? `${arcBalance}` : '0'} USDC
                  </p>
                </div>
              </div>
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${direction === 'sepolia-to-arc' ? 'bg-blue-500/10 border border-blue-500/30' : 'bg-slate-800/50'}`}>
                <img src="/networks/ethereum.svg" alt="Ethereum" className="w-5 h-5" />
                <div className="text-right">
                  <p className="text-slate-400 text-[10px]">Sepolia</p>
                  <p className={`font-semibold text-sm ${direction === 'sepolia-to-arc' ? 'text-blue-400' : 'text-white'}`}>
                    {isLoadingBalance ? '...' : sepoliaBalance ? `${sepoliaBalance}` : '0'} USDC
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
                onClick={() => !option.disabled && setDirection(option.id)}
                disabled={isSubmitting || option.disabled}
                className={`rounded-xl border px-4 py-4 text-left transition-all ${
                  option.disabled
                    ? 'border-slate-600/30 bg-slate-800/30 text-slate-500 cursor-not-allowed opacity-60'
                    : option.id === direction
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
                  <img src="/icons/usdc.svg" alt="USDC" className="w-10 h-10" />
                  <div>
                    <p className="font-semibold text-base">USDC</p>
                    <p className="text-xs text-slate-400">USD Coin</p>
                  </div>
                </div>
                <div className="ml-auto text-xs text-slate-300 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
                  Arc Testnet ↔ Sepolia
                </div>
              </div>
            </div>

            <label className="flex flex-col gap-2">
              <div className="flex justify-between">
                <span className="text-sm font-medium text-slate-400">
                  Amount ({selectedToken.symbol})
                </span>
                {sourceBalance && (
                  <button
                    type="button"
                    onClick={() => setAmount(sourceBalance)}
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    Max: {sourceBalance}
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
                placeholder="e.g. 1.5 or 1,5"
              />
              {amountError && (
                <span className="text-xs text-accent-orange">{amountError}</span>
              )}
            </label>

            <div className="rounded-lg bg-blue-500/10 border border-blue-500/30 p-3">
              <p className="text-xs text-blue-300">
                Bridge uses your PasskeyAccount smart wallet. You'll be prompted to sign with your passkey for each step (approve + burn).
              </p>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <button
          onClick={handleBridge}
          disabled={!canSubmit}
          className="flex items-center justify-center gap-2 h-14 rounded-lg bg-slate-200 hover:bg-white text-slate-900 text-lg font-semibold transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting && <SpinnerIcon size={20} />}
          <span>
            {isSubmitting
              ? `Bridging ${selectedToken.symbol}…`
              : `Bridge ${selectedToken.symbol} ${directionDetails?.label ?? ''}`}
          </span>
        </button>

        {/* Status Messages */}
        {statusMessage && (
          <div
            className={`rounded-lg border px-4 py-3 text-sm text-left ${
              statusVariant === 'error'
                ? 'border-red-400/50 bg-red-500/10 text-red-200'
                : statusVariant === 'success'
                ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200'
                : 'border-white/10 bg-white/5 text-text-secondary'
            }`}
          >
            {statusMessage}
            {progressItem && (
              <div className="mt-1 text-xs text-text-secondary">{progressItem}</div>
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
                  href={`${TX_EXPLORER_URL}${sourceTxHash}`}
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
                  href={`https://sepolia.etherscan.io/tx/${destTxHash}`}
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
