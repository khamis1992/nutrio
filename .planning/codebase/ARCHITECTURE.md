# Architecture

**Analysis Date:** 2026-03-06

## Pattern Overview

**Overall:** Monorepo Single Page Application (SPA) with Multi-Portal Architecture

**Key Characteristics:**
- Single codebase serving four distinct user portals (Customer, Partner, Admin, Driver)
- All portals share the same React application with role-based route protection
- Backend-as-a-Service using Supabase (Postgres, Auth, Edge Functions, Storage)
- Native mobile targeting via Capacitor wrapper
- Server-side rendering not used - pure client-side React

## Layers

### presentation Layer
- Purpose: User interface components and page routing
- Location: `src/pages/`, `src/components/`
- Contains: Route-level page components, feature components, UI primitives
- Depends on: Hooks, Contexts, Services, Integrations
- Used by: App routes and navigation

**Sub-Layers:**
- **Pages (`src/pages/`):** Route-level components, organized by portal (`admin/`, `partner/`, `driver/`, top-level for customer)
- **Components (`src/components/`):** Reusable UI components, organized by feature (`wallet/`, `driver/`, `customer/`, `CancellationFlow/`)
- **UI Primitives (`src/components/ui/`):** shadcn/ui components based on Radix primitives

### business-logic Layer
- Purpose: Domain-specific logic and data fetching
- Location: `src/hooks/`, `src/services/`, `src/lib/`
- Contains: Custom React hooks (TanStack Query), service clients, utilities
- Depends on: Integrations, Contexts

**Sub-Layers:**
- **Hooks (`src/hooks/`):** Custom hooks using `@tanstack/react-query` for server state (e.g., `useSubscription`, `useWallet`, `useUserOrders`, `usePartnerAnalytics`)
- **Services (`src/services/`):** Business service layer (e.g., `walletService.ts`)
- **Libraries (`src/lib/`):** Utility functions and third-party integrations (analytics, email, payment, utilities)

### integration Layer
- Purpose: External service connections and platform APIs
- Location: `src/integrations/`, `src/contexts/`
- Contains: Supabase client, platform contexts, third-party SDK wrappers

**Sub-Layers:**
- **Supabase (`src/integrations/supabase/`):** `client.ts` (single typed client), `types.ts` (auto-generated DB types)
- **Contexts (`src/contexts/`):** `AuthContext`, `AnalyticsContext`, `LanguageContext` - global state providers
- **Fleet (`src/fleet/`):** Fleet management integration (tracking, drivers, vehicles)

### platform Layer
- Purpose: Application entry and platform initialization
- Location: `src/main.tsx`, `src/App.tsx`
- Contains: Root component, routing, platform feature initialization

## Data Flow

### Authentication Flow

1. User navigates to `/auth` or attempts to access protected route
2. `AuthProvider` initializes Supabase client with custom Capacitor storage adapter
3. `onAuthStateChange` listener maintains session state
4. `/auth` endpoint renders `Auth` page with email/password or OTP signup/login
5. On successful auth, Supabase stores session in Capacitor Preferences (native) or localStorage (web)
6. `ProtectedRoute` component checks auth state and redirects to `/dashboard` or `/auth`
7. IP-based geo-restriction (`checkIPLocation()`) runs before password login to enforce Qatar-only access

### State Management Flow

**Global State (Context):**
- User session (`AuthContext`)
- Analytics instance (`AnalyticsContext`)
- Language preferences (`LanguageContext`)

**Server State (TanStack Query):**
- All API calls use custom hooks in `src/hooks/`
- Hooks return `{ data, error, isLoading, refetch }` pattern
- Cache key patterns: `[entity, id, params]` (e.g., `['orders', userId]`)

**Client State (React):**
- Local form state (`react-hook-form`)
- UI state (modals, filters, selection)
- Capacitor native feature state

### Route Navigation Flow

