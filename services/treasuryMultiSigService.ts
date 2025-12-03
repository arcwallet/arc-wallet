/**
 * Treasury Multi-Sig Service
 * Integrates treasury operations with multi-sig approval workflow
 * Supports both local storage (offline) and backend API (online) modes
 */

import { treasuryPolicyService, UserRole, PolicyValidationResult } from './treasuryPolicyService';
import { multiSigClient, MultiSigTransaction, TransactionWithDetails } from './multiSigClient';
import { treasuryApiClient } from './treasuryApiClient';

// Treasury transaction types
export type TreasuryOperationType = 'subscribe' | 'redeem' | 'transfer' | 'rebalance';

// Treasury transaction interface
export interface TreasuryTransaction {
  id: string;
  operationType: TreasuryOperationType;
  amount: string;
  token: 'USDC' | 'USYC';
  outputToken?: 'USDC' | 'USYC';
  expectedOutput?: string;
  submittedBy: string;
  submitterEmail: string;
  submitterRole: UserRole;
  walletAddress: string;
  multiSigAccountId?: string;
  multiSigTransactionId?: string;
  status: 'pending_approval' | 'approved' | 'executing' | 'executed' | 'rejected' | 'failed';
  requiredSignatures: number;
  currentSignatures: number;
  signatures: TreasurySignature[];
  policyValidation: PolicyValidationResult;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  txHash?: string;
  error?: string;
}

export interface TreasurySignature {
  signerId: string;
  signerEmail: string;
  signerRole: UserRole;
  status: 'approved' | 'rejected';
  signedAt: Date;
  comment?: string;
}

export interface CreateTreasuryTransactionParams {
  operationType: TreasuryOperationType;
  amount: string;
  token: 'USDC' | 'USYC';
  outputToken?: 'USDC' | 'USYC';
  expectedOutput?: string;
  submittedBy: string;
  submitterEmail: string;
  submitterRole: UserRole;
  walletAddress: string;
  multiSigAccountId?: string;
  usdcBalance: number;
  usycBalance: number;
}

// Storage key
const TREASURY_TX_STORAGE_KEY = 'arcwallet_treasury_transactions';
const USE_BACKEND_KEY = 'arcwallet_treasury_use_backend';

class TreasuryMultiSigService {
  private transactions: Map<string, TreasuryTransaction> = new Map();
  private useBackend: boolean = false;

  constructor() {
    this.loadFromStorage();
    // Backend is enabled by default, can be disabled for offline mode
    const storedValue = localStorage.getItem(USE_BACKEND_KEY);
    this.useBackend = storedValue === null ? true : storedValue === 'true';
  }

  /**
   * Enable or disable backend sync
   */
  setBackendMode(enabled: boolean): void {
    this.useBackend = enabled;
    localStorage.setItem(USE_BACKEND_KEY, String(enabled));
  }

  /**
   * Check if backend mode is enabled
   */
  isBackendEnabled(): boolean {
    return this.useBackend;
  }

  /**
   * Sync transactions from backend
   */
  async syncFromBackend(walletAddress: string): Promise<void> {
    if (!this.useBackend) return;

    try {
      const transactions = await treasuryApiClient.getTransactions(walletAddress);
      // Merge with local transactions
      for (const tx of transactions) {
        const localTx = this.mapApiToLocal(tx);
        this.transactions.set(tx.id, localTx);
      }
      this.saveToStorage();
    } catch (error) {
      console.warn('Failed to sync from backend, using local storage:', error);
    }
  }

