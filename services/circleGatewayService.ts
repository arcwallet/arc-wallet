/**
 * Circle Gateway Service
 * Handles instant USDC crosschain transfers via Circle Gateway (<500ms)
 */

import { ethers } from 'ethers';
import { PasskeyAccountManager } from '@arc/wallet-sdk';
import {
  GATEWAY_CONTRACTS,
  GATEWAY_API,
  GATEWAY_WALLET_ABI,
  GATEWAY_MINTER_ABI,
  ERC20_ABI,
  GATEWAY_DOMAINS,
  USDC_ADDRESSES,
  RPC_URLS,
  type SupportedChain,
} from '../config/gatewayConfig';

// Gateway transfer direction
export type GatewayDirection = 'arc-to-sepolia' | 'sepolia-to-arc';

// Progress callback types
export type GatewayProgressStep =
  | { type: 'checking-balance' }
  | { type: 'approving-usdc'; txHash?: string }
  | { type: 'depositing'; txHash?: string }
  | { type: 'signing-burn-intent' }
  | { type: 'requesting-attestation' }
  | { type: 'attestation-received'; attestation?: string }
  | { type: 'minting'; txHash?: string }
  | { type: 'completed'; sourceTxHash?: string; destinationTxHash?: string }
  | { type: 'error'; message: string };

export interface GatewayTransferParams {
  passkeyManager: PasskeyAccountManager;
  sepoliaPasskeyManager?: PasskeyAccountManager;
  amount: string; // USDC amount as string (e.g., "10.00")
  direction: GatewayDirection;
  onProgress?: (step: GatewayProgressStep) => void;
}

export interface GatewayTransferResult {
  success: boolean;
  sourceTxHash?: string;
  destinationTxHash?: string;
  error?: string;
}

// Helper: Convert address to bytes32 (left-padded)
function addressToBytes32(address: string): string {
  return ethers.zeroPadValue(address, 32);
}

// Helper: Get chain info from direction
function getChainInfo(direction: GatewayDirection) {
  const sourceChain: SupportedChain = direction === 'arc-to-sepolia' ? 'arcTestnet' : 'sepolia';
  const destChain: SupportedChain = direction === 'arc-to-sepolia' ? 'sepolia' : 'arcTestnet';

  return {
    sourceChain,
    destChain,
    sourceRpc: RPC_URLS[sourceChain],
    destRpc: RPC_URLS[destChain],
    sourceUsdc: USDC_ADDRESSES[sourceChain],
    destUsdc: USDC_ADDRESSES[destChain],
    sourceDomain: GATEWAY_DOMAINS[sourceChain],
    destDomain: GATEWAY_DOMAINS[destChain],
  };
}

/**
 * Get Gateway unified balance for a depositor
 */
export async function getGatewayBalance(
  depositorAddress: string,
  chain: SupportedChain = 'arcTestnet'
): Promise<string> {
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URLS[chain]);
    const gatewayWallet = new ethers.Contract(
      GATEWAY_CONTRACTS.GATEWAY_WALLET,
      GATEWAY_WALLET_ABI,
      provider
    );

    const balance = await gatewayWallet.getBalance(
      depositorAddress,
      USDC_ADDRESSES[chain]
    );

    return ethers.formatUnits(balance, 6);
  } catch (error) {
    console.error('[Gateway] Failed to get balance:', error);
    return '0.00';
  }
}

/**
 * Get current nonce for depositor
 */
export async function getGatewayNonce(
  depositorAddress: string,
  chain: SupportedChain = 'arcTestnet'
): Promise<bigint> {
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URLS[chain]);
    const gatewayWallet = new ethers.Contract(
      GATEWAY_CONTRACTS.GATEWAY_WALLET,
      GATEWAY_WALLET_ABI,
      provider
    );

    return await gatewayWallet.getNonce(depositorAddress);
  } catch (error) {
    console.error('[Gateway] Failed to get nonce:', error);
    return 0n;
  }
}

