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
export { CirclePaymasterClient } from './core/circlePaymaster';
export { CircleApiClient } from './services/circleApi';
export { PasskeyAccountManager } from './core/passkeyAccountManager';
export type { PasskeyAccountConfig, PasskeyCredential as PasskeyAccountCredential } from './core/passkeyAccountManager';

// Utils
export { logger, createLogger, LogLevel } from './utils/logger';
export type { LoggerConfig, LogContext } from './utils/logger';
export { validateCCTPConfig, isArcNetworkConfigured, getCCTPConfigErrorMessage } from './utils/cctpValidator';
export type { CCTPValidationResult } from './utils/cctpValidator';
export { isCircleMSCA } from './utils/mscaDetector';
export { getCircleNetwork, isCCTPSupported, isNativeUSDC, CIRCLE_NETWORKS } from './utils/circleNetworks';
export type { CircleNetwork } from './utils/circleNetworks';
export {
  runPasskeyDiagnostic,
  checkPlatformAuthenticatorSupport,
  isHighRiskDevice,
  getDeviceRiskLevel,
  getDiagnosticErrorMessage,
  getPasskeyDiagnosticMode,
  PasskeyDiagnosticError,
  PASSKEY_DIAGNOSTIC_MESSAGES,
} from './utils/passkeyDiagnostic';
export type { PasskeyDiagnosticResult, PasskeyDiagnosticMode } from './utils/passkeyDiagnostic';

// Version
export const VERSION = '1.0.0';
