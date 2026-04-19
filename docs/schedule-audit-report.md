# Schedule Page — Complete Reverse-Flow Validation & Logic Audit Report

**Date:** 2026-04-16  
**Scope:** Customer app `/nutrio/schedule` — forward flow, reverse flow, dependencies, edge cases  
**Auditor:** Senior QA Engineer / Systems Analyst  
**Status:** Complete

---

## Executive Summary

The Nutrio Fuel Schedule page (`/nutrio/schedule`) is the central hub for customer meal scheduling. After deep inspection of 40+ files spanning frontend components, Supabase RPC functions, database triggers, and all four portal views, I identified **7 critical bugs, 5 major logic inconsistencies, 12 missing reverse-case handlers, and 4 security/permission concerns**. The most severe issues are: no rollback on partial creation failures, cancelled orders inflating revenue across all portals, and admin cancellations bypassing all business logic.

---

## 1. FORWARD WORKFLOW AUDIT

### 1.1 Meal Scheduling Creation Flow

| Step | Component | Status | Notes |
|------|-----------|--------|-------|
| Auth check | `Schedule.tsx:197` | OK | Redirects to onboarding |
| Feature flag | `Schedule.tsx:486-518` | OK | Shows warning if `meal_scheduling` disabled |
| Quota check | `MealWizard.tsx:618-646` | **BUG** | Checks `remainingMeals` before creation but increments **before** insert — no rollback if insert fails |
| Meal insert | `MealWizard.tsx:648` | OK | Batch `INSERT` into `meal_schedules` |
| Add-on wallet debit | `MealWizard.tsx:656-687` | **CRITICAL BUG** | On debit failure, silently continues — add-ons inserted without payment |
| Quota increment | `MealWizard.tsx:631-645` | **BUG** | Increments in a loop per meal — if meal #2 of 3 fails, meal #1's quota is consumed with no schedule |
| Notification | `MealDetail.tsx:1101-1119` | OK | Creates `meal_scheduled` notification |
| Delivery job creation | Created by trigger | OK | `on_meal_schedule_confirmed` trigger when `order_status` → `confirmed` |

### 1.2 UI States Verification

| State | Visual | Component | Status |
|-------|--------|-----------|--------|
| Empty slot | Swipeable card with `+` icon | `Schedule.tsx:822-963` | OK |
| Scheduled | Meal card with check toggle | `Schedule.tsx:754-819` | OK |
| Completed | Green check, strikethrough name | `Schedule.tsx:803-815` | OK |
| No quota remaining | "Buy Credits" button | `Schedule.tsx:701-709` | OK |
| Feature disabled | Warning with redirect | `Schedule.tsx:486-518` | OK |
| Loading | Spinner | `Schedule.tsx:715-718` | OK |

### 1.3 Database Writes

| Operation | Table | Method | Atomic? |
|-----------|-------|--------|---------|
| Create schedule | `meal_schedules` | Direct INSERT | No (multiple steps) |
| Create add-ons | `schedule_addons` | Direct INSERT after schedule | No (separate transaction) |
| Debit wallet (add-ons) | `customer_wallets` + `wallet_transactions` | `debit_wallet` RPC | Yes (single function) |
| Increment meal quota | `subscriptions` | `increment_monthly_meal_usage` RPC | Yes (single function) |
| Create notification | `notifications` | Direct INSERT | No (best-effort in MealDetail) |

### 1.4 Forward Flow — Critical Gaps

1. **No atomicity between quota increment and schedule creation.** `incrementMealUsage()` is called in a loop *before* `meal_schedules` INSERT. If the INSERT fails, quota is consumed but no schedule exists.
2. **No atomicity between schedule creation and add-on wallet debit.** If wallet debit fails for add-ons, `schedule_addons` rows are still inserted.
3. **No transaction wrapper.** Each operation is a separate Supabase call — there is no rollback mechanism if any step fails.

---

## 2. REVERSE / BACKWARD WORKFLOW AUDIT

### 2.1 Cancellation After Creation — `cancel_meal_schedule` RPC

The latest version (`20260413000001`) handles:

