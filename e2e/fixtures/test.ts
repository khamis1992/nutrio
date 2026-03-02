/**
 * Playwright Test Fixtures
 * Extends base test with authentication and utilities
 */

import { test as base, Page, expect } from '@playwright/test';
import { loginAsCustomer, loginAsAdmin, loginAsPartner, loginAsDriver, logout } from '../utils/helpers';

// Define test fixtures
type TestFixtures = {
  authenticatedCustomerPage: Page;
  authenticatedAdminPage: Page;
  authenticatedPartnerPage: Page;
  authenticatedDriverPage: Page;
};

// Extend base test with fixtures
export const test = base.extend<TestFixtures>({
  // Fixture: Authenticated customer page
  authenticatedCustomerPage: async ({ page }, use) => {
    await loginAsCustomer(page);
    await use(page);
    await logout(page);
  },

  // Fixture: Authenticated admin page
  authenticatedAdminPage: async ({ page }, use) => {
    await loginAsAdmin(page);
    await use(page);
    await logout(page);
  },

  // Fixture: Authenticated partner page
  authenticatedPartnerPage: async ({ page }, use) => {
    await loginAsPartner(page);
    await use(page);
    await logout(page);
  },

  // Fixture: Authenticated driver page
  authenticatedDriverPage: async ({ page }, use) => {
    await loginAsDriver(page);
    await use(page);
    await logout(page);
  },
});

export { expect } from '@playwright/test';
