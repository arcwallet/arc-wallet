/**
 * Arc Wallet SDK
 * Passkey-based Ethereum wallet SDK
 *
 * @packageDocumentation
 */

// Main SDK Class
export { WalletSDK } from './wallet/WalletSDK';

// Types
export type {
  WalletSDKConfig,
  WalletAccount,
  TransactionRequest,
  SignedTransaction,
  PasskeyCredential,
  AuthenticationResult,
  WalletEvent,
  WalletEventPayload,
  StorageProvider,
} from './types';

// CCTP Types
export type {
  CCTPConfig,
  CCTPTransferParams,
  CCTPTransferResult,
  CCTPAttestation,
} from './types/cctp';

export { DEFAULT_CCTP_CONFIG } from './types/cctp';

// Account Abstraction Types
export type {
  UserOperation,
  UserOperationRequest,
  UserOperationResult,
  BatchTransaction,
  SmartAccountConfig,
  PaymasterConfig,
  PaymasterData,
} from './types/account-abstraction';

export { DEFAULT_AA_CONFIG } from './types/account-abstraction';

// Core (advanced usage)
export { WebAuthnManager } from './core/webauthn';
export { SecureStorage } from './core/secureStorage';
export { KeyManager } from './core/keyManager';
export { CCTPManager } from './core/cctpManager';
export { SmartAccountManager } from './core/smartAccountManager';

// Version
export const VERSION = '1.0.0';
