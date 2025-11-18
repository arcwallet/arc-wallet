import React, { useState, useEffect } from 'react';
import { passkeyClient } from '../services/passkeyClient';
import { useWallet } from '../contexts/WalletContext';
import arcWalletLoginLogo from '../assets/arcwalletloginlogo.png';

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
        console.log('Recovery token:', response.data.recoveryToken);
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
      <h1 className="login-heading">Recover Passkey</h1>
      <p className="login-message muted" style={{ marginBottom: '1rem' }}>
        Enter your email to receive a recovery link. This will reset your passkey.
      </p>
      <form onSubmit={handleRequestRecovery} className="login-form">
        <input
          type="email"
          placeholder="Enter your email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="login-input"
        />
        <button type="submit" disabled={submitting} className="login-button">
          {submitting ? 'Sending...' : 'Send Recovery Link'}
        </button>
      </form>
      <button
        onClick={() => navigate('/login')}
        className="login-button"
        style={{ marginTop: '0.5rem', background: 'transparent', border: '1px solid #5c7cfa' }}
      >
        Back to Login
      </button>
    </>
  );

  const renderVerifyStep = () => (
    <>
      <h1 className="login-heading">Restore Wallet</h1>
      <p className="login-message success" style={{ marginBottom: '1rem' }}>
        Recovery link verified for: {verifiedEmail}
      </p>
      <p className="login-message muted" style={{ marginBottom: '1rem' }}>
        Enter your wallet private key to restore access. This will delete your old passkey.
      </p>
      <form onSubmit={handleCompleteRecovery} className="login-form">
        <input
          type="password"
          placeholder="Private key (0x...)"
          value={privateKey}
          onChange={(e) => setPrivateKey(e.target.value)}
          className="login-input"
          style={{ fontFamily: 'monospace' }}
        />
        <button type="submit" disabled={submitting} className="login-button">
          {submitting ? 'Recovering...' : 'Complete Recovery'}
        </button>
      </form>
      <p className="login-message muted" style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
        If you don't have your private key, you can still proceed to register a new passkey, but your old wallet will not be recovered.
      </p>
    </>
  );

  const renderCompleteStep = () => (
    <>
      <h1 className="login-heading">Register New Passkey</h1>
      <p className="login-message success" style={{ marginBottom: '1rem' }}>
        {message}
      </p>
      <p className="login-message muted" style={{ marginBottom: '1rem' }}>
        Now register a new passkey for your account.
      </p>
      <button
        onClick={handleRegisterNewPasskey}
        disabled={submitting}
        className="login-button"
      >
        {submitting ? 'Registering...' : 'Register New Passkey'}
      </button>
    </>
  );

  const renderSuccessStep = () => (
    <>
      <h1 className="login-heading">Recovery Complete</h1>
      <p className="login-message success">
        Your passkey has been successfully registered. Redirecting to wallet...
      </p>
    </>
  );

  return (
    <div className="fullpage-login">
      <div className="login-logo-container">
        <img src={arcWalletLoginLogo} alt="Arc Wallet" className="login-logo" />
      </div>
      <div className="login-content">
        {step === 'request' && renderRequestStep()}
        {step === 'verify' && renderVerifyStep()}
        {step === 'complete' && renderCompleteStep()}
        {step === 'success' && renderSuccessStep()}

        {error && <p className="login-message error">{error}</p>}
        {message && step === 'request' && <p className="login-message success">{message}</p>}
      </div>
    </div>
  );
};

export default RecoveryPage;
