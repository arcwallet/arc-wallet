/**
 * WebCrypto Master Key Manager
 * Manages non-extractable master keys for enhanced security
 */

export class WebCryptoMasterKeyManager {
    private masterKey: CryptoKey | null = null;
    private keyId: string | null = null;

    /**
     * Generate non-extractable master key
     */
    async generateMasterKey(credentialId: string): Promise<void> {
        try {
            console.log('[WebCrypto] Generating non-extractable master key...');

            // Generate AES-GCM key (non-extractable)
            this.masterKey = await crypto.subtle.generateKey(
                {
                    name: 'AES-GCM',
                    length: 256,
                },
                false, // NON-EXTRACTABLE - Key cannot be exported!
                ['encrypt', 'decrypt']
            );

            this.keyId = credentialId;

            console.log('[WebCrypto] Master key generated (non-extractable)');
        } catch (error: any) {
            console.error('[WebCrypto] Master key generation failed:', error);
            throw new Error(`Failed to generate master key: ${error.message}`);
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
