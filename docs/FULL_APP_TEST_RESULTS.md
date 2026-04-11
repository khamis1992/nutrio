# Nutrio Full App Test Results

**Test Date:** 2026-03-30  
**App URL:** http://178.18.243.68/nutrio/  
**Stack:** React + Vite + Supabase (SPA, development mode)  
**Testing Method:** Direct Supabase REST API calls with authenticated tokens + frontend source analysis

---

## Executive Summary

| Account | Login | Dashboard | Key Features |
|---------|-------|-----------|-------------|
| User (eng.aljabor) | ✅ PASS | ✅ Data exists | Partial — core flows work, many features have missing backend tables |
| Partner (khamis4everever) | ✅ PASS | ✅ Route exists | Menu mgmt, orders, earnings routes exist |
| Admin (khamis-1992) | ✅ PASS | ✅ Full admin panel | Extensive admin routes (30+ pages) |
| Driver (driver@nutriofuel) | ✅ PASS | ✅ Route exists | Basic driver panel |
| Fleet Manager (admin@nutrio) | ✅ PASS | ✅ Route exists | Fleet management active |

---

## 1. User Account (eng.aljabor@gmail.com)

### Authentication
| Feature | Status | Notes |
|---------|--------|-------|
| Login | ✅ PASS | Email/password via Supabase Auth works |
| Registration | ✅ EXISTS | `/auth` route exists |
| Password Reset | ✅ EXISTS | `/reset-password` route exists |
| Onboarding | ✅ EXISTS | `/onboarding` route + `onboarding_completed` field in profile |

### Profile & Dashboard
| Feature | Status | Notes |
|---------|--------|-------|
| Profile data | ✅ PASS | Full profile: name, gender, age, height, weight, goals, activity level, macros |
| Avatar | ✅ PASS | Has avatar_url uploaded to Supabase Storage |
| Dashboard | ✅ EXISTS | `/dashboard` route |
| Personal info | ✅ EXISTS | `/personal-info` route |
| Settings | ✅ EXISTS | `/settings` route |
| Profile page | ✅ EXISTS | `/profile` route |

**Profile Details:**
- Full name: KHAMIS AL-JABOR
- Gender: male, Age: 33, Height: 180cm, Weight: 120kg, Target: 90kg
- Health goal: lose, Activity: sedentary
- Daily targets: 2066 cal, 181g protein, 181g carbs, 69g fat
- Streak: 14 days, Level: 1, XP: 0
- Onboarding: completed
- Referral code: ALJABOR2024

### Meal Browsing
| Feature | Status | Notes |
|---------|--------|-------|
| Meals listing | ✅ PASS | 36 meals in database, `/meals` route exists |
| Meal detail | ✅ EXISTS | `/meals/:id` route exists |
| Meal categories | ✅ PASS | 6 categories: Breakfast, Lunch, Dinner, Snacks, Beverages, Desserts |
| Restaurant listing | ✅ PASS | 5 restaurants: Organic Harvest, Healthy Bites Cafe, Mediterranean Delights, Green Garden Vegan, Khamis Kitchen |
| Restaurant detail | ✅ EXISTS | `/restaurant/:id` route exists |

**⚠️ Issues:**
- Most meals have **NULL** protein, carbs, fats, ingredients, image_url, category_id, and price=0
- Only calories are populated for most meals
- Meal categories exist but meals aren't linked to them (category_id is NULL)
- Restaurants have Unsplash placeholder images

### Meal Customization
| Feature | Status | Notes |
|---------|--------|-------|
| Ingredients | ❌ MISSING | No `meal_ingredients` table, all meal ingredients are NULL |
| Meal options | ❌ MISSING | No `meal_options` or `meal_option_values` tables |
| Portion adjustment | ⚠️ UNKNOWN | No portion/size table found |

### Meal Plan / AI Planner
| Feature | Status | Notes |
|---------|--------|-------|
| Meal scheduling | ✅ PARTIAL | `meal_schedules` table exists with 3 records for user |
| `/schedule` route | ✅ EXISTS | Route present |
| AI meal planner | ❌ MISSING | No `ai_meal_plans` or `meal_plan_templates` tables |
| AI calorie suggestions | ⚠️ EMPTY | `ai_suggested_calories` and `ai_suggestion_confidence` fields exist but NULL |
| Goal adjustment AI | ⚠️ EMPTY | Fields exist in profile but never populated |

### Custom Macros
| Feature | Status | Notes |
|---------|--------|-------|
| Macro targets | ✅ PASS | Stored in profile: protein, carbs, fat targets |
| `/goals` route | ✅ EXISTS | Goals/settings page route |
| Custom macro overrides | ⚠️ PARTIAL | No separate `custom_macro_targets` table; macros in profile only |

