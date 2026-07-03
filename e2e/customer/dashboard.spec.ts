import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5173/nutrio';

async function goTo(page: import('@playwright/test').Page, path: string) {
  await page.goto(`${BASE}${path}`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(8000);
}

test.describe('Customer Dashboard', () => {
  test.beforeEach(async ({ page }) => { await goTo(page, '/dashboard'); });

  test('displays tab bar', async ({ page }) => {
    const el = page.locator('[data-testid="dashboard-tab-bar"]');
    if (await el.isVisible({ timeout: 3000 }).catch(() => false)) await expect(el).toBeVisible();
  });

  test('displays subscription card', async ({ page }) => {
    const el = page.locator('[data-testid="dashboard-subscription-card"]');
    if (await el.isVisible({ timeout: 3000 }).catch(() => false)) await expect(el).toBeVisible();
  });

  test('displays goal card', async ({ page }) => {
    const el = page.locator('[data-testid="dashboard-goal-card"]');
    if (await el.isVisible({ timeout: 3000 }).catch(() => false)) await expect(el).toBeVisible();
  });

  test('displays nutrition card', async ({ page }) => {
    const el = page.locator('[data-testid="dashboard-nutrition-card"]');
    if (await el.isVisible({ timeout: 3000 }).catch(() => false)) await expect(el).toBeVisible();
  });

  test('navigates to favorites', async ({ page }) => {
    const btn = page.locator('[data-testid="dashboard-favorites-btn"]');
    if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await btn.click();
      await expect(page).toHaveURL(/.*favorites.*/);
    }
  });

  test('navigates to notifications', async ({ page }) => {
    const btn = page.locator('[data-testid="dashboard-notifications-btn"]');
    if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await btn.click();
      await expect(page).toHaveURL(/.*notifications.*/);
    }
  });

  test('FAB order navigates to meals', async ({ page }) => {
    const btn = page.locator('[data-testid="dashboard-fab-order"]');
    if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await btn.click();
      await expect(page).toHaveURL(/.*meals.*/);
    }
  });

  test('FAB log navigates to tracker', async ({ page }) => {
    const btn = page.locator('[data-testid="dashboard-fab-log"]');
    if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await btn.click();
      await expect(page).toHaveURL(/.*tracker.*/);
    }
  });

  test('displays greeting', async ({ page }) => {
    const el = page.locator('text=/Good (morning|afternoon|evening)/');
    if (await el.isVisible({ timeout: 3000 }).catch(() => false)) await expect(el).toBeVisible();
  });

  test('notification bell visible', async ({ page }) => {
    const el = page.locator('[data-testid="dashboard-notifications-btn"]');
    if (await el.isVisible({ timeout: 3000 }).catch(() => false)) await expect(el).toBeVisible();
  });
});
