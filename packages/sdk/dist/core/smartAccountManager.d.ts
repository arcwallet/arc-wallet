/**
 * Smart Account Manager - Handles ERC-4337 Account Abstraction
 */
import type { JsonRpcProvider, Wallet } from 'ethers';
import type { UserOperation, UserOperationRequest, UserOperationResult, BatchTransaction, SmartAccountConfig, PaymasterConfig } from '../types/account-abstraction';
export declare class SmartAccountManager {
    private config;
    private provider;
    private paymasterConfig?;
    private circlePaymaster?;
    private accountAddress;
    constructor(provider: JsonRpcProvider, config?: Partial<SmartAccountConfig>, paymasterConfig?: PaymasterConfig);
    /**
     * Get counterfactual Smart Account address
     */
    getAccountAddress(owner: string): string;
    /**
     * Check if Smart Account is deployed
     */
    isDeployed(address: string): Promise<boolean>;
    /**
     * Build UserOperation for single transaction
     */
    buildUserOperation(wallet: Wallet, request: UserOperationRequest): Promise<UserOperation>;
    /**
     * Build UserOperation for batch transactions
     */
    buildBatchUserOperation(wallet: Wallet, transactions: BatchTransaction[], sponsored?: boolean): Promise<UserOperation>;
    /**
     * Send UserOperation to bundler
     */
    sendUserOperation(userOp: UserOperation): Promise<UserOperationResult>;
    /**
     * Build initCode for account deployment
     */
    private buildInitCode;
    /**
     * Sign UserOperation
     */
    private signUserOperation;
    /**
     * Get UserOperation hash
     */
    private getUserOpHash;
    /**
     * Pack UserOperation for hashing
     */
    private packUserOp;
    /**
     * Serialize UserOperation for JSON-RPC
     */
    private serializeUserOp;
    /**
     * Get paymaster sponsorship data
     */
    private getPaymasterData;
    /**
     * Create Circle-compatible smart account (MSCA)
     */
    createCircleMSCA(owner: string, signer: Wallet): Promise<string>;
}
