# NutriFuel - System Architecture & Business Model Diagrams

Generated: 2026-02-14
Platform: Healthy Meal Delivery Marketplace
Tech Stack: React + TypeScript + Supabase + Capacitor

---

## 1. SYSTEM ARCHITECTURE DIAGRAM

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         NUTRIOFUEL SYSTEM ARCHITECTURE                          │
└─────────────────────────────────────────────────────────────────────────────────┘

┌───────────────────────┐
│   CLIENT DEVICES      │
│                       │
│  ┌─────────────────┐  │     ┌─────────────────┐
│  │   Web Browser   │  │     │  Mobile Device  │
│  │   (React SPA)   │  │     │  (iOS/Android)  │
│  └────────┬────────┘  │     │  (Capacitor)    │
│           │           │     └────────┬────────┘
│           │ HTTPS     │              │
│           │           │              │
└───────────┼───────────┘              │
            │                          │
            │                          │
┌───────────┼──────────────────────────┼───────────────────────────────────────┐
│           │     FRONTEND LAYER       │                                       │
│           │                          │                                       │
│  ┌────────▼──────────────────────────▼──────────────┐                        │
│  │         REACT APPLICATION (vite + React 18)       │                        │
│  │                                                     │                      │
│  │  ┌──────────────────────────────────────────────┐ │                      │
│  │  │  Routing: React Router v6                    │ │                      │
│  │  │  State: React Context + TanStack Query       │ │                      │
│  │  │  UI: Radix UI + shadcn/ui + TailwindCSS      │ │                      │
│  │  │  Forms: React Hook Form + Zod               │ │                      │
│  │  │  Charts: Recharts                            │ │                      │
│  │  └──────────────────────────────────────────────┘ │                      │
│  │                                                     │                      │
│  │  ┌─────────────────┐  ┌─────────────────────┐     │                      │
│  │  │ Customer Portal │  │  Partner Portal     │     │                      │
│  │  │ - Dashboard     │  │  - Dashboard        │     │                      │
│  │  │ - Meal Browsing │  │  - Menu Management  │     │                      │
│  │  │ - Ordering      │  │  - Order Fulfillment│     │                      │
│  │  │ - Tracking      │  │  - Analytics        │     │                      │
│  │  │ - Progress      │  │  - Payouts          │     │                      │
│  │  └─────────────────┘  └─────────────────────┘     │                      │
│  │                                                     │                      │
│  │  ┌─────────────────┐                               │                      │
│  │  │ Admin Portal    │                               │                      │
│  │  │ - Platform Mgmt │                               │                      │
│  │  │ - User Mgmt     │                               │                      │
│  │  │ - Analytics     │                               │                      │
│  │  │ - Payouts       │                               │                      │
│  │  └─────────────────┘                               │                      │
│  └─────────────────────┬───────────────────────────────┘                      │
│                        │                                                       │
└────────────────────────┼───────────────────────────────────────────────────────┘
                         │
                         │ REST API / Realtime
                         │
┌────────────────────────┼───────────────────────────────────────────────────────┐
│                         │         BACKEND LAYER                                 │
│                         │                                                       │
│  ┌──────────────────────▼───────────────────────────────────────────────────┐ │
│  │                       SUPABASE BACKEND                                    │ │
│  │                                                                          │ │
│  │  ┌────────────────────────────────────────────────────────────────────┐  │ │
│  │  │  SUPABASE AUTH (Authentication & Authorization)                   │  │ │
│  │  │  - Email/Password Authentication                                   │  │ │
│  │  │  - JWT Token Management                                            │  │ │
│  │  │  - Row Level Security (RLS) Policies                               │  │ │
│  │  │  - Role-Based Access Control (user/partner/admin)                  │  │ │
│  │  └────────────────────────────────────────────────────────────────────┘  │ │
│  │                                                                          │ │
│  │  ┌────────────────────────────────────────────────────────────────────┐  │ │
│  │  │  SUPABASE DATABASE (PostgreSQL)                                    │  │ │
│  │  │  - 40+ Tables with Relations                                       │  │ │
│  │  │  - Views, Functions, Triggers                                      │  │ │
│  │  │  - Data Validation & Constraints                                   │  │ │
│  │  └────────────────────────────────────────────────────────────────────┘  │ │
│  │                                                                          │ │
│  │  ┌────────────────────────────────────────────────────────────────────┐  │ │
│  │  │  SUPABASE STORAGE (File Management)                                │  │ │
│  │  │  - Meal Images                                                     │  │ │
│  │  │  - Restaurant Logos                                                │  │ │
│  │  │  - User Avatar Images                                              │  │ │
│  │  │  - Support Ticket Attachments                                      │  │ │
│  │  └────────────────────────────────────────────────────────────────────┘  │ │
│  │                                                                          │ │
│  │  ┌────────────────────────────────────────────────────────────────────┐  │ │
│  │  │  SUPABASE REALTIME (Live Updates)                                  │  │ │
│  │  │  - Order Status Updates                                            │  │ │
│  │  │  - Live Notifications                                               │  │ │
│  │  │  - Tracking Updates                                                 │  │ │
│  │  └────────────────────────────────────────────────────────────────────┘  │ │
│  │                                                                          │ │
│  │  ┌────────────────────────────────────────────────────────────────────┐  │ │
│  │  │  SUPABASE EDGE FUNCTIONS (Serverless)                              │  │ │
│  │  │  - Affiliate Notifications                                         │  │ │
│  │  │  - Commission Calculations                                         │  │ │
│  │  │  - Meal Reminders                                                  │  │ │
│  │  │  - Payout Processing                                               │  │ │
│  │  │  - Milestone Notifications                                         │  │ │
│  │  │  - Monthly Reports                                                 │  │ │
│  │  │  - Meal Image Analysis (AI)                                        │  │ │
│  │  └────────────────────────────────────────────────────────────────────┘  │ │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  CAPACITOR (Mobile Bridge)                                           │  │
│  │  - Native Device Features Access                                      │  │
│  │  - Push Notifications                                                 │  │
│  │  - Local Notifications                                                │  │
│  │  - Biometric Auth                                                     │  │
│  │  - Device Info                                                        │  │
│  │  - Haptics & Vibration                                                │  │
│  │  - Keyboard Management                                                │  │
│  │  - Splash Screen                                                      │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         EXTERNAL INTEGRATIONS                                │
│                                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ Stripe       │  │ OpenAI/AI    │  │ Email Service │  │ Third-party  │    │
│  │ (Payments)   │  │ (Meal Image  │  │ (Transactional│  │ Analytics    │    │
│  │              │  │  Analysis)   │  │  Emails)      │  │              │    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. AUTHENTICATION & AUTHORIZATION FLOW

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                     AUTHENTICATION & AUTHORIZATION                           │
└──────────────────────────────────────────────────────────────────────────────┘

