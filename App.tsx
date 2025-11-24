import React, { useEffect, useState } from 'react';
import './styles/magic.css';
import ErrorBoundary from './components/ErrorBoundary';
import WalletDashboard from './components/WalletDashboard';
import LoginPage from './pages/LoginPage';
const PrivacyPolicy = React.lazy(() => import('./pages/PrivacyPolicy'));
const TermsAndConditions = React.lazy(() => import('./pages/TermsAndConditions'));
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
import UnlockWalletPasskey from './components/UnlockWalletPasskey';

// Self-custodial wallet experience - new architecture
const SelfCustodialWalletExperience: React.FC = () => {
  const {
    hasWallet,
    isUnlocked,
    logout,
  } = useSelfCustodialWallet();
  const { logout: sessionLogout } = useSession();

  const handleComplete = async () => {
    // Wallet created successfully with SDK
    console.log('[App] Wallet creation complete');
  };

  const handleUnlock = () => {
    // Wallet unlocked, show dashboard
    console.log('[App] Wallet unlocked');
  };

  const handleReset = () => {
    // Wallet reset, go back to setup
    console.log('[App] Wallet reset');
  };

  const handleLogout = async () => {
    await sessionLogout();
    logout();
  };

  // No wallet - show setup (Create Passkey)
  if (!hasWallet) {
    return <WalletSetup onComplete={handleComplete} />;
  }

  // Wallet exists but locked - show unlock (Verify Passkey)
  // This enforces passkey authentication even after magic link login
  if (!isUnlocked) {
    return <UnlockWalletPasskey onUnlock={handleUnlock} onReset={handleReset} />;
  }

  // Only show dashboard if wallet is UNLOCKED (Passkey verified)
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

  const verificationStarted = React.useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (!token || tokenHandled || verificationStarted.current) return;

    // Skip magic link verification if we're on recovery page (recovery has its own token handling)
    // if (currentPath === '/recovery') return;

    verificationStarted.current = true;
    console.log('[App] Verifying magic link token...');

    verifyMagicToken(token)
      .then(() => {
        console.log('[App] Magic link verified successfully');
      })
      .catch((error) => {
        console.error('[App] Magic link verification failed:', error);
      })
      .finally(() => {
        params.delete('token');
        const next = params.toString();
        const url = `${window.location.pathname}${next ? `?${next}` : ''}`;
        window.history.replaceState({}, '', url);
        setTokenHandled(true);
      });
  }, [tokenHandled, verifyMagicToken, currentPath]);

  // Show recovery page if on /recovery path
  // if (currentPath === '/recovery') {
  //   return <RecoveryPage />;
  // }

  if (currentPath === '/privacy-policy') {
    return <PrivacyPolicy />;
  }

  if (currentPath === '/terms-and-conditions') {
    return <TermsAndConditions />;
  }

  // Use self-custodial or legacy wallet experience
  // if (useSelfCustodial) {
  // Hybrid auth: Email + Passkey
  // Email is required for multi-device support and recovery
  if (!email) {
    return <LoginPage />;
  }
  return <SelfCustodialWalletExperience />;
  // }

  // Legacy wallet requires email
  // if (!email) {
  //   return <LoginPage />;
  // }

  // return <WalletExperience email={email} />;
};

const App: React.FC = () => {
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled Promise Rejection:', event.reason);
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    return () => window.removeEventListener('unhandledrejection', handleUnhandledRejection);
  }, []);

  return (
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
                        <React.Suspense fallback={null}>
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
};

export default App;
