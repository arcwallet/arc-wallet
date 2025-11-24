import { MagicSession, MagicUser } from './types.js';
export declare class MagicSessionStore {
    private sessions;
    create(user: MagicUser, ttlMs?: number): MagicSession;
    get(sessionId?: string | null): MagicSession | null;
    delete(sessionId?: string | null): void;
}
//# sourceMappingURL=SessionStore.d.ts.map