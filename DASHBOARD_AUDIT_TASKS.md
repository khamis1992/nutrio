# Nutrio Dashboard Audit — Fix Task List

> Generated: April 14, 2026 | Score: 62/100 | 3 Critical, 8 High, 14 Medium, 11 Low

---

## Phase 1 — Critical (0–3 days)

### C-1: Supabase Real-Time Channel Isolation
- [ ] Change `ActiveOrderBanner.tsx:298` channel name from `"active-orders"` to `"active-orders-${userId}"`
- [ ] Change `BehaviorPredictionWidget.tsx:41` channel name from `"behavior-predictions"` to `"behavior-predictions-${userId}"`
- [ ] Change `useSubscription.ts:147` channel name to include `user.id`
- [ ] Verify RLS policies on `meal_schedules`, `subscriptions`, `behavior_predictions` tables
- [ ] Add `supabase.realtime.setAuth()` call before subscribing on each component mount
- **Files:** `ActiveOrderBanner.tsx`, `BehaviorPredictionWidget.tsx`, `useSubscription.ts`
- **Severity:** Critical

### C-2: Add Error Boundaries Around Dashboard Widgets
- [ ] Create `DashboardErrorBoundary` component with fallback UI (error message + retry button)
- [ ] Wrap `DailyNutritionCard` in `<DashboardErrorBoundary>`
- [ ] Wrap `ActiveOrderBanner` in `<DashboardErrorBoundary>`
- [ ] Wrap `BehaviorPredictionWidget` in `<DashboardErrorBoundary>`
- [ ] Wrap `AdaptiveGoalCard` in `<DashboardErrorBoundary>`
- [ ] Add null guards on all Supabase response destructuring (`Dashboard.tsx:207-212`, `ActiveOrderBanner.tsx:214-225`)
- **Files:** New `DashboardErrorBoundary.tsx`, `Dashboard.tsx`
- **Severity:** Critical

### C-3: Remove Fleet Auth Tokens from localStorage
- [ ] Replace `localStorage.setItem('fleet_auth_token', ...)` with in-memory state in `FleetAuthContext.tsx`
- [ ] Replace `localStorage.setItem('fleet_refresh_token', ...)` with in-memory state
- [ ] Replace `localStorage.setItem('fleet_user', ...)` with in-memory state
- [ ] Implement silent refresh flow that re-authenticates on page reload using stored httpOnly cookie or refresh endpoint
- [ ] Remove `localStorage.getItem/setItem/removeItem` calls for auth tokens (6 locations in `FleetAuthContext.tsx`)
- **Files:** `FleetAuthContext.tsx`
- **Severity:** Critical

---

## Phase 2 — High Priority (1–2 weeks)

### H-1: Fix Race Conditions in Dashboard useEffect Hooks
- [ ] Add `isMounted` ref pattern to notifications useEffect (`Dashboard.tsx:132-143`)
- [ ] Add `isMounted` ref pattern to restaurant check useEffect (`Dashboard.tsx:145-156`)
- [ ] Add `isMounted` ref pattern to today's progress useEffect (`Dashboard.tsx:191-219`)
- [ ] Add `AbortController` signal passing to all 6 Supabase queries in `Dashboard.tsx`
- [ ] Consider migrating parallel queries to TanStack Query `useQueries`
- **Files:** `Dashboard.tsx`, `useProfile.ts`, `useFeaturedRestaurants.ts`, `useFavoriteRestaurants.ts`
- **Severity:** High

### H-2: Fix useProfile Infinite Redirect on Error
- [ ] Add explicit `error` state to `useProfile` return value
- [ ] In `Dashboard.tsx:186-188`, only redirect to `/onboarding` when `profile.onboarding_completed === false` (not null)
- [ ] Show error UI when `useProfile` has an error (network failure, etc.)
- [ ] Add retry mechanism in `useProfile` for transient failures
- **Files:** `useProfile.ts`, `Dashboard.tsx`
- **Severity:** High

