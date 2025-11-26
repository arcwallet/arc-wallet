/**
 * Email OTP Routes
 * Simple email-based OTP authentication using nodemailer
 */
import { EnvConfig } from '../types/index.js';
import { MagicSessionStore } from '../magicLink/SessionStore.js';
import { Database } from '../models/Database.js';
export declare const createCircleOtpRouter: (config: EnvConfig, db: Database, sessionStore: MagicSessionStore) => import("express-serve-static-core").Router;
//# sourceMappingURL=circleOtp.d.ts.map