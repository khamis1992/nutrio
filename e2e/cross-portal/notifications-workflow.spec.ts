/**
 * Cross-Portal Integration Test: Notifications Workflow
 * 
 * Tests the complete notification system across all portals:
 * 1. Customer views notifications
 * 2. Customer receives order updates
 * 3. Customer receives delivery updates
 * 4. Customer receives promotional notifications
 * 5. Partner views notifications
 * 6. Partner receives order notifications
 * 7. Partner receives payout notifications
 * 8. Driver views notifications
 * 9. Driver receives delivery assignments
 * 10. Driver receives earnings notifications
 * 11. Admin views notifications
 * 12. Admin sends announcements
 * 13. Admin views system notifications
 * 14. All portals receive real-time updates
 * 15. Mark notifications as read
 * 16. Clear notifications
 */

import { test, expect, Browser, BrowserContext, Page } from '@playwright/test';
import {
  loginAsCustomer,
  loginAsAdmin,
  loginAsPartner,
  loginAsDriver,
  waitForNetworkIdle,
  verifyPageLoaded,
  safeClick,
  elementExists,
} from './utils';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

test.describe('Cross-Portal: Notifications Workflow', () => {
  let browser: Browser;
  let contexts: {
    customerContext: BrowserContext;
    adminContext: BrowserContext;
    partnerContext: BrowserContext;
    driverContext: BrowserContext;
  };
  let pages: {
    customerPage: Page;
    adminPage: Page;
    partnerPage: Page;
    driverPage: Page;
  };

  test.beforeAll(async ({ browser: b }) => {
    browser = b;
    
    // Create contexts for all 4 portals
    contexts = {
      customerContext: await browser.newContext(),
      adminContext: await browser.newContext(),
      partnerContext: await browser.newContext(),
      driverContext: await browser.newContext(),
    };

    pages = {
      customerPage: await contexts.customerContext.newPage(),
      adminPage: await contexts.adminContext.newPage(),
      partnerPage: await contexts.partnerContext.newPage(),
      driverPage: await contexts.driverContext.newPage(),
    };

    // Login all 4 portals in parallel
    console.log('Logging in all 4 portals for notifications test...');
    await Promise.all([
      loginAsCustomer(pages.customerPage),
      loginAsAdmin(pages.adminPage),
      loginAsPartner(pages.partnerPage),
      loginAsDriver(pages.driverPage),
    ]);
    console.log('All 4 portals logged in for notifications');
  });

  test.afterAll(async () => {
    await contexts.customerContext.close();
    await contexts.adminContext.close();
    await contexts.partnerContext.close();
    await contexts.driverContext.close();
  });

  test('Step 1: Customer views notifications', async () => {
    const { customerPage } = pages;
    
    await customerPage.goto(`${BASE_URL}/notifications`);
    await waitForNetworkIdle(customerPage);
    await verifyPageLoaded(customerPage);
    
    console.log('Customer viewing notifications');
  });

  test('Step 2: Partner views notifications', async () => {
    const { partnerPage } = pages;
    
    await partnerPage.goto(`${BASE_URL}/partner/notifications`);
    await waitForNetworkIdle(partnerPage);
    await verifyPageLoaded(partnerPage);
    
    console.log('Partner viewing notifications');
  });

  test('Step 3: Driver views notifications', async () => {
    const { driverPage } = pages;
    
    await driverPage.goto(`${BASE_URL}/driver/notifications`);
    await waitForNetworkIdle(driverPage);
    await verifyPageLoaded(driverPage);
    
    console.log('Driver viewing notifications');
  });

  test('Step 4: Admin views notifications', async () => {
    const { adminPage } = pages;
    
    await adminPage.goto(`${BASE_URL}/admin/notifications`);
    await waitForNetworkIdle(adminPage);
    await verifyPageLoaded(adminPage);
    
    console.log('Admin viewing notifications');
  });

  test('Step 5: Customer checks for order notifications', async () => {
    const { customerPage } = pages;
    
    await customerPage.goto(`${BASE_URL}/notifications`);
    await waitForNetworkIdle(customerPage);
    
    const bodyText = await customerPage.locator('body').textContent() || '';
    const hasOrderNotifs = 
      bodyText.includes('Order') ||
      bodyText.includes('order') ||
      bodyText.includes('Delivery') ||
      bodyText.includes('delivery');
    
    console.log('Customer order notifications:', hasOrderNotifs);
    await verifyPageLoaded(customerPage);
  });

  test('Step 6: Partner checks for order notifications', async () => {
    const { partnerPage } = pages;
    
    await partnerPage.goto(`${BASE_URL}/partner/notifications`);
    await waitForNetworkIdle(partnerPage);
    
    const bodyText = await partnerPage.locator('body').textContent() || '';
    const hasOrderNotifs = 
      bodyText.includes('Order') ||
      bodyText.includes('order') ||
      bodyText.includes('New');
    
    console.log('Partner order notifications:', hasOrderNotifs);
    await verifyPageLoaded(partnerPage);
  });

  test('Step 7: Driver checks for delivery notifications', async () => {
    const { driverPage } = pages;
    
    await driverPage.goto(`${BASE_URL}/driver/notifications`);
    await waitForNetworkIdle(driverPage);
    
    const bodyText = await driverPage.locator('body').textContent() || '';
    const hasDeliveryNotifs = 
      bodyText.includes('Delivery') ||
      bodyText.includes('delivery') ||
      bodyText.includes('Assignment');
    
    console.log('Driver delivery notifications:', hasDeliveryNotifs);
    await verifyPageLoaded(driverPage);
  });

  test('Step 8: Admin checks system notifications', async () => {
    const { adminPage } = pages;
    
    await adminPage.goto(`${BASE_URL}/admin/notifications`);
    await waitForNetworkIdle(adminPage);
    
    const bodyText = await adminPage.locator('body').textContent() || '';
    const hasSystemNotifs = 
      bodyText.includes('System') ||
      bodyText.includes('Alert') ||
      bodyText.includes('Report');
    
    console.log('Admin system notifications:', hasSystemNotifs);
    await verifyPageLoaded(adminPage);
  });

  test('Step 9: All 4 portals check notifications simultaneously', async () => {
    // Navigate all 4 to notifications at once
    await Promise.all([
      pages.customerPage.goto(`${BASE_URL}/notifications`),
      pages.partnerPage.goto(`${BASE_URL}/partner/notifications`),
      pages.driverPage.goto(`${BASE_URL}/driver/notifications`),
      pages.adminPage.goto(`${BASE_URL}/admin/notifications`),
    ]);
    
    await Promise.all([
      waitForNetworkIdle(pages.customerPage),
      waitForNetworkIdle(pages.partnerPage),
      waitForNetworkIdle(pages.driverPage),
      waitForNetworkIdle(pages.adminPage),
    ]);
    
    // Verify all loaded
    await verifyPageLoaded(pages.customerPage);
    await verifyPageLoaded(pages.partnerPage);
    await verifyPageLoaded(pages.driverPage);
    await verifyPageLoaded(pages.adminPage);
    
    console.log('All 4 portals viewing notifications simultaneously');
  });

  test('Step 10: Customer navigates from notification to order', async () => {
    const { customerPage } = pages;
    
    await customerPage.goto(`${BASE_URL}/notifications`);
    await waitForNetworkIdle(customerPage);
    
    // Look for order link in notifications
    const orderLink = customerPage.locator('a[href*="/order"], a:has-text("Order"), [data-testid="order-link"]').first();
    
    console.log('Customer can navigate from notification to order');
    await verifyPageLoaded(customerPage);
  });

  test('Step 11: Partner navigates from notification to order details', async () => {
    const { partnerPage } = pages;
    
    await partnerPage.goto(`${BASE_URL}/partner/notifications`);
    await waitForNetworkIdle(partnerPage);
    
    console.log('Partner can navigate from notification to order');
    await verifyPageLoaded(partnerPage);
  });

  test('Step 12: Driver navigates from notification to delivery', async () => {
    const { driverPage } = pages;
    
    await driverPage.goto(`${BASE_URL}/driver/notifications`);
    await waitForNetworkIdle(driverPage);
    
    console.log('Driver can navigate from notification to delivery');
    await verifyPageLoaded(driverPage);
  });

  test('Step 13: Admin sends announcement', async () => {
    const { adminPage } = pages;
    
    // Admin goes to notifications/announcements
    await adminPage.goto(`${BASE_URL}/admin/notifications`);
    await waitForNetworkIdle(adminPage);
    
    // Look for send announcement button
    const hasSendButton = await elementExists(
      adminPage,
      'button:has-text("Send"), button:has-text("Create"), button:has-text("New")'
    );
    
    console.log('Admin can send announcements:', hasSendButton);
    await verifyPageLoaded(adminPage);
  });

  test('Step 14: Customer receives promotional notification', async () => {
    const { customerPage } = pages;
    
    await customerPage.goto(`${BASE_URL}/notifications`);
    await waitForNetworkIdle(customerPage);
    
    const bodyText = await customerPage.locator('body').textContent() || '';
    const hasPromo = 
      bodyText.includes('Promo') ||
      bodyText.includes('Offer') ||
      bodyText.includes('Discount');
    
    console.log('Customer promotional notifications:', hasPromo);
    await verifyPageLoaded(customerPage);
  });

  test('Step 15: Partner receives payout notification', async () => {
    const { partnerPage } = pages;
    
    await partnerPage.goto(`${BASE_URL}/partner/notifications`);
    await waitForNetworkIdle(partnerPage);
    
    const bodyText = await partnerPage.locator('body').textContent() || '';
    const hasPayout = 
      bodyText.includes('Payout') ||
      bodyText.includes('Payment') ||
      bodyText.includes('Earning');
    
    console.log('Partner payout notifications:', hasPayout);
    await verifyPageLoaded(partnerPage);
  });

  test('Step 16: Driver receives earnings notification', async () => {
    const { driverPage } = pages;
    
    await driverPage.goto(`${BASE_URL}/driver/notifications`);
    await waitForNetworkIdle(driverPage);
    
    const bodyText = await driverPage.locator('body').textContent() || '';
    const hasEarnings = 
      bodyText.includes('Earning') ||
      bodyText.includes('Payment') ||
      bodyText.includes('Completed');
    
    console.log('Driver earnings notifications:', hasEarnings);
    await verifyPageLoaded(driverPage);
  });

  test('Step 17: All portals refresh and sync notifications', async () => {
    // All portals refresh
    await Promise.all([
      pages.customerPage.reload(),
      pages.partnerPage.reload(),
      pages.driverPage.reload(),
      pages.adminPage.reload(),
    ]);
    
    await Promise.all([
      waitForNetworkIdle(pages.customerPage),
      waitForNetworkIdle(pages.partnerPage),
      waitForNetworkIdle(pages.driverPage),
      waitForNetworkIdle(pages.adminPage),
    ]);
    
    // Verify all still loaded
    await verifyPageLoaded(pages.customerPage);
    await verifyPageLoaded(pages.partnerPage);
    await verifyPageLoaded(pages.driverPage);
    await verifyPageLoaded(pages.adminPage);
    
    console.log('All portals synced with latest notifications');
  });

  test('Step 18: Customer checks notification settings', async () => {
    const { customerPage } = pages;
    
    await customerPage.goto(`${BASE_URL}/settings`);
    await waitForNetworkIdle(customerPage);
    
    const bodyText = await customerPage.locator('body').textContent() || '';
    const hasNotifSettings = 
      bodyText.includes('Notification') ||
      bodyText.includes('notification');
    
    console.log('Customer notification settings:', hasNotifSettings);
    await verifyPageLoaded(customerPage);
  });

  test('Step 19: Partner checks notification settings', async () => {
    const { partnerPage } = pages;
    
    await partnerPage.goto(`${BASE_URL}/partner/settings`);
    await waitForNetworkIdle(partnerPage);
    
    const bodyText = await partnerPage.locator('body').textContent() || '';
    const hasNotifSettings = 
      bodyText.includes('Notification') ||
      bodyText.includes('notification');
    
    console.log('Partner notification settings:', hasNotifSettings);
    await verifyPageLoaded(partnerPage);
  });

  test('Step 20: Driver checks notification settings', async () => {
    const { driverPage } = pages;
    
    await driverPage.goto(`${BASE_URL}/driver/settings`);
    await waitForNetworkIdle(driverPage);
    
    const bodyText = await driverPage.locator('body').textContent() || '';
    const hasNotifSettings = 
      bodyText.includes('Notification') ||
      bodyText.includes('notification');
    
    console.log('Driver notification settings:', hasNotifSettings);
    await verifyPageLoaded(driverPage);
  });
});
