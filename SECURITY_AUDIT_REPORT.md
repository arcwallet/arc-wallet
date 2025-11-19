# Arc Wallet - Comprehensive Security Audit Report

**Date:** November 19, 2025
**Scope:** Wallet application (frontend + backend)
**Audit Type:** Full security vulnerability assessment

---

## Executive Summary

This audit identifies **3 CRITICAL** vulnerabilities and **7 HIGH** severity issues that require immediate remediation. The application handles cryptographic keys and wallet operations, making these security issues potentially catastrophic.

---

## CRITICAL VULNERABILITIES

### [CRITICAL-1] Private Keys Exposed in HTTP Responses and Stored in Browser Storage

**Severity:** CRITICAL
**Location:** 
- `/Users/seher/Desktop/arcwallet/contexts/WalletContext.tsx` (Lines 206-210, 373-376)
- `/Users/seher/Desktop/arcwallet/backend/src/controllers/PasskeyController.ts` (Lines 203-210, 370-376)
- `/Users/seher/Desktop/arcwallet/services/passkeyClient.ts` (Lines 58-63)

**Issue:**
Private keys are transmitted in plaintext JSON responses from the backend and stored in browser storage (both localStorage and sessionStorage).

**Vulnerable Code:**
```typescript
// Backend - PasskeyController.ts:203-210
res.json({
  success: true,
  data: {
    sessionKey: {
      privateKey: sessionKey.privateKey,  // EXPOSED IN HTTP RESPONSE
      address: sessionKey.address,
      expiresAt: sessionKey.expiresAt.toISOString()
    }
  }
});

// Frontend - WalletContext.tsx:242
window.sessionStorage.setItem(SESSION_KEY_STORAGE_KEY, 
  JSON.stringify(session));  // Private key stored in plain sessionStorage
```

**Risk:**
- Network eavesdropping can capture private keys
- Browser storage is vulnerable to XSS attacks
- Private keys persist in browser memory and storage
- Easy extraction via browser DevTools

**Immediate Fix Required:**
1. NEVER transmit private keys in HTTP responses
2. Use non-exportable cryptographic keys with SubtleCrypto API
3. Store keys only in memory, not persistent storage
4. Implement hardware wallet/passkey-only signing (recommended)
5. Use secure communication channels (HTTPS required, enforce)

---

### [CRITICAL-2] Unencrypted Private Keys in Database

**Severity:** CRITICAL
**Location:** `/Users/seher/Desktop/arcwallet/backend/src/models/Database.ts` (Lines 76-86, 350-366)

**Issue:**
Session keys (containing raw private keys) are stored in SQLite database without encryption.

**Vulnerable Code:**
```typescript
// Database.ts:76-86
CREATE TABLE IF NOT EXISTS session_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  private_key TEXT NOT NULL,  // PLAIN TEXT STORAGE
  address TEXT NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
)

// Database.ts:350-366
await run(
  `INSERT INTO session_keys (id, user_id, private_key, address, expires_at, created_at)
   VALUES (?, ?, ?, ?, ?, ?)`,
  [
    sessionKey.id,
    sessionKey.userId,
    sessionKey.privateKey,  // STORED UNENCRYPTED
    sessionKey.address,
    sessionKey.expiresAt.toISOString(),
    now.toISOString()
  ]
);
```

**Risk:**
- Database compromise = instant loss of all user funds
- No encryption at rest
- Anyone with database access can steal all private keys
- No key derivation or hashing

**Immediate Fix Required:**
1. Implement database-level encryption (TDE - Transparent Data Encryption)
2. Use field-level encryption for sensitive data
3. Never store raw private keys - use hardware security modules or key management services
4. Implement proper key derivation functions (PBKDF2, Argon2)
5. Consider migration to cloud KMS (AWS KMS, Google Cloud KMS, Azure Key Vault)

---

### [CRITICAL-3] Private Keys Exposed in Console Logs

**Severity:** CRITICAL
**Location:** `/Users/seher/Desktop/arcwallet/backend/src/controllers/PasskeyController.ts` (Line 141-146, 295)

**Issue:**
Debug logging outputs full credential and session key information including sensitive identifiers that could be used to reconstruct keys.

