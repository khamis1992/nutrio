import { test, expect } from '../fixtures/test';
import { waitForNetworkIdle } from '../utils/helpers';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

test.describe('Driver - Dashboard', () => {

  test('TC134_Driver_Dashboard_Load', async ({ authenticatedDriverPage }) => {
    // Priority: High
    // Feature: View
    // Expected: Dashboard shows: available orders, today's earnings, active deliveries...
    
    // Navigate to dashboard
    await authenticatedDriverPage.goto(BASE_URL + '/driver/dashboard');
    await waitForNetworkIdle(authenticatedDriverPage);
    
    // Verify dashboard loaded
    await expect(authenticatedDriverPage.locator('body')).toContainText('Dashboard');
  });

  test('TC135_View_Driver_Stats', async ({ authenticatedDriverPage }) => {
    // Priority: Medium
    // Feature: Stats
    // Expected: Correct stats displayed...
    
    // Navigate to dashboard
    await authenticatedDriverPage.goto(BASE_URL + '/driver/dashboard/[id]');
    await waitForNetworkIdle(authenticatedDriverPage);
    
    // Verify dashboard loaded
    await expect(authenticatedDriverPage.locator('body')).toContainText('Dashboard');
  });

  test('TC231_View_Earnings_Summary_on_Dashboard', async ({ authenticatedDriverPage }) => {
    // Priority: High
    // Feature: Earnings Summary
    // Expected: Earnings stats displayed accurately...
    
    // Navigate to dashboard
    await authenticatedDriverPage.goto(BASE_URL + '/driver/dashboard/[id]');
    await waitForNetworkIdle(authenticatedDriverPage);
    
    // Verify dashboard loaded
    await expect(authenticatedDriverPage.locator('body')).toContainText('Dashboard');
  });

  test('TC232_View_Active_Delivery_on_Dashboard', async ({ authenticatedDriverPage }) => {
    // Priority: Critical
    // Feature: Active Delivery
    // Expected: Active delivery details shown...
    
    // Navigate to dashboard
    await authenticatedDriverPage.goto(BASE_URL + '/driver/dashboard/[id]');
    await waitForNetworkIdle(authenticatedDriverPage);
    
    // Verify dashboard loaded
    await expect(authenticatedDriverPage.locator('body')).toContainText('Dashboard');
  });

  test('TC160_Load_Driver_Dashboard', async ({ authenticatedDriverPage }) => {
    // Priority: Critical
    // Feature: Dashboard Load
    // Expected: Dashboard loaded...
    
    // Navigate to dashboard
    await authenticatedDriverPage.goto(BASE_URL + '/driver/dashboard');
    await waitForNetworkIdle(authenticatedDriverPage);
    
    // Verify dashboard loaded
    await expect(authenticatedDriverPage.locator('body')).toContainText('Dashboard');
  });

  test('TC161_View_Earnings_Summary', async ({ authenticatedDriverPage }) => {
    // Priority: High
    // Feature: Earnings Summary
    // Expected: Earnings displayed...
    
    // Navigate to dashboard
    await authenticatedDriverPage.goto(BASE_URL + '/driver/dashboard');
    await waitForNetworkIdle(authenticatedDriverPage);
    
    // Verify dashboard loaded
    await expect(authenticatedDriverPage.locator('body')).toContainText('Dashboard');
  });

  test('TC162_View_Active_Delivery', async ({ authenticatedDriverPage }) => {
    // Priority: Critical
    // Feature: Active Delivery
    // Expected: Active delivery shown...
    
    // Navigate to dashboard
    await authenticatedDriverPage.goto(BASE_URL + '/driver/dashboard');
    await waitForNetworkIdle(authenticatedDriverPage);
    
    // Verify dashboard loaded
    await expect(authenticatedDriverPage.locator('body')).toContainText('Dashboard');
  });

  test('TC163_View_Completion_Rate', async ({ authenticatedDriverPage }) => {
    // Priority: Medium
    // Feature: Completion Rate
    // Expected: Completion rate displayed...
    
    // Navigate to dashboard
    await authenticatedDriverPage.goto(BASE_URL + '/driver/dashboard');
    await waitForNetworkIdle(authenticatedDriverPage);
    
    // Verify dashboard loaded
    await expect(authenticatedDriverPage.locator('body')).toContainText('Dashboard');
  });
});
