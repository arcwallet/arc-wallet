import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { sessionApi } from '../services/sessionApi';
import { useSession } from '../contexts/SessionContext';

const CallbackPage: React.FC = () => {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Verifying magic link…');
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const { refresh } = useSession();

  useEffect(() => {
    const token = search.get('token');
    if (!token) {
      setStatus('error');
      setMessage('Invalid or missing token. Please request a new magic link.');
      return;
    }

    const verify = async () => {
      try {
        await sessionApi.verify(token);
        await refresh();
        setStatus('success');
        setMessage('Sign-in successful. Redirecting…');
        setTimeout(() => navigate('/dashboard', { replace: true }), 1000);
      } catch (error) {
        setStatus('error');
        setMessage(error instanceof Error ? error.message : 'Verification failed.');
      }
    };

    void verify();
  }, [navigate, refresh, search]);

  return (
    <div className="auth-card">
      <h1>Magic Link</h1>
      <p className={`muted ${status === 'error' ? 'error' : 'success'}`}>{message}</p>
    </div>
  );
};

export default CallbackPage;
