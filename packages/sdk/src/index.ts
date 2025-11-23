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

// Core (advanced usage)
export { WebAuthnManager } from './core/webauthn';
export { SecureStorage } from './core/secureStorage';
export { KeyManager } from './core/keyManager';

// Version
export const VERSION = '1.0.0';
