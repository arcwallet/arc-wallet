/**
 * Circle Paymaster Integration
 * Enables gasless transactions with USDC
 */

import { logger } from '../utils/logger';

export interface CirclePaymasterConfig {
    paymasterUrl: string; // Circle Paymaster API
    chainId: number;
    bundlerUrl?: string; // ERC-4337 bundler
}

export class CirclePaymasterClient {
    private config: CirclePaymasterConfig;

    constructor(config: CirclePaymasterConfig) {
        this.config = config;
    }

    /**
     * Get paymaster data for UserOperation
     */
    async getPaymasterData(userOp: any): Promise<{
        paymasterAndData: string;
        preVerificationGas: bigint;
        verificationGasLimit: bigint;
        callGasLimit: bigint;
    }> {
        try {
            // Call Circle Paymaster API
            const response = await fetch(`${this.config.paymasterUrl}/sponsor`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userOp,
                    chainId: this.config.chainId,
                }),
            });

            if (!response.ok) {
                throw new Error('Paymaster request failed');
            }

            const data = await response.json();

            logger.info('Circle Paymaster sponsored transaction', {
                component: 'CirclePaymaster',
                chainId: this.config.chainId,
            });

            return data;
        } catch (error: any) {
            logger.error('Failed to get paymaster sponsorship', error, {
                component: 'CirclePaymaster',
            });
            throw error;
        }
    }
}
