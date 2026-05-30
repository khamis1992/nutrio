# Architecture

This document describes the system architecture, data flow, and technical decisions for the Nutrio platform.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Applications                       │
├─────────────┬─────────────┬──────────┬─────────┬─────────────┤
│   Customer  │   Partner    │  Admin   │ Driver  │    Fleet    │
│   (React)   │   (React)    │ (React)  │ (React) │   (React)   │
└──────┬──────┴──────┬───────┴────┬─────┴────┬────┴──────┬──────┘
       │             │            │          │           │
       └─────────────┴────────────┴──────────┴───────────┘
                              │
                    ┌─────────┴─────────┐
                    │   Supabase Backend │
                    │   (PostgreSQL +     │
                    │    Auth + Storage  │
                    │    + Realtime +     │
                    │    Edge Functions)  │
                    └─────────────────────┘
```

## Provider Hierarchy

The application wraps components in a specific provider order. The entry point is `src/main.tsx`:

```tsx
createRoot(document.getElementById("root")!).render(
  <LanguageProvider>
    <ThemeProvider>
      <SentryErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <Toaster position="top-right" />
            <BrowserRouter basename="/nutrio">
              <AuthProvider>
                <AnalyticsProvider>
                  <SessionTimeoutManager>
                    <ScrollToTop />
                    <Routes>
                      {/* Route definitions */}
                    </Routes>
                  </SessionTimeoutManager>
                </AnalyticsProvider>
              </AuthProvider>
            </BrowserRouter>
          </TooltipProvider>
        </QueryClientProvider>
      </SentryErrorBoundary>
    </ThemeProvider>
  </LanguageProvider>
);
```

**Provider order matters:**
1. `LanguageProvider` - i18n context (English/Arabic)
2. `ThemeProvider` - Dark/light mode
3. `SentryErrorBoundary` - Error catching (production)
4. `DevelopmentErrorBoundary` - Error details (development)
5. `QueryClientProvider` - TanStack Query for server state
6. `TooltipProvider` - Radix UI tooltip context
7. `BrowserRouter` - React Router with `/nutrio` base
8. `AuthProvider` - Supabase auth, user/profile state
9. `AnalyticsProvider` - PostHog tracking
10. `SessionTimeoutManager` - Auto-logout after inactivity

## Five User Portals

### Customer Portal

**Routes:** `/dashboard`, `/meals`, `/orders`, `/wallet`, `/schedule`, `/tracker`, `/favorites`, `/progress`

**Layout:** `CustomerLayout` wraps all routes, provides:
- Top header with user info, notifications, balance
- Bottom tab navigation (Home, Meals, Schedule, Profile)
- FAB for logging meals/activity

**Key Features:**
- Browse restaurants and filter by cuisine, diet tags
- Subscribe to weekly meal plans
- Track daily nutrition and macros
- Log workouts and body measurements
- AI coaching insights (via Edge Functions)
- Wallet balance and payment history
- Affiliate/referral program

**Key Hooks:** `useProfile`, `useTodayProgress`, `useSubscription`, `useWallet`, `useNotifications`

### Partner Portal

**Routes:** `/partner/*` (auth, onboarding, dashboard, menu, orders, analytics, settings, payouts)

**Layout:** `PartnerLayout` with sidebar navigation

**Key Features:**
- Restaurant profile management
- Menu CRUD with meal customization options
- Order fulfillment workflow
- Revenue analytics dashboard
- Payout management
- Boost campaigns for visibility

**Key Hooks:** `usePartnerBranch`, `useRestaurantBranches`

### Admin Portal

**Routes:** `/admin/*` (dashboard, restaurants, users, orders, subscriptions, analytics, settings, exports, payouts)

**Layout:** `AdminLayout` with sidebar and top navigation

**Key Features:**
- Restaurant approval workflow
- User management and role assignment
- Order tracking and analytics
- Subscription management
- Payout processing
- Featured restaurants management
- Diet tags and promotions
- Support ticket monitoring

**Key Hooks:** Various admin-specific hooks for CRUD operations

### Driver Portal

**Routes:** `/driver/*` (auth, onboarding, dashboard, orders, history, earnings, payouts, profile)

**Layout:** `DriverLayout` with bottom tab navigation

**Key Features:**
- Active delivery orders
- Order pickup and delivery workflow
- Earnings tracking
- Payout history
- Profile and vehicle info

**Key Hooks:** `useDriverOrders`, Earnings hooks

### Fleet Portal

**Routes:** `/fleet/*` (login, dashboard, drivers, vehicles, tracking, payouts)

**Layout:** `FleetLayout` with sidebar

**Key Features:**
- Fleet driver management
- Vehicle tracking and assignment
- Real-time location monitoring
- Payout and commission management

**Key Hooks:** Fleet-specific hooks via Edge Functions

## Data Flow

### Authentication Flow

```
User → /auth (WelcomeScreen)
     → Email/Password or OAuth (Google, Apple)
     → Supabase Auth
     → AuthContext loads user + profile
     → Role-based redirect:
        - customer → /dashboard
        - partner → /partner (or /partner/onboarding)
        - admin → /admin
        - driver → /driver
        - fleet → /fleet
        - coach → /coach
```

### Data Fetching Pattern

All data fetching uses TanStack Query hooks:

```tsx
// Hook pattern
export function useProfile() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['profile', user?.id],
    queryFn: () => supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single(),
    enabled: !!user,
  });
}

// Usage in component
const { data: profile, isLoading } = useProfile();
```

### Realtime Subscriptions

Critical data uses Supabase Realtime:

```tsx
// useRealtimeTable hook pattern
useEffect(() => {
  const channel = supabase
    .channel('table-changes')
    .on('postgres_changes', 
      { event: '*', schema: 'public', table: 'orders' },
      (payload) => {
        queryClient.invalidateQueries({ queryKey: ['orders'] });
      }
    )
    .subscribe();
    
  return () => { supabase.removeChannel(channel); };
}, []);
```

### Edge Functions

Serverless Deno functions for secure operations:

| Function | Purpose |
|----------|---------|
| `auto-assign-driver` | Automatically assign nearest driver |
| `calculate-health-score` | Compute user health metrics |
| `smart-meal-allocator` | AI-powered meal recommendations |
| `adaptive-goals` | Adjust nutrition goals dynamically |
| `send-push-notification` | Push notifications via FCM/APN |
| `process-subscription-renewal` | Handle subscription billing |
| `check-ip-location` | Qatar geo-restriction enforcement |
| `generate-coach-report` | AI coaching insights |

## Database Schema Overview

### Core Tables

| Table | Purpose |
|-------|---------|
| `profiles` | User profiles (extends auth.users) |
| `restaurants` | Partner restaurant info |
| `branches` | Restaurant branch locations |
| `meals` | Menu items with nutrition data |
| `meal_schedules` | Customer orders (past/present/future) |
| `subscriptions` | Subscription plans and status |
| `notifications` | In-app notifications |
| `wallet_transactions` | User wallet balance history |
| `driver_locations` | Real-time driver GPS |

### Key Relationships

```
profiles ──┬── user_role (customer/partner/admin/driver/fleet/coach)
           ├── subscription_id → subscriptions
           └── branch_id → branches (for partners)

restaurants ──┬── branches
              └── meals

meal_schedules ──┬── user_id → profiles
                 ├── meal_id → meals
                 └── branch_id → branches
```

## Mobile (Capacitor)

### Native Features

- **Camera** - Profile photos, meal photos for AI analysis
- **Push Notifications** - Order updates, promotions
- **Local Notifications** - Meal reminders
- **Biometrics** - Fingerprint/Face ID auth
- **Geolocation** - Delivery tracking
- **Haptics** - Tactile feedback
- **Splash Screen** - Native launch animation
- **Status Bar** - Dark/light mode support

### Build Commands

```bash
npm run cap:sync        # Sync web assets to native
npm run cap:android     # Build + open Android Studio
npm run cap:ios         # Build + open Xcode
```

### Native Storage

Supabase auth uses Capacitor Preferences for native storage:

```tsx
const storage = isNative ? capacitorStorage : localStorage;
```

## Security Architecture

### Row Level Security (RLS)

All tables have RLS enabled. Example policies:

```sql
-- Customers can only see their own orders
CREATE POLICY "Users can view own meal schedules"
  ON meal_schedules FOR SELECT
  USING (auth.uid() = user_id);

-- Partners can only manage their branches
CREATE POLICY "Partners manage own branches"
  ON branches FOR ALL
  USING (auth.uid() = owner_id);
```

### Role-Based Access

`ProtectedRoute` component enforces role requirements:

```tsx
<ProtectedRoute requiredRole="admin" requireApproval>
  <AdminDashboard />
</ProtectedRoute>
```

### Geo-Restriction

Qatar-only access enforced at signup:

```tsx
// src/lib/ipCheck.ts
const { data } = await supabase.functions.invoke('check-ip-location');
if (!data.isQatar) {
  throw new Error('Service only available in Qatar');
}
```

## Performance Considerations

### Code Splitting

Routes are lazy-loaded:

```tsx
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const PartnerMenu = lazy(() => import('./pages/partner/PartnerMenu'));
```

### Query Caching

TanStack Query config:

```tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,  // 5 minutes
      gcTime: 10 * 60 * 1000,     // 10 minutes
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
```

### Bundle Analysis

Run `npm run build` and check `dist/` sizes. Keep route chunks under 500KB.

## Monitoring

### Sentry

- Error tracking with source maps
- Performance monitoring
- User feedback collection

### PostHog

- Feature flags
- Event tracking
- User analytics

## See Also

- [SETUP.md](./SETUP.md) - Environment setup guide
- [CONTRIBUTING.md](./CONTRIBUTING.md) - Development standards
- [docs/API.md](./docs/API.md) - Supabase API reference