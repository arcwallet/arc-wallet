/**
 * Gas Station Client
 * Frontend service for gas sponsorship
 */

import { BACKEND_URL } from '../config/app.config';

interface GasStationHealth {
    enabled: boolean;
    status: string;
    message: string;
}

interface EligibilityResult {
    eligible: boolean;
    reason: string;
    currentBalance: string;
    dailyUsed: string;
    dailyLimit: string;
}

interface SponsorResult {
    sponsored: boolean;
    txHash?: string;
    amount?: string;
    reason: string;
}

interface GasStationStats {
    enabled: boolean;
    sponsorAddress: string | null;
    sponsorBalance: string;
    globalDailySpent: string;
    globalDailyLimit: string;
    totalUsers: number;
    config: {
        minBalanceThreshold: string;
        topUpAmount: string;
        maxDailyPerUser: string;
    };
}

class GasStationClient {
    private baseUrl: string;

    constructor() {
        this.baseUrl = `${BACKEND_URL}/api/gas-station`;
    }

    /**
     * Check if gas station is operational
     */
    async checkHealth(): Promise<GasStationHealth | null> {
        try {
            const response = await fetch(`${this.baseUrl}/health`);
            const data = await response.json();

            if (data.success) {
                return data.data;
            }
            return null;
        } catch (error) {
            console.error('[GasStation] Health check failed:', error);
            return null;
        }
    }

    /**
     * Check if address is eligible for gas sponsorship
     */
    async checkEligibility(address: string): Promise<EligibilityResult | null> {
        try {
            const response = await fetch(`${this.baseUrl}/eligibility/${address}`);
            const data = await response.json();

            if (data.success) {
                return data.data;
            }
            return null;
        } catch (error) {
            console.error('[GasStation] Eligibility check failed:', error);
            return null;
        }
    }

    /**
     * Request gas sponsorship
     */
    async requestSponsorship(address: string): Promise<SponsorResult> {
        try {
            const response = await fetch(`${this.baseUrl}/sponsor`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address }),
            });

            const data = await response.json();

            if (data.success && data.data) {
                return {
                    sponsored: true,
                    txHash: data.data.txHash,
                    amount: data.data.amount,
                    reason: data.data.message || 'Gas sponsored successfully',
                };
            }

            return {
                sponsored: false,
                reason: data.error || 'Sponsorship request failed',
            };
        } catch (error: any) {
            console.error('[GasStation] Sponsorship request failed:', error);
            return {
                sponsored: false,
                reason: error.message || 'Network error',
            };
        }
    }

    /**
     * Auto-sponsor gas if needed before a transaction
     * Returns whether gas was sponsored and the user can proceed
     */
    async autoSponsor(address: string, estimatedGas?: string): Promise<SponsorResult> {
        try {
            const response = await fetch(`${this.baseUrl}/auto-sponsor`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address, estimatedGas }),
            });

            const data = await response.json();

            if (data.success && data.data) {
                return {
                    sponsored: data.data.sponsored,
                    txHash: data.data.txHash,
                    amount: data.data.amount,
                    reason: data.data.reason,
                };
            }

            return {
                sponsored: false,
                reason: data.error || 'Auto-sponsor failed',
            };
        } catch (error: any) {
            console.error('[GasStation] Auto-sponsor failed:', error);
            return {
                sponsored: false,
                reason: error.message || 'Network error',
            };
        }
    }

    /**
     * Get gas station statistics
     */
    async getStats(): Promise<GasStationStats | null> {
        try {
            const response = await fetch(`${this.baseUrl}/stats`);
            const data = await response.json();

            if (data.success) {
                return data.data;
            }
            return null;
        } catch (error) {
            console.error('[GasStation] Failed to get stats:', error);
            return null;
        }
    }

    /**
     * Check if gas sponsorship is available and user needs it
     * Convenience method for UI
     */
    async shouldShowGasSponsorship(address: string): Promise<{
        show: boolean;
        eligible: boolean;
        balance: string;
        message: string;
    }> {
        const health = await this.checkHealth();

        if (!health || !health.enabled) {
            return {
                show: false,
                eligible: false,
                balance: '0',
                message: 'Gas sponsorship not available',
            };
        }

        const eligibility = await this.checkEligibility(address);

        if (!eligibility) {
            return {
                show: false,
                eligible: false,
                balance: '0',
                message: 'Could not check eligibility',
            };
        }

        return {
            show: true,
            eligible: eligibility.eligible,
            balance: eligibility.currentBalance,
            message: eligibility.reason,
        };
    }
}

export const gasStationClient = new GasStationClient();
