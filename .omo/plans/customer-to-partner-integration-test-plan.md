# Nutrio Customer-to-Partner Integration Test Plan

**Audience**: Senior QA Automation Engineer + CTO Review  
**Date**: 2026-06-25  
**Status**: READY FOR REVIEW  
**Scope**: End-to-end integration from Customer Portal actions → Partner Restaurant Portal effects

---

## Executive Summary

This document provides a comprehensive integration test plan verifying that every customer action in the Nutrio Customer Portal is correctly reflected inside the Partner Restaurant Portal in real time. The test plan covers 20 test domains, 8 end-to-end scenarios, database consistency checks, RLS/security validation, and real-time/polling fallback verification.

**Architecture Context**:
- **Central order table**: `meal_schedules` (not a separate `orders` table)
- **Partner scoping**: `meal_schedules.meal_id` → `meals.restaurant_id` → `restaurants.owner_id`
- **Real-time**: 4 Supabase channels on `meal_schedules` and `notifications` tables
- **Polling fallback**: 10-second interval in PartnerOrders
- **Payment**: Simulated via `useSimulatedPayment` hook
- **Earnings**: `partner_earnings` table, calculated as `payout_rate * (1 - commission_rate/100)`

---

## 1. System Architecture Map

### 1.1 Customer Portal Routes (Order-Relevant)

| Route | Page | Key Actions |
|-------|------|-------------|
| `/meals` | Meals.tsx | Browse restaurants, view meals |
| `/restaurant/:id` | RestaurantDetail.tsx | View restaurant details, menu |
| `/meals/:id` | MealDetail.tsx | View meal details, select variant/add-ons |
| `/checkout` | Checkout.tsx | Cart → payment → order creation |
| `/schedule` | Schedule.tsx | Schedule meals, modify/cancel orders |
| `/orders` | OrderHistory.tsx | View order history, reorder |
| `/order/:id` | OrderDetail.tsx | View order details, cancel |
| `/favorites` | Favorites.tsx | Favorite/unfavorite restaurants & meals |
| `/wallet` | Wallet.tsx | Wallet balance, top-up |
| `/subscription` | Subscription.tsx | Subscription management, credits |
| `/addresses` | Addresses.tsx | Manage delivery addresses |
| `/notifications` | Notifications.tsx | Customer notification preferences |
| `/support` | Support.tsx | Create support tickets |

### 1.2 Partner Portal Routes

| Route | Page | Key Data |
|-------|------|----------|
| `/partner` | PartnerDashboard.tsx | Stats, recent schedules, revenue |
| `/partner/orders` | PartnerOrders.tsx | Today's orders, status management |
| `/partner/menu` | PartnerMenu.tsx | Meal management |
| `/partner/analytics` | PartnerAnalytics.tsx | Charts, top meals, trends |
| `/partner/earnings` | PartnerEarningsDashboard.tsx | Earnings, commission, payouts |
| `/partner/payouts` | PartnerPayouts.tsx | Payout history, settlement |
| `/partner/notifications` | PartnerNotifications.tsx | Order alerts, updates |
| `/partner/settings` | PartnerSettings.tsx | Restaurant profile |
| `/partner/profile` | PartnerProfile.tsx | Partner account |

### 1.3 Real-Time Channels

| Channel Name | Table | Events | Consumer |
|-------------|-------|--------|----------|
| `partner-meal-schedules` | `meal_schedules` | UPDATE | PartnerOrders (status changes) |
| `partner-dashboard-rt` | `meal_schedules` | * (all) | PartnerDashboard (stats refresh) |
| `partner-notifications-page` | `notifications` | INSERT | PartnerNotifications (new alerts) |
| `new-order-notification-banner` | `meal_schedules` | INSERT | NewOrderNotificationBanner (audio + banner) |

### 1.4 Key Database Tables

| Table | Purpose | RLS Scoping |
|-------|---------|-------------|
| `meal_schedules` | Central order/schedule table | Via meal_id → restaurant_id → owner_id |
| `meals` | Meal catalog | Partners: own restaurant; Public: SELECT |
| `restaurants` | Restaurant profiles | Partners: owner_id; Public: SELECT approved |
| `partner_earnings` | Per-order earnings records | restaurant_id → owner_id |
| `partner_payouts` | Settlement records | restaurant_id → owner_id |
| `notifications` | All portal notifications | user_id = auth.uid() |
| `favorites` | Customer favorites | user_id = auth.uid() |
| `carts` | Customer shopping cart | user_id = auth.uid() |
| `user_addresses` | Delivery addresses | user_id = auth.uid() |
| `subscriptions` | Meal subscriptions | user_id = auth.uid() |
| `customer_wallets` | Wallet balances | user_id = auth.uid() |
| `wallet_transactions` | Wallet history | Via wallet_id → user_id |
| `support_tickets` | Support requests | user_id = auth.uid() |
| `meal_reviews` | Customer ratings/reviews | Public SELECT; user-scoped INSERT |

---

## 2. Test Domains

### Domain 1: Customer Browsing → Partner Data Accuracy

**Objective**: Verify all displayed restaurant and meal data matches what the partner created.

| Test ID | Customer Action | Partner Data to Verify | Expected Result |
|---------|----------------|----------------------|-----------------|
| D1-T1 | Open restaurant list (`/meals`) | Restaurant name, logo, cuisine, rating | Matches `restaurants` table |
| D1-T2 | Open restaurant detail (`/restaurant/:id`) | All restaurant fields, operating hours, location | Matches `restaurants` + `restaurant_details` |
| D1-T3 | Open meal detail (`/meals/:id`) | Meal image, name, price, calories, protein, carbs, fat, description | Matches `meals` table |
| D1-T4 | View meal variants | Size options, prices | Matches `meal_variants` if implemented |
| D1-T5 | View meal add-ons | Add-on names, prices | Matches `meal_addons` table |
| D1-T6 | Check meal availability | is_available, is_active flags | Matches `meals.is_available` |
| D1-T7 | Check restaurant status | is_active, approval_status | Matches `restaurants.is_active` |

