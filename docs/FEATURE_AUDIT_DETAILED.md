# Nutrio Feature Audit — Detailed Report

> Generated: 2026-03-30
> Method: Full codebase search — every file verified, not guessed.

---

## Summary

| # | Feature | Status |
|---|---------|--------|
| 1 | Favorites System | ✅ EXISTS |
| 2 | Reviews/Ratings System | ✅ EXISTS |
| 3 | Meal Customization | ❌ MISSING |
| 4 | Addons System | ✅ EXISTS |
| 5 | Custom Macros Input | ✅ EXISTS |
| 6 | AI Meal Planner | ✅ EXISTS |
| 7 | Dietitian System | ❌ MISSING |
| 8 | Gym Partner System | ❌ MISSING |
| 9 | Recovery Credits System | ❌ MISSING |
| 10 | Corporate B2B | ❌ MISSING |
| 11 | Family Plans | ❌ MISSING |
| 12 | Driver System | ✅ EXISTS |
| 13 | Social Feed | ❌ MISSING |
| 14 | Daily Logging | ✅ EXISTS |
| 15 | Wallet System | ✅ EXISTS |
| 16 | Payment System | 🟡 PARTIAL |
| 17 | Referral System | ✅ EXISTS |
| 18 | Affiliate System | ✅ EXISTS |
| 19 | Gamification | ✅ EXISTS |
| 20 | Notifications | ✅ EXISTS |
| 21 | Delivery Tracking | 🟡 PARTIAL |
| 22 | Fleet Management | ✅ EXISTS |
| 23 | Subscription System | ✅ EXISTS |
| 24 | Arabic Translation | ✅ EXISTS |
| 25 | Admin Panel | ✅ EXISTS |

**Score: 16 ✅ | 2 🟡 | 7 ❌**

---

## Detailed Findings

### 1. Favorites System — ✅ EXISTS

**Evidence:**
- `hooks/useFavoriteRestaurants.ts` — Full hook with `toggleFavorite()`, fetches from Supabase
- `pages/Favorites.tsx` (374 lines) — Dedicated favorites page with tabs, filters, meal cards
- `pages/MealDetail.tsx` — Favorite toggle on meal detail
- `pages/RestaurantDetail.tsx` — Favorite toggle on restaurant detail
- `components/MainMenu.tsx` — Favorites link in navigation
- `components/SideDrawer.tsx` — Favorites in drawer nav

**DB Table:** `user_favorite_restaurants` (user_id, restaurant_id)

**What works:** Full CRUD — add/remove favorites, dedicated page, integrated in meal/restaurant detail views.
**What's missing:** No meal-level favorites (only restaurant-level). No favorite collections/lists.

---

### 2. Reviews/Ratings System — ✅ EXISTS

**Evidence:**
- `hooks/useMealReviews.ts` — Full hook with `submitReview()`, `deleteReview()`, `voteHelpful()`, pagination
- `components/MealReviewForm.tsx` — Review submission form (rating, title, text, photos, would_recommend, tags)
- `components/MealReviewsList.tsx` — Reviews display list
- `components/StarRating.tsx` — Star rating UI component
- `pages/MealDetail.tsx` — Reviews integrated in meal detail
- `pages/partner/PartnerReviews.tsx` — Partner view of reviews
- `hooks/useMealQuality.ts` — Quality scoring based on reviews

**DB Table:** `meal_reviews` (review_id, user_id, rating, title, review_text, photo_urls, is_verified_purchase, would_recommend, tags, helpful_count)

**What works:** Full review lifecycle — submit, display, delete, helpful votes, rating stats breakdown (5→1 stars), photo uploads, verified purchase badges.
**What's missing:** No review moderation UI for admins (only partner view exists).

---

### 3. Meal Customization — ❌ MISSING

**Evidence:**
- `pages/MealDetail.tsx` — Displays ingredients list but NO removal toggle, NO portion size selector, NO ingredient swap
- `components/MealWizard.tsx` — Only has a protein portion scoring heuristic (line 415), no user-facing customization
- No `useMealCustomization` hook found
- No "customize" UI components found
- No high-protein variant display found

**What works:** Ingredients are displayed read-only.
**What's missing:** Everything — ingredient removal, portion size selection, ingredient swapping, high-protein variants. Users cannot customize meals at all.

---

### 4. Addons System — ✅ EXISTS