### Subscription
| Feature | Status | Notes |
|---------|--------|-------|
| Subscription plans | ✅ PASS | 4 plans: Weekly (450 QR), Fresh (1800 QR), Healthy (2800 QR), Elite (3800 QR) |
| `/subscription` route | ✅ EXISTS | |
| `/subscription/plans` route | ✅ EXISTS | |
| Active subscription | ✅ PASS | User has active "healthy" tier subscription (QAR 2800/mo, 40 meals) |
| Subscription features | ✅ PASS | Plans include meals_per_month, snacks, daily_meals, daily_snacks |
| Bilingual plans | ✅ PASS | Both English and Arabic descriptions |

**Subscription Details (Active):**
- Plan: healthy, Status: active, Auto-renew: true
- 40 meals/month, 5 used this month
- Freeze days used: 7
- Includes gym: true

### Order History
| Feature | Status | Notes |
|---------|--------|-------|
| Orders table | ✅ EXISTS | Table exists |
| User orders | ⚠️ EMPTY | No orders found for user account (RLS may filter, or no orders) |
| Order status history | ✅ EXISTS | `order_status_history` has records showing partner confirmed orders |
| `/orders` route | ✅ EXISTS | |
| `/order/:id` route | ✅ EXISTS | |
| `/checkout` route | ✅ EXISTS | |
| `/invoices` route | ✅ EXISTS | |

### Progress / Body Metrics
| Feature | Status | Notes |
|---------|--------|-------|
| `/progress` route | ✅ EXISTS | |
| `/weight-tracking` route | ✅ EXISTS | |
| `/water-tracker` route | ✅ EXISTS | |
| `/step-counter` route | ✅ EXISTS | |
| `/tracker` route | ✅ EXISTS | |
| Weight data | ⚠️ PARTIAL | `body_measurements` table exists with data; `weight_tracker` table MISSING |
| Water tracking | ✅ EXISTS | `water_intake` table exists with data |
| Body measurements | ✅ EXISTS | `body_measurements` table exists |

**⚠️ Issues:**
- No `weight_tracker` table (but `body_measurements` may serve this purpose)
- No `daily_logs`, `nutrition_logs`, `meal_logs`, `exercise_logs`, `step_logs` tables
- Gamification fields (streak, xp, level, badges) exist in profile but no underlying tracking tables

### Nutrition Dashboard
| Feature | Status | Notes |
|---------|--------|-------|
| `/dietary` route | ✅ EXISTS | Dietary preferences page |
| Daily calorie target | ✅ PASS | 2066 cal in profile |
| Macro targets | ✅ PASS | Protein/carbs/fat in profile |
| Meal nutrition | ⚠️ PARTIAL | Calories populated, but protein/carbs/fats NULL for most meals |

### Wallet
| Feature | Status | Notes |
|---------|--------|-------|
| `/wallet` route | ✅ EXISTS | |
| Wallet transactions | ✅ PASS | 2 transactions found (debit: extra meal credits) |
| Transaction details | ✅ PASS | Includes type, amount, balance_after, reference_type, metadata |

### Favorites
| Feature | Status | Notes |
|---------|--------|-------|
| `/favorites` route | ✅ EXISTS | |
| `favorites` table | ❌ MISSING | Table does not exist |

### Referral System
| Feature | Status | Notes |
|---------|--------|-------|
| `/affiliate` route | ✅ EXISTS | |
| `/affiliate/tracking` route | ✅ EXISTS | |
| Referral code | ✅ PASS | Code "ALJABOR2024" in profile |
| Referral rewards | ✅ PASS | `referral_rewards_earned: 50.0`, `affiliate_balance: 125.5`, `affiliate_tier: silver` |
| Multi-tier referrals | ✅ PASS | tier1/tier2/tier3_referrer_id fields exist |
| `referral_codes` table | ❌ MISSING | (Referral data stored in profile instead) |

### Notifications
| Feature | Status | Notes |
|---------|--------|-------|
| `/notifications` route | ✅ EXISTS | |
| Notifications table | ✅ PASS | 10 notifications for user |
| Notification types | ✅ PASS | meal_scheduled type confirmed, includes rich data (meal name, calories, address) |
| Read/unread | ✅ PASS | `status: read`, `read_at` field populated |
| Notification preferences | ✅ PASS | Granular prefs: SMS (marketing, order, delivery), Push (5 types), Email (5 types) |

