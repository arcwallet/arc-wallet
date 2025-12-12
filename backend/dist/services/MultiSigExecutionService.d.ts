/**
 * Multi-Sig On-Chain Execution Service
 *
 * NOTE: This legacy service used the old backend bundler.
 * Now using Circle Modular Wallet SDK with ERC-6900 multi-sig on frontend.
 * This file is kept for backwards compatibility but execution methods are disabled.
 * Use ERC6900MultiSigContext and Circle SDK for multi-sig operations.
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
     * @deprecated Use Circle Modular Wallet SDK (ERC6900MultiSigContext) instead
     */
    prepareUserOperation(_params: TransactionParams): Promise<PreparedUserOp | null>;
    /**
     * Execute UserOperation via existing BundlerService
     * @deprecated Use Circle Modular Wallet SDK (ERC6900MultiSigContext) instead
     */
    executeUserOperation(_preparedOp: PreparedUserOp, _aggregatedSignature: string): Promise<ExecutionResult>;
    /**
     * Simple execution for when signatures are ready
     * @deprecated Use Circle Modular Wallet SDK (ERC6900MultiSigContext) instead
     */
    executeTransaction(_params: TransactionParams, _aggregatedSignature: string): Promise<ExecutionResult>;
    /**
     * Wait for UserOp receipt via bundler
     * @deprecated Legacy bundler removed
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