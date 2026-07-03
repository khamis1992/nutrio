/**
 * Global Auth Setup
 * Logs in once per role and saves storage state for reuse across all tests.
 * Eliminates per-test login overhead (~12s per test) and rate limiting.
 */
import { test as setup, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

setup.setTimeout(120000);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AUTH_DIR = path.join(__dirname, '.auth');

async function saveAuthState(
  page: import('@playwright/test').Page,
  role: string,
  email: string,
  password: string,
  authPath: string,
  expectedUrlPattern: RegExp,
) {
  await page.goto('/auth');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(5000);

  const currentUrl = page.url();

  // If already authenticated (redirected to dashboard/onboarding), save state directly
  if (expectedUrlPattern.test(currentUrl) || currentUrl.includes('dashboard') || currentUrl.includes('onboarding')) {
    await page.context().storageState({ path: authPath });
    console.log(`✅ Auth state saved for ${role} (already authenticated): ${authPath}`);
    return;
  }

  // Check if we're on the onboarding/walkthrough screen (no welcome buttons)
  const onboardingNext = page.locator('button:has-text("Next")').first();
  const onboardingSkip = page.locator('button:has-text("Skip")').first();
  if (await onboardingNext.isVisible({ timeout: 2000 }).catch(() => false)) {
    // Click through onboarding to reach dashboard, then save state
    for (let i = 0; i < 5; i++) {
      if (await onboardingNext.isVisible({ timeout: 1000 }).catch(() => false)) {
        await onboardingNext.click();
        await page.waitForTimeout(500);
      } else {
        break;
      }
    }
    await page.context().storageState({ path: authPath });
    console.log(`✅ Auth state saved for ${role} (via onboarding): ${authPath}`);
    return;
  }

  // Customer auth shows a welcome screen first — click "Sign In" to reveal the form
  const welcomeSignIn = page.locator('[data-testid="welcome-sign-in-btn"]');
  if (await welcomeSignIn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await welcomeSignIn.click();
    await page.waitForTimeout(800);
  }

  // Fill credentials using data-testid selectors
  await page.locator('[data-testid="signin-email-input"]').fill(email);
  await page.locator('[data-testid="signin-password-input"]').fill(password);
  await page.locator('[data-testid="signin-submit-btn"]').click();

  // Wait for redirect to expected page
  await expect(page).toHaveURL(expectedUrlPattern, { timeout: 15000 });

  // Save storage state
  await page.context().storageState({ path: authPath });
  console.log(`✅ Auth state saved for ${role}: ${authPath}`);
}

setup('authenticate customer', async ({ page }) => {
  await saveAuthState(
    page,
    'customer',
    'eng.aljabor@gmail.com',
    '123456789',
    path.join(AUTH_DIR, 'customer.json'),
    /.*dashboard.*/,
  );
});

setup('authenticate admin', async ({ page }) => {
  await saveAuthState(
    page,
    'admin',
    'khamis-1992@hotmail.com',
    'Khamees1992#',
    path.join(AUTH_DIR, 'admin.json'),
    /.*admin.*/,
  );
});

setup('authenticate partner', async ({ page }) => {
  await page.goto('/partner/auth');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);
  await page.locator('[data-testid="signin-email-input"]').fill('khamis4everever@gmail.com');
  await page.locator('[data-testid="signin-password-input"]').fill('123456789');
  await page.locator('[data-testid="signin-submit-btn"]').click();
  await expect(page).toHaveURL(/.*partner.*/, { timeout: 15000 });
  await page.context().storageState({ path: path.join(AUTH_DIR, 'partner.json') });
  console.log('✅ Auth state saved for partner');
});

setup('authenticate driver', async ({ page }) => {
  await page.goto('/driver/auth');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);
  await page.locator('[data-testid="signin-email-input"]').fill('driver@nutriofuel.com');
  await page.locator('[data-testid="signin-password-input"]').fill('123456789');
  await page.locator('[data-testid="signin-submit-btn"]').click();
  await expect(page).toHaveURL(/.*driver.*/, { timeout: 15000 });
  await page.context().storageState({ path: path.join(AUTH_DIR, 'driver.json') });
  console.log('✅ Auth state saved for driver');
});
