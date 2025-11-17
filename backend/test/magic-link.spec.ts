import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { Express } from 'express';
import { createMagicLinkRouter } from '../src/routes/magicLink.js';
import { cookieMiddleware } from '../src/middleware/cookies.js';
import type { EnvConfig } from '../src/types/index.js';
import type { MagicLinkMailer, MagicLinkMessage } from '../src/services/magicLinkMailer.js';

const baseConfig: EnvConfig = {
  PORT: 5050,
  NODE_ENV: 'test',
  ALLOWED_ORIGINS: ['http://localhost:5173'],
  RP_ID: 'localhost',
  RP_NAME: 'Arc Wallet',
  ORIGIN: 'http://localhost:5173',
  DB_PATH: './data/test.db',
  SESSION_SECRET: 'test-session-secret',
  JWT_SECRET: 'test-jwt-secret',
  RATE_LIMIT_WINDOW_MS: 900000,
  RATE_LIMIT_MAX_REQUESTS: 100,
  MAGIC_LINK_BASE_URL: 'https://app.arcwallet.network/auth/callback',
};

const createMailer = () => {
  const sent: MagicLinkMessage[] = [];
  const mailer: MagicLinkMailer = {
    isConfigured: () => true,
    sendMagicLink: vi.fn(async (message: MagicLinkMessage) => {
      sent.push(message);
    }),
  };
  return { mailer, sent };
};

const createApp = (mailer: MagicLinkMailer) => {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieMiddleware);
  app.use(createMagicLinkRouter(baseConfig, mailer));
  return app;
};

const sendLinkAndExtractToken = async (app: Express, sent: MagicLinkMessage[]) => {
  const email = 'sehermuaz@gmail.com';
  const response = await request(app).post('/api/send-link').send({ email });
  expect(response.status).toBe(200);
  expect(sent.length).toBeGreaterThan(0);
  const last = sent.at(-1)!;
  const url = new URL(last.url);
  const token = url.searchParams.get('token');
  expect(token).toBeTruthy();
  expect(url.origin + url.pathname).toBe(baseConfig.MAGIC_LINK_BASE_URL);
  return { token: token!, email, cookieUrl: url.toString() };
};

const originalCwd = process.cwd();
let tmpDir: string;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arcwallet-magic-link-'));
  process.chdir(tmpDir);
});

afterAll(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('Magic link router', () => {
  it('rejects invalid email payloads', async () => {
    const { mailer } = createMailer();
    const app = createApp(mailer);
    const response = await request(app).post('/api/send-link').send({ email: 'not-an-email' });
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ success: false });
    expect(mailer.sendMagicLink).not.toHaveBeenCalled();
  });

  it('completes send-link → verify → session → logout flow', async () => {
    const { mailer, sent } = createMailer();
    const app = createApp(mailer);

    const { token, email } = await sendLinkAndExtractToken(app, sent);
    expect(mailer.sendMagicLink).toHaveBeenCalledTimes(1);

    const verifyRes = await request(app).post('/api/verify').send({ token });
    expect(verifyRes.status).toBe(200);
    const cookieHeader = verifyRes.get('set-cookie');
    expect(cookieHeader).toBeDefined();
    const sessionCookie = cookieHeader?.find((cookie) => cookie.startsWith('arcwallet_session='));
    expect(sessionCookie).toBeDefined();

    const sessionRes = await request(app).get('/api/session').set('Cookie', sessionCookie!);
    expect(sessionRes.status).toBe(200);
    expect(sessionRes.body?.data?.email).toBe(email);

    const logoutRes = await request(app)
      .post('/api/logout')
      .set('Cookie', sessionCookie!)
      .set('Accept', 'application/json');
    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body).toMatchObject({ success: true });

    const afterLogout = await request(app).get('/api/session').set('Cookie', sessionCookie!);
    expect(afterLogout.status).toBe(401);
  });

  it('returns 400 when token missing during verify', async () => {
    const { mailer } = createMailer();
    const app = createApp(mailer);
    const res = await request(app).post('/api/verify').send({});
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false });
  });
});
