# Nutrio Codebase Feature Audit

**Date:** 2026-03-30  
**Scope:** `src/`, `supabase/migrations/`, `integrations/`

---

## 1. Implemented Features

### 1.1 Pages & Screens (36 customer + 13 driver + 14 partner + 28 admin + fleet)

#### Customer App
| Page | Path | Status |
|------|------|--------|
| Walkthrough/Landing | `/walkthrough`, `/` | ✅ Implemented |
| Auth (login/signup) | `/auth` | ✅ Implemented |
| Reset Password | `/reset-password` | ✅ Implemented |
| Onboarding | `/onboarding` | ✅ Implemented |
| Dashboard | `/dashboard` | ✅ Implemented |
| Meals Browser | `/meals` | ✅ Implemented |
| Meal Detail | `/meals/:id` | ✅ Implemented |
| Restaurant Detail | `/restaurant/:id` | ✅ Implemented |
| Checkout | `/checkout` | ✅ Implemented |
| Order History | `/orders` | ✅ Implemented |
| Live Map / Tracking | `/live/:id` | ✅ Implemented |
| Delivery Tracking | `/tracking` | ✅ Redirects to dashboard |
| Subscription | `/subscription` | ✅ Implemented |
| Subscription Plans | `/subscription/plans` | ✅ Implemented |
| Progress / Body Metrics | `/progress`, `/progress/redesigned` | ✅ Implemented (2 versions) |
| Weight Tracking | `/weight-tracking` | ✅ Implemented |
| Water Tracker | `/water-tracker` | ✅ Implemented |
| Meal Plan / AI Planner | `/meal-plan`, `/planner/ai-weekly` | ✅ Implemented |
| Schedule | `/schedule` | ✅ Implemented |
| Dietary Preferences | `/dietary` | ✅ Implemented |
| Tracker | `/tracker` | ✅ Implemented |
| Step Counter | `/step-counter` | ✅ Implemented |
| Wallet | `/wallet` | ✅ Implemented |
| Favorites | `/favorites` | ✅ Implemented |
| Referral Tracking | `/referral-tracking` | ✅ Implemented |
| Affiliate Program | `/affiliate` | ✅ Implemented |
| Notifications | `/notifications` | ✅ Implemented |
| Settings | `/settings` | ✅ Implemented |
| Profile / Personal Info | `/profile`, `/personal-info` | ✅ Implemented |
| Addresses | `/addresses` | ✅ Implemented |
| Invoice History | `/invoice-history` | ✅ Implemented |
| Google Fit Callback | `/google-fit-callback` | ✅ Implemented |
| Support / FAQ / Contact | `/support`, `/faq`, `/contact` | ✅ Implemented |
| About / Privacy / Terms | `/about`, `/privacy`, `/terms`, `/policies` | ✅ Implemented |
| Nutrition Dashboard | `/dashboard/nutrition` | ✅ Implemented |
| Smart Recommendations | `/recommendations/smart-meals` | ✅ Implemented |
| Body Progress Dashboard | `/progress/body` | ✅ Implemented |

#### Driver App (13 pages)
Auth, Dashboard, Orders, Order Detail, History, Earnings, Payouts, Profile, Settings, Support, Notifications, Onboarding, QR Scanner

#### Partner/Restaurant App (14 pages)
Auth, Dashboard, Orders, Analytics, Menu, Addons, Reviews, Earnings, Payouts, Profile, Settings, Notifications, Onboarding, Pending Approval, Boost

#### Admin Panel (28 pages)
Dashboard, Users, Orders, Restaurants, Restaurant Detail, Drivers, Subscriptions, Subscription Dashboard, Freeze Management, Promotions, Meal Approvals, Diet Tags, Featured, Deliveries, Payouts, Analytics, Income, Profit Dashboard, Settings, IP Management, Notifications, Support, Exports, AI Engine Monitor, Retention Analytics, Premium Analytics, Affiliate Applications, Affiliate Payouts, Milestones, Streak Rewards

#### Fleet Management
Full sub-app with: Live Tracking, Driver Management, Vehicle Management, Order Management, Payout Management, Dispatch Map, Dashboard Stats, Driver Filters, Zone/City Selection

### 1.2 User Flows

