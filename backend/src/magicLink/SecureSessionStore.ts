import crypto from 'crypto';
import fs from 'fs';
import { MagicSession, MagicUser } from './types.js';
import BetterSqlite3 from 'better-sqlite3';
import path from 'path';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const SESSION_ID_BYTES = 32; // 256-bit session ID

/**
 * Secure Session Store with SQLite persistence
 *
 * Security features:
 * - Cryptographically secure session IDs (256-bit random)
 * - SQLite persistence (survives server restarts)
 * - Automatic cleanup of expired sessions
 * - Session fingerprinting (IP + User-Agent binding)
 */
export class SecureSessionStore {
  private db: BetterSqlite3.Database;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(dbPath?: string) {
    const resolvedPath = dbPath || path.join(process.cwd(), 'data', 'sessions.db');

    // Ensure data directory exists
    const dir = path.dirname(resolvedPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new BetterSqlite3(resolvedPath);
    this.initializeSchema();
    this.startCleanupJob();
  }

  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        email TEXT NOT NULL,
        fingerprint TEXT,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        last_accessed_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    `);
  }

  /**
   * Generate cryptographically secure session ID
   * Uses 256-bit random bytes encoded as URL-safe base64
   */
  private generateSecureSessionId(): string {
    return crypto.randomBytes(SESSION_ID_BYTES).toString('base64url');
  }

  /**
   * Generate session fingerprint from request metadata
   * Helps prevent session hijacking by binding session to client characteristics
   */
  generateFingerprint(ip?: string, userAgent?: string): string {
    const data = `${ip || 'unknown'}|${userAgent || 'unknown'}`;
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 32);
  }

  /**
   * Create a new secure session
   */
  create(user: MagicUser, ttlMs: number = ONE_DAY_MS, fingerprint?: string): MagicSession {
    const id = this.generateSecureSessionId();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMs);

    const session: MagicSession = {
      id,
      userId: user.id,
      email: user.email,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    const stmt = this.db.prepare(`
      INSERT INTO sessions (id, user_id, email, fingerprint, created_at, expires_at, last_accessed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      session.id,
      session.userId,
      session.email,
      fingerprint || null,
      session.createdAt,
      session.expiresAt,
      session.createdAt
    );

    return session;
  }

  /**
   * Get session by ID with optional fingerprint validation
   */
  get(sessionId?: string | null, fingerprint?: string): MagicSession | null {
    if (!sessionId) {
      return null;
    }

    // Validate session ID format (base64url, 43 chars for 32 bytes)
    if (!/^[A-Za-z0-9_-]{43}$/.test(sessionId)) {
      return null;
    }

    const stmt = this.db.prepare(`
      SELECT id, user_id, email, fingerprint, created_at, expires_at
      FROM sessions
      WHERE id = ?
    `);

    const row = stmt.get(sessionId) as {
      id: string;
      user_id: string;
      email: string;
      fingerprint: string | null;
      created_at: string;
      expires_at: string;
    } | undefined;

    if (!row) {
      return null;
    }

    // Check expiration
    if (Date.now() > Date.parse(row.expires_at)) {
      this.delete(sessionId);
      return null;
    }

    // Validate fingerprint if provided and stored
    if (fingerprint && row.fingerprint && row.fingerprint !== fingerprint) {
      // Potential session hijacking attempt - log and invalidate
      console.warn(`[Session] Fingerprint mismatch for session, potential hijacking attempt`);
      this.delete(sessionId);
      return null;
    }

    // Update last accessed time
    const updateStmt = this.db.prepare(`
      UPDATE sessions SET last_accessed_at = ? WHERE id = ?
    `);
    updateStmt.run(new Date().toISOString(), sessionId);

    return {
      id: row.id,
      userId: row.user_id,
      email: row.email,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
    };
  }

  /**
   * Delete a session
   */
  delete(sessionId?: string | null): void {
    if (!sessionId) return;

    const stmt = this.db.prepare('DELETE FROM sessions WHERE id = ?');
    stmt.run(sessionId);
  }

  /**
   * Delete all sessions for a user (useful for logout all devices)
   */
  deleteAllForUser(userId: string): number {
    const stmt = this.db.prepare('DELETE FROM sessions WHERE user_id = ?');
    const result = stmt.run(userId);
    return result.changes;
  }

  /**
   * Regenerate session ID (for session fixation prevention)
   */
  regenerate(oldSessionId: string): MagicSession | null {
    const session = this.get(oldSessionId);
    if (!session) {
      return null;
    }

    // Get fingerprint from old session
    const stmt = this.db.prepare('SELECT fingerprint FROM sessions WHERE id = ?');
    const row = stmt.get(oldSessionId) as { fingerprint: string | null } | undefined;
    const fingerprint = row?.fingerprint;

    // Delete old session
    this.delete(oldSessionId);

    // Create new session with same user data but new ID
    const remainingTtl = Date.parse(session.expiresAt) - Date.now();
    return this.create(
      { id: session.userId, email: session.email, createdAt: session.createdAt, updatedAt: new Date().toISOString() },
      remainingTtl > 0 ? remainingTtl : ONE_DAY_MS,
      fingerprint || undefined
    );
  }

  /**
   * Cleanup expired sessions
   */
  cleanup(): number {
    const stmt = this.db.prepare('DELETE FROM sessions WHERE expires_at < ?');
    const result = stmt.run(new Date().toISOString());
    if (result.changes > 0 && process.env.NODE_ENV === 'development') {
      console.log(`[Session] Cleaned up ${result.changes} expired sessions`);
    }
    return result.changes;
  }

  /**
   * Start periodic cleanup job
   */
  private startCleanupJob(): void {
    // Run cleanup every 15 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 15 * 60 * 1000);

    // Initial cleanup
    this.cleanup();
  }

  /**
   * Get active session count (for monitoring)
   */
  getActiveSessionCount(): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM sessions WHERE expires_at > ?');
    const row = stmt.get(new Date().toISOString()) as { count: number };
    return row.count;
  }

  /**
   * Close database connection
   */
  close(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.db.close();
  }
}

// Backward compatible wrapper that uses SecureSessionStore internally
// but exposes the same interface as MagicSessionStore
export class MagicSessionStore {
  private store: SecureSessionStore;

  constructor(dbPath?: string) {
    this.store = new SecureSessionStore(dbPath);
  }

  create(user: MagicUser, ttlMs: number = ONE_DAY_MS): MagicSession {
    return this.store.create(user, ttlMs);
  }

  get(sessionId?: string | null): MagicSession | null {
    return this.store.get(sessionId);
  }

  delete(sessionId?: string | null): void {
    this.store.delete(sessionId);
  }

  // Extended methods available through the secure store
  getSecureStore(): SecureSessionStore {
    return this.store;
  }
}