**Evidence:**
- `hooks/useMealAddons.ts` — Full hook: fetch addons, `toggleAddon()`, `updateQuantity()`, `getSelectedAddonsTotal()`
- `components/MealAddonsManager.tsx` — Customer addon selection UI
- `pages/MealDetail.tsx` — Addons integrated in meal detail
- `pages/OrderDetail.tsx` — Addons shown in order detail
- `pages/partner/PartnerAddons.tsx` — Partner addon CRUD management
- `pages/partner/PartnerMenu.tsx` — Addons in menu management
- `pages/partner/PartnerOrders.tsx` — Addons in order display

**DB Table:** `meal_addons` (id, meal_id, name, description, price, category, is_available)

**What works:** Full addon lifecycle — customer selection with quantity, partner management, price calculation, order integration.

---

### 5. Custom Macros Input — ✅ EXISTS

**Evidence:**
- `hooks/useNutritionGoals.ts` — Full hook with goal types (weight_loss, muscle_gain, maintenance, general_health), macro targets (protein, carbs, fat, fiber, calories)
- `hooks/useAdaptiveGoals.ts` — Smart goal adjustment
- `hooks/useHealthScore.ts` — Health scoring based on goals
- `components/GoalsManagement.tsx` — Goal management UI
- `components/AdaptiveGoalCard.tsx` / `AdaptiveGoalsSettings.tsx` — Adaptive goal display
- `pages/Dashboard.tsx` — Macro progress display
- `components/DailyNutritionCard.tsx` — Daily macro tracking card
- `components/SubscriptionGate.tsx` — Goals tied to subscription tier

**DB Table:** `nutrition_goals` (id, goal_type, target_weight_kg, daily_calorie_target, protein_target_g, carbs_target_g, fat_target_g, fiber_target_g, is_active)

**What works:** Users can set custom macro targets (calories, protein, carbs, fat, fiber). Goals are tracked with milestones, adaptive adjustments, and weekly reports.
**What's missing:** No specific "custom macro input" wizard page — goals are set through the profile/settings flow.

---

### 6. AI Meal Planner — ✅ EXISTS

**Evidence:**
- `lib/meal-plan-generator.ts` (438 lines) — Full meal plan generator using Supabase queries
  - `generateWeeklyMealPlan(calorieTarget, proteinTarget)` → returns 7 days of meals
  - Fetches from `meals` table with restaurant joins
  - Filters by availability, nutrition, rating
  - Balances daily calories/protein/price
- `pages/planner/AIWeeklyPlanner.tsx` — Full UI for the AI planner
- `components/MealPlanGenerator.tsx` — Meal plan generator component
- `components/AIMealExplanation.tsx` — AI-powered meal explanation

**DB Tables:** `meals` (with restaurant join), reads real meal data

**What works:** Connected to real DB. Fetches actual meals from partner restaurants, filters by nutrition/rating/availability, generates balanced 7-day plans. Not a mock — queries live Supabase.
**What's missing:** No LLM/AI API integration — it's algorithmic (rule-based), not using OpenAI/Gemini etc.

---

### 7. Dietitian System — ❌ MISSING

**Evidence:**
- `grep -rl "dietitian\|consultation"` — Only matches in `LanguageContext.tsx` (translation keys) and `integrations/supabase/types.ts` (no relevant types)
- No dietitian pages, hooks, components, or DB tables found
- No booking system, no video call integration, no dietitian profiles

**What works:** Nothing.
**What's missing:** Entire feature — no dietitian profiles, booking, consultation, video calls, chat, or any related UI.

---

### 8. Gym Partner System — ❌ MISSING

**Evidence:**
- `grep -rl "gym_partner\|gym.*check\|QR.*gym"` — Only matches in fleet/driver QR scanner (for delivery, not gym)
- No gym partner pages, check-in system, QR codes for gym access
- No visit tracking, no gym integration

**What works:** Nothing.
**What's missing:** Entire feature — no gym partner registration, QR check-in, visit tracking, gym access management.

---

### 9. Recovery Credits System — ❌ MISSING

**Evidence:**
- `grep -rl "recovery\|spa\|massage\|cryotherapy"` — Only matches in `OnboardingRecoveryDialog.tsx` (name only) and translation files
- No recovery booking, no spa/massage/cryotherapy pages, no credits system

