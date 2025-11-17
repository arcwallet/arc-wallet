import React from 'react';
import './styles/magic.css';
import arcWalletLoginLogo from './assets/arcwalletloginlogo.png';
import ErrorBoundary from './components/ErrorBoundary';
import WalletDashboard from './components/WalletDashboard';
import WalletSetupScreen from './components/WalletSetupScreen';
const LoginPage = React.lazy(() => import('./pages/LoginPage'));
import { SessionProvider, useSession } from './contexts/SessionContext';
import { WalletProvider, useWallet } from './contexts/WalletContext';
import { ArcAccountProvider } from './contexts/ArcAccountContext';
import { ActivityProvider } from './contexts/ActivityContext';

const WalletExperience: React.FC<{ email: string }> = ({ email }) => {
  const { isAuthenticated, activateWithPrivateKey, logout: walletLogout } = useWallet();
  const { logout: sessionLogout } = useSession();

  const handleLogout = async () => {
    await sessionLogout();
    walletLogout();
  };

  if (!isAuthenticated) {
    return <WalletSetupScreen email={email} onComplete={activateWithPrivateKey} onLogout={handleLogout} />;
  }

  return (
    <>
      <div className="session-banner">
        <div>
          <p className="session-label">Signed in as</p>
          <p className="session-email">{email}</p>
        </div>
        <button onClick={handleLogout}>Sign out</button>
      </div>
      <WalletDashboard />
    </>
  );
};

const RootView: React.FC = () => {
  const { email, loading } = useSession();

  if (loading) {
    return (
      <div className="auth-card">
        <div className="login-header">
          <img src={arcWalletLoginLogo} alt="Arc Wallet" className="login-logo" />
          <span className="login-title">Arc Wallet</span>
        </div>
        <p className="muted">Checking your session…</p>
      </div>
    );
  }

  if (!email) {
    return <LoginPage />;
  }

  return <WalletExperience email={email} />;
};

const App: React.FC = () => (
  <ErrorBoundary>
    <SessionProvider>
      <WalletProvider>
        <ArcAccountProvider>
          <ActivityProvider>
            <div className="auth-wrapper">
              <React.Suspense fallback={<div className="auth-card"><p className="muted">Loading…</p></div>}>
                <RootView />
              </React.Suspense>
            </div>
          </ActivityProvider>
        </ArcAccountProvider>
      </WalletProvider>
    </SessionProvider>
  </ErrorBoundary>
);

export default App;
