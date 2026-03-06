# Codebase Structure

**Analysis Date:** 2026-03-06

## Directory Layout

```
C:\Users\khamis\Documents\nutrio/
├── src/                                    # Source code
│   ├── components/                         # React components
│   │   ├── ui/                            # shadcn/ui primitives (Radix-based)
│   │   │   ├── accordion.tsx
│   │   │   ├── alert.tsx
│   │   │   ├── alert-dialog.tsx
│   │   │   ├── avatar.tsx
│   │   │   └── ... (40+ primitives)
│   │   ├── customer/                      # Customer-specific components
│   │   │   └── CustomerDeliveryTracker.tsx
│   │   ├── driver/                        # Driver-specific components
│   │   │   ├── DriverLayout.tsx
│   │   │   └── DriverQRScanner.tsx
│   │   ├── partner/                       # Partner-specific components
│   │   │   └── PartnerDeliveryHandoff.tsx
│   │   ├── CancellationFlow/              # Order cancellation wizard
│   │   │   ├── index.tsx
│   │   │   ├── Step1Survey.tsx
│   │   │   ├── Step2PauseOffer.tsx
│   │   │   ├── Step3DiscountOffer.tsx
│   │   │   └── Step4Final.tsx
│   │   ├── maps/                          # Mapbox/Leaflet components
│   │   │   ├── MapContainer.tsx
│   │   │   ├── Markers.tsx
│   │   │   ├── RoutePolyline.tsx
│   │   │   └── DriverMarker.tsx
│   │   ├── wallet/                        # Wallet features
│   │   │   ├── WalletBalance.tsx
│   │   │   ├── TransactionHistory.tsx
│   │   │   └── TopUpPackages.tsx
│   │   ├── fleet/                         # Fleet management UI
│   │   │   ├── FleetLayout.tsx
│   │   │   ├── ProtectedFleetRoute.tsx
│   │   │   └── ... (fleet pages)
│   │   ├── AdminLayout.tsx                # Admin portal layout
│   │   ├── AdminSidebar.tsx               # Admin sidebar navigation
│   │   ├── CustomerLayout.tsx             # Customer layout with background
│   │   ├── DriverLayout.tsx               # Driver layout wrapper
│   │   ├── PartnerLayout.tsx              # Partner layout wrapper
│   │   ├── ProtectedRoute.tsx             # Role-based route protection
│   │   ├── NativeRouteRedirect.tsx        # Capacitor route handling
│   │   └── ... (40+ feature components)
│   │
│   ├── pages/                             # Route-level page components
│   │   ├── Index.tsx                      # Landing page
│   │   ├── Auth.tsx                       # Customer auth (login/signup)
│   │   ├── Dashboard.tsx                  # Customer main dashboard
│   │   ├── Meals.tsx                      # Meal browsing page
│   │   ├── Mealdetail.tsx                 # Individual meal page
│   │   ├── Schedule.tsx                   # Meal schedule view
│   │   ├── ProgressRedesigned.tsx         # Nutrition progress tracking
│   │   ├── Tracker.tsx                    # Food/activity tracker
│   │   ├── WaterTracker.tsx               # Water intake tracker
│   │   ├── StepCounter.tsx                | Step count integration
│   │   ├── WeightTracking.tsx             # Weight history/progress
│   │   ├── Profile.tsx                    # User profile/settings
│   │   ├── Dietary.tsx                    # Dietary preferences
│   │   ├── Orders.tsx                     # Order history
│   │   ├── OrderDetail.tsx                | Individual order view
│   │   ├── Subscriptions.tsx              # Subscription management
│   │   ├── Wallet.tsx                     # Wallet/billing
│   │   ├── Checkout.tsx                   # Order checkout
│   │   ├── Notifications.tsx              # Notifications center
│   │   ├── Favorites.tsx                  # Saved items
│   │   ├── Settings.tsx                   # App settings
│   │   ├── Affiliate.tsx                  # Affiliate program
│   │   ├── ReferralTracking.tsx           # Referral analytics
│   │   ├── Addresses.tsx                  # Saved delivery addresses
│   │   ├── Support.tsx                    # Support tickets
│   │   ├── InvoiceHistory.tsx             # Invoice downloads
│   │   ├── DeliveryTracking.tsx           # Live order tracking
│   │   └── ... (public pages)
│   │
│   │   ├── partner/                       # Partner portal pages
│   │   │   ├── PartnerAuth.tsx
│   │   │   ├── PartnerDashboard.tsx
│   │   │   ├── PartnerMenu.tsx
│   │   │   ├── PartnerOrders.tsx
│   │   │   ├── PartnerAnalytics.tsx
│   │   │   ├── PartnerSettings.tsx
│   │   │   ├── PartnerNotifications.tsx
│   │   │   ├── PartnerProfile.tsx
│   │   │   ├── PartnerReviews.tsx
│   │   │   ├── PartnerPayouts.tsx
│   │   │   ├── PartnerOnboarding.tsx
│   │   │   ├── PartnerBoost.tsx
│   │   │   ├── PartnerAddons.tsx
│   │   │   ├── PartnerEarningsDashboard.tsx
│   │   │   ├── PartnerAIInsights.tsx
│   │   │   └── PendingApproval.tsx
│   │   │
│   │   ├── admin/                         # Admin portal pages
│   │   │   ├── AdminDashboard.tsx
│   │   │   ├── AdminRestaurants.tsx
│   │   │   ├── AdminRestaurantDetail.tsx
│   │   │   ├── AdminFeatured.tsx
│   │   │   ├── AdminUsers.tsx
│   │   │   ├── AdminOrders.tsx
│   │   │   ├── AdminSubscriptions.tsx
│   │   │   ├── AdminAnalytics.tsx
│   │   │   ├── AdminSettings.tsx
│   │   │   ├── AdminPayouts.tsx
│   │   │   ├── AdminAffiliatePayouts.tsx
│   │   │   ├── AdminAffiliateApplications.tsx
│   │   │   ├── AdminMilestones.tsx
│   │   │   ├── AdminFreezeManagement.tsx
│   │   │   ├── AdminRetentionAnalytics.tsx
│   │   │   ├── AdminStreakRewards.tsx
│   │   │   ├── AdminAIEngineMonitor.tsx
│   │   │   ├── AdminIncome.tsx
│   │   │   ├── AdminExports.tsx
│   │   │   ├── AdminDietTags.tsx
│   │   │   ├── AdminPromotions.tsx
│   │   │   ├── AdminSupport.tsx
│   │   │   ├── AdminNotifications.tsx
│   │   │   ├── AdminDrivers.tsx
│   │   │   ├── AdminDeliveries.tsx
│   │   │   ├── AdminIPManagement.tsx
│   │   │   ├── AdminSubscriptionDashboard.tsx
│   │   │   └── ... (admin pages)
│   │   │
│   │   ├── driver/                        # Driver portal pages
│   │   │   ├── DriverAuth.tsx
│   │   │   ├── DriverOnboarding.tsx
│   │   │   ├── DriverDashboard.tsx
│   │   │   ├── DriverOrders.tsx
│   │   │   ├── DriverOrderDetail.tsx
│   │   │   ├── DriverHistory.tsx
│   │   │   ├── DriverEarnings.tsx
│   │   │   ├── DriverPayouts.tsx
│   │   │   ├── DriverProfile.tsx
│   │   │   ├── DriverSettings.tsx
│   │   │   ├── DriverSupport.tsx
│   │   │   ├── DriverNotifications.tsx
│   │   │   └── DriverHome.tsx
│   │   │
│   │   ├── fleet/                         # Fleet management pages (separate app)
│   │   │   ├── FleetLogin.tsx
│   │   │   ├── FleetDashboard.tsx
│   │   │   ├── LiveTracking.tsx
│   │   │   ├── DriverManagement.tsx
│   │   │   ├── AddDriver.tsx
│   │   │   ├── DriverDetail.tsx
│   │   │   ├── VehicleManagement.tsx
│   │   │   ├── RouteOptimization.tsx
│   │   │   ├── PayoutManagement.tsx
│   │   │   ├── PayoutProcessing.tsx
│   │   │   └── FleetLogin.tsx
│   │   │
│   │   ├── subscription/                  # Subscription-related pages
│   │   │   └── SubscriptionPlans.tsx
│   │   │
│   │   ├── recommendations/               # AI recommendations pages
│   │   │   └── SmartMealRecommendations.tsx
│   │   │
│   │   ├── planner/                       # Meal planning pages
│   │   │   └── AIWeeklyPlanner.tsx
│   │   │
│   │   └── progress/                      # Progress tracking pages
│   │       └── BodyProgressDashboard.tsx
│   │
│   ├── contexts/                          # React Context providers
│   │   ├── AuthContext.tsx                # Supabase auth state + IP restriction
│   │   ├── AnalyticsContext.tsx           # PostHog analytics context
│   │   └── LanguageContext.tsx            # Language/translation context
│   │
│   ├── hooks/                             # Custom React hooks (TanStack Query)
│   │   ├── useAuth.ts                     # Auth state accessor
│   │   ├── useWallet.ts                   # Wallet balance/transactions
│   │   ├── useSubscription.ts             # Active subscription state
│   │   ├── useUserOrders.ts               # User order history
│   │   ├── useProfile.ts                  # User profile data
│   │   ├── usePartnerAnalytics.ts         # Partner analytics data
│   │   ├── useAffiliateProgram.ts         # Affiliate earnings/stats
│   │   ├── useMealReviews.ts              # Meal review form/submission
│   │   ├── useSubscriptionPlans.ts        # Available plans
│   │   ├── useSmartRecommendations.ts     # AI meal suggestions
│   │   ├── useBodyMetrics.ts              # Body measurements history
│   │   ├── useNutritionGoals.ts           # User nutrition goals
│   │   ├── useAdaptiveGoals.ts            # AI goal adjustments
│   │   ├── useHealthScore.ts              # Health score calculation
│   │   ├── useStreak.ts                   # User streak tracking
│   │   ├── useDeliveryFees.ts             # Delivery fee info
│   │   ├── useFeaturedRestaurants.ts      # Featured partners
│   │   ├── useFavoriteRestaurants.ts      # Favorite partners
│   │   ├── usePagination.ts               # Generic pagination hook
│   │   ├── use-toast.ts                   # Toast helper
│   │   └── ... (50+ domain-specific hooks)
│   │
│   ├── lib/                               # Utility functions and integrations
│   │   ├── utils.ts                       # Shared utilities (cn, formatting)
│   │   ├── analytics.ts                   # PostHog init/tracking
│   │   ├── sentry.ts                      # Sentry error tracking
│   │   ├── capacitor.ts                   # Capacitor native features
│   │   ├── ipCheck.ts                     # IP geo-restriction to Qatar
│   │   ├── currency.ts                    # QAR formatting
│   │   ├── nutrition-calculator.ts        # Macro/calorie calculations
│   │   ├── sadad.ts                       # Sadad payment gateway
│   │   ├── resend.ts                      # Resend email service
│   │   ├── email-service.ts               # Email sending utilities
│   │   ├── email-templates.ts             # Email HTML templates
│   │   ├── invoice-pdf.ts                 # PDF invoice generation
│   │   ├── whatsapp.ts                    # WhatsApp notifications (Ultramsg)
│   │   ├── notifications.ts               # General notification utilities
│   │   ├── notifications/push.ts          # Push notification service
│   │   ├── mapbox-gl                      # Mapbox GL wrapper
│   │   ├── calendar.ts                    # Calendar utilities
│   │   ├── cache.ts                       # Custom caching utilities
│   │   ├── debounce.ts                    # Debounce helper
│   │   ├── haptics.ts                     # Haptic feedback
│   │   ├── meal-plan-generator.ts         # Weekly meal plan generator
│   │   ├── meal-images.ts                 # Meal image optimization
│   │   ├── ai-report-generator.ts         # AI nutrition reports
│   │   ├── meal-images-analysis.ts        # Image analysis for meals
│   │   ├── payment-simulation.ts          # Payment testing utilities
│   │   └── ... (utilities)
│   │
│   ├── services/                          # Service layer (business logic)
│   │   └── walletService.ts               # Wallet operations
│   │
│   ├── integrations/                      # External service integrations
│   │   └── supabase/
│   │       ├── client.ts                  # Typed Supabase client
│   │       ├── types.ts                   # Auto-generated DB types (~106K)
│   │       ├── delivery.ts                # Delivery-specific types
│   │       └── types.ts                   # Database types
│   │
│   ├── fleet/                             # Fleet management module
│   │   ├── index.ts                       # Fleet exports
│   │   ├── types/                         # Fleet types
│   │   │   ├── index.ts
│   │   │   └── fleet.ts
│   │   ├── components/                    # Fleet UI components
│   │   ├── pages/                         # Fleet pages (see pages/fleet/)
│   │   ├── routes.tsx                     # Fleet routes
│   │   ├── context/                       # Fleet contexts
│   │   │   ├── TrackingContext.tsx
│   │   │   ├── FleetAuthContext.tsx
│   │   │   └── CityContext.tsx
│   │   ├── services/                      # Fleet API services
│   │   │   ├── fleetApi.ts
│   │   │   └── trackingSocket.ts
│   │   └── hooks/                         # Fleet hooks
│   │       ├── useLiveTracking.ts
│   │       ├── useFleetAuth.ts
│   │       └── useDrivers.ts
│   │
│   ├── test/                              # Test utilities
│   │   ├── setup.ts                       # Vitest setup
│   │   ├── server.ts                      # MSW server
│   │   └── mocks/                         # Test mocks
│   │       └── index.ts
│   │
│   ├── App.tsx                            # Main app with all routes
│   ├── main.tsx                           # Application entry point
│   ├── index.css                          # Global styles + Tailwind
│   └── vite-env.d.ts                      # Vite type declarations
│
├── supabase/                              # Supabase configuration and DB
│   ├── config.toml                        # Local Supabase config
│   ├── types.ts                           # Local DB types (backup)
│   └── migrations/                        # SQL migration files
│       ├── 20240101000000_add_notification_preferences.sql
│   │   ├── 20240101000001_add_nps_responses.sql
│   │   ├── 20240101000002_add_cancel_order_rpc.sql
│   │   ├── 20240101000003_add_delivery_queue.sql
│   │   ├── 20240101_driver_app.sql
│   │   ├── 20240102_driver_integration.sql
│   │   ├── 20240227_demo_fleet_data.sql
│   │   ├── 20240228000000_fleet_management.sql
│   │   ├── 20250218130000_email_logs.sql
│   │   ├── 20250218120000_wallet_system.sql
│   │   ├── 20250219000000_ip_management.sql
│   │   ├── 20250220000001_fix_ip_rls_policies.sql
│   │   ├── 20250220000002_fix_referral_tables.sql
│   │   ├── 20250220000003_create_diet_tags.sql
│   │   ├── 20250220000004_create_promotions.sql
│   │   ├── 20250220000005_create_announcements.sql
│   │   ├── 20250220000006_create_admin_tables.sql
│   │   ├── 20250220000007_create_profile_trigger.sql
│   │   ├── 20250220000008_create_ip_logging_trigger.sql
│   │   ├── 20250223000001_ai_subscription_credit_system.sql
│   │   ├── 20250223000002_add_sample_featured_listings.sql
│   │   ├── 20250223000003_add_sample_subscriptions.sql
│   │   ├── 20250223000004_advanced_retention_system.sql
│   │   ├── 20250225_add_annual_billing.sql
│   │   ├── 20260105*                      # Recent migrations (2026-01)
│   │   ├── 20260218*                      # February 2026 migrations
│   │   ├── 20260220*                      # February 2026 migrations
│   │   ├── 20260221*                      | February 2026 migrations
│   │   └── ... (other migrations)
│
├── e2e/                                   # End-to-end tests (Playwright)
│   ├── cross-portal/                      # Cross-portal test suites
│   │   ├── order-lifecycle.spec.ts
│   │   ├── partner-onboarding.spec.ts
│   │   ├── driver-delivery.spec.ts
│   │   ├── admin-management.spec.ts
│   │   ├── customer-journey.spec.ts
│   │   ├── subscription-management.spec.ts
│   │   ├── affiliate-referral.spec.ts
│   │   ├── wallet-payments.spec.ts
│   │   ├── payouts-workflow.spec.ts
│   │   └── notifications-workflow.spec.ts
│   └── fixtures/                          # Test fixtures
│
├── public/                                # Static assets
│   ├── favicon.svg
│   └── assets/                            # Images, icons, videos
│
├── .opencode/                             # Custom tooling
│   └── scripts/                           # Validation scripts
│       └── enforce-patterns.js
│
├── .eslintrc.cjs                          # ESLint configuration
├── .prettierrc.json                       # Prettier configuration
├── vitest.config.ts                       # Vitest configuration
├── playwright.config.ts                   # Playwright configuration
├── tailwind.config.ts                     # Tailwind CSS configuration
├── postcss.config.mjs                     # PostCSS configuration
├── tsconfig.json                          # Root TypeScript config
├── tsconfig.app.json                      # App TypeScript config
├── tsconfig.node.json                     # Node TypeScript config
├── components.json                        # shadcn/ui configuration
├── package.json                           # Dependencies and scripts
├── vite.config.ts                         # Vite configuration
└── AGENTS.md                              # This file
```

