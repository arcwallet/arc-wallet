/**
 * CCTP Manager - Cross-chain USDC transfer via Circle CCTP
 */
import { JsonRpcProvider, Wallet } from 'ethers';
import type { CCTPConfig, CCTPTransferParams, CCTPTransferResult } from '../types/cctp';
export declare class CCTPManager {
    private config;
    private provider;
    constructor(provider: JsonRpcProvider, config?: Partial<CCTPConfig>);
    /**
     * Transfer USDC cross-chain using CCTP
     */
    transferUSDC(wallet: Wallet, params: CCTPTransferParams): Promise<CCTPTransferResult>;
    /**
     * Get attestation from Circle's attestation service
     */
    getAttestation(messageHash: string): Promise<string>;
    /**
     * Poll for attestation with retries
     */
    private pollForAttestation;
    /**
     * Convert Ethereum address to bytes32 format
     */
    private addressToBytes32;
    /**
     * Extract message hash from transaction receipt
     */
    private extractMessageHash;
    /**
     * Get USDC balance
     */
    getUSDCBalance(address: string, chainId?: number): Promise<string>;
}
