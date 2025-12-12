/**
 * Circle Modular Wallet Configuration
 *
 * This configuration is used by the Circle Modular Wallet SDK
 * for passkey authentication and smart account management.
 */

// Get environment variables with fallbacks
const getEnvVar = (key: string, fallback: string = ''): string => {
  if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
    return (import.meta as any).env[key] || fallback;
  }
  return fallback;
};

export const CIRCLE_CONFIG = {
  // SDK Endpoints
  clientUrl: getEnvVar('VITE_CIRCLE_CLIENT_URL', 'https://modular-sdk.circle.com/v1/rpc/w3s/buidl'),
  clientKey: getEnvVar('VITE_CIRCLE_CLIENT_KEY', ''),

  // Arc Testnet Configuration
  arcTestnet: {
    chainId: 5042002,
    name: 'Arc Testnet',
    rpcUrl: getEnvVar('VITE_ARC_RPC_URL', 'https://rpc.testnet.arc.network'),
    explorerUrl: getEnvVar('VITE_EXPLORER_URL', 'https://testnet.arcscan.app'),
    // Circle SDK network path for Arc Testnet
    // Circle uses chain code "ARC" in their API
    // SDK path follows pattern: /chainName (camelCase for testnets)
    // Examples: /polygonAmoy, /arbitrumSepolia, /baseSepolia
    // For Arc Testnet, likely: /arc or /arcTestnet
    sdkPath: getEnvVar('VITE_CIRCLE_CHAIN_PATH', '/arcTestnet'),
  },

  // Passkey Configuration
  passkey: {
    // RP ID should match the domain where passkeys are registered
    rpId: typeof window !== 'undefined' ? window.location.hostname : 'app.arcwallet.network',
    rpName: 'Arc Wallet',
  },

  // Token Addresses on Arc Testnet
  tokens: {
    usdc: '0x3600000000000000000000000000000000000000' as const,
    eurc: '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a' as const,
    usyc: '0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C' as const,
  },

  // Circle Infrastructure
  faucetUrl: 'https://faucet.circle.com',

  // Feature Flags
  features: {
    gasSponsorship: true, // Arc uses USDC as native gas, no sponsorship needed
    lazyDeployment: true, // Deploy wallet on first transaction
  },
} as const;

// Validate configuration
export function validateCircleConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!CIRCLE_CONFIG.clientKey) {
    errors.push('VITE_CIRCLE_CLIENT_KEY is not set');
  }

  if (!CIRCLE_CONFIG.clientUrl) {
    errors.push('VITE_CIRCLE_CLIENT_URL is not set');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export default CIRCLE_CONFIG;
