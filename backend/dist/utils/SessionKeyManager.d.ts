import { Database } from '../models/Database.js';
import { SessionKey } from '../types/index.js';
export declare class SessionKeyManager {
    private db;
    constructor(db: Database);
    /**
     * Generate a new session key for a user
     */
    generateSessionKey(userId: string, expirationHours?: number): Promise<SessionKey>;
    /**
     * Get active session keys for a user
     */
    getActiveSessionKeys(userId: string): Promise<SessionKey[]>;
    /**
     * Get the most recent active session key for a user
     */
    getLatestSessionKey(userId: string): Promise<SessionKey | null>;
    /**
     * Get a session key by its ID
     */
    getSessionKeyById(sessionKeyId: string): Promise<SessionKey | null>;
    /**
     * Revoke a specific session key
     */
    revokeSessionKey(sessionKeyId: string): Promise<void>;
    /**
     * Revoke all session keys for a user
     */
    revokeAllSessionKeys(userId: string): Promise<void>;
    /**
     * Cleanup expired session keys
     */
    cleanupExpiredKeys(): Promise<void>;
    /**
     * Validate if a session key is still active
     */
    validateSessionKey(privateKey: string): Promise<SessionKey | null>;
    /**
     * Get all active session keys (for validation purposes)
     * Note: This is not efficient for large datasets, consider indexing in production
     */
    private getAllActiveSessionKeys;
    /**
     * Create a session key from an existing private key (for migration purposes)
     */
    importSessionKey(userId: string, privateKey: string, expirationHours?: number): Promise<SessionKey>;
    /**
     * Extend session key expiration
     */
    extendSessionKey(sessionKeyId: string, additionalHours?: number): Promise<SessionKey | null>;
    /**
     * Get session key statistics for a user
     */
    getSessionKeyStats(userId: string): Promise<{
        totalActive: number;
        totalGenerated: number;
        oldestActive?: Date;
        newestActive?: Date;
    }>;
}
//# sourceMappingURL=SessionKeyManager.d.ts.map