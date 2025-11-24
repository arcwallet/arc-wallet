/**
 * WebAuthn Manager - Passkey Creation & Authentication
 * Uses device Secure Enclave for key storage
 * Now powered by @simplewebauthn library for production reliability
 */

import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/types';
import type { PasskeyCredential, AuthenticationResult } from '../types';
import { logger } from '../utils/logger';
import {
  runPasskeyDiagnostic,
  getDiagnosticErrorMessage,
  getPasskeyDiagnosticMode,
  type PasskeyDiagnosticResult,
} from '../utils/passkeyDiagnostic';

export interface WebAuthnConfig {
  rpId: string;
  rpName: string;
  backendUrl?: string;
}

export class WebAuthnManager {
  private backendUrl: string;

  constructor(config: WebAuthnConfig) {
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
   * Get CSRF token from cookie
   */
  private getCsrfToken(): string | null {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.match(/(?:^|; )_csrf=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : null;
  }

  /**
   * Get headers with CSRF token for API requests
   */
  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    const csrfToken = this.getCsrfToken();
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
    }

    return headers;
  }

  /**
   * Create new passkey for user using @simplewebauthn/browser
   */
  async createPasskey(userId: string, userName: string): Promise<PasskeyCredential> {
    try {
      logger.info('Starting passkey registration', {
        component: 'WebAuthn',
        action: 'createPasskey',
        userId,
      });

      // Run diagnostic check
      const diagnosticMode = getPasskeyDiagnosticMode();
      const diagnostic: PasskeyDiagnosticResult = await runPasskeyDiagnostic(diagnosticMode);

      // Log diagnostic result
      const diagnosticMessage = getDiagnosticErrorMessage(diagnostic);
      if (diagnosticMessage) {
        logger.warn('Passkey diagnostic warning', {
          component: 'WebAuthn',
          deviceRisk: diagnostic.deviceRisk,
          platformSupport: diagnostic.platformSupport,
          message: diagnosticMessage,
        });
      }

      // Step 1: Get registration options from backend
      const optionsResponse = await fetch(`${this.backendUrl}/passkeys/register/options`, {
        method: 'POST',
        headers: this.getHeaders(),
        credentials: 'include',
        body: JSON.stringify({ userId, userName }),
      });

      if (!optionsResponse.ok) {
        throw new Error('Failed to get registration options');
      }

      const options: PublicKeyCredentialCreationOptionsJSON = await optionsResponse.json();

      logger.debug('Received registration options from backend', {
        component: 'WebAuthn',
        challenge: options.challenge.substring(0, 20) + '...',
      });

      // Step 2: Create credential using @simplewebauthn/browser
      // This handles all buffer conversions, Base64URL encoding, and browser quirks
      const credential: RegistrationResponseJSON = await startRegistration({ optionsJSON: options });

      logger.debug('Credential created successfully', {
        component: 'WebAuthn',
        credentialId: credential.id.substring(0, 20) + '...',
      });

      // Step 3: Verify credential with backend
      const verifyResponse = await fetch(`${this.backendUrl}/passkeys/register/verify`, {
        method: 'POST',
        headers: this.getHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          userId,
          credential,
        }),
      });

      if (!verifyResponse.ok) {
        const errorData = await verifyResponse.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to verify credential');
      }

      const verifyResult = await verifyResponse.json();

      logger.info('Passkey registered successfully', {
        component: 'WebAuthn',
        credentialId: credential.id.substring(0, 20) + '...',
      });

      // Return in our expected format
      return {
        id: credential.id,
        publicKey: verifyResult.publicKey || credential.id, // Backend should return the actual public key
        userId, // Include userId as required by PasskeyCredential interface
        createdAt: new Date(),
      };
    } catch (error: any) {
      logger.error('Passkey creation failed', error, {
        component: 'WebAuthn',
        action: 'createPasskey',
      });

      // Provide helpful error messages
      if (error.name === 'NotAllowedError') {
        throw new Error(
          'Passkey creation was cancelled. Please try again and allow the passkey when prompted.'
        );
      }

      if (error.name === 'InvalidStateError') {
        throw new Error(
          'A passkey already exists for this device. Use "Connect Existing Wallet" instead.'
        );
      }

      throw new Error(`Failed to create passkey: ${error.message}`);
    }
  }

  /**
   * Authenticate with existing passkey using @simplewebauthn/browser
   */
  async authenticate(credentialId?: string): Promise<AuthenticationResult> {
    try {
      logger.info('Starting passkey authentication', {
        component: 'WebAuthn',
        action: 'authenticate',
        credentialId: credentialId?.substring(0, 20),
      });

      // Step 1: Get authentication options from backend
      const optionsResponse = await fetch(`${this.backendUrl}/passkeys/login/options`, {
        method: 'POST',
        headers: this.getHeaders(),
        credentials: 'include',
        body: JSON.stringify({ credentialId }),
      });

      if (!optionsResponse.ok) {
        throw new Error('Failed to get authentication options');
      }

      const options: PublicKeyCredentialRequestOptionsJSON = await optionsResponse.json();

      logger.debug('Received authentication options from backend', {
        component: 'WebAuthn',
        challenge: options.challenge.substring(0, 20) + '...',
      });

      // Step 2: Authenticate using @simplewebauthn/browser
      // This handles all browser interactions and buffer conversions
      const credential: AuthenticationResponseJSON = await startAuthentication({ optionsJSON: options });

      logger.debug('Authentication response received', {
        component: 'WebAuthn',
        credentialId: credential.id.substring(0, 20) + '...',
      });

      // Step 3: Verify authentication with backend
      const verifyResponse = await fetch(`${this.backendUrl}/passkeys/login/verify`, {
        method: 'POST',
        headers: this.getHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          credential,
        }),
      });

      if (!verifyResponse.ok) {
        const errorData = await verifyResponse.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to verify authentication');
      }

      const verifyResult = await verifyResponse.json();

      logger.info('Authentication successful', {
        component: 'WebAuthn',
        credentialId: credential.id.substring(0, 20) + '...',
      });

      return {
        success: true,
        credentialId: credential.id,
        userId: verifyResult.userId,
        // Authenticator data is handled by backend
      };
    } catch (error: any) {
      logger.error('Authentication failed', error, {
        component: 'WebAuthn',
        action: 'authenticate',
      });

      // Provide helpful error messages
      if (error.name === 'NotAllowedError') {
        throw new Error(
          'Authentication was cancelled. Please try again and verify your identity when prompted.'
        );
      }

      if (error.name === 'InvalidStateError') {
        throw new Error(
          'No passkey found for this wallet. Please create a new wallet or use a different device.'
        );
      }

      return {
        success: false,
        credentialId: '',
        userId: '',
        error: error.message,
      };
    }
  }
}
