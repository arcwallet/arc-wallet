/**
 * Email OTP Routes (Server-Side Only)
 * Uses Microsoft Graph API for reliable email delivery
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { EnvConfig } from '../types/index.js';
import { MagicUserStore } from '../magicLink/UserStore.js';
import { MagicSessionStore } from '../magicLink/SessionStore.js';
import { rateLimitMiddleware } from '../middleware/security.js';
import { Database } from '../models/Database.js';
import path from 'path';

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

// Generate 6-digit OTP
const generateOtp = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Store pending OTPs
interface PendingOtp {
  email: string;
  code: string;
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

// Get Microsoft Graph access token
async function getGraphAccessToken(): Promise<string | null> {
  const tenantId = process.env.MS_TENANT_ID;
  const clientId = process.env.MS_CLIENT_ID;
  const clientSecret = process.env.MS_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    console.warn('[OTP] Microsoft Graph not configured');
    return null;
  }

  try {
    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials',
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('[OTP] Graph token error:', data);
      return null;
    }

    return data.access_token;
  } catch (error) {
    console.error('[OTP] Graph token fetch error:', error);
    return null;
  }
}

// Send email via Microsoft Graph API
async function sendEmailViaGraph(to: string, subject: string, htmlContent: string, textContent: string): Promise<boolean> {
  const accessToken = await getGraphAccessToken();
  const senderEmail = process.env.MS_SENDER_EMAIL || 'support@arcwallet.network';

  if (!accessToken) {
    return false;
  }

  try {
    const response = await fetch(`https://graph.microsoft.com/v1.0/users/${senderEmail}/sendMail`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          subject,
          body: {
            contentType: 'HTML',
            content: htmlContent,
          },
          toRecipients: [{ emailAddress: { address: to } }],
        },
        saveToSentItems: false,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[OTP] Graph send error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[OTP] Graph send exception:', error);
    return false;
  }
}

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
  const userStore = new MagicUserStore(path.join(process.cwd(), 'data'));

  /**
   * Request OTP - Send verification code via email
   * POST /api/circle/otp/request
   */
  router.post('/api/circle/otp/request', rateLimitMiddleware('registration'), async (req: Request, res: Response) => {
    const email = sanitizeEmail(req.body?.email);

    if (!email) {
      return res.status(400).json({ success: false, error: 'Please provide a valid email address.' });
    }

    try {
      // Generate OTP
      const otpCode = generateOtp();
      const otpKey = crypto.createHash('sha256').update(email).digest('hex');

      // Store OTP
      pendingOtps.set(otpKey, {
        email,
        code: otpCode,
        createdAt: Date.now(),
        attempts: 0,
      });

      // Send email via Graph API
      const htmlContent = generateOtpEmailHtml(otpCode);
      const textContent = `Your Arc Wallet verification code is: ${otpCode}\n\nThis code expires in 10 minutes.`;

      const sent = await sendEmailViaGraph(
        email,
        'Your Arc Wallet verification code',
        htmlContent,
        textContent
      );

      if (!sent) {
        return res.status(500).json({
          success: false,
          error: 'Failed to send verification code. Please try again.',
        });
      }

      console.log(`[OTP] Code sent to ${email}`);

      res.json({
        success: true,
        message: 'Verification code sent to your email',
      });
    } catch (error) {
      console.error('[OTP] Send error:', error);
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

    try {
      // Generate new OTP
      const otpCode = generateOtp();
      const otpKey = crypto.createHash('sha256').update(email).digest('hex');

      // Store OTP (replace old one)
      pendingOtps.set(otpKey, {
        email,
        code: otpCode,
        createdAt: Date.now(),
        attempts: 0,
      });

      // Send email via Graph API
      const htmlContent = generateOtpEmailHtml(otpCode);
      const textContent = `Your new Arc Wallet verification code is: ${otpCode}\n\nThis code expires in 10 minutes.`;

      const sent = await sendEmailViaGraph(
        email,
        'Your Arc Wallet verification code',
        htmlContent,
        textContent
      );

      if (!sent) {
        return res.status(500).json({
          success: false,
          error: 'Failed to resend verification code. Please try again.',
        });
      }

      console.log(`[OTP] Code resent to ${email}`);

      res.json({
        success: true,
        message: 'New verification code sent to your email',
      });
    } catch (error) {
      console.error('[OTP] Resend error:', error);
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

      // Check expiry
      if (Date.now() - pending.createdAt > OTP_EXPIRY_MS) {
        pendingOtps.delete(otpKey);
        return res.status(400).json({
          success: false,
          error: 'Verification code has expired. Please request a new one.',
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

      // Verify code
      if (pending.code !== otpCode) {
        pending.attempts++;
        return res.status(400).json({
          success: false,
          error: 'Invalid verification code. Please try again.',
        });
      }

      // Success - clean up and create session
      pendingOtps.delete(otpKey);

      const user = userStore.findOrCreate(email);
      const session = sessionStore.create(user, SESSION_TTL_MS);

      console.log(`[OTP] Verified and session created for ${email}`);

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
      console.error('[OTP] Verify error:', error);
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