**Database Verification**:
```sql
-- Verify meal data consistency
SELECT m.id, m.name, m.price, m.calories, m.image_url, r.name as restaurant_name
FROM meals m JOIN restaurants r ON m.restaurant_id = r.id
WHERE m.id = '<meal_id>';

-- Verify restaurant data
SELECT r.*, rd.operating_hours, rd.cuisine_type
FROM restaurants r LEFT JOIN restaurant_details rd ON r.id = rd.restaurant_id
WHERE r.id = '<restaurant_id>';
```

**Failure Criteria**: Any mismatch between displayed data and database values is an integration failure.

---

### Domain 2: Customer Favorite Actions → Partner Analytics

**Objective**: Verify favorites are tracked and reflected in analytics if applicable.

| Test ID | Customer Action | Partner Impact | Expected Result |
|---------|----------------|----------------|-----------------|
| D2-T1 | Favorite a restaurant | Check if partner analytics shows favorites | If metric exists, count increments |
| D2-T2 | Favorite a meal | Check if partner analytics shows meal interest | If metric exists, count increments |
| D2-T3 | Unfavorite a restaurant | Check if count decrements | Removed from favorites |
| D2-T4 | Unfavorite a meal | Check if count decrements | Removed from favorites |

**Database Verification**:
```sql
-- Check favorites table
SELECT f.*, r.name as restaurant_name, m.name as meal_name
FROM favorites f
LEFT JOIN restaurants r ON f.restaurant_id = r.id
LEFT JOIN meals m ON f.meal_id = m.id
WHERE f.user_id = '<customer_user_id>';
```

**Note**: PartnerAnalytics.tsx does not currently display favorite counts. This is a **gap** — mark as feature request, not a bug.

---

### Domain 3: Customer Meal Selection → Partner Menu Link

**Objective**: Verify selected meal, variant, add-ons, and notes are saved and appear in partner order.

| Test ID | Customer Action | Partner Impact | Expected Result |
|---------|----------------|----------------|-----------------|
| D3-T1 | Select meal from menu | Meal appears in cart | Cart contains correct meal_id |
| D3-T2 | Select size/variant | Variant saved to cart | Cart items include variant |
| D3-T3 | Select add-ons | Add-ons saved to cart | Cart items include add-on IDs |
| D3-T4 | Add kitchen notes | Notes saved | `restaurant_note` field populated |
| D3-T5 | Complete checkout | Order appears in PartnerOrders | Meal name, variant, add-ons, notes all correct |

**Database Verification**:
```sql
-- Check cart before checkout
SELECT * FROM carts WHERE user_id = '<customer_user_id>';

-- Check schedule_addons after order
SELECT sa.*, ma.name as addon_name
FROM schedule_addons sa
JOIN meal_addons ma ON sa.addon_id = ma.id
WHERE sa.schedule_id = '<schedule_id>';
```

---

### Domain 4: Customer Schedule Meal → Partner Upcoming Orders

**Objective**: Verify scheduled meals appear in partner dashboard and orders.

| Test ID | Customer Action | Partner Impact | Expected Result |
|---------|----------------|----------------|-----------------|
| D4-T1 | Schedule meal for future date | PartnerDashboard "Recent schedule" updates | Schedule appears with correct date/meal |
| D4-T2 | Schedule meal for today | PartnerOrders shows order | Order appears in active tab |
| D4-T3 | Schedule with delivery time slot | PartnerOrders shows time | `delivery_time_slot` displayed |
| D4-T4 | Schedule with delivery address | PartnerOrders shows address | Address matches customer selection |

**Critical Note**: PartnerOrders only shows **today's** orders (`.eq("scheduled_date", today)`). Future schedules appear only in PartnerDashboard "Recent schedule" section.

**Database Verification**:
```sql
SELECT ms.*, m.name as meal_name, r.name as restaurant_name
FROM meal_schedules ms
JOIN meals m ON ms.meal_id = m.id
JOIN restaurants r ON m.restaurant_id = r.id
WHERE ms.user_id = '<customer_user_id>'
ORDER BY ms.scheduled_date DESC;
```

---

### Domain 5: Customer Checkout Success → Partner New Order

**Objective**: Verify complete order flow from checkout to partner notification.

| Test ID | Customer Action | Partner Impact | Expected Result |
|---------|----------------|----------------|-----------------|
| D5-T1 | Complete checkout successfully | New order in PartnerOrders | Order appears in active tab |
| D5-T2 | Complete checkout | NewOrderNotificationBanner | Banner appears with meal name |
| D5-T3 | Complete checkout | Audio alert | Mixkit sound plays |
| D5-T4 | Complete checkout | Toast notification | "Order Updated" toast |
| D5-T5 | Complete checkout | PartnerNotifications | `new_order` notification created |
| D5-T6 | Verify order details | Customer name | `profiles.full_name` displayed |
| D5-T7 | Verify order details | Delivery address | `user_addresses` data displayed |
| D5-T8 | Verify order details | Meal name, calories | Matches `meals` table |
| D5-T9 | Verify order details | Add-ons listed | `schedule_addons` displayed |
| D5-T10 | Verify order details | Kitchen notes | `restaurant_note` displayed |
| D5-T11 | Verify order details | Delivery time | `delivery_time_slot` displayed |

