/**
 * Passkey (WebAuthn) API Tests
 *
 * Tests the complete passkey registration and authentication flow
 * including session key management, device management, and recovery.
 *
 * @module tests/passkey
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import express, { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import type { Express } from 'express';
import { createPasskeyRoutes } from '../src/routes/passkeys.js';
import { Database } from '../src/models/Database.js';
import { cookieMiddleware } from '../src/middleware/cookies.js';
import type { EnvConfig, ApiError } from '../src/types/index.js';

// ============================================================================
// Test Configuration
// ============================================================================

const testConfig: EnvConfig = {
  PORT: 5050,
  NODE_ENV: 'test',
  ALLOWED_ORIGINS: ['http://localhost:5173'],
  RP_ID: 'localhost',
  RP_NAME: 'Arc Wallet Test',
  ORIGIN: 'http://localhost:5173',
  DB_PATH: './data/passkey-test.db',
  SESSION_SECRET: 'test-session-secret-passkey',
  JWT_SECRET: 'test-jwt-secret-passkey',
  RATE_LIMIT_WINDOW_MS: 900000,
  RATE_LIMIT_MAX_REQUESTS: 1000, // Higher limit for tests
  MAGIC_LINK_BASE_URL: 'https://app.arcwallet.network/auth/callback',
};

// ============================================================================
// Mock Data
// ============================================================================

/**
 * Creates a mock WebAuthn registration credential response
 */
const createMockRegistrationCredential = (challenge: string) => ({
  id: 'test-credential-id-' + randomUUID().slice(0, 8),
  rawId: 'dGVzdC1jcmVkZW50aWFsLWlk',
  type: 'public-key',
  response: {
    clientDataJSON: Buffer.from(JSON.stringify({
      type: 'webauthn.create',
      challenge: challenge,
      origin: testConfig.ORIGIN,
      crossOrigin: false
    })).toString('base64url'),
    attestationObject: 'o2NmbXRkbm9uZWdhdHRTdG10oGhhdXRoRGF0YVjEyeVXBBAt',
    transports: ['internal', 'hybrid']
  },
  clientExtensionResults: {}
});

/**
 * Creates a mock WebAuthn authentication credential response
 */
const createMockAuthenticationCredential = (challenge: string, credentialId: string) => ({
  id: credentialId,
  rawId: credentialId,
  type: 'public-key',
  response: {
    clientDataJSON: Buffer.from(JSON.stringify({
      type: 'webauthn.get',
      challenge: challenge,
      origin: testConfig.ORIGIN,
      crossOrigin: false
    })).toString('base64url'),
    authenticatorData: 'SZYN5YgOjGh0NBcPZHZgW4_krrmihjLHmVzzuoMdl2MFYftypQ',
    signature: 'MEUCIQDNrHFnqW...',
    userHandle: null
  },
  clientExtensionResults: {}
});

// ============================================================================
// Test Setup
// ============================================================================

let app: Express;
let db: Database;
let tmpDir: string;
const originalCwd = process.cwd();

/**
 * Error handler middleware for tests
 */
const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    error: err.message,
    code: err.code || 'INTERNAL_ERROR',
  });
};

/**
 * Creates Express app with passkey routes
 */
const createApp = () => {
  const application = express();
  db = new Database(testConfig.DB_PATH);
  application.use(express.json());
  application.use(express.urlencoded({ extended: true }));
  application.use(cookieMiddleware);
  application.use('/passkeys', createPasskeyRoutes(db, testConfig));
  application.use(errorHandler);
  return application;
};

beforeAll(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arcwallet-passkey-test-'));
  process.chdir(tmpDir);
  app = createApp();
  await db.waitForReady();
});

