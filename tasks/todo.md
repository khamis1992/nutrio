# Fleet ↔ Partner Portal Integration Fix Plan

## Problem Summary

The two portals operate on two separate order tables with no bridge:

| Portal | Order Table | Status Field |
|--------|------------|-------------|
| Partner | `meal_schedules` | `order_status` (pending → confirmed → preparing → ready → out_for_delivery → delivered) |
| Fleet | `orders` | `status` (preparing → ready_for_pickup → assigned → ...) |

`delivery_jobs.schedule_id` has a FK to `meal_schedules.id` — but the fleet writes `orders.id` into it, breaking the handoff loop.

**Three broken connections:**
1. Partner marks order "ready" → fleet never sees it in dispatch queue
2. Fleet assigns a driver → partner handoff screen stays blank ("Waiting for driver")
3. Fleet marks order "picked up" → partner status stays stuck at "ready"

---

## Fix Plan — 4 Phases

---

### Phase 1 — Fleet dispatch queue reads `meal_schedules` orders
**Goal:** When a partner marks an order `ready`, it appears in the fleet Dispatch Center (Live Queue tab).

**What to change:**
- `src/fleet/services/orderDispatch.ts` → `getDispatchOrders()`
  - Add a second query to `meal_schedules` for records with `order_status = 'ready'`
  - Map `meal_schedules` rows into the same `DispatchOrderRecord` shape as `orders` rows
  - Tag each record with a `source: "meal_schedule" | "order"` field so assignment logic knows which table to update
- `src/fleet/services/orderDispatch.ts` → `subscribeToDispatchOrders()`
  - Add a second Supabase Realtime channel listening to `meal_schedules` for `order_status` changes to/from `ready`

**Files changed:** `orderDispatch.ts` only  
**No DB migration needed**

---

### Phase 2 — Fleet assignment writes correct `schedule_id` and updates `meal_schedules`
**Goal:** When fleet assigns a driver to a `meal_schedules` order, the delivery job gets the correct FK and the partner portal sees it.

**What to change:**
- `src/fleet/services/orderDispatch.ts` → `assignDispatchOrder()`
  - Accept a `source` parameter on the order record
  - If `source === "meal_schedule"`:
    - Insert `delivery_jobs` with `schedule_id = meal_schedule.id` (correct FK)
    - Update `meal_schedules.order_status = 'out_for_delivery'` after job is created
  - If `source === "order"` (existing logic): keep current behaviour unchanged

**Files changed:** `orderDispatch.ts` only  
**No DB migration needed** — the FK already points to `meal_schedules`

---

### Phase 3 — Partner handoff screen shows the fleet-assigned driver in real time
**Goal:** Partner sees driver name, phone, rating, live ETA the moment fleet assigns — zero refresh.

**What is already built:** `PartnerDeliveryHandoff` component already:
- Queries `delivery_jobs` filtered by `schedule_id`
- Has a Supabase Realtime subscription on that same filter
- Displays driver name, phone, rating, QR code, pickup verification code

**After Phase 2 is done this already works** — because Phase 2 now writes the correct `meal_schedules.id` as `schedule_id`, so the partner's existing real-time filter matches.

**No code changes needed in Phase 3** — it is a free win from Phase 2.

---

### Phase 4 — Fleet picks up order → partner status advances automatically
**Goal:** When a driver marks an order picked up or delivered, the partner's `meal_schedules.order_status` advances without any manual action.

**What to change:**
- `src/fleet/services/orderDispatch.ts` — add a new exported function `syncMealScheduleStatus(scheduleId, newStatus)` that writes to `meal_schedules.order_status`
- Call it from the places that update `delivery_jobs.status`:
  - `picked_up` → set `meal_schedules.order_status = 'out_for_delivery'`
  - `delivered` / `completed` → set `meal_schedules.order_status = 'delivered'`

**Alternative (cleaner, no frontend change):** Add a Postgres trigger on `delivery_jobs.status` that automatically updates `meal_schedules.order_status` when the job status changes. This keeps the sync in the DB layer.

**Recommended approach:** DB trigger (one migration file, zero frontend code)

---

## Task List

- [ ] **P1-A** — `getDispatchOrders()`: add `meal_schedules` query for `order_status = 'ready'`
- [ ] **P1-B** — Map `meal_schedules` rows into `DispatchOrderRecord` shape with `source = "meal_schedule"`
- [ ] **P1-C** — `subscribeToDispatchOrders()`: add second realtime channel for `meal_schedules`
- [ ] **P2-A** — `assignDispatchOrder()`: branch on `source` to use correct table for `delivery_jobs` insert
- [ ] **P2-B** — After insert, update `meal_schedules.order_status = 'out_for_delivery'`
- [ ] **P4-A** — Write DB migration: trigger on `delivery_jobs.status` → syncs `meal_schedules.order_status`

> Phase 3 requires no work — it works automatically once Phase 2 is done.

---

## What does NOT need changing

| Thing | Reason |
|-------|--------|
| `PartnerDeliveryHandoff` component | Already correct — queries `delivery_jobs` by `meal_schedules.id`, has real-time sub |
| `PartnerOrders` real-time subscription | Already subscribes to `meal_schedules` UPDATE events — will fire on Phase 2/4 writes |
| Driver data | Both portals already read the same `drivers` table |
| Restaurant/branch data | Already shared correctly |
| Payout systems | Separate by design, no change needed |
| `orders` table flow | Unchanged — existing on-demand order path keeps working |