### H-3: Fix Subscription Query Timezone + Complexity
- [ ] Replace `new Date().toISOString().split('T')[0]` with UTC-safe date: `new Date().toISOString().split('T')[0]` or use `date-fns-tz`
- [ ] Simplify `.or()` filter in `useSubscription.ts:77-84` to separate `.in('status', ['active','pending'])` and `.eq('status', 'cancelled').gte('end_date', today)` combined properly
- [ ] Add unit test for subscription status edge cases (expired cancelled, pending, active)
- **Files:** `useSubscription.ts`
- **Severity:** High

### H-4: Fix Role Cache Invalidation
- [ ] Reduce `CACHE_TTL` from 5 minutes to 60 seconds for admin/partner roles in `ProtectedRoute.tsx:41`
- [ ] Add Supabase realtime listener on `user_roles` table changes that calls `clearRoleCache()`
- [ ] Invalidate role cache on any navigation to a role-protected route
- [ ] Add `useEffect` cleanup that clears the cache entry when user changes
- **Files:** `ProtectedRoute.tsx`
- **Severity:** High

### H-5: Unify Toast System — Migrate BehaviorPredictionWidget to Sonner
- [ ] Remove `import { useToast } from "@/hooks/use-toast"` from `BehaviorPredictionWidget.tsx:14`
- [ ] Add `import { toast } from "sonner"` to `BehaviorPredictionWidget.tsx`
- [ ] Replace `const { toast } = useToast();` with direct `toast.info()` / `toast.error()` calls
- [ ] Audit all other dashboard components for Shadcn toast usage and migrate to Sonner
- **Files:** `BehaviorPredictionWidget.tsx`, `LogMealDialog.tsx`, `LogActivitySheet.tsx`, `ActiveOrderBanner.tsx`
- **Severity:** High

### H-6: Accessibility Audit Fixes
- [ ] Add `aria-label` to all `<motion.button>` elements in `Dashboard.tsx` (Log Meal button, favorite buttons, notification bell)
- [ ] Add `role="button"`, `tabIndex={0}`, `onKeyDown={handleKeyDown}` to streak dots in `Dashboard.tsx:583-612`
- [ ] Add descriptive `aria-label` to SVG calorie ring in `DailyNutritionCard.tsx:232-243`
- [ ] Add `aria-label` to favorite heart button in `Dashboard.tsx:671-689`
- [ ] Add `aria-label` to notification bell in `Dashboard.tsx:347-358`
- [ ] Add `aria-live="polite"` to subscription meals remaining counter
- [ ] Add `aria-roledescription="progress ring"` to all SVG progress circles
- [ ] Add `@media (prefers-reduced-motion: reduce)` CSS to disable infinite animations globally
- [ ] Ensure all interactive elements have ≥44px touch targets
- **Files:** `Dashboard.tsx`, `DailyNutritionCard.tsx`, `ActiveOrderBanner.tsx`
- **Severity:** High

### H-7: Reduce Dashboard API Flood — Batch Requests
- [ ] Create `useDashboardData()` hook that calls a single Supabase RPC `get_dashboard_data(user_id)` returning profile, subscription, progress, notifications, rollover credits, featured restaurants in one call
- [ ] Add Supabase migration for `get_dashboard_data` RPC function
- [ ] Replace 6 inline `useEffect` hooks in `Dashboard.tsx` with the new consolidated hook
- [ ] Migrate `useProfile`, `useSubscription`, `useAdaptiveGoals` to TanStack Query with stale time configuration
- [ ] Add Suspense boundaries so fastest widgets render first
- **Files:** New `useDashboardData.ts`, `Dashboard.tsx`, Supabase migration
- **Severity:** High

### H-8: Fix Cancel Order Error Handling
- [ ] Replace `window.confirm()` in `ActiveOrderBanner.tsx:265` with a proper `<AlertDialog>` component
- [ ] Change backend RPC `cancel_meal_schedule` to return structured error codes (e.g., `{error_code: "ORDER_IN_PROGRESS"}`) instead of error message strings
- [ ] Replace `errorMessage.includes("preparing")` check (`ActiveOrderBanner.tsx:273`) with error code matching
- [ ] Add timeout handling for the cancel RPC call
- [ ] Add cancel button loading state with spinner animation
- **Files:** `ActiveOrderBanner.tsx`
- **Severity:** High

