import { test, expect } from '@playwright/test';

import { appUrl, getTestUser } from '../config';

async function goToAuthFresh(page: import('@playwright/test').Page) {
  await page.goto(appUrl('/auth'));
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(8000);

  // If onboarding screen appears (user has cached session), click Skip to reach welcome screen
  const skipBtn = page.locator('button:has-text("Skip")').first();
  if (await skipBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await skipBtn.click();
    await page.waitForTimeout(2000);
  }
}

test.describe('Customer Auth', () => {
  test.describe('Login', () => {
    test('logs in with valid credentials and lands on dashboard', async ({ page }) => {
      const credentials = getTestUser('customer');
      await goToAuthFresh(page);

      const welcomeSignIn = page.locator('[data-testid="welcome-sign-in-btn"]');
      if (await welcomeSignIn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await welcomeSignIn.click();
        await page.waitForTimeout(500);
      }

      await page.locator('[data-testid="signin-email-input"]').fill(credentials.email);
      await page.locator('[data-testid="signin-password-input"]').fill(credentials.password);
      await page.locator('[data-testid="signin-submit-btn"]').click();

      await expect(page).toHaveURL(/.*dashboard.*/, { timeout: 15000 });
    });

    test('shows error for invalid password', async ({ page }) => {
      const credentials = getTestUser('customer');
      await goToAuthFresh(page);

      const welcomeSignIn = page.locator('[data-testid="welcome-sign-in-btn"]');
      if (await welcomeSignIn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await welcomeSignIn.click();
        await page.waitForTimeout(500);
      }

      await page.locator('[data-testid="signin-email-input"]').fill(credentials.email);
      await page.locator('[data-testid="signin-password-input"]').fill('invalid-e2e-password');
      await page.locator('[data-testid="signin-submit-btn"]').click();

      await expect(page.locator('body')).toContainText(/invalid|error|failed|wrong/i, { timeout: 10000 });
    });

    test('shows validation for empty form submission', async ({ page }) => {
      await goToAuthFresh(page);

      const welcomeSignIn = page.locator('[data-testid="welcome-sign-in-btn"]');
      if (await welcomeSignIn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await welcomeSignIn.click();
        await page.waitForTimeout(500);
      }

      await page.locator('[data-testid="signin-submit-btn"]').click();
      await expect(page.locator('body')).toContainText(/required|email|password/i);
    });

    test('shows validation for invalid email format', async ({ page }) => {
      await goToAuthFresh(page);

      const welcomeSignIn = page.locator('[data-testid="welcome-sign-in-btn"]');
      if (await welcomeSignIn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await welcomeSignIn.click();
        await page.waitForTimeout(500);
      }

      await page.locator('[data-testid="signin-email-input"]').fill('not-an-email');
      await page.locator('[data-testid="signin-password-input"]').fill('invalid-e2e-password');
      await page.locator('[data-testid="signin-submit-btn"]').click();
      await expect(page.locator('body')).toContainText(/valid|email|invalid/i);
    });
  });

  test.describe('Sign Up', () => {
    test('navigates to sign up form from welcome screen', async ({ page }) => {
      await goToAuthFresh(page);

      await page.locator('[data-testid="welcome-sign-up-btn"]').click();
      await page.waitForTimeout(500);

      await expect(page.locator('[data-testid="signup-name-input"]')).toBeVisible();
      await expect(page.locator('[data-testid="signup-email-input"]')).toBeVisible();
      await expect(page.locator('[data-testid="signup-password-input"]')).toBeVisible();
    });

    test('toggles between sign in and sign up', async ({ page }) => {
      await goToAuthFresh(page);

      await page.locator('[data-testid="welcome-sign-up-btn"]').click();
      await page.waitForTimeout(500);
      await expect(page.locator('[data-testid="signup-name-input"]')).toBeVisible();

      await page.locator('[data-testid="signup-signin-link"]').click();
      await page.waitForTimeout(500);
      await expect(page.locator('[data-testid="signin-email-input"]')).toBeVisible();
    });
  });

  test.describe('Password Reset', () => {
    test('opens forgot password flow', async ({ page }) => {
      await goToAuthFresh(page);

      const welcomeSignIn = page.locator('[data-testid="welcome-sign-in-btn"]');
      if (await welcomeSignIn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await welcomeSignIn.click();
        await page.waitForTimeout(500);
      }

      await page.locator('[data-testid="signin-forgot-link"]').click();
      await page.waitForTimeout(500);
      await expect(page.locator('[data-testid="forgot-email-input"]')).toBeVisible();
    });

    test('submits password reset request', async ({ page }) => {
      const credentials = getTestUser('customer');
      await goToAuthFresh(page);

      const welcomeSignIn = page.locator('[data-testid="welcome-sign-in-btn"]');
      if (await welcomeSignIn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await welcomeSignIn.click();
        await page.waitForTimeout(500);
      }

      await page.locator('[data-testid="signin-forgot-link"]').click();
      await page.waitForTimeout(500);

      await page.locator('[data-testid="forgot-email-input"]').fill(credentials.email);
      await page.locator('[data-testid="forgot-submit-btn"]').click();
      await expect(page.locator('body')).toContainText(/sent|email|reset|check/i);
    });
  });

  test.describe('Navigation', () => {
    test('shows terms and privacy links on auth page', async ({ page }) => {
      await goToAuthFresh(page);

      await expect(page.locator('a:has-text("Terms")')).toBeVisible();
      await expect(page.locator('a:has-text("Privacy")')).toBeVisible();
    });
  });
});
