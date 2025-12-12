/**
 * Wallet Setup Component - Circle Modular Wallet Edition
 *
 * ARCHITECTURE:
 * - Uses Circle's Modular Smart Contract Account (MSCA)
 * - Passkey (P256) authentication via Circle's infrastructure
 * - ERC-4337 + ERC-6900 compliant smart accounts
 * - Same passkey = Same wallet address (deterministic)
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

const WalletSetup: React.FC<WalletSetupProps> = ({ onComplete }) => {
  // Use Circle Wallet (Modular Smart Contract Account)
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
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('Waiting for verified email...');
  const [isCreating, setIsCreating] = useState(false);
  const [mode, setMode] = useState<'initial' | 'create' | 'connect'>('initial');
  const [autoReconnectAttempted, setAutoReconnectAttempted] = useState(false);

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

  // Auto-reconnect on page load if there's a stored session
  useEffect(() => {
    if (autoReconnectAttempted || isConnected || isReconnecting) {
      return;
    }

    if (hasStoredSession && currentEmail) {
      setAutoReconnectAttempted(true);
      setMode('connect');
      setStatusMessage('Reconnecting to your wallet...');

      // Small delay to show UI, then trigger passkey
      const timer = setTimeout(() => {
        tryReconnect().then((success) => {
          if (!success) {
            // Auto-reconnect failed, show login options
            setMode('initial');
            setStatusMessage('');
          }
        });
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [hasStoredSession, currentEmail, autoReconnectAttempted, isConnected, isReconnecting, tryReconnect]);

  // Handle wallet creation with new passkey
  const handleCreateWallet = useCallback(async () => {
    setError(null);

    if (!currentEmail) {
      setError('Please verify your email first.');
      return;
    }

    setIsCreating(true);
    setStatusMessage('Creating your wallet with passkey...');

    try {
      await createWallet();
      setStatusMessage('Wallet created successfully!');
      // onComplete will be called via useEffect when isConnected becomes true
    } catch (err: any) {
      console.error('[WalletSetup] Create wallet failed:', err);
      handleError(err);
    } finally {
      setIsCreating(false);
    }
  }, [createWallet, currentEmail]);

  // Handle wallet connection with existing passkey
  const handleConnectWallet = useCallback(async () => {
    setError(null);
    setIsCreating(true);
    setStatusMessage('Connecting to your wallet...');

    try {
      await login();
      setStatusMessage('Connected successfully!');
      // onComplete will be called via useEffect when isConnected becomes true
    } catch (err: any) {
      console.error('[WalletSetup] Connect wallet failed:', err);
      handleError(err);
    } finally {
      setIsCreating(false);
    }
  }, [login]);

  // Handle errors with user-friendly messages
  const handleError = (err: any) => {
    const errorMessage = err.message?.toLowerCase() || '';

    if (errorMessage.includes('cancelled') || errorMessage.includes('canceled') || errorMessage.includes('user refused')) {
      setError(null);
      setStatusMessage('Authentication cancelled. Try again when ready.');
    } else if (errorMessage.includes('timed out') || errorMessage.includes('not allowed')) {
      setError(null);
      setStatusMessage('Authentication was dismissed. Tap the button when ready.');
    } else if (errorMessage.includes('not supported')) {
      setError('Your device does not support passkey authentication.');
    } else if (errorMessage.includes('not available')) {
      setError('Passkey authentication is not available. Please check your device settings.');
    } else if (errorMessage.includes('failed to fetch') || errorMessage.includes('network')) {
      setError('Connection error. Please check your internet and try again.');
    } else if (errorMessage.includes('credential not found') || errorMessage.includes('no credential')) {
      setError('No passkey found. Please create a new wallet or use the device where you created your passkey.');
    } else if (errorMessage.includes('invalid') || errorMessage.includes('configuration')) {
      setError('Configuration error. Please contact support.');
    } else {
      setError(`Error: ${err.message || 'Something went wrong. Please try again.'}`);
    }
  };

  // Show initial choice screen
  const renderInitialChoice = () => (
    <div className="space-y-6">
      {/* Create New Wallet */}
      <button
        onClick={() => {
          setMode('create');
          handleCreateWallet();
        }}
        disabled={isConnecting || isCreating || !currentEmail}
        className="w-full bg-slate-200 hover:bg-white text-slate-900 font-medium text-lg py-4 rounded-lg transition-all duration-200 shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        <span>Create New Wallet</span>
      </button>

      {/* Connect Existing Wallet */}
      <button
        onClick={() => {
          setMode('connect');
          handleConnectWallet();
        }}
        disabled={isConnecting || isCreating || !currentEmail}
        className="w-full bg-transparent hover:bg-slate-800/50 text-slate-300 hover:text-white font-medium py-4 rounded-lg transition-all duration-200 border border-slate-600/50 hover:border-slate-500 flex items-center justify-center gap-2"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <span>Connect Existing Wallet</span>
      </button>
    </div>
  );

  // Show loading/processing state
  const renderProcessing = () => (
    <div className="space-y-6">
      <button
        disabled
        className="w-full bg-slate-200 text-slate-900 font-medium text-lg py-4 rounded-lg opacity-80 flex items-center justify-center gap-2"
      >
        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <span>{mode === 'create' ? 'Creating wallet...' : 'Connecting...'}</span>
      </button>

      <button
        onClick={() => {
          setMode('initial');
          setError(null);
          setStatusMessage('');
        }}
        className="w-full text-slate-400 hover:text-slate-200 text-sm py-2 transition-colors"
      >
        Cancel
      </button>
    </div>
  );

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
              {mode === 'create' ? 'Creating Wallet' : mode === 'connect' ? 'Connecting' : 'Welcome'}
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

            {/* Status Message */}
            {statusMessage && !error && (isCreating || isConnecting) && (
              <div className="p-3 rounded-lg backdrop-blur-sm border bg-blue-900/20 border-blue-500/40 text-blue-200 text-center text-sm">
                {statusMessage}
              </div>
            )}

            {/* Render appropriate UI based on state */}
            {isCreating || isConnecting ? renderProcessing() : renderInitialChoice()}

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
