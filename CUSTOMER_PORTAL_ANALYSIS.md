# Nutrio Fuel — Customer Portal Deep Analysis & Improvement Roadmap

> **Date:** Fri May 22 2026
> **Scope:** Customer Portal only (ignores Admin, Partner, Driver, Fleet, DevOps)
> **Methodology:** Code audit, UX heuristic evaluation, architecture review, and product analytics inference.

---

## Table of Contents

1. [Phase 1 — Understand the Product](#phase-1--understand-the-product)
2. [Phase 2 — Analyze UX](#phase-2--analyze-ux)
3. [Phase 3 — Architecture Understanding](#phase-3--architecture-understanding)
4. [Phase 4 — Improvement Recommendations](#phase-4--improvement-recommendations)
5. [Phase 5 — Prioritized Roadmap](#phase-5--prioritized-roadmap)

---

## Phase 1 — Understand the Product

### 1. What Is This Product?

**Nutrio Fuel** is a Qatar-centric, mobile-first health-tech marketplace that combines a **healthy meal delivery app** with a **personalized nutrition tracker** to create a closed-loop wellness experience. It is a multi-sided platform connecting health-conscious consumers with restaurant partners and delivery drivers. The customer portal is the demand-side application where users discover meals, track macros, manage subscriptions, schedule deliveries, and monitor health progress.

### 2. Who Are the Users?

- **Primary: "Health-Conscious Hadi/Hala"** — Adults 18–45 in Qatar, bilingual (EN/AR), gym-goers or dieters who want convenient healthy food with macro tracking.
- **Secondary: "Fitness Professional"** — Users with strict diets (Keto, High Protein, Vegan) who need precise macro control, blood-work tracking, and AI-driven goal adjustments.
- **Tertiary: "Referrer/Influencer"** — Socially active users participating in the multi-tier affiliate program to earn commissions.

### 3. Primary User Goals

1. **Track Daily Nutrition & Macros** — Log meals, water, steps, and weight to stay within calorie/protein targets.
2. **Discover & Order Healthy Meals** — Browse restaurants, filter by diet, view macros, and schedule deliveries.
3. **Schedule Weekly Meals** — Plan breakfast, lunch, dinner, and snacks days in advance.
4. **Achieve Health Goals** — Lose weight, gain muscle, or maintain via adaptive nutrition targets and weekly reports.
5. **Manage Subscription & Wallet** — Subscribe to weekly/monthly/Unlimited plans, freeze/upgrade, top up wallet.
6. **Stay Consistent & Motivated** — Maintain logging streaks, earn XP/badges, claim streak rewards, and get AI insights.
7. **Track Deliveries** — Real-time driver location, delivery status, and ETA.

### 4. Main User Flows

- **First-Time Activation:** App Open → Welcome → Sign Up (Qatar IP gate) → 5-step Onboarding (Goal, Gender, Metrics, Activity, Diet) → Plan Computation → Dashboard.
- **Daily Engagement Loop:** Dashboard (Greeting + Nutrition Ring) → Log Meal / Browse Restaurants → Schedule Meal → Order Confirmation → Live Tracking.
- **Subscription Monetization:** Dashboard/Profile → Subscription Plans → Compare Plans → Checkout (Card/Sadad/Wallet) → Success → Active Subscriber.
- **Retention & Support:** Dashboard → AI Insights / Smart Adjustments → Apply Goal Changes → Weekly PDF Report → Settings → Dietary Updates.

### 5. Business Problems Solved (AARRR)

| Stage | Problem | Solution |
|-------|---------|----------|
| **Acquisition** | Geo-limited growth; high CAC | Qatar-only IP check; affiliate/referral program with multi-tier commissions |
| **Activation** | Users abandon before seeing value | 5-step onboarding computes personalized nutrition plan in ~1 min with visual macro donut chart |
| **Retention** | Sticking to goals is hard | Gamification (streaks, XP, badges), adaptive AI adjustments, weekly reports, push notifications, rollover credits |
| **Revenue** | Recurring revenue predictability | Weekly/Monthly/Unlimited subscriptions, wallet top-ups with bonuses, annual billing ("Pay 10, Get 12"), cancellation flow with retention offers |
| **Referral** | Organic growth | Affiliate leaderboard, tiered commissions, milestone bonuses, shareable referral links |

### 6. Most Important Screens

| # | Screen | Why Critical |
|---|--------|--------------|
| 1 | **Auth (Welcome/Sign-Up)** | First impression; brand promise; single entry gate |
| 2 | **Onboarding** | Collects health data to personalize everything; highest drop-off risk |
| 3 | **Dashboard** | Daily home screen; nutrition rings, streaks, active orders, primary CTA |
| 4 | **Meals / Restaurants** | Discovery engine for revenue; category chips, calorie filters, favorites |
| 5 | **Meal Detail** | Conversion decision point; macros, allergens, scheduling CTA |
| 6 | **Schedule** | Core habit-building tool; weekly planning and visualization |
| 7 | **Checkout** | Revenue gate; multiple payment methods (Sadad, Apple/Google Pay, Wallet) |
| 8 | **Subscription Plans** | Upsell/retention; plan comparison, freeze/reactivate, annual savings |
| 9 | **Progress / Tracker** | Retention driver; weight forecasting, smart adjustments, weekly reports |
| 10 | **Live Map / Delivery Tracking** | Post-purchase delight; real-time driver location and ETA |

### 7. Conversion Funnel

```
Visitor
 └── [Auth Welcome] → Sign Up (Qatar IP validated)
   └── [Onboarding] → Personalized Plan Computed
     └── [Dashboard] → "Subscribe" or "Browse Meals"
       ├── Path A: Subscribe → Plans → Checkout → Active Subscriber
       └── Path B: Browse Meals → Meal Detail → Add to Schedule
         ├── Unsubscribed user → Blocked by "Subscribe to Order" gate
         └── Subscribed user → Schedule Success → Live Tracking → Delivered
              └── Repeat Loop (Retention: streaks, rollover credits, AI adjustments)
```

**Key Gates:** Geo-gate (signup), Subscription-gate (ordering), Meal-limit gate (weekly caps), Checkout gate (payment).

### 8. Most Important Actions (CTAs)

| Action | Location | Business Value |
|--------|----------|----------------|
| **"Create Free Account"** | Auth Welcome | Acquisition |
| **"Log Meal"** | Dashboard (primary button) | Engagement, data generation, streak maintenance |
| **"Add to Schedule"** | Meal Detail | Revenue conversion, subscription utilization |
| **"Subscribe" / "Upgrade"** | Subscription Plans | Recurring revenue |
| **"Pay / Top Up"** | Checkout | Immediate revenue |
| **"Apply Adjustments"** | Dashboard / Progress | Retention via personalization |
| **"Schedule Delivery"** | Schedule Page | Habit formation |
| **"Share Referral Link"** | Affiliate Page | Organic acquisition |

### Product Summary

Nutrio Fuel is a Qatar-focused "food + fitness" super-app. On the demand side, customers complete a guided onboarding that calculates personalized calorie and macro targets based on BMR/TDEE equations. They land on a dashboard designed for daily engagement: nutrition rings, streak counters, meal logging, and featured restaurant carousels. The platform monetizes through tiered meal subscriptions (Elite, Healthy, Fresh, Weekly, VIP Unlimited), wallet top-ups with bonus incentives, and a hardened cancellation flow offering pauses, discounts, and downgrades. On the supply side, Nutrio operates Partner, Driver, Admin, and Fleet portals—all powered by Supabase with AI-driven adaptive goal engines and real-time delivery tracking.

### User Journey Summary

1. **Discovery:** Referral link, social media, or app store.
2. **Onboarding:** Animated welcome → Qatar-only signup → 5-step health questionnaire → BMR/TDEE computation → donut chart plan → Dashboard.
3. **Daily Loop:** Log breakfast (manual or AI camera scan) → nutrition ring updates → streak maintained → XP earned.
4. **Meal Ordering:** Browse by category → filter by calories/favorites → schedule for tomorrow → confirm address.
5. **Payment:** Capped plan deducts weekly quota; out-of-meals prompts upgrade → checkout via credit card, Sadad, Apple/Google Pay, or wallet.
6. **Delivery:** Order pipeline: Preparing → Driver Assigned → En Route → Delivered; live map available.
7. **Progress Check:** Weekly charts, PDF report download, smart macro adjustment suggestions.
8. **Retention:** Streak rewards (7/30/60/90 days), rollover credits, cancellation flow with pause/discount offers.

### Feature Map (Customer-Facing)

- **Auth & Security:** Biometric login (Face ID/Fingerprint), OTP recovery, role-based routing, session timeout, "Remember me".
- **Onboarding:** 5-step wizard (goal, gender, body metrics with drag rulers, activity, dietary preferences), auto-save draft with recovery dialog, BMR/TDEE calculation, macro computation, animated loading + plan summary donut chart.
- **Dashboard:** Dynamic greeting, nutrition progress ring, streak counter, active order banner, "Order Again" row, featured restaurants horizontal scroll, primary "Log Meal" CTA, AI Insights collapsible section.
- **Meals & Restaurants:** Category chips (Breakfast, Lunch, Dinner, Snacks, Desserts, Beverages), search with clear, filter sheet (sort, calories, favorites), dual grid view (restaurants or meals), macro dots, availability overlays.
- **Meal Detail & Scheduling:** Full nutrition facts, allergen alerts, VIP badge, date/address selection, subscription gating.
- **Schedule:** Weekly calendar, day meal slots, mark complete/not done, delivery time setter, pull-to-refresh.
- **Nutrition Tracking:** Log Meal Dialog (manual, AI photo scan, barcode, recent), Water Tracker, Step Counter, Weight Tracking with AI 4-week forecast, Activity Logger (MET-based).
- **Progress & Goals:** Weekly charts, consistency score, smart adjustments, goal editing, milestones, weekly PDF report.
- **Subscription & Billing:** Plan comparison, monthly vs annual toggle, upgrades/downgrades/freezes (up to 14 days), cancellation flow with retention offers, auto-renewal, rollover credits, meals remaining widget.
- **Wallet & Checkout:** Balance display, top-up packages, transaction history, payment method selector (Card, Sadad, Apple/Google Pay), simulated processing + 3D Secure, success/failure screens, invoice history.
- **Gamification & Rewards:** Streak rewards (7/30/60/90 days), XP system, 8 badges, rollover credits (up to 20% carry-forward).
- **Affiliate & Referrals:** Multi-tier commissions (3 tiers), referral code, WhatsApp/email sharing, leaderboard, network view, payout requests.
- **Delivery & Tracking:** Order status pipeline, live driver map (`/live/:id`), call driver/contact restaurant, real-time ETA.
- **Profile & Settings:** Avatar, personal info, dietary preferences, delivery addresses with map pinning, language toggle (EN/AR), notification settings, privacy settings, password change, account deletion.
- **Health Integrations:** Blood work upload & results, health dashboard, BMI, AI food scanning.
- **Support & Legal:** FAQ, contact form, WhatsApp/email/phone support, Terms, Privacy Policy, support tickets.

### Screen Hierarchy (Customer Portal)

```
CustomerLayout (max-w-[480px] centered, mobile-first)
├── BottomTabBar: Home | Restaurants | Schedule | Profile
│
├── /dashboard
│   ├── Header (Avatar, Greeting, Notifications, Subscription Pill)
│   ├── Nutrition Progress Card
│   ├── Log Meal Button (opens LogMealDialog)
│   ├── Active Order Banner + Order Again Row
│   ├── Featured Restaurants (horizontal scroll)
│   └── AI Insights (collapsible)
├── /meals
│   ├── Search Bar, Category Chips, Filter Sheet
│   └── Grid: Restaurants OR Meals
├── /restaurant/:id → Menu categories, meal list
├── /meals/:id → Nutrition facts, scheduling CTA
├── /schedule → Weekly calendar, day slots
├── /progress → Goals, history, weight, smart adjustments
├── /tracker → Macro charts, weekly insights
├── /water-tracker, /step-counter, /weight-tracking
├── /health/dashboard, /health/blood-work
├── /profile → Tabs: Profile, Wallet, Rewards, Settings
├── /subscription → Current plan, freeze/cancel/reactivate
├── /subscription/plans → Plan cards, annual toggle
├── /checkout → Payment method, card form, processing
├── /wallet → Balance, top-up, transaction history
├── /orders → Active + Completed tabs
├── /notifications, /favorites, /affiliate, /support
└── (Outside CustomerLayout)
    ├── /auth (Welcome, Sign in/up, Forgot, OTP)
    ├── /onboarding (5-step wizard, no bottom tab)
    └── /walkthrough
```

### Main Navigation Structure

**Bottom Tab Bar (4 tabs):**
- 🏠 **Home** → `/dashboard`
- 🍽️ **Restaurants** → `/meals`
- 📅 **Schedule** → `/schedule`
- 👤 **Profile** → `/profile`

Active tab indicated by spring-animated pill (`layoutId="tab-pill"`). Filled vs. outlined icons.

**Hidden Navigation (drawers, modals, sheets):**
- Filter Sheet (meals/restaurants)
- Log Meal Dialog (full-screen modal with tabs)
- Onboarding Recovery Dialog
- Payment Processing Modal + 3D Secure Modal
- Subscription Cancel/Freeze Sheets
- Address Bottom Sheet (map pinning)

---

## Phase 2 — Analyze UX

### Friction Points

| # | Issue | Severity | Why It Matters | Recommendation |
|---|-------|----------|----------------|--------------|
| FP-1 | Meals page forced context switch — category filter switches grid from restaurants to meals without warning | **High** | Users browsing restaurants lose context | Add persistent toggle/tabs (Restaurants \| Meals) above grid |
| FP-2 | Checkout simulated payment UI exposed in production via `isDevelopment` check | **High** | Users may see fake payment buttons in live app | Remove dev testing block from production via feature flags |
| FP-3 | Onboarding has no quick exit — "Skip" buried below fold | **Medium** | New users abandon before seeing value | Elevate skip to header; offer "Quick Start" with defaults |
| FP-4 | Wallet/profile redundant payment flows — duplicate top-up dialogs and checkout navigation | **Medium** | Maintenance overhead and divergent UX | Extract single `WalletTopUpFlow` component |
| FP-5 | Auth sign-up form declares a `name` state variable but never renders a name input field | **High** | Users land on Dashboard with blank/placeholder name; profile personalization broken from day one | Add `<Input>` for full name to sign-up form, or collect during onboarding |
| FP-6 | Settings page toggles fire individual Supabase updates + toasts in rapid succession | **Medium** | Toggling 5 preferences creates 5 network requests and temporarily disables all controls | Batch updates with optimistic UI; single toast on completion |
| FP-7 | Profile notification/privacy toggles use local React state without persisting to backend | **Medium** | Users believe preferences are saved, but they reset on next page load | Wire toggles to Supabase `profiles.preferences` or settings table with mutation |

### Confusing Flows

| # | Issue | Severity | Recommendation |
|---|-------|----------|--------------|
| CF-1 | Auth post-login role routing is opaque — silent redirects without explanation | **High** | Add intermediate screen: "Setting up your workspace…" with role badge; support multi-role switcher |
| CF-2 | OTP custom keypad prevents paste — users cannot paste from email/SMS | **Medium** | Replace with 4 native `<input inputMode="numeric" autoComplete="one-time-code">` fields |
| CF-3 | AI Insights collapsed by default with no preview | **Low** | Show teaser line (e.g., "You're 200 kcal under target — see why") with chevron |
| CF-4 | Restaurant detail filter sheet renders dietary tags, calorie ranges, and protein ranges that are not wired to any state | **Medium** | Wire filters to actual menu filtering state, or remove the placeholder UI until functional |
| CF-5 | Health Dashboard has empty catch blocks that swallow Supabase errors silently | **Medium** | Add error state UI with retry button for each data section; do not swallow errors silently |

### Cognitive Overload

| # | Issue | Severity | Recommendation |
|---|-------|----------|--------------|
| CO-1 | Filter sheet presents sort + calories + favorites all at once | **Medium** | Default to single "Sort" row + expandable "More filters" |
| CO-2 | Profile page has 4 tabs + accordions creating deep nesting | **Medium** | Flatten navigation; move Dietary to its own top-level tab; use Settings list with headers |
| CO-3 | Subscription cards are dense with duplicate trust badges | **Low** | Use comparison table or collapsible feature lists; remove duplicate trust messaging |

### Inconsistent UI Patterns

| # | Issue | Severity | Recommendation |
|---|-------|----------|--------------|
| IP-1 | Color token drift — hardcoded hex/HSL vs. Tailwind `primary` tokens | **Medium** | Audit pages; replace hardcoded values with Tailwind theme tokens; add design-token linter |
| IP-2 | Button style inconsistency — `variant="gradient"` vs. standard shadcn; different sizes | **Low** | Standardize on `Button` sizes (`sm`, `default`, `lg`, `xl`) with consistent scales |
| IP-3 | Wallet alerts use manual `bg-*` overrides instead of `variant` props | **Low** | Use `variant="success"`, `"destructive"`, `"warning"` consistently |

### Poor Hierarchy

| # | Issue | Severity | Recommendation |
|---|-------|----------|--------------|
| PH-1 | Subscription status pill is tiny (`text-[10px]`); exhausted users don't understand blockage | **Medium** | Make pill more prominent; if `effectiveMealsLeft === 0`, surface banner above "Log Meal" with direct renew CTA |
| PH-2 | OrderHistory tab labels mismatch mental model — "Upcoming", "Completed", "Orders" | **Medium** | Rename to "Scheduled" \| "History" with filter chips |

### Bad / Empty States

| # | Issue | Severity | Recommendation |
|---|-------|----------|--------------|
| ES-1 | Meals empty state not differentiated — generic "No meals found" regardless of cause | **Medium** | Differentiate: "No restaurants match your filters" vs. "We're expanding to your area soon" with "Notify me" CTA |
| ES-2 | Profile missing name fallback shows static "Your Name" text | **Low** | Show friendly fallback: "Welcome! Tap to add your name" with inline edit affordance |

### Missing Loading States

| # | Issue | Severity | Recommendation |
|---|-------|----------|--------------|
| ML-1 | Auth "Checking Role" is invisible — silent spinner with no context | **High** | Add contextual message below spinner: "Setting up your account…" changing based on detected role |
| ML-2 | Dietary toggle lacks optimistic UI — awaits Supabase before updating local state | **Medium** | Implement optimistic state updates: toggle UI immediately, revert on error with toast |
| ML-3 | Dashboard restaurant skeleton is too generic — 3 identical pulse blocks | **Low** | Use skeleton that mirrors actual card layout |
| ML-4 | Health Dashboard catch blocks are empty; incomplete data renders without error messaging | **Medium** | Add per-section error boundaries with retry affordances and skeleton fallbacks |

### Weak Onboarding

| # | Issue | Severity | Recommendation |
|---|-------|----------|--------------|
| WO-1 | No height unit toggle — hardcoded to cm; Qatar users commonly use feet/inches | **Medium** | Add `cm`/`ft` toggle for height with ruler adapting to feet increments |
| WO-2 | No inline validation on rulers — allows 30–250 kg without boundary feedback | **Medium** | Add haptic feedback at limits, toast for extreme values, dim ruler edges |
| WO-3 | Loading/plan screens not skippable accessibly — X buttons have no visible label or `aria-label` | **Low** | Add `aria-label="Skip to dashboard"` and visible "Skip" text link below progress ring |

### Accessibility Issues

| # | Issue | Severity | Recommendation |
|---|-------|----------|--------------|
| A11Y-1 | OTP keypad buttons lack `aria-label` | **High** | Add `aria-label` to each button; ensure backspace SVG has `role="img"` |
| A11Y-2 | Dashboard skip link is obscured by sticky header | **Medium** | Add `scroll-margin-top` to `#main-content` equal to sticky header height |
| A11Y-3 | Meal card images lack contextual `alt` text | **Medium** | Use `alt={`Photo of ${meal.name} from ${meal.restaurant_name}`}` |
| A11Y-4 | Onboarding rulers have no keyboard access | **Medium** | Add hidden `<input type="range">` or keyboard handlers (ArrowLeft/ArrowRight) with `tabIndex={0}` |

### Trust Issues

| # | Issue | Severity | Recommendation |
|---|-------|----------|--------------|
| TI-1 | Simulation mode banner in Wallet — permanent yellow alert says payments are simulated | **Critical** | Remove simulation banner from production entirely; gate behind feature flag OFF by default |
| TI-2 | Checkout security badge is an emoji (`🔒`) | **Medium** | Replace emoji with `Lock` from `lucide-react`; move badge closer to payment form; add "Powered by Sadad" branding |
| TI-3 | Auth terms checkbox is custom and missing `aria-checked` | **Medium** | Replace with hidden native checkbox (`sr-only`) styled via `peer-checked`, or add `role="checkbox"` + `aria-checked` |
| TI-4 | StepCounter injects fake demo workout data ("demo-1", "demo-2") when no real data exists | **Medium** | Remove demo data injection entirely; show empty state with CTA to log steps or connect Google Fit |
| TI-5 | Meals page displays randomly generated `delivery_time` instead of real estimates | **Low** | Fetch real delivery estimates from backend or remove the field until data is available |
| TI-6 | Subscription upgrade debits wallet before calling `upgrade_subscription` RPC with no rollback on failure | **High** | Wrap debit + upgrade in a single atomic edge function or DB transaction; auto-refund on failure |

### Unclear CTAs

| # | Issue | Severity | Recommendation |
|---|-------|----------|--------------|
| CTA-1 | "Log Meal" primary CTA is ambiguous — app is a delivery service, not just a tracker | **Medium** | A/B test "Order Meal" or "Choose Meal" as primary CTA; reserve "Log Meal" for secondary tracking |
| CTA-2 | Subscription CTA is verbose — dynamic text may wrap awkwardly in Arabic | **Low** | Use fixed CTA text: "Get Started" or "Subscribe Now"; put plan name above button |

### Unnecessary Steps

| # | Issue | Severity | Recommendation |
|---|-------|----------|--------------|
| US-1 | Two-step wallet top-up — dialog then checkout page load | **Medium** | Skip dialog for returning users; store preferred payment method and use one-tap top-up |
| US-2 | Meals back button always navigates to Dashboard, not previous scroll position | **Low** | Use `navigate(-1)` with scroll restoration or preserve scroll position in session state |

### Mobile Usability

| # | Issue | Severity | Recommendation |
|---|-------|----------|--------------|
| MU-1 | Onboarding footer blocks content on small screens | **Medium** | Add `pb-32` to scrollable content container to ensure last elements are above footer |
| MU-2 | Restaurant carousel has no snap padding; last card cut off | **Low** | Add `scroll-padding-right: 1rem` to scroll container |
| MU-3 | Profile accordion animation causes scroll jank on mid-tier Android | **Low** | Replace height animation with `max-height` transition or Framer Motion `layout` prop sparingly |
| MU-4 | Schedule page "swipe to add" gestures use a complex `hasTriggered` ref to debounce — brittle and easy to break | **Medium** | Replace custom swipe with tap-to-add on empty slots or a persistent floating "+" action button |

### Form UX Problems

| # | Issue | Severity | Recommendation |
|---|-------|----------|--------------|
| FUX-1 | Auth password error doesn't clear on type | **Medium** | Validate in real-time with 300ms debounce; show live strength meter |
| FUX-2 | Onboarding age input lacks transparency — doesn't explain why age is needed | **Medium** | Add tooltip/subtitle: "We use age to calculate your Basal Metabolic Rate"; enforce `min={13}` `max={120}` |
| FUX-3 | Profile password change lacks strength checklist | **Low** | Show checklist below field updating live: "✓ 8+ characters", "✓ One uppercase", etc. |
| FUX-4 | Onboarding age/height/weight drag rulers are hard to use precisely on desktop; thumbs obscure values on mobile | **Medium** | Replace drag rulers with native-style number pickers, stepper inputs, or wheel selectors |

### Navigation Problems

| # | Issue | Severity | Recommendation |
|---|-------|----------|--------------|
| NP-1 | Hidden nav paths are hardcoded — `HIDDEN_NAV_PATHS` uses exact string matching | **Medium** | Use route metadata (`meta: { hideNav: true }`) and read via `useMatches()`; centralize nav rules |
| NP-2 | Notification bell lacks state context when zero unread | **Low** | Always include state in `aria-label`: `"Notifications, no unread"` |
| NP-3 | Bottom tab "Restaurants" label is misleading — navigates to `/meals` | **Low** | Rename label key to "meals" in translations to match route and page title |

---

## Phase 3 — Architecture Understanding

### Frontend Architecture

The application is a **single-page application (SPA)** built as a **multi-portal monolith**. All five user portals (Customer, Partner, Admin, Driver, Fleet) ship in one bundle and are conditionally mounted via React Router. This is a **feature-based / portal-based** architecture with route-driven code splitting via `React.lazy()`.

**Initialization sequence (`src/main.tsx`):**
1. Monitoring (`initSentry`, `initPostHog`) at module import time.
2. Native bridge (`initializeNativeApp()`) deferred into `useEffect` to prevent blank-white flash in Capacitor WebView.
3. Error boundaries (`SentryErrorBoundary`, `DevelopmentErrorBoundary`).
4. `LanguageProvider` above error boundaries.

**Provider Hierarchy:**

```
<QueryClientProvider>
  <TooltipProvider>
    <Toaster /> / <RadixToaster />
    <BrowserRouter basename="/nutrio">
      <AuthProvider>
        <AnalyticsProvider>
          <SessionTimeoutManager>
            <Suspense fallback={<PageLoader />}>
              <RouteErrorBoundary>
                <Routes />
              </RouteErrorBoundary>
            </Suspense>
          </SessionTimeoutManager>
        </AnalyticsProvider>
      </AuthProvider>
    </BrowserRouter>
  </TooltipProvider>
</QueryClientProvider>
```

**Observations:**
- `BrowserRouter` uses `basename="/nutrio"`. All deep links must include this prefix.
- `QueryClientProvider` wraps the router, so query cache survives navigation but **not** full page reloads.
- No global layout route; each portal defines its own layout (`CustomerLayout`, `DriverLayout`, etc.).

### Routing Structure

- **React Router v6** with declarative `<Routes>`.
- **Customer portal** uses layout route `<Route element={<CustomerLayout />}>` wrapping `Outlet` + conditional `<BottomTabBar>` based on `HIDDEN_NAV_PATHS`.
- **Lazy loading** for almost every page (good for code splitting).
- **Risk:** `App.tsx` is **802 lines** containing every lazy import and route definition. Adding a page requires editing this central file, violating the Open/Closed Principle.
- **Deep linking:** `ScrollToTop` resets scroll on pathname change (important for WebView/Capacitor).

### State Management

| Concern | Technology | Location |
|---------|-----------|----------|
| Auth session | React Context + Supabase | `src/contexts/AuthContext.tsx` |
| UI language | React Context (inline dictionary) | `src/contexts/LanguageContext.tsx` |
| Server data (profiles, meals, orders) | TanStack Query (custom hooks) | `src/hooks/useProfile.ts`, `useSubscription.ts` |
| Local UI state | `useState` / `useReducer` | Page components |
| Realtime updates | Supabase Realtime + `useEffect` | `useNotifications.ts`, `useSubscription.ts` |

**Two distinct data-fetching patterns coexist:**
1. **TanStack Query** (modern, cached, deduplicated) — `useProfile`, `useSubscription`
2. **Raw `useEffect` + Supabase** (manual, uncached) — `useTodayProgress`, some notifications

**Risk:** Pattern #2 duplicates logic, lacks deduplication, and misses TanStack Query's background refetching.

**Caching Strategy:**
- Global `QueryClient` instantiated in `App.tsx` with **no default options** (`staleTime: 0`, aggressive window-focus refetching).
- Role cache in `ProtectedRoute.tsx` uses module-level `Map` with 60-second TTL.
- Supabase session persisted via custom Capacitor `Preferences` adapter.

### Component Organization

- **`src/components/ui/`** — shadcn/ui primitives (~50 files) using `cva` + Tailwind.
- **`src/components/`** — shared app components (`CustomerLayout`, `BottomTabBar`, `ProtectedRoute`).
- **`src/pages/`** — route-level components organized by portal.
- **`src/pages/dashboard/components/`** — page-local components.

**Reusability patterns:**
- Composition over inheritance via `forwardRef` + `cva`.
- `cn()` utility merges `clsx` and `tailwind-merge`.
- Hooks as data interfaces (`useProfile`, `useSubscription`, `useNotifications`).

**Feature boundaries** are directory-based but not enforced by module boundaries. Pages in `admin/` can still import `../../hooks/useSubscription`. Risk of circular dependencies as codebase grows.

### Reusable UI System

**Design System:** shadcn/ui + Tailwind CSS with custom theme in `src/index.css`.

Key tokens:

```css
:root {
  --primary: 162 69% 42%;   /* Deep Emerald */
  --accent: 39 92% 50%;     /* Warm Gold */
  --destructive: 0 84% 60%;
  --warning: 39 92% 50%;
  --success: 160 65% 42%;
  --radius: 1rem;
}
```

**Consistency issues:**
- `Button` defines 10 variants (`default`, `destructive`, `outline`, `gradient`, `hero`, `soft`, `icon`, etc.) and 5 sizes.
- `Card` uses `default`, `elevated`, `interactive`, `stat` variants.
- **Redundant toasters:** Sonner and Radix Toaster both mount in `App.tsx` simultaneously.
- **Inline SVGs** are common (e.g., `BottomTabBar.tsx`), fragmenting iconography.

### API Interaction Patterns

**Supabase Client** (`src/integrations/supabase/client.ts`) creates a typed Supabase client with a **custom Capacitor storage adapter** for native session persistence.

**Error Handling:**
- `withRetry` utility wraps flaky queries.
- RPC fallbacks are common (e.g., `useSubscription.ts` catches RPC errors and falls back to direct `supabase.from()` updates).

**Real-time Subscriptions:**
Multiple hooks open independent Supabase Realtime channels (e.g., `useNotifications.ts`, `useSubscription.ts`).

**Risk:** Channel naming and cleanup logic are duplicated. A centralized realtime manager or custom TanStack Query real-time plugin would reduce boilerplate and prevent leaked subscriptions.

### Authentication Flow

**AuthContext.tsx** wraps Supabase Auth with `onAuthStateChange` listener. Geo-restriction (Qatar-only signup) enforced via `checkIPLocation()`.

**Role-based Routing:**
`ProtectedRoute.tsx` (~400 lines) is the gatekeeper:
- Queries `user_roles`, `restaurants`, `drivers`, `fleet_managers`
- Caches roles for 60 seconds
- Falls back to role-specific redirects if access denied
- Subscribes to real-time `user_roles` changes

**Session Management:**
- Supabase handles token refresh automatically (`autoRefreshToken: true`).
- `safetyTimeout` in `AuthContext.tsx` clears `loading` after 10 seconds if Supabase is unreachable.
- `signOut` clears `localStorage` remembered email and flushes role cache.

**Biometric Auth (Native):**
`Auth.tsx` integrates `@capgo/capacitor-native-biometric` with auto-trigger login when credentials are stored.

### Identified Risks & Problematic Patterns

| Risk | Severity | Description | Mitigation |
|------|----------|-------------|------------|
| **Monolithic Route File (`App.tsx`)** | **High** | 802 lines with every lazy import and route declaration. Adding a page touches a file every developer conflicts on. | Move portal routes into sub-routers (e.g., `src/customer/routes.tsx`) imported as fragments, similar to `fleetRoutes`. |
| **Language Context Bloat** | **High** | ~1200-line inline translation dictionary bundled and parsed on every app start, even if only one language is used. | Split translations into lazy-loaded JSON files or dynamic imports per language. |
| **Invalid CSS** | **Medium** | `src/index.css` contains invalid HSL syntax: `background-color: hsl(var(--background) / 0 / 90%);` (two slashes). Silent failure in some browsers. | Fix to `hsl(var(--background) / 0.9)`. Add CSS linting to CI. |
| **Redundant Toaster Systems** | **Medium** | Sonner and Radix Toaster both mounted. Call sites may use `toast` from Sonner or `useToast` from Radix. | Standardize on one toast system. Remove the other. |
| **Mixed Data-Fetching Patterns** | **High** | `useProfile` uses TanStack Query (good); `useTodayProgress` and `useNotifications` use raw `useEffect` + state (bad at scale). | Migrate all server-state access to TanStack Query with custom hooks. |
| **Duplicated Realtime Subscription Logic** | **Medium** | Every realtime hook opens its own channel, manages its own `removeChannel`, constructs its own filter string. | Create reusable `useRealtimeTable(table, filter, callback)` hook. |
| **`useSubscription` Anti-Pattern** | **Medium** | `useMemo(() => subscription, [subscription])` never caches because `subscription` is a new object reference on every state change. | Remove useless `useMemo` or memoize the object creation upstream. |
| **Supabase Client Crash on Missing Env Vars** | **High** | If `SUPABASE_URL` or `SUPABASE_PUBLISHABLE_KEY` missing, module throws at import time—before React or error boundaries mount—resulting in blank white screen with no recovery. | Defer guard into factory function or initialization routine so app can render config error page. |
| **`Auth.tsx` Too Large (~930 lines)** | **Medium** | All auth views (welcome, sign-in, sign-up, forgot, OTP) in one file with local state for every field. | Extract each view into sub-component or route segment (e.g., `/auth/signin`, `/auth/forgot`). |
| **ProtectedRoute Module-Level Caches** | **Medium** | `roleCache` and `tableExistsCache` are plain `Map` objects at module scope. Persist across hot reloads in Vite and may leak memory in long-lived native sessions. | Bound cache size (LRU) or clear on `beforeunload`. |
| **`CustomerLayout` Console Log** | **Low** | Unconditional `console.log` leaks debug output to production builds. | Remove or wrap with `import.meta.env.DEV`. |
| **QueryClient Without Defaults** | **Medium** | No `defaultOptions`, `staleTime`, or `gcTime`. Defaults to aggressive refetching on window focus—unnecessary for mobile-first app. | Configure `QueryClient` with sensible defaults: `staleTime: 5 * 60 * 1000`, `gcTime: 10 * 60 * 1000`. |
| **Mega-Page Files** | **High** | `MealDetail.tsx` (1,620 lines), `Schedule.tsx` (1,491 lines), `ProgressRedesigned.tsx` (1,544 lines) mix business logic, UI, data fetching, and animations in single files. | Decompose into sub-components: `MealHeader`, `NutritionPanel`, `CustomizationForm`, `ScheduleWeekView`, etc. |
| **Schedule Page Feature Gate** | **Medium** | If `settings.features.meal_scheduling` is disabled, entire page shows a static blocking screen with no alternative action. | Replace static blocking screen with CTA to enable or browse meals. |

---

## Phase 4 — Improvement Recommendations

### ✅ Completed (37 items — May 2026)

Sprints 1 & 2 fully complete. 37 items delivered across trust/safety, onboarding, navigation, color tokens, button standardization, wallet deduplication, empty states, OTP accessibility, dietary optimistic UI, profile persistence, restaurant filters, and data layer improvements (TanStack Query migration, QueryClient defaults, deferred monitoring, demo data removal, skeleton refinements, Meals dual-view toggle, auth social proof, Quick Start mode).

---

### Remaining Work

#### R.4 — Subscription plan comparison table
**Effort:** 3–5 days | **Impact:** High plan selection clarity
Side-by-side comparison with collapsible feature details.

#### R.5 — Profile information architecture overhaul
**Effort:** 5–7 days | **Impact:** High usability
Flatten deep nesting; consider moving Wallet and Rewards out of Profile to standalone routes.

#### R.7 — Auth views modularization
**Effort:** 3–5 days | **Impact:** High maintainability
Split `Auth.tsx` (~975 lines) into route segments or sub-components per view.

#### R.8 — Decompose mega-page files
**Effort:** 3–5 days | **Impact:** High maintainability + testability
Split `MealDetail` (1,620), `Schedule` (1,491), `ProgressRedesigned` (1,544) into sub-components.

#### R.9 — Replace onboarding drag rulers with accessible inputs
**Effort:** 3–5 days | **Impact:** High accessibility + completion rate
Use native `<input type="range">` or react-slider for age/height/weight.

#### R.10 — Atomic wallet upgrade transaction
**Effort:** 2–3 days | **Impact:** High trust + revenue protection
Debit + upgrade in a single Supabase edge function or DB transaction with rollback on failure.

#### P.3 — Split LanguageContext translations
**Effort:** 2–3 days | **Impact:** Faster initial bundle parse
Lazy-load EN/AR JSON files from 4,678-line inline dictionary.

#### P.4 — Sub-router extraction from monolithic App.tsx
**Effort:** 2–3 days | **Impact:** Reduced merge conflicts, better code splitting
Move portal routes into sub-routers (`src/customer/routes.tsx`).

#### P.5 — Centralized realtime manager
**Effort:** 2–3 days | **Impact:** Reduced memory leaks, cleaner code
Create reusable `useRealtimeTable()` hook.

---

### UX Modernization (remaining)

| # | Suggestion | Effort |
|---|------------|--------|
| 1 | Adopt React 18 Suspense boundaries around major feature areas | 2–3 days |
| 2 | Consider RSC / Next.js migration for data-heavy pages | Research |
| 3 | Use Zustand for lightweight global UI state | 1–2 days |
| 4 | Replace drag rulers with accessible native inputs (duplicates R.9) | 2–3 days |
| 5 | Standardize form handling with react-hook-form + zod | 3–5 days |
| 6 | Remove demo data from all tracking pages | 1–2 days |

### New Features (reference)

| # | Feature | Effort |
|---|---------|--------|
| 1 | Meal plan generator ("Fill my week") | 5–7 days |
| 2 | Smart substitutions for unavailable meals | 3–5 days |
| 3 | Social/family plans (multi-profile) | 7–10 days |
| 4 | Nutrition coach chat (VIP tier) | 7–10 days |
| 5 | Fitness wearable integration (Apple Health / Google Fit) | 5–7 days |
| 6 | Community features (recipes, leaderboards, challenges) | 7–10 days |
| 7 | Push notification rich actions | 3–5 days |
| 8 | Dark mode full implementation | 3–5 days |

### Onboarding Improvements (remaining)

| # | Improvement | Effort |
|---|-------------|--------|
| 3 | Progressive onboarding — move allergies/activity to first-time meal browse | 3–5 days |
| 6 | Onboarding video/gif — animation of nutrition ring filling up | 2–3 days |

### Retention Improvements (remaining)

| # | Improvement | Effort |
|---|-------------|--------|
| 1 | Smart meal reminders — push notification before usual meal times | 3–5 days |
| 2 | Streak recovery — option when streak breaks | 2–3 days |
| 3 | Weekly report sharing — Instagram/WhatsApp Stories | 3–5 days |
| 4 | Cancellation salvage flow (pause, downgrade, skip week) | 3–5 days |
| 5 | Referral milestones on Dashboard | 2–3 days |
| 6 | VIP exclusives (early access, exclusive meals, coach sessions) | 3–5 days |
| 7 | Gamification dashboard (XP bar, badge previews) | 2–3 days |
| 8 | Rollover credit expiry nudges | 1–2 days |

---

## Phase 5 — Remaining Prioritized Roadmap

### Top 10 Remaining Improvements

| # | Initiative | Complexity | Impact |
|---|------------|------------|--------|
| 1 | Auth views modularization (split Auth.tsx) | Medium | Maintainability |
| 2 | Decompose mega-page files (MealDetail/Schedule/Progress) | Medium | Maintainability |
| 3 | Sub-router extraction from monolithic App.tsx | Medium | Dev velocity |
| 4 | Atomic wallet upgrade transaction | Medium | Revenue protection |
| 5 | Profile information architecture overhaul | High | Usability |
| 6 | Split LanguageContext translations | Medium | Performance |
| 7 | Centralized realtime manager | Medium | Reliability |
| 8 | Cancellation salvage flow | Medium | Retention |
| 9 | Subscription plan comparison table | Medium | Conversion |
| 10 | Replace onboarding drag rulers | Medium | Accessibility |

### Implementation Sequence

**Sprint 4: Architecture (Week 6–8)**
- Auth views modularization
- Decompose mega-pages (MealDetail, Schedule, ProgressRedesigned)
- Sub-router extraction from App.tsx
- Split LanguageContext to lazy-load JSON

**Sprint 5: Reliability & Revenue (Week 8–10)**
- Atomic wallet upgrade edge function
- Centralized realtime manager
- Cancellation salvage flow
- Rollover credit expiry nudges

**Sprint 6: UX Polish (Week 10–12)**
- Profile IA overhaul
- Subscription plan comparison table
- Replace onboarding drag rulers
- Progressive onboarding, Dark mode

**Sprint 7: New Features (Ongoing)**
- Meal plan generator, Smart substitutions
- Fitness wearable integration
- Community features, Push notification rich actions

---

## Final Notes

This portal demonstrates **strong product-market fit** for the Qatar health-conscious consumer segment and has **solid technical foundations** (TypeScript, Supabase, shadcn/ui, Capacitor). The biggest risks addressed so far: trust gaps in payment flows, hardcoded color tokens, duplicate wallet logic, missing onboarding name field, and data-fetching inconsistency. Remaining risks center on architectural file-size accumulation (`App.tsx`, `Auth.tsx`, `LanguageContext`, mega-page components) and runtime reliability (payment atomicity, realtime channel management).