| Step | Action | Status |
|------|--------|--------|
| Auth check | `user_id = auth.uid()` | OK |
| Status guard | Only `pending`/`confirmed` | OK |
| Active delivery check | Blocks cancel if driver active | OK |
| Delivery queue cleanup | Deletes queued entries | OK |
| Set `order_status = 'cancelled'` | Updates `meal_schedules` | OK |
| Refund meal credit | Decrements `meals_used_this_month` by 1 | **BUG** — see §2.3 |
| Refund add-ons to wallet | Credits `addons_total` back | OK |
| Partner notification | Best-effort | OK |
| Customer notification | Best-effort | OK |

### 2.2 Completion Reversal — `uncomplete_meal_atomic` RPC

The **active** version is from `20260225211304` (the `_skip_20260413000002` fix was **not applied**):

| Step | Action | Status |
|------|--------|--------|
| Verify schedule ownership | `user_id = p_user_id FOR UPDATE` | OK (row lock) |
| Idempotency check | If `is_completed = false`, return `nothing_to_undo` | OK |
| Set `is_completed = false` | Updates `meal_schedules` | OK |
| Clear `completed_at` | Sets to `NULL` | OK |
| Subtract from `progress_logs` | Decrements nutrition values | **BUG** — see §2.3 |
| **Delete `meal_history` entry** | **MISSING** (in the active version) | **CRITICAL BUG** |
| **Deduct XP** | **MISSING** (in the active version) | **CRITICAL BUG** |
| **Decrement `total_meals_logged`** | **MISSING** (in the active version) | **CRITICAL BUG** |

### 2.3 Critical Reverse-Flow Bugs

**BUG-1: `cancel_meal_schedule` only decrements monthly quota, not weekly**

The RPC does: `meals_used_this_month = GREATEST(0, meals_used_this_month - 1)` but **does not** also decrement `meals_used_this_week`. This creates a permanent skew where weekly quota appears more consumed than monthly.

**BUG-2: Active `uncomplete_meal_atomic` is the old version without meal_history/XP reversal**

The migration `_skip_20260413000002_fix_uncomplete_meal_atomic.sql` was **skipped** (the `_skip_` prefix is the Supabase convention for intentionally unapplied migrations). This means the active function does NOT:
- Delete the `meal_history` entry created by `complete_meal_atomic` v2
- Deduct 10 XP from the user's profile
- Decrement `total_meals_logged`

This causes **permanent data corruption**: every completion/uncompletion cycle creates orphaned `meal_history` entries and inflates XP/meal counts.

**BUG-3: Active `complete_meal_atomic` is also the old version without meal_history/XP**

Similarly, `_skip_20260413000003_fix_complete_meal_atomic.sql` was skipped. The active `complete_meal_atomic` does NOT insert into `meal_history` or update XP. This means the two functions (complete + uncomplete) are mismatched — uncomplete tries to subtract from `progress_logs` but the nutrition values it uses are the **base meal values**, not the **actual logged values** that would only exist in `meal_history`.

**BUG-4: `partner_earnings` not reversed on cancellation**

When `cancel_meal_schedule` sets `order_status = 'cancelled'`, the `partner_earnings` row created by the `on_meal_schedule_confirmed` trigger is **not deleted or updated**. The trigger fires `WHEN (NEW.order_status = 'confirmed' AND OLD.order_status != 'confirmed')`, so cancellation does NOT trigger any reversal. Partners continue to earn from cancelled orders.

**BUG-5: `delivery_jobs` not cancelled — only checked for active status**

The RPC checks if there are active delivery jobs and blocks the cancel if so. But if delivery jobs are in `pending` or `scheduled` status, they are **not cancelled or removed** — the RPC only cleans up `delivery_queue` entries. Orphaned `delivery_jobs` with `status = 'pending'` remain in the database.

### 2.4 Editing After Submission

| Scenario | Handler | Status |
|----------|---------|--------|
| Change delivery time slot | `updateDeliveryTimeSlot()` in Schedule.tsx:396-421 | OK — direct update |
| Change meal (swap) | **MISSING** | No UI or logic to swap a meal |
| Change meal type (breakfast→lunch) | **MISSING** | No UI or logic |
| Change date | **MISSING** | No UI or logic to reschedule |
| Change add-ons after scheduling | **MISSING** | Only selectable at creation time |

