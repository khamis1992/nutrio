# NutrioFuel Codebase Overview

**Last Updated:** 2025-02-14

## Quick Start

This document provides a 30-minute overview of the NutrioFuel application architecture. For detailed information on any area, refer to the specific documentation files:

- **STACK.md** - Technology stack and dependencies
- **INTEGRATIONS.md** - External services and APIs
- **ARCHITECTURE.md** - System design and data flow
- **STRUCTURE.md** - File organization and layout
- **CONVENTIONS.md** - Coding patterns and style
- **TESTING.md** - Testing approach and patterns
- **CONCERNS.md** - Technical debt and known issues

## What is NutrioFuel?

NutrioFuel is a comprehensive **multi-sided marketplace** for healthy meal delivery with three distinct user portals:

1. **Customer Portal** - Users browse restaurants, order meals, track nutrition, manage subscriptions
2. **Partner Portal** - Restaurant owners manage menus, view analytics, process orders
3. **Admin Portal** - Platform administrators manage users, restaurants, payouts, settings

### Key Features
- **Subscription-based ordering** - Weekly/monthly meal plans with quotas
- **Nutrition tracking** - Calorie and macro tracking with visual progress
- **Multi-tenant restaurants** - Partner restaurant management and approval workflow
- **Referral program** - Multi-tier affiliate system with milestone rewards
- **Native mobile apps** - Capacitor-based Android/iOS apps

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Presentation Layer                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Pages     │  │ Components  │  │   UI Library        │ │
│  │  (Routes)   │  │ (Features)  │  │  (shadcn/ui)        │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────┴────────────────────────────────────┐
│                   Business Logic Layer                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Hooks     │  │  Contexts   │  │   Utilities         │ │
│  │ (Data)      │  │  (Auth)     │  │   (Helpers)         │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────┴────────────────────────────────────┐
│                      Data Layer                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │            Supabase (Auth, DB, Storage)              │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Technology Snapshot

| Category | Technology | Purpose |
|----------|-----------|---------|
| **Framework** | React 18.3 + Vite 5 | UI framework and build tool |
| **Routing** | React Router 6.30 | Client-side routing |
| **State** | TanStack Query + Context | Server and client state |
| **Database** | Supabase (PostgreSQL) | Backend-as-a-Service |
| **Styling** | Tailwind CSS + shadcn/ui | Utility-first CSS + components |
| **Mobile** | Capacitor 8.0 | Native app wrapper |
| **Forms** | React Hook Form + Zod | Form management and validation |
| **Charts** | Recharts 2.15 | Data visualization |

## File System Overview

```
src/
├── pages/           # 40+ page components (routes)
│   ├── admin/       # 17 admin portal pages
│   └── partner/     # 12 partner portal pages
├── components/      # 100+ React components
│   └── ui/          # 60+ shadcn/ui components
├── hooks/           # 15+ custom React hooks
├── contexts/        # AuthContext (global auth state)
├── lib/             # Utility functions
└── integrations/    # Supabase client setup
```

## Key Concepts

### 1. **Three-Portal Architecture**

The app serves three distinct user types with separate navigation and workflows:

- **Customers** (`/dashboard`, `/meals`, `/schedule`, `/progress`)
  - Browse and order meals
  - Track nutrition progress
  - Manage subscriptions and referrals

- **Partners** (`/partner/*`)
  - Manage restaurant profile and menu
  - View analytics and sales
  - Process incoming orders

- **Admins** (`/admin/*`)
  - Approve restaurants and partners
  - Manage payouts and subscriptions
  - Platform-wide analytics and settings

### 2. **Data Fetching Pattern**

All data operations go through custom hooks that wrap Supabase queries:

```typescript
// Hook pattern used throughout
const { profile, loading, error, refetch, updateProfile } = useProfile();
```

Common hooks:
- `useProfile` - User profile data
- `useSubscription` - Subscription status and quotas
- `useAffiliateProgram` - Referral/affiliate features
- `useFavoriteRestaurants` - User favorites

### 3. **Protected Routes**

All authenticated routes use the `ProtectedRoute` wrapper:

```typescript
<Route
  path="/dashboard"
  element={
    <ProtectedRoute>
      <Dashboard />
    </ProtectedRoute>
  }
/>
```

