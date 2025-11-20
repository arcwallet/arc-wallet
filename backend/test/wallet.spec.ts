import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { Database } from '../src/models/Database.js';
import { createWalletRouter } from '../src/routes/wallet.js';
import { MagicSessionStore } from '../src/magicLink/SessionStore.js';
import { EnvConfig } from '../src/types/index.js';
import { cookieMiddleware } from '../src/middleware/cookies.js';
import fs from 'fs';
import path from 'path';

describe('Wallet Persistence API', () => {
    let app: express.Express;
    let db: Database;
    let sessionStore: MagicSessionStore;
    let userId: string;
    let sessionId: string;

    const TEST_DB_PATH = path.join(process.cwd(), 'test-wallet.db');
    const MOCK_ENCRYPTED_WALLET = JSON.stringify({
        address: '0x123',
        encryptedData: 'mock-encrypted-data'
    });

    beforeAll(async () => {
        // Setup DB
        if (fs.existsSync(TEST_DB_PATH)) {
            fs.unlinkSync(TEST_DB_PATH);
        }
        db = new Database(TEST_DB_PATH);
        await db.waitForReady();

        // Setup Session Store
        sessionStore = new MagicSessionStore();

        // Create test user
        const userObj = {
            id: 'test-user-id-' + Date.now(),
            username: 'testuser_' + Date.now(),
            displayName: 'Test User',
            walletAddress: '0x123'
        };
        const user = await db.createUser(userObj);
        userId = user.id;

        // Create session
        const magicUser = {
            id: userId,
            email: 'test@example.com',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        const session = sessionStore.create(magicUser);
        sessionId = session.id;

        // Setup App
        app = express();
        app.use(express.json());
        app.use(cookieMiddleware);

        const config = {
            SESSION_SECRET: 'test-secret',
            MAGIC_LINK_BASE_URL: 'http://localhost:3000'
        } as EnvConfig;

        app.use('/api/wallet', createWalletRouter(db, config, sessionStore));
    });

    afterAll(async () => {
        await db.close();
        if (fs.existsSync(TEST_DB_PATH)) {
            fs.unlinkSync(TEST_DB_PATH);
        }
    });

    it('should fail without session cookie', async () => {
        const res = await request(app)
            .post('/api/wallet/backup')
            .send({ encryptedWallet: MOCK_ENCRYPTED_WALLET });

        expect(res.status).toBe(401);
    });

    it('should backup wallet successfully', async () => {
        const res = await request(app)
            .post('/api/wallet/backup')
            .set('Cookie', [`arcwallet_session=${sessionId}`])
            .send({ encryptedWallet: MOCK_ENCRYPTED_WALLET });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('should retrieve backed up wallet', async () => {
        const res = await request(app)
            .get('/api/wallet/backup')
            .set('Cookie', [`arcwallet_session=${sessionId}`]);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.encryptedWallet).toBe(MOCK_ENCRYPTED_WALLET);
    });

    it('should update existing backup', async () => {
        const NEW_WALLET_DATA = JSON.stringify({ address: '0x456', data: 'new-data' });

        await request(app)
            .post('/api/wallet/backup')
            .set('Cookie', [`arcwallet_session=${sessionId}`])
            .send({ encryptedWallet: NEW_WALLET_DATA })
            .expect(200);

        const res = await request(app)
            .get('/api/wallet/backup')
            .set('Cookie', [`arcwallet_session=${sessionId}`]);

        expect(res.body.encryptedWallet).toBe(NEW_WALLET_DATA);
    });
});
