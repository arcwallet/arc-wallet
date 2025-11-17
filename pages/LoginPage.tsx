import React, { useState } from 'react';
import { useSession } from '../contexts/SessionContext';
import arcWalletLoginLogo from '../assets/arcwalletloginlogo.png';

const LoginPage: React.FC = () => {
  const { sendMagicLink, requestStatus, message } = useSession();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((current) => Math.max(current - 1, 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email || submitting || cooldown > 0) return;
    setSubmitting(true);
    try {
      await sendMagicLink(email);
      setCooldown(30);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-card">
      <div className="login-header">
        <img src={arcWalletLoginLogo} alt="Arc Wallet" className="login-logo" />
        <span className="login-title">Arc Wallet</span>
      </div>
      <form onSubmit={handleSubmit} className="auth-form">
        <input
          type="email"
          name="email"
          placeholder="Enter your work email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <button type="submit" disabled={submitting || cooldown > 0}>
          {submitting ? 'Sending…' : cooldown > 0 ? `Retry in ${cooldown}s` : 'Sign in'}
        </button>
      </form>
      {message && (
        <p className={`muted ${requestStatus === 'error' ? 'error' : 'success'}`}>
          {message}
        </p>
      )}
      {cooldown > 0 && (
        <p className="muted">
          Please check your inbox. You can request another link after the countdown.
        </p>
      )}
    </div>
  );
};

export default LoginPage;
