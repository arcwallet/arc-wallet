/**
 * Circle Email OTP Service
 * Handles email-based OTP authentication using Circle's API
 */

const CIRCLE_API_BASE = 'https://api.circle.com/v1/w3s';

interface CircleOtpConfig {
  apiKey: string;
}

interface RequestOtpResponse {
  success: boolean;
  message?: string;
  error?: string;
}

interface VerifyOtpResponse {
  success: boolean;
  userToken?: string;
  encryptionKey?: string;
  refreshToken?: string;
  userId?: string;
  message?: string;
  error?: string;
}

interface RefreshTokenResponse {
  success: boolean;
  userToken?: string;
  encryptionKey?: string;
  refreshToken?: string;
  error?: string;
}

class CircleOtpService {
  private apiKey: string;

  constructor(config: CircleOtpConfig) {
    this.apiKey = config.apiKey;
  }

  /**
   * Request OTP code to be sent to user's email
   */
  async requestOtp(email: string): Promise<RequestOtpResponse> {
    try {
      const response = await fetch(`${CIRCLE_API_BASE}/users/email/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.message || data.error || `Request failed: ${response.status}`,
        };
      }

      return {
        success: true,
        message: 'OTP sent to your email',
      };
    } catch (error) {
      console.error('[CircleOTP] Request OTP error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to request OTP',
      };
    }
  }

  /**
   * Resend OTP code to user's email
   */
  async resendOtp(email: string): Promise<RequestOtpResponse> {
    try {
      const response = await fetch(`${CIRCLE_API_BASE}/users/email/resendOTP`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.message || data.error || `Request failed: ${response.status}`,
        };
      }

      return {
        success: true,
        message: 'OTP resent to your email',
      };
    } catch (error) {
      console.error('[CircleOTP] Resend OTP error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to resend OTP',
      };
    }
  }

  /**
   * Verify OTP code and get user tokens
   */
  async verifyOtp(email: string, otpCode: string): Promise<VerifyOtpResponse> {
    try {
      const response = await fetch(`${CIRCLE_API_BASE}/users/email/token`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          email,
          otpToken: otpCode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.message || data.error || `Verification failed: ${response.status}`,
        };
      }

      // Circle returns userToken, encryptionKey, and refreshToken
      return {
        success: true,
        userToken: data.data?.userToken,
        encryptionKey: data.data?.encryptionKey,
        refreshToken: data.data?.refreshToken,
        userId: data.data?.userId,
      };
    } catch (error) {
      console.error('[CircleOTP] Verify OTP error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to verify OTP',
      };
    }
  }

  /**
   * Refresh expired user token
   */
  async refreshToken(refreshToken: string): Promise<RefreshTokenResponse> {
    try {
      const response = await fetch(`${CIRCLE_API_BASE}/users/token/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ refreshToken }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.message || data.error || `Refresh failed: ${response.status}`,
        };
      }

      return {
        success: true,
        userToken: data.data?.userToken,
        encryptionKey: data.data?.encryptionKey,
        refreshToken: data.data?.refreshToken,
      };
    } catch (error) {
      console.error('[CircleOTP] Refresh token error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to refresh token',
      };
    }
  }

  /**
   * Initialize user (create or get existing user)
   * Call after successful OTP verification
   */
  async initializeUser(userToken: string): Promise<{ success: boolean; userId?: string; error?: string }> {
    try {
      const response = await fetch(`${CIRCLE_API_BASE}/user/initialize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'X-User-Token': userToken,
        },
        body: JSON.stringify({
          blockchains: ['ETH-SEPOLIA', 'MATIC-AMOY'],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.message || data.error || `Initialize failed: ${response.status}`,
        };
      }

      return {
        success: true,
        userId: data.data?.userId,
      };
    } catch (error) {
      console.error('[CircleOTP] Initialize user error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to initialize user',
      };
    }
  }
}

// Singleton instance
let circleOtpServiceInstance: CircleOtpService | null = null;

export function getCircleOtpService(): CircleOtpService {
  if (!circleOtpServiceInstance) {
    const apiKey = (import.meta as any).env?.VITE_CIRCLE_API_KEY;

    if (!apiKey) {
      throw new Error('Circle API key not configured. Please set VITE_CIRCLE_API_KEY environment variable.');
    }

    circleOtpServiceInstance = new CircleOtpService({ apiKey });
  }

  return circleOtpServiceInstance;
}

export type { CircleOtpService, RequestOtpResponse, VerifyOtpResponse, RefreshTokenResponse };
export default CircleOtpService;