USER REGISTRATION FLOW:
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   User      │────▶│   Sign Up   │────▶│  Supabase   │────▶│ Create User │
│  Browser    │     │   Form      │     │    Auth     │     │   Record    │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                           │                                        │
                           │                                        │
                           ▼                                        ▼
                    ┌─────────────┐                       ┌─────────────┐
                    │  Redirect   │                       │ Assign Role │
                    │ to Dashboard│                       │ (Default:   │
                    │             │                       │   user)     │
                    └─────────────┘                       └─────────────┘

LOGIN FLOW:
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   User      │────▶│   Sign In   │────▶│  Supabase   │────▶│ JWT Token   │
│  Browser    │     │   Form      │     │    Auth     │     │  Generated  │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                                                                  │
                                                                  │
                                                                  ▼
                                                        ┌─────────────────┐
                                                        │ Token Stored in │
                                                        │    Browser      │
                                                        │   localStorage  │
                                                        └─────────────────┘

ROLE-BASED ACCESS CONTROL (RBAC):
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                         USER ROLES                                │  │
│  │                                                                   │  │
│  │  ┌────────────────┐    ┌────────────────┐    ┌────────────────┐ │  │
│  │  │     USER       │    │    PARTNER     │    │     ADMIN      │ │  │
│  │  │                │    │                │    │                │ │  │
│  │  │ - Browse meals │    │ - Manage menu  │    │ - Full platform│ │  │
│  │  │ - Place orders │    │ - View orders  │    │   management   │ │  │
│  │  │ - Track orders │    │ - Analytics    │    │ - User mgmt    │ │  │
│  │  │ - Progress     │    │ - Payouts      │    │ - Restaurant   │ │  │
│  │  │ - Referrals    │    │ - Reviews      │    │   approvals    │ │  │
│  │  │ - Affiliate    │    │ - Settings     │    │ - Payouts      │ │  │
│  │  └────────────────┘    └────────────────┘    └────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘

ROW LEVEL SECURITY (RLS):
┌─────────────────────────────────────────────────────────────────────────┐
│  • Users can only see their own data (orders, profile, progress)         │
│  • Partners can only see their restaurant data (orders, menu, reviews)   │
│  • Admins have full access to all data                                   │
│  • Authenticated users can view public data (meals, restaurants)         │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 3. USER FLOW DIAGRAMS

### 3.1 CUSTOMER USER FLOW

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         CUSTOMER USER FLOW                                   │
└──────────────────────────────────────────────────────────────────────────────┘

REGISTRATION & ONBOARDING:
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│ Landing │───▶│  Sign   │───▶│  Email  │───▶│Onboard │───▶│Set Goals│
│  Page   │    │   Up    │    │Confirm  │    │ Form    │    │(Health  │
│         │    │         │    │         │    │         │    │ Targets)│
└─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘
                                                   │
                                                   ▼
                                            ┌─────────┐
                                            │Profile  │
                                            │Created  │
                                            └─────────┘

MEAL DISCOVERY & ORDERING:
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│Browse   │───▶│Filter   │───▶│View Meal│───▶│Add to   │───▶│Checkout │
│Meals    │    │by Diet/ │    │Details  │    │Schedule │    │         │
│         │    │Rest.    │    │         │    │         │    │         │
└─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘
                                                           │
                                                           ▼
                                                    ┌─────────────┐
                                                    │Select       │
                                                    │Delivery     │
                                                    │Address &    │
                                                    │Time         │
                                                    └─────────────┘
                                                           │
                                                           ▼
                                                    ┌─────────────┐
                                                    │Apply        │
                                                    │Promo Code   │
                                                    │(Optional)   │
                                                    └─────────────┘
                                                           │
                                                           ▼
                                                    ┌─────────────┐
                                                    │Confirm      │
                                                    │Payment      │
                                                    │(Stripe)     │
                                                    └─────────────┘

ORDER TRACKING:
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│Order    │───▶│Pending  │───▶│Confirm  │───▶│Preparin │───▶│Out for  │
│Confirmed│    │         │    │         │    │g        │    │Delivery │
└─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘
                                                  │              │
                                                  │              ▼
                                                  │         ┌─────────┐
                                                  │         │Delivered│
                                                  │         │         │
                                                  │         └─────────┘
                                                  │              │
                                                  ▼              ▼
                                            ┌────────────────────┐
                                            │    Rate Meal       │
                                            │    (Optional)      │
                                            └────────────────────┘

