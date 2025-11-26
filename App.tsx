import React, { useEffect, useState } from 'react';
import './styles/magic.css';
import ErrorBoundary from './components/ErrorBoundary';
import WalletDashboard from './components/WalletDashboard';
import LoginPage from './pages/LoginPage';
const PrivacyPolicy = React.lazy(() => import('./pages/PrivacyPolicy'));
const TermsAndConditions = React.lazy(() => import('./pages/TermsAndConditions'));
import { SessionProvider, useSession } from './contexts/SessionContext';
import { WalletProvider } from './contexts/WalletContext';
import { ArcAccountProvider } from './contexts/ArcAccountContext';
import { ActivityProvider } from './contexts/ActivityContext';
import { MultiSigProvider } from './contexts/MultiSigContext';
import { PrivacyProvider } from './contexts/PrivacyContext';
// Smart Contract Passkey Wallet (NEW - default)
import { PasskeyAccountProvider, usePasskeyAccount } from './contexts/PasskeyAccountContext';
// Legacy EOA wallet (kept for backwards compatibility)
import { SelfCustodialWalletProvider } from './contexts/SelfCustodialWalletContext';
import WalletSetup from './components/WalletSetup';

// Smart Contract Passkey Wallet Experience
// NEW ARCHITECTURE: Passkey IS the signing key, no private key stored
const PasskeyWalletExperience: React.FC = () => {
  const { isConnected } = usePasskeyAccount();

  const handleComplete = () => {
    // Wallet created/connected successfully
    console.log('[App] Smart Contract Wallet ready');
  };

  // No account or not connected - show setup
  // WalletSetup now uses PasskeyAccountContext (Smart Contract)
  if (!isConnected) {
    return <WalletSetup onComplete={handleComplete} />;
  }

  // Connected - show dashboard
  return <WalletDashboard />;
};



const RootView: React.FC = () => {
  const { email, verifyMagicToken } = useSession();
  const [tokenHandled, setTokenHandled] = useState(false);
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

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

  // Email is required for multi-device support and recovery
  if (!email) {
    return <LoginPage />;
  }

  // Use Smart Contract Passkey Wallet (NEW - default)
  return <PasskeyWalletExperience />;
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
        <PasskeyAccountProvider>
          <SelfCustodialWalletProvider>
            <WalletProvider>
              <ArcAccountProvider>
                <ActivityProvider>
                  <PrivacyProvider>
                    <MultiSigProvider>
                      <div className="auth-wrapper">
                        <React.Suspense fallback={null}>
                          <RootView />
                        </React.Suspense>
                      </div>
                    </MultiSigProvider>
                  </PrivacyProvider>
                </ActivityProvider>
              </ArcAccountProvider>
            </WalletProvider>
          </SelfCustodialWalletProvider>
        </PasskeyAccountProvider>
      </SessionProvider>
    </ErrorBoundary>
  );
};

export default App;
