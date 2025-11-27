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
     * Restore state from a stored credential (without WebAuthn interaction)
     * Use this when restoring from localStorage
     */
    restoreFromCredential(credential: PasskeyCredential): Promise<string>;
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
    /**
     * Execute a transaction via the smart account
     * This handles the full ERC-4337 UserOperation flow:
     * 1. Build UserOperation with callData
     * 2. Get gas estimates
     * 3. Sign with passkey
     * 4. Submit to bundler/RPC
     */
    executeTransaction(to: string, value: bigint, data?: string): Promise<{
        hash: string;
        userOpHash?: string;
    }>;
    /**
     * Submit UserOperation via backend relay service
     */
    private submitViaRelay;
    /**
     * Calculate UserOperation hash for signing
     */
    private calculateUserOpHash;
    /**
     * Submit UserOperation to bundler or RPC
     */
    private submitUserOperation;
    /**
     * Wait for UserOperation to be included in a transaction
     */
    private waitForUserOperation;
    private extractSignatureComponents;
    private parseDERSignature;
    private toBase64Url;
    private fromBase64Url;
    private storeCredential;
    private loadCredential;
}
