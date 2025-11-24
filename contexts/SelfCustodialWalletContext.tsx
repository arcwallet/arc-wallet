/**
 * Self-Custodial Wallet Context - WebAuthn/Passkey Edition
 *
 * SECURITY: Private keys are generated and stored ONLY on client-side
 * Backend NEVER sees or stores private keys
 *
 * Flow:
 * 1. User creates wallet → Passkey created → Key generated locally → Encrypted with passkey
 * 2. User unlocks wallet → Authenticates with biometrics → Key decrypted in-memory
 * 3. Transactions signed locally → Only signed tx sent to network
 *
 * NO SEED PHRASES - Uses WebAuthn (FaceID/TouchID/Device Passcode)
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
import { WalletSDK } from '@arc/wallet-sdk';
import type { WalletAccount } from '@arc/wallet-sdk';
import { useSession } from './SessionContext';

// Types
export interface SelfCustodialWalletContextValue {
  // Wallet state
  isAuthenticated: boolean;
  isUnlocked: boolean;
  isConnecting: boolean;
  hasWallet: boolean;
  needsBackup: boolean; // Always false now (no seed phrases)
  address: string | null;
  userId: string | null;

  // Wallet creation (no password needed!)
  createWallet: (userName: string) => Promise<{ address: string }>;

  // Authentication with biometrics
  unlockWallet: () => Promise<void>;
  lockWallet: () => void;

  // Signing
  getPrivateKey: () => string | null;
  signTransaction: (tx: any) => Promise<string>;
  signMessage: (message: string) => Promise<string>;

  // Management
  logout: () => void;
  deleteWallet: () => Promise<void>;

  // SDK instance for advanced usage
  sdk: WalletSDK | null;
}

const SelfCustodialWalletContext = createContext<SelfCustodialWalletContextValue | undefined>(undefined);

const normalizeEmail = (email?: string | null) => {
  if (!email) return null;
  return email.trim().toLowerCase();
};

// Storage keys helpers
const getStorageKey = (userId: string | null, key: string) => {
  if (!userId) return key; // Fallback for legacy or unauthenticated
  return `arcwallet:${userId}:${key}`;
};

// Legacy keys for migration
const LEGACY_HAS_WALLET_KEY = 'arcwallet:has-wallet';
const LEGACY_WALLET_ADDRESS_KEY = 'arcwallet:wallet-address';
const LEGACY_USER_ID_KEY = 'arcwallet:user-id';

// Initialize SDK
const initializeSDK = (): WalletSDK => {
  // Use environment variable with smart fallback:
  // 1. VITE_PASSKEY_API_URL if set
  // 2. In production build, use same-origin /api to avoid CORS
  // 3. In development, fallback to localhost:4000
  const backendUrl = typeof window !== 'undefined'
    ? ((import.meta as any).env.VITE_PASSKEY_API_URL ??
      ((import.meta as any).env.PROD
        ? `${window.location.origin}/api`
        : 'http://localhost:4000'))
    : 'http://localhost:4000';

  return new WalletSDK({
    appName: 'Arc Wallet',
    rpId: typeof window !== 'undefined' ? window.location.hostname : 'localhost',
    rpcUrl: 'https://rpc.testnet.arc.network',
    backendUrl,
    theme: 'dark',
  });
};

export const SelfCustodialWalletProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Core state
  const [sdk] = useState<WalletSDK>(() => {
    if (typeof window === 'undefined') return null as any;
    return initializeSDK();
  });

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [hasWallet, setHasWallet] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [currentAccount, setCurrentAccount] = useState<WalletAccount | null>(null);

  const { currentEmail } = useSession();
  const normalizedEmail = normalizeEmail(currentEmail);

  // Initialize on mount and when email changes
  useEffect(() => {
    if (typeof window === 'undefined' || !sdk) return;

    // Reset state when email changes
    setIsUnlocked(false);
    setIsAuthenticated(false);
    setCurrentAccount(null);
    setAddress(null);
    setHasWallet(false);
    setUserId(normalizedEmail);

    if (!normalizedEmail) {
      // If no email, we can't load a specific wallet
      return;
    }

    // Check for legacy wallet (migration)
    const hasLegacyWallet = localStorage.getItem(LEGACY_HAS_WALLET_KEY) === 'true';
    const legacyAddress = localStorage.getItem(LEGACY_WALLET_ADDRESS_KEY);

    if (hasLegacyWallet && legacyAddress) {
      console.log('[Wallet] Found legacy wallet, migrating to user:', currentEmail);

      // Migrate to namespaced keys
      const hasWalletKey = getStorageKey(normalizedEmail, 'has-wallet');
      const addressKey = getStorageKey(normalizedEmail, 'wallet-address');

      localStorage.setItem(hasWalletKey, 'true');
      localStorage.setItem(addressKey, legacyAddress);

      // Clear legacy keys
      localStorage.removeItem(LEGACY_HAS_WALLET_KEY);
      localStorage.removeItem(LEGACY_WALLET_ADDRESS_KEY);
      localStorage.removeItem(LEGACY_USER_ID_KEY);
    }

    // Load user-specific wallet
    const userHasWalletKey = getStorageKey(normalizedEmail, 'has-wallet');
    const userAddressKey = getStorageKey(normalizedEmail, 'wallet-address');

    const hasWalletStored = localStorage.getItem(userHasWalletKey) === 'true';
    setHasWallet(hasWalletStored);

    const storedAddress = localStorage.getItem(userAddressKey);
    if (storedAddress) {
      setAddress(storedAddress);
    }
  }, [sdk, normalizedEmail]);

  // Setup SDK event listeners
  useEffect(() => {
    if (!sdk) return;

    const handleConnect = (payload: { address: string }) => {
      console.log('[Wallet] Connected:', payload.address);
      setAddress(payload.address);

      if (normalizedEmail) {
        const addressKey = getStorageKey(normalizedEmail, 'wallet-address');
        localStorage.setItem(addressKey, payload.address);
      }
    };

    const handleDisconnect = () => {
      console.log('[Wallet] Disconnected');
      setIsUnlocked(false);
    };

    const handleError = (payload: { message: string; code: string }) => {
      console.error('[Wallet] Error:', payload);
    };

    sdk.on('connect', handleConnect);
    sdk.on('disconnect', handleDisconnect);
    sdk.on('error', handleError);

    return () => {
      sdk.off('connect', handleConnect);
      sdk.off('disconnect', handleDisconnect);
      sdk.off('error', handleError);
    };
  }, [sdk, normalizedEmail]);

  // Create new wallet with passkey (EMAIL + PASSKEY!)
  const createWallet = useCallback(async (userName: string): Promise<{ address: string }> => {
    if (!sdk) throw new Error('SDK not initialized');
    if (!normalizedEmail) throw new Error('Email verification required. Please login first.');

    setIsConnecting(true);

    try {
      console.log('[Wallet] Creating new wallet with email + passkey...');

      // Use email as userId for multi-device support
      const userId = normalizedEmail;
      const displayName = (userName || currentEmail || normalizedEmail).slice(0, 64);

      // Create wallet with passkey - This will:
      // 1. Prompt user for biometric authentication
      // 2. Create passkey in device's Secure Enclave
      // 3. Generate Ethereum wallet
      // 4. Encrypt private key with passkey-derived key
      // 5. Store encrypted key in IndexedDB
      const account = await sdk.createWallet(userId, displayName);

      console.log('[Wallet] Wallet created successfully:', account.address);

      // Update state
      setCurrentAccount(account);
      setAddress(account.address);
      setHasWallet(true);
      setIsUnlocked(true);
      setIsAuthenticated(true);
      setUserId(normalizedEmail);

      // Persist wallet existence
      const hasWalletKey = getStorageKey(normalizedEmail, 'has-wallet');
      const addressKey = getStorageKey(normalizedEmail, 'wallet-address');
      const userIdKey = getStorageKey(normalizedEmail, 'user-id');

      localStorage.setItem(hasWalletKey, 'true');
      localStorage.setItem(addressKey, account.address);
      localStorage.setItem(userIdKey, normalizedEmail);

      // TODO: Backup encrypted wallet to backend (Phase 3)
      // await backupWalletToBackend(currentEmail, account.encryptedData);

      return { address: account.address };
    } catch (error: any) {
      console.error('[Wallet] Creation failed:', error);
      throw new Error(error.message || 'Failed to create wallet');
    } finally {
      setIsConnecting(false);
    }
  }, [sdk, normalizedEmail, currentEmail]);

  // Unlock wallet with passkey (biometric authentication)
  const unlockWallet = useCallback(async () => {
    if (!sdk) throw new Error('SDK not initialized');

    setIsConnecting(true);

    try {
      console.log('[Wallet] Unlocking wallet with passkey...');

      // Connect with passkey - This will:
      // 1. Prompt user for biometric authentication
      // 2. Verify passkey with device
      // 3. Derive encryption key from passkey
      // 4. Decrypt private key from IndexedDB
      // 5. Load wallet into memory
      const account = await sdk.connect();

      console.log('[Wallet] Wallet unlocked:', account.address);

      // Update state
      setCurrentAccount(account);
      setAddress(account.address);
      setIsUnlocked(true);
      setIsAuthenticated(true);

      // Update stored address in case it changed
      if (normalizedEmail) {
        const addressKey = getStorageKey(normalizedEmail, 'wallet-address');
        localStorage.setItem(addressKey, account.address);
      }
    } catch (error: any) {
      console.error('[Wallet] Unlock failed:', error);
      throw new Error(error.message || 'Failed to unlock wallet. Please try again.');
    } finally {
      setIsConnecting(false);
    }
  }, [sdk, normalizedEmail]);

  // Lock wallet (clear from memory)
  const lockWallet = useCallback(() => {
    if (!sdk) return;

    console.log('[Wallet] Locking wallet...');
    sdk.disconnect();
    setIsUnlocked(false);
    setCurrentAccount(null);
  }, [sdk]);

  // Get private key (only when unlocked) - for signing transactions
  const getPrivateKey = useCallback((): string | null => {
    // Note: SDK keeps private key in memory only when unlocked
    // We don't expose it directly for security reasons
    // Use signTransaction or signMessage instead
    if (!isUnlocked || !currentAccount) return null;

    // For backwards compatibility, return a placeholder
    // Components should use signTransaction/signMessage instead
    return 'PRIVATE_KEY_MANAGED_BY_SDK';
  }, [isUnlocked, currentAccount]);

  // Sign transaction with SDK
  const signTransaction = useCallback(async (tx: any): Promise<string> => {
    if (!sdk) throw new Error('SDK not initialized');
    if (!isUnlocked) throw new Error('Wallet is locked. Please unlock first.');

    try {
      console.log('[Wallet] Signing transaction...');
      const result = await sdk.signTransaction(tx);
      console.log('[Wallet] Transaction signed:', result.hash);
      return result.hash;
    } catch (error: any) {
      console.error('[Wallet] Transaction signing failed:', error);
      throw error;
    }
  }, [sdk, isUnlocked]);

  // Sign message with SDK
  const signMessage = useCallback(async (message: string): Promise<string> => {
    if (!sdk) throw new Error('SDK not initialized');
    if (!isUnlocked) throw new Error('Wallet is locked. Please unlock first.');

    try {
      console.log('[Wallet] Signing message...');
      const signature = await sdk.signMessage(message);
      console.log('[Wallet] Message signed');
      return signature;
    } catch (error: any) {
      console.error('[Wallet] Message signing failed:', error);
      throw error;
    }
  }, [sdk, isUnlocked]);

  // Logout (lock wallet and clear auth state)
  const logout = useCallback(() => {
    console.log('[Wallet] Logging out...');
    lockWallet();
    setIsAuthenticated(false);
  }, [lockWallet]);

  // Delete wallet completely
  const deleteWallet = useCallback(async () => {
    if (!sdk) throw new Error('SDK not initialized');

    try {
      console.log('[Wallet] Deleting wallet...');

      if (isUnlocked) {
        await sdk.deleteWallet();
      }

      // Clear all storage
      if (normalizedEmail) {
        const hasWalletKey = getStorageKey(normalizedEmail, 'has-wallet');
        const addressKey = getStorageKey(normalizedEmail, 'wallet-address');
        const userIdKey = getStorageKey(normalizedEmail, 'user-id');

        localStorage.removeItem(hasWalletKey);
        localStorage.removeItem(addressKey);
        localStorage.removeItem(userIdKey);
      }

      // Reset state
      setAddress(null);
      setCurrentAccount(null);
      setIsUnlocked(false);
      setHasWallet(false);
      setIsAuthenticated(false);
      setUserId(null);

      console.log('[Wallet] Wallet deleted successfully');
    } catch (error: any) {
      console.error('[Wallet] Delete failed:', error);
      throw error;
    }
  }, [sdk, isUnlocked, normalizedEmail]);

  // Context value
  const value = useMemo<SelfCustodialWalletContextValue>(() => ({
    isAuthenticated,
    isUnlocked,
    isConnecting,
    hasWallet,
    needsBackup: false, // No seed phrases, so no backup needed
    address,
    userId,
    createWallet,
    unlockWallet,
    lockWallet,
    getPrivateKey,
    signTransaction,
    signMessage,
    logout,
    deleteWallet,
    sdk,
  }), [
    isAuthenticated,
    isUnlocked,
    isConnecting,
    hasWallet,
    address,
    userId,
    createWallet,
    unlockWallet,
    lockWallet,
    getPrivateKey,
    signTransaction,
    signMessage,
    logout,
    deleteWallet,
    sdk,
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
