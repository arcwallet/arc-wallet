/**
 * Key Manager - Manages private keys using WebAuthn + WebCrypto Secure Storage
 * Keys are encrypted with non-extractable master keys, never exposed
 */
import { WebAuthnManager } from './webauthn';
import { SecureStorage } from './secureStorage';
import type { WalletAccount } from '../types';
export declare class KeyManager {
    private webauthn;
    private storage;
    private webCrypto;
    private currentWallet;
    private currentCredentialId;
    constructor(webauthn: WebAuthnManager, storage: SecureStorage);
    /**
     * Create new wallet with passkey
     */
    createWallet(userId: string, userName: string): Promise<WalletAccount>;
    /**
     * Unlock wallet with passkey authentication
     */
    unlockWallet(credentialId?: string): Promise<WalletAccount>;
    /**
     * Sign transaction with current wallet
     */
    signTransaction(tx: any): Promise<string>;
    /**
     * Sign message with current wallet
     */
    signMessage(message: string): Promise<string>;
    /**
     * Get current wallet address
     */
    getCurrentAddress(): string | null;
    /**
     * Get current wallet's private key (only when unlocked)
     * WARNING: Handle with care - never log or expose this value
     */
    getPrivateKey(): string | null;
    /**
     * Get current credential ID
     */
    getCurrentCredentialId(): string | null;
    /**
     * Lock wallet (clear from memory)
     */
    lock(): void;
    /**
     * Delete wallet permanently
     */
    deleteWallet(credentialId: string): Promise<void>;
    /**
     * Check if wallet exists
     */
    hasWallet(credentialId: string): Promise<boolean>;
    /**
     * Recover wallet using existing passkey (when local data is lost)
     * This authenticates with existing passkey and creates a NEW wallet
     * NOTE: This creates a new wallet address since the original private key is lost
     */
    recoverWithExistingPasskey(): Promise<WalletAccount>;
    /**
     * Get all wallet metadata (without private keys)
     */
    getAllWallets(): Promise<Array<{
        credentialId: string;
        metadata: any;
    }>>;
}