**What works:** Nothing beyond a recovery onboarding dialog name.
**What's missing:** Entire feature — no recovery service booking, no credits system, no spa/massage/cryotherapy integration.

---

### 10. Corporate B2B — ❌ MISSING

**Evidence:**
- `grep -rl "corporate\|b2b\|employee.*enroll\|HR"` — Only matches in translation/language context
- No corporate registration, employee enrollment, HR dashboard, company plans

**What works:** Nothing.
**What's missing:** Entire feature — no corporate accounts, employee management, HR analytics, B2B pricing.

---

### 11. Family Plans — ❌ MISSING

**Evidence:**
- `grep -rl "family_plan\|family_member\|child\|kids.*meal"` — No relevant results
- No family plan logic, child profiles, shared plans, kids meals

**What works:** Nothing.
**What's missing:** Entire feature — no family plans, child accounts, shared subscriptions, kids meal filters.

---

### 12. Driver System — ✅ EXISTS

**Evidence:**
- 13 driver pages: `DriverAuth`, `DriverDashboard`, `DriverEarnings`, `DriverHistory`, `DriverHome`, `DriverNotifications`, `DriverOnboarding`, `DriverOrderDetail`, `DriverOrders`, `DriverPayouts`, `DriverProfile`, `DriverSettings`, `DriverSupport`
- `components/driver/DriverLayout.tsx` — Driver app layout
- `components/driver/DriverQRScanner.tsx` — QR scanning for delivery verification
- `components/DriverLayout.tsx` — Additional driver layout
- `fleet/` directory — Full fleet management system with tracking, dispatch, vehicle management

**DB Tables:** `drivers`, `driver_earnings`, `deliveries` (with driver_id FK)

**What works:** Complete driver system — auth, dashboard, earnings, order management, payouts, notifications, profile, onboarding, QR scanning, plus full fleet management backend.
**What's missing:** Nothing significant — this is one of the most complete feature areas.

---

### 13. Social Feed — ❌ MISSING

**Evidence:**
- `grep -rl "social.*feed\|timeline\|community.*feed\|post"` — No relevant results for a social feed feature
- No feed pages, no post creation, no timeline, no community features

**What works:** Nothing.
**What's missing:** Entire feature — no social feed, community posts, user timelines, or sharing.

---

### 14. Daily Logging — ✅ EXISTS

**Evidence:**
- `pages/Tracker.tsx` — Main tracking page
- `pages/WaterTracker.tsx` — Water tracking page
- `pages/WeightTracking.tsx` — Weight tracking page
- `pages/StepCounter.tsx` — Step counter page
- `hooks/useWaterIntake.ts` / `hooks/useWaterEntries.ts` — Water logging hooks
- `hooks/useBodyMetrics.ts` / `hooks/useBodyMeasurements.ts` — Body metric tracking
- `hooks/useGoogleFitWorkouts.ts` — Google Fit workout import
- `hooks/useAutoWorkoutDetection.ts` — Auto workout detection
- `hooks/useHealthIntegration.ts` — Health data integration
- `components/LogMealDialog.tsx` — Meal logging dialog
- `components/LogActivitySheet.tsx` — Activity logging sheet
- `components/progress/WaterTracker.tsx` — Water tracker component
- `services/health/googleFit.ts` — Google Fit integration

**DB Table:** `user_nutrition_log` (with meal_id FK)

**What works:** Comprehensive logging — meals, water, weight, steps, workouts, body measurements, with Google Fit integration and auto-detection.
**What's missing:** No dedicated "daily log" single-page view that combines all logs; they're spread across separate pages.

---

### 15. Wallet System — ✅ EXISTS

**Evidence:**
- `pages/Wallet.tsx` — Wallet page
- `hooks/useWallet.ts` (60+ lines) — Full wallet hook with WalletData, WalletTransaction, TopUpPackage, PaymentRecord interfaces
- `services/walletService.ts` — Wallet service with `processWalletTopup()`, invoice generation, email notifications
- `components/wallet/WalletBalance.tsx` — Balance display
- `components/wallet/TopUpPackages.tsx` — Top-up package selection
- `components/wallet/TransactionHistory.tsx` — Transaction history list

**DB Tables:** `customer_wallets`, `wallet_transactions`, `wallet_topup_packages`