## Directory Purposes

**src/components/:**
- Purpose:_reusable React components
- Contains: All UI components, organized by feature (ui/, customer/, driver/, partner/, CancellationFlow/, maps/, wallet/)
- Key files: `ProtectedRoute.tsx`, `AdminLayout.tsx`, `CustomerLayout.tsx`, `DriverLayout.tsx`

**src/pages/:**
- Purpose: Route-level page components
- Contains: One file per route, organized by portal (customer at top, partner/admin/driver in subdirectories)
- Key files: All files map directly to URL routes defined in `src/App.tsx`

**src/hooks/:**
- Purpose: Custom hooks for data fetching and business logic
- Contains: Hooks typically use `@tanstack/react-query` for server state management
- Key files: `useSubscription.ts`, `useWallet.ts`, `useUserOrders.ts`, `useProfile.ts`, `usePartnerAnalytics.ts`, `useAffiliateProgram.ts`

**src/lib/:**
- Purpose: Utility functions and third-party service integrations
- Contains: Helper functions, payment gateways, email services, analytics tracking
- Key files: `utils.ts`, `analytics.ts`, `sentry.ts`, `capacitor.ts`, `ipCheck.ts`, `sadad.ts`

**src/contexts/:**
- Purpose: React Context providers for global state
- Contains: Auth, Analytics, Language contexts
- Key files: `AuthContext.tsx`, `AnalyticsContext.tsx`, `LanguageContext.tsx`

