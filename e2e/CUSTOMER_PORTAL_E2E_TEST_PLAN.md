# Nutrio Customer Portal — End-to-End Integration Test Plan

**Classification:** CTO Review / Senior QA Audit  
**Date:** 2026-06-25  
**Go-Live Readiness:** `❌ NOT READY — Score: 18/100`

---

## 1. Executive Summary

The Nutrio Fuel customer portal ships **47 route-defined pages** backed by **52 Edge Functions** and **100+ SQL migrations**. However:

- **97.3% of existing E2E tests fail** — the 82 Playwright files were auto-generated from an Excel spec and never matched actual routes or selectors
- **Zero `data-testid` attributes** exist across all customer page components — tests have no stable hooks
- **No test data seeding/teardown infrastructure** exists for E2E
- **Critical cross-module flows are completely untested** (meal→XP→challenge, checkout→wallet→invoice, subscription→SADAD→status)
- **Login credentials hardcoded** in helpers.ts may be stale or blocked by IP geo-restriction
- **Environment mismatch**: README says port `8080`, actual helpers.ts says `5173`

---

## 2. Architecture & Integration Map

```
┌────────────────────────────────────────────────────────────────────┐
│                        CUSTOMER PORTAL                             │
│                                                                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ Dashboard │  │  Meals   │  │ Schedule │  │   Orders         │  │
│  │ (4 views) │  │  + AI    │  │          │  │   + Tracking     │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └───────┬──────────┘  │
│       │              │              │                │             │
│  ┌────▼─────┐  ┌────▼─────┐  ┌────▼─────┐  ┌───────▼──────────┐  │
│  │ Progress │  │ Health   │  │ Coach    │  │ Wallet/Checkout │  │
│  │ Tracker  │  │ Dashboard│  │ Suite    │  │ Subscriptions   │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └───────┬──────────┘  │
│       │              │              │                │             │
│  ┌────▼──────────────▼──────────────▼────────────────▼──────────┐ │
│  │                   SUPABASE BACKBONE                          │ │
│  │  Auth │ DB │ Storage │ Realtime │ Edge Functions (×52)      │ │
│  └──────────────────────────────────────────────────────────────┘ │
│       │              │              │                │             │
│  ┌────▼─────┐  ┌────▼─────┐  ┌────▼─────┐  ┌───────▼──────────┐  │
│  │ SADAD    │  │ WhatsApp │  │  Email   │  │  Google Fit      │  │
│  │ Payments │  │  API     │  │ (Resend) │  │  / Health Kit    │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

### Core Data Flows (Must Be Tested End-to-End)

| Flow | Pages Involved | DB Tables | Edge Functions | Side Effects |
|------|---------------|-----------|----------------|--------------|
| **A. Meal Logging Pipeline** | `/tracker` → dashboard | `meal_history`, `progress_logs` | `analyze-meal-image`, `predict-nutrition` | XP award, challenge sync, health app write |
| **B. Order→Payment→Delivery** | `/meals` → `/checkout` → `/orders` → `/tracking` | `orders`, `order_items`, `payments`, `wallet_transactions` | `sadad-payment` | Invoice PDF, email notification, WhatsApp, driver assignment |
| **C. Subscription Lifecycle** | `/subscription` → `/subscription/plans` → SADAD → `/subscription` | `subscriptions`, `invoices`, `wallet_transactions` | `upgrade-subscription`, `process-subscription-renewal` | Email invoice, wallet credit, tier upgrade notification |
| **D. Health → Readiness → Meals** | Health dashboard → `/recovery-insights` → `/meals` | `health_daily_metrics`, `meal_recommendations` | `calculate-health-score`, `recommend-meals`, `nutrition-profile-engine` | Meal recommendations adjust based on readiness |
| **E. Community→XP→Rewards** | `/community` → `/rewards` → `/friend-leaderboard` | `xp_ledger`, `rewards`, `community_challenges` | `send-milestone-notification` | Streak tracking, badge unlock, leaderboard refresh |
| **F. Affiliate→Wallet** | `/affiliate` → `/affiliate/tracking` → `/wallet` | `affiliate_links`, `wallet_transactions`, `commission_logs` | `send-commission-notification`, `send-monthly-affiliate-report` | Wallet credit, email report |

---

## 3. Critical Blockers (Must Fix Before Go-Live)

| # | Issue | Severity | Location | Impact |
|---|-------|----------|----------|--------|
| B1 | **No `data-testid` on any page** | 🔴 Critical | All customer pages | Tests have no stable selectors; will break on any UI change |
| B2 | **No test data seeding** | 🔴 Critical | E2E infra | Tests create side effects in production DB; no isolation |
| B3 | **No auth token reuse** | 🔴 Critical | `e2e/fixtures/test.ts` | Login runs before every test → rate limited; 12s timeout per fixture |
| B4 | **Failed auth credentials may be stale** | 🔴 Critical | `e2e/utils/helpers.ts:9-13` | `<E2E_CUSTOMER_EMAIL>` / `<E2E_TEST_PASSWORD>` — may be blocked by IP geo-filter |
| B5 | **Test assertions check for fictional text** | 🔴 Critical | All 82 spec files | `expect(body).toContainText('Meal Completion Atomic')` — these strings don't exist |
| B6 | **BASE_URL mismatch** | 🔴 High | `e2e/README.md` vs `helpers.ts` | README says `8080`, code uses `5173` |

---

## 4. Module-by-Module Test Scope

### 4.1 Authentication & Onboarding
**Routes:** `/auth`, onboarding flow (multi-step)
**Edge Functions:** `check-ip-location`, `log-user-ip`
**DB:** `auth.users` (Supabase managed), `profiles`, `user_roles`

| Test ID | Scenario | Priority | Integration Points |
|---------|----------|----------|-------------------|
| AUTH-01 | Sign up with email/password → redirect to onboarding | Critical | Supabase Auth, IP check, profile creation |
| AUTH-02 | Email verification redirect → full login | Critical | Supabase Auth email confirmation |
| AUTH-03 | Login with valid credentials → dashboard | Critical | Auth flow redirect to `/dashboard` |
| AUTH-04 | Login with invalid password → error toast | Critical | Auth error handling, toast UI |
| AUTH-05 | Login with unverified email → verify prompt | High | Auth state machine |
| AUTH-06 | "Remember me" session persistence | High | Local storage, session cookie |
| AUTH-07 | Logout → redirect to `/auth` | Critical | Session clear, redirect |
| AUTH-08 | Onboarding step 1: personal info → saves to `profiles` | Critical | `profiles` table insert |
| AUTH-09 | Onboarding step 2: dietary preferences → saves to `dietary_preferences` | Critical | `dietary_preferences` table |
| AUTH-10 | Onboarding completion → `/dashboard` with tutorial | High | First-login flag in `profiles` |
| AUTH-11 | Expired session → redirect to login | Critical | Token expiry, 401 handling |
| AUTH-12 | Rate limiting on repeated failed login | High | Auth rate limit edge function |
| AUTH-13 | IP geo-restriction blocks non-Qatar signup | High | `check-ip-location` edge function |
| AUTH-14 | Password reset flow → email sent → reset success | Critical | Supabase Auth, email trigger |
| AUTH-15 | OAuth Google/Apple sign-in | Medium | Supabase OAuth providers |

### 4.2 Dashboard
**Routes:** `/dashboard`, `/dashboard/nutrition`, `/dashboard/activity`, `/dashboard/progress`
**Hooks:** `useTodayProgress`, `useSubscription`, `useStreak`, `useWaterIntake`, `useHealthScore`, `useDailyPerformanceSnapshot`
**DB:** `progress_logs`, `subscriptions`, `xp_ledger`, `water_intake`, `meal_history`

| Test ID | Scenario | Priority | Integration Points |
|---------|----------|----------|-------------------|
| DASH-01 | Dashboard loads with today's progress summary | Critical | `progress_logs` (today), `meal_history` (today) |
| DASH-02 | Nutrition tab shows macro breakdown | High | `progress_logs` calories/protein/carbs/fat |
| DASH-03 | Activity tab shows steps + water + workouts | High | `water_intake`, `health_daily_metrics`, `workout_sessions` |
| DASH-04 | Progress tab shows weight chart + streak | High | `weight_logs`, `xp_ledger` streak data |
| DASH-05 | Subscription status card reflects current plan | Critical | `subscriptions` table → UI badge |
| DASH-06 | Quick-add meal shortcut opens meal logger | High | Navigation to `/tracker` or modal |
| DASH-07 | Upcoming schedule shows next meals | Medium | `meal_plans` / `order_items` |
| DASH-08 | Wallet balance displays correctly | Medium | `wallet_transactions` balance |
| DASH-09 | Health readiness score renders (if data exists) | High | `health_daily_metrics` → `calculateHealthBaseline()` |
| DASH-10 | Empty state when no data logged | Medium | Conditional rendering check |

### 4.3 Meals & Restaurant Browsing
**Routes:** `/meals`, `/meals/:id`, `/restaurant/:id`, `/favorites`, `/recommendations` (redirects to `/meals`)
**Edge Functions:** `similar-meals`, `recommend-meals`, `lookup-barcode`, `translate-meal`, `smart-meal-allocator`
**DB:** `meals`, `restaurants`, `restaurant_branches`, `meal_reviews`, `favorites`, `meal_addons`, `popular_combos`

| Test ID | Scenario | Priority | Integration Points |
|---------|----------|----------|-------------------|
| MEAL-01 | Browse meals grid loads with restaurant data | Critical | `meals` JOIN `restaurants` |
| MEAL-02 | Filter by dietary preference (keto/vegan/etc.) | Critical | `meals.dietary_tags` filter, `meal_customizations` |
| MEAL-03 | Filter by cuisine type | High | `restaurants.cuisine_type` |
| MEAL-04 | Search meals by name | Critical | Supabase `ilike` query or `restaurant-intelligence-engine` |
| MEAL-05 | Meal detail page shows nutrition info + price | Critical | `meals` single row, `meal_addons` |
| MEAL-06 | Restaurant detail shows menu + branches | Critical | `restaurants` JOIN `restaurant_branches` |
| MEAL-07 | Add meal to favorites | High | `favorites` table insert |
| MEAL-08 | Remove meal from favorites | High | `favorites` table delete |
| MEAL-09 | View favorites page → shows favorited meals | High | `favorites` JOIN `meals` |
| MEAL-10 | Similar meals carousel loads on meal detail | Medium | `similar-meals` edge function |
| MEAL-11 | "Recommend for me" uses AI recommendations | Medium | `recommend-meals` edge function |
| MEAL-12 | Barcode lookup scans → shows nutritional info | Medium | `lookup-barcode` edge function |
| MEAL-13 | Meal customization: add-ons + special requests | High | `meal_addons`, order creation |
| MEAL-14 | Meal translation (Arabic/English toggle) | Medium | `translate-meal` edge function |
| MEAL-15 | Popular combos load on restaurant page | Medium | `popular_combos` table |

### 4.4 Schedule & Meal Planning
**Routes:** `/schedule`
**Hooks:** `useMealRecommendations`, `useMealCustomization`
**DB:** `meal_plans`, `schedule_slots`, `meal_schedule_entries`
**Edge Functions:** `smart-meal-allocator`, `dynamic-adjustment-engine`

| Test ID | Scenario | Priority | Integration Points |
|---------|----------|----------|-------------------|
| SCH-01 | Weekly calendar view renders 7 days | Critical | `meal_plans` by user + date range |
| SCH-02 | Click day → shows planned meals | Critical | `meal_schedule_entries` |
| SCH-03 | Add meal to schedule slot | Critical | `meal_schedule_entries` insert |
| SCH-04 | Remove meal from schedule | High | `meal_schedule_entries` delete |
| SCH-05 | Drag & drop meal to reschedule | High | Update `meal_schedule_entries` time slot |
| SCH-06 | Smart allocation fills empty slots | High | `smart-meal-allocator` edge function |
| SCH-07 | Schedule changes reflect in next order | Critical | Schedule → order pipeline |
| SCH-08 | Dynamic adjustment adapts to missed meals | Medium | `dynamic-adjustment-engine` edge function |
| SCH-09 | Meal completion toggling from schedule | High | `meal_history` insert + XP |
| SCH-10 | Empty week state | Low | Conditional rendering |

### 4.5 Orders, Checkout & Payment
**Routes:** `/checkout`, `/orders`, `/order/:id`, `/tracking`
**Edge Functions:** `sadad-payment`, `simulate-payment`
**DB:** `orders`, `order_items`, `payments`, `wallet_transactions`, `invoices`, `delivery_tracking`
**Lib:** `walletService.ts`, `invoice-pdf.ts`, `resend.ts`

| Test ID | Scenario | Priority | Integration Points |
|---------|----------|----------|-------------------|
| ORD-01 | Checkout page loads with cart items | Critical | Cart state → items display |
| ORD-02 | Select delivery address from saved addresses | Critical | `addresses` table |
| ORD-03 | Add new delivery address during checkout | Critical | `addresses` insert |
| ORD-04 | Select delivery time slot | High | `delivery_slots` availability |
| ORD-05 | Add delivery instructions | Medium | `orders.delivery_instructions` |
| ORD-06 | Apply promo code → discount reflected | High | Promo validation, price recalculation |
| ORD-07 | Select payment method (wallet vs SADAD) | Critical | Payment method toggle |
| ORD-08 | Pay with wallet → balance deducted → order created | Critical | `walletService` → `credit_wallet` RPC → `orders` insert → `invoices` insert |
| ORD-09 | Pay with SADAD → redirect → callback → order confirmed | Critical | `sadad-payment` edge function → external redirect → webhook callback |
| ORD-10 | Failed SADAD payment → order marked as pending | Critical | Error handling, order status `payment_pending` |
| ORD-11 | Order confirmation page shows order summary | Critical | `orders` JOIN `order_items` |
| ORD-12 | Order history lists all past orders | Critical | `orders` filtered by user |
| ORD-13 | Order detail shows items + status + timeline | Critical | `orders` JOIN `order_items`, `order_status_history` |
| ORD-14 | Invoice PDF generates and is downloadable | High | `invoice-pdf.ts` → `invoices.pdf_url` |
| ORD-15 | Invoice email sent via Resend | High | `resend.sendInvoiceEmail()` → `email_logs` |
| ORD-16 | Real-time delivery tracking map | High | `delivery_tracking` via Realtime subscription |
| ORD-17 | Order status transitions: pending→confirmed→preparing→out_for_delivery→delivered | Critical | `order_status_history` state machine |
| ORD-18 | Cancel order before cutoff time | High | `orders` status update + refund trigger |
| ORD-19 | Reorder from past order (one-click) | High | `useReorder` → duplicate order |
| ORD-20 | Split payment (wallet + SADAD) | Low | Payment split logic |

### 4.6 Wallet & Invoices
**Routes:** `/wallet`, `/invoices`, `/invoice-history`
**Services:** `walletService.ts`
**DB:** `wallet_transactions`, `wallet_topup_packages`, `invoices`, `email_logs`

| Test ID | Scenario | Priority | Integration Points |
|---------|----------|----------|-------------------|
| WAL-01 | Wallet balance displays correctly | Critical | `wallet_transactions` balance aggregation |
| WAL-02 | Transaction history lists all entries | Critical | `wallet_transactions` by user |
| WAL-03 | Top-up package selection | High | `wallet_topup_packages` query |
| WAL-04 | Wallet top-up via SADAD → credit + invoice | Critical | `walletService.processWalletTopup()` |
| WAL-05 | Wallet top-up bonus amount applied correctly | Critical | `pkg.amount + pkg.bonus_amount` |
| WAL-06 | Invoice history lists all invoices | High | `invoices` by user |
| WAL-07 | Invoice detail/view/download | High | `InvoicePDFGenerator` |
| WAL-08 | Wallet credit used during checkout reduces balance | Critical | Checkout flow → `credit_wallet` RPC |
| WAL-09 | Insufficient wallet balance → prompt to top-up | High | Error handling + redirect to top-up |
| WAL-10 | Rollover credits appear after subscription renewal | Medium | `cleanup-expired-rollovers` + `useRolloverCredits` |

### 4.7 Subscriptions
**Routes:** `/subscription`, `/subscription/plans`, `/plans` (redirects to `/subscription/plans`)
**Edge Functions:** `upgrade-subscription`, `process-subscription-renewal`, `handle-freeze-request`, `send-tier-upgrade-notification`
**DB:** `subscriptions`, `subscription_plans`, `invoices`
**Hooks:** `useSubscription`, `useSubscriptionPlans`, `useSubscriptionManagement`, `useSubscriptionFreeze`

| Test ID | Scenario | Priority | Integration Points |
|---------|----------|----------|-------------------|
| SUB-01 | Current subscription plan displays | Critical | `subscriptions` JOIN `subscription_plans` |
| SUB-02 | Browse available plans | Critical | `subscription_plans` query |
| SUB-03 | Upgrade to higher tier → SADAD payment → plan changes | Critical | `upgrade-subscription` edge function |
| SUB-04 | Downgrade takes effect at next billing cycle | High | Plan change scheduling |
| SUB-05 | Cancel subscription → end-of-period notice | Critical | `subscriptions` status change + email |
| SUB-06 | Freeze subscription → no meals during freeze | High | `handle-freeze-request` edge function |
| SUB-07 | Unfreeze → schedule resumes | High | Freeze lift → schedule reactivation |
| SUB-08 | Subscription renewal triggers payment | Critical | `process-subscription-renewal` edge function |
| SUB-09 | Renewal failure → grace period → notification | High | Failed payment → email/notification |
| SUB-10 | Billing history shows all invoices | High | `invoices` by subscription |
| SUB-11 | Subscription status reflects on dashboard | Critical | Dashboard subscription card |

### 4.8 Progress Tracking (Nutrition, Weight, Water, Steps)
**Routes:** `/progress`, `/tracker`, `/water-tracker`, `/step-counter`, `/weight-tracking`, `/body-metrics`
**DB:** `progress_logs`, `weight_logs`, `water_intake`, `step_logs`, `body_metrics`
**Edge Functions:** `behavior-prediction-engine`, `adaptive-goals`

| Test ID | Scenario | Priority | Integration Points |
|---------|----------|----------|-------------------|
| PROG-01 | Daily nutrition progress shows calories/macros | Critical | `progress_logs` by user + date |
| PROG-02 | Log meal via tracker → updates progress_logs + meal_history + XP | Critical | Triple-table write + `award_xp_for_meal_log` RPC |
| PROG-03 | AI meal photo → analyzed → nutrition logged | Critical | `analyze-meal-image` → meal log flow |
| PROG-04 | Log water intake → updates water_intake | Critical | `water_intake` insert/update |
| PROG-05 | Log steps manually | High | `step_logs` insert |
| PROG-06 | Log weight → updates weight_logs | Critical | `weight_logs` insert |
| PROG-07 | View weight chart over time (7d/30d/90d) | High | `weight_logs` range query, `useWeightChartData` |
| PROG-08 | Body metrics log (waist, body fat, etc.) | Medium | `body_metrics` insert |
| PROG-09 | Progress page weekly/monthly summary | High | `useWeeklySummary` aggregate query |
| PROG-10 | Goal progress bars reflect `nutrition_goals` | Critical | `nutrition_goals` vs `progress_logs` comparison |
| PROG-11 | Adaptive goal adjustment based on progress | Medium | `adaptive-goals` edge function |
| PROG-12 | Behavior prediction insights | Low | `behavior-prediction-engine` |

### 4.9 Health Dashboard, Blood Work & Medications
**Routes:** `/health/dashboard`, `/health/blood-work`, `/health/blood-work/results`, `/medications`
**Services:** `blood-work.ts`
**DB:** `health_daily_metrics`, `blood_work`, `blood_work_results`, `medications`, `meal_medicine_check`

| Test ID | Scenario | Priority | Integration Points |
|---------|----------|----------|-------------------|
| HLTH-01 | Health dashboard aggregates daily metrics | Critical | `health_daily_metrics` query |
| HLTH-02 | Blood work upload (PDF/image) | Critical | `blood_work` insert + Storage upload |
| HLTH-03 | Blood work AI analysis generates results | Critical | AI analysis → `blood_work_results` insert |
| HLTH-04 | Blood work results page shows analyzed data | Critical | `blood_work_results` JOIN `blood_work` |
| HLTH-05 | Add medication → saved to medications | Critical | `medications` insert |
| HLTH-06 | Edit medication dosage | High | `medications` update |
| HLTH-07 | Delete medication | High | `medications` soft/hard delete |
| HLTH-08 | Medication-meal interaction check | High | `useMealMedicineCheck` → `meal_medicine_check` |
| HLTH-09 | Google Fit / Apple Health sync trigger | Medium | `google-fit-token` edge function, `health-integration` |
| HLTH-10 | Health score calculation displays | Medium | `calculate-health-score` edge function |

### 4.10 Recovery & Readiness Insights
**Routes:** `/recovery-insights`
**Lib:** `health-readiness.ts`
**DB:** `health_daily_metrics`, `recovery_plans`
**Edge Functions:** `calculate-health-score`

| Test ID | Scenario | Priority | Integration Points |
|---------|----------|----------|-------------------|
| REC-01 | Recovery readiness score renders (or "need data" state) | Critical | `calculateRecoveryReadiness()` from health data |
| REC-02 | Body load score renders | High | `calculateBodyLoad()` |
| REC-03 | Health baseline calculation shows trends | High | `calculateHealthBaseline()` over last 7 days |
| REC-04 | Food recommendation tip based on readiness | High | `buildReadinessFoodTip()` |
| REC-05 | Recovery plan recommendation | Medium | `getRecoveryPlanKey()` |
| REC-06 | Empty state when no health data synced | Critical | Edge case for new users |

### 4.11 Goals & Nutrition Goals
**Routes:** `/nutrition-goals`, `/edit-goal`, `/goals` (redirects to `/nutrition-goals`)
**Lib:** `goal-engine.ts`
**DB:** `nutrition_goals`, `goal_proposals`

| Test ID | Scenario | Priority | Integration Points |
|---------|----------|----------|-------------------|
| GOAL-01 | View current nutrition goals | Critical | `nutrition_goals` by user |
| GOAL-02 | Create new nutrition goal | Critical | `nutrition_goals` insert |
| GOAL-03 | Edit existing goal | Critical | `nutrition_goals` update |
| GOAL-04 | Delete goal | High | `nutrition_goals` delete |
| GOAL-05 | Goal alignment score with current intake | High | `goal-engine.ts` → `progress_logs` comparison |
| GOAL-06 | Goal proposals from coach (if assigned) | Medium | `goal_proposals` from coach module |

### 4.12 Coach Suite
**Routes:** `/coaches`, `/coach-messages`, `/coach-schedule`, `/coach-programs`, `/coach-programs/workout/:id/day/:num`, `/workout-history`, `/become-coach`, `/coach-onboarding`, `/coach-subscription`
**DB:** `coach_clients`, `coach_messages`, `coach_sessions`, `coach_programs`, `workout_sessions`
**Hooks:** `useCoachPrograms`, `useCoachMessages`, `useCoachSessions`, `useCoachAvailability`, `useCoachChat`, `useCoachReviews`

| Test ID | Scenario | Priority | Integration Points |
|---------|----------|----------|-------------------|
| COACH-01 | Coaches directory lists available coaches | Critical | `coach_profiles` query |
| COACH-02 | View coach profile with reviews + rating | Critical | `coach_profiles` + `coach_reviews` |
| COACH-03 | Book a session with coach | Critical | `coach_sessions` insert |
| COACH-04 | Cancel a booked session | High | `coach_sessions` status update |
| COACH-05 | Message coach via chat | Critical | `coach_messages` insert (Realtime) |
| COACH-06 | View coach-suggested programs | High | `coach_programs` by coach assignment |
| COACH-07 | Complete guided workout → marks progress | High | `workout_sessions` insert |
| COACH-08 | View workout history | Medium | `workout_sessions` by user |
| COACH-09 | Apply to become a coach | Medium | `coach_applications` insert |
| COACH-10 | Coach subscription (user pays coach) | Medium | `coach_subscriptions` |

### 4.13 Community, Rewards & XP
**Routes:** `/community`, `/rewards`, `/friends`, `/friend-leaderboard`, `/log-activity`
**DB:** `xp_ledger`, `levels`, `badges`, `rewards`, `community_challenges`, `friend_connections`, `daily_missions`
**Hooks:** `useCommunityChallenges`, `useDailyMissions`, `useFriends`, `useFriendLeaderboard`, `useStreak`
**Edge Functions:** `send-milestone-notification`

| Test ID | Scenario | Priority | Integration Points |
|---------|----------|----------|-------------------|
| COM-01 | Community challenges load and display | Critical | `community_challenges` query |
| COM-02 | Join a community challenge | Critical | `challenge_participants` insert |
| COM-03 | Challenge progress updates in real-time | High | Realtime subscription on challenge progress |
| COM-04 | Daily missions display with completion status | High | `daily_missions` query |
| COM-05 | Complete daily mission → XP awarded | Critical | `award_xp` RPC |
| COM-06 | Current level + XP progress bar | Critical | `xp_ledger` → level calculation |
| COM-07 | Badges earned display in profile | High | `badges` JOIN `user_badges` |
| COM-08 | Redeem reward → wallet credit or discount | Critical | `rewards` redemption → `wallet_transactions` |
| COM-09 | Add friend by email/username | High | `friend_connections` insert |
| COM-10 | Accept friend request | High | `friend_connections` update |
| COM-11 | Friend leaderboard ranks by XP | High | `friend_connections` JOIN `xp_ledger` |
| COM-12 | Streak counter increments on consecutive daily logins | High | Streak calculation logic |
| COM-13 | Log activity (custom) → XP | Medium | `activity_logs` insert + XP |

### 4.14 Affiliate & Referrals
**Routes:** `/affiliate`, `/affiliate/tracking`
**DB:** `affiliate_links`, `referrals`, `commission_logs`
**Edge Functions:** `send-affiliate-welcome`, `send-commission-notification`, `send-affiliate-status-notification`, `send-monthly-affiliate-report`

| Test ID | Scenario | Priority | Integration Points |
|---------|----------|----------|-------------------|
| AFF-01 | Affiliate dashboard shows referral link | Critical | `affiliate_links` by user |
| AFF-02 | Share referral link → copies to clipboard | High | Clipboard API + tracking |
| AFF-03 | Referral tracking shows signups + commissions | Critical | `referrals` JOIN `commission_logs` |
| AFF-04 | Commission earned → wallet credited | Critical | Commission → `wallet_transactions` |
| AFF-05 | Affiliate status badge | Medium | Tier calculation from referrals count |

### 4.15 Settings, Profile, Personal Info
**Routes:** `/settings`, `/profile`, `/personal-info`
**DB:** `profiles`, `user_settings`
**Hooks:** `useProfile`

| Test ID | Scenario | Priority | Integration Points |
|---------|----------|----------|-------------------|
| SET-01 | Profile page shows user info from `profiles` | Critical | `profiles` query |
| SET-02 | Edit name/phone/avatar → saves to `profiles` | Critical | `profiles` update |
| SET-03 | Upload profile avatar → Storage bucket | High | Storage upload → `profiles.avatar_url` |
| SET-04 | Change password | High | Supabase Auth `updateUser` |
| SET-05 | Toggle notification preferences | High | `user_settings` update |
| SET-06 | Language toggle (Arabic/English) | High | i18n switch, persists to `user_settings` |
| SET-07 | Dietary preferences management | High | `dietary_preferences` CRUD |
| SET-08 | Delete account | Low | Account deletion flow |

### 4.16 Addresses
**Routes:** `/addresses`
**DB:** `addresses`

| Test ID | Scenario | Priority | Integration Points |
|---------|----------|----------|-------------------|
| ADDR-01 | List saved addresses | Critical | `addresses` by user |
| ADDR-02 | Add new address (street, building, area, etc.) | Critical | `addresses` insert |
| ADDR-03 | Edit existing address | Critical | `addresses` update |
| ADDR-04 | Delete address | High | `addresses` delete |
| ADDR-05 | Set default address | High | `addresses.is_default` flag |
| ADDR-06 | Address used in checkout auto-selects | Critical | Address → checkout flow |

### 4.17 Recipes & Marketplace
**Routes:** `/recipes`, `/recipes/new`, `/recipes/:id`, `/marketplace`
**DB:** `recipes`, `recipe_ingredients`, `marketplace_listings`

| Test ID | Scenario | Priority | Integration Points |
|---------|----------|----------|-------------------|
| REC-01 | Browse recipes list | Medium | `recipes` query |
| REC-02 | View recipe detail with ingredients + instructions | Medium | `recipes` JOIN `recipe_ingredients` |
| REC-03 | Create new recipe | Low | `recipes` insert + ingredients |
| REC-04 | Marketplace items list | Medium | `marketplace_listings` |

### 4.18 Recovery Partners
**Routes:** `/recovery`, `/recovery/:id`, `/recovery/bookings`
**DB:** `recovery_partners`, `recovery_bookings`

| Test ID | Scenario | Priority | Integration Points |
|---------|----------|----------|-------------------|
| RP-01 | Recovery partners directory | Critical | `recovery_partners` query |
| RP-02 | Partner detail page with services | Critical | `recovery_partners` single |
| RP-03 | Book a recovery session | Critical | `recovery_bookings` insert |
| RP-04 | View my bookings | High | `recovery_bookings` by user |
| RP-05 | Cancel a booking | High | `recovery_bookings` status update |

### 4.19 Notifications & Support
**Routes:** `/notifications`, `/support`
**DB:** `notifications`, `support_threads`, `support_messages`
**Edge Functions:** `send-push-notification`, `send-email`, `send-whatsapp-proxy`, `process-whatsapp-notifications`

| Test ID | Scenario | Priority | Integration Points |
|---------|----------|----------|-------------------|
| NOTIF-01 | Notifications list loads | Critical | `notifications` by user |
| NOTIF-02 | Mark notification as read | Critical | `notifications.read_at` update |
| NOTIF-03 | Mark all as read | High | Bulk update |
| NOTIF-04 | Click notification → deep link to relevant page | High | `notifications.deep_link` → navigation |
| NOTIF-05 | Support page shows contact options | High | Static content + form |
| NOTIF-06 | Submit support ticket → inserted | Critical | `support_threads` + `support_messages` |

### 4.20 AI Reports
**Routes:** `/ai-report`
**Edge Functions:** `generate-ai-insight`, `generate-coach-report`
**DB:** `ai_reports`

| Test ID | Scenario | Priority | Integration Points |
|---------|----------|----------|-------------------|
| AI-01 | AI-generated weekly report loads | High | `generate-ai-insight` edge function |
| AI-02 | Download report as PDF | Medium | Report export |
| AI-03 | Empty state when insufficient data | Medium | Graceful fallback |

---

## 5. Cross-Module Integration Scenarios (Critical Path Tests)

These tests **must pass** before go-live. Each spans multiple pages, DB tables, and edge functions.

### Scenario A: Complete Meal → XP → Challenge Cycle
```
1. User logs in → `/auth` → `/dashboard`
2. Navigate to `/tracker` → log a meal (name, calories, macros)
3. Verify: `meal_history` has new row
4. Verify: `progress_logs` updated with today's totals
5. Verify: XP awarded via `award_xp_for_meal_log` RPC → `xp_ledger` has row
6. Verify: `increment_meals_logged` RPC ran
7. Verify: Community challenge progress synced via `syncCommunityChallengeProgressQuietly()`
8. Verify: Dashboard progress bars reflect new data
9. Verify: Streak counter did not reset
```
**DB tables affected:** `meal_history`, `progress_logs`, `xp_ledger`, `challenge_participants`  
**Edge functions:** `analyze-meal-image` (if photo), `award_xp_for_meal_log` (RPC)  
**Assert count:** ≥8 assertions  

### Scenario B: Browse → Schedule → Order → Payment → Delivery
```
1. Browse meals at `/meals` → apply dietary filter
2. View meal detail at `/meals/:id`
3. Add meal to schedule at `/schedule`
4. Go to `/checkout` → cart reflects selected meals
5. Select delivery address from `/addresses` (or add new)
6. Select delivery time slot
7. Pay with wallet (if sufficient balance)
8. Verify: `orders` table has new row with status 'confirmed'
9. Verify: `order_items` has correct items
10. Verify: `wallet_transactions` has debit entry
11. Verify: `invoices` has new invoice row
12. Verify: Dashboard shows order count increment
13. View order at `/orders/:id` → status timeline visible
14. Track delivery at `/tracking` → real-time map renders
```
**DB tables affected:** `orders`, `order_items`, `wallet_transactions`, `invoices`, `email_logs`  
**Edge functions:** `sadad-payment` (if SADAD), `send-email`  
**Third-party:** Resend (email), Mapbox/Leaflet (map)  
**Assert count:** ≥14 assertions  

### Scenario C: Subscription Upgrade → Payment → Feature Unlock
```
1. View current plan at `/subscription`
2. Browse plans at `/subscription/plans`
3. Select upgrade → redirected to payment
4. Complete SADAD payment (or simulate)
5. Verify: `upgrade-subscription` edge function called
6. Verify: `subscriptions.plan_id` updated to new plan
7. Verify: `invoices` has upgrade invoice
8. Verify: Dashboard subscription badge updated
9. Verify: New plan features accessible (e.g., AI reports)
10. Verify: `send-tier-upgrade-notification` fired
```
**DB tables affected:** `subscriptions`, `invoices`, `wallet_transactions`  
**Edge functions:** `upgrade-subscription`, `sadad-payment`, `send-tier-upgrade-notification`  
**Assert count:** ≥10 assertions  

### Scenario D: Health Sync → Readiness Score → Meal Recommendations
```
1. Health data exists in `health_daily_metrics` (pre-seeded)
2. Visit `/health/dashboard` → metrics display
3. Visit `/recovery-insights` → readiness score calculated
4. Verify: `calculateRecoveryReadiness()` returns valid score
5. Verify: `calculateBodyLoad()` returns valid score
6. Food recommendation tip rendered (`buildReadinessFoodTip()`)
7. Visit `/meals` → recommendations adjusted based on health state
8. Verify: `nutrition-profile-engine` edge function considered readiness
```
**DB tables affected:** `health_daily_metrics`  
**Lib:** `health-readiness.ts`  
**Edge functions:** `calculate-health-score`, `nutrition-profile-engine`, `recommend-meals`  
**Assert count:** ≥8 assertions  

### Scenario E: Community → XP → Rewards → Redemption
```
1. Visit `/community` → view active challenges
2. Join a challenge → `challenge_participants` inserted
3. Log meals to earn XP → verifiable in `xp_ledger`
4. Visit `/rewards` → badges/levels updated
5. Redeem a reward → wallet credited
6. Verify: `wallet_transactions` has credit entry
7. Verify: Leaderboard at `/friend-leaderboard` shows updated XP
8. Verify: Sent milestone notification (`send-milestone-notification`)
```
**DB tables affected:** `xp_ledger`, `wallet_transactions`, `challenge_participants`, `user_badges`  
**Edge functions:** `send-milestone-notification`  
**Assert count:** ≥8 assertions  

### Scenario F: Affiliate Link → Referral → Commission → Wallet
```
1. Visit `/affiliate` → get referral link
2. Simulate referral signup via link
3. Verify: `referrals` has new row
4. Verify: Commission calculated → `commission_logs` inserted
5. Verify: `wallet_transactions` has commission credit
6. Verify: Affiliate tracking at `/affiliate/tracking` shows referral
7. Verify: Welcome email sent (`send-affiliate-welcome`)
```
**DB tables affected:** `referrals`, `commission_logs`, `wallet_transactions`  
**Edge functions:** `send-affiliate-welcome`, `send-commission-notification`  
**Assert count:** ≥7 assertions  

---

## 6. Database Validation Checklist

### 6.1 Write Integrity
| Check | Tables | Method |
|-------|--------|--------|
| Meal log inserts into 3 tables atomically | `meal_history`, `progress_logs`, `xp_ledger` | Verify all 3 within same transaction scope |
| Order creates consistent records | `orders`, `order_items`, `payments`, `invoices` | FK constraints, no orphan items |
| Wallet credits/debits balance | `wallet_transactions` | Running balance = SUM(credits) − SUM(debits) |
| Subscription changes are versioned | `subscriptions`, `subscription_history` | History row created on every change |
| Challenge participation is unique | `challenge_participants` | No duplicate user+challenge rows |

### 6.2 RLS Policy Verification
| Table | Expected RLS | Test |
|-------|-------------|------|
| `meal_history` | user_id = auth.uid() | Try SELECT another user's rows → 0 results |
| `orders` | user_id = auth.uid() | Try UPDATE another user's order → 403 |
| `wallet_transactions` | user_id = auth.uid() | Try INSERT with another user_id → 403 |
| `addresses` | user_id = auth.uid() | Try DELETE another user's address → 403 |
| `notifications` | user_id = auth.uid() | Verify isolation between users |
| `health_daily_metrics` | user_id = auth.uid() | Verify health data isolation |
| `xp_ledger` | user_id = auth.uid() | Verify XP isolation |
| `recovery_bookings` | user_id = auth.uid() | Verify booking isolation |

### 6.3 Constraint Validation
| Constraint | Tables | Test |
|------------|--------|------|
| NOT NULL on critical fields | All | Attempt insert with NULL on required fields |
| UNIQUE on email | `profiles` | Duplicate email → conflict error |
| FK cascade on user delete | All FK tables | Delete profiles → child rows cascade |
| CHECK (amount > 0) | `wallet_transactions` | Insert zero/negative amount → rejected |
| ENUM values | `orders.status`, `payments.status` | Insert invalid enum → error |

---

## 7. API / Edge Function Validation Checklist

| Edge Function | Method | Auth Required | Payload Validation | Expected Response | Failure Mode |
|--------------|--------|--------------|-------------------|-------------------|-------------|
| `sadad-payment` | POST | Yes (JWT) | amount>0, orderId required | `{payment_id, payment_url}` | Invalid amount → 400, no auth → 401 |
| `analyze-meal-image` | POST | Yes (JWT) | image file, multipart | `{nutrition_data}` | Bad image → 400, auth fail → 401 |
| `recommend-meals` | POST | Yes (JWT) | userId, preferences | `{meals: []}` | Empty prefs → all meals |
| `upgrade-subscription` | POST | Yes (JWT) | planId, paymentId | `{success, subscription}` | Invalid plan → 400 |
| `generate-ai-insight` | POST | Yes (JWT) | dateRange, type | `{insight_text}` | No data → graceful message |
| `calculate-health-score` | POST | Yes (JWT) | userId (service role) | `{score, components}` | No data → null score |
| `check-ip-location` | POST | No | IP address | `{allowed, country}` | Invalid IP → 400 |
| `lookup-barcode` | GET | Yes (JWT) | barcode string | `{product, nutrition}` | No match → 404 |
| `predict-nutrition` | POST | Yes (JWT) | meal description | `{nutrition_estimate}` | Bad description → 400 |
| `translate-meal` | POST | Yes (JWT) | text, targetLang | `{translated_text}` | Unsupported lang → 400 |

---

## 8. Security & RLS Audit Checklist

| # | Check | Method |
|---|-------|--------|
| SEC-01 | RLS enabled on all user-owned tables | `supabase` queries `pg_tables` + `pg_policies` |
| SEC-02 | No public INSERT on any customer-owned table | Verify no `USING (true)` policies |
| SEC-03 | Service role only for server-side operations | Verify edge functions use service key, not anon key |
| SEC-04 | JWT expiry forces re-login | Wait 1h → attempt API call → 401 |
| SEC-05 | SQL injection protection on all user inputs | Attempt `' OR 1=1--` in search fields |
| SEC-06 | XSS prevention on user-generated content | Attempt `<script>alert(1)</script>` in meal name |
| SEC-07 | CORS restricted to app origin | Verify CORS headers in edge functions |
| SEC-08 | Rate limiting on auth endpoints | 100 rapid requests → rate limit error |
| SEC-09 | No PII in URLs or logs | Audit `console.error` calls for sensitive data |
| SEC-10 | File upload type validation | Attempt `.exe` upload on avatar/blood work |

