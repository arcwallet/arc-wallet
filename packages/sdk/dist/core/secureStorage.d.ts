/**
 * Secure Storage - Encrypted key storage using IndexedDB
 * Keys are encrypted with AES-GCM using WebCrypto API
 */
export interface EncryptedData {
    /** Encrypted data */
    ciphertext: ArrayBuffer;
    /** Initialization vector */
    iv: Uint8Array;
    /** Authentication tag (included in ciphertext for AES-GCM) */
    salt: Uint8Array;
}
export declare class SecureStorage {
    private readonly ALGORITHM;
    private readonly KEY_LENGTH;
    private readonly IV_LENGTH;
    private readonly SALT_LENGTH;
    /**
     * Derive encryption key from passkey credential
     */
    deriveEncryptionKey(credentialId: string, salt: Uint8Array): Promise<CryptoKey>;
    /**
     * Store encrypted private key
     */
    storeKey(credentialId: string, privateKey: string, encryptionKey: CryptoKey): Promise<void>;
    /**
     * Store WebCrypto encrypted data (new format)
     */
    storeWebCryptoData(credentialId: string, data: {
        encrypted: number[];
        iv: number[];
        address: string;
        keyType: string;
    }): Promise<void>;
    /**
     * Retrieve and decrypt private key
     */
    getKey(credentialId: string, encryptionKey: CryptoKey): Promise<string | null>;
    /**
     * Delete stored key
     */
    deleteKey(credentialId: string): Promise<void>;
    /**
     * Clear all stored keys
     */
    clearAll(): Promise<void>;
    /**
     * Encrypt data using AES-GCM
     */
    private encrypt;
    /**
     * Decrypt data using AES-GCM
     */
    private decrypt;
    /**
     * Get key data (supports both legacy and new formats)
     */
    getKeyData(credentialId: string): Promise<any>;
    /**
     * Store metadata
     */
    storeMetadata(credentialId: string, metadata: any): Promise<void>;
    /**
     * Get wallet metadata
     */
    getMetadata(credentialId: string): Promise<any | null>;
    /**
     * Check if key exists
     */
    hasKey(credentialId: string): Promise<boolean>;
}
export declare const secureStorage: SecureStorage;