**Real-Time Verification**:
- PartnerOrders page open during checkout → order appears without refresh (via `partner-meal-schedules` channel)
- NewOrderNotificationBanner appears immediately (via `new-order-notification-banner` channel)
- PartnerNotifications page receives new entry (via `partner-notifications-page` channel)

---

### Domain 6: Customer Payment Failure → No Valid Partner Order

**Objective**: Verify failed payments do not create actionable partner orders.

| Test ID | Customer Action | Partner Impact | Expected Result |
|---------|----------------|----------------|-----------------|
| D6-T1 | Payment fails (simulated) | No order in PartnerOrders | No new active order |
| D6-T2 | Payment fails | Partner earnings unchanged | `partner_earnings` no new record |
| D6-T3 | Payment fails | Partner payouts unchanged | No payout impact |
| D6-T4 | Payment fails | Partner analytics unchanged | No order count increment |
| D6-T5 | Payment fails | Partner notifications | No `new_order` notification |
| D6-T6 | Payment fails | NewOrderNotificationBanner | No banner appears |
| D6-T7 | Payment fails | Audio alert | No sound plays |

**Database Verification**:
```sql
-- Verify no meal_schedule created for failed payment
SELECT COUNT(*) FROM meal_schedules 
WHERE user_id = '<customer_user_id>' 
AND created_at > '<payment_attempt_time>';

-- Verify no partner_earnings record
SELECT COUNT(*) FROM partner_earnings 
WHERE created_at > '<payment_attempt_time>';
```

**Critical Blocker**: If a failed payment creates a `meal_schedule` record with `order_status != 'cancelled'`, this is a **CRITICAL BLOCKER**.

---

### Domain 7: Customer Wallet / Reward / Discount → Partner Calculations

**Objective**: Verify partner financial calculations are correct when customer uses wallet, rewards, or discounts.

| Test ID | Customer Action | Partner Impact | Expected Result |
|---------|----------------|----------------|-----------------|
| D7-T1 | Pay with wallet balance | Partner order shows correct gross | `payout_rate` from restaurant |
| D7-T2 | Apply discount/reward | Partner earnings show net | `payout_rate * (1 - commission_rate/100)` |
| D7-T3 | Subscription credit used | Partner earnings unaffected | Partner still receives full payout_rate |
| D7-T4 | Verify invoice total | PartnerEarningsDashboard | Net amount matches calculation |
| D7-T5 | Verify commission | PartnerEarningsDashboard | `commission_rate` % deducted correctly |

**Calculation Verification**:
```
gross_amount = restaurant.payout_rate
platform_fee = gross_amount * (commission_rate / 100)
net_amount = gross_amount - platform_fee
```

**Database Verification**:
```sql
SELECT pe.*, r.payout_rate, r.commission_rate
FROM partner_earnings pe
JOIN restaurants r ON pe.restaurant_id = r.id
WHERE pe.restaurant_id = '<restaurant_id>'
ORDER BY pe.created_at DESC LIMIT 1;
```

---

### Domain 8: Customer Cancels Order → Partner Order Update

**Objective**: Verify cancellation flow from customer to partner.

| Test ID | Customer Action | Partner Impact | Expected Result |
|---------|----------------|----------------|-----------------|
| D8-T1 | Cancel order before preparation | PartnerOrders status → "cancelled" | Real-time update |
| D8-T2 | Cancel with reason | Cancellation reason displayed | `cancellation_reason` shown |
| D8-T3 | Cancel order | Partner cannot transition status | Action buttons hidden for cancelled |
| D8-T4 | Cancel order | Excluded from earnings | No `partner_earnings` record (or marked cancelled) |
| D8-T5 | Cancel order | Excluded from payouts | Not included in payout calculation |
| D8-T6 | Cancel order | Excluded from analytics | Not counted in completed orders |
| D8-T7 | Cancel order | Partner notification created | `order_update` notification |

**Status Flow Verification**:
- Partner can only cancel from `pending`, `confirmed`, `preparing`, `ready` states
- Once `out_for_delivery` or beyond, partner cannot cancel
- Customer cancellation should update `order_status` to `cancelled`

---

### Domain 9: Customer Modifies Order → Partner Updated Order

**Objective**: Verify order modifications propagate correctly.

| Test ID | Customer Action | Partner Impact | Expected Result |
|---------|----------------|----------------|-----------------|
| D9-T1 | Change meal | PartnerOrders shows new meal | Old meal replaced |
| D9-T2 | Change variant | PartnerOrders shows new variant | Updated |
| D9-T3 | Change add-ons | PartnerOrders shows new add-ons | `schedule_addons` updated |
| D9-T4 | Change delivery time | PartnerOrders shows new time | `delivery_time_slot` updated |
| D9-T5 | Change address | PartnerOrders shows new address | Address updated |
| D9-T6 | Change notes | PartnerOrders shows new notes | `restaurant_note` updated |
| D9-T7 | Modify order | Price recalculated | Earnings reflect new price |
| D9-T8 | Modify order | Partner notification | `order_update` notification |

**Note**: The `ModifyOrderModal` component exists in Schedule.tsx. Verify it uses `update_order_status` RPC or direct update.

---

### Domain 10: Customer Reorders → Partner New Order

**Objective**: Verify reorder creates a new order, not a mutation.