### 2.5 Rescheduling / Reopening

| Scenario | Status |
|----------|--------|
| Reopen cancelled schedule | **MISSING** — `cancel_meal_schedule` sets `order_status='cancelled'` but no UI or RPC to revert to `pending` |
| Reopen completed schedule | `uncomplete_meal_atomic` exists and works (with the bugs noted above) |
| Revert from confirmed to pending | **MISSING** — only partners can change status, and `update_order_status` only allows forward transitions |

### 2.6 Financial Reversal

| Scenario | Handler | Status |
|----------|---------|--------|
| Meal credit refund on cancel | `cancel_meal_schedule` decrements `meals_used_this_month` | **PARTIAL** — weekly not decremented |
| Add-on refund on cancel | `cancel_meal_schedule` credits `addons_total` back to wallet | OK |
| Wallet debit refund on failed creation | **MISSING** — no rollback in MealWizard | **CRITICAL** |
| "Buy Meal Credit" refund (QAR 50) on cancel | **MISSING** — `handleBuyMealCredit` does `debit_wallet` then increments `meals_per_month`; cancel only decrements usage, not the `meals_per_month` increment | **BUG** |
| XP reversal on uncomplete | **MISSING** in active DB version | **BUG** |

---

## 3. DEPENDENCY VALIDATION

### 3.1 Accounting / Ledger Entries

| System | Affected by cancel? | Properly reversed? |
|--------|---------------------|---------------------|
| `wallet_transactions` | Add-on debit creates `type='debit'` entry | Cancel creates `type='refund'` entry — OK |
| `subscriptions.meals_used_this_month` | Incremented on create | Decremented on cancel — OK |
| `subscriptions.meals_used_this_week` | Incremented on create | **NOT** decremented on cancel — BUG |
| `subscriptions.meals_per_month` | Incremented by "Buy Credits" | **NOT** decremented on cancel — BUG |
| `partner_earnings` | Created on `confirmed` transition | **NOT** reversed on cancel — BUG |

### 3.2 Notifications

| Event | Created? | Cleared on cancel? |
|-------|----------|-------------------|
| `meal_scheduled` (to customer) | Yes (MealDetail.tsx) | **NOT** deleted or updated on cancel — stale notification remains |
| `order_update` (to partner) | Yes (cancel RPC) | Newly created; original `meal_scheduled` notification to partner is not handled |
| `order_update` (to customer) | Yes (cancel RPC) | OK — new cancel notification |

### 3.3 Reports / Analytics

| Portal | Excludes cancelled? | Impact |
|--------|---------------------|--------|
| AdminDashboard | **NO** | Total orders, today orders, revenue all inflated |
| AdminAnalytics | **NO** | All charts (revenue, orders, growth) inflated |
| AdminOrders | Partially | `total`/`today` stats inflated; `upcoming`/`overdue` correct |
| PartnerDashboard | **NO** | `totalRevenue`, `todayOrders`, `weeklyRevenue` all inflated |
| PartnerOrders | Partially | Cancelled grouped under "Completed" tab — misleading |
| DriverDashboard | N/A | Operates on `delivery_jobs`, not `meal_schedules` |

### 3.4 Dashboard Stats

- Schedule page's "This Week Progress" (`Schedule.tsx:476-484`) — **counts all schedules including cancelled** because `fetchSchedules` does not filter by `order_status`. A cancelled schedule still appears in the UI as a meal card.

### 3.5 Related Entity Statuses

| Entity | Updated on cancel? | Correct? |
|--------|-------------------|----------|
| `meal_schedules.order_status` | Set to `cancelled` | OK |
| `delivery_jobs.status` | **NOT** updated (only checked for active ones) | **BUG** — orphaned pending delivery jobs |
| `delivery_queue` | Queued entries deleted | OK |
| `schedule_addons` | **NOT** deleted — rows remain referencing a cancelled schedule | Minor — add-ons are refunded via wallet but orphan rows persist |
| `notifications` (original `meal_scheduled`) | **NOT** updated to read or cancelled | **BUG** — stale notification |
| `nps_responses` | **NOT** handled | Minor — orphaned NPS records |
| `partner_earnings` | **NOT** reversed | **BUG** — partner paid for cancelled order |

