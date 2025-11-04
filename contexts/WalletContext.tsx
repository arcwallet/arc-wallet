import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from 'react';
import { Wallet } from 'ethers';
import { passkeyClient, PasskeyClientError, type SessionKey } from '../services/passkeyClient';
import { createRegistrationCredential, createAuthenticationCredential } from '../utils/webauthn';

interface WalletContextValue {
  isAuthenticated: boolean;
  isConnecting: boolean;
  address: string | null;
  userId: string | null;
  sessionKey: SessionKey | null;
  loginWithPasskey: () => Promise<void>;
  logout: () => void;
}

const WalletContext = createContext<WalletContextValue | undefined>(undefined);

const USER_ID_STORAGE_KEY = 'arcwallet:user-id';
const SESSION_KEY_STORAGE_KEY = 'arcwallet:session-key';

const getOrCreateUserId = () => {
  if (typeof window === 'undefined') {
    return null;
  }
  let userId = window.localStorage.getItem(USER_ID_STORAGE_KEY);
  if (!userId) {
    userId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `user-${Date.now()}`;
    window.localStorage.setItem(USER_ID_STORAGE_KEY, userId);
  }
  return userId;
};

export const WalletProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [address, setAddress] = useState<string | null>(null);
  const [sessionKey, setSessionKey] = useState<SessionKey | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const storedUserId = window.localStorage.getItem(USER_ID_STORAGE_KEY);
    if (storedUserId) {
      setUserId(storedUserId);
    }

    const sessionRaw = window.sessionStorage.getItem(SESSION_KEY_STORAGE_KEY);
    if (sessionRaw) {
      try {
        const parsed = JSON.parse(sessionRaw) as SessionKey;
        const expiresMs = Date.parse(parsed.expiresAt);
        if (!Number.isNaN(expiresMs) && expiresMs > Date.now()) {
          setSessionKey(parsed);
          setAddress(parsed.address);
          setIsAuthenticated(true);
          return;
        }
      } catch (error) {
        console.warn('Failed to parse stored session key', error);
      }
      window.sessionStorage.removeItem(SESSION_KEY_STORAGE_KEY);
    }

    const legacyAddress = window.sessionStorage.getItem('arcwallet:last-address');
    if (legacyAddress) {
      setAddress(legacyAddress);
      setIsAuthenticated(true);
    }
  }, []);

  const finalizeSession = useCallback((session: SessionKey) => {
    setSessionKey(session);
    setAddress(session.address);
    setIsAuthenticated(true);
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(SESSION_KEY_STORAGE_KEY, JSON.stringify(session));
    }
  }, []);

  const registerPasskey = useCallback(async (userId: string) => {
    const username = `Arc User ${userId.slice(0, 6)}`;
    try {
      const options = await passkeyClient.beginRegistration(userId, username);
      const credential = await createRegistrationCredential(options);
      await passkeyClient.finishRegistration(userId, credential);
    } catch (error) {
      if (error instanceof PasskeyClientError && error.status === 400) {
        console.info('Passkey already registered, skipping re-registration');
        return;
      }
      if (error instanceof DOMException && error.name === 'InvalidStateError') {
        console.info('Credential already exists on this authenticator');
        return;
      }
      throw error;
    }
  }, []);

  const authenticateWithPasskey = useCallback(async (userId: string) => {
    const options = await passkeyClient.beginAuthentication(userId);
    const credential = await createAuthenticationCredential(options);
    const { sessionKey: newSession } = await passkeyClient.finishAuthentication(userId, credential);
    return newSession;
  }, []);

  const loginWithPasskey = useCallback(async () => {
    if (typeof window === 'undefined') {
      return;
    }
    if (!('credentials' in navigator)) {
      window.alert('WebAuthn is not supported in this browser.');
      return;
    }

    const userId = getOrCreateUserId();
    if (!userId) {
      window.alert('Unable to establish user identity for passkey login.');
      return;
    }
    setUserId(userId);

    setIsConnecting(true);
    try {
      let session = await authenticateWithPasskey(userId);
      finalizeSession(session);
    } catch (firstError) {
      if (firstError instanceof PasskeyClientError && firstError.status === 404) {
        try {
          await registerPasskey(userId);
          const session = await authenticateWithPasskey(userId);
          finalizeSession(session);
          return;
        } catch (registerError) {
          console.error('Passkey registration failed', registerError);
          window.alert('Passkey registration failed. Please try again.');
          return;
        }
      }

      if (firstError instanceof DOMException && firstError.name === 'NotAllowedError') {
        console.warn('Passkey authentication was cancelled by the user.');
        return;
      }

      console.error('Passkey authentication failed', firstError);
      const fallback = window.confirm(
        'Passkey authentication failed. Would you like to generate a temporary session key as developer mode?',
      );
      if (fallback) {
        const wallet = Wallet.createRandom();
        window.alert(
          `Developer session private key generated:\n${wallet.privateKey}\n\nPlease store this key securely. Session will expire in 10 minutes.`,
        );
        const session = {
          address: wallet.address,
          privateKey: wallet.privateKey,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        } as SessionKey;
        finalizeSession(session);
        return;
      }

      window.alert('Passkey authentication failed. Please try again.');
    } finally {
      setIsConnecting(false);
    }
  }, [authenticateWithPasskey, finalizeSession, registerPasskey]);

  const logout = useCallback(() => {
    setAddress(null);
    setSessionKey(null);
    setIsAuthenticated(false);
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(SESSION_KEY_STORAGE_KEY);
    }
  }, []);

  const value = useMemo<WalletContextValue>(
    () => ({ isAuthenticated, isConnecting, address, userId, sessionKey, loginWithPasskey, logout }),
    [isAuthenticated, isConnecting, address, userId, sessionKey, loginWithPasskey, logout],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
};

export const useWallet = (): WalletContextValue => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};
