/**
 * Pimlico ERC-4337 Bundler & Paymaster Client
 *
 * Arc Testnet IS supported by Pimlico!
 * Chain ID: 5042002, Slug: arc-testnet
 *
 * This client provides:
 * - UserOperation bundling via eth_sendUserOperation
 * - Gas estimation via eth_estimateUserOperationGas
 * - Paymaster sponsorship via pm_sponsorUserOperation
 */

import { PIMLICO_CONFIG, ARC_TESTNET } from '../config/app.config';

interface UserOperation {
    sender: string;
    nonce: string;
    initCode: string;
    callData: string;
    callGasLimit: string;
    verificationGasLimit: string;
    preVerificationGas: string;
    maxFeePerGas: string;
    maxPriorityFeePerGas: string;
    paymasterAndData: string;
    signature: string;
}

interface GasEstimate {
    callGasLimit: string;
    verificationGasLimit: string;
    preVerificationGas: string;
}

interface PaymasterResult {
    paymasterAndData: string;
    callGasLimit?: string;
    verificationGasLimit?: string;
    preVerificationGas?: string;
}

interface UserOperationReceipt {
    userOpHash: string;
    sender: string;
    nonce: string;
    actualGasCost: string;
    actualGasUsed: string;
    success: boolean;
    logs: any[];
    receipt: {
        transactionHash: string;
        blockNumber: string;
        blockHash: string;
    };
}

class PimlicoClient {
    private bundlerUrl: string;
    private paymasterUrl: string;
    private entryPoint: string;
    private enabled: boolean;

    constructor() {
        this.bundlerUrl = PIMLICO_CONFIG.bundlerUrl;
        this.paymasterUrl = PIMLICO_CONFIG.paymasterUrl;
        this.entryPoint = PIMLICO_CONFIG.entryPoint;
        this.enabled = PIMLICO_CONFIG.enabled;

        if (this.enabled) {
            console.log('[Pimlico] Initialized for Arc Testnet (chain ID: 5042002)');
            console.log('[Pimlico] Bundler URL:', this.bundlerUrl.replace(/apikey=.*/, 'apikey=***'));
        } else {
            console.warn('[Pimlico] Not configured - VITE_PIMLICO_API_KEY is missing');
        }
    }

    /**
     * Check if Pimlico is configured with API key
     */
    isConfigured(): boolean {
        return this.enabled && !!PIMLICO_CONFIG.apiKey;
    }

