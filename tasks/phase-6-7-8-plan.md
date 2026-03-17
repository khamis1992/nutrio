# Fleet Portal — Phases 6, 7 & 8 Plan

## Existing foundations to build on
- `src/fleet/pages/OrderManagement.tsx` — dispatch page with queue + details panel
- `src/fleet/services/orderDispatch.ts` — `DispatchOrderRecord`, `DispatchDriverRecord`, `assignDispatchOrder`
- `src/fleet/lib/dispatchRecommendations.ts` — scoring engine with `DispatchRecommendation`
- `src/fleet/context/TrackingContext.tsx` — `useTracking()` gives live `DriverLocation[]` from WebSocket
- `src/fleet/types/fleet.ts` — `DriverLocation` has `latitude`, `longitude`, `driverId`, `driverName`, `isOnline`
- Leaflet already installed (`leaflet`, `leaflet/dist/leaflet.css`) — used in `LiveTracking.tsx`
- `src/fleet/services/orderDispatch.ts` — `subscribeToDispatchOrders` for realtime

---

## Phase 6 — Visual Dispatch (Mini Map in Dispatch Panel)

**Goal:** Operators see pickup, dropoff and all recommended driver pins on one small map inside
the Dispatch Details panel. Clicking a driver pin selects that driver in the list.

### Tasks

- [ ] **6-A · `DispatchMap` component**
  - Create `src/fleet/components/dispatch/DispatchMap.tsx`.
  - Renders a Leaflet map (same setup as `LiveTracking.tsx`: fix default icon, `DOHA_CENTER`).
  - Accepts props:
    - `pickupLat / pickupLng` — orange `📍` marker (restaurant/branch)
    - `dropoffLat / dropoffLng` — blue `📍` marker (customer delivery)
    - `drivers: Array<{ id, name, lat, lng, isTop }>` — green pin per driver; top-ranked gets a
      highlighted colour
    - `selectedDriverId` — highlighted ring on that driver's pin
    - `onDriverClick(driverId)` — fires when a driver pin is clicked
  - Map auto-fits bounds to include all pins.
  - Uses `useEffect` to add / update markers when props change (same pattern as `LiveTracking.tsx`
    `markers.current` ref map).
  - _Files: `DispatchMap.tsx` (new)_

- [ ] **6-B · Live driver positions from `TrackingContext`**
  - In `OrderManagement.tsx`, import `useTracking` from `@/fleet/context/TrackingContext`.
  - Merge WebSocket `DriverLocation[]` positions with the fetched `DispatchDriverRecord[]` using
    `driverId` as the key: if a live position exists, override `currentLat/currentLng` with the
    live values.
  - This keeps the recommendation scorer using the freshest coordinates without an extra query.
  - _Files: `OrderManagement.tsx`_

- [ ] **6-C · Embed map in Dispatch Details panel**
  - In `OrderManagement.tsx`, render `<DispatchMap />` inside the "Dispatch Details" card when an
    order is selected.
  - Pass `pickupLat/Lng` and `deliveryLat/Lng` from `selectedOrder`.
  - Map `selectedRecommendations.slice(0, 6)` to the driver pin list; mark index 0 as `isTop`.
  - Wire `onDriverClick` → `setSelectedDriverId` local state → highlight the matching
    recommendation card in the list (scroll it into view).
  - _Files: `OrderManagement.tsx`_

---

## Phase 7 — Auto-Dispatch Rules

