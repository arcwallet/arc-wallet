import React, { useState } from 'react';
import { useSession } from '../contexts/SessionContext';
import { ArrowUpRightIcon } from '../components/Icons';
import { WaveBackground } from '../components/WaveBackground';
import arcLogo from '../assets/arclogo.png';
import { Footer } from '../components/Footer';
import { passkeyClient } from '../services/passkeyClient';
import { createAuthenticationCredential } from '../utils/webauthn';

const LoginPage: React.FC = () => {
  const { sendMagicLink, requestStatus, message, refresh } = useSession();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [localMessage, setLocalMessage] = useState<string | null>(null);
  const [localStatus, setLocalStatus] = useState<'idle' | 'success' | 'error'>('idle');

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((current) => Math.max(current - 1, 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const handlePasskeyAuth = async (userEmail: string): Promise<boolean> => {
    try {
      // Start authentication
      const startResult = await passkeyClient.beginAuthentication(userEmail);
      if (!startResult.success || !startResult.data?.options) {
        throw new Error('Failed to start passkey authentication');
      }

      // Create credential with browser
      const credential = await createAuthenticationCredential(startResult.data.options);

      // Finish authentication
      const finishResult = await passkeyClient.finishAuthentication(credential);
      if (!finishResult.success) {
        throw new Error('Failed to verify passkey');
      }

      // Store session key if returned
      if (finishResult.data?.sessionKey) {
        localStorage.setItem('arc_session_key', JSON.stringify(finishResult.data.sessionKey));
      }

      // Refresh session to update state
      await refresh();
      return true;
    } catch (error) {
      console.error('[LoginPage] Passkey auth failed:', error);
      return false;
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email || submitting || cooldown > 0) return;
    setSubmitting(true);
    setLocalMessage(null);
    setLocalStatus('idle');

    try {
      // First check if user has passkeys
      const checkResult = await passkeyClient.checkUserPasskeys(email);

      if (checkResult.success && checkResult.data?.hasPasskey) {
        // User has passkeys, try direct passkey authentication
        setLocalMessage('Passkey found! Please authenticate with your passkey...');
        setLocalStatus('success');

        const authSuccess = await handlePasskeyAuth(email);
        if (authSuccess) {
          // Auth successful, session will be refreshed and user redirected
          return;
        } else {
          // Passkey auth failed, fall back to magic link
          setLocalMessage('Passkey authentication failed. Sending magic link...');
          setLocalStatus('error');
          await sendMagicLink(email);
          setCooldown(30);
        }
      } else {
        // No passkeys, send magic link
        await sendMagicLink(email);
        setCooldown(30);
      }
    } catch (error) {
      // If checkUserPasskeys fails, fall back to magic link
      console.error('[LoginPage] Check passkeys failed:', error);
      await sendMagicLink(email);
      setCooldown(30);
    } finally {
      setSubmitting(false);
    }
  };

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

      {/* Login Container */}
      <div className="relative z-20 w-full max-w-md px-4 animate-in fade-in zoom-in duration-700">
        <h1 className="text-5xl font-light text-center mb-12 text-slate-100 tracking-tight drop-shadow-lg">
          Sign in
        </h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="group">
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                required
                className="w-full bg-slate-900/60 border border-slate-500/50 rounded-lg px-4 py-4 text-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all backdrop-blur-sm"
              />
              {/* Subtle glow effect on focus */}
              <div className="absolute inset-0 rounded-lg bg-blue-500/5 opacity-0 group-focus-within:opacity-100 pointer-events-none transition-opacity duration-500" />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || cooldown > 0}
            className="w-full bg-slate-200 hover:bg-white text-slate-900 font-medium text-lg py-3.5 rounded-lg transition-all duration-200 shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5 text-slate-900" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Authenticating...
              </span>
            ) : cooldown > 0 ? (
              `Retry in ${cooldown}s`
            ) : (
              "Sign in"
            )}
          </button>
        </form>

        {/* Status Messages */}
        {(localMessage || message) && (
          <div className={`mt-4 p-3 rounded-lg backdrop-blur-sm border text-center ${(localStatus === 'error' || requestStatus === 'error')
            ? 'bg-red-900/20 border-red-500/50 text-red-200'
            : 'bg-blue-900/20 border-blue-500/50 text-blue-200'
            }`}>
            {localMessage || message}
          </div>
        )}

        {cooldown > 0 && (
          <p className="mt-3 text-center text-sm text-slate-400">
            Please check your inbox. You can request another link after the countdown.
          </p>
        )}


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

export default LoginPage;
