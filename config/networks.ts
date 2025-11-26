/**
 * Multi-Chain Network Configuration
 * Supports Arc Network + Popular EVM Chains
 */

export interface NetworkConfig {
  id: string;
  chainId: number;
  name: string;
  shortName: string;
  network: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: {
    default: string;
    public: string;
    fallback?: string[];
  };
  blockExplorers: {
    default: {
      name: string;
      url: string;
    };
  };
  testnet: boolean;
  icon?: string;
  // Arc-specific: USDC as gas
  usesUSDCGas?: boolean;
  // Contract addresses
  contracts?: {
    multicall3?: string;
    ensRegistry?: string;
  };
}

// ============================================
// ARC NETWORK
// ============================================

export const ARC_TESTNET: NetworkConfig = {
  id: 'arc-testnet',
  chainId: 5042002,
  name: 'Arc Testnet',
  shortName: 'ARC',
  network: 'arc-testnet',
  nativeCurrency: {
    name: 'USDC',
    symbol: 'USDC',
    decimals: 6,
  },
  rpcUrls: {
    default: 'https://rpc.testnet.arc.network',
    public: 'https://rpc.testnet.arc.network',
  },
  blockExplorers: {
    default: { name: 'ArcScan', url: 'https://testnet.arcscan.app' },
  },
  testnet: true,
  icon: '/arc-logo.svg',
  usesUSDCGas: true,
};

// ============================================
// ETHEREUM
// ============================================

export const ETHEREUM_MAINNET: NetworkConfig = {
  id: 'ethereum',
  chainId: 1,
  name: 'Ethereum',
  shortName: 'ETH',
  network: 'homestead',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: 'https://eth.llamarpc.com',
    public: 'https://ethereum.publicnode.com',
    fallback: [
      'https://rpc.ankr.com/eth',
      'https://1rpc.io/eth',
    ],
  },
  blockExplorers: {
    default: { name: 'Etherscan', url: 'https://etherscan.io' },
  },
  testnet: false,
  icon: '/eth-logo.svg',
  contracts: {
    multicall3: '0xca11bde05977b3631167028862be2a173976ca11',
    ensRegistry: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e',
  },
};

export const ETHEREUM_SEPOLIA: NetworkConfig = {
  id: 'sepolia',
  chainId: 11155111,
  name: 'Sepolia Testnet',
  shortName: 'SEP',
  network: 'sepolia',
  nativeCurrency: {
    name: 'Sepolia Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: 'https://rpc.sepolia.org',
    public: 'https://ethereum-sepolia.publicnode.com',
    fallback: [
      'https://rpc.ankr.com/eth_sepolia',
      'https://sepolia.drpc.org',
    ],
  },
  blockExplorers: {
    default: { name: 'Etherscan', url: 'https://sepolia.etherscan.io' },
  },
  testnet: true,
  icon: '/eth-logo.svg',
  contracts: {
    multicall3: '0xca11bde05977b3631167028862be2a173976ca11',
  },
};

// ============================================
// BASE (Coinbase L2)
// ============================================

export const BASE_MAINNET: NetworkConfig = {
  id: 'base',
  chainId: 8453,
  name: 'Base',
  shortName: 'BASE',
  network: 'base',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: 'https://mainnet.base.org',
    public: 'https://base.publicnode.com',
    fallback: [
      'https://base.llamarpc.com',
      'https://1rpc.io/base',
    ],
  },
  blockExplorers: {
    default: { name: 'BaseScan', url: 'https://basescan.org' },
  },
  testnet: false,
  icon: '/base-logo.svg',
  contracts: {
    multicall3: '0xca11bde05977b3631167028862be2a173976ca11',
  },
};

export const BASE_SEPOLIA: NetworkConfig = {
  id: 'base-sepolia',
  chainId: 84532,
  name: 'Base Sepolia',
  shortName: 'BSEP',
  network: 'base-sepolia',
  nativeCurrency: {
    name: 'Sepolia Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: 'https://sepolia.base.org',
    public: 'https://base-sepolia.publicnode.com',
  },
  blockExplorers: {
    default: { name: 'BaseScan', url: 'https://sepolia.basescan.org' },
  },
  testnet: true,
  icon: '/base-logo.svg',
  contracts: {
    multicall3: '0xca11bde05977b3631167028862be2a173976ca11',
  },
};

// ============================================
// ARBITRUM
// ============================================

export const ARBITRUM_ONE: NetworkConfig = {
  id: 'arbitrum',
  chainId: 42161,
  name: 'Arbitrum One',
  shortName: 'ARB',
  network: 'arbitrum',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: 'https://arb1.arbitrum.io/rpc',
    public: 'https://arbitrum-one.publicnode.com',
    fallback: [
      'https://arbitrum.llamarpc.com',
      'https://1rpc.io/arb',
    ],
  },
  blockExplorers: {
    default: { name: 'Arbiscan', url: 'https://arbiscan.io' },
  },
  testnet: false,
  icon: '/arbitrum-logo.svg',
  contracts: {
    multicall3: '0xca11bde05977b3631167028862be2a173976ca11',
  },
};

