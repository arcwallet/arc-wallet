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
const PASSKEY_FACTORY_ADDRESS = (import.meta as any).env.VITE_PASSKEY_FACTORY_ADDRESS || '0x9AE89FbF3C32F976Db2A668d5a5c7B00032BD14a';
const ENTRY_POINT_ADDRESS = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789';

// Initialize PasskeyAccountManager
const initializeManager = (): PasskeyAccountManager => {
  const backendUrl = typeof window !== 'undefined'
    ? ((import.meta as any).env.VITE_PASSKEY_API_URL || 'https://arcwallet-backend.onrender.com')
    : 'https://arcwallet-backend.onrender.com';

  const rpId = typeof window !== 'undefined' ? window.location.hostname : 'localhost';

  console.log('[PasskeyAccount] Initializing manager:', { backendUrl, rpId, factory: PASSKEY_FACTORY_ADDRESS });

  const config: PasskeyAccountConfig = {
    factoryAddress: PASSKEY_FACTORY_ADDRESS,
    entryPointAddress: ENTRY_POINT_ADDRESS,
    rpcUrl: 'https://rpc.testnet.arc.network',
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
    try {
      const mgr = initializeManager();
      setManager(mgr);
      console.log('[PasskeyAccount] Manager initialized');

      // Check for existing credential in localStorage
      const storedCredentialId = localStorage.getItem('arcwallet:passkey:current');
      if (storedCredentialId) {
        const storedCred = localStorage.getItem(`arcwallet:passkey:${storedCredentialId}`);
        if (storedCred) {
          setHasAccount(true);
          console.log('[PasskeyAccount] Found existing credential');
        }
      }
    } catch (error) {
      console.error('[PasskeyAccount] Failed to initialize manager:', error);
    }
  }, []);

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

    setIsConnecting(true);
    try {
      console.log('[PasskeyAccount] Connecting with existing passkey...');

      const result = await manager.connect();

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
  }, [manager]);

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