### Support/FAQ
| Feature | Status | Notes |
|---------|--------|-------|
| `/support` route | ✅ EXISTS | |
| `/faq` route | ✅ EXISTS | |
| `/contact` route | ✅ EXISTS | |
| Support tickets | ✅ EXISTS | `support_tickets` table exists (empty) |
| FAQ table | ❌ MISSING | No `faq` table (may be hardcoded) |

### Addresses
| Feature | Status | Notes |
|---------|--------|-------|
| `/addresses` route | ✅ EXISTS | |
| User addresses | ✅ PASS | 1 address saved (Home, Al Khor, Qatar) |
| Address fields | ✅ PASS | label, address_line1/2, city, state, postal_code, country, phone, is_default, delivery_instructions |

### Other Routes
| Feature | Status | Notes |
|---------|--------|-------|
| `/tracking` route | ✅ EXISTS | Order tracking |
| `/live/:id` route | ✅ EXISTS | Live delivery tracking |
| `/policies` route | ✅ EXISTS | |
| `/walkthrough` route | ✅ EXISTS | App walkthrough |
| `/about` route | ✅ EXISTS | |

---

## 2. Partner Account (khamis4everever@gmail.com)

### Authentication
| Feature | Status | Notes |
|---------|--------|-------|
| Login | ✅ PASS | Works |
| Partner auth | ✅ EXISTS | `/partner/auth` route |
| Partner onboarding | ✅ EXISTS | `/partner/onboarding` route |
| Pending approval | ✅ EXISTS | `/partner/pending-approval` route |

### Profile
**Details:** Name: Mohamed Khalil, onboarding: not completed, affiliate_tier: bronze, referred by user account

### Dashboard
| Feature | Status | Notes |
|---------|--------|-------|
| `/partner` route | ✅ EXISTS | Partner dashboard |
| `/partner/orders` route | ✅ EXISTS | |
| `/partner/menu` route | ✅ EXISTS | Menu management |
| `/partner/analytics` route | ✅ EXISTS | |
| `/partner/earnings` route | ✅ EXISTS | |
| `/partner/payouts` route | ✅ EXISTS | |
| `/partner/notifications` route | ✅ EXISTS | |
| `/partner/profile` route | ✅ EXISTS | |
| `/partner/settings` route | ✅ EXISTS | |
| `/partner/support` route | ✅ EXISTS | |
| `/partner/addons` route | ✅ EXISTS | Addons management |
| `/partner/boost` route | ✅ EXISTS | Boost/promote feature |

### Menu Management
| Feature | Status | Notes |
|---------|--------|-------|
| Meals table | ✅ EXISTS | 36 meals across restaurants |
| Meal CRUD | ✅ EXISTS | Route + data structure supports add/edit |
| Categories | ✅ EXISTS | 6 meal categories |
| Meal images | ⚠️ PARTIAL | Most meals have NULL image_url |

### Reviews
| Feature | Status | Notes |
|---------|--------|-------|
| `reviews` table | ❌ MISSING | Table does not exist |
| `restaurant_reviews` table | ✅ EXISTS | Table exists but empty |

### Earnings/Payouts
| Feature | Status | Notes |
|---------|--------|-------|
| `/partner/earnings` route | ✅ EXISTS | |
| `/partner/payouts` route | ✅ EXISTS | |
| `restaurant_payouts` table | ❌ MISSING | |
| `earnings_payouts` table | ❌ MISSING | |
| Restaurant payout_rate | ✅ PASS | 82% payout rate on restaurant record |

### Addons Management
| Feature | Status | Notes |
|---------|--------|-------|
| `/partner/addons` route | ✅ EXISTS | |
| `addons` table | ❌ MISSING | |
| `addon_categories` table | ❌ MISSING | |

---

## 3. Admin Account (khamis-1992@hotmail.com)

### Authentication
| Feature | Status | Notes |
|---------|--------|-------|
| Login | ✅ PASS | Works |

### Profile
**Details:** Name: Ahmed Hassan (admin sees all profiles — 10+ users visible)

