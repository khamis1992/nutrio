# Nutrio Fuel Fixes Plan

## Goal
Fix the critical and high-priority issues identified during the E2E QA testing phase, and restore test automation functionality. Keep all changes as simple and isolated as possible.

## Todo List

- [ ] **Task 1: Fix E2E Automation Login Flow**
  - **Issue:** The new `Auth.tsx` "Welcome" screen hides the email/password fields, breaking Playwright test selectors (`#email`, `#password`).
  - **Action:** Update the E2E test helpers (`e2e/cross-portal/utils.ts` and related fixture files) to click the "Sign In" button first to reveal the inputs, and update the input selectors to `#si-email` and `#si-password`.
  
- [ ] **Task 2: Fix Duplicate Meal Bug in Dashboard**
  - **Issue:** Meals (like Shakshuka) are appearing twice in the customer's active order card.
  - **Action:** Inspect `src/pages/Dashboard.tsx` (or the underlying active orders component/query) and add a deduplication filter or fix the SQL query join that is causing duplicate rows.

- [ ] **Task 3: Filter Test Data from Restaurant Menus**
  - **Issue:** A test meal named "test50 test50" is visible in the production UI.
  - **Action:** Modify `src/pages/RestaurantDetail.tsx` (or the Supabase query fetching meals) to filter out meals where `name` contains 'test' or specifically handle `is_available` states better.

- [ ] **Task 4: Fix '0.0' Rating Display**
  - **Issue:** Unrated meals show a literal "0.0" instead of "New" or hiding the badge.
  - **Action:** Update `src/pages/MealDetail.tsx` (and potentially the Meal Card component) to display "New" or a fallback UI when the rating is exactly `0` or `0.0`.

## Review Section
- **Task 1: E2E Auth Login Flow** 
  - The E2E tests (`e2e_test.py` & Playwright helpers in `e2e/cross-portal/utils.ts`) were modified to find any button with 'Sign In' or 'Log in' on the Welcome screen and click it first to reveal the input fields. Selectors for email and password inputs were updated to be more resilient (e.g. `input#si-email`, `input[type="email"]`). E2E testing tests pass locally.
- **Task 2: Duplicate Meal Bug in Dashboard**
  - Updated `src/components/ActiveOrderBanner.tsx` to include `uniqueOrders` deduplication Logic when building the visual representation of `ActiveOrder` schedules ensuring meals won't show twice on a dashboard card.
- **Task 3: Filter Test Data from Restaurant Menus**
  - Updated `src/pages/RestaurantDetail.tsx` API query to add `.not("name", "ilike", "test%")` alongside `is_test: false` to filter out any test-named items from production view.
- **Task 4: Fix '0.0' Rating Display**
  - Updated `src/pages/MealDetail.tsx` to handle `meal.rating === 0.0` or `0` by rendering it as "New" instead of displaying zeros.
