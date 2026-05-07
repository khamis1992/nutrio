# Nutrio Fuel — Fix Plan (Post E2E QA)

**Date:** March 20, 2026  
**Status:** Awaiting approval before execution

---

## 📊 Summary of All Problems

| Priority | Count | Description |
|----------|-------|-------------|
| 🔴 Critical | 3 | Blocking production launch |
| 🟠 High | 4 | Affects core user experience |
| 🟡 Medium | 5 | Quality and stability issues |
| 🔵 Low | 6 | Code hygiene and ESLint |

---

## 🔴 Phase 1 — Critical (Must fix before launch)

### P1-1: Add timeout to `isPartnerApproved` in ProtectedRoute
- **Problem:** The `isPartnerApproved()` DB call has no timeout. If the query hangs, partner pages get stuck in loading forever.
- **File:** `src/components/ProtectedRoute.tsx` line ~280
- **Fix:** Wrap the call in a `Promise.race()` with a 4-second timeout, same as the role check.
- **Effort:** Small (10 min)

### P1-2: Fix `emailSchema` not defined in forgot password handler
- **Problem:** `emailSchema` is used in `handleForgotSubmit()` but it's only declared at the component scope in the `validateForm()` function. Will throw a runtime error when user clicks "Forgot Password".
- **File:** `src/pages/Auth.tsx` line 246
- **Fix:** Move the `emailSchema` declaration to the module level (above the component), or re-declare it inside `handleForgotSubmit`.
- **Effort:** Tiny (5 min)

### P1-3: Fix React Hook called conditionally
- **Problem:** `useRolloverExpiryCountdown` is called after an early return — violates Rules of Hooks. This can cause a React crash in production.
- **File:** Somewhere in `src/` (from ESLint: `react-hooks/rules-of-hooks`)
- **Fix:** Move the hook call ABOVE the early return, or restructure the component.
- **Effort:** Small (15 min)

---

## 🟠 Phase 2 — High Priority (Fix within this sprint)

### P2-1: Apply Real-time Migration to Supabase
- **Problem:** `supabase/migrations/20260318_enable_realtime.sql` has been fixed locally but not pushed to the live Supabase instance. Real-time order updates won't work between roles.
- **Fix:** Run `npx supabase db push` to apply the migration to the remote database.
- **Effort:** Tiny (5 min, requires Supabase CLI access)

### P2-2: Clean up test data from database
- **Problem:** Test meals (e.g., "test50 test50") are still in the `meals` table in the database and could reappear if the `is_test` filter is bypassed.
- **Fix:** Run a SQL DELETE to remove all meals where `name ILIKE 'test%'` OR `is_test = true` from production database.
- **Effort:** Tiny (SQL one-liner)

### P2-3: Validate full order lifecycle manually
- **Problem:** The cross-portal workflow (Customer orders → Partner accepts → Driver delivers → Customer gets confirmation) has never been fully tested end-to-end with real accounts.
- **Fix:** Manual test using: customer (eng.aljabor@gmail.com) + partner (khamis4everever@gmail.com) + admin (khamis-1992@hotmail.com) + driver (driver@nutriofuel.com) simultaneously.
- **Effort:** Medium (1–2 hours of manual testing)

### P2-4: Create Sadad Payment Webhook Edge Function
- **Problem:** No webhook handler exists for Sadad payment callbacks. The simulation works, but real Sadad payment integration is broken.
- **File:** `supabase/functions/sadad-webhook/index.ts` (does not exist)
- **Fix:** Create a new Edge Function that receives Sadad's POST callback, verifies the signature, and updates the payment record + credits the wallet.
- **Effort:** Medium (1–2 hours)

---

## 🟡 Phase 3 — Medium Priority (Quality improvements)

### P3-1: Fix duplicate Navigation aria-label
- **Problem:** Two `<nav>` elements have the same `aria-label="Main navigation"`. Accessibility issue (screen readers read it twice).
- **File:** `src/components/CustomerNavigation.tsx`
- **Fix:** Change one to `aria-label="Bottom navigation"` or remove the duplicate render.
- **Effort:** Tiny (5 min)

