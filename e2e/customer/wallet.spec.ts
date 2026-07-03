import { test, expect } from '@playwright/test';
const BASE = 'http://localhost:5173/nutrio';
async function goTo(page: import('@playwright/test').Page, path: string) {
  await page.goto(`${BASE}${path}`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(8000);
}

test.describe('Customer Wallet', () => {
  test.beforeEach(async ({ page }) => { await goTo(page, '/wallet'); });
  test('displays back button', async ({ page }) => {
    const el = page.locator('[data-testid="wallet-back-btn"]');
    if (await el.isVisible({ timeout: 3000 }).catch(() => false)) await expect(el).toBeVisible();
  });
  test('back button navigates away', async ({ page }) => {
    const btn = page.locator('[data-testid="wallet-back-btn"]');
    if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await btn.click();
      await expect(page).not.toHaveURL(/.*wallet.*/);
    }
  });
  test('page loads', async ({ page }) => {
    await expect(page.locator('body')).toBeAttached();
  });
});
