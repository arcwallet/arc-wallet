/**
 * Wallet Setup Component - Circle Modular Wallet Edition
 *
 * FLOW:
 * 1. Email verified -> Auto-trigger passkey login
 * 2. If passkey exists -> Connect directly
 * 3. If no passkey found -> Show "Create Wallet" option
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useCircleWallet } from '../contexts/CircleWalletContext';
import { useSession } from '../contexts/SessionContext';
import { WaveBackground } from './WaveBackground';
import arcLogo from '../assets/arclogo.png';
import { Footer } from './Footer';

interface WalletSetupProps {
  onComplete: () => void;
}

type SetupState = 'checking' | 'no_wallet' | 'connecting' | 'creating' | 'error';

const WalletSetup: React.FC<WalletSetupProps> = ({ onComplete }) => {
  const {
    createWallet,
    login,
    isConnecting,
    isConnected,
    isReconnecting,
    hasStoredSession,
    tryReconnect,
    error: contextError,
  } = useCircleWallet();

  const { currentEmail } = useSession();
  const [setupState, setSetupState] = useState<SetupState>('checking');
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [checkAttempted, setCheckAttempted] = useState(false);

  // Update error from context
  useEffect(() => {
    if (contextError) {
      setError(contextError);
    }
  }, [contextError]);

  // Check if connected and call onComplete
  useEffect(() => {
    if (isConnected) {
      onComplete();
    }
  }, [isConnected, onComplete]);

  // Auto-check for existing wallet on page load
  useEffect(() => {
    if (checkAttempted || isConnected || isConnecting || isReconnecting || !currentEmail) {
      return;
    }

    const checkExistingWallet = async () => {
      setCheckAttempted(true);
      setSetupState('checking');
      setStatusMessage('Checking for existing wallet...');

      try {
        // First try stored session (faster, no passkey prompt)
        if (hasStoredSession) {
          setStatusMessage('Reconnecting to your wallet...');
          const success = await tryReconnect();
          if (success) return; // Will trigger onComplete via isConnected
        }

        // Try to login with existing passkey
        setStatusMessage('Looking for your passkey...');
        await login();
        // If successful, isConnected will become true and trigger onComplete

      } catch (err: any) {
        const errorMessage = err.message?.toLowerCase() || '';

        // Check if error indicates no passkey found
        if (
          errorMessage.includes('no credential') ||
          errorMessage.includes('credential not found') ||
          errorMessage.includes('not found') ||
          errorMessage.includes('no passkey') ||
          errorMessage.includes('no authenticator') ||
          errorMessage.includes('the operation either timed out or was not allowed')
        ) {
          // No existing wallet - show create option
          console.log('[WalletSetup] No existing passkey found, showing create option');
          setSetupState('no_wallet');
          setStatusMessage('');
          setError(null);
        } else if (
          errorMessage.includes('cancelled') ||
          errorMessage.includes('canceled') ||
          errorMessage.includes('user refused') ||
          errorMessage.includes('aborted')
        ) {
          // User cancelled - show create option (they might not have a wallet)
          console.log('[WalletSetup] User cancelled passkey check');
          setSetupState('no_wallet');
          setStatusMessage('');
          setError(null);
        } else {
          // Other error
          console.error('[WalletSetup] Wallet check error:', err.message);
          setSetupState('error');
          setError(err.message || 'Connection failed. Please try again.');
        }
      }
    };

    // Small delay for UI
    const timer = setTimeout(checkExistingWallet, 500);
    return () => clearTimeout(timer);
  }, [currentEmail, checkAttempted, isConnected, isConnecting, isReconnecting, hasStoredSession, tryReconnect, login]);

  // Handle wallet creation
  const handleCreateWallet = useCallback(async () => {
    if (!currentEmail) {
      setError('Please verify your email first.');
      return;
    }

    setSetupState('creating');
    setError(null);
    setStatusMessage('Creating your wallet...');

    try {
      await createWallet();
      setStatusMessage('Wallet created successfully!');
    } catch (err: any) {
      console.error('[WalletSetup] Create wallet failed:', err);
      const errorMessage = err.message?.toLowerCase() || '';

      if (errorMessage.includes('cancelled') || errorMessage.includes('canceled')) {
        setSetupState('no_wallet');
        setStatusMessage('');
        setError(null);
      } else {
        setSetupState('error');
        setError(err.message || 'Failed to create wallet. Please try again.');
      }
    }
  }, [createWallet, currentEmail]);

  // Handle retry connection
  const handleRetryConnect = useCallback(async () => {
    setSetupState('connecting');
    setError(null);
    setStatusMessage('Connecting to your wallet...');

    try {
      await login();
    } catch (err: any) {
      const errorMessage = err.message?.toLowerCase() || '';

      if (
        errorMessage.includes('no credential') ||
        errorMessage.includes('not found') ||
        errorMessage.includes('cancelled') ||
        errorMessage.includes('canceled')
      ) {
        setSetupState('no_wallet');
        setStatusMessage('');
        setError(null);
      } else {
        setSetupState('error');
        setError(err.message || 'Connection failed.');
      }
    }
  }, [login]);

  // Render checking state
  const renderChecking = () => (
    <div className="space-y-6">
      <div className="w-full bg-slate-800/60 text-slate-200 font-medium text-lg py-4 rounded-lg flex items-center justify-center gap-3">
        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <span>{statusMessage || 'Checking...'}</span>
      </div>
    </div>
  );

  // Render no wallet state (create new)
  const renderNoWallet = () => (
    <div className="space-y-6">
      <div className="text-center mb-4">
        <p className="text-slate-400 text-sm">
          No wallet found for this email. Create one to get started.
        </p>
      </div>

      <button
        onClick={handleCreateWallet}
        disabled={isConnecting || !currentEmail}
        className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 text-white font-semibold text-lg py-4 rounded-lg transition-all duration-200 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        <span>Create Wallet</span>
      </button>

      <p className="text-center text-slate-500 text-xs">
        A passkey will be created on your device
      </p>
    </div>
  );

  // Render creating state
  const renderCreating = () => (
    <div className="space-y-6">
      <div className="w-full bg-gradient-to-r from-blue-500/80 to-cyan-500/80 text-white font-medium text-lg py-4 rounded-lg flex items-center justify-center gap-3">
        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <span>Creating your wallet...</span>
      </div>

      <p className="text-center text-slate-400 text-sm">
        Please complete the passkey authentication on your device
      </p>
    </div>
  );

  // Render error state
  const renderError = () => (
    <div className="space-y-6">
      <button
        onClick={handleRetryConnect}
        disabled={isConnecting}
        className="w-full bg-slate-200 hover:bg-white text-slate-900 font-medium text-lg py-4 rounded-lg transition-all duration-200 shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] disabled:opacity-50 flex items-center justify-center gap-2"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        <span>Try Again</span>
      </button>

      <button
        onClick={handleCreateWallet}
        disabled={isConnecting}
        className="w-full bg-transparent hover:bg-slate-800/50 text-slate-300 hover:text-white font-medium py-4 rounded-lg transition-all duration-200 border border-slate-600/50 hover:border-slate-500 flex items-center justify-center gap-2"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        <span>Create New Wallet</span>
      </button>
    </div>
  );

  // Get header text
  const getHeaderText = () => {
    switch (setupState) {
      case 'checking':
        return 'Connecting';
      case 'no_wallet':
        return 'Welcome';
      case 'creating':
        return 'Creating Wallet';
      case 'connecting':
        return 'Connecting';
      case 'error':
        return 'Connection Issue';
      default:
        return 'Welcome';
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
              {getHeaderText()}
            </h2>
            <p className="text-sm text-slate-400">
              Secure Smart Contract Wallet with Passkey
            </p>
          </div>

          {/* Form */}
          <div className="space-y-6">
            {/* Email Display */}
            <div className="rounded-lg bg-slate-900/60 border border-slate-600/40 px-4 py-4">
              <p className="text-xs uppercase tracking-widest text-slate-500 mb-1">Email</p>
              <p className="text-base font-mono text-slate-100">
                {currentEmail ?? 'Verifying...'}
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-lg backdrop-blur-sm border bg-red-900/20 border-red-500/50 text-red-200 text-center text-sm">
                {error}
              </div>
            )}

            {/* Status Message for checking/connecting */}
            {statusMessage && !error && (setupState === 'checking' || setupState === 'connecting') && (
              <div className="p-3 rounded-lg backdrop-blur-sm border bg-blue-900/20 border-blue-500/40 text-blue-200 text-center text-sm">
                {statusMessage}
              </div>
            )}

            {/* Render appropriate UI based on state */}
            {setupState === 'checking' || setupState === 'connecting' ? renderChecking() : null}
            {setupState === 'no_wallet' ? renderNoWallet() : null}
            {setupState === 'creating' ? renderCreating() : null}
            {setupState === 'error' ? renderError() : null}

            {/* Circle Badge */}
            <div className="flex items-center justify-center gap-2 pt-2">
              <span className="text-xs text-slate-600">Powered by</span>
              <span className="text-xs font-medium text-slate-400">Circle Modular Wallet</span>
            </div>
          </div>
        </div>
      </div>

      <Footer />

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes zoom-in {
          from { transform: scale(0.95); }
          to { transform: scale(1); }
        }
        .animate-in {
          animation: fade-in 0.7s ease-out, zoom-in 0.7s ease-out;
        }
      `}</style>
    </div>
  );
};

export default WalletSetup;
