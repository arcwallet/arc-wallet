import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { sessionApi } from '../services/sessionApi';

interface SessionState {
  email: string | null;
  loading: boolean;
  requestStatus: 'idle' | 'success' | 'error';
  message: string | null;
}

interface SessionContextValue extends SessionState {
  sendMagicLink: (email: string) => Promise<void>;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<SessionState>({
    email: null,
    loading: true,
    requestStatus: 'idle',
    message: null,
  });

  const refresh = useCallback(async () => {
    try {
      const session = await sessionApi.getSession();
      setState((prev) => ({
        ...prev,
        email: session?.email ?? null,
        loading: false,
      }));
    } catch {
      setState((prev) => ({
        ...prev,
        email: null,
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

  const value: SessionContextValue = {
    ...state,
    sendMagicLink,
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