---

## 9. UI/UX Regression Checklist

| # | Check | Viewport |
|---|-------|----------|
| UX-01 | All pages render at 430px mobile width without horizontal scroll | 430×932 |
| UX-02 | All buttons ≥44px touch target | 430×932 |
| UX-03 | Loading states (skeleton/spinner) display on data fetch | All breakpoints |
| UX-04 | Error states (toast/inline) for failed API calls | All breakpoints |
| UX-05 | Empty states when no data exists | All breakpoints |
| UX-06 | Arabic RTL rendering on all pages | All breakpoints |
| UX-07 | Navigation bottom bar works at mobile | 430×932 |
| UX-08 | Pull-to-refresh on data pages | Mobile |
| UX-09 | Keyboard dismiss on form input | Mobile |
| UX-10 | Safe area insets on notched devices | Mobile |

---

## 10. Existing Test Infrastructure Assessment

| Metric | Value | Verdict |
|--------|-------|---------|
| Total E2E test files | 82 | ❌ All auto-generated, never matched |
| Total test cases | 927 | ❌ 97.3% failure rate |
| Working auth tests | 10 of 333 customer tests | ⚠️ Fragile (no token reuse) |
| `data-testid` usage | **0 attributes** across customer pages | ❌ Critical gap |
| Test data seeding | **None** | ❌ Critical gap |
| Auth token/state reuse | **None** | ❌ Each test re-logs in |
| Page Object Models | **None** | ❌ Tests are unmaintainable |
| Visual regression | **None** | ❌ Missing |
| Accessibility checks | **None** | ❌ Missing |
| API mock layer | **None** | ❌ Tests hit production |