### 3.6 Inventory / Stock Allocation

No inventory/stock system exists — meals are from partner restaurants with no stock tracking. N/A.

### 3.7 User Balances / Wallet / Credits

| Scenario | Forward | Reverse | Correct? |
|----------|---------|---------|----------|
| Add-on wallet debit | `debit_wallet` RPC | `cancel_meal_schedule` credits `addons_total` | OK |
| Buy extra meal credit (QAR 50) | `debit_wallet` → `meals_per_month += 1` | Cancel decrements `meals_used_this_month` but NOT `meals_per_month` | **BUG** — user pays QAR 50, cancels meal, and keeps the extra `meals_per_month` slot |
| Meal quota consumption | `increment_monthly_meal_usage` | Decremented in `cancel_meal_schedule` | OK for monthly; **missing weekly** |
| Wallet balance | Decreased by add-on amount | Refunded by cancel RPC | OK |

### 3.8 Multi-Portal Consistency

| Portal | Real-time updates | Cancel reflected? |
|--------|-------------------|-------------------|
| Customer (Schedule) | Polls on wizard close | Stale — cancelled schedules stay in list until refresh, and no filter by `order_status` |
| Partner (PartnerDashboard) | Real-time subscription | Cancel updates shown, but revenue calc wrong |
| Partner (PartnerOrders) | Real-time + 10s poll | Cancel updates shown with badge |
| Driver | Real-time on `delivery_jobs` | **Stale** — `meal_schedules` cancel doesn't cascade to `delivery_jobs` |
| Admin | **None** — manual refresh only | Cancel visible in grid but revenue stats wrong |
| Fleet | No real-time | Disconnected from `meal_schedules` |

---

## 4. EDGE CASES

### 4.1 Partial Reversal

| Scenario | Expected | Actual |
|----------|----------|--------|
| Cancel a partial day (3 meals, cancel 1) | That 1 meal cancelled, others remain | OK — `cancel_meal_schedule` operates per schedule ID |
| Schedule with add-ons, cancel the schedule | Meal credit + add-on amount refunded | OK via RPC |
| Schedule with add-ons, but partial add-on debit failed during creation | Refund only the `addons_total` that was debited | **BUG** — `addons_total` column may not reflect what was actually charged |

### 4.2 Double Reversal

| Scenario | Expected | Actual |
|----------|----------|--------|
| Cancel same schedule twice | Second call should fail or be idempotent | **OK** — First cancel sets `order_status='cancelled'`; second call hits the guard `IF v_schedule.order_status NOT IN ('pending', 'confirmed')` and raises exception. Frontend shows error. |
| Uncomplete an already incomplete meal | Should be no-op | **OK** — Returns `{ nothing_to_undo: true }` |
| Complete an already completed meal | Should be idempotent | **OK** — Returns `{ was_already_completed: true }` |

### 4.3 Reversal After Timeout/Expiry

| Scenario | Expected | Actual |
|----------|----------|--------|
| Cancel after subscription expired | Refund should still work | **OK** — RPC decrements `meals_used_this_month` with `GREATEST(0, ...)` regardless of subscription status |
| Cancel a past-date schedule | Should still refund | **OK** — No date check in RPC |
| Uncomplete a meal from a past date | Should still work | **OK** — No date check in uncomplete RPC |

### 4.4 Reversal with Missing Dependencies

| Scenario | Expected | Actual |
|----------|----------|--------|
| Cancel schedule whose meal was deleted from `meals` table | Should still cancel | **BUG** — RPC does `JOIN meals m ON m.id = ms.meal_id`; if meal deleted, the JOIN returns no row, raising "Order not found" exception |
| Cancel schedule with no active subscription | Should still cancel schedule but skip quota refund | **BUG** — The `UPDATE subscriptions ... WHERE status = 'active'` will update 0 rows silently; schedule is cancelled but no refund of meal credit |
| Cancel schedule with no wallet | Should still cancel, skip add-on refund | **OK** — Wallet credit wrapped in a condition checking `addons_total > 0`; if wallet doesn't exist, `v_wallet_id` is NULL and the UPDATE will affect 0 rows |
| Uncomplete meal with no `progress_logs` entry | Should still mark as incomplete | **OK** — Only updates progress if `v_existing_progress IS NOT NULL` |

