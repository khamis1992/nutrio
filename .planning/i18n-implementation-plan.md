# i18n Implementation Plan

## Goal
Complete internationalization of all 27 customer-facing pages by replacing hardcoded English strings with `t()` translation calls.

## Current Status
- ✅ LanguageContext exists with 800+ translation keys
- ✅ English and Arabic translations defined
- ✅ `useLanguage()` hook available
- ✅ Auth.tsx, Dashboard.tsx already using translations
- ❌ Many pages still have hardcoded strings

## Strategy
1. Add missing translation keys to LanguageContext (English + Arabic)
2. Update pages systematically, starting with most user-facing
3. Group related updates to minimize context switching

## Files to Update (Priority Order)

### High Priority (Most User-Facing)
1. **Onboarding.tsx** - 234 strings - Critical first impression
2. **MealDetail.tsx** - 156 strings - Core meal scheduling flow  
3. **Subscription.tsx** - 156 strings - Payment/subscription flow
4. **RestaurantDetail.tsx** - 198 strings - Restaurant browsing
5. **Affiliate.tsx** - 156 strings - Partner dashboard

### Medium Priority
6. **OrderHistory.tsx** - 127 strings
7. **ProgressRedesigned.tsx** - 134 strings
8. **Settings.tsx** - 78 strings
9. **Addresses.tsx** - 67 strings
10. **Wallet.tsx** - 28 strings
11. **Checkout.tsx** - 43 strings
12. **Notifications.tsx** - 42 strings
13. **Meals.tsx** - 45 strings
14. **Favorites.tsx** - 34 strings
15. **Schedule.tsx** - 38 strings
16. **Contact.tsx** - 38 strings
17. **Tracker.tsx** - 42 strings
18. **WaterTracker.tsx** - 89 strings
19. **WeightTracking.tsx** - 56 strings
20. **StepCounter.tsx** - 94 strings
21. **Progress.tsx** - 89 strings

### Lower Priority (Already Partially Done)
22. **Profile.tsx** - 82 strings
23. **ResetPassword.tsx** - 47 strings
24. **NotFound.tsx** - 4 strings

### Already Done ✅
25. **Auth.tsx** - Already uses t()
26. **Dashboard.tsx** - Already uses t()
27. **FAQ.tsx** - Data-driven, not UI strings

## Translation Key Categories to Add

### Meal Detail Page
- `schedule_your_meal`: "Schedule Your Meal"
- `choose_when_enjoy`: "Choose when you'd like to enjoy {mealName}"
- `select_date`: "Select Date"
- `swipe_to_see`: "Swipe →"
- `meal_type`: "Meal Type"
- `breakfast_time`: "7-10 AM"
- `lunch_time`: "12-2 PM"
- `dinner_time`: "6-9 PM"
- `anytime`: "Anytime"
- `tomorrow`: "Tomorrow"
- `default_label`: "Default"
- `add_new_address`: "Add new address"
- `meals_remaining`: "Meals Remaining"
- `enjoy_unlimited`: "Enjoy unlimited meals"
- `use_wisely`: "Use them wisely!"
- `unlimited`: "Unlimited"
- `left_count`: "left"
- `adding_to_schedule`: "Adding to Schedule..."
- `select_date_first`: "Select a Date First"
- `add_to_schedule`: "Add to Schedule"
- `meal_will_deliver`: "Your meal will be delivered on"
- `meal_detail_selected`: "Selected"
- `meals_left`: "Meals Left"
- `tap_to_add_schedule`: "Tap + to add to your schedule"
- `failed_load_meal`: "Failed to load meal details"
- `sign_in_to_schedule_meal`: "Please sign in to schedule meals"
- `subscribe_to_schedule`: "Please subscribe to schedule meals"
- `weekly_meal_limit`: "You've reached your weekly meal limit"
- `allergen_alert`: "Allergen alert"
- `proceed_anyway`: "Proceed anyway"
- `meal_scheduled_toast`: "Meal Scheduled! 🎉"
- `meal_added_schedule`: "{mealName} has been added to your schedule for {date}"
- `meal_not_found`: "Meal not found"
- `meal_not_exist`: "The meal you're looking for doesn't exist or has been removed."
- `browse_meals`: "Browse Meals"
- `vip_exclusive`: "VIP Exclusive"
- `prep_time`: "Prep Time"
- `minutes`: "m"
- `fiber`: "Fiber"
- `nutrition_facts`: "Nutrition Facts"
- `per_serving`: "Per serving"
- `ingredients`: "Ingredients"
- `added_to_schedule`: "Added to Schedule!"
- `redirecting_to_schedule`: "Redirecting to your schedule..."

## Progress Tracker

- [ ] Phase 1: Add all missing translation keys to LanguageContext
- [ ] Phase 2: Update MealDetail.tsx
- [ ] Phase 3: Update Onboarding.tsx
- [ ] Phase 4: Update Subscription.tsx
- [ ] Phase 5: Update RestaurantDetail.tsx
- [ ] Phase 6: Update Affiliate.tsx
- [ ] Phase 7: Update remaining pages
- [ ] Phase 8: Run typecheck and lint
- [ ] Phase 9: Test both languages

## Current Phase: Phase 2 - Update MealDetail.tsx

Started adding useLanguage hook and replacing strings.