### P3-2: Fix nav badge count mismatch (8 vs 7 Schedule)
- **Problem:** Two navigation instances show different schedule counts on the Dashboard.
- **File:** `src/components/CustomerNavigation.tsx` + `src/pages/Dashboard.tsx`
- **Fix:** Trace where the count comes from and ensure only ONE `<CustomerNavigation>` is rendered per page.
- **Effort:** Small (20 min)

### P3-3: Fix "No Branches Found" warning in Partner Dashboard
- **Problem:** Partner Dashboard shows a warning about branches. This is confusing for partners.
- **File:** `src/pages/partner/PartnerDashboard.tsx`
- **Fix:** Either implement branches or hide the warning if it's not a used feature.
- **Effort:** Small (15 min)

### P3-4: Add drivers to database for admin testing
- **Problem:** `/admin/drivers` shows "Failed to load drivers" because the `drivers` table is empty.
- **Fix:** Either seed test driver data or adjust the empty state UI to be more friendly.
- **Effort:** Small (15 min)

### P3-5: Fix `@ts-ignore` usage (use `@ts-expect-error` instead)
- **Problem:** ESLint warns about `@ts-ignore` comments that should be `@ts-expect-error`.
- **Fix:** Simple text replacement.
- **Effort:** Tiny (5 min)

---

## 🔵 Phase 4 — Low Priority (Code hygiene)

### P4-1: Fix `prefer-const` errors (8+ instances)
- **Problem:** Variables declared with `let` that are never reassigned. ESLint `prefer-const` errors.
- **Files:** Multiple files across `src/pages/` and `src/components/`
- **Fix:** Auto-fix with `npx eslint src --ext .ts,.tsx --fix --rule "prefer-const: error"`
- **Effort:** Tiny (auto-fix)

### P4-2: Fix `no-empty` blocks (2 instances)
- **Problem:** Empty `catch` or block statements in code.
- **Fix:** Add a comment or throw the error.
- **Effort:** Tiny (5 min)

### P4-3: Fix Playwright test selectors
- **Problem:** E2E tests still use `input#email` in some files instead of `input#si-email`.
- **Files:** `e2e/admin/auth.spec.ts`, `e2e/roles/customer-auth.spec.ts`
- **Fix:** Update selectors.
- **Effort:** Small (20 min)

### P4-4: Fix Playwright fixture variable bug
- **Problem:** `e2e/fixtures/test.ts` line 31 uses `page` instead of `authenticatedAdminPage`.
- **Fix:** Rename the variable in the assertion.
- **Effort:** Tiny (2 min)

### P4-5: Remove unused variables in Auth.tsx
- **Problem:** `isRTL`, `setName`, `forgotSent`, `handleSocialLogin` are declared but never used.
- **File:** `src/pages/Auth.tsx`
- **Fix:** Remove unused destructuring.
- **Effort:** Tiny (5 min)

### P4-6: Replace `any` types with proper types (567 ESLint errors)
- **Problem:** 567 `@typescript-eslint/no-explicit-any` errors across the codebase.
- **Note:** Most are non-critical (Supabase response types). Fix progressively.
- **Fix:** Replace common patterns like `(err: any)` with `(err: unknown)` or proper typed interfaces.
- **Effort:** Large (3–4 hours, can be done incrementally)

---

## 📅 Suggested Execution Order

```
Day 1 (Today):
  ✅ P1-1 — ProtectedRoute isPartnerApproved timeout
  ✅ P1-2 — emailSchema fix in Auth.tsx
  ✅ P1-3 — Hook called conditionally fix
  ✅ P2-1 — Apply realtime migration (npx supabase db push)
  ✅ P2-2 — Clean test data from database
  ✅ P3-1 — Fix duplicate nav aria-label
  ✅ P3-2 — Fix nav badge count
  ✅ P3-5 — Fix @ts-ignore → @ts-expect-error

Day 2:
  ✅ P2-3 — Full order lifecycle manual test
  ✅ P2-4 — Sadad webhook Edge Function
  ✅ P3-3 — Fix Partner "No Branches Found"
  ✅ P3-4 — Seed driver data or fix empty state
  ✅ P4-1 — Fix prefer-const (auto-fix)
  ✅ P4-2 — Fix no-empty blocks
  ✅ P4-3 — Fix Playwright selectors
  ✅ P4-4 — Fix Playwright fixture
  ✅ P4-5 — Remove unused Auth.tsx variables

Day 3+:
  ✅ P4-6 — Progressive any → proper types (can be done in background)
```

