/**
 * Test Utilities and Helpers
 * Shared functions for all E2E tests
 */

import { Page, expect } from '@playwright/test';
import { appUrl, getTestUser } from '../config';

// Portal URLs
export const URLS = {
  base: 'http://localhost:5173/nutrio',
  auth: '/auth',
  dashboard: '/dashboard',
  meals: '/meals',
  orders: '/orders',
  subscription: '/subscription',
  profile: '/profile',
  wallet: '/wallet',
  checkout: '/checkout',
  admin: '/admin',
  partner: '/partner',
  driver: '/driver',
};

// Wait utilities
export const waitFor = async (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const waitForNetworkIdle = async (page: Page) => {
  await page.waitForLoadState('networkidle');
};

export const waitForElement = async (page: Page, selector: string, timeout = 10000) => {
  await page.waitForSelector(selector, { state: 'visible', timeout });
};

/** Click "Sign In" on the welcome screen if it's shown, then fill credentials */
const fillLoginForm = async (page: Page, email: string, password: string) => {
  // Customer auth shows a welcome screen first — click "Sign In" to reveal the form
  const emailInput = page.locator('input#si-email, input[type="email"]').first();
  for (let step = 0; step < 4; step += 1) {
    if (await emailInput.isVisible({ timeout: 1000 }).catch(() => false)) break;

    const walkthroughSkip = page.getByRole('button', { name: /^skip$/i }).first();
    if (await walkthroughSkip.isVisible({ timeout: 1000 }).catch(() => false)) {
      await walkthroughSkip.click();
      await page.waitForTimeout(500);
      continue;
    }

    const welcomeSignIn = page.getByRole('button', { name: /^sign in$/i }).first();
    if (await welcomeSignIn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await welcomeSignIn.click();
      await page.waitForTimeout(500);
      continue;
    }

    await page.waitForTimeout(500);
  }
  // Fill the form using actual field IDs
  await emailInput.waitFor({ state: 'visible', timeout: 10000 });
  await emailInput.fill(email);
  await page.fill('input#si-password, input[type="password"]', password);
  await page.click('button[type="submit"]');
};

// Auth helpers
export const loginAsCustomer = async (page: Page) => {
  const credentials = getTestUser('customer');
  await page.goto(appUrl(URLS.auth));
  await page.waitForLoadState('networkidle');
  await fillLoginForm(page, credentials.email, credentials.password);
  await expect(page).toHaveURL(/.*dashboard.*/, { timeout: 12000 });
};

export const loginAsAdmin = async (page: Page) => {
  const credentials = getTestUser('admin');
  await page.goto(appUrl(URLS.auth));
  await page.waitForLoadState('networkidle');
  await fillLoginForm(page, credentials.email, credentials.password);
  await expect(page).toHaveURL(/.*admin.*/, { timeout: 12000 });
};

export const loginAsPartner = async (page: Page) => {
  const credentials = getTestUser('partner');
  await page.goto(appUrl('/partner/auth'));
  await page.waitForLoadState('networkidle');
  await page.fill('input#email, input[type="email"]', credentials.email);
  await page.fill('input#password, input[type="password"]', credentials.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(
    (url) => {
      const path = url.pathname.replace(/\/+$/, '');
      return path.endsWith('/partner') ||
        (path.includes('/partner/') && !path.endsWith('/partner/auth'));
    },
    { timeout: 12000 },
  );
};

export const loginAsDriver = async (page: Page) => {
  const credentials = getTestUser('driver');
  await page.goto(appUrl('/driver/auth'));
  await page.waitForLoadState('networkidle');

  const existingDriverSignIn = page.getByRole('button', {
    name: /already a driver\?\s*sign in/i,
  });
  if (await existingDriverSignIn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await existingDriverSignIn.click();
  }

  await page.fill('input#email, input[type="email"]', credentials.email);
  await page.fill('input#password, input[type="password"]', credentials.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(
    (url) => {
      const path = url.pathname.replace(/\/+$/, '');
      return path.endsWith('/driver') ||
        (path.includes('/driver/') && !path.endsWith('/driver/auth'));
    },
    { timeout: 12000 },
  );
};

export const loginAsFleet = async (page: Page) => {
  const credentials = getTestUser('fleet');
  await page.goto(appUrl('/fleet/login'));
  await page.waitForLoadState('networkidle');
  await page.fill('input#email, input[type="email"]', credentials.email);
  await page.fill('input#password, input[type="password"]', credentials.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(
    (url) => {
      const path = url.pathname.replace(/\/+$/, '');
      return path.endsWith('/fleet') ||
        (path.includes('/fleet/') && !path.endsWith('/fleet/login'));
    },
    { timeout: 12000 },
  );
};

export const loginAsCoach = async (page: Page) => {
  const credentials = getTestUser('coach');
  await page.goto(appUrl('/auth'));
  await page.waitForLoadState('networkidle');
  await fillLoginForm(page, credentials.email, credentials.password);
  await page.waitForURL(
    (url) => !url.pathname.replace(/\/+$/, '').endsWith('/auth'),
    { timeout: 12000 },
  );
  await page.goto(appUrl('/coach'));
  await expect(page).toHaveURL(/.*\/coach(?:[/?#]|$)/, { timeout: 12000 });
};

export const logout = async (page: Page) => {
  // Click user menu if exists
  const userMenu = page.locator('[data-testid="user-menu"], button:has-text("Logout"), a:has-text("Logout")').first();
  if (await userMenu.isVisible().catch(() => false)) {
    await userMenu.click();
  }
  await page.goto(appUrl('/auth'));
};

// Form helpers
export const fillForm = async (page: Page, data: Record<string, string>) => {
  for (const [selector, value] of Object.entries(data)) {
    await page.fill(selector, value);
  }
};

export const clearAndFill = async (page: Page, selector: string, value: string) => {
  await page.fill(selector, '');
  await page.fill(selector, value);
};

// Navigation helpers
export const navigateTo = async (page: Page, path: string) => {
  await page.goto(appUrl(path));
  await waitForNetworkIdle(page);
};

// Element interaction helpers
export const clickWhenReady = async (page: Page, selector: string, timeout = 10000) => {
  await waitForElement(page, selector, timeout);
  await page.click(selector);
};

export const selectOption = async (page: Page, selector: string, option: string) => {
  await page.selectOption(selector, option);
};

export const checkCheckbox = async (page: Page, selector: string) => {
  const checkbox = page.locator(selector);
  if (!(await checkbox.isChecked())) {
    await checkbox.check();
  }
};

export const uncheckCheckbox = async (page: Page, selector: string) => {
  const checkbox = page.locator(selector);
  if (await checkbox.isChecked()) {
    await checkbox.uncheck();
  }
};

// Assertion helpers
export const expectToast = async (page: Page, message: string | RegExp) => {
  const toast = page.locator('[role="status"], .toast, .sonner-toast').first();
  await expect(toast).toContainText(message);
};

export const expectUrl = async (page: Page, pattern: RegExp | string) => {
  await expect(page).toHaveURL(pattern);
};

export const expectElement = async (page: Page, selector: string) => {
  await expect(page.locator(selector).first()).toBeVisible();
};

export const expectText = async (page: Page, text: string | RegExp) => {
  await expect(page.locator('body')).toContainText(text);
};

// Table helpers
export const getTableRows = async (page: Page, tableSelector: string) => {
  return page.locator(`${tableSelector} tbody tr, ${tableSelector} tr`).count();
};

export const clickTableRow = async (page: Page, tableSelector: string, rowIndex: number) => {
  await page.locator(`${tableSelector} tbody tr, ${tableSelector} tr`).nth(rowIndex).click();
};

// Search helpers
export const search = async (page: Page, searchInput: string, query: string) => {
  await page.fill(searchInput, query);
  await page.press(searchInput, 'Enter');
  await waitForNetworkIdle(page);
};

// Upload helpers
export const uploadFile = async (page: Page, selector: string, filePath: string) => {
  await page.setInputFiles(selector, filePath);
};

// Scroll helpers
export const scrollToBottom = async (page: Page) => {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
};

export const scrollToElement = async (page: Page, selector: string) => {
  await page.locator(selector).scrollIntoViewIfNeeded();
};

// Mobile viewport helpers
export const setMobileViewport = async (page: Page) => {
  await page.setViewportSize({ width: 375, height: 667 });
};

export const setTabletViewport = async (page: Page) => {
  await page.setViewportSize({ width: 768, height: 1024 });
};

export const setDesktopViewport = async (page: Page) => {
  await page.setViewportSize({ width: 1280, height: 720 });
};

// Local storage helpers
export const getLocalStorage = async (page: Page, key: string) => {
  return page.evaluate((k) => localStorage.getItem(k), key);
};

export const setLocalStorage = async (page: Page, key: string, value: string) => {
  await page.evaluate(({ k, v }) => localStorage.setItem(k, v), { k: key, v: value });
};

export const clearLocalStorage = async (page: Page) => {
  await page.evaluate(() => localStorage.clear());
};

// Screenshot helpers
export const takeScreenshot = async (page: Page, name: string) => {
  await page.screenshot({ path: `./test-results/${name}.png`, fullPage: true });
};

// Retry logic for flaky operations
export const retry = async <T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delay = 1000
): Promise<T> => {
  let lastError: Error | undefined;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        await waitFor(delay);
      }
    }
  }
  
  throw lastError;
};
