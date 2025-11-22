import { parseUnits } from 'ethers';

const CIRCLE_API_BASE_URL = (import.meta as any).env.VITE_CIRCLE_WALLETS_API_URL || 'https://api.circle.com/v1/w3s/developer';
const DEBUG = (import.meta as any).env.VITE_SWAP_DEBUG === 'true';

export interface CircleApiConfig {
  apiKey: string;
  entitySecret: string;
}

export interface SwapTransactionParams {
  walletId?: string;
  walletAddress?: string;
  blockchain: string;
  contractAddress: string;
  functionSignature: string;
  abiParameters: any[];
  feeLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
  maxFee?: string;
  priorityFee?: string;
}

export interface CircleTransactionResponse {
  id: string;
  state: 'INITIATED' | 'PENDING_RISK_SCREENING' | 'DENIED' | 'QUEUED' | 'SENT' | 'CONFIRMED' | 'FAILED' | 'CANCELLED';
  txHash?: string;
  operation: 'CONTRACT_EXECUTION';
  amounts: string[];
  destinationAddress: string;
  errorReason?: string;
  blockchain: string;
  createDate: string;
  updateDate: string;
}

export class CircleApiService {
  private config: CircleApiConfig;

  constructor(config: CircleApiConfig) {
    this.config = config;
  }

  private generateIdempotencyKey(): string {
    // Use browser-compatible UUID generation
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  private encryptionCache?: { publicKey: string; fetchedAt: number };

  private async fetchEncryptionPublicKey(): Promise<string> {
    if (this.encryptionCache && Date.now() - this.encryptionCache.fetchedAt < 10 * 60 * 1000) {
      return this.encryptionCache.publicKey;
    }
    const res = await fetch(`${CIRCLE_API_BASE_URL.replace('/developer', '')}/encryption/public`, {
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch Circle encryption key: ${res.status}`);
    }
    const data = await res.json();
    const publicKey = data?.data?.publicKey as string | undefined;
    if (!publicKey) throw new Error('Circle encryption key missing in response');
    this.encryptionCache = { publicKey, fetchedAt: Date.now() };
    return publicKey;
  }

  private async encryptEntitySecret(entitySecret: string): Promise<string> {
    try {
      // Prefer explicit key from env to avoid extra request
      const pem = (import.meta as any)?.env?.VITE_CIRCLE_ENCRYPTION_PUBLIC_KEY as string | undefined;
      const publicKeyPem = pem || (await this.fetchEncryptionPublicKey());

      // Import RSA-OAEP public key from PEM
      const importKey = async (pemKey: string) => {
        const b64 = pemKey.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
        const der = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const key = await crypto.subtle.importKey(
          'spki',
          der.buffer,
          { name: 'RSA-OAEP', hash: 'SHA-256' },
          false,
          ['encrypt']
        );
        return key;
      };

      const key = await importKey(publicKeyPem);
      const enc = new TextEncoder();
      const ciphertext = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, key, enc.encode(entitySecret));
      const bytes = new Uint8Array(ciphertext);
      let binary = '';
      bytes.forEach((b) => (binary += String.fromCharCode(b)));
      return btoa(binary);
    } catch (e) {
      if (DEBUG) console.warn('Encryption fallback to base64 due to error:', e);
      return btoa(entitySecret);
    }
  }

  async executeContractTransaction(params: SwapTransactionParams): Promise<CircleTransactionResponse> {
    try {
      if (DEBUG) {
        console.debug('[Circle API] Executing contract transaction', params);
      }

      const entitySecretCiphertext = await this.encryptEntitySecret(this.config.entitySecret);
      const idempotencyKey = this.generateIdempotencyKey();

      const requestBody = {
        idempotencyKey,
        entitySecretCiphertext,
        walletId: params.walletId,
        walletAddress: params.walletAddress,
        blockchain: params.blockchain,
        contractAddress: params.contractAddress,
        abiFunctionSignature: params.functionSignature,
        abiParameters: params.abiParameters,
        feeLevel: params.feeLevel || 'MEDIUM',
        ...(params.maxFee && { maxFee: params.maxFee }),
        ...(params.priorityFee && { priorityFee: params.priorityFee }),
      };

      if (DEBUG) {
        console.debug('[Circle API] Request:', requestBody);
      }

      const response = await fetch(`${CIRCLE_API_BASE_URL}/transactions/contractExecution`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Circle API error: ${response.status} - ${errorData.message || response.statusText}`);
      }

      const result = await response.json();

      if (DEBUG) {
        console.debug('[Circle API] Response:', result);
      }

      return result.data;
    } catch (error: any) {
      if (DEBUG) {
        console.error('❌ Circle API Error:', error);
      }
      throw new Error(`Failed to execute contract transaction: ${error.message}`);
    }
  }

  async getTransactionStatus(transactionId: string): Promise<CircleTransactionResponse> {
    try {
      const response = await fetch(`${CIRCLE_API_BASE_URL}/transactions/${transactionId}`, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get transaction status: ${response.status}`);
      }

      const result = await response.json();
      return result.data;
    } catch (error: any) {
      throw new Error(`Failed to get transaction status: ${error.message}`);
    }
  }

  async waitForTransactionConfirmation(
    transactionId: string,
    maxWaitTime: number = 300000, // 5 minutes
    pollInterval: number = 5000 // 5 seconds
  ): Promise<CircleTransactionResponse> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      const transaction = await this.getTransactionStatus(transactionId);

      if (transaction.state === 'CONFIRMED') {
        return transaction;
      } else if (transaction.state === 'FAILED' || transaction.state === 'CANCELLED') {
        throw new Error(`Transaction ${transaction.state.toLowerCase()}: ${transaction.errorReason || 'Unknown error'}`);
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error('Transaction confirmation timeout');
  }
}

// Singleton instance
let circleApiService: CircleApiService | null = null;

export function getCircleApiService(): CircleApiService {
  if (!circleApiService) {
    const apiKey = (import.meta as any).env.VITE_CIRCLE_API_KEY;
    const entitySecret = (import.meta as any).env.VITE_CIRCLE_ENTITY_SECRET;

    if (!apiKey || !entitySecret) {
      throw new Error('Circle API credentials not configured. Please set VITE_CIRCLE_API_KEY and VITE_CIRCLE_ENTITY_SECRET environment variables.');
    }

    circleApiService = new CircleApiService({
      apiKey,
      entitySecret,
    });
  }

  return circleApiService;
}