import { Request, Response } from 'express';
import { Database } from '../models/Database.js';
import { EnvConfig } from '../types/index.js';
export declare class PasskeyController {
    private db;
    private sessionKeyManager;
    private config;
    constructor(db: Database, config: EnvConfig);
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
}
//# sourceMappingURL=PasskeyController.d.ts.map