---

## 11. Bug Report Table (Known Issues)

| Bug ID | Module | Description | Severity | Root Cause |
|--------|--------|-------------|----------|------------|
| BUG-001 | Checkout | Route `/cart` redirects to `/checkout` but no cart state check | High | Cart state may be empty on direct nav |
| BUG-002 | Subscription | `/plans` redirect → `/subscription/plans`, but `/subscribe` → `/subscription` (not `/subscription/plans`) | Medium | Inconsistent redirect targets |
| BUG-003 | Goals | `/goals` redirects to `/nutrition-goals` but `/edit-goal` also goes to NutritionGoals page | Medium | Route ambiguity |
| BUG-004 | Meals | No verification that `/favorites` reacts to favorite toggle in real-time | High | No Realtime subscription on favorites |
| BUG-005 | Wallet | Top-up flow creates invoice after wallet credit — if credit succeeds but invoice fails, no reversal | High | Missing compensating transaction |
| BUG-006 | Affiliate | No route-level guard checking if user is eligible for affiliate program | Medium | Unauthorized access possible |
| BUG-007 | Coach | `/become-coach` accessible even if user already applied | Low | Missing application status check |
| BUG-008 | Onboarding | No route guard preventing re-onboarding for existing users | Medium | Direct nav to `/onboarding` may show stale flow |
| BUG-009 | Notifications | No unread count badge in navigation | Low | UX gap |
| BUG-010 | Settings | Password change logs out without warning | Medium | UX gap — no confirmation toast |

