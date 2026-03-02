# Nutrio Fuel E2E Test Suite

Comprehensive Playwright E2E test suite covering all 927 test cases from the Excel test plan.

## 📊 Test Coverage

| Portal | Tests | Files |
|--------|-------|-------|
| Customer | 333 | 24 files |
| Admin | 201 | 22 files |
| Partner | 213 | 14 files |
| Driver | 94 | 9 files |
| System | 86 | 13 files |
| **TOTAL** | **927** | **82 files** |

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
npx playwright install chromium
```

### 2. Configure Environment
Create `.env` file:
```env
BASE_URL=http://localhost:8080
TEST_USER_EMAIL=khamis--1992@hotmail.com
TEST_USER_PASSWORD=Khamees1992#
```

### 3. Run Tests

```bash
# Run all tests
npx playwright test

# Run specific portal
npx playwright test customer
npx playwright test admin
npx playwright test partner
npx playwright test driver
npx playwright test system

# Run with UI
npx playwright test --ui

# Run headed (see browser)
npx playwright test --headed

# Run specific test file
npx playwright test customer/auth.spec.ts

# Run tests matching pattern
npx playwright test --grep "TC001"

# Run critical priority tests only
npx playwright test --grep "Critical"
```

## 📁 Directory Structure

```
e2e/
├── fixtures/
│   └── test.ts              # Test fixtures (authenticated pages)
├── utils/
│   └── helpers.ts           # Test utilities
├── customer/                # 333 tests
│   ├── auth.spec.ts
│   ├── onboarding.spec.ts
│   ├── dashboard.spec.ts
│   ├── meals.spec.ts
│   └── ...
├── admin/                   # 201 tests
│   ├── auth.spec.ts
│   ├── users.spec.ts
│   ├── restaurants.spec.ts
│   └── ...
├── partner/                 # 213 tests
│   ├── auth.spec.ts
│   ├── menu.spec.ts
│   ├── orders.spec.ts
│   └── ...
├── driver/                  # 94 tests
│   ├── auth.spec.ts
│   ├── deliveries.spec.ts
│   └── ...
└── system/                  # 86 tests
    ├── security.spec.ts
    ├── payments.spec.ts
    └── ...
```

## 🧪 Test Implementation Guide

Each generated test file contains test stubs with:
- Test ID and description from Excel
- Priority level
- Feature category
- Navigation to URL
- Expected result documentation

### Implementing Test Steps

Replace `// TODO: Implement test steps` with actual Playwright code:

```typescript
test('TC001: Customer Login', async ({ authenticatedCustomerPage: page }) => {
  // TODO: Implement test steps
  
  // Example implementation:
  await expect(page.locator('h1')).toContainText('Dashboard');
  await page.click('[data-testid="user-menu"]');
  await expect(page.locator('[data-testid="user-email"]')).toContainText('user@example.com');
});
```

### Common Patterns

```typescript
// Click and navigate
await page.click('text=Submit Order');
await expect(page).toHaveURL(/.*checkout.*/);

// Fill form
await page.fill('input[name="email"]', 'test@example.com');
await page.fill('input[name="password"]', 'password123');

// Verify element visible
await expect(page.locator('.success-message')).toBeVisible();

// Verify text content
await expect(page.locator('body')).toContainText('Order placed successfully');

// Wait for network idle
await page.waitForLoadState('networkidle');
```

## 📝 Test Credentials

Update credentials in `e2e/utils/helpers.ts`:

```typescript
export const TEST_USERS = {
  customer: {
    email: 'your-email@example.com',
    password: 'your-password',
  },
  admin: {
    email: 'admin@nutrio.com',
    password: 'admin-password',
  },
  partner: {
    email: 'partner@nutrio.com',
    password: 'partner-password',
  },
  driver: {
    email: 'driver@nutriofuel.com',
    password: 'driver-password',
  },
};
```

## 📈 CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run dev &
      - run: npx playwright test
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

## 🐛 Debugging

```bash
# Run in debug mode
npx playwright test --debug

# Open last test trace
npx playwright show-trace test-results/trace.zip

# Generate report
npx playwright show-report
```

## 📋 Test Priority Legend

- **Critical**: Core functionality - must pass
- **High**: Important features - should pass
- **Medium**: Standard features - nice to have
- **Low**: Edge cases - can skip if needed

## 🔄 Regenerating Tests

If you update the Excel test plan, regenerate tests:

```bash
python e2e/generate_tests.py
```

## 📚 Resources

- [Playwright Docs](https://playwright.dev/docs/intro)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [Selectors Guide](https://playwright.dev/docs/selectors)
- [Assertions](https://playwright.dev/docs/test-assertions)

## 📞 Support

For issues or questions:
1. Check Playwright documentation
2. Review test implementation examples
3. Verify selectors match actual UI
4. Check browser console for errors
