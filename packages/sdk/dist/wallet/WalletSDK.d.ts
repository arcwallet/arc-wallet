/**
 * Arc Wallet SDK - Main Class
 * Provides a simple API for integrating passkey-based wallets
 */
import { JsonRpcProvider } from 'ethers';
import type { WalletSDKConfig, WalletAccount, TransactionRequest, SignedTransaction, WalletEvent, WalletEventPayload } from '../types';
import type { CCTPTransferParams, CCTPTransferResult } from '../types/cctp';
import type { UserOperationRequest, UserOperationResult, BatchTransaction } from '../types/account-abstraction';
export declare class WalletSDK {
    private webauthn;
    private storage;
    private keyManager;
    private cctpManager;
    private smartAccountManager;
    private provider;
    private eventListeners;
    private currentAccount;
    private accountType;
    constructor(config: WalletSDKConfig);
    /**
     * Create new wallet with passkey
     */
    createWallet(userId: string, userName: string): Promise<WalletAccount>;
    /**
     * Connect to existing wallet (unlock with passkey)
     */
    connect(credentialId?: string): Promise<WalletAccount>;
    /**
     * Disconnect wallet (lock)
     */
    disconnect(): void;
    /**
     * Sign and send transaction
     */
    signTransaction(txRequest: TransactionRequest): Promise<SignedTransaction>;
    /**
     * Sign message
     */
    signMessage(message: string): Promise<string>;
    /**
     * Get current account
     */
    getAccount(): WalletAccount | null;
    /**
     * Get current address
     */
    getAddress(): string | null;
    /**
     * Get private key (only when wallet is unlocked)
     * WARNING: Handle with care - never log or expose this value
     */
    getPrivateKey(): string | null;
    /**
     * Check if wallet is connected
     */
    isConnected(): boolean;
    /**
     * Get provider for advanced usage
     */
    getProvider(): JsonRpcProvider;
    /**
     * Subscribe to events
     */
    on<E extends WalletEvent>(event: E, listener: (payload: WalletEventPayload[E]) => void): void;
    /**
     * Unsubscribe from events
     */
    off<E extends WalletEvent>(event: E, listener: (payload: WalletEventPayload[E]) => void): void;
    /**
     * Emit event
     */
    private emit;
    /**
     * Transfer USDC cross-chain using CCTP
     */
    transferUSDC(params: CCTPTransferParams): Promise<CCTPTransferResult>;
    /**
     * Get USDC balance
     */
    getUSDCBalance(chainId?: number): Promise<string>;
    /**
     * Send UserOperation (Smart Account only)
     */
    sendUserOperation(request: UserOperationRequest): Promise<UserOperationResult>;
    /**
     * Batch transactions (Smart Account only)
     */
    batchTransactions(transactions: BatchTransaction[], sponsored?: boolean): Promise<UserOperationResult>;
    /**
     * Get Smart Account address (counterfactual)
     */
    getSmartAccountAddress(): string | null;
    /**
     * Check if Smart Account is deployed
     */
    isSmartAccountDeployed(): Promise<boolean>;
    /**
     * Delete wallet permanently
     */
    deleteWallet(): Promise<void>;
    /**
     * Recover wallet using existing passkey (when local data is lost)
     * This authenticates with the existing passkey and creates a NEW wallet
     * NOTE: This creates a new wallet address since the original private key is lost
     */
    recoverWithExistingPasskey(): Promise<WalletAccount>;
}
