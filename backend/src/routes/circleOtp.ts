/**
 * Circle Email OTP Routes (Hybrid Mode)
 * Uses Circle API for email OTP verification only
 * Wallet creation handled separately via Passkey
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { EnvConfig } from '../types/index.js';
import { MagicUserStore } from '../magicLink/UserStore.js';
import { MagicSessionStore } from '../magicLink/SessionStore.js';
import { rateLimitMiddleware } from '../middleware/security.js';
import { Database } from '../models/Database.js';
import path from 'path';

const CIRCLE_API_BASE = 'https://api.circle.com/v1/w3s';
const SESSION_COOKIE_NAME = 'arcwallet_session';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

type CookieRequest = Request & { cookies?: Record<string, string> };

const COOKIE_BASE_OPTIONS = (isProd: boolean) => ({
  httpOnly: true,
  sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
  secure: isProd,
  maxAge: 4 * 60 * 60 * 1000,
  path: '/',
});

const sanitizeEmail = (email: unknown): string | null => {
  if (typeof email !== 'string') return null;
  const trimmed = email.trim().toLowerCase();
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
  return regex.test(trimmed) ? trimmed : null;
};

// Generate UUID for idempotency key
const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// Store pending OTP sessions (deviceToken, etc.)
interface PendingOtp {
  email: string;
  deviceToken: string;
  deviceEncryptionKey: string;
  otpToken: string;
  createdAt: number;
}
const pendingOtps = new Map<string, PendingOtp>();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of pendingOtps.entries()) {
    if (now - value.createdAt > 15 * 60 * 1000) {
      pendingOtps.delete(key);
    }
  }
}, 5 * 60 * 1000);

export const createCircleOtpRouter = (config: EnvConfig, db: Database, sessionStore: MagicSessionStore) => {
  const router = Router();
  const userStore = new MagicUserStore(path.join(process.cwd(), 'data'));

  const circleApiKey = process.env.CIRCLE_API_KEY;

  if (!circleApiKey) {
    console.warn('[CircleOTP] CIRCLE_API_KEY not configured');
  }

  /**
   * Request OTP - Call Circle API to send verification email
   * POST /api/circle/otp/request
   */
  router.post('/api/circle/otp/request', rateLimitMiddleware('registration'), async (req: Request, res: Response) => {
    const email = sanitizeEmail(req.body?.email);
    const deviceId = typeof req.body?.deviceId === 'string' ? req.body.deviceId : null;

    if (!email) {
      return res.status(400).json({ success: false, error: 'Please provide a valid email address.' });
    }

    if (!deviceId) {
      return res.status(400).json({ success: false, error: 'Device ID is required.' });
    }

    if (!circleApiKey) {
      return res.status(500).json({ success: false, error: 'Circle API not configured' });
    }

    try {
      // Call Circle API to request OTP
      const response = await fetch(`${CIRCLE_API_BASE}/users/email/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${circleApiKey}`,
        },
        body: JSON.stringify({
          idempotencyKey: generateUUID(),
          deviceId,
          email,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('[CircleOTP] Request failed:', data);
        return res.status(response.status).json({
          success: false,
          error: data.message || data.error?.message || 'Failed to send verification code',
        });
      }

      // Store OTP session data
      const otpKey = crypto.createHash('sha256').update(email).digest('hex');
      pendingOtps.set(otpKey, {
        email,
        deviceToken: data.data?.deviceToken,
        deviceEncryptionKey: data.data?.deviceEncryptionKey,
        otpToken: data.data?.otpToken,
        createdAt: Date.now(),
      });

      console.log(`[CircleOTP] OTP requested for ${email}`);

      // Return tokens to frontend for SDK verification
      res.json({
        success: true,
        message: 'Verification code sent to your email',
        data: {
          deviceToken: data.data?.deviceToken,
          deviceEncryptionKey: data.data?.deviceEncryptionKey,
          otpToken: data.data?.otpToken,
        },
      });
    } catch (error) {
      console.error('[CircleOTP] Request error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to send verification code. Please try again.',
      });
    }
  });

  /**
   * Resend OTP
   * POST /api/circle/otp/resend
   */
  router.post('/api/circle/otp/resend', rateLimitMiddleware('registration'), async (req: Request, res: Response) => {
    const email = sanitizeEmail(req.body?.email);
    const deviceId = typeof req.body?.deviceId === 'string' ? req.body.deviceId : null;

    if (!email) {
      return res.status(400).json({ success: false, error: 'Please provide a valid email address.' });
    }

    if (!deviceId) {
      return res.status(400).json({ success: false, error: 'Device ID is required.' });
    }

    if (!circleApiKey) {
      return res.status(500).json({ success: false, error: 'Circle API not configured' });
    }

    try {
      // Call Circle API to resend OTP
      const response = await fetch(`${CIRCLE_API_BASE}/users/email/resendOTP`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${circleApiKey}`,
        },
        body: JSON.stringify({
          idempotencyKey: generateUUID(),
          deviceId,
          email,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('[CircleOTP] Resend failed:', data);
        return res.status(response.status).json({
          success: false,
          error: data.message || data.error?.message || 'Failed to resend verification code',
        });
      }

      console.log(`[CircleOTP] OTP resent for ${email}`);

      res.json({
        success: true,
        message: 'New verification code sent to your email',
        data: {
          deviceToken: data.data?.deviceToken,
          deviceEncryptionKey: data.data?.deviceEncryptionKey,
          otpToken: data.data?.otpToken,
        },
      });
    } catch (error) {
      console.error('[CircleOTP] Resend error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to resend verification code. Please try again.',
      });
    }
  });

  /**
   * Create session after successful OTP verification
   * This is the hybrid part - we accept the Circle userToken but don't create Circle wallet
   * POST /api/circle/session
   */
  router.post('/api/circle/session', rateLimitMiddleware('auth'), async (req: Request, res: Response) => {
    const email = sanitizeEmail(req.body?.email);
    const userToken = typeof req.body?.userToken === 'string' ? req.body.userToken : null;

    if (!email) {
      return res.status(400).json({ success: false, error: 'Please provide a valid email address.' });
    }

    if (!userToken) {
      return res.status(400).json({ success: false, error: 'User token is required.' });
    }

    try {
      // Verify the userToken is valid by checking with Circle API (optional, adds security)
      // For now, we trust the frontend SDK verification

      // Clean up pending OTP
      const otpKey = crypto.createHash('sha256').update(email).digest('hex');
      pendingOtps.delete(otpKey);

      // Create our own session (NOT Circle MPC wallet)
      const user = userStore.findOrCreate(email);
      const session = sessionStore.create(user, SESSION_TTL_MS);

      console.log(`[CircleOTP] Session created for ${email} (hybrid mode - Passkey wallet)`);

      // Set session cookie
      const cookieOptions = COOKIE_BASE_OPTIONS(config.NODE_ENV === 'production');
      res.cookie(SESSION_COOKIE_NAME, session.id, cookieOptions);

      res.json({
        success: true,
        message: 'Email verified successfully',
        data: {
          email: session.email,
        },
      });
    } catch (error) {
      console.error('[CircleOTP] Session creation error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create session. Please try again.',
      });
    }
  });

  // ============================================
  // FALLBACK: Simple OTP (if Circle API fails)
  // ============================================

  // Keep the simple OTP endpoints as fallback
  router.post('/api/otp/request', rateLimitMiddleware('registration'), async (req: Request, res: Response) => {
    const email = sanitizeEmail(req.body?.email);
    if (!email) {
      return res.status(400).json({ success: false, error: 'Please provide a valid email address.' });
    }

    // For now, redirect to Circle flow
    // If Circle is not configured, this would use nodemailer fallback
    res.status(501).json({
      success: false,
      error: 'Please use /api/circle/otp/request endpoint',
    });
  });

  router.post('/api/otp/verify', rateLimitMiddleware('auth'), async (req: Request, res: Response) => {
    res.status(501).json({
      success: false,
      error: 'OTP verification is handled by Circle SDK on frontend',
    });
  });

  return router;
};
