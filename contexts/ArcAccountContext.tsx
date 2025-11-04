import React, { createContext, useContext, ReactNode } from 'react';
import { useWallet } from './WalletContext';
import { useArcAccountSnapshot, type UseArcAccountSnapshotState } from '../hooks/useArcAccountSnapshot';

interface ArcAccountContextValue extends UseArcAccountSnapshotState {
  address: string | null;
}

const ArcAccountContext = createContext<ArcAccountContextValue | undefined>(undefined);

export const ArcAccountProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { address } = useWallet();
  const snapshotState = useArcAccountSnapshot(address);

  return (
    <ArcAccountContext.Provider value={{ address, ...snapshotState }}>
      {children}
    </ArcAccountContext.Provider>
  );
};

export const useArcAccount = (): ArcAccountContextValue => {
  const context = useContext(ArcAccountContext);
  if (!context) {
    throw new Error('useArcAccount must be used within an ArcAccountProvider');
  }
  return context;
};
