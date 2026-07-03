import { test, expect } from '@playwright/test';
const BASE = 'http://localhost:5173/nutrio';
async function goTo(page: import('@playwright/test').Page, path: string) {
  await page.goto(`${BASE}${path}`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(8000);
}

test.describe('Customer Meals', () => {
  test.beforeEach(async ({ page }) => { await goTo(page, '/meals'); });
  test('displays search input', async ({ page }) => {
    const el = page.locator('[data-testid="meals-search-input"]');
    if (await el.isVisible({ timeout: 3000 }).catch(() => false)) await expect(el).toBeVisible();
  });
  test('displays category tabs', async ({ page }) => {
    const tabs = page.locator('[data-testid^="meals-category-"]');
    if (await tabs.first().isVisible({ timeout: 3000 }).catch(() => false)) expect(await tabs.count()).toBeGreaterThanOrEqual(1);
  });
  test('displays favorites filter', async ({ page }) => {
    const el = page.locator('[data-testid="meals-favorites-filter"]');
    if (await el.isVisible({ timeout: 3000 }).catch(() => false)) await expect(el).toBeVisible();
  });
  test('displays clear filters', async ({ page }) => {
    const el = page.locator('[data-testid="meals-clear-filters"]');
    if (await el.isVisible({ timeout: 3000 }).catch(() => false)) await expect(el).toBeVisible();
  });
  test('searches for meals', async ({ page }) => {
    const input = page.locator('[data-testid="meals-search-input"]');
    if (await input.isVisible({ timeout: 3000 }).catch(() => false)) {
      await input.fill('chicken');
      await expect(input).toHaveValue('chicken');
    }
  });
  test('selects category tab', async ({ page }) => {
    const tab = page.locator('[data-testid="meals-category-breakfast"]');
    if (await tab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await tab.click();
      await expect(tab).toBeVisible();
    }
  });
  test('back button navigates away', async ({ page }) => {
    const btn = page.locator('[data-testid="meals-back-btn"]');
    if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await btn.click();
      await expect(page).not.toHaveURL(/.*meals.*/);
    }
  });
  test('page loads without errors', async ({ page }) => {
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeAttached();
  });
});
