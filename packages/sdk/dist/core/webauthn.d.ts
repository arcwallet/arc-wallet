/**
 * WebAuthn Manager - Passkey Creation & Authentication
 * Uses device Secure Enclave for key storage
 * Now powered by @simplewebauthn library for production reliability
 */
import type { PasskeyCredential, AuthenticationResult } from '../types';
export interface WebAuthnConfig {
    rpId: string;
    rpName: string;
    backendUrl?: string;
}
export declare class WebAuthnManager {
    private backendUrl;
    constructor(config: WebAuthnConfig);
    /**
     * Check if WebAuthn is supported
     */
    isSupported(): boolean;
    /**
     * Create new passkey for user using @simplewebauthn/browser
     */
    createPasskey(userId: string, userName: string): Promise<PasskeyCredential>;
    /**
     * Authenticate with existing passkey using @simplewebauthn/browser
     */
    authenticate(credentialId?: string): Promise<AuthenticationResult>;
}
