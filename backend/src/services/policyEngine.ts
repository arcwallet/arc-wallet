/**
 * Policy Engine
 * Manages sponsorship policies for the Paymaster
 */

interface Policy {
    name: string;
    enabled: boolean;
    check(sender: string, estimatedCost: bigint): Promise<boolean>;
}

interface PolicyConfig {
    whitelist: {
        enabled: boolean;
        addresses: Set<string>;
    };
    rateLimit: {
        enabled: boolean;
        maxOpsPerHour: number;
        tracking: Map<string, { count: number; resetTime: number }>;
    };
    budget: {
        enabled: boolean;
        maxCostPerOp: bigint;
        dailyBudget: bigint;
        dailySpent: bigint;
        lastReset: number;
    };
}

class PolicyEngine {
    private config: PolicyConfig;

    constructor() {
        this.config = {
            whitelist: {
                enabled: true,
                addresses: new Set(),
            },
            rateLimit: {
                enabled: false,
                maxOpsPerHour: 10,
                tracking: new Map(),
            },
            budget: {
                enabled: false,
                maxCostPerOp: BigInt('10000000000000000'), // 0.01 ETH
                dailyBudget: BigInt('1000000000000000000'), // 1 ETH
                dailySpent: 0n,
                lastReset: Date.now(),
            },
        };
    }

    /**
     * Check all enabled policies
     */
    async checkPolicies(sender: string, estimatedCost: bigint): Promise<boolean> {
        const policies: Policy[] = [
            new WhitelistPolicy(this.config.whitelist),
            new RateLimitPolicy(this.config.rateLimit),
            new BudgetPolicy(this.config.budget),
        ];

        for (const policy of policies) {
            if (policy.enabled) {
                const passed = await policy.check(sender, estimatedCost);
                if (!passed) {
                    console.log(`❌ Policy check failed: ${policy.name} for ${sender}`);
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * Add address to whitelist
     */
    addToWhitelist(address: string): void {
        this.config.whitelist.addresses.add(address.toLowerCase());
        console.log(`✅ Added ${address} to whitelist`);
    }

    /**
     * Remove address from whitelist
     */
    removeFromWhitelist(address: string): void {
        this.config.whitelist.addresses.delete(address.toLowerCase());
        console.log(`✅ Removed ${address} from whitelist`);
    }

    /**
     * Check if address is whitelisted
     */
    isWhitelisted(address: string): boolean {
        return this.config.whitelist.addresses.has(address.toLowerCase());
    }

    /**
     * Update whitelist policy
     */
    setWhitelistPolicy(enabled: boolean): void {
        this.config.whitelist.enabled = enabled;
        console.log(`✅ Whitelist policy ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Update rate limit policy
     */
    setRateLimitPolicy(enabled: boolean, maxOpsPerHour?: number): void {
        this.config.rateLimit.enabled = enabled;
        if (maxOpsPerHour !== undefined) {
            this.config.rateLimit.maxOpsPerHour = maxOpsPerHour;
        }
        console.log(`✅ Rate limit policy ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Update budget policy
     */
    setBudgetPolicy(
        enabled: boolean,
        maxCostPerOp?: bigint,
        dailyBudget?: bigint
    ): void {
        this.config.budget.enabled = enabled;
        if (maxCostPerOp !== undefined) {
            this.config.budget.maxCostPerOp = maxCostPerOp;
        }
        if (dailyBudget !== undefined) {
            this.config.budget.dailyBudget = dailyBudget;
        }
        console.log(`✅ Budget policy ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Record a sponsored operation
     */
    recordSponsorship(sender: string, actualCost: bigint): void {
        // Update budget
        if (this.config.budget.enabled) {
            this.config.budget.dailySpent += actualCost;
            this._resetBudgetIfNeeded();
        }

        // Update rate limit
        if (this.config.rateLimit.enabled) {
            this._updateRateLimit(sender);
        }
    }

    /**
     * Get current policy configuration
     */
    getConfig(): PolicyConfig {
        return this.config;
    }

    /**
     * Reset daily budget if needed
     */
    private _resetBudgetIfNeeded(): void {
        const now = Date.now();
        const dayInMs = 24 * 60 * 60 * 1000;

        if (now - this.config.budget.lastReset >= dayInMs) {
            this.config.budget.dailySpent = 0n;
            this.config.budget.lastReset = now;
            console.log('✅ Daily budget reset');
        }
    }

    /**
     * Update rate limit tracking
     */
    private _updateRateLimit(sender: string): void {
        const now = Date.now();
        const hourInMs = 60 * 60 * 1000;

        const tracking = this.config.rateLimit.tracking.get(sender);

        if (!tracking || now - tracking.resetTime >= hourInMs) {
            // Reset counter
            this.config.rateLimit.tracking.set(sender, {
                count: 1,
                resetTime: now,
            });
        } else {
            // Increment counter
            tracking.count++;
        }
    }
}

/**
 * Whitelist Policy
 */
class WhitelistPolicy implements Policy {
    name = 'Whitelist';
    enabled: boolean;
    private config: PolicyConfig['whitelist'];

    constructor(config: PolicyConfig['whitelist']) {
        this.config = config;
        this.enabled = config.enabled;
    }

    async check(sender: string): Promise<boolean> {
        return this.config.addresses.has(sender.toLowerCase());
    }
}

/**
 * Rate Limit Policy
 */
class RateLimitPolicy implements Policy {
    name = 'Rate Limit';
    enabled: boolean;
    private config: PolicyConfig['rateLimit'];

    constructor(config: PolicyConfig['rateLimit']) {
        this.config = config;
        this.enabled = config.enabled;
    }

    async check(sender: string): Promise<boolean> {
        const tracking = this.config.tracking.get(sender);

        if (!tracking) {
            return true; // First operation, allow
        }

        const now = Date.now();
        const hourInMs = 60 * 60 * 1000;

        // Check if hour has passed
        if (now - tracking.resetTime >= hourInMs) {
            return true; // Counter will be reset
        }

        // Check if under limit
        return tracking.count < this.config.maxOpsPerHour;
    }
}

/**
 * Budget Policy
 */
class BudgetPolicy implements Policy {
    name = 'Budget';
    enabled: boolean;
    private config: PolicyConfig['budget'];

    constructor(config: PolicyConfig['budget']) {
        this.config = config;
        this.enabled = config.enabled;
    }

    async check(sender: string, estimatedCost: bigint): Promise<boolean> {
        // Check per-operation limit
        if (estimatedCost > this.config.maxCostPerOp) {
            console.log(`❌ Operation cost ${estimatedCost} exceeds max ${this.config.maxCostPerOp}`);
            return false;
        }

        // Check daily budget
        if (this.config.dailySpent + estimatedCost > this.config.dailyBudget) {
            console.log(`❌ Daily budget exceeded: ${this.config.dailySpent} + ${estimatedCost} > ${this.config.dailyBudget}`);
            return false;
        }

        return true;
    }
}

// Export singleton instance
export const policyEngine = new PolicyEngine();
