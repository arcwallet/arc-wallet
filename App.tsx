import React, { useEffect, useState } from 'react';
import './styles/magic.css';
import ErrorBoundary from './components/ErrorBoundary';
import DesktopOnlyGuard from './components/DesktopOnlyGuard';
import WalletDashboard from './components/WalletDashboard';
import LoginPage from './pages/LoginPage';
const PrivacyPolicy = React.lazy(() => import('./pages/PrivacyPolicy'));
const TermsAndConditions = React.lazy(() => import('./pages/TermsAndConditions'));
import { SessionProvider, useSession } from './contexts/SessionContext';
import { ArcAccountProvider } from './contexts/ArcAccountContext';
import { ActivityProvider } from './contexts/ActivityContext';
import { MultiSigProvider } from './contexts/MultiSigContext';
import { PrivacyProvider } from './contexts/PrivacyContext';
import { NetworkProvider } from './contexts/NetworkContext';
// Smart Contract Passkey Wallet (ERC-4337)
import { PasskeyAccountProvider, usePasskeyAccount } from './contexts/PasskeyAccountContext';
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
  const { email } = useSession();
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  // Listen for path changes
  useEffect(() => {
    const handlePopState = () => setCurrentPath(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  if (currentPath === '/privacy-policy') {
    return <PrivacyPolicy />;
  }

  if (currentPath === '/terms-and-conditions') {
    return <TermsAndConditions />;
  }

  // Email is required for multi-device support and recovery
  // User authenticates via Circle Email OTP
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
      <DesktopOnlyGuard>
        <SessionProvider>
          <NetworkProvider>
            <PasskeyAccountProvider>
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
            </PasskeyAccountProvider>
          </NetworkProvider>
        </SessionProvider>
      </DesktopOnlyGuard>
    </ErrorBoundary>
  );
};

export default App;
