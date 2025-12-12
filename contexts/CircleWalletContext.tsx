/**
 * Circle Wallet Context
 *
 * React context for managing Circle Modular Wallet state and operations.
 * Replaces the old PasskeyAccountContext with Circle's infrastructure.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  circleWalletService,
  type CircleWalletState,
  type TransactionParams,
  type TokenTransferParams,
} from '../services/circleWalletService';
import { useSession } from './SessionContext';
import { logger } from '../services/logger';

// Balance refresh interval (30 seconds)
const BALANCE_REFRESH_INTERVAL = 30_000;

// Context value type
interface CircleWalletContextValue {
  // State
  isConnected: boolean;
  isConnecting: boolean;
  isReconnecting: boolean;
  address: string | null;
  username: string | null;
  error: string | null;
  hasStoredSession: boolean;
  balance: bigint | null;
  isLoadingBalance: boolean;

  // Account Management
  createWallet: () => Promise<void>;
  login: () => Promise<void>;
  disconnect: () => void;
  tryReconnect: () => Promise<boolean>;

  // Transactions
  sendTransaction: (params: TransactionParams) => Promise<string>;
  sendTokenTransfer: (params: TokenTransferParams) => Promise<string>;
  sendBatchTransactions: (
    calls: Array<{ to: string; value?: bigint; data?: `0x${string}` }>
  ) => Promise<string>;

  // Utils
  getBalance: () => Promise<bigint>;
  getTokenBalance: (tokenAddress: string) => Promise<bigint>;
  isDeployed: () => Promise<boolean>;
  refreshState: () => void;
  refreshBalance: () => Promise<void>;
}

// Create context
const CircleWalletContext = createContext<CircleWalletContextValue | undefined>(undefined);

// Provider props
interface CircleWalletProviderProps {
  children: ReactNode;
}

/**
 * Circle Wallet Provider Component
 */
