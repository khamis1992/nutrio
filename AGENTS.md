# AGENTS.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

Nutrio Fuel is a healthy meal delivery and nutrition tracking platform for Qatar. It is a React SPA with five distinct user portals: **Customer**, **Partner (Restaurant)**, **Admin**, **Driver**, and **Fleet Management**. The backend is entirely Supabase (auth, Postgres DB, Edge Functions). The app also targets native mobile via Capacitor (iOS/Android).

## Build & Dev Commands

```
npm run dev              # Vite dev server on port 8080
npm run build            # Production build (minified, no console logs)
npm run build:dev        # Development build
npm run preview          # Preview production build
npm run lint             # ESLint
npm run typecheck        # tsc --noEmit
npm run test             # Vitest in watch mode
npm run test:run         # Vitest single run
npm run test:coverage    # Vitest with v8 coverage
npx vitest run src/path/to/file.test.tsx   # Run a single test file
```

Capacitor (native mobile):
```
npm run cap:android      # Build + sync + open Android Studio
npm run cap:ios          # Build + sync + open Xcode
npm run cap:sync         # Sync web assets to native projects
```

Database migrations:
```
npx supabase db push     # Apply migrations from supabase/migrations/
```

## Architecture

### Provider Hierarchy (src/main.tsx → src/App.tsx)

Initialization: `initSentry()` → `initPostHog()` → `initializeNativeApp()` (Capacitor)

Component tree:
```
<React.StrictMode>
  <SentryErrorBoundary>
    <QueryClientProvider>        // TanStack Query
      <TooltipProvider>
        <Toaster /> <Sonner />   // Two toast systems (Radix + Sonner)
        <BrowserRouter>
          <AuthProvider>         // Supabase auth state
            <AnalyticsProvider>  // PostHog analytics
              <Suspense>
                <Routes />
              </Suspense>
            </AnalyticsProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </SentryErrorBoundary>
</React.StrictMode>
```

### Five Portals / Route Structure

All portals share a single SPA. Routes are defined in `src/App.tsx`. Most routes are wrapped in `<ProtectedRoute>` which redirects to `/auth` if unauthenticated.

- **Customer** (`/dashboard`, `/meals`, `/orders`, `/wallet`, etc.) — Main consumer-facing app for browsing meals, ordering, tracking nutrition, subscriptions, referrals/affiliate
- **Partner** (`/partner/*`) — Restaurant portal for menu management, order fulfillment, analytics, payouts. Has its own auth at `/partner/auth` and layout in `src/components/PartnerLayout.tsx`
- **Admin** (`/admin/*`) — Platform management: users, restaurants, orders, promotions, IP management, drivers. Layout in `src/components/AdminLayout.tsx` + `AdminSidebar.tsx`
- **Driver** (`/driver/*`) — Delivery driver portal for orders, earnings, payouts. Has its own auth at `/driver/auth` and layout in `src/components/DriverLayout.tsx`
- **Fleet Management** (`/fleet/*`) — Internal operations portal for dispatch, live driver tracking, vehicle management, route optimization, driver management, payouts, and analytics. Has its own auth at `/fleet/login`, its own auth context in `src/fleet/context/FleetAuthContext.tsx`, and layout in `src/fleet/components/FleetLayout.tsx`. Routes are defined in `src/fleet/routes.tsx`.

All non-critical pages are lazy-loaded. Only `Index`, `Auth`, and `NotFound` are eagerly loaded.

### Backend: Supabase

- **Client**: `src/integrations/supabase/client.ts` — single typed Supabase client. Import as `import { supabase } from "@/integrations/supabase/client"`
- **Types**: `src/integrations/supabase/types.ts` — auto-generated DB types (large file, ~106K). Regenerate with `npx supabase gen types typescript`
- **Edge Functions**: `supabase/functions/` — Deno-based serverless functions (email notifications, IP checks, meal image analysis, affiliate notifications)
- **Migrations**: `supabase/migrations/` — SQL migration files. Apply with `npx supabase db push`
- **RLS** is enabled on all tables

### Key src/ Directories

- `contexts/` — `AuthContext` (Supabase auth + IP-based geo-restriction to Qatar) and `AnalyticsContext` (PostHog)
- `hooks/` — Domain-specific hooks using TanStack Query for server state (subscriptions, wallet, favorites, affiliate, pagination, etc.)
- `lib/` — Utilities and service integrations:
  - `analytics.ts` — PostHog init/tracking
  - `sentry.ts` — Sentry error tracking (disabled in dev)
  - `capacitor.ts` — Native mobile feature initialization
  - `ipCheck.ts` — IP geo-restriction (Qatar-only access)
  - `sadad.ts` — Sadad payment gateway (Qatar)
  - `whatsapp.ts` — Ultramsg WhatsApp integration
  - `resend.ts` / `email-service.ts` / `email-templates.ts` — Email via Resend
  - `invoice-pdf.ts` — PDF invoice generation (jsPDF)
  - `currency.ts` — QAR currency formatting
  - `nutrition-calculator.ts` — Macro/calorie calculations
- `services/` — `walletService.ts` (wallet balance, transactions)
- `components/ui/` — shadcn/ui primitives (Radix-based). Add new ones via `npx shadcn-ui add <component>`
- `pages/` — Route-level page components, organized by portal (`admin/`, `partner/`, `driver/`, top-level for customer)

### UI System

