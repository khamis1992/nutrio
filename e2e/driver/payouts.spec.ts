import { test, expect } from '../fixtures/test';
import { waitForNetworkIdle } from '../utils/helpers';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

test.describe('Driver - Payouts', () => {

  test('TC240_View_Payout_History', async ({ authenticatedDriverPage }) => {
    // Priority: High
    // Feature: View Payouts
    // Expected: Payouts displayed...
    
    // Navigate to page
    await authenticatedDriverPage.goto(BASE_URL + '/driver/payouts');
    await waitForNetworkIdle(authenticatedDriverPage);
    
    // TODO: Implement specific test steps for View Payouts
    // Verify page loaded
    await expect(authenticatedDriverPage.locator('body')).toBeVisible();
    await expect(authenticatedDriverPage.locator('body')).toContainText('View Payouts');
  });
});