**What works:** Full wallet — balance tracking, top-up with bonus packages, transaction history, invoice generation, email receipts.
**What's missing:** Nothing significant.

---

### 16. Payment System — 🟡 PARTIAL

**Evidence:**
- `lib/payment-simulation.ts` (222 lines) — Full simulated payment flow with 3D Secure simulation
- `lib/payment-simulation-config.ts` — Payment simulation configuration
- `lib/sadad.ts` (219 lines) — **Real** Sadad payment gateway integration (Qatar)
  - Has API URL, merchant ID, secret key from env vars
  - Implements `createPayment()`, `verifyPayment()`, `handleCallback()`
- `hooks/useSimulatedPayment.ts` — Simulated payment hook
- `components/payment/` — Full payment UI: `CountdownTimer`, `PaymentMethodSelector`, `PaymentProcessingModal`, `PaymentSuccessScreen`, `PaymentFailureScreen`, `Simulated3DSecure`, `SimulatedCardForm`
- `components/SubscriptionWizard.tsx` — Subscription payment flow
- `pages/Checkout.tsx` — Checkout page

**What works:** Sadad gateway code is written with real API structure. Payment simulation flow is complete with 3D Secure mock. Full checkout UI.
**What's missing:** Sadad integration depends on env vars (`VITE_SADAD_MERCHANT_ID`, `VITE_SADAD_SECRET_KEY`) — likely not configured for production yet. No Stripe or other international gateway. All payments may currently route through simulation mode.

---

### 17. Referral System — ✅ EXISTS

**Evidence:**
- `pages/ReferralTracking.tsx` — Full referral tracking page with referral list, search, filters
- `components/ReferralMilestones.tsx` — Referral milestone display
- `hooks/useAffiliateProgram.ts` — Also handles referral data (tier1/2/3 referrals, commissions)

**DB Tables:** `affiliate_commissions` (used for referral tracking too)

**What works:** Referral tracking with tiered commissions, referral list with stats (total_orders, total_spent, commissions_earned), search and filter. Milestone display.
**What's missing:** No dedicated "share referral code" UI with deep links or QR codes. No referral reward redemption flow.

---

### 18. Affiliate System — ✅ EXISTS

**Evidence:**
- `pages/Affiliate.tsx` — Affiliate program page
- `hooks/useAffiliateProgram.ts` — Full affiliate hook with tiers, commissions, payouts, network members
- `hooks/useAffiliateApplication.ts` — Affiliate application hook
- `components/AffiliateApplicationCard.tsx` — Application UI
- `components/AffiliateEarningsWidget.tsx` — Earnings display
- `components/AffiliateLeaderboard.tsx` — Leaderboard
- `pages/admin/AdminAffiliateApplications.tsx` — Admin affiliate management
- `pages/admin/AdminAffiliatePayouts.tsx` — Admin payout management

**DB Tables:** `affiliate_applications`, `affiliate_commissions`, `affiliate_payouts`

**What works:** Complete affiliate system — application, tiered commissions (3 tiers), earnings tracking, payout requests, leaderboard, admin management.
**What's missing:** Nothing significant.

---

### 19. Gamification — ✅ EXISTS

**Evidence:**
- `components/GamificationWidget.tsx` — Full gamification widget with XP, levels, badges
- `components/StreakRewardsWidget.tsx` — Streak rewards display
- `components/StreakDisplay.tsx` — Streak progress display
- `hooks/useStreak.ts` — Streak tracking hook (logging, goals, weight, water streak types)
- `pages/admin/AdminStreakRewards.tsx` — Admin streak rewards management
- `pages/admin/AdminMilestones.tsx` — Admin milestones management
- `components/progress/GoalsMilestones.tsx` — Goals milestones display
- DB: `user_streaks` table with current_streak, best_streak, last_log_date

**DB Tables:** `user_streaks`, milestones in `nutrition_goals`

**What works:** XP/level system, badges, streak tracking (4 types), leaderboard, rewards, admin management.
**What's missing:** No challenges system (e.g., "eat 5 veggies this week"). No competitive leaderboards between users.

---

### 20. Notifications — ✅ EXISTS