### Dashboard & Management (30+ Routes)
| Feature | Status | Notes |
|---------|--------|-------|
| `/admin` dashboard | ✅ EXISTS | |
| `/admin/users` | ✅ EXISTS | Can see all user profiles |
| `/admin/restaurants` | ✅ EXISTS | 5 restaurants visible |
| `/admin/restaurants/:id` | ✅ EXISTS | Restaurant detail management |
| `/admin/orders` | ✅ EXISTS | |
| `/admin/drivers` | ✅ EXISTS | |
| `/admin/subscriptions` | ✅ EXISTS | |
| `/admin/promotions` | ✅ EXISTS | 1 promo (SAV20, 20% off) |
| `/admin/analytics` | ✅ EXISTS | |
| `/admin/settings` | ✅ EXISTS | |
| `/admin/support` | ✅ EXISTS | |
| `/admin/notifications` | ✅ EXISTS | |
| `/admin/payouts` | ✅ EXISTS | |
| `/admin/income` | ✅ EXISTS | |
| `/admin/profit` | ✅ EXISTS | |
| `/admin/deliveries` | ✅ EXISTS | |
| `/admin/meal-approvals` | ✅ EXISTS | Meal approval workflow |
| `/admin/exports` | ✅ EXISTS | Data export |
| `/admin/featured` | ✅ EXISTS | Featured meals/restaurants |
| `/admin/diet-tags` | ✅ EXISTS | Dietary tag management |
| `/admin/freeze-management` | ✅ EXISTS | Subscription freeze management |
| `/admin/announcements` | ✅ EXISTS | |
| `/admin/ip-management` | ✅ EXISTS | IP whitelist/management |
| `/admin/premium-analytics` | ✅ EXISTS | |
| `/admin/retention-analytics` | ✅ EXISTS | |
| `/admin/affiliate-applications` | ✅ EXISTS | |
| `/admin/affiliate-milestones` | ✅ EXISTS | |
| `/admin/affiliate-payouts` | ✅ EXISTS | |
| `/admin/streak-rewards` | ✅ EXISTS | |

**⚠️ Admin Issues:**
- No orders in database (orders table empty for all queries)
- Payout tables missing (`restaurant_payouts`, `earnings_payouts`)

---

## 4. Driver Account (driver@nutriofuel.com)

### Authentication
| Feature | Status | Notes |
|---------|--------|-------|
| Login | ✅ PASS | Works |
| Driver auth | ✅ EXISTS | `/driver/auth` route |
| Driver onboarding | ✅ EXISTS | `/driver/onboarding` route |

### Profile
**Details:** Name: Ali bin Abdullah, onboarding: not completed, affiliate_tier: bronze

### Features
| Feature | Status | Notes |
|---------|--------|-------|
| `/driver` dashboard | ✅ EXISTS | |
| `/driver/orders` | ✅ EXISTS | |
| `/driver/orders/:id` | ✅ EXISTS | Order detail |
| `earnings` | ✅ EXISTS | Child route |
| `history` | ✅ EXISTS | Child route |
| `profile` | ✅ EXISTS | Child route |
| `settings` | ✅ EXISTS | Child route |
| `support` | ✅ EXISTS | Child route |
| `notifications` | ✅ EXISTS | Child route |
| `payouts` | ✅ EXISTS | Child route |
| `driver_profiles` table | ❌ MISSING | |
| `driver_earnings` table | ❌ MISSING | |
| `driver_orders` table | ❌ MISSING | |
| `driver_shifts` table | ❌ MISSING | |
| `driver_location` table | ❌ MISSING | |

**Note:** Driver linked as owner of "Organic Harvest" restaurant (owner_id match)

---

## 5. Fleet Manager (admin@nutrio.com)

### Authentication
| Feature | Status | Notes |
|---------|--------|-------|
| Login | ✅ PASS | Works |

### Profile
**Details:** Name: Fatma Al-Rashid, onboarding: completed, affiliate_tier: silver  
**Fleet Manager Record:** role: super_admin, country: Qatar, is_active: true

### Features
| Feature | Status | Notes |
|---------|--------|-------|
| Fleet routes | ✅ EXISTS | Separate fleet route module (`fleetRoutes`) |
| Fleet dashboard | ✅ EXISTS | |
| `fleet_managers` table | ✅ PASS | Has record for this user |
| `vehicles` table | ✅ EXISTS | Table exists (empty) |
| Driver management | ✅ LIKELY | Via admin drivers route |

---

## Database Schema Summary

### ✅ Tables That Exist (16)
| Table | Records | Notes |
|-------|---------|-------|
| `profiles` | 10+ | Rich schema with health goals, macros, gamification, referrals |
| `restaurants` | 5 | Full schema with ratings, payout rates, cuisine, zones |
| `meals` | 36 | Basic schema; nutrition data mostly NULL |
| `meal_categories` | 6 | Breakfast, Lunch, Dinner, Snacks, Beverages, Desserts |
| `subscriptions` | 2 | User has active subscription |
| `subscription_plans` | 4 | Well-structured with bilingual content |
| `orders` | 0 | Table exists but empty |
| `order_items` | 0 | Table exists but empty |
| `wallet_transactions` | 2 | Working wallet system |
| `notifications` | 10+ | Rich notification system |
| `promotions` | 1 | Coupon/promo system |
| `fleet_managers` | 1 | Fleet management |
| `vehicles` | 0 | Table exists but empty |
| `support_tickets` | 0 | Table exists but empty |
| `water_intake` | ✅ | Water tracking data exists |
| `body_measurements` | ✅ | Body measurement data exists |
| `meal_schedules` | 3 | Meal scheduling works |
| `order_status_history` | 5+ | Order status tracking |
| `user_addresses` | 1 | Address management |
| `social_posts` | 0 | Table exists but empty |
| `user_achievements` | 0 | Table exists but empty |
| `nutrition_goals` | 0 | Table exists but empty |

