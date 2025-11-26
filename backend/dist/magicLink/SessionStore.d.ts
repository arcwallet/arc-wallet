/**
 * Session Store with enhanced security
 *
 * Security features:
 * - Cryptographically secure 256-bit session IDs (not predictable UUIDs)
 * - Automatic cleanup of expired sessions
 * - Memory-based for simplicity and compatibility
 */
import { MagicSession, MagicUser } from './types.js';
export declare class MagicSessionStore {
    private sessions;
    private cleanupInterval;
    constructor();
    /**
     * Generate cryptographically secure session ID
     */
    private generateSecureSessionId;
    create(user: MagicUser, ttlMs?: number): MagicSession;
    get(sessionId?: string | null): MagicSession | null;
    delete(sessionId?: string | null): void;
    /**
     * Cleanup expired sessions
     */
    private cleanup;
    /**
     * Get active session count (for monitoring)
     */
    getActiveSessionCount(): number;
}
//# sourceMappingURL=SessionStore.d.ts.map