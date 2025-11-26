/**
 * Email OTP Routes
 * Simple email-based OTP authentication using nodemailer
 */
import { Router } from 'express';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { MagicUserStore } from '../magicLink/UserStore.js';
import { rateLimitMiddleware } from '../middleware/security.js';
import path from 'path';
const SESSION_COOKIE_NAME = 'arcwallet_session';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const COOKIE_BASE_OPTIONS = (isProd) => ({
    httpOnly: true,
    sameSite: (isProd ? 'none' : 'lax'),
    secure: isProd,
    maxAge: 4 * 60 * 60 * 1000,
    path: '/',
});
const sanitizeEmail = (email) => {
    if (typeof email !== 'string')
        return null;
    const trimmed = email.trim().toLowerCase();
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
    return regex.test(trimmed) ? trimmed : null;
};
// Generate 6-digit OTP
const generateOtp = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};
const pendingOtps = new Map();
// Cleanup old OTPs every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of pendingOtps.entries()) {
        if (now - value.createdAt > OTP_EXPIRY_MS) {
            pendingOtps.delete(key);
        }
    }
}, 5 * 60 * 1000);
export const createCircleOtpRouter = (config, db, sessionStore) => {
    const router = Router();
    const userStore = new MagicUserStore(path.join(process.cwd(), 'data'));
    // Create nodemailer transporter
    const smtpHost = process.env.SMTP_HOST;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const fromAddress = process.env.EMAIL_FROM_ADDRESS || smtpUser;
    const fromName = process.env.EMAIL_FROM_NAME || 'Arc Wallet';
    const hasSmtp = Boolean(smtpHost && smtpUser && smtpPass);
    let transporter = null;
    if (hasSmtp) {
        transporter = nodemailer.createTransport({
            host: smtpHost,
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: false,
            auth: {
                user: smtpUser,
                pass: smtpPass,
            },
        });
        transporter.verify((error) => {
            if (error) {
                console.error('[OTP] SMTP connection failed:', error.message);
            }
            else {
                console.log('[OTP] SMTP connection verified successfully');
            }
        });
    }
    else {
        console.warn('[OTP] SMTP not configured, OTP codes will be logged to console');
    }
    // Send OTP email
    const sendOtpEmail = async (email, code) => {
        if (!transporter || !hasSmtp) {
            console.log(`📧 [OTP Preview] Code for ${email}: ${code}`);
            return true;
        }
        try {
            await transporter.sendMail({
                from: { name: fromName, address: fromAddress },
                to: email,
                subject: 'Your Arc Wallet verification code',
                text: `Your verification code is: ${code}\n\nThis code expires in 10 minutes.\n\nIf you didn't request this code, please ignore this email.`,
                html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="margin:0;padding:0;background-color:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
            <table width="100%" style="background-color:#f4f4f7;padding:40px 20px;">
              <tr>
                <td align="center">
                  <table width="100%" style="max-width:400px;background:#ffffff;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.05);">
                    <tr>
                      <td style="padding:32px;text-align:center;">
                        <h1 style="margin:0 0 8px;font-size:24px;color:#1a1a1a;">Arc Wallet</h1>
                        <p style="margin:0 0 24px;color:#666;font-size:14px;">Your verification code</p>
                        <div style="background:#f8f9fa;border-radius:8px;padding:20px;margin:0 0 24px;">
                          <span style="font-size:32px;font-weight:700;letter-spacing:8px;color:#1a1a1a;">${code}</span>
                        </div>
                        <p style="margin:0;color:#888;font-size:13px;">
                          This code expires in 10 minutes.<br>
                          If you didn't request this, ignore this email.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `,
            });
            console.log(`[OTP] Code sent to ${email}`);
            return true;
        }
        catch (error) {
            console.error('[OTP] Failed to send email:', error);
            return false;
        }
    };
    /**
     * Request OTP - Send verification code to email
     * POST /api/otp/request
     */
    router.post('/api/otp/request', rateLimitMiddleware('registration'), async (req, res) => {
        const email = sanitizeEmail(req.body?.email);
        if (!email) {
            return res.status(400).json({ success: false, error: 'Please provide a valid email address.' });
        }
        try {
            const code = generateOtp();
            const otpKey = crypto.createHash('sha256').update(email).digest('hex');
            // Store OTP
            pendingOtps.set(otpKey, {
                email,
                code,
                createdAt: Date.now(),
                attempts: 0,
            });
            // Send email
            const sent = await sendOtpEmail(email, code);
            if (!sent) {
                return res.status(500).json({
                    success: false,
                    error: 'Failed to send verification code. Please try again.',
                });
            }
            res.json({
                success: true,
                message: 'Verification code sent to your email',
            });
        }
        catch (error) {
            console.error('[OTP] Request error:', error);
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
    router.post('/api/otp/resend', rateLimitMiddleware('registration'), async (req, res) => {
        const email = sanitizeEmail(req.body?.email);
        if (!email) {
            return res.status(400).json({ success: false, error: 'Please provide a valid email address.' });
        }
        try {
            const code = generateOtp();
            const otpKey = crypto.createHash('sha256').update(email).digest('hex');
            // Update or create OTP
            pendingOtps.set(otpKey, {
                email,
                code,
                createdAt: Date.now(),
                attempts: 0,
            });
            // Send email
            const sent = await sendOtpEmail(email, code);
            if (!sent) {
                return res.status(500).json({
                    success: false,
                    error: 'Failed to resend verification code. Please try again.',
                });
            }
            res.json({
                success: true,
                message: 'New verification code sent to your email',
            });
        }
        catch (error) {
            console.error('[OTP] Resend error:', error);
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
    router.post('/api/otp/verify', rateLimitMiddleware('auth'), async (req, res) => {
        const email = sanitizeEmail(req.body?.email);
        const otpCode = typeof req.body?.code === 'string' ? req.body.code.trim() : null;
        if (!email) {
            return res.status(400).json({ success: false, error: 'Please provide a valid email address.' });
        }
        if (!otpCode || otpCode.length !== 6) {
            return res.status(400).json({ success: false, error: 'Please provide a valid 6-digit code.' });
        }
        const otpKey = crypto.createHash('sha256').update(email).digest('hex');
        const pending = pendingOtps.get(otpKey);
        // Check if OTP exists
        if (!pending) {
            return res.status(400).json({
                success: false,
                error: 'No verification code found. Please request a new code.',
            });
        }
        // Check expiry
        if (Date.now() - pending.createdAt > OTP_EXPIRY_MS) {
            pendingOtps.delete(otpKey);
            return res.status(400).json({
                success: false,
                error: 'Verification code expired. Please request a new code.',
            });
        }
        // Check attempts
        pending.attempts++;
        if (pending.attempts > 5) {
            pendingOtps.delete(otpKey);
            return res.status(429).json({
                success: false,
                error: 'Too many attempts. Please request a new code.',
            });
        }
        // Verify code
        if (pending.code !== otpCode) {
            return res.status(400).json({
                success: false,
                error: 'Invalid verification code. Please try again.',
            });
        }
        try {
            // OTP verified successfully - create session
            const user = userStore.findOrCreate(email);
            const session = sessionStore.create(user, SESSION_TTL_MS);
            // Clean up OTP
            pendingOtps.delete(otpKey);
            console.log(`[OTP] Verified for ${email}, creating session ${session.id}`);
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
        }
        catch (error) {
            console.error('[OTP] Verify error:', error);
            res.status(500).json({
                success: false,
                error: 'Verification failed. Please try again.',
            });
        }
    });
    return router;
};
//# sourceMappingURL=circleOtp.js.map