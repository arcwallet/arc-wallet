/**
 * Account Abstraction (ERC-4337) Types
 */
export interface UserOperation {
    sender: string;
    nonce: bigint;
    initCode: string;
    callData: string;
    callGasLimit: bigint;
    verificationGasLimit: bigint;
    preVerificationGas: bigint;
    maxFeePerGas: bigint;
    maxPriorityFeePerGas: bigint;
    paymasterAndData: string;
    signature: string;
}
export interface UserOperationRequest {
    to: string;
    value: string;
    data?: string;
    sponsored?: boolean;
}
export interface BatchTransaction {
    to: string;
    value: string;
    data?: string;
}
export interface UserOperationResult {
    userOpHash: string;
    transactionHash?: string;
    status: 'pending' | 'included' | 'executed' | 'failed';
    receipt?: any;
}
export interface SmartAccountConfig {
    entryPoint: string;
    bundlerUrl: string;
    factoryAddress?: string;
    accountImplementation?: string;
}
export interface PaymasterConfig {
    url: string;
    enabled: boolean;
    type?: 'circle' | 'generic';
    chainId?: number;
}
export interface PaymasterData {
    paymasterAndData: string;
    preVerificationGas?: bigint;
    verificationGasLimit?: bigint;
    callGasLimit?: bigint;
}
export declare const DEFAULT_AA_CONFIG: SmartAccountConfig;
