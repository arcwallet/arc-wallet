/**
 * RPC Configuration
 *
 * Handles RPC URL generation with ThirdWeb API key injection
 */

/**
 * Get the Arc Testnet RPC URL
 * If VITE_THIRDWEB_API_KEY is provided, use ThirdWeb RPC
 * Otherwise fall back to public RPC endpoint
 */
export function getArcRpcUrl(): string {
  const thirdwebApiKey = import.meta.env.VITE_THIRDWEB_API_KEY;
  const customRpcUrl = import.meta.env.VITE_ARC_RPC_URL;

  // If custom RPC URL is provided and doesn't contain placeholder
  if (customRpcUrl && !customRpcUrl.includes('${VITE_THIRDWEB_API_KEY}')) {
    return customRpcUrl;
  }

  // If ThirdWeb API key is provided, construct ThirdWeb RPC URL
  if (thirdwebApiKey && thirdwebApiKey !== 'your_thirdweb_api_key_here') {
    return `https://5042002.rpc.thirdweb.com/${thirdwebApiKey}`;
  }

  // Fall back to public Arc Testnet RPC
  console.warn('⚠️ No ThirdWeb API key found. Using public RPC endpoint. For better performance, set VITE_THIRDWEB_API_KEY in .env');
  return 'https://rpc.testnet.arc.network';
}

/**
 * Get the Sepolia RPC URL
 */
export function getSepoliaRpcUrl(): string {
  return import.meta.env.VITE_SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';
}

/**
 * Get RPC URL for any supported chain
 */
export function getRpcUrl(chain: 'arc' | 'sepolia'): string {
  switch (chain) {
    case 'arc':
      return getArcRpcUrl();
    case 'sepolia':
      return getSepoliaRpcUrl();
    default:
      throw new Error(`Unsupported chain: ${chain}`);
  }
}

// Export default Arc RPC URL for backward compatibility
export const DEFAULT_ARC_RPC_URL = getArcRpcUrl();
