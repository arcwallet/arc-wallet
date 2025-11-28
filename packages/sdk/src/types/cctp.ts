/**
 * CCTP (Circle Cross-Chain Transfer Protocol) Types
 */

export interface CCTPConfig {
    // TokenMessenger contract addresses per chain
    tokenMessengerAddresses: {
        [chainId: number]: string;
    };
    // USDC contract addresses per chain
    usdcAddresses: {
        [chainId: number]: string;
    };
    // Domain IDs for CCTP
    domainIds: {
        [chainId: number]: number;
    };
    // Attestation service URL
    attestationServiceUrl?: string;
}

export interface CCTPTransferParams {
    amount: string; // Amount in USDC (e.g., "100" for 100 USDC)
    destinationAddress: string; // Recipient address on destination chain
    destinationChainId: number; // Destination chain ID
}

export interface CCTPTransferResult {
    sourceTxHash: string;
    messageHash: string;
    attestation?: string;
    destinationTxHash?: string;
    status: 'pending' | 'attested' | 'completed' | 'failed';
}

export interface CCTPAttestation {
    status: string;
    attestation: string;
}

// Default CCTP configuration for Arc Network
export const DEFAULT_CCTP_CONFIG: CCTPConfig = {
    // Token Messenger contract addresses by chain ID
    tokenMessengerAddresses: {
        // TESTNETS
        11155111: '0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5', // Sepolia
        421614: '0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5',   // Arbitrum Sepolia
        11155420: '0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5', // Optimism Sepolia
        84532: '0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5',    // Base Sepolia

        // MAINNETS
        1: '0xBd3fa81B58Ba92a82136038B25aDec7066af3155',      // Ethereum Mainnet
        43114: '0x6b25532e1060CE10cc3B0A99e5683b91BFDe6982',  // Avalanche C-Chain
        10: '0x2B4069517957735bE00ceE0fadAE88a26365528f',     // Optimism Mainnet
        42161: '0x19330d10D9Cc8751218eaf51E8885D058642E08A',  // Arbitrum One
        // Base and Polygon TokenMessenger addresses TBD

        // Arc Testnet CCTP contracts (official addresses from docs.arc.network)
        5042002: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA', // Arc Testnet TokenMessenger
    },

    // USDC contract addresses by chain ID
    usdcAddresses: {
        // TESTNETS
        11155111: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // Sepolia
        421614: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',   // Arbitrum Sepolia
        11155420: '0x5fd84259d66Cd46123540766Be93DFE6D43130D7', // Optimism Sepolia
        84532: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',    // Base Sepolia

        // MAINNETS
        1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',      // Ethereum Mainnet
        137: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',    // Polygon (Native USDC)
        10: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',     // Optimism Mainnet
        42161: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',  // Arbitrum One
        8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',   // Base Mainnet
        43114: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',  // Avalanche C-Chain

        // Arc Testnet USDC (native token address from docs.arc.network)
        5042002: '0x3600000000000000000000000000000000000000', // Arc Testnet USDC (Native)
    },
    domainIds: {
        // TESTNETS
        11155111: 0,  // Sepolia
        421614: 3,    // Arbitrum Sepolia
        11155420: 2,  // Optimism Sepolia
        84532: 6,     // Base Sepolia
        5042002: 26,  // Arc Testnet (official domain from docs.arc.network)

        // MAINNETS
        1: 0,         // Ethereum
        43114: 1,     // Avalanche
        10: 2,        // Optimism
        42161: 3,     // Arbitrum
        8453: 6,      // Base
        137: 7,       // Polygon
    },
    attestationServiceUrl: 'https://iris-api.circle.com',
};
