import React, { useEffect, useState } from 'react';
import './styles/magic.css';
import arcWalletLoginLogo from './assets/arcwalletloginlogo.png';
import ErrorBoundary from './components/ErrorBoundary';
import WalletDashboard from './components/WalletDashboard';
import WalletSetupScreen from './components/WalletSetupScreen';
import WalletSelectionScreen from './components/WalletSelectionScreen';
const LoginPage = React.lazy(() => import('./pages/LoginPage'));
const RecoveryPage = React.lazy(() => import('./pages/RecoveryPage'));
import { SessionProvider, useSession } from './contexts/SessionContext';
import { WalletProvider, useWallet } from './contexts/WalletContext';
import { ArcAccountProvider } from './contexts/ArcAccountContext';
import { ActivityProvider } from './contexts/ActivityContext';
import { MultiSigProvider } from './contexts/MultiSigContext';
import { IdentityProvider } from './contexts/IdentityContext';
import { PrivacyProvider } from './contexts/PrivacyContext';
// Self-custodial wallet imports
import { SelfCustodialWalletProvider, useSelfCustodialWallet } from './contexts/SelfCustodialWalletContext';
import WalletSetup from './components/WalletSetup';
import UnlockWallet from './components/UnlockWallet';

// Self-custodial wallet experience - new architecture
const SelfCustodialWalletExperience: React.FC = () => {
  const {
    hasWallet,
    isUnlocked,
    isAuthenticated,
    registerPasskey,
    logout,
    deleteWallet,
    needsBackup
  } = useSelfCustodialWallet();
  const { logout: sessionLogout } = useSession();

  const handleComplete = async () => {
    // After wallet creation/import, register passkey for identity
    try {
      await registerPasskey();
    } catch (error) {
      console.error('Passkey registration failed:', error);
      // User can still use the wallet without passkey
    }
  };

  const handleUnlock = () => {
    // Wallet unlocked, show dashboard
  };

  const handleReset = () => {
    // Wallet reset, go back to setup
  };

  const handleLogout = async () => {
    await sessionLogout();
    logout();
  };

  // No wallet or needs backup - show setup
  if (!hasWallet || needsBackup) {
    return <WalletSetup onComplete={handleComplete} />;
  }

  // Wallet exists but locked - show unlock
  if (!isUnlocked) {
    return <UnlockWallet onUnlock={handleUnlock} onReset={handleReset} />;
  }

  // Wallet unlocked - show dashboard
  return <WalletDashboard />;
};

// Legacy wallet experience - existing architecture
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
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  // Feature flag for self-custodial mode
  const useSelfCustodial = true; // Set to true to enable self-custodial wallet

  // Listen for path changes
  useEffect(() => {
    const handlePopState = () => setCurrentPath(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (!token || tokenHandled) return;

    // Skip magic link verification if we're on recovery page (recovery has its own token handling)
    if (currentPath === '/recovery') return;

    verifyMagicToken(token)
      .finally(() => {
        params.delete('token');
        const next = params.toString();
        const url = `${window.location.pathname}${next ? `?${next}` : ''}`;
        window.history.replaceState({}, '', url);
        setTokenHandled(true);
      })
      .catch(() => { });
  }, [tokenHandled, verifyMagicToken, currentPath]);

  // Show recovery page if on /recovery path
  if (currentPath === '/recovery') {
    return <RecoveryPage />;
  }

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

  // Use self-custodial or legacy wallet experience
  if (useSelfCustodial) {
    return <SelfCustodialWalletExperience />;
  }

  return <WalletExperience email={email} />;
};

const App: React.FC = () => (
  <ErrorBoundary>
    <SessionProvider>
      <SelfCustodialWalletProvider>
        <WalletProvider>
          <ArcAccountProvider>
            <ActivityProvider>
              <IdentityProvider>
                <PrivacyProvider>
                  <MultiSigProvider>
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
                  </MultiSigProvider>
                </PrivacyProvider>
              </IdentityProvider>
            </ActivityProvider>
          </ArcAccountProvider>
        </WalletProvider>
      </SelfCustodialWalletProvider>
    </SessionProvider>
  </ErrorBoundary>
);

export default App;