    /**
     * Make JSON-RPC request to Pimlico
     */
    private async rpcCall(url: string, method: string, params: any[]): Promise<any> {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                jsonrpc: '2.0',
                method,
                params,
                id: Date.now(),
            }),
        });

        const data = await response.json();

        if (data.error) {
            console.error(`[Pimlico] RPC Error (${method}):`, data.error);
            throw new Error(data.error.message || 'Pimlico RPC error');
        }

        return data.result;
    }

    /**
     * Get supported EntryPoints from bundler
     */
    async getSupportedEntryPoints(): Promise<string[]> {
        if (!this.isConfigured()) {
            throw new Error('Pimlico not configured');
        }
        return this.rpcCall(this.bundlerUrl, 'eth_supportedEntryPoints', []);
    }

    /**
     * Estimate gas for UserOperation
     */
    async estimateUserOperationGas(userOp: Partial<UserOperation>): Promise<GasEstimate> {
        if (!this.isConfigured()) {
            throw new Error('Pimlico not configured');
        }

        const result = await this.rpcCall(
            this.bundlerUrl,
            'eth_estimateUserOperationGas',
            [userOp, this.entryPoint]
        );

        return {
            callGasLimit: result.callGasLimit,
            verificationGasLimit: result.verificationGasLimit,
            preVerificationGas: result.preVerificationGas,
        };
    }

    /**
     * Send UserOperation to bundler
     */
    async sendUserOperation(userOp: UserOperation): Promise<string> {
        if (!this.isConfigured()) {
            throw new Error('Pimlico not configured');
        }

        console.log('[Pimlico] Sending UserOperation to bundler...');
        const userOpHash = await this.rpcCall(
            this.bundlerUrl,
            'eth_sendUserOperation',
            [userOp, this.entryPoint]
        );

        console.log('[Pimlico] UserOperation submitted:', userOpHash);
        return userOpHash;
    }

    /**
     * Get UserOperation by hash
     */
    async getUserOperationByHash(hash: string): Promise<any> {
        if (!this.isConfigured()) {
            throw new Error('Pimlico not configured');
        }
        return this.rpcCall(this.bundlerUrl, 'eth_getUserOperationByHash', [hash]);
    }

    /**
     * Get UserOperation receipt
     */
    async getUserOperationReceipt(hash: string): Promise<UserOperationReceipt | null> {
        if (!this.isConfigured()) {
            throw new Error('Pimlico not configured');
        }
        return this.rpcCall(this.bundlerUrl, 'eth_getUserOperationReceipt', [hash]);
    }

    /**
     * Wait for UserOperation to be included in a block
     */
    async waitForUserOperation(
        hash: string,
        timeout: number = 60000
    ): Promise<UserOperationReceipt> {
        const startTime = Date.now();
        const pollInterval = 2000; // 2 seconds

        while (Date.now() - startTime < timeout) {
            try {
                const receipt = await this.getUserOperationReceipt(hash);
                if (receipt) {
                    console.log('[Pimlico] UserOperation confirmed:', receipt.receipt.transactionHash);
                    return receipt;
                }
            } catch (error) {
                // Receipt not available yet, continue polling
            }

            await new Promise(resolve => setTimeout(resolve, pollInterval));
        }

        throw new Error(`UserOperation ${hash} not confirmed within ${timeout}ms`);
    }

    /**
     * Sponsor UserOperation via Pimlico Paymaster (Verifying Paymaster)
     * This will pay for the user's gas fees
     */
    async sponsorUserOperation(userOp: Partial<UserOperation>): Promise<PaymasterResult> {
        if (!this.isConfigured()) {
            throw new Error('Pimlico not configured');
        }

        console.log('[Pimlico] Requesting paymaster sponsorship...');

        // Use pm_sponsorUserOperation for Pimlico's verifying paymaster
        const result = await this.rpcCall(
            this.paymasterUrl,
            'pm_sponsorUserOperation',
            [userOp, this.entryPoint]
        );

        console.log('[Pimlico] Sponsorship approved');
        return {
            paymasterAndData: result.paymasterAndData,
            callGasLimit: result.callGasLimit,
            verificationGasLimit: result.verificationGasLimit,
            preVerificationGas: result.preVerificationGas,
        };
    }

    /**
     * Get paymaster stub data (for gas estimation before signing)
     */
    async getPaymasterStubData(userOp: Partial<UserOperation>): Promise<PaymasterResult> {
        if (!this.isConfigured()) {
            throw new Error('Pimlico not configured');
        }

        // Use pm_getPaymasterStubData for estimation
        try {
            const result = await this.rpcCall(
                this.paymasterUrl,
                'pm_getPaymasterStubData',
                [userOp, this.entryPoint, `0x${ARC_TESTNET.chainId.toString(16)}`]
            );

            return {
                paymasterAndData: result.paymasterAndData || result.paymaster || '0x',
                callGasLimit: result.callGasLimit,
                verificationGasLimit: result.verificationGasLimit,
                preVerificationGas: result.preVerificationGas,
            };
        } catch (error) {
            // Fallback: return empty paymaster data
            console.warn('[Pimlico] getPaymasterStubData failed, using empty data');
            return { paymasterAndData: '0x' };
        }
    }

    /**
     * Validate sponsorship policy
     */
    async validateSponsorshipPolicy(): Promise<{ valid: boolean; reason?: string }> {
        if (!this.isConfigured()) {
            return { valid: false, reason: 'Pimlico not configured (missing API key)' };
        }

        try {
            // Check if bundler is reachable
            const entryPoints = await this.getSupportedEntryPoints();
            if (entryPoints.length === 0) {
                return { valid: false, reason: 'No supported entry points' };
            }
            return { valid: true };
        } catch (error: any) {
            return { valid: false, reason: error.message };
        }
    }

    /**
     * Get current gas prices from Pimlico
     */
    async getGasPrices(): Promise<{
        slow: { maxFeePerGas: string; maxPriorityFeePerGas: string };
        standard: { maxFeePerGas: string; maxPriorityFeePerGas: string };
        fast: { maxFeePerGas: string; maxPriorityFeePerGas: string };
    }> {
        if (!this.isConfigured()) {
            throw new Error('Pimlico not configured');
        }

        // Use pimlico_getUserOperationGasPrice for accurate gas prices
        const result = await this.rpcCall(
            this.bundlerUrl,
            'pimlico_getUserOperationGasPrice',
            []
        );

        return {
            slow: result.slow,
            standard: result.standard,
            fast: result.fast,
        };
    }

    /**
     * Check bundler health
     */
    async checkHealth(): Promise<boolean> {
        if (!this.isConfigured()) {
            return false;
        }

        try {
            const entryPoints = await this.getSupportedEntryPoints();
            return entryPoints.length > 0;
        } catch {
            return false;
        }
    }

    /**
     * Get account nonce from bundler
     */
    async getAccountNonce(sender: string, key: bigint = 0n): Promise<bigint> {
        if (!this.isConfigured()) {
            throw new Error('Pimlico not configured');
        }

        // Use eth_getUserOperationCount for nonce
        const result = await this.rpcCall(
            this.bundlerUrl,
            'eth_getUserOperationCount',
            [sender, this.entryPoint]
        );

        return BigInt(result);
    }

    /**
     * Get EntryPoint address
     */
    getEntryPoint(): string {
        return this.entryPoint;
    }
}

// Export singleton instance
export const pimlicoClient = new PimlicoClient();
