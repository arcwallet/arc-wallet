/**
 * Policy Engine
 * Manages sponsorship policies for the Paymaster
 */
interface PolicyConfig {
    whitelist: {
        enabled: boolean;
        addresses: Set<string>;
    };
    rateLimit: {
        enabled: boolean;
        maxOpsPerHour: number;
        tracking: Map<string, {
            count: number;
            resetTime: number;
        }>;
    };
    budget: {
        enabled: boolean;
        maxCostPerOp: bigint;
        dailyBudget: bigint;
        dailySpent: bigint;
        lastReset: number;
    };
}
declare class PolicyEngine {
    private config;
    constructor();
    /**
     * Check all enabled policies
     */
    checkPolicies(sender: string, estimatedCost: bigint): Promise<boolean>;
    /**
     * Add address to whitelist
     */
    addToWhitelist(address: string): void;
    /**
     * Remove address from whitelist
     */
    removeFromWhitelist(address: string): void;
    /**
     * Check if address is whitelisted
     */
    isWhitelisted(address: string): boolean;
    /**
     * Update whitelist policy
     */
    setWhitelistPolicy(enabled: boolean): void;
    /**
     * Update rate limit policy
     */
    setRateLimitPolicy(enabled: boolean, maxOpsPerHour?: number): void;
    /**
     * Update budget policy
     */
    setBudgetPolicy(enabled: boolean, maxCostPerOp?: bigint, dailyBudget?: bigint): void;
    /**
     * Record a sponsored operation
     */
    recordSponsorship(sender: string, actualCost: bigint): void;
    /**
     * Get current policy configuration
     */
    getConfig(): PolicyConfig;
    /**
     * Reset daily budget if needed
     */
    private _resetBudgetIfNeeded;
    /**
     * Update rate limit tracking
     */
    private _updateRateLimit;
}
export declare const policyEngine: PolicyEngine;
export {};
//# sourceMappingURL=policyEngine.d.ts.map