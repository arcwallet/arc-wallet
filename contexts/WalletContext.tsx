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
import { useSession } from './SessionContext';

interface WalletContextValue {
  isAuthenticated: boolean;
  isConnecting: boolean;
  address: string | null;
  userId: string | null;
  sessionKey: SessionKey | null;
  loginWithPasskey: () => Promise<void>;
  logout: () => void;
  registerPasskeyForCurrentUser: () => Promise<void>;
  verifyWithPasskey: () => Promise<void>;
  activateWithPrivateKey: (privateKey: string) => Promise<void>;
}

const WalletContext = createContext<WalletContextValue | undefined>(undefined);

const USER_ID_STORAGE_KEY = 'arcwallet:user-id';
const SESSION_KEY_STORAGE_KEY = 'arcwallet:session-key';
const WALLET_STORAGE_KEY = 'arcwallet:wallets';
const ENCRYPTION_SECRET = import.meta.env.VITE_WALLET_ENCRYPTION_SECRET ?? '';

const textEncoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
const textDecoder = typeof TextDecoder !== 'undefined' ? new TextDecoder() : null;

const supportsEncryption = () =>
  typeof window !== 'undefined' &&
  Boolean(window.crypto?.subtle) &&
  Boolean(textEncoder && textDecoder) &&
  ENCRYPTION_SECRET.length >= 16;

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

const toBase64 = (buffer: ArrayBuffer) => {
  if (typeof window === 'undefined') return '';
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return window.btoa(binary);
};

const fromBase64 = (value: string) => {
  if (typeof window === 'undefined') return new Uint8Array();
  const binary = window.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const loadStoredWallets = (): Record<string, { cipher: string; iv?: string }> => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(WALLET_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, { cipher: string; iv?: string }>) : {};
  } catch {
    return {};
  }
};

const removeStoredWallet = (email: string) => {
  if (typeof window === 'undefined') return;
  const lower = email.toLowerCase();
  const existing = loadStoredWallets();
  if (!existing[lower]) return;
  delete existing[lower];
  if (Object.keys(existing).length === 0) {
    window.localStorage.removeItem(WALLET_STORAGE_KEY);
  } else {
    window.localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(existing));
  }
};

const getAesKey = async (email: string) => {
  const encoder = textEncoder!;
  const hash = await window.crypto.subtle.digest('SHA-256', encoder.encode(`${email.toLowerCase()}::${ENCRYPTION_SECRET}`));
  return window.crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
};

const encryptSession = async (email: string, session: SessionKey) => {
  if (!supportsEncryption() || !textEncoder) {
    return { cipher: JSON.stringify(session) };
  }
  const key = await getAesKey(email);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const cipherBuffer = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, textEncoder.encode(JSON.stringify(session)));
  return { cipher: toBase64(cipherBuffer), iv: toBase64(iv.buffer) };
};

const decryptSession = async (email: string, record: { cipher: string; iv?: string }) => {
  if (!record) return null;
  if (!supportsEncryption() || !record.iv || !textDecoder) {
    try {
      return JSON.parse(record.cipher) as SessionKey;
    } catch {
      return null;
    }
  }
  try {
    const key = await getAesKey(email);
    const ivBytes = fromBase64(record.iv);
    const cipherBytes = fromBase64(record.cipher);
    const plainBuffer = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBytes }, key, cipherBytes);
    const decoder = textDecoder;
    return JSON.parse(decoder.decode(plainBuffer)) as SessionKey;
  } catch (error) {
    console.warn('Failed to decrypt wallet for email', email, error);
    return null;
  }
};

const persistWalletForEmail = async (email: string, session: SessionKey) => {
  if (typeof window === 'undefined') return;
  const existing = loadStoredWallets();
  existing[email.toLowerCase()] = await encryptSession(email, session);
  window.localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(existing));
};

