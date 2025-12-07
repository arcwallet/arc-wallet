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
import { PasskeyAccountManager } from '../services/passkeyAccountManager';
import type { PasskeyAccountConfig, PasskeyAccountCredential } from '../services/passkeyAccountManager';
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
const ENTRY_POINT_ADDRESS = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789'; // v0.6

// Initialize PasskeyAccountManager with Arc's own bundler
const initializeManager = (): PasskeyAccountManager => {
  const backendUrl = typeof window !== 'undefined'
    ? ((import.meta as any).env.VITE_PASSKEY_API_URL || 'https://arcwallet-backend.onrender.com')
    : 'https://arcwallet-backend.onrender.com';

  const rpId = typeof window !== 'undefined' ? window.location.hostname : 'localhost';

  // Use Arc's own bundler
  const bundlerUrl = `${backendUrl}/api/bundler/rpc`;

  console.log('[PasskeyAccount] Initializing manager:', {
    backendUrl,
    rpId,
    factory: PASSKEY_FACTORY_ADDRESS,
    bundler: 'Arc Bundler',
  });

  const config: PasskeyAccountConfig = {
    factoryAddress: PASSKEY_FACTORY_ADDRESS,
    entryPointAddress: ENTRY_POINT_ADDRESS,
    rpcUrl: 'https://rpc.testnet.arc.network',
    bundlerUrl, // Arc bundler for UserOperation submission
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
  // ALSO: Check backend if localStorage has no credential for this user
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
            // Don't clear hasAccount yet - check backend first
          } else {
            setHasAccount(true);
            setCredential(storedCred);
            console.log('[PasskeyAccount] Found existing credential for current user:', storedCred);

            // Restore address from stored credential
            if (storedCred.publicKeyX && storedCred.publicKeyY && storedCred.userId) {
              try {
                const restoredAddress = await manager.restoreFromCredential(storedCred);
                setAddress(restoredAddress);

                // Check if last auth was within 15 minutes - auto-connect if so
                const SESSION_DURATION = 15 * 60 * 1000; // 15 minutes
                const lastAuthTime = localStorage.getItem('arcwallet:lastAuthTime');
                const isSessionValid = lastAuthTime && (Date.now() - parseInt(lastAuthTime)) < SESSION_DURATION;

                if (isSessionValid) {
                  setIsConnected(true);
                  console.log('[PasskeyAccount] Session valid, auto-connected:', restoredAddress);
                } else {
                  setIsConnected(false);
                  console.log('[PasskeyAccount] Session expired, requires passkey auth:', restoredAddress);
                }
              } catch (err) {
                console.error('[PasskeyAccount] Failed to restore address:', err);
              }
            }
            return; // Credential found and restored, no need to check backend
          }
        }
      }

      // No valid localStorage credential for this user - check backend
      console.log('[PasskeyAccount] No localStorage credential, checking backend for:', currentEmail);
      try {
        const backendUrl = (import.meta as any).env.VITE_PASSKEY_API_URL || 'https://arcwallet-backend.onrender.com';
        const response = await fetch(`${backendUrl}/passkeys/check-user`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: currentEmail }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data?.hasPasskey) {
            console.log('[PasskeyAccount] Backend confirms passkey exists for user, passkeyCount:', data.data.passkeyCount, 'walletAddress:', data.data.walletAddress);
            // User has passkey on backend but not in localStorage
            // Set hasAccount to true so they can use "connect" flow
            setHasAccount(true);
            setIsConnected(false);
            // Set wallet address from backend so ActivityContext can fetch history
            setAddress(data.data.walletAddress || null);
            setCredential(null);
          } else {
            console.log('[PasskeyAccount] Backend confirms no passkey for user');
            setHasAccount(false);
            setIsConnected(false);
            setAddress(null);
            setCredential(null);
          }
        } else {
          console.warn('[PasskeyAccount] Backend check failed, assuming no account');
          setHasAccount(false);
          setIsConnected(false);
          setAddress(null);
          setCredential(null);
        }
      } catch (err) {
        console.error('[PasskeyAccount] Backend check error:', err);
        // On error, default to no account (safe fallback)
        setHasAccount(false);
        setIsConnected(false);
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

      // Save auth time for session persistence (15 min)
      localStorage.setItem('arcwallet:lastAuthTime', Date.now().toString());

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

      // Save auth time for session persistence (15 min)
      localStorage.setItem('arcwallet:lastAuthTime', Date.now().toString());

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
