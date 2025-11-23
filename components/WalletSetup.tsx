/**
 * Wallet Setup Component - Passkey Edition
 * Self-custodial wallet creation with WebAuthn/Passkey
 * NO PASSWORDS - NO SEED PHRASES
 */

import React, { useState } from 'react';
import { useSelfCustodialWallet } from '../contexts/SelfCustodialWalletContext';
import { WaveBackground } from './WaveBackground';
import arcLogo from '../assets/arclogo.png';
import { Footer } from './Footer';

interface WalletSetupProps {
  onComplete: () => void;
}

const WalletSetup: React.FC<WalletSetupProps> = ({ onComplete }) => {
  const { createWallet, isConnecting } = useSelfCustodialWallet();

  const [userName, setUserName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Handle wallet creation with passkey
  const handleCreate = async () => {
    setError(null);

    if (!userName.trim()) {
      setError('Please enter your name');
      return;
    }

    setIsCreating(true);

    try {
      console.log('[WalletSetup] Creating wallet with passkey...');
      await createWallet(userName.trim());
      console.log('[WalletSetup] Wallet created successfully');
      onComplete();
    } catch (err: any) {
      console.error('[WalletSetup] Creation failed:', err);

      // Handle specific WebAuthn errors
      if (err.message?.includes('User cancelled') || err.message?.includes('cancelled')) {
        setError('Biometric authentication was cancelled. Please try again.');
      } else if (err.message?.includes('not supported')) {
        setError('Your device does not support biometric authentication. Please use a compatible device.');
      } else if (err.message?.includes('not available')) {
        setError('Biometric authentication is not available. Please enable it in your device settings.');
      } else {
        setError(err.message || 'Failed to create wallet. Please try again.');
      }
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 w-full h-full flex flex-col items-center justify-center overflow-hidden bg-transparent">
      {/* Background Pattern */}
      <div className="absolute inset-0 z-0">
        <WaveBackground />
      </div>

      {/* Top Left Logo */}
      <div className="absolute top-8 left-8 z-20 opacity-90 hover:opacity-100 transition-opacity cursor-pointer">
        <img
          src={arcLogo}
          alt="Arc Wallet"
          className="w-20 h-20 object-contain drop-shadow-[0_0_20px_rgba(255,255,255,0.6)]"
        />
      </div>

      {/* Setup Container */}
      <div className="relative z-20 w-full max-w-lg px-4 animate-in fade-in zoom-in duration-700">
        <div className="space-y-8">
          {/* Header */}
          <div className="text-center space-y-4">
            <h2 className="text-4xl font-light text-slate-100 tracking-tight drop-shadow-lg">
              Create Your Wallet
            </h2>
            <p className="text-slate-400 text-lg">
              Secure your wallet with biometric authentication
            </p>
          </div>

          {/* Security Notice */}
          <div className="p-6 rounded-lg bg-blue-900/20 border border-blue-500/50 backdrop-blur-sm space-y-3">
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-blue-300 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <div className="space-y-2">
                <p className="text-sm text-blue-200 font-medium">
                  No passwords. No seed phrases.
                </p>
                <ul className="text-sm text-blue-200/80 space-y-1">
                  <li>• Use FaceID, TouchID, or device passcode</li>
                  <li>• Private key stored in device's Secure Enclave</li>
                  <li>• Your keys never leave your device</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="space-y-6">
            <div className="group">
              <label className="block text-sm font-medium text-slate-400 mb-2">
                Your Name
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && userName.trim() && !isCreating) {
                      handleCreate();
                    }
                  }}
                  placeholder="Enter your name"
                  disabled={isCreating}
                  className="w-full bg-slate-900/60 border border-slate-500/50 rounded-lg px-4 py-4 text-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all backdrop-blur-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  autoFocus
                />
                <div className="absolute inset-0 rounded-lg bg-blue-500/5 opacity-0 group-focus-within:opacity-100 pointer-events-none transition-opacity duration-500" />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                This will be used to identify your wallet
              </p>
            </div>

            {error && (
              <div className="p-3 rounded-lg backdrop-blur-sm border bg-red-900/20 border-red-500/50 text-red-200 text-center text-sm">
                {error}
              </div>
            )}

            <button
              onClick={handleCreate}
              disabled={isConnecting || isCreating || !userName.trim()}
              className="w-full bg-slate-200 hover:bg-white text-slate-900 font-medium text-lg py-4 rounded-lg transition-all duration-200 shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isCreating ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Waiting for biometric...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
                  </svg>
                  <span>Create Wallet with Biometric</span>
                </>
              )}
            </button>

            {/* Info Cards */}
            <div className="grid grid-cols-3 gap-3 pt-4">
              <div className="p-4 rounded-lg bg-slate-900/40 border border-slate-500/30 text-center flex flex-col items-center gap-2">
                <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <p className="text-xs text-slate-400 font-medium">Secure Enclave</p>
              </div>
              <div className="p-4 rounded-lg bg-slate-900/40 border border-slate-500/30 text-center flex flex-col items-center gap-2">
                <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
                </svg>
                <p className="text-xs text-slate-400 font-medium">Biometric Auth</p>
              </div>
              <div className="p-4 rounded-lg bg-slate-900/40 border border-slate-500/30 text-center flex flex-col items-center gap-2">
                <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <p className="text-xs text-slate-400 font-medium">Self-Custodial</p>
              </div>
            </div>
          </div>

          {/* Self-Custodial Notice */}
          <div className="p-4 rounded-lg bg-amber-900/20 border border-amber-500/50 backdrop-blur-sm">
            <p className="text-sm text-amber-200">
              <strong>Self-Custodial:</strong> Your private keys are encrypted and stored only on this device.
              We never have access to your keys. Only you can access your wallet through biometric authentication.
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

export default WalletSetup;
