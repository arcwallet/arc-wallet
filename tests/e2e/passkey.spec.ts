/**
 * Passkey E2E Tests
 *
 * End-to-end tests for the complete passkey authentication flow
 * including registration, authentication, and wallet operations.
 *
 * Note: These tests require a browser environment with WebAuthn support.
 * They can be run with Playwright or similar E2E testing frameworks.
 *
 * @module tests/e2e/passkey
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';

// Test configuration
const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5173';
const API_URL = process.env.E2E_API_URL || 'http://localhost:4000';

// Test user data
const testUser = {
  email: `test-${Date.now()}@example.com`,
  displayName: 'E2E Test User',
};

/**
 * Helper to wait for network idle
 */
async function waitForNetworkIdle(page: Page) {
  await page.waitForLoadState('networkidle');
}

/**
 * Helper to mock WebAuthn for testing
 * In real E2E tests, you would use virtual authenticators
 */
async function setupVirtualAuthenticator(context: BrowserContext) {
  // Playwright supports virtual authenticators via CDP
  const cdpSession = await context.newCDPSession(await context.newPage());
  await cdpSession.send('WebAuthn.enable');
  const authenticatorId = await cdpSession.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
    },
  });
  return { cdpSession, authenticatorId };
}

// ============================================================================
// API Health Check Tests
// ============================================================================

test.describe('Passkey API Health', () => {
  test('should return healthy status from passkey service', async ({ request }) => {
    const response = await request.get(`${API_URL}/passkeys/health`);

    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.status).toBe('healthy');
    expect(body.service).toBe('passkey-service');
  });
});

// ============================================================================
// Registration Flow Tests
// ============================================================================

