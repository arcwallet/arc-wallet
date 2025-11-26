/**
 * Bridge API Client
 * Communicates with backend bridge endpoints
 */

const API_BASE_URL = (import.meta as any).env.VITE_PASSKEY_API_URL || 'https://arcwallet-backend.onrender.com';

import { getCsrfToken, refreshCsrfToken } from './csrfService';

export interface StartBridgeRequest {
  userId: string;
  sessionKeyAddress: string;
  amount: string; // Decimal string like "10.50"
  direction: 'arc-to-sepolia' | 'sepolia-to-arc';
  token: 'USDC';
}

export interface StartBridgeResponse {
  success: boolean;
  data?: {
    transactionId: number;
    status: string;
    message: string;
  };
  error?: string;
  code?: string;
}

export interface BridgeStatusResponse {
  success: boolean;
  data?: {
    id: number;
    status: 'pending' | 'burn_complete' | 'attestation_fetched' | 'mint_complete' | 'completed' | 'failed';
    amount: string;
    direction: string;
    token: string;
    sourceTxHash?: string;
    destinationTxHash?: string;
    errorMessage?: string;
    createdAt: string;
    updatedAt: string;
  };
  error?: string;
  code?: string;
}

export interface BridgeHistoryResponse {
  success: boolean;
  data?: {
    transactions: Array<{
      id: number;
      status: string;
      amount: string;
      direction: string;
      token: string;
      sourceTxHash?: string;
      destinationTxHash?: string;
      errorMessage?: string;
      createdAt: string;
    }>;
    limit: number;
    offset: number;
  };
  error?: string;
  code?: string;
}

/**
 * Start a bridge transaction
 */
export interface BridgeApiResponse {
  success: boolean;
  data?: any;
  error?: string;
  code?: string;
}

export class BridgeApiError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
    this.name = 'BridgeApiError';
  }
}

export async function startBridge(request: StartBridgeRequest, isRetry = false): Promise<StartBridgeResponse> {
  try {
    const csrfToken = getCsrfToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
    }

    const response = await fetch(`${API_BASE_URL}/bridge/start`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify(request),
    });

    // Handle CSRF token expiration
    if (response.status === 403 && !isRetry) {
      const clone = response.clone();
      try {
        const errorBody = await clone.json();
        if (errorBody.code === 'CSRF_VALIDATION_FAILED' || errorBody.error === 'Invalid CSRF token') {
          await refreshCsrfToken();
          return startBridge(request, true);
        }
      } catch (e) {
        // Ignore JSON parse error
      }
    }

    const data = await response.json();

    if (!response.ok) {
      // Throw a custom error with the error code from the API
      const errorCode = data.code || 'BRIDGE_START_ERROR';
      const errorMessage = data.error || `HTTP ${response.status}`;
      const error = new BridgeApiError(errorMessage, errorCode);
      throw error;
    }

    return data;
  } catch (error: any) {
    console.error('Bridge start error:', error);

    // If it's our custom error, preserve the code
    if (error instanceof BridgeApiError) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }

    return {
      success: false,
      error: error.message || 'Failed to start bridge transaction',
      code: 'BRIDGE_START_ERROR',
    };
  }
}

/**
 * Get bridge transaction status
 */
export async function getBridgeStatus(transactionId: number): Promise<BridgeStatusResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/bridge/status/${transactionId}`, {
      credentials: 'include',
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    return data;
  } catch (error: any) {
    console.error('Bridge status error:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch bridge status',
      code: 'BRIDGE_STATUS_ERROR',
    };
  }
}

/**
 * Get user's bridge history
 */
export async function getBridgeHistory(
  userId: string,
  limit: number = 50,
  offset: number = 0
): Promise<BridgeHistoryResponse> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/bridge/history/${userId}?limit=${limit}&offset=${offset}`,
      { credentials: 'include' }
    );
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    return data;
  } catch (error: any) {
    console.error('Bridge history error:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch bridge history',
      code: 'BRIDGE_HISTORY_ERROR',
    };
  }
}

/**
 * Poll bridge status until completion or failure
 */
export async function pollBridgeStatus(
  transactionId: number,
  onProgress?: (status: string, data?: any) => void,
  maxAttempts: number = 60, // 60 attempts * 5 seconds = 5 minutes
  intervalMs: number = 5000 // Poll every 5 seconds
): Promise<BridgeStatusResponse> {
  let attempts = 0;

  return new Promise((resolve, reject) => {
    const poll = async () => {
      attempts++;

      if (attempts > maxAttempts) {
        reject(new Error('Bridge polling timeout - transaction taking too long'));
        return;
      }

      try {
        const response = await getBridgeStatus(transactionId);

        if (!response.success) {
          reject(new Error(response.error || 'Failed to get bridge status'));
          return;
        }

        const status = response.data?.status;
        onProgress?.(status || 'unknown', response.data);

        // Terminal states
        if (status === 'completed' || status === 'failed') {
          resolve(response);
          return;
        }

        // Continue polling
        setTimeout(poll, intervalMs);
      } catch (error) {
        reject(error);
      }
    };

    poll();
  });
}
