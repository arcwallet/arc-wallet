/**
 * Sepolia ERC-4337 Bundler Service
 *
 * A lightweight bundler implementation for Sepolia testnet.
 * Handles UserOperation validation, bundling, and submission to EntryPoint.
 *
 * This is a separate instance from Arc bundler to handle Sepolia chain
 * with its own RPC, wallet, and configuration.
 */
export interface UserOperation {
    sender: string;
    nonce: string | bigint;
    initCode: string;
    callData: string;
    callGasLimit: string | bigint;
    verificationGasLimit: string | bigint;
    preVerificationGas: string | bigint;
    maxFeePerGas: string | bigint;
    maxPriorityFeePerGas: string | bigint;
    paymasterAndData: string;
    signature: string;
}
export declare class SepoliaBundlerService {
    private provider;
    private bundlerWallet;
    private entryPoint;
    private entryPointAddress;
    private chainId;
    private mempool;
    private isRunning;
    private bundleInterval;
    private readonly BUNDLE_INTERVAL;
    private readonly MAX_BUNDLE_SIZE;
    private readonly MEMPOOL_EXPIRY;
    constructor();
    /**
     * Start the bundler service
     */
    start(): Promise<void>;
    /**
     * Stop the bundler service
     */
    stop(): void;
    /**
     * eth_sendUserOperation - Submit a UserOperation to the mempool
     */
    sendUserOperation(userOp: UserOperation, entryPointAddr: string): Promise<string>;
    /**
     * eth_getUserOperationByHash - Get UserOperation status
     */
    getUserOperationByHash(userOpHash: string): Promise<any>;
    /**
     * eth_getUserOperationReceipt - Get UserOperation receipt
     */
    getUserOperationReceipt(userOpHash: string): Promise<any>;
    /**
     * eth_estimateUserOperationGas - Estimate gas for UserOperation
     */
    estimateUserOperationGas(userOp: Partial<UserOperation>, entryPointAddr: string): Promise<{
        preVerificationGas: string;
        verificationGasLimit: string;
        callGasLimit: string;
    }>;
    /**
     * eth_supportedEntryPoints - Return supported EntryPoints
     */
    getSupportedEntryPoints(): string[];
    /**
     * eth_chainId - Return chain ID
     */
    getChainId(): string;
    /**
     * Process pending UserOperations into a bundle
     */
    private processBundle;
    /**
     * Validate a UserOperation
     */
    private validateUserOperation;
    /**
     * Calculate required prefund for UserOperation
     */
    private calculateRequiredPrefund;
    /**
     * Calculate userOpHash
     */
    private getUserOpHash;
    /**
     * Calculate userOpHash locally (fallback)
     */
    private calculateUserOpHashLocally;
    /**
     * Pack UserOperation for contract call
     */
    private packUserOperation;
    /**
     * Unpack UserOperation for API response
     */
    private unpackUserOperation;
    /**
     * Extract paymaster address from paymasterAndData
     */
    private extractPaymaster;
    /**
     * Clean up expired mempool entries
     */
    private cleanupMempool;
    /**
     * Ensure sufficient deposit in EntryPoint for a sender
     */
    private ensureSufficientDeposit;
    /**
     * Get bundler status
     */
    getStatus(): {
        isRunning: boolean;
        address: string;
        entryPoint: string;
        chainId: number;
        mempoolSize: number;
        pendingCount: number;
    };
    /**
     * Get bundler wallet balance
     */
    getBalance(): Promise<string>;
}
export declare function getSepoliaBundlerService(): SepoliaBundlerService;
export default SepoliaBundlerService;
//# sourceMappingURL=sepoliaBundlerService.d.ts.map