/**
 * Arc Network Gas Client
 *
 * Arc uses USDC as native gas token - NO external bundler/paymaster needed!
 * This file provides a compatibility layer that uses standard transactions.
 *
 * Arc Native Gas Features:
 * - USDC is the native gas token (like ETH on Ethereum)
 * - Target gas fee: ~$0.01 per transaction
 * - No need for ERC-4337 bundlers or paymasters
 * - Standard EVM transactions work directly
 */

import { PIMLICO_CONFIG, ARC_GAS_CONFIG } from '../config/app.config';

// Note: Pimlico does NOT support Arc Testnet
// This client provides a compatibility interface but uses native transactions

class ArcGasClient {
    private enabled: boolean;

    constructor() {
        // Pimlico is disabled for Arc - we use native USDC gas
        this.enabled = PIMLICO_CONFIG.enabled;
    }

    /**
     * Check if external bundler is configured
     * Always returns false for Arc - we use native gas
     */
    isConfigured(): boolean {
        return false; // Arc uses native USDC gas, no external bundler
    }

    /**
     * Check if Arc native gas is being used
     */
    usesNativeGas(): boolean {
        return ARC_GAS_CONFIG.usesNativeGas;
    }

    /**
     * Get gas configuration for Arc
     */
    getGasConfig() {
        return {
            targetGasFee: ARC_GAS_CONFIG.targetGasFee,
            decimals: ARC_GAS_CONFIG.decimals,
            nativeToken: 'USDC',
            message: 'Arc uses USDC as native gas - standard transactions supported',
        };
    }

    /**
     * Legacy bundler methods - Not supported on Arc
     * These throw errors to indicate Arc's native gas should be used
     */

    async getSupportedEntryPoints(): Promise<string[]> {
        console.warn('[ArcGas] Arc uses native USDC gas - no external EntryPoints');
        return [];
    }

    async estimateUserOperationGas(_userOp: any): Promise<any> {
        throw new Error('Arc uses native USDC gas. Use standard eth_estimateGas instead.');
    }

    async sendUserOperation(_userOp: any): Promise<string> {
        throw new Error('Arc uses native USDC gas. Use standard eth_sendTransaction instead.');
    }

    async getUserOperationByHash(_hash: string): Promise<any> {
        throw new Error('Arc uses native USDC gas. Use eth_getTransactionByHash instead.');
    }

    async getUserOperationReceipt(_hash: string): Promise<any> {
        throw new Error('Arc uses native USDC gas. Use eth_getTransactionReceipt instead.');
    }

    async waitForUserOperation(_hash: string): Promise<any> {
        throw new Error('Arc uses native USDC gas. Use standard transaction confirmation.');
    }

    async sponsorUserOperation(_userOp: any): Promise<any> {
        throw new Error('Arc uses native USDC gas - no paymaster sponsorship needed.');
    }

    async getPaymasterStubData(_userOp: any): Promise<any> {
        throw new Error('Arc uses native USDC gas - no paymaster needed.');
    }

    async validateSponsorshipPolicy(): Promise<{ valid: boolean; reason?: string }> {
        return {
            valid: false,
            reason: 'Arc uses native USDC gas - no external sponsorship available',
        };
    }

    async getGasPrices(): Promise<any> {
        // Arc targets ~$0.01 per transaction
        // Return a stub that indicates native gas usage
        return {
            message: 'Arc uses native USDC gas with ~$0.01 target fee',
            standard: {
                maxFeePerGas: '1000000000', // 1 gwei equivalent in USDC terms
                maxPriorityFeePerGas: '100000000',
            },
        };
    }

    async checkHealth(): Promise<boolean> {
        // Always "healthy" since we use native gas
        console.log('[ArcGas] Arc native USDC gas is always available');
        return true;
    }

    async getAccountNonce(_sender: string): Promise<bigint> {
        throw new Error('Use eth_getTransactionCount for nonce on Arc');
    }
}

// Export as pimlicoClient for backwards compatibility
export const pimlicoClient = new ArcGasClient();
