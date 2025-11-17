import React, { useEffect, useState } from 'react';
import './styles/magic.css';
import arcWalletLoginLogo from './assets/arcwalletloginlogo.png';
import ErrorBoundary from './components/ErrorBoundary';
import WalletDashboard from './components/WalletDashboard';
import WalletSetupScreen from './components/WalletSetupScreen';
import WalletSelectionScreen from './components/WalletSelectionScreen';
const LoginPage = React.lazy(() => import('./pages/LoginPage'));
import { SessionProvider, useSession } from './contexts/SessionContext';
import { WalletProvider, useWallet } from './contexts/WalletContext';
import { ArcAccountProvider } from './contexts/ArcAccountContext';
import { ActivityProvider } from './contexts/ActivityContext';

const WalletExperience: React.FC<{ email: string }> = ({ email }) => {
  const { isAuthenticated, activateWithPrivateKey, loginWithPasskey, isConnecting, logout: walletLogout } = useWallet();
  const { logout: sessionLogout } = useSession();
  const [usingRecovery, setUsingRecovery] = useState(false);

  const handleLogout = async () => {
    await sessionLogout();
    walletLogout();
    setUsingRecovery(false);
  };

  if (!isAuthenticated && !usingRecovery) {
    return (
      <WalletSelectionScreen
        email={email}
        onConnect={loginWithPasskey}
        isConnecting={isConnecting}
        onUseRecovery={() => setUsingRecovery(true)}
      />
    );
  }

  if (!isAuthenticated && usingRecovery) {
    return <WalletSetupScreen email={email} onComplete={activateWithPrivateKey} onLogout={handleLogout} />;
  }

  return <WalletDashboard />;
};

const RootView: React.FC = () => {
  const { email, loading, verifyMagicToken, verifyingToken, message } = useSession();
  const [tokenHandled, setTokenHandled] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (!token || tokenHandled) return;

    verifyMagicToken(token)
      .finally(() => {
        params.delete('token');
        const next = params.toString();
        const url = `${window.location.pathname}${next ? `?${next}` : ''}`;
        window.history.replaceState({}, '', url);
        setTokenHandled(true);
      })
      .catch(() => {});
  }, [tokenHandled, verifyMagicToken]);

  if (loading || verifyingToken) {
    return (
      <div className="fullpage-login">
        <div className="login-logo-container">
          <img src={arcWalletLoginLogo} alt="Arc Wallet" className="login-logo" />
        </div>
        <div className="login-content">
          <p className="login-message muted">
            {verifyingToken ? 'Verifying your magic link…' : 'Checking your session…'}
          </p>
          {message && <p className="login-message error">{message}</p>}
        </div>
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
              <React.Suspense fallback={
                <div className="fullpage-login">
                  <div className="login-content">
                    <p className="login-message muted">Loading…</p>
                  </div>
                </div>
              }>
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