export const ARBITRUM_SEPOLIA: NetworkConfig = {
  id: 'arbitrum-sepolia',
  chainId: 421614,
  name: 'Arbitrum Sepolia',
  shortName: 'ARBSEP',
  network: 'arbitrum-sepolia',
  nativeCurrency: {
    name: 'Sepolia Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: 'https://sepolia-rollup.arbitrum.io/rpc',
    public: 'https://arbitrum-sepolia.publicnode.com',
  },
  blockExplorers: {
    default: { name: 'Arbiscan', url: 'https://sepolia.arbiscan.io' },
  },
  testnet: true,
  icon: '/arbitrum-logo.svg',
  contracts: {
    multicall3: '0xca11bde05977b3631167028862be2a173976ca11',
  },
};

// ============================================
// OPTIMISM
// ============================================

export const OPTIMISM_MAINNET: NetworkConfig = {
  id: 'optimism',
  chainId: 10,
  name: 'Optimism',
  shortName: 'OP',
  network: 'optimism',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: 'https://mainnet.optimism.io',
    public: 'https://optimism.publicnode.com',
    fallback: [
      'https://optimism.llamarpc.com',
      'https://1rpc.io/op',
    ],
  },
  blockExplorers: {
    default: { name: 'Optimistic Etherscan', url: 'https://optimistic.etherscan.io' },
  },
  testnet: false,
  icon: '/optimism-logo.svg',
  contracts: {
    multicall3: '0xca11bde05977b3631167028862be2a173976ca11',
  },
};

export const OPTIMISM_SEPOLIA: NetworkConfig = {
  id: 'optimism-sepolia',
  chainId: 11155420,
  name: 'Optimism Sepolia',
  shortName: 'OPSEP',
  network: 'optimism-sepolia',
  nativeCurrency: {
    name: 'Sepolia Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: 'https://sepolia.optimism.io',
    public: 'https://optimism-sepolia.publicnode.com',
  },
  blockExplorers: {
    default: { name: 'Optimistic Etherscan', url: 'https://sepolia-optimism.etherscan.io' },
  },
  testnet: true,
  icon: '/optimism-logo.svg',
  contracts: {
    multicall3: '0xca11bde05977b3631167028862be2a173976ca11',
  },
};

// ============================================
// POLYGON
// ============================================

export const POLYGON_MAINNET: NetworkConfig = {
  id: 'polygon',
  chainId: 137,
  name: 'Polygon',
  shortName: 'MATIC',
  network: 'matic',
  nativeCurrency: {
    name: 'POL',
    symbol: 'POL',
    decimals: 18,
  },
  rpcUrls: {
    default: 'https://polygon-rpc.com',
    public: 'https://polygon-bor.publicnode.com',
    fallback: [
      'https://polygon.llamarpc.com',
      'https://1rpc.io/matic',
    ],
  },
  blockExplorers: {
    default: { name: 'PolygonScan', url: 'https://polygonscan.com' },
  },
  testnet: false,
  icon: '/polygon-logo.svg',
  contracts: {
    multicall3: '0xca11bde05977b3631167028862be2a173976ca11',
  },
};

export const POLYGON_AMOY: NetworkConfig = {
  id: 'polygon-amoy',
  chainId: 80002,
  name: 'Polygon Amoy',
  shortName: 'AMOY',
  network: 'polygon-amoy',
  nativeCurrency: {
    name: 'POL',
    symbol: 'POL',
    decimals: 18,
  },
  rpcUrls: {
    default: 'https://rpc-amoy.polygon.technology',
    public: 'https://polygon-amoy.publicnode.com',
  },
  blockExplorers: {
    default: { name: 'PolygonScan', url: 'https://amoy.polygonscan.com' },
  },
  testnet: true,
  icon: '/polygon-logo.svg',
  contracts: {
    multicall3: '0xca11bde05977b3631167028862be2a173976ca11',
  },
};

// ============================================
// AVALANCHE
// ============================================

export const AVALANCHE_MAINNET: NetworkConfig = {
  id: 'avalanche',
  chainId: 43114,
  name: 'Avalanche C-Chain',
  shortName: 'AVAX',
  network: 'avalanche',
  nativeCurrency: {
    name: 'Avalanche',
    symbol: 'AVAX',
    decimals: 18,
  },
  rpcUrls: {
    default: 'https://api.avax.network/ext/bc/C/rpc',
    public: 'https://avalanche-c-chain.publicnode.com',
    fallback: [
      'https://avalanche.drpc.org',
      'https://1rpc.io/avax/c',
    ],
  },
  blockExplorers: {
    default: { name: 'Snowtrace', url: 'https://snowtrace.io' },
  },
  testnet: false,
  icon: '/avalanche-logo.svg',
  contracts: {
    multicall3: '0xca11bde05977b3631167028862be2a173976ca11',
  },
};

