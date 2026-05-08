# Nutrio — Architecture & Testing Audit

Scope: architecture, state management, routing, service layer, error handling, testing strategy, mobile/web parity. Read-only audit.

---

## HEALTH SUMMARY

| Metric | Value | Status |
|---|---|---|
| Total `.ts/.tsx` source files (src/) | ~470+ | — |
| Unit/component test files (`*.test.*` in src/) | **35** | Low |
| Integration test files (`src/test/integration`) | 1 | Very low |
| E2E spec files (Playwright, `e2e/`) | **~95** | Very high |
| Test ratio (unit tests : src files) | ~**1 : 13** (~7.4%) | Unhealthy |
| Test pyramid shape | **Inverted / top-heavy** (95 E2E vs 35 unit) | Risk |
| Coverage thresholds (vitest) | 60% lines / 50% branches | Modest |
| Routes (App.tsx) | ~80 routes (4 portals + fleet) | — |
| Lazy-loaded routes | **Yes — ~all of them**; only `Auth` + `NotFound` eager | Good |
| Auth guard | `<ProtectedRoute>` (consistent) + `<ProtectedFleetRoute>` (separate) | Mixed |
| Error boundaries | 4 components (Sentry, Route, Dashboard, Development) | Good base |
| Error boundary coverage | 1 top-level (Sentry) + 1 route-level. **No per-portal/page boundaries.** | Partial |
| Toast/notification systems | **TWO competing**: `sonner` (50 files) + Radix `useToast` (109 files) | Inconsistent |
| State management | React Query + 7 Contexts. **No zustand** (despite claims). | Mostly OK |
| Direct `supabase.from(...)` callsites | **107 files** (incl. ~40 components, ~25 pages) | Severe leak |
| `services/` directory | Only **8 files** (anemic) | Underused |
| Capacitor wrapper (`lib/capacitor.ts`) | Single, well-isolated `isNative` gate | Excellent |
| Test setup quality (`vitest.config.ts`) | Good (jsdom, MSW, per-file thresholds, mocks) | Good |

---

## Top Findings

### 1. [Critical] Service layer is bypassed — Supabase is called directly from 107 files
**Affected:** `src/components/**` (61 calls in 20 components), `src/pages/**` (56 calls in 20 pages, plus all admin/partner/driver portals), `src/hooks/**`.

**Observation:** `src/services/` contains only 8 files (`walletService.ts`, `translationService.ts`, `blood-work.ts`, etc.). Yet 107 files import `supabase` and call `supabase.from(...)`, `supabase.auth.*`, `supabase.rpc(...)`, `supabase.storage.*`, or `supabase.functions.*` directly. Components such as `LogMealDialog.tsx` (9 calls), `AvatarUpload`, `MealReviewForm`, `MealAddonsManager`, and pages like `AdminPayouts`, `DeliveryTracking`, `DriverDashboard` embed query logic, error mapping, and DB schema knowledge in the UI layer.

**Risk:** Schema changes ripple through dozens of UI files. RLS/permission bugs surface as toast spam in random components. Impossible to swap or mock the data layer cleanly. Components are not testable without a Supabase mock at every callsite. Caching, retry, optimistic updates, and audit logging cannot be enforced.

**Recommendation:** Establish a thin repository layer (e.g., `src/services/{meals,orders,subscriptions,users,...}.ts`) that owns all Supabase calls. Components/pages call hooks; hooks call services; services call Supabase. Forbid `import { supabase } from '@/integrations/supabase/client'` outside `src/services/**` and `src/hooks/**` via an ESLint `no-restricted-imports` rule. Migrate incrementally per feature domain.

---

### 2. [Critical] Inverted test pyramid — 95 E2E specs, 35 unit tests, 1 integration test
**Affected:** `src/**`, `e2e/**`, `tests/**`.

**Observation:** Playwright has **~95 spec files** spanning admin (21), customer (22), partner (14), driver (9), cross-portal (10), and system (13). Vitest has **only 35** unit/component tests against 470+ source files (~7% coverage by file count). `src/test/integration/` contains a single file (`critical-flows.test.tsx`). The shape is upside-down: most assertions live in slow, flaky, environment-dependent E2E tests.

**Risk:** Test runs are slow and brittle. Bugs only caught at the browser-driving layer have ambiguous root causes. PRs are not gated by meaningful unit feedback. Refactoring is dangerous because individual modules are uncovered. Vitest coverage threshold (60% lines) will be impossible to meet without either dropping the threshold or writing many more unit tests.

