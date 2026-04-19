# AGENTS.md

Nutrio Fuel - React SPA for healthy meal delivery and nutrition tracking in Qatar.

## Build & Dev Commands

```bash
npm run dev              # Vite dev server (port 5173, not 8080)
npm run build            # Production build
npm run lint             # ESLint
npm run typecheck        # tsc --noEmit
npm run test             # Vitest watch mode
npm run test:run         # Vitest single run
```

**Verify before commit**: Always run `npm run lint && npm run typecheck`.

## Architecture

### Provider Hierarchy
`src/main.tsx` → `initSentry()` → `initPostHog()` → `initializeNativeApp()` (Capacitor)

```
<React.StrictMode> → <SentryErrorBoundary> → <QueryClientProvider> → <BrowserRouter>
  → <AuthProvider> → <AnalyticsProvider> → <Routes />
```

### Five Portals (single SPA)
| Portal | Routes | Auth |
|--------|--------|------|
| Customer | `/dashboard`, `/meals`, `/orders`, `/wallet`, `/schedule`, etc. | `/auth` |
| Partner | `/partner/*` | `/partner/auth` (PartnerLayout) |
| Admin | `/admin/*` | Session (AdminLayout + AdminSidebar) |
| Driver | `/driver/*` | `/driver/auth` (DriverLayout) |
| Fleet | `/fleet/*` | `/fleet/login` (FleetAuthContext, FleetLayout) |

Routes in `src/App.tsx`. Non-critical pages are lazy-loaded.

### Backend: Supabase
- **Client**: `src/integrations/supabase/client.ts` — use `import { supabase } from "@/integrations/supabase/client"`
- **Types**: `src/integrations/supabase/types.ts` — regenerate with `npx supabase gen types typescript`
- **Edge Functions**: `supabase/functions/` (Deno)
- **Migrations**: `supabase/migrations/` — apply with `npx supabase db push`
- **RLS** enabled on all tables

## Key Directories

- `contexts/` — AuthContext (Supabase + Qatar geo-restriction), AnalyticsContext (PostHog)
- `hooks/` — TanStack Query hooks (subscriptions, wallet, favorites, affiliate, pagination)
- `lib/` — `analytics.ts`, `sentry.ts`, `capacitor.ts`, `ipCheck.ts`, `sadad.ts`, `whatsapp.ts`, `currency.ts`
- `components/ui/` — shadcn/ui primitives. Add via `npx shadcn-ui add <component>`
- `pages/` — Route components organized by portal (`admin/`, `partner/`, `driver/`, `dashboard/`, etc.)

## UI System

- **shadcn/ui** + Tailwind CSS. Config in `components.json`. Theme vars in `src/index.css`.
- Design tokens: `primary`, `secondary`, `destructive`, `warning`, `success`, `muted`, `accent`
- Use `cn()` from `@/lib/utils` for conditional classes
- Font: Plus Jakarta Sans. 44px min touch targets

## Skills (MANDATORY)

Use the appropriate skill for each task type:

| Task | Skill |
|-----|-------|
| UI/UX design, mobile redesign | `ui-ux-pro-max` |
| Security | `senior-security` |
| API integration | `API Integration Specialist` |
| Code review | `code-reviewer` |
| Complex exploration | `explore` subagent |
| PDF/Document | `pdf` or `docx` |
| Testing | `webapp-testing` |
| Deployment | `railway-deployment` |

## Code Style

- Path alias: `@/` = `src/`. Use `@/` for non-relative imports.
- Import order: React → third-party → `@/` → relative
- Use Sonner `toast()` for user notifications, `console.error()` for debug
- Supabase queries: always check `error` and throw if present
- Commit messages: present tense, lowercase

## Windows-Specific

This repo uses **PowerShell**. Commands with `&&` won't work. Use `;` instead:
```powershell
npm run lint; npm run typecheck  # NOT npm run lint && npm run typecheck
```

## Never Push Without Permission

You must NEVER commit or push unless the user explicitly asks. Show diffs, wait for approval.

<!-- gitnexus:start -->
## GitNexus Knowledge Graph

This repo is indexed as **nutrio-fuel-new** (3494 symbols, 8675 relationships).

**Before exploring/debugging, run**: `npx gitnexus analyze` if index is stale

| Task | Skill |
|-----|-------|
| Understand architecture | `.claude/skills/gitnexus/exploring/SKILL.md` |
| Blast radius analysis | `.claude/skills/gitnexus/impact-analysis/SKILL.md` |
| Trace bugs | `.claude/skills/gitnexus/debugging/SKILL.md` |
| Rename/refactor | `.claude/skills/gitnexus/refactoring/SKILL.md` |
<!-- gitnexus:end -->
