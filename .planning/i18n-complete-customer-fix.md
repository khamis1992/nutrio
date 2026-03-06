# COMPLETE Customer App Translation Fix Plan

## Executive Summary

**Total Files to Fix: 93**
**Total Untranslated Strings: 1,400+**
**Already Fixed: 20 files (18%)**
**Remaining: 93 files (82%)**

---

## CRITICAL FILES - Immediate Action Required

### Phase 1: Core Customer Pages (15 files - 400+ strings)

| File | Missing Translations | Priority |
|------|---------------------|----------|
| **MealDetail.tsx** | 50+ | CRITICAL |
| **RestaurantDetail.tsx** | 40+ | CRITICAL |
| **Checkout.tsx** | 60+ | CRITICAL |
| **Wallet.tsx** | 40+ | CRITICAL |
| **Affiliate.tsx** | 35+ | HIGH |
| **Settings.tsx** | 30+ | HIGH |
| **Contact.tsx** | 25+ | MEDIUM |
| **FAQ.tsx** | 20+ | MEDIUM |
| **About.tsx** | 20+ | MEDIUM |
| **Support.tsx** | 25+ | MEDIUM |
| **NotFound.tsx** | 10+ | LOW |
| **Index.tsx** | 30+ | MEDIUM |
| **Privacy.tsx** | 20+ | LOW |
| **Terms.tsx** | 20+ | LOW |
| **ResetPassword.tsx** | 15+ | MEDIUM |

### Phase 2: Tracker & Health Pages (5 files - 200+ strings)

| File | Missing Translations | Priority |
|------|---------------------|----------|
| **WaterTracker.tsx** | 50+ | HIGH |
| **WeightTracking.tsx** | 45+ | HIGH |
| **StepCounter.tsx** | 35+ | MEDIUM |
| **DeliveryTracking.tsx** | 40+ | MEDIUM |
| **Dietary.tsx** | 30+ | MEDIUM |

### Phase 3: Address & Misc Pages (3 files - 100+ strings)

| File | Missing Translations | Priority |
|------|---------------------|----------|
| **Addresses.tsx** | 50+ | HIGH |
| **MealPlan.tsx** | 30+ | MEDIUM |
| **OrderDetail.tsx** | 20+ | MEDIUM |

---

## CRITICAL COMPONENTS - Immediate Action Required

### Phase 4: Order & Meal Components (15 files - 500+ strings)

| File | Missing Translations | Priority |
|------|---------------------|----------|
| **ActiveOrderBanner.tsx** | 60+ | CRITICAL |
| **MealReviewForm.tsx** | 45+ | CRITICAL |
| **LogActivitySheet.tsx** | 40+ | HIGH |
| **ModifyOrderModal.tsx** | 35+ | HIGH |
| **OneTapReorder.tsx** | 30+ | HIGH |
| **DeliveredMealNotifications.tsx** | 25+ | HIGH |
| **OrderTrackingHub.tsx** | 35+ | MEDIUM |
| **customer/CustomerDeliveryTracker.tsx** | 40+ | MEDIUM |
| **MealAddonsManager.tsx** | 25+ | MEDIUM |
| **MealFilters.tsx** | 20+ | MEDIUM |
| **MealImageUpload.tsx** | 15+ | LOW |
| **CuisineChips.tsx** | 10+ | LOW |
| **MealPlanGenerator.tsx** | 25+ | MEDIUM |
| **RestaurantCard.tsx** | 20+ | MEDIUM |
| **RestaurantSearch.tsx** | 15+ | LOW |

### Phase 5: Wallet & Payment Components (15 files - 350+ strings)

