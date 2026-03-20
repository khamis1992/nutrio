/**
 * Cross-Portal Integration Test: Admin Management Workflow
 * 
 * Tests admin oversight across all portals:
 * 1. Admin views dashboard with analytics
 * 2. Admin manages users
 * 3. Admin manages restaurants/partners
 * 4. Admin views all orders
 * 5. Admin manages drivers
 * 6. Admin views analytics and reports
 * 7. Admin manages payouts
 * 8. Admin views while other portals are active
 */

import { test, expect, Browser, BrowserContext, Page } from '@playwright/test';
import {
  loginAsAdmin,
  loginAsCustomer,
  loginAsPartner,
  loginAsDriver,
  waitForNetworkIdle,
  verifyPageLoaded,
  safeClick,
} from './utils';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

test.describe('Cross-Portal: Admin Management Workflow', () => {
  let browser: Browser;
  let contexts: {
    adminContext: BrowserContext;
    customerContext: BrowserContext;
    partnerContext: BrowserContext;
    driverContext: BrowserContext;
  };
  let pages: {
    adminPage: Page;
    customerPage: Page;
    partnerPage: Page;
    driverPage: Page;
  };

  test.beforeAll(async ({ browser: b }) => {
    browser = b;
    
    // Create all 4 contexts
    contexts = {
      adminContext: await browser.newContext(),
      customerContext: await browser.newContext(),
      partnerContext: await browser.newContext(),
      driverContext: await browser.newContext(),
    };

    pages = {
      adminPage: await contexts.adminContext.newPage(),
      customerPage: await contexts.customerContext.newPage(),
      partnerPage: await contexts.partnerContext.newPage(),
      driverPage: await contexts.driverContext.newPage(),
    };

    // Login all 4 portals in parallel
    console.log('Logging in all 4 portals for admin management test...');
    await Promise.all([
      loginAsAdmin(pages.adminPage),
      loginAsCustomer(pages.customerPage),
      loginAsPartner(pages.partnerPage),
      loginAsDriver(pages.driverPage),
    ]);
    console.log('All 4 portals logged in');
  });

  test.afterAll(async () => {
    await contexts.adminContext.close();
    await contexts.customerContext.close();
    await contexts.partnerContext.close();
    await contexts.driverContext.close();
  });

  test('Step 1: Admin views main dashboard', async () => {
    const { adminPage } = pages;
    
    await adminPage.goto(`${BASE_URL}/admin`);
    await waitForNetworkIdle(adminPage);
    await verifyPageLoaded(adminPage, 'Dashboard');
    
    console.log('Admin dashboard loaded');
  });

  test('Step 2: Admin views users management', async () => {
    const { adminPage } = pages;
    
    await adminPage.goto(`${BASE_URL}/admin/users`);
    await waitForNetworkIdle(adminPage);
    await verifyPageLoaded(adminPage);
    
    console.log('Admin users page loaded');
  });

  test('Step 3: Admin views restaurants', async () => {
    const { adminPage } = pages;
    
    await adminPage.goto(`${BASE_URL}/admin/restaurants`);
    await waitForNetworkIdle(adminPage);
    await verifyPageLoaded(adminPage);
    
    console.log('Admin restaurants page loaded');
  });

  test('Step 4: Admin views orders', async () => {
    const { adminPage } = pages;
    
    await adminPage.goto(`${BASE_URL}/admin/orders`);
    await waitForNetworkIdle(adminPage);
    await verifyPageLoaded(adminPage);
    
    console.log('Admin orders page loaded');
  });

  test('Step 5: Admin views drivers', async () => {
    const { adminPage } = pages;
    
    await adminPage.goto(`${BASE_URL}/admin/drivers`);
    await waitForNetworkIdle(adminPage);
    await verifyPageLoaded(adminPage);
    
    console.log('Admin drivers page loaded');
  });

  test('Step 6: Admin views deliveries', async () => {
    const { adminPage } = pages;
    
    await adminPage.goto(`${BASE_URL}/admin/deliveries`);
    await waitForNetworkIdle(adminPage);
    await verifyPageLoaded(adminPage);
    
    console.log('Admin deliveries page loaded');
  });

  test('Step 7: Admin views analytics', async () => {
    const { adminPage } = pages;
    
    await adminPage.goto(`${BASE_URL}/admin/analytics`);
    await waitForNetworkIdle(adminPage);
    await verifyPageLoaded(adminPage);
    
    console.log('Admin analytics page loaded');
  });

  test('Step 8: Admin views payouts', async () => {
    const { adminPage } = pages;
    
    await adminPage.goto(`${BASE_URL}/admin/payouts`);
    await waitForNetworkIdle(adminPage);
    await verifyPageLoaded(adminPage);
    
    console.log('Admin payouts page loaded');
  });

  test('Step 9: Admin views subscriptions', async () => {
    const { adminPage } = pages;
    
    await adminPage.goto(`${BASE_URL}/admin/subscriptions`);
    await waitForNetworkIdle(adminPage);
    await verifyPageLoaded(adminPage);
    
    console.log('Admin subscriptions page loaded');
  });

  test('Step 10: Admin views settings', async () => {
    const { adminPage } = pages;
    
    await adminPage.goto(`${BASE_URL}/admin/settings`);
    await waitForNetworkIdle(adminPage);
    await verifyPageLoaded(adminPage);
    
    console.log('Admin settings page loaded');
  });

  test('Step 11: Admin views affiliate applications', async () => {
    const { adminPage } = pages;
    
    await adminPage.goto(`${BASE_URL}/admin/affiliate-applications`);
    await waitForNetworkIdle(adminPage);
    await verifyPageLoaded(adminPage);
    
    console.log('Admin affiliate applications page loaded');
  });

  test('Step 12: Admin views notifications', async () => {
    const { adminPage } = pages;
    
    await adminPage.goto(`${BASE_URL}/admin/notifications`);
    await waitForNetworkIdle(adminPage);
    await verifyPageLoaded(adminPage);
    
    console.log('Admin notifications page loaded');
  });

  test('Step 13: Admin monitors while all portals active', async () => {
    // Navigate all portals to their main pages
    await Promise.all([
      pages.adminPage.goto(`${BASE_URL}/admin`),
      pages.customerPage.goto(`${BASE_URL}/dashboard`),
      pages.partnerPage.goto(`${BASE_URL}/partner`),
      pages.driverPage.goto(`${BASE_URL}/driver`),
    ]);
    
    await Promise.all([
      waitForNetworkIdle(pages.adminPage),
      waitForNetworkIdle(pages.customerPage),
      waitForNetworkIdle(pages.partnerPage),
      waitForNetworkIdle(pages.driverPage),
    ]);
    
    // Verify all 4 loaded
    await verifyPageLoaded(pages.adminPage);
    await verifyPageLoaded(pages.customerPage);
    await verifyPageLoaded(pages.partnerPage);
    await verifyPageLoaded(pages.driverPage);
    
    console.log('Admin monitoring all 4 active portals');
  });

  test('Step 14: Admin views exports', async () => {
    const { adminPage } = pages;
    
    await adminPage.goto(`${BASE_URL}/admin/exports`);
    await waitForNetworkIdle(adminPage);
    await verifyPageLoaded(adminPage);
    
    console.log('Admin exports page loaded');
  });

  test('Step 15: Admin views featured restaurants', async () => {
    const { adminPage } = pages;
    
    await adminPage.goto(`${BASE_URL}/admin/featured`);
    await waitForNetworkIdle(adminPage);
    await verifyPageLoaded(adminPage);
    
    console.log('Admin featured restaurants page loaded');
  });
});
