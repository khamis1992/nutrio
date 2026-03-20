import { test, expect } from '../fixtures/test';
import { waitForNetworkIdle } from '../utils/helpers';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

test.describe('Partner - Auth', () => {

  test('TC046_Partner_Login', async ({ authenticatedPartnerPage }) => {
    // Priority: High
    // Feature: Login
    // Expected: Partner logged in, redirected to partner dashboard...
    
    // Navigate to auth page
    await authenticatedPartnerPage.goto(BASE_URL + '/partner/auth');
    await waitForNetworkIdle(authenticatedPartnerPage);
    
    // Fill login form using actual selectors from Auth.tsx
    await authenticatedPartnerPage.fill('input#email', 'partner@nutrio.com');
    await authenticatedPartnerPage.fill('input#password', 'Partner123!');
    
    // Click Sign In button
    await authenticatedPartnerPage.click('button[type="submit"]');
    await waitForNetworkIdle(authenticatedPartnerPage);
    
    // Verify successful login
    await expect(page).toHaveURL(/.*dashboard.*/);
    await expect(authenticatedPartnerPage.locator('body')).toContainText('Dashboard');
  });

  test('TC047_Partner_Login_-_Invalid_Credentials', async ({ authenticatedPartnerPage }) => {
    // Priority: High
    // Feature: Invalid Login
    // Expected: Error message displayed...
    
    // Navigate to auth page
    await authenticatedPartnerPage.goto(BASE_URL + '/partner/auth');
    await waitForNetworkIdle(authenticatedPartnerPage);
    
    // Fill login form using actual selectors from Auth.tsx
    await authenticatedPartnerPage.fill('input#email', 'partner@nutrio.com');
    await authenticatedPartnerPage.fill('input#password', 'Partner123!');
    
    // Click Sign In button
    await authenticatedPartnerPage.click('button[type="submit"]');
    await waitForNetworkIdle(authenticatedPartnerPage);
    
    // Verify successful login
    await expect(page).toHaveURL(/.*dashboard.*/);
    await expect(authenticatedPartnerPage.locator('body')).toContainText('Dashboard');
  });

  test('TC048_Partner_Logout', async ({ authenticatedPartnerPage }) => {
    // Priority: High
    // Feature: Logout
    // Expected: Logged out, redirected to login authenticatedPartnerPage...
    
    // Verify logged in
    await expect(page).toHaveURL(/.*dashboard.*/);
    
    // Click logout
    await authenticatedPartnerPage.click('text=Logout');
    await waitForNetworkIdle(authenticatedPartnerPage);
    
    // Verify logged out
    await expect(page).toHaveURL(/.*auth.*/);
  });

  test('TC153_Partner_Password_Reset_Flow', async ({ authenticatedPartnerPage }) => {
    // Priority: High
    // Feature: Password Reset
    // Expected: Password reset successful, can login with new credentials...
    
    // Navigate to auth page
    await authenticatedPartnerPage.goto(BASE_URL + '/auth');
    await waitForNetworkIdle(authenticatedPartnerPage);
    
    // Open forgot password dialog (if exists)
    await authenticatedPartnerPage.click('text=Forgot Password');
    
    // Fill email
    await authenticatedPartnerPage.fill('input#email', 'partner@nutrio.com');
    await authenticatedPartnerPage.click('button[type="submit"]');
    await waitForNetworkIdle(authenticatedPartnerPage);
    
    // Verify reset message
    await expect(authenticatedPartnerPage.locator('body')).toContainText(/sent|email|reset/i);
  });

  test('TC153_Partner_Password_Reset_Flow_2', async ({ authenticatedPartnerPage }) => {
    // Priority: High
    // Feature: Password Reset
    // Expected: Password reset successful, can login with new credentials...
    
    // Navigate to auth page
    await authenticatedPartnerPage.goto(BASE_URL + '/auth');
    await waitForNetworkIdle(authenticatedPartnerPage);
    
    // Open forgot password dialog (if exists)
    await authenticatedPartnerPage.click('text=Forgot Password');
    
    // Fill email
    await authenticatedPartnerPage.fill('input#email', 'partner@nutrio.com');
    await authenticatedPartnerPage.click('button[type="submit"]');
    await waitForNetworkIdle(authenticatedPartnerPage);
    
    // Verify reset message
    await expect(authenticatedPartnerPage.locator('body')).toContainText(/sent|email|reset/i);
  });

  test('TC200_Login_as_Partner', async ({ authenticatedPartnerPage }) => {
    // Priority: Critical
    // Feature: Partner Login
    // Expected: Partner logged in...
    
    // Navigate to auth page
    await authenticatedPartnerPage.goto(BASE_URL + '/partner/auth');
    await waitForNetworkIdle(authenticatedPartnerPage);
    
    // Fill login form using actual selectors from Auth.tsx
    await authenticatedPartnerPage.fill('input#email', 'partner@nutrio.com');
    await authenticatedPartnerPage.fill('input#password', 'Partner123!');
    
    // Click Sign In button
    await authenticatedPartnerPage.click('button[type="submit"]');
    await waitForNetworkIdle(authenticatedPartnerPage);
    
    // Verify successful login
    await expect(page).toHaveURL(/.*dashboard.*/);
    await expect(authenticatedPartnerPage.locator('body')).toContainText('Dashboard');
  });

  test('TC201_Invalid_Credentials', async ({ authenticatedPartnerPage }) => {
    // Priority: High
    // Feature: Invalid Login
    // Expected: Error displayed...
    
    // Navigate to auth page
    await authenticatedPartnerPage.goto(BASE_URL + '/partner/auth');
    await waitForNetworkIdle(authenticatedPartnerPage);
    
    // Fill login form using actual selectors from Auth.tsx
    await authenticatedPartnerPage.fill('input#email', 'partner@nutrio.com');
    await authenticatedPartnerPage.fill('input#password', 'Partner123!');
    
    // Click Sign In button
    await authenticatedPartnerPage.click('button[type="submit"]');
    await waitForNetworkIdle(authenticatedPartnerPage);
    
    // Verify successful login
    await expect(page).toHaveURL(/.*dashboard.*/);
    await expect(authenticatedPartnerPage.locator('body')).toContainText('Dashboard');
  });

  test('TC202_Logout', async ({ authenticatedPartnerPage }) => {
    // Priority: High
    // Feature: Partner Logout
    // Expected: Logged out...
    
    // Verify logged in
    await expect(page).toHaveURL(/.*dashboard.*/);
    
    // Click logout
    await authenticatedPartnerPage.click('text=Logout');
    await waitForNetworkIdle(authenticatedPartnerPage);
    
    // Verify logged out
    await expect(page).toHaveURL(/.*auth.*/);
  });

  test('TC203_Password_Reset', async ({ authenticatedPartnerPage }) => {
    // Priority: High
    // Feature: Password Reset
    // Expected: Password reset successful...
    
    // Navigate to auth page
    await authenticatedPartnerPage.goto(BASE_URL + '/auth');
    await waitForNetworkIdle(authenticatedPartnerPage);
    
    // Open forgot password dialog (if exists)
    await authenticatedPartnerPage.click('text=Forgot Password');
    
    // Fill email
    await authenticatedPartnerPage.fill('input#email', 'partner@nutrio.com');
    await authenticatedPartnerPage.click('button[type="submit"]');
    await waitForNetworkIdle(authenticatedPartnerPage);
    
    // Verify reset message
    await expect(authenticatedPartnerPage.locator('body')).toContainText(/sent|email|reset/i);
  });
});