### 4.5 Permission Conflicts

| Scenario | Expected | Actual |
|----------|----------|--------|
| Customer cancels another customer's schedule | Should be rejected | **OK** — RPC enforces `user_id = auth.uid()` |
| Partner cancels a customer's schedule | Should go through role-based RPC | **PARTIAL** — PartnerOrders uses `update_order_status` RPC; AdminOrders uses direct UPDATE (bypasses all business logic) |
| Admin cancels via AdminOrders | Should trigger full cancellation flow | **BUG** — AdminOrders uses `supabase.from("meal_schedules").update({ order_status: "cancelled" })` which bypasses `cancel_meal_schedule` RPC. No refund, no notification, no delivery cleanup. |

### 4.6 Concurrent Edits During Reversal

| Scenario | Expected | Actual |
|----------|----------|--------|
| Two cancel requests for same schedule | Only one should succeed | **OK** — Second hits status guard |
| Schedule confirmed by partner while customer cancels | Cancel should be rejected if status changed | **RACE** — `cancel_meal_schedule` does `SELECT ... INTO v_schedule` then `UPDATE`; no `FOR UPDATE` lock. Small window where partner changes status between SELECT and UPDATE. The `WHERE id = p_schedule_id` in UPDATE doesn't check status again. |
| MealWizard quota check + concurrent creation | Both pass, both insert | **RACE** — Non-atomic duplicate check at `MealWizard.tsx:598-605` |

### 4.7 Invalid Rollback Sequences

| Scenario | Expected | Actual |
|----------|----------|--------|
| Complete → Cancel | Cancel should block (status is not pending/confirmed) | **OK** — Guard rejects |
| Cancel → Uncomplete | Uncomplete should be no-op (is_completed = false for cancelled) | **OK** |
| Complete → Uncomplete → Cancel | Should work: complete (is_completed=true), uncomplete (is_completed=false), cancel (order_status pending → cancelled) | **OK** — Status flow allows this |
| Buy credit → Schedule meal → Cancel meal | QAR 50 debited, meal_per_month incremented by 1, meals_used incremented, then meals_used decremented. But meals_per_month stays +1 | **BUG** — Net result: user gains an extra `meals_per_month` slot for free |

---

## 5. COMPLETE BUG & ISSUE LIST

### CRITICAL (P0 — Data Loss / Financial Impact)

| ID | Description | Location | Impact |
|----|-------------|----------|--------|
| **BUG-1** | MealWizard has no rollback — if schedule INSERT fails after quota increment, user loses meal credits without getting a schedule | `MealWizard.tsx:631-653` | Financial loss for user |
| **BUG-2** | Add-on wallet debit failure silently swallowed — add-ons inserted without payment | `MealWizard.tsx:671` | Revenue leakage |
| **BUG-3** | Active `uncomplete_meal_atomic` is old version — does NOT delete `meal_history`, deduct XP, or decrement `total_meals_logged` | Migration `_skip_20260413000002` not applied | Permanent data corruption per cycle |
| **BUG-4** | Active `complete_meal_atomic` is old version — does NOT insert `meal_history` or update XP | Migration `_skip_20260413000003` not applied | Mismatch with uncomplete logic |
| **BUG-5** | `cancel_meal_schedule` does NOT decrement `meals_used_this_week` | `cancel_meal_schedule` RPC | Weekly quota skew |
| **BUG-6** | "Buy Meal Credit" (QAR 50) increments `meals_per_month`, but cancel only decrements `meals_used_this_month` — user keeps the extra slot for free | `Schedule.tsx:144-171` | Revenue leakage |
| **BUG-7** | `partner_earnings` not reversed on cancellation | `cancel_meal_schedule` RPC + trigger | Partners earn from cancelled orders |
| **BUG-8** | AdminOrders cancellation bypasses `cancel_meal_schedule` RPC — no refund, no notification, no delivery cleanup | `AdminOrders.tsx:577-612` | Financial loss + stale data |

