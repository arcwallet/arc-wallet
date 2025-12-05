import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { MagicSessionStore } from '../magicLink/SessionStore.js';

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; email: string };
    }
  }
}

// Session cookie name - must match the cookie set by CircleOTP, MagicLink, and PasskeyController
const SESSION_COOKIE_NAME = 'arcwallet_session';

/**
 * Auth middleware that supports both:
 * 1. Bearer JWT token in Authorization header
 * 2. Cookie-based session (arcwallet_session cookie)
 */
export const authMiddleware = (secret: string, sessionStore?: MagicSessionStore) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    // Try Bearer token first
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      try {
        const decoded = jwt.verify(token, secret) as { id: string; email: string };
        req.user = decoded;
        return next();
      } catch (error) {
        // Fall through to try cookie session
      }
    }

    // Try cookie-based session (check both cookie names for backwards compatibility)
    const sessionId = req.cookies?.[SESSION_COOKIE_NAME] || req.cookies?.magic_session;
    if (sessionId && sessionStore) {
      const session = sessionStore.get(sessionId);
      if (session) {
        req.user = { id: session.userId, email: session.email };
        return next();
      }
    }

    // No valid auth found
    return res.status(401).json({
      success: false,
      error: 'Missing authorization token',
      code: 'UNAUTHORIZED'
    });
  };
};
