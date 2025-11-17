import { randomUUID } from 'crypto';
import { MagicSession, MagicUser } from './types.js';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export class MagicSessionStore {
  private sessions = new Map<string, MagicSession>();

  create(user: MagicUser, ttlMs: number = ONE_DAY_MS): MagicSession {
    const id = randomUUID();
    const now = Date.now();
    const session: MagicSession = {
      id,
      userId: user.id,
      email: user.email,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + ttlMs).toISOString(),
    };
    this.sessions.set(id, session);
    return session;
  }

  get(sessionId?: string | null): MagicSession | null {
    if (!sessionId) {
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

  delete(sessionId?: string | null) {
    if (!sessionId) return;
    this.sessions.delete(sessionId);
  }
}