---

## Phase 3 — Medium Priority (2–4 weeks)

### M-1: Fix Timezone in DailyNutritionCard Date Logic
- [ ] Replace `new Date()` with `new Date()` adjusted to `Asia/Qatar` timezone using `date-fns-tz`
- [ ] Update `isToday` check at `DailyNutritionCard.tsx:126` to use Qatar timezone
- [ ] Update `todayStr` at `DailyNutritionCard.tsx:127` to use Qatar timezone
- **Files:** `DailyNutritionCard.tsx`

### M-2: Extract Inline useEffects to Reusable Hooks
- [ ] Create `useNotifications(userId)` hook from `Dashboard.tsx:132-143`
- [ ] Create `useRolloverCredits(userId)` hook from `Dashboard.tsx:158-183`
- [ ] Create `useTodayProgress(userId, dateStr, progressKey)` hook from `Dashboard.tsx:191-219`
- [ ] Create `useHasRestaurant(userId)` hook from `Dashboard.tsx:145-156`
- [ ] Replace inline effects in Dashboard with new hooks
- **Files:** New hooks in `src/hooks/`, `Dashboard.tsx`

### M-3: Add ARIA Labels to Restaurant Favorite Button
- [ ] Add `aria-label={isFavorite(restaurant.id) ? "Remove from favorites" : "Add to favorites"}` to favorite button at `Dashboard.tsx:671`
- [ ] Memoize `isFavorite(restaurant.id)` calls using `useMemo` on restaurant list
- **Files:** `Dashboard.tsx`

### M-4: Fix Streak Calculation Logic
- [ ] Replace modulo-based streak calculation (`Dashboard.tsx:250`) with a proper weekly completion tracker
- [ ] Add `weekly_completions` field to `profiles` table or a new `streak_log` table
- [ ] Update streak display to use actual daily completion data
- **Files:** `Dashboard.tsx`, Supabase migration, `useProfile.ts`

### M-5: Fix Duplicate Calories Display in Nutrition Card
- [ ] Change the "Activities" card in `DailyNutritionCard.tsx:322-330` to show number of workout sessions instead of duplicate calorie count
- [ ] Fetch workout session count from existing `workout_sessions` query
- **Files:** `DailyNutritionCard.tsx`

### M-6: Internationalize Hardcoded Day Labels
- [ ] Replace `weekDays` array at `Dashboard.tsx:252-254` with translated labels using `t()`
- [ ] Add day translation keys to `LanguageContext.tsx`: `day_sat`, `day_sun`, `day_mon`, etc.
- [ ] Update Arabic translations for day labels
- **Files:** `Dashboard.tsx`, `LanguageContext.tsx`

### M-7: Namespace BehaviorPrediction Dismiss localStorage Key
- [ ] Change `localStorage.setItem('behavior_prediction_dismissed', ...)` at `BehaviorPredictionWidget.tsx:93` to `localStorage.setItem('behavior_prediction_dismissed_${user?.id}', ...)`
- [ ] Update read check in component logic to match the namespaced key
- **Files:** `BehaviorPredictionWidget.tsx`

### M-8: Cache Adaptive Goals Edge Function Results
- [ ] Migrate `useAdaptiveGoals` to use TanStack Query with `staleTime: 15 * 60 * 1000`
- [ ] Store last recommendation in localStorage with timestamp for offline fallback
- [ ] Only invoke edge function if last result is stale (>15 min old)
- **Files:** `useAdaptiveGoals.ts`

