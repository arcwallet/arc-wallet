/**
 * Email OTP Routes
 * Uses SendGrid for email delivery, secure OTP verification
 *
 * SECURITY FEATURES:
 * - Cryptographically secure OTP generation
 * - Timing-safe OTP comparison (prevents timing attacks)
 * - Account lockout after failed attempts
 * - IP-based rate limiting
 * - PII masking in logs
 *
 * IMPORTANT: User records are stored in SQLite Database (not file system)
 * This ensures passkey registration can find the same user created during OTP verification
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import sgMail from '@sendgrid/mail';
import { randomUUID } from 'crypto';
import { EnvConfig } from '../types/index.js';
import { MagicSessionStore } from '../magicLink/SessionStore.js';
import { rateLimitMiddleware } from '../middleware/security.js';
import { Database } from '../models/Database.js';

const SESSION_COOKIE_NAME = 'arcwallet_session';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const MAX_OTP_ATTEMPTS = 5;
const ACCOUNT_LOCKOUT_MS = 30 * 60 * 1000; // 30 minutes lockout after max attempts

const COOKIE_BASE_OPTIONS = (isProd: boolean) => ({
  httpOnly: true,
  sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
  secure: isProd,
  maxAge: 4 * 60 * 60 * 1000,
  path: '/',
});

/**
 * Mask email for logging (PII protection)
 * example@domain.com -> e***e@d***.com
 */
const maskEmail = (email: string): string => {
  const [local, domain] = email.split('@');
  if (!domain) return '***@***';
  const [domainName, tld] = domain.split('.');
  const maskedLocal = local.length > 2
    ? `${local[0]}***${local[local.length - 1]}`
    : '***';
  const maskedDomain = domainName && domainName.length > 1
    ? `${domainName[0]}***`
    : '***';
  return `${maskedLocal}@${maskedDomain}.${tld || '***'}`;
};

const sanitizeEmail = (email: unknown): string | null => {
  if (typeof email !== 'string') return null;
  const trimmed = email.trim().toLowerCase();
  // RFC 5322 compliant email validation (simplified but more robust)
  const regex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  if (!regex.test(trimmed)) return null;
  // Additional length checks
  if (trimmed.length > 254) return null;
  const [local] = trimmed.split('@');
  if (local && local.length > 64) return null;
  return trimmed;
};

// Generate 6-digit OTP using cryptographically secure random
const generateOtp = (): string => {
  return crypto.randomInt(100000, 999999).toString();
};

/**
 * Timing-safe OTP comparison
 * Prevents timing attacks by always comparing in constant time
 */
const verifyOtpSecure = (provided: string, stored: string): boolean => {
  // Ensure both are 6 digits
  if (provided.length !== 6 || stored.length !== 6) {
    return false;
  }
  // Use timing-safe comparison
  const providedBuffer = Buffer.from(provided, 'utf8');
  const storedBuffer = Buffer.from(stored, 'utf8');
  return crypto.timingSafeEqual(providedBuffer, storedBuffer);
};

// Store pending OTPs with enhanced security
interface PendingOtp {
  email: string;
  codeHash: string; // Store hash instead of plaintext
  createdAt: number;
  attempts: number;
  lockedUntil?: number; // Account lockout timestamp
}
const pendingOtps = new Map<string, PendingOtp>();

// Hash OTP code for storage (in case of memory dump attack)
const hashOtp = (code: string): string => {
  return crypto.createHash('sha256').update(code).digest('hex');
};

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of pendingOtps.entries()) {
    // Clean expired OTPs and expired lockouts
    if (now - value.createdAt > OTP_EXPIRY_MS && (!value.lockedUntil || now > value.lockedUntil)) {
      pendingOtps.delete(key);
    }
  }
}, 5 * 60 * 1000);

