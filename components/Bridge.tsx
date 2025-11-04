import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useWallet } from '../contexts/WalletContext';
import { useActivity } from '../contexts/ActivityContext';
import type { BridgeDirection } from '../services/bridgeService';
import { bridgeUsdcWithSessionKey } from '../services/bridgeService';
import { TransactionStatus, TransactionType } from '../types';
import { SpinnerIcon } from './Icons';

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
  const { sessionKey } = useWallet();
  const { addActivity } = useActivity();

  const [direction, setDirection] = useState<BridgeDirection>('arc-to-sepolia');
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [statusVariant, setStatusVariant] = useState<'info' | 'error' | 'success'>('info');
  const [progressItem, setProgressItem] = useState<string>('');

  const canSubmit = useMemo(() => {
    const normalized = Number(amount);
    return Boolean(sessionKey?.privateKey) && normalized > 0 && !Number.isNaN(normalized) && !isSubmitting;
  }, [sessionKey, amount, isSubmitting]);

  const handleBridge = async () => {
    if (!sessionKey?.privateKey) {
      setStatusVariant('error');
      setStatusMessage('Active session key not found. Please sign in with your passkey.');
      return;
    }

    const normalizedAmount = Number(amount);
    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      setStatusVariant('error');
      setStatusMessage('Please enter a valid amount greater than zero.');
      return;
    }

    setIsSubmitting(true);
    setStatusVariant('info');
    setStatusMessage('Bridge transaction in progress. You may be prompted to approve multiple steps.');
    setProgressItem('');

    try {
      const { sourceTxHash, receiveTxHash } = await bridgeUsdcWithSessionKey({
        privateKey: sessionKey.privateKey,
        amount,
        direction,
        onProgress: (step) => {
          switch (step.type) {
            case 'switch-network':
              setProgressItem('Switching networks…');
              break;
            case 'approve':
              setProgressItem('Approving USDC spend…');
              break;
            case 'burn':
              setProgressItem('Burning USDC on source chain…');
              break;
            case 'fetch-attestation':
              setProgressItem('Fetching attestation…');
              break;
            case 'mint':
              setProgressItem('Minting USDC on destination chain…');
              break;
            default:
              break;
          }
        },
      });

      setStatusVariant('success');
      setStatusMessage('Bridge completed successfully. Activity list has been updated.');
      setProgressItem('');

      const amountNumber = Number(amount);
      const now = new Date();

      if (direction === 'arc-to-sepolia' && sourceTxHash) {
        addActivity({
          id: sourceTxHash,
          type: TransactionType.Sent,
          description: 'Bridge USDC from Arc to Sepolia',
          timestamp: 'Just now',
          date: now,
          amount: -amountNumber,
          currency: 'USDC',
          usdValue: -amountNumber,
          status: TransactionStatus.Completed,
          hash: sourceTxHash,
          from: sessionKey.address,
          to: 'Sepolia Bridge',
          networkFee: 0,
          approvals: { required: 0, list: [] },
        });
      }

      if (direction === 'sepolia-to-arc' && receiveTxHash) {
        addActivity({
          id: receiveTxHash,
          type: TransactionType.Received,
          description: 'Bridge USDC from Sepolia',
          timestamp: 'Just now',
          date: now,
          amount: amountNumber,
          currency: 'USDC',
          usdValue: amountNumber,
          status: TransactionStatus.Completed,
          hash: receiveTxHash,
          from: 'Sepolia Bridge',
          to: sessionKey.address,
          networkFee: 0,
          approvals: { required: 0, list: [] },
        });
      }
    } catch (error: any) {
      const message = typeof error?.message === 'string' ? error.message : 'Bridge transaction failed';
      setStatusVariant('error');
      setStatusMessage(message);
      setProgressItem('');

      // Detailed log in debug mode
      if (import.meta.env.VITE_BRIDGE_DEBUG === 'true') {
        console.error('🚨 Bridge component error:', error);
        console.error('🔍 Error details:', {
          message: error.message,
          code: error.code,
          cause: error.cause,
          stack: error.stack?.split('\n').slice(0, 5) // İlk 5 satır stack trace
        });
      } else {
        console.error('Bridge failed', error);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const directionDetails = useMemo(() => DIRECTIONS.find((item) => item.id === direction), [direction]);

  return (
    <div className="w-full max-w-3xl mx-auto px-6 py-10 space-y-10">
      <div className="space-y-3 text-center">
        <h2 className="text-text-primary text-4xl font-black leading-tight tracking-[-0.03em]">Bridge USDC</h2>
        <p className="text-text-secondary text-base">
          Bridge USDC between Arc Testnet and Ethereum Sepolia using your current Arc Wallet session.
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
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-text-secondary">Amount (USDC)</span>
            <input
              type="number"
              min="0"
              step={1 / 10 ** PRIMARY_TOKEN_DECIMALS}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="form-input h-12 rounded-lg border border-white/10 bg-[#0f1729] px-4 text-text-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
              placeholder="0.00"
            />
          </label>
          <p className="text-xs text-text-secondary">
            Ensure your session key controls USDC on the selected source chain. Bridging uses the same private key across Sepolia and Arc.
          </p>
        </div>

        <motion.button
          whileTap={{ scale: canSubmit ? 0.98 : 1 }}
          onClick={handleBridge}
          disabled={!canSubmit}
          className="flex items-center justify-center gap-2 h-12 rounded-lg bg-primary text-primary-text text-base font-semibold transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting && <SpinnerIcon size={20} />}
          <span>{isSubmitting ? 'Bridging…' : `Bridge ${directionDetails?.label ?? ''}`}</span>
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
          </div>
        )}
      </div>
    </div>
  );
};

export default Bridge;