---

## 12. Go-Live Readiness Score: 18/100

| Category | Weight | Score | Notes |
|----------|--------|-------|-------|
| E2E test coverage | 25% | 5/100 | Only 10 auth tests pass; zero integration tests |
| Data integrity | 15% | 30/100 | DB constraints exist but untested under load |
| Security/RLS | 15% | 25/100 | Policies defined but untested for bypass |
| Payment flow | 15% | 10/100 | SADAD integration exists but sandbox testing incomplete |
| Auth flow | 10% | 50/100 | Works manually, E2E tests pass for basic cases |
| Mobile UX | 10% | 20/100 | No mobile testing done; Capacitor untested |
| Performance | 5% | 10/100 | No load testing; 52 edge functions may have cold starts |
| Accessibility | 5% | 0/100 | Not tested at all |
| **TOTAL** | **100%** | **18/100** | **❌ NOT READY** |

### Go-Live Decision: ❌ BLOCKED

**Must pass before go-live:**
1. Add `data-testid` attributes to all interactive elements (est. 2 days)
2. Implement test data seeding/decorators (est. 1 day)
3. Implement auth token reuse via `storageState` (est. 0.5 day)
4. Implement and pass Scenario A (Meal→XP→Challenge) (est. 1 day)
5. Implement and pass Scenario B (Order→Payment→Delivery) (est. 2 days)
6. Implement and pass Scenario C (Subscription upgrade) (est. 1 day)
7. Verify all 10 RLS policies with actual role-based access tests (est. 0.5 day)
8. Fix top 5 bugs from bug report table (est. 1 day)

