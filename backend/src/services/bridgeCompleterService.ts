/**
 * BridgeCompleterService - Auto-complete CCTP bridge claims
 *
 * This service monitors pending bridge transactions and automatically
 * completes the claim (receiveMessage) on the destination chain when
 * the Circle attestation is ready.
 *
 * ENTERPRISE WALLET APPROACH:
 * - User initiates burn on source chain
 * - Backend monitors Circle attestation API
 * - Backend auto-executes receiveMessage on destination chain
 * - User receives USDC without manual claim
 */

import { ethers, JsonRpcProvider, Wallet, Interface } from 'ethers';

// CCTP V2 Configuration
const CCTP_CONFIG = {
  arc: {
    chainId: 5042002,
    rpcUrl: process.env.ARC_RPC_URL || 'https://rpc.testnet.arc.network',
    messageTransmitter: '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275',
    domain: 26,
  },
  sepolia: {
    chainId: 11155111,
    rpcUrl: process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com',
    messageTransmitter: '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275',
    domain: 0,
  },
};

const ATTESTATION_API = 'https://iris-api-sandbox.circle.com';

const MESSAGE_TRANSMITTER_ABI = [
  'function receiveMessage(bytes message, bytes attestation) returns (bool success)',
  'function usedNonces(bytes32 nonce) view returns (uint256)',
];

interface PendingBridge {
  sourceTxHash: string;
  sourceDomain: number;
  destinationDomain: number;
  recipientAddress: string;
  amount: string;
  createdAt: number;
}

export class BridgeCompleterService {
  private pendingBridges: Map<string, PendingBridge> = new Map();
  private isRunning: boolean = false;
  private checkInterval: NodeJS.Timeout | null = null;
  private arcWallet: Wallet;
  private sepoliaWallet: Wallet;

  constructor() {
    const privateKey = process.env.BUNDLER_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('BUNDLER_PRIVATE_KEY required for BridgeCompleterService');
    }

    // Create wallets for both chains (using bundler key for gas)
    const arcProvider = new JsonRpcProvider(CCTP_CONFIG.arc.rpcUrl);
    const sepoliaProvider = new JsonRpcProvider(CCTP_CONFIG.sepolia.rpcUrl);

    this.arcWallet = new Wallet(privateKey, arcProvider);
    this.sepoliaWallet = new Wallet(privateKey, sepoliaProvider);