**Recommendation:** Freeze E2E count and write unit tests for the next quarter. Target: every hook (60+ exist, only ~10 tested), every reducer/calculator (`nutrition-calculator.ts`, `taste-profile-calculator.ts`, `meal-plan-generator.ts`, `payment-simulation.ts` — none tested), and every service (services/* are completely untested). Keep E2E narrow: one happy path per portal + critical money flows.

---

### 3. [High] Two competing toast systems used in parallel
**Affected:** Every UI surface — 109 files import the Radix `useToast` / `@/hooks/use-toast`, 50 files import `sonner` directly. `App.tsx` mounts BOTH `<Toaster from sonner />` and `<RadixToaster />`.

**Observation:** Some files (e.g. `LogMealDialog.tsx` with 15 toast occurrences, `AdminNotifications.tsx` with 16, `AdminPayouts.tsx` with 13) mix the two within a single component. The codebase has both `src/hooks/use-toast.ts` and `src/components/ui/use-toast.ts` plus `src/components/ui/toaster.tsx` and `src/components/ui/sonner.tsx`.

**Risk:** Two toast stacks render at the same time; styling, dismiss timing, and accessibility behavior diverge. Users see double toasts or missed toasts depending on which API a developer chose. Future migrations and A11y fixes have to be done twice.

**Recommendation:** Pick **one** (sonner is lighter and already imported in `App.tsx` first). Codemod all `useToast()` callsites to the chosen API, delete the unused `Toaster`/`use-toast` files, and add a lint rule banning the deprecated import.

---

### 4. [High] `<ProtectedRoute>` performs DB queries on every route mount
**Affected:** `src/components/ProtectedRoute.tsx`.

**Observation:** Each protected navigation triggers `checkTableExists()` calls (with 3s timeouts) plus 2–4 parallel Supabase queries (`user_roles`, `restaurants`, `drivers`, `fleet_managers`) plus a realtime subscription on `user_roles`. There is a 60-second in-memory cache, but it is shared module-state and clears on hard reload. There is also a 5-second hard timeout that, when hit, sets `userRoles = []` and silently denies access.

**Risk:** Sluggish navigation, especially on cold cache or flaky networks. The "table exists" probe runs identical queries the schema makes inevitable — it leaks DB schema fragility into routing. Realtime channel `user_roles_rt_${user.id}` opens/closes on every mount of any protected route, churning websocket subscriptions. The 5s timeout silently masks legitimate auth failures.

**Recommendation:** Move role lookup into `AuthContext` so it runs **once** on session change and is reused everywhere. Drop the `checkTableExists` probes — handle missing-table errors as actual errors, not preflight checks. Replace the silent timeout fallback with a visible error state.

---

### 5. [High] `pages/` directory mixes flat customer routes with portal subdirectories
**Affected:** `src/pages/`.

**Observation:** Customer pages live at the root (`Dashboard.tsx`, `Meals.tsx`, `Schedule.tsx`, `Profile.tsx`, ~40 files) while portal pages are nested (`pages/admin/*` 30 files, `pages/partner/*` 15, `pages/driver/*` 13). There is no `pages/customer/` for parity. Some features are split between root and subfolder (`Progress.tsx` vs `pages/progress/BodyProgressDashboard.tsx`, `Subscription.tsx` vs `pages/subscription/SubscriptionPlans.tsx`, `Dashboard.tsx` vs `pages/dashboard/NutritionDashboard.tsx`). Two competing implementations exist for Progress (`Progress.tsx` and `ProgressRedesigned.tsx` — only the latter is wired into the route).

**Risk:** Hard to reason about ownership. The flat customer area will keep growing and competing with the per-portal subfolders. Dead code accumulates (`Progress.tsx` appears unreferenced).

**Recommendation:** Move customer pages under `pages/customer/`. Delete `Progress.tsx` after confirming nothing imports it. Adopt one convention: `pages/<portal>/<feature>.tsx`.

---

### 6. [High] Hooks directory has become the de-facto service layer (60+ hooks, ~10 tested)
**Affected:** `src/hooks/`.

**Observation:** 60+ hooks in a single flat directory, many of which contain Supabase queries, business logic, and toast side effects mixed together (e.g., `useReorder.ts:8 supabase calls`, `useSubscriptionFreeze.ts:6`, `useMealReviews`, `useScheduledMealNotifications.tsx`). Only ~10 of 60+ have tests. There is no domain grouping (`hooks/orders/`, `hooks/subscription/`).

**Risk:** Logic that should live in a service is locked inside a React hook and cannot be reused from a service worker, edge function, CLI, or even another hook. Testing requires rendering React. Domains bleed into each other.

**Recommendation:** Split hooks per domain folder. For each hook with side effects, extract the pure logic into a service module and keep the hook as a thin React adapter. Backfill tests for the pure modules first.

---

### 7. [Medium] Error boundaries are sparse for a 4-portal app
**Affected:** `src/main.tsx`, `src/App.tsx`, `src/components/{Sentry,Route,Dashboard,Development}ErrorBoundary.tsx`.

**Observation:** There is one global `<SentryErrorBoundary>` in `main.tsx` and one `<RouteErrorBoundary>` wrapping `<Routes>`. `<DashboardErrorBoundary>` exists but is only used inside the Dashboard. There are no per-portal boundaries (admin, partner, driver, fleet) and no boundaries around expensive widgets (charts, maps, recharts panels). When any chart in a partner analytics page throws, the whole route trips the route boundary and the user sees the generic "Something went wrong" screen.

**Risk:** A single faulty widget in a partner dashboard takes down the entire page. UX is poor and Sentry signal is noisier (one error blanks the whole tree).

**Recommendation:** Wrap each portal layout (`PartnerLayout`, `AdminLayout`, `DriverLayout`, `FleetLayout`) with its own boundary. Wrap heavy/3rd-party widgets (Mapbox, Leaflet, Recharts panels) with `<DashboardErrorBoundary name="…">`. Each level reports to Sentry with a `component` tag for triage.

---

### 8. [Medium] Sentry `beforeSend` PII filter masks email but leaks user ID hash
**Affected:** `src/lib/sentry.ts`.

**Observation:** `beforeSend` deletes `event.user.email` and `event.user.ip_address` (good), but `setUserContext` sends `email: ${userId}@user.local` — a deterministic email-shaped string derived from the Supabase user UUID. This is technically not PII, but it's misleading: it looks like an email and could pollute downstream tooling that auto-detects email columns. `tracesSampleRate: 1.0` and `replaysOnErrorSampleRate: 1.0` will be very expensive at production volume.

**Risk:** Sentry quota burn at scale (every transaction sampled, every error gets a session replay). The fake-email pattern is a footgun.

**Recommendation:** Set `tracesSampleRate` to `0.1` (or a `tracesSampler` based on transaction name). Set `replaysOnErrorSampleRate` lower for non-critical errors. Use Sentry `setUser({ id: userId })` only — drop the synthetic email entirely.

---

### 9. [Medium] Fleet portal is a parallel mini-app with its own auth and conventions
**Affected:** `src/fleet/` (own `routes.tsx`, `context/FleetAuthContext`, `services/fleetApi.ts`, `pages/`, `components/`, `hooks/`).

**Observation:** The fleet portal has a separate auth provider, its own `ProtectedFleetRoute`, its own services, and its own routes file injected into `App.tsx` via `{fleetRoutes}`. This is the **only** portal that follows a clean DDD-ish slice (services + hooks + components + pages co-located). Ironically the rest of the app would benefit from copying this structure.

**Risk:** Two auth systems (`AuthContext` + `FleetAuthContext`) increase the chance of one being out of sync (token refresh, logout cascade). Knowledge silos: a developer working on fleet doesn't see partner code and vice versa.

**Recommendation:** Either fold `FleetAuthContext` into `AuthContext` with a `fleet_manager` role check (the role already exists in `ProtectedRoute.UserRole`), or apply the fleet folder structure to the other portals (`src/admin/`, `src/partner/`, `src/driver/`, `src/customer/`).

---

### 10. [Low] Mobile/web parity is well-handled; one minor leak
**Affected:** `src/integrations/supabase/client.ts`, `src/lib/capacitor.ts`, `src/main.tsx`, `src/contexts/AuthContext.tsx`.

**Observation:** The Capacitor integration is **the strongest part of the architecture**. `lib/capacitor.ts` exposes typed wrappers (`haptics`, `statusBar`, `pushNotifications`, `biometricAuth`, etc.) that all check `isNative` first and no-op on web. The Supabase client cleanly swaps storage to Capacitor `Preferences` on native (with the critical `isAsyncStorage: true` flag). Only 14 files reference Capacitor APIs directly — all in plumbing layers.

**Minor leak:** `App.tsx` hardcodes `<BrowserRouter basename="/nutrio">` which is web-deployment specific and may cause routing issues on native (where there is no `/nutrio` path). `src/components/NativeRouteRedirect.tsx` exists, suggesting workarounds. `App.css` and `index.css` are imported globally without Capacitor-conditional safe-area / status-bar inset handling.

**Risk:** The basename will silently mis-handle deep links on iOS/Android (`@capacitor/app` `appUrlOpen` events would need to strip `/nutrio`). Web-only assumptions could leak.

**Recommendation:** Make `basename` conditional: `basename={isNative ? '/' : '/nutrio'}`. Audit any `window.location.*` and `document.cookie` usage for native-safety. Add a single integration test that mounts the app with `Capacitor.isNativePlatform = () => true` and verifies it boots.

---

## Strengths to preserve

- **Lazy loading is comprehensive** — almost every route uses `lazy()`, with a single `<PageLoader>` Suspense fallback. Good code splitting story.
- **Capacitor isolation** is exemplary; copy this pattern for Supabase.
- **Vitest config** has per-file coverage thresholds (rare and good); MSW is wired up; `setup.ts` mocks `matchMedia`, `IntersectionObserver`, `ResizeObserver`, `scrollTo` correctly.
- **React Query** is the consistent server-state choice (no zustand redux duplication despite the global `CLAUDE.md` claim).
- **Auth context** correctly subscribes BEFORE calling `getSession()` and has a safety timeout — a common Supabase footgun avoided.

## Action priority (top 3)

1. **Build a real service layer** and forbid direct Supabase imports outside it (Finding 1) — single biggest leverage point.
2. **Flip the test pyramid**: pause E2E expansion, write unit tests for every untested hook and pure module (Finding 2).
3. **Pick one toast system and migrate** (Finding 3) — small effort, high consistency win.