**Goal:** Operators define simple rules ("auto-assign if order is ready > N min and nearest driver
is < X km"). The system evaluates them every 60 s and assigns without manual action.

### Tasks

- [ ] **7-A · Auto-dispatch rule storage (client-side)**
  - Add `AutoDispatchRule` interface to `src/fleet/services/orderDispatch.ts`:
    ```ts
    export interface AutoDispatchRule {
      id: string;
      enabled: boolean;
      triggerStatus: "ready_for_pickup" | "preparing";
      minWaitMinutes: number;      // fire only if order is older than this
      maxDriverDistanceKm: number; // only assign if top driver is within this distance
      label: string;
    }
    ```
  - Persist rules in `localStorage` under key `fleet_auto_dispatch_rules` (no DB migration
    needed for V1 — rules are per-operator session).
  - Add `loadAutoDispatchRules()` / `saveAutoDispatchRules()` helpers in `orderDispatch.ts`.
  - _Files: `orderDispatch.ts`_

- [ ] **7-B · Rule evaluation engine**
  - Create `src/fleet/lib/autoDispatch.ts`.
  - Export `evaluateAutoDispatchRules(rules, orders, recommendationMap, now)`:
    - For each enabled rule, find orders that match `triggerStatus` and have been waiting ≥
      `minWaitMinutes`.
    - For each matching order, look up its top `DispatchRecommendation`; if
      `distanceKm ≤ maxDriverDistanceKm` and driver is not overloaded, return an
      `AutoDispatchAction { orderId, driverId, ruleName }`.
    - Returns an array of actions to execute (de-duped by orderId — first rule wins).
  - _Files: `autoDispatch.ts` (new)_

- [ ] **7-C · Rule runner in `OrderManagement.tsx`**
  - Add a `useEffect` with a 60 s interval that calls `evaluateAutoDispatchRules`.
  - For each returned action, call `assignDispatchOrder` automatically and show a toast:
    `"Auto-assigned [meal] → [driver] (Rule: [ruleName])"`.
  - Write `action = 'auto_assigned'` in the `reason` field passed to `assignDispatchOrder`.
  - _Files: `OrderManagement.tsx`_

- [ ] **7-D · Auto-dispatch settings UI page**
  - Create `src/fleet/pages/AutoDispatchSettings.tsx`.
  - Simple page with a list of rules (editable inline cards): label, status toggle, trigger,
    minWaitMinutes slider (0–30), maxDriverDistanceKm slider (0–15).
  - Add / remove rules. Save to `localStorage` via `saveAutoDispatchRules`.
  - Add route `/fleet/auto-dispatch` in `routes.tsx` and a nav item "Auto Dispatch" (with a
    `Zap` icon) in `FleetLayout.tsx` sidebar.
  - _Files: `AutoDispatchSettings.tsx` (new), `routes.tsx`, `FleetLayout.tsx`_

---

## Phase 8 — Driver Reliability Scoring

**Goal:** Each driver gets a computed reliability score based on GPS freshness, stale-location
frequency, and historical on-time delivery rate. The score replaces the raw star rating as the
primary dispatch signal.

### Tasks

- [ ] **8-A · `computeReliabilityScore` utility**
  - Create `src/fleet/lib/reliabilityScore.ts`.
  - Export `computeReliabilityScore(driver: DispatchDriverRecord): ReliabilityScore`:
    - **GPS freshness** (30 pts): 30 if `locationAgeMinutes < 3`, scaling to 0 at 15 min.
    - **Active-job load** (20 pts): 20 if 0 jobs, 10 if 1, 0 if ≥ 2.
    - **Star rating** (30 pts): `min(driver.rating, 5) / 5 * 30`.
    - **Delivery volume** (20 pts): `min(driver.totalDeliveries / 100, 1) * 20`.
    - Returns `{ score: 0–100, tier: "green" | "amber" | "red", label: string }`.
  - _Files: `reliabilityScore.ts` (new)_

- [ ] **8-B · Integrate score into `dispatchRecommendations.ts`**
  - Import `computeReliabilityScore` and add `reliabilityScore`, `reliabilityTier` to
    `DispatchRecommendation`.
  - Replace the current `driver.rating * 2` scoring fragment with the reliability score
    contribution: `score += reliabilityScore * 0.3`.
  - _Files: `dispatchRecommendations.ts`_

- [ ] **8-C · Reliability badge on recommendation cards**
  - In `OrderManagement.tsx`, add a colour-coded `ReliabilityBadge` component (inline, small):
    - Green: "Reliable"
    - Amber: "Moderate"
    - Red: "Low reliability" + tooltip with breakdown
  - Show it next to the driver name on each recommendation card.
  - _Files: `OrderManagement.tsx`_

- [ ] **8-D · Assign-block warning for red-tier drivers**
  - In `handleAssign`, if the selected driver has `reliabilityTier === "red"`, show a
    confirmation dialog (`window.confirm`) before proceeding:
    `"This driver has a low reliability score. Are you sure you want to assign them?"`
  - _Files: `OrderManagement.tsx`_

---

## Implementation order (recommended)
Phase 6 → Phase 7 → Phase 8

Each phase is self-contained. Complete and verify typecheck before starting the next.

### Key constraint
Phase 6 requires Leaflet already installed ✅  
Phase 7 stores rules in `localStorage` — no DB migration needed for V1  
Phase 8 is pure frontend computation — no new tables or API calls

---

## Review
*(To be filled after implementation)*
