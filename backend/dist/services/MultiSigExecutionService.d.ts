/**
 * Multi-Sig On-Chain Execution Service
 * Uses ERC-4337 UserOperations for gasless transaction execution
 * No relayer private key needed - uses bundler + paymaster
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
export interface UserOperationRequest {
    accountAddress: string;
    callData: string;
    signatures: string[];
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
    private bundlerUrl;
    private paymasterUrl;
    constructor(rpcUrl: string, chainId?: number);
    /**
     * Prepare a UserOperation for multi-sig transaction
     * Returns the UserOp that needs to be signed by passkeys
     */
    prepareUserOperation(params: TransactionParams): Promise<PreparedUserOp | null>;
    /**
     * Execute UserOperation with collected signatures
     * Called after all required passkey signatures are collected
     */
    executeUserOperation(preparedOp: PreparedUserOp, aggregatedSignature: string): Promise<ExecutionResult>;
    /**
     * Simple execution using backend's stored signatures
     * For when all signatures are already collected in DB
     */
    executeTransaction(params: TransactionParams, storedSignatures: {
        publicKey: string;
        signature: string;
    }[]): Promise<ExecutionResult>;
    /**
     * Build callData for execute function
     */
    private _buildCallData;
    /**
     * Get paymaster sponsorship data
     */
    private _getPaymasterData;
    /**
     * Calculate UserOp hash for signing
     */
    private _getUserOpHash;
    /**
     * Send UserOp to bundler
     */
    private _sendToBundler;
    /**
     * Wait for UserOp to be included in a block
     */
    private _waitForUserOpReceipt;
    /**
     * Aggregate P256 signatures for multi-sig
     * Format: [keyIndex1][signature1][keyIndex2][signature2]...
     */
    private _aggregateSignatures;
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
    /**
     * Estimate gas for transaction
     */
    estimateGas(params: TransactionParams): Promise<string | null>;
}
export declare const getExecutionService: () => MultiSigExecutionService;
export default MultiSigExecutionService;
//# sourceMappingURL=MultiSigExecutionService.d.ts.map