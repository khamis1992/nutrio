# Cross-Portal Integration Tests

## Overview

This directory contains comprehensive **cross-portal integration tests** that simulate real business workflows across all 4 Nutrio Fuel portals simultaneously:

- **Customer Portal** - End users who order meals
- **Partner Portal** - Restaurants that prepare orders
- **Driver Portal** - Delivery personnel
- **Admin Portal** - Platform management

## Why Cross-Portal Tests?

Traditional tests check one portal at a time. Cross-portal tests verify that:

1. **Real-time interactions work** - When a customer orders, partner sees it instantly
2. **Data flows correctly** - Order status updates propagate across all portals
3. **Multi-user scenarios work** - Multiple users can use the platform simultaneously
4. **Integration is solid** - APIs and websockets work between portals

## Test Files

### 1. `order-lifecycle.spec.ts` ⭐ **MOST IMPORTANT**
**The Complete Order Flow**

Tests the full order journey:
```
Customer browses meals
    ↓
Customer places order
    ↓
Partner receives order
    ↓
Driver gets assigned
    ↓
Driver delivers
    ↓
Admin monitors everything
```

**Tests**: 9 steps covering the critical business flow
**Portals**: All 4 (Customer, Partner, Driver, Admin)

### 2. `partner-onboarding.spec.ts`
**Partner Registration & Approval**

Tests partner lifecycle:
```
Partner registers
    ↓
Partner completes onboarding
    ↓
Admin reviews application
    ↓
Admin approves partner
    ↓
Partner accesses dashboard
    ↓
Partner manages menu
```

**Tests**: 11 steps
**Portals**: Partner + Admin

### 3. `driver-delivery.spec.ts`
**Driver Assignment & Delivery**

Tests delivery workflow:
```
Driver goes online
    ↓
Driver sees available orders
    ↓
Driver accepts order
    ↓
Driver picks up from partner
    ↓
Driver delivers to customer
    ↓
All parties see updates
```

**Tests**: 12 steps
**Portals**: Driver + Partner + Customer

### 4. `admin-management.spec.ts`
**Admin Oversight & Control**

Tests admin capabilities:
```
Admin views dashboard
    ↓
Admin manages users
    ↓
Admin manages restaurants
    ↓
Admin manages drivers
    ↓
Admin views orders
    ↓
Admin views analytics
    ↓
Admin monitors all portals
```

**Tests**: 15 steps
**Portals**: Admin + All others (monitored)

### 5. `customer-journey.spec.ts`
**Complete Customer Experience**

Tests customer flows:
```
Customer registers
    ↓
Customer browses meals
    ↓
Customer manages favorites
    ↓
Customer manages addresses
    ↓
Customer views subscription
    ↓
Customer manages wallet
    ↓
Customer places orders
    ↓
Customer tracks deliveries
```

**Tests**: 20 steps
**Portals**: Customer only (comprehensive)

## How It Works

### Multi-Browser Contexts

Each test creates **isolated browser contexts** for each portal:

```typescript
// 4 separate browser instances
const customerContext = await browser.newContext();
const adminContext = await browser.newContext();
const partnerContext = await browser.newContext();
const driverContext = await browser.newContext();

// 4 separate pages
const customerPage = await customerContext.newPage();
const adminPage = await adminContext.newPage();
const partnerPage = await partnerContext.newPage();
const driverPage = await driverContext.newPage();
```

This ensures:
- ✅ Separate sessions (cookies, localStorage)
- ✅ Separate authentication states
- ✅ True multi-user simulation

### Parallel Login

All portals log in simultaneously:

```typescript
await Promise.all([
  loginAsCustomer(customerPage),
  loginAsAdmin(adminPage),
  loginAsPartner(partnerPage),
  loginAsDriver(driverPage),
]);
```

**Time saved**: ~15 seconds vs 60 seconds sequential

### Simultaneous Actions

All portals navigate at once:

```typescript
await Promise.all([
  customerPage.goto('/dashboard'),
  adminPage.goto('/admin'),
  partnerPage.goto('/partner'),
  driverPage.goto('/driver'),
]);
```

## Running the Tests

### Quick Run (All Cross-Portal Tests)

**Linux/Mac:**
```bash
./scripts/run-cross-portal-tests.sh
```

**Windows:**
```bash
scripts\run-cross-portal-tests.bat
```

### Run Individual Workflows

```bash
# Most important - Order lifecycle
npx playwright test e2e/cross-portal/order-lifecycle.spec.ts

# Partner onboarding
npx playwright test e2e/cross-portal/partner-onboarding.spec.ts

# Driver delivery
npx playwright test e2e/cross-portal/driver-delivery.spec.ts

# Admin management
npx playwright test e2e/cross-portal/admin-management.spec.ts

# Customer journey
npx playwright test e2e/cross-portal/customer-journey.spec.ts
```

### With Different Browsers

```bash
# Test on Chrome, Firefox, and Safari
npx playwright test e2e/cross-portal/ --project=chromium --project=firefox --project=webkit
```

### With Visual Debugging

