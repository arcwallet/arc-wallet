import { Request, Response } from 'express';
import { Database } from '../models/Database.js';
import { MagicSessionStore } from '../magicLink/SessionStore.js';
import { EnvConfig } from '../types/index.js';
export declare class PasskeyController {
    private db;
    private sessionKeyManager;
    private config;
    private sessionStore?;
    constructor(db: Database, config: EnvConfig, sessionStore?: MagicSessionStore);
    /**
     * Start passkey registration
     */
    registrationStart: (req: Request, res: Response) => Promise<void>;
    /**
     * Finish passkey registration
     */
    registrationFinish: (req: Request, res: Response) => Promise<void>;
    /**
     * Start passkey authentication
     */
    authenticationStart: (req: Request, res: Response) => Promise<void>;
    /**
     * Finish passkey authentication
     */
    authenticationFinish: (req: Request, res: Response) => Promise<void>;
    /**
     * Get user session keys
     */
    getSessionKeys: (req: Request, res: Response) => Promise<void>;
    /**
     * Revoke session key
     */
    revokeSessionKey: (req: Request, res: Response, authUserId?: string) => Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * List passkey devices for a user
     */
    getDevices: (req: Request, res: Response) => Promise<void>;
    /**
     * Delete a passkey device (credential) by internal id
     */
    deleteDevice: (req: Request, res: Response, authUserId?: string) => Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * Health check endpoint
     */
    healthCheck: (req: Request, res: Response) => Promise<void>;
    private getAllChallenges;
    /**
     * Start passkey recovery - send recovery email
     */
    recoveryStart: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * Verify recovery token
     */
    recoveryVerify: (req: Request, res: Response) => Promise<void>;
    /**
     * Complete recovery - delete old passkeys and allow new registration
     */
    recoveryComplete: (req: Request, res: Response) => Promise<void>;
    /**
     * Reset user passkeys (development/testing only)
     * Deletes all passkeys for a user to allow fresh registration
     */
    resetUserPasskeys: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
    /**
     * Check if user has registered passkeys
     * Used to skip magic link when user already has passkeys for this email
     */
    checkUserPasskeys: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
    /**
     * Admin: Manually register a passkey credential for a user
     * This is used for recovery when WebAuthn registration was lost from server
     * but passkey still exists on user's device
     */
    adminRegisterCredential: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
    /**
     * Admin endpoint to reset ALL user data (for testing)
     * POST /passkeys/admin/reset-all
     */
    adminResetAll: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
}
//# sourceMappingURL=PasskeyController.d.ts.map