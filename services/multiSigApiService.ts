/**
 * Multi-Sig API Service
 * Frontend wrapper for backend multi-sig API endpoints
 */

import { logger } from './logger';

export interface MultiSigAccount {
  id: string;
  name: string;
  address: string | null;
  requiredSignatures: number;
  createdBy: string;
  createdAt: string;
  members?: MultiSigMember[];
  pendingTransactions?: number;
}

export interface MultiSigMember {
  id: string;
  accountId: string;
  userId: string;
  email: string;
  role: 'owner' | 'signer' | 'viewer';
  status: 'pending' | 'active' | 'removed';
}

export interface MultiSigTransaction {
  id: string;
  accountId: string;
  submitterId: string;
  targetAddress: string;
  value: string;
  tokenAddress: string | null;
  tokenSymbol: string;
  data: string | null;
  description: string | null;
  status: 'pending' | 'executed' | 'rejected' | 'expired';
  txHash: string | null;
  expiresAt: string;
  signatures?: MultiSigSignature[];
  approvalCount?: number;
  requiredSignatures?: number;
}

export interface MultiSigSignature {
  id: string;
  transactionId: string;
  signerId: string;
  signerAddress: string;
  status: 'approved' | 'rejected';
  createdAt: string;
}

export interface CreateAccountParams {
  name: string;
  requiredSignatures: number;
  members: { userId?: string; email: string; role: 'owner' | 'signer' | 'viewer' }[];
}

export interface CreateTransactionParams {
  accountId: string;
  targetAddress: string;
  value: string;
  tokenAddress?: string;
  tokenSymbol?: string;
  data?: string;
  description?: string;
}

class MultiSigApiService {
  private baseUrl: string;

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl || import.meta.env.VITE_BACKEND_URL || 'https://arcwallet-backend.onrender.com';
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}/api/multisig${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      credentials: 'include',
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.message || 'Request failed');
    }

    return data.data;
  }

  // ============ Account Operations ============

  async createAccount(params: CreateAccountParams): Promise<{ account: MultiSigAccount; members: MultiSigMember[] }> {
    logger.info('Creating multi-sig account', { component: 'MultiSigApiService', name: params.name });
    return this.request('/accounts', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async getAccounts(): Promise<MultiSigAccount[]> {
    logger.info('Fetching multi-sig accounts', { component: 'MultiSigApiService' });
    return this.request('/accounts');
  }

  async getAccount(accountId: string): Promise<{ account: MultiSigAccount; members: MultiSigMember[]; transactions: MultiSigTransaction[] }> {
    return this.request(`/accounts/${accountId}`);
  }

  async updateAccount(accountId: string, updates: { name?: string; requiredSignatures?: number }): Promise<MultiSigAccount> {
    logger.info('Updating multi-sig account', { component: 'MultiSigApiService', accountId });
    return this.request(`/accounts/${accountId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deployContract(accountId: string, address: string): Promise<{ accountId: string; address: string }> {
    logger.info('Deploying multi-sig contract', { component: 'MultiSigApiService', accountId, address });
    return this.request(`/accounts/${accountId}/deploy`, {
      method: 'POST',
      body: JSON.stringify({ address }),
    });
  }

  // ============ Member Operations ============

  async addMember(accountId: string, email: string, role: 'signer' | 'viewer' = 'signer'): Promise<MultiSigMember> {
    logger.info('Adding member to multi-sig', { component: 'MultiSigApiService', accountId, email });
    return this.request(`/accounts/${accountId}/members`, {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    });
  }

  async removeMember(accountId: string, memberId: string): Promise<void> {
    logger.info('Removing member from multi-sig', { component: 'MultiSigApiService', accountId, memberId });
    return this.request(`/accounts/${accountId}/members/${memberId}`, {
      method: 'DELETE',
    });
  }

  // ============ Transaction Operations ============

  async createTransaction(params: CreateTransactionParams): Promise<{ transaction: MultiSigTransaction; approvalCount: number; requiredSignatures: number }> {
    logger.info('Creating multi-sig transaction', { component: 'MultiSigApiService', ...params });
    return this.request('/transactions', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async getTransaction(transactionId: string): Promise<{ transaction: MultiSigTransaction; signatures: MultiSigSignature[]; approvalCount: number; requiredSignatures: number }> {
    return this.request(`/transactions/${transactionId}`);
  }

  async getTransactions(accountId: string, status?: 'pending' | 'executed' | 'rejected' | 'expired'): Promise<MultiSigTransaction[]> {
    const query = status ? `?status=${status}` : '';
    return this.request(`/accounts/${accountId}/transactions${query}`);
  }

  async approveTransaction(transactionId: string, signerAddress?: string): Promise<{ approvalCount: number; requiredSignatures: number; executed: boolean }> {
    logger.info('Approving multi-sig transaction', { component: 'MultiSigApiService', transactionId });
    return this.request(`/transactions/${transactionId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ signerAddress }),
    });
  }

  async rejectTransaction(transactionId: string, signerAddress?: string): Promise<{ rejectionCount: number; rejected: boolean }> {
    logger.info('Rejecting multi-sig transaction', { component: 'MultiSigApiService', transactionId });
    return this.request(`/transactions/${transactionId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ signerAddress }),
    });
  }
}

// Singleton instance
export const multiSigApi = new MultiSigApiService();
export default multiSigApi;