PROGRESS TRACKING:
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│Log Meal │───▶│Track    │───▶│View     │───▶│Update  │───▶│Generate │
│Consumed │    │Calories │    │Progress │    │Weight  │    │Reports  │
│         │    │         │    │Charts   │    │         │    │         │
└─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘

REFERRAL & AFFILIATE PROGRAM:
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│Get      │───▶│Share    │───▶│Friend   │───▶│Earn     │───▶│Request  │
│Referral │    │Referral │    │Signs Up │    │Rewards  │    │Payout   │
│Code     │    │Link     │    │          │    │         │    │         │
└─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘
                                    │
                                    ▼
                             ┌─────────────┐
                             │Milestone    │
                             │Bonuses      │
                             └─────────────┘
```

### 3.2 PARTNER USER FLOW

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         PARTNER USER FLOW                                    │
└──────────────────────────────────────────────────────────────────────────────┘

PARTNER APPLICATION:
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│Partner  │───▶│Fill     │───▶│Upload   │───▶│Submit   │───▶│Admin    │
│Sign Up  │    │App Form │    │Documents│    │for Review│    │Review   │
└─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘
                                                   │
                                                   ▼
                                            ┌─────────────┐
                                            │Wait for     │
                                            │Approval     │
                                            └─────────────┘
                                                   │
                              ┌─────────────────────┼─────────────────────┐
                              │                     │                     │
                              ▼                     ▼                     ▼
                       ┌─────────────┐      ┌─────────────┐      ┌─────────────┐
                       │   Approved  │      │   Rejected  │      │   Pending   │
                       └─────────────┘      └─────────────┘      └─────────────┘
                              │
                              ▼
                       ┌─────────────┐
                       │Onboarding   │
                       │Complete    │
                       └─────────────┘

MENU MANAGEMENT:
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│Create   │───▶│Upload   │───▶│Set      │───▶│Configure│───▶│Publish  │
│Meal Item│    │Images   │    │Price    │    │Add-ons  │    │Menu     │
└─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘
                                                   │
                                                   ▼
                                            ┌─────────────┐
                                            │Add Diet     │
                                            │Tags         │
                                            └─────────────┘

ORDER FULFILLMENT:
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│Receive  │───▶│Accept   │───▶│Prepare  │───▶│Mark as  │───▶│Handover │
│New Order│    │Order    │    │Meal     │    │Ready    │    │to Driver│
└─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘

ANALYTICS & PAYOUTS:
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│View     │───▶│Track    │───▶│Monitor  │───▶│Request  │───▶│Receive  │
│Dashboard│    │Sales    │    │Reviews  │    │Payout   │    │Payment  │
└─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘
                              │
                              ▼
                       ┌─────────────┐
                       │Upgrade to   │
                       │Premium      │
                       │Analytics    │
                       └─────────────┘
```

### 3.3 ADMIN OPERATIONS FLOW

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         ADMIN OPERATIONS FLOW                                │
└──────────────────────────────────────────────────────────────────────────────┘

RESTAURANT MANAGEMENT:
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│View     │───▶│Review   │───▶│Verify   │───▶│Approve/ │───▶│Activate │
│Pending  │    │Details  │    │Documents│    │Reject   │    │Account  │
│Requests │    │         │    │         │    │         │    │         │
└─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘

USER MANAGEMENT:
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│View All │───▶│Search   │───▶│View     │───▶│Update   │───▶│Manage   │
│Users    │    │Filter   │    │Profile  │    │Role     │    │Status   │
└─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘

ORDER MANAGEMENT:
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│Monitor  │───▶│Resolve  │───▶│Process  │───▶│Handle   │───▶│Generate │
│All Orders│    │Issues   │    │Refunds  │    │Disputes │    │Reports  │
└─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘

PAYOUT PROCESSING:
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│View     │───▶│Calculate│───▶│Deduct   │───▶│Approve  │───▶│Process  │
│Pending  │    │Earnings │    │Commission│    │Payout   │    │Payment  │
│Payouts  │    │         │    │          │    │         │    │         │
└─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘

AFFILIATE MANAGEMENT:
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│Review   │───▶│Verify   │───▶│Approve/ │───▶│Monitor  │───▶│Process  │
│Affiliate│    │Referrals│    │Reject   │    │Earnings │    │Payouts  │
│Applications│  │         │    │         │    │         │    │         │
└─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘

