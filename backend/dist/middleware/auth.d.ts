import { Request, Response, NextFunction } from 'express';
import { MagicSessionStore } from '../magicLink/SessionStore.js';
declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string;
                email: string;
            };
        }
    }
}
/**
 * Auth middleware that supports both:
 * 1. Bearer JWT token in Authorization header
 * 2. Cookie-based session (arcwallet_session cookie)
 */
export declare const authMiddleware: (secret: string, sessionStore?: MagicSessionStore) => (req: Request, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
//# sourceMappingURL=auth.d.ts.map