/**
 * WebCrypto Master Key Manager
 * Manages non-extractable master keys for enhanced security
 *
 * IMPORTANT: Uses PBKDF2 to derive deterministic keys from credentialId
 * This ensures the same key is generated for the same credentialId across sessions
 */
export declare class WebCryptoMasterKeyManager {
    private masterKey;
    private keyId;
    /**
     * Generate/derive non-extractable master key from credentialId
     * Uses PBKDF2 to ensure deterministic key derivation
     */
    generateMasterKey(credentialId: string): Promise<void>;
    /**
     * Encrypt data with non-extractable master key
     */
    encrypt(data: string): Promise<{
        encrypted: Uint8Array;
        iv: Uint8Array;
    }>;
    /**
     * Decrypt data with non-extractable master key
     */
    decrypt(encrypted: Uint8Array, iv: Uint8Array): Promise<string>;
    /**
     * Check if master key is initialized
     */
    isInitialized(): boolean;
    /**
     * Get key ID
     */
    getKeyId(): string | null;
    /**
     * Clear master key from memory
     */
    clear(): void;
    /**
     * Derive key from passkey credential (for backward compatibility)
     */
    deriveKeyFromPasskey(credentialId: string, salt: Uint8Array): Promise<CryptoKey>;
    /**
     * Encrypt with derived key (for backward compatibility)
     */
    encryptWithDerivedKey(data: string, credentialId: string, salt: Uint8Array): Promise<{
        encrypted: Uint8Array;
        iv: Uint8Array;
    }>;
    /**
     * Decrypt with derived key (for backward compatibility)
     */
    decryptWithDerivedKey(encrypted: Uint8Array, iv: Uint8Array, credentialId: string, salt: Uint8Array): Promise<string>;
}
