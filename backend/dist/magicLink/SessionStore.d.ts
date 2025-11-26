/**
 * Session Store - Re-exports from SecureSessionStore for backward compatibility
 *
 * Security improvements in SecureSessionStore:
 * - Cryptographically secure 256-bit session IDs (not predictable UUIDs)
 * - SQLite persistence (survives server restarts, prevents DoS via memory exhaustion)
 * - Session fingerprinting (IP + User-Agent binding to prevent hijacking)
 * - Automatic cleanup of expired sessions
 * - Session regeneration support (prevents session fixation attacks)
 */
export { MagicSessionStore, SecureSessionStore } from './SecureSessionStore.js';
//# sourceMappingURL=SessionStore.d.ts.map