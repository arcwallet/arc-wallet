/**
 * Paymaster Service
 * Handles gas sponsorship for user operations
 */
interface PaymasterData {
    paymasterAddress: string;
    paymasterVerificationGasLimit: bigint;
    postOpGasLimit: bigint;
    paymasterData: string;
}
interface PaymasterStats {
    totalSponsored: number;
    totalCost: bigint;
    dailySpent: bigint;
    balance: bigint;
    topSpenders: Array<{
        address: string;
        count: number;
        cost: bigint;
    }>;
}
interface PaymasterConfig {
    whitelistEnabled: boolean;
    budgetEnabled: boolean;
    rateLimitEnabled: boolean;
    maxCostPerOp: bigint;
    dailyBudget: bigint;
    maxOpsPerHour: number;
}
declare class PaymasterService {
    private provider;
    private paymasterContract;
    private paymasterAddress;
    private paymasterABI;
    constructor();
    /**
     * Check if paymaster is enabled
     */
    isEnabled(): boolean;
    /**
     * Generate paymaster data for a UserOperation
     */
    getPaymasterData(sender: string, estimatedCost: bigint): Promise<PaymasterData | null>;
    /**
     * Check if a UserOperation can be sponsored
     */
    canSponsor(sender: string, estimatedCost: bigint): Promise<boolean>;
    /**
     * Get current paymaster balance
     */
    getBalance(): Promise<bigint>;
    /**
     * Get paymaster statistics
     */
    getStats(): Promise<PaymasterStats>;
    /**
     * Get paymaster configuration
     */
    getConfig(): Promise<PaymasterConfig | null>;
    /**
     * Encode paymaster data for UserOperation
     */
    encodePaymasterData(data: PaymasterData): string;
    /**
     * Check if paymaster needs funding (balance < 1 ETH)
     */
    needsFunding(): Promise<boolean>;
    /**
     * Monitor paymaster balance and alert if low
     */
    monitorBalance(): Promise<void>;
}
export declare const paymasterService: PaymasterService;
export {};
//# sourceMappingURL=paymasterService.d.ts.map