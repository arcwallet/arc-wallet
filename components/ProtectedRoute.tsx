import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSession } from '../contexts/SessionContext';

const ProtectedRoute: React.FC = () => {
  const { email, loading } = useSession();
  const location = useLocation();

  if (loading) {
    return (
      <div className="auth-card">
        <p className="muted">Checking session…</p>
      </div>
    );
  }

  if (!email) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
