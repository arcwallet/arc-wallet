/**
 * Arc Wallet SDK - Type Definitions
 * @module @arc/wallet-sdk
 */

import type { CCTPConfig } from './cctp';
import type { SmartAccountConfig, PaymasterConfig } from './account-abstraction';

export interface WalletSDKConfig {
  /** Application name for WebAuthn */
  appName: string;

  /** Relying Party ID (usually your domain) */
  rpId: string;

  /** RPC URL for blockchain connection */
  rpcUrl: string;

  /** Optional theme for UI components */
  theme?: 'light' | 'dark';

  /** Optional backend URL for passkey registration */
  backendUrl?: string;

  /** Optional CCTP configuration for cross-chain transfers */
  cctp?: Partial<CCTPConfig>;

  /** Account type: EOA (default) or Smart Account */
  accountType?: 'eoa' | 'smart-account';

  /** Smart Account configuration (required if accountType is 'smart-account') */
  smartAccount?: Partial<SmartAccountConfig>;

  /** Paymaster configuration for gasless transactions */
  paymaster?: PaymasterConfig;
}

export interface PasskeyCredential {
  /** Credential ID from WebAuthn */
  id: string;

  /** Public key in hex format */
  publicKey: string;

  /** User ID associated with this credential */
  userId: string;

  /** Creation timestamp */
  createdAt: Date;
}

export interface WalletAccount {
  /** Ethereum address */
  address: string;

  /** Associated passkey credential ID */
  credentialId: string;

  /** Public key */
  publicKey: string;
}

export interface TransactionRequest {
  /** Recipient address */
  to: string;

  /** Amount in wei or token units */
  value: string;

  /** Transaction data (contract call) */
  data?: string;

  /** Gas limit */
  gasLimit?: bigint;

  /** Max fee per gas */
  maxFeePerGas?: bigint;

  /** Max priority fee per gas */
  maxPriorityFeePerGas?: bigint;
}

export interface SignedTransaction {
  /** Transaction hash */
  hash: string;

  /** Signed transaction data */
  signedTx: string;

  /** From address */
  from: string;

  /** To address */
  to: string;

  /** Transaction value */
  value: string;
}

export interface WebAuthnCredential {
  /** Credential ID (base64url encoded) */
  id: string;

  /** Raw credential ID (ArrayBuffer) */
  rawId: ArrayBuffer;

  /** Authenticator response */
  response: {
    /** Client data JSON */
    clientDataJSON: ArrayBuffer;

    /** Authenticator data */
    attestationObject: ArrayBuffer;
  };

  /** Credential type (always 'public-key') */
  type: 'public-key';
}

export interface AuthenticationResult {
  /** Whether authentication was successful */
  success: boolean;

  /** Credential ID used */
  credentialId: string;

  /** Derived private key (never exposed to app) */
  privateKey?: string;

  /** Error message if failed */
  error?: string;
}

export interface StorageProvider {
  /** Store encrypted data */
  set(key: string, value: any): Promise<void>;

  /** Retrieve encrypted data */
  get<T>(key: string): Promise<T | null>;

  /** Delete data */
  delete(key: string): Promise<void>;

  /** Clear all data */
  clear(): Promise<void>;
}

export type WalletEvent =
  | 'connect'
  | 'disconnect'
  | 'accountsChanged'
  | 'chainChanged'
  | 'transactionSigned'
  | 'error';

export interface WalletEventPayload {
  connect: { address: string };
  disconnect: { reason: string };
  accountsChanged: { accounts: string[] };
  chainChanged: { chainId: number };
  transactionSigned: { hash: string };
  error: { message: string; code?: string };
}
