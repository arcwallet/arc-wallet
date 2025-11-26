/**
 * Email OTP Routes (Server-Side Only)
 * Uses Circle API for email OTP delivery
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
const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

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
  attempts: number;
}
const pendingOtps = new Map<string, PendingOtp>();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of pendingOtps.entries()) {
    if (now - value.createdAt > OTP_EXPIRY_MS) {
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

    if (!email) {
      return res.status(400).json({ success: false, error: 'Please provide a valid email address.' });
    }

    if (!circleApiKey) {
      return res.status(500).json({ success: false, error: 'Circle API not configured' });
    }

    try {
      // Call Circle API to request OTP
      const response = await fetch(`${CIRCLE_API_BASE}/users/otp/email/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${circleApiKey}`,
        },
        body: JSON.stringify({
          idempotencyKey: generateUUID(),
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
        attempts: 0,
      });

      console.log(`[CircleOTP] OTP requested for ${email}`);

      res.json({
        success: true,
        message: 'Verification code sent to your email',
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

    if (!email) {
      return res.status(400).json({ success: false, error: 'Please provide a valid email address.' });
    }

    if (!circleApiKey) {
      return res.status(500).json({ success: false, error: 'Circle API not configured' });
    }

    try {
      // Call Circle API to request new OTP
      const response = await fetch(`${CIRCLE_API_BASE}/users/otp/email/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${circleApiKey}`,
        },
        body: JSON.stringify({
          idempotencyKey: generateUUID(),
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
        attempts: 0,
      });

      console.log(`[CircleOTP] OTP resent for ${email}`);

      res.json({
        success: true,
        message: 'New verification code sent to your email',
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
   * Verify OTP - Call Circle API to verify code
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

    if (!circleApiKey) {
      return res.status(500).json({ success: false, error: 'Circle API not configured' });
    }

    try {
      const otpKey = crypto.createHash('sha256').update(email).digest('hex');
      const pending = pendingOtps.get(otpKey);

      if (!pending) {
        return res.status(400).json({
          success: false,
          error: 'No verification code found. Please request a new one.',
        });
      }

      // Check attempts (max 5)
      if (pending.attempts >= 5) {
        pendingOtps.delete(otpKey);
        return res.status(400).json({
          success: false,
          error: 'Too many attempts. Please request a new code.',
        });
      }

      // Call Circle API to verify OTP
      const response = await fetch(`${CIRCLE_API_BASE}/users/otp/email/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${circleApiKey}`,
        },
        body: JSON.stringify({
          idempotencyKey: generateUUID(),
          email,
          otpToken: pending.otpToken,
          otp: otpCode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        pending.attempts++;
        console.error('[CircleOTP] Verify failed:', data);
        return res.status(400).json({
          success: false,
          error: data.message || data.error?.message || 'Invalid verification code',
        });
      }

      // Success - clean up and create session
      pendingOtps.delete(otpKey);

      const user = userStore.findOrCreate(email);
      const session = sessionStore.create(user, SESSION_TTL_MS);

      console.log(`[CircleOTP] Verified and session created for ${email}`);

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

  // Legacy endpoint redirects
  router.post('/api/otp/request', rateLimitMiddleware('registration'), async (req: Request, res: Response) => {
    res.status(301).json({
      success: false,
      error: 'Please use /api/circle/otp/request endpoint',
    });
  });

  router.post('/api/otp/verify', rateLimitMiddleware('auth'), async (req: Request, res: Response) => {
    res.status(301).json({
      success: false,
      error: 'Please use /api/circle/otp/verify endpoint',
    });
  });

  return router;
};
