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
const ENCRYPTION_SECRET =
  ((import.meta as any).env?.VITE_WALLET_ENCRYPTION_SECRET as string | undefined) ?? '';

const textEncoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
const textDecoder = typeof TextDecoder !== 'undefined' ? new TextDecoder() : null;

const supportsEncryption = () =>
  typeof window !== 'undefined' &&
  Boolean(window.crypto?.subtle) &&
  Boolean(textEncoder && textDecoder) &&
  ENCRYPTION_SECRET.length >= 16;

let encryptionWarningIssued = false;

const ensureEncryptionConfigured = () => {
  const ready = supportsEncryption();
  if (!ready && typeof window !== 'undefined' && !encryptionWarningIssued) {
    encryptionWarningIssued = true;
    const message =
      'Secure wallet backup is disabled because VITE_WALLET_ENCRYPTION_SECRET is missing or too short. Configure a strong secret to enable automatic wallet recovery.';
    console.warn(message);
    window.alert(message);
  }
  return ready;
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
  if (!ensureEncryptionConfigured()) {
    console.warn('Skipping wallet persistence because encryption is not configured');
    return;
  }
  const existing = loadStoredWallets();
  existing[email.toLowerCase()] = await encryptSession(email, session);
  window.localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(existing));
};

const getWalletForEmail = async (email: string | null): Promise<SessionKey | null> => {
  if (!email || typeof window === 'undefined') return null;
  if (!ensureEncryptionConfigured()) {
    return null;
  }
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

  const loadStoredWalletForCurrentEmail = useCallback(async (): Promise<SessionKey | null> => {
    if (!currentEmail) return null;
    return getWalletForEmail(currentEmail);
  }, [currentEmail]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    ensureEncryptionConfigured();
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

    const finishResp = await passkeyClient.finishAuthentication(credential);
    const newSession = finishResp.data?.sessionKey ?? (finishResp as any).data?.sessionKey;
    const user = finishResp.data?.user ?? (finishResp as any).data?.user;
    if (!newSession) {
      throw new Error('Authentication succeeded but no session key was issued by the server.');
    }
    if (user?.id && typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(USER_ID_STORAGE_KEY, user.id);
        setUserId(user.id);
      } catch {}
    }
    // Include username in session key for future authentications
    const sessionWithUsername: SessionKey = {
      ...newSession,
      username: user?.username || username
    };
    return sessionWithUsername;
  }, []);

  const registerPasskey = useCallback(async (email: string): Promise<SessionKey | null> => {
    const trimmedEmail = email.trim();
    const normalizedEmail = trimmedEmail.toLowerCase();
    if (!normalizedEmail) {
      throw new Error('Email is required for passkey registration');
    }
    try {
      const startResp = await passkeyClient.beginRegistration(normalizedEmail, trimmedEmail);
      const options = startResp.data?.options ?? (startResp as any).data?.options;
      const credential = await createRegistrationCredential(options);
      const finishResp = await passkeyClient.finishRegistration(normalizedEmail, credential);

      const sessionKey = finishResp.data?.sessionKey ?? (finishResp as any).data?.sessionKey;
      const user = finishResp.data?.user ?? (finishResp as any).data?.user;

      if (user?.id && typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(USER_ID_STORAGE_KEY, user.id);
          setUserId(user.id);
        } catch {}
      }

      if (sessionKey) {
        const sessionWithUsername: SessionKey = {
          ...sessionKey,
          username: user?.username || normalizedEmail
        };
        return sessionWithUsername;
      }

      // Backend must always issue a session key; fallback to explicit auth just in case
      return await authenticateWithPasskey(normalizedEmail);
    } catch (error) {
      if (error instanceof PasskeyClientError && error.status === 400) {
        console.info('Passkey already registered, trying to authenticate instead');
        return authenticateWithPasskey(normalizedEmail);
      }
      if (error instanceof DOMException && error.name === 'InvalidStateError') {
        console.info('Credential already exists on this authenticator, trying to authenticate');
        return authenticateWithPasskey(normalizedEmail);
      }
      throw error;
    }
  }, [authenticateWithPasskey]);

  const loginWithPasskey = useCallback(async () => {
    if (typeof window === 'undefined') {
      return;
    }
    if (!currentEmail) {
      window.alert('Please verify your email first and try again.');
      return;
    }
    if (!('credentials' in navigator)) {
      window.alert('WebAuthn is not supported in this browser.');
      return;
    }

    setIsConnecting(true);
    try {
      // STEP 1: Check if user already has registered passkeys in the database
      const passkeyCheck = await passkeyClient.checkUserPasskeys(currentEmail);
      const hasExistingPasskey = passkeyCheck.data?.hasPasskey ?? false;
      const passkeyCount = passkeyCheck.data?.passkeyCount ?? 0;

      console.log('[Wallet] Passkey check result:', { hasExistingPasskey, passkeyCount, email: currentEmail });

      if (hasExistingPasskey) {
        // User HAS passkeys - only allow authentication, not registration
        try {
          // Try authentication with username to get specific credentials
          const session = await authenticateWithPasskey(currentEmail);
          const storedWallet = await loadStoredWalletForCurrentEmail();
          finalizeSession(storedWallet ?? session);
          return;
        } catch (authError) {
          // If authentication fails and user has passkeys, they need to use the original device or recovery
          if (authError instanceof PasskeyClientError && authError.status === 404) {
            window.alert(
              'Your passkey is registered on another device or browser.\n\n' +
              'Please:\n' +
              '1. Use the same device/browser where you created your passkey, OR\n' +
              '2. Use Account Recovery to reset your passkey\n\n' +
              'Each email can only have one wallet.'
            );
            return;
          }
          if (authError instanceof DOMException && authError.name === 'NotAllowedError') {
            console.warn('Passkey authentication was cancelled by the user.');
            return;
          }
          throw authError;
        }
      } else {
        // User has NO passkeys - this is a new user, allow registration
        console.log('[Wallet] New user detected, starting passkey registration');
        try {
          const newSession = await registerPasskey(currentEmail);
          if (newSession) {
            finalizeSession(newSession);
          }
          return;
        } catch (registerErr) {
          // If registration fails because passkey already exists on device
          if (registerErr instanceof DOMException && registerErr.name === 'InvalidStateError') {
            console.info('Credential already exists on authenticator, trying to authenticate');
            const session = await authenticateWithPasskey(currentEmail);
            const storedWallet = await loadStoredWalletForCurrentEmail();
            finalizeSession(storedWallet ?? session);
            return;
          }
          console.error('Passkey registration failed', registerErr);
          window.alert('Passkey registration failed. Please try again.');
          return;
        }
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        console.warn('Passkey operation was cancelled by the user.');
        return;
      }

      console.error('Passkey authentication failed', error);
      window.alert('Passkey authentication failed. Please try again.');
    } finally {
      setIsConnecting(false);
    }
  }, [authenticateWithPasskey, registerPasskey, finalizeSession, currentEmail, loadStoredWalletForCurrentEmail]);

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
        if (typeof window !== 'undefined') {
          window.alert(
            'Your wallet is ready. Write down your private key and store it safely. You can reveal it later under Settings → Wallet Backup.',
          );
        }
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
        if (!currentEmail) {
          throw new Error('Cannot add a new passkey before the email is verified.');
        }
        const session = await registerPasskey(currentEmail);
        const stored = await loadStoredWalletForCurrentEmail();
        const sessionToUse = stored ?? session;
        if (sessionToUse) {
          finalizeSession(sessionToUse);
        }
      },
      verifyWithPasskey: async () => {
        try {
          const storedUsername = sessionKey?.username || currentEmail;
          const session = await authenticateWithPasskey(storedUsername ?? undefined);
          const stored = await loadStoredWalletForCurrentEmail();
          finalizeSession(stored ?? session);
        } catch (error) {
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
      currentEmail,
      loadStoredWalletForCurrentEmail,
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
