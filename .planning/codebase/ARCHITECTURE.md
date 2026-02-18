# Architecture

**Analysis Date:** 2025-02-14

## Pattern Overview

**Overall:** Client-side SPA with Context-based state management

**Key Characteristics:**
- Single Page Application (SPA) using React Router
- Three-tier architecture: UI → Business Logic → Data Layer
- Context-based global state (Auth)
- TanStack Query for server state caching
- Component composition with shared UI library
- Route-based code splitting (implicit via React Router)
- Multi-role application (Customer, Partner, Admin portals)

## Layers

**Presentation Layer (UI):**
- Purpose: Render UI components and handle user interactions
- Location: `src/pages/`, `src/components/`
- Contains: Page components, UI components, layout components
- Depends on: Business logic layer (hooks, contexts), Data layer (Supabase client)
- Used by: End users

**Business Logic Layer:**
- Purpose: Encapsulate business rules and data operations
- Location: `src/hooks/`, `src/contexts/`, `src/lib/`
- Contains: Custom hooks, React contexts, utility functions
- Depends on: Data layer (Supabase client)
- Used by: Presentation layer

**Data Layer:**
- Purpose: Abstract external data sources (Supabase)
- Location: `src/integrations/supabase/`
- Contains: Supabase client initialization, TypeScript type definitions
- Depends on: Supabase infrastructure (auth, database, storage)
- Used by: Business logic layer

## Data Flow

**Authentication Flow:**

1. User initiates auth action (sign in/up/out)
2. AuthContext handles action via Supabase client
3. Supabase auth state changes trigger `onAuthStateChange` callback
4. Context updates user/session state
5. ProtectedRoute guards redirect or render based on auth state
6. Components access auth state via `useAuth()` hook

**Query Flow (TanStack Query):**

1. Component calls custom hook (e.g., `useProfile`)
2. Hook initiates Supabase query
3. TanStack Query caches response
4. Component receives data, loading, error states
5. Background refetch on window focus/reconnect

**Order Placement Flow:**

1. User browses meals (/meals, /restaurants/:id)
2. User selects meal and addons
3. Order data saved to `meal_schedules` or `orders`
4. Subscription quota checked/incremented
5. Notification sent to user and partner
6. Real-time UI updates

**State Management:**
- Global state: React Context (AuthContext)
- Server state: TanStack Query (useQuery, useMutation)
- Local component state: useState, useReducer
- Form state: React Hook Form

## Key Abstractions

**Custom Hooks Pattern:**
- Purpose: Encapsulate data fetching and business logic
- Examples: `src/hooks/useProfile.ts`, `src/hooks/useSubscription.ts`
- Pattern: `const { data, loading, error, refetch } = useHook()`
- Return values: Data, loading state, error, actions
- Used in: Page components and shared components

**UI Component Pattern:**
- Purpose: Reusable, composable UI elements
- Examples: `src/components/ui/button.tsx`, `src/components/ui/card.tsx`
- Pattern: Radix UI primitives + Tailwind styling + variant support
- Compound components for complex UI (Dialog, Dropdown, etc.)
- Used in: All page and feature components

**Protected Route Pattern:**
- Purpose: Route-level authentication guards
- Implementation: `src/components/ProtectedRoute.tsx`
- Pattern: Wrap route element, check auth, redirect if needed
- Used in: `src/App.tsx` for protected routes

## Entry Points

**Application Entry:**
- Location: `src/main.tsx`
- Triggers: Application initialization
- Responsibilities:
  - Initialize Capacitor native features
  - Create React root
  - Render App component

**Router Entry:**
- Location: `src/App.tsx`
- Triggers: Browser navigation
- Responsibilities:
  - Define all routes
  - Set up providers (QueryClientProvider, AuthProvider, etc.)
  - Configure route protection
  - Handle 404s

**Page Routes:**
- Customer Portal: `/dashboard`, `/meals`, `/schedule`, `/progress`, etc.
- Partner Portal: `/partner/*`, `/partner/auth`
- Admin Portal: `/admin/*`
- Public: `/`, `/about`, `/contact`, `/auth`

## Error Handling

**Strategy:** Graceful degradation with user feedback

**Patterns:**
- Try-catch blocks in async operations
- Error state in custom hooks (return `{ error }`)
- Toast notifications for user feedback (Sonner)
- Loading states with spinners (Loader2 from lucide-react)
- Error boundaries: Not configured (React default behavior)
- Console logging in development only

**Auth Errors:**
- Redirect to `/auth` if unauthenticated
- Error toasts for sign-in/sign-up failures
- Session refresh handled by Supabase client

## Cross-Cutting Concerns

**Logging:**
- Console-based logging (dropped in production)
- No structured logging service

**Validation:**
- Client-side: Zod schemas for form validation
- React Hook Form resolvers for form integration
- Server-side: Supabase RLS policies and constraints

**Authentication:**
- Supabase Auth for user identity
- Custom role-based access control via `user_roles` table
- Protected routes component pattern
- Role checking throughout app (admin, partner, customer)

**Theming:**
- CSS variables for colors (HSL system)
- Dark mode support via next-themes
- Tailwind utility classes for styling
- Consistent design tokens via Tailwind config

**Mobile Responsiveness:**
- Tailwind responsive breakpoints (sm, md, lg, xl)
- Capacitor for native app wrapper
- Mobile-optimized layouts (bottom navigation on mobile)
- Native features (biometrics, notifications, haptics)

---

*Architecture analysis: 2025-02-14*
