/**
 * Wallet Setup Component - Passkey Edition
 * Self-custodial wallet creation with WebAuthn/Passkey
 * NO PASSWORDS - NO SEED PHRASES
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useSelfCustodialWallet } from '../contexts/SelfCustodialWalletContext';
import { useSession } from '../contexts/SessionContext';
import { passkeyClient } from '../services/passkeyClient';
import { WaveBackground } from './WaveBackground';
import arcLogo from '../assets/arclogo.png';
import { Footer } from './Footer';

interface WalletSetupProps {
  onComplete: () => void;
}

const WalletSetup: React.FC<WalletSetupProps> = ({ onComplete }) => {
  const { createWallet, recoverWithExistingPasskey, unlockWallet, isConnecting, hasWallet } = useSelfCustodialWallet();
  const { currentEmail } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('Waiting for verified email...');
  const [isCreating, setIsCreating] = useState(false);
  const [autoStarted, setAutoStarted] = useState(false);

  // State to track if user has passkey on server (even if local wallet is missing)
  const [hasServerPasskey, setHasServerPasskey] = useState<boolean | null>(null);

  // Check server for existing passkey on mount
  useEffect(() => {
    const checkServerPasskey = async () => {
      if (!currentEmail) return;
      try {
        const response = await passkeyClient.checkUserPasskeys(currentEmail);
        const hasPasskey = response.data?.hasPasskey ?? false;
        console.log('[WalletSetup] Server passkey check:', { email: currentEmail, hasPasskey });
        setHasServerPasskey(hasPasskey);
      } catch (error) {
        console.error('[WalletSetup] Failed to check server passkey:', error);
        setHasServerPasskey(false);
      }
    };
    checkServerPasskey();
  }, [currentEmail]);

  // Handle wallet creation or unlock with passkey
  const handleWalletAccess = useCallback(async (auto = false) => {
    setError(null);

    if (!currentEmail) {
      if (!auto) {
        setError('Please verify your email before accessing wallet.');
      }
      return;
    }

    setIsCreating(true);

    try {
      // IMPORTANT: Check if user already has a passkey on the server
      // This handles the case where local storage was cleared but passkey exists
      const serverCheck = await passkeyClient.checkUserPasskeys(currentEmail);
      const userHasServerPasskey = serverCheck.data?.hasPasskey ?? false;

      console.log('[WalletSetup] Wallet access check:', {
        hasLocalWallet: hasWallet,
        hasServerPasskey: userHasServerPasskey,
        email: currentEmail
      });

      if (hasWallet) {
        // Local wallet exists - unlock with passkey
        console.log('[WalletSetup] Unlocking existing local wallet with passkey...');
        setStatusMessage(`Authenticating ${currentEmail} with passkey...`);
        await unlockWallet();
        console.log('[WalletSetup] Wallet unlocked successfully');
        setStatusMessage('Wallet unlocked successfully. Loading dashboard...');
      } else if (userHasServerPasskey) {
        // No local wallet but passkey exists on server
        // User cleared cookies/storage - recover using existing passkey
        console.log('[WalletSetup] No local wallet but server has passkey - recovering...');
        setStatusMessage(`Recovering wallet with your passkey...`);

        // IMPORTANT: Since IndexedDB was cleared, the encrypted private key is LOST
        // But we can authenticate with the EXISTING passkey and create a new wallet
        // This gives the user a new address but preserves their passkey
        // TODO: In Phase 3, implement server-side backup to restore original address

        try {
          await recoverWithExistingPasskey();
          console.log('[WalletSetup] Wallet recovered with existing passkey');
          setStatusMessage('Wallet recovered. Note: Your wallet address has changed due to cleared storage.');
        } catch (recoveryError: any) {
          // If recovery fails, fall back to creating a new wallet
          console.warn('[WalletSetup] Recovery failed, creating new wallet:', recoveryError.message);
          const userName = currentEmail.split('@')[0];
          await createWallet(currentEmail, userName);
          console.log('[WalletSetup] New wallet created as fallback');
          setStatusMessage('New wallet created.');
        }
      } else {
        // New user - create wallet with new passkey
        console.log('[WalletSetup] Creating new wallet with passkey...');
        setStatusMessage(`Requesting biometric approval for ${currentEmail}...`);
        const userName = currentEmail.split('@')[0];
        await createWallet(currentEmail, userName);
        console.log('[WalletSetup] Wallet created successfully');
        setStatusMessage('Wallet created successfully. Loading dashboard...');
      }

      onComplete();
    } catch (err: any) {
      console.error('[WalletSetup] Wallet access failed:', err);

      // Handle specific WebAuthn errors
      if (err.message?.includes('User cancelled') || err.message?.includes('cancelled')) {
        setError('Biometric authentication was cancelled. Please try again.');
      } else if (err.message?.includes('not supported')) {
        setError('Your device does not support biometric authentication. Please use a compatible device.');
      } else if (err.message?.includes('not available')) {
        setError('Biometric authentication is not available. Please enable it in your device settings.');
      } else if (err.message?.includes('Failed to fetch')) {
        setError('Could not reach the passkey API. Please make sure the backend is running and reachable.');
      } else if (err.message?.includes('passkey already exists') || err.message?.includes('already registered')) {
        // Passkey already exists - this means we should authenticate, not register
        setError('A passkey already exists for this email. Please use your existing passkey to authenticate.');
      } else {
        setError(err.message || `Failed to ${hasWallet ? 'unlock' : 'create'} wallet. Please try again.`);
      }
    } finally {
      setIsCreating(false);
      if (currentEmail) {
        setStatusMessage('Biometric prompt dismissed. Use Retry to try again.');
      }
    }
  }, [createWallet, unlockWallet, onComplete, currentEmail, hasWallet]);

  useEffect(() => {
    if (!autoStarted && !isCreating && currentEmail) {
      setAutoStarted(true);
      setStatusMessage(`Preparing ${hasWallet ? 'authentication' : 'wallet creation'} for ${currentEmail}...`);
      void handleWalletAccess(true);
    }
  }, [autoStarted, isCreating, handleWalletAccess, currentEmail, hasWallet]);

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
          </div>

          {/* Form */}
          <div className="space-y-6">
            <div className="rounded-lg bg-slate-900/60 border border-slate-600/40 px-4 py-4">
              <p className="text-xs uppercase tracking-widest text-slate-500 mb-1">Email</p>
              <p className="text-base font-mono text-slate-100">
                {currentEmail ?? 'Verifying...'}
              </p>
            </div>

            {error && (
              <div className="p-3 rounded-lg backdrop-blur-sm border bg-red-900/20 border-red-500/50 text-red-200 text-center text-sm">
                {error}
              </div>
            )}

            <button
              onClick={() => handleWalletAccess()}
              disabled={isConnecting || isCreating || !currentEmail}
              className="w-full bg-slate-200 hover:bg-white text-slate-900 font-medium text-lg py-4 rounded-lg transition-all duration-200 shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isCreating ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>{hasWallet ? 'Unlocking wallet...' : 'Creating wallet...'}</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span>
                    {!currentEmail ? 'Waiting for email...' : hasWallet ? 'Unlock Wallet with Passkey' : 'Create Wallet with Passkey'}
                  </span>
                </>
              )}
            </button>
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
