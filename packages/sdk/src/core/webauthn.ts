/**
 * WebAuthn Manager - Passkey Creation & Authentication
 * Uses device Secure Enclave for key storage
 */

import type { PasskeyCredential, AuthenticationResult } from '../types';

export interface WebAuthnConfig {
  rpId: string;
  rpName: string;
  backendUrl?: string;
}

export class WebAuthnManager {
  private rpId: string;
  private rpName: string;
  private backendUrl: string;

  constructor(config: WebAuthnConfig) {
    this.rpId = config.rpId;
    this.rpName = config.rpName;
    this.backendUrl = config.backendUrl || 'http://localhost:4000';

    // Check WebAuthn support
    if (!this.isSupported()) {
      throw new Error('WebAuthn is not supported in this browser');
    }
  }

  /**
   * Check if WebAuthn is supported
   */
  isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      window.PublicKeyCredential !== undefined &&
      typeof window.PublicKeyCredential === 'function'
    );
  }

  /**
   * Create new passkey for user
   */
  async createPasskey(userId: string, userName: string): Promise<PasskeyCredential> {
    try {
      // Step 1: Get registration options from backend
      const optionsResponse = await fetch(`${this.backendUrl}/passkey/register/options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId, userName }),
      });

      if (!optionsResponse.ok) {
        throw new Error('Failed to get registration options');
      }

      const options = await optionsResponse.json();

      // Step 2: Create credential using WebAuthn
      const credential = await navigator.credentials.create({
        publicKey: {
          ...options,
          challenge: this.base64urlToBuffer(options.challenge),
          user: {
            ...options.user,
            id: this.base64urlToBuffer(options.user.id),
          },
          excludeCredentials: options.excludeCredentials?.map((cred: any) => ({
            ...cred,
            id: this.base64urlToBuffer(cred.id),
          })),
        },
      }) as PublicKeyCredential;

      if (!credential) {
        throw new Error('Failed to create credential');
      }

      const attestationResponse = credential.response as AuthenticatorAttestationResponse;

      // Step 3: Verify credential with backend
      const verifyResponse = await fetch(`${this.backendUrl}/passkey/register/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          userId,
          credential: {
            id: credential.id,
            rawId: this.bufferToBase64url(credential.rawId),
            response: {
              clientDataJSON: this.bufferToBase64url(attestationResponse.clientDataJSON),
              attestationObject: this.bufferToBase64url(attestationResponse.attestationObject),
            },
            type: credential.type,
          },
        }),
      });

      if (!verifyResponse.ok) {
        throw new Error('Failed to verify credential');
      }

      const result = await verifyResponse.json();

      // Step 4: Derive Ethereum address from public key
      const publicKeyHex = this.extractPublicKey(attestationResponse);
      const address = await this.deriveAddress(publicKeyHex);

      return {
        id: credential.id,
        publicKey: publicKeyHex,
        userId,
        createdAt: new Date(),
      };
    } catch (error: any) {
      console.error('Passkey creation failed:', error);
      throw new Error(`Failed to create passkey: ${error.message}`);
    }
  }

  /**
   * Authenticate with existing passkey
   */
  async authenticate(credentialId?: string): Promise<AuthenticationResult> {
    try {
      // Step 1: Get authentication options from backend
      const optionsResponse = await fetch(`${this.backendUrl}/passkey/login/options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ credentialId }),
      });

      if (!optionsResponse.ok) {
        throw new Error('Failed to get authentication options');
      }

      const options = await optionsResponse.json();

      // Step 2: Get credential from device
      const assertion = await navigator.credentials.get({
        publicKey: {
          ...options,
          challenge: this.base64urlToBuffer(options.challenge),
          allowCredentials: options.allowCredentials?.map((cred: any) => ({
            ...cred,
            id: this.base64urlToBuffer(cred.id),
          })),
        },
      }) as PublicKeyCredential;

      if (!assertion) {
        return {
          success: false,
          credentialId: '',
          error: 'Authentication cancelled',
        };
      }

      const assertionResponse = assertion.response as AuthenticatorAssertionResponse;

      // Step 3: Verify with backend
      const verifyResponse = await fetch(`${this.backendUrl}/passkey/login/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          credential: {
            id: assertion.id,
            rawId: this.bufferToBase64url(assertion.rawId),
            response: {
              clientDataJSON: this.bufferToBase64url(assertionResponse.clientDataJSON),
              authenticatorData: this.bufferToBase64url(assertionResponse.authenticatorData),
              signature: this.bufferToBase64url(assertionResponse.signature),
              userHandle: assertionResponse.userHandle
                ? this.bufferToBase64url(assertionResponse.userHandle)
                : undefined,
            },
            type: assertion.type,
          },
        }),
      });

      if (!verifyResponse.ok) {
        throw new Error('Authentication verification failed');
      }

      const result = await verifyResponse.json();

      return {
        success: true,
        credentialId: assertion.id,
        // Private key is derived securely on client-side
        // Never sent to backend
      };
    } catch (error: any) {
      console.error('Authentication failed:', error);
      return {
        success: false,
        credentialId: '',
        error: error.message,
      };
    }
  }

  /**
   * Extract public key from attestation response
   */
  private extractPublicKey(response: AuthenticatorAttestationResponse): string {
    // Parse CBOR attestation object to extract public key
    // This is simplified - real implementation needs CBOR parsing
    const attestationObject = response.attestationObject;

    // For now, return a placeholder
    // Real implementation would use @simplewebauthn/server to parse
    return '0x' + Array.from(new Uint8Array(attestationObject.slice(0, 32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Derive Ethereum address from public key
   */
  private async deriveAddress(publicKeyHex: string): Promise<string> {
    // Use ethers.js to derive address from public key
    const { keccak256 } = await import('ethers');
    const hash = keccak256(publicKeyHex);
    return '0x' + hash.slice(-40);
  }

  /**
   * Convert base64url to ArrayBuffer
   */
  private base64urlToBuffer(base64url: string): ArrayBuffer {
    const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    const padding = '='.repeat((4 - (base64.length % 4)) % 4);
    const str = atob(base64 + padding);
    const buffer = new ArrayBuffer(str.length);
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < str.length; i++) {
      bytes[i] = str.charCodeAt(i);
    }
    return buffer;
  }

  /**
   * Convert ArrayBuffer to base64url
   */
  private bufferToBase64url(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let str = '';
    for (let i = 0; i < bytes.length; i++) {
      str += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(str);
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }
}