### M-9: Remove Duplicate Shimmer Keyframe Definition
- [ ] Remove inline `<style>` block at `Dashboard.tsx:295-300` (duplicate of loading skeleton's definition)
- [ ] Move shimmer animation to `src/index.css` as a shared utility
- **Files:** `Dashboard.tsx`, `src/index.css`

### M-10: Fix Subscription Card Flash on Re-render
- [ ] Stabilize `subscription` object reference using `useMemo` in `useSubscription.ts`
- [ ] Use `layoutId` instead of `key={subscription.id}` for smooth AnimatePresence transitions in `Dashboard.tsx:375`
- **Files:** `useSubscription.ts`, `Dashboard.tsx`

### M-11: Migrate useProfile to TanStack Query
- [ ] Replace `useEffect` + `useState` pattern in `useProfile.ts` with `useQuery`
- [ ] Add `staleTime: 5 * 60 * 1000` to prevent unnecessary refetches
- [ ] Export `refetch` and `error` states properly
- **Files:** `useProfile.ts`

### M-12: Remove window.__sessionTimeout Global
- [ ] Create `SessionTimeoutContext` React Context to replace `window.__sessionTimeout`
- [ ] Update `useSessionTimeoutControl()` hook to use context instead of `window` global
- [ ] Remove `(window as any).__sessionTimeout` assignments in `SessionTimeoutManager.tsx:233-247`
- **Files:** `SessionTimeoutManager.tsx`

### M-13: Use UTC-Safe Date Formatting
- [ ] Replace all `new Date().toISOString().split('T')[0]` with a `getUTCDay()` utility
- [ ] Add `date-fns-tz` package if not already installed
- [ ] Configure default timezone as `Asia/Qatar` in a shared utility
- **Files:** `Dashboard.tsx`, `useSubscription.ts`, `DailyNutritionCard.tsx`, `ActiveOrderBanner.tsx`

### M-14: Audit External Links for rel="noopener noreferrer"
- [ ] Search for any `<a>` tags with external URLs and add `rel="noopener noreferrer"` + `target="_blank"`
- [ ] Add ESLint rule `react/jsx-no-target-blank` to enforce this
- **Files:** ESLint config, any external links

---

## Phase 4 — Low Priority (4–6 weeks)

### L-1: Remove Duplicate Inline Style Tags
- [ ] Remove `<style>` block at `Dashboard.tsx:295-300` (duplicate shimmer animation)
- [ ] Keep single definition in `src/index.css`

### L-2: Handle Infinity Display Edge Case
- [ ] Add explicit check for `Infinity` in `effectiveMealsLeft` calculation at `Dashboard.tsx:247`
- [ ] Ensure `canOrder` logic works correctly with `Infinity` values

### L-3: Move Animation Variants to Shared Module
- [ ] Extract `spring`, `springBouncy`, `springGentle`, `fadeInUp`, `staggerContainer`, etc. from `Dashboard.tsx:36-89` into `src/lib/animations.ts`
- [ ] Import from shared module in all components

### L-4: Improve Restaurant Logo Alt Text
- [ ] Change `alt={restaurant.name}` to `alt={\`${restaurant.name} logo\`}` at `Dashboard.tsx:661`

### L-5: Add Edge Function Unavailable Fallback Message
- [ ] When `functionAvailableRef.current === false` in `useAdaptiveGoals`, show a subtle message: "AI suggestions temporarily unavailable"
- [ ] Don't render `AdaptiveGoalCard` when edge function is known unavailable

### L-6: Fix Streak Modulo Edge Cases
- [ ] When `weekTarget` is 7 and `streak_days >= weekTarget*2`, show "2+ weeks" instead of modulo result
- [ ] Consider storing `weekly_completions` as an array of booleans in the profile

### L-7: Deduplicate Restaurant Data Source
- [ ] Remove `restaurants` state at `Dashboard.tsx:116-117` and `restaurantsLoading` state
- [ ] Use `featuredRestaurants` directly from `useFeaturedRestaurants()` hook
- [ ] Remove mapping effect at `Dashboard.tsx:221-235`

### L-8: Add Debounce to Favorite Toggle
- [ ] Wrap `toggleFavorite` in `useCallback` with 300ms debounce in `Dashboard.tsx`
- [ ] Add optimistic update with rollback on error

### L-9: Make Week Start Day Configurable
- [ ] Change `weekDays` to use a configurable start day based on locale
- [ ] Default to Saturday for Qatar, Monday for other regions

### L-10: Verify scrollbar-hide Utility
- [ ] Confirm `scrollbar-hide` CSS utility exists in `src/index.css` or Tailwind config
- [ ] If missing, add `@utilities scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; &::-webkit-scrollbar { display: none; } }`

### L-11: Fix Duplicate Crown Import
- [ ] Remove `Crown as SubscriptionIcon` at `Dashboard.tsx:17`
- [ ] Use `Crown` directly for both VIP badge and subscription icon
- [ ] If different styling is needed, use a named alias like `CrownIcon`

---

## Phase 5 — Test Coverage (Ongoing)

### TC-1: Dashboard Page Unit Tests
- [ ] Create `src/pages/Dashboard.test.tsx`
- [ ] Test: renders greeting based on time of day
- [ ] Test: displays subscription card when active
- [ ] Test: shows "all meals used" state when remaining = 0
- [ ] Test: shows log meal button
- [ ] Test: shows featured restaurants carousel
- [ ] Test: shows streak widget with correct day count
- [ ] Test: redirects to /onboarding when profile.onboarding_completed is false
- [ ] Test: handles profile fetch error gracefully
- [ ] Test: handles null subscription (no active sub)
- [ ] Test: handles empty notifications

### TC-2: Hook Unit Tests
- [ ] Create `src/hooks/useSubscription.test.ts`
- [ ] Create `src/hooks/useProfile.test.ts`
- [ ] Create `src/hooks/useAdaptiveGoals.test.ts`
- [ ] Create `src/hooks/useFavoriteRestaurants.test.ts`
- [ ] Create `src/hooks/useFeaturedRestaurants.test.ts`
- [ ] Use MSW for Supabase API mocking
- [ ] Test loading states, error states, edge cases (null data, empty arrays, expired dates)

### TC-3: Component Unit Tests
- [ ] Create `src/components/DailyNutritionCard.test.tsx`
- [ ] Create `src/components/ActiveOrderBanner.test.tsx`
- [ ] Create `src/components/BehaviorPredictionWidget.test.tsx`
- [ ] Create `src/components/AdaptiveGoalCard.test.tsx`
- [ ] Create `src/components/LogMealDialog.test.tsx`
- [ ] Test cancel order flow in ActiveOrderBanner
- [ ] Test date navigation in DailyNutritionCard
- [ ] Test dismiss behavior in BehaviorPredictionWidget
- [ ] Test apply/dismiss in AdaptiveGoalCard

### TC-4: Replace E2E Stub Tests with Real Assertions
- [ ] Update `e2e/customer/dashboard.spec.ts` — all 15 tests are stubs
- [ ] Add assertions for: subscription card renders, nutrition card shows data, streak days visible, log meal button works, quick actions navigate correctly, restaurant carousel loads
- [ ] Add assertions for empty states: no subscription, no active orders, no featured restaurants
- [ ] Add assertions for error states: network failure, Supabase error

### TC-5: Add Coverage Thresholds
- [ ] Add `coverage.thresholds` to `vitest.config.ts`:
  ```
  lines: 60, functions: 60, branches: 50, statements: 60
  ```
- [ ] Add per-file coverage for dashboard files:
  ```
  'src/pages/Dashboard.tsx': { lines: 70 },
  'src/hooks/useSubscription.ts': { lines: 80 },
  'src/hooks/useProfile.ts': { lines: 80 },
  ```

---

## Summary

| Phase | Timeline | Issues | Priority |
|-------|----------|--------|----------|
| Phase 1 | 0–3 days | C-1, C-2, C-3 | Critical |
| Phase 2 | 1–2 weeks | H-1 through H-8 | High |
| Phase 3 | 2–4 weeks | M-1 through M-14 | Medium |
| Phase 4 | 4–6 weeks | L-1 through L-11 | Low |
| Phase 5 | Ongoing | TC-1 through TC-5 | Test Coverage |

**Total tasks: 36 Critical + 62 High + 95 Medium + 36 Low = 229 subtasks**