**src/integrations/supabase/:**
- Purpose: Supabase client and database types
- Contains: Single typed Supabase client instance, auto-generated types
- Key files: `client.ts`, `types.ts`

**src/fleet/:**
- Purpose: Fleet management portal (separate from main customer app)
- Contains: Fleet-specific UI, types, services, hooks
- Key files: `routes.tsx`, `services/fleetApi.ts`, `services/trackingSocket.ts`

**supabase/migrations/:**
- Purpose: Database schema migrations
- Contains: SQL migration files with timestamps
- Key pattern: `YYYYMMDDHHMMSS_<description>.sql`

**e2e/cross-portal/:**
- Purpose: Cross-portal end-to-end tests using Playwright
- Contains: Test suites for order lifecycle, partner onboarding, driver delivery, admin management
- Key files: `order-lifecycle.spec.ts`, `partner-onboarding.spec.ts`

## Key File Locations

**Entry Points:**
- `src/main.tsx`: Application entry point (React root, initialization)
- `src/App.tsx`: Route definitions, provider hierarchy

**Configuration:**
- `tsconfig.json`: Root TypeScript references
- `tsconfig.app.json`: App compiler options
- `vite.config.ts`: Vite configuration
- `tailwind.config.ts`: Tailwind CSS setup
- `vitest.config.ts`: Vitest testing configuration
- `playwright.config.ts`: Playwright E2E configuration
- `.eslintrc.cjs`: ESLint rules
- `.prettierrc.json`: Code formatting rules
- `components.json`: shadcn/ui configuration

