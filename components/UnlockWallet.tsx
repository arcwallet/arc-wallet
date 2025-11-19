/**
 * Unlock Wallet Component
 * Password entry to decrypt local wallet
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useSelfCustodialWallet } from '../contexts/SelfCustodialWalletContext';

interface UnlockWalletProps {
  onUnlock: () => void;
  onReset?: () => void;
}

const UnlockWallet: React.FC<UnlockWalletProps> = ({ onUnlock, onReset }) => {
  const { unlockWallet, address, deleteWallet } = useSelfCustodialWallet();

  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);

  const handleUnlock = async () => {
    if (!password) {
      setError('Please enter your password');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await unlockWallet(password);
      onUnlock();
    } catch (err: any) {
      setError(err.message || 'Failed to unlock wallet');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleUnlock();
    }
  };

  const handleReset = () => {
    if (window.confirm('Are you sure you want to reset your wallet? This will delete your encrypted wallet. You will need your seed phrase to recover.')) {
      deleteWallet();
      onReset?.();
    }
  };

  // Show short address
  const shortAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : 'Unknown';

  return (
    <div className="w-full max-w-md mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
          <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-text-primary">Unlock Wallet</h2>
        <p className="text-text-secondary text-sm">
          Enter your password to access <span className="font-mono text-primary">{shortAddress}</span>
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Enter password"
            autoFocus
            className="w-full h-12 rounded-lg border border-white/10 bg-[#0f1729] px-4 text-text-primary focus:border-primary focus:outline-none"
          />
        </div>

        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}

        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={handleUnlock}
          disabled={isLoading}
          className="w-full h-12 rounded-lg bg-primary text-primary-text font-semibold disabled:opacity-50"
        >
          {isLoading ? 'Unlocking...' : 'Unlock'}
        </motion.button>

        <div className="text-center">
          <button
            onClick={() => setShowReset(!showReset)}
            className="text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            Forgot password?
          </button>
        </div>

        {showReset && (
          <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 space-y-3">
            <p className="text-sm text-red-200">
              If you forgot your password, you'll need to reset your wallet and import using your seed phrase.
            </p>
            <button
              onClick={handleReset}
              className="w-full py-2 px-4 rounded-lg bg-red-500/20 text-red-200 text-sm font-medium hover:bg-red-500/30 transition-colors"
            >
              Reset Wallet
            </button>
          </div>
        )}
      </div>

      <div className="p-4 rounded-lg bg-white/5 border border-white/10">
        <p className="text-xs text-text-secondary text-center">
          Your wallet is encrypted locally. We never have access to your password or private keys.
        </p>
      </div>
    </div>
  );
};

export default UnlockWallet;
