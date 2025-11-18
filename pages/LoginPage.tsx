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
    <div className="fullpage-login">
      <div className="login-logo-container">
        <img src={arcWalletLoginLogo} alt="Arc Wallet" className="login-logo" />
      </div>
      <div className="login-content">
        <h1 className="login-heading">Sign in</h1>
        <form onSubmit={handleSubmit} className="login-form">
          <input
            type="email"
            name="email"
            placeholder="Enter your email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="login-input"
          />
          <button type="submit" disabled={submitting || cooldown > 0} className="login-button">
            {submitting ? 'Sending…' : cooldown > 0 ? `Retry in ${cooldown}s` : 'Sign in'}
          </button>
        </form>
        {message && (
          <p className={`login-message ${requestStatus === 'error' ? 'error' : 'success'}`}>
            {message}
          </p>
        )}
        {cooldown > 0 && (
          <p className="login-message muted">
            Please check your inbox. You can request another link after the countdown.
          </p>
        )}
        <button
          onClick={() => {
            window.history.pushState({}, '', '/recovery');
            window.dispatchEvent(new PopStateEvent('popstate'));
          }}
          className="login-message muted"
          style={{
            display: 'block',
            marginTop: '1.5rem',
            textDecoration: 'underline',
            cursor: 'pointer',
            fontSize: '0.9rem',
            background: 'none',
            border: 'none',
            padding: 0,
            width: '100%',
            textAlign: 'center'
          }}
        >
          Lost your passkey? Recover access
        </button>
      </div>
    </div>
  );
};

export default LoginPage;
