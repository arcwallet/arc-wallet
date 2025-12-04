/**
 * Multi-Sig On-Chain Execution Service
 * Executes approved multi-sig transactions on the blockchain
 */
export interface ExecutionResult {
    success: boolean;
    txHash?: string;
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
export declare class MultiSigExecutionService {
    private provider;
    private relayerWallet;
    private chainId;
    constructor(rpcUrl: string, chainId?: number);
    /**
     * Initialize with a relayer private key for gas sponsorship
     */
    initRelayer(privateKey: string): void;
    /**
     * Execute an approved multi-sig transaction
     */
    executeTransaction(params: TransactionParams): Promise<ExecutionResult>;
    /**
     * Execute batch transactions
     */
    executeBatch(accountAddress: string, transactions: {
        target: string;
        value: string;
        data: string;
    }[]): Promise<ExecutionResult>;
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