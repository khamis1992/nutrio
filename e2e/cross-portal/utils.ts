/**
 * Cross-Portal Test Utilities
 * Shared helpers for multi-portal integration testing
 */

import { Page, BrowserContext, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

// Test user credentials â€” must match actual accounts in database
export const TEST_USERS = {
  customer: {
    email: 'eng.aljabor@gmail.com',
    password: '123456789',
    name: 'Khamis',
  },
  admin: {
    email: 'khamis-1992@hotmail.com',
    password: 'Khamees1992#',
    name: 'Admin',
  },
  partner: {
    email: 'khamis4everever@gmail.com',
    password: '123456789',
    name: 'Khamis Kitchen',
  },
  driver: {
    email: 'driver@nutriofuel.com',
    password: '123456789',
    name: 'Test Driver',
  },
};

// Portal contexts holder
export interface PortalContexts {
  customerContext: BrowserContext;
  adminContext: BrowserContext;
  partnerContext: BrowserContext;
  driverContext: BrowserContext;
}

export interface PortalPages {
  customerPage: Page;
  adminPage: Page;
  partnerPage: Page;
  driverPage: Page;
}

/**
 * Wait for network to be idle
 */
export const waitForNetworkIdle = async (page: Page, timeout = 10000) => {
  await page.waitForLoadState('networkidle', { timeout });
};

/**
 * Wait for element to be visible
 */
export const waitForElement = async (page: Page, selector: string, timeout = 10000) => {
  await page.waitForSelector(selector, { state: 'visible', timeout });
};

/**
 * Safe click with retry
 */
export const safeClick = async (page: Page, selector: string, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await waitForElement(page, selector);
      await page.click(selector);
      return;
    } catch (e) {
      if (i === maxRetries - 1) throw e;
      await page.waitForTimeout(500);
    }
  }
};

/**
 * Safe fill with retry
 */
export const safeFill = async (page: Page, selector: string, value: string, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await waitForElement(page, selector);
      await page.fill(selector, value);
      return;
    } catch (e) {
      if (i === maxRetries - 1) throw e;
      await page.waitForTimeout(500);
    }
  }
};

/**
 * Login as customer
 */
export const loginAsCustomer = async (page: Page) => {
  await page.goto(`${BASE_URL}/auth`);
  await waitForNetworkIdle(page);
  
  // Click "Sign In" on welcome screen if it exists
  const signinBtn = page.locator('button', { hasText: /sign in|log in/i });
  if (await signinBtn.count() > 0) {
    await signinBtn.first().click();
    await page.waitForTimeout(1000);
  }
  
  await safeFill(page, 'input#si-email, input[type="email"]', TEST_USERS.customer.email);
  await safeFill(page, 'input#si-password, input[type="password"]', TEST_USERS.customer.password);
  await safeClick(page, 'button[type="submit"]');
  
  await page.waitForURL(/.*dashboard|.*onboarding/, { timeout: 10000 });
};

/**
 * Login as admin
 */
export const loginAsAdmin = async (page: Page) => {
  await page.goto(`${BASE_URL}/admin`);
  await waitForNetworkIdle(page);
  
  // Check if already logged in
  const currentUrl = page.url();
  if (currentUrl.includes('/admin') && !currentUrl.includes('/auth')) {
    return; // Already logged in
  }
  
  // Click "Sign In" on welcome screen if it exists
  const signinBtn = page.locator('button', { hasText: /sign in|log in/i });
  if (await signinBtn.count() > 0) {
    await signinBtn.first().click();
    await page.waitForTimeout(1000);
  }
  
  await safeFill(page, 'input#si-email, input[type="email"]', TEST_USERS.admin.email);
  await safeFill(page, 'input#si-password, input[type="password"]', TEST_USERS.admin.password);
  await safeClick(page, 'button[type="submit"]');
  
  await page.waitForURL(/.*admin/, { timeout: 10000 });
};

/**
 * Login as partner
 */
