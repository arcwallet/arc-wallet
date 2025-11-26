/**
 * Network Context - Multi-Chain Network Management
 * Handles network selection, switching, and provider management
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { JsonRpcProvider } from 'ethers';
import {
  NetworkConfig,
  ALL_NETWORKS,
  TESTNET_NETWORKS,
  DEFAULT_NETWORK,
  getNetworkByChainId,
  getNetworkById,
  getRpcUrl,
} from '../config/networks';

interface NetworkContextType {
  // Current network
  currentNetwork: NetworkConfig;
  // All available networks
  networks: NetworkConfig[];
  // Provider for current network
  provider: JsonRpcProvider | null;
  // Loading state
  isLoading: boolean;
  // Error state
  error: string | null;
  // Show only testnets (for development)
  showTestnetsOnly: boolean;
  // Actions
  switchNetwork: (networkId: string) => Promise<void>;
  switchNetworkByChainId: (chainId: number) => Promise<void>;
  setShowTestnetsOnly: (value: boolean) => void;
  // Helpers
  isCurrentNetwork: (networkId: string) => boolean;
  getExplorerTxUrl: (txHash: string) => string;
  getExplorerAddressUrl: (address: string) => string;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

const STORAGE_KEY = 'arc_wallet_network';
const TESTNETS_ONLY_KEY = 'arc_wallet_testnets_only';

export const NetworkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Load saved network from localStorage
  const [currentNetwork, setCurrentNetwork] = useState<NetworkConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const network = getNetworkById(saved);
        if (network) return network;
      }
    } catch (e) {
      console.warn('[NetworkContext] Failed to load saved network:', e);
    }
    return DEFAULT_NETWORK;
  });

  // Testnet only mode (default true for development)
  const [showTestnetsOnly, setShowTestnetsOnly] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(TESTNETS_ONLY_KEY);
      return saved !== 'false'; // Default to true
    } catch {
      return true;
    }
  });

  const [provider, setProvider] = useState<JsonRpcProvider | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter networks based on testnet setting
  const networks = useMemo(() => {
    return showTestnetsOnly ? TESTNET_NETWORKS : ALL_NETWORKS;
  }, [showTestnetsOnly]);

  // Initialize provider for current network
  useEffect(() => {
    const initProvider = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const rpcUrl = getRpcUrl(currentNetwork);
        const newProvider = new JsonRpcProvider(rpcUrl, {
          chainId: currentNetwork.chainId,
          name: currentNetwork.network,
        });

        // Test connection
        await newProvider.getBlockNumber();

        setProvider(newProvider);
        console.log(`[NetworkContext] Connected to ${currentNetwork.name} (${currentNetwork.chainId})`);
      } catch (err: any) {
        console.error('[NetworkContext] Failed to connect to network:', err);
        setError(`Failed to connect to ${currentNetwork.name}`);
        setProvider(null);
      } finally {
        setIsLoading(false);
      }
    };

    initProvider();
  }, [currentNetwork]);

  // Save network preference
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, currentNetwork.id);
    } catch (e) {
      console.warn('[NetworkContext] Failed to save network preference:', e);
    }
  }, [currentNetwork]);

  // Save testnet preference
  useEffect(() => {
    try {
      localStorage.setItem(TESTNETS_ONLY_KEY, String(showTestnetsOnly));
    } catch (e) {
      console.warn('[NetworkContext] Failed to save testnet preference:', e);
    }
  }, [showTestnetsOnly]);

  // Switch network by ID
  const switchNetwork = useCallback(async (networkId: string) => {
    const network = getNetworkById(networkId);
    if (!network) {
      throw new Error(`Network not found: ${networkId}`);
    }

    console.log(`[NetworkContext] Switching to ${network.name}`);
    setCurrentNetwork(network);
    // Arc Wallet is self-custodial - no external wallet connection needed
    // Network switch happens internally via our own provider
  }, []);

  // Switch network by chain ID
  const switchNetworkByChainId = useCallback(async (chainId: number) => {
    const network = getNetworkByChainId(chainId);
    if (!network) {
      throw new Error(`Network not found for chain ID: ${chainId}`);
    }
    await switchNetwork(network.id);
  }, [switchNetwork]);

  // Check if network is current
  const isCurrentNetwork = useCallback((networkId: string) => {
    return currentNetwork.id === networkId;
  }, [currentNetwork]);

  // Get explorer TX URL
  const getExplorerTxUrl = useCallback((txHash: string) => {
    return `${currentNetwork.blockExplorers.default.url}/tx/${txHash}`;
  }, [currentNetwork]);

  // Get explorer address URL
  const getExplorerAddressUrl = useCallback((address: string) => {
    return `${currentNetwork.blockExplorers.default.url}/address/${address}`;
  }, [currentNetwork]);

  const value: NetworkContextType = {
    currentNetwork,
    networks,
    provider,
    isLoading,
    error,
    showTestnetsOnly,
    switchNetwork,
    switchNetworkByChainId,
    setShowTestnetsOnly,
    isCurrentNetwork,
    getExplorerTxUrl,
    getExplorerAddressUrl,
  };

  return (
    <NetworkContext.Provider value={value}>
      {children}
    </NetworkContext.Provider>
  );
};

export const useNetwork = (): NetworkContextType => {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return context;
};

export default NetworkContext;
