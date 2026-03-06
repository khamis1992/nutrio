# External Integrations

**Analysis Date:** 2026-03-06

## APIs & External Services

**Resend (Email):**
- Service - Email delivery platform
- SDK/Client: Custom HTTP client in `src/lib/resend.ts`
- Auth: `RESEND_API_KEY` environment variable
- Usage: Welcome emails, invoice emails, notification emails via `resendService.sendEmail()`

**Ultramsg (WhatsApp):**
- Service - WhatsApp Business API via Ultramsg
- SDK/Client: Custom HTTP client in `src/lib/whatsapp.ts`
- Auth: `VITE_ULTRAMSG_INSTANCE_ID` and `VITE_ULTRAMSG_TOKEN`
- Usage: Order confirmations, driver assignments, partner notifications, driver delivery alerts

**Sadad (Payment Gateway):**
- Service - Qatar-based payment processing
- SDK/Client: Custom HTTP client in `src/lib/sadad.ts`
- Auth: `VITE_SADAD_MERCHANT_ID` and `VITE_SADAD_SECRET_KEY`
- Usage: Wallet top-up payments via `initiateSadadPayment()` helper

**Sentry (Error Tracking):**
- Service - Application monitoring and error tracking
- SDK/Client: `@sentry/react` 10.39.0
- Auth: `VITE_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`
- Usage: Error reporting via `captureError()` in `src/lib/sentry.ts`

**PostHog (Analytics):**
- Service - Product analytics and session replay
- SDK/Client: `posthog-js` 1.351.1
- Auth: `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST`
- Usage: Event tracking, user identification, feature flags in `src/lib/analytics.ts`

**OpenRouter AI:**
- Service - Access to multiple LLMs (Mistral, Gemma, etc.)
- Usage: OpenRouter API for AI-generated nutrition reports
- Auth: `VITE_OPENROUTER_API_KEY`

## Data Storage

**Databases:**
- Supabase Postgres
  - Connection: `VITE_SUPABASE_URL` - Supabase project URL
  - Client: `@supabase/supabase-js` 2.89.0
  - Types: Auto-generated in `src/integrations/supabase/types.ts`
  - RLS: Enabled on all tables
  - Migration tool: `npx supabase db push`

**File Storage:**
- Supabase Storage (implied from typical Supabase setup)
- Capacitor Filesystem for native mobile file operations
- Capacitor Camera for image capture

**Caching:**
- localStorage for web sessions
- Capacitor Preferences for native mobile sessions
- Custom cache utility in `src/lib/cache.ts`

## Authentication & Identity

**Auth Provider:**
- Supabase Auth
  - Implementation: Email/password, social providers (Google, GitHub via Supabase)
  - Storage: localStorage (web) / Capacitor Preferences (native)
  - Location: `src/integrations/supabase/client.ts`
  - Custom Auth Context: `src/contexts/AuthContext` with IP-based geo-restriction

**IP Geo-Restriction:**
- Service: IP-based geographic restriction to Qatar
- Implementation: `src/lib/ipCheck.ts` - Checks user IP location
- Integration: AuthContext enforces Qatar-only access

## Monitoring & Observability

**Error Tracking:**
- Sentry - Production error monitoring with source map support
  - Configured in `src/lib/sentry.ts`
  - Disabled in development mode

**Logs:**
- Console logging in development (`console.log`, `console.error`)
- Sentry for production error aggregation
- Supabase Edge Functions log to Deno console

## CI/CD & Deployment

**Hosting:**
- Vercel (implied from vite.config.ts support for `VERCEL` env variable)
- Capacitor for native mobile apps (iOS/Android)

**CI Pipeline:**
- Local pre-commit hook via `.opencode/scripts/enforce-patterns.js`
- Commands checked: TypeScript typechecking, ESLint, pattern enforcement

## Environment Configuration

**Required env vars:**
```env
# Supabase
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY

# Analytics & Monitoring
VITE_POSTHOG_KEY
VITE_SENTRY_DSN

# WhatsApp
VITE_ULTRAMSG_INSTANCE_ID
VITE_ULTRAMSG_TOKEN

# Payments
VITE_SADAD_API_URL
VITE_SADAD_MERCHANT_ID
VITE_SADAD_SECRET_KEY

# Email
RESEND_API_KEY

# AI Reports
VITE_OPENROUTER_API_KEY

# App
VITE_APP_NAME
VITE_APP_ID
VITE_APP_VERSION
```

**Secrets location:**
- Environment variables (`.env.production`, `.env.local` - gitignored)
- `.env.production.template` included in repo with placeholder values

## Webhooks & Callbacks

**Incoming:**
- Sadad payment callback at `/api/payment/callback`
- Resend webhooks (for email delivery status) - configured on Resend dashboard

**Outgoing:**
- WhatsApp messages via Ultramsg API to customer/partner/driver numbers
- Supabase Edge Functions trigger on database events (insert, update, delete)
- PostHog events sent automatically on page views and tracked actions

---

*Integration audit: 2026-03-06*