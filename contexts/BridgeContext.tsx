/**
 * Bridge Context
 *
 * React context for CCTP bridge functionality.
 * Provides cross-chain USDC transfer capabilities using Circle's CCTP V2.
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import {
  bridgeService,
  type BridgeTransaction,
  type BridgeEstimate,
  type BridgeStatus,
} from '../services/bridgeService';
import { type BridgeChainConfig } from '../config/cctp';
import { useCircleWallet } from './CircleWalletContext';
import { logger } from '../services/logger';

// Context value type
interface BridgeContextValue {
  // State
  isLoading: boolean;
  error: string | null;
  transactions: BridgeTransaction[];
  pendingTransactions: BridgeTransaction[];
  currentEstimate: BridgeEstimate | null;

  // Chain info
  destinationChains: BridgeChainConfig[];
  sourceChains: BridgeChainConfig[];
  selectedDestination: BridgeChainConfig | null;
  selectedSource: BridgeChainConfig | null;

  // Actions
  selectDestination: (chainId: number) => void;
  selectSource: (chainId: number) => void;
  estimateBridge: (amount: string, destinationChainId: number) => Promise<BridgeEstimate>;
  executeBridge: (amount: string, destinationChainId: number) => Promise<BridgeTransaction>;
  executeInboundBridge: (amount: string, sourceChainId: number) => Promise<BridgeTransaction>;
  claimTransaction: (txId: string) => Promise<void>;
  getTransaction: (txId: string) => BridgeTransaction | undefined;
  refreshTransactions: () => void;
  clearError: () => void;
}

// Create context
const BridgeContext = createContext<BridgeContextValue | undefined>(undefined);

// Provider props
interface BridgeProviderProps {
  children: ReactNode;
}

/**
 * Bridge Provider Component
 */
