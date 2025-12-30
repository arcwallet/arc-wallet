import React, { useState, useEffect } from 'react';
import { useSession } from '../contexts/SessionContext';
import { WaveBackground } from '../components/WaveBackground';
import arcLogo from '../assets/arclogo.png';
import { Footer } from '../components/Footer';
import { passkeyClient } from '../services/passkeyClient';
import { createAuthenticationCredential, createRegistrationCredential } from '../utils/webauthn';
import OtpInput from '../components/OtpInput';

const API_BASE = ((import.meta as any).env.VITE_PASSKEY_API_URL || 'https://arcwallet-backend.onrender.com').replace(/\/$/, '');

// Whitelist - only these emails can login
// Set via VITE_ALLOWED_EMAILS env var (comma-separated)
const ALLOWED_EMAILS = (import.meta.env.VITE_ALLOWED_EMAILS || '')
  .split(',')
  .map((e: string) => e.trim().toLowerCase())
  .filter(Boolean);

type LoginStep = 'email' | 'otp' | 'passkey' | 'verifying' | 'creating_passkey' | 'waitlist';

const LoginPage: React.FC = () => {
  const { refresh } = useSession();
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [step, setStep] = useState<LoginStep>('email');
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info');

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((current) => Math.max(current - 1, 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  // Auto-submit OTP when 6 digits entered
  useEffect(() => {
    if (otpCode.length === 6 && step === 'otp' && !submitting) {
      handleVerifyOtp();
    }
  }, [otpCode]);

  const showMessage = (text: string, type: 'success' | 'error' | 'info') => {
    setMessage(text);
    setMessageType(type);
  };

  const handlePasskeyAuth = async (userEmail: string): Promise<boolean> => {
    try {
      const startResult = await passkeyClient.beginAuthentication(userEmail);
      if (!startResult.success || !startResult.data?.options) {
        throw new Error('Failed to start passkey authentication');
      }

      const credential = await createAuthenticationCredential(startResult.data.options);
      const finishResult = await passkeyClient.finishAuthentication(credential);

      if (!finishResult.success) {
        throw new Error('Failed to verify passkey');
      }

      // Session key is managed by HttpOnly cookies - no need to store in localStorage
      // Private keys should NEVER be stored in localStorage (security risk!)

      await refresh();
      return true;
    } catch (error) {
      console.error('[LoginPage] Passkey auth failed:', error);
      return false;
    }
  };

  // Create passkey for user after OTP verification
  const handleCreatePasskey = async (userEmail: string): Promise<boolean> => {
    try {
      console.log('[LoginPage] Creating passkey for:', userEmail);
      setStep('creating_passkey');
      showMessage('Creating your secure passkey...', 'info');

      // Start passkey registration
      const startResult = await passkeyClient.beginRegistration(userEmail, userEmail.split('@')[0]);
      if (!startResult.success || !startResult.data?.options) {
        throw new Error('Failed to start passkey registration');
      }

      // Create the passkey
      const credential = await createRegistrationCredential(startResult.data.options);

      // Finish registration
      const finishResult = await passkeyClient.finishRegistration(userEmail, credential);
      if (!finishResult.success) {
        throw new Error('Failed to complete passkey registration');
      }

      // Session key is managed by HttpOnly cookies - no need to store in localStorage
      // Private keys should NEVER be stored in localStorage (security risk!)

      console.log('[LoginPage] Passkey created successfully');
      showMessage('Passkey created successfully!', 'success');
      return true;
    } catch (error: any) {
      console.error('[LoginPage] Passkey creation failed:', error);
      // User might have cancelled - that's OK, they can still login
      if (error.name === 'AbortError' || error.message?.includes('cancelled')) {
        showMessage('Passkey creation cancelled. You can create one later.', 'info');
        return false;
      }
      showMessage(error.message || 'Failed to create passkey', 'error');
      return false;
    }
  };

  const handleEmailSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email || submitting || cooldown > 0) return;

    setSubmitting(true);
    setMessage(null);

    // Check whitelist (if configured)
    // If ALLOWED_EMAILS is empty, allow all emails (no whitelist)
    const normalizedEmail = email.toLowerCase().trim();
    if (ALLOWED_EMAILS.length > 0 && !ALLOWED_EMAILS.includes(normalizedEmail)) {
      setStep('waitlist');
      setSubmitting(false);
      return;
    }

    try {
      // First check if user has passkeys AND wallet (existing user)
      const checkResult = await passkeyClient.checkUserPasskeys(email);

      // CRITICAL: Only require passkey auth if user has BOTH passkey AND wallet
      // New users may have stale passkey data but no wallet - they should go through OTP
      const hasPasskeyAndWallet = checkResult.success &&
        checkResult.data?.hasPasskey &&
        checkResult.data?.walletAddress;

      if (hasPasskeyAndWallet) {
        // Existing user with wallet - try direct passkey authentication
        showMessage('Passkey found! Please authenticate...', 'info');
        setStep('passkey');

        const authSuccess = await handlePasskeyAuth(email);
        if (authSuccess) {
          return; // Auth successful
        }
        // Passkey failed, fall back to OTP
        showMessage('Sending verification code...', 'info');
      }

      // Request OTP via SendGrid
      const response = await fetch(`${API_BASE}/api/circle/otp/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        // Check for rate limit error
        if (data.code === 'RATE_LIMIT_EXCEEDED' && data.retryAfter) {
          setCooldown(data.retryAfter);
          showMessage(`Please wait ${data.retryAfter} seconds before trying again`, 'info');
          return;
        }
        throw new Error(data.error || 'Failed to send verification code');
      }

      setStep('otp');
      setCooldown(60);
      showMessage('Verification code sent to your email', 'success');

    } catch (error: any) {
      console.error('[LoginPage] Error:', error);

      // Check if it's a rate limit error - show as info, not error
      const errorMessage = error instanceof Error ? error.message : 'Something went wrong. Please try again.';
      const isRateLimitError = errorMessage.toLowerCase().includes('too many') ||
                               errorMessage.toLowerCase().includes('rate limit') ||
                               error?.code === 'RATE_LIMIT_EXCEEDED';

      if (isRateLimitError) {
        // Extract retry time if available
        const retryMatch = errorMessage.match(/(\d+)\s*(saniye|second|s\b)/i);
        const retrySeconds = retryMatch ? parseInt(retryMatch[1]) : 60;
        setCooldown(retrySeconds);
        showMessage(`Please wait ${retrySeconds} seconds before trying again`, 'info');
      } else {
        showMessage(errorMessage, 'error');
      }
      setStep('email');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otpCode.length !== 6 || submitting) return;

    setSubmitting(true);
    setMessage(null);
    setStep('verifying');

    try {
      // Verify OTP via backend
      const response = await fetch(`${API_BASE}/api/circle/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, otpCode }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Invalid verification code');
      }

      showMessage('Email verified successfully!', 'success');

      // Check if user has a passkey AND wallet - if so, require passkey auth as 2FA
      const checkResult = await passkeyClient.checkUserPasskeys(email);

      // CRITICAL: Only require passkey auth if user has BOTH passkey AND wallet
      // This prevents new users from being stuck in passkey auth when they don't have a wallet yet
      const hasPasskeyAndWallet = checkResult.success &&
        checkResult.data?.hasPasskey &&
        checkResult.data?.walletAddress;

      if (hasPasskeyAndWallet) {
        // Existing user with wallet - require passkey authentication as second factor
        console.log('[LoginPage] User has passkey and wallet, requiring passkey auth...');
        showMessage('Please authenticate with your passkey...', 'info');
        setStep('passkey');

        const authSuccess = await handlePasskeyAuth(email);
        if (!authSuccess) {
          showMessage('Passkey authentication failed. Please try again.', 'error');
          setStep('email');
          setOtpCode('');
          return;
        }
        // Passkey auth successful - session is now active
        return;
      }

      // No passkey/wallet yet - proceed to wallet setup where they will create both
      console.log('[LoginPage] New user or no wallet, proceeding to wallet setup...');

      // Refresh session after OTP verification
      await refresh();

    } catch (error) {
      console.error('[LoginPage] OTP verification failed:', error);
      showMessage(
        error instanceof Error ? error.message : 'Invalid or expired code. Please try again.',
        'error'
      );
      setOtpCode('');
      setStep('otp');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    if (cooldown > 0 || submitting) return;

    setSubmitting(true);
    try {
      const response = await fetch(`${API_BASE}/api/circle/otp/resend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        // Check for rate limit error
        if (data.code === 'RATE_LIMIT_EXCEEDED' && data.retryAfter) {
          setCooldown(data.retryAfter);
          showMessage(`Please wait ${data.retryAfter} seconds before trying again`, 'info');
          return;
        }
        throw new Error(data.error || 'Failed to resend code');
      }

      setCooldown(60);
      showMessage('New verification code sent', 'success');
    } catch (error: any) {
      // Check if it's a rate limit error
      const errorMessage = error instanceof Error ? error.message : 'Failed to resend code';
      const isRateLimitError = errorMessage.toLowerCase().includes('too many') ||
                               errorMessage.toLowerCase().includes('rate limit');

      if (isRateLimitError) {
        showMessage('Please wait before trying again', 'info');
      } else {
        showMessage(errorMessage, 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleBackToEmail = () => {
    setStep('email');
    setOtpCode('');
    setMessage(null);
    setCooldown(0);
  };

  const renderEmailStep = () => (
    <form onSubmit={handleEmailSubmit} className="flex flex-col gap-6">
      <div className="group">
        <div className="relative">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            required
            autoComplete="email"
            className="w-full bg-slate-900/60 border border-slate-500/50 rounded-lg px-4 py-4 text-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all backdrop-blur-sm"
          />
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
            Checking...
          </span>
        ) : cooldown > 0 ? (
          `Retry in ${cooldown}s`
        ) : (
          'Continue'
        )}
      </button>
    </form>
  );

  const renderOtpStep = () => (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <p className="text-slate-400 text-sm mb-1">Enter the 6-digit code sent to</p>
        <p className="text-white font-medium">{email}</p>
      </div>

      <OtpInput
        value={otpCode}
        onChange={setOtpCode}
        disabled={submitting}
        error={messageType === 'error' ? message : null}
      />

      <button
        onClick={handleVerifyOtp}
        disabled={otpCode.length !== 6 || submitting}
        className="w-full bg-slate-200 hover:bg-white text-slate-900 font-medium text-lg py-3.5 rounded-lg transition-all duration-200 shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center"
      >
        {submitting ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-5 w-5 text-slate-900" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Verifying...
          </span>
        ) : (
          'Verify'
        )}
      </button>

      <div className="flex items-center justify-between text-sm">
        <button
          onClick={handleBackToEmail}
          className="text-slate-400 hover:text-white transition-colors"
        >
          Change email
        </button>
        <button
          onClick={handleResendOtp}
          disabled={cooldown > 0 || submitting}
          className="text-blue-400 hover:text-blue-300 transition-colors disabled:text-slate-500 disabled:cursor-not-allowed"
        >
          {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
        </button>
      </div>
    </div>
  );

  const renderPasskeyStep = () => (
    <div className="flex flex-col items-center gap-6">
      <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center animate-pulse">
        <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
        </svg>
      </div>
      <p className="text-slate-300 text-center">
        Complete authentication with your passkey...
      </p>
      <button
        onClick={handleBackToEmail}
        className="text-sm text-slate-400 hover:text-white transition-colors"
      >
        Use verification code instead
      </button>
    </div>
  );

  const renderVerifyingStep = () => (
    <div className="flex flex-col items-center gap-6">
      <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center">
        <svg className="animate-spin h-8 w-8 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
      <p className="text-slate-300 text-center">
        Verifying your code...
      </p>
    </div>
  );

  const renderCreatingPasskeyStep = () => (
    <div className="flex flex-col items-center gap-6">
      <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center animate-pulse">
        <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
        </svg>
      </div>
      <div className="text-center">
        <p className="text-white font-medium mb-2">Creating your secure passkey</p>
        <p className="text-slate-400 text-sm">
          Follow your device's prompt to create a passkey for secure, password-free login.
        </p>
      </div>
    </div>
  );

  const renderWaitlistStep = () => (
    <div className="flex flex-col items-center gap-6">
      <div className="w-20 h-20 rounded-full bg-amber-500/20 flex items-center justify-center">
        <svg className="w-10 h-10 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div className="text-center">
        <h2 className="text-2xl font-medium text-white mb-3">You're on the waitlist!</h2>
        <p className="text-slate-400 mb-2">
          Arc Wallet is currently in private beta.
        </p>
        <p className="text-slate-500 text-sm">
          We'll notify you at <span className="text-slate-300">{email}</span> when access is available.
        </p>
      </div>
      <button
        onClick={handleBackToEmail}
        className="mt-4 text-sm text-slate-400 hover:text-white transition-colors"
      >
        Try a different email
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 w-full h-full flex flex-col items-center justify-center overflow-hidden bg-transparent">
      {/* Background Pattern */}
      <div className="absolute inset-0 z-0">
        <WaveBackground showAnimation={true} />
      </div>

      {/* Top Left Logo */}
      <div className="absolute top-6 left-6 z-20">
        <img src={arcLogo} alt="Arc Wallet" style={{ height: '48px', width: 'auto', objectFit: 'contain', filter: 'drop-shadow(0 0 15px rgba(255,255,255,0.5))' }} />
      </div>

      {/* Login Container */}
      <div className="relative z-20 w-full max-w-md px-4 animate-in fade-in zoom-in duration-700">
        <h1 className="text-5xl font-light text-center mb-12 text-slate-100 tracking-tight drop-shadow-lg">
          {step === 'waitlist' ? 'Waitlist' : step === 'otp' || step === 'verifying' ? 'Verify email' : step === 'creating_passkey' ? 'Setup passkey' : 'Sign in'}
        </h1>

        {step === 'email' && renderEmailStep()}
        {step === 'otp' && renderOtpStep()}
        {step === 'passkey' && renderPasskeyStep()}
        {step === 'verifying' && renderVerifyingStep()}
        {step === 'creating_passkey' && renderCreatingPasskeyStep()}
        {step === 'waitlist' && renderWaitlistStep()}

        {/* Status Messages (not for OTP step - handled by OtpInput) */}
        {message && step !== 'otp' && step !== 'verifying' && (
          <div className={`mt-4 p-3 rounded-lg backdrop-blur-sm border text-center ${
            messageType === 'error'
              ? 'bg-red-900/20 border-red-500/50 text-red-200'
              : messageType === 'success'
                ? 'bg-blue-900/20 border-blue-500/50 text-blue-200'
                : 'bg-slate-900/20 border-slate-500/50 text-slate-200'
          }`}>
            {message}
          </div>
        )}

        {/* Success message for OTP step */}
        {message && step === 'otp' && messageType === 'success' && (
          <div className="mt-4 p-3 rounded-lg backdrop-blur-sm border text-center bg-blue-900/20 border-blue-500/50 text-blue-200">
            {message}
          </div>
        )}
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

export default LoginPage;
