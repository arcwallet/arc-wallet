/**
 * Circle Auth Service
 * Hybrid authentication: Circle Email OTP + Passkey Wallet
 * Uses Circle SDK only for email verification, skips MPC wallet creation
 */

import { W3SSdk } from '@circle-fin/w3s-pw-web-sdk';

const API_BASE = ((import.meta as any).env.VITE_PASSKEY_API_URL || 'https://arcwallet-backend.onrender.com').replace(/\/$/, '');

interface CircleAuthConfig {
  appId: string;
}

interface OtpRequestResponse {
  success: boolean;
  deviceToken?: string;
  deviceEncryptionKey?: string;
  otpToken?: string;
  error?: string;
}

interface OtpVerifyResponse {
  success: boolean;
  userToken?: string;
  encryptionKey?: string;
  refreshToken?: string;
  userId?: string;
  error?: string;
}

class CircleAuthService {
  private sdk: W3SSdk | null = null;
  private appId: string;
  private deviceId: string | null = null;

  constructor(config: CircleAuthConfig) {
    this.appId = config.appId;
  }

  /**
   * Initialize SDK and get deviceId
   */
  async initialize(): Promise<string> {
    if (this.deviceId) {
      return this.deviceId;
    }

    // Initialize SDK without authentication (just to get deviceId)
    this.sdk = new W3SSdk();

    // Get device ID
    this.deviceId = await this.sdk.getDeviceId();
    console.log('[CircleAuth] Device ID:', this.deviceId);

    return this.deviceId;
  }

  /**
   * Request OTP to be sent to email
   */
  async requestOtp(email: string): Promise<OtpRequestResponse> {
    try {
      // Ensure we have deviceId
      const deviceId = await this.initialize();

      // Call backend to request OTP via Circle API
      const response = await fetch(`${API_BASE}/api/circle/otp/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          email,
          deviceId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || 'Failed to send verification code',
        };
      }

      return {
        success: true,
        deviceToken: data.data?.deviceToken,
        deviceEncryptionKey: data.data?.deviceEncryptionKey,
        otpToken: data.data?.otpToken,
      };
    } catch (error) {
      console.error('[CircleAuth] Request OTP error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send verification code',
      };
    }
  }

  /**
   * Verify OTP code using Circle SDK
   */
  async verifyOtp(
    email: string,
    otpCode: string,
    deviceToken: string,
    deviceEncryptionKey: string,
    otpToken: string
  ): Promise<OtpVerifyResponse> {
    try {
      if (!this.sdk) {
        await this.initialize();
      }

      // Configure SDK with device credentials
      this.sdk = new W3SSdk({
        appSettings: {
          appId: this.appId,
        },
      });

      // Verify OTP through SDK
      return new Promise((resolve) => {
        this.sdk!.verifyOTP(
          deviceToken,
          deviceEncryptionKey,
          otpToken,
          otpCode,
          (error, result) => {
            if (error) {
              console.error('[CircleAuth] Verify OTP error:', error);
              resolve({
                success: false,
                error: error.message || 'Invalid verification code',
              });
              return;
            }

            console.log('[CircleAuth] OTP verified successfully:', result);

            // Extract tokens from result
            resolve({
              success: true,
              userToken: result?.userToken,
              encryptionKey: result?.encryptionKey,
              refreshToken: result?.refreshToken,
              userId: result?.userId,
            });
          }
        );
      });
    } catch (error) {
      console.error('[CircleAuth] Verify OTP error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Verification failed',
      };
    }
  }

  /**
   * Create session on backend after successful OTP verification
   * This is where we diverge from Circle's flow - we create our own session
   * instead of initializing a Circle MPC wallet
   */
  async createSession(email: string, userToken: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${API_BASE}/api/circle/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          email,
          userToken,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || 'Failed to create session',
        };
      }

      return { success: true };
    } catch (error) {
      console.error('[CircleAuth] Create session error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create session',
      };
    }
  }

  /**
   * Get current device ID
   */
  getDeviceId(): string | null {
    return this.deviceId;
  }
}

// Singleton instance
let circleAuthInstance: CircleAuthService | null = null;

export function getCircleAuthService(): CircleAuthService {
  if (!circleAuthInstance) {
    const appId = (import.meta as any).env?.VITE_CIRCLE_APP_ID || '';

    if (!appId) {
      console.warn('[CircleAuth] VITE_CIRCLE_APP_ID not configured');
    }

    circleAuthInstance = new CircleAuthService({ appId });
  }

  return circleAuthInstance;
}

export type { CircleAuthService, OtpRequestResponse, OtpVerifyResponse };
export default CircleAuthService;