**Core Infrastructure:**
- `src/integrations/supabase/client.ts`: Typed Supabase client singleton
- `src/integrations/supabase/types.ts`: Auto-generated database types
- `src/contexts/AuthContext.tsx`: Authentication provider with IP restriction
- `src/lib/capacitor.ts`: Native mobile feature initialization

**Core Business Logic:**
- `src/hooks/useSubscription.ts`: Subscription state management
- `src/hooks/useWallet.ts`: Wallet balance and transactions
- `src/services/walletService.ts`: Wallet business logic
- `src/lib/payment-simulation.ts`: Payment gateway simulation for testing

## Naming Conventions

**Files:**
- Component files: `PascalCase.tsx` (e.g., `Dashboard.tsx`, `ProtectedRoute.tsx`)
- Hook files: `use<Feature>.ts` or `use<Feature>.tsx` (e.g., `useWallet.ts`, `use-toast.ts`)
- Test files: `<File>.test.tsx` or `<File>.spec.tsx` (e.g., `Onboarding.test.tsx`)
- Utility files: `kebab-case.ts` (e.g., `nutrition-calculator.ts`, `payment-simulation.ts`)
- Context files: `<Name>Context.tsx` (e.g., `AuthContext.tsx`)
- Migration files: `YYYYMMDDHHMMSS_<snake_case>.sql` (e.g., `20250218130000_email_logs.sql`)