| File | Missing Translations | Priority |
|------|---------------------|----------|
| **WalletBalance.tsx** | 25+ | CRITICAL |
| **TransactionHistory.tsx** | 30+ | HIGH |
| **TopUpPackages.tsx** | 35+ | HIGH |
| **payment/*.tsx** (10 files) | 200+ | CRITICAL |
| **RolloverCreditsWidget.tsx** | 15+ | MEDIUM |

### Phase 6: Subscription Components (10 files - 400+ strings)

| File | Missing Translations | Priority |
|------|---------------------|----------|
| **subscription/SubscriptionPlans.tsx** | 60+ | CRITICAL |
| **CancellationFlow/index.tsx** | 40+ | HIGH |
| **FreezeSubscriptionModal.tsx** | 35+ | HIGH |
| **MealsRemainingWidget.tsx** | 45+ | CRITICAL |
| **MealLimitUpsellBanner.tsx** | 30+ | HIGH |
| **QuotaWarningBanner.tsx** | 25+ | HIGH |
| **BillingIntervalToggle.tsx** | 20+ | MEDIUM |
| **PromoVideo.tsx** | 15+ | LOW |
| **SkipReasonModal.tsx** | 20+ | MEDIUM |
| **AdaptiveGoalsSettings.tsx** | 30+ | MEDIUM |

### Phase 7: User Profile Components (10 files - 250+ strings)

| File | Missing Translations | Priority |
|------|---------------------|----------|
| **GoalsManagement.tsx** | 50+ | CRITICAL |
| **GamificationWidget.tsx** | 40+ | HIGH |
| **AdaptiveGoalCard.tsx** | 30+ | HIGH |
| **BehaviorPredictionWidget.tsx** | 35+ | MEDIUM |
| **AvatarUpload.tsx** | 20+ | MEDIUM |
| **NotificationPreferences.tsx** | 25+ | HIGH |
| **NavLink.tsx** | 10+ | LOW |
| **SideDrawer.tsx** | 15+ | LOW |
| **RoleIndicator.tsx** | 12+ | MEDIUM |
| **ForgotPasswordDialog.tsx** | 25+ | MEDIUM |

### Phase 8: Affiliate Components (4 files - 100+ strings)

| File | Missing Translations | Priority |
|------|---------------------|----------|
| **AffiliateApplicationCard.tsx** | 30+ | HIGH |
| **AffiliateEarningsWidget.tsx** | 25+ | MEDIUM |
| **AffiliateLeaderboard.tsx** | 20+ | LOW |
| **ReferralMilestones.tsx** | 25+ | MEDIUM |

### Phase 9: Nutrition & Progress Components (15 files - 400+ strings)

| File | Missing Translations | Priority |
|------|---------------------|----------|
| **DailyNutritionCard.tsx** | 35+ | CRITICAL |
| **ProfessionalWeeklyReport.tsx** | 80+ | CRITICAL |
| **WeeklyReport.tsx** | 45+ | HIGH |
| **CalorieProgressRing.tsx** | 15+ | MEDIUM |
| **AIMealExplanation.tsx** | 25+ | MEDIUM |
| **HealthScoreCard.tsx** | 20+ | MEDIUM |
| **progress/*.tsx** (11 files) | 150+ | MEDIUM |

### Phase 10: Dashboard & Misc Components (12 files - 200+ strings)

| File | Missing Translations | Priority |
|------|---------------------|----------|
| **AnnouncementsBanner.tsx** | 20+ | MEDIUM |
| **BarcodeScanner.tsx** | 15+ | LOW |
| **PremiumAnalyticsDashboard.tsx** | 35+ | LOW |
| **PremiumAnalyticsPaywall.tsx** | 30+ | LOW |
| **recommendations/*.tsx** | 50+ | MEDIUM |
| **SortDropdown.tsx** | 15+ | LOW |
| **MainMenu.tsx** | Already translated | DONE |
| **CustomerNavigation.tsx** | Already translated | DONE |

---

## HOOKS - Toast Messages (20 files - 143 strings)

All hooks need translation updates:
1. useReorder.ts - 9 strings
2. useSubscriptionFreeze.ts - 6 strings
3. useSubscriptionManagement.ts - 22 strings
4. useMealCompletion.ts - 10 strings
5. useAdaptiveGoals.ts - 8 strings
6. useBodyMetrics.ts - 6 strings
7. useFavoriteRestaurants.ts - 8 strings
8. useHealthScore.ts - 3 strings
9. useHealthIntegration.ts - 5 strings
10. useDeliveryNotifications.ts - 17 strings
11. useDeliveredMealNotifications.ts - 4 strings
12. usePushNotificationDeepLink.ts - 12 strings
13. useAffiliateProgram.ts - 2 strings
14. useMealReviews.ts - 6 strings
15. useWallet.ts - 1 string
16. useSmartRecommendations.ts - 32 strings

---

## MISSING TRANSLATION KEYS TO ADD

### New Keys Required (~600 new keys):

#### Navigation & Layout
- nav_dashboard, nav_progress, nav_favorites, nav_wallet
- nav_orders, nav_affiliate, nav_settings

#### Common Actions
- action_edit, action_delete, action_save, action_cancel
- action_confirm, action_apply, action_close, action_back
- action_continue, action_next, action_previous
- action_filter, action_sort, action_search
- action_view, action_hide, action_show, action_expand
- action_collapse, action_refresh, action_reload

#### Status & Feedback
- status_loading, status_saving, status_processing
- status_updating, status_creating, status_deleting
- status_success, status_error, status_warning
- status_info, status_pending, status_completed
- status_active, status_inactive, status_cancelled

#### Meal & Food
- meal_breakfast, meal_lunch, meal_dinner, meal_snack
- meal_calories, meal_protein, meal_carbs, meal_fat
- meal_grams, meal_milliliters, meal_cups
- meal_servings, meal_ingredients, meal_nutrition
- meal_description, meal_price, meal_rating
- meal_available, meal_unavailable, meal_sold_out

#### Order & Delivery
- order_placed, order_confirmed, order_preparing
- order_ready, order_out_for_delivery, order_delivered
- order_completed, order_cancelled, order_pending
- order_status, order_number, order_date
- order_total, order_subtotal, order_discount
- order_delivery_fee, order_tip
- delivery_address, delivery_time, delivery_status
- driver_name, driver_phone, driver_rating

#### Subscription & Plans
- plan_free, plan_basic, plan_standard, plan_premium
- plan_vip, plan_annual, plan_monthly
- plan_price, plan_features, plan_popular
- plan_current, plan_upgrade, plan_downgrade
- subscription_active, subscription_cancelled
- subscription_paused, subscription_expired
- subscription_renew, subscription_auto_renew
- subscription_freeze, subscription_reactivate

#### Wallet & Payment
- wallet_balance, wallet_credits, wallet_bonus
- wallet_top_up, wallet_transaction_history
- payment_method, payment_card, payment_cash
- payment_wallet, payment_pending, payment_success
- payment_failed, payment_processing

#### User Profile
- profile_info, profile_preferences, profile_goals
- profile_metrics, profile_streak, profile_badges
- profile_achievements, profile_activity
- goal_weight_loss, goal_muscle_gain, goal_maintenance
- goal_general_health, goal_target_weight
- metric_weight, metric_height, metric_age
- metric_gender, metric_activity_level

#### Notifications
- notif_order_updates, notif_delivery_updates
- notif_promotions, notif_meal_reminders
- notif_push, notif_email, notif_whatsapp

#### Errors & Validation
- error_required, error_invalid, error_min_length
- error_max_length, error_email, error_password
- error_match, error_network, error_server
- error_unauthorized, error_forbidden
- error_not_found, error_unknown

#### Time & Date
- time_today, time_yesterday, time_tomorrow
- time_days_ago, time_hours_ago, time_minutes_ago
- time_just_now, time_days, time_hours
- time_minutes, time_seconds

#### Empty States
- empty_no_data, empty_no_results, empty_no_meals
- empty_no_orders, empty_no_favorites, empty_no_notifications
- empty_no_transactions, empty_no_reviews
- empty_start_exploring, empty_try_again

---

## IMPLEMENTATION APPROACH

### For Each File:

1. **Add import:**
```typescript
import { useLanguage } from "@/contexts/LanguageContext";
```

2. **Add hook:**
```typescript
const { t } = useLanguage();
```

3. **Replace strings:**
```typescript
// From:
<Button>Submit</Button>
// To:
<Button>{t("submit")}</Button>
```

4. **Add missing keys to LanguageContext.tsx**

---

## VERIFICATION CHECKLIST

After fixing each file, verify:
- [ ] File imports useLanguage
- [ ] File uses const { t } = useLanguage()
- [ ] All JSX text uses t()
- [ ] All button labels use t()
- [ ] All placeholders use t()
- [ ] All toast messages use t()
- [ ] All dialog titles use t()
- [ ] All empty states use t()
- [ ] Build passes without errors
- [ ] No TypeScript errors

---

## PRIORITY ORDER

### Week 1 - Critical (Fix these first)
1. MealDetail.tsx
2. RestaurantDetail.tsx
3. Checkout.tsx
4. ActiveOrderBanner.tsx
5. MealReviewForm.tsx
6. Wallet.tsx
7. WalletBalance.tsx
8. MealsRemainingWidget.tsx
9. MealLimitUpsellBanner.tsx
10. subscription/SubscriptionPlans.tsx

### Week 2 - High Priority
1. RestaurantDetail.tsx
2. Affiliate.tsx
3. Settings.tsx
4. GoalsManagement.tsx
5. GamificationWidget.tsx
6. WaterTracker.tsx
7. WeightTracking.tsx
8. DailyNutritionCard.tsx
9. ProfessionalWeeklyReport.tsx
10. All payment components

### Week 3 - Medium Priority
1. All remaining pages
2. All remaining components
3. All hooks

### Week 4 - Polish
1. Testing in Arabic mode
2. RTL layout verification
3. Final QA

---

## ESTIMATED EFFORT

- **Pages**: 23 files × 2 hours = 46 hours
- **Components**: 61 files × 1.5 hours = 91.5 hours
- **Hooks**: 20 files × 1 hour = 20 hours
- **LanguageContext updates**: 10 hours
- **Testing & QA**: 20 hours

**TOTAL: ~187.5 hours (4-5 weeks full-time)**

Or with a team of 4 developers: **1-1.5 weeks**

---

## NEXT STEPS

Choose your approach:

### Option A: Critical Path Only (1 week)
Fix only the 20 most critical files affecting the main user journey:
- MealDetail, RestaurantDetail, Checkout, Wallet
- ActiveOrderBanner, MealReviewForm, MealsRemainingWidget
- SubscriptionPlans, MealLimitUpsellBanner
- DailyNutritionCard, GoalsManagement

### Option B: High Impact (2-3 weeks)
Fix all 50 high-priority files (phases 1-6)

### Option C: Complete Fix (4-5 weeks)
Fix all 93 files comprehensively

---

## CURRENT STATUS

✅ **Already Fixed (20 files):**
- Dashboard.tsx, Meals.tsx, Schedule.tsx, Profile.tsx
- Auth.tsx, Tracker.tsx, Favorites.tsx, Onboarding.tsx
- Subscription.tsx, OrderHistory.tsx, Notifications.tsx
- ProgressRedesigned.tsx, PersonalInfo.tsx, WalkthroughScreen.tsx
- TrackerInsights.tsx, MealWizard.tsx, MainMenu.tsx
- LogMealDialog.tsx, CustomerNavigation.tsx, GuestLoginPrompt.tsx

❌ **Still Need Fix (93 files):**
- See complete list above

---

This is a massive undertaking. Would you like me to:
1. Focus on the most critical 20 files first (Option A)?
2. Create a script to auto-generate the translation keys?
3. Start fixing files one by one systematically?
4. Create a shared translation sheet for your team?