**Vulnerable Code:**
```typescript
// PasskeyController.ts:141-146
console.log('🔍 Registration Credential:', {
  id: credential.id?.substring(0, 30),
  rawId: (credential as any).rawId?.substring(0, 30),
  idLength: credential.id?.length,
  rawIdLength: (credential as any).rawId?.length
});

// PasskeyController.ts:295
console.log('🔍 Full Credential Object:', JSON.stringify(credential, null, 2));

// PasskeyController.ts:605
console.log(`🔗 [RECOVERY] Token: ${token}`);  // Recovery token in logs
```

**Risk:**
- Logs are typically stored in files/services accessible to devops/platform teams
- CI/CD pipelines, log aggregation services (ELK, Splunk) expose logs
- Credentials in logs = permanent exposure
- Recovery tokens in logs can be used to hijack accounts

**Immediate Fix Required:**
1. Remove ALL debug logging of credentials, tokens, and keys
2. Implement centralized logging without sensitive data
3. Use log filtering/masking for production
4. Audit all historical logs for exposed data
5. Implement proper secret redaction in logger

---

## HIGH SEVERITY VULNERABILITIES

### [HIGH-1] Weak Magic Link Token Implementation

**Severity:** HIGH
**Location:** `/Users/seher/Desktop/arcwallet/backend/src/magicLink/MagicLinkService.ts`

**Issue:**
Magic link tokens are JWT-like but lack standard protections. Token verification doesn't validate issuedAt timing properly.

**Vulnerable Code:**
```typescript
// MagicLinkService.ts:35-56
verifyToken(token: string): MagicLinkPayload | null {
  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = this.sign(encodedPayload);
  const provided = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length || 
      !crypto.timingSafeEqual(provided, expected)) {
    return null;
  }

  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload)) as MagicLinkPayload;
    if (Date.now() > payload.expiresAt) {  // Only checks expiration
      return null;
    }
    return payload;  // No nbf (not-before) check, no iat validation
  } catch {
    return null;
  }
}
```

**Risks:**
- No protection against token reuse
- No issuedAt validation
- Magic link tokens sent in URLs (logged in server logs, browser history, proxies)
- No token revocation mechanism
- Default 15-minute expiry is long (susceptible to interception)

**Fix Required:**
1. Implement one-time token usage (invalidate after use) - currently missing
2. Store token hashes in database with used flag
3. Add issued-at (iat) claim validation
4. Reduce token lifetime to 5 minutes or less
5. Implement token rotation/refresh mechanism
6. Log magic link token usage for audit trails

---

### [HIGH-2] Missing Authorization Checks on API Endpoints

**Severity:** HIGH
**Location:** Multiple route files

**Issues:**

**A. Session Keys Endpoint - No User Ownership Verification**
```typescript
// passkeys.ts:89-99
router.get(
  '/session-keys/:userId',
  rateLimitMiddleware('general'),
  async (req: Request, res: Response, next: NextFunction) => {
    // NO AUTH: Any user can request ANY user's session keys
    const { userId } = req.params;
    const sessionKeys = await this.sessionKeyManager.getActiveSessionKeys(userId);
    // Returns all active session keys for arbitrary user
  }
);
```

**B. Bridge History - No User Verification**
```typescript
// bridge.ts:240-292
router.get(
  '/bridge/history/:userId',
  [param('userId').isString().notEmpty()],
  async (req: Request, res: Response) => {
    // NO AUTH: Any user can request any user's bridge history
    const userId = req.params.userId;
    const transactions = await db.getBridgeHistory(userId, limit, offset);
  }
);
```

**C. MultiSig Operations - Weak Ownership Verification**
```typescript
// MultiSigController.ts:86-94
async getAccounts(req: Request, res: Response): Promise<void> {
  const { userId } = req.params;  // No verification this is current user
  const accounts = await this.db.getMultiSigAccountsByUser(userId);
  // Trust that userId parameter is legitimate
}
```

**Risks:**
- User enumeration attacks
- Privacy violation - exposing user transaction history
- Session key enumeration
- No authentication mechanism implemented

**Fix Required:**
1. Implement JWT-based authentication middleware
2. Verify authenticated user matches userId parameter
3. Add authentication to ALL protected endpoints
4. Use bearer tokens in Authorization header (not URL parameters)
5. Implement user session verification on every request

---

### [HIGH-3] Insecure Cookie Configuration for Magic Links

**Severity:** HIGH
**Location:** `/Users/seher/Desktop/arcwallet/backend/src/routes/magicLink.ts` (Line 16-22)

