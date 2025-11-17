import React from 'react';
import { useSession } from '../contexts/SessionContext';

const DashboardPage: React.FC = () => {
  const { email, logout, loading } = useSession();

  if (loading) {
    return (
      <div className="auth-card">
        <p className="muted">Loading session…</p>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <h1>Dashboard</h1>
      <p className="muted">Signed in as:</p>
      <p className="success">{email}</p>
      <button onClick={() => logout()} className="logout-button">
        Sign Out
      </button>
    </div>
  );
};

export default DashboardPage;