PLATFORM CONFIGURATION:
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│Manage   │───▶│Configure│───▶│Create   │───▶│Schedule │───▶│Send     │
│Settings │    │Features │    │Promotions│    │Announcements│Messages│
└─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘
```

---

## 4. DATA MODEL / ENTITY RELATIONSHIP DIAGRAM

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    NUTRIOFUEL DATABASE SCHEMA                                 │
│                    (40+ Tables with Relationships)                            │
└──────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           USER & AUTHENTICATION                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐         ┌──────────────────┐         ┌──────────────────┐
│   auth.users     │         │    profiles      │         │   user_roles     │
│ (Supabase Auth)  │         │                  │         │                  │
├──────────────────┤         ├──────────────────┤         ├──────────────────┤
│ PK id            │◄────────│ PK id            │◄────────│ PK id            │
│    email         │         │    user_id       │         │    user_id       │
│    password      │         │    full_name     │         │    role          │
│    created_at    │         │    avatar_url    │         │    created_at    │
│    updated_at    │         │    health_goal   │         │                 │
└──────────────────┘         │    activity_level│         └──────────────────┘
                             │    daily_calorie_│
                             │    target        │
                             │    current_weight│
                             │    target_weight │
                             │    referral_code │
                             │    affiliate_bal │
                             │    onboarding_co│
                             └──────────────────┘
                                      │
                                      │ 1:N
                                      ▼
                             ┌──────────────────┐
                             │ notification_pref│
                             │                  │
                             ├──────────────────┤
                             │ PK id            │
                             │    user_id       │
                             │    push_notif    │
                             │    email_notif   │
                             │    meal_reminder │
                             └──────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           RESTAURANTS & PARTNERS                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐         ┌──────────────────┐         ┌──────────────────┐
│   restaurants    │         │     meals        │         │   meal_addons    │
│                  │         │                  │         │                  │
├──────────────────┤         ├──────────────────┤         ├──────────────────┤
│ PK id            │◄────────│ PK id            │◄────────│ PK id            │
│    name          │  1:N    │    restaurant_id │  1:N    │    meal_id       │
│    description   │         │    name          │         │    name          │
│    logo_url      │         │    description   │         │    price         │
│    address       │         │    price         │         │    category      │
│    phone         │         │    calories      │         │    is_available  │
│    email         │         │    protein_g     │         └──────────────────┘
│    owner_id      │         │    carbs_g       │
│    rating        │         │    fat_g         │         ┌──────────────────┐
│    total_orders  │         │    image_url     │         │  meal_diet_tags  │
│    approval_stat │         │    is_available  │         │                  │
│    premium_ana   │         │    is_vip_excl   │         ├──────────────────┤
└──────────────────┘         │    order_count   │         │ PK meal_id       │
                             │    prep_time     │         │ PK diet_tag_id   │
                             └──────────────────┘         └──────────────────┘
                                      │                              │
                                      │                              │
                                      │ N:M                          │
                                      ▼                              ▼
                             ┌──────────────────┐         ┌──────────────────┐
                             │   diet_tags      │         │   reviews        │
                             │                  │         │                  │
                             ├──────────────────┤         ├──────────────────┤
                             │ PK id            │         │ PK id            │
                             │    name          │         │    user_id       │
                             │    description   │         │    restaurant_id │
                             └──────────────────┘         │    meal_id       │
                                                          │    rating        │
                                                          │    comment       │
                                                          │    partner_resp  │
                                                          └──────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           ORDERS & SCHEDULING                                │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐         ┌──────────────────┐         ┌──────────────────┐
│     orders       │         │   order_items    │         │ meal_schedules   │
│                  │         │                  │         │                  │
├──────────────────┤         ├──────────────────┤         ├──────────────────┤
│ PK id            │◄────────│ PK id            │         │ PK id            │
│    user_id       │  1:N    │    order_id      │         │    user_id       │
│    restaurant_id │         │    meal_id       │         │    meal_id       │
│    status        │         │    quantity      │         │    scheduled_date│
│    total_price   │         │    unit_price    │         │    meal_type     │
│    delivery_date │         └──────────────────┘         │    order_status  │
│    meal_type     │                                      │    is_completed  │
│    commission    │         ┌──────────────────┐         │    delivery_fee  │
│    partner_earn  │         │ schedule_addons   │         └──────────────────┘
└──────────────────┘         │                  │
                             ├──────────────────┤
                             │ PK id            │
                             │    schedule_id   │
                             │    addon_id      │
                             │    quantity      │
                             │    unit_price    │
                             └──────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           SUBSCRIPTIONS & PAYMENTS                           │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐         ┌──────────────────┐         ┌──────────────────┐
│  subscriptions   │         │     payouts      │         │ affiliate_commis │
│                  │         │                  │         │                  │
├──────────────────┤         ├──────────────────┤         ├──────────────────┤
│ PK id            │         │ PK id            │         │ PK id            │
│    user_id       │         │    restaurant_id │         │    user_id       │
│    plan          │         │    partner_id    │         │    source_user_i │
│    status        │         │    amount        │         │    order_id      │
│    price         │         │    period_start  │         │    amount        │
│    meals_per_wk  │         │    period_end    │         │    commission_rt │
│    auto_renew    │         │    status        │         │    tier          │
│    stripe_sub_id │         │    commission    │         │    status        │
└──────────────────┘         │    processed_at  │         └──────────────────┘
                             └──────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           REFERRALS & AFFILIATES                            │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐         ┌──────────────────┐         ┌──────────────────┐
│    referrals     │         │  affiliate_apps  │         │ affiliate_payouts│
│                  │         │                  │         │                  │
├──────────────────┤         ├──────────────────┤         ├──────────────────┤
│ PK id            │         │ PK id            │         │ PK id            │
│    referrer_id   │         │    user_id       │         │    user_id       │
│    referred_id   │         │    status        │         │    amount        │
│    referral_code │         │    applied_at    │         │    status        │
│    status        │         │    reviewed_at   │         │    requested_at  │
│    reward_earned │         │    reviewed_by   │         │    processed_at  │
└──────────────────┘         └──────────────────┘         └──────────────────┘
                                      │
                                      │
                                      ▼
                             ┌──────────────────┐
                             │ user_milestone_  │
                             │   achievements   │
                             │                  │
                             ├──────────────────┤
                             │ PK id            │
                             │    user_id       │
                             │    milestone_id  │
                             │    achieved_at   │
                             │    bonus_credited│
                             └──────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           SUPPORT & NOTIFICATIONS                            │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐         ┌──────────────────┐         ┌──────────────────┐
│ support_tickets  │         │ ticket_messages  │         │ ticket_attachments│
│                  │         │                  │         │                  │
├──────────────────┤         ├──────────────────┤         ├──────────────────┤
│ PK id            │◄────────│ PK id            │◄────────│ PK id            │
│    user_id       │  1:N    │    ticket_id     │  1:N    │    ticket_id     │
│    category      │         │    sender_id     │         │    message_id    │
│    priority      │         │    message       │         │    file_url      │
│    status        │         │    is_admin_reply│         │    file_name     │
│    subject       │         └──────────────────┘         │    file_type     │
│    description   │                                      └──────────────────┘
│    assigned_to   │
│    resolved_at   │         ┌──────────────────┐
└──────────────────┘         │   notifications  │
                             │                  │
                             ├──────────────────┤
                             │ PK id            │
                             │    user_id       │
                             │    type          │
                             │    title         │
                             │    message       │
                             │    is_read       │
                             │    metadata      │
                             └──────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           PROMOTIONS & FEATURES                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐         ┌──────────────────┐         ┌──────────────────┐
│   promotions     │         │ promotion_usage  │         │ featured_listing│
│                  │         │                  │         │                  │
├──────────────────┤         ├──────────────────┤         ├──────────────────┤
│ PK id            │◄────────│ PK id            │         │ PK id            │
│    code          │  1:N    │    promotion_id  │         │    restaurant_id │
│    name          │         │    user_id       │         │    package_type  │
│    description   │         │    order_id      │         │    starts_at     │
│    discount_type │         │    discount_appl │         │    ends_at       │
│    discount_val  │         │    used_at       │         │    status        │
│    valid_from    │         └──────────────────┘         │    price_paid    │
│    valid_until   │                                      └──────────────────┘
│    max_uses      │
│    is_active     │
└──────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           USER PREFERENCES                                   │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐         ┌──────────────────┐         ┌──────────────────┐
│ user_addresses   │         │ user_favorite_res│         │user_dietary_pref│
│                  │         │                  │         │                  │
├──────────────────┤         ├──────────────────┤         ├──────────────────┤
│ PK id            │         │ PK id            │         │ PK user_id      │
│    user_id       │         │    user_id       │         │ PK diet_tag_id  │
│    label         │         │    restaurant_id │         └──────────────────┘
│    address_line1 │         └──────────────────┘
│    city          │
│    postal_code   │         ┌──────────────────┐
│    is_default    │         │   meal_history   │
└──────────────────┘         │                  │
                             ├──────────────────┤
                             │ PK id            │
                             │    user_id       │
                             │    logged_at     │
                             │    name          │
                             │    calories      │
                             │    protein_g     │
                             │    carbs_g       │
                             │    fat_g         │
                             └──────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           PROGRESS TRACKING                                 │
└─────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│                progress_logs                            │
│                                                         │
├────────────────────────────────────────────────────────┤
│ PK id                                                   │
│    user_id                                              │
│    log_date                                             │
│    weight_kg                                            │
│    calories_consumed                                    │
│    protein_consumed_g                                   │
│    carbs_consumed_g                                     │
│    fat_consumed_g                                       │
│    notes                                                │
└────────────────────────────────────────────────────────┘

LEGEND:
  PK  - Primary Key
  FK  - Foreign Key
  1:N - One to Many relationship
  N:M - Many to Many relationship
  ◄─── Points to parent table
```

