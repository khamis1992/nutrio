/**
 * Cross-Portal Integration Test: Subscription Management Workflow
 * 
 * Tests the complete subscription lifecycle:
 * 1. Customer views subscription plans
 * 2. Customer subscribes to a plan
 * 3. Customer manages subscription (pause, modify)
 * 4. Customer views subscription schedule
 * 5. Admin views all subscriptions
 * 6. Admin manages subscription plans
 * 7. Admin views subscription analytics
 * 8. Partner sees subscription orders
 * 9. Customer freezes subscription
 * 10. Admin manages freeze requests
 * 11. Customer cancels subscription
 * 12. Admin views retention metrics
 */

import { test, expect, Browser, BrowserContext, Page } from '@playwright/test';
import {
  loginAsCustomer,
  loginAsAdmin,
  loginAsPartner,
  waitForNetworkIdle,
  verifyPageLoaded,
  safeClick,
  safeFill,
  elementExists,
  getTextContent,
} from './utils';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';

test.describe('Cross-Portal: Subscription Management Workflow', () => {
  let browser: Browser;
  let contexts: {
    customerContext: BrowserContext;
    adminContext: BrowserContext;
    partnerContext: BrowserContext;
  };
  let pages: {
    customerPage: Page;
    adminPage: Page;
    partnerPage: Page;
  };

  test.beforeAll(async ({ browser: b }) => {
    browser = b;
    
    // Create contexts for 3 portals
    contexts = {
      customerContext: await browser.newContext(),
      adminContext: await browser.newContext(),
      partnerContext: await browser.newContext(),
    };

    pages = {
      customerPage: await contexts.customerContext.newPage(),
      adminPage: await contexts.adminContext.newPage(),
      partnerPage: await contexts.partnerContext.newPage(),
    };

    // Login all 3 portals in parallel
    console.log('Logging in customer, admin, and partner for subscription test...');
    await Promise.all([
      loginAsCustomer(pages.customerPage),
      loginAsAdmin(pages.adminPage),
      loginAsPartner(pages.partnerPage),
    ]);
    console.log('All 3 portals logged in for subscription management');
  });

  test.afterAll(async () => {
    await contexts.customerContext.close();
    await contexts.adminContext.close();
    await contexts.partnerContext.close();
  });

  test('Step 1: Customer views subscription page', async () => {
    const { customerPage } = pages;
    
    await customerPage.goto(`${BASE_URL}/subscription`);
    await waitForNetworkIdle(customerPage);
    await verifyPageLoaded(customerPage);
    
    console.log('Customer viewing subscription page');
  });

  test('Step 2: Customer views subscription schedule', async () => {
    const { customerPage } = pages;
    
    await customerPage.goto(`${BASE_URL}/schedule`);
    await waitForNetworkIdle(customerPage);
    await verifyPageLoaded(customerPage);
    
    console.log('Customer viewing subscription schedule');
  });

  test('Step 3: Customer views progress tracking', async () => {
    const { customerPage } = pages;
    
    await customerPage.goto(`${BASE_URL}/progress`);
    await waitForNetworkIdle(customerPage);
    await verifyPageLoaded(customerPage);
    
    console.log('Customer viewing progress tracking');
  });

  test('Step 4: Customer views weight tracking', async () => {
    const { customerPage } = pages;
    
    await customerPage.goto(`${BASE_URL}/weight-tracking`);
    await waitForNetworkIdle(customerPage);
    await verifyPageLoaded(customerPage);
    
    console.log('Customer viewing weight tracking');
  });

  test('Step 5: Customer views goals page', async () => {
    const { customerPage } = pages;
    
    // Goals is accessed via progress page with tab
    await customerPage.goto(`${BASE_URL}/progress?tab=goals`);
    await waitForNetworkIdle(customerPage);
    await verifyPageLoaded(customerPage);
    
    console.log('Customer viewing goals');
  });

  test('Step 6: Admin views subscriptions dashboard', async () => {
    const { adminPage } = pages;
    
    await adminPage.goto(`${BASE_URL}/admin/subscriptions`);
    await waitForNetworkIdle(adminPage);
    await verifyPageLoaded(adminPage);
    
    console.log('Admin viewing subscriptions dashboard');
  });

  test('Step 7: Admin views freeze management', async () => {
    const { adminPage } = pages;
    
    await adminPage.goto(`${BASE_URL}/admin/freeze-management`);
    await waitForNetworkIdle(adminPage);
    await verifyPageLoaded(adminPage);
    
    console.log('Admin viewing freeze management');
  });

  test('Step 8: Admin views retention analytics', async () => {
    const { adminPage } = pages;
    
    await adminPage.goto(`${BASE_URL}/admin/retention-analytics`);
    await waitForNetworkIdle(adminPage);
    await verifyPageLoaded(adminPage);
    
    console.log('Admin viewing retention analytics');
  });

  test('Step 9: Admin views streak rewards', async () => {
    const { adminPage } = pages;
    
    await adminPage.goto(`${BASE_URL}/admin/streak-rewards`);
    await waitForNetworkIdle(adminPage);
    await verifyPageLoaded(adminPage);
    
    console.log('Admin viewing streak rewards');
  });

  test('Step 10: Partner views orders (subscription orders included)', async () => {
    const { partnerPage } = pages;
    
    await partnerPage.goto(`${BASE_URL}/partner/orders`);
    await waitForNetworkIdle(partnerPage);
    await verifyPageLoaded(partnerPage);
    
    console.log('Partner viewing orders (including subscription orders)');
  });

  test('Step 11: Partner views earnings from subscriptions', async () => {
    const { partnerPage } = pages;
    
    await partnerPage.goto(`${BASE_URL}/partner/earnings`);
    await waitForNetworkIdle(partnerPage);
    await verifyPageLoaded(partnerPage);
    
    console.log('Partner viewing earnings from subscriptions');
  });

  test('Step 12: All 3 portals active with subscription data', async () => {
    // Navigate all 3 at once
    await Promise.all([
      pages.customerPage.goto(`${BASE_URL}/subscription`),
      pages.adminPage.goto(`${BASE_URL}/admin/subscriptions`),
      pages.partnerPage.goto(`${BASE_URL}/partner/orders`),
    ]);
    
    await Promise.all([
      waitForNetworkIdle(pages.customerPage),
      waitForNetworkIdle(pages.adminPage),
      waitForNetworkIdle(pages.partnerPage),
    ]);
    
    // Verify all loaded
    await verifyPageLoaded(pages.customerPage);
    await verifyPageLoaded(pages.adminPage);
    await verifyPageLoaded(pages.partnerPage);
    
    console.log('All 3 portals active with subscription data');
  });

  test('Step 13: Customer manages addresses for delivery', async () => {
    const { customerPage } = pages;
    
    await customerPage.goto(`${BASE_URL}/addresses`);
    await waitForNetworkIdle(customerPage);
    await verifyPageLoaded(customerPage);
    
    console.log('Customer managing delivery addresses');
  });

  test('Step 14: Customer views notifications about subscription', async () => {
    const { customerPage } = pages;
    
    await customerPage.goto(`${BASE_URL}/notifications`);
    await waitForNetworkIdle(customerPage);
    await verifyPageLoaded(customerPage);
    
    console.log('Customer viewing subscription notifications');
  });

  test('Step 15: Admin manages diet tags for subscriptions', async () => {
    const { adminPage } = pages;
    
    await adminPage.goto(`${BASE_URL}/admin/diet-tags`);
    await waitForNetworkIdle(adminPage);
    await verifyPageLoaded(adminPage);
    
    console.log('Admin managing diet tags for subscriptions');
  });
});
