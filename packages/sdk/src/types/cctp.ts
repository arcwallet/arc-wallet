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
        11155111: '0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5', // Sepolia
        421614: '0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5',   // Arbitrum Sepolia
        11155420: '0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5', // Optimism Sepolia
        84532: '0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5',    // Base Sepolia

        // ⚠️ CONFIGURATION REQUIRED
        // Arc Network TokenMessenger address must be obtained from Arc Network team
        // Current value is a placeholder and will cause transactions to fail
        412346: '0x0000000000000000000000000000000000000000', // Arc Testnet - PLACEHOLDER
    },

    // USDC contract addresses by chain ID
    usdcAddresses: {
        11155111: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // Sepolia
        421614: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',   // Arbitrum Sepolia
        11155420: '0x5fd84259d66Cd46123540766Be93DFE6D43130D7', // Optimism Sepolia
        84532: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',    // Base Sepolia

        // ⚠️ CONFIGURATION REQUIRED
        // Arc Network USDC address must be obtained from Arc Network team
        // Current value is a placeholder and will cause transactions to fail
        412346: '0x0000000000000000000000000000000000000000', // Arc Testnet - PLACEHOLDER
    },
    domainIds: {
        // Arc Testnet
        412346: 7, // TODO: Verify Arc domain ID
        // Ethereum Sepolia
        11155111: 0,
    },
    attestationServiceUrl: 'https://iris-api.circle.com',
};
