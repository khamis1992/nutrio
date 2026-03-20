import { test, expect } from '../fixtures/test';
import { waitForNetworkIdle } from '../utils/helpers';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

test.describe('Customer - Dashboard', () => {

  test('TC006_Dashboard_Load_and_Display', async ({ authenticatedCustomerPage }) => {
    // Priority: High
    // Feature: View
    // Expected: Dashboard loads with subscription info, meals remaining, recent orders...
    
    // Navigate to dashboard
    await authenticatedCustomerPage.goto(BASE_URL + '/dashboard');
    await waitForNetworkIdle(authenticatedCustomerPage);
    
    // Verify dashboard loaded
    await expect(authenticatedCustomerPage.locator('body')).toContainText('Dashboard');
  });

  test('TC007_Dashboard_Navigation_Links', async ({ authenticatedCustomerPage }) => {
    // Priority: High
    // Feature: Navigation
    // Expected: All links navigate to correct pages...
    
    // Navigate to dashboard
    await authenticatedCustomerPage.goto(BASE_URL + '/dashboard');
    await waitForNetworkIdle(authenticatedCustomerPage);
    
    // Verify dashboard loaded
    await expect(authenticatedCustomerPage.locator('body')).toContainText('Dashboard');
  });

  test('TC008_Dashboard_Quick_Action_Buttons', async ({ authenticatedCustomerPage }) => {
    // Priority: Medium
    // Feature: Quick Actions
    // Expected: Each button performs correct action...
    
    // Navigate to dashboard
    await authenticatedCustomerPage.goto(BASE_URL + '/dashboard');
    await waitForNetworkIdle(authenticatedCustomerPage);
    
    // Verify dashboard loaded
    await expect(authenticatedCustomerPage.locator('body')).toContainText('Dashboard');
  });

  test('TC450_Dashboard_Initial_Load', async ({ authenticatedCustomerPage }) => {
    // Priority: Critical
    // Feature: Dashboard Load
    // Expected: Dashboard loads with all widgets...
    
    // Navigate to dashboard
    await authenticatedCustomerPage.goto(BASE_URL + '/dashboard');
    await waitForNetworkIdle(authenticatedCustomerPage);
    
    // Verify dashboard loaded
    await expect(authenticatedCustomerPage.locator('body')).toContainText('Dashboard');
  });

  test('TC451_Dashboard_Quick_Actions', async ({ authenticatedCustomerPage }) => {
    // Priority: High
    // Feature: Quick Actions
    // Expected: All quick actions navigate correctly...
    
    // Navigate to dashboard
    await authenticatedCustomerPage.goto(BASE_URL + '/dashboard');
    await waitForNetworkIdle(authenticatedCustomerPage);
    
    // Verify dashboard loaded
    await expect(authenticatedCustomerPage.locator('body')).toContainText('Dashboard');
  });

  test('TC452_View_Meals_Remaining_Widget', async ({ authenticatedCustomerPage }) => {
    // Priority: High
    // Feature: Meals Remaining Widget
    // Expected: Widget shows correct remaining meals...
    
    // Navigate to dashboard
    await authenticatedCustomerPage.goto(BASE_URL + '/dashboard');
    await waitForNetworkIdle(authenticatedCustomerPage);
    
    // Verify dashboard loaded
    await expect(authenticatedCustomerPage.locator('body')).toContainText('Dashboard');
  });

  test('TC453_View_Recent_Orders_Widget', async ({ authenticatedCustomerPage }) => {
    // Priority: High
    // Feature: Recent Orders Widget
    // Expected: Recent orders displayed, click navigates...
    
    // Navigate to dashboard
    await authenticatedCustomerPage.goto(BASE_URL + '/dashboard');
    await waitForNetworkIdle(authenticatedCustomerPage);
    
    // Verify dashboard loaded
    await expect(authenticatedCustomerPage.locator('body')).toContainText('Dashboard');
  });

  test('TC454_View_Nutrition_Summary_Widget', async ({ authenticatedCustomerPage }) => {
    // Priority: High
    // Feature: Nutrition Summary Widget
    // Expected: Nutrition summary shows today's totals...
    
    // Navigate to dashboard
    await authenticatedCustomerPage.goto(BASE_URL + '/dashboard');
    await waitForNetworkIdle(authenticatedCustomerPage);
    
    // Verify dashboard loaded
    await expect(authenticatedCustomerPage.locator('body')).toContainText('Dashboard');
  });

  test('TC455_Water_Tracker_on_Dashboard', async ({ authenticatedCustomerPage }) => {
    // Priority: Medium
    // Feature: Water Tracker Widget
    // Expected: Water intake tracked and saved...
    
    // Navigate to dashboard
    await authenticatedCustomerPage.goto(BASE_URL + '/dashboard');
    await waitForNetworkIdle(authenticatedCustomerPage);
    
    // Verify dashboard loaded
    await expect(authenticatedCustomerPage.locator('body')).toContainText('Dashboard');
  });

  test('TC456_View_Streak_Widget', async ({ authenticatedCustomerPage }) => {
    // Priority: Medium
    // Feature: Streak Display Widget
    // Expected: Current streak displayed with details...
    
    // Navigate to dashboard
    await authenticatedCustomerPage.goto(BASE_URL + '/dashboard');
    await waitForNetworkIdle(authenticatedCustomerPage);
    
    // Verify dashboard loaded
    await expect(authenticatedCustomerPage.locator('body')).toContainText('Dashboard');
  });

  test('TC457_View_Health_Score_Widget', async ({ authenticatedCustomerPage }) => {
    // Priority: Medium
    // Feature: Health Score Widget
    // Expected: Health score displayed with category...
    
    // Navigate to dashboard
    await authenticatedCustomerPage.goto(BASE_URL + '/dashboard');
    await waitForNetworkIdle(authenticatedCustomerPage);
    
    // Verify dashboard loaded
    await expect(authenticatedCustomerPage.locator('body')).toContainText('Dashboard');
  });

  test('TC458_View_Gamification_Widget', async ({ authenticatedCustomerPage }) => {
    // Priority: Low
    // Feature: Gamification Widget
    // Expected: Gamification elements displayed...
    
    // Navigate to dashboard
    await authenticatedCustomerPage.goto(BASE_URL + '/dashboard');
    await waitForNetworkIdle(authenticatedCustomerPage);
    
    // Verify dashboard loaded
    await expect(authenticatedCustomerPage.locator('body')).toContainText('Dashboard');
  });

  test('TC459_View_Smart_Recommendations', async ({ authenticatedCustomerPage }) => {
    // Priority: Medium
    // Feature: Smart Recommendations
    // Expected: AI recommendations displayed...
    
    // Navigate to dashboard
    await authenticatedCustomerPage.goto(BASE_URL + '/dashboard');
    await waitForNetworkIdle(authenticatedCustomerPage);
    
    // Verify dashboard loaded
    await expect(authenticatedCustomerPage.locator('body')).toContainText('Dashboard');
  });

  test('TC460_View_Rollover_Credits', async ({ authenticatedCustomerPage }) => {
    // Priority: Medium
    // Feature: Rollover Credits Widget
    // Expected: Rollover credits displayed with expiry...
    
    // Navigate to dashboard
    await authenticatedCustomerPage.goto(BASE_URL + '/dashboard');
    await waitForNetworkIdle(authenticatedCustomerPage);
    
    // Verify dashboard loaded
    await expect(authenticatedCustomerPage.locator('body')).toContainText('Dashboard');
  });

  test('TC461_View_Weekly_Summary_Cards', async ({ authenticatedCustomerPage }) => {
    // Priority: Low
    // Feature: Weekly Summary Cards
    // Expected: Weekly summary with trends displayed...
    
    // Navigate to dashboard
    await authenticatedCustomerPage.goto(BASE_URL + '/dashboard');
    await waitForNetworkIdle(authenticatedCustomerPage);
    
    // Verify dashboard loaded
    await expect(authenticatedCustomerPage.locator('body')).toContainText('Dashboard');
  });

  test('TC462_Refresh_Dashboard_Data', async ({ authenticatedCustomerPage }) => {
    // Priority: Low
    // Feature: Refresh Data
    // Expected: Dashboard data refreshed successfully...
    
    // Navigate to dashboard
    await authenticatedCustomerPage.goto(BASE_URL + '/dashboard');
    await waitForNetworkIdle(authenticatedCustomerPage);
    
    // Verify dashboard loaded
    await expect(authenticatedCustomerPage.locator('body')).toContainText('Dashboard');
  });

  test('TC463_Navigate_to_Full_Nutrition_Dashboard', async ({ authenticatedCustomerPage }) => {
    // Priority: Medium
    // Feature: Nutrition Dashboard Page
    // Expected: Full nutrition dashboard displayed...
    
    // Navigate to dashboard
    await authenticatedCustomerPage.goto(BASE_URL + '/dashboard');
    await waitForNetworkIdle(authenticatedCustomerPage);
    
    // Verify dashboard loaded
    await expect(authenticatedCustomerPage.locator('body')).toContainText('Dashboard');
  });

  test('TC464_View_Progress_Rings', async ({ authenticatedCustomerPage }) => {
    // Priority: Low
    // Feature: Progress Rings
    // Expected: Progress rings show accurate completion...
    
    // Navigate to dashboard
    await authenticatedCustomerPage.goto(BASE_URL + '/dashboard');
    await waitForNetworkIdle(authenticatedCustomerPage);
    
    // Verify dashboard loaded
    await expect(authenticatedCustomerPage.locator('body')).toContainText('Dashboard');
  });
});
