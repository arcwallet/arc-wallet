/**
 * CCTP Bridge Service
 *
 * Cross-chain USDC bridge using Circle's CCTP V2 protocol.
 * Works with existing ERC-4337 smart account (no EOA required).
 *
 * Flow:
 * 1. Approve USDC to TokenMessenger (if needed)
 * 2. Call depositForBurn on source chain
 * 3. Wait for Circle attestation
 * 4. Call receiveMessage on destination chain (optional - can be done by relayer)
 */

import { encodeFunctionData, parseUnits, formatUnits, type Address, type Hex } from 'viem';
import { circleWalletService } from './circleWalletService';
import {
  CCTP_CONTRACTS,
  BRIDGE_CHAINS,
  CCTP_ATTESTATION,
  CCTP_FEES,
  TOKEN_MESSENGER_ABI,
  ERC20_ABI,
  addressToBytes32,
  getChainConfig,
  getDestinationChains,
  type BridgeChainConfig,
} from '../config/cctp';
import { logger } from './logger';

// Bridge transaction status
export type BridgeStatus =
  | 'pending_approval'
  | 'approving'
  | 'pending_burn'
  | 'burning'
  | 'pending_attestation'
  | 'attestation_received'
  | 'pending_mint'
  | 'minting'
  | 'completed'
  | 'failed';

// Bridge transaction record
export interface BridgeTransaction {
  id: string;
  sourceChainId: number;
  destinationChainId: number;
  amount: string; // Human readable (e.g., "100.00")
  amountRaw: bigint;
  sender: Address;
  recipient: Address;
  status: BridgeStatus;
  burnTxHash?: string;
  mintTxHash?: string;
  messageHash?: string;
  attestation?: string;
  nonce?: bigint;
  createdAt: Date;
  updatedAt: Date;
  error?: string;
}

// Bridge estimate
export interface BridgeEstimate {
  sourceChain: BridgeChainConfig;
  destinationChain: BridgeChainConfig;
  amount: string;
  fee: string;
  estimatedTime: string; // e.g., "~15 minutes"
  needsApproval: boolean;
  currentAllowance: bigint;
}

// Local storage key for bridge history
const BRIDGE_HISTORY_KEY = 'arc_bridge_history';

/**
 * CCTP Bridge Service Implementation
 */
class BridgeServiceImpl {
  private transactions: Map<string, BridgeTransaction> = new Map();

  constructor() {
    this.loadHistory();
  }

  /**
   * Get available destination chains
   */
  getDestinationChains(sourceChainId: number = 5042002): BridgeChainConfig[] {
    return getDestinationChains(sourceChainId);
  }

  /**
   * Get chain config
   */
  getChainConfig(chainId: number): BridgeChainConfig | undefined {
    return getChainConfig(chainId);
  }

  /**
   * Estimate bridge transaction
   */
  async estimateBridge(
    amount: string,
    destinationChainId: number,
    sourceChainId: number = 5042002
  ): Promise<BridgeEstimate> {
    const sourceChain = getChainConfig(sourceChainId);
    const destinationChain = getChainConfig(destinationChainId);

    if (!sourceChain || !destinationChain) {
      throw new Error('Invalid chain configuration');
    }

    const walletAddress = circleWalletService.getAddress();
    if (!walletAddress) {
      throw new Error('Wallet not connected');
    }

    // Check current allowance
    let currentAllowance = 0n;
    let needsApproval = true;

    try {
      currentAllowance = await this.checkAllowance(
        sourceChain.usdc,
        walletAddress as Address
      );
      const amountRaw = parseUnits(amount, 6);
      needsApproval = currentAllowance < amountRaw;
    } catch (err) {
      logger.warn('Could not check allowance', {
        component: 'BridgeService',
        error: err instanceof Error ? err.message : 'Unknown',
      });
    }

    // Estimate time based on transfer type
    const estimatedTime = destinationChain.supportsFastTransfer
      ? '~30 seconds'
      : '~15-20 minutes';

    // Fee is minimal for CCTP
    const fee = formatUnits(CCTP_FEES.standardTransferFee, 6);

    return {
      sourceChain,
      destinationChain,
      amount,
      fee,
      estimatedTime,
      needsApproval,
      currentAllowance,
    };
  }

