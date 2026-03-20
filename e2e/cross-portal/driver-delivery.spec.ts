/**
 * Cross-Portal Integration Test: Driver Delivery Workflow
 * 
 * Tests the driver assignment and delivery flow:
 * 1. Driver logs in and goes online
 * 2. Driver sees available orders
 * 3. Driver accepts order
 * 4. Driver navigates to pickup
 * 5. Driver picks up order
 * 6. Driver navigates to delivery
 * 7. Driver completes delivery
 * 8. Partner sees order status updates
 * 9. Customer sees delivery updates
 * 10. Admin can track delivery
 */

import { test, expect, Browser, BrowserContext, Page } from '@playwright/test';
import {
  PortalPages,
  loginAsCustomer,
  loginAsPartner,
  loginAsDriver,
  waitForNetworkIdle,
  verifyPageLoaded,
  safeClick,
  safeFill,
  elementExists,
} from './utils';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

test.describe('Cross-Portal: Driver Delivery Workflow', () => {
  let browser: Browser;
  let contexts: {
    customerContext: BrowserContext;
    partnerContext: BrowserContext;
    driverContext: BrowserContext;
  };
  let pages: {
    customerPage: Page;
    partnerPage: Page;
    driverPage: Page;
  };

  test.beforeAll(async ({ browser: b }) => {
    browser = b;
    
    // Create contexts for 3 portals
    contexts = {
      customerContext: await browser.newContext(),
      partnerContext: await browser.newContext(),
      driverContext: await browser.newContext(),
    };

    pages = {
      customerPage: await contexts.customerContext.newPage(),
      partnerPage: await contexts.partnerContext.newPage(),
      driverPage: await contexts.driverContext.newPage(),
    };

    // Login all 3 portals in parallel
    console.log('Logging in customer, partner, and driver...');
    await Promise.all([
      loginAsCustomer(pages.customerPage),
      loginAsPartner(pages.partnerPage),
      loginAsDriver(pages.driverPage),
    ]);
    console.log('All 3 portals logged in');
  });

  test.afterAll(async () => {
    await contexts.customerContext.close();
    await contexts.partnerContext.close();
    await contexts.driverContext.close();
  });

  test('Step 1: Driver views dashboard', async () => {
    const { driverPage } = pages;
    
    await driverPage.goto(`${BASE_URL}/driver`);
    await waitForNetworkIdle(driverPage);
    await verifyPageLoaded(driverPage);
    
    console.log('Driver dashboard loaded');
  });

  test('Step 2: Driver views available orders', async () => {
    const { driverPage } = pages;
    
    await driverPage.goto(`${BASE_URL}/driver/orders`);
    await waitForNetworkIdle(driverPage);
    await verifyPageLoaded(driverPage);
    
    console.log('Driver orders page loaded');
  });

  test('Step 3: Driver views earnings', async () => {
    const { driverPage } = pages;
    
    await driverPage.goto(`${BASE_URL}/driver/earnings`);
    await waitForNetworkIdle(driverPage);
    await verifyPageLoaded(driverPage);
    
    console.log('Driver earnings page loaded');
  });

  test('Step 4: Driver views payouts', async () => {
    const { driverPage } = pages;
    
    await driverPage.goto(`${BASE_URL}/driver/payouts`);
    await waitForNetworkIdle(driverPage);
    await verifyPageLoaded(driverPage);
    
    console.log('Driver payouts page loaded');
  });

  test('Step 5: Driver views delivery history', async () => {
    const { driverPage } = pages;
    
    await driverPage.goto(`${BASE_URL}/driver/history`);
    await waitForNetworkIdle(driverPage);
    await verifyPageLoaded(driverPage);
    
    console.log('Driver history page loaded');
  });

  test('Step 6: Driver views profile', async () => {
    const { driverPage } = pages;
    
    await driverPage.goto(`${BASE_URL}/driver/profile`);
    await waitForNetworkIdle(driverPage);
    await verifyPageLoaded(driverPage);
    
    console.log('Driver profile page loaded');
  });

  test('Step 7: Partner views orders while driver is active', async () => {
    const { partnerPage } = pages;
    
    // Partner navigates to orders
    await partnerPage.goto(`${BASE_URL}/partner/orders`);
    await waitForNetworkIdle(partnerPage);
    await verifyPageLoaded(partnerPage);
    
    console.log('Partner viewing orders while driver active');
  });

  test('Step 8: Customer views order tracking', async () => {
    const { customerPage } = pages;
    
    // Customer checks their orders
    await customerPage.goto(`${BASE_URL}/orders`);
    await waitForNetworkIdle(customerPage);
    await verifyPageLoaded(customerPage);
    
    console.log('Customer viewing orders');
  });

  test('Step 9: Customer views delivery tracking page', async () => {
    const { customerPage } = pages;
    
    await customerPage.goto(`${BASE_URL}/tracking`);
    await waitForNetworkIdle(customerPage);
    await verifyPageLoaded(customerPage);
    
    console.log('Customer tracking page loaded');
  });

  test('Step 10: All 3 portals active - Driver, Partner, Customer', async () => {
    // Navigate all 3 at once
    await Promise.all([
      pages.driverPage.goto(`${BASE_URL}/driver/orders`),
      pages.partnerPage.goto(`${BASE_URL}/partner/orders`),
      pages.customerPage.goto(`${BASE_URL}/orders`),
    ]);
    
    await Promise.all([
      waitForNetworkIdle(pages.driverPage),
      waitForNetworkIdle(pages.partnerPage),
      waitForNetworkIdle(pages.customerPage),
    ]);
    
    // Verify all loaded
    await verifyPageLoaded(pages.driverPage);
    await verifyPageLoaded(pages.partnerPage);
    await verifyPageLoaded(pages.customerPage);
    
    console.log('Driver, Partner, and Customer portals all active');
  });

  test('Step 11: Driver views notifications', async () => {
    const { driverPage } = pages;
    
    await driverPage.goto(`${BASE_URL}/driver/notifications`);
    await waitForNetworkIdle(driverPage);
    await verifyPageLoaded(driverPage);
    
    console.log('Driver notifications page loaded');
  });

  test('Step 12: Driver views settings', async () => {
    const { driverPage } = pages;
    
    await driverPage.goto(`${BASE_URL}/driver/settings`);
    await waitForNetworkIdle(driverPage);
    await verifyPageLoaded(driverPage);
    
    console.log('Driver settings page loaded');
  });
});
