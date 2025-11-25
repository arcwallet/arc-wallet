/**
 * WebCrypto Master Key Manager
 * Manages non-extractable master keys for enhanced security
 *
 * IMPORTANT: Uses PBKDF2 to derive deterministic keys from credentialId
 * This ensures the same key is generated for the same credentialId across sessions
 */

// Fixed salt for deterministic key derivation (app-specific)
const FIXED_SALT = new Uint8Array([
    0x41, 0x52, 0x43, 0x57, 0x41, 0x4c, 0x4c, 0x45,  // "ARCWALLE"
    0x54, 0x5f, 0x53, 0x41, 0x4c, 0x54, 0x5f, 0x56   // "T_SALT_V"
]);

export class WebCryptoMasterKeyManager {
    private masterKey: CryptoKey | null = null;
    private keyId: string | null = null;

    /**
     * Generate/derive non-extractable master key from credentialId
     * Uses PBKDF2 to ensure deterministic key derivation
     */
    async generateMasterKey(credentialId: string): Promise<void> {
        try {
            console.log('[WebCrypto] Deriving non-extractable master key from credential...');

            // Import credential ID as key material for PBKDF2
            const keyMaterial = await crypto.subtle.importKey(
                'raw',
                new TextEncoder().encode(credentialId),
                'PBKDF2',
                false,
                ['deriveBits', 'deriveKey']
            );

            // Derive AES-GCM key using PBKDF2 (deterministic - same credentialId = same key)
            this.masterKey = await crypto.subtle.deriveKey(
                {
                    name: 'PBKDF2',
                    salt: FIXED_SALT,
                    iterations: 100000,
                    hash: 'SHA-256',
                },
                keyMaterial,
                {
                    name: 'AES-GCM',
                    length: 256,
                },
                false, // NON-EXTRACTABLE - Key cannot be exported!
                ['encrypt', 'decrypt']
            );

            this.keyId = credentialId;

            console.log('[WebCrypto] Master key derived (non-extractable, deterministic)');
        } catch (error: any) {
            console.error('[WebCrypto] Master key derivation failed:', error);
            throw new Error(`Failed to derive master key: ${error.message}`);
        }
    }

    /**
     * Encrypt data with non-extractable master key
     */
    async encrypt(data: string): Promise<{ encrypted: Uint8Array; iv: Uint8Array }> {
        if (!this.masterKey) {
            throw new Error('Master key not initialized');
        }

        try {
            // Generate random IV
            const iv = crypto.getRandomValues(new Uint8Array(12));

            // Encode data
            const dataBytes = new TextEncoder().encode(data);

            // Encrypt with non-extractable master key
            const encrypted = await crypto.subtle.encrypt(
                {
                    name: 'AES-GCM',
                    iv,
                },
                this.masterKey,
                dataBytes
            );

            return {
                encrypted: new Uint8Array(encrypted),
                iv,
            };
        } catch (error: any) {
            console.error('[WebCrypto] Encryption failed:', error);
            throw new Error(`Encryption failed: ${error.message}`);
        }
    }

    /**
     * Decrypt data with non-extractable master key
     */
    async decrypt(encrypted: Uint8Array, iv: Uint8Array): Promise<string> {
        if (!this.masterKey) {
            throw new Error('Master key not initialized');
        }

        try {
            // Decrypt with non-extractable master key
            const decrypted = await crypto.subtle.decrypt(
                {
                    name: 'AES-GCM',
                    iv,
                },
                this.masterKey,
                encrypted
            );

            // Decode to string
            return new TextDecoder().decode(decrypted);
        } catch (error: any) {
            console.error('[WebCrypto] Decryption failed:', error);
            throw new Error(`Decryption failed: ${error.message}`);
        }
    }

    /**
     * Check if master key is initialized
     */
    isInitialized(): boolean {
        return this.masterKey !== null;
    }

    /**
     * Get key ID
     */
    getKeyId(): string | null {
        return this.keyId;
    }

    /**
     * Clear master key from memory
     */
    clear(): void {
        this.masterKey = null;
        this.keyId = null;
        console.log('[WebCrypto] Master key cleared from memory');
    }

    /**
     * Derive key from passkey credential (for backward compatibility)
     */
    async deriveKeyFromPasskey(credentialId: string, salt: Uint8Array): Promise<CryptoKey> {
        // Import credential ID as key material
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(credentialId),
            'PBKDF2',
            false,
            ['deriveBits', 'deriveKey']
        );

        // Derive AES key
        const derivedKey = await crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt,
                iterations: 100000,
                hash: 'SHA-256',
            },
            keyMaterial,
            {
                name: 'AES-GCM',
                length: 256,
            },
            false, // Non-extractable
            ['encrypt', 'decrypt']
        );

        return derivedKey;
    }

    /**
     * Encrypt with derived key (for backward compatibility)
     */
    async encryptWithDerivedKey(
        data: string,
        credentialId: string,
        salt: Uint8Array
    ): Promise<{ encrypted: Uint8Array; iv: Uint8Array }> {
        const derivedKey = await this.deriveKeyFromPasskey(credentialId, salt);

        const iv = crypto.getRandomValues(new Uint8Array(12));
        const dataBytes = new TextEncoder().encode(data);

        const encrypted = await crypto.subtle.encrypt(
            {
                name: 'AES-GCM',
                iv,
            },
            derivedKey,
            dataBytes
        );

        return {
            encrypted: new Uint8Array(encrypted),
            iv,
        };
    }

    /**
     * Decrypt with derived key (for backward compatibility)
     */
    async decryptWithDerivedKey(
        encrypted: Uint8Array,
        iv: Uint8Array,
        credentialId: string,
        salt: Uint8Array
    ): Promise<string> {
        const derivedKey = await this.deriveKeyFromPasskey(credentialId, salt);

        const decrypted = await crypto.subtle.decrypt(
            {
                name: 'AES-GCM',
                iv,
            },
            derivedKey,
            encrypted
        );

        return new TextDecoder().decode(decrypted);
    }
}
