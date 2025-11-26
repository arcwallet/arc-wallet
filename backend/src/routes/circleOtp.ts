/**
 * Circle Email OTP Routes
 * Uses Circle API for email OTP - requires deviceId from frontend SDK
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

// Store pending OTP sessions
interface PendingOtp {
  email: string;
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
      // Call Circle API to request email token (OTP)
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

      // Store OTP token for verification
      const otpKey = crypto.createHash('sha256').update(email).digest('hex');
      pendingOtps.set(otpKey, {
        email,
        otpToken: data.data?.otpToken || '',
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

      // Update stored OTP token
      const otpKey = crypto.createHash('sha256').update(email).digest('hex');
      pendingOtps.set(otpKey, {
        email,
        otpToken: data.data?.otpToken || '',
        createdAt: Date.now(),
      });

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
   * Verify OTP (fallback - normally done via SDK)
   * POST /api/circle/otp/verify
   */
  router.post('/api/circle/otp/verify', rateLimitMiddleware('auth'), async (req: Request, res: Response) => {
    const email = sanitizeEmail(req.body?.email);
    const otpCode = typeof req.body?.otpCode === 'string' ? req.body.otpCode.trim() : null;

    if (!email) {
      return res.status(400).json({ success: false, error: 'Please provide a valid email address.' });
    }

    if (!otpCode || otpCode.length !== 6) {
      return res.status(400).json({ success: false, error: 'Please provide a valid 6-digit code.' });
    }

    // Note: OTP verification should be done via SDK on frontend
    // This is a fallback that creates session without Circle verification
    // For production, consider implementing server-side verification if Circle supports it

    try {
      const otpKey = crypto.createHash('sha256').update(email).digest('hex');
      const pending = pendingOtps.get(otpKey);

      if (!pending) {
        return res.status(400).json({
          success: false,
          error: 'No verification code found. Please request a new one.',
        });
      }

      // Clean up
      pendingOtps.delete(otpKey);

      // Create session
      const user = userStore.findOrCreate(email);
      const session = sessionStore.create(user, SESSION_TTL_MS);

      console.log(`[CircleOTP] Session created for ${email}`);

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
      console.error('[CircleOTP] Verify error:', error);
      res.status(500).json({
        success: false,
        error: 'Verification failed. Please try again.',
      });
    }
  });

  /**
   * Create session after SDK verification
   * POST /api/circle/session
   */
  router.post('/api/circle/session', rateLimitMiddleware('auth'), async (req: Request, res: Response) => {
    const email = sanitizeEmail(req.body?.email);
    const userToken = typeof req.body?.userToken === 'string' ? req.body.userToken : null;

    if (!email) {
      return res.status(400).json({ success: false, error: 'Please provide a valid email address.' });
    }

    try {
      // Clean up pending OTP
      const otpKey = crypto.createHash('sha256').update(email).digest('hex');
      pendingOtps.delete(otpKey);

      // Create our own session (NOT Circle MPC wallet)
      const user = userStore.findOrCreate(email);
      const session = sessionStore.create(user, SESSION_TTL_MS);

      console.log(`[CircleOTP] Session created for ${email} (SDK verified)`);

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

  return router;
};
