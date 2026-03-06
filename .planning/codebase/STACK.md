# Technology Stack

**Analysis Date:** 2026-03-06

## Languages

**Primary:**
- TypeScript 5.8.3 - All frontend (React), build tools, and configuration files

**Secondary:**
- SQL - Database migrations in `supabase/migrations/`
- TypeScript (Deno runtime) - Supabase Edge Functions in `supabase/functions/`
- JavaScript - Build scripts in `.opencode/scripts/`

## Runtime

**Environment:**
- Node.js 22.16.5 (devDependencies reference)
- Vite 7.3.1 - Build tool and dev server
- React 18.3.1 + React DOM 18.3.1 - UI framework

**Package Manager:**
- npm (based on package.json scripts and structure)
- Lockfile: `package-lock.json` (implied, standard for npm)

## Frameworks

**Core:**
- React 18.3.1 - UI framework
- React Router DOM 7.13.0 - Client-side routing
- TanStack Query 5.83.0 - Server state management

**UI:**
- shadcn/ui + Radix UI - Component primitives
- Tailwind CSS 3.4.17 - Styling system
- Framer Motion 12.34.3 - Animations
- Recharts 2.15.4 - Charts and data visualization

**Testing:**
- Vitest 4.0.18 + React Testing Library - Unit and integration tests
- Playwright 1.58.2 - E2E testing framework

**Build/Dev:**
- Vite 7.3.1 - Build tool and dev server
- SWC - Transpiler via `@vitejs/plugin-react-swc`
- ESLint 9.32.0 - Code linting

## Key Dependencies

**Critical:**
- `@supabase/supabase-js` 2.89.0 - Supabase client for Postgres, Auth, and Edge Functions
- `tanstack/react-query` 5.83.0 - Server state management for API data
- `zod` 3.25.76 - Schema validation
- `react-hook-form` 7.61.1 - Form management with Zod validation

**Infrastructure:**
- `posthog-js` 1.351.1 - Analytics and product insights
- `@sentry/react` 10.39.0 - Error tracking and performance monitoring
- `@capacitor/core` 8.0.0 - Native mobile bridge for iOS/Android

**UI Components:**
- `@radix-ui/react-*` 1.2.x - 26+ Radix UI primitives (dialog, dropdown, select, toast, etc.)
- `lucide-react` 0.462.0 - Icon library
- `class-variance-authority` 0.7.1 - Classname utility for variants
- `clsx` 2.1.1 - Conditional classnames

## Configuration

**Environment:**
- Vite injects `import.meta.env.*` variables at build time
- All client-side env vars prefixed with `VITE_`
- Server-side env vars (for Edge Functions) use `Deno.env.get()`
- Resend API key uses `RESEND_API_KEY` (not prefixed) for server-side functions

**Build:**
- `vite.config.ts` - Vite configuration with path alias `@/` → `./src`
- `tsconfig.json` - Base TypeScript config with path aliases and strict mode
- `tailwind.config.ts` - Tailwind CSS configuration with custom design tokens
- `vitest.config.ts` - Vitest test configuration with jsdom and V8 coverage

**Environment Variables (required):**
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` - Supabase anon key
- `VITE_POSTHOG_KEY` - PostHog analytics key
- `VITE_SENTRY_DSN` - Sentry error tracking DSN
- `VITE_ULTRAMSG_INSTANCE_ID`, `VITE_ULTRAMSG_TOKEN` - WhatsApp API credentials
- `VITE_SADAD_*` - Sadad payment gateway credentials
- `RESEND_API_KEY` - Email service API key
- `VITE_OPENROUTER_API_KEY` - OpenRouter AI API for reports

## Platform Requirements

**Development:**
- Node.js 22.x
- npm or compatible package manager
- Access to Supabase project (local development mode supported)

**Production:**
- Web: Any modern browser supporting ES2020+ (Vite target: `esnext`)
- Mobile: iOS 13+ and Android 8+ (Capacitor native containers)

---

*Stack analysis: 2026-03-06*