/**
 * Poll for attestation status
 */
async function pollAttestation(params: {
  sourceChain: SupportedChain;
  burnTxHash: string;
  maxAttempts?: number;
  intervalMs?: number;
}): Promise<{ attestation: string; signature: string }> {
  const { sourceChain, burnTxHash, maxAttempts = 60, intervalMs = 1000 } = params;

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(
        `${GATEWAY_API.TESTNET}/attestations/${burnTxHash}?domain=${GATEWAY_DOMAINS[sourceChain]}`
      );

      if (response.ok) {
        const data = await response.json();
        if (data.attestation && data.status === 'complete') {
          return {
            attestation: data.attestation,
            signature: data.signature || '0x',
          };
        }
      }
    } catch (error) {
      console.log(`[Gateway] Attestation poll attempt ${i + 1}/${maxAttempts}`);
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error('Attestation timeout');
}

/**
 * Execute Gateway transfer with Passkey Smart Account
 *
 * Flow:
 * 1. Approve USDC to GatewayWallet
 * 2. Deposit USDC to GatewayWallet (creates unified balance)
 * 3. Sign burn intent (EIP-712)
 * 4. Execute burn on source chain
 * 5. Get attestation from Gateway API
 * 6. Mint on destination chain
 */
export async function transferWithGateway(
  params: GatewayTransferParams
): Promise<GatewayTransferResult> {
  const { passkeyManager, sepoliaPasskeyManager, amount, direction, onProgress } = params;

  const chainInfo = getChainInfo(direction);
  const amountWei = ethers.parseUnits(amount, 6);
  const userAddress = passkeyManager.getAccountAddress();

  if (!userAddress) {
    return { success: false, error: 'Wallet not connected' };
  }

  console.log('[Gateway] Starting transfer:', {
    direction,
    amount,
    userAddress,
    sourceChain: chainInfo.sourceChain,
    destChain: chainInfo.destChain,
  });

  try {
    // Step 1: Check USDC balance
    onProgress?.({ type: 'checking-balance' });

    const provider = new ethers.JsonRpcProvider(chainInfo.sourceRpc);
    const usdc = new ethers.Contract(chainInfo.sourceUsdc, ERC20_ABI, provider);
    const balance = await usdc.balanceOf(userAddress);

    if (balance < amountWei) {
      return {
        success: false,
        error: `Insufficient USDC balance. Have: ${ethers.formatUnits(balance, 6)}, Need: ${amount}`,
      };
    }

    // Get the appropriate manager for source chain
    const sourceManager = direction === 'arc-to-sepolia'
      ? passkeyManager
      : (sepoliaPasskeyManager || passkeyManager);

    // Step 2: Approve USDC to GatewayWallet
    onProgress?.({ type: 'approving-usdc' });

    const allowance = await usdc.allowance(userAddress, GATEWAY_CONTRACTS.GATEWAY_WALLET);

    let approveTxHash: string | undefined;
    if (allowance < amountWei) {
      const approveCalldata = usdc.interface.encodeFunctionData('approve', [
        GATEWAY_CONTRACTS.GATEWAY_WALLET,
        amountWei,
      ]);

      // executeTransaction(to, value, data) - returns { hash, userOpHash? }
      const approveResult = await sourceManager.executeTransaction(
        chainInfo.sourceUsdc,
        0n,
        approveCalldata
      );

      approveTxHash = approveResult.hash;
      onProgress?.({ type: 'approving-usdc', txHash: approveTxHash });
      console.log('[Gateway] USDC approved:', approveTxHash);
    }

    // Step 3: Deposit USDC to GatewayWallet
    onProgress?.({ type: 'depositing' });

    const gatewayWallet = new ethers.Contract(
      GATEWAY_CONTRACTS.GATEWAY_WALLET,
      GATEWAY_WALLET_ABI,
      provider
    );

    const depositCalldata = gatewayWallet.interface.encodeFunctionData('deposit', [
      chainInfo.sourceUsdc,
      amountWei,
    ]);

    const depositResult = await sourceManager.executeTransaction(
      GATEWAY_CONTRACTS.GATEWAY_WALLET,
      0n,
      depositCalldata
    );

    const depositTxHash = depositResult.hash;
    onProgress?.({ type: 'depositing', txHash: depositTxHash });
    console.log('[Gateway] Deposited to Gateway:', depositTxHash);

    // Step 4: Execute burn with caller
    onProgress?.({ type: 'signing-burn-intent' });

    const mintRecipient = addressToBytes32(userAddress);
    const destinationCaller = addressToBytes32(GATEWAY_CONTRACTS.GATEWAY_MINTER);
    const maxFee = 0n; // No fee for now

    const burnCalldata = gatewayWallet.interface.encodeFunctionData('burnWithCaller', [
      amountWei,
      chainInfo.sourceUsdc,
      mintRecipient,
      chainInfo.destDomain,
      destinationCaller,
      maxFee,
    ]);

    const burnResult = await sourceManager.executeTransaction(
      GATEWAY_CONTRACTS.GATEWAY_WALLET,
      0n,
      burnCalldata
    );

    const burnTxHash = burnResult.hash;
    console.log('[Gateway] Burn executed:', burnTxHash);

    // Step 5: Request attestation
    onProgress?.({ type: 'requesting-attestation' });

    const attestationResult = await pollAttestation({
      sourceChain: chainInfo.sourceChain,
      burnTxHash,
      maxAttempts: 30, // 30 seconds max for Gateway (should be <1s)
      intervalMs: 500,
    });

    onProgress?.({ type: 'attestation-received', attestation: attestationResult.attestation.slice(0, 20) + '...' });
    console.log('[Gateway] Attestation received');

    // Step 6: Mint on destination chain
    onProgress?.({ type: 'minting' });

    const destManager = direction === 'arc-to-sepolia'
      ? (sepoliaPasskeyManager || passkeyManager)
      : passkeyManager;

    const gatewayMinter = new ethers.Contract(
      GATEWAY_CONTRACTS.GATEWAY_MINTER,
      GATEWAY_MINTER_ABI,
      new ethers.JsonRpcProvider(chainInfo.destRpc)
    );

    const mintCalldata = gatewayMinter.interface.encodeFunctionData('gatewayMint', [
      attestationResult.attestation,
      attestationResult.signature,
    ]);

    const mintResult = await destManager.executeTransaction(
      GATEWAY_CONTRACTS.GATEWAY_MINTER,
      0n,
      mintCalldata
    );

    const mintTxHash = mintResult.hash;
    console.log('[Gateway] Minted on destination:', mintTxHash);

    onProgress?.({
      type: 'completed',
      sourceTxHash: burnTxHash,
      destinationTxHash: mintTxHash,
    });

    return {
      success: true,
      sourceTxHash: burnTxHash,
      destinationTxHash: mintTxHash,
    };

  } catch (error: any) {
    const message = error?.message || 'Gateway transfer failed';
    console.error('[Gateway] Transfer error:', error);
    onProgress?.({ type: 'error', message });
    return { success: false, error: message };
  }
}

/**
 * Estimate Gateway transfer time and fee
 */
export function estimateGatewayTransfer(amount: string, direction: GatewayDirection) {
  // Gateway is nearly instant (<500ms for attestation)
  return {
    estimatedTime: '< 1 minute',
    estimatedTimeMs: 60000, // Conservative estimate
    fee: '0.00', // No fee currently on testnet
    feePercentage: 0,
    netAmount: amount,
  };
}

/**
 * Check if Gateway is available for a chain pair
 */
export function isGatewayAvailable(direction: GatewayDirection): boolean {
  // Gateway supports Arc Testnet <-> Sepolia
  return true;
}
