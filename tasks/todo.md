# Fix: Cancel Order Not Persisting After Refresh

## Root Cause Analysis
The cancel IS working correctly (DB confirms cancelled records with today's timestamps).
The "order returning" happens because:
1. User has 15+ pending scheduled meals (subscription queue)
2. Dashboard was using .limit(3) — only showed 3 at a time
3. Cancel one order ? next one from queue slid in (same restaurant/meal)
4. User sees same meal/restaurant again and thinks cancel failed

## Fix Plan

- [x] 1. Fix ActiveOrderBanner.tsx etchActiveOrders to not use .limit(3) - show all active orders
- [x] 2. After successful cancel, call etchActiveOrders() from DB instead of just filtering local state

## Changes Made

### src/components/ActiveOrderBanner.tsx
1. Removed .limit(3) from etchActiveOrders query — now fetches ALL active meal schedules
2. After cancel success, calls wait fetchActiveOrders() to re-sync with DB (instead of optimistic local filter)

## Review

**Bug confirmed via browser testing:**
- Before fix: Cancel order ? order disappears from UI ? refresh ? same restaurant card reappears (because a different order with same meal slid in from queue)
- The cancel_meal_schedule RPC was working correctly all along — DB showed cancelled records
- The issue was purely UX: .limit(3) hid the true queue depth, and after cancel the next queued order appeared

**After fix verified:**
- Cancel ? UI immediately re-syncs with DB (via fetchActiveOrders refetch)
- Refresh ? cancelled orders stay gone, no phantom reappearance
- All active orders are now shown (not artificially capped at 3)
