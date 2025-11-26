/**
 * Email OTP Routes
 * Uses SendGrid for email delivery, simple OTP verification
 *
 * IMPORTANT: User records are stored in SQLite Database (not file system)
 * This ensures passkey registration can find the same user created during OTP verification
 */
import { EnvConfig } from '../types/index.js';
import { MagicSessionStore } from '../magicLink/SessionStore.js';
import { Database } from '../models/Database.js';
export declare const createCircleOtpRouter: (config: EnvConfig, db: Database, sessionStore: MagicSessionStore) => import("express-serve-static-core").Router;
//# sourceMappingURL=circleOtp.d.ts.map