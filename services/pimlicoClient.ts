/**
 * Pimlico Client - ERC-4337 Bundler & Paymaster
 *
 * Integrates with Pimlico's infrastructure for Arc Testnet:
 * - Bundler: Submit and track UserOperations
 * - Paymaster: Gas sponsorship (Verifying Paymaster)
 */

import { PIMLICO_CONFIG, ARC_TESTNET } from '../config/app.config';

// Types
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
    preVerificationGas: string;
    verificationGasLimit: string;
    callGasLimit: string;
    paymasterVerificationGasLimit?: string;
    paymasterPostOpGasLimit?: string;
}

interface PaymasterSponsorResult {
    paymasterAndData: string;
    preVerificationGas?: string;
    verificationGasLimit?: string;
    callGasLimit?: string;
}

interface UserOpReceipt {
    userOpHash: string;
    entryPoint: string;
    sender: string;
    nonce: string;
    paymaster: string;
    actualGasCost: string;
    actualGasUsed: string;
    success: boolean;
    logs: any[];
    receipt: {
        transactionHash: string;
        transactionIndex: number;
        blockHash: string;
        blockNumber: number;
        from: string;
        to: string;
        gasUsed: string;
        status: string;
    };
}

class PimlicoClient {
    private bundlerUrl: string;
    private paymasterUrl: string;
    private entryPoint: string;
    private chainId: number;
    private apiKey: string;

    constructor() {
        this.apiKey = PIMLICO_CONFIG.apiKey;
        this.bundlerUrl = this.apiKey
            ? `${PIMLICO_CONFIG.bundlerUrl}?apikey=${this.apiKey}`
            : PIMLICO_CONFIG.bundlerUrl;
        this.paymasterUrl = this.apiKey
            ? `${PIMLICO_CONFIG.paymasterUrl}?apikey=${this.apiKey}`
            : PIMLICO_CONFIG.paymasterUrl;
        this.entryPoint = PIMLICO_CONFIG.entryPoint;
        this.chainId = ARC_TESTNET.chainId;
    }

    /**
     * Check if Pimlico is properly configured
     */
    isConfigured(): boolean {
        return !!this.apiKey;
    }