| Test ID | Customer Action | Partner Impact | Expected Result |
|---------|----------------|----------------|-----------------|
| D10-T1 | Reorder from OrderHistory | New order in PartnerOrders | New `meal_schedule` record, new ID |
| D10-T2 | Reorder | Old order unchanged | Previous order status preserved |
| D10-T3 | Reorder | Add-ons preserved | Same add-ons as original |
| D10-T4 | Reorder | Address preserved | Same delivery address |
| D10-T5 | Reorder | Payment status correct | New payment processed |

**Database Verification**:
```sql
-- Verify two distinct records exist
SELECT id, created_at, order_status FROM meal_schedules
WHERE user_id = '<customer_user_id>' AND meal_id = '<meal_id>'
ORDER BY created_at DESC;
```

---

### Domain 11: Customer Delivery Address Change → Partner Delivery Details

**Objective**: Verify address changes propagate to partner orders.

| Test ID | Customer Action | Partner Impact | Expected Result |
|---------|----------------|----------------|-----------------|
| D11-T1 | Change default address | Future orders use new address | PartnerOrders shows new address |
| D11-T2 | Select different address at checkout | Order uses selected address | Not default, but selected |
| D11-T3 | Old address not used | PartnerOrders address correct | Matches customer selection |

**Database Verification**:
```sql
-- Check address on order
SELECT ua.* FROM user_addresses ua
JOIN meal_schedules ms ON ms.user_id = ua.user_id
WHERE ms.id = '<schedule_id>' AND ua.is_default = true;
```

---

### Domain 12: Customer Subscription Credits → Partner Order Eligibility

**Objective**: Verify subscription-based ordering and partner earnings.

| Test ID | Customer Action | Partner Impact | Expected Result |
|---------|----------------|----------------|-----------------|
| D12-T1 | Order with active subscription | Order created as "paid" | `isCoveredBySubscription = true` |
| D12-T2 | Order with subscription | Partner earnings calculated | Full `payout_rate` paid to partner |
| D12-T3 | Order with subscription | Meal credit consumed | `remainingMeals` decremented |
| D12-T4 | Order with unlimited plan | No credit limit | Order proceeds |
| D12-T5 | Order with expired subscription | Payment required | Customer must pay |
| D12-T6 | Order with 0 credits | Order blocked | No partner order created |

**Checkout Logic** (from Checkout.tsx):
```typescript
const isCoveredBySubscription = type === 'order' && hasActiveSubscription && (isUnlimited || remainingMeals > 0);
const requiredAmount = isCoveredBySubscription ? 0 : amount;
```

---

### Domain 13: Customer Meal Completion → Partner Dashboard/Analytics

**Objective**: Verify completion metrics update correctly.

| Test ID | Customer Action | Partner Impact | Expected Result |
|---------|----------------|----------------|-----------------|
| D13-T1 | Mark meal as completed | PartnerDashboard completed count | Increments |
| D13-T2 | Mark meal as completed | PartnerAnalytics | Order counted in stats |
| D13-T3 | Mark meal as completed | Partner earnings | `partner_earnings` record created |
| D13-T4 | Completion without delivery | Payout not triggered | Only delivered+completed trigger payout |

**Note**: `is_completed` field on `meal_schedules` tracks completion. Partner earnings are trigger-populated.

---

### Domain 14: Customer Support Ticket → Partner Visibility

**Objective**: Verify support ticket visibility and data protection.

| Test ID | Customer Action | Partner Impact | Expected Result |
|---------|----------------|----------------|-----------------|
| D14-T1 | Create ticket about order | Check partner visibility | Determine if partner can see |
| D14-T2 | Ticket contains order reference | Order link if visible | `order_id` linked correctly |
| D14-T3 | Ticket contains sensitive data | Data protection | PII not exposed to partner unnecessarily |

**RLS Check**:
```sql
-- support_tickets RLS
SELECT * FROM support_tickets WHERE user_id = auth.uid();
```

**Note**: Partner portal does not have a dedicated support page. Tickets may be admin-only.

---

### Domain 15: Customer Review / Rating → Partner Restaurant Metrics

**Objective**: Verify rating system integrity.

| Test ID | Customer Action | Partner Impact | Expected Result |
|---------|----------------|----------------|-----------------|
| D15-T1 | Rate a meal | PartnerAnalytics rating updates | Average recalculated |
| D15-T2 | Rate a restaurant | Restaurant rating updates | `restaurants.rating` updated |
| D15-T3 | Submit duplicate rating | Prevention mechanism | Duplicate blocked or overwritten |
| D15-T4 | Rating average calculation | Verify math | Sum(ratings) / count |

**Database**: `meal_reviews` table (created in migration `20260225211248_add_meal_reviews.sql`)

---

### Domain 16: Customer Notifications Preference → Partner Independence

**Objective**: Verify customer notification settings don't affect partner alerts.

| Test ID | Customer Action | Partner Impact | Expected Result |
|---------|----------------|----------------|-----------------|
| D16-T1 | Disable customer push notifications | Partner new-order alert still works | Banner + audio still trigger |
| D16-T2 | Disable customer email notifications | Partner notifications unaffected | Partner notifications still created |
| D16-T3 | Mute all customer notifications | Partner real-time updates work | Channels still active |

**Verification**: Customer `notification_preferences` columns are scoped to customer user_id. Partner notifications use separate `notifications` table entries with partner's user_id.

---

### Domain 17: Real-Time Customer → Partner Sync

**Objective**: Verify real-time updates and polling fallback.

