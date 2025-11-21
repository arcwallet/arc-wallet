# Arc Wallet - Security Fixes Implementation Guide

## CRITICAL FIXES (Implement Immediately)

### Fix #1: Remove Private Keys from HTTP Responses

**File:** `/backend/src/controllers/PasskeyController.ts`

**OLD CODE (Lines 203-210):**
```typescript
res.json({
  success: true,
  data: {
    sessionKey: {
      privateKey: sessionKey.privateKey,  // REMOVE THIS
      address: sessionKey.address,
      expiresAt: sessionKey.expiresAt.toISOString()
    },
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName
    }
  }
});
```

**FIXED CODE:**
```typescript
// NEVER RETURN PRIVATE KEYS
res.json({
  success: true,
  data: {
    sessionKey: {
      // Don't include privateKey - it should never leave the client
      address: sessionKey.address,
      expiresAt: sessionKey.expiresAt.toISOString()
    },
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName
    }
  }
});
```

**Reason:** Private keys should NEVER be transmitted over HTTP. They should be generated client-side only using WebAuthn/Passkeys.

---

### Fix #2: Remove Console Logging of Sensitive Data

**File:** `/backend/src/controllers/PasskeyController.ts`

**OLD CODE (Lines 141-146, 295, 605):**
```typescript
// Line 141-146
console.log('🔍 Registration Credential:', {
  id: credential.id?.substring(0, 30),
  rawId: (credential as any).rawId?.substring(0, 30),
  idLength: credential.id?.length,
  rawIdLength: (credential as any).rawId?.length
});

// Line 295
console.log('🔍 Full Credential Object:', JSON.stringify(credential, null, 2));

// Line 605
console.log(`🔗 [RECOVERY] Token: ${token}`);
```

**FIXED CODE:**
```typescript
// Only log non-sensitive information with hashes
import crypto from 'crypto';

const hashSensitive = (data: string): string => {
  return crypto.createHash('sha256').update(data).digest('hex').substring(0, 8);
};

// Line 141-146 - Log only hashes
console.log('🔍 Registration started:', {
  credentialIdHash: credential.id ? hashSensitive(credential.id) : 'unknown',
  timestamp: new Date().toISOString()
});

// Line 295 - Remove completely
// Don't log the full credential object

// Line 605 - Log only hash
console.log(`[RECOVERY] Token sent for email: ${normalizedEmail}, hash: ${hashSensitive(token)}`);
```

---

### Fix #3: Implement Database Encryption for Session Keys

**File:** `/backend/src/utils/encryption.ts` (NEW FILE)

```typescript
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.DB_ENCRYPTION_KEY;

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length < 32) {
  throw new Error('DB_ENCRYPTION_KEY must be set and at least 32 characters');
}

export function encryptPrivateKey(privateKey: string): { encrypted: string; iv: string } {
  const iv = crypto.randomBytes(16);
  const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  let encrypted = cipher.update(privateKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return {
    encrypted: `${encrypted}:${authTag.toString('hex')}`,
    iv: iv.toString('hex')
  };
}

export function decryptPrivateKey(encrypted: string, iv: string): string {
  const [ciphertext, authTag] = encrypted.split(':');
  const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
  
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));
  
  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
```

**File:** `/backend/src/models/Database.ts` (UPDATE)

**OLD CODE (Lines 350-366):**
```typescript
await run(
  `INSERT INTO session_keys (id, user_id, private_key, address, expires_at, created_at)
   VALUES (?, ?, ?, ?, ?, ?)`,
  [
    sessionKey.id,
    sessionKey.userId,
    sessionKey.privateKey,  // PLAIN TEXT
    sessionKey.address,
    sessionKey.expiresAt.toISOString(),
    now.toISOString()
  ]
);
```

**FIXED CODE:**
```typescript
import { encryptPrivateKey, decryptPrivateKey } from '../utils/encryption.js';

// Add iv column to schema (add migration)
// ALTER TABLE session_keys ADD COLUMN private_key_iv TEXT;

const encrypted = encryptPrivateKey(sessionKey.privateKey);

await run(
  `INSERT INTO session_keys (id, user_id, private_key, private_key_iv, address, expires_at, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?)`,
  [
    sessionKey.id,
    sessionKey.userId,
    encrypted.encrypted,  // ENCRYPTED
    encrypted.iv,
    sessionKey.address,
    sessionKey.expiresAt.toISOString(),
    now.toISOString()
  ]
);
```

**Add to .env:**
```bash
DB_ENCRYPTION_KEY=your-very-long-random-string-at-least-32-characters-here
```

---