| Flow | Status | Notes |
|------|--------|-------|
| **Auth** (signup/login/forgot/reset) | ✅ Complete | Supabase auth, session timeout manager |
| **Onboarding** | ✅ Complete | Recovery dialog exists |
| **Meal browsing & filtering** | ✅ Complete | Cuisine chips, meal filters, search |
| **Restaurant browsing** | ✅ Complete | Cards, detail, reviews, branches |
| **Order placement** | ✅ Complete | Checkout, addons, meal scheduling |
| **Order modification** | ✅ Complete | ModifyOrderModal, skip reason |
| **Order tracking** | ✅ Complete | LiveMap, driver markers, route polyline |
| **Delivery tracking** | ✅ Complete | Mapbox integration, real-time driver location |
| **Subscription purchase** | ✅ Complete | SubscriptionWizard, billing toggle, plans |
| **Subscription freeze** | ✅ Complete | Freeze modal, admin freeze management |
| **Cancellation flow** | ✅ Complete | 4-step survey → pause offer → discount → final |
| **Wallet top-up** | ✅ Complete | Packages, transaction history |
| **Referral system** | ✅ Complete | Milestones, tracking |
| **Affiliate program** | ✅ Complete | Application, earnings, leaderboard |
| **One-tap reorder** | ✅ Complete | OneTapReorder component |
| **Push notifications** | ✅ Complete | Deep link support, preferences |
| **Guest login prompt** | ✅ Complete | |

### 1.3 AI/ML Features

| Feature | Status | Implementation |
|---------|--------|----------------|
| **AI Meal Plan Generator** | ✅ Implemented | `lib/meal-plan-generator.ts` |
| **AI Weekly Planner** | ✅ Implemented | `pages/planner/AIWeeklyPlanner.tsx` |
| **AI Meal Explanation** | ✅ Implemented | `components/AIMealExplanation.tsx` |
| **AI Report Generator** | ✅ Implemented | `lib/ai-report-generator.ts` — uses OpenRouter with free models (trinity, gemini-flash-lite, deepseek-v3, grok-4.1-fast) |
| **Smart Recommendations** | ✅ Implemented | `hooks/useSmartRecommendations.ts`, `pages/recommendations/` |
| **Behavior Prediction** | ✅ Implemented | `components/BehaviorPredictionWidget.tsx`, `behavior_predictions` table |
| **Weight Prediction** | ✅ Implemented | `components/WeightPredictionChart.tsx`, `weight_predictions` table |
| **Adaptive Goals** | ✅ Implemented | `hooks/useAdaptiveGoals.ts`, `components/AdaptiveGoalCard.tsx`, `adaptive_goal_settings` table |
| **Health Score** | ✅ Implemented | `hooks/useHealthScore.ts`, `components/health-score/ComplianceScoreCard.tsx` |
| **Meal Quality Score** | ✅ Implemented | `hooks/useMealQuality.ts`, `progress/MealQualityScore.tsx` |
| **Nutrition Calculator** | ✅ Implemented | `lib/nutrition-calculator.ts` |
| **Auto Workout Detection** | ✅ Implemented | `hooks/useAutoWorkoutDetection.ts` |
| **Plateau Detection** | ✅ Implemented | DB function `detect_weight_plateau`, `plateau_events` table |

### 1.4 Payment Methods

| Method | Status | Notes |
|--------|--------|-------|
| Credit Card | ✅ Simulated | Via `payment-simulation.ts` |
| Debit Card | ✅ Simulated | Via `payment-simulation.ts` |
| Sadad (Qatar) | ⚠️ Scaffolded | `lib/sadad.ts` — full client written, signature verification is placeholder, requires merchant credentials |
| Apple Pay | ✅ Simulated | Listed as payment option |
| Google Pay | ✅ Simulated | Listed as payment option |
| Wallet credits | ✅ Implemented | `services/walletService.ts`, `customer_wallets` table |

**All real payments are currently simulated.** `VITE_ENABLE_PAYMENT_SIMULATION` flag controls this. No live payment gateway (Stripe, etc.) is integrated.

### 1.5 Notification Channels

| Channel | Status | Implementation |
|---------|--------|----------------|
| **Push notifications** | ✅ Implemented | `lib/notifications/push.ts`, deep links, preferences |
| **WhatsApp** | ✅ Implemented | `lib/whatsapp.ts` — via Ultramsg API (order confirm, driver assign, pickup, delivered, partner/driver/admin alerts) |
| **Email** | ✅ Implemented | `lib/resend.ts` — Resend API, `lib/email-templates.ts`, `lib/email-service.ts` |
| **In-app notifications** | ✅ Implemented | `notifications` table, `notification_queue`, preferences |
| **SMS** | ❌ Not implemented | No SMS gateway found |

---

## 2. Data Model

### 2.1 Database Tables (~120 tables in Supabase)

**Core Business:**
- `users`, `profiles`, `user_profiles`, `user_roles`, `user_addresses`
- `restaurants`, `restaurant_details`, `restaurant_addons`, `restaurant_reviews`, `restaurant_capacity_status`
- `meals`, `meal_categories`, `meal_addons`, `meal_diet_tags`, `meal_reviews`, `meal_plans`, `meal_schedules`, `meal_history`
- `orders`, `order_items`, `order_status_history`, `order_cancellations`
- `payments`, `payment_processing_errors`
- `invoices`, `invoice_items`