| Test ID | Customer Action | Partner Impact | Expected Result |
|---------|----------------|----------------|-----------------|
| D17-T1 | Place order while partner portal open | Order appears without refresh | < 2 seconds via real-time |
| D17-T2 | Cancel order while partner portal open | Status updates without refresh | < 2 seconds via real-time |
| D17-T3 | Modify order while partner portal open | Details update without refresh | < 2 seconds via real-time |
| D17-T4 | Simulate real-time failure | Polling fallback | Order appears within 10 seconds |
| D17-T5 | Place multiple orders rapidly | No duplicate banners | One banner per order |
| D17-T6 | Place multiple orders rapidly | No duplicate audio | One sound per order |
| D17-T7 | Place multiple orders rapidly | No duplicate toasts | One toast per status change |
| D17-T8 | Place multiple orders rapidly | No duplicate order rows | One row per order |

**Real-Time Architecture**:
- `partner-meal-schedules` channel: UPDATE events → status change toasts + order refresh
- `new-order-notification-banner` channel: INSERT events → banner + audio
- `partner-dashboard-rt` channel: * events → dashboard stats refresh
- `partner-notifications-page` channel: INSERT events → notification list

**Polling Fallback**: `setInterval(fetchOrders, 10000)` in PartnerOrders.tsx line 339

---

### Domain 18: Restaurant Scoping & Security

**Objective**: Verify strict restaurant-level data isolation.

| Test ID | Customer Action | Security Check | Expected Result |
|---------|----------------|----------------|-----------------|
| D18-T1 | Order from Restaurant A | Restaurant B partner cannot see order | RLS blocks |
| D18-T2 | Order from Restaurant A | Only Restaurant A partner sees it | Order visible only to owner |
| D18-T3 | Direct API call with wrong restaurant_id | RLS enforcement | 403 or empty result |
| D18-T4 | Customer orders from inactive restaurant | Order blocked | Cannot create order |
| D18-T5 | Customer orders hidden meal | Order blocked | `is_available = false` respected |
| D18-T6 | Customer orders unapproved restaurant | Order blocked | `approval_status != 'approved'` |

**RLS Policy** (from `20260510000001_rls_policies_and_indexes.sql`):
```sql
-- Partners can only see orders for their restaurant's meals
CREATE POLICY "Partners can view their restaurant orders" ON orders 
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM restaurants r 
    WHERE r.id = orders.restaurant_id 
    AND r.owner_id = (select auth.uid())
  )
);
```

**PartnerOrders Scoping** (from PartnerOrders.tsx):
```typescript
// Get partner's restaurant
const { data: restaurant } = await supabase
  .from("restaurants").select("id, name")
  .eq("owner_id", user.id).maybeSingle();

// Get all meal IDs for this restaurant
const { data: meals } = await supabase
  .from("meals").select("id")
  .eq("restaurant_id", restaurant.id);

// Only fetch schedules for these meals
.in("meal_id", mealIds)
```

---

### Domain 19: Cross-Portal Database Consistency

**Objective**: Verify data integrity across all related tables.

| Table | Check | Verification |
|-------|-------|-------------|
| `meal_schedules` | Correct `meal_id` → `restaurant_id` | JOIN meals, verify restaurant |
| `meal_schedules` | Correct `user_id` | Matches customer auth.uid() |
| `schedule_addons` | Correct `schedule_id` | FK to meal_schedules |
| `partner_earnings` | Correct `restaurant_id` | Matches meal's restaurant |
| `partner_earnings` | Correct `net_amount` | `payout_rate * (1 - commission_rate/100)` |
| `partner_payouts` | Correct `restaurant_id` | Matches partner's restaurant |
| `notifications` | Correct `user_id` | Partner notifications → partner user_id |
| `notifications` | Correct `type` | `new_order` or `order_update` |
| `favorites` | Correct `user_id` | Customer's own favorites |
| `carts` | Correct `user_id` | Customer's own cart |
| `user_addresses` | Correct `user_id` | Customer's own addresses |
| `subscriptions` | Correct `user_id` | Customer's own subscription |

**Orphan Record Checks**:
```sql
-- schedule_addons without valid schedule
SELECT sa.* FROM schedule_addons sa
LEFT JOIN meal_schedules ms ON sa.schedule_id = ms.id
WHERE ms.id IS NULL;

-- partner_earnings without valid restaurant
SELECT pe.* FROM partner_earnings pe
LEFT JOIN restaurants r ON pe.restaurant_id = r.id
WHERE r.id IS NULL;

-- notifications with invalid user_id
SELECT n.* FROM notifications n
LEFT JOIN profiles p ON n.user_id = p.id
WHERE p.id IS NULL;
```

**Duplicate Order Check**:
```sql
SELECT user_id, meal_id, scheduled_date, COUNT(*) as cnt
FROM meal_schedules
GROUP BY user_id, meal_id, scheduled_date
HAVING COUNT(*) > 1;
```

---

### Domain 20: Full End-to-End Scenarios

#### Scenario A: Happy Path — Browse → Order → Partner Receives
1. Customer opens `/meals`, browses restaurants
2. Customer opens `/restaurant/:id`, views menu
3. Customer opens `/meals/:id`, selects variant and add-ons
4. Customer adds to cart, goes to `/checkout`
5. Customer completes payment successfully
6. **Verify**: PartnerOrders shows new order with correct meal, variant, add-ons, address
7. **Verify**: NewOrderNotificationBanner appears with meal name
8. **Verify**: Audio alert plays
9. **Verify**: Toast notification appears
10. **Verify**: PartnerNotifications has `new_order` entry
11. **Verify**: PartnerDashboard stats update (active orders +1)

#### Scenario B: Scheduled Meals → Partner Dashboard
1. Customer schedules 5 meals for the week via `/schedule`
2. **Verify**: PartnerDashboard "Recent schedule" shows all 5
3. On each scheduled day, **verify**: PartnerOrders shows that day's meals
4. **Verify**: Statuses remain synchronized between portals