**Total estimated effort: 9 days** before any customer portal can be certified as go-live ready.

---

## 13. Recommended Test Automation Strategy

### Phase 1: Foundation (Week 1)
1. Add `data-testid` attributes to all customer page components
2. Create `test-data/seeds.ts` with SQL seed files for deterministic test data
3. Implement `storageState` fixture for auth token reuse (login once per test suite)
4. Set up `.env.test` with dedicated Supabase project/branch for E2E
5. Fix BASE_URL to `5173` consistently

### Phase 2: Critical Paths (Week 2)
6. Implement Page Object Models for 6 core pages (Dashboard, Meals, Checkout, Orders, Wallet, Subscriptions)
7. Implement and automate Scenarios A, B, C
8. Verify all edge functions with contract tests

### Phase 3: Coverage (Week 3)
9. Automate Scenarios D, E, F
10. Implement the 120 module-specific tests from sections 4.1–4.20
11. Add visual regression with Percy/Chromatic

### Phase 4: Quality Gates (Week 4)
12. Add accessibility checks (axe-core)
13. Performance testing with Lighthouse CI
14. RLS penetration testing
15. Full regression suite in CI pipeline

---

## 14. Test File Structure Recommendation

```
e2e/
├── config/
│   └── test-data.ts          # Seed data + fixtures
│   └── routes.ts             # Route constants (matches src/customer/routes.tsx)
├── fixtures/
│   └── auth-fixture.ts       # storageState-based auth (login once)
│   └── db-fixture.ts         # Data seeding before/after
├── pages/                    # Page Object Models
│   ├── auth.page.ts
│   ├── dashboard.page.ts
│   ├── meals.page.ts
│   ├── checkout.page.ts
│   ├── orders.page.ts
│   ├── wallet.page.ts
│   └── subscription.page.ts
├── specs/                    # Actual test files
│   ├── auth.spec.ts
│   ├── food-logging.spec.ts
│   ├── subscription.spec.ts
│   ├── checkout.spec.ts
│   ├── affiliate.spec.ts
│   ├── community.spec.ts
│   └── integrations/         # Cross-module scenarios
│       ├── scenario-a-meal-xp.spec.ts
│       ├── scenario-b-order-delivery.spec.ts
│       ├── scenario-c-subscription.spec.ts
│       ├── scenario-d-health-readiness.spec.ts
│       ├── scenario-e-community-rewards.spec.ts
│       └── scenario-f-affiliate-commission.spec.ts
├── security/
│   └── rls-policies.spec.ts
└── utils/
    ├── api-client.ts          # Direct API calls for verification
    ├── db-assertions.ts       # DB-level assertion helpers
    └── helpers.ts             # Existing helpers (refactor)
```