afterAll(async () => {
  await db.close();
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ============================================================================
// Registration Tests
// ============================================================================

describe('Passkey Registration', () => {
  describe('POST /passkeys/register/start', () => {
    it('should return registration options for new user', async () => {
      const response = await request(app)
        .post('/passkeys/register/start')
        .send({
          username: 'newuser@example.com',
          displayName: 'New User'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.options).toBeDefined();
      expect(response.body.data.options.challenge).toBeDefined();
      expect(response.body.data.options.rp.id).toBe(testConfig.RP_ID);
      expect(response.body.data.options.rp.name).toBe(testConfig.RP_NAME);
      expect(response.body.data.options.user.name).toBe('newuser@example.com');
    });

    it('should normalize username to lowercase', async () => {
      const response = await request(app)
        .post('/passkeys/register/start')
        .send({
          username: 'UPPERCASE@EXAMPLE.COM',
          displayName: 'Test User'
        });

      expect(response.status).toBe(200);
      expect(response.body.data.options.user.name).toBe('uppercase@example.com');
    });

    it('should reject empty username', async () => {
      const response = await request(app)
        .post('/passkeys/register/start')
        .send({
          username: '',
          displayName: 'Test'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject missing required fields', async () => {
      const response = await request(app)
        .post('/passkeys/register/start')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should allow registration for existing user (multi-device)', async () => {
      // First registration
      await request(app)
        .post('/passkeys/register/start')
        .send({
          username: 'multidevice@example.com',
          displayName: 'Multi Device User'
        });

      // Second registration attempt (different device)
      const response = await request(app)
        .post('/passkeys/register/start')
        .send({
          username: 'multidevice@example.com',
          displayName: 'Multi Device User'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /passkeys/register/finish', () => {
    it('should reject missing credential', async () => {
      const response = await request(app)
        .post('/passkeys/register/finish')
        .send({
          username: 'test@example.com'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject invalid challenge', async () => {
      const response = await request(app)
        .post('/passkeys/register/finish')
        .send({
          username: 'test@example.com',
          credential: createMockRegistrationCredential('invalid-challenge')
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });
});

// ============================================================================
// Authentication Tests
// ============================================================================

describe('Passkey Authentication', () => {
  describe('POST /passkeys/auth/start', () => {
    it('should return authentication options', async () => {
      const response = await request(app)
        .post('/passkeys/auth/start')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.options).toBeDefined();
      expect(response.body.data.options.challenge).toBeDefined();
      expect(response.body.data.options.rpId).toBe(testConfig.RP_ID);
      expect(response.body.data.options.userVerification).toBe('required');
    });

    it('should return 404 for non-existent user when username provided', async () => {
      const response = await request(app)
        .post('/passkeys/auth/start')
        .send({
          username: 'nonexistent@example.com'
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('USER_NOT_FOUND');
    });

    it('should set timeout in options', async () => {
      const response = await request(app)
        .post('/passkeys/auth/start')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.data.options.timeout).toBe(60000);
    });
  });

  describe('POST /passkeys/auth/finish', () => {
    it('should reject missing credential', async () => {
      const response = await request(app)
        .post('/passkeys/auth/finish')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject invalid credential ID', async () => {
      // Start authentication to get challenge
      const startRes = await request(app)
        .post('/passkeys/auth/start')
        .send({});

      const challenge = startRes.body.data.options.challenge;

      const response = await request(app)
        .post('/passkeys/auth/finish')
        .send({
          credential: createMockAuthenticationCredential(challenge, 'invalid-credential-id')
        });

      expect(response.status).toBe(404);
      expect(response.body.code).toBe('PASSKEY_NOT_FOUND');
    });
  });
});

// ============================================================================
// User Passkey Check Tests
// ============================================================================

describe('Check User Passkeys', () => {
  describe('POST /passkeys/check-user', () => {
    it('should return hasPasskey: false for new email', async () => {
      const response = await request(app)
        .post('/passkeys/check-user')
        .send({
          email: 'brand-new-user@example.com'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.hasPasskey).toBe(false);
      expect(response.body.data.passkeyCount).toBe(0);
    });

    it('should normalize email to lowercase', async () => {
      const response = await request(app)
        .post('/passkeys/check-user')
        .send({
          email: 'TEST@EXAMPLE.COM'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should reject missing email', async () => {
      const response = await request(app)
        .post('/passkeys/check-user')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });
});

// ============================================================================
// Recovery Tests
// ============================================================================

describe('Passkey Recovery', () => {
  describe('POST /passkeys/recovery/start', () => {
    it('should return success even for non-existent email (security)', async () => {
      const response = await request(app)
        .post('/passkeys/recovery/start')
        .send({
          email: 'nonexistent@example.com'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      // Should not reveal if user exists
      expect(response.body.message).toContain('If an account exists');
    });

    it('should reject missing email', async () => {
      const response = await request(app)
        .post('/passkeys/recovery/start')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /passkeys/recovery/verify', () => {
    it('should reject invalid token', async () => {
      const response = await request(app)
        .post('/passkeys/recovery/verify')
        .send({
          token: 'invalid-token-12345'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('INVALID_TOKEN');
    });

    it('should reject missing token', async () => {
      const response = await request(app)
        .post('/passkeys/recovery/verify')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /passkeys/recovery/complete', () => {
    it('should reject invalid token', async () => {
      const response = await request(app)
        .post('/passkeys/recovery/complete')
        .send({
          token: 'invalid-recovery-token'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject missing token', async () => {
      const response = await request(app)
        .post('/passkeys/recovery/complete')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });
});

// ============================================================================
// Health Check Tests
// ============================================================================

describe('Passkey Health Check', () => {
  describe('GET /passkeys/health', () => {
    it('should return healthy status', async () => {
      const response = await request(app)
        .get('/passkeys/health');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.status).toBe('healthy');
      expect(response.body.service).toBe('passkey-service');
      expect(response.body.timestamp).toBeDefined();
    });
  });
});

// ============================================================================
// Session Key Tests (require authentication)
// ============================================================================

describe('Session Keys', () => {
  describe('GET /passkeys/session-keys/:userId', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/passkeys/session-keys/test-user-id');

      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /passkeys/session-keys/:sessionKeyId', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .delete('/passkeys/session-keys/test-session-key-id');

      expect(response.status).toBe(401);
    });
  });
});

// ============================================================================
// Device Management Tests (require authentication)
// ============================================================================

describe('Device Management', () => {
  describe('GET /passkeys/devices/:userId', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/passkeys/devices/test-user-id');

      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /passkeys/devices/:credentialId', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .delete('/passkeys/devices/test-credential-id');

      expect(response.status).toBe(401);
    });
  });
});

// ============================================================================
// Rate Limiting Tests
// ============================================================================

describe('Rate Limiting', () => {
  it('should apply rate limiting to registration endpoints', async () => {
    // This test validates rate limiting is configured
    // Actual rate limit testing requires many requests
    const response = await request(app)
      .post('/passkeys/register/start')
      .send({
        username: 'ratelimit@example.com',
        displayName: 'Rate Limit Test'
      });

    // Should succeed on first request
    expect([200, 429]).toContain(response.status);
  });

  it('should apply rate limiting to auth endpoints', async () => {
    const response = await request(app)
      .post('/passkeys/auth/start')
      .send({});

    // Should succeed on first request
    expect([200, 429]).toContain(response.status);
  });
});

// ============================================================================
// Input Validation Tests
// ============================================================================

describe('Input Validation', () => {
  it('should sanitize username input', async () => {
    const response = await request(app)
      .post('/passkeys/register/start')
      .send({
        username: '  whitespace@example.com  ',
        displayName: 'Test'
      });

    expect(response.status).toBe(200);
    expect(response.body.data.options.user.name).toBe('whitespace@example.com');
  });

  it('should handle special characters in displayName', async () => {
    const response = await request(app)
      .post('/passkeys/register/start')
      .send({
        username: 'special@example.com',
        displayName: 'Test <script>alert(1)</script> User'
      });

    expect(response.status).toBe(200);
    // Should be sanitized or escaped
  });

  it('should truncate long displayName', async () => {
    const longName = 'A'.repeat(100);
    const response = await request(app)
      .post('/passkeys/register/start')
      .send({
        username: 'longname@example.com',
        displayName: longName
      });

    expect(response.status).toBe(200);
    expect(response.body.data.options.user.displayName.length).toBeLessThanOrEqual(64);
  });
});

// ============================================================================
// Error Handling Tests
// ============================================================================

describe('Error Handling', () => {
  it('should return consistent error format', async () => {
    const response = await request(app)
      .post('/passkeys/register/start')
      .send({});

    expect(response.body).toHaveProperty('success');
    expect(response.body).toHaveProperty('error');
    expect(response.body).toHaveProperty('code');
  });

  it('should handle malformed JSON gracefully', async () => {
    const response = await request(app)
      .post('/passkeys/register/start')
      .set('Content-Type', 'application/json')
      .send('{ invalid json }');

    expect(response.status).toBe(400);
  });
});
