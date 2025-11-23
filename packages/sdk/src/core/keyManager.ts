/**
 * Key Manager - Manages private keys using WebAuthn + WebCrypto Secure Storage
 * Keys are encrypted with non-extractable master keys, never exposed
 */

import { Wallet } from 'ethers';
import { WebAuthnManager } from './webauthn';
import { SecureStorage } from './secureStorage';
import { WebCryptoMasterKeyManager } from './webCryptoMasterKey';
import type { WalletAccount } from '../types';
import { logger } from '../utils/logger';

export class KeyManager {
  private webauthn: WebAuthnManager;
  private storage: SecureStorage;
  private webCrypto: WebCryptoMasterKeyManager;
  private currentWallet: Wallet | null = null;
  private currentCredentialId: string | null = null;

  constructor(webauthn: WebAuthnManager, storage: SecureStorage) {
    this.webauthn = webauthn;
    this.storage = storage;
    this.webCrypto = new WebCryptoMasterKeyManager();
  }

  /**
   * Create new wallet with passkey
   */
  async createWallet(userId: string, userName: string): Promise<WalletAccount> {
    try {
      logger.info('Creating new wallet with passkey', { component: 'KeyManager', action: 'createWallet' });

      // Step 1: Create passkey credential
      const credential = await this.webauthn.createPasskey(userId, userName);

      // Step 2: Generate WebCrypto non-extractable master key
      await this.webCrypto.generateMasterKey(credential.id);
      logger.info('WebCrypto master key generated (non-extractable)', { component: 'KeyManager' });

      // Step 3: Generate new Ethereum wallet
      const wallet = Wallet.createRandom();
      const privateKey = wallet.privateKey;
      const address = wallet.address;

      logger.info('Wallet created', { component: 'KeyManager', address });

      // Step 4: Encrypt private key with WebCrypto non-extractable master key
      const { encrypted, iv } = await this.webCrypto.encrypt(privateKey);

      // Step 5: Store encrypted key (master key stays in WebCrypto, non-extractable)
      await this.storage.storeWebCryptoData(credential.id, {
        encrypted: Array.from(encrypted),
        iv: Array.from(iv),
        address,
        keyType: 'webcrypto-master', // Mark as WebCrypto protected
      });

      // Step 6: Store metadata
      await this.storage.storeMetadata(credential.id, {
        address,
        publicKey: credential.publicKey,
        userId,
        createdAt: credential.createdAt.toISOString(),
        keyType: 'webcrypto-master',
      });

      console.log('[KeyManager] Wallet secured with WebCrypto non-extractable master key');

      // Set as current wallet
      this.currentWallet = wallet as any;
      this.currentCredentialId = credential.id;

      return {
        address,
        credentialId: credential.id,
        publicKey: credential.publicKey,
      };
    } catch (error: any) {
      logger.error('Wallet creation failed', error instanceof Error ? error : undefined, { component: 'KeyManager' });
      throw new Error(`Failed to create wallet: ${error.message}`);
    }
  }

  /**
   * Unlock wallet with passkey authentication
   */
  async unlockWallet(credentialId?: string): Promise<WalletAccount> {
    try {
      logger.info('Unlocking wallet with passkey', { component: 'KeyManager', action: 'unlockWallet' });

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

      // Step 3: Check key type and decrypt accordingly
      const keyData = await this.storage.getKeyData(activeCredentialId);
      if (!keyData) {
        throw new Error('Wallet key data not found');
      }

      let privateKey: string;

      if (keyData.keyType === 'webcrypto-master') {
        // New WebCrypto approach
        console.log('[KeyManager] Using WebCrypto master key for decryption');

        // Generate master key
        await this.webCrypto.generateMasterKey(activeCredentialId);

        // Decrypt with non-extractable master key
        const encrypted = new Uint8Array(keyData.encrypted);
        const iv = new Uint8Array(keyData.iv);
        privateKey = await this.webCrypto.decrypt(encrypted, iv);
      } else {
        // Legacy approach (backward compatibility)
        console.log('[KeyManager] Using legacy decryption method');

        const salt = new Uint8Array(metadata.salt || []);
        const encryptionKey = await this.storage.deriveEncryptionKey(
          activeCredentialId,
          salt
        );
        const decrypted = await this.storage.getKey(activeCredentialId, encryptionKey);
        if (!decrypted) {
          throw new Error('Failed to decrypt private key');
        }
        privateKey = decrypted;
      }

      if (!privateKey) {
        throw new Error('Failed to decrypt private key');
      }

      // Step 4: Create wallet instance
      const wallet = new Wallet(privateKey);

      // Verify address matches
      if (wallet.address.toLowerCase() !== metadata.address.toLowerCase()) {
        throw new Error('Address mismatch - wallet may be corrupted');
      }

      logger.info('Wallet unlocked', { component: 'KeyManager', address: wallet.address });

      // Set as current wallet
      this.currentWallet = wallet;
      this.currentCredentialId = activeCredentialId;

      return {
        address: wallet.address,
        credentialId: activeCredentialId,
        publicKey: metadata.publicKey,
      };
    } catch (error: any) {
      logger.error('Wallet unlock failed', error instanceof Error ? error : undefined, { component: 'KeyManager' });
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
      logger.error('Message signing failed', error instanceof Error ? error : undefined, { component: 'KeyManager' });
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
    logger.info('Wallet locked', { component: 'KeyManager' });
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
