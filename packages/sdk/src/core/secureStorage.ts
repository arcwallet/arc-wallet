/**
 * Secure Storage - Encrypted key storage using IndexedDB
 * Keys are encrypted with AES-GCM using WebCrypto API
 */

import { get, set, del, clear } from 'idb-keyval';

export interface EncryptedData {
  /** Encrypted data */
  ciphertext: ArrayBuffer;

  /** Initialization vector */
  iv: Uint8Array;

  /** Authentication tag (included in ciphertext for AES-GCM) */
  salt: Uint8Array;
}

export class SecureStorage {
  private readonly ALGORITHM = 'AES-GCM';
  private readonly KEY_LENGTH = 256;
  private readonly IV_LENGTH = 12;
  private readonly SALT_LENGTH = 16;

  /**
   * Derive encryption key from passkey credential
   */
  async deriveEncryptionKey(credentialId: string, salt: Uint8Array): Promise<CryptoKey> {
    // Use PBKDF2 to derive a key from credential ID
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(credentialId),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      {
        name: this.ALGORITHM,
        length: this.KEY_LENGTH,
      },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Store encrypted private key
   */
  async storeKey(
    credentialId: string,
    privateKey: string,
    encryptionKey: CryptoKey
  ): Promise<void> {
    try {
      const encrypted = await this.encrypt(privateKey, encryptionKey);
      await set(`wallet_key_${credentialId}`, encrypted);
      console.log('[SecureStorage] Private key encrypted and stored');
    } catch (error) {
      console.error('[SecureStorage] Failed to store key:', error);
      throw new Error('Failed to store private key securely');
    }
  }

  /**
   * Retrieve and decrypt private key
   */
  async getKey(credentialId: string, encryptionKey: CryptoKey): Promise<string | null> {
    try {
      const encrypted = await get<EncryptedData>(`wallet_key_${credentialId}`);
      if (!encrypted) {
        return null;
      }

      return await this.decrypt(encrypted, encryptionKey);
    } catch (error) {
      console.error('[SecureStorage] Failed to retrieve key:', error);
      return null;
    }
  }

  /**
   * Delete stored key
   */
  async deleteKey(credentialId: string): Promise<void> {
    await del(`wallet_key_${credentialId}`);
  }

  /**
   * Clear all stored keys
   */
  async clearAll(): Promise<void> {
    await clear();
  }

  /**
   * Encrypt data using AES-GCM
   */
  private async encrypt(data: string, key: CryptoKey): Promise<EncryptedData> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);

    // Generate random IV
    const iv = crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));

    // Generate random salt (stored with ciphertext for key derivation)
    const salt = crypto.getRandomValues(new Uint8Array(this.SALT_LENGTH));

    // Encrypt
    const ciphertext = await crypto.subtle.encrypt(
      {
        name: this.ALGORITHM,
        iv,
      },
      key,
      dataBuffer
    );

    return {
      ciphertext,
      iv,
      salt,
    };
  }

  /**
   * Decrypt data using AES-GCM
   */
  private async decrypt(encrypted: EncryptedData, key: CryptoKey): Promise<string> {
    const decrypted = await crypto.subtle.decrypt(
      {
        name: this.ALGORITHM,
        iv: encrypted.iv,
      },
      key,
      encrypted.ciphertext
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  }

  /**
   * Store wallet metadata (not encrypted)
   */
  async storeMetadata(credentialId: string, metadata: any): Promise<void> {
    await set(`wallet_meta_${credentialId}`, metadata);
  }

  /**
   * Get wallet metadata
   */
  async getMetadata(credentialId: string): Promise<any | null> {
    return await get(`wallet_meta_${credentialId}`);
  }

  /**
   * Check if key exists
   */
  async hasKey(credentialId: string): Promise<boolean> {
    const key = await get(`wallet_key_${credentialId}`);
    return key !== undefined;
  }
}

export const secureStorage = new SecureStorage();