```bash
# See the browsers (headed mode)
npx playwright test e2e/cross-portal/order-lifecycle.spec.ts --headed

# Slow down for observation
npx playwright test e2e/cross-portal/order-lifecycle.spec.ts --headed --slow-mo 1000
```

### Parallel Execution

```bash
# Run all 5 test files in parallel
npx playwright test e2e/cross-portal/ --workers=5
```

## Test Results

### Expected Output

```
Running 67 tests using 5 workers

✓ order-lifecycle.spec.ts (9 tests)
✓ partner-onboarding.spec.ts (11 tests)
✓ driver-delivery.spec.ts (12 tests)
✓ admin-management.spec.ts (15 tests)
✓ customer-journey.spec.ts (20 tests)

67 passed (45s)
```

### View HTML Report

```bash
npx playwright show-report
```

Opens a beautiful HTML report showing:
- Test duration
- Screenshots on failure
- Trace viewer for debugging
- Video recordings (if enabled)

## Test Utilities

### `utils.ts`

Shared helpers for cross-portal tests:

```typescript
// Login helpers
loginAsCustomer(page)
loginAsAdmin(page)
loginAsPartner(page)
loginAsDriver(page)
loginAllPortals(pages)  // All at once

// Navigation
navigateAllToDashboards(pages)

// Verification
verifyPageLoaded(page, expectedText?)

// Utilities
waitForNetworkIdle(page)
safeClick(page, selector)
safeFill(page, selector, value)
takeScreenshot(page, name)
```

## Writing New Cross-Portal Tests

### Template

```typescript
import { test, Browser } from '@playwright/test';
import { loginAllPortals, verifyPageLoaded } from './utils';

test.describe('Cross-Portal: Your Workflow', () => {
  let pages;

  test.beforeAll(async ({ browser }) => {
    // Create contexts and pages
    const customerContext = await browser.newContext();
    const adminContext = await browser.newContext();
    
    pages = {
      customerPage: await customerContext.newPage(),
      adminPage: await adminContext.newPage(),
    };

    // Login
    await loginAllPortals(pages);
  });

  test('Step 1: Customer does something', async () => {
    await pages.customerPage.goto('/dashboard');
    await verifyPageLoaded(pages.customerPage);
  });

  test('Step 2: Admin sees it', async () => {
    await pages.adminPage.goto('/admin');
    await verifyPageLoaded(pages.adminPage);
  });
});
```

## Best Practices

### 1. Keep Tests Independent
Each test should be runnable standalone:
```typescript
// Good: Each test navigates to its starting point
test('Step 1', async () => {
  await page.goto('/start');
  // ... test
});
```

### 2. Use Parallel Operations
```typescript
// Good: All portals act simultaneously
await Promise.all([
  customerPage.click('button'),
  adminPage.goto('/admin'),
  partnerPage.reload(),
]);
```

### 3. Verify State Changes
```typescript
// Good: Check that data propagated
test('Order appears for partner', async () => {
  await customerPage.click('Place Order');
  await partnerPage.goto('/partner/orders');
  await expect(partnerPage.locator('body')).toContainText('New Order');
});
```

### 4. Clean Up After Tests
```typescript
test.afterAll(async () => {
  await customerContext.close();
  await adminContext.close();
});
```

## Troubleshooting

### "Port already in use"

Close other test runs:
```bash
npx playwright test --workers=1  # Run sequentially
```

### Tests timing out

Increase timeout:
```bash
npx playwright test --timeout=60000
```

### Authentication failures

Check test users exist in Supabase:
```sql
SELECT email FROM auth.users 
WHERE email IN ('admin@nutrio.com', 'partner@nutrio.com', 'driver@nutriofuel.com');
```

### Portals showing 404

Verify routes exist in `src/App.tsx`:
- `/admin` ✓
- `/partner` ✓
- `/driver` ✓

## Coverage

| Workflow | Tests | Portals | Priority |
|----------|-------|---------|----------|
| Order Lifecycle | 9 | 4 | ⭐ Critical |
| Customer Journey | 20 | 1 | High |
| Admin Management | 15 | 4 | High |
| Driver Delivery | 12 | 3 | Medium |
| Partner Onboarding | 11 | 2 | Medium |
| **Total** | **67** | **All** | **-** |

## CI/CD Integration

### GitHub Actions

```yaml
- name: Run Cross-Portal Tests
  run: npx playwright test e2e/cross-portal/
```

### Daily Schedule

```yaml
schedule:
  - cron: '0 2 * * *'  # Run at 2 AM daily
```

## Conclusion

These cross-portal tests verify that your **entire platform works together**. They catch integration issues that single-portal tests miss.

**Run them before every major release!**

---

## Quick Reference

```bash
# Run all cross-portal tests
npx playwright test e2e/cross-portal/

# Run with UI
npx playwright test e2e/cross-portal/ --headed

# Run specific workflow
npx playwright test e2e/cross-portal/order-lifecycle.spec.ts

# Debug failing test
npx playwright test e2e/cross-portal/order-lifecycle.spec.ts --debug

# View report
npx playwright show-report
```