### Fix #4: Remove Recovery Tokens from API Responses

**File:** `/backend/src/controllers/PasskeyController.ts`

**OLD CODE (Lines 604-613):**
```typescript
return res.json({
  success: true,
  message: 'If an account exists with this email, a recovery link will be sent.',
  // Include token in dev mode for testing
  ...(this.config.NODE_ENV === 'development' && { recoveryToken: token })
});
```

**FIXED CODE:**
```typescript
return res.json({
  success: true,
  message: 'If an account exists with this email, a recovery link will be sent.'
  // NEVER RETURN TOKEN - send via email only
});
```

---

## HIGH SEVERITY FIXES

### Fix #5: Implement JWT Authentication Middleware

**File:** `/backend/src/middleware/auth.ts` (NEW FILE)

```typescript
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; email: string };
    }
  }
}

export const authMiddleware = (secret: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        error: 'Missing authorization token',
        code: 'UNAUTHORIZED'
      });
    }
    
    const token = authHeader.slice(7);
    
    try {
      const decoded = jwt.verify(token, secret) as { id: string; email: string };
      req.user = decoded;
      next();
    } catch (error) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid or expired token',
        code: 'UNAUTHORIZED'
      });
    }
  };
};
```

**File:** `/backend/src/routes/passkeys.ts` (UPDATE)

**OLD CODE (Lines 89-99):**
```typescript
router.get(
  '/session-keys/:userId',
  rateLimitMiddleware('general'),
  async (req: Request, res: Response, next: NextFunction) => {
    const { userId } = req.params;
    const sessionKeys = await this.sessionKeyManager.getActiveSessionKeys(userId);
```

**FIXED CODE:**
```typescript
router.get(
  '/session-keys/:userId',
  authMiddleware(config.JWT_SECRET),
  rateLimitMiddleware('general'),
  async (req: Request, res: Response, next: NextFunction) => {
    const { userId } = req.params;
    
    // Verify user owns this data
    if (req.user?.id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        code: 'FORBIDDEN'
      });
    }
    
    const sessionKeys = await this.sessionKeyManager.getActiveSessionKeys(userId);
```

---

### Fix #6: Fix Cookie Configuration

**File:** `/backend/src/routes/magicLink.ts`

**OLD CODE (Lines 16-22):**
```typescript
const COOKIE_BASE_OPTIONS = (isProd: boolean) => ({
  httpOnly: true,
  sameSite: 'none' as const,  // VULNERABLE
  secure: isProd,              // Only in prod
  maxAge: SESSION_TTL_MS,      // 24 hours
  path: '/',
});
```

**FIXED CODE:**
```typescript
const COOKIE_BASE_OPTIONS = (isProd: boolean) => ({
  httpOnly: true,
  sameSite: 'lax' as const,    // Fixed: lax instead of none
  secure: true,                // Fixed: ALWAYS secure (enforce HTTPS)
  maxAge: 4 * 60 * 60 * 1000,  // Fixed: 4 hours instead of 24
  path: '/',
  domain: undefined,           // Let browser handle domain
});

// Add this at app startup in index.ts:
if (config.NODE_ENV === 'production' && !process.env.HTTPS) {
  throw new Error('HTTPS required for production');
}
```

---

### Fix #7: Implement One-Time Magic Link Tokens

**File:** `/backend/src/models/Database.ts` (UPDATE schema)

```typescript
// Add to createTables():
await run(`
  CREATE TABLE IF NOT EXISTS used_tokens (
    token_hash TEXT PRIMARY KEY,
    used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL
  )
`);

// Add methods:
async markTokenUsed(tokenHash: string, expiresAt: Date): Promise<void> {
  const run: any = promisify(this.db.run.bind(this.db));
  await run(
    'INSERT INTO used_tokens (token_hash, expires_at) VALUES (?, ?)',
    [tokenHash, expiresAt.toISOString()]
  );
}

async isTokenUsed(tokenHash: string): Promise<boolean> {
  const get: any = promisify(this.db.get.bind(this.db));
  const result = await get(
    'SELECT * FROM used_tokens WHERE token_hash = ? AND expires_at > ?',
    [tokenHash, new Date().toISOString()]
  );
  return !!result;
}
```

**File:** `/backend/src/routes/magicLink.ts` (UPDATE)

