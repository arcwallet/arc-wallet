/**
 * Circle-compatible network configurations
 */

export interface CircleNetwork {
    chainId: number;
    name: string;
    isTestnet: boolean;
    nativeUSDC: boolean; // Native vs bridged USDC
    cctpSupported: boolean;
    rpcUrl?: string;
}

export const CIRCLE_NETWORKS: Record<number, CircleNetwork> = {
    // Ethereum
    1: {
        chainId: 1,
        name: 'Ethereum Mainnet',
        isTestnet: false,
        nativeUSDC: true,
        cctpSupported: true,
    },
    11155111: {
        chainId: 11155111,
        name: 'Sepolia Testnet',
        isTestnet: true,
        nativeUSDC: true,
        cctpSupported: true,
    },

    // Polygon
    137: {
        chainId: 137,
        name: 'Polygon PoS',
        isTestnet: false,
        nativeUSDC: true, // Native USDC, not USDC.e
        cctpSupported: true,
    },

    // Base
    8453: {
        chainId: 8453,
        name: 'Base Mainnet',
        isTestnet: false,
        nativeUSDC: true,
        cctpSupported: true,
    },
    84532: {
        chainId: 84532,
        name: 'Base Sepolia',
        isTestnet: true,
        nativeUSDC: true,
        cctpSupported: true,
    },

    // Arbitrum
    42161: {
        chainId: 42161,
        name: 'Arbitrum One',
        isTestnet: false,
        nativeUSDC: true,
        cctpSupported: true,
    },
    421614: {
        chainId: 421614,
        name: 'Arbitrum Sepolia',
        isTestnet: true,
        nativeUSDC: true,
        cctpSupported: true,
    },

    // Optimism
    10: {
        chainId: 10,
        name: 'Optimism Mainnet',
        isTestnet: false,
        nativeUSDC: true,
        cctpSupported: true,
    },
    11155420: {
        chainId: 11155420,
        name: 'Optimism Sepolia',
        isTestnet: true,
        nativeUSDC: true,
        cctpSupported: true,
    },

    // Avalanche
    43114: {
        chainId: 43114,
        name: 'Avalanche C-Chain',
        isTestnet: false,
        nativeUSDC: true,
        cctpSupported: true,
    },

    // Arc Network (Testnet)
    412346: {
        chainId: 412346,
        name: 'Arc Testnet',
        isTestnet: true,
        nativeUSDC: true, // Assuming native for now
        cctpSupported: true, // Planned support
    }
};

export function getCircleNetwork(chainId: number): CircleNetwork | undefined {
    return CIRCLE_NETWORKS[chainId];
}

export function isCCTPSupported(chainId: number): boolean {
    return CIRCLE_NETWORKS[chainId]?.cctpSupported ?? false;
}

export function isNativeUSDC(chainId: number): boolean {
    return CIRCLE_NETWORKS[chainId]?.nativeUSDC ?? false;
}
