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
    sponsored?: boolean; // Use paymaster
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
    chainId?: number; // Required for Circle Paymaster
}

export interface PaymasterData {
    paymasterAndData: string;
    preVerificationGas?: bigint;
    verificationGasLimit?: bigint;
    callGasLimit?: bigint;
}

// Default ERC-4337 configuration
export const DEFAULT_AA_CONFIG: SmartAccountConfig = {
    entryPoint: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789', // v0.6
    bundlerUrl: '', // Must be provided
    factoryAddress: '', // Must be provided
    accountImplementation: '', // Must be provided
};