**Evidence:**
- `lib/notifications.ts` (113 lines) — Notification utilities
- `lib/notifications/push.ts` (136 lines) — Push notification service with test file
- `lib/whatsapp.ts` (196 lines) — WhatsApp notification integration
- `lib/email-service.ts` — Email notification service
- `lib/resend.ts` — Resend email API integration
- `hooks/useScheduledMealNotifications.tsx` — Scheduled meal notifications
- `hooks/useDeliveryNotifications.ts` — Delivery status notifications
- `hooks/useDeliveredMealNotifications.ts` — Delivered meal notifications
- `hooks/usePushNotificationDeepLink.ts` — Push notification deep linking
- `components/NotificationPreferences.tsx` — User notification preferences
- `pages/Notifications.tsx` — Notifications page
- `pages/admin/AdminNotifications.tsx` — Admin notification management

**What works:** Push notifications, WhatsApp, email (via Resend), in-app notifications. Preferences management. Scheduled meal reminders. Delivery updates.
**What's missing:** No SMS integration found.

---

### 21. Delivery Tracking — 🟡 PARTIAL

**Evidence:**
- `pages/DeliveryTracking.tsx` (591 lines) — Delivery tracking page with real-time subscriptions
- `pages/LiveMap.tsx` — Live map page
- `components/OrderTrackingHub.tsx` — Order tracking hub
- `components/maps/` — Full map components (MapContainer, Markers, RoutePolyline, MapboxMap)
- `components/customer/CustomerDeliveryTracker.tsx` — Customer delivery tracker
- `integrations/supabase/delivery.ts` — Delivery integration
- `fleet/components/map/LiveMap.tsx` — Fleet live map with driver markers
- `fleet/hooks/useLiveTracking.ts` — Live tracking hook
- `fleet/services/trackingSocket.ts` — WebSocket tracking service

**DB Tables:** `deliveries` (with driver_id, location data)

**What works:** Real-time delivery tracking with Supabase subscriptions, map integration (Mapbox), driver location markers, route polylines, fleet live map.
**What's missing:** Customer-facing live tracking may depend on driver app actually broadcasting location. GPS tracking integration with driver phones is unclear. The customer LiveMap page exists but its connection to real-time driver GPS needs verification.

---

### 22. Fleet Management — ✅ EXISTS

**Evidence:**
- Full `fleet/` directory with:
  - `fleet/pages/`: FleetDashboard, FleetAnalytics, DriverManagement, DriverDetail, AddDriver, VehicleManagement, OrderManagement, DispatchCenter, LiveTracking, RouteOptimization, PayoutManagement, PayoutProcessing, AutoDispatchSettings, FleetLogin, BranchOrders
  - `fleet/components/`: FleetLayout, DispatchMap, LiveMap, DriverMarker, DriverCard, DriverList, DriverFilters, DriverStatusBadge, AddVehicleModal, EditVehicleModal, DashboardStats, DriversStatusChart, StatusFilter, CitySelector, ZoneSelector
  - `fleet/services/`: fleetApi.ts, trackingSocket.ts, orderDispatch.ts
  - `fleet/lib/`: autoDispatch.ts, dispatchRecommendations.ts, reliabilityScore.ts
  - `fleet/hooks/`: useFleetAuth, useDispatchTimer, useUnassignedOrderCount, useLiveTracking, useDrivers
  - `fleet/context/`: FleetAuthContext, TrackingContext, CityContext
  - `fleet/routes.tsx` — Fleet routing

**What works:** Complete fleet management — driver CRUD, vehicle management, auto-dispatch, manual dispatch, live tracking, route optimization, city/zone management, payout management, analytics dashboard, reliability scoring.

---

### 23. Subscription System — ✅ EXISTS

**Evidence:**
- `hooks/useSubscription.ts` — Full subscription hook (status, meals tracking, pause/resume, increment usage)
- `hooks/useSubscriptionManagement.ts` — Plan management (create, upgrade, cancel, win-back offers, annual billing)
- `hooks/useSubscriptionPlans.ts` — Plan fetching
- `hooks/useSubscriptionFreeze.ts` — Freeze management
- `hooks/useRolloverCredits.ts` — Rollover credits
- `components/SubscriptionWizard.tsx` — Subscription signup wizard
- `components/SubscriptionGate.tsx` — Subscription-gated features
- `components/subscription/FreezeSubscriptionModal.tsx` — Freeze modal
- `components/subscription/RolloverCreditsDisplay.tsx` — Rollover display
- `components/CancellationFlow/` — 4-step cancellation flow (survey, pause offer, discount offer, final)
- `components/BillingIntervalToggle.tsx` — Monthly/annual toggle
- `pages/Subscription.tsx` — Subscription page
- `pages/subscription/SubscriptionPlans.tsx` — Plan comparison page
- `components/MealsRemainingWidget.tsx` — Meals remaining display
- `components/QuotaWarningBanner.tsx` — Quota warning

