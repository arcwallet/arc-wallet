import { test, expect } from '@playwright/test';

test.describe('Magic link onboarding', () => {
  test('user receives link and lands on wallet setup', async ({ page }) => {
    const email = 'sehermuaz@gmail.com';
    let sessionAuthorized = false;
    let sendLinkCalls = 0;

    await page.route('**/api/session', async (route) => {
      if (sessionAuthorized) {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({ success: true, data: { email } }),
          headers: { 'content-type': 'application/json' },
        });
      } else {
        await route.fulfill({
          status: 401,
          body: JSON.stringify({ success: false, error: 'Session not found.' }),
          headers: { 'content-type': 'application/json' },
        });
      }
    });

    await page.route('**/api/send-link', async (route, request) => {
      const body = request.postDataJSON() as { email: string };
      expect(body.email).toBe(email);
      sendLinkCalls += 1;
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ success: true, message: 'Magic link sent. Please check your inbox.' }),
        headers: { 'content-type': 'application/json' },
      });
    });

    await page.route('**/api/verify', async (route) => {
      sessionAuthorized = true;
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ success: true }),
        headers: { 'content-type': 'application/json' },
      });
    });

    await page.goto('/');
    await page.getByPlaceholder('Enter your email').fill(email);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('Magic link sent. Please check your inbox.')).toBeVisible();
    expect(sendLinkCalls).toBe(1);

    // Simulate clicking the email link (token appended to URL)
    await page.goto('/?token=fake-test-token');

    await expect(page.getByText("You're signed in as")).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();
  });
});
