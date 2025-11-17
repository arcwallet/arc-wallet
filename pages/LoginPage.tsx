import React, { useState } from 'react';
import { useSession } from '../contexts/SessionContext';

const LoginPage: React.FC = () => {
  const { sendMagicLink, requestStatus, message } = useSession();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email) return;
    setSubmitting(true);
    try {
      await sendMagicLink(email);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-card">
      <h1>Arc Wallet Magic Link</h1>
      <p>Enter your email address to receive a secure one-time sign-in link in your inbox.</p>
      <form onSubmit={handleSubmit} className="auth-form">
        <input
          type="email"
          name="email"
          placeholder="ornek@arcwallet.io"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <button type="submit" disabled={submitting}>
          {submitting ? 'Sending…' : 'Send Link'}
        </button>
      </form>
      {message && (
        <p className={`muted ${requestStatus === 'error' ? 'error' : 'success'}`}>
          {message}
        </p>
      )}
      <p className="muted">We email a link that stays valid for 15 minutes.</p>
    </div>
  );
};

export default LoginPage;
