# E2E Test Infrastructure — Handoff Document

**Date:** 2026-06-25
**Status:** Foundation complete, test suites written, ready for verification run

---

## What Was Done

### Phase 1: Foundation (Tasks 1–18)

| Task | Status | Details |
|------|--------|---------|
| data-testid injection | ✅ | 33 of 63 page files now have `data-testid` attributes on all interactive elements (back buttons, CTAs, inputs, tabs, cards). Covers all auth pages, all core customer journey pages (Dashboard, Meals, Checkout, Wallet, Subscription, Schedule, Tracker, OrderHistory, Profile, Settings, Notifications, Favorites), and 20+ secondary pages (Addresses, Onboarding, ProgressRedesigned, RestaurantDetail, DeliveryTracking, MealDetail, Community, CoachesDirectory, Rewards, Affiliate, AIReport, BodyMetrics, WeightTracking, WaterTracker, Dietary, Support, CoachMessages, StepCounter, FriendLeaderboard, WalkthroughScreen, OrderDetail) |
| FormField testId prop | ✅ | `src/components/forms/FormField.tsx` passes `testId` prop through as `data-testid` |
| BASE_URL fix | ✅ | `helpers.ts` now uses `http://localhost:5173/nutrio`; README port corrected from 8080 to 5173 |
| Auth fixture (storageState) | ✅ | `e2e/auth.setup.ts` logs in once per role and saves storage state; `playwright.config.ts` has role-specific projects (`chromium`, `chromium-admin`, `chromium-partner`, `chromium-driver`, `mobile-chrome`) with `dependencies: ['setup']` |
| Route constants | ✅ | `e2e/utils/routes.ts` — 80+ route constants organized by portal |
| Seed infrastructure | ✅ | `e2e/utils/seed.ts` — `seedTestData()` and `cleanupTestData()` stubs |
| Page Object Models | ✅ | 6 POMs: `DashboardPage`, `MealsPage`, `CheckoutPage`, `TrackerPage`, `ProfilePage`, `SubscriptionPage` |

### Phase 2: Test Suites (Tasks 19–28)

| Suite | File | Tests | Selectors |
|-------|------|-------|-----------|
| Auth | `customer/auth.spec.ts` | 10 | data-testid |
| Dashboard | `customer/dashboard.spec.ts` | 10 | DashboardPage POM |
| Meals | `customer/meals.spec.ts` | 9 | MealsPage POM |
| Checkout | `customer/checkout.spec.ts` | 8 | CheckoutPage POM |
| Wallet | `customer/wallet.spec.ts` | 3 | data-testid |
| Subscription | `customer/subscription.spec.ts` | 5 | SubscriptionPage POM |
| Schedule | `customer/schedule.spec.ts` | 5 | data-testid |
| Tracker | `customer/tracker.spec.ts` | 9 | TrackerPage POM |
| Profile | `customer/profile.spec.ts` | 10 | ProfilePage POM |
| Order History | `customer/orders.spec.ts` | 5 | data-testid |
| Notifications | `customer/notifications.spec.ts` | 4 | data-testid |
| Favorites | `customer/favorites.spec.ts` | 4 | data-testid |
| Integration | `customer/integration.spec.ts` | 6 | POMs + data-testid |
| Security/RLS | `customer/security.spec.ts` | 7 | data-testid |
| UX Regression | `customer/ux-regression.spec.ts` | 10 | data-testid |

**Total: 105 tests across 15 spec files** (all using data-testid selectors or POMs)

### Phase 3: CI & Docs (Tasks 29–39)

| Task | Status | Details |
|------|--------|---------|
| CI pipeline | ✅ | `.github/workflows/ci-cd.yml` — added `e2e` job with Playwright, Supabase secrets, artifact upload |
| Handoff doc | ✅ | This document |

---

## Files Created/Modified

### New files (14)
- `e2e/auth.setup.ts` — storageState auth setup
- `e2e/utils/routes.ts` — route constants
- `e2e/utils/seed.ts` — test data seeding
- `e2e/pages/DashboardPage.ts` — POM
- `e2e/pages/MealsPage.ts` — POM
- `e2e/pages/CheckoutPage.ts` — POM
- `e2e/pages/TrackerPage.ts` — POM
- `e2e/pages/ProfilePage.ts` — POM
- `e2e/pages/SubscriptionPage.ts` — POM
- `e2e/customer/security.spec.ts` — security/RLS tests
- `e2e/customer/ux-regression.spec.ts` — UX regression tests
- `e2e/customer/favorites.spec.ts` — favorites tests
- `e2e/customer/tracker.spec.ts` — tracker tests
- `e2e/HANDOFF.md` — this document

### Modified files (30+)
- `playwright.config.ts` — added setup project, role-specific projects, storageState
- `e2e/utils/helpers.ts` — fixed BASE_URL
- `e2e/README.md` — fixed port reference
- `.github/workflows/ci-cd.yml` — added E2E job
- `e2e/customer/auth.spec.ts` — rewritten with data-testid
- `e2e/customer/dashboard.spec.ts` — rewritten with POM
- `e2e/customer/meals.spec.ts` — rewritten with POM
- `e2e/customer/checkout.spec.ts` — rewritten with POM
- `e2e/customer/wallet.spec.ts` — rewritten with data-testid
- `e2e/customer/subscription.spec.ts` — rewritten with POM
- `e2e/customer/schedule.spec.ts` — rewritten with data-testid
- `e2e/customer/profile.spec.ts` — rewritten with POM
- `e2e/customer/orders.spec.ts` — rewritten with data-testid
- `e2e/customer/notifications.spec.ts` — rewritten with data-testid
- `e2e/customer/integration.spec.ts` — rewritten with POMs + data-testid
- 33 page files with data-testid injection

---

## How to Run

```bash
npm run dev

npx playwright test --project=chromium

npx playwright test --project=chromium --headed

npx playwright test --project=chromium customer/auth.spec.ts

npx playwright show-report
```

---

## Remaining Work

### Before go-live
1. **Run the test suite** against a live dev server to verify all selectors match
2. **Implement Supabase RPC functions** for `seed_e2e_test_data` and `cleanup_e2e_test_data`
3. **Add Supabase secrets** to GitHub (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`)
4. **Delete stale auto-generated specs** (16 files still using old fixture pattern: `addresses.spec.ts`, `affiliate.spec.ts`, `ai.spec.ts`, `billing.spec.ts`, `gamification.spec.ts`, `mobile.spec.ts`, `onboarding.spec.ts`, `progress.spec.ts`, `referral.spec.ts`, `settings.spec.ts`, `static.spec.ts`, `support.spec.ts`, `auth-fixed.spec.ts`)

### Nice to have
5. Add data-testid to remaining 30 static/info pages (About, Terms, Privacy, Policies, FAQ, Contact, NotFound, Index, etc.)
6. Write test suites for secondary pages (Addresses, Onboarding, Progress, Rewards, Community, Coaches, Recipes, MealPlan, etc.)
7. Add visual regression testing (Playwright screenshot comparison)
8. Add performance budget tests (Lighthouse CI)
9. Add mobile-specific tests (Capacitor bridge, touch gestures, offline mode)

---

## Key Decisions

- **Naming convention**: `{page}-{element-description}` in kebab-case (e.g., `tracker-tab-today`)
- **Selector strategy**: data-testid for all interactive elements; POMs for page-level abstraction
- **Auth strategy**: storageState-based (one login per role, reused across all tests) — eliminates per-test login overhead
- **Test organization**: one spec file per page/feature; integration specs for cross-page flows
- **CI**: E2E job runs after quality gate (lint + typecheck), uses Playwright chromium project