---

## 5. BUSINESS MODEL CANVAS

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                      NUTRIOFUEL BUSINESS MODEL CANVAS                         │
└──────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────┬────────────────────────────┬───────────────────┐
│     KEY PARTNERS           │      KEY ACTIVITIES        │   VALUE PROPOSITION│
├────────────────────────────┼────────────────────────────┼───────────────────┤
│ • Restaurant Partners      │ • Platform Development     │ FOR CUSTOMERS:    │
│ • Delivery Service         │ • Partner Acquisition      │ • Convenient meal │
│   Providers                │ • Quality Assurance        │   planning        │
│ • Payment Gateway          │ • Order Matching           │ • Healthy,        │
│   (Stripe)                 │ • Customer Support         │   tailored meals  │
│ • Nutrition Experts        │ • Commission Processing    │ • Time savings    │
│ • Marketing Affiliates     │ • Marketing & Growth       │ • Progress        │
│                            │ • Analytics & Reporting     │   tracking       │
├────────────────────────────┼────────────────────────────┤                   │
│     KEY RESOURCES          │      KEY RESOURCES         │ FOR PARTNERS:     │
├────────────────────────────┼────────────────────────────┤ • Additional      │
│ • Technology Platform      │      CUSTOMER              │   revenue stream  │
│ • Restaurant Network       │      SEGMENTS              │ • Customer        │
│ • Delivery Infrastructure  │                            │   insights        │
│ • Brand & Reputation       │ • Health Enthusiasts       │ • Marketing       │
│ • User Base                │ • Fitness Conscious        │   exposure        │
│ • Data & Analytics         │ • Busy Professionals       │ • Easy menu       │
│                            │ • People with Dietary       │   management      │
├────────────────────────────┤   Restrictions             │                   │
│     COST STRUCTURE         │ • Weight Management        │                   │
├────────────────────────────┤ • Meal Planning Subscribers│                   │
│ • Platform Development     │ • Corporate Clients        │                   │
│ • Marketing & Acquisition  │ • Families                 │                   │
│ • Operational Costs        │                            │                   │
│ • Payment Processing       │                            │                   │
│ • Customer Support         │                            │                   │
│ • Technology Maintenance   │                            │                   │
└────────────────────────────┴────────────────────────────┴───────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│                          REVENUE STREAMS                                     │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  COMMISSION REVENUE:                                                         │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ • Order Commission: 15-20% per order                                    │ │
│  │ • Subscription Commission: 10-15% on meal plans                         │ │
│  │ • Featured Listing Fees: $50-200/month                                 │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  SUBSCRIPTION REVENUE (from customers):                                      │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ • Weekly Plans: $29.99 - $49.99/week                                    │ │
│  │ • Monthly Plans: $99.99 - $199.99/month                                 │ │
│  │ • Premium Features: $9.99/month                                         │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  PARTNER REVENUE:                                                            │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ • Premium Analytics: $49.99/month                                       │ │
│  │ • Boost/Visibility Packages: $25-100/promotion                         │ │
│  │ • Restaurant Onboarding Fee: $50 (one-time)                            │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  AFFILIATE REVENUE:                                                          │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ • Referral Bonuses: $5-10 per successful referral                      │ │
│  │ • Tiered Commission: 5-15% on referred orders                          │ │
│  │ • Milestone Bonuses: Up to $100 for 50+ referrals                      │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ADVERTISING & PROMOTIONS:                                                  │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ • Sponsored Placements: $100-500/month                                  │ │
│  │ • Featured Restaurant Slots: $200/week                                 │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│                          CHANNELS                                            │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  DIGITAL CHANNELS:                                                          │
│  • Website & Web App (Primary)                                              │
│  • Mobile Apps (iOS & Android)                                              │
│  • Social Media (Instagram, Facebook, TikTok)                               │
│  • Email Marketing                                                          │
│  • Content Marketing (Blog, Recipes)                                        │
│                                                                              │
│  PARTNERSHIP CHANNELS:                                                      │
│  • Restaurant Partners                                                      │
│  • Fitness Centers & Gyms                                                  │
│  • Nutritionists & Dietitians                                               │
│  • Corporate Wellness Programs                                             │
│                                                                              │
│  PAID CHANNELS:                                                            │
│  • Google Ads                                                               │
│  • Facebook/Instagram Ads                                                  │
│  • Influencer Partnerships                                                  │
│                                                                              │
│  CUSTOMER RELATIONSHIPS:                                                     │
│  • Self-Service Platform                                                    │
│  • Automated Meal Reminders                                                │
│  • In-App Chat Support                                                      │
│  • Email Support                                                            │
│  • Community (Forums, Social Media)                                        │
│  • Personalized Recommendations                                             │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. FEATURE MAP

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                      NUTRIOFUEL FEATURE MAP                                   │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│                          CUSTOMER FEATURES                                    │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  CORE FEATURES (Priority: HIGH)                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ ✓ User Registration & Authentication                                 │    │
│  │ ✓ Onboarding with Health Goals                                       │    │
│  │ ✓ Browse & Search Restaurants                                        │    │
│  │ ✓ Filter Meals by Diet (Keto, Vegan, etc.)                           │    │
│  │ ✓ View Detailed Nutritional Information                              │    │
│  │ ✓ Add Meals to Schedule                                              │    │
│  │ ✓ One-time Orders & Subscriptions                                    │    │
│  │ ✓ Real-time Order Tracking                                           │    │
│  │ ✓ Multiple Delivery Addresses                                        │    │
│  │ ✓ Order History & Reordering                                         │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  NUTRITION & PROGRESS (Priority: HIGH)                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ ✓ Calorie & Macro Tracking                                           │    │
│  │ ✓ Weight Logging & Progress Charts                                   │    │
│  │ ✓ Meal History Logging                                               │    │
│  │ ✓ Personalized Nutrition Targets                                     │    │
│  │ ✓ Visual Progress Reports (Charts & Graphs)                          │    │
│  │ ✓ Weekly Summary Reports                                             │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  SOCIAL & ENGAGEMENT (Priority: MEDIUM)                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ ✓ Restaurant Reviews & Ratings                                       │    │
│  │ ✓ Favorite Restaurants                                               │    │
│  │ ✓ Referral Program with Unique Codes                                 │    │
│  │ ✓ Affiliate Program with Tiered Commissions                          │    │
│  │ ✓ Milestone Rewards & Bonuses                                        │    │
│  │ ✓ Leaderboards (Earnings & Referrals)                                │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  PERSONALIZATION (Priority: MEDIUM)                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ ✓ Dietary Preferences (Keto, Vegan, etc.)                            │    │
│  │ ✓ Meal Type Preferences (Breakfast, Lunch, Dinner)                   │    │
│  │ ✓ Notification Preferences                                          │    │
│  │ ✓ Profile Management                                                 │    │
│  │ ✓ Avatar Upload                                                       │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  SUPPORT (Priority: LOW)                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ ✓ In-App Support Tickets                                            │    │
│  │ ✓ FAQ Section                                                        │    │
│  │ ✓ Contact Form                                                       │    │
│  │ ✓ Email Notifications                                                │    │
│  │ ✓ Push Notifications (Mobile)                                       │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│                          PARTNER FEATURES                                     │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ONBOARDING (Priority: HIGH)                                                │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ ✓ Partner Registration                                               │    │
│  │ ✓ Restaurant Profile Creation                                       │    │
│  │ ✓ Logo & Image Upload                                               │    │
│  │ ✓ Document Verification                                             │    │
│  │ ✓ Approval Workflow                                                 │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  MENU MANAGEMENT (Priority: HIGH)                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ ✓ Create & Edit Meals                                               │    │
│  │ ✓ Upload Meal Images                                                │    │
│  │ ✓ Set Nutritional Information                                       │    │
│  │ ✓ Configure Add-ons                                                 │    │
│  │ ✓ Diet Tag Management                                               │    │
│  │ ✓ Bulk Import/Export                                                │    │
│  │ ✓ Availability Toggle                                               │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ORDER MANAGEMENT (Priority: HIGH)                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ ✓ View Incoming Orders                                              │    │
│  │ ✓ Accept/Reject Orders                                              │    │
│  │ ✓ Order Status Updates                                              │    │
│  │ ✓ Preparation Time Management                                       │    │
│  │ ✓ Delivery Coordination                                             │    │
│  │ ✓ Order History                                                     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ANALYTICS (Priority: MEDIUM)                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ ✓ Sales Dashboard                                                    │    │
│  │ ✓ Revenue Tracking                                                  │    │
│  │ ✓ Popular Items Report                                              │    │
│  │ ✓ Customer Insights                                                 │    │
│  │ ✓ Rating & Review Monitoring                                        │    │
│  │ ✓ Premium Analytics (Paid Feature)                                  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ENGAGEMENT (Priority: MEDIUM)                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ ✓ Respond to Reviews                                                │    │
│  │ ✓ View Customer Feedback                                            │    │
│  │ ✓ Featured Listing (Paid)                                           │    │
│  │ ✓ Boost Visibility (Paid)                                           │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  FINANCIALS (Priority: HIGH)                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ ✓ Earnings Overview                                                 │    │
│  │ ✓ Payout History                                                    │    │
│  │ ✓ Request Payout                                                    │    │
│  │ ✓ Commission Breakdown                                              │    │
│  │ ✓ Transaction History                                               │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│                          ADMIN FEATURES                                       │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  USER MANAGEMENT (Priority: HIGH)                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ ✓ View All Users                                                    │    │
│  │ ✓ Search & Filter Users                                             │    │
│  │ ✓ View User Profiles                                                │    │
│  │ ✓ Update User Roles                                                 │    │
│  │ ✓ Manage User Status                                                │    │
│  │ ✓ Export User Data                                                  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  RESTAURANT MANAGEMENT (Priority: HIGH)                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ ✓ View All Restaurants                                              │    │
│  │ ✓ Review Applications                                               │    │
│  │ ✓ Approve/Reject Restaurants                                        │    │
│  │ ✓ Manage Restaurant Status                                          │    │
│  │ ✓ View Restaurant Details                                           │    │
│  │ ✓ Manage Featured Listings                                          │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ORDER OVERSIGHT (Priority: HIGH)                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ ✓ Monitor All Orders                                                │    │
│  │ ✓ Resolve Order Issues                                              │    │
│  │ ✓ Process Refunds                                                   │    │
│  │ ✓ Handle Disputes                                                   │    │
│  │ ✓ Order Analytics                                                   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  PAYOUT MANAGEMENT (Priority: HIGH)                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ ✓ View Pending Payouts                                              │    │
│  │ ✓ Calculate Earnings                                                │    │
│  │ ✓ Deduct Platform Commission                                        │    │
│  │ ✓ Process Partner Payouts                                           │    │
│  │ ✓ Process Affiliate Payouts                                         │    │
│  │ ✓ Payout History & Reports                                          │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  AFFILIATE MANAGEMENT (Priority: MEDIUM)                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ ✓ Review Affiliate Applications                                     │    │
│  │ ✓ Verify Referrals                                                  │    │
│  │ ✓ Approve/Reject Affiliates                                          │    │
│  │ ✓ Monitor Affiliate Earnings                                        │    │
│  │ ✓ Process Affiliate Payouts                                         │    │
│  │ ✓ Configure Milestones                                              │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  PLATFORM CONFIG (Priority: MEDIUM)                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ ✓ Manage Platform Settings                                          │    │
│  │ ✓ Configure Commission Rates                                        │    │
│  │ ✓ Create & Manage Promotions                                        │    │
│  │ ✓ Manage Diet Tags                                                  │    │
│  │ ✓ Send Announcements                                                │    │
│  │ ✓ Schedule Promotions                                               │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  SUPPORT (Priority: MEDIUM)                                                │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ ✓ View Support Tickets                                              │    │
│  │ ✓ Assign Tickets                                                    │    │
│  │ ✓ Respond to Tickets                                                │    │
│  │ ✓ Track Resolution Status                                           │    │
│  │ ✓ Support Analytics                                                 │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ANALYTICS & REPORTING (Priority: MEDIUM)                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ ✓ Platform Overview Dashboard                                       │    │
│  │ ✓ User Growth Analytics                                             │    │
│  │ ✓ Order Analytics                                                   │    │
│  │ ✓ Revenue Reports                                                   │    │
│  │ ✓ Partner Performance                                               │    │
│  │ ✓ Export Data (CSV/Excel)                                           │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│                          MOBILE-SPECIFIC FEATURES                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ ✓ Biometric Authentication (Face ID/Touch ID)                        │    │
│  │ ✓ Push Notifications                                                 │    │
│  │ ✓ Local Notifications (Meal Reminders)                              │    │
│  │ ✓ Offline Mode (Basic Viewing)                                      │    │
│  │ ✓ Camera Integration (Image Upload)                                 │    │
│  │ ✓ Native Sharing                                                    │    │
│  │ ✓ Haptic Feedback                                                   │    │
│  │ ✓ Splash Screen Experience                                          │    │
│  │ ✓ Mobile-Optimized UI                                               │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. TECHNOLOGY STACK SUMMARY

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                      TECHNOLOGY STACK & INFRASTRUCTURE                        │
└──────────────────────────────────────────────────────────────────────────────┘

