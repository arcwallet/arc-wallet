/**
 * Circle Email OTP Routes
 * Backend proxy for Circle's email OTP authentication
 */

import express, { Router, Request, Response } from 'express';
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

// OTP storage (in-memory, production should use Redis)
const pendingOtps = new Map<string, { email: string; createdAt: number; attempts: number }>();

// Cleanup old OTPs every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of pendingOtps.entries()) {
    if (now - value.createdAt > 10 * 60 * 1000) { // 10 minutes expiry
      pendingOtps.delete(key);
    }
  }
}, 5 * 60 * 1000);

export const createCircleOtpRouter = (config: EnvConfig, db: Database, sessionStore: MagicSessionStore) => {
  const router = Router();
  const userStore = new MagicUserStore(path.join(process.cwd(), 'data'));

  const circleApiKey = process.env.CIRCLE_API_KEY;

  if (!circleApiKey) {
    console.warn('[CircleOTP] CIRCLE_API_KEY not configured, OTP routes will fail');
  }

  const requireSession = (req: Request) => {
    const sessionId = (req as CookieRequest).cookies?.[SESSION_COOKIE_NAME];
    return sessionStore.get(sessionId);
  };

  /**
   * Request OTP - Send verification code to email
   * POST /api/otp/request
   */
  router.post('/api/otp/request', rateLimitMiddleware('registration'), async (req: Request, res: Response) => {
    const email = sanitizeEmail(req.body?.email);
    if (!email) {
      return res.status(400).json({ success: false, error: 'Please provide a valid email address.' });
    }

    if (!circleApiKey) {
      return res.status(500).json({ success: false, error: 'Circle API not configured' });
    }

    try {
      const response = await fetch(`${CIRCLE_API_BASE}/users/email/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${circleApiKey}`,
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('[CircleOTP] Request failed:', data);
        return res.status(response.status).json({
          success: false,
          error: data.message || data.error || 'Failed to send OTP',
        });
      }

      // Store pending OTP request
      const otpKey = crypto.createHash('sha256').update(email).digest('hex');
      pendingOtps.set(otpKey, { email, createdAt: Date.now(), attempts: 0 });

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
   * POST /api/otp/resend
   */
  router.post('/api/otp/resend', rateLimitMiddleware('registration'), async (req: Request, res: Response) => {
    const email = sanitizeEmail(req.body?.email);
    if (!email) {
      return res.status(400).json({ success: false, error: 'Please provide a valid email address.' });
    }

    if (!circleApiKey) {
      return res.status(500).json({ success: false, error: 'Circle API not configured' });
    }

    try {
      const response = await fetch(`${CIRCLE_API_BASE}/users/email/resendOTP`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${circleApiKey}`,
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('[CircleOTP] Resend failed:', data);
        return res.status(response.status).json({
          success: false,
          error: data.message || data.error || 'Failed to resend OTP',
        });
      }

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
   * Verify OTP and create session
   * POST /api/otp/verify
   */
  router.post('/api/otp/verify', rateLimitMiddleware('auth'), async (req: Request, res: Response) => {
    const email = sanitizeEmail(req.body?.email);
    const otpCode = typeof req.body?.code === 'string' ? req.body.code.trim() : null;

    if (!email) {
      return res.status(400).json({ success: false, error: 'Please provide a valid email address.' });
    }

    if (!otpCode || otpCode.length !== 6) {
      return res.status(400).json({ success: false, error: 'Please provide a valid 6-digit code.' });
    }

    if (!circleApiKey) {
      return res.status(500).json({ success: false, error: 'Circle API not configured' });
    }

    // Check rate limiting on OTP attempts
    const otpKey = crypto.createHash('sha256').update(email).digest('hex');
    const pending = pendingOtps.get(otpKey);

    if (pending) {
      pending.attempts++;
      if (pending.attempts > 5) {
        pendingOtps.delete(otpKey);
        return res.status(429).json({
          success: false,
          error: 'Too many attempts. Please request a new code.',
        });
      }
    }

    try {
      // Verify with Circle API
      const response = await fetch(`${CIRCLE_API_BASE}/users/email/token`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${circleApiKey}`,
        },
        body: JSON.stringify({
          email,
          otpToken: otpCode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('[CircleOTP] Verify failed:', data);
        return res.status(response.status).json({
          success: false,
          error: data.message || data.error || 'Invalid or expired code',
        });
      }

      // OTP verified successfully - create session
      const user = userStore.findOrCreate(email);
      const session = sessionStore.create(user, SESSION_TTL_MS);

      // Clean up pending OTP
      pendingOtps.delete(otpKey);

      console.log(`[CircleOTP] Verified OTP for ${email}, creating session ${session.id}`);

      // Store Circle tokens if needed for MPC wallet later
      const circleTokens = {
        userToken: data.data?.userToken,
        encryptionKey: data.data?.encryptionKey,
        refreshToken: data.data?.refreshToken,
        userId: data.data?.userId,
      };

      // Set session cookie
      const cookieOptions = COOKIE_BASE_OPTIONS(config.NODE_ENV === 'production');
      res.cookie(SESSION_COOKIE_NAME, session.id, cookieOptions);

      res.json({
        success: true,
        message: 'Email verified successfully',
        data: {
          email: session.email,
          // Include Circle user info if available
          circleUserId: circleTokens.userId,
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

  return router;
};
