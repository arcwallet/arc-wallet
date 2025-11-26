import { MagicSession, MagicUser } from './types.js';
/**
 * Secure Session Store with SQLite persistence
 *
 * Security features:
 * - Cryptographically secure session IDs (256-bit random)
 * - SQLite persistence (survives server restarts)
 * - Automatic cleanup of expired sessions
 * - Session fingerprinting (IP + User-Agent binding)
 */
export declare class SecureSessionStore {
    private db;
    private cleanupInterval;
    constructor(dbPath?: string);
    private initializeSchema;
    /**
     * Generate cryptographically secure session ID
     * Uses 256-bit random bytes encoded as URL-safe base64
     */
    private generateSecureSessionId;
    /**
     * Generate session fingerprint from request metadata
     * Helps prevent session hijacking by binding session to client characteristics
     */
    generateFingerprint(ip?: string, userAgent?: string): string;
    /**
     * Create a new secure session
     */
    create(user: MagicUser, ttlMs?: number, fingerprint?: string): MagicSession;
    /**
     * Get session by ID with optional fingerprint validation
     */
    get(sessionId?: string | null, fingerprint?: string): MagicSession | null;
    /**
     * Delete a session
     */
    delete(sessionId?: string | null): void;
    /**
     * Delete all sessions for a user (useful for logout all devices)
     */
    deleteAllForUser(userId: string): number;
    /**
     * Regenerate session ID (for session fixation prevention)
     */
    regenerate(oldSessionId: string): MagicSession | null;
    /**
     * Cleanup expired sessions
     */
    cleanup(): number;
    /**
     * Start periodic cleanup job
     */
    private startCleanupJob;
    /**
     * Get active session count (for monitoring)
     */
    getActiveSessionCount(): number;
    /**
     * Close database connection
     */
    close(): void;
}
export declare class MagicSessionStore {
    private store;
    constructor(dbPath?: string);
    create(user: MagicUser, ttlMs?: number): MagicSession;
    get(sessionId?: string | null): MagicSession | null;
    delete(sessionId?: string | null): void;
    getSecureStore(): SecureSessionStore;
}
//# sourceMappingURL=SecureSessionStore.d.ts.map