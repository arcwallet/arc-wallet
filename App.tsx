// Fix: Import `useState` from React to fix "Cannot find name 'useState'" error.
import React, { useState } from 'react';
import WalletSelectionScreen from './components/WalletSelectionScreen';
import WalletSetupScreen from './components/WalletSetupScreen';
import WalletDashboard from './components/WalletDashboard';
import ErrorBoundary from './components/ErrorBoundary';
import { WalletProvider, useWallet } from './contexts/WalletContext';
import { ArcAccountProvider } from './contexts/ArcAccountContext';
import { ActivityProvider } from './contexts/ActivityContext';

const AppContent: React.FC = () => {
  const { isAuthenticated, isConnecting, loginWithPasskey } = useWallet();
  const [setupComplete, setSetupComplete] = useState(false); // This can be removed later when setup flow is real

  const handleSetupComplete = () => {
    setSetupComplete(true);
  };
  
  if (!isAuthenticated) {
    return <WalletSelectionScreen onConnect={loginWithPasskey} isConnecting={isConnecting} />;
  }

  // This setup screen is part of the initial flow but for now we bypass it after connect.
  // In the future, connection might lead to setup if the wallet is new.
  if (!setupComplete) {
     // A sensible default is to consider setup complete once connected.
     // This can be made more complex later.
     handleSetupComplete();
  }

  return <WalletDashboard />;
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <WalletProvider>
        <ArcAccountProvider>
          <ActivityProvider>
            <AppContent />
          </ActivityProvider>
        </ArcAccountProvider>
      </WalletProvider>
    </ErrorBoundary>
  );
};

export default App;
