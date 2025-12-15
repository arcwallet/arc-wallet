/**
 * Shared RPC Provider and Network Utilities
 *
 * This module provides shared blockchain connectivity utilities
 * used across all wallet services (passkey-based and legacy).
 */

import { JsonRpcProvider } from 'ethers';
import artifact from '../hh-artifacts/contracts/ArcSmartAccount.sol/ArcSmartAccount.json' assert { type: 'json' };

// ============================================================================
// Environment Configuration
// ============================================================================

const runtimeEnv =
  typeof import.meta !== 'undefined' && typeof import.meta.env !== 'undefined'
    ? (import.meta.env as Record<string, string | undefined>)
    : (process.env as Record<string, string | undefined>);

/**
 * Arc Testnet RPC URL
 */
export const RPC_URL =
  runtimeEnv?.VITE_ARC_RPC_URL ?? runtimeEnv?.ARC_RPC_URL ?? 'https://rpc.testnet.arc.network';

/**
 * Base Sepolia RPC URL (for bridging)
 */
export const BASE_SEPOLIA_RPC_URL =
  runtimeEnv?.VITE_BASE_SEPOLIA_RPC_URL ?? 'https://sepolia.base.org';

/**
 * Arc Chain ID
 */
export const ARC_CHAIN_ID = 1555n;

// ============================================================================
// Provider Management
// ============================================================================

let sharedProvider: JsonRpcProvider | null = null;
let baseSepoliaProvider: JsonRpcProvider | null = null;

/**
 * Get shared JsonRpcProvider instance for Arc network
 * Uses singleton pattern to avoid creating multiple connections
 */
export const getProvider = (): JsonRpcProvider => {
  if (!sharedProvider) {
    sharedProvider = new JsonRpcProvider(RPC_URL);
    sharedProvider.pollingInterval = 6000;
  }
  return sharedProvider;
};

/**
 * Get provider for Base Sepolia network (bridging)
 */
export const getBaseSepoliaProvider = (): JsonRpcProvider => {
  if (!baseSepoliaProvider) {
    baseSepoliaProvider = new JsonRpcProvider(BASE_SEPOLIA_RPC_URL);
    baseSepoliaProvider.pollingInterval = 12000;
  }
  return baseSepoliaProvider;
};

/**
 * Create a new provider instance (non-shared)
 */
export const createProvider = (rpcUrl: string = RPC_URL): JsonRpcProvider => {
  return new JsonRpcProvider(rpcUrl);
};

// ============================================================================
// Fee Estimation
// ============================================================================

export interface FeeSettings {
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
}

/**
 * Get current network fee settings (EIP-1559)
 */
export const getFeeSettings = async (provider: JsonRpcProvider): Promise<FeeSettings> => {
  const feeData = await provider.getFeeData();
  const maxFeePerGas = feeData.maxFeePerGas ?? feeData.gasPrice ?? 0n;
  const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas ?? 0n;
  return { maxFeePerGas, maxPriorityFeePerGas };
};

// ============================================================================
// Smart Account ABI (shared across all services)
// ============================================================================

const { abi, bytecode } = artifact as { abi: any; bytecode: string };

/**
 * ArcSmartAccount contract ABI
 */
export const ARC_SMART_ACCOUNT_ABI = abi;

/**
 * ArcSmartAccount contract bytecode (for deployment)
 */
export const ARC_SMART_ACCOUNT_BYTECODE = bytecode;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if an address is a deployed contract
 */
export async function isContractDeployed(address: string): Promise<boolean> {
  const provider = getProvider();
  const code = await provider.getCode(address);
  return code !== '0x';
}

/**
 * Get native token balance for an address
 */
export async function getNativeBalance(address: string): Promise<bigint> {
  const provider = getProvider();
  return provider.getBalance(address);
}

/**
 * Wait for transaction confirmation
 */
export async function waitForTransaction(txHash: string, confirmations: number = 1): Promise<void> {
  const provider = getProvider();
  const receipt = await provider.waitForTransaction(txHash, confirmations);
  if (!receipt || receipt.status === 0) {
    throw new Error(`Transaction ${txHash} failed`);
  }
}