---

## 15. Appendix: Existing Test Files Audit

| File | Test Count | Status | Action |
|------|-----------|--------|--------|
| `customer/auth-fixed.spec.ts` | 12 | ⚠️ 10 pass, 2 skip | Keep — refactor to use storageState |
| `customer/auth.spec.ts` | ~15 | ❌ All fail | Delete — superseded by auth-fixed |
| `customer/checkout.spec.ts` | ~12 | ❌ TODO stubs | Rewrite with POM |
| `customer/meals.spec.ts` | ~15 | ❌ TODO stubs | Rewrite with POM |
| `customer/orders.spec.ts` | ~15 | ❌ TODO stubs | Rewrite with POM |
| `customer/dashboard.spec.ts` | ~15 | ❌ TODO stubs | Rewrite with POM |
| `customer/wallet.spec.ts` | ~10 | ❌ TODO stubs | Rewrite with POM |
| `customer/subscription.spec.ts` | ~10 | ❌ TODO stubs | Rewrite with POM |
| `customer/schedule.spec.ts` | ~10 | ❌ TODO stubs | Rewrite with POM |
| `customer/progress.spec.ts` | ~10 | ❌ TODO stubs | Rewrite |
| `customer/profile.spec.ts` | ~8 | ❌ TODO stubs | Rewrite |
| `customer/settings.spec.ts` | ~8 | ❌ TODO stubs | Rewrite |
| `customer/notifications.spec.ts` | ~6 | ❌ TODO stubs | Rewrite |
| `customer/addresses.spec.ts` | ~6 | ❌ TODO stubs | Rewrite |
| `customer/affiliate.spec.ts` | ~8 | ❌ TODO stubs | Rewrite |
| `customer/referral.spec.ts` | ~6 | ❌ TODO stubs | Rewrite |
| `customer/billing.spec.ts` | ~6 | ❌ TODO stubs | Rewrite |
| `customer/gamification.spec.ts` | ~8 | ❌ TODO stubs | Rewrite |
| `customer/support.spec.ts` | ~5 | ❌ TODO stubs | Rewrite |
| `customer/onboarding.spec.ts` | ~6 | ❌ TODO stubs | Rewrite |
| `customer/integration.spec.ts` | ~10 | ❌ TODO stubs | Rewrite as Scenarios A-F |
| `customer/ai.spec.ts` | ~5 | ❌ TODO stubs | Rewrite |
| `customer/mobile.spec.ts` | ~5 | ❌ TODO stubs | Rewrite |
| `customer/static.spec.ts` | ~4 | ❌ TODO stubs | Rewrite |
| **All customer files** | **~230** | **❌ 97.3% fail** | **Full rewrite needed** |

---

*Prepared for CTO review. All findings verified against actual source code at `src/customer/routes.tsx`, `supabase/functions/`, and `src/lib/`.*
