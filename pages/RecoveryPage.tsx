import React, { useState, useEffect } from 'react';
import { passkeyClient } from '../services/passkeyClient';
import { useWallet } from '../contexts/WalletContext';
import { ArrowUpRightIcon } from '../components/Icons';
import { WaveBackground } from '../components/WaveBackground';
import arcLogo from '../assets/arclogo.png';

type RecoveryStep = 'request' | 'verify' | 'complete' | 'success';

const RecoveryPage: React.FC = () => {
  const { activateWithPrivateKey, registerPasskeyForCurrentUser } = useWallet();

  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const [step, setStep] = useState<RecoveryStep>('request');
  const [email, setEmail] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [recoveryToken, setRecoveryToken] = useState('');
  const [verifiedEmail, setVerifiedEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Check for recovery token in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      setRecoveryToken(token);
      verifyToken(token);
    }
  }, []);

  const verifyToken = async (token: string) => {
    setSubmitting(true);
    setError('');
    try {
      const response = await passkeyClient.verifyRecoveryToken(token);
      if (response.data?.email) {
        setVerifiedEmail(response.data.email);
        setStep('verify');
      }
    } catch (err: any) {
      setError('Invalid or expired recovery link. Please request a new one.');
      setStep('request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || submitting) return;

    setSubmitting(true);
    setError('');
    setMessage('');

    try {
      const response = await passkeyClient.startRecovery(email);
      setMessage(response.data?.message || 'Recovery link sent. Please check your email.');

      // In development, show the token for testing
      if (response.data?.recoveryToken) {
        setRecoveryToken(response.data.recoveryToken);
        // Auto-verify in dev mode
        setTimeout(() => verifyToken(response.data!.recoveryToken!), 1000);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to send recovery link');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryToken || submitting) return;

    setSubmitting(true);
    setError('');

    try {
      // Complete recovery - delete old passkeys
      const response = await passkeyClient.completeRecovery(recoveryToken, privateKey);

      if (response.data) {
        setMessage(response.data.message);

        // If private key provided, activate wallet with it
        if (privateKey) {
          try {
            await activateWithPrivateKey(privateKey);
          } catch (pkError: any) {
            setError('Invalid private key. Please check and try again.');
            setSubmitting(false);
            return;
          }
        }

        setStep('complete');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to complete recovery');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegisterNewPasskey = async () => {
    setSubmitting(true);
    setError('');

    try {
      await registerPasskeyForCurrentUser();
      setStep('success');
      setTimeout(() => navigate('/'), 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to register new passkey');
    } finally {
      setSubmitting(false);
    }
  };

  const renderRequestStep = () => (
    <>
      <h1 className="text-5xl font-light text-center mb-12 text-slate-100 tracking-tight drop-shadow-lg">
        Recover Passkey
      </h1>
      <p className="text-center text-slate-400 text-sm mb-8">
        Enter your email to receive a recovery link. This will reset your passkey.
      </p>
      <form onSubmit={handleRequestRecovery} className="flex flex-col gap-6">
        <div className="group">
          <div className="relative">
            <input
              type="email"
              placeholder="Email address"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-900/60 border border-slate-500/50 rounded-lg px-4 py-4 text-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all backdrop-blur-sm"
            />
            <div className="absolute inset-0 rounded-lg bg-blue-500/5 opacity-0 group-focus-within:opacity-100 pointer-events-none transition-opacity duration-500" />
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-slate-200 hover:bg-white text-slate-900 font-medium text-lg py-3.5 rounded-lg transition-all duration-200 shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {submitting ? 'Sending...' : 'Send Recovery Link'}
        </button>

        <button
          type="button"
          onClick={() => navigate('/login')}
          className="w-full bg-transparent border border-slate-500/50 text-slate-300 hover:text-white hover:border-slate-400 font-medium text-lg py-3.5 rounded-lg transition-all duration-200"
        >
          Back to Login
        </button>
      </form>
    </>
  );

  const renderVerifyStep = () => (
    <>
      <h1 className="text-5xl font-light text-center mb-8 text-slate-100 tracking-tight drop-shadow-lg">
        Restore Wallet
      </h1>

      {verifiedEmail && (
        <div className="mb-6 p-3 rounded-lg backdrop-blur-sm border bg-green-900/20 border-green-500/50 text-green-200 text-center">
          Recovery link verified for: {verifiedEmail}
        </div>
      )}

      <p className="text-center text-slate-400 text-sm mb-8">
        Enter your wallet private key to restore access. This will delete your old passkey.
      </p>

      <form onSubmit={handleCompleteRecovery} className="flex flex-col gap-6">
        <div className="group">
          <div className="relative">
            <input
              type="password"
              placeholder="Private key (0x...)"
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
              className="w-full bg-slate-900/60 border border-slate-500/50 rounded-lg px-4 py-4 text-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all backdrop-blur-sm font-mono"
            />
            <div className="absolute inset-0 rounded-lg bg-blue-500/5 opacity-0 group-focus-within:opacity-100 pointer-events-none transition-opacity duration-500" />
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-slate-200 hover:bg-white text-slate-900 font-medium text-lg py-3.5 rounded-lg transition-all duration-200 shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {submitting ? 'Recovering...' : 'Complete Recovery'}
        </button>
      </form>

      <p className="mt-6 text-center text-slate-500 text-xs">
        If you don't have your private key, you can still proceed to register a new passkey, but your old wallet will not be recovered.
      </p>
    </>
  );

  const renderCompleteStep = () => (
    <>
      <h1 className="text-5xl font-light text-center mb-8 text-slate-100 tracking-tight drop-shadow-lg">
        Register New Passkey
      </h1>

      {message && (
        <div className="mb-6 p-3 rounded-lg backdrop-blur-sm border bg-green-900/20 border-green-500/50 text-green-200 text-center">
          {message}
        </div>
      )}

      <p className="text-center text-slate-400 text-sm mb-8">
        Now register a new passkey for your account.
      </p>

      <button
        onClick={handleRegisterNewPasskey}
        disabled={submitting}
        className="w-full bg-slate-200 hover:bg-white text-slate-900 font-medium text-lg py-3.5 rounded-lg transition-all duration-200 shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] disabled:opacity-70 disabled:cursor-not-allowed"
      >
        {submitting ? 'Registering...' : 'Register New Passkey'}
      </button>
    </>
  );

  const renderSuccessStep = () => (
    <>
      <h1 className="text-5xl font-light text-center mb-8 text-slate-100 tracking-tight drop-shadow-lg">
        Recovery Complete
      </h1>
      <div className="p-3 rounded-lg backdrop-blur-sm border bg-green-900/20 border-green-500/50 text-green-200 text-center">
        Your passkey has been successfully registered. Redirecting to wallet...
      </div>
    </>
  );

  return (
    <div className="fixed inset-0 w-full h-full flex flex-col items-center justify-center overflow-hidden bg-transparent">
      {/* Background Pattern */}
      <div className="absolute inset-0 z-0">
        <WaveBackground />
      </div>

      {/* Top Left Logo */}
      <div className="absolute top-8 left-8 z-20 opacity-90 hover:opacity-100 transition-opacity cursor-pointer">
        <img src={arcLogo} alt="Arc Wallet" className="w-20 h-20 object-contain drop-shadow-[0_0_20px_rgba(255,255,255,0.6)]" />
      </div>

      {/* Recovery Container */}
      <div className="relative z-20 w-full max-w-md px-4 animate-in fade-in zoom-in duration-700">
        {step === 'request' && renderRequestStep()}
        {step === 'verify' && renderVerifyStep()}
        {step === 'complete' && renderCompleteStep()}
        {step === 'success' && renderSuccessStep()}

        {/* Error Messages */}
        {error && (
          <div className="mt-4 p-3 rounded-lg backdrop-blur-sm border bg-red-900/20 border-red-500/50 text-red-200 text-center">
            {error}
          </div>
        )}

        {/* Success Messages (only on request step) */}
        {message && step === 'request' && (
          <div className="mt-4 p-3 rounded-lg backdrop-blur-sm border bg-green-900/20 border-green-500/50 text-green-200 text-center">
            {message}
          </div>
        )}
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

export default RecoveryPage;
