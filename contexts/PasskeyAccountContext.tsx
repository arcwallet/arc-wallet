/**
 * Passkey Account Context - Native Passkey Signing
 *
 * NEW ARCHITECTURE:
 * - Passkey (P256) IS the signing key
 * - NO private key stored anywhere
 * - Smart contract verifies P256 signatures on-chain
 * - Storage cleared = No problem (same passkey = same account)
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
import { PasskeyAccountManager } from '@arc/wallet-sdk';
import type { PasskeyAccountConfig, PasskeyAccountCredential } from '@arc/wallet-sdk';
import { useSession } from './SessionContext';

// Types
export interface PasskeyAccountContextValue {
  // Account state
  isConnected: boolean;
  isConnecting: boolean;
  hasAccount: boolean;
  address: string | null;
  credential: PasskeyAccountCredential | null;

  // Account management
  createAccount: () => Promise<{ address: string }>;
  connect: () => Promise<{ address: string }>;
  disconnect: () => void;

  // Signing (returns encoded signature for smart contract)
  signUserOperation: (userOpHash: string) => Promise<string>;

  // Account info
  isDeployed: () => Promise<boolean>;
  getInitCode: () => string;
  getNonce: () => Promise<bigint>;

  // Manager instance for advanced usage
  manager: PasskeyAccountManager | null;
}

const PasskeyAccountContext = createContext<PasskeyAccountContextValue | undefined>(undefined);

// Factory and contract addresses
const PASSKEY_FACTORY_ADDRESS = (import.meta as any).env.VITE_PASSKEY_FACTORY_ADDRESS || '0x4C16f269dE57B846309a8Eb3591ddb394aBba488';
const ENTRY_POINT_ADDRESS = '0x0000000071727De22E5E9d8BAf0edAc6f37da032'; // v0.7

// Initialize PasskeyAccountManager with bundler (own bundler preferred, Pimlico as fallback)
const initializeManager = (): PasskeyAccountManager => {
  const backendUrl = typeof window !== 'undefined'
    ? ((import.meta as any).env.VITE_PASSKEY_API_URL || 'https://arcwallet-backend.onrender.com')
    : 'https://arcwallet-backend.onrender.com';

  const rpId = typeof window !== 'undefined' ? window.location.hostname : 'localhost';

  // Determine bundler URL - prefer our own bundler, fallback to Pimlico
  let bundlerUrl: string | undefined;
  let bundlerType = 'Not configured';

  // Option 1: Use our own bundler (same backend URL)
  const useOwnBundler = typeof window !== 'undefined'
    ? (import.meta as any).env.VITE_USE_OWN_BUNDLER === 'true'
    : false;

  if (useOwnBundler) {
    bundlerUrl = `${backendUrl}/api/bundler/rpc`;
    bundlerType = 'Arc Bundler (Own)';
  } else {
    // Option 2: Pimlico bundler as fallback
    const pimlicoApiKey = typeof window !== 'undefined'
      ? (import.meta as any).env.VITE_PIMLICO_API_KEY || ''
      : '';

    if (pimlicoApiKey) {
      bundlerUrl = `https://api.pimlico.io/v2/5042002/rpc?apikey=${pimlicoApiKey}`;
      bundlerType = 'Pimlico (Arc Testnet)';
    }
  }

  console.log('[PasskeyAccount] Initializing manager:', {
    backendUrl,
    rpId,
    factory: PASSKEY_FACTORY_ADDRESS,
    bundler: bundlerType,
  });

  const config: PasskeyAccountConfig = {
    factoryAddress: PASSKEY_FACTORY_ADDRESS,
    entryPointAddress: ENTRY_POINT_ADDRESS,
    rpcUrl: 'https://rpc.testnet.arc.network',
    bundlerUrl, // Pimlico bundler for UserOperation submission
    backendUrl,
    rpId,
    rpName: 'Arc Wallet',
  };

  return new PasskeyAccountManager(config);
};

interface PasskeyAccountProviderProps {
  children: ReactNode;
}

export const PasskeyAccountProvider: React.FC<PasskeyAccountProviderProps> = ({ children }) => {
  const { currentEmail } = useSession();

  // State
  const [manager, setManager] = useState<PasskeyAccountManager | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [hasAccount, setHasAccount] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [credential, setCredential] = useState<PasskeyAccountCredential | null>(null);

  // Initialize manager on mount
  useEffect(() => {
    const mgr = initializeManager();
    setManager(mgr);
    console.log('[PasskeyAccount] Manager initialized');
  }, []);

  // Restore credential from localStorage when currentEmail changes
  // IMPORTANT: Only restore if the stored credential belongs to current user
  useEffect(() => {
    const restoreCredential = async () => {
      if (!manager || !currentEmail) {
        // No email = not logged in, clear passkey state
        if (!currentEmail) {
          setIsConnected(false);
          setHasAccount(false);
          setAddress(null);
          setCredential(null);
        }
        return;
      }

      console.log('[PasskeyAccount] Checking stored credential for:', currentEmail);

      // Check for existing credential in localStorage
      const storedCredentialId = localStorage.getItem('arcwallet:passkey:current');
      if (storedCredentialId) {
        const storedCredStr = localStorage.getItem(`arcwallet:passkey:${storedCredentialId}`);
        if (storedCredStr) {
          const storedCred = JSON.parse(storedCredStr);

          // CRITICAL: Check if stored credential belongs to current user
          if (storedCred.userId !== currentEmail) {
            console.log('[PasskeyAccount] Stored credential belongs to different user:', storedCred.userId, '!= ', currentEmail);
            // Clear state - this user doesn't have a passkey yet
            setIsConnected(false);
            setHasAccount(false);
            setAddress(null);
            setCredential(null);
            return;
          }

          setHasAccount(true);
          setCredential(storedCred);
          console.log('[PasskeyAccount] Found existing credential for current user:', storedCred);

          // Restore address from stored credential for display purposes
          // BUT DO NOT set isConnected = true - user must authenticate with passkey first!
          if (storedCred.publicKeyX && storedCred.publicKeyY && storedCred.userId) {
            try {
              // Use restoreFromCredential to compute the address (for display)
              const restoredAddress = await manager.restoreFromCredential(storedCred);
              setAddress(restoredAddress);
              // SECURITY: Do NOT auto-connect! User must re-authenticate with passkey
              // isConnected stays false until user explicitly calls connect()
              setIsConnected(false);
              console.log('[PasskeyAccount] Address restored (requires passkey auth):', restoredAddress);
            } catch (err) {
              console.error('[PasskeyAccount] Failed to restore address:', err);
            }
          }
        } else {
          // No stored credential for this user
          setIsConnected(false);
          setHasAccount(false);
          setAddress(null);
          setCredential(null);
        }
      } else {
        // No stored credential at all
        setIsConnected(false);
        setHasAccount(false);
        setAddress(null);
        setCredential(null);
      }
    };

    restoreCredential();
  }, [manager, currentEmail]);

  // Create new account with passkey
  const createAccount = useCallback(async (): Promise<{ address: string }> => {
    if (!manager) throw new Error('Manager not initialized');
    if (!currentEmail) throw new Error('Email required. Please login first.');

    setIsConnecting(true);
    try {
      console.log('[PasskeyAccount] Creating account for:', currentEmail);

      const userName = currentEmail.split('@')[0];
      const result = await manager.createAccount(currentEmail, userName);

      setAddress(result.address);
      setCredential(result.credential);
      setIsConnected(true);
      setHasAccount(true);

      console.log('[PasskeyAccount] Account created:', result.address);

      return { address: result.address };
    } catch (error: any) {
      console.error('[PasskeyAccount] Create failed:', error);
      throw new Error(error.message || 'Failed to create account');
    } finally {
      setIsConnecting(false);
    }
  }, [manager, currentEmail]);

  // Connect with existing passkey
  const connect = useCallback(async (): Promise<{ address: string }> => {
    if (!manager) throw new Error('Manager not initialized');
    if (!currentEmail) throw new Error('Email required. Please login first.');

    setIsConnecting(true);
    try {
      console.log('[PasskeyAccount] Connecting with existing passkey...', { email: currentEmail });

      // Pass email to find user's specific passkeys
      // This ensures we only allow the user's registered passkeys
      const result = await manager.connect(currentEmail);

      setAddress(result.address);
      setCredential(result.credential);
      setIsConnected(true);
      setHasAccount(true);

      console.log('[PasskeyAccount] Connected:', result.address);

      return { address: result.address };
    } catch (error: any) {
      console.error('[PasskeyAccount] Connect failed:', error);
      throw new Error(error.message || 'Failed to connect');
    } finally {
      setIsConnecting(false);
    }
  }, [manager, currentEmail]);

  // Disconnect (just clear local state, passkey remains)
  const disconnect = useCallback(() => {
    setIsConnected(false);
    setAddress(null);
    setCredential(null);
    console.log('[PasskeyAccount] Disconnected');
  }, []);

  // Sign UserOperation with passkey
  const signUserOperation = useCallback(async (userOpHash: string): Promise<string> => {
    if (!manager) throw new Error('Manager not initialized');
    if (!isConnected) throw new Error('Not connected. Please connect first.');

    console.log('[PasskeyAccount] Signing UserOperation...');

    const signature = await manager.signUserOperation({} as any, userOpHash);

    console.log('[PasskeyAccount] UserOperation signed');

    return signature;
  }, [manager, isConnected]);

  // Check if account is deployed
  const isDeployed = useCallback(async (): Promise<boolean> => {
    if (!manager) return false;
    return await manager.isAccountDeployed();
  }, [manager]);

  // Get init code for deployment
  const getInitCode = useCallback((): string => {
    if (!manager) throw new Error('Manager not initialized');
    return manager.getInitCode();
  }, [manager]);

  // Get account nonce
  const getNonce = useCallback(async (): Promise<bigint> => {
    if (!manager) throw new Error('Manager not initialized');
    return await manager.getAccountNonce();
  }, [manager]);

  // Context value
  const value = useMemo(() => ({
    isConnected,
    isConnecting,
    hasAccount,
    address,
    credential,
    createAccount,
    connect,
    disconnect,
    signUserOperation,
    isDeployed,
    getInitCode,
    getNonce,
    manager,
  }), [
    isConnected,
    isConnecting,
    hasAccount,
    address,
    credential,
    createAccount,
    connect,
    disconnect,
    signUserOperation,
    isDeployed,
    getInitCode,
    getNonce,
    manager,
  ]);

  return (
    <PasskeyAccountContext.Provider value={value}>
      {children}
    </PasskeyAccountContext.Provider>
  );
};

export const usePasskeyAccount = (): PasskeyAccountContextValue => {
  const context = useContext(PasskeyAccountContext);
  if (!context) {
    throw new Error('usePasskeyAccount must be used within a PasskeyAccountProvider');
  }
  return context;
};

export default PasskeyAccountProvider;