#### Scenario C: Reward/Discount → Partner Earnings
1. Customer applies reward/discount at checkout
2. Customer completes payment
3. **Verify**: Partner order shows correct gross amount (`payout_rate`)
4. **Verify**: PartnerEarningsDashboard shows correct net (`payout_rate * (1 - commission_rate/100)`)
5. **Verify**: Commission calculation is accurate
6. **Verify**: Partner is not underpaid (receives full `payout_rate` regardless of customer discount)

#### Scenario D: Payment Failure → No Partner Impact
1. Customer attempts checkout
2. Payment fails (simulated)
3. **Verify**: No order in PartnerOrders
4. **Verify**: No `partner_earnings` record
5. **Verify**: No notification created
6. **Verify**: No banner or audio alert
7. **Verify**: PartnerDashboard stats unchanged

#### Scenario E: Cancel → Partner Update
1. Customer places order successfully
2. Customer cancels order via `/order/:id` or `/schedule`
3. **Verify**: PartnerOrders status changes to "cancelled" (real-time)
4. **Verify**: Cancellation reason displayed
5. **Verify**: Action buttons hidden for cancelled order
6. **Verify**: Order excluded from active count
7. **Verify**: `partner_earnings` not created (or marked cancelled)
8. **Verify**: Partner notification created

#### Scenario F: Modify → Partner Update
1. Customer places order
2. Customer modifies order (change meal, add-ons, time, address)
3. **Verify**: PartnerOrders reflects all changes
4. **Verify**: Old data not displayed
5. **Verify**: Price/earnings recalculated
6. **Verify**: Partner notification created

#### Scenario G: Cross-Restaurant Security
1. Customer orders from Restaurant A
2. Restaurant B partner logs in
3. **Verify**: Restaurant B partner cannot see Restaurant A's order
4. **Verify**: Direct API call with Restaurant A's meal_id returns empty/403
5. **Verify**: RLS policies enforced at database level

#### Scenario H: Real-Time + Polling Fallback
1. Partner portal open on `/partner/orders`
2. Customer places order
3. **Verify**: Order appears within 2 seconds (real-time)
4. Disconnect real-time (simulate)
5. Customer places another order
6. **Verify**: Order appears within 10 seconds (polling fallback)
7. Reconnect real-time
8. **Verify**: Real-time resumes

---

## 3. Automated Test Recommendations

### 3.1 Playwright Test Structure

```typescript
// tests/e2e/integration/customer-to-partner.spec.ts

import { test, expect } from '@playwright/test';

// Test accounts (use test data, not production)
const CUSTOMER = { email: 'test-customer@nutrio.qa', password: '...' };
const PARTNER_A = { email: 'test-partner-a@nutrio.qa', password: '...' };
const PARTNER_B = { email: 'test-partner-b@nutrio.qa', password: '...' };

test.describe('Customer-to-Partner Integration', () => {
  
  test('D5: Checkout success creates partner order', async ({ browser }) => {
    const customerCtx = await browser.newContext();
    const partnerCtx = await browser.newContext();
    
    const customerPage = await customerCtx.newPage();
    const partnerPage = await partnerCtx.newPage();
    
    // Login as partner and navigate to orders
    await partnerPage.goto('/nutrio/partner/auth');
    // ... login flow
    await partnerPage.goto('/nutrio/partner/orders');
    
    // Login as customer and place order
    await customerPage.goto('/nutrio/auth');
    // ... login flow
    await customerPage.goto('/nutrio/meals');
    // ... select meal, checkout
    
    // Verify partner sees the order
    await expect(partnerPage.locator('text=New Order Received')).toBeVisible();
    await expect(partnerPage.locator('article')).toContainText('Test Meal');
  });
  
  test('D18: Cross-restaurant isolation', async ({ browser }) => {
    // Customer orders from Restaurant A
    // Restaurant B partner cannot see the order
  });
  
  test('D17: Real-time order appearance', async ({ browser }) => {
    // Partner page open, customer places order
    // Verify order appears without page refresh
  });
});
```

### 3.2 Key Selectors

| Element | Selector |
|---------|----------|
| PartnerOrders page | `article` (order cards) |
| NewOrderNotificationBanner | `.animate-fade-in` or `text=New Order Received` |
| Order status badge | `Badge` with status label |
| PartnerDashboard stats | `.grid-cols-2.lg\\:grid-cols-4` stat cards |
| PartnerNotifications | `article` with notification items |
| Checkout place order button | `[data-testid="checkout-place-order-btn"]` |
| Checkout back button | `[data-testid="checkout-back-btn"]` |

### 3.3 API-Level Tests (Supabase)

```typescript
// Test RLS directly
const { data, error } = await supabase
  .from('meal_schedules')
  .select('*')
  .eq('meal_id', '<other_restaurant_meal_id>');
// Should return empty for partner of different restaurant
expect(data).toHaveLength(0);

// Test real-time subscription
const channel = supabase
  .channel('test')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'meal_schedules' }, 
    (payload) => { /* verify payload */ })
  .subscribe();
```

---

## 4. Supabase Database Relationship Checklist

### 4.1 Core Order Flow Tables

```
restaurants (id, owner_id, name, payout_rate, commission_rate, is_active, approval_status)
    ↓
meals (id, restaurant_id, name, price, calories, image_url, is_available)
    ↓
meal_schedules (id, meal_id, user_id, scheduled_date, order_status, delivery_time_slot, 
                restaurant_note, delivery_type, delivery_fee, addons_total, is_completed)
    ↓
schedule_addons (id, schedule_id, addon_id, quantity)
    ↓
meal_addons (id, meal_id, name, price)
```