**Issue:**
Magic link session cookies use `sameSite: 'none'` which allows CSRF attacks, and `secure` flag not enforced in non-production.

**Vulnerable Code:**
```typescript
// magicLink.ts:16-22
const COOKIE_BASE_OPTIONS = (isProd: boolean) => ({
  httpOnly: true,
  sameSite: 'none' as const,  // VULNERABLE: Allows cross-site requests
  secure: isProd,              // WEAK: Not enforced in development
  maxAge: SESSION_TTL_MS,
  path: '/',
});
```

**Risks:**
- CSRF attacks possible (sameSite=none means cookie sent on cross-origin requests)
- Development mode cookies not marked secure (vulnerable in plaintext HTTP)
- Session fixation attacks possible
- 24-hour session is too long

**Fix Required:**
1. Change sameSite to 'strict' (default) or 'lax' for same-origin requests
2. Enforce secure flag in all environments (HTTPS only)
3. Reduce maxAge to 2-4 hours
4. Add signed/encrypted cookie middleware
5. Implement CSRF tokens for state-changing operations

---

### [HIGH-4] Recovery Tokens Exposed in Development Responses

**Severity:** HIGH
**Location:** `/Users/seher/Desktop/arcwallet/backend/src/controllers/PasskeyController.ts` (Lines 604-613)

**Issue:**
Recovery tokens are logged and returned in API responses during development, allowing account hijacking.

**Vulnerable Code:**
```typescript
// PasskeyController.ts:604-613
console.log(`🔗 [RECOVERY] Token: ${token}`);  // Logged to console

return res.json({
  success: true,
  message: 'If an account exists with this email, a recovery link will be sent.',
  // Include token in dev mode for testing
  ...(this.config.NODE_ENV === 'development' && { recoveryToken: token })
  // RETURNS TOKEN IN RESPONSE - can be intercepted
});
```

**Risks:**
- Tokens logged in plaintext in server logs
- Tokens returned in HTTP responses (logged in proxies, CDNs)
- "Development only" code often exists in production
- No token rate limiting
- No token rotation after use

**Fix Required:**
1. NEVER return recovery tokens in API responses
2. NEVER log tokens - only log token hash
3. Implement one-time token usage
4. Send tokens only via secure email
5. Add rate limiting on recovery endpoints (2 attempts per email per hour)
6. Remove development-only features from production builds

---

### [HIGH-5] SQL Injection Risk in Dynamic Query Building

**Severity:** HIGH
**Location:** `/Users/seher/Desktop/arcwallet/backend/src/models/Database.ts` (Lines 281-283)

**Issue:**
While parameterized queries are used correctly in most places, dynamic SQL building for UPDATE statements could be vulnerable if not careful.

**Vulnerable Pattern:**
```typescript
// Database.ts:281-283
await run(
  `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
  values  // Values array doesn't include constructed field names
);
```

**Risk:**
- Fields are constructed from user input implicitly
- Even though current code sanitizes, dynamic field construction is error-prone
- Future developers might add unsanitized fields

**Fix Required:**
1. Implement field whitelist validation before SQL construction
2. Use TypeScript strict types to prevent invalid fields
3. Add SQL injection tests
4. Consider using ORM (Prisma, TypeORM) instead of raw SQL
5. Audit all dynamic SQL queries

---

### [HIGH-6] Default Secrets Not Changed in Production

**Severity:** HIGH
**Location:** `/Users/seher/Desktop/arcwallet/backend/src/utils/config.ts` (Lines 34-51)

**Issue:**
Default secrets are defined in code and only validated at startup, not enforced.

**Vulnerable Code:**
```typescript
// config.ts:34-51
const SESSION_SECRET = process.env.SESSION_SECRET || 
  'default-session-secret-change-in-production';  // DEFAULT VALUE IN CODE
const JWT_SECRET = process.env.JWT_SECRET || 
  'default-jwt-secret-change-in-production';      // DEFAULT VALUE IN CODE

