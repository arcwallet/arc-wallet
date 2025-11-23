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
    tokenMessengerAddresses: {
        // Arc Testnet
        412346: '0x...', // TODO: Add actual TokenMessenger address
        // Ethereum Sepolia
        11155111: '0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5',
    },
    usdcAddresses: {
        // Arc Testnet
        412346: '0x...', // TODO: Add actual USDC address
        // Ethereum Sepolia
        11155111: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    },
    domainIds: {
        // Arc Testnet
        412346: 7, // TODO: Verify Arc domain ID
        // Ethereum Sepolia
        11155111: 0,
    },
    attestationServiceUrl: 'https://iris-api.circle.com',
};