```typescript
router.post('/api/verify', async (req, res) => {
  const token = typeof req.body?.token === 'string' ? req.body.token : null;
  if (!token) {
    return res.status(400).json({ success: false, error: 'Magic link token is required.' });
  }

  // Check if token already used
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const alreadyUsed = await db.isTokenUsed(tokenHash);
  if (alreadyUsed) {
    return res.status(400).json({ success: false, error: 'Token already used.' });
  }

  const payload = tokenService.verifyToken(token);
  if (!payload) {
    return res.status(400).json({ success: false, error: 'Invalid or expired magic link.' });
  }

  // Mark token as used
  const expiresAt = new Date(payload.expiresAt);
  await db.markTokenUsed(tokenHash, expiresAt);

  const user = userStore.findOrCreate(payload.email);
  const session = sessionStore.create(user, SESSION_TTL_MS);
  res.cookie(SESSION_COOKIE_NAME, session.id, COOKIE_BASE_OPTIONS(config.NODE_ENV === 'production'));
  res.json({ success: true });
});
```

---

### Fix #8: Add Rate Limiting to Recovery Endpoints

**File:** `/backend/src/middleware/security.ts` (UPDATE)

```typescript
// Update rate limiters
const rateLimiters = {
  general: new RateLimiterMemory({
    points: 100,
    duration: 900,
  }),
  auth: new RateLimiterMemory({
    points: 10,
    duration: 900,
  }),
  registration: new RateLimiterMemory({
    points: 5,
    duration: 3600,
  }),
  recovery: new RateLimiterMemory({
    points: 3,           // Max 3 attempts
    duration: 3600,      // Per hour
    blockDurationMs: 300000 // 5 minute cooldown
  }),
  bridge: new RateLimiterMemory({
    points: 20,
    duration: 3600,
  }),
};
```

**File:** `/backend/src/routes/passkeys.ts` (UPDATE)

```typescript
// Update recovery endpoints to use stricter rate limiting
router.post(
  '/recovery/start',
  rateLimitMiddleware('recovery'),  // Changed from 'registration'
  validateRequestBody(['email']),
  async (req: Request, res: Response, next: NextFunction) => {
    // ...existing code
  }
);

router.post(
  '/recovery/verify',
  rateLimitMiddleware('recovery'),  // Changed from 'auth'
  validateRequestBody(['token']),
  async (req: Request, res: Response, next: NextFunction) => {
    // ...existing code
  }
);
```

---

### Fix #9: Implement Field Whitelist for SQL Queries

**File:** `/backend/src/models/Database.ts` (UPDATE)

```typescript
// Add at top of file
const ALLOWED_USER_FIELDS = new Set(['username', 'display_name', 'wallet_address']);
const ALLOWED_MULTISIG_FIELDS = new Set(['name', 'address', 'required_signatures']);

// Update updateUser method
async updateUser(id: string, updates: Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt'>>): Promise<User | null> {
  await this.waitForReady();
  const run: any = promisify(this.db.run.bind(this.db));
  const get: any = promisify(this.db.get.bind(this.db));

  const fields = [];
  const values = [];

  // Whitelist validation
  if (updates.username !== undefined) {
    if (!ALLOWED_USER_FIELDS.has('username')) throw new Error('Invalid field');
    fields.push('username = ?');
    values.push(updates.username);
  }
  if (updates.displayName !== undefined) {
    if (!ALLOWED_USER_FIELDS.has('display_name')) throw new Error('Invalid field');
    fields.push('display_name = ?');
    values.push(updates.displayName);
  }
  if (updates.walletAddress !== undefined) {
    if (!ALLOWED_USER_FIELDS.has('wallet_address')) throw new Error('Invalid field');
    fields.push('wallet_address = ?');
    values.push(updates.walletAddress);
  }

  if (fields.length === 0) return this.getUserById(id);

  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  await run(
    `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
    values
  );

  return this.getUserById(id);
}
```

---

### Fix #10: Enforce Required Environment Variables

**File:** `/backend/src/utils/config.ts`

**OLD CODE (Lines 34-36):**
```typescript
const SESSION_SECRET = process.env.SESSION_SECRET || 'default-session-secret-change-in-production';
const JWT_SECRET = process.env.JWT_SECRET || 'default-jwt-secret-change-in-production';
```

**FIXED CODE:**
```typescript
const SESSION_SECRET = process.env.SESSION_SECRET;
const JWT_SECRET = process.env.JWT_SECRET;

// Check immediately, before validation
if (!SESSION_SECRET) {
  throw new Error('SESSION_SECRET environment variable is required');
}
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}
if (SESSION_SECRET.length < 32) {
  throw new Error('SESSION_SECRET must be at least 32 characters');
}
if (JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters');
}
```

---

## MEDIUM FIXES

### Fix #11: Add CSRF Protection

**File:** `/backend/src/middleware/csrf.ts` (NEW FILE)

```typescript
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