export const CircleWalletProvider: React.FC<CircleWalletProviderProps> = ({ children }) => {
  const { currentEmail } = useSession();

  // State
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasStoredSession, setHasStoredSession] = useState(false);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);

  // Refresh balance from service
  const refreshBalance = useCallback(async () => {
    if (!circleWalletService.getState().isConnected) {
      return;
    }

    setIsLoadingBalance(true);
    try {
      const newBalance = await circleWalletService.getBalance();
      setBalance(newBalance);
    } catch (err: any) {
      logger.error('Failed to refresh balance', {
        component: 'CircleWalletContext',
        errorMsg: err.message,
      });
    } finally {
      setIsLoadingBalance(false);
    }
  }, []);

  // Refresh state from service
  const refreshState = useCallback(() => {
    const state = circleWalletService.getState();
    setIsConnected(state.isConnected);
    setAddress(state.address);
    setUsername(state.username);
    setHasStoredSession(circleWalletService.hasStoredSession());

    // Also refresh balance if connected
    if (state.isConnected) {
      refreshBalance();
    }
  }, [refreshBalance]);

  // Try to reconnect using stored session
  const tryReconnect = useCallback(async (): Promise<boolean> => {
    if (isConnected || isReconnecting) {
      return isConnected;
    }

    setIsReconnecting(true);
    setError(null);

    try {
      const success = await circleWalletService.tryAutoReconnect();
      if (success) {
        refreshState();
        // Also refresh balance after reconnect
        await refreshBalance();
        logger.info('Auto-reconnect successful', {
          component: 'CircleWalletContext',
        });
      }
      return success;
    } catch (err: any) {
      logger.info('Auto-reconnect failed', {
        component: 'CircleWalletContext',
        errorMsg: err.message,
      });
      return false;
    } finally {
      setIsReconnecting(false);
    }
  }, [isConnected, isReconnecting, refreshState, refreshBalance]);

  // Initialize and check for stored session on mount
  useEffect(() => {
    refreshState();

    // Check if there's a stored session
    const storedSession = circleWalletService.getStoredSession();
    if (storedSession) {
      setHasStoredSession(true);
      // Pre-fill address from stored session (before reconnect)
      setAddress(storedSession.address);
      setUsername(storedSession.username);
    }
  }, [refreshState]);

  // Auto-refresh balance when connected
  useEffect(() => {
    if (!isConnected) {
      return;
    }

    // Initial balance fetch
    refreshBalance();

    // Set up interval for periodic refresh
    const intervalId = setInterval(() => {
      refreshBalance();
    }, BALANCE_REFRESH_INTERVAL);

    return () => {
      clearInterval(intervalId);
    };
  }, [isConnected, refreshBalance]);

  // Create new wallet
  const createWallet = useCallback(async () => {
    if (!currentEmail) {
      setError('Please login first');
      throw new Error('Please login first');
    }

    setIsConnecting(true);
    setError(null);

    try {
      const result = await circleWalletService.createWallet(currentEmail);
      setIsConnected(true);
      setAddress(result.address);
      setUsername(currentEmail);

      // Fetch initial balance
      await refreshBalance();

      logger.info('Wallet created via context', {
        component: 'CircleWalletContext',
        address: result.address,
      });
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to create wallet';
      setError(errorMessage);
      logger.error('Wallet creation failed', {
        component: 'CircleWalletContext',
        errorMsg: errorMessage,
      });
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, [currentEmail, refreshBalance]);

  // Login with existing wallet
  const login = useCallback(async () => {
    setIsConnecting(true);
    setError(null);

    try {
      const result = await circleWalletService.login();
      setIsConnected(true);
      setAddress(result.address);
      refreshState(); // Get username from storage

      // Fetch initial balance
      await refreshBalance();

      logger.info('Wallet connected via context', {
        component: 'CircleWalletContext',
        address: result.address,
      });
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to connect wallet';
      setError(errorMessage);
      logger.error('Wallet connection failed', {
        component: 'CircleWalletContext',
        errorMsg: errorMessage,
      });
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, [refreshState, refreshBalance]);

  // Disconnect wallet
  const disconnect = useCallback(() => {
    circleWalletService.disconnect();
    setIsConnected(false);
    setAddress(null);
    setUsername(null);
    setError(null);
    setBalance(null);

    logger.info('Wallet disconnected via context', {
      component: 'CircleWalletContext',
    });
  }, []);

  // Send transaction
  const sendTransaction = useCallback(async (params: TransactionParams): Promise<string> => {
    setError(null);
    try {
      return await circleWalletService.sendTransaction(params);
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, []);

  // Send token transfer
  const sendTokenTransfer = useCallback(async (params: TokenTransferParams): Promise<string> => {
    setError(null);
    try {
      return await circleWalletService.sendTokenTransfer(params);
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, []);

  // Send batch transactions
  const sendBatchTransactions = useCallback(
    async (
      calls: Array<{ to: string; value?: bigint; data?: `0x${string}` }>
    ): Promise<string> => {
      setError(null);
      try {
        return await circleWalletService.sendBatchTransactions(calls);
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    []
  );

  // Get balance
  const getBalance = useCallback(async (): Promise<bigint> => {
    return circleWalletService.getBalance();
  }, []);

  // Get token balance
  const getTokenBalance = useCallback(async (tokenAddress: string): Promise<bigint> => {
    return circleWalletService.getTokenBalance(tokenAddress);
  }, []);

  // Check if deployed
  const isDeployed = useCallback(async (): Promise<boolean> => {
    return circleWalletService.isDeployed();
  }, []);

  // Context value
  const value: CircleWalletContextValue = {
    // State
    isConnected,
    isConnecting,
    isReconnecting,
    address,
    username,
    error,
    hasStoredSession,
    balance,
    isLoadingBalance,

    // Account Management
    createWallet,
    login,
    disconnect,
    tryReconnect,

    // Transactions
    sendTransaction,
    sendTokenTransfer,
    sendBatchTransactions,

    // Utils
    getBalance,
    getTokenBalance,
    isDeployed,
    refreshState,
    refreshBalance,
  };

  return (
    <CircleWalletContext.Provider value={value}>
      {children}
    </CircleWalletContext.Provider>
  );
};

/**
 * Hook to use Circle Wallet context
 */
export const useCircleWallet = (): CircleWalletContextValue => {
  const context = useContext(CircleWalletContext);
  if (!context) {
    throw new Error('useCircleWallet must be used within a CircleWalletProvider');
  }
  return context;
};

// Also export as useWallet for easier migration
export const useWallet = useCircleWallet;

export default CircleWalletContext;
