/**
 * Arc Wallet SDK
 * Passkey-based Ethereum wallet SDK
 *
 * @packageDocumentation
 */
export { WalletSDK } from './wallet/WalletSDK';
export type { WalletSDKConfig, WalletAccount, TransactionRequest, SignedTransaction, PasskeyCredential, AuthenticationResult, WalletEvent, WalletEventPayload, StorageProvider, } from './types';
export type { CCTPConfig, CCTPTransferParams, CCTPTransferResult, CCTPAttestation, } from './types/cctp';
export { DEFAULT_CCTP_CONFIG } from './types/cctp';
export type { UserOperation, UserOperationRequest, UserOperationResult, BatchTransaction, SmartAccountConfig, PaymasterConfig, PaymasterData, } from './types/account-abstraction';
export { DEFAULT_AA_CONFIG } from './types/account-abstraction';
export { WebAuthnManager } from './core/webauthn';
export { SecureStorage } from './core/secureStorage';
export { KeyManager } from './core/keyManager';
export { CCTPManager } from './core/cctpManager';
export { SmartAccountManager } from './core/smartAccountManager';
export { CirclePaymasterClient } from './core/circlePaymaster';
export { CircleApiClient } from './services/circleApi';
export { logger, createLogger, LogLevel } from './utils/logger';
export type { LoggerConfig, LogContext } from './utils/logger';
export { validateCCTPConfig, isArcNetworkConfigured, getCCTPConfigErrorMessage } from './utils/cctpValidator';
export type { CCTPValidationResult } from './utils/cctpValidator';
export { isCircleMSCA } from './utils/mscaDetector';
export { getCircleNetwork, isCCTPSupported, isNativeUSDC, CIRCLE_NETWORKS } from './utils/circleNetworks';
export type { CircleNetwork } from './utils/circleNetworks';
export { runPasskeyDiagnostic, checkPlatformAuthenticatorSupport, isHighRiskDevice, getDeviceRiskLevel, getDiagnosticErrorMessage, getPasskeyDiagnosticMode, PasskeyDiagnosticError, PASSKEY_DIAGNOSTIC_MESSAGES, } from './utils/passkeyDiagnostic';
export type { PasskeyDiagnosticResult, PasskeyDiagnosticMode } from './utils/passkeyDiagnostic';
export declare const VERSION = "1.0.0";
