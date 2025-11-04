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
}