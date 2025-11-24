import { randomUUID } from 'crypto';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
export class MagicSessionStore {
    sessions = new Map();
    create(user, ttlMs = ONE_DAY_MS) {
        const id = randomUUID();
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
}
//# sourceMappingURL=SessionStore.js.map