const getWalletForEmail = async (email: string | null): Promise<SessionKey | null> => {
  if (!email || typeof window === 'undefined') return null;
  const stored = loadStoredWallets();
  const record = stored[email.toLowerCase()];
  if (!record) return null;
  const decrypted = await decryptSession(email, record);
  if (!decrypted) {
    removeStoredWallet(email);
  }
  return decrypted;
};

export const WalletProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [address, setAddress] = useState<string | null>(null);
  const [sessionKey, setSessionKey] = useState<SessionKey | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const { currentEmail } = useSession();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!supportsEncryption()) {
      console.warn(
        'Wallet encryption disabled. Configure VITE_WALLET_ENCRYPTION_SECRET with at least 16 characters to protect stored sessions.',
      );
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    let cancelled = false;

    const initialize = async () => {
      const storedUserId = window.localStorage.getItem(USER_ID_STORAGE_KEY);
      if (storedUserId && !cancelled) {
        setUserId(storedUserId);
      }

      const stored = await getWalletForEmail(currentEmail ?? null);
      if (cancelled) {
        return;
      }
      if (stored) {
        setSessionKey(stored);
        setAddress(stored.address);
        setIsAuthenticated(true);
        window.sessionStorage.setItem(SESSION_KEY_STORAGE_KEY, JSON.stringify(stored));
        return;
      }

      const sessionRaw = window.sessionStorage.getItem(SESSION_KEY_STORAGE_KEY);
      if (sessionRaw) {
        try {
          const parsed = JSON.parse(sessionRaw) as SessionKey;
          const expiresMs = Date.parse(parsed.expiresAt);
          if (!Number.isNaN(expiresMs) && expiresMs > Date.now() && !cancelled) {
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
      if (legacyAddress && !cancelled) {
        setAddress(legacyAddress);
        setIsAuthenticated(true);
      }
    };

    void initialize();

    return () => {
      cancelled = true;
    };
  }, [currentEmail]);

  const finalizeSession = useCallback((session: SessionKey) => {
    setSessionKey(session);
    setAddress(session.address);
    setIsAuthenticated(true);
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(SESSION_KEY_STORAGE_KEY, JSON.stringify(session));
      if (currentEmail) {
        void persistWalletForEmail(currentEmail, session).catch((error) => {
          console.warn('Failed to persist wallet for email', currentEmail, error);
        });
      }
    }
  }, [currentEmail]);

  // Define authenticateWithPasskey FIRST before registerPasskey (which uses it)
  const authenticateWithPasskey = useCallback(async (username?: string) => {
    const startResp = await passkeyClient.beginAuthentication(username);
    const options = startResp.data?.options ?? (startResp as any).data?.options;
    const credential = await createAuthenticationCredential(options);

    // Debug log - DETAILED
    console.log('🔍 Frontend Auth Credential FULL:', {
      id: credential.id,
      rawId: (credential as any).rawId,
      idLength: credential.id?.length,
      rawIdLength: (credential as any).rawId?.length,
      type: credential.type
    });

    // Also log what we're sending to backend
    console.log('📤 Sending to backend:', JSON.stringify(credential, null, 2).substring(0, 500));

    const finishResp = await passkeyClient.finishAuthentication(credential);
    const newSession = finishResp.data?.sessionKey ?? (finishResp as any).data?.sessionKey;
    const user = finishResp.data?.user ?? (finishResp as any).data?.user;
    if (user?.id && typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(USER_ID_STORAGE_KEY, user.id);
        setUserId(user.id);
      } catch {}
    }
    return newSession as SessionKey;
  }, []);

  const registerPasskey = useCallback(async (userId: string): Promise<SessionKey | null> => {
    const username = `Arc User ${userId.slice(0, 6)}`;
    try {
      const startResp = await passkeyClient.beginRegistration(username, username);
      const options = startResp.data?.options ?? (startResp as any).data?.options;
      const credential = await createRegistrationCredential(options);
      const finishResp = await passkeyClient.finishRegistration(username, credential);

      // Registration now returns a session key
      const sessionKey = finishResp.data?.sessionKey ?? (finishResp as any).data?.sessionKey;
      const user = finishResp.data?.user ?? (finishResp as any).data?.user;

      // Update user ID from registration response
      if (user?.id && typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(USER_ID_STORAGE_KEY, user.id);
          setUserId(user.id);
        } catch {}
      }

      return sessionKey as SessionKey;
    } catch (error) {
      if (error instanceof PasskeyClientError && error.status === 400) {
        console.info('Passkey already registered, trying to authenticate instead');
        // If already registered, try to authenticate
        const username = `Arc User ${userId.slice(0, 6)}`;
        const session = await authenticateWithPasskey(username);
        return session;
      }
      if (error instanceof DOMException && error.name === 'InvalidStateError') {
        console.info('Credential already exists on this authenticator, trying to authenticate');
        // If credential exists, try to authenticate
        const username = `Arc User ${userId.slice(0, 6)}`;
        const session = await authenticateWithPasskey(username);
        return session;
      }
      throw error;
    }
  }, [authenticateWithPasskey]);

  const loginWithPasskey = useCallback(async () => {
    if (typeof window === 'undefined') {
      return;
    }
    if (!('credentials' in navigator)) {
      window.alert('WebAuthn is not supported in this browser.');
      return;
    }

    setIsConnecting(true);
    try {
      // Use discoverable credentials (no username needed)
      // Browser will show all passkeys registered on this device for this RP_ID
      let session = await authenticateWithPasskey();
      finalizeSession(session);
    } catch (firstError) {
      if (firstError instanceof PasskeyClientError && firstError.status === 404) {
        // No passkey found, prompt user to create one
        window.alert('No passkey found. Please create a new passkey first.');
        return;
      }

      if (firstError instanceof DOMException && firstError.name === 'NotAllowedError') {
        console.warn('Passkey authentication was cancelled by the user.');
        return;
      }

      console.error('Passkey authentication failed', firstError);
      window.alert('Passkey authentication failed. Please try again.');
    } finally {
      setIsConnecting(false);
    }
  }, [authenticateWithPasskey, finalizeSession]);

  const logout = useCallback(() => {
    setAddress(null);
    setSessionKey(null);
    setIsAuthenticated(false);
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(SESSION_KEY_STORAGE_KEY);
    }
  }, []);

  const activateWithPrivateKey = useCallback(
    async (privateKey: string) => {
      try {
        const wallet = new Wallet(privateKey);
        const session: SessionKey = {
          privateKey: wallet.privateKey,
          address: wallet.address,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        };
        finalizeSession(session);
      } catch (error) {
        console.error('Invalid private key provided', error);
        throw new Error('Invalid private key. Please double-check and try again.');
      }
    },
    [finalizeSession],
  );

  const value = useMemo<WalletContextValue>(
    () => ({
      isAuthenticated,
      isConnecting,
      address,
      userId,
      sessionKey,
      loginWithPasskey,
      logout,
      registerPasskeyForCurrentUser: async () => {
        const uid = userId || getOrCreateUserId();
        if (!uid) throw new Error('No user identity');
        setUserId(uid);
        const session = await registerPasskey(uid);
        if (session) {
          finalizeSession(session);
        }
      },
      verifyWithPasskey: async () => {
        console.log('🔐 verifyWithPasskey called - using discoverable credentials');

        try {
          // Always use discoverable credentials for maximum compatibility
          // This allows the browser to show all available passkeys
          const session = await authenticateWithPasskey();
          console.log('✅ Passkey verification successful');
          finalizeSession(session);
        } catch (error) {
          console.error('❌ Passkey verification failed:', error);
          throw error;
        }
      },
      activateWithPrivateKey,
    }),
    [
      isAuthenticated,
      isConnecting,
      address,
      userId,
      sessionKey,
      loginWithPasskey,
      logout,
      registerPasskey,
      authenticateWithPasskey,
      finalizeSession,
      activateWithPrivateKey,
    ],
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