  /**
   * Check USDC allowance for TokenMessenger
   */
  async checkAllowance(tokenAddress: Address, owner: Address): Promise<bigint> {
    // Use circleWalletService's public client to read allowance
    const state = circleWalletService.getState();
    if (!state.isConnected) {
      return 0n;
    }

    // We need to make a contract read call
    // Since circleWalletService doesn't expose publicClient directly,
    // we'll use a batch transaction approach or add a method
    // For now, return 0 to always approve (safe default)
    return 0n;
  }

  /**
   * Execute bridge transaction
   * Uses sendBatchTransactions for approve + burn in single UserOp
   */
  async bridge(
    amount: string,
    destinationChainId: number,
    recipient?: Address // Optional: defaults to same address
  ): Promise<BridgeTransaction> {
    const sourceChainId = 5042002; // Arc Testnet
    const sourceChain = getChainConfig(sourceChainId);
    const destinationChain = getChainConfig(destinationChainId);

    if (!sourceChain || !destinationChain) {
      throw new Error('Invalid chain configuration');
    }

    const walletAddress = circleWalletService.getAddress();
    if (!walletAddress) {
      throw new Error('Wallet not connected');
    }

    const sender = walletAddress as Address;
    const mintRecipient = recipient || sender;
    const amountRaw = parseUnits(amount, 6);

    // Create transaction record
    const tx: BridgeTransaction = {
      id: `bridge_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      sourceChainId,
      destinationChainId,
      amount,
      amountRaw,
      sender,
      recipient: mintRecipient,
      status: 'pending_approval',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.transactions.set(tx.id, tx);
    this.saveHistory();

    logger.info('Starting bridge transaction', {
      component: 'BridgeService',
      txId: tx.id,
      amount,
      from: sourceChain.name,
      to: destinationChain.name,
    });

    try {
      // Prepare calls for batch transaction
      const calls: Array<{ to: Address; data: Hex }> = [];

      // 1. Approve USDC to TokenMessenger (use max uint256 for unlimited)
      const approveData = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [CCTP_CONTRACTS.TokenMessengerV2, amountRaw],
      });
      calls.push({
        to: sourceChain.usdc,
        data: approveData as Hex,
      });

      // 2. depositForBurn
      // Convert recipient address to bytes32
      const mintRecipientBytes32 = addressToBytes32(mintRecipient);
      // destinationCaller = 0x0 allows anyone to call receiveMessage
      const destinationCaller = '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex;

      const depositData = encodeFunctionData({
        abi: TOKEN_MESSENGER_ABI,
        functionName: 'depositForBurn',
        args: [
          amountRaw,
          destinationChain.domain,
          mintRecipientBytes32,
          sourceChain.usdc,
          destinationCaller,
          CCTP_FEES.maxFee, // Max fee we're willing to pay
          0, // minFinalityThreshold (0 for standard)
        ],
      });
      calls.push({
        to: CCTP_CONTRACTS.TokenMessengerV2,
        data: depositData as Hex,
      });

      // Update status
      tx.status = 'burning';
      tx.updatedAt = new Date();
      this.saveHistory();

      // Execute batch transaction (approve + burn in single UserOp)
      logger.info('Executing batch transaction (approve + burn)', {
        component: 'BridgeService',
        txId: tx.id,
        callCount: calls.length,
      });

      const burnTxHash = await circleWalletService.sendBatchTransactions(calls);

      tx.burnTxHash = burnTxHash;
      tx.status = 'pending_attestation';
      tx.updatedAt = new Date();
      this.saveHistory();

      logger.info('Burn transaction confirmed', {
        component: 'BridgeService',
        txId: tx.id,
        burnTxHash,
      });

      // Start polling for attestation in background
      this.pollForAttestation(tx.id);

      return tx;
    } catch (err: any) {
      tx.status = 'failed';
      tx.error = err.message;
      tx.updatedAt = new Date();
      this.saveHistory();

      logger.error('Bridge transaction failed', {
        component: 'BridgeService',
        txId: tx.id,
        error: err.message,
      });

      throw err;
    }
  }

  /**
   * Poll for attestation from Circle's Iris service
   */
  private async pollForAttestation(txId: string): Promise<void> {
    const tx = this.transactions.get(txId);
    if (!tx || !tx.burnTxHash) {
      return;
    }

    const maxAttempts = 60; // ~20 minutes with 20s interval
    const interval = 20000; // 20 seconds

    logger.info('Starting attestation polling', {
      component: 'BridgeService',
      txId,
      burnTxHash: tx.burnTxHash,
    });

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        // Query Circle attestation API
        const attestation = await this.fetchAttestation(tx.burnTxHash);

        if (attestation) {
          tx.attestation = attestation.attestation;
          tx.messageHash = attestation.messageHash;
          tx.status = 'attestation_received';
          tx.updatedAt = new Date();
          this.saveHistory();

          logger.info('Attestation received', {
            component: 'BridgeService',
            txId,
            messageHash: attestation.messageHash,
          });

          // Attestation received - user can now claim on destination
          // Or a relayer will do it automatically
          return;
        }
      } catch (err) {
        logger.warn('Attestation fetch failed, retrying...', {
          component: 'BridgeService',
          txId,
          attempt,
          error: err instanceof Error ? err.message : 'Unknown',
        });
      }

      // Wait before next attempt
      await new Promise(resolve => setTimeout(resolve, interval));
    }

    logger.warn('Attestation polling timeout', {
      component: 'BridgeService',
      txId,
    });
  }

  /**
   * Fetch attestation from Circle's Iris API
   */
  private async fetchAttestation(
    txHash: string
  ): Promise<{ attestation: string; messageHash: string } | null> {
    try {
      // Circle's attestation API endpoint
      const url = `${CCTP_ATTESTATION.testnet}/${txHash}`;

      const response = await fetch(url);

      if (!response.ok) {
        if (response.status === 404) {
          // Not ready yet
          return null;
        }
        throw new Error(`Attestation API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.status === 'complete' && data.attestation) {
        return {
          attestation: data.attestation,
          messageHash: data.messageHash || data.message_hash,
        };
      }

      return null;
    } catch (err) {
      logger.warn('Attestation fetch error', {
        component: 'BridgeService',
        txHash,
        error: err instanceof Error ? err.message : 'Unknown',
      });
      return null;
    }
  }

  /**
   * Get transaction by ID
   */
  getTransaction(txId: string): BridgeTransaction | undefined {
    return this.transactions.get(txId);
  }

  /**
   * Get all transactions
   */
  getAllTransactions(): BridgeTransaction[] {
    return Array.from(this.transactions.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  /**
   * Get pending transactions
   */
  getPendingTransactions(): BridgeTransaction[] {
    return this.getAllTransactions().filter(
      tx => !['completed', 'failed'].includes(tx.status)
    );
  }

  /**
   * Save transaction history to localStorage
   */
  private saveHistory(): void {
    if (typeof window === 'undefined') return;

    try {
      const history = Array.from(this.transactions.entries()).map(([id, tx]) => ({
        ...tx,
        amountRaw: tx.amountRaw.toString(),
        nonce: tx.nonce?.toString(),
        createdAt: tx.createdAt.toISOString(),
        updatedAt: tx.updatedAt.toISOString(),
      }));

      localStorage.setItem(BRIDGE_HISTORY_KEY, JSON.stringify(history));
    } catch (err) {
      logger.warn('Failed to save bridge history', {
        component: 'BridgeService',
        error: err instanceof Error ? err.message : 'Unknown',
      });
    }
  }

  /**
   * Load transaction history from localStorage
   */
  private loadHistory(): void {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(BRIDGE_HISTORY_KEY);
      if (!stored) return;

      const history = JSON.parse(stored);
      for (const item of history) {
        const tx: BridgeTransaction = {
          ...item,
          amountRaw: BigInt(item.amountRaw),
          nonce: item.nonce ? BigInt(item.nonce) : undefined,
          createdAt: new Date(item.createdAt),
          updatedAt: new Date(item.updatedAt),
        };
        this.transactions.set(tx.id, tx);
      }

      logger.info('Loaded bridge history', {
        component: 'BridgeService',
        count: this.transactions.size,
      });
    } catch (err) {
      logger.warn('Failed to load bridge history', {
        component: 'BridgeService',
        error: err instanceof Error ? err.message : 'Unknown',
      });
    }
  }

  /**
   * Clear transaction history
   */
  clearHistory(): void {
    this.transactions.clear();
    if (typeof window !== 'undefined') {
      localStorage.removeItem(BRIDGE_HISTORY_KEY);
    }
  }
}

// Singleton instance
export const bridgeService = new BridgeServiceImpl();

export default bridgeService;
