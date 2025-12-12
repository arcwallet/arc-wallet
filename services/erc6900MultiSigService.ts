/**
 * ERC-6900 Multi-Sig Service
 *
 * Native Circle Modular Wallet multi-sig using WeightedWebauthnMultisigPlugin.
 * This is the enterprise-grade, audited approach for multi-signature wallets.
 *
 * Features:
 * - Weighted signatures (CEO=2, CFO=2, CTO=1, etc.)
 * - Passkey-based signing (WebAuthn P256)
 * - Threshold-based execution
 * - ERC-6900 compliant (audited by Quantstamp)
 */

import { encodeFunctionData, parseAbi, type Hex, type Address } from 'viem';
import { circleWalletService } from './circleWalletService';
import { logger } from './logger';

// ============================================
// ABIs from Circle SDK
// ============================================

const CIRCLE_PLUGIN_ADD_OWNERS_ABI = [
  {
    inputs: [
      { internalType: 'address[]', name: 'ownersToAdd', type: 'address[]' },
      { internalType: 'uint256[]', name: 'weightsToAdd', type: 'uint256[]' },
      {
        components: [
          { internalType: 'uint256', name: 'x', type: 'uint256' },
          { internalType: 'uint256', name: 'y', type: 'uint256' },
        ],
        internalType: 'struct PublicKey[]',
        name: 'publicKeyOwnersToAdd',
        type: 'tuple[]',
      },
      { internalType: 'uint256[]', name: 'publicKeyWeightsToAdd', type: 'uint256[]' },
      { internalType: 'uint256', name: 'newThresholdWeight', type: 'uint256' },
    ],
    name: 'addOwners',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

const CIRCLE_PLUGIN_REMOVE_OWNERS_ABI = [
  {
    inputs: [
      { internalType: 'address[]', name: 'ownersToRemove', type: 'address[]' },
      {
        components: [
          { internalType: 'uint256', name: 'x', type: 'uint256' },
          { internalType: 'uint256', name: 'y', type: 'uint256' },
        ],
        internalType: 'struct PublicKey[]',
        name: 'publicKeyOwnersToRemove',
        type: 'tuple[]',
      },
      { internalType: 'uint256', name: 'newThresholdWeight', type: 'uint256' },
    ],
    name: 'removeOwners',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

const CIRCLE_PLUGIN_UPDATE_WEIGHTS_ABI = [
  {
    inputs: [
      { internalType: 'address[]', name: 'ownersToUpdate', type: 'address[]' },
      { internalType: 'uint256[]', name: 'newWeightsToUpdate', type: 'uint256[]' },
      {
        components: [
          { internalType: 'uint256', name: 'x', type: 'uint256' },
          { internalType: 'uint256', name: 'y', type: 'uint256' },
        ],
        internalType: 'struct PublicKey[]',
        name: 'publicKeyOwnersToUpdate',
        type: 'tuple[]',
      },
      { internalType: 'uint256[]', name: 'publicKeyNewWeightsToUpdate', type: 'uint256[]' },
      { internalType: 'uint256', name: 'newThresholdWeight', type: 'uint256' },
    ],
    name: 'updateMultisigWeights',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

// ============================================
// Types
// ============================================

export interface PublicKeyCoordinates {
  x: bigint;
  y: bigint;
}

export interface WebAuthnOwner {
  publicKey: PublicKeyCoordinates;
  weight: number;
  name?: string;
  email?: string;
  role?: string;
}

export interface EOAOwner {
  address: Address;
  weight: number;
  name?: string;
  email?: string;
  role?: string;
}

export interface MultiSigConfig {
  thresholdWeight: number;
  webAuthnOwners: WebAuthnOwner[];
  eoaOwners?: EOAOwner[];
}

export interface PendingMultiSigTransaction {
  id: string;
  to: Address;
  value: bigint;
  data: Hex;
  description?: string;
  signatures: MultiSigSignature[];
  requiredWeight: number;
  currentWeight: number;
  status: 'pending' | 'ready' | 'executed' | 'rejected';
  createdAt: Date;
  expiresAt: Date;
}

export interface MultiSigSignature {
  ownerId: string;
  ownerType: 'webauthn' | 'eoa';
  weight: number;
  signature: Hex;
  signedAt: Date;
}

// ============================================
// Storage Keys
// ============================================

const STORAGE_KEYS = {
  CONFIG: 'arcwallet_multisig_config',
  PENDING_TXS: 'arcwallet_multisig_pending',
};

// ============================================
// ERC-6900 Multi-Sig Service
// ============================================

class ERC6900MultiSigService {
  private config: MultiSigConfig | null = null;
  private pendingTransactions: Map<string, PendingMultiSigTransaction> = new Map();

  constructor() {
    this.loadFromStorage();
  }

  // ============================================
  // Storage
  // ============================================

  private loadFromStorage(): void {
    try {
      const configStr = localStorage.getItem(STORAGE_KEYS.CONFIG);
      if (configStr) {
        this.config = JSON.parse(configStr);
      }

      const pendingStr = localStorage.getItem(STORAGE_KEYS.PENDING_TXS);
      if (pendingStr) {
        const pending = JSON.parse(pendingStr);
        this.pendingTransactions = new Map(Object.entries(pending));
      }
    } catch (error) {
      logger.error('Failed to load multi-sig config from storage', { error });
    }
  }

  private saveToStorage(): void {
    try {
      if (this.config) {
        localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(this.config));
      }

      const pendingObj = Object.fromEntries(this.pendingTransactions);
      localStorage.setItem(STORAGE_KEYS.PENDING_TXS, JSON.stringify(pendingObj));
    } catch (error) {
      logger.error('Failed to save multi-sig config to storage', { error });
    }
  }

  // ============================================
  // Configuration
  // ============================================

  /**
   * Get current multi-sig configuration
   */
  getConfig(): MultiSigConfig | null {
    return this.config;
  }

  /**
   * Check if wallet has multi-sig enabled
   */
  isMultiSigEnabled(): boolean {
    return this.config !== null && this.config.webAuthnOwners.length > 1;
  }

  /**
   * Get total weight of all owners
   */
  getTotalWeight(): number {
    if (!this.config) return 0;

    const webAuthnWeight = this.config.webAuthnOwners.reduce((sum, o) => sum + o.weight, 0);
    const eoaWeight = this.config.eoaOwners?.reduce((sum, o) => sum + o.weight, 0) || 0;

    return webAuthnWeight + eoaWeight;
  }

  // ============================================
  // Owner Management
  // ============================================

  /**
   * Add new WebAuthn owners to the wallet
   * This calls the addOwners function on the WeightedWebauthnMultisigPlugin
   */
  async addWebAuthnOwners(
    owners: WebAuthnOwner[],
    newThresholdWeight?: number
  ): Promise<string> {
    logger.info('Adding WebAuthn owners', {
      component: 'ERC6900MultiSig',
      ownerCount: owners.length,
    });

    const publicKeyOwners = owners.map((o) => ({
      x: o.publicKey.x,
      y: o.publicKey.y,
    }));
    const weights = owners.map((o) => BigInt(o.weight));
    const threshold = BigInt(newThresholdWeight || 0); // 0 = no change

    const callData = encodeFunctionData({
      abi: CIRCLE_PLUGIN_ADD_OWNERS_ABI,
      functionName: 'addOwners',
      args: [
        [], // No EOA owners
        [], // No EOA weights
        publicKeyOwners,
        weights,
        threshold,
      ],
    });

    // Execute via Circle wallet
    const txHash = await circleWalletService.sendTransaction({
      to: circleWalletService.getState().address as Address,
      value: 0n,
      data: callData,
    });

    // Update local config
    if (this.config) {
      this.config.webAuthnOwners.push(...owners);
      if (newThresholdWeight) {
        this.config.thresholdWeight = newThresholdWeight;
      }
    } else {
      this.config = {
        thresholdWeight: newThresholdWeight || 1,
        webAuthnOwners: owners,
      };
    }
    this.saveToStorage();

    logger.info('WebAuthn owners added', {
      component: 'ERC6900MultiSig',
      txHash,
    });

    return txHash;
  }

  /**
   * Add EOA owners to the wallet
   */
  async addEOAOwners(
    owners: EOAOwner[],
    newThresholdWeight?: number
  ): Promise<string> {
    logger.info('Adding EOA owners', {
      component: 'ERC6900MultiSig',
      ownerCount: owners.length,
    });

    const addresses = owners.map((o) => o.address);
    const weights = owners.map((o) => BigInt(o.weight));
    const threshold = BigInt(newThresholdWeight || 0);

    const callData = encodeFunctionData({
      abi: CIRCLE_PLUGIN_ADD_OWNERS_ABI,
      functionName: 'addOwners',
      args: [
        addresses,
        weights,
        [], // No WebAuthn owners
        [], // No WebAuthn weights
        threshold,
      ],
    });

    const txHash = await circleWalletService.sendTransaction({
      to: circleWalletService.getState().address as Address,
      value: 0n,
      data: callData,
    });

    // Update local config
    if (this.config) {
      this.config.eoaOwners = [...(this.config.eoaOwners || []), ...owners];
      if (newThresholdWeight) {
        this.config.thresholdWeight = newThresholdWeight;
      }
    }
    this.saveToStorage();

    return txHash;
  }

  /**
   * Remove owners from the wallet
   */
  async removeOwners(
    webAuthnOwners: PublicKeyCoordinates[],
    eoaOwners: Address[],
    newThresholdWeight: number
  ): Promise<string> {
    logger.info('Removing owners', {
      component: 'ERC6900MultiSig',
      webAuthnCount: webAuthnOwners.length,
      eoaCount: eoaOwners.length,
    });

    const callData = encodeFunctionData({
      abi: CIRCLE_PLUGIN_REMOVE_OWNERS_ABI,
      functionName: 'removeOwners',
      args: [eoaOwners, webAuthnOwners, BigInt(newThresholdWeight)],
    });

    const txHash = await circleWalletService.sendTransaction({
      to: circleWalletService.getState().address as Address,
      value: 0n,
      data: callData,
    });

    // Update local config
    if (this.config) {
      this.config.webAuthnOwners = this.config.webAuthnOwners.filter(
        (o) => !webAuthnOwners.some((r) => r.x === o.publicKey.x && r.y === o.publicKey.y)
      );
      this.config.eoaOwners = this.config.eoaOwners?.filter(
        (o) => !eoaOwners.includes(o.address)
      );
      this.config.thresholdWeight = newThresholdWeight;
    }
    this.saveToStorage();

    return txHash;
  }

  /**
   * Update owner weights
   */
  async updateWeights(
    webAuthnUpdates: Array<{ publicKey: PublicKeyCoordinates; newWeight: number }>,
    eoaUpdates: Array<{ address: Address; newWeight: number }>,
    newThresholdWeight?: number
  ): Promise<string> {
    logger.info('Updating weights', {
      component: 'ERC6900MultiSig',
      webAuthnCount: webAuthnUpdates.length,
      eoaCount: eoaUpdates.length,
    });

    const callData = encodeFunctionData({
      abi: CIRCLE_PLUGIN_UPDATE_WEIGHTS_ABI,
      functionName: 'updateMultisigWeights',
      args: [
        eoaUpdates.map((u) => u.address),
        eoaUpdates.map((u) => BigInt(u.newWeight)),
        webAuthnUpdates.map((u) => u.publicKey),
        webAuthnUpdates.map((u) => BigInt(u.newWeight)),
        BigInt(newThresholdWeight || 0),
      ],
    });

    const txHash = await circleWalletService.sendTransaction({
      to: circleWalletService.getState().address as Address,
      value: 0n,
      data: callData,
    });

    // Update local config
    if (this.config) {
      webAuthnUpdates.forEach((update) => {
        const owner = this.config!.webAuthnOwners.find(
          (o) => o.publicKey.x === update.publicKey.x && o.publicKey.y === update.publicKey.y
        );
        if (owner) {
          owner.weight = update.newWeight;
        }
      });

      eoaUpdates.forEach((update) => {
        const owner = this.config!.eoaOwners?.find((o) => o.address === update.address);
        if (owner) {
          owner.weight = update.newWeight;
        }
      });

      if (newThresholdWeight) {
        this.config.thresholdWeight = newThresholdWeight;
      }
    }
    this.saveToStorage();

    return txHash;
  }

  // ============================================
  // Transaction Management
  // ============================================

  /**
   * Create a pending multi-sig transaction
   * Other owners need to sign before execution
   */
  createPendingTransaction(params: {
    to: Address;
    value: bigint;
    data: Hex;
    description?: string;
  }): PendingMultiSigTransaction {
    if (!this.config) {
      throw new Error('Multi-sig not configured');
    }

    const id = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000); // 48 hours

    const tx: PendingMultiSigTransaction = {
      id,
      to: params.to,
      value: params.value,
      data: params.data,
      description: params.description,
      signatures: [],
      requiredWeight: this.config.thresholdWeight,
      currentWeight: 0,
      status: 'pending',
      createdAt: now,
      expiresAt,
    };

    this.pendingTransactions.set(id, tx);
    this.saveToStorage();

    logger.info('Pending transaction created', {
      component: 'ERC6900MultiSig',
      txId: id,
      requiredWeight: tx.requiredWeight,
    });

    return tx;
  }

  /**
   * Get all pending transactions
   */
  getPendingTransactions(): PendingMultiSigTransaction[] {
    return Array.from(this.pendingTransactions.values()).filter(
      (tx) => tx.status === 'pending' || tx.status === 'ready'
    );
  }

  /**
   * Get a specific transaction
   */
  getTransaction(id: string): PendingMultiSigTransaction | undefined {
    return this.pendingTransactions.get(id);
  }

  /**
   * Add signature to pending transaction
   */
  addSignature(
    txId: string,
    signature: Omit<MultiSigSignature, 'signedAt'>
  ): PendingMultiSigTransaction {
    const tx = this.pendingTransactions.get(txId);
    if (!tx) {
      throw new Error('Transaction not found');
    }

    if (tx.status !== 'pending') {
      throw new Error('Transaction is not pending');
    }

    // Check if owner already signed
    const alreadySigned = tx.signatures.some((s) => s.ownerId === signature.ownerId);
    if (alreadySigned) {
      throw new Error('Owner already signed this transaction');
    }

    // Add signature
    tx.signatures.push({
      ...signature,
      signedAt: new Date(),
    });

    // Update current weight
    tx.currentWeight = tx.signatures.reduce((sum, s) => sum + s.weight, 0);

    // Check if ready to execute
    if (tx.currentWeight >= tx.requiredWeight) {
      tx.status = 'ready';
    }

    this.pendingTransactions.set(txId, tx);
    this.saveToStorage();

    logger.info('Signature added', {
      component: 'ERC6900MultiSig',
      txId,
      currentWeight: tx.currentWeight,
      requiredWeight: tx.requiredWeight,
      status: tx.status,
    });

    return tx;
  }

  /**
   * Execute a ready transaction
   */
  async executeTransaction(txId: string): Promise<string> {
    const tx = this.pendingTransactions.get(txId);
    if (!tx) {
      throw new Error('Transaction not found');
    }

    if (tx.status !== 'ready') {
      throw new Error('Transaction is not ready for execution');
    }

    logger.info('Executing multi-sig transaction', {
      component: 'ERC6900MultiSig',
      txId,
    });

    // Execute via Circle wallet
    // Note: In a full implementation, signatures would be aggregated and verified on-chain
    const txHash = await circleWalletService.sendTransaction({
      to: tx.to,
      value: tx.value,
      data: tx.data,
    });

    // Update status
    tx.status = 'executed';
    this.pendingTransactions.set(txId, tx);
    this.saveToStorage();

    logger.info('Multi-sig transaction executed', {
      component: 'ERC6900MultiSig',
      txId,
      txHash,
    });

    return txHash;
  }

  /**
   * Reject a pending transaction
   */
  rejectTransaction(txId: string): void {
    const tx = this.pendingTransactions.get(txId);
    if (!tx) {
      throw new Error('Transaction not found');
    }

    tx.status = 'rejected';
    this.pendingTransactions.set(txId, tx);
    this.saveToStorage();

    logger.info('Transaction rejected', {
      component: 'ERC6900MultiSig',
      txId,
    });
  }

  // ============================================
  // Utility
  // ============================================

  /**
   * Initialize multi-sig config from on-chain state
   * TODO: Query contract to get current owners and threshold
   */
  async syncFromChain(): Promise<void> {
    logger.info('Syncing multi-sig config from chain', {
      component: 'ERC6900MultiSig',
    });

    // TODO: Implement contract query for current owners
    // This would call view functions on the WeightedWebauthnMultisigPlugin
  }

  /**
   * Clear all local data
   */
  clear(): void {
    this.config = null;
    this.pendingTransactions.clear();
    localStorage.removeItem(STORAGE_KEYS.CONFIG);
    localStorage.removeItem(STORAGE_KEYS.PENDING_TXS);
  }
}

// Singleton instance
export const erc6900MultiSigService = new ERC6900MultiSigService();
export default erc6900MultiSigService;