export const loginAsPartner = async (page: Page) => {
  await page.goto(`${BASE_URL}/partner/auth`);
  await waitForNetworkIdle(page);
  
  const currentUrl = page.url();
  if (currentUrl.includes('/partner') && !currentUrl.includes('/auth')) {
    return;
  }
  
  // Click "Sign In" on welcome screen if it exists
  const signinBtn = page.locator('button', { hasText: /sign in|log in/i });
  if (await signinBtn.count() > 0) {
    await signinBtn.first().click();
    await page.waitForTimeout(1000);
  }
  
  await safeFill(page, 'input#si-email, input[type="email"]', TEST_USERS.partner.email);
  await safeFill(page, 'input#si-password, input[type="password"]', TEST_USERS.partner.password);
  await safeClick(page, 'button[type="submit"]');
  
  await page.waitForURL(/.*partner/, { timeout: 10000 });
};

/**
 * Login as driver
 */
export const loginAsDriver = async (page: Page) => {
  await page.goto(`${BASE_URL}/driver/auth`);
  await waitForNetworkIdle(page);
  
  const currentUrl = page.url();
  if (currentUrl.includes('/driver') && !currentUrl.includes('/auth')) {
    return;
  }
  
  // Click "Sign In" on welcome screen if it exists
  const signinBtn = page.locator('button', { hasText: /sign in|log in/i });
  if (await signinBtn.count() > 0) {
    await signinBtn.first().click();
    await page.waitForTimeout(1000);
  }
  
  await safeFill(page, 'input#si-email, input[type="email"]', TEST_USERS.driver.email);
  await safeFill(page, 'input#si-password, input[type="password"]', TEST_USERS.driver.password);
  await safeClick(page, 'button[type="submit"]');
  
  await page.waitForURL(/.*driver/, { timeout: 10000 });
};

/**
 * Login all portals in parallel
 */
export const loginAllPortals = async (pages: PortalPages) => {
  await Promise.all([
    loginAsCustomer(pages.customerPage),
    loginAsAdmin(pages.adminPage),
    loginAsPartner(pages.partnerPage),
    loginAsDriver(pages.driverPage),
  ]);
};

/**
 * Navigate all portals to their dashboards
 */
export const navigateAllToDashboards = async (pages: PortalPages) => {
  await Promise.all([
    pages.customerPage.goto(`${BASE_URL}/dashboard`),
    pages.adminPage.goto(`${BASE_URL}/admin`),
    pages.partnerPage.goto(`${BASE_URL}/partner`),
    pages.driverPage.goto(`${BASE_URL}/driver`),
  ]);
  
  await Promise.all([
    waitForNetworkIdle(pages.customerPage),
    waitForNetworkIdle(pages.adminPage),
    waitForNetworkIdle(pages.partnerPage),
    waitForNetworkIdle(pages.driverPage),
  ]);
};

/**
 * Verify page loaded successfully
 */
export const verifyPageLoaded = async (page: Page, expectedText?: string) => {
  await expect(page.locator('body')).toBeVisible();
  
  // Check for error states
  const bodyText = await page.locator('body').textContent() || '';
  
  if (bodyText.includes('404') && bodyText.includes('Page not found')) {
    throw new Error('Page returned 404');
  }
  
  if (bodyText.includes('Error') && bodyText.includes('Something went wrong')) {
    throw new Error('Page has error state');
  }
  
  if (expectedText) {
    await expect(page.locator('body')).toContainText(expectedText);
  }
};

/**
 * Take screenshot for debugging
 */
export const takeScreenshot = async (page: Page, name: string) => {
  await page.screenshot({ 
    path: `./test-results/cross-portal/${name}.png`, 
    fullPage: true 
  });
};

/**
 * Create test data timestamp
 */
export const getTestTimestamp = () => {
  return Date.now().toString(36);
};

/**
 * Retry async operation with exponential backoff
 */
export const retryWithBackoff = async <T>(
  operation: () => Promise<T>,
  maxRetries = 5,
  baseDelay = 1000
): Promise<T> => {
  let lastError: Error | undefined;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      const delay = baseDelay * Math.pow(2, i);
      console.log(`Retry ${i + 1}/${maxRetries} after ${delay}ms: ${lastError.message}`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
};

/**
 * Check if element exists
 */
export const elementExists = async (page: Page, selector: string): Promise<boolean> => {
  try {
    await page.waitForSelector(selector, { timeout: 2000 });
    return true;
  } catch {
    return false;
  }
};

/**
 * Get text content safely
 */
export const getTextContent = async (page: Page, selector: string): Promise<string> => {
  try {
    const element = page.locator(selector).first();
    return await element.textContent() || '';
  } catch {
    return '';
  }
};
