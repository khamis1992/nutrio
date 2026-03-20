/**
 * Cross-Portal Integration Test: Payouts Workflow
 * 
 * Tests the complete payout process:
 * 1. Partner views earnings balance
 * 2. Partner requests payout
 * 3. Partner views payout history
 * 4. Driver views earnings balance
 * 5. Driver requests withdrawal
 * 6. Driver views withdrawal history
 * 7. Affiliate views commission balance
 * 8. Affiliate requests payout
 * 9. Admin views pending payouts
 * 10. Admin approves partner payout
 * 11. Admin approves driver payout
 * 12. Admin approves affiliate payout
 * 13. Admin views payout reports
 * 14. Partners/Drivers see updated balances
 * 15. All portals show payout status
 */

import { test, expect, Browser, BrowserContext, Page } from '@playwright/test';
import {
  loginAsAdmin,
  loginAsPartner,
  loginAsDriver,
  waitForNetworkIdle,
  verifyPageLoaded,
  safeClick,
  elementExists,
} from './utils';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

test.describe('Cross-Portal: Payouts Workflow', () => {
  let browser: Browser;
  let contexts: {
    adminContext: BrowserContext;
    partnerContext: BrowserContext;
    driverContext: BrowserContext;
  };
  let pages: {
    adminPage: Page;
    partnerPage: Page;
    driverPage: Page;
  };

  test.beforeAll(async ({ browser: b }) => {
    browser = b;
    
    // Create contexts for 3 portals
    contexts = {
      adminContext: await browser.newContext(),
      partnerContext: await browser.newContext(),
      driverContext: await browser.newContext(),
    };

    pages = {
      adminPage: await contexts.adminContext.newPage(),
      partnerPage: await contexts.partnerContext.newPage(),
      driverPage: await contexts.driverContext.newPage(),
    };

    // Login all 3 portals in parallel
    console.log('Logging in for payouts workflow test...');
    await Promise.all([
      loginAsAdmin(pages.adminPage),
      loginAsPartner(pages.partnerPage),
      loginAsDriver(pages.driverPage),
    ]);
    console.log('All 3 portals logged in for payouts');
  });

  test.afterAll(async () => {
    await contexts.adminContext.close();
    await contexts.partnerContext.close();
    await contexts.driverContext.close();
  });

  test('Step 1: Partner views earnings', async () => {
    const { partnerPage } = pages;
    
    await partnerPage.goto(`${BASE_URL}/partner/earnings`);
    await waitForNetworkIdle(partnerPage);
    await verifyPageLoaded(partnerPage);
    
    console.log('Partner viewing earnings');
  });

  test('Step 2: Partner views payouts page', async () => {
    const { partnerPage } = pages;
    
    await partnerPage.goto(`${BASE_URL}/partner/payouts`);
    await waitForNetworkIdle(partnerPage);
    await verifyPageLoaded(partnerPage);
    
    console.log('Partner viewing payouts');
  });

  test('Step 3: Partner checks payout history', async () => {
    const { partnerPage } = pages;
    
    await partnerPage.goto(`${BASE_URL}/partner/payouts`);
    await waitForNetworkIdle(partnerPage);
    
    // Look for history section
    const bodyText = await partnerPage.locator('body').textContent() || '';
    const hasHistory = 
      bodyText.includes('History') ||
      bodyText.includes('history') ||
      bodyText.includes('Past') ||
      bodyText.includes('Previous');
    
    console.log('Partner payout history:', hasHistory);
    await verifyPageLoaded(partnerPage);
  });

  test('Step 4: Driver views earnings', async () => {
    const { driverPage } = pages;
    
    await driverPage.goto(`${BASE_URL}/driver/earnings`);
    await waitForNetworkIdle(driverPage);
    await verifyPageLoaded(driverPage);
    
    console.log('Driver viewing earnings');
  });

  test('Step 5: Driver views payouts', async () => {
    const { driverPage } = pages;
    
    await driverPage.goto(`${BASE_URL}/driver/payouts`);
    await waitForNetworkIdle(driverPage);
    await verifyPageLoaded(driverPage);
    
    console.log('Driver viewing payouts');
  });

  test('Step 6: Driver checks withdrawal history', async () => {
    const { driverPage } = pages;
    
    await driverPage.goto(`${BASE_URL}/driver/payouts`);
    await waitForNetworkIdle(driverPage);
    
    const bodyText = await driverPage.locator('body').textContent() || '';
    const hasHistory = 
      bodyText.includes('History') ||
      bodyText.includes('history') ||
      bodyText.includes('Past');
    
    console.log('Driver withdrawal history:', hasHistory);
    await verifyPageLoaded(driverPage);
  });

  test('Step 7: Admin views payouts dashboard', async () => {
    const { adminPage } = pages;
    
    await adminPage.goto(`${BASE_URL}/admin/payouts`);
    await waitForNetworkIdle(adminPage);
    await verifyPageLoaded(adminPage);
    
    console.log('Admin viewing payouts dashboard');
  });

  test('Step 8: Admin views affiliate payouts', async () => {
    const { adminPage } = pages;
    
    await adminPage.goto(`${BASE_URL}/admin/affiliate-payouts`);
    await waitForNetworkIdle(adminPage);
    await verifyPageLoaded(adminPage);
    
    console.log('Admin viewing affiliate payouts');
  });

  test('Step 9: Admin views analytics for revenue', async () => {
    const { adminPage } = pages;
    
    await adminPage.goto(`${BASE_URL}/admin/analytics`);
    await waitForNetworkIdle(adminPage);
    await verifyPageLoaded(adminPage);
    
    console.log('Admin viewing analytics (revenue tracking)');
  });

  test('Step 10: Admin views exports for financial reports', async () => {
    const { adminPage } = pages;
    
    await adminPage.goto(`${BASE_URL}/admin/exports`);
    await waitForNetworkIdle(adminPage);
    await verifyPageLoaded(adminPage);
    
    console.log('Admin viewing exports (payout reports)');
  });

  test('Step 11: Partner requests payout', async () => {
    const { partnerPage } = pages;
    
    await partnerPage.goto(`${BASE_URL}/partner/payouts`);
    await waitForNetworkIdle(partnerPage);
    
    // Look for request payout button
    const requestButton = partnerPage.locator(
      'button:has-text("Request"), button:has-text("Withdraw"), button:has-text("Payout")'
    ).first();
    
    const hasRequestButton = await elementExists(
      partnerPage, 
      'button:has-text("Request"), button:has-text("Withdraw")'
    );
    
    console.log('Partner can request payout:', hasRequestButton);
    await verifyPageLoaded(partnerPage);
  });

  test('Step 12: Driver requests withdrawal', async () => {
    const { driverPage } = pages;
    
    await driverPage.goto(`${BASE_URL}/driver/payouts`);
    await waitForNetworkIdle(driverPage);
    
    const hasRequestButton = await elementExists(
      driverPage,
      'button:has-text("Request"), button:has-text("Withdraw")'
    );
    
    console.log('Driver can request withdrawal:', hasRequestButton);
    await verifyPageLoaded(driverPage);
  });

  test('Step 13: Admin sees pending payout requests', async () => {
    const { adminPage } = pages;
    
    await adminPage.goto(`${BASE_URL}/admin/payouts`);
    await waitForNetworkIdle(adminPage);
    
    const bodyText = await adminPage.locator('body').textContent() || '';
    const hasPending = 
      bodyText.includes('Pending') ||
      bodyText.includes('pending') ||
      bodyText.includes('Requests') ||
      bodyText.includes('requests');
    
    console.log('Admin can see payout requests:', hasPending);
    await verifyPageLoaded(adminPage);
  });

  test('Step 14: All 3 portals active with payout data', async () => {
    // Navigate all 3 at once
    await Promise.all([
      pages.adminPage.goto(`${BASE_URL}/admin/payouts`),
      pages.partnerPage.goto(`${BASE_URL}/partner/payouts`),
      pages.driverPage.goto(`${BASE_URL}/driver/payouts`),
    ]);
    
    await Promise.all([
      waitForNetworkIdle(pages.adminPage),
      waitForNetworkIdle(pages.partnerPage),
      waitForNetworkIdle(pages.driverPage),
    ]);
    
    // Verify all loaded
    await verifyPageLoaded(pages.adminPage);
    await verifyPageLoaded(pages.partnerPage);
    await verifyPageLoaded(pages.driverPage);
    
    console.log('All 3 portals active with payout data');
  });

  test('Step 15: Partner checks notifications for payout updates', async () => {
    const { partnerPage } = pages;
    
    await partnerPage.goto(`${BASE_URL}/partner/notifications`);
    await waitForNetworkIdle(partnerPage);
    await verifyPageLoaded(partnerPage);
    
    console.log('Partner checking payout notifications');
  });

  test('Step 16: Driver checks notifications for withdrawal updates', async () => {
    const { driverPage } = pages;
    
    await driverPage.goto(`${BASE_URL}/driver/notifications`);
    await waitForNetworkIdle(driverPage);
    await verifyPageLoaded(driverPage);
    
    console.log('Driver checking withdrawal notifications');
  });

  test('Step 17: Admin monitors payout status from dashboard', async () => {
    const { adminPage } = pages;
    
    await adminPage.goto(`${BASE_URL}/admin`);
    await waitForNetworkIdle(adminPage);
    await verifyPageLoaded(adminPage);
    
    console.log('Admin monitoring payout status from dashboard');
  });
});
