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
import { EnvConfig } from '../types/index.js';
import { MagicSessionStore } from '../magicLink/SessionStore.js';
import { Database } from '../models/Database.js';
export declare const createCircleOtpRouter: (config: EnvConfig, db: Database, sessionStore: MagicSessionStore) => import("express-serve-static-core").Router;
//# sourceMappingURL=circleOtp.d.ts.map