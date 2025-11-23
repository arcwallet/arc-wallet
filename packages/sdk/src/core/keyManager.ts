/**
 * Key Manager - Manages private keys using WebAuthn + Secure Storage
 * Keys are encrypted and stored locally, never exposed
 */

import { Wallet } from 'ethers';
import { WebAuthnManager } from './webauthn';
import { SecureStorage } from './secureStorage';
import type { WalletAccount } from '../types';

export class KeyManager {
  private webauthn: WebAuthnManager;
  private storage: SecureStorage;
  private currentWallet: Wallet | null = null;
  private currentCredentialId: string | null = null;

  constructor(webauthn: WebAuthnManager, storage: SecureStorage) {
    this.webauthn = webauthn;
    this.storage = storage;
  }

  /**
   * Create new wallet with passkey
   */
  async createWallet(userId: string, userName: string): Promise<WalletAccount> {
    try {
      console.log('[KeyManager] Creating new wallet with passkey...');

      // Step 1: Create passkey credential
      const credential = await this.webauthn.createPasskey(userId, userName);

      // Step 2: Generate new Ethereum wallet
      const wallet = Wallet.createRandom();
      const privateKey = wallet.privateKey;
      const address = wallet.address;

      console.log('[KeyManager] Wallet created:', address);

      // Step 3: Derive encryption key from credential
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const encryptionKey = await this.storage.deriveEncryptionKey(credential.id, salt);

      // Step 4: Encrypt and store private key
      await this.storage.storeKey(credential.id, privateKey, encryptionKey);

      // Step 5: Store metadata
      await this.storage.storeMetadata(credential.id, {
        address,
        publicKey: credential.publicKey,
        userId,
        createdAt: credential.createdAt.toISOString(),
        salt: Array.from(salt), // Store salt for key derivation
      });

      console.log('[KeyManager] Wallet secured with passkey');

      // Set as current wallet (Wallet.createRandom() returns HDNodeWallet, which extends Wallet)
      this.currentWallet = wallet as any;
      this.currentCredentialId = credential.id;

      return {
        address,
        credentialId: credential.id,
        publicKey: credential.publicKey,
      };
    } catch (error: any) {
      console.error('[KeyManager] Wallet creation failed:', error);
      throw new Error(`Failed to create wallet: ${error.message}`);
    }
  }

  /**
   * Unlock wallet with passkey authentication
   */
  async unlockWallet(credentialId?: string): Promise<WalletAccount> {
    try {
      console.log('[KeyManager] Unlocking wallet with passkey...');

      // Step 1: Authenticate with passkey
      const authResult = await this.webauthn.authenticate(credentialId);

      if (!authResult.success) {
        throw new Error(authResult.error || 'Authentication failed');
      }

      const activeCredentialId = authResult.credentialId;

      // Step 2: Get metadata
      const metadata = await this.storage.getMetadata(activeCredentialId);
      if (!metadata) {
        throw new Error('Wallet metadata not found');
      }

      // Step 3: Derive encryption key
      const salt = new Uint8Array(metadata.salt);
      const encryptionKey = await this.storage.deriveEncryptionKey(
        activeCredentialId,
        salt
      );

      // Step 4: Decrypt private key
      const privateKey = await this.storage.getKey(activeCredentialId, encryptionKey);
      if (!privateKey) {
        throw new Error('Failed to decrypt private key');
      }

      // Step 5: Create wallet instance
      const wallet = new Wallet(privateKey);

      // Verify address matches
      if (wallet.address.toLowerCase() !== metadata.address.toLowerCase()) {
        throw new Error('Address mismatch - wallet may be corrupted');
      }

      console.log('[KeyManager] Wallet unlocked:', wallet.address);

      // Set as current wallet
      this.currentWallet = wallet;
      this.currentCredentialId = activeCredentialId;

      return {
        address: wallet.address,
        credentialId: activeCredentialId,
        publicKey: metadata.publicKey,
      };
    } catch (error: any) {
      console.error('[KeyManager] Wallet unlock failed:', error);
      throw new Error(`Failed to unlock wallet: ${error.message}`);
    }
  }

  /**
   * Sign transaction with current wallet
   */
  async signTransaction(tx: any): Promise<string> {
    if (!this.currentWallet) {
      throw new Error('No wallet unlocked. Please authenticate first.');
    }

    try {
      console.log('[KeyManager] Signing transaction...');
      const signedTx = await this.currentWallet.signTransaction(tx);
      console.log('[KeyManager] Transaction signed');
      return signedTx;
    } catch (error: any) {
      console.error('[KeyManager] Transaction signing failed:', error);
      throw new Error(`Failed to sign transaction: ${error.message}`);
    }
  }

  /**
   * Sign message with current wallet
   */
  async signMessage(message: string): Promise<string> {
    if (!this.currentWallet) {
      throw new Error('No wallet unlocked. Please authenticate first.');
    }

    try {
      console.log('[KeyManager] Signing message...');
      const signature = await this.currentWallet.signMessage(message);
      console.log('[KeyManager] Message signed');
      return signature;
    } catch (error: any) {
      console.error('[KeyManager] Message signing failed:', error);
      throw new Error(`Failed to sign message: ${error.message}`);
    }
  }

  /**
   * Get current wallet address
   */
  getCurrentAddress(): string | null {
    return this.currentWallet?.address || null;
  }

  /**
   * Get current credential ID
   */
  getCurrentCredentialId(): string | null {
    return this.currentCredentialId;
  }

  /**
   * Lock wallet (clear from memory)
   */
  lock(): void {
    this.currentWallet = null;
    this.currentCredentialId = null;
    console.log('[KeyManager] Wallet locked');
  }

  /**
   * Delete wallet permanently
   */
  async deleteWallet(credentialId: string): Promise<void> {
    try {
      await this.storage.deleteKey(credentialId);
      await this.storage.storeMetadata(credentialId, null);

      if (this.currentCredentialId === credentialId) {
        this.lock();
      }

      console.log('[KeyManager] Wallet deleted');
    } catch (error: any) {
      console.error('[KeyManager] Wallet deletion failed:', error);
      throw new Error(`Failed to delete wallet: ${error.message}`);
    }
  }

  /**
   * Check if wallet exists
   */
  async hasWallet(credentialId: string): Promise<boolean> {
    return await this.storage.hasKey(credentialId);
  }

  /**
   * Get all wallet metadata (without private keys)
   */
  async getAllWallets(): Promise<Array<{ credentialId: string; metadata: any }>> {
    // This would require iterating through IndexedDB keys
    // For now, return empty array - can be implemented later
    return [];
  }
}
