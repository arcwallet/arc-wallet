/**
 * PasskeyBridgeService - CCTP Bridge for PasskeyAccount Smart Wallet
 *
 * This service enables cross-chain USDC transfers using Circle's CCTP protocol
 * with PasskeyAccount (ERC-4337) smart wallet architecture.
 *
 * Key differences from legacy bridgeService:
 * - NO private key required
 * - Uses PasskeyAccountManager.executeTransaction() for UserOperations
 * - Signs with WebAuthn/P256 passkey
 * - Works with ERC-4337 bundler (Pimlico)
 */

import { Interface, parseUnits, JsonRpcProvider, getAddress } from 'ethers';
import type { PasskeyAccountManager } from '@arc/wallet-sdk';

// Arc Testnet CCTP Configuration (from docs.arc.network)
const ARC_TESTNET_CONFIG = {
  chainId: 5042002,
  rpcUrl: 'https://rpc.testnet.arc.network',
  tokenMessenger: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
  messageTransmitter: '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275',
  usdc: '0x3600000000000000000000000000000000000000',
  domain: 26,
};

// Sepolia CCTP V2 Configuration (same addresses as Arc - Circle uses deterministic deployment)
const SEPOLIA_CONFIG = {
  chainId: 11155111,
  rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
  tokenMessenger: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA', // TokenMessengerV2
  messageTransmitter: '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275', // MessageTransmitterV2
  usdc: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
  domain: 0,
};

// Circle Attestation API
const ATTESTATION_API = 'https://iris-api-sandbox.circle.com';

// ABIs for CCTP V2 contracts (Arc Testnet and Sepolia both use V2)
const TOKEN_MESSENGER_V2_ABI = [
  // V2 depositForBurn has 7 parameters (3 more than V1)
  'function depositForBurn(uint256 amount, uint32 destinationDomain, bytes32 mintRecipient, address burnToken, bytes32 destinationCaller, uint256 maxFee, uint32 minFinalityThreshold) external returns (uint64 nonce)',
];

const MESSAGE_TRANSMITTER_V2_ABI = [
  'function receiveMessage(bytes message, bytes attestation) returns (bool success)',
];

const USDC_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
];

export type BridgeDirection = 'arc-to-sepolia' | 'sepolia-to-arc';

export interface PasskeyBridgeParams {
  passkeyManager: PasskeyAccountManager;
  sepoliaPasskeyManager?: PasskeyAccountManager; // Optional: for Sepolia→Arc direction
  amount: string; // Human readable (e.g., "100" for 100 USDC)
  direction: BridgeDirection;
  recipientAddress?: string; // Optional: defaults to sender address
  senderAddressOverride?: string; // Optional: override sender address for balance checks (when cross-chain factories differ)
  onProgress?: (step: BridgeProgressStep) => void;
}

export type BridgeProgressStep =
  | { type: 'checking-balance' }
  | { type: 'approving-usdc'; txHash?: string }
  | { type: 'burning-usdc'; txHash?: string }
  | { type: 'waiting-attestation'; messageHash?: string }
  | { type: 'attestation-received'; attestation?: string }
  | { type: 'minting-usdc'; txHash?: string }
  | { type: 'completed'; sourceTxHash?: string; destinationTxHash?: string }
  | { type: 'error'; message: string };

export interface BridgeResult {
  success: boolean;
  sourceTxHash?: string;
  destinationTxHash?: string;
  messageHash?: string;
  error?: string;
}

/**
 * Bridge USDC using PasskeyAccount smart wallet
 * Executes approve + depositForBurn as UserOperations signed with passkey
 */