**Directories:**
- Portal-specific: `partner/`, `admin/`, `driver/`, `fleet/`
- Feature-based: `wallet/`, `CancellationFlow/`, `maps/`, `driver/`, `customer/`
- General: `components/`, `pages/`, `hooks/`, `lib/`, `contexts/`, `integrations/`

**Variables/Functions:**
- Hooks: `use<Vendor><Feature>` (e.g., `useWallet`, `useSubscriptionPlans`)
- Components: PascalCase (e.g., `OrderDetail`, `CustomerLayout`)
- Utilities: camelCase (e.g., `formatCurrency`, `calculateNutritionGoals`)
- Contexts: singular nouns (e.g., `AuthContext`, `AnalyticsContext`)

## Where to Add New Code

**New Customer Feature (e.g., "Schedule"):**
- Component: `src/components/ScheduleModal.tsx`
- Hook (if data fetching): `src/hooks/useSchedule.ts`
- Page: `src/pages/Schedule.tsx`
- Test: `src/pages/Schedule.test.tsx`

**New Partner Feature (e.g., "Dashboard Analytics"):**
- Page: `src/pages/partner/PartnerAnalytics.tsx`
- Hook: `src/hooks/usePartnerAnalytics.ts`
- Service: `src/services/partnerAnalyticsService.ts`

