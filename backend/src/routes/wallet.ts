import express, { Router, Request, Response } from 'express';
import { Database } from '../models/Database.js';
import { EnvConfig } from '../types/index.js';
import { MagicSessionStore } from '../magicLink/SessionStore.js';

const SESSION_COOKIE_NAME = 'arcwallet_session';

type CookieRequest = Request & { cookies?: Record<string, string> };

export const createWalletRouter = (db: Database, config: EnvConfig, sessionStore: MagicSessionStore) => {
    const router = Router();

    // Middleware to check session
    const requireSession = async (req: Request, res: Response, next: express.NextFunction) => {
        const sessionId = (req as CookieRequest).cookies?.[SESSION_COOKIE_NAME];
        if (!sessionId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const session = sessionStore.get(sessionId);
        if (!session) {
            return res.status(401).json({ success: false, error: 'Session expired or invalid' });
        }

        // Attach user to request
        (req as any).user = { id: session.userId, email: session.email };
        next();
    };

    // Save encrypted wallet
    router.post('/backup', requireSession, async (req: Request, res: Response) => {
        try {
            const userId = (req as any).user.id;
            const { encryptedWallet } = req.body;

            if (!encryptedWallet || typeof encryptedWallet !== 'string') {
                return res.status(400).json({ success: false, error: 'Invalid encrypted wallet data' });
            }

            await db.updateEncryptedWallet(userId, encryptedWallet);

            res.json({ success: true, message: 'Wallet backed up successfully' });
        } catch (error) {
            console.error('Backup error:', error);
            res.status(500).json({ success: false, error: 'Failed to backup wallet' });
        }
    });

    // Get encrypted wallet
    router.get('/backup', requireSession, async (req: Request, res: Response) => {
        try {
            const userId = (req as any).user.id;
            const encryptedWallet = await db.getEncryptedWallet(userId);

            if (!encryptedWallet) {
                return res.status(404).json({ success: false, error: 'No backup found' });
            }

            res.json({ success: true, encryptedWallet });
        } catch (error) {
            console.error('Restore error:', error);
            res.status(500).json({ success: false, error: 'Failed to retrieve wallet backup' });
        }
    });

    return router;
};