export async function bridgeUsdcWithPasskey(params: PasskeyBridgeParams): Promise<BridgeResult> {
  const { passkeyManager, sepoliaPasskeyManager, amount, direction, recipientAddress, senderAddressOverride, onProgress } = params;

  const sourceConfig = direction === 'arc-to-sepolia' ? ARC_TESTNET_CONFIG : SEPOLIA_CONFIG;
  const destConfig = direction === 'arc-to-sepolia' ? SEPOLIA_CONFIG : ARC_TESTNET_CONFIG;

  // For sepolia-to-arc, we need a Sepolia-configured PasskeyManager for burn operations
  const sourceManager = direction === 'sepolia-to-arc' && sepoliaPasskeyManager
    ? sepoliaPasskeyManager
    : passkeyManager;
  const destManager = passkeyManager; // Arc manager is always used for Arc operations

  // Get sender address - use override if provided (for cross-chain factory address mismatch)
  // This allows balance checks on the actual EOA/smart wallet address where funds are
  const senderAddress = senderAddressOverride || sourceManager.getAccountAddress();
  if (!senderAddress) {
    throw new Error('PasskeyAccount not connected. Please connect first.');
  }

  const recipient = recipientAddress || senderAddress;
  const amountWei = parseUnits(amount, 6); // USDC has 6 decimals

  console.log('[PasskeyBridge] Starting bridge:', {
    direction,
    amount,
    amountWei: amountWei.toString(),
    from: senderAddress,
    to: recipient,
    sourceChain: sourceConfig.chainId,
    destChain: destConfig.chainId,
  });

  try {
    // Step 1: Check balance
    onProgress?.({ type: 'checking-balance' });
    const provider = new JsonRpcProvider(sourceConfig.rpcUrl);
    const usdcInterface = new Interface(USDC_ABI);

    const balanceData = usdcInterface.encodeFunctionData('balanceOf', [senderAddress]);
    const balanceResult = await provider.call({
      to: sourceConfig.usdc,
      data: balanceData,
    });
    const balance = BigInt(balanceResult);

    if (balance < amountWei) {
      throw new Error(`Insufficient USDC balance. Have: ${Number(balance) / 1e6}, Need: ${amount}`);
    }

    console.log('[PasskeyBridge] Balance check passed:', {
      balance: Number(balance) / 1e6,
      required: amount,
    });

    // Step 2: Check allowance and approve if needed
    const allowanceData = usdcInterface.encodeFunctionData('allowance', [senderAddress, sourceConfig.tokenMessenger]);
    const allowanceResult = await provider.call({
      to: sourceConfig.usdc,
      data: allowanceData,
    });
    const currentAllowance = BigInt(allowanceResult);

    if (currentAllowance < amountWei) {
      console.log('[PasskeyBridge] Approving USDC...');
      onProgress?.({ type: 'approving-usdc' });

      // Encode approve call
      const approveData = usdcInterface.encodeFunctionData('approve', [
        sourceConfig.tokenMessenger,
        amountWei,
      ]);

      // Execute approve via PasskeyAccount (UserOperation)
      const approveResult = await sourceManager.executeTransaction(
        sourceConfig.usdc,
        0n, // No native value
        approveData
      );

      console.log('[PasskeyBridge] USDC approved:', approveResult.hash);
      onProgress?.({ type: 'approving-usdc', txHash: approveResult.hash });
    }

    // Step 3: Call depositForBurn on TokenMessengerV2
    console.log('[PasskeyBridge] Burning USDC...');
    onProgress?.({ type: 'burning-usdc' });

    const tokenMessengerInterface = new Interface(TOKEN_MESSENGER_V2_ABI);

    // Convert recipient address to bytes32 (left-padded)
    const mintRecipient = addressToBytes32(recipient);

    // CCTP V2 new parameters:
    // - destinationCaller: bytes32(0) allows anyone to call receiveMessage on destination
    // - maxFee: 0 for no fee (can be calculated as feeRate * amount in basis points)
    // - minFinalityThreshold: 1000 or less for Fast Transfer mode
    const destinationCaller = '0x0000000000000000000000000000000000000000000000000000000000000000';
    const maxFee = 0n;
    const minFinalityThreshold = 1000; // Fast Transfer mode

    const depositForBurnData = tokenMessengerInterface.encodeFunctionData('depositForBurn', [
      amountWei,
      destConfig.domain,
      mintRecipient,
      sourceConfig.usdc,
      destinationCaller,
      maxFee,
      minFinalityThreshold,
    ]);

    // Execute depositForBurn via PasskeyAccount (UserOperation)
    const burnResult = await sourceManager.executeTransaction(
      sourceConfig.tokenMessenger,
      0n,
      depositForBurnData
    );

    console.log('[PasskeyBridge] USDC burned:', burnResult.hash);
    onProgress?.({ type: 'burning-usdc', txHash: burnResult.hash });

    // Step 4: Wait for attestation from Circle (V2 API uses txHash instead of messageHash)
    console.log('[PasskeyBridge] Waiting for attestation...');
    onProgress?.({ type: 'waiting-attestation', messageHash: burnResult.hash });

    const { attestation, message } = await waitForAttestationV2(burnResult.hash, sourceConfig.domain);
    console.log('[PasskeyBridge] Attestation received');
    onProgress?.({ type: 'attestation-received', attestation });

    // Step 6: Call receiveMessage on destination chain
    // Note: For Arc -> Sepolia, user needs to execute on Sepolia (different chain)
    // For now, we'll return the attestation and let the user complete on destination
    console.log('[PasskeyBridge] Bridge deposit complete. Attestation ready for destination claim.');

    // If going TO Arc Testnet, we can complete it via PasskeyAccount
    if (direction === 'sepolia-to-arc') {
      console.log('[PasskeyBridge] Completing on Arc Testnet...');
      onProgress?.({ type: 'minting-usdc' });

      const messageTransmitterInterface = new Interface(MESSAGE_TRANSMITTER_V2_ABI);
      const receiveMessageData = messageTransmitterInterface.encodeFunctionData('receiveMessage', [
        message,
        attestation,
      ]);

      const mintResult = await destManager.executeTransaction(
        destConfig.messageTransmitter,
        0n,
        receiveMessageData
      );

      console.log('[PasskeyBridge] USDC minted on Arc:', mintResult.hash);
      onProgress?.({ type: 'completed', sourceTxHash: burnResult.hash, destinationTxHash: mintResult.hash });

      return {
        success: true,
        sourceTxHash: burnResult.hash,
        destinationTxHash: mintResult.hash,
      };
    }

    // For Arc -> Sepolia, user needs to complete on Sepolia manually or via different wallet
    onProgress?.({ type: 'completed', sourceTxHash: burnResult.hash });

    return {
      success: true,
      sourceTxHash: burnResult.hash,
      // destinationTxHash will be completed on Sepolia
    };

  } catch (error: any) {
    console.error('[PasskeyBridge] Error:', error);
    onProgress?.({ type: 'error', message: error.message });

    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Convert Ethereum address to bytes32 format for CCTP
 */
function addressToBytes32(address: string): string {
  const cleanAddress = address.toLowerCase().replace('0x', '');
  return '0x' + cleanAddress.padStart(64, '0');
}

/**
 * Wait for Circle attestation service to provide attestation (CCTP V2 API)
 * V2 uses /v2/messages/{domain}?transactionHash={txHash} instead of /attestations/{messageHash}
 */
async function waitForAttestationV2(
  txHash: string,
  sourceDomain: number,
  maxRetries = 120,
  interval = 3000 // 3 seconds (faster polling since V2 attestation is usually quick)
): Promise<{ attestation: string; message: string }> {

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(
        `${ATTESTATION_API}/v2/messages/${sourceDomain}?transactionHash=${txHash}`
      );

      if (response.ok) {
        const data = await response.json();

        // V2 returns { messages: [...] } array
        if (data.messages && data.messages.length > 0) {
          const msg = data.messages[0];
          if (msg.status === 'complete' && msg.attestation) {
            return {
              attestation: msg.attestation,
              message: msg.message,
            };
          }
        }
      }
    } catch (error) {
      console.warn('[PasskeyBridge] Attestation check failed, retrying...', error);
    }

    // Wait before next retry
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error('Attestation timeout. Please try again later.');
}

/**
 * Get USDC balance on specified chain
 */
export async function getUsdcBalance(
  address: string,
  chain: 'arc' | 'sepolia'
): Promise<string> {
  try {
    const config = chain === 'arc' ? ARC_TESTNET_CONFIG : SEPOLIA_CONFIG;
    console.log(`[Bridge] getUsdcBalance called for ${chain}:`, {
      address,
      rpcUrl: config.rpcUrl,
      usdcContract: config.usdc,
    });

    const provider = new JsonRpcProvider(config.rpcUrl);

    // Normalize address to checksum format
    const checksumAddress = getAddress(address.toLowerCase());
    console.log(`[Bridge] Checksum address:`, checksumAddress);

    const usdcInterface = new Interface(USDC_ABI);
    const balanceData = usdcInterface.encodeFunctionData('balanceOf', [checksumAddress]);
    console.log(`[Bridge] Encoded balanceOf data:`, balanceData.slice(0, 20) + '...');

    const result = await provider.call({
      to: config.usdc,
      data: balanceData,
    });
    console.log(`[Bridge] Raw RPC result for ${chain}:`, result);

    const balance = BigInt(result);
    const formatted = (Number(balance) / 1e6).toFixed(2);
    console.log(`[Bridge] ${chain} USDC balance:`, formatted);
    return formatted;
  } catch (error: any) {
    console.error(`[Bridge] Error fetching ${chain} USDC balance:`, error.message || error);
    // Return 0 on error instead of throwing
    return '0.00';
  }
}

/**
 * Estimate bridge time
 */
export function estimateBridgeTime(direction: BridgeDirection): string {
  // CCTP attestation typically takes 10-20 minutes
  return '10-20 minutes';
}

export { ARC_TESTNET_CONFIG, SEPOLIA_CONFIG };
