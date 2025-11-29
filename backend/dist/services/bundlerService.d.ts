/**
 * ERC-4337 Bundler Service
 *
 * A lightweight bundler implementation for Arc Wallet.
 * Handles UserOperation validation, bundling, and submission to EntryPoint.
 *
 * Flow:
 * 1. User submits UserOperation via eth_sendUserOperation
 * 2. Bundler validates the UserOperation
 * 3. Bundler bundles it and calls EntryPoint.handleOps()
 * 4. Returns userOpHash for tracking
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
export declare class BundlerService {
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
    private readonly MIN_STAKE;
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
     * Validate token transfer has sufficient balance
     * Parses callData to detect ERC20 transfers and checks sender balance
     *
     * NOTE: For undeployed wallets (with initCode), we skip validation because:
     * 1. The wallet address is a counterfactual address (not yet deployed)
     * 2. Funds may be pre-deposited to the counterfactual address
     * 3. The EntryPoint will handle the actual validation during execution
     */
    private validateTokenTransfer;
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
     * Analyze WebAuthn/Passkey signature for debugging
     * Expected format: abi.encode(bytes authenticatorData, string clientDataJSON, uint256 challengeIndex, uint256 typeIndex, uint256 r, uint256 s)
     */
    private analyzeSignature;
    /**
     * Clean up expired mempool entries
     */
    private cleanupMempool;
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
export declare function getBundlerService(): BundlerService;
export default BundlerService;
//# sourceMappingURL=bundlerService.d.ts.map