/**
 * Unlock Wallet Component - Passkey Edition
 * Biometric authentication to unlock wallet
 * NO PASSWORDS
 */

import React, { useState } from 'react';
import { useSelfCustodialWallet } from '../contexts/SelfCustodialWalletContext';
import { WaveBackground } from './WaveBackground';
import arcLogo from '../assets/arclogo.png';
import { Footer } from './Footer';

interface UnlockWalletProps {
  onUnlock: () => void;
  onReset?: () => void;
}

const UnlockWallet: React.FC<UnlockWalletProps> = ({ onUnlock, onReset }) => {
  const { unlockWallet, address, deleteWallet } = useSelfCustodialWallet();

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);

  const handleUnlock = async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('[UnlockWallet] Unlocking with biometric...');
      await unlockWallet();
      console.log('[UnlockWallet] Unlock successful');
      onUnlock();
    } catch (err: any) {
      console.error('[UnlockWallet] Unlock failed:', err);

      // Handle specific errors
      if (err.message?.includes('User cancelled') || err.message?.includes('cancelled')) {
        setError('Biometric authentication was cancelled. Please try again.');
      } else if (err.message?.includes('not supported')) {
        setError('Your device does not support biometric authentication.');
      } else if (err.message?.includes('not available')) {
        setError('Biometric authentication is not available. Please enable it in your device settings.');
      } else {
        setError(err.message || 'Failed to unlock wallet. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = async () => {
    if (window.confirm('Are you sure you want to reset your wallet? This will delete your encrypted wallet permanently. This action cannot be undone.')) {
      try {
        await deleteWallet();
        onReset?.();
      } catch (error) {
        console.error('[UnlockWallet] Reset failed:', error);
        setError('Failed to reset wallet. Please try again.');
      }
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
              Use biometric authentication to access <span className="font-mono text-blue-400">{shortAddress}</span>
            </p>
          </div>

          {/* Unlock Section */}
          <div className="space-y-6">
            {/* Biometric Info */}
            <div className="p-6 rounded-lg bg-blue-900/20 border border-blue-500/50 backdrop-blur-sm">
              <div className="flex items-start gap-3">
                <svg className="w-6 h-6 text-blue-300 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
                </svg>
                <div>
                  <p className="text-sm text-blue-200 font-medium mb-1">
                    Secure Authentication
                  </p>
                  <p className="text-sm text-blue-200/80">
                    Your wallet is protected by your device's biometric authentication (FaceID, TouchID, or device passcode).
                  </p>
                </div>
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
              className="w-full bg-slate-200 hover:bg-white text-slate-900 font-medium text-lg py-4 rounded-lg transition-all duration-200 shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                  </svg>
                  <span>Unlock with Biometric</span>
                </>
              )}
            </button>

            {/* Forgot Password Link */}
            <div className="text-center">
              <button
                onClick={() => setShowReset(!showReset)}
                className="text-sm text-slate-400 hover:text-blue-400 transition-colors"
              >
                Can't unlock your wallet?
              </button>
            </div>

            {/* Reset Warning */}
            {showReset && (
              <div className="p-5 rounded-lg bg-red-900/20 border border-red-500/50 backdrop-blur-sm space-y-4">
                <p className="text-sm text-red-200">
                  If you can't unlock your wallet, you'll need to reset it. This will permanently delete your encrypted wallet from this device.
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
              Your wallet is encrypted locally. We never have access to your private keys or biometric data.
            </p>
          </div>
        </div>
      </div>

      <Footer />

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