FRONTEND:
  • Framework: React 18.3.1
  • Language: TypeScript 5.8.3
  • Build Tool: Vite 5.4.19
  • Routing: React Router DOM 6.30.1
  • State Management: React Context API
  • Data Fetching: TanStack React Query 5.83.0
  • UI Components: Radix UI + shadcn/ui
  • Styling: TailwindCSS 3.4.17
  • Forms: React Hook Form 7.61.1 + Zod 3.25.76
  • Charts: Recharts 2.15.4
  • Date Handling: date-fns 3.6.0
  • Icons: Lucide React 0.462.0

BACKEND:
  • Platform: Supabase (PostgreSQL + Auth + Storage + Realtime)
  • Database: PostgreSQL 14.1
  • Authentication: Supabase Auth (JWT-based)
  • Storage: Supabase Storage (S3-compatible)
  • Edge Functions: Deno-based serverless functions
  • API: RESTful + GraphQL (via PostgREST)

MOBILE:
  • Framework: Capacitor 8.0.0
  • Platforms: iOS 8.0.0, Android 8.0.0
  • Plugins:
    - @capacitor/local-notifications
    - @capacitor/push-notifications
    - @capgo/capacitor-native-biometric
    - @capacitor/splash-screen
    - @capacitor/haptics

THIRD-PARTY INTEGRATIONS:
  • Payments: Stripe (inferred from subscriptions)
  • Email: Supabase Email (Transactional)
  • AI/ML: OpenAI (for meal image analysis)
  • Analytics: Custom (built-in)

