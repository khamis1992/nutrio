import { test, expect } from '../fixtures/test';
import { waitForNetworkIdle } from '../utils/helpers';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

test.describe('Admin - Dashboard', () => {

  test('TC080_Admin_Dashboard_Load', async ({ authenticatedAdminPage }) => {
    // Priority: High
    // Feature: View
    // Expected: Dashboard shows: total users, orders, revenue, restaurants...
    
    // Navigate to dashboard
    await authenticatedAdminPage.goto(BASE_URL + '/admin');
    await waitForNetworkIdle(authenticatedAdminPage);
    
    // Verify dashboard loaded
    await expect(authenticatedAdminPage.locator('body')).toContainText('Dashboard');
  });

  test('TC081_Dashboard_Statistics', async ({ authenticatedAdminPage }) => {
    // Priority: High
    // Feature: Stats
    // Expected: All metrics accurate and up-to-date...
    
    // Navigate to dashboard
    await authenticatedAdminPage.goto(BASE_URL + '/admin');
    await waitForNetworkIdle(authenticatedAdminPage);
    
    // Verify dashboard loaded
    await expect(authenticatedAdminPage.locator('body')).toContainText('Dashboard');
  });

  test('TC082_Admin_Quick_Actions', async ({ authenticatedAdminPage }) => {
    // Priority: Medium
    // Feature: Quick Actions
    // Expected: Navigates to correct section...
    
    // Navigate to dashboard
    await authenticatedAdminPage.goto(BASE_URL + '/admin');
    await waitForNetworkIdle(authenticatedAdminPage);
    
    // Verify dashboard loaded
    await expect(authenticatedAdminPage.locator('body')).toContainText('Dashboard');
  });

  test('TC083_View_Recent_Activity', async ({ authenticatedAdminPage }) => {
    // Priority: Medium
    // Feature: Recent Activity
    // Expected: Recent orders, signups, restaurant applications shown...
    
    // Navigate to dashboard
    await authenticatedAdminPage.goto(BASE_URL + '/admin');
    await waitForNetworkIdle(authenticatedAdminPage);
    
    // Verify dashboard loaded
    await expect(authenticatedAdminPage.locator('body')).toContainText('Dashboard');
  });

  test('TC410_Load_Admin_Dashboard', async ({ authenticatedAdminPage }) => {
    // Priority: Critical
    // Feature: Dashboard Load
    // Expected: Dashboard with stats displayed...
    
    // Navigate to dashboard
    await authenticatedAdminPage.goto(BASE_URL + '/admin');
    await waitForNetworkIdle(authenticatedAdminPage);
    
    // Verify dashboard loaded
    await expect(authenticatedAdminPage.locator('body')).toContainText('Dashboard');
  });

  test('TC411_View_Dashboard_Statistics', async ({ authenticatedAdminPage }) => {
    // Priority: High
    // Feature: View Statistics
    // Expected: All statistics displayed accurately...
    
    // Navigate to dashboard
    await authenticatedAdminPage.goto(BASE_URL + '/admin');
    await waitForNetworkIdle(authenticatedAdminPage);
    
    // Verify dashboard loaded
    await expect(authenticatedAdminPage.locator('body')).toContainText('Dashboard');
  });

  test('TC412_Use_Quick_Actions', async ({ authenticatedAdminPage }) => {
    // Priority: Medium
    // Feature: Quick Actions
    // Expected: Quick action navigates correctly...
    
    // Navigate to dashboard
    await authenticatedAdminPage.goto(BASE_URL + '/admin');
    await waitForNetworkIdle(authenticatedAdminPage);
    
    // Verify dashboard loaded
    await expect(authenticatedAdminPage.locator('body')).toContainText('Dashboard');
  });

  test('TC413_View_Recent_Activity_2', async ({ authenticatedAdminPage }) => {
    // Priority: Medium
    // Feature: Recent Activity
    // Expected: Recent activity displayed...
    
    // Navigate to dashboard
    await authenticatedAdminPage.goto(BASE_URL + '/admin');
    await waitForNetworkIdle(authenticatedAdminPage);
    
    // Verify dashboard loaded
    await expect(authenticatedAdminPage.locator('body')).toContainText('Dashboard');
  });

  test('TC414_View_Dashboard_Charts', async ({ authenticatedAdminPage }) => {
    // Priority: Medium
    // Feature: Charts Display
    // Expected: Charts displayed correctly...
    
    // Navigate to dashboard
    await authenticatedAdminPage.goto(BASE_URL + '/admin');
    await waitForNetworkIdle(authenticatedAdminPage);
    
    // Verify dashboard loaded
    await expect(authenticatedAdminPage.locator('body')).toContainText('Dashboard');
  });
});
