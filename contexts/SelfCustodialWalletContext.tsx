/**
 * Self-Custodial Wallet Context
 *
 * SECURITY: Private keys are generated and stored ONLY on client-side
 * Backend NEVER sees or stores private keys
 *
 * Flow:
 * 1. User creates wallet → Key generated locally → Encrypted with password
 * 2. User authenticates with passkey → Backend verifies identity
 * 3. User unlocks wallet → Decrypts local key with password
 * 4. Transactions signed locally → Only signed tx sent to backend
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from 'react';
import { passkeyClient, PasskeyClientError } from '../services/passkeyClient';
import { createRegistrationCredential, createAuthenticationCredential } from '../utils/webauthn';
import { useSession } from './SessionContext';
import {
  generateWallet,
  encryptWallet,
  decryptWallet,
  saveEncryptedWallet,
  loadEncryptedWallet,
  hasStoredWallet,
  deleteStoredWallet,
  importFromMnemonic,
  importFromPrivateKey,
  isValidMnemonic,
  isValidPrivateKey,
  WalletData,
} from '../services/cryptoService';

// Types
export interface SelfCustodialWalletContextValue {
  // Wallet state
  isAuthenticated: boolean;
  isUnlocked: boolean;
  isConnecting: boolean;
  hasWallet: boolean;
  needsBackup: boolean;
  address: string | null;
  userId: string | null;

  // Wallet creation/import
  createWallet: (password: string) => Promise<{ address: string; mnemonic: string }>;
  importWallet: (input: string, password: string) => Promise<string>;

  // Authentication
  loginWithPasskey: () => Promise<void>;
  registerPasskey: () => Promise<void>;

  // Wallet access
  unlockWallet: (password: string) => Promise<void>;
  lockWallet: () => void;
  getPrivateKey: () => string | null;

  // Management
  logout: () => void;
  deleteWallet: () => void;
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>;
  markBackedUp: () => void;
  getMnemonic: () => string | null;
}

const SelfCustodialWalletContext = createContext<SelfCustodialWalletContextValue | undefined>(undefined);

// Storage keys
const USER_ID_KEY = 'arcwallet:user-id';
const AUTH_STATE_KEY = 'arcwallet:auth-state';
const BACKUP_FLAG_KEY = 'arcwallet:needs-backup';

export const SelfCustodialWalletProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Core state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [hasWallet, setHasWallet] = useState(false);
  const [needsBackup, setNeedsBackup] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // In-memory only (cleared on lock/logout)
  const [privateKey, setPrivateKey] = useState<string | null>(null);
  const [mnemonic, setMnemonic] = useState<string | null>(null);

  const { currentEmail } = useSession();

  // Initialize on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check for existing wallet
    setHasWallet(hasStoredWallet());

    // Check backup flag
    const backupFlag = localStorage.getItem(BACKUP_FLAG_KEY);
    setNeedsBackup(backupFlag === 'true');

    // Restore user ID
    const storedUserId = localStorage.getItem(USER_ID_KEY);
    if (storedUserId) {
      setUserId(storedUserId);
    }

    // Check auth state
    const authState = sessionStorage.getItem(AUTH_STATE_KEY);
    if (authState) {
      try {
        const parsed = JSON.parse(authState);
        setIsAuthenticated(parsed.isAuthenticated);
        setAddress(parsed.address);
      } catch { }
    }
  }, []);

  // Upload encrypted wallet to backend
  const backupWallet = async (encrypted: any) => {
    try {
      await fetch('/api/wallet/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encryptedWallet: JSON.stringify(encrypted) }),
      });
    } catch (error) {
      console.error('Failed to backup wallet:', error);
      // Don't fail the flow, just log error
    }
  };

  // Create new wallet (generates key locally)
  const createWallet = useCallback(async (password: string): Promise<{ address: string; mnemonic: string }> => {
    setIsConnecting(true);

    try {
      // Generate wallet locally - NEVER sent to backend
      const walletData = generateWallet();

      if (!walletData.mnemonic) {
        throw new Error('Failed to generate mnemonic');
      }

      // Encrypt and save locally
      const encrypted = await encryptWallet(walletData, password);
      saveEncryptedWallet(encrypted);

      // Backup to backend
      await backupWallet(encrypted);

      // Update state
      setAddress(walletData.address);
      setPrivateKey(walletData.privateKey);
      setMnemonic(walletData.mnemonic);
      setHasWallet(true);
      setIsUnlocked(true);
      setNeedsBackup(true);

      // Save backup flag
      localStorage.setItem(BACKUP_FLAG_KEY, 'true');

      return {
        address: walletData.address,
        mnemonic: walletData.mnemonic,
      };
    } finally {
      setIsConnecting(false);
    }
  }, []);

  // Import wallet from mnemonic or private key
  const importWallet = useCallback(async (input: string, password: string): Promise<string> => {
    setIsConnecting(true);

    try {
      let walletData: WalletData;
      const trimmed = input.trim();

      if (isValidMnemonic(trimmed)) {
        walletData = importFromMnemonic(trimmed);
      } else if (isValidPrivateKey(trimmed)) {
        walletData = importFromPrivateKey(trimmed);
      } else {
        throw new Error('Invalid private key or mnemonic');
      }

      // Encrypt and save locally
      const encrypted = await encryptWallet(walletData, password);
      saveEncryptedWallet(encrypted);

      // Backup to backend
      await backupWallet(encrypted);

      // Update state
      setAddress(walletData.address);
      setPrivateKey(walletData.privateKey);
      setMnemonic(walletData.mnemonic || null);
      setHasWallet(true);
      setIsUnlocked(true);
      setNeedsBackup(false);

      localStorage.removeItem(BACKUP_FLAG_KEY);

      return walletData.address;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  // Register passkey (for identity, not wallet)
  const registerPasskey = useCallback(async () => {
    if (!address) {
      throw new Error('Create or import a wallet first');
    }

    setIsConnecting(true);

    try {
      const username = currentEmail || `user-${address.slice(0, 8)}`;
      const displayName = currentEmail || username;

      // Register passkey with backend
      const startResp = await passkeyClient.beginRegistration(username, displayName);
      const options = startResp.data?.options;
      const credential = await createRegistrationCredential(options);
      const finishResp = await passkeyClient.finishRegistration(username, credential);

      // Get user ID from backend
      const responseData = finishResp.data as { user?: { id: string; username: string; displayName: string } } | undefined;
      const user = responseData?.user;
      if (user?.id) {
        localStorage.setItem(USER_ID_KEY, user.id);
        setUserId(user.id);
      }

      setIsAuthenticated(true);

      // Save auth state
      sessionStorage.setItem(AUTH_STATE_KEY, JSON.stringify({
        isAuthenticated: true,
        address,
      }));

      // Ensure wallet is backed up after registration
      const encrypted = loadEncryptedWallet();
      if (encrypted) {
        await backupWallet(encrypted);
      }

    } catch (error) {
      if (error instanceof PasskeyClientError && error.status === 400) {
        // Already registered, try to authenticate
        await loginWithPasskeyInternal();
        return;
      }
      throw error;
    } finally {
      setIsConnecting(false);
    }
  }, [address, currentEmail]);

  // Login with passkey (internal)
  const loginWithPasskeyInternal = useCallback(async () => {
    const startResp = await passkeyClient.beginAuthentication(currentEmail || undefined);
    const options = startResp.data?.options;
    const credential = await createAuthenticationCredential(options);
    const finishResp = await passkeyClient.finishAuthentication(credential);

    const responseData = finishResp.data as { user?: { id: string; username: string; displayName: string } } | undefined;
    const user = responseData?.user;
    if (user?.id) {
      localStorage.setItem(USER_ID_KEY, user.id);
      setUserId(user.id);
    }

    setIsAuthenticated(true);

    // Check if we need to restore wallet from backend
    if (!hasStoredWallet()) {
      try {
        const backupResp = await fetch('/api/wallet/backup');
        if (backupResp.ok) {
          const { encryptedWallet } = await backupResp.json();
          if (encryptedWallet) {
            // Restore to local storage
            const parsed = JSON.parse(encryptedWallet);
            saveEncryptedWallet(parsed);
            setHasWallet(true);
            // Note: Wallet is still locked, user needs to enter password
          }
        }
      } catch (error) {
        console.error('Failed to restore wallet backup:', error);
      }
    }

    // Save auth state
    sessionStorage.setItem(AUTH_STATE_KEY, JSON.stringify({
      isAuthenticated: true,
      address, // Might be null if just restored
    }));
  }, [address, currentEmail]);

  // Login with passkey (public)
  const loginWithPasskey = useCallback(async () => {
    // Allow login even if no local wallet (to restore from backup)
    // if (!hasWallet) {
    //   throw new Error('No wallet found. Create or import a wallet first.');
    // }

    setIsConnecting(true);

    try {
      await loginWithPasskeyInternal();
    } catch (error) {
      if (error instanceof PasskeyClientError && error.status === 404) {
        // No passkey registered, need to register first
        throw new Error('No passkey found. Please register a passkey first.');
      }
      throw error;
    } finally {
      setIsConnecting(false);
    }
  }, [loginWithPasskeyInternal]);

  // Unlock wallet with password
  const unlockWallet = useCallback(async (password: string) => {
    setIsConnecting(true);

    try {
      const encrypted = loadEncryptedWallet();
      if (!encrypted) {
        throw new Error('No wallet found');
      }

      const walletData = await decryptWallet(encrypted, password);

      setAddress(walletData.address);
      setPrivateKey(walletData.privateKey);
      setMnemonic(walletData.mnemonic || null);
      setIsUnlocked(true);

      // Update auth state with address
      if (isAuthenticated) {
        sessionStorage.setItem(AUTH_STATE_KEY, JSON.stringify({
          isAuthenticated: true,
          address: walletData.address,
        }));
      }
    } catch (error: any) {
      if (error.name === 'OperationError') {
        throw new Error('Incorrect password');
      }
      throw error;
    } finally {
      setIsConnecting(false);
    }
  }, [isAuthenticated]);

  // Lock wallet (clear sensitive data)
  const lockWallet = useCallback(() => {
    setPrivateKey(null);
    setMnemonic(null);
    setIsUnlocked(false);
  }, []);

  // Get private key (only when unlocked)
  const getPrivateKey = useCallback((): string | null => {
    if (!isUnlocked) return null;
    return privateKey;
  }, [isUnlocked, privateKey]);

  // Get mnemonic (only when unlocked)
  const getMnemonic = useCallback((): string | null => {
    if (!isUnlocked) return null;
    return mnemonic;
  }, [isUnlocked, mnemonic]);

  // Logout (clear auth but keep wallet)
  const logout = useCallback(() => {
    setIsAuthenticated(false);
    setIsUnlocked(false);
    setPrivateKey(null);
    setMnemonic(null);
    sessionStorage.removeItem(AUTH_STATE_KEY);
  }, []);

  // Delete wallet completely
  const deleteWallet = useCallback(() => {
    deleteStoredWallet();
    localStorage.removeItem(BACKUP_FLAG_KEY);
    setAddress(null);
    setPrivateKey(null);
    setMnemonic(null);
    setIsUnlocked(false);
    setHasWallet(false);
    setNeedsBackup(false);
  }, []);

  // Change password
  const changePassword = useCallback(async (oldPassword: string, newPassword: string) => {
    const encrypted = loadEncryptedWallet();
    if (!encrypted) {
      throw new Error('No wallet found');
    }

    // Decrypt with old password
    const walletData = await decryptWallet(encrypted, oldPassword);

    // Re-encrypt with new password
    const newEncrypted = await encryptWallet(walletData, newPassword);
    saveEncryptedWallet(newEncrypted);
  }, []);

  // Mark as backed up
  const markBackedUp = useCallback(() => {
    setNeedsBackup(false);
    localStorage.removeItem(BACKUP_FLAG_KEY);
  }, []);

  // Context value
  const value = useMemo<SelfCustodialWalletContextValue>(() => ({
    isAuthenticated,
    isUnlocked,
    isConnecting,
    hasWallet,
    needsBackup,
    address,
    userId,
    createWallet,
    importWallet,
    loginWithPasskey,
    registerPasskey,
    unlockWallet,
    lockWallet,
    getPrivateKey,
    logout,
    deleteWallet,
    changePassword,
    markBackedUp,
    getMnemonic,
  }), [
    isAuthenticated,
    isUnlocked,
    isConnecting,
    hasWallet,
    needsBackup,
    address,
    userId,
    createWallet,
    importWallet,
    loginWithPasskey,
    registerPasskey,
    unlockWallet,
    lockWallet,
    getPrivateKey,
    logout,
    deleteWallet,
    changePassword,
    markBackedUp,
    getMnemonic,
  ]);

  return (
    <SelfCustodialWalletContext.Provider value={value}>
      {children}
    </SelfCustodialWalletContext.Provider>
  );
};

export const useSelfCustodialWallet = (): SelfCustodialWalletContextValue => {
  const context = useContext(SelfCustodialWalletContext);
  if (!context) {
    throw new Error('useSelfCustodialWallet must be used within a SelfCustodialWalletProvider');
  }
  return context;
};

export default SelfCustodialWalletProvider;