DEPLOYMENT:
  • Frontend: Vercel/Netlify/Cloudflare (inferred from Vite)
  • Backend: Supabase Cloud
  • Mobile: App Store + Google Play Store
  • CDN: Supabase Edge Network

DEVELOPMENT TOOLS:
  • Linting: ESLint 9.32.0
  • Package Manager: npm
  • Version Control: Git
  • Type Checking: TypeScript Compiler
```

---

## 8. KEY METRICS & KPIs

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                      BUSINESS METRICS & KPIs                                  │
└──────────────────────────────────────────────────────────────────────────────┘

CUSTOMER METRICS:
  • Total Registered Users
  • Active Users (DAU/MAU)
  • Customer Acquisition Cost (CAC)
  • Customer Lifetime Value (CLV)
  • Churn Rate
  • Retention Rate
  • Average Order Value (AOV)
  • Order Frequency
  • Subscription Conversion Rate

PARTNER METRICS:
  • Total Active Partners
  • Partner Applications (Pending/Approved/Rejected)
  • Average Partner Earnings
  • Partner Retention Rate
  • Average Menu Size
  • Order Fulfillment Rate
  • Average Rating

PLATFORM METRICS:
  • Total Orders
  • Gross Merchandise Value (GMV)
  • Revenue (Commission + Subscriptions)
  • Order Success Rate
  • Average Delivery Time
  • Platform Commission Rate

AFFILIATE METRICS:
  • Total Active Affiliates
  • Referral Conversion Rate
  • Affiliate Earnings
  • Top Performers
  • Milestone Achievements

ENGAGEMENT METRICS:
  • Session Duration
  • Pages per Session
  • Feature Usage
  • Notification Open Rate
  • Review Submission Rate
  • Referral Share Rate

SUPPORT METRICS:
  • Ticket Volume
  • Response Time
  • Resolution Time
  • Customer Satisfaction (CSAT)
  • Ticket Closure Rate
```

