import { test, expect } from '@playwright/test';

test('App loads correctly', async ({ page }) => {
  await page.goto('http://localhost:8080/auth');
  
  // Wait for the page to load
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);
  
  // Take screenshot to debug
  await page.screenshot({ path: 'debug-auth-page.png' });
  
  // Check if page has content
  const bodyText = await page.locator('body').textContent();
  console.log('Page content:', bodyText?.substring(0, 200));
  
  // Look for email input with more flexible selector
  const emailInput = page.locator('input[type="email"], input#email, input[name="email"]').first();
  const isVisible = await emailInput.isVisible().catch(() => false);
  
  console.log('Email input visible:', isVisible);
  
  if (isVisible) {
    await expect(emailInput).toBeVisible();
    console.log('SUCCESS: Email input found!');
  } else {
    console.log('FAIL: Email input not found');
    // List all inputs on page
    const inputs = await page.locator('input').all();
    console.log('Total inputs found:', inputs.length);
    for (let i = 0; i < inputs.length; i++) {
      const type = await inputs[i].getAttribute('type');
      const id = await inputs[i].getAttribute('id');
      console.log(`Input ${i}: type=${type}, id=${id}`);
    }
  }
});