---

## Review Section

*(To be filled after execution)*

---

## Quick Task Plan — Move "Review Order" Button Up

**Date:** April 25, 2026  
**Status:** Awaiting user approval before execution

- [ ] Locate and confirm the exact fixed bottom button container in `src/components/MealWizard.tsx`
- [ ] Apply the smallest possible spacing change to move the button upward (likely by increasing the fixed container's bottom offset)
- [ ] Run a quick lint check for the edited file and ensure no new issues were introduced
- [ ] Update this review section with what changed and why

## Review Section (Quick Task)

- [x] Locate and confirm the exact fixed bottom button container in `src/components/MealWizard.tsx`
- [x] Apply the smallest possible spacing change to move the button upward (likely by increasing the fixed container's bottom offset)
- [x] Run a quick lint check for the edited file and ensure no new issues were introduced
- [x] Update this review section with what changed and why

### Review Notes

- Updated only one class in `src/components/MealWizard.tsx` for the specific fixed container that renders `Review Order ({...} meal...)` when meals are selected.
- Changed `bottom-0` to `bottom-4` so the button sits slightly above the bottom edge while keeping all existing styling/behavior intact.
- Scope kept intentionally minimal to avoid affecting other fixed bottom actions in the wizard.
- Lint check run on edited files after change.
- Follow-up adjustment: changed `bottom-4` to `bottom-8` to move the button higher per request, without altering any other styles or behavior.
- Follow-up adjustment: changed `bottom-8` to `bottom-12` to move it higher again while keeping the same fixed layout behavior.
- Follow-up adjustment: changed `bottom-12` to `bottom-16` to move the button higher once more with no other UI changes.
- Additional follow-up: in `src/pages/Schedule.tsx`, increased bottom sheet content padding (`paddingBottom`) to ensure `Remove from Schedule` remains visible above device dock/safe-area overlays.
- Final follow-up: increased `paddingBottom` floor from `96px` to `112px` in `src/pages/Schedule.tsx` for extra clearance above the dock.
- Direct visibility fix: moved the meal detail bottom sheet itself up from screen bottom using `style={{ bottom: "max(24px, env(safe-area-inset-bottom))" }}` so action buttons clear dock overlays even when inner padding changes are not enough.

---

## Quick Task Plan — Remove Header "Customer" Role Indicator

**Date:** April 26, 2026  
**Status:** Awaiting user approval before execution

- [x] Confirm the exact `RoleIndicator` usage in the dashboard header that renders the "Customer" label
- [x] Remove only that `RoleIndicator` render from `src/pages/Dashboard.tsx` with the smallest possible change
- [x] Run a quick lint check for the edited file to ensure no new issues were introduced
- [x] Add a short review note in this file summarizing what changed

## Review Section (Role Indicator Removal)

### Review Notes

- Removed the single dashboard header render `!hasRestaurant && <RoleIndicator role="customer" />` from `src/pages/Dashboard.tsx` so the "Customer" label no longer appears.
- Removed the now-unused `RoleIndicator` import from the same file.
- Kept the change intentionally minimal: no other header elements or layout logic were changed.
- Ran `npx eslint src/pages/Dashboard.tsx` and confirmed it passes for this edit.

---

## Quick Task Plan — Change Apple Icon Color

**Date:** April 26, 2026  
**Status:** Awaiting user approval before execution

- [ ] Confirm the exact `Apple` icon instance and current Tailwind color class in `src/components/DailyNutritionCard.tsx`
- [ ] Change only that icon color class to the requested color using the smallest possible edit
- [ ] Run a quick lint check for the edited file to ensure no new issues were introduced
- [ ] Add a short review note in this file summarizing the icon color update

---

## Quick Task Plan — Fix Stuck Subscription Badge Count

**Date:** April 26, 2026  
**Status:** Awaiting user approval before execution

- [ ] Confirm the Dashboard header badge source (`remainingMeals + rolloverCredits`) and identify why it stays stale after meal changes
- [ ] Add the smallest safe refresh path so Dashboard refetches subscription/rollover data when meal progress changes
- [ ] Run a quick lint check on edited files to ensure no new issues were introduced
- [ ] Add a short review note in this file summarizing the fix and files touched
