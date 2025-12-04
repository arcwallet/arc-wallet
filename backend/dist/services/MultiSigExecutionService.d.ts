/**
 * Multi-Sig On-Chain Execution Service
 * Uses existing BundlerService for ERC-4337 UserOperation execution
 * Integrates with Arc Wallet's passkey-based smart accounts
 */
export interface ExecutionResult {
    success: boolean;
    txHash?: string;
    userOpHash?: string;
    error?: string;
    gasUsed?: string;
}
export interface TransactionParams {
    accountAddress: string;
    targetAddress: string;
    value: string;
    tokenAddress?: string | null;
    tokenSymbol?: string;
    data?: string | null;
}
export interface PreparedUserOp {
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
    userOpHash: string;
}
export declare class MultiSigExecutionService {
    private provider;
    private chainId;
    private entryPointAddress;
    constructor(rpcUrl: string, chainId?: number);
    /**
     * Prepare a UserOperation for multi-sig transaction
     * Returns the UserOp that needs to be signed by passkeys on frontend
     */
    prepareUserOperation(params: TransactionParams): Promise<PreparedUserOp | null>;
    /**
     * Execute UserOperation via existing BundlerService
     * Called after all required passkey signatures are collected on frontend
     */
    executeUserOperation(preparedOp: PreparedUserOp, aggregatedSignature: string): Promise<ExecutionResult>;
    /**
     * Simple execution for when signatures are ready
     * Prepares and executes in one call
     */
    executeTransaction(params: TransactionParams, aggregatedSignature: string): Promise<ExecutionResult>;
    /**
     * Build callData for execute function
     */
    private _buildCallData;
    /**
     * Calculate UserOp hash for signing
     */
    private _calculateUserOpHash;
    /**
     * Wait for UserOp receipt via bundler
     */
    private _waitForReceipt;
    /**
     * Check if account has enough balance for transaction
     */
    checkBalance(accountAddress: string, value: string, tokenAddress?: string): Promise<boolean>;
    /**
     * Get account contract info
     */
    getAccountInfo(accountAddress: string): Promise<{
        threshold: number;
        keyCount: number;
        balance: string;
    } | null>;
}
export declare const getExecutionService: () => MultiSigExecutionService;
export default MultiSigExecutionService;
//# sourceMappingURL=MultiSigExecutionService.d.ts.map