**New Admin Feature (e.g., "User Blocking"):**
- Service: `src/services/adminService.ts`
- Hook: `src/hooks/useAdminUsers.ts`
- Page: `src/pages/admin/AdminUsers.tsx` (extend existing)

**New Database Table:**
- Migration: `supabase/migrations/YYYYMMDDHHMMSS_create_<table>.sql`
- Run: `npx supabase db push` to update `supabase/migrations/types.ts`
- Regenerate types: `npx supabase gen types typescript > src/integrations/supabase/types.ts`

**New UI Component:**
- Design: Add to `src/components/ui/` using `npx shadcn-ui add <component>`
- Import: Use `@/components/ui/<component>` pattern

**New External Integration:**
- Service: `src/lib/<integration>.ts` (e.g., `src/lib/sadad.ts`)
- Hook: `src/hooks/use<Integration>.ts` if state management needed
- Import: `@/lib/<integration>`

## Special Directories

**src/components/ui/:**
- Purpose: shadcn/ui component primitives
- Generated: Yes, via `npx shadcn-ui add <component>`
- Committed: Yes

**src/test/:**
- Purpose: Test utilities and mocking
- Generated: No
- Committed: Yes

**supabase/migrations/:**
- Purpose: Database schema tracking and versioning
- Generated: No (manual SQL files)
- Committed: Yes

**supabase/.temp/:**
- Purpose: Local Supabase CLI temporary files
- Generated: Yes (by Supabase CLI)
- Committed: No (gitignore)

**public/:**
- Purpose: Static assets served directly
- Generated: No
- Committed: Yes

---

*Structure analysis: 2026-03-06*