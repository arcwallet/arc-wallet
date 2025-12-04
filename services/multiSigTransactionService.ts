/**
 * Multi-Signature Transaction Service
 * Handles 2-of-3 signature collection for corporate wallet transactions
 *
 * Flow:
 * 1. First signer creates a pending transaction
 * 2. Other signers approve the pending transaction
 * 3. When threshold is reached, transaction executes
 */

import { Contract, JsonRpcProvider, keccak256, AbiCoder } from 'ethers';
import { startAuthentication } from '@simplewebauthn/browser';
import type {
  PublicKeyCredentialRequestOptionsJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/types';
import { logger } from './logger';

export interface PendingMultiSigTx {
  id: string;
  opHash: string;
  walletAddress: string;
  type: 'transfer' | 'subscribe' | 'redeem' | 'addKey' | 'removeKey' | 'setThreshold';
  description: string;
  amount?: string;
  token?: string;
  to?: string;
  callData: string;
  requiredSignatures: number;
  currentSignatures: number;
  signatures: MultiSigSignature[];
  createdAt: Date;
  expiresAt: Date;
  status: 'pending' | 'ready' | 'executed' | 'expired' | 'cancelled';
  initiator: string; // keyHash of initiator
}

export interface MultiSigSignature {
  keyHash: string;
  deviceName: string;
  role: string;
  signature: string;
  signedAt: Date;
}

export interface MultiSigConfig {
  rpcUrl: string;
  backendUrl: string;
  entryPointAddress: string;
  chainId?: number;
}

// Storage key for pending transactions
const PENDING_TX_KEY = 'arcwallet:pendingMultiSigTx';

// ArcAccount ABI for multi-sig
const MULTI_SIG_ABI = [
  'function signatureThreshold() view returns (uint8)',
  'function proposeOperation(bytes32 opHash, uint8 keySlot, bytes signature)',
  'function approveOperation(bytes32 opHash, uint8 keySlot, bytes signature)',
  'function canExecuteOperation(bytes32 opHash) view returns (bool)',
  'function getPendingOperation(bytes32 opHash) view returns (uint8 signatureCount, uint8 requiredSignatures, uint40 createdAt, uint40 expiresAt, bool executed)',
  'function execute(address target, uint256 value, bytes data) returns (bytes)',
];

export class MultiSigTransactionService {
  private provider: JsonRpcProvider;
  private config: MultiSigConfig;

  constructor(config: MultiSigConfig) {
    this.config = config;
    this.provider = new JsonRpcProvider(config.rpcUrl);
  }

  /**
   * Create a new pending multi-sig transaction
   */
  async createPendingTransaction(
    walletAddress: string,
    type: PendingMultiSigTx['type'],
    description: string,
    callData: string,
    initiatorKeyHash: string,
    initiatorDeviceName: string,
    initiatorRole: string,
    additionalData?: {
      amount?: string;
      token?: string;
      to?: string;
    }
  ): Promise<PendingMultiSigTx> {
    // Get required signatures from contract
    const contract = new Contract(walletAddress, MULTI_SIG_ABI, this.provider);
    const requiredSigs = await contract.signatureThreshold();

    // Generate operation hash
    const opHash = this.generateOpHash(walletAddress, callData);

    // Create pending transaction
    const pendingTx: PendingMultiSigTx = {
      id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      opHash,
      walletAddress,
      type,
      description,
      amount: additionalData?.amount,
      token: additionalData?.token,
      to: additionalData?.to,
      callData,
      requiredSignatures: Number(requiredSigs),
      currentSignatures: 0,
      signatures: [],
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      status: 'pending',
      initiator: initiatorKeyHash,
    };

    // Save to local storage (in production, this would be server-side)
    this.savePendingTransaction(pendingTx);

    logger.info('Created pending multi-sig transaction', {
      component: 'MultiSigTransactionService',
      txId: pendingTx.id,
      type,
      requiredSigs: Number(requiredSigs),
    });

    return pendingTx;
  }

  /**
   * Sign a pending transaction with a passkey
   */
  async signTransaction(
    txId: string,
    keySlot: number,
    keyHash: string,
    deviceName: string,
    role: string,
    backendUrl: string
  ): Promise<PendingMultiSigTx> {
    const pendingTx = this.getPendingTransaction(txId);
    if (!pendingTx) {
      throw new Error('Transaction not found');
    }

    if (pendingTx.status !== 'pending') {
      throw new Error(`Transaction is ${pendingTx.status}`);
    }

    if (new Date() > pendingTx.expiresAt) {
      pendingTx.status = 'expired';
      this.savePendingTransaction(pendingTx);
      throw new Error('Transaction has expired');
    }

    // Check if already signed by this key
    if (pendingTx.signatures.some(s => s.keyHash === keyHash)) {
      throw new Error('You have already signed this transaction');
    }

    // Get passkey signature
    const signature = await this.getPasskeySignature(
      pendingTx.opHash,
      backendUrl
    );

    // Add signature to pending transaction
    pendingTx.signatures.push({
      keyHash,
      deviceName,
      role,
      signature,
      signedAt: new Date(),
    });
    pendingTx.currentSignatures++;

    // Check if ready to execute
    if (pendingTx.currentSignatures >= pendingTx.requiredSignatures) {
      pendingTx.status = 'ready';
    }

    this.savePendingTransaction(pendingTx);

    logger.info('Transaction signed', {
      component: 'MultiSigTransactionService',
      txId,
      currentSigs: pendingTx.currentSignatures,
      requiredSigs: pendingTx.requiredSignatures,
      status: pendingTx.status,
    });

    return pendingTx;
  }

  /**
   * Execute a transaction that has enough signatures
   */
  async executeTransaction(txId: string): Promise<{ hash: string }> {
    const pendingTx = this.getPendingTransaction(txId);
    if (!pendingTx) {
      throw new Error('Transaction not found');
    }

    if (pendingTx.status !== 'ready') {
      throw new Error(`Transaction is not ready. Status: ${pendingTx.status}`);
    }

    // In a real implementation, this would:
    // 1. Build a UserOperation with all collected signatures
    // 2. Submit to the bundler
    // 3. Wait for confirmation

    logger.info('Executing multi-sig transaction', {
      component: 'MultiSigTransactionService',
      txId,
      signatures: pendingTx.currentSignatures,
    });

    // Mark as executed
    pendingTx.status = 'executed';
    this.savePendingTransaction(pendingTx);

    // Return mock hash for now
    return { hash: `0x${pendingTx.opHash.slice(2, 66)}` };
  }

  /**
   * Get all pending transactions for a wallet
   */
  getPendingTransactionsForWallet(walletAddress: string): PendingMultiSigTx[] {
    const all = this.getAllPendingTransactions();
    return all
      .filter(tx => tx.walletAddress.toLowerCase() === walletAddress.toLowerCase())
      .filter(tx => tx.status === 'pending' || tx.status === 'ready')
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Cancel a pending transaction
   */
  cancelTransaction(txId: string): void {
    const pendingTx = this.getPendingTransaction(txId);
    if (!pendingTx) {
      throw new Error('Transaction not found');
    }

    pendingTx.status = 'cancelled';
    this.savePendingTransaction(pendingTx);

    logger.info('Transaction cancelled', {
      component: 'MultiSigTransactionService',
      txId,
    });
  }

  /**
   * Check if a key has already signed a transaction
   */
  hasKeySigned(txId: string, keyHash: string): boolean {
    const pendingTx = this.getPendingTransaction(txId);
    if (!pendingTx) return false;
    return pendingTx.signatures.some(s => s.keyHash === keyHash);
  }

  // ============ Private Methods ============

  private generateOpHash(walletAddress: string, callData: string): string {
    const abiCoder = AbiCoder.defaultAbiCoder();
    const packed = abiCoder.encode(
      ['address', 'bytes', 'uint256'],
      [walletAddress, callData, Date.now()]
    );
    return keccak256(packed);
  }

  private async getPasskeySignature(
    opHash: string,
    backendUrl: string
  ): Promise<string> {
    // Get authentication options from backend
    const optionsResponse = await fetch(`${backendUrl}/passkeys/auth/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        challenge: opHash, // Use opHash as challenge
      }),
    });

    if (!optionsResponse.ok) {
      throw new Error('Failed to get signing options');
    }

    const responseData = await optionsResponse.json();
    const options: PublicKeyCredentialRequestOptionsJSON = responseData.data?.options || responseData;

    // Override challenge with opHash
    options.challenge = this.toBase64Url(opHash);

    // Sign with WebAuthn
    const authResponse: AuthenticationResponseJSON = await startAuthentication({ optionsJSON: options });

    // Extract and encode signature
    const signature = this.encodeWebAuthnSignature(authResponse);

    return signature;
  }

  private encodeWebAuthnSignature(auth: AuthenticationResponseJSON): string {
    // Return base64-encoded signature for storage
    // In real implementation, this would be properly encoded for the contract
    return JSON.stringify({
      authenticatorData: auth.response.authenticatorData,
      clientDataJSON: auth.response.clientDataJSON,
      signature: auth.response.signature,
    });
  }

  private toBase64Url(hex: string): string {
    const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
    const bytes = new Uint8Array(cleanHex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(cleanHex.substr(i * 2, 2), 16);
    }
    const base64 = btoa(String.fromCharCode(...bytes));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  private savePendingTransaction(tx: PendingMultiSigTx): void {
    const all = this.getAllPendingTransactions();
    const index = all.findIndex(t => t.id === tx.id);
    if (index >= 0) {
      all[index] = tx;
    } else {
      all.push(tx);
    }
    localStorage.setItem(PENDING_TX_KEY, JSON.stringify(all));
  }

  private getPendingTransaction(txId: string): PendingMultiSigTx | null {
    const all = this.getAllPendingTransactions();
    const tx = all.find(t => t.id === txId);
    if (!tx) return null;

    // Parse dates
    tx.createdAt = new Date(tx.createdAt);
    tx.expiresAt = new Date(tx.expiresAt);
    tx.signatures.forEach(s => {
      s.signedAt = new Date(s.signedAt);
    });

    return tx;
  }

  private getAllPendingTransactions(): PendingMultiSigTx[] {
    const stored = localStorage.getItem(PENDING_TX_KEY);
    if (!stored) return [];
    try {
      const txs = JSON.parse(stored) as PendingMultiSigTx[];
      // Parse dates
      return txs.map(tx => ({
        ...tx,
        createdAt: new Date(tx.createdAt),
        expiresAt: new Date(tx.expiresAt),
        signatures: tx.signatures.map(s => ({
          ...s,
          signedAt: new Date(s.signedAt),
        })),
      }));
    } catch {
      return [];
    }
  }
}

// Singleton instance
let multiSigServiceInstance: MultiSigTransactionService | null = null;

export const getMultiSigService = (config?: MultiSigConfig): MultiSigTransactionService => {
  if (!multiSigServiceInstance && config) {
    multiSigServiceInstance = new MultiSigTransactionService(config);
  }
  if (!multiSigServiceInstance) {
    throw new Error('MultiSigTransactionService not initialized');
  }
  return multiSigServiceInstance;
};

export const initMultiSigService = (config: MultiSigConfig): MultiSigTransactionService => {
  multiSigServiceInstance = new MultiSigTransactionService(config);
  return multiSigServiceInstance;
};