### 4.2 Financial Tables

```
meal_schedules (completed)
    ↓ (trigger)
partner_earnings (id, restaurant_id, order_id, gross_amount, platform_fee, net_amount, status)
    ↓ (admin process)
partner_payouts (id, restaurant_id, amount, period_start, period_end, status)
```

### 4.3 Notification Tables

```
meal_schedules (INSERT/UPDATE)
    ↓ (trigger or edge function)
notifications (id, user_id, type, title, message, status, data, created_at)
```

### 4.4 Customer Tables

```
profiles (id, full_name, email)
user_addresses (id, user_id, address_line1, city, is_default)
carts (id, user_id, items)
favorites (id, user_id, restaurant_id, meal_id)
subscriptions (id, user_id, tier, meals_per_week, status)
customer_wallets (id, user_id, balance)
wallet_transactions (id, wallet_id, amount, type)
```

---

## 5. RLS/Security Checklist

| # | Check | Status |
|---|-------|--------|
| 1 | `meal_schedules` RLS enabled | ✅ (20260510000001) |
| 2 | Partners can only see their restaurant's meal schedules | ✅ (via meal_id → restaurant_id chain) |
| 3 | `partner_earnings` RLS enabled | ✅ |
| 4 | `partner_payouts` RLS enabled | ✅ |
| 5 | `notifications` scoped to user_id | ✅ |
| 6 | `favorites` scoped to user_id | ✅ |
| 7 | `carts` scoped to user_id | ✅ |
| 8 | `user_addresses` scoped to user_id | ✅ |
| 9 | `subscriptions` scoped to user_id | ✅ |
| 10 | `customer_wallets` scoped to user_id | ✅ |
| 11 | `restaurants` partner-scoped (owner_id) | ✅ |
| 12 | `meals` partner-scoped (via restaurant_id) | ✅ |
| 13 | `orders` table RLS (if separate from meal_schedules) | ✅ |
| 14 | `support_tickets` scoped to user_id | ✅ |
| 15 | `meal_reviews` scoped appropriately | ⚠️ Verify |
| 16 | Direct API manipulation blocked | ✅ (RLS) |
| 17 | Inactive restaurant orders blocked | ⚠️ Verify frontend check |
| 18 | Hidden meal orders blocked | ⚠️ Verify frontend check |

---

## 6. Real-Time and Polling Fallback Checklist

| # | Check | Status |
|---|-------|--------|
| 1 | `partner-meal-schedules` channel active | ✅ PartnerOrders.tsx:356 |
| 2 | `partner-dashboard-rt` channel active | ✅ PartnerDashboard.tsx:99 |
| 3 | `partner-notifications-page` channel active | ✅ PartnerNotifications.tsx:41 |
| 4 | `new-order-notification-banner` channel active | ✅ NewOrderNotificationBanner.tsx:58 |
| 5 | Audio alert plays on new order | ✅ Mixkit sound, line 23-26 |
| 6 | Banner appears on new order | ✅ NewOrderNotificationBanner |
| 7 | Toast on status change | ✅ PartnerOrders.tsx:384-389 |
| 8 | Polling fallback (10s) | ✅ PartnerOrders.tsx:339 |
| 9 | No duplicate banners | ⚠️ Verify (state management) |
| 10 | No duplicate audio | ⚠️ Verify (audioRef reuse) |
| 11 | No duplicate toasts | ⚠️ Verify (toast dedup) |
| 12 | No duplicate order rows | ⚠️ Verify (setOrders replace) |
| 13 | Channel cleanup on unmount | ✅ (return () => removeChannel) |
| 14 | Real-time resumes after reconnect | ⚠️ Verify (Supabase auto-reconnect) |

---

## 7. Payment/Order/Invoice/Earnings Consistency Checklist

| # | Check | Formula/Verification |
|---|-------|---------------------|
| 1 | Gross amount = payout_rate | `restaurants.payout_rate` |
| 2 | Platform fee = gross * commission_rate% | `gross * (commission_rate / 100)` |
| 3 | Net amount = gross - platform_fee | `gross - platform_fee` |
| 4 | Subscription order → partner paid | Partner receives full payout_rate |
| 5 | Failed payment → no partner_earnings | No record created |
| 6 | Cancelled order → excluded from earnings | Status check |
| 7 | Modified order → earnings recalculated | New net_amount |
| 8 | Invoice total matches partner earnings | Cross-reference |
| 9 | Payout total = sum of net_amounts | Aggregation check |
| 10 | No duplicate earnings records | Unique constraint on order_id |

---

## 8. Bug Report Table

| # | Customer Action | Partner Impact | Page | Steps | Expected | Actual | Severity | Root Cause | Fix |
|---|----------------|----------------|------|-------|----------|--------|----------|------------|-----|
| | *To be populated during test execution* | | | | | | | | |

---

## 9. Readiness Scorecard

| Domain | Weight | Score (0-10) | Notes |
|--------|--------|-------------|-------|
| D1: Data Accuracy | 5% | - | |
| D2: Favorites → Analytics | 3% | - | |
| D3: Meal Selection → Order | 8% | - | |
| D4: Schedule → Partner | 8% | - | |
| D5: Checkout → New Order | 10% | - | |
| D6: Payment Failure Safety | 10% | - | |
| D7: Financial Calculations | 8% | - | |
| D8: Cancellation Flow | 8% | - | |
| D9: Modification Flow | 5% | - | |
| D10: Reorder Flow | 3% | - | |
| D11: Address Propagation | 3% | - | |
| D12: Subscription Credits | 5% | - | |
| D13: Completion Metrics | 3% | - | |
| D14: Support Tickets | 2% | - | |
| D15: Reviews/Ratings | 2% | - | |
| D16: Notification Independence | 3% | - | |
| D17: Real-Time Sync | 8% | - | |
| D18: Security/Scoping | 10% | - | |
| D19: DB Consistency | 5% | - | |
| D20: E2E Scenarios | 5% | - | |
| **TOTAL** | **100%** | **TBD** | |

