/**
 * Circle API Client
 * Integration with Circle's Web3 Services APIs
 */

import { logger } from '../utils/logger';

export interface CircleApiConfig {
    apiKey: string;
    baseUrl?: string;
}

export interface CircleTransaction {
    id: string;
    state: string;
    amount: string;
    sourceAddress: string;
    destinationAddress: string;
    txHash?: string;
    createDate: string;
}

export class CircleApiClient {
    private config: CircleApiConfig;
    private baseUrl: string;

    constructor(config: CircleApiConfig) {
        this.config = config;
        this.baseUrl = config.baseUrl || 'https://api.circle.com/v1';
    }

    /**
     * Monitor USDC transactions via Circle API
     */
    async getUSDCTransactions(address: string): Promise<CircleTransaction[]> {
        try {
            const response = await fetch(
                `${this.baseUrl}/wallets/${address}/transactions`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.config.apiKey}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            if (!response.ok) {
                throw new Error(`Circle API error: ${response.statusText}`);
            }

            const data = await response.json();
            return data.data || [];
        } catch (error: any) {
            logger.error('Failed to fetch USDC transactions', error, {
                component: 'CircleApiClient',
                address,
            });
            throw error;
        }
    }

    /**
     * Get real-time USDC balance from Circle API
     */
    async getUSDCBalance(address: string, chainId: number): Promise<string> {
        try {
            const response = await fetch(
                `${this.baseUrl}/balances/${address}?chainId=${chainId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.config.apiKey}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            if (!response.ok) {
                throw new Error(`Circle API error: ${response.statusText}`);
            }

            const data = await response.json();
            return data.data?.usdc?.balance || '0';
        } catch (error: any) {
            logger.error('Failed to fetch USDC balance', error, {
                component: 'CircleApiClient',
                address,
                chainId,
            });
            throw error;
        }
    }
}
