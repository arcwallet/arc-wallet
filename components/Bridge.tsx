import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useWallet } from '../contexts/WalletContext';
import { useActivity } from '../contexts/ActivityContext';
import { TransactionStatus, TransactionType } from '../types';
import { SpinnerIcon } from './Icons';
import { getAllSupportedTokens, TokenInfo } from '../config/tokens';
import { startBridge, pollBridgeStatus } from '../services/bridgeApiClient';
import type { BridgeApiResponse } from '../services/bridgeApiClient';

type BridgeDirection = 'arc-to-sepolia' | 'sepolia-to-arc';

const DIRECTIONS: { id: BridgeDirection; label: string; description: string }[] = [
  {
    id: 'arc-to-sepolia',
    label: 'Arc → Sepolia',
    description: 'Burn USDC on Arc and mint on Sepolia',
  },
  {
    id: 'sepolia-to-arc',
    label: 'Sepolia → Arc',
    description: 'Bridge USDC from Sepolia into Arc',
  },
];

const PRIMARY_TOKEN_DECIMALS = 6;

const Bridge: React.FC = () => {
  const { sessionKey, userId, verifyWithPasskey, logout } = useWallet();
  const { addActivity } = useActivity();
  const [needsReauth, setNeedsReauth] = useState(false);

  const [direction, setDirection] = useState<BridgeDirection>('arc-to-sepolia');
  // Only USDC is supported for bridge between Arc Testnet and Sepolia
  const [selectedToken, setSelectedToken] = useState<TokenInfo>(getAllSupportedTokens().find(t => t.symbol === 'USDC') || getAllSupportedTokens()[0]);
  const [amount, setAmount] = useState('');
  const [amountError, setAmountError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [statusVariant, setStatusVariant] = useState<'info' | 'error' | 'success'>('info');
  const [progressItem, setProgressItem] = useState<string>('');
  const [currentTransactionId, setCurrentTransactionId] = useState<number | null>(null);

  const canSubmit = useMemo(() => {
    const normalized = Number(amount);
    return Boolean(sessionKey?.address) && Boolean(userId) && normalized > 0 && !Number.isNaN(normalized) && !isSubmitting;
  }, [sessionKey, userId, amount, isSubmitting]);

  const normalizeAmount = (raw: string): string | null => {
    if (raw == null) return null;
    // remove thousand separators and spaces; unify comma to dot
    let s = String(raw).trim().replace(/[,_\s]/g, '').replace(',', '.');
    if (s === '') return null;
    if (s.startsWith('.')) s = '0' + s;
    if (s.endsWith('.')) s = s + '0';
    const num = Number(s);
    if (!Number.isFinite(num) || num <= 0) return null;
    // Clamp to 6 decimals max for display; BridgeKit will accept decimal string
    const [int, frac = ''] = s.split('.');
    const clamped = frac.length > 6 ? `${int}.${frac.slice(0, 6)}` : s;
    // return with 2 decimals to be safe for BridgeKit
    return Number(clamped).toFixed(2);
  };

  const handleBridge = async () => {
    if (!sessionKey?.address || !userId) {
      setStatusVariant('error');
      setStatusMessage('Session not found. Please sign in with your passkey.');
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

    setIsSubmitting(true);
    setStatusVariant('info');
    setStatusMessage('Initiating bridge transaction with backend...');
    setProgressItem('Sending request to backend');
    setCurrentTransactionId(null);

    try {
      // Step 1: Start bridge via backend
      const startResponse = await startBridge({
        userId,
        sessionKeyAddress: sessionKey.address,
        amount: normalized,
        direction,
        token: 'USDC',
      });

      if (!startResponse.success || !startResponse.data) {
        const error = new Error(startResponse.error || 'Failed to start bridge transaction') as any;
        error.code = startResponse.code;
        throw error;
      }

      const transactionId = startResponse.data.transactionId;
      setCurrentTransactionId(transactionId);
      setProgressItem('Bridge transaction started. Monitoring progress...');

      // Step 2: Poll for status updates
      const finalStatus = await pollBridgeStatus(
        transactionId,
        (status, data) => {

          switch (status) {
            case 'pending':
              setProgressItem('Bridge transaction pending...');
              break;
            case 'burn_complete':
              setProgressItem(`${selectedToken.symbol} burned on source chain`);
              break;
            case 'attestation_fetched':
              setProgressItem('Attestation received from Circle');
              break;
            case 'mint_complete':
              setProgressItem(`${selectedToken.symbol} minted on destination chain`);
              break;
            case 'completed':
              setProgressItem('Bridge completed!');
              break;
            case 'failed':
              setProgressItem(data?.errorMessage || 'Bridge failed');
              break;
            default:
              setProgressItem(`Status: ${status}`);
          }
        },
        60, // 60 attempts
        5000 // 5 seconds interval
      );

      if (!finalStatus.success || !finalStatus.data) {
        throw new Error(finalStatus.error || 'Bridge status check failed');
      }

      if (finalStatus.data.status === 'failed') {
        throw new Error(finalStatus.data.errorMessage || 'Bridge transaction failed on backend');
      }

      // Success!
      const sourceTxHash = finalStatus.data.sourceTxHash;
      const destinationTxHash = finalStatus.data.destinationTxHash;

      setStatusVariant('success');
      setStatusMessage('Bridge completed successfully. Activity list has been updated.');
      setProgressItem('');

      const amountNumber = Number(amount);
      const now = new Date();

      // Add to activity feed - use Bridge type so ActivityContext doesn't poll these cross-chain transactions
      if (direction === 'arc-to-sepolia' && sourceTxHash) {
        addActivity({
          id: sourceTxHash,
          type: TransactionType.Bridge,
          description: `Bridge ${selectedToken.symbol} from Arc to Sepolia`,
          timestamp: 'Just now',
          date: now,
          amount: -amountNumber,
          currency: selectedToken.symbol,
          usdValue: selectedToken.symbol === 'USDC' ? -amountNumber : -amountNumber * 1.07,
          status: TransactionStatus.Completed,
          hash: sourceTxHash,
          from: sessionKey.address,
          to: 'Sepolia Bridge',
          networkFee: 0,
          approvals: { required: 0, list: [] },
        });
      }

      if (direction === 'sepolia-to-arc' && destinationTxHash) {
        addActivity({
          id: destinationTxHash,
          type: TransactionType.Bridge,
          description: `Bridge ${selectedToken.symbol} from Sepolia to Arc`,
          timestamp: 'Just now',
          date: now,
          amount: amountNumber,
          currency: selectedToken.symbol,
          usdValue: selectedToken.symbol === 'USDC' ? amountNumber : amountNumber * 1.07,
          status: TransactionStatus.Completed,
          hash: destinationTxHash,
          from: 'Sepolia Bridge',
          to: sessionKey.address,
          networkFee: 0,
          approvals: { required: 0, list: [] },
        });
      }
    } catch (error: any) {
      const message = typeof error?.message === 'string' ? error.message : 'Bridge transaction failed';
      const errorCode = error?.code;

      // Check if we need to re-authenticate
      if (errorCode === 'SESSION_KEY_NOT_FOUND' ||
          errorCode === 'SESSION_KEY_EXPIRED' ||
          errorCode === 'SESSION_KEY_USER_MISMATCH' ||
          message.includes('Session key') ||
          message.includes('re-authenticate')) {
        setNeedsReauth(true);
      }

      setStatusVariant('error');
      setStatusMessage(message);
      setProgressItem('');

      console.error('Bridge failed:', error);
    } finally {
      setIsSubmitting(false);
      setCurrentTransactionId(null);
    }
  };

  const directionDetails = useMemo(() => DIRECTIONS.find((item) => item.id === direction), [direction]);

  const handleReauthenticate = async () => {
    try {
      setStatusVariant('info');
      setStatusMessage('Re-authenticating with passkey...');
      await verifyWithPasskey();
      setNeedsReauth(false);
      setStatusVariant('success');
      setStatusMessage('Re-authentication successful! You can now try the bridge operation again.');
    } catch (error) {
      console.error('Re-authentication failed:', error);
      setStatusVariant('error');
      setStatusMessage('Re-authentication failed. Please try logging in again.');
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-6 py-10 space-y-10">
      <div className="space-y-3 text-center">
        <h2 className="text-text-primary text-4xl font-black leading-tight tracking-[-0.03em]">Bridge USDC</h2>
        <p className="text-text-secondary text-base">
          Transfer USDC between <span className="text-primary font-semibold">Arc Testnet</span> and <span className="text-primary font-semibold">Ethereum Sepolia</span> using Circle CCTP.
        </p>
      </div>

      <div className="grid gap-6">
        <div className="rounded-xl border border-white/10 bg-[#151A22] p-6 space-y-4">
          <p className="text-sm font-medium text-text-secondary">Bridge Direction</p>
          <div className="grid sm:grid-cols-2 gap-3">
            {DIRECTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setDirection(option.id)}
                className={`rounded-xl border px-4 py-4 text-left transition-colors ${
                  option.id === direction
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-white/10 bg-transparent text-text-primary hover:border-primary/40 hover:bg-primary/5'
                }`}
              >
                <p className="text-base font-semibold">{option.label}</p>
                <p className="text-xs text-text-secondary mt-1">{option.description}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#151A22] p-6 space-y-4">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-text-secondary">Token</label>
              <div className="mt-1 w-full rounded-lg border border-white/10 bg-[#0f1729] px-4 py-3 text-text-primary flex items-center gap-3">
                <div className="flex items-center gap-3">
                  <img
                    src="/icons/usdc.svg"
                    alt="USDC"
                    className="w-10 h-10"
                  />
                  <div>
                    <p className="font-semibold text-base">USDC</p>
                    <p className="text-xs text-text-secondary">USD Coin</p>
                  </div>
                </div>
                <div className="ml-auto text-xs text-text-secondary bg-white/5 px-3 py-1.5 rounded-full">
                  Arc Testnet ↔ Sepolia
                </div>
              </div>
              <p className="text-xs text-text-secondary mt-2">
                ✓ Only USDC is supported for bridge between Arc Testnet and Ethereum Sepolia
              </p>
            </div>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-text-secondary">Amount ({selectedToken.symbol})</span>
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="form-input h-12 rounded-lg border border-white/10 bg-[#0f1729] px-4 text-text-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
              placeholder="e.g. 1.5 or 1,5"
            />
            {amountError && <span className="text-xs text-accent-orange">{amountError}</span>}
          </label>
          <p className="text-xs text-text-secondary">
            Ensure your session key controls {selectedToken.symbol} on the selected source chain. Bridging uses the same private key across Sepolia and Arc.
          </p>
          </div>
        </div>

        <motion.button
          whileTap={{ scale: canSubmit ? 0.98 : 1 }}
          onClick={handleBridge}
          disabled={!canSubmit}
          className="flex items-center justify-center gap-2 h-12 rounded-lg bg-primary text-primary-text text-base font-semibold transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting && <SpinnerIcon size={20} />}
          <span>{isSubmitting ? `Bridging ${selectedToken.symbol}…` : `Bridge ${selectedToken.symbol} ${directionDetails?.label ?? ''}`}</span>
        </motion.button>

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
            {progressItem && <div className="mt-1 text-xs text-text-secondary">{progressItem}</div>}
            {needsReauth && (
              <button
                onClick={handleReauthenticate}
                className="mt-3 w-full rounded-lg bg-primary text-primary-text py-2 px-4 text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                Re-authenticate with Passkey
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Bridge;