if (NODE_ENV === 'production') {
  if (SESSION_SECRET === 'default-session-secret-change-in-production') {
    throw new Error('SESSION_SECRET must be set in production');
  }
  // Validation only at startup - no runtime enforcement
}
```

**Risks:**
- If environment variables not set, app uses defaults
- Validation only at startup (can be bypassed)
- No rotation mechanism
- Secrets visible in .env.example files

**Fix Required:**
1. Require secrets via environment variables (no defaults)
2. Implement secret rotation mechanism
3. Use AWS Secrets Manager / HashiCorp Vault / similar
4. Don't include examples with actual default values
5. Implement runtime secret validation

---

### [HIGH-7] Session Key Expiration Not Enforced at Middleware Level

**Severity:** HIGH
**Location:** `/Users/seher/Desktop/arcwallet/backend/src` (multiple locations)

**Issue:**
Session key expiration is checked at the application level in individual route handlers, not centrally enforced.

**Impact:**
- Easy to miss expiration checks in new endpoints
- Expired keys could be accepted by some endpoints
- No consistent session validation

**Missing Code:**
```typescript
// Should exist in middleware, but doesn't:
router.use(async (req, res, next) => {
  const sessionKey = req.body.sessionKeyAddress;
  if (sessionKey) {
    const key = await db.getActiveSessionKeyByAddress(sessionKey);
    if (!key || key.expiresAt < new Date()) {
      return res.status(401).json({ error: 'Session expired' });
    }
  }
  next();
});
```

**Fix Required:**
1. Create session validation middleware
2. Apply middleware to all protected routes
3. Implement consistent session expiry across app
4. Add session verification before signing operations

---

## MEDIUM SEVERITY VULNERABILITIES

### [MEDIUM-1] Missing CSRF Protection on State-Changing Operations

**Severity:** MEDIUM
**Location:** `/Users/seher/Desktop/arcwallet/backend/src/routes/magicLink.ts`

**Issue:**
POST endpoints modify state (logout, account changes) without CSRF token validation.

```typescript
router.post('/api/logout', (req, res) => {  // No CSRF token required
  const sessionId = (req as CookieRequest).cookies?.[SESSION_COOKIE_NAME];
  sessionStore.delete(sessionId);
  res.clearCookie(SESSION_COOKIE_NAME, COOKIE_BASE_OPTIONS(config.NODE_ENV === 'production'));
});
```

**Fix Required:**
1. Implement CSRF token validation for all POST/PUT/DELETE operations
2. Use double-submit cookie pattern or synchronizer token pattern
3. Validate token origin

---

### [MEDIUM-2] Insufficient Input Validation

**Severity:** MEDIUM
**Location:** Multiple controllers

**Issue:**
Recovery tokens and usernames accept very wide input ranges.

```typescript
// Recovery tokens could be anything 
const token = randomUUID() + '-' + randomUUID();
// But verification doesn't rate limit or validate format strictly
```

**Fix Required:**
1. Implement strict input validation schemas (joi, zod)
2. Add request size limits
3. Validate email format properly (use email-validator library)

---

### [MEDIUM-3] Weak Rate Limiting Configuration

**Severity:** MEDIUM
**Location:** `/Users/seher/Desktop/arcwallet/backend/src/middleware/security.ts` (Lines 6-30)

**Issue:**
Rate limiting disabled in non-production environments and uses memory (not distributed).

```typescript
const disabled = process.env.DISABLE_RATE_LIMIT === 'true' || 
                 process.env.NODE_ENV !== 'production';
