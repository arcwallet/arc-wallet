import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { sessionApi } from '../services/sessionApi';

interface SessionState {
  email: string | null;
  hasWallet: boolean;
  walletAddress: string | null;
  userId: string | null;
  loading: boolean;
}

interface SessionContextValue extends SessionState {
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  currentEmail: string | null;
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<SessionState>({
    email: null,
    hasWallet: false,
    walletAddress: null,
    userId: null,
    loading: true,
  });

  const refresh = useCallback(async () => {
    try {
      console.log('[SessionContext] Refreshing session...');
      const session = await sessionApi.getSession();
      console.log('[SessionContext] Session retrieved:', session);
      setState((prev) => ({
        ...prev,
        email: session?.email ?? null,
        hasWallet: session?.hasWallet ?? false,
        walletAddress: session?.walletAddress ?? null,
        userId: session?.userId ?? null,
        loading: false,
      }));
    } catch (error) {
      console.error('[SessionContext] Session refresh failed:', error);
      setState((prev) => ({
        ...prev,
        email: null,
        hasWallet: false,
        walletAddress: null,
        userId: null,
        loading: false,
      }));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    await sessionApi.logout();
    await refresh();
  }, [refresh]);

  const value: SessionContextValue = {
    ...state,
    currentEmail: state.email,
    refresh,
    logout,
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
};

export const useSession = (): SessionContextValue => {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error('useSession must be used within SessionProvider');
  }
  return ctx;
};
