/**
 * Unlock Wallet Component
 * Password entry to decrypt local wallet
 */

import React, { useState } from 'react';
import { useSelfCustodialWallet } from '../contexts/SelfCustodialWalletContext';
import { WaveBackground } from './WaveBackground';
import arcLogo from '../assets/arclogo.png';

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
    <div className="fixed inset-0 w-full h-full flex flex-col items-center justify-center overflow-hidden bg-transparent">
      {/* Background Pattern */}
      <div className="absolute inset-0 z-0">
        <WaveBackground showAnimation={true} />
      </div>

      {/* Top Left Logo */}
      <div className="absolute top-8 left-8 z-20 opacity-90 hover:opacity-100 transition-opacity cursor-pointer">
        <img src={arcLogo} alt="Arc Wallet" className="w-20 h-20 object-contain drop-shadow-[0_0_20px_rgba(255,255,255,0.6)]" />
      </div>

      {/* Unlock Container */}
      <div className="relative z-20 w-full max-w-md px-4 animate-in fade-in zoom-in duration-700">
        <div className="space-y-8">
          {/* Lock Icon & Title */}
          <div className="text-center space-y-4">
            <div className="w-24 h-24 mx-auto rounded-full bg-blue-500/10 border border-blue-400/30 flex items-center justify-center backdrop-blur-sm">
              <svg className="w-12 h-12 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-4xl font-light text-slate-100 tracking-tight drop-shadow-lg">
              Unlock Wallet
            </h2>
            <p className="text-slate-400 text-lg">
              Enter your password to access <span className="font-mono text-blue-400">{shortAddress}</span>
            </p>
          </div>

          {/* Password Input */}
          <div className="space-y-6">
            <div className="group">
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Enter password"
                  autoFocus
                  className="w-full bg-slate-900/60 border border-slate-500/50 rounded-lg px-4 py-4 text-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all backdrop-blur-sm"
                />
                <div className="absolute inset-0 rounded-lg bg-blue-500/5 opacity-0 group-focus-within:opacity-100 pointer-events-none transition-opacity duration-500" />
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-lg backdrop-blur-sm border bg-red-900/20 border-red-500/50 text-red-200 text-center text-sm">
                {error}
              </div>
            )}

            <button
              onClick={handleUnlock}
              disabled={isLoading}
              className="w-full bg-slate-200 hover:bg-white text-slate-900 font-medium text-lg py-3.5 rounded-lg transition-all duration-200 shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Unlocking...' : 'Unlock'}
            </button>

            {/* Forgot Password Link */}
            <div className="text-center">
              <button
                onClick={() => setShowReset(!showReset)}
                className="text-sm text-slate-400 hover:text-blue-400 transition-colors"
              >
                Forgot password?
              </button>
            </div>

            {/* Reset Warning */}
            {showReset && (
              <div className="p-5 rounded-lg bg-red-900/20 border border-red-500/50 backdrop-blur-sm space-y-4">
                <p className="text-sm text-red-200">
                  If you forgot your password, you'll need to reset your wallet and import using your seed phrase.
                </p>
                <button
                  onClick={handleReset}
                  className="w-full py-3 px-4 rounded-lg bg-red-500/20 text-red-200 text-sm font-medium hover:bg-red-500/30 transition-colors border border-red-500/30"
                >
                  Reset Wallet
                </button>
              </div>
            )}
          </div>

          {/* Security Note */}
          <div className="p-4 rounded-lg bg-slate-900/40 border border-slate-600/30 backdrop-blur-sm">
            <p className="text-xs text-slate-400 text-center leading-relaxed">
              Your wallet is encrypted locally. We never have access to your password or private keys.
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes zoom-in {
          from {
            transform: scale(0.95);
          }
          to {
            transform: scale(1);
          }
        }
        .animate-in {
          animation: fade-in 0.7s ease-out, zoom-in 0.7s ease-out;
        }
      `}</style>
    </div>
  );
};

export default UnlockWallet;
