/**
 * CCTP (Cross-Chain Transfer Protocol) Configuration
 *
 * Circle CCTP V2 contract addresses and chain configurations
 * for cross-chain USDC transfers.
 *
 * @see https://developers.circle.com/cctp/evm-smart-contracts
 */

import type { Address } from 'viem';

// CCTP Domain IDs (assigned by Circle)
export const CCTP_DOMAINS = {
  ETHEREUM: 0,
  AVALANCHE: 1,
  OP_MAINNET: 2,
  ARBITRUM: 3,
  BASE: 6,
  POLYGON: 7,
  SOLANA: 5,
  ARC_TESTNET: 26,
  ETHEREUM_SEPOLIA: 0,
  AVALANCHE_FUJI: 1,
  BASE_SEPOLIA: 6,
} as const;

// CCTP V2 Contract Addresses (deterministic via CREATE2 - same on all chains)
export const CCTP_CONTRACTS = {
  TokenMessengerV2: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA' as Address,
  MessageTransmitterV2: '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275' as Address,
  TokenMinterV2: '0xb43db544E2c27092c107639Ad201b3dEfAbcF192' as Address,
  MessageV2: '0xbaC0179bB358A8936169a63408C8481D582390C4' as Address,
} as const;

// Chain-specific USDC addresses
export const USDC_ADDRESSES: Record<number, Address> = {
  // Testnets
  5042002: '0x3600000000000000000000000000000000000000', // Arc Testnet (native)
  11155111: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // Ethereum Sepolia
  84532: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // Base Sepolia
  43113: '0x5425890298aed601595a70AB815c96711a31Bc65', // Avalanche Fuji

  // Mainnets (for future use)
  1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // Ethereum
  8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // Base
  42161: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // Arbitrum
  137: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', // Polygon
};

// Supported bridge routes
export interface BridgeChainConfig {
  chainId: number;
  name: string;
  domain: number;
  rpcUrl: string;
  explorerUrl: string;
  usdc: Address;
  isTestnet: boolean;
  nativeToken: string;
  // Whether this chain supports fast transfer (CCTP V2)
  supportsFastTransfer: boolean;
}

export const BRIDGE_CHAINS: Record<string, BridgeChainConfig> = {
  arcTestnet: {
    chainId: 5042002,
    name: 'Arc Testnet',
    domain: CCTP_DOMAINS.ARC_TESTNET,
    rpcUrl: 'https://rpc.testnet.arc.network',
    explorerUrl: 'https://testnet.arcscan.app',
    usdc: USDC_ADDRESSES[5042002],
    isTestnet: true,
    nativeToken: 'USDC', // Arc uses USDC as native gas
    supportsFastTransfer: false, // Arc only supports standard transfer
  },
  baseSepolia: {
    chainId: 84532,
    name: 'Base Sepolia',
    domain: CCTP_DOMAINS.BASE_SEPOLIA,
    rpcUrl: 'https://sepolia.base.org',
    explorerUrl: 'https://sepolia.basescan.org',
    usdc: USDC_ADDRESSES[84532],
    isTestnet: true,
    nativeToken: 'ETH',
    supportsFastTransfer: true,
  },
};

// Circle Attestation API endpoints
export const CCTP_ATTESTATION = {
  testnet: 'https://iris-api-sandbox.circle.com/v2/attestations',
  mainnet: 'https://iris-api.circle.com/v2/attestations',
} as const;

// TokenMessengerV2 ABI (only functions we need)
export const TOKEN_MESSENGER_ABI = [
  {
    name: 'depositForBurn',
    type: 'function',
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'destinationDomain', type: 'uint32' },
      { name: 'mintRecipient', type: 'bytes32' },
      { name: 'burnToken', type: 'address' },
      { name: 'destinationCaller', type: 'bytes32' },
      { name: 'maxFee', type: 'uint256' },
      { name: 'minFinalityThreshold', type: 'uint32' },
    ],
    outputs: [{ name: 'nonce', type: 'uint64' }],
    stateMutability: 'nonpayable',
  },
  {
    name: 'depositForBurnWithCaller',
    type: 'function',
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'destinationDomain', type: 'uint32' },
      { name: 'mintRecipient', type: 'bytes32' },
      { name: 'burnToken', type: 'address' },
      { name: 'destinationCaller', type: 'bytes32' },
    ],
    outputs: [{ name: 'nonce', type: 'uint64' }],
    stateMutability: 'nonpayable',
  },
] as const;

// MessageTransmitterV2 ABI (for receiving)
export const MESSAGE_TRANSMITTER_ABI = [
  {
    name: 'receiveMessage',
    type: 'function',
    inputs: [
      { name: 'message', type: 'bytes' },
      { name: 'attestation', type: 'bytes' },
    ],
    outputs: [{ name: 'success', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    name: 'usedNonces',
    type: 'function',
    inputs: [{ name: 'nonce', type: 'bytes32' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

// ERC20 ABI for approve
export const ERC20_ABI = [
  {
    name: 'approve',
    type: 'function',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    name: 'allowance',
    type: 'function',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'balanceOf',
    type: 'function',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

// Helper: Convert address to bytes32 (for mintRecipient)
export function addressToBytes32(address: Address): `0x${string}` {
  // Remove 0x prefix, pad to 32 bytes (64 hex chars)
  const cleanAddress = address.toLowerCase().replace('0x', '');
  return `0x${'0'.repeat(24)}${cleanAddress}` as `0x${string}`;
}

// Helper: Convert bytes32 back to address
export function bytes32ToAddress(bytes32: `0x${string}`): Address {
  // Take last 40 hex chars (20 bytes)
  return `0x${bytes32.slice(-40)}` as Address;
}

// Helper: Get chain config by chainId
export function getChainConfig(chainId: number): BridgeChainConfig | undefined {
  return Object.values(BRIDGE_CHAINS).find(c => c.chainId === chainId);
}

// Helper: Get supported destination chains for a source chain
export function getDestinationChains(sourceChainId: number): BridgeChainConfig[] {
  return Object.values(BRIDGE_CHAINS).filter(c => c.chainId !== sourceChainId);
}

// Bridge fee estimation (CCTP V2 fees)
export const CCTP_FEES = {
  // Standard transfer: ~$0.01-0.05 depending on chain
  standardTransferFee: 50000n, // 0.05 USDC in 6 decimals
  // Fast transfer: higher fee for faster finality
  fastTransferFee: 100000n, // 0.10 USDC in 6 decimals
  // Max fee we're willing to pay (for safety)
  maxFee: 1000000n, // 1 USDC max
} as const;

// CCTP V2 Finality Thresholds
// See: https://developers.circle.com/cctp/technical-guide
export const CCTP_FINALITY = {
  // Fast Transfer: confirmed level attestation (faster, higher fee)
  // Use for chains that support fast transfer
  FAST: 1000,
  // Standard Transfer: finalized level attestation (slower, lower fee)
  // Use for chains that only support standard transfer (like Arc)
  STANDARD: 2000,
} as const;

export default {
  CCTP_DOMAINS,
  CCTP_CONTRACTS,
  BRIDGE_CHAINS,
  CCTP_ATTESTATION,
  TOKEN_MESSENGER_ABI,
  MESSAGE_TRANSMITTER_ABI,
  ERC20_ABI,
};