export const AVALANCHE_FUJI: NetworkConfig = {
  id: 'avalanche-fuji',
  chainId: 43113,
  name: 'Avalanche Fuji',
  shortName: 'FUJI',
  network: 'avalanche-fuji',
  nativeCurrency: {
    name: 'Avalanche',
    symbol: 'AVAX',
    decimals: 18,
  },
  rpcUrls: {
    default: 'https://api.avax-test.network/ext/bc/C/rpc',
    public: 'https://avalanche-fuji-c-chain.publicnode.com',
  },
  blockExplorers: {
    default: { name: 'Snowtrace', url: 'https://testnet.snowtrace.io' },
  },
  testnet: true,
  icon: '/avalanche-logo.svg',
  contracts: {
    multicall3: '0xca11bde05977b3631167028862be2a173976ca11',
  },
};

// ============================================
// BSC (Binance Smart Chain)
// ============================================

export const BSC_MAINNET: NetworkConfig = {
  id: 'bsc',
  chainId: 56,
  name: 'BNB Smart Chain',
  shortName: 'BSC',
  network: 'bsc',
  nativeCurrency: {
    name: 'BNB',
    symbol: 'BNB',
    decimals: 18,
  },
  rpcUrls: {
    default: 'https://bsc-dataseed.binance.org',
    public: 'https://bsc.publicnode.com',
    fallback: [
      'https://bsc-dataseed1.defibit.io',
      'https://1rpc.io/bnb',
    ],
  },
  blockExplorers: {
    default: { name: 'BscScan', url: 'https://bscscan.com' },
  },
  testnet: false,
  icon: '/bsc-logo.svg',
  contracts: {
    multicall3: '0xca11bde05977b3631167028862be2a173976ca11',
  },
};

export const BSC_TESTNET: NetworkConfig = {
  id: 'bsc-testnet',
  chainId: 97,
  name: 'BSC Testnet',
  shortName: 'BSCT',
  network: 'bsc-testnet',
  nativeCurrency: {
    name: 'tBNB',
    symbol: 'tBNB',
    decimals: 18,
  },
  rpcUrls: {
    default: 'https://data-seed-prebsc-1-s1.binance.org:8545',
    public: 'https://bsc-testnet.publicnode.com',
  },
  blockExplorers: {
    default: { name: 'BscScan', url: 'https://testnet.bscscan.com' },
  },
  testnet: true,
  icon: '/bsc-logo.svg',
};

// ============================================
// NETWORK COLLECTIONS
// ============================================

// All supported networks
export const ALL_NETWORKS: NetworkConfig[] = [
  // Arc Network (primary)
  ARC_TESTNET,
  // Ethereum
  ETHEREUM_MAINNET,
  ETHEREUM_SEPOLIA,
  // Base
  BASE_MAINNET,
  BASE_SEPOLIA,
  // Arbitrum
  ARBITRUM_ONE,
  ARBITRUM_SEPOLIA,
  // Optimism
  OPTIMISM_MAINNET,
  OPTIMISM_SEPOLIA,
  // Polygon
  POLYGON_MAINNET,
  POLYGON_AMOY,
  // Avalanche
  AVALANCHE_MAINNET,
  AVALANCHE_FUJI,
  // BSC
  BSC_MAINNET,
  BSC_TESTNET,
];

// Mainnet networks only
export const MAINNET_NETWORKS = ALL_NETWORKS.filter(n => !n.testnet);

// Testnet networks only
export const TESTNET_NETWORKS = ALL_NETWORKS.filter(n => n.testnet);

// Default network
export const DEFAULT_NETWORK = ARC_TESTNET;

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get network by chain ID
 */
export const getNetworkByChainId = (chainId: number): NetworkConfig | undefined => {
  return ALL_NETWORKS.find(n => n.chainId === chainId);
};

/**
 * Get network by ID
 */
export const getNetworkById = (id: string): NetworkConfig | undefined => {
  return ALL_NETWORKS.find(n => n.id === id);
};

/**
 * Get explorer URL for transaction
 */
export const getTxExplorerUrl = (network: NetworkConfig, txHash: string): string => {
  return `${network.blockExplorers.default.url}/tx/${txHash}`;
};

/**
 * Get explorer URL for address
 */
export const getAddressExplorerUrl = (network: NetworkConfig, address: string): string => {
  return `${network.blockExplorers.default.url}/address/${address}`;
};

/**
 * Check if network is Arc
 */
export const isArcNetwork = (network: NetworkConfig): boolean => {
  return network.id.startsWith('arc');
};

/**
 * Get RPC URL with fallback
 */
export const getRpcUrl = (network: NetworkConfig): string => {
  return network.rpcUrls.default;
};

/**
 * Format chain ID for wallet connection
 */
export const formatChainIdHex = (chainId: number): string => {
  return `0x${chainId.toString(16)}`;
};