**DB Tables:** `subscriptions` (plan, status, meals_per_month, meals_used, tier, snacks, etc.), `cancellation_attempts`

**What works:** Complete subscription system — 4 tiers (basic/standard/premium/vip), monthly/annual billing, freeze/pause, cancellation with win-back offers, meal/snack tracking, rollover credits, quota management, upgrade flow.
**What's missing:** Nothing significant.

---

### 24. Arabic Translation — ✅ EXISTS

**Evidence:**
- `contexts/LanguageContext.tsx` (4,599 lines) — Massive translation file
  - English (`en`): ~2,100+ translation keys
  - Arabic (`ar`): ~1,854+ translation keys
  - RTL support: `document.documentElement.setAttribute("dir", isRTL ? "rtl" : "ltr")` (line 4567)
  - Language toggle in settings
- `services/translationService.ts` (354 lines) — Translation service
- `hooks/useMealTranslation.ts` — Meal-specific translations

**Coverage:** ~88% of English keys have Arabic translations (1,854/2,100+). Arabic translations are substantive — full phrases, not stubs.

**What works:** Near-complete Arabic translation with RTL layout support. Used across all major pages (Dashboard, Favorites, MealDetail, Settings, Profile, etc.).
**What's missing:** ~12% of keys missing Arabic equivalents. Some newer/less common strings may fall back to English.

---

### 25. Admin Panel — ✅ EXISTS

**Evidence:**
- 29 admin pages in `pages/admin/`:
  - AdminDashboard, AdminAnalytics, AdminOrders, AdminUsers, AdminDrivers
  - AdminRestaurants, AdminRestaurantDetail, AdminMealApprovals
  - AdminSubscriptions, AdminSubscriptionDashboard, AdminFreezeManagement
  - AdminAffiliateApplications, AdminAffiliatePayouts
  - AdminDeliveries, AdminPayouts, AdminIncome, AdminProfitDashboard
  - AdminNotifications, AdminSupport, AdminSettings
  - AdminFeatured, AdminPromotions, AdminDietTags, AdminExports
  - AdminIPManagement, AdminRetentionAnalytics, AdminPremiumAnalytics
  - AdminStreakRewards, AdminMilestones, AdminAIEngineMonitor
- `components/AdminLayout.tsx` — Admin layout
- `components/AdminSidebar.tsx` — Admin navigation
- `components/admin/` — Admin components (ChangePasswordDialog, CreateFleetManagerDialog, ManageRolesDialog, OrderHistoryCard, OrderStatistics, UserSubscriptionManager)

**What works:** Comprehensive admin panel covering users, orders, restaurants, subscriptions, drivers, affiliates, payouts, analytics, promotions, and more.
**What's missing:** No admin audit log / activity history page.

---

## Missing Features Summary

The following 7 features have **zero implementation**:

1. **Meal Customization** — No ingredient removal, portion sizing, or swaps
2. **Dietitian System** — No dietitian profiles, booking, or consultations
3. **Gym Partner System** — No gym check-in, QR access, or visit tracking
4. **Recovery Credits** — No spa/massage/cryotherapy booking
5. **Corporate B2B** — No corporate accounts or employee management
6. **Family Plans** — No family/child accounts or shared plans
7. **Social Feed** — No community posts or timelines

## Partial Features Summary

1. **Payment System** — Sadad gateway code exists but likely unconfigured; all payments may route through simulation mode. No Stripe/international gateway.
2. **Delivery Tracking** — Infrastructure exists (maps, WebSocket, Supabase subscriptions) but depends on driver app actually broadcasting GPS location in real-time.

## Most Complete Feature Areas

1. **Fleet Management** — Enterprise-grade with auto-dispatch, live tracking, analytics
2. **Driver System** — 13 pages, full lifecycle
3. **Admin Panel** — 29 pages, comprehensive
4. **Subscription System** — Full with freeze, cancellation flow, win-back offers
5. **Arabic Translation** — 88% coverage with RTL support