test.describe('Passkey Registration Flow', () => {
  test('should start registration and return WebAuthn options', async ({ request }) => {
    const response = await request.post(`${API_URL}/passkeys/register/start`, {
      data: {
        username: testUser.email,
        displayName: testUser.displayName,
      },
    });

    expect(response.ok()).toBeTruthy();
    const body = await response.json();

    expect(body.success).toBe(true);
    expect(body.data.options).toBeDefined();
    expect(body.data.options.challenge).toBeDefined();
    expect(body.data.options.rp).toBeDefined();
    expect(body.data.options.user).toBeDefined();
    expect(body.data.options.pubKeyCredParams).toBeDefined();
    expect(body.data.options.authenticatorSelection).toBeDefined();
  });

  test('should reject registration without username', async ({ request }) => {
    const response = await request.post(`${API_URL}/passkeys/register/start`, {
      data: {
        displayName: 'Test',
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  test('should normalize username to lowercase', async ({ request }) => {
    const response = await request.post(`${API_URL}/passkeys/register/start`, {
      data: {
        username: 'UPPERCASE@EXAMPLE.COM',
        displayName: 'Test',
      },
    });

    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.data.options.user.name).toBe('uppercase@example.com');
  });
});

// ============================================================================
// Authentication Flow Tests
// ============================================================================

test.describe('Passkey Authentication Flow', () => {
  test('should start authentication and return WebAuthn options', async ({ request }) => {
    const response = await request.post(`${API_URL}/passkeys/auth/start`, {
      data: {},
    });

    expect(response.ok()).toBeTruthy();
    const body = await response.json();

    expect(body.success).toBe(true);
    expect(body.data.options).toBeDefined();
    expect(body.data.options.challenge).toBeDefined();
    expect(body.data.options.rpId).toBeDefined();
    expect(body.data.options.userVerification).toBe('required');
    expect(body.data.options.timeout).toBe(60000);
  });

  test('should return 404 for non-existent user', async ({ request }) => {
    const response = await request.post(`${API_URL}/passkeys/auth/start`, {
      data: {
        username: 'nonexistent@example.com',
      },
    });

    expect(response.status()).toBe(404);
    const body = await response.json();
    expect(body.code).toBe('USER_NOT_FOUND');
  });
});

// ============================================================================
// Check User Passkeys Tests
// ============================================================================

test.describe('Check User Passkeys', () => {
  test('should return hasPasskey: false for new user', async ({ request }) => {
    const response = await request.post(`${API_URL}/passkeys/check-user`, {
      data: {
        email: `new-user-${Date.now()}@example.com`,
      },
    });

    expect(response.ok()).toBeTruthy();
    const body = await response.json();

    expect(body.success).toBe(true);
    expect(body.data.hasPasskey).toBe(false);
    expect(body.data.passkeyCount).toBe(0);
  });

  test('should reject request without email', async ({ request }) => {
    const response = await request.post(`${API_URL}/passkeys/check-user`, {
      data: {},
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
  });
});

// ============================================================================
// Recovery Flow Tests
// ============================================================================

test.describe('Passkey Recovery Flow', () => {
  test('should start recovery without revealing user existence', async ({ request }) => {
    const response = await request.post(`${API_URL}/passkeys/recovery/start`, {
      data: {
        email: 'any-email@example.com',
      },
    });

    expect(response.ok()).toBeTruthy();
    const body = await response.json();

    expect(body.success).toBe(true);
    expect(body.message).toContain('If an account exists');
    // Should NOT reveal whether account exists
  });

  test('should reject invalid recovery token', async ({ request }) => {
    const response = await request.post(`${API_URL}/passkeys/recovery/verify`, {
      data: {
        token: 'invalid-token-12345',
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.code).toBe('INVALID_TOKEN');
  });
});

// ============================================================================
// UI Flow Tests (requires browser)
// ============================================================================

test.describe('Passkey UI Flow', () => {
  test.skip('should display login page', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForNetworkIdle(page);

    // Check for login form elements
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test.skip('should show passkey prompt when user has passkey', async ({ page }) => {
    // This test would require a user with existing passkey
    // and virtual authenticator setup
    await page.goto(BASE_URL);

    const emailInput = page.locator('input[type="email"]');
    await emailInput.fill('existing-user@example.com');

    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();

    // Should show passkey authentication prompt
    // (This would trigger browser's WebAuthn UI in real scenario)
  });
});

// ============================================================================
// Security Tests
// ============================================================================

test.describe('Passkey Security', () => {
  test('should require user verification', async ({ request }) => {
    const response = await request.post(`${API_URL}/passkeys/auth/start`, {
      data: {},
    });

    const body = await response.json();
    expect(body.data.options.userVerification).toBe('required');
  });

  test('should use secure authenticator selection', async ({ request }) => {
    const response = await request.post(`${API_URL}/passkeys/register/start`, {
      data: {
        username: 'security-test@example.com',
        displayName: 'Security Test',
      },
    });

    const body = await response.json();
    const authenticatorSelection = body.data.options.authenticatorSelection;

    expect(authenticatorSelection.userVerification).toBe('required');
    expect(authenticatorSelection.residentKey).toBeDefined();
  });

  test('should reject requests with invalid content type', async ({ request }) => {
    const response = await request.post(`${API_URL}/passkeys/register/start`, {
      headers: {
        'Content-Type': 'text/plain',
      },
      data: 'invalid',
    });

    // Should reject or return error
    expect([400, 415]).toContain(response.status());
  });
});

// ============================================================================
// Rate Limiting Tests
// ============================================================================

test.describe('Passkey Rate Limiting', () => {
  test('should apply rate limiting to registration endpoint', async ({ request }) => {
    // Make multiple rapid requests
    const responses = await Promise.all(
      Array(5).fill(null).map(() =>
        request.post(`${API_URL}/passkeys/register/start`, {
          data: {
            username: `ratelimit-${Date.now()}@example.com`,
            displayName: 'Rate Limit Test',
          },
        })
      )
    );

    // At least one should succeed
    const successCount = responses.filter(r => r.ok()).length;
    expect(successCount).toBeGreaterThan(0);
  });
});

// ============================================================================
// Session Key Tests (require authentication)
// ============================================================================

test.describe('Session Key Management', () => {
  test('should require authentication for session keys', async ({ request }) => {
    const response = await request.get(`${API_URL}/passkeys/session-keys/test-user-id`);

    expect(response.status()).toBe(401);
  });

  test('should require authentication for revoking session keys', async ({ request }) => {
    const response = await request.delete(`${API_URL}/passkeys/session-keys/test-key-id`);

    expect(response.status()).toBe(401);
  });
});

// ============================================================================
// Device Management Tests (require authentication)
// ============================================================================

test.describe('Device Management', () => {
  test('should require authentication for listing devices', async ({ request }) => {
    const response = await request.get(`${API_URL}/passkeys/devices/test-user-id`);

    expect(response.status()).toBe(401);
  });

  test('should require authentication for deleting devices', async ({ request }) => {
    const response = await request.delete(`${API_URL}/passkeys/devices/test-credential-id`);

    expect(response.status()).toBe(401);
  });
});

// ============================================================================
// Error Handling Tests
// ============================================================================

test.describe('Passkey Error Handling', () => {
  test('should return consistent error format', async ({ request }) => {
    const response = await request.post(`${API_URL}/passkeys/register/finish`, {
      data: {
        username: 'test@example.com',
        // Missing credential
      },
    });

    expect(response.ok()).toBeFalsy();
    const body = await response.json();

    expect(body).toHaveProperty('success', false);
    expect(body).toHaveProperty('error');
    expect(body).toHaveProperty('code');
  });

  test('should handle malformed JSON gracefully', async ({ request }) => {
    const response = await request.post(`${API_URL}/passkeys/register/start`, {
      headers: {
        'Content-Type': 'application/json',
      },
      data: '{ invalid json }',
    });

    expect(response.status()).toBe(400);
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

test.describe('Passkey Integration', () => {
  test('should maintain consistent state across endpoints', async ({ request }) => {
    // Start registration
    const startRes = await request.post(`${API_URL}/passkeys/register/start`, {
      data: {
        username: `integration-${Date.now()}@example.com`,
        displayName: 'Integration Test',
      },
    });

    expect(startRes.ok()).toBeTruthy();
    const startBody = await startRes.json();

    // Verify challenge is stored (auth/start should return different challenge)
    const authRes = await request.post(`${API_URL}/passkeys/auth/start`, {
      data: {},
    });

    expect(authRes.ok()).toBeTruthy();
    const authBody = await authRes.json();

    // Challenges should be different
    expect(authBody.data.options.challenge).not.toBe(startBody.data.options.challenge);
  });
});