- **shadcn/ui** with Radix primitives. Config in `components.json`. CSS variables define the theme in `src/index.css`.
- **Tailwind CSS** with custom design tokens: `primary`, `secondary`, `destructive`, `warning`, `success`, `muted`, `accent`. Custom gradients: `gradient-hero`, `gradient-primary`.
- Use `cn()` from `@/lib/utils` for conditional class merging.
- Font: Plus Jakarta Sans.
- 44px minimum touch targets for mobile.

### Environment Variables

All client-side env vars are prefixed with `VITE_`. See `.env.production.template` for the full list. Key ones:
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` — Supabase connection
- `VITE_SENTRY_DSN` — Error tracking
- `VITE_POSTHOG_KEY` — Analytics
- `VITE_SADAD_*` — Payment gateway
- `VITE_ULTRAMSG_*` — WhatsApp notifications

### Testing

- **Vitest** + **React Testing Library** + **jsdom**. Setup in `src/test/setup.ts`.
- Test files: `*.test.tsx` / `*.spec.tsx` inside `src/`.
- MSW available for API mocking.
- Test setup mocks `matchMedia`, `IntersectionObserver`, `ResizeObserver`, and suppresses React act warnings.

### Code Style

- Path alias: `@/` maps to `src/`. Always use `@/` imports for non-relative imports.
- Strict TypeScript: `noImplicitAny`, `strictNullChecks`, `noUnusedParameters`, `noUnusedLocals`.
- ESLint has `@typescript-eslint/no-unused-vars` turned **off** (relies on tsc for that).
- Import order: React → third-party → `@/` absolute → relative.
- Use Sonner `toast` for user-facing notifications, `console.error` for debug logging.
- Error tracking: use `captureError()` from `@/lib/sentry` in production code paths.
- Supabase queries: always check for `error` in the response and throw if present.
- State management: React Context for global state (auth, analytics), TanStack Query for server state, `useState`/`useReducer` for local state.
- Commit messages: present tense, lowercase.
- Always run `npm run lint` and `npm run typecheck` before committing.

## Agent Rules (CRITICAL - DO NOT IGNORE)

### 1. Use Best Agent & Skill for Every Task
**MANDATORY**: Whenever the user asks for any task, you MUST use the best available agent and skill for that specific task type.
- UI/Design work → Use `frontend-design` or `ui-design-system` skill
- Security work → Use `senior-security` skill
- API integration → Use `API Integration Specialist` skill
- Code review → Use `code-reviewer` skill
- Complex exploration → Use `explore` subagent with thoroughness level
- Marketing → Use `executing-marketing-campaigns` skill
- PDF/Document work → Use `pdf`, `PDF Processing Pro`, or `docx` skill
- Testing → Use `webapp-testing` skill
- Deployment → Use `railway-deployment` skill
- Always match the tool to the task complexity and domain

### 2. Never Push to GitHub Without Explicit Permission
**MANDATORY**: You must NEVER commit or push changes to GitHub unless the user explicitly tells you to.
- Make file changes locally
- Show the user what changed (git status/diff)
- WAIT for explicit "push" or "commit" command from user
- This rule is ABSOLUTE - no exceptions

<!-- gitnexus:start -->
# GitNexus MCP

This project is indexed by GitNexus as **nutrio-fuel-new** (3494 symbols, 8675 relationships, 186 execution flows).

GitNexus provides a knowledge graph over this codebase — call chains, blast radius, execution flows, and semantic search.

## Always Start Here

For any task involving code understanding, debugging, impact analysis, or refactoring, you must:

1. **Read `gitnexus://repo/{name}/context`** — codebase overview + check index freshness
2. **Match your task to a skill below** and **read that skill file**
3. **Follow the skill's workflow and checklist**

> If step 1 warns the index is stale, run `npx gitnexus analyze` in the terminal first.

## Skills

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/refactoring/SKILL.md` |

## Tools Reference

| Tool | What it gives you |
|------|-------------------|
| `query` | Process-grouped code intelligence — execution flows related to a concept |
| `context` | 360-degree symbol view — categorized refs, processes it participates in |
| `impact` | Symbol blast radius — what breaks at depth 1/2/3 with confidence |
| `detect_changes` | Git-diff impact — what do your current changes affect |
| `rename` | Multi-file coordinated rename with confidence-tagged edits |
| `cypher` | Raw graph queries (read `gitnexus://repo/{name}/schema` first) |
| `list_repos` | Discover indexed repos |

## Resources Reference

Lightweight reads (~100-500 tokens) for navigation:

| Resource | Content |
|----------|---------|
| `gitnexus://repo/{name}/context` | Stats, staleness check |
| `gitnexus://repo/{name}/clusters` | All functional areas with cohesion scores |
| `gitnexus://repo/{name}/cluster/{clusterName}` | Area members |
| `gitnexus://repo/{name}/processes` | All execution flows |
| `gitnexus://repo/{name}/process/{processName}` | Step-by-step trace |
| `gitnexus://repo/{name}/schema` | Graph schema for Cypher |

## Graph Schema

**Nodes:** File, Function, Class, Interface, Method, Community, Process
**Edges (via CodeRelation.type):** CALLS, IMPORTS, EXTENDS, IMPLEMENTS, DEFINES, MEMBER_OF, STEP_IN_PROCESS

```cypher
MATCH (caller)-[:CodeRelation {type: 'CALLS'}]->(f:Function {name: "myFunc"})
RETURN caller.name, caller.filePath
```

<!-- gitnexus:end -->