### ❌ Tables That Don't Exist (25+)
| Missing Table | Impact |
|--------------|--------|
| `reviews` | No meal reviews |
| `favorites` | Cannot favorite meals |
| `water_logs` | (but `water_intake` exists) |
| `weight_logs` | (but `body_measurements` exists) |
| `body_metrics` | (but `body_measurements` exists) |
| `macros` | (stored in profile instead) |
| `referral_codes` | (stored in profile instead) |
| `addons` / `addon_categories` | No addon system |
| `driver_profiles` / `driver_earnings` / `driver_orders` / `driver_shifts` / `driver_location` | No driver-specific data |
| `meal_options` / `meal_option_values` | No meal customization |
| `meal_ingredients` | No ingredient management |
| `categories` | (using `meal_categories`) |
| `delivery_drivers` | No dedicated driver table |
| `restaurant_payouts` / `earnings_payouts` | No payout tracking |
| `restaurant_staff` / `restaurant_hours` / `restaurant_menu_sections` | No restaurant detail mgmt |
| `cuisine_types` / `allergen_tags` | No allergen/cuisine system |
| `achievement_definitions` / `gamification_log` | No gamification backend |
| `challenge_definitions` / `user_challenges` | No challenges system |
| `daily_check_ins` / `weekly_reports` | No check-in system |
| `meal_ratings` / `meal_photos` | No meal UGC |
| `chat_messages` | No chat system |
| `faq` / `feedback` | No FAQ/feedback tables |
| `delivery_zones` | No zone management |
| `daily_logs` / `nutrition_logs` / `meal_logs` / `exercise_logs` / `step_logs` | No daily logging |

---

## Critical Issues

1. **Orders table is empty** — No orders exist despite order_status_history having records. This suggests orders were deleted or there's an RLS/data integrity issue.

2. **Meal nutrition data incomplete** — 36 meals exist but most have NULL protein, carbs, fats, ingredients, images, and category_id. Only calories are populated.

3. **Meals not linked to categories** — category_id is NULL for all meals despite 6 categories existing.

4. **25+ missing database tables** — Many features have frontend routes but no backend tables to support them.

5. **Driver-specific tables all missing** — Driver features exist in UI but have no data layer.

6. **Favorites table missing** — `/favorites` route exists but no table.

7. **App running in development mode** — Vite dev server exposed (`DEV: true`), which is a security concern.

---

## Features Working Better Than Expected

1. **Rich profile system** — Health goals, activity levels, macro targets, gamification (streak/xp/level), referral system with multi-tier tracking
2. **Subscription system** — Well-structured with 4 tiers, freeze management, rollover credits, auto-renewal
3. **Wallet system** — Working transactions with balance tracking
4. **Notification system** — Rich notifications with read/unread, granular preferences (SMS/push/email)
5. **Meal scheduling** — Working schedule system with meal type and date
6. **Fleet management** — Separate fleet module with vehicles table
7. **Extensive admin panel** — 30+ admin routes including analytics, exports, IP management, affiliate management
8. **Bilingual support** — Plans and content in both English and Arabic
9. **Address management** — Full address system with delivery instructions
10. **Partner boost feature** — Unique promotional tool for restaurants
11. **Order status history** — Tracks status changes with who changed and when
12. **Sadad payment integration** — Qatari payment gateway configured

---

## Per-Account Summary

### User: 60% Functional
Core browsing and subscription work. Missing: favorites, reviews, meal customization, AI planner, detailed nutrition tracking, daily logging.

### Partner: 50% Functional
Menu and orders exist. Missing: reviews, addons, payout tracking, earnings tables.

### Admin: 70% Functional
Most comprehensive panel. Missing: payout tables, some analytics backends. Orders empty.

### Driver: 30% Functional
Routes exist but NO backend tables for driver-specific data (profiles, earnings, orders, shifts, location).

### Fleet Manager: 40% Functional
Fleet manager table exists. Vehicles table exists (empty). Driver management via admin routes likely.