**Readiness Score**: TBD / 100

---

## 10. Launch Decision

- [ ] **Ready to go live** — All domains ≥ 8/10, no critical blockers
- [ ] **Ready only after fixes** — Critical/high issues must be resolved
- [ ] **Not ready** — Multiple critical blockers, significant rework needed

---

## 11. Critical Blockers & High-Priority Fixes

### Critical Blockers (Must Fix Before Launch)

| # | Issue | Domain | Impact |
|---|-------|--------|--------|
| | *To be populated during test execution* | | |

### High Priority

| # | Issue | Domain | Impact |
|---|-------|--------|--------|
| | *To be populated during test execution* | | |

### Medium Priority

| # | Issue | Domain | Impact |
|---|-------|--------|--------|
| | *To be populated during test execution* | | |

---

## 12. Pre-Identified Concerns

Based on code review (without execution):

1. **PartnerOrders only shows TODAY's orders** (line 486: `.eq("scheduled_date", today)`). Future scheduled meals are invisible in PartnerOrders until their scheduled date. This is by design but should be documented.

2. **No separate "orders" table in partner flow**. Everything flows through `meal_schedules`. The `orders` and `order_items` tables exist but PartnerOrders reads from `meal_schedules`. Verify consistency between these tables.

3. **Partner phone is null** (line 230: `phone: null`). Customer phone number is not fetched from profiles (profiles has no phone column). Phone comes from `user_addresses.phone` only.

4. **Cancellation reason is hardcoded to null** (line 225: `cancellation_reason: null`). The `transformScheduleToOrder` function sets `cancellation_reason` to null regardless of actual data. Check if `meal_schedules` has a `cancellation_reason` column.

5. **Audio autoplay may be blocked** (line 77: `.play().catch(...)`). Browser autoplay policies may prevent audio. The catch handler logs a warning but doesn't provide user feedback.

6. **No partner visibility for support tickets**. Partner portal has no support page. Customer support tickets about orders may not be visible to partners.

7. **Favorites not reflected in partner analytics**. PartnerAnalytics.tsx does not query the `favorites` table. Partners cannot see how many customers favorited their restaurant/meals.

8. **Real-time channel filter limitation**. The `new-order-notification-banner` channel listens to ALL `meal_schedules` INSERTs and filters client-side by `mealIds`. This could be a performance concern at scale.

9. **Polling fetches all orders every 10 seconds** (line 339). This could be expensive. Consider only fetching new/modified orders.

10. **No idempotency key on order creation**. Rapid double-clicks could create duplicate `meal_schedules`.

---

## Appendix A: Test Data Setup

```sql
-- Create test partner
-- 1. Create partner user via Supabase Auth
-- 2. Create restaurant
INSERT INTO restaurants (id, owner_id, name, payout_rate, commission_rate, is_active, approval_status)
VALUES (gen_random_uuid(), '<partner_user_id>', 'Test Restaurant', 25.00, 18, true, 'approved');

-- 3. Create test meals
INSERT INTO meals (id, restaurant_id, name, price, calories, protein, carbs, fats, is_available)
VALUES 
  (gen_random_uuid(), '<restaurant_id>', 'Test Meal 1', 25.00, 450, 35, 40, 15, true),
  (gen_random_uuid(), '<restaurant_id>', 'Test Meal 2', 30.00, 550, 40, 50, 20, true);

-- 4. Create test add-ons
INSERT INTO meal_addons (id, meal_id, name, price)
VALUES (gen_random_uuid(), '<meal_id>', 'Extra Protein', 5.00);

-- Create test customer
-- 1. Create customer user via Supabase Auth
-- 2. Create profile, address, wallet
```

## Appendix B: Test Execution Commands

```powershell
# Run all E2E tests
npm run test:e2e

# Run specific integration test
npx playwright test tests/e2e/integration/customer-to-partner.spec.ts

# Run with UI
npm run test:e2e:ui

# Run with debug
npx playwright test --debug

# Check database consistency
npx supabase db diff --linked
```

## Appendix C: Key File Reference

| File | Purpose |
|------|---------|
| `src/pages/Checkout.tsx` | Customer checkout/payment flow |
| `src/pages/Schedule.tsx` | Customer meal scheduling |
| `src/pages/partner/PartnerOrders.tsx` | Partner order management |
| `src/pages/partner/PartnerDashboard.tsx` | Partner dashboard |
| `src/pages/partner/PartnerEarningsDashboard.tsx` | Partner earnings |
| `src/pages/partner/PartnerNotifications.tsx` | Partner notifications |
| `src/pages/partner/PartnerAnalytics.tsx` | Partner analytics |
| `src/components/partner/NewOrderNotificationBanner.tsx` | Real-time order banner + audio |
| `src/components/PartnerLayout.tsx` | Partner layout wrapper |
| `src/integrations/supabase/client.ts` | Supabase client config |
| `supabase/migrations/20260510000001_rls_policies_and_indexes.sql` | RLS policies |
| `supabase/migrations/20260221150000_comprehensive_business_model_fix.sql` | Business model |
| `supabase/migrations/20260226000008_fix_rls_and_security_issues.sql` | Security fixes |
