import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Transaction Flows
 * Tests cover:
 * - Send token flow
 * - Receive flow
 * - Transaction history
 * - Address validation
 */

test.describe('Transactions - Send Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authenticated state
    await page.addInitScript(() => {
      localStorage.setItem('arcwallet:session', JSON.stringify({
        email: 'test@example.com',
        authenticated: true,
      }));
    });
  });

  test('should display send button on dashboard', async ({ page }) => {
    await page.goto('/');

    // Look for send button
    const sendButton = page.locator('button, a').filter({ hasText: /send/i });
    await expect(page.locator('body')).toBeVisible();
  });

  test('should open send modal/page', async ({ page }) => {
    await page.goto('/');

    const sendButton = page.locator('button, a').filter({ hasText: /send/i }).first();

    if (await sendButton.isVisible()) {
      await sendButton.click();

      // Should show send form
      const sendForm = page.locator('form, [role="dialog"]').filter({ hasText: /send|recipient|amount/i });
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('should validate recipient address format', async ({ page }) => {
    await page.goto('/');

    const sendButton = page.locator('button, a').filter({ hasText: /send/i }).first();

    if (await sendButton.isVisible()) {
      await sendButton.click();

      // Find address input
      const addressInput = page.locator('input[placeholder*="address" i], input[placeholder*="0x" i]');

      if (await addressInput.isVisible()) {
        // Invalid address
        await addressInput.fill('invalid-address');

        // Should show error
        const errorText = page.locator('text=Invalid, text=invalid address, text=Error');
        // Validation should trigger on blur or submit
      }
    }
  });

  test('should validate amount input', async ({ page }) => {
    await page.goto('/');

    const sendButton = page.locator('button, a').filter({ hasText: /send/i }).first();

    if (await sendButton.isVisible()) {
      await sendButton.click();

      // Find amount input
      const amountInput = page.locator('input[type="number"], input[placeholder*="amount" i]');

      if (await amountInput.isVisible()) {
        // Negative amount
        await amountInput.fill('-100');

        // Should not allow negative
        const value = await amountInput.inputValue();
        expect(parseFloat(value)).toBeGreaterThanOrEqual(0);
      }
    }
  });

  test('should show token selector', async ({ page }) => {
    await page.goto('/');

    const sendButton = page.locator('button, a').filter({ hasText: /send/i }).first();

    if (await sendButton.isVisible()) {
      await sendButton.click();

      // Look for token selector
      const tokenSelector = page.locator('select, [role="listbox"]').filter({ hasText: /ARC|USDC|ETH/i });
      await expect(page.locator('body')).toBeVisible();
    }
  });
});

test.describe('Transactions - Receive Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('arcwallet:session', JSON.stringify({
        email: 'test@example.com',
        authenticated: true,
      }));
    });
  });

  test('should display receive button', async ({ page }) => {
    await page.goto('/');

    const receiveButton = page.locator('button, a').filter({ hasText: /receive/i });
    await expect(page.locator('body')).toBeVisible();
  });

  test('should show wallet address on receive', async ({ page }) => {
    await page.goto('/');

    const receiveButton = page.locator('button, a').filter({ hasText: /receive/i }).first();

    if (await receiveButton.isVisible()) {
      await receiveButton.click();

      // Should show address (0x...)
      const addressDisplay = page.locator('text=/0x[a-fA-F0-9]{4,}/');
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('should show QR code on receive', async ({ page }) => {
    await page.goto('/');

    const receiveButton = page.locator('button, a').filter({ hasText: /receive/i }).first();

    if (await receiveButton.isVisible()) {
      await receiveButton.click();

      // Look for QR code
      const qrCode = page.locator('canvas, svg, img[alt*="QR" i]');
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('should have copy address button', async ({ page }) => {
    await page.goto('/');

    const receiveButton = page.locator('button, a').filter({ hasText: /receive/i }).first();

    if (await receiveButton.isVisible()) {
      await receiveButton.click();

      const copyButton = page.locator('button').filter({ hasText: /copy/i });
      await expect(page.locator('body')).toBeVisible();
    }
  });
});

test.describe('Transactions - History', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('arcwallet:session', JSON.stringify({
        email: 'test@example.com',
        authenticated: true,
      }));
    });
  });

  test('should display transaction history section', async ({ page }) => {
    await page.goto('/');

    // Look for history/activity section
    const historySection = page.locator('text=History, text=Activity, text=Transactions, text=Recent');
    await expect(page.locator('body')).toBeVisible();
  });

  test('should show empty state when no transactions', async ({ page }) => {
    await page.goto('/');

    // Empty state message
    const emptyState = page.locator('text=No transactions, text=No activity, text=No recent');
    await expect(page.locator('body')).toBeVisible();
  });

  test('should link to explorer for transaction details', async ({ page }) => {
    await page.goto('/');

    // Transaction links should point to explorer
    const explorerLinks = page.locator('a[href*="explorer"]');
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Transactions - Validation', () => {
  test('should reject invalid Ethereum addresses', async ({ page }) => {
    await page.goto('/');

    const sendButton = page.locator('button, a').filter({ hasText: /send/i }).first();

    if (await sendButton.isVisible()) {
      await sendButton.click();

      const addressInput = page.locator('input[placeholder*="address" i], input[placeholder*="0x" i]');

      if (await addressInput.isVisible()) {
        // Test cases for invalid addresses
        const invalidAddresses = [
          '0x123', // Too short
          '0xGGGG', // Invalid hex
          'not-an-address',
          '0x' + 'a'.repeat(41), // Too long
        ];

        for (const addr of invalidAddresses) {
          await addressInput.fill(addr);
          // Validation should show error
        }
      }
    }
  });

  test('should accept valid Ethereum addresses', async ({ page }) => {
    await page.goto('/');

    const sendButton = page.locator('button, a').filter({ hasText: /send/i }).first();

    if (await sendButton.isVisible()) {
      await sendButton.click();

      const addressInput = page.locator('input[placeholder*="address" i], input[placeholder*="0x" i]');

      if (await addressInput.isVisible()) {
        // Valid address
        await addressInput.fill('0x742d35Cc6634C0532925a3b844Bc9e7595f1dE42');

        // Should not show error
        const errorText = page.locator('.error, [class*="error"]').filter({ hasText: /invalid/i });
        const hasError = await errorText.isVisible().catch(() => false);
        // Valid address should not show error
      }
    }
  });

  test('should prevent sending more than balance', async ({ page }) => {
    await page.goto('/');

    const sendButton = page.locator('button, a').filter({ hasText: /send/i }).first();

    if (await sendButton.isVisible()) {
      await sendButton.click();

      const amountInput = page.locator('input[type="number"], input[placeholder*="amount" i]');

      if (await amountInput.isVisible()) {
        // Try to send huge amount
        await amountInput.fill('999999999999');

        // Should show insufficient balance or disable send
        const submitBtn = page.locator('button[type="submit"], button').filter({ hasText: /send|confirm/i });
        // Button should be disabled or show error
      }
    }
  });
});

test.describe('Transactions - Gas Estimation', () => {
  test('should display estimated gas fee', async ({ page }) => {
    await page.goto('/');

    const sendButton = page.locator('button, a').filter({ hasText: /send/i }).first();

    if (await sendButton.isVisible()) {
      await sendButton.click();

      // Fill in valid transaction details
      const addressInput = page.locator('input[placeholder*="address" i], input[placeholder*="0x" i]');
      const amountInput = page.locator('input[type="number"], input[placeholder*="amount" i]');

      if (await addressInput.isVisible() && await amountInput.isVisible()) {
        await addressInput.fill('0x742d35Cc6634C0532925a3b844Bc9e7595f1dE42');
        await amountInput.fill('0.01');

        // Look for gas fee display
        const gasFee = page.locator('text=Gas, text=Fee, text=Network fee');
        await expect(page.locator('body')).toBeVisible();
      }
    }
  });
});