    /**
     * Make JSON-RPC call to bundler
     */
    private async bundlerCall(method: string, params: any[]): Promise<any> {
        const response = await fetch(this.bundlerUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: Date.now(),
                method,
                params,
            }),
        });

        const data = await response.json();

        if (data.error) {
            console.error('[Pimlico] Bundler error:', data.error);
            throw new Error(data.error.message || 'Bundler RPC error');
        }

        return data.result;
    }

    /**
     * Make JSON-RPC call to paymaster
     */
    private async paymasterCall(method: string, params: any[]): Promise<any> {
        const response = await fetch(this.paymasterUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: Date.now(),
                method,
                params,
            }),
        });

        const data = await response.json();

        if (data.error) {
            console.error('[Pimlico] Paymaster error:', data.error);
            throw new Error(data.error.message || 'Paymaster RPC error');
        }

        return data.result;
    }

    // ========== BUNDLER METHODS ==========

    /**
     * Get supported EntryPoints
     */
    async getSupportedEntryPoints(): Promise<string[]> {
        return this.bundlerCall('eth_supportedEntryPoints', []);
    }

    /**
     * Estimate gas for UserOperation
     */
    async estimateUserOperationGas(userOp: UserOperation): Promise<GasEstimate> {
        return this.bundlerCall('eth_estimateUserOperationGas', [
            userOp,
            this.entryPoint,
        ]);
    }

    /**
     * Send UserOperation to bundler
     */
    async sendUserOperation(userOp: UserOperation): Promise<string> {
        console.log('[Pimlico] Sending UserOperation...');
        const userOpHash = await this.bundlerCall('eth_sendUserOperation', [
            userOp,
            this.entryPoint,
        ]);
        console.log('[Pimlico] UserOperation hash:', userOpHash);
        return userOpHash;
    }

    /**
     * Get UserOperation by hash
     */
    async getUserOperationByHash(userOpHash: string): Promise<any> {
        return this.bundlerCall('eth_getUserOperationByHash', [userOpHash]);
    }

    /**
     * Get UserOperation receipt
     */
    async getUserOperationReceipt(userOpHash: string): Promise<UserOpReceipt | null> {
        return this.bundlerCall('eth_getUserOperationReceipt', [userOpHash]);
    }

    /**
     * Wait for UserOperation to be included
     */
    async waitForUserOperation(
        userOpHash: string,
        timeout: number = 60000,
        interval: number = 2000
    ): Promise<UserOpReceipt> {
        const startTime = Date.now();

        while (Date.now() - startTime < timeout) {
            const receipt = await this.getUserOperationReceipt(userOpHash);

            if (receipt) {
                console.log('[Pimlico] UserOperation confirmed:', receipt.receipt.transactionHash);
                return receipt;
            }

            await new Promise(resolve => setTimeout(resolve, interval));
        }

        throw new Error('UserOperation timeout - not included in block');
    }

    // ========== PAYMASTER METHODS (Pimlico Verifying Paymaster) ==========

    /**
     * Get paymaster sponsorship for UserOperation
     * Uses Pimlico's Verifying Paymaster
     */
    async sponsorUserOperation(userOp: UserOperation): Promise<PaymasterSponsorResult> {
        console.log('[Pimlico] Requesting paymaster sponsorship...');

        // Pimlico v2 paymaster method
        const result = await this.paymasterCall('pm_sponsorUserOperation', [
            userOp,
            this.entryPoint,
            {
                sponsorshipPolicyId: 'sp_arc_testnet', // Policy ID for Arc Testnet
            },
        ]);

        console.log('[Pimlico] Paymaster sponsorship received');
        return result;
    }

    /**
     * Get paymaster stub data (for gas estimation)
     */
    async getPaymasterStubData(userOp: UserOperation): Promise<PaymasterSponsorResult> {
        return this.paymasterCall('pm_getPaymasterStubData', [
            userOp,
            this.entryPoint,
            `0x${this.chainId.toString(16)}`,
        ]);
    }

    /**
     * Validate paymaster sponsorship policy
     */
    async validateSponsorshipPolicy(
        userOp: UserOperation,
        policyId: string
    ): Promise<{ valid: boolean; reason?: string }> {
        try {
            await this.paymasterCall('pm_validateSponsorshipPolicies', [
                userOp,
                this.entryPoint,
                [policyId],
            ]);
            return { valid: true };
        } catch (error: any) {
            return { valid: false, reason: error.message };
        }
    }

    // ========== UTILITY METHODS ==========

    /**
     * Get current gas prices from bundler
     */
    async getGasPrices(): Promise<{
        slow: { maxFeePerGas: string; maxPriorityFeePerGas: string };
        standard: { maxFeePerGas: string; maxPriorityFeePerGas: string };
        fast: { maxFeePerGas: string; maxPriorityFeePerGas: string };
    }> {
        return this.bundlerCall('pimlico_getUserOperationGasPrice', []);
    }

    /**
     * Check bundler health
     */
    async checkHealth(): Promise<boolean> {
        try {
            const entryPoints = await this.getSupportedEntryPoints();
            return entryPoints.includes(this.entryPoint.toLowerCase());
        } catch {
            return false;
        }
    }

    /**
     * Get account nonce from EntryPoint
     */
    async getAccountNonce(sender: string, key: bigint = 0n): Promise<bigint> {
        const result = await this.bundlerCall('eth_call', [
            {
                to: this.entryPoint,
                data: this.encodeGetNonce(sender, key),
            },
            'latest',
        ]);
        return BigInt(result);
    }

    /**
     * Encode getNonce call
     */
    private encodeGetNonce(sender: string, key: bigint): string {
        // getNonce(address sender, uint192 key)
        const selector = '0x35567e1a';
        const paddedSender = sender.slice(2).padStart(64, '0');
        const paddedKey = key.toString(16).padStart(64, '0');
        return selector + paddedSender + paddedKey;
    }
}

export const pimlicoClient = new PimlicoClient();