### MAJOR (P1 — Incorrect Behavior)

| ID | Description | Location | Impact |
|----|-------------|----------|--------|
| **ISSUE-1** | Schedule page `fetchSchedules` does NOT filter by `order_status` — cancelled schedules remain visible | `Schedule.tsx:209-222` | Confusing UX |
| **ISSUE-2** | `delivery_jobs` not cancelled/updated when `meal_schedule` is cancelled (only `delivery_queue` cleaned) | `cancel_meal_schedule` RPC | Driver sees orphaned orders |
| **ISSUE-3** | Original `meal_scheduled` notification not updated/read on cancel | No code path | Stale notification |
| **ISSUE-4** | All admin + partner dashboards include cancelled orders in revenue/counts | AdminDashboard, AdminAnalytics, AdminOrders, PartnerDashboard | Inflated metrics |
| **ISSUE-5** | `cancel_meal_schedule` fails with exception if the meal was deleted from `meals` table (INNER JOIN) | `cancel_meal_schedule` RPC | Cancel fails, schedule stuck |
| **ISSUE-6** | AdminBulk actions "Mark as Completed" and "Cancel Selected" have no `onClick` handlers | `AdminOrders.tsx:956-967` | Non-functional buttons |
| **ISSUE-7** | `cancellation_reason` field always `null` in PartnerOrders | `PartnerOrders.tsx:468` | Cancellation reason UI never shows |

### MINOR (P2 — UX / Polish)

| ID | Description | Location | Impact |
|----|-------------|----------|--------|
| **ISSUE-8** | Cancelled orders grouped under "Completed" tab in PartnerOrders | `PartnerOrders.tsx:535-537` | Misleading UX |
| **ISSUE-9** | Recent activity in AdminDashboard shows cancelled orders as "New meal scheduled" | `AdminDashboard.tsx:229-233` | Misleading |
| **ISSUE-10** | `PartnerDashboard.ScheduledMeal` type missing `order_status` — cancelled orders show as "Pending" | `PartnerDashboard.tsx:48-59` | Misleading |
| **ISSUE-11** | No real-time subscription in AdminDashboard, AdminAnalytics, AdminOrders | All admin pages | Stale data until manual refresh |
| **ISSUE-12** | Schedule page "This Week Progress" counts cancelled schedules | `Schedule.tsx:475-484` | Inaccurate completion percentage |
| **ISSUE-13** | No way to edit/reschedule a meal after creation | Missing feature | Poor UX |
| **ISSUE-14** | No `order_status` filter in real-time subscription for PartnerDashboard — listens to ALL `meal_schedules` changes | `PartnerDashboard.tsx:97-119` | Unnecessary re-fetches |
| **ISSUE-15** | `DeliveryTracking` cancel for `orders` table uses raw UPDATE with no refund/notification/cleanup | `DeliveryTracking.tsx:307` | Major inconsistency |

---

## 6. SECURITY / PERMISSION CONCERNS

| ID | Description | Severity |
|----|-------------|----------|
| **SEC-1** | `cancel_meal_schedule` RPC requires `auth.uid() = user_id` but does NOT use `SELECT ... FOR UPDATE` — race window for concurrent status changes | Medium |
| **SEC-2** | MealWizard's duplicate-check SELECT is not atomic with the INSERT — two concurrent requests can both pass and create duplicates | Medium |
| **SEC-3** | `AdminOrders.cancelOrder` uses direct `.update()` on `meal_schedules` bypassing the RPC — a malicious or buggy admin action would skip all business logic (refunds, notifications, delivery cleanup) | **High** |
| **SEC-4** | `Schedule.tsx:144-150` calls `debit_wallet` with `(supabase.rpc as any)` — type assertion bypasses TypeScript type safety, could pass malformed parameters | Low |
| **SEC-5** | RLS policy `"Users can manage their own schedules"` uses `FOR ALL` which allows UPDATE/DELETE — a user could directly update `order_status` to any value, bypassing the cancel RPC and its side effects | Medium |