  /**
   * Map API transaction to local format
   */
  private mapApiToLocal(apiTx: any): TreasuryTransaction {
    return {
      id: apiTx.id,
      operationType: apiTx.operationType,
      amount: apiTx.amount,
      token: apiTx.token,
      outputToken: apiTx.outputToken,
      expectedOutput: apiTx.expectedOutput,
      submittedBy: apiTx.submittedBy,
      submitterEmail: apiTx.submitterEmail,
      submitterRole: apiTx.submitterRole,
      walletAddress: apiTx.walletAddress,
      status: apiTx.status,
      requiredSignatures: apiTx.requiredSignatures,
      currentSignatures: apiTx.currentSignatures,
      signatures: apiTx.signatures?.map((s: any) => ({
        signerId: s.signerId,
        signerEmail: s.signerEmail,
        signerRole: s.signerRole,
        status: s.status,
        signedAt: new Date(s.signedAt),
        comment: s.comment,
      })) || [],
      policyValidation: {
        allowed: true,
        requiresApproval: apiTx.requiredSignatures > 1,
        requiredSignatures: apiTx.requiredSignatures,
      },
      createdAt: new Date(apiTx.createdAt),
      updatedAt: new Date(apiTx.updatedAt),
      expiresAt: new Date(apiTx.expiresAt),
      txHash: apiTx.txHash,
      error: apiTx.error,
    };
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(TREASURY_TX_STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        this.transactions = new Map(
          data.map((tx: any) => [
            tx.id,
            {
              ...tx,
              createdAt: new Date(tx.createdAt),
              updatedAt: new Date(tx.updatedAt),
              expiresAt: new Date(tx.expiresAt),
              signatures: tx.signatures.map((s: any) => ({
                ...s,
                signedAt: new Date(s.signedAt),
              })),
            },
          ])
        );
      }
    } catch (error) {
      console.error('Failed to load treasury transactions:', error);
    }
  }

  private saveToStorage(): void {
    try {
      const data = Array.from(this.transactions.values());
      localStorage.setItem(TREASURY_TX_STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save treasury transactions:', error);
    }
  }

  private generateId(): string {
    return `treasury_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create a new treasury transaction with policy validation
   */
  async createTransaction(params: CreateTreasuryTransactionParams): Promise<TreasuryTransaction> {
    // If backend is enabled, try to create on backend first
    if (this.useBackend) {
      try {
        const apiTx = await treasuryApiClient.createTransaction({
          walletAddress: params.walletAddress,
          operationType: params.operationType,
          amount: params.amount,
          token: params.token,
          outputToken: params.outputToken,
          expectedOutput: params.expectedOutput,
          submitterEmail: params.submitterEmail,
          submitterRole: params.submitterRole,
          usdcBalance: params.usdcBalance,
          usycBalance: params.usycBalance,
        });
        const localTx = this.mapApiToLocal(apiTx);
        this.transactions.set(localTx.id, localTx);
        this.saveToStorage();
        return localTx;
      } catch (error) {
        console.warn('Backend transaction creation failed, falling back to local:', error);
      }
    }

    // Validate against policy
    const validation = treasuryPolicyService.validateTransaction(
      params.operationType,
      parseFloat(params.amount),
      params.token,
      params.submitterRole,
      params.submitterEmail,
      params.walletAddress,
      undefined,
      params.usdcBalance,
      params.usycBalance
    );

    if (!validation.allowed) {
      throw new Error(validation.reason || 'Transaction not allowed by policy');
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

    const transaction: TreasuryTransaction = {
      id: this.generateId(),
      operationType: params.operationType,
      amount: params.amount,
      token: params.token,
      outputToken: params.outputToken,
      expectedOutput: params.expectedOutput,
      submittedBy: params.submittedBy,
      submitterEmail: params.submitterEmail,
      submitterRole: params.submitterRole,
      walletAddress: params.walletAddress,
      multiSigAccountId: params.multiSigAccountId,
      status: validation.requiresApproval ? 'pending_approval' : 'approved',
      requiredSignatures: validation.requiredSignatures,
      currentSignatures: 0,
      signatures: [],
      policyValidation: validation,
      createdAt: now,
      updatedAt: now,
      expiresAt,
    };

    // If no approval required, auto-approve with submitter's signature
    if (!validation.requiresApproval) {
      transaction.signatures.push({
        signerId: params.submittedBy,
        signerEmail: params.submitterEmail,
        signerRole: params.submitterRole,
        status: 'approved',
        signedAt: now,
      });
      transaction.currentSignatures = 1;
    }

    // If multi-sig account is provided, create a multi-sig transaction
    if (params.multiSigAccountId && validation.requiresApproval) {
      try {
        const description = this.getOperationDescription(params.operationType, params.amount, params.token);

        // Note: For treasury operations, we use a placeholder address
        // The actual contract interaction happens after approval
        const multiSigResult = await multiSigClient.createTransaction({
          accountId: params.multiSigAccountId,
          targetAddress: params.walletAddress, // Target is the wallet itself for treasury ops
          value: params.amount,
          tokenSymbol: params.token,
          description,
          submitterId: params.submittedBy,
        });

        if (multiSigResult.data) {
          transaction.multiSigTransactionId = multiSigResult.data.transaction.id;
        }
      } catch (error) {
        console.error('Failed to create multi-sig transaction:', error);
        // Continue without multi-sig integration
      }
    }

    this.transactions.set(transaction.id, transaction);
    this.saveToStorage();

    // Log to audit
    treasuryPolicyService.addAuditLog({
      action: 'create_transaction',
      performedBy: params.submitterEmail,
      details: `Created ${params.operationType} transaction for ${params.amount} ${params.token}`,
      transactionId: transaction.id,
    });

    return transaction;
  }

  /**
   * Sign/approve a treasury transaction
   */
  async signTransaction(
    transactionId: string,
    signerId: string,
    signerEmail: string,
    signerRole: UserRole,
    approve: boolean,
    comment?: string
  ): Promise<TreasuryTransaction> {
    // If backend is enabled, try to sign on backend first
    if (this.useBackend) {
      try {
        const apiTx = await treasuryApiClient.signTransaction(
          transactionId,
          approve,
          signerEmail,
          signerRole,
          comment
        );
        const localTx = this.mapApiToLocal(apiTx);
        this.transactions.set(localTx.id, localTx);
        this.saveToStorage();
        return localTx;
      } catch (error) {
        console.warn('Backend sign failed, falling back to local:', error);
      }
    }

    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      throw new Error('Transaction not found');
    }

    if (transaction.status !== 'pending_approval') {
      throw new Error('Transaction is not pending approval');
    }

    if (new Date() > transaction.expiresAt) {
      transaction.status = 'rejected';
      transaction.error = 'Transaction expired';
      this.saveToStorage();
      throw new Error('Transaction has expired');
    }

    // Check if already signed by this user
    const existingSignature = transaction.signatures.find((s) => s.signerId === signerId);
    if (existingSignature) {
      throw new Error('You have already signed this transaction');
    }

    // Check if user has permission to sign
    const canSign = this.canUserSign(signerRole);
    if (!canSign) {
      throw new Error('You do not have permission to sign treasury transactions');
    }

    // Add signature
    const signature: TreasurySignature = {
      signerId,
      signerEmail,
      signerRole,
      status: approve ? 'approved' : 'rejected',
      signedAt: new Date(),
      comment,
    };
    transaction.signatures.push(signature);
    transaction.updatedAt = new Date();

    if (approve) {
      transaction.currentSignatures++;

      // Check if we have enough signatures
      if (transaction.currentSignatures >= transaction.requiredSignatures) {
        transaction.status = 'approved';
      }
    } else {
      // Single rejection rejects the transaction
      transaction.status = 'rejected';
      transaction.error = `Rejected by ${signerEmail}${comment ? `: ${comment}` : ''}`;
    }

    // Sync with multi-sig if available
    if (transaction.multiSigTransactionId) {
      try {
        if (approve) {
          await multiSigClient.approveTransaction(transaction.multiSigTransactionId, signerId);
        } else {
          await multiSigClient.rejectTransaction(transaction.multiSigTransactionId, signerId);
        }
      } catch (error) {
        console.error('Failed to sync with multi-sig:', error);
      }
    }

    this.saveToStorage();

    // Log to audit
    treasuryPolicyService.addAuditLog({
      action: approve ? 'approve_transaction' : 'reject_transaction',
      performedBy: signerEmail,
      details: `${approve ? 'Approved' : 'Rejected'} ${transaction.operationType} transaction for ${transaction.amount} ${transaction.token}`,
      transactionId,
    });

    return transaction;
  }

  /**
   * Execute an approved transaction
   */
  async executeTransaction(transactionId: string, txHash: string): Promise<TreasuryTransaction> {
    // If backend is enabled, try to execute on backend first
    if (this.useBackend) {
      try {
        const apiTx = await treasuryApiClient.executeTransaction(transactionId, txHash);
        const localTx = this.mapApiToLocal(apiTx);
        this.transactions.set(localTx.id, localTx);
        this.saveToStorage();
        return localTx;
      } catch (error) {
        console.warn('Backend execute failed, falling back to local:', error);
      }
    }

    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      throw new Error('Transaction not found');
    }

    if (transaction.status !== 'approved') {
      throw new Error('Transaction is not approved');
    }

    transaction.status = 'executed';
    transaction.txHash = txHash;
    transaction.updatedAt = new Date();

    this.saveToStorage();

    // Update spending in policy service
    treasuryPolicyService.recordSpending(
      transaction.walletAddress,
      transaction.token,
      parseFloat(transaction.amount)
    );

    // Log to audit
    treasuryPolicyService.addAuditLog({
      action: 'execute_transaction',
      performedBy: 'system',
      details: `Executed ${transaction.operationType} transaction for ${transaction.amount} ${transaction.token}`,
      transactionId,
    });

    return transaction;
  }

  /**
   * Mark transaction as failed
   */
  markTransactionFailed(transactionId: string, error: string): TreasuryTransaction | null {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      return null;
    }

    transaction.status = 'failed';
    transaction.error = error;
    transaction.updatedAt = new Date();

    this.saveToStorage();

    treasuryPolicyService.addAuditLog({
      action: 'transaction_failed',
      performedBy: 'system',
      details: `Transaction failed: ${error}`,
      transactionId,
    });

    return transaction;
  }

  /**
   * Get all pending transactions for a wallet
   */
  async getPendingTransactions(walletAddress: string): Promise<TreasuryTransaction[]> {
    // Sync from backend if enabled
    if (this.useBackend) {
      try {
        const apiTransactions = await treasuryApiClient.getTransactions(walletAddress, 'pending_approval');
        for (const apiTx of apiTransactions) {
          const localTx = this.mapApiToLocal(apiTx);
          this.transactions.set(localTx.id, localTx);
        }
        this.saveToStorage();
      } catch (error) {
        console.warn('Failed to get pending transactions from backend:', error);
      }
    }

    return Array.from(this.transactions.values())
      .filter(
        (tx) =>
          tx.walletAddress === walletAddress &&
          tx.status === 'pending_approval' &&
          new Date() < tx.expiresAt
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get all transactions for a wallet
   */
  async getTransactions(walletAddress: string, status?: string): Promise<TreasuryTransaction[]> {
    // Sync from backend if enabled
    if (this.useBackend) {
      try {
        const apiTransactions = await treasuryApiClient.getTransactions(walletAddress, status);
        for (const apiTx of apiTransactions) {
          const localTx = this.mapApiToLocal(apiTx);
          this.transactions.set(localTx.id, localTx);
        }
        this.saveToStorage();
      } catch (error) {
        console.warn('Failed to get transactions from backend:', error);
      }
    }

    let transactions = Array.from(this.transactions.values()).filter(
      (tx) => tx.walletAddress === walletAddress
    );

    if (status) {
      transactions = transactions.filter((tx) => tx.status === status);
    }

    return transactions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get a single transaction by ID
   */
  getTransaction(transactionId: string): TreasuryTransaction | null {
    return this.transactions.get(transactionId) || null;
  }

  /**
   * Get transactions pending user's signature
   */
  async getTransactionsPendingSignature(walletAddress: string, userId: string): Promise<TreasuryTransaction[]> {
    const pending = await this.getPendingTransactions(walletAddress);
    return pending.filter(
      (tx) => !tx.signatures.some((s) => s.signerId === userId)
    );
  }

  /**
   * Check if user can sign treasury transactions
   */
  private canUserSign(role: UserRole): boolean {
    const signingRoles: UserRole[] = ['admin', 'treasury_manager', 'approver'];
    return signingRoles.includes(role);
  }

  /**
   * Get operation description
   */
  private getOperationDescription(
    operationType: TreasuryOperationType,
    amount: string,
    token: string
  ): string {
    switch (operationType) {
      case 'subscribe':
        return `Treasury Subscribe: ${amount} ${token} to USYC`;
      case 'redeem':
        return `Treasury Redeem: ${amount} ${token} to USDC`;
      case 'transfer':
        return `Treasury Transfer: ${amount} ${token}`;
      case 'rebalance':
        return `Treasury Rebalance: ${amount} ${token}`;
      default:
        return `Treasury Operation: ${amount} ${token}`;
    }
  }

  /**
   * Clean up expired transactions
   */
  cleanupExpired(): number {
    let count = 0;
    const now = new Date();

    for (const [id, tx] of this.transactions) {
      if (tx.status === 'pending_approval' && now > tx.expiresAt) {
        tx.status = 'rejected';
        tx.error = 'Transaction expired';
        tx.updatedAt = now;
        count++;
      }
    }

    if (count > 0) {
      this.saveToStorage();
    }

    return count;
  }

  /**
   * Get statistics for a wallet
   */
  async getStatistics(walletAddress: string): Promise<{
    pending: number;
    approved: number;
    executed: number;
    rejected: number;
    totalVolume: { USDC: number; USYC: number };
    todaySpending?: { usdcSpent: number; usycSpent: number };
  }> {
    // If backend is enabled, try to get stats from backend
    if (this.useBackend) {
      try {
        const backendStats = await treasuryApiClient.getStatistics(walletAddress);
        return backendStats;
      } catch (error) {
        console.warn('Failed to get statistics from backend:', error);
      }
    }

    const transactions = await this.getTransactions(walletAddress);

    const stats = {
      pending: 0,
      approved: 0,
      executed: 0,
      rejected: 0,
      totalVolume: { USDC: 0, USYC: 0 },
    };

    for (const tx of transactions) {
      switch (tx.status) {
        case 'pending_approval':
          stats.pending++;
          break;
        case 'approved':
        case 'executing':
          stats.approved++;
          break;
        case 'executed':
          stats.executed++;
          stats.totalVolume[tx.token] += parseFloat(tx.amount);
          break;
        case 'rejected':
        case 'failed':
          stats.rejected++;
          break;
      }
    }

    return stats;
  }
}

// Export singleton instance
export const treasuryMultiSigService = new TreasuryMultiSigService();
export default treasuryMultiSigService;
