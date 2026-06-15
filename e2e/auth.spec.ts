import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('landing page loads', async ({ page }) => {
    await page.goto('/auth');
    await expect(page.locator('text=Welcome')).toBeVisible({ timeout: 10000 });
  });

  test('can navigate to sign in', async ({ page }) => {
    await page.goto('/auth');
    await page.click('text=Sign In');
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('can navigate to sign up', async ({ page }) => {
    await page.goto('/auth');
    await page.click('text=Sign Up');
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });
});

test.describe('Arabic Localization', () => {
  test('switches to Arabic and shows RTL', async ({ page }) => {
    await page.goto('/auth');
    await page.evaluate(() => {
      localStorage.setItem('nutrio_language', 'ar');
    });
    await page.reload();
    const dir = await page.evaluate(() => document.documentElement.dir);
    expect(dir).toBe('rtl');
  });
});

test.describe('Protected Routes', () => {
  test('redirects to auth when not logged in', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL('**/auth**', { timeout: 10000 });
  });
});