export const BridgeProvider: React.FC<BridgeProviderProps> = ({ children }) => {
  const { isConnected, address } = useCircleWallet();

  // State
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<BridgeTransaction[]>([]);
  const [currentEstimate, setCurrentEstimate] = useState<BridgeEstimate | null>(null);
  const [selectedDestination, setSelectedDestination] = useState<BridgeChainConfig | null>(null);
  const [selectedSource, setSelectedSource] = useState<BridgeChainConfig | null>(null);

  // Get destination chains (excluding Arc Testnet as source)
  const destinationChains = bridgeService.getDestinationChains(5042002);

  // Get source chains for inbound bridging (Sepolia, Base Sepolia)
  const sourceChains = bridgeService.getDestinationChains(5042002); // Same chains, different direction

  // Load transactions on mount and when wallet connects
  // Also resume any pending transactions that need attestation polling
  useEffect(() => {
    if (isConnected) {
      refreshTransactions();
      // Resume polling for any pending transactions (e.g., after page refresh)
      bridgeService.resumePendingTransactions();
    }
  }, [isConnected, address]);

  // Refresh transactions from service
  const refreshTransactions = useCallback(() => {
    const allTx = bridgeService.getAllTransactions();
    setTransactions(allTx);
  }, []);

  // Get pending transactions
  const pendingTransactions = transactions.filter(
    tx => !['completed', 'failed'].includes(tx.status)
  );

  // Select destination chain
  const selectDestination = useCallback((chainId: number) => {
    const chain = bridgeService.getChainConfig(chainId);
    setSelectedDestination(chain || null);
    setCurrentEstimate(null);
  }, []);

  // Select source chain (for inbound bridging)
  const selectSource = useCallback((chainId: number) => {
    const chain = bridgeService.getChainConfig(chainId);
    setSelectedSource(chain || null);
    setCurrentEstimate(null);
  }, []);

  // Estimate bridge
  const estimateBridge = useCallback(async (
    amount: string,
    destinationChainId: number
  ): Promise<BridgeEstimate> => {
    setError(null);

    try {
      const estimate = await bridgeService.estimateBridge(amount, destinationChainId);
      setCurrentEstimate(estimate);
      return estimate;
    } catch (err: any) {
      const message = err.message || 'Failed to estimate bridge';
      setError(message);
      throw err;
    }
  }, []);

  // Execute bridge
  const executeBridge = useCallback(async (
    amount: string,
    destinationChainId: number
  ): Promise<BridgeTransaction> => {
    if (!isConnected) {
      throw new Error('Wallet not connected');
    }

    setIsLoading(true);
    setError(null);

    try {
      logger.info('Executing bridge from context', {
        component: 'BridgeContext',
        amount,
        destinationChainId,
      });

      const tx = await bridgeService.bridge(amount, destinationChainId);

      // Refresh transactions list
      refreshTransactions();

      logger.info('Bridge initiated successfully', {
        component: 'BridgeContext',
        txId: tx.id,
        status: tx.status,
      });

      return tx;
    } catch (err: any) {
      const message = err.message || 'Bridge failed';
      setError(message);

      logger.error('Bridge failed', {
        component: 'BridgeContext',
        error: message,
      });

      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, refreshTransactions]);

  // Execute inbound bridge (from external chain to Arc)
  const executeInboundBridge = useCallback(async (
    amount: string,
    sourceChainId: number
  ): Promise<BridgeTransaction> => {
    if (!isConnected) {
      throw new Error('Wallet not connected');
    }

    setIsLoading(true);
    setError(null);

    try {
      logger.info('Executing inbound bridge from context', {
        component: 'BridgeContext',
        amount,
        sourceChainId,
        destinationChainId: 5042002, // Arc Testnet
      });

      const tx = await bridgeService.bridgeInbound(amount, sourceChainId);

      // Refresh transactions list
      refreshTransactions();

      logger.info('Inbound bridge initiated successfully', {
        component: 'BridgeContext',
        txId: tx.id,
        status: tx.status,
      });

      return tx;
    } catch (err: any) {
      const message = err.message || 'Inbound bridge failed';
      setError(message);

      logger.error('Inbound bridge failed', {
        component: 'BridgeContext',
        error: message,
      });

      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, refreshTransactions]);

  // Claim a pending transaction manually
  const claimTransaction = useCallback(async (txId: string): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      logger.info('Claiming transaction', {
        component: 'BridgeContext',
        txId,
      });

      await bridgeService.claimTransaction(txId);

      // Refresh transactions list
      refreshTransactions();

      logger.info('Transaction claimed successfully', {
        component: 'BridgeContext',
        txId,
      });
    } catch (err: any) {
      const message = err.message || 'Claim failed';
      setError(message);

      logger.error('Claim failed', {
        component: 'BridgeContext',
        txId,
        error: message,
      });

      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [refreshTransactions]);

  // Get single transaction
  const getTransaction = useCallback((txId: string): BridgeTransaction | undefined => {
    return bridgeService.getTransaction(txId);
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Poll for transaction updates
  useEffect(() => {
    if (pendingTransactions.length === 0) return;

    const interval = setInterval(() => {
      refreshTransactions();
    }, 10000); // Poll every 10 seconds

    return () => clearInterval(interval);
  }, [pendingTransactions.length, refreshTransactions]);

  // Context value
  const value: BridgeContextValue = {
    // State
    isLoading,
    error,
    transactions,
    pendingTransactions,
    currentEstimate,

    // Chain info
    destinationChains,
    sourceChains,
    selectedDestination,
    selectedSource,

    // Actions
    selectDestination,
    selectSource,
    estimateBridge,
    executeBridge,
    executeInboundBridge,
    claimTransaction,
    getTransaction,
    refreshTransactions,
    clearError,
  };

  return (
    <BridgeContext.Provider value={value}>
      {children}
    </BridgeContext.Provider>
  );
};

/**
 * Hook to use Bridge context
 */
export const useBridge = (): BridgeContextValue => {
  const context = useContext(BridgeContext);
  if (!context) {
    throw new Error('useBridge must be used within a BridgeProvider');
  }
  return context;
};

export default BridgeContext;