    console.log('[BridgeCompleter] Initialized with completer address:', this.arcWallet.address);
  }

  /**
   * Start the bridge completer service
   */
  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    console.log('[BridgeCompleter] Service started');

    // Check pending bridges every 30 seconds
    this.checkInterval = setInterval(() => this.checkPendingBridges(), 30000);
  }

  /**
   * Stop the service
   */
  stop(): void {
    this.isRunning = false;
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    console.log('[BridgeCompleter] Service stopped');
  }

  /**
   * Register a bridge transaction for auto-completion
   */
  registerBridge(params: {
    sourceTxHash: string;
    direction: 'arc-to-sepolia' | 'sepolia-to-arc';
    recipientAddress: string;
    amount: string;
  }): void {
    const { sourceTxHash, direction, recipientAddress, amount } = params;

    const sourceDomain = direction === 'arc-to-sepolia' ? CCTP_CONFIG.arc.domain : CCTP_CONFIG.sepolia.domain;
    const destinationDomain = direction === 'arc-to-sepolia' ? CCTP_CONFIG.sepolia.domain : CCTP_CONFIG.arc.domain;

    this.pendingBridges.set(sourceTxHash, {
      sourceTxHash,
      sourceDomain,
      destinationDomain,
      recipientAddress,
      amount,
      createdAt: Date.now(),
    });

    console.log(`[BridgeCompleter] Registered bridge: ${sourceTxHash} (${direction})`);

    // Immediately check this bridge
    this.checkBridge(sourceTxHash);
  }

  /**
   * Check all pending bridges for attestation
   */
  private async checkPendingBridges(): Promise<void> {
    for (const [txHash] of this.pendingBridges) {
      await this.checkBridge(txHash);
    }
  }

  /**
   * Check a single bridge for attestation and complete if ready
   */
  private async checkBridge(sourceTxHash: string): Promise<void> {
    const bridge = this.pendingBridges.get(sourceTxHash);
    if (!bridge) return;

    try {
      // Check attestation status
      const response = await fetch(
        `${ATTESTATION_API}/v2/messages/${bridge.sourceDomain}?transactionHash=${sourceTxHash}`
      );

      if (!response.ok) {
        console.log(`[BridgeCompleter] Attestation not ready for ${sourceTxHash.slice(0, 10)}...`);
        return;
      }

      const data = await response.json();

      if (!data.messages || data.messages.length === 0) {
        console.log(`[BridgeCompleter] No messages found for ${sourceTxHash.slice(0, 10)}...`);
        return;
      }

      const msg = data.messages[0];

      if (msg.status !== 'complete' || !msg.attestation) {
        console.log(`[BridgeCompleter] Attestation pending for ${sourceTxHash.slice(0, 10)}... status: ${msg.status}`);
        return;
      }

      console.log(`[BridgeCompleter] Attestation ready! Completing bridge for ${sourceTxHash.slice(0, 10)}...`);

      // Complete the bridge on destination chain
      await this.completeBridge(bridge, msg.message, msg.attestation);

      // Remove from pending
      this.pendingBridges.delete(sourceTxHash);

    } catch (error: any) {
      console.error(`[BridgeCompleter] Error checking bridge ${sourceTxHash.slice(0, 10)}:`, error.message);
    }
  }

  /**
   * Complete bridge by calling receiveMessage on destination chain
   */
  private async completeBridge(
    bridge: PendingBridge,
    message: string,
    attestation: string
  ): Promise<string> {
    // Determine destination chain
    const isToSepolia = bridge.destinationDomain === CCTP_CONFIG.sepolia.domain;
    const destConfig = isToSepolia ? CCTP_CONFIG.sepolia : CCTP_CONFIG.arc;
    const wallet = isToSepolia ? this.sepoliaWallet : this.arcWallet;

    console.log(`[BridgeCompleter] Executing receiveMessage on ${isToSepolia ? 'Sepolia' : 'Arc'}...`);

    const messageTransmitter = new ethers.Contract(
      destConfig.messageTransmitter,
      MESSAGE_TRANSMITTER_ABI,
      wallet
    );

    // Execute receiveMessage
    const tx = await messageTransmitter.receiveMessage(message, attestation, {
      gasLimit: 500000n,
    });

    console.log(`[BridgeCompleter] Claim tx submitted: ${tx.hash}`);

    const receipt = await tx.wait();
    console.log(`[BridgeCompleter] Claim confirmed in block ${receipt?.blockNumber}`);

    return tx.hash;
  }

  /**
   * Manually complete a bridge (for recovery/admin)
   */
  async manualComplete(sourceTxHash: string, sourceDomain: number): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      // Fetch attestation
      const response = await fetch(
        `${ATTESTATION_API}/v2/messages/${sourceDomain}?transactionHash=${sourceTxHash}`
      );

      if (!response.ok) {
        return { success: false, error: 'Attestation not available' };
      }

      const data = await response.json();

      if (!data.messages || data.messages.length === 0) {
        return { success: false, error: 'No messages found for this transaction' };
      }

      const msg = data.messages[0];

      if (msg.status !== 'complete' || !msg.attestation) {
        return { success: false, error: `Attestation not ready. Status: ${msg.status}` };
      }

      // Determine destination from message
      const destDomain = msg.decodedMessage?.destinationDomain;
      const isToSepolia = destDomain === '0' || destDomain === 0;

      // Get recipient from decoded message
      const recipientAddress = msg.decodedMessage?.decodedMessageBody?.mintRecipient;

      const bridge: PendingBridge = {
        sourceTxHash,
        sourceDomain,
        destinationDomain: isToSepolia ? 0 : 26,
        recipientAddress: recipientAddress || '',
        amount: msg.decodedMessage?.decodedMessageBody?.amount || '0',
        createdAt: Date.now(),
      };

      const txHash = await this.completeBridge(bridge, msg.message, msg.attestation);

      return { success: true, txHash };

    } catch (error: any) {
      console.error('[BridgeCompleter] Manual complete error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get service status
   */
  getStatus(): { isRunning: boolean; pendingCount: number; completerAddress: string } {
    return {
      isRunning: this.isRunning,
      pendingCount: this.pendingBridges.size,
      completerAddress: this.arcWallet.address,
    };
  }
}

// Singleton instance
let bridgeCompleterInstance: BridgeCompleterService | null = null;

export function getBridgeCompleterService(): BridgeCompleterService {
  if (!bridgeCompleterInstance) {
    bridgeCompleterInstance = new BridgeCompleterService();
  }
  return bridgeCompleterInstance;
}
