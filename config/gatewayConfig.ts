/**
 * Circle Gateway Configuration
 * Testnet contract addresses and domain IDs for instant USDC crosschain transfers
 */

// Gateway contract addresses (same on all testnet chains)
export const GATEWAY_CONTRACTS = {
  GATEWAY_WALLET: '0x0077777d7EBA4688BDeF3E311b846F25870A19B9',
  GATEWAY_MINTER: '0x0022222ABE238Cc2C7Bb1f21003F0a260052475B',
} as const;

// USDC token addresses per chain
export const USDC_ADDRESSES = {
  arcTestnet: '0x3600000000000000000000000000000000000000',
  sepolia: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
  baseSepolia: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  avalancheFuji: '0x5425890298aed601595a70ab815c96711a31bc65',
} as const;

// Circle CCTP Domain IDs
export const GATEWAY_DOMAINS = {
  arcTestnet: 26,
  sepolia: 0,
  avalancheFuji: 1,
  baseSepolia: 6,
} as const;

// Chain IDs
export const CHAIN_IDS = {
  arcTestnet: 5042002,
  sepolia: 11155111,
  baseSepolia: 84532,
  avalancheFuji: 43113,
} as const;

// RPC URLs
export const RPC_URLS = {
  arcTestnet: 'https://testnet-rpc.arc.io',
  sepolia: 'https://ethereum-sepolia-rpc.publicnode.com',
  baseSepolia: 'https://sepolia.base.org',
  avalancheFuji: 'https://api.avax-test.network/ext/bc/C/rpc',
} as const;

// Gateway API endpoint - Uses Circle's attestation API (same as CCTP)
// Gateway attestation is faster but uses same infrastructure
export const GATEWAY_API = {
  TESTNET: 'https://iris-api-sandbox.circle.com',
  MAINNET: 'https://iris-api.circle.com',
} as const;

// EIP-712 TypedData for burn intent
export const BURN_INTENT_TYPES = {
  BurnIntent: [
    { name: 'amount', type: 'uint256' },
    { name: 'burnToken', type: 'address' },
    { name: 'mintRecipient', type: 'bytes32' },
    { name: 'destinationDomain', type: 'uint32' },
    { name: 'destinationCaller', type: 'bytes32' },
    { name: 'maxFee', type: 'uint256' },
    { name: 'nonce', type: 'uint64' },
  ],
} as const;

// Gateway Wallet ABI (minimal - only what we need)
export const GATEWAY_WALLET_ABI = [
  {
    name: 'deposit',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'getBalance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'depositor', type: 'address' },
      { name: 'token', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'burnWithCaller',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'burnToken', type: 'address' },
      { name: 'mintRecipient', type: 'bytes32' },
      { name: 'destinationDomain', type: 'uint32' },
      { name: 'destinationCaller', type: 'bytes32' },
      { name: 'maxFee', type: 'uint256' },
    ],
    outputs: [{ name: 'nonce', type: 'uint64' }],
  },
  {
    name: 'getNonce',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'depositor', type: 'address' }],
    outputs: [{ name: '', type: 'uint64' }],
  },
] as const;

// Gateway Minter ABI (for receiving USDC on destination)
// Uses CCTP's receiveMessage function - same as MessageTransmitter
export const GATEWAY_MINTER_ABI = [
  {
    name: 'receiveMessage',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'message', type: 'bytes' },
      { name: 'attestation', type: 'bytes' },
    ],
    outputs: [{ name: 'success', type: 'bool' }],
  },
] as const;

// ERC20 ABI for approve
export const ERC20_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

// Helper to get domain ID from chain name
export type SupportedChain = keyof typeof GATEWAY_DOMAINS;

export function getDomainId(chain: SupportedChain): number {
  return GATEWAY_DOMAINS[chain];
}

export function getUsdcAddress(chain: SupportedChain): string {
  return USDC_ADDRESSES[chain];
}

export function getChainId(chain: SupportedChain): number {
  return CHAIN_IDS[chain];
}

export function getRpcUrl(chain: SupportedChain): string {
  return RPC_URLS[chain];
}
