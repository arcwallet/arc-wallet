/**
 * Circle Paymaster Integration
 * Enables gasless transactions with USDC
 */
export interface CirclePaymasterConfig {
    paymasterUrl: string;
    chainId: number;
    bundlerUrl?: string;
}
export declare class CirclePaymasterClient {
    private config;
    constructor(config: CirclePaymasterConfig);
    /**
     * Get paymaster data for UserOperation
     */
    getPaymasterData(userOp: any): Promise<{
        paymasterAndData: string;
        preVerificationGas: bigint;
        verificationGasLimit: bigint;
        callGasLimit: bigint;
    }>;
}
