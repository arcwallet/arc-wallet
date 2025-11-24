/**
 * CCTP (Circle Cross-Chain Transfer Protocol) Types
 */
export interface CCTPConfig {
    tokenMessengerAddresses: {
        [chainId: number]: string;
    };
    usdcAddresses: {
        [chainId: number]: string;
    };
    domainIds: {
        [chainId: number]: number;
    };
    attestationServiceUrl?: string;
}
export interface CCTPTransferParams {
    amount: string;
    destinationAddress: string;
    destinationChainId: number;
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
export declare const DEFAULT_CCTP_CONFIG: CCTPConfig;