// Generate OTP email HTML
function generateOtpEmailHtml(otpCode: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 40px 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #1e293b; font-size: 24px; font-weight: 600; margin: 0;">Arc Wallet</h1>
      </div>
      <div style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); border-radius: 16px; padding: 40px; text-align: center;">
        <p style="color: #94a3b8; font-size: 14px; margin: 0 0 20px 0;">Your verification code is:</p>
        <div style="background: rgba(255,255,255,0.1); border-radius: 12px; padding: 20px; margin-bottom: 20px;">
          <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #ffffff;">${otpCode}</span>
        </div>
        <p style="color: #64748b; font-size: 12px; margin: 0;">This code expires in 10 minutes</p>
      </div>
      <p style="color: #64748b; font-size: 12px; text-align: center; margin-top: 20px;">
        If you didn't request this code, you can safely ignore this email.
      </p>
    </div>
  `;
}

export const createCircleOtpRouter = (config: EnvConfig, db: Database, sessionStore: MagicSessionStore) => {
  const router = Router();
  // NOTE: We use SQLite Database (db) for user storage, NOT file-based userStore
  // This ensures passkey registration finds the same user created during OTP verification

  // Initialize SendGrid
  const sendgridApiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@arcwallet.network';

  if (sendgridApiKey) {
    sgMail.setApiKey(sendgridApiKey);
    // Don't log configuration status in production
  } else if (process.env.NODE_ENV === 'development') {
    console.warn('[OTP] SENDGRID_API_KEY not configured');
  }

  /**
   * Request OTP - Send verification code via SendGrid
   * POST /api/circle/otp/request
   */
  router.post('/api/circle/otp/request', rateLimitMiddleware('registration'), async (req: Request, res: Response) => {
    const email = sanitizeEmail(req.body?.email);

    if (!email) {
      return res.status(400).json({ success: false, error: 'Please provide a valid email address.' });
    }

    if (!sendgridApiKey) {
      return res.status(500).json({ success: false, error: 'Email service not configured' });
    }

    try {
      const otpKey = crypto.createHash('sha256').update(email).digest('hex');

      // Check if account is locked
      const existing = pendingOtps.get(otpKey);
      if (existing?.lockedUntil && Date.now() < existing.lockedUntil) {
        const remainingMinutes = Math.ceil((existing.lockedUntil - Date.now()) / 60000);
        return res.status(429).json({
          success: false,
          error: `Account temporarily locked. Please try again in ${remainingMinutes} minutes.`,
        });
      }

      // Generate OTP
      const otpCode = generateOtp();

      // Store OTP hash (not plaintext)
      pendingOtps.set(otpKey, {
        email,
        codeHash: hashOtp(otpCode),
        createdAt: Date.now(),
        attempts: 0,
      });

      // Send email via SendGrid
      await sgMail.send({
        to: email,
        from: {
          email: fromEmail,
          name: 'Arc Wallet',
        },
        subject: 'Your Arc Wallet verification code',
        html: generateOtpEmailHtml(otpCode),
        text: `Your Arc Wallet verification code is: ${otpCode}\n\nThis code expires in 10 minutes.\n\nIf you didn't request this code, you can safely ignore this email.`,
      });

      // Log with masked email (PII protection)
      if (process.env.NODE_ENV === 'development') {
        console.log(`[OTP] Code sent to ${maskEmail(email)}`);
      }

      res.json({
        success: true,
        message: 'Verification code sent to your email',
      });
    } catch (error: any) {
      console.error('[OTP] Send error:', error?.response?.body || error);
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

    if (!sendgridApiKey) {
      return res.status(500).json({ success: false, error: 'Email service not configured' });
    }

    try {
      const otpKey = crypto.createHash('sha256').update(email).digest('hex');

      // Check if account is locked
      const existing = pendingOtps.get(otpKey);
      if (existing?.lockedUntil && Date.now() < existing.lockedUntil) {
        const remainingMinutes = Math.ceil((existing.lockedUntil - Date.now()) / 60000);
        return res.status(429).json({
          success: false,
          error: `Account temporarily locked. Please try again in ${remainingMinutes} minutes.`,
        });
      }

      // Generate new OTP
      const otpCode = generateOtp();

      // Store OTP hash (replace old one)
      pendingOtps.set(otpKey, {
        email,
        codeHash: hashOtp(otpCode),
        createdAt: Date.now(),
        attempts: 0,
      });

      // Send email via SendGrid
      await sgMail.send({
        to: email,
        from: {
          email: fromEmail,
          name: 'Arc Wallet',
        },
        subject: 'Your Arc Wallet verification code',
        html: generateOtpEmailHtml(otpCode),
        text: `Your new Arc Wallet verification code is: ${otpCode}\n\nThis code expires in 10 minutes.\n\nIf you didn't request this code, you can safely ignore this email.`,
      });

      // Log with masked email (PII protection)
      if (process.env.NODE_ENV === 'development') {
        console.log(`[OTP] Code resent to ${maskEmail(email)}`);
      }

      res.json({
        success: true,
        message: 'New verification code sent to your email',
      });
    } catch (error: any) {
      console.error('[OTP] Resend error:', error?.response?.body || error);
      res.status(500).json({
        success: false,
        error: 'Failed to resend verification code. Please try again.',
      });
    }
  });

  /**
   * Verify OTP
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

    try {
      const otpKey = crypto.createHash('sha256').update(email).digest('hex');
      const pending = pendingOtps.get(otpKey);

      if (!pending) {
        return res.status(400).json({
          success: false,
          error: 'No verification code found. Please request a new one.',
        });
      }

      // Check if account is locked
      if (pending.lockedUntil && Date.now() < pending.lockedUntil) {
        const remainingMinutes = Math.ceil((pending.lockedUntil - Date.now()) / 60000);
        return res.status(429).json({
          success: false,
          error: `Account temporarily locked. Please try again in ${remainingMinutes} minutes.`,
        });
      }

      // Check expiry
      if (Date.now() - pending.createdAt > OTP_EXPIRY_MS) {
        pendingOtps.delete(otpKey);
        return res.status(400).json({
          success: false,
          error: 'Verification code has expired. Please request a new one.',
        });
      }

      // Check attempts (max 5) with account lockout
      if (pending.attempts >= MAX_OTP_ATTEMPTS) {
        // Lock the account for 30 minutes
        pending.lockedUntil = Date.now() + ACCOUNT_LOCKOUT_MS;
        console.warn(`[OTP] Account locked due to too many attempts: ${maskEmail(email)}`);
        return res.status(429).json({
          success: false,
          error: 'Too many failed attempts. Account locked for 30 minutes.',
        });
      }

      // Verify code using timing-safe comparison
      const providedHash = hashOtp(otpCode);
      const isValid = crypto.timingSafeEqual(
        Buffer.from(providedHash, 'hex'),
        Buffer.from(pending.codeHash, 'hex')
      );

      if (!isValid) {
        pending.attempts++;
        const remainingAttempts = MAX_OTP_ATTEMPTS - pending.attempts;
        return res.status(400).json({
          success: false,
          error: remainingAttempts > 0
            ? `Invalid verification code. ${remainingAttempts} attempts remaining.`
            : 'Invalid verification code. Account will be locked.',
        });
      }

      // Success - clean up OTP
      pendingOtps.delete(otpKey);

      // CRITICAL: Create or find user in SQLite Database
      // This is the SAME database that passkey registration uses
      // Ensures email->passkey linking works correctly
      let dbUser = await db.getUserByUsername(email);

      if (!dbUser) {
        // First time login - create user in SQLite
        const userId = randomUUID();
        dbUser = await db.createUser({
          id: userId,
          username: email,
          displayName: email.split('@')[0],
        });
        if (process.env.NODE_ENV === 'development') {
          console.log(`[OTP] Created new user: ${maskEmail(email)}`);
        }
      }

      // Create session with user info (now using SQLite-backed secure session store)
      const now = new Date().toISOString();
      const sessionUser = {
        id: dbUser.id,
        email,
        createdAt: dbUser.createdAt?.toISOString?.() || now,
        updatedAt: dbUser.updatedAt?.toISOString?.() || now,
      };
      const session = sessionStore.create(sessionUser, SESSION_TTL_MS);

      if (process.env.NODE_ENV === 'development') {
        console.log(`[OTP] Session created for ${maskEmail(email)}`);
      }

      // Set session cookie
      const cookieOptions = COOKIE_BASE_OPTIONS(config.NODE_ENV === 'production');
      res.cookie(SESSION_COOKIE_NAME, session.id, cookieOptions);

      // Return userId so frontend can link passkey to same user
      res.json({
        success: true,
        message: 'Email verified successfully',
        data: {
          email: session.email,
          userId: dbUser.id,
          hasWallet: !!dbUser.walletAddress,
          walletAddress: dbUser.walletAddress || null,
        },
      });
    } catch (error) {
      console.error('[OTP] Verify error:', error);
      res.status(500).json({
        success: false,
        error: 'Verification failed. Please try again.',
      });
    }
  });

  /**
   * Get current session
   * GET /api/session
   */
  router.get('/api/session', async (req: Request, res: Response) => {
    const sessionId = (req as any).cookies?.[SESSION_COOKIE_NAME];
    const session = sessionStore.get(sessionId);

    if (!session) {
      return res.status(401).json({ success: false, error: 'Session not found.' });
    }

    try {
      // Get user details from database to check for wallet
      const user = await db.getUserByUsername(session.email);

      res.json({
        success: true,
        data: {
          email: session.email,
          hasWallet: !!user?.walletAddress,
          walletAddress: user?.walletAddress || null,
          userId: user?.id || null,
        },
      });
    } catch (error) {
      console.error('[Session] Fetch error:', error);
      // Fallback to just email if DB fails
      res.json({
        success: true,
        data: { email: session.email },
      });
    }
  });

  /**
   * Logout - clear session
   * POST /api/logout
   */
  router.post('/api/logout', (req: Request, res: Response) => {
    const sessionId = (req as any).cookies?.[SESSION_COOKIE_NAME];
    sessionStore.delete(sessionId);
    res.clearCookie(SESSION_COOKIE_NAME, COOKIE_BASE_OPTIONS(config.NODE_ENV === 'production'));
    res.json({ success: true });
  });

  return router;
};
