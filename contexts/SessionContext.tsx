import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { sessionApi } from '../services/sessionApi';

interface SessionState {
  email: string | null;
  hasWallet: boolean;
  walletAddress: string | null;
  userId: string | null;
  loading: boolean;
  requestStatus: 'idle' | 'success' | 'error';
  message: string | null;
  verifyingToken: boolean;
}

interface SessionContextValue extends SessionState {
  sendMagicLink: (email: string) => Promise<void>;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  verifyMagicToken: (token: string) => Promise<void>;
  currentEmail: string | null;
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<SessionState>({
    email: null,
    hasWallet: false,
    walletAddress: null,
    userId: null,
    loading: false,
    requestStatus: 'idle',
    message: null,
    verifyingToken: false,
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

  const sendMagicLink = useCallback(async (email: string) => {
    setState((prev) => ({
      ...prev,
      requestStatus: 'idle',
      message: null,
    }));
    try {
      const response = await sessionApi.sendLink(email);
      setState((prev) => ({
        ...prev,
        requestStatus: 'success',
        message: response?.message ?? 'Magic link sent. Please check your inbox.',
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        requestStatus: 'error',
        message: error instanceof Error ? error.message : 'Unable to send magic link.',
      }));
    }
  }, []);

  const logout = useCallback(async () => {
    await sessionApi.logout();
    await refresh();
  }, [refresh]);

  const verifyMagicToken = useCallback(
    async (token: string) => {
      setState((prev) => ({ ...prev, verifyingToken: true, message: null }));
      try {
        await sessionApi.verify(token);
        await refresh();
        setState((prev) => ({ ...prev, verifyingToken: false }));
      } catch (error) {
        setState((prev) => ({
          ...prev,
          verifyingToken: false,
          message: error instanceof Error ? error.message : 'Failed to verify magic link.',
        }));
        throw error;
      }
    },
    [refresh],
  );

  const value: SessionContextValue = {
    ...state,
    currentEmail: state.email,
    sendMagicLink,
    refresh,
    logout,
    verifyMagicToken,
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
