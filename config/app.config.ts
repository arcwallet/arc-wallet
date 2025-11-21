/**
 * Centralized Application Configuration
 * All environment variables and constants should be defined here
 */

// Type-safe environment variable access
const getEnv = (key: string, defaultValue?: string): string => {
    return (import.meta as any).env?.[key] || defaultValue || '';
};

// Environment detection
export const isDevelopment = (import.meta as any).env?.DEV || false;
export const isProduction = (import.meta as any).env?.PROD || false;

// Backend API Configuration
export const BACKEND_URL = getEnv('VITE_BACKEND_URL', 'http://localhost:3001');

// Blockchain Configuration
export const RPC_URL = getEnv('VITE_ARC_RPC_URL', 'https://rpc.testnet.arc.network');
export const ENTRY_POINT = getEnv('VITE_ARC_ENTRY_POINT', '0x0000000000000000000000000000000000000000');

// Explorer Configuration
export const EXPLORER_BASE_URL = getEnv('VITE_EXPLORER_URL', 'https://testnet.arcscan.app');
export const TX_EXPLORER_URL = `${EXPLORER_BASE_URL}/tx/`;
export const ADDRESS_EXPLORER_URL = `${EXPLORER_BASE_URL}/address/`;
export const BLOCK_EXPLORER_URL = `${EXPLORER_BASE_URL}/block/`;

// External Services
export const CIRCLE_FAUCET_URL = 'https://faucet.circle.com/';

// Default Token Icons
export const DEFAULT_TOKEN_ICON = 'https://mintcdn.com/arc-docs/FYqE2_-PsObv0l4x/logo/Arc_Logo_FC.svg?fit=max&auto=format';

// API Endpoints
export const API_ENDPOINTS = {
    history: (address: string, limit: number = 20) => `${BACKEND_URL}/history/${address}?limit=${limit}`,
    webhooks: {
        list: (address: string) => `${BACKEND_URL}/webhooks/${address}`,
        create: () => `${BACKEND_URL}/webhooks`,
        delete: (id: string) => `${BACKEND_URL}/webhooks/${id}`,
        test: (id: string) => `${BACKEND_URL}/webhooks/${id}/test`,
    },
    notifications: {
        vapidKey: () => `${BACKEND_URL}/notifications/vapid-public-key`,
        subscribe: () => `${BACKEND_URL}/notifications/subscribe`,
        test: () => `${BACKEND_URL}/notifications/test`,
    },
    oauth: {
        google: () => `${BACKEND_URL}/auth/google`,
        apple: () => `${BACKEND_URL}/auth/apple`,
        facebook: () => `${BACKEND_URL}/auth/facebook`,
    },
} as const;

// Session Configuration
export const SESSION_CONFIG = {
    ttl: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
    cookieName: 'arc_session',
} as const;

// Rate Limiting (for reference, actual implementation in backend)
export const RATE_LIMITS = {
    general: { windowMs: 15 * 60 * 1000, max: 100 }, // 100 requests per 15 minutes
    auth: { windowMs: 60 * 60 * 1000, max: 5 }, // 5 requests per hour
    registration: { windowMs: 60 * 60 * 1000, max: 5 }, // 5 requests per hour
} as const;

// Gas Configuration
export const GAS_CONFIG = {
    defaultGasLimit: 200000n,
    smartAccountGasLimit: 500000n,
    maxFeePerGasMultiplier: 1.2, // 20% buffer
} as const;

// Transaction Configuration
export const TX_CONFIG = {
    confirmations: 1,
    timeout: 60000, // 60 seconds
    retryAttempts: 3,
    retryDelay: 2000, // 2 seconds
} as const;

// Feature Flags
export const FEATURES = {
    enableBatchTransfers: true,
    enableWebhooks: true,
    enablePushNotifications: true,
    enableSocialLogin: true,
    enableMultiSig: true,
    enableBridge: true,
} as const;

// Validation Rules
export const VALIDATION = {
    minPasswordLength: 8,
    maxPasswordLength: 128,
    minUsernameLength: 3,
    maxUsernameLength: 32,
    emailRegex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
} as const;

// Export all as a single config object for convenience
export const config = {
    isDevelopment,
    isProduction,
    backendUrl: BACKEND_URL,
    rpcUrl: RPC_URL,
    entryPoint: ENTRY_POINT,
    explorer: {
        base: EXPLORER_BASE_URL,
        tx: TX_EXPLORER_URL,
        address: ADDRESS_EXPLORER_URL,
        block: BLOCK_EXPLORER_URL,
    },
    externalServices: {
        circleFaucet: CIRCLE_FAUCET_URL,
    },
    defaultTokenIcon: DEFAULT_TOKEN_ICON,
    api: API_ENDPOINTS,
    session: SESSION_CONFIG,
    rateLimits: RATE_LIMITS,
    gas: GAS_CONFIG,
    tx: TX_CONFIG,
    features: FEATURES,
    validation: VALIDATION,
} as const;

export default config;
