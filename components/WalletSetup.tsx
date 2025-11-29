/**
 * Wallet Setup Component - Smart Contract Passkey Edition
 *
 * ARCHITECTURE:
 * - Passkey (P256) IS the signing key - NO private key stored
 * - Smart contract verifies P256 signatures on-chain
 * - Pimlico bundler submits UserOperations to Arc Testnet
 * - Same passkey = Same wallet address (even after clearing storage)
 *
 * Arc Testnet + Pimlico = Full ERC-4337 Support!
 */

import React, { useCallback, useEffect, useState } from 'react';
import { usePasskeyAccount } from '../contexts/PasskeyAccountContext';
import { useSession } from '../contexts/SessionContext';
import { passkeyClient } from '../services/passkeyClient';
import { WaveBackground } from './WaveBackground';
import arcLogo from '../assets/arclogo.png';
import { Footer } from './Footer';

interface WalletSetupProps {
  onComplete: () => void;
}

const WalletSetup: React.FC<WalletSetupProps> = ({ onComplete }) => {
  // Use PasskeyAccount (Smart Contract with P256 signing)
  // Pimlico bundler handles UserOperation submission
  const {
    createAccount,
    connect,
    isConnecting,
  } = usePasskeyAccount();

  const { currentEmail, walletAddress: existingWalletAddress, hasWallet: hasExistingWallet } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('Waiting for verified email...');
  const [isCreating, setIsCreating] = useState(false);
  const [autoStarted, setAutoStarted] = useState(false);

  // State to track if user has passkey on server
  const [hasServerPasskey, setHasServerPasskey] = useState<boolean | null>(null);

  // Detect legacy wallet migration scenario
  const hasLegacyWallet = hasExistingWallet && existingWalletAddress && !hasServerPasskey;

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

  // Handle wallet creation or connection with passkey
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
      // NEW APPROACH: Always try connect() first!
      // WebAuthn credentials are stored on the DEVICE, not just on server
      // If user has a passkey on this device, WebAuthn will find it
      console.log('[WalletSetup] Attempting to connect with existing passkey first...');
      setStatusMessage(`Looking for existing passkey for ${currentEmail}...`);

      try {
        // Try to connect with existing passkey on device
        const result = await connect();
        console.log('[WalletSetup] Connected to Smart Contract Wallet:', result.address);
        setStatusMessage('Connected successfully. Loading dashboard...');
        onComplete();
        return;
      } catch (connectErr: any) {
        const connectError = connectErr.message?.toLowerCase() || '';
        console.log('[WalletSetup] Connect attempt failed:', connectError);

        // If user cancelled or dismissed, don't create new - let them try again
        if (connectError.includes('cancelled') || connectError.includes('canceled') ||
            connectError.includes('user refused') || connectError.includes('timed out') ||
            connectError.includes('not allowed')) {
          throw connectErr; // Re-throw to handle in outer catch
        }

        // If no credential found on device, fall back to creating new
        if (connectError.includes('no credential') || connectError.includes('not found') ||
            connectError.includes('no passkey') || connectError.includes('could not find')) {
          console.log('[WalletSetup] No existing passkey found on device, creating new...');
          setStatusMessage(`Creating new wallet for ${currentEmail}...`);

          const result = await createAccount();
          console.log('[WalletSetup] Smart Contract Wallet created:', result.address);
          setStatusMessage('Wallet created successfully. Loading dashboard...');
          onComplete();
          return;
        }

        // For other errors, re-throw
        throw connectErr;
      }
    } catch (err: any) {
      console.error('[WalletSetup] Wallet access failed:', err);

      // Handle specific WebAuthn errors with user-friendly messages
      const errorMessage = err.message?.toLowerCase() || '';

      if (errorMessage.includes('cancelled') || errorMessage.includes('canceled') || errorMessage.includes('user refused')) {
        // User cancelled - not an error, just info
        setError(null);
        setStatusMessage('Authentication cancelled. Tap the button to try again.');
      } else if (errorMessage.includes('timed out') || errorMessage.includes('not allowed')) {
        // Timeout or user dismissed the prompt
        setError(null);
        setStatusMessage('Authentication was dismissed. Tap the button when ready.');
      } else if (errorMessage.includes('not supported')) {
        setError('Your device does not support passkey authentication.');
      } else if (errorMessage.includes('not available')) {
        setError('Passkey authentication is not available. Please check your device settings.');
      } else if (errorMessage.includes('failed to fetch') || errorMessage.includes('network')) {
        setError('Connection error. Please check your internet and try again.');
      } else if (errorMessage.includes('passkey already exists') || errorMessage.includes('already registered') || errorMessage.includes('already have a passkey')) {
        // Passkey exists - try to connect instead
        // This is a security measure: each passkey generates a different wallet address
        // Allowing multiple passkeys would cause users to lose access to their funds
        setStatusMessage('Passkey found for this email. Connecting to your existing wallet...');
        try {
          await connect();
          onComplete();
          return;
        } catch (connectErr) {
          setError('Could not connect with existing passkey. Please use the same device/browser where you created your passkey.');
        }
      } else if (errorMessage.includes('credential not found')) {
        setError('Passkey not found. Please create a new wallet.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setIsCreating(false);
    }
  }, [createAccount, connect, onComplete, currentEmail]);

  // Auto-start wallet access when email is verified
  // Skip auto-start if user has legacy wallet without passkey (show warning first)
  useEffect(() => {
    if (!autoStarted && !isCreating && currentEmail && hasServerPasskey !== null) {
      // Don't auto-start for legacy wallet users - let them see the warning
      if (hasExistingWallet && existingWalletAddress && hasServerPasskey === false) {
        setAutoStarted(true);
        setStatusMessage('Please review the migration notice below.');
        return;
      }
      setAutoStarted(true);
      setStatusMessage(`Preparing wallet for ${currentEmail}...`);
      void handleWalletAccess(true);
    }
  }, [autoStarted, isCreating, handleWalletAccess, currentEmail, hasServerPasskey, hasExistingWallet, existingWalletAddress]);

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
              {hasServerPasskey ? 'Welcome Back' : 'Create Your Wallet'}
            </h2>
            <p className="text-sm text-slate-400">
              Smart Contract Wallet with Passkey Security
            </p>
          </div>

          {/* Form */}
          <div className="space-y-6">
            <div className="rounded-lg bg-slate-900/60 border border-slate-600/40 px-4 py-4">
              <p className="text-xs uppercase tracking-widest text-slate-500 mb-1">Email</p>
              <p className="text-base font-mono text-slate-100">
                {currentEmail ?? 'Verifying...'}
              </p>
            </div>

            {/* Legacy wallet migration warning */}
            {hasLegacyWallet && hasServerPasskey === false && (
              <div className="p-4 rounded-lg backdrop-blur-sm border bg-amber-900/20 border-amber-500/50 text-amber-200 text-sm">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <p className="font-medium mb-1">Existing Wallet Detected</p>
                    <p className="text-xs text-amber-300/80 mb-2">
                      You have an existing wallet at <span className="font-mono">{existingWalletAddress?.slice(0, 8)}...{existingWalletAddress?.slice(-6)}</span>
                    </p>
                    <p className="text-xs text-amber-300/80">
                      Creating a new passkey will generate a <strong>new wallet address</strong>. If you have funds in your old wallet, please transfer them after setup.
                    </p>
                  </div>
                </div>
              </div>
            )}

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
              {isCreating || isConnecting ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>{hasServerPasskey ? 'Connecting...' : 'Creating wallet...'}</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span>
                    {!currentEmail
                      ? 'Waiting for email...'
                      : hasServerPasskey
                        ? 'Connect with Passkey'
                        : 'Create Wallet with Passkey'}
                  </span>
                </>
              )}
            </button>

            {/* Info text */}
            <p className="text-xs text-center text-slate-500">
              Your passkey is your wallet. No seed phrases or passwords needed.
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
