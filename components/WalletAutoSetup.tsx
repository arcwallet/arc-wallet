import React, { useCallback, useEffect, useRef, useState } from 'react';
import { usePasskeyAccount } from '../contexts/PasskeyAccountContext';
import { useSession } from '../contexts/SessionContext';

interface WalletAutoSetupProps {
  onComplete: () => void;
}

const WalletAutoSetup: React.FC<WalletAutoSetupProps> = ({ onComplete }) => {
  // PasskeyAccount - Smart Wallet (single wallet system)
  const { createAccount, hasAccount, isConnected } = usePasskeyAccount();
  const { currentEmail } = useSession();
  const [status, setStatus] = useState('Waiting for verified email...');
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const hasAttempted = useRef(false);

  const run = useCallback(async () => {
    if (!currentEmail) {
      setStatus('Waiting for verified email...');
      setError(null);
      return;
    }

    // If already connected, skip wallet creation
    if (isConnected) {
      setStatus('Wallet already connected. Loading dashboard...');
      onComplete();
      return;
    }

    setIsRunning(true);
    setError(null);
    setStatus(`Requesting biometric approval for ${currentEmail}...`);
    try {
      await createAccount();
      setStatus('Wallet created successfully. Loading dashboard...');
      onComplete();
    } catch (err: any) {
      if (err?.message?.includes('Failed to fetch')) {
        setError('Could not reach the passkey API. Please ensure https://arcwallet-backend.onrender.com is reachable.');
      } else if (err?.message) {
        setError(err.message);
      } else {
        setError('Failed to create wallet. Please try again.');
      }
      setStatus('Biometric prompt dismissed. Tap retry to try again.');
    } finally {
      setIsRunning(false);
    }
  }, [createAccount, currentEmail, onComplete, isConnected]);

  useEffect(() => {
    if (currentEmail && !hasAttempted.current) {
      hasAttempted.current = true;
      void run();
    }
  }, [currentEmail, run]);

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-[#05070D] text-slate-200 px-6 text-center">
      <div className="text-2xl font-light tracking-tight text-white">Getting your wallet ready…</div>
      <p className="text-sm text-slate-400 max-w-md">{status}</p>
      {error && (
        <div className="max-w-md rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}
      <button
        onClick={() => run()}
        disabled={isRunning || !currentEmail}
        className="rounded-lg bg-white/90 px-5 py-2 text-sm font-semibold text-slate-900 shadow transition disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isRunning ? 'Waiting for biometric…' : 'Retry biometric prompt'}
      </button>
    </div>
  );
};

export default WalletAutoSetup;

