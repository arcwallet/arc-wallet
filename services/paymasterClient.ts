import { BACKEND_URL } from '../config/app.config';

/**
 * Paymaster Client
 * Frontend service for interacting with Paymaster API
 */

interface PaymasterStats {
    balance: string;
    balanceFormatted: string;
    dailySpent: string;
    dailySpentFormatted: string;
    totalSponsored: number;
    totalCost: string;
    totalCostFormatted: string;
    topSpenders: Array<{ address: string; count: number; cost: string }>;
    config: any;
}

interface PaymasterBalance {
    balance: string;
    balanceFormatted: string;
    needsFunding: boolean;
}

class PaymasterClient {
    private baseUrl: string;

    constructor() {
        this.baseUrl = BACKEND_URL;
    }

    /**
     * Get paymaster statistics
     */
    async getStats(): Promise<PaymasterStats | null> {
        try {
            const response = await fetch(`${this.baseUrl}/api/paymaster/stats`);
            const data = await response.json();

            if (data.success) {
                return data.data;
            }

            return null;
        } catch (error) {
            console.error('Error fetching paymaster stats:', error);
            return null;
        }
    }

    /**
     * Get paymaster balance
     */
    async getBalance(): Promise<PaymasterBalance | null> {
        try {
            const response = await fetch(`${this.baseUrl}/api/paymaster/balance`);
            const data = await response.json();

            if (data.success) {
                return data.data;
            }

            return null;
        } catch (error) {
            console.error('Error fetching paymaster balance:', error);
            return null;
        }
    }

    /**
     * Check if an address can be sponsored
     */
    async canSponsor(address: string, estimatedCost?: string): Promise<boolean> {
        try {
            const url = new URL(`${this.baseUrl}/api/paymaster/can-sponsor/${address}`);
            if (estimatedCost) {
                url.searchParams.set('estimatedCost', estimatedCost);
            }

            const response = await fetch(url.toString());
            const data = await response.json();

            if (data.success) {
                return data.data.canSponsor;
            }

            return false;
        } catch (error) {
            console.error('Error checking sponsorship:', error);
            return false;
        }
    }

    /**
     * Update whitelist
     */
    async updateWhitelist(addresses: string[], enabled: boolean): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseUrl}/api/paymaster/whitelist`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ addresses, enabled }),
            });

            const data = await response.json();
            return data.success;
        } catch (error) {
            console.error('Error updating whitelist:', error);
            return false;
        }
    }

    /**
     * Update policies
     */
    async updatePolicies(policies: any): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseUrl}/api/paymaster/policies`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(policies),
            });

            const data = await response.json();
            return data.success;
        } catch (error) {
            console.error('Error updating policies:', error);
            return false;
        }
    }

    /**
     * Get policy configuration
     */
    async getConfig(): Promise<any> {
        try {
            const response = await fetch(`${this.baseUrl}/api/paymaster/config`);
            const data = await response.json();

            if (data.success) {
                return data.data;
            }

            return null;
        } catch (error) {
            console.error('Error fetching config:', error);
            return null;
        }
    }
}

export const paymasterClient = new PaymasterClient();