---

## 9. SECURITY & COMPLIANCE

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                      SECURITY & COMPLIANCE FEATURES                           │
└──────────────────────────────────────────────────────────────────────────────┘

AUTHENTICATION SECURITY:
  ✓ JWT-based Authentication
  ✓ Secure Password Hashing (bcrypt)
  ✓ Session Management
  ✓ Multi-factor Authentication (Ready for implementation)
  ✓ Biometric Authentication (Mobile)

DATA SECURITY:
  ✓ Row Level Security (RLS) in Database
  ✓ Encrypted Data Transmission (HTTPS/TLS)
  • Data at Rest Encryption (Supabase managed)
  • Secure File Upload (Image validation)
  • SQL Injection Prevention (Parameterized queries)
  • XSS Protection (React built-in)

AUTHORIZATION:
  ✓ Role-Based Access Control (RBAC)
  ✓ User Roles: user, partner, admin
  ✓ Granular Permissions per Role
  ✓ API Access Control

PRIVACY & COMPLIANCE:
  ✓ GDPR Compliance (Data export/deletion capabilities)
  ✓ User Consent Management
  ✓ Privacy Policy & Terms of Service
  • CCPA Compliance (Ready)
  • Data Retention Policies
  • Cookie Consent (Ready)

PAYMENT SECURITY:
  • PCI DSS Compliance (Stripe)
  • Secure Payment Processing
  • Fraud Detection (Stripe managed)

OPERATIONAL SECURITY:
  • Regular Security Audits (Supabase managed)
  • Dependency Updates
  • Vulnerability Scanning
  • Incident Response Plan
```

---

## DOCUMENT END

Generated: 2026-02-14
Platform: NutriFuel - Healthy Meal Delivery Marketplace
Version: 1.0
Author: Business Analysis System

For questions or updates, please refer to the main codebase at:
C:\Users\khamis\Documents\nutrio-fuel
```