// Disabled in development - might not be caught in testing
```

**Fix Required:**
1. Use Redis or similar for distributed rate limiting
2. Implement endpoint-specific rate limits
3. Add rate limiting for password recovery (max 3 per hour per email)
4. Log rate limit violations

---

### [MEDIUM-4] Error Information Disclosure

**Severity:** MEDIUM
**Location:** `/Users/seher/Desktop/arcwallet/backend/src/middleware/security.ts` (Lines 144-150)

**Issue:**
Stack traces exposed in development mode; could leak information in production if misconfigured.

```typescript
const isDevelopment = process.env.NODE_ENV === 'development';
res.status(500).json({
  success: false,
  error: isDevelopment ? err.message : 'Internal server error',
  code: 'INTERNAL_ERROR',
  ...(isDevelopment && { stack: err.stack })  // Stack trace exposed
});
```

**Fix Required:**
1. Never expose error details to clients
2. Log errors with correlation IDs only
3. Return generic error messages

---

### [MEDIUM-5] No Rate Limiting on Recovery Endpoints

**Severity:** MEDIUM
**Location:** `/Users/seher/Desktop/arcwallet/backend/src/routes/passkeys.ts` (Lines 147-157)

**Issue:**
Recovery endpoints use 'registration' rate limit (5 per hour) but should be stricter.

**Fix Required:**
1. Implement custom rate limiter for recovery (2-3 per hour)
2. Rate limit by email address, not just IP
3. Implement exponential backoff

---

## ARCHITECTURE ISSUES

### Private Key Management

**Current Approach (INSECURE):**
- Keys generated on backend
- Sent in plaintext to frontend  
- Stored in browser storage
- Used for blockchain operations

**Recommended Approach:**
1. Use WebAuthn/Passkeys for signing (hardware-backed)
2. Use AWS Cognito + SigV4 signing
3. Use Ledger/Hardware wallet integration
4. Implement Threshold Signature Schemes (TSS)
5. Use account abstraction with delegated signers

---

## SUMMARY TABLE

| ID | Severity | Issue | File | Line | Status |
|---|---|---|---|---|---|
| C1 | CRITICAL | Private Keys in HTTP + Storage | WalletContext.tsx, PasskeyController.ts | Multiple | Needs Immediate Fix |
| C2 | CRITICAL | Unencrypted Keys in DB | Database.ts | 76-366 | Needs Immediate Fix |
| C3 | CRITICAL | Keys in Console Logs | PasskeyController.ts | 141-146, 295, 605 | Needs Immediate Fix |
| H1 | HIGH | Weak Magic Link Tokens | MagicLinkService.ts | 35-56 | Needs Immediate Fix |
| H2 | HIGH | Missing Authorization | passkeys.ts, bridge.ts | Multiple | Needs Immediate Fix |
| H3 | HIGH | Insecure Cookies | magicLink.ts | 16-22 | Needs Immediate Fix |
| H4 | HIGH | Recovery Tokens Exposed | PasskeyController.ts | 604-613 | Needs Immediate Fix |
| H5 | HIGH | SQL Injection Risk | Database.ts | 281-283 | Needs Assessment |
| H6 | HIGH | Default Secrets | config.ts | 34-51 | Needs Immediate Fix |
| H7 | HIGH | Session Expiry Not Enforced | Multiple | - | Needs Immediate Fix |
| M1 | MEDIUM | No CSRF Protection | magicLink.ts | Multiple | Needs Fix |
| M2 | MEDIUM | Weak Input Validation | Multiple | Multiple | Needs Fix |
| M3 | MEDIUM | Weak Rate Limiting | security.ts | 6-30 | Needs Fix |
| M4 | MEDIUM | Error Disclosure | security.ts | 144-150 | Needs Fix |
| M5 | MEDIUM | No Recovery Rate Limit | passkeys.ts | 147-157 | Needs Fix |

---

## REMEDIATION ROADMAP

### Phase 1: CRITICAL (Do Immediately - Next 24-48 Hours)
1. Remove all private key handling from frontend
2. Migrate to passkey/WebAuthn-only signing
3. Remove private keys from database (archive old data)
4. Implement database encryption for session keys
5. Remove all sensitive data from logs
6. Remove recovery tokens from API responses

### Phase 2: HIGH (Do Within 1 Week)
1. Implement JWT authentication middleware
2. Add authorization checks to all endpoints
3. Fix cookie configuration
4. Implement one-time recovery tokens
5. Add field validation to prevent SQL injection
6. Enforce secrets in environment variables

### Phase 3: MEDIUM (Do Within 2 Weeks)
1. Implement CSRF protection
2. Enhance input validation
3. Switch to distributed rate limiting (Redis)
4. Fix error handling
5. Implement recovery endpoint rate limiting

---

## TESTING RECOMMENDATIONS

1. **Security Testing:**
   - Run OWASP ZAP or Burp Suite Community Edition
   - Test for XSS vulnerabilities
   - Test for CSRF vulnerabilities
   - Test for SQL injection
   - Fuzz input validation

2. **Cryptography Testing:**
   - Audit key generation
   - Verify proper use of SubtleCrypto API
   - Test key derivation functions

3. **Authorization Testing:**
   - Test accessing other users' data
   - Test privilege escalation
   - Test session hijacking

---

## CONCLUSION

This wallet application has fundamental security issues that must be addressed before production use. The handling of private keys is particularly concerning and violates industry best practices. 

**Recommendation:** Halt production deployment until CRITICAL issues are resolved.