const tokens = new Map<string, { token: string; createdAt: number }>();
const TOKEN_LIFETIME = 24 * 60 * 60 * 1000; // 24 hours

export const csrfMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Generate CSRF token if not present
  if (!req.session?.csrfToken) {
    const token = crypto.randomBytes(32).toString('hex');
    if (!req.session) req.session = {};
    req.session.csrfToken = token;
    tokens.set(token, { token, createdAt: Date.now() });
  }

  // Clean up old tokens
  for (const [token, data] of tokens.entries()) {
    if (Date.now() - data.createdAt > TOKEN_LIFETIME) {
      tokens.delete(token);
    }
  }

  // Expose token for forms
  res.locals.csrfToken = req.session?.csrfToken;

  next();
};

export const validateCSRF = (req: Request, res: Response, next: NextFunction) => {
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const token = req.body._csrf || req.headers['x-csrf-token'];
    
    if (!token || !tokens.has(token as string)) {
      return res.status(403).json({ 
        success: false, 
        error: 'Invalid CSRF token',
        code: 'CSRF_VALIDATION_FAILED'
      });
    }
  }
  
  next();
};
```

**File:** `/backend/src/index.ts` (UPDATE)

```typescript
import { csrfMiddleware, validateCSRF } from './middleware/csrf.js';

// Add CSRF middleware
app.use(csrfMiddleware);
app.use(validateCSRF);
```

---

## Testing Checklist

After implementing these fixes:

- [ ] Verify NO private keys in HTTP responses
- [ ] Verify NO sensitive data in console logs
- [ ] Verify database encryption working (test decrypt)
- [ ] Verify JWT auth required on protected endpoints
- [ ] Verify user ownership checks working
- [ ] Verify cookie settings (sameSite, secure, httpOnly)
- [ ] Verify one-time token usage (replay attack test)
- [ ] Verify rate limiting on recovery endpoints
- [ ] Verify CSRF token validation
- [ ] Run OWASP ZAP scan
- [ ] Test SQL injection protection
- [ ] Test XSS protection

---

## Environment Variables Required

Add to `.env`:

```bash
# Required in PRODUCTION
SESSION_SECRET=your-very-secure-random-string-min-32-chars
JWT_SECRET=another-very-secure-random-string-min-32-chars
DB_ENCRYPTION_KEY=yet-another-very-secure-random-string-min-32-chars

# Required for HTTPS
HTTPS=true

# Secrets Manager (recommended for production)
AWS_REGION=us-east-1
AWS_SECRETS_MANAGER_ARN=arn:aws:secretsmanager:us-east-1:123456789012:secret:arc-wallet-secrets
```

---

## Security Best Practices

1. **Never commit secrets** - Use environment variables only
2. **HTTPS only** - Enforce in production
3. **Audit logs** - Log security events with user IDs
4. **Regular rotations** - Rotate secrets every 90 days
5. **Security headers** - Implement all recommended HTTP headers
6. **Dependency updates** - Keep dependencies up to date
7. **Security testing** - Run tests on every commit

---

## Implemented Security Improvements (Sprint 2 & 3)

### 1. CSRF Token Refresh Mechanism
- **Implementation:** Centralized `csrfService.ts` created.
- **Behavior:** Automatically refreshes CSRF tokens on 403 errors and retries requests.
- **Files:** `services/csrfService.ts`, `services/multiSigClient.ts`, `services/bridgeApiClient.ts`, `services/sessionApi.ts`.

### 2. Client-Side Rate Limiting
- **Implementation:** Explicit handling of HTTP 429 responses in `activityService.ts`.
- **Behavior:** Throws `RateLimitError` to trigger cooldown logic in `ActivityContext`.
- **Files:** `services/activityService.ts`, `contexts/ActivityContext.tsx`.

### 3. Global Error Handling
- **Implementation:** Global `unhandledrejection` handler in `App.tsx`.
- **Behavior:** Catches and logs unhandled async errors to prevent silent failures.
- **Files:** `App.tsx`.

### 4. Secure Loading States
- **Implementation:** Unified `isConnecting` state in `WalletSetup`.
- **Behavior:** Prevents multiple concurrent wallet creation/import attempts.
- **Files:** `components/WalletSetup.tsx`, `contexts/SelfCustodialWalletContext.tsx`.

### 5. Console Log Cleanup
- **Implementation:** Removed sensitive or unnecessary logs from production builds.
- **Behavior:** Uses `console.debug` with `DEBUG` flag or removes logs entirely.
- **Files:** `services/fheService.ts`, `services/circleApiService.ts`.


