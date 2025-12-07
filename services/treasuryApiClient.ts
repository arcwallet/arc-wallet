/**
 * Treasury API Client
 * Connects frontend treasury services to backend API
 */

import { BACKEND_URL } from '../config/app.config';

// Types
export type TreasuryUserRole = 'admin' | 'treasury_manager' | 'operator' | 'approver' | 'viewer' | 'member';
export type TreasuryOperationType = 'subscribe' | 'redeem' | 'transfer' | 'rebalance';

export interface TreasuryPolicy {
  id: string;
  walletAddress: string;
  dailyLimit: number;
  singleTransactionLimit: number;
  requireApprovalAbove: number;
  requiredSignatures: number;
  allowedOperations: TreasuryOperationType[];
  cooldownPeriod: number;
  maxYieldAllocation: number;
  emergencyPauseEnabled: boolean;
  whitelistedAddresses: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface TreasuryTransaction {
  id: string;
  walletAddress: string;
  operationType: TreasuryOperationType;
  amount: string;
  token: 'USDC' | 'USYC';
  outputToken?: 'USDC' | 'USYC';
  expectedOutput?: string;
  submittedBy: string;
  submitterEmail: string;
  submitterRole: TreasuryUserRole;
  status: 'pending_approval' | 'approved' | 'executing' | 'executed' | 'rejected' | 'failed';
  requiredSignatures: number;
  currentSignatures: number;
  signatures?: TreasurySignature[];
  txHash?: string;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
}

export interface TreasurySignature {
  id: string;
  transactionId: string;
  signerId: string;
  signerEmail: string;
  signerRole: TreasuryUserRole;
  status: 'approved' | 'rejected';
  comment?: string;
  signedAt: Date;
}

export interface TreasuryAuditLog {
  id: string;
  walletAddress: string;
  action: string;
  performedBy: string;
  details: string;
  transactionId?: string;
  ipAddress?: string;
  timestamp: Date;
}

export interface TreasuryStats {
  pending: number;
  approved: number;
  executed: number;
  rejected: number;
  totalVolume: { USDC: number; USYC: number };
  todaySpending: { usdcSpent: number; usycSpent: number };
}

// API Response type
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

class TreasuryApiClient {
  private getAuthHeaders(): HeadersInit {
    try {
      // Get auth token from localStorage if available
      const sessionToken = localStorage.getItem('arc_session_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (sessionToken) {
        headers['Authorization'] = `Bearer ${sessionToken}`;
      }
      return headers;
    } catch {
      return { 'Content-Type': 'application/json' };
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${BACKEND_URL}/treasury${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.getAuthHeaders(),
        ...options.headers,
      },
      credentials: 'include',
    });

    const data: ApiResponse<T> = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || `Request failed: ${response.status}`);
    }

    return data.data as T;
  }

  // ==================== Policy Operations ====================

  async getPolicy(walletAddress: string): Promise<TreasuryPolicy> {
    const data = await this.request<any>(`/policy/${walletAddress}`);
    return this.mapPolicy(data);
  }

  async updatePolicy(walletAddress: string, policy: Partial<TreasuryPolicy>): Promise<TreasuryPolicy> {
    const data = await this.request<any>(`/policy/${walletAddress}`, {
      method: 'PUT',
      body: JSON.stringify(policy),
    });
    return this.mapPolicy(data);
  }

  // ==================== Transaction Operations ====================

  async createTransaction(params: {
    walletAddress: string;
    operationType: TreasuryOperationType;
    amount: string;
    token: 'USDC' | 'USYC';
    outputToken?: 'USDC' | 'USYC';
    expectedOutput?: string;
    submitterEmail: string;
    submitterRole: TreasuryUserRole;
    usdcBalance: number;
    usycBalance: number;
  }): Promise<TreasuryTransaction> {
    const data = await this.request<any>('/transactions', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    return this.mapTransaction(data);
  }

  async getTransactions(walletAddress: string, status?: string): Promise<TreasuryTransaction[]> {
    const queryParams = status ? `?status=${status}` : '';
    const data = await this.request<any[]>(`/transactions/${walletAddress}${queryParams}`);
    return data.map(tx => this.mapTransaction(tx));
  }

  async getTransaction(transactionId: string): Promise<TreasuryTransaction> {
    const data = await this.request<any>(`/transaction/${transactionId}`);
    return this.mapTransaction(data);
  }

  async signTransaction(
    transactionId: string,
    approve: boolean,
    signerEmail: string,
    signerRole: TreasuryUserRole,
    comment?: string
  ): Promise<TreasuryTransaction> {
    const data = await this.request<any>(`/transactions/${transactionId}/sign`, {
      method: 'POST',
      body: JSON.stringify({ approve, signerEmail, signerRole, comment }),
    });
    return this.mapTransaction(data);
  }

  async executeTransaction(transactionId: string, txHash: string): Promise<TreasuryTransaction> {
    const data = await this.request<any>(`/transactions/${transactionId}/execute`, {
      method: 'POST',
      body: JSON.stringify({ txHash }),
    });
    return this.mapTransaction(data);
  }

  // ==================== Audit & Statistics ====================

  async getAuditLogs(walletAddress: string, limit = 100, offset = 0): Promise<TreasuryAuditLog[]> {
    const data = await this.request<any[]>(`/audit/${walletAddress}?limit=${limit}&offset=${offset}`);
    return data.map(log => ({
      ...log,
      timestamp: new Date(log.timestamp),
    }));
  }

  async getStatistics(walletAddress: string): Promise<TreasuryStats> {
    return await this.request<TreasuryStats>(`/stats/${walletAddress}`);
  }

  // ==================== Helper Methods ====================

  private mapPolicy(data: any): TreasuryPolicy {
    return {
      ...data,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
    };
  }

  private mapTransaction(data: any): TreasuryTransaction {
    return {
      ...data,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
      expiresAt: new Date(data.expiresAt),
      signatures: data.signatures?.map((sig: any) => ({
        ...sig,
        signedAt: new Date(sig.signedAt),
      })),
    };
  }
}

// Export singleton instance
export const treasuryApiClient = new TreasuryApiClient();
export default treasuryApiClient;
