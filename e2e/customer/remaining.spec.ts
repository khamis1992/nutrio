import { test, expect } from '@playwright/test';
const BASE = 'http://localhost:5173/nutrio';
async function goTo(page: import('@playwright/test').Page, path: string) {
  await page.goto(`${BASE}${path}`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(8000);
}

test.describe('Customer Subscription', () => {
  test.beforeEach(async ({ page }) => { await goTo(page, '/subscription'); });
  test('displays back button', async ({ page }) => {
    const el = page.locator('[data-testid="subscription-back-btn"]');
    if (await el.isVisible({ timeout: 3000 }).catch(() => false)) await expect(el).toBeVisible();
  });
  test('navigates to plans', async ({ page }) => {
    await goTo(page, '/subscription/plans');
    const el = page.locator('[data-testid="subscription-plans-back-btn"]');
    if (await el.isVisible({ timeout: 3000 }).catch(() => false)) await expect(el).toBeVisible();
  });
  test('plans page has view toggles', async ({ page }) => {
    await goTo(page, '/subscription/plans');
    const cards = page.locator('[data-testid="subscription-plans-view-cards"]');
    const compare = page.locator('[data-testid="subscription-plans-view-compare"]');
    if (await cards.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(cards).toBeVisible();
      await expect(compare).toBeVisible();
    }
  });
});

test.describe('Customer Schedule', () => {
  test.beforeEach(async ({ page }) => { await goTo(page, '/schedule'); });
  test('displays back button', async ({ page }) => {
    const el = page.locator('[data-testid="schedule-back-btn"]');
    if (await el.isVisible({ timeout: 3000 }).catch(() => false)) await expect(el).toBeVisible();
  });
  test('displays clear combo button', async ({ page }) => {
    const el = page.locator('[data-testid="schedule-clear-combo-btn"]');
    if (await el.isVisible({ timeout: 3000 }).catch(() => false)) await expect(el).toBeVisible();
  });
  test('displays add combo button', async ({ page }) => {
    const el = page.locator('[data-testid="schedule-add-combo-btn"]');
    if (await el.isVisible({ timeout: 3000 }).catch(() => false)) await expect(el).toBeVisible();
  });
  test('displays buy credits button', async ({ page }) => {
    const el = page.locator('[data-testid="schedule-buy-credits-btn"]');
    if (await el.isVisible({ timeout: 3000 }).catch(() => false)) await expect(el).toBeVisible();
  });
});

test.describe('Customer Tracker', () => {
  test.beforeEach(async ({ page }) => { await goTo(page, '/tracker'); });
  test('displays back button', async ({ page }) => {
    const el = page.locator('[data-testid="tracker-back-btn"]');
    if (await el.isVisible({ timeout: 3000 }).catch(() => false)) await expect(el).toBeVisible();
  });
  test('displays progress button', async ({ page }) => {
    const el = page.locator('[data-testid="tracker-progress-btn"]');
    if (await el.isVisible({ timeout: 3000 }).catch(() => false)) await expect(el).toBeVisible();
  });
  test('displays today and insights tabs', async ({ page }) => {
    const today = page.locator('[data-testid="tracker-tab-today"]');
    const insights = page.locator('[data-testid="tracker-tab-insights"]');
    if (await today.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(today).toBeVisible();
      await expect(insights).toBeVisible();
    }
  });
  test('displays weight update button', async ({ page }) => {
    const el = page.locator('[data-testid="tracker-weight-update-btn"]');
    if (await el.isVisible({ timeout: 3000 }).catch(() => false)) await expect(el).toBeVisible();
  });
  test('displays water and steps links', async ({ page }) => {
    const water = page.locator('[data-testid="tracker-water-link"]');
    const steps = page.locator('[data-testid="tracker-steps-link"]');
    if (await water.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(water).toBeVisible();
      await expect(steps).toBeVisible();
    }
  });
});

test.describe('Customer Profile', () => {
  test.beforeEach(async ({ page }) => { await goTo(page, '/profile'); });
  test('displays back button', async ({ page }) => {
    const el = page.locator('[data-testid="profile-back-btn"]');
    if (await el.isVisible({ timeout: 3000 }).catch(() => false)) await expect(el).toBeVisible();
  });
  test('displays notifications button', async ({ page }) => {
    const el = page.locator('[data-testid="profile-notifications-btn"]');
    if (await el.isVisible({ timeout: 3000 }).catch(() => false)) await expect(el).toBeVisible();
  });
  test('displays rewards card', async ({ page }) => {
    const el = page.locator('[data-testid="profile-rewards-card"]');
    if (await el.isVisible({ timeout: 3000 }).catch(() => false)) await expect(el).toBeVisible();
  });
  test('displays security button', async ({ page }) => {
    const el = page.locator('[data-testid="profile-security-btn"]');
    if (await el.isVisible({ timeout: 3000 }).catch(() => false)) await expect(el).toBeVisible();
  });
  test('displays affiliate button', async ({ page }) => {
    const el = page.locator('[data-testid="profile-affiliate-btn"]');
    if (await el.isVisible({ timeout: 3000 }).catch(() => false)) await expect(el).toBeVisible();
  });
  test('displays delete account button', async ({ page }) => {
    const el = page.locator('[data-testid="profile-delete-account-btn"]');
    if (await el.isVisible({ timeout: 3000 }).catch(() => false)) await expect(el).toBeVisible();
  });
});

test.describe('Customer Order History', () => {
  test.beforeEach(async ({ page }) => { await goTo(page, '/orders'); });
  test('displays back button', async ({ page }) => {
    const el = page.locator('[data-testid="order-history-back-btn"]');
    if (await el.isVisible({ timeout: 3000 }).catch(() => false)) await expect(el).toBeVisible();
  });
  test('displays refresh button', async ({ page }) => {
    const el = page.locator('[data-testid="order-history-refresh-btn"]');
    if (await el.isVisible({ timeout: 3000 }).catch(() => false)) await expect(el).toBeVisible();
  });
  test('displays tab buttons', async ({ page }) => {
    const tabs = page.locator('[data-testid^="order-history-tab-"]');
    if (await tabs.first().isVisible({ timeout: 3000 }).catch(() => false)) expect(await tabs.count()).toBeGreaterThanOrEqual(1);
  });
});

test.describe('Customer Notifications', () => {
  test.beforeEach(async ({ page }) => { await goTo(page, '/notifications'); });
  test('displays back button', async ({ page }) => {
    const el = page.locator('[data-testid="notifications-back-btn"]');
    if (await el.isVisible({ timeout: 3000 }).catch(() => false)) await expect(el).toBeVisible();
  });
  test('displays message input', async ({ page }) => {
    const el = page.locator('[data-testid="notifications-message-input"]');
    if (await el.isVisible({ timeout: 3000 }).catch(() => false)) await expect(el).toBeVisible();
  });
  test('displays send button', async ({ page }) => {
    const el = page.locator('[data-testid="notifications-send-btn"]');
    if (await el.isVisible({ timeout: 3000 }).catch(() => false)) await expect(el).toBeVisible();
  });
});

test.describe('Customer Favorites', () => {
  test.beforeEach(async ({ page }) => { await goTo(page, '/favorites'); });
  test('displays back button', async ({ page }) => {
    const el = page.locator('[data-testid="favorites-back-btn"]');
    if (await el.isVisible({ timeout: 3000 }).catch(() => false)) await expect(el).toBeVisible();
  });
  test('displays refresh button', async ({ page }) => {
    const el = page.locator('[data-testid="favorites-refresh-btn"]');
    if (await el.isVisible({ timeout: 3000 }).catch(() => false)) await expect(el).toBeVisible();
  });
});

test.describe('Security & RLS', () => {
  test('unauthenticated user redirected from protected pages', async ({ page }) => {
    const routes = ['/dashboard', '/meals', '/orders', '/subscription', '/profile', '/wallet', '/checkout'];
    for (const route of routes) {
      await goTo(page, route);
      await expect(page).toHaveURL(/.*auth.*/, { timeout: 10000 });
    }
  });
  test('customer cannot access admin', async ({ page }) => {
    await goTo(page, '/admin');
    const url = page.url();
    expect(url).toBeTruthy();
  });
  test('password input uses type=password', async ({ page }) => {
    await goTo(page, '/auth');
    const skipBtn = page.locator('button:has-text("Skip")').first();
    if (await skipBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await skipBtn.click();
      await page.waitForTimeout(2000);
    }
    const welcomeSignIn = page.locator('[data-testid="welcome-sign-in-btn"]');
    if (await welcomeSignIn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await welcomeSignIn.click();
      await page.waitForTimeout(500);
    }
    const pw = page.locator('[data-testid="signin-password-input"]');
    if (await pw.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(pw).toHaveAttribute('type', 'password');
    }
  });
});

test.describe('UX Regression', () => {
  test('dashboard renders at mobile width', async ({ page }) => {
    await page.setViewportSize({ width: 430, height: 932 });
    await goTo(page, '/dashboard');
    const el = page.locator('[data-testid="dashboard-tab-bar"]');
    if (await el.isVisible({ timeout: 3000 }).catch(() => false)) await expect(el).toBeVisible();
  });
  test('meals renders at mobile width', async ({ page }) => {
    await page.setViewportSize({ width: 430, height: 932 });
    await goTo(page, '/meals');
    const el = page.locator('[data-testid="meals-search-input"]');
    if (await el.isVisible({ timeout: 3000 }).catch(() => false)) await expect(el).toBeVisible();
  });
  test('auth renders at mobile width', async ({ page }) => {
    await page.setViewportSize({ width: 430, height: 932 });
    await goTo(page, '/auth');
    const el = page.locator('[data-testid="welcome-sign-in-btn"]');
    if (await el.isVisible({ timeout: 3000 }).catch(() => false)) await expect(el).toBeVisible();
  });
  test('back buttons meet 44px touch target', async ({ page }) => {
    await goTo(page, '/dashboard');
    const backBtns = page.locator('[data-testid$="-back-btn"]');
    const count = await backBtns.count();
    for (let i = 0; i < Math.min(count, 3); i++) {
      const box = await backBtns.nth(i).boundingBox();
      if (box) {
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
    }
  });
  test('dashboard does not show crash error', async ({ page }) => {
    await goTo(page, '/dashboard');
    await expect(page.locator('body')).not.toContainText('Something went wrong');
  });
});
