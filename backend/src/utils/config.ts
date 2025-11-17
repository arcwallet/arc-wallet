import { EnvConfig } from '../types/index.js';
import path from 'path';

export function loadConfig(): EnvConfig {
  // Load environment variables
  const PORT = parseInt(process.env.PORT || '4000', 10);
  const NODE_ENV = process.env.NODE_ENV || 'development';

  // Defaults differ for production vs development to avoid common misconfig
  const isProd = (process.env.NODE_ENV || 'development') === 'production';
  const defaultAllowedOrigins = isProd
    ? ['https://app.arcwallet.network']
    : [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:3001',
        'http://localhost:3000',
        'http://localhost:3002'
      ];

  const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
    : defaultAllowedOrigins;

  const RP_ID = process.env.RP_ID || (isProd ? 'app.arcwallet.network' : 'localhost');
  const RP_NAME = process.env.RP_NAME || 'Arc Wallet';
  const ORIGIN = process.env.ORIGIN || (isProd ? 'https://app.arcwallet.network' : 'http://localhost:5173');
  const MAGIC_LINK_BASE_URL = process.env.MAGIC_LINK_BASE_URL || '';

  const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'wallet.db');

  const SESSION_SECRET = process.env.SESSION_SECRET || 'default-session-secret-change-in-production';
  const JWT_SECRET = process.env.JWT_SECRET || 'default-jwt-secret-change-in-production';

  const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10);
  const RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10);

  // Validate required configuration
  if (NODE_ENV === 'production') {
    if (SESSION_SECRET === 'default-session-secret-change-in-production') {
      throw new Error('SESSION_SECRET must be set in production');
    }
    if (JWT_SECRET === 'default-jwt-secret-change-in-production') {
      throw new Error('JWT_SECRET must be set in production');
    }
  }

  // Validate port
  if (isNaN(PORT) || PORT < 1 || PORT > 65535) {
    throw new Error('PORT must be a valid port number between 1 and 65535');
  }

  // Validate RP_ID
  if (!RP_ID || RP_ID.length === 0) {
    throw new Error('RP_ID is required for WebAuthn');
  }

  const config: EnvConfig = {
    PORT,
    NODE_ENV,
    ALLOWED_ORIGINS,
    RP_ID,
    RP_NAME,
    ORIGIN,
    DB_PATH,
    SESSION_SECRET,
    JWT_SECRET,
    RATE_LIMIT_WINDOW_MS,
    RATE_LIMIT_MAX_REQUESTS,
    MAGIC_LINK_BASE_URL,
  };

  // Log configuration (excluding secrets)
  console.log('Configuration loaded:', {
    ...config,
    SESSION_SECRET: '***',
    JWT_SECRET: '***'
  });

  return config;
}

export function validateConfig(config: EnvConfig): void {
  const requiredFields: (keyof EnvConfig)[] = [
    'PORT',
    'NODE_ENV',
    'ALLOWED_ORIGINS',
    'RP_ID',
    'RP_NAME',
    'ORIGIN',
    'DB_PATH',
    'SESSION_SECRET',
    'JWT_SECRET'
  ];

  for (const field of requiredFields) {
    if (config[field] === undefined || config[field] === null) {
      throw new Error(`Configuration field ${field} is required`);
    }
  }

  // Additional validation
  if (config.ALLOWED_ORIGINS.length === 0) {
    throw new Error('At least one allowed origin must be specified');
  }

  if (config.RATE_LIMIT_WINDOW_MS <= 0) {
    throw new Error('RATE_LIMIT_WINDOW_MS must be positive');
  }

  if (config.RATE_LIMIT_MAX_REQUESTS <= 0) {
    throw new Error('RATE_LIMIT_MAX_REQUESTS must be positive');
  }
}
