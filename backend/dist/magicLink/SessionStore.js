/**
 * Session Store with enhanced security
 *
 * Security features:
 * - Cryptographically secure 256-bit session IDs (not predictable UUIDs)
 * - Automatic cleanup of expired sessions
 * - Memory-based for simplicity and compatibility
 */
import crypto from 'crypto';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const SESSION_ID_BYTES = 32; // 256-bit session ID
const MAX_SESSIONS = 10000; // Prevent memory exhaustion
export class MagicSessionStore {
    sessions = new Map();
    cleanupInterval = null;
    constructor() {
        // Start periodic cleanup every 5 minutes
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, 5 * 60 * 1000);
    }
    /**
     * Generate cryptographically secure session ID
     */
    generateSecureSessionId() {
        return crypto.randomBytes(SESSION_ID_BYTES).toString('base64url');
    }
    create(user, ttlMs = ONE_DAY_MS) {
        // Prevent memory exhaustion - remove oldest sessions if limit reached
        if (this.sessions.size >= MAX_SESSIONS) {
            this.cleanup();
            // If still at limit, remove oldest 10%
            if (this.sessions.size >= MAX_SESSIONS) {
                const toRemove = Math.floor(MAX_SESSIONS * 0.1);
                const keys = Array.from(this.sessions.keys()).slice(0, toRemove);
                keys.forEach(k => this.sessions.delete(k));
            }
        }
        const id = this.generateSecureSessionId();
        const now = Date.now();
        const session = {
            id,
            userId: user.id,
            email: user.email,
            createdAt: new Date(now).toISOString(),
            expiresAt: new Date(now + ttlMs).toISOString(),
        };
        this.sessions.set(id, session);
        return session;
    }
    get(sessionId) {
        if (!sessionId) {
            return null;
        }
        // Validate session ID format (base64url, 43 chars for 32 bytes)
        if (!/^[A-Za-z0-9_-]{43}$/.test(sessionId)) {
            return null;
        }
        const record = this.sessions.get(sessionId);
        if (!record) {
            return null;
        }
        if (Date.now() > Date.parse(record.expiresAt)) {
            this.sessions.delete(sessionId);
            return null;
        }
        return record;
    }
    delete(sessionId) {
        if (!sessionId)
            return;
        this.sessions.delete(sessionId);
    }
    /**
     * Cleanup expired sessions
     */
    cleanup() {
        const now = Date.now();
        for (const [key, session] of this.sessions.entries()) {
            if (now > Date.parse(session.expiresAt)) {
                this.sessions.delete(key);
            }
        }
    }
    /**
     * Get active session count (for monitoring)
     */
    getActiveSessionCount() {
        return this.sessions.size;
    }
}
//# sourceMappingURL=SessionStore.js.map