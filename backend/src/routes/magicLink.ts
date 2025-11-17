import fs from 'fs';
import express, { Router, Request, Response } from 'express';
import path from 'path';
import { EnvConfig } from '../types/index.js';
import { MagicUserStore } from '../magicLink/UserStore.js';
import { MagicSessionStore } from '../magicLink/SessionStore.js';
import { MagicLinkService } from '../magicLink/MagicLinkService.js';
import { rateLimitMiddleware } from '../middleware/security.js';
import type { MagicLinkMailer } from '../services/magicLinkMailer.js';

const SESSION_COOKIE_NAME = 'arcwallet_session';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

type CookieRequest = Request & { cookies?: Record<string, string> };

const COOKIE_BASE_OPTIONS = (isProd: boolean) => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: isProd,
  maxAge: SESSION_TTL_MS,
  path: '/',
});

const sanitizeEmail = (email: unknown): string | null => {
  if (typeof email !== 'string') return null;
  const trimmed = email.trim().toLowerCase();
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
  return regex.test(trimmed) ? trimmed : null;
};

const renderTemplate = (title: string, body: string) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif; background: #0b1020; color: #eef3f8; display:flex; justify-content:center; align-items:center; min-height:100vh; margin:0; }
      .card { background:#131a2c; padding:32px; border-radius:16px; width: min(420px, 90vw); box-shadow:0 10px 40px rgba(3,10,35,0.45); }
      h1 { font-size:1.8rem; margin-bottom:1rem; }
      p { color:#b5c1d8; line-height:1.5; }
      form { display:flex; flex-direction:column; gap:12px; margin-top:1rem; }
      input[type="email"] { padding:12px 16px; border-radius:10px; border:1px solid #262f4c; background:#0b1122; color:#eef3f8; }
      button { padding:12px 16px; border-radius:10px; border:0; background:#5c7cfa; color:white; font-weight:600; cursor:pointer; }
      button:disabled { opacity:0.6; cursor:not-allowed; }
      .muted { color:#8292b5; font-size:0.9rem; margin-top:0.5rem; }
      .success { color:#5de28d; }
      .error { color:#ff6b6b; }
      .actions { display:flex; justify-content:space-between; gap:8px; margin-top:1rem; }
      a { color:#8fb7ff; text-decoration:none; }
    </style>
  </head>
  <body>
    <div class="card">
      ${body}
    </div>
  </body>
</html>`;

export const createMagicLinkRouter = (config: EnvConfig, mailer: MagicLinkMailer) => {
  const router = Router();
  const userStore = new MagicUserStore(path.join(process.cwd(), 'data'));
  const sessionStore = new MagicSessionStore();
  const tokenService = new MagicLinkService(config.SESSION_SECRET);
  const baseUrl = config.MAGIC_LINK_BASE_URL || `http://localhost:${config.PORT}`;
  const staticDir = path.join(process.cwd(), 'public');

  const requireSession = (req: Request) => {
    const sessionId = (req as CookieRequest).cookies?.[SESSION_COOKIE_NAME];
    return sessionStore.get(sessionId);
  };

  if (fs.existsSync(staticDir)) {
    router.use('/static', express.static(staticDir, { maxAge: '1m' }));
  }

  router.get('/login', (req, res) => {
    const session = requireSession(req);
    if (session) {
      return res.redirect('/dashboard');
    }

    const hintText = mailer.isConfigured()
      ? 'We will email you a secure, one-time sign-in link.'
      : 'During the demo the magic link is printed in the server console.';

    const body = `
      <h1>Arc Wallet Magic Link</h1>
      <p>Enter your email address to receive a one-time link.</p>
      <form id="magic-login-form" method="POST" action="/api/send-link">
        <input type="email" name="email" placeholder="ornek@arcwallet.io" required />
        <button type="submit">Send Link</button>
      </form>
      <p id="login-status" class="muted">${hintText}</p>
      <script defer src="/static/login.js"></script>
    `;
    res.send(renderTemplate('Sign In', body));
  });

  router.post('/api/send-link', rateLimitMiddleware('registration'), async (req, res) => {
    const email = sanitizeEmail(req.body?.email);
    if (!email) {
      return res.status(400).json({ success: false, error: 'Please provide a valid email address.' });
    }

    const user = userStore.findOrCreate(email);
    const token = tokenService.generateToken(user);
    const magicUrl = `${baseUrl}/auth/callback?token=${token}`;

    try {
      await mailer.sendMagicLink({ to: user.email, url: magicUrl });
    } catch (error) {
      console.error('Magic link email failed:', error);
      if (!mailer.isConfigured()) {
        console.log('📬 [Magic Link Preview]', user.email, magicUrl);
      }
      return res.status(500).json({ success: false, error: 'Failed to send magic link email.' });
    }

    res.json({
      success: true,
      message: mailer.isConfigured()
        ? 'Magic link sent. Please check your inbox.'
        : 'Magic link generated. Check server logs while email is disabled.'
    });
  });

  router.get('/auth/callback', (req, res) => {
    const { token } = req.query;
    if (!token || typeof token !== 'string') {
      return res.redirect('/login');
    }

    const body = `
      <h1>Verifying Link</h1>
      <p id="callback-message" class="muted">Starting a secure session…</p>
      <script defer src="/static/callback.js"></script>
    `;
    res.send(renderTemplate('Verification', body));
  });

  router.post('/api/verify', (req, res) => {
    const token = typeof req.body?.token === 'string' ? req.body.token : null;
    if (!token) {
      return res.status(400).json({ success: false, error: 'Token gerekli.' });
    }

    const payload = tokenService.verifyToken(token);
    if (!payload) {
      return res.status(400).json({ success: false, error: 'Invalid or expired magic link.' });
    }

    const user = userStore.findOrCreate(payload.email);
    const session = sessionStore.create(user, SESSION_TTL_MS);
    res.cookie(SESSION_COOKIE_NAME, session.id, COOKIE_BASE_OPTIONS(config.NODE_ENV === 'production'));
    res.json({ success: true });
  });

  router.get('/api/session', (req, res) => {
    const session = requireSession(req);
    if (!session) {
      return res.status(401).json({ success: false, error: 'Session not found.' });
    }
    res.json({
      success: true,
      data: { email: session.email },
    });
  });

  router.get('/dashboard', (req, res) => {
    const session = requireSession(req);
    if (!session) {
      return res.redirect('/login');
    }

    const body = `
      <h1>Welcome back</h1>
      <p class="muted">Signed in as:</p>
      <p class="success">${session.email}</p>
      <div class="actions">
        <a href="/login">Use another account</a>
        <form method="POST" action="/api/logout" style="margin:0;">
          <button type="submit">Sign Out</button>
        </form>
      </div>
    `;
    res.send(renderTemplate('Kontrol Paneli', body));
  });

  router.post('/api/logout', (req, res) => {
    const sessionId = (req as CookieRequest).cookies?.[SESSION_COOKIE_NAME];
    sessionStore.delete(sessionId);
    res.clearCookie(SESSION_COOKIE_NAME, COOKIE_BASE_OPTIONS(config.NODE_ENV === 'production'));
    const acceptsHtml = (req.headers.accept || '').includes('text/html');
    if (acceptsHtml) {
      return res.redirect('/login');
    }
    res.json({ success: true });
  });

  return router;
};
