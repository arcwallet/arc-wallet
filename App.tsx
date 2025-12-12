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

// Circle Modular Wallet (ERC-4337 + ERC-6900)
import { CircleWalletProvider, useCircleWallet } from './contexts/CircleWalletContext';
import { ERC6900MultiSigProvider } from './contexts/ERC6900MultiSigContext';
import { BridgeProvider } from './contexts/BridgeContext';
import WalletSetup from './components/WalletSetup';

// Circle Modular Wallet Experience
// Uses Circle's infrastructure for passkey-based smart accounts
const CircleWalletExperience: React.FC = () => {
  const { isConnected } = useCircleWallet();

  const handleComplete = () => {
    // Wallet created/connected successfully
    console.log('[App] Circle Modular Wallet ready');
  };

  // No account or not connected - show setup
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

  // Use Circle Modular Wallet
  return <CircleWalletExperience />;
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
            <CircleWalletProvider>
              <BridgeProvider>
                <ERC6900MultiSigProvider>
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
                </ERC6900MultiSigProvider>
              </BridgeProvider>
            </CircleWalletProvider>
          </NetworkProvider>
        </SessionProvider>
      </DesktopOnlyGuard>
    </ErrorBoundary>
  );
};

export default App;