---

## 7. RECOMMENDATIONS

### Immediate (P0 — Fix Now)

1. **Apply the `_skip_` migrations**: Activate `_skip_20260413000002_fix_uncomplete_meal_atomic.sql` and `_skip_20260413000003_fix_complete_meal_atomic.sql`. These fix the meal_history/XP mismatch and are designated fixes that were intentionally deferred.

2. **Add `meals_used_this_week` decrement to `cancel_meal_schedule`**: Add `meals_used_this_week = GREATEST(0, meals_used_this_week - 1)` alongside the monthly decrement.

3. **Fix "Buy Meal Credit" cancel logic**: When a user cancels a meal that was purchased via "Buy Credits" (QAR 50), the `cancel_meal_schedule` RPC should also decrement `meals_per_month` if the schedule was created using purchased credit. Alternatively, add a `credit_type` column to `meal_schedules` to track this.

4. **Reverse `partner_earnings` on cancel**: Add a trigger or logic in `cancel_meal_schedule` to set `partner_earnings` status to `cancelled` or delete the row when `order_status` transitions to `cancelled`.

5. **Fix MealWizard rollback**: Wrap meal creation in a transactional pattern. Either: (a) use a Supabase RPC that atomically creates schedules + add-ons + debits wallet, or (b) add client-side rollback logic that deletes created schedules and reverses quota increments if any step fails.

6. **Fix AdminOrders cancellation**: Replace the direct `.update()` with `supabase.rpc("cancel_meal_schedule", { p_schedule_id: orderId })` to ensure all side effects fire.

7. **Fix add-on debit failure**: In `MealWizard.tsx`, change the `continue` on debit error to either: (a) abort and rollback, or (b) throw an error that prevents the `schedule_addons` INSERT.

### Short-Term (P1 — Next Sprint)

8. **Filter cancelled schedules**: Add `.neq("order_status", "cancelled")` to `fetchSchedules` in Schedule.tsx and all dashboard queries. For dashboards that need to show cancelled orders, add a separate `cancelledCount` stat.

9. **Cancel `delivery_jobs` when meal schedule is cancelled**: Add logic in `cancel_meal_schedule` RPC to update `delivery_jobs` status to `cancelled` where `schedule_id = p_schedule_id` (for non-active ones, which were already blocked).

10. **Fix JOIN in `cancel_meal_schedule`**: Change `JOIN meals m ON m.id = ms.meal_id` to `LEFT JOIN meals m ON m.id = ms.meal_id` so cancellation works even if the meal was deleted.

11. **Mark stale notifications**: After cancellation, update the original `meal_scheduled` notification to `status = 'read'` and type `cancelled`.

12. **Add `SELECT ... FOR UPDATE` to `cancel_meal_schedule`**: Prevent race condition between auth check and status update.

13. **Add real-time to admin pages**: Subscribe to `postgres_changes` on `meal_schedules` in AdminDashboard, AdminOrders, and AdminAnalytics.

### Medium-Term (P2 — Backlog)

14. **Add reschedule/edit functionality**: Allow customers to change the meal, date, or time slot on a scheduled meal without cancel and re-create.

15. **Fix `cancellation_reason` population**: Update `cancel_meal_schedule` RPC to accept an optional `p_reason` parameter, and update `SkipReasonModal` to pass the reason to the RPC.

16. **Group cancelled orders separately**: In PartnerOrders, move cancelled orders to their own "Cancelled" tab instead of grouping with "Completed."

17. **Add meal swap capability**: Allow customers to replace a meal in a schedule slot without cancelling.

18. **Fix `DeliveryTracking` orders table cancel**: Use an RPC with proper side effects instead of raw UPDATE for the `orders` table cancellation path.

19. **Narrow RLS policy**: Change `"Users can manage their own schedules"` from `FOR ALL` to separate policies for SELECT, INSERT, UPDATE (with restricted columns), preventing direct `order_status` manipulation bypassing RPCs.

---

*End of report.*