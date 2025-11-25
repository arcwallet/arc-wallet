/**
 * Gas Station Service
 * Provides gas sponsorship for users on Arc Testnet
 *
 * Phase 1: Simple gas top-up model
 * - Backend wallet sends USDC (native gas on Arc) to users
 * - Tracks daily spending limits per user
 * - Configurable thresholds and amounts
 */
/**
 * Initialize the Gas Station service
 */
export declare function initGasStation(): boolean;
/**
 * Check if gas station is operational
 */
export declare function isGasStationEnabled(): boolean;
/**
 * Get sponsor wallet balance
 */
export declare function getSponsorBalance(): Promise<{
    balance: string;
    balanceFormatted: string;
    address: string;
}>;
/**
 * Check if user is eligible for gas sponsorship
 */
export declare function checkEligibility(userAddress: string): Promise<{
    eligible: boolean;
    reason: string;
    currentBalance: string;
    dailyUsed: string;
    dailyLimit: string;
}>;
/**
 * Sponsor gas for a user (send USDC for gas)
 */
export declare function sponsorGas(userAddress: string): Promise<{
    success: boolean;
    txHash?: string;
    amount?: string;
    error?: string;
}>;
/**
 * Get gas station statistics
 */
export declare function getStats(): Promise<{
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
}>;
//# sourceMappingURL=gasStation.d.ts.map