1. User clicks navigation link (e.g., `/dashboard`)
2. `react-router-dom` matches route in `App.tsx`
3. `ProtectedRoute` wrapper checks auth state (via `AuthContext`)
4. If authenticated, renders lazy-loaded page component
5. If not authenticated, redirects to `/auth`
6. Portal-specific routes check `requiredRole` prop (`admin`, `partner`, `driver`)
7. Customer routes wrapped in `CustomerLayout` for consistent background/navigation
8. Partner routes use `PartnerLayout`, Admin uses `AdminLayout`, Driver uses `DriverLayout`

### API Data Flow

1. Hook calls Supabase client from `@/integrations/supabase/client`
2. Supabase client uses typed `Database` type from `src/integrations/supabase/types.ts`
3. Query executes with RLS policies enforced on database
4. Response returned as typed data (TypeScript inferred from DB schema)
5. Hook returns data to component, triggering re-render
6. Error handling via Supabase `error` property in response

## Key Abstractions

### ProtectedRoute
- Purpose: Role-based access control
- Examples: `src/components/ProtectedRoute.tsx`
- Pattern: Wrapped routes check `user` from context and `requiredRole` prop
- Redirects unauthenticated users to `/auth`

### Supabase Client
- Purpose: Single typed Supabase instance across app
- Examples: `src/integrations/supabase/client.ts`
- Pattern: Custom storage adapter uses Capacitor Preferences for native apps, localStorage for web
- Auth session persisted across app restarts

### Layout System
- Purpose: Portal-specific navigation and branding
- Examples: `src/components/CustomerLayout.tsx`, `src/components/PartnerLayout.tsx`
- Pattern: Layout components wrap portal routes, provide sidebar/header, handle logout
- Admin uses `AdminLayout` + `AdminSidebar.tsx` for complex admin panel navigation

### Toast Notification System
- Purpose: User-facing notifications
- Examples: `@/components/ui/sonner.tsx` (Sonner), `@/components/ui/toast.tsx` (Radix)
- Pattern: Two toast systems coexist - Sonner primary for user alerts, Radix for internal UI states
- Use `toast()` from `sonner` for user notifications

## Entry Points

### Main Entry
- Location: `src/main.tsx`
- Triggers: App launch (native or web)
- Responsibilities: Initialize Sentry, PostHog, Capacitor native features; render root with providers

### App Entry
- Location: `src/App.tsx`
- Triggers: After main initialization completes
- Responsibilities: Define all routes, wrap with provider hierarchy (QueryClient, Tooltip, Toaster, Auth, Analytics)
- Routes defined with lazy-loaded page imports for code splitting

### Capacitor Native Entry
- Location: `src/lib/capacitor.ts`
- Triggers: When `isNative` platform detected
- Responsibilities: Initialize native plugins (camera, haptics, biometrics, etc.)

## Error Handling

**Strategy:** Centralized error boundary with per-page fallbacks

**Patterns:**
- `SentryErrorBoundary` (production): Wraps app, sends errors to Sentry
- `DevelopmentErrorBoundary` (dev): Shows inline error UI
- Supabase queries: Check `error` property and throw for UI to handle
- Hooks: Return `{ error }` or throw based on pattern
- Routes: `NotFound` page catches 404s

## Cross-Cutting Concerns

**Logging:** 
- Console.log only in development (production build removes with terser)
- Error tracking via `@/lib/sentry.ts` using Sentry React integration

**Validation:**
- `zod` schemas for form validation (`react-hook-form`)
- Server-side validation via Supabase DB constraints and RLS

**Authentication:**
- Supabase Auth with email/password or OTP
- Role-based access via `requiredRole` prop on `ProtectedRoute`
- Session stored in Capacitor Preferences (native) or localStorage (web)

**Geo-restriction:**
- IP-based country check (`@/lib/ipCheck.ts`)
- Enforces Qatar-only access via `checkIPLocation()`
- Runs before partner login, may fail silently (log but don't block)

---

*Architecture analysis: 2026-03-06*