Unauthenticated users are redirected to `/auth`.

### 4. **Component Structure**

- **Pages** - Route-level components in `src/pages/`
- **Feature Components** - Domain-specific components (e.g., `RestaurantCard.tsx`)
- **UI Components** - Reusable shadcn/ui components in `src/components/ui/`

### 5. **State Management**

- **Global State** - React Context (AuthContext)
- **Server State** - TanStack Query (caching, refetching)
- **Form State** - React Hook Form
- **Local State** - useState, useReducer

## Database Schema Overview

**Core Tables:**
- `profiles` - User profiles and preferences
- `restaurants` - Partner restaurant listings
- `meals` - Menu items from restaurants
- `orders` - Customer orders
- `meal_schedules` - Scheduled meal deliveries
- `subscriptions` - User subscription plans
- `user_roles` - Role assignments (user/partner/admin)

**Supporting Tables:**
- `meal_addons` - Meal customization options
- `notifications` - User notifications
- `referrals` - Referral tracking
- `affiliate_commissions` - Affiliate earnings
- `promotions` - Discount codes
- `reviews` - Restaurant/meal reviews

**Full type definitions:** See `src/integrations/supabase/types.ts` (1800+ lines)

## Development Workflow

### Starting Development

```bash
npm install              # Install dependencies
npm run dev             # Start Vite dev server (port 8080)
```

### Building for Production

```bash
npm run build           # Build for web
npm run cap:android     # Build Android app
npm run cap:ios         # Build iOS app
```

### Environment Setup

Required environment variables (`.env`):
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_key
```

## Adding New Features

### 1. New Customer Page

```bash
# Create page file
src/pages/MyNewPage.tsx

# Add route in src/App.tsx
<Route path="/my-new-page" element={<ProtectedRoute><MyNewPage /></ProtectedRoute>} />

# Add navigation link
```

### 2. New Component

```bash
# Create feature component
src/components/MyComponent.tsx

# Export and use in pages
import { MyComponent } from "@/components/MyComponent";
```

### 3. New Data Hook

```bash
# Create hook following pattern
src/hooks/useMyFeature.ts

export const useMyFeature = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch logic with Supabase

  return { data, loading, error, refetch };
};
```

### 4. New Database Table

```bash
# Create migration
supabase migration new create_my_table

# Generate types
supabase gen types typescript --local > src/integrations/supabase/types.ts
```

## Key Files to Understand First

1. **`src/App.tsx`** - All routes defined here, understand the flow
2. **`src/contexts/AuthContext.tsx`** - Authentication state management
3. **`src/pages/Dashboard.tsx`** - Main customer page, shows patterns
4. **`src/hooks/useProfile.ts`** - Example of data fetching pattern
5. **`src/integrations/supabase/types.ts`** - Complete database schema
6. **`src/components/ProtectedRoute.tsx`** - Route protection pattern

## Conventions Summary

- **Files:** PascalCase for components/pages, camelCase for hooks
- **Imports:** Grouped by source (React → third-party → internal)
- **Components:** Functional with hooks
- **Styling:** Tailwind utility classes + cn() helper
- **Types:** TypeScript interfaces for all data structures

## Current Limitations

1. **No Testing** - Test framework not set up (see TESTING.md)
2. **Type Safety** - Strict mode disabled (see CONCERNS.md)
3. **Documentation** - Limited inline comments
4. **Error Tracking** - No production error monitoring
5. **Analytics** - No user analytics integration

## Mobile App Development

The app supports native iOS/Android via Capacitor:

```bash
npm run cap:sync:android    # Sync Android project
npm run cap:sync:ios        # Sync iOS project
npm run cap:dev:android     # Run on Android device
npm run cap:dev:ios         # Run on iOS device
```

Native features:
- Biometric authentication
- Push notifications
- Haptic feedback
- Splash screen
- Safe area handling

## Getting Help

For detailed information on any aspect of the codebase:

- **Architecture questions** → ARCHITECTURE.md
- **Where files are located** → STRUCTURE.md
- **How to write code** → CONVENTIONS.md
- **What technologies are used** → STACK.md
- **External integrations** → INTEGRATIONS.md
- **Known issues** → CONCERNS.md

---

*Overview document: 2025-02-14*