**Subscription & Billing:**
- `subscriptions`, `subscription_plans`, `subscribers`
- `win_back_offers`, `cancellation_attempts`

**Nutrition & Health:**
- `user_nutrition_log`, `nutrition_goals`, `user_dietary_preferences`, `diet_tags`
- `body_measurements`, `weight_predictions`, `water_intake`, `progress_logs`
- `weekly_nutrition_reports`, `weekly_adherence`
- `user_goals`, `goal_adjustment_history`, `adaptive_goal_settings`
- `workout_sessions`, `user_streaks`

**Delivery & Fleet:**
- `deliveries`, `deliveries_legacy`, `delivery_jobs`, `delivery_queue`, `delivery_status_history`
- `drivers`, `driver_documents`, `driver_locations`, `driver_payouts`, `driver_earnings`, `driver_reviews`, `driver_activity_log`, `driver_wallet_transactions`, `driver_withdrawals`
- `vehicles`, `zones`, `cities`
- `fleet_managers`, `fleet_activity_log`

**Partner System:**
- `partners`, `partner_requests`, `partner_earnings`, `partner_payouts`

**Wallet & Credits:**
- `customer_wallets`, `wallet_transactions`, `wallet_topup_packages`

**Referral & Affiliate:**
- `referral_milestones`, `user_milestones`, `user_milestone_achievements`
- `affiliate_applications`, `affiliate_commissions`, `affiliate_payouts`

**Gamification:**
- `achievements`, `user_achievements`, `badges`, `user_badges`
- `streak_rewards_claimed`, `leaderboards`, `leaderboard_entries`
- `community_challenges`, `challenge_participants`

**Gym/Recovery Partnerships (tables exist, no UI):**
- `gym_partner_profiles`, `gym_access`, `gym_access_log`, `gym_partner_analytics`
- `fitness_programs`

**Social:**
- `social_posts`, `post_comments`, `post_likes`

**Support & Admin:**
- `support_tickets`, `ticket_messages`, `ticket_attachments`
- `staff_members`, `staff_roles`, `staff_schedules`
- `announcements`, `health_tips`
- `promotions`, `promotion_usage`, `featured_listings`
- `nps_responses`, `api_logs`, `platform_settings`, `platform_logs`
- `blocked_ips`, `user_ip_logs`
- `gdpr_export_logs`

**Inventory & Supply:**
- `inventory_items`, `inventory_transactions`, `suppliers`, `kitchen_queue`

**Notifications:**
- `notifications`, `notification_queue`, `notification_preferences`, `push_tokens`

**Analytics:**
- `analytics_daily_stats`, `daily_margin_reports`

### 2.2 Key Relationships
- User → Profile → Subscription → Orders → Order Items → Meals
- Restaurant → Meals → Meal Categories / Diet Tags
- Order → Delivery → Driver (with assignment history)
- User → Wallet → Wallet Transactions
- User → Referral → Milestones
- User → Achievements / Badges / Streaks
- User → Body Measurements → Weight Predictions
- User → Nutrition Goals → Nutrition Log → Weekly Reports
- Partner → Partner Earnings → Partner Payouts

### 2.3 Notable DB Functions (~50+)
Extensive stored procedures for: order lifecycle, delivery dispatch, driver earnings, meal quality scoring, streak calculation, weight plateau detection, subscription management, wallet operations, NPS scoring, GDPR exports, capacity management, webhook scheduling.

---

## 3. Feature Readiness Assessment

| Feature | Readiness | Assessment |
|---------|-----------|------------|
| **Subscription Management** | 🟢 90% | Plans, wizard, freeze, cancellation flow, win-back offers, admin dashboard, billing intervals all implemented. Missing: live payment processing. |
| **Restaurant Partner System** | 🟢 85% | Full partner portal (auth, dashboard, menu, orders, reviews, analytics, payouts, addons, boost). Commission system exists. |
| **Delivery Tracking** | 🟢 90% | Mapbox maps, real-time driver location, fleet management sub-app, dispatch, auto-assignment, QR/pickup verification. |
| **Nutrition Tracking / Macros** | 🟢 85% | Nutrition log, goals, macro gauges, daily nutrition card, meal completion logging, water tracker, weekly reports, adherence scoring. |
| **Gym/Recovery Partnerships** | 🟡 30% | Tables exist (`gym_partner_profiles`, `gym_access`, `fitness_programs`). **No UI or service layer found.** Data model only. |
| **Corporate/B2B Features** | 🟡 15% | Some admin capabilities exist (staff roles, staff schedules, user subscription management). No dedicated B2B/corporate portal or multi-seat management. |
| **Family Plans** | 🔴 5% | No evidence of family plan UI or group subscription logic. Only individual subscriptions found. |
| **Dietitian Consultations** | 🔴 5% | Professional weekly reports exist (`lib/professional-weekly-report-pdf.ts`) but no consultation booking, messaging, or dietitian profile system. |
| **AI Recommendations** | 🟢 75% | Smart recommendations, behavior prediction, adaptive goals, AI meal planner, AI report generator all implemented. Relies on free OpenRouter models. |
| **Wallet/Credits System** | 🟢 85% | Wallet balance, top-up packages, transaction history, debit/credit operations, Sadad integration scaffolded. Missing: live payment. |
| **Referral System** | 🟢 80% | Referral milestones, tracking page, affiliate program with applications, commissions, payouts, leaderboard. |
| **Gamification** | 🟢 70% | Achievements, badges, streaks, streak rewards, leaderboards, community challenges. UI components exist. |
| **Social Features** | 🟡 40% | Tables for posts/comments/likes exist. Minimal UI — no social feed found. |
| **Inventory/Supply** | 🟡 30% | Tables exist. No UI or service layer for inventory management. |

---

## 4. Code Quality & Gaps

### 4.1 Hardcoded Values
- **Currency:** QAR (Qatar Riyal) hardcoded throughout — `currency.ts`, WhatsApp templates, payment config
- **Sadad:** Qatar-specific payment gateway
- **Country:** Phone format assumes Qatar (+974)
- **Mapbox:** Map library choice is hardcoded

### 4.2 TODO/FIXME/Stub Density
**356 TODO/FIXME/placeholder comments** across the codebase. Key areas:
- Fleet management pages (driver list, vehicle management, payout processing)
- Admin pages (drivers, orders, restaurants, promotions, subscriptions)
- Driver app pages (auth, support, payouts, order detail)
- UI components (input, select, textarea, command from shadcn)
- Sadad signature verification is a **placeholder**

### 4.3 Payment Integration
- **No live payment gateway.** Everything goes through `payment-simulation.ts`.
- Sadad integration is **scaffolded but not production-ready** (placeholder signature verification, requires merchant credentials).
- Apple Pay / Google Pay are listed as options but have no real implementation.

### 4.4 External Integrations

| Integration | Provider | Status |
|-------------|----------|--------|
| Auth | Supabase | ✅ Production |
| Database | Supabase (PostgreSQL + PostGIS) | ✅ Production |
| Maps | Mapbox | ✅ Production |
| Email | Resend | ✅ Production |
| WhatsApp | Ultramsg | ✅ Production |
| Push Notifications | Web Push API | ✅ Production |
| AI/LLM | OpenRouter (free models) | ✅ Working (free tier) |
| Payment | Simulation only | ⚠️ No live gateway |
| Analytics | Custom (analytics.ts) | ✅ Implemented |
| Error Tracking | Sentry | ✅ Configured |
| Health | Google Fit | ✅ Implemented |
| PDF Generation | Client-side (jspdf) | ✅ Implemented |
| i18n | LanguageContext | ✅ Basic implementation |

### 4.5 Test Coverage
Test files exist for: order status constants, push notifications, onboarding, subscription gate, subscription wizard, quota warning banner, sentry error boundary, order tracking hub, notification preferences. Coverage appears sparse relative to codebase size.

### 4.6 Technical Debt
- Two versions of Progress page (`Progress.tsx` and `ProgressRedesigned.tsx`) — unclear which is canonical
- Two versions of WeeklyMetricsForm (in `body-metrics/` and `body-progress/`)
- DriverLayout exists in both `components/` and `components/driver/`
- Fleet management is a full sub-app that could be extracted
- ~9200 lines of auto-generated Supabase types

---

## 5. Summary

**What's working well:** Nutrio has an impressive and feature-rich codebase with comprehensive customer, driver, partner, admin, and fleet management interfaces. The data model is extensive (~120 tables) with sophisticated stored procedures. AI features (recommendations, adaptive goals, report generation) are genuinely implemented. The notification system covers push, WhatsApp, email, and in-app channels.

**Critical gaps:**
1. **No live payment processing** — everything is simulated
2. **Gym/recovery partnerships** — data model exists, zero UI
3. **Corporate/B2B** — minimal support, no dedicated portal
4. **Family plans** — not implemented
5. **Dietitian consultations** — not implemented (only PDF reports)
6. **Social features** — tables exist, no social feed
7. **356 TODOs** — significant tech debt, especially in admin/fleet/driver pages
8. **Qatar-only** — currency, payment, phone format all hardcoded to Qatar market

**Codebase size:** ~300+ source files (excluding UI primitives), ~120 DB tables, ~50+ stored functions. This is a substantial, production-oriented application.
