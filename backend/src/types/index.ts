import {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
  AuthenticatorDevice,
  AuthenticatorTransportFuture
} from '@simplewebauthn/types';

export interface User {
  id: string;
  username: string;
  displayName: string;
  walletAddress?: string;
  encryptedWallet?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PasskeyCredential {
  id: string;
  userId: string;
  credentialID: string;
  credentialPublicKey: Uint8Array;
  counter: number;
  credentialDeviceType: 'singleDevice' | 'multiDevice';
  credentialBackedUp: boolean;
  transports?: AuthenticatorTransportFuture[];
  createdAt: Date;
}

export interface SessionKey {
  id: string;
  userId: string;
  privateKey: string;
  address: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface WebAuthnChallenge {
  id: string;
  challenge: string;
  userId?: string;
  type: 'registration' | 'authentication';
  expiresAt: Date;
  createdAt: Date;
}

export interface BridgeTransaction {
  id: number;
  userId: string;
  sessionKeyAddress: string;
  amount: string;
  direction: 'arc-to-sepolia' | 'sepolia-to-arc';
  token: string;
  status: 'pending' | 'burn_complete' | 'attestation_fetched' | 'mint_complete' | 'completed' | 'failed';
  sourceTxHash?: string;
  destinationTxHash?: string;
  attestation?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

// Multi-sig types
export interface MultiSigAccount {
  id: string;
  name: string;
  address: string | null;
  requiredSignatures: number;
  createdBy: string;
  createdAt: Date;
}

export interface MultiSigMember {
  id: string;
  accountId: string;
  userId: string;
  email: string;
  role: 'owner' | 'signer' | 'viewer';
  status: 'pending' | 'active' | 'removed';
  addedAt: Date;
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
  createdAt: Date;
  expiresAt: Date;
}

export interface MultiSigSignature {
  id: string;
  transactionId: string;
  signerId: string;
  signerAddress: string;
  status: 'approved' | 'rejected';
  signedAt: Date;
}

export interface OAuthAccount {
  id: string;
  userId: string;
  provider: string;
  providerId: string;
  email: string;
  name: string;
  picture?: string;
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface OAuthState {
  state: string;
  provider: string;
  redirectUrl?: string;
  createdAt: number;
  expiresAt: number;
}

// API Request/Response Types
export interface RegistrationStartRequest {
  username: string;
  displayName: string;
}

export interface RegistrationStartResponse {
  options: any; // PublicKeyCredentialCreationOptionsJSON
}

export interface RegistrationFinishRequest {
  username: string;
  credential: RegistrationResponseJSON;
}

export interface RegistrationFinishResponse {
  success: boolean;
  user: {
    id: string;
    username: string;
    displayName: string;
  };
}

export interface AuthenticationStartRequest {
  username?: string;
}

export interface AuthenticationStartResponse {
  options: any; // PublicKeyCredentialRequestOptionsJSON
}

export interface AuthenticationFinishRequest {
  username?: string;
  credential: AuthenticationResponseJSON;
}

export interface AuthenticationFinishResponse {
  success: boolean;
  sessionKey: {
    privateKey: string;
    address: string;
    expiresAt: string;
  };
  user: {
    id: string;
    username: string;
    displayName: string;
  };
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Database Models
export interface UserModel extends User {
  passkeys: PasskeyCredential[];
  sessionKeys: SessionKey[];
}

// Error Types
export class ApiError extends Error {
  public statusCode: number;
  public code: string;

  constructor(message: string, statusCode: number = 500, code: string = 'INTERNAL_ERROR') {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

// Environment Types
export interface EnvConfig {
  PORT: number;
  NODE_ENV: string;
  ALLOWED_ORIGINS: string[];
  RP_ID: string;
  RP_NAME: string;
  ORIGIN: string;
  DB_PATH: string;
  SESSION_SECRET: string;
  JWT_SECRET: string;
  RATE_LIMIT_WINDOW_MS: number;
  RATE_LIMIT_MAX_REQUESTS: number;
  MAGIC_LINK_BASE_URL?: string;
  COOKIE_DOMAIN?: string;
  ARC_RPC_URL: string;
  SEPOLIA_RPC_URL: string;
}
