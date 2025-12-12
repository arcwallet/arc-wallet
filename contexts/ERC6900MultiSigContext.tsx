/**
 * ERC-6900 Multi-Sig Context
 *
 * React context for managing ERC-6900 native multi-sig functionality.
 * Uses Circle's WeightedWebauthnMultisigPlugin for enterprise-grade security.
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
  erc6900MultiSigService,
  type MultiSigConfig,
  type PendingMultiSigTransaction,
  type WebAuthnOwner,
  type EOAOwner,
  type PublicKeyCoordinates,
} from '../services/erc6900MultiSigService';
import { useCircleWallet } from './CircleWalletContext';
import { logger } from '../services/logger';
import type { Address, Hex } from 'viem';

// ============================================
// Types
// ============================================

interface ERC6900MultiSigContextValue {
  // State
  isMultiSigEnabled: boolean;
  config: MultiSigConfig | null;
  pendingTransactions: PendingMultiSigTransaction[];
  isLoading: boolean;
  error: string | null;

  // Owner Management
  addWebAuthnOwners: (
    owners: WebAuthnOwner[],
    newThresholdWeight?: number
  ) => Promise<string>;
  addEOAOwners: (owners: EOAOwner[], newThresholdWeight?: number) => Promise<string>;
  removeOwners: (
    webAuthnOwners: PublicKeyCoordinates[],
    eoaOwners: Address[],
    newThresholdWeight: number
  ) => Promise<string>;
  updateWeights: (
    webAuthnUpdates: Array<{ publicKey: PublicKeyCoordinates; newWeight: number }>,
    eoaUpdates: Array<{ address: Address; newWeight: number }>,
    newThresholdWeight?: number
  ) => Promise<string>;

  // Transaction Management
  createTransaction: (params: {
    to: Address;
    value: bigint;
    data: Hex;
    description?: string;
  }) => PendingMultiSigTransaction;
  signTransaction: (txId: string, weight: number) => Promise<void>;
  executeTransaction: (txId: string) => Promise<string>;
  rejectTransaction: (txId: string) => void;

  // Utility
  refreshPendingTransactions: () => void;
  clearError: () => void;
}

// ============================================
// Context
// ============================================

const ERC6900MultiSigContext = createContext<ERC6900MultiSigContextValue | undefined>(
  undefined
);

// ============================================
// Provider
// ============================================

interface ERC6900MultiSigProviderProps {
  children: ReactNode;
}

export const ERC6900MultiSigProvider: React.FC<ERC6900MultiSigProviderProps> = ({
  children,
}) => {
  const { isConnected, address } = useCircleWallet();

  // State
  const [config, setConfig] = useState<MultiSigConfig | null>(null);
  const [pendingTransactions, setPendingTransactions] = useState<
    PendingMultiSigTransaction[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Computed
  const isMultiSigEnabled = erc6900MultiSigService.isMultiSigEnabled();

  // ============================================
  // Initialization
  // ============================================

  useEffect(() => {
    if (isConnected) {
      setConfig(erc6900MultiSigService.getConfig());
      setPendingTransactions(erc6900MultiSigService.getPendingTransactions());
    } else {
      setConfig(null);
      setPendingTransactions([]);
    }
  }, [isConnected, address]);

  // ============================================
  // Owner Management
  // ============================================

  const addWebAuthnOwners = useCallback(
    async (owners: WebAuthnOwner[], newThresholdWeight?: number): Promise<string> => {
      setIsLoading(true);
      setError(null);

      try {
        const txHash = await erc6900MultiSigService.addWebAuthnOwners(
          owners,
          newThresholdWeight
        );

        // Refresh config
        setConfig(erc6900MultiSigService.getConfig());

        logger.info('WebAuthn owners added via context', {
          component: 'ERC6900MultiSigContext',
          txHash,
        });

        return txHash;
      } catch (err: any) {
        const errorMessage = err.message || 'Failed to add owners';
        setError(errorMessage);
        logger.error('Failed to add WebAuthn owners', {
          component: 'ERC6900MultiSigContext',
          errorMsg: errorMessage,
        });
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const addEOAOwners = useCallback(
    async (owners: EOAOwner[], newThresholdWeight?: number): Promise<string> => {
      setIsLoading(true);
      setError(null);

      try {
        const txHash = await erc6900MultiSigService.addEOAOwners(
          owners,
          newThresholdWeight
        );

        setConfig(erc6900MultiSigService.getConfig());

        return txHash;
      } catch (err: any) {
        const errorMessage = err.message || 'Failed to add EOA owners';
        setError(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const removeOwners = useCallback(
    async (
      webAuthnOwners: PublicKeyCoordinates[],
      eoaOwners: Address[],
      newThresholdWeight: number
    ): Promise<string> => {
      setIsLoading(true);
      setError(null);

      try {
        const txHash = await erc6900MultiSigService.removeOwners(
          webAuthnOwners,
          eoaOwners,
          newThresholdWeight
        );

        setConfig(erc6900MultiSigService.getConfig());

        return txHash;
      } catch (err: any) {
        const errorMessage = err.message || 'Failed to remove owners';
        setError(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const updateWeights = useCallback(
    async (
      webAuthnUpdates: Array<{ publicKey: PublicKeyCoordinates; newWeight: number }>,
      eoaUpdates: Array<{ address: Address; newWeight: number }>,
      newThresholdWeight?: number
    ): Promise<string> => {
      setIsLoading(true);
      setError(null);

      try {
        const txHash = await erc6900MultiSigService.updateWeights(
          webAuthnUpdates,
          eoaUpdates,
          newThresholdWeight
        );

        setConfig(erc6900MultiSigService.getConfig());

        return txHash;
      } catch (err: any) {
        const errorMessage = err.message || 'Failed to update weights';
        setError(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // ============================================
  // Transaction Management
  // ============================================

  const createTransaction = useCallback(
    (params: {
      to: Address;
      value: bigint;
      data: Hex;
      description?: string;
    }): PendingMultiSigTransaction => {
      setError(null);

      try {
        const tx = erc6900MultiSigService.createPendingTransaction(params);
        setPendingTransactions(erc6900MultiSigService.getPendingTransactions());
        return tx;
      } catch (err: any) {
        const errorMessage = err.message || 'Failed to create transaction';
        setError(errorMessage);
        throw err;
      }
    },
    []
  );

  const signTransaction = useCallback(
    async (txId: string, weight: number): Promise<void> => {
      setIsLoading(true);
      setError(null);

      try {
        // In a full implementation, this would:
        // 1. Get the transaction hash to sign
        // 2. Use WebAuthn to sign it
        // 3. Submit the signature

        // For now, simulate adding a signature
        erc6900MultiSigService.addSignature(txId, {
          ownerId: address || 'unknown',
          ownerType: 'webauthn',
          weight,
          signature: '0x' as Hex, // Placeholder
        });

        setPendingTransactions(erc6900MultiSigService.getPendingTransactions());

        logger.info('Transaction signed', {
          component: 'ERC6900MultiSigContext',
          txId,
        });
      } catch (err: any) {
        const errorMessage = err.message || 'Failed to sign transaction';
        setError(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [address]
  );

  const executeTransaction = useCallback(async (txId: string): Promise<string> => {
    setIsLoading(true);
    setError(null);

    try {
      const txHash = await erc6900MultiSigService.executeTransaction(txId);
      setPendingTransactions(erc6900MultiSigService.getPendingTransactions());

      logger.info('Transaction executed', {
        component: 'ERC6900MultiSigContext',
        txId,
        txHash,
      });

      return txHash;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to execute transaction';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const rejectTransaction = useCallback((txId: string): void => {
    setError(null);

    try {
      erc6900MultiSigService.rejectTransaction(txId);
      setPendingTransactions(erc6900MultiSigService.getPendingTransactions());
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to reject transaction';
      setError(errorMessage);
      throw err;
    }
  }, []);

  // ============================================
  // Utility
  // ============================================

  const refreshPendingTransactions = useCallback(() => {
    setPendingTransactions(erc6900MultiSigService.getPendingTransactions());
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // ============================================
  // Context Value
  // ============================================

  const value: ERC6900MultiSigContextValue = {
    // State
    isMultiSigEnabled,
    config,
    pendingTransactions,
    isLoading,
    error,

    // Owner Management
    addWebAuthnOwners,
    addEOAOwners,
    removeOwners,
    updateWeights,

    // Transaction Management
    createTransaction,
    signTransaction,
    executeTransaction,
    rejectTransaction,

    // Utility
    refreshPendingTransactions,
    clearError,
  };

  return (
    <ERC6900MultiSigContext.Provider value={value}>
      {children}
    </ERC6900MultiSigContext.Provider>
  );
};

// ============================================
// Hook
// ============================================

export const useERC6900MultiSig = (): ERC6900MultiSigContextValue => {
  const context = useContext(ERC6900MultiSigContext);
  if (!context) {
    throw new Error('useERC6900MultiSig must be used within an ERC6900MultiSigProvider');
  }
  return context;
};

export default ERC6900MultiSigContext;
