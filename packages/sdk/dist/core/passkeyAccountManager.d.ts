/**
 * PasskeyAccountManager - Manages Passkey-based Smart Contract Wallets
 *
 * Architecture:
 * - Passkey (P256) IS the signing key
 * - No separate private key stored anywhere
 * - Smart contract verifies P256 signatures on-chain
 */
export interface PasskeyAccountConfig {
    factoryAddress: string;
    entryPointAddress: string;
    rpcUrl: string;
    backendUrl: string;
    rpId: string;
    rpName: string;
}
export interface PasskeyCredential {
    credentialId: string;
    publicKeyX: string;
    publicKeyY: string;
    userId: string;
}
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
export declare class PasskeyAccountManager {
    private provider;
    private factory;
    private config;
    private currentCredential;
    private accountAddress;
    constructor(config: PasskeyAccountConfig);
    /**
     * Create new passkey and get account address
     */
    createAccount(userId: string, userName: string): Promise<{
        address: string;
        credential: PasskeyCredential;
    }>;
    /**
     * Connect with existing passkey
     * @param username Optional username/email to find specific credentials
     */
    connect(username?: string): Promise<{
        address: string;
        credential: PasskeyCredential;
    }>;
    /**
     * Sign UserOperation with passkey
     */
    signUserOperation(_userOp: Omit<UserOperation, 'signature'>, userOpHash: string): Promise<string>;
    /**
     * Get current account address
     */
    getAccountAddress(): string | null;
    /**
     * Get current credential
     */
    getCurrentCredential(): PasskeyCredential | null;
    /**
     * Check if account is deployed
     */
    isAccountDeployed(): Promise<boolean>;
    /**
     * Get account nonce
     */
    getAccountNonce(): Promise<bigint>;
    /**
     * Build init code for account deployment
     */
    getInitCode(): string;
    private extractSignatureComponents;
    private parseDERSignature;
    private toBase64Url;
    private fromBase64Url;
    private storeCredential;
    private loadCredential;
}
