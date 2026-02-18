# Codebase Structure

**Analysis Date:** 2025-02-14

## Directory Layout

```
nutrio-fuel/
├── android/                    # Native Android project (Capacitor)
├── ios/                        # Native iOS project (Capacitor)
├── public/                     # Static assets
├── src/
│   ├── assets/                 # Images and static resources
│   │   └── meals/             # Meal placeholder images
│   ├── components/            # React components
│   │   ├── ui/                # shadcn/ui components (60+ files)
│   │   └── [feature components]
│   ├── contexts/              # React contexts
│   ├── hooks/                 # Custom React hooks
│   ├── integrations/          # External service integrations
│   │   └── supabase/          # Supabase client and types
│   ├── lib/                   # Utility functions
│   └── pages/                 # Page components (routes)
│       ├── admin/             # Admin portal pages (17 files)
│       └── partner/           # Partner portal pages (12 files)
├── supabase/                  # Supabase migrations and functions
├── .planning/                 # Planning documents (GSD)
├── [config files]             # Root configuration files
```

## Directory Purposes

**`src/components/`:**
- Purpose: Reusable UI components
- Contains: Feature components, shared components, UI library
- Key files:
  - `ui/` - shadcn/ui component library (button, card, dialog, etc.)
  - `ProtectedRoute.tsx` - Route authentication guard
  - `AdminLayout.tsx`, `PartnerLayout.tsx` - Portal layouts
  - `MainMenu.tsx`, `CustomerNavigation.tsx` - Navigation components
  - `RestaurantCard.tsx`, `MealImageUpload.tsx` - Feature-specific components

**`src/pages/`:**
- Purpose: Route-level page components
- Contains: All application pages organized by portal
- Key files:
  - `Index.tsx`, `About.tsx`, `Contact.tsx` - Public pages
  - `Auth.tsx`, `Onboarding.tsx` - User acquisition
  - `Dashboard.tsx`, `Meals.tsx`, `Schedule.tsx` - Customer features
  - `Profile.tsx`, `Settings.tsx`, `Subscription.tsx` - User management
  - `admin/` - Admin portal (17 pages)
  - `partner/` - Partner portal (12 pages)

**`src/hooks/`:**
- Purpose: Custom React hooks for business logic
- Contains: Data fetching hooks, domain logic hooks
- Key files:
  - `useProfile.ts` - User profile data
  - `useSubscription.ts` - Subscription management
  - `useAffiliateProgram.ts`, `useAffiliateApplication.ts` - Affiliate features
  - `useMealAddons.ts`, `useDeliveryFees.ts` - Order logic
  - `usePremiumAnalytics.ts` - Partner analytics
  - `use-mobile.tsx` - Mobile detection

**`src/contexts/`:**
- Purpose: Global React state management
- Contains: AuthContext
- Key files:
  - `AuthContext.tsx` - Authentication state and methods

**`src/integrations/`:**
- Purpose: External service integrations
- Contains: Supabase client setup, type definitions
- Key files:
  - `supabase/client.ts` - Supabase client initialization
  - `supabase/types.ts` - Database type definitions (auto-generated)

**`src/lib/`:**
- Purpose: Utility functions and helpers
- Contains: General-purpose utilities
- Key files:
  - `utils.ts` - Class name utility (cn function)
  - `currency.ts` - Currency formatting
  - `nutrition-calculator.ts` - Nutrition calculations
  - `capacitor.ts` - Capacitor native features initialization

**`supabase/`:**
- Purpose: Database schema and migrations
- Contains: SQL migrations, functions, RLS policies
- Generated: Supabase types in `src/integrations/supabase/types.ts`

## Key File Locations

**Entry Points:**
- `src/main.tsx`: Application bootstrap, Capacitor init
- `src/App.tsx`: Router configuration, provider setup, route definitions
- `index.html`: HTML root

**Configuration:**
- `vite.config.ts`: Vite build configuration
- `tailwind.config.ts`: Tailwind CSS theming
- `tsconfig.json`: TypeScript configuration
- `capacitor.config.ts`: Capacitor native app config
- `eslint.config.js`: Linting rules
- `.env`: Environment variables (not in git)

**Core Logic:**
- `src/contexts/AuthContext.tsx`: Authentication state management
- `src/integrations/supabase/client.ts`: Database client
- `src/hooks/`: Domain-specific data hooks

**Testing:**
- No test directory configured (testing not set up)

**Mobile:**
- `android/`: Android native project (Capacitor)
- `ios/`: iOS native project (Capacitor)
- `src/lib/capacitor.ts`: Capacitor feature initialization

## Naming Conventions

**Files:**
- Components: PascalCase (e.g., `RestaurantCard.tsx`, `MainMenu.tsx`)
- Hooks: camelCase with `use` prefix (e.g., `useProfile.ts`, `useSubscription.ts`)
- Utilities: camelCase (e.g., `utils.ts`, `currency.ts`)
- Pages: PascalCase (e.g., `Dashboard.tsx`, `AdminDashboard.tsx`)

**Directories:**
- Lowercase with hyphens for multi-word (e.g., `src/pages/admin/`)
- Singular names (e.g., `components/`, not `component/`)

## Where to Add New Code

**New Feature (Customer):**
- Primary code: `src/pages/[FeatureName].tsx`
- Components: `src/components/[FeatureName].tsx`
- Hooks: `src/hooks/use[FeatureName].ts`
- Tests: (not configured - would need to add test directory)

**New Feature (Partner):**
- Primary code: `src/pages/partner/Partner[FeatureName].tsx`
- Components: `src/components/[PartnerFeatureName].tsx`
- Hooks: `src/hooks/use[PartnerFeatureName].ts`

**New Feature (Admin):**
- Primary code: `src/pages/admin/Admin[FeatureName].tsx`
- Components: `src/components/Admin[FeatureName].tsx`

**New UI Component:**
- Implementation: `src/components/ui/[component-name].tsx`
- Follow shadcn/ui patterns
- Export from appropriate index if creating barrel files

**Utilities:**
- Shared helpers: `src/lib/[utility-name].ts`
- Domain logic: `src/hooks/use[Domain].ts`

**New Database Table:**
- Migration: `supabase/migrations/[timestamp]_[description].sql`
- Types: Auto-generated via Supabase CLI to `src/integrations/supabase/types.ts`

## Special Directories

**`node_modules/`:**
- Purpose: npm dependencies
- Generated: Yes
- Committed: No (gitignored)

**`dist/`:**
- Purpose: Vite build output
- Generated: Yes
- Committed: No (gitignored)

**`.lovable/`:**
- Purpose: Lovable.ai tooling data
- Generated: Yes
- Committed: Yes

**`.playwright-mcp/`:**
- Purpose: Playwright MCP tool data
- Generated: Yes
- Committed: Yes

**`android/`, `ios/`:**
- Purpose: Native app projects (Capacitor)
- Generated: Yes (initial sync)
- Committed: Yes (with some generated files gitignored)

---

*Structure analysis: 2025-02-14*
