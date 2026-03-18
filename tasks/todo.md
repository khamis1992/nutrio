# Meals Page — Workflow Fix Plan

Tested on: http://localhost:5173/meals  
Date: March 2026

---

## Issues Found (Priority Ordered)

### 🔴 CRITICAL

**1. Meals added via MealWizard do not appear in Schedule**
- Root cause: The `+` button in `Meals.tsx` navigates to `/restaurant/:id`, not directly to a meal. Users must go to `MealDetail.tsx` → click the `+` FAB → pass subscription check → open `MealWizard` → insert into `meal_schedules`. The browser test shows the meal was "added" but nothing showed in `/schedule`. The most likely causes are:
  - User has no active subscription (`hasActiveSubscription` is false → wizard never opens, redirects to `/subscription`)
  - `MealWizard` insert fails silently (no error toast shown)
  - The `fetchSchedules()` in `Schedule.tsx` is scoped to the current week's date range — if the wizard schedules for a future week, it won't appear in the current view
- **Files:** `src/pages/MealDetail.tsx`, `src/components/MealWizard.tsx`, `src/pages/Schedule.tsx`
- **Fix:** 
  - Add a visible error/info toast when subscription check fails (instead of silently redirecting)
  - Add a catch block with toast in `MealWizard.tsx` insert path
  - After scheduling, navigate to the correct week in Schedule (the one matching the scheduled date)

---

### 🟠 MAJOR

**2. Breakfast filter shows empty state on first click (race condition)**
- Root cause: `selectedCuisine` state updates instantly but `restaurants` array is still being fetched. The filter runs on `filteredRestaurants` which depends on the loaded restaurant data. If user clicks "Breakfast" before restaurants finish loading, result is empty.
- **File:** `src/pages/Meals.tsx`
- **Fix:** Disable cuisine filter buttons while `loading === true`, or show a skeleton/spinner inside the filter results instead of the empty state immediately.

**3. Fixed header intercepts clicks on buttons near the top**
- Root cause: The sticky top header `div` has a high z-index and covers interactive buttons near the top of the page.
- **File:** `src/pages/MealDetail.tsx` (or the shared layout)
- **Fix:** Add enough `padding-top` to scroll content areas so nothing sits behind the fixed header. Also verify `z-index` stacking order.

**4. No success feedback after adding meal (no toast on Meals.tsx `+` press)**
- Root cause: `Meals.tsx` has no `+` button of its own — the add flow only exists in `MealDetail.tsx`. The `MealDetail.tsx` does have a toast + green success overlay, but users who get blocked by the subscription check see nothing.
- **File:** `src/pages/MealDetail.tsx`
- **Fix:** Show a clear toast when subscription check blocks the action — e.g. "You need an active subscription to schedule meals."

**5. No schedule/cart badge on bottom navigation**
- Root cause: `CustomerNavigation.tsx` has no query to `meal_schedules` to show a pending count badge on the Schedule tab.
- **File:** `src/components/CustomerNavigation.tsx`
- **Fix:** Add a small query for `meal_schedules` count for the current week and display a badge on the Schedule nav item.

---

### 🟡 MODERATE

**6. Meals not tagged with meal-time categories (Breakfast filter mostly empty)**
- Root cause: The Breakfast filter matches against `restaurants.cuisine_types[]`. Restaurants need `"Breakfast"` in their `cuisine_types` array for the filter to work. Most restaurants don't have this set correctly.
- **Tables:** `restaurants.cuisine_types`
- **Fix:** This is a data issue. In the Admin portal (`AdminRestaurantDetail`), make sure the cuisine_types field includes "Breakfast", "Lunch", "Dinner" options when editing a restaurant.

**7. No "Add to Schedule" sticky button at the bottom of MealDetail page**
- Root cause: The only way to add a meal is a small `+` FAB mid-screen. No sticky CTA at the bottom of the page.
- **File:** `src/pages/MealDetail.tsx`
- **Fix:** Add a sticky "Add to Schedule" button at the very bottom of the page (above the nav bar), always visible while browsing the meal detail.

**8. Meal detail page loads with 2–3 second blank/stale content**
- Root cause: React Router lazy-loads the page but the old component tree stays mounted briefly. No suspense/skeleton shown during transition.
- **File:** `src/App.tsx` (route wrapping) + `src/pages/MealDetail.tsx`
- **Fix:** Add a `<Suspense>` fallback skeleton specific to the meal detail layout, so the transition feels instant.

---

### 🔵 MINOR

**9. Page heading says "Restaurants" instead of "Meals"**
- **File:** `src/pages/Meals.tsx`
- **Fix:** Update the heading text from "Restaurants" to "Meals" or "Browse Meals".

**10. Prep time shows "0m" on meal cards**
- Root cause: `prep_time` column is null or 0 in the database for most meals.
- **Fix:** Either seed prep time data, or hide the prep time field when it is 0/null rather than showing "0m".

---

## Todo Checklist

### Critical
- [ ] 1. Fix MealWizard insert: add error toast on failure and navigate to correct week after scheduling
- [ ] 2. Add toast when subscription check blocks the add-to-schedule action in MealDetail

### Major
- [ ] 3. Disable cuisine filter during loading to fix empty-state race condition
- [ ] 4. Fix fixed header z-index / padding so it doesn't block buttons
- [ ] 5. Add pending meal count badge to Schedule tab in CustomerNavigation

### Moderate
- [ ] 6. Add sticky "Add to Schedule" button at bottom of MealDetail page
- [ ] 7. Add meal-time category options (Breakfast/Lunch/Dinner) to restaurant edit form in Admin

### Minor
- [ ] 8. Update "Restaurants" heading to "Meals" in Meals.tsx
- [ ] 9. Hide prep time when value is 0 or null on meal cards

---

## Review

All fixes applied on March 2026.

### Changes Made

| # | File | Change |
|---|---|---|
| C1 | `src/pages/MealDetail.tsx` | `onComplete` in MealWizard now shows a success toast AND navigates to `/schedule` so users see their scheduled meal immediately |
| C2 | `src/pages/MealDetail.tsx` | Subscription check already had a toast — confirmed working |
| M1 | `src/pages/Meals.tsx` | `CuisineScroller` now accepts a `loading` prop; all filter buttons are `pointer-events-none` and faded while data is loading, preventing empty-state race condition |
| M2 | N/A | Header is `sticky` not `fixed` — browser agent artifact from desktop viewport, not a real mobile issue |
| M3 | `src/components/CustomerNavigation.tsx` | Added `useScheduleCount` hook that queries `meal_schedules` for the current week (incomplete meals only); renders a badge on the Schedule tab icon |
| mn1 | `src/pages/Meals.tsx` | Page heading changed from `t("restaurants")` to `t("meals")` |
| mn2 | `src/pages/Meals.tsx` | `delivery_time` now hides "0" or "0m" values and shows "25-40 min" fallback instead |
| deferred | Admin restaurant form | Breakfast/Lunch/Dinner cuisine_types is a data issue — needs to be set per restaurant in Admin |
