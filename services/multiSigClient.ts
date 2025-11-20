/**
 * Multi-Sig API Client
 * Frontend service for multi-sig wallet operations
 */

const API_BASE_URL = ((import.meta as any).env.VITE_PASSKEY_API_URL ?? ((import.meta as any).env.PROD ? `${window.location.origin}/api` : 'http://localhost:4000')).replace(/\/$/, '');
const resolveUrl = (path: string) => (API_BASE_URL ? `${API_BASE_URL}${path}` : path);

// Get CSRF token from cookie
const getCsrfToken = (): string | null => {
  const match = document.cookie.match(/(?:^|; )_csrf=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
};

// Types
export interface MultiSigAccount {
  id: string;
  name: string;
  address: string | null;
  requiredSignatures: number;
  createdBy: string;
  createdAt: string;
}

export interface MultiSigMember {
  id: string;
  accountId: string;
  userId: string;
  email: string;
  role: 'owner' | 'signer' | 'viewer';
  status: 'pending' | 'active' | 'removed';
  addedAt: string;
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
  onChainTxId: number | null;
  createdAt: string;
  expiresAt: string;
}

export interface MultiSigSignature {
  id: string;
  transactionId: string;
  signerId: string;
  signerAddress: string;
  status: 'approved' | 'rejected';
  signedAt: string;
}

export interface AccountWithDetails extends MultiSigAccount {
  members: MultiSigMember[];
  pendingTransactions?: number;
}

export interface TransactionWithDetails extends MultiSigTransaction {
  signatures: MultiSigSignature[];
  approvalCount: number;
  requiredSignatures: number;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Helper functions
async function postJSON<T>(endpoint: string, data: any): Promise<ApiResponse<T>> {
  const csrfToken = getCsrfToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (csrfToken) {
    headers['X-CSRF-Token'] = csrfToken;
  }

  const response = await fetch(resolveUrl(endpoint), {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify(data),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || result.message || 'Request failed');
  }

  return result;
}

async function getJSON<T>(endpoint: string): Promise<ApiResponse<T>> {
  const csrfToken = getCsrfToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (csrfToken) {
    headers['X-CSRF-Token'] = csrfToken;
  }

  const response = await fetch(resolveUrl(endpoint), {
    method: 'GET',
    headers,
    credentials: 'include',
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || result.message || 'Request failed');
  }

  return result;
}

async function putJSON<T>(endpoint: string, data: any): Promise<ApiResponse<T>> {
  const csrfToken = getCsrfToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (csrfToken) {
    headers['X-CSRF-Token'] = csrfToken;
  }

  const response = await fetch(resolveUrl(endpoint), {
    method: 'PUT',
    headers,
    credentials: 'include',
    body: JSON.stringify(data),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || result.message || 'Request failed');
  }

  return result;
}

async function deleteJSON<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
  const csrfToken = getCsrfToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (csrfToken) {
    headers['X-CSRF-Token'] = csrfToken;
  }

  const response = await fetch(resolveUrl(endpoint), {
    method: 'DELETE',
    headers,
    credentials: 'include',
    body: data ? JSON.stringify(data) : undefined,
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || result.message || 'Request failed');
  }

  return result;
}

// Multi-Sig API Client
export const multiSigClient = {
  // Account operations
  createAccount: (
    name: string,
    requiredSignatures: number,
    members: Array<{ userId?: string; email: string; role?: string }>,
    userId: string
  ) =>
    postJSON<{ account: MultiSigAccount; members: MultiSigMember[] }>(
      '/multisig/accounts',
      { name, requiredSignatures, members, userId }
    ),

  getAccounts: (userId: string) =>
    getJSON<AccountWithDetails[]>(`/multisig/accounts/user/${userId}`),

  getAccount: (accountId: string) =>
    getJSON<{
      account: MultiSigAccount;
      members: MultiSigMember[];
      transactions: MultiSigTransaction[];
    }>(`/multisig/accounts/${accountId}`),

  updateAccount: (
    accountId: string,
    updates: { name?: string; requiredSignatures?: number },
    userId: string
  ) =>
    putJSON<MultiSigAccount>(`/multisig/accounts/${accountId}`, {
      ...updates,
      userId,
    }),

  deployContract: (accountId: string, address: string, userId: string) =>
    postJSON<{ accountId: string; address: string }>(
      `/multisig/accounts/${accountId}/deploy`,
      { address, userId }
    ),

  // Member operations
  addMember: (
    accountId: string,
    email: string,
    role: 'signer' | 'viewer',
    userId: string
  ) =>
    postJSON<MultiSigMember>(`/multisig/accounts/${accountId}/members`, {
      email,
      role,
      userId,
    }),

  removeMember: (accountId: string, memberId: string, userId: string) =>
    deleteJSON<{ message: string }>(
      `/multisig/accounts/${accountId}/members/${memberId}`,
      { userId }
    ),

  // Transaction operations
  createTransaction: (params: {
    accountId: string;
    targetAddress: string;
    value: string;
    tokenAddress?: string;
    tokenSymbol?: string;
    data?: string;
    description?: string;
    submitterId: string;
  }) =>
    postJSON<{
      transaction: MultiSigTransaction;
      approvalCount: number;
      requiredSignatures: number;
    }>('/multisig/transactions', params),

  getTransaction: (transactionId: string) =>
    getJSON<{
      transaction: MultiSigTransaction;
      signatures: MultiSigSignature[];
      approvalCount: number;
      requiredSignatures: number;
    }>(`/multisig/transactions/${transactionId}`),

  getTransactions: (accountId: string, status?: string) =>
    getJSON<TransactionWithDetails[]>(
      `/multisig/accounts/${accountId}/transactions${status ? `?status=${status}` : ''}`
    ),

  approveTransaction: (
    transactionId: string,
    userId: string,
    signerAddress?: string
  ) =>
    postJSON<{
      approvalCount: number;
      requiredSignatures: number;
      executed: boolean;
    }>(`/multisig/transactions/${transactionId}/approve`, {
      userId,
      signerAddress,
    }),

  rejectTransaction: (
    transactionId: string,
    userId: string,
    signerAddress?: string
  ) =>
    postJSON<{
      rejectionCount: number;
      rejected: boolean;
    }>(`/multisig/transactions/${transactionId}/reject`, {
      userId,
      signerAddress,
    }),
};

export default multiSigClient;
