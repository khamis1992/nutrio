# Nutrio Codebase Audit — Synthesis

**Date:** 2026-05-08
**Scope:** Read-only audit by 4 parallel agents (security, performance, code quality, architecture).
**Detail reports:** `audit/security.md`, `audit/performance.md`, `audit/code-quality.md`, `audit/architecture.md`.

---

## Headline numbers

| Dimension | Result |
|---|---|
| Security findings | **4 Critical**, 6 High, 4 Medium, 1 Low |
| TypeScript errors | 0 (clean) — but 288 `: any` + 299 `as any` |
| Files > 500 LOC (CLAUDE.md cap) | **47+** |
| Largest file | `LanguageContext.tsx` — **4,677 lines** |
| Components calling Supabase directly | **107** (vs 8 service files) |
| Test ratio (Vitest:Playwright:source) | 35 : 95 : ~700 — **inverted pyramid** |
| Raw assets in `src/assets` | **84 MB** (nine PNGs at 5–9 MB) |
| Entry chunk size | **1.21 MB** monolith |
| Hooks using react-query | 6 of 122 (the other 116 use raw `useEffect`) |
| `console.*` calls | 600 |

---

## Cross-cutting findings (flagged by 2+ agents = highest confidence)

These are the issues most worth fixing first because multiple independent passes converged on them:

### 1. `LanguageContext.tsx` — 4,677-line context provider
- **Perf:** ships in entry bundle, provider value not memoized, every keystroke re-renders 60+ consumers
- **Quality:** single biggest file in the repo; ~3.5% of all `src/` LOC
- **Fix:** split inline EN/AR dictionaries into `src/locales/{en,ar}.ts`, lazy-load by current locale, memoize provider value with `useMemo`. Single highest-leverage change in this audit.

### 2. UI components calling Supabase directly (no service layer)
- **Arch:** 107 files bypass `services/` (which has only 8 files)
- **Perf:** 116 raw `useEffect` Supabase calls instead of react-query (no caching, refetch on every mount)
- **Security:** every direct call relies on RLS being correct on the table — no defense in depth
- **Fix:** introduce service modules per domain (meals, orders, partners…), wrap in react-query hooks with sane `staleTime`, migrate components incrementally. Don't try to do this in one PR.

### 3. iOS signing artifacts unprotected in working tree
- **Security + my own pre-flight check:** `ios/Certificates.p12` and `ios/NutriFuel_App_Store.mobileprovision` are untracked and `.gitignore` does not exclude `*.p12` or `*.mobileprovision`
- **Fix immediately (one-line change):** add to `.gitignore`:
  ```
  *.p12
  *.mobileprovision
  ios/Certificates*
  ios/*.mobileprovision
  ```
- Then `git rm --cached` if anything was staged. Rotate the cert if it's been pushed anywhere.

---

## P0 — Must fix before next release (security-critical)

| # | Finding | Location |
|---|---------|----------|
| 1 | **Hardcoded admin email + substring `"admin"` match grants admin role** | `src/pages/Auth.tsx:115`, `src/components/AdminLayout.tsx:64-77` |
| 2 | **Sadad payment secret bundled in SPA** (`VITE_SADAD_SECRET_KEY` used as Bearer token from browser) | `src/lib/sadad.ts:7,89` |
| 3 | **Google OAuth `client_secret` bundled in SPA** (token-refresh path bypasses existing edge function) | `src/hooks/useHealthIntegration.ts:236-260` |
| 4 | **iOS distribution cert at risk of being committed** | `.gitignore`, `ios/` |
| 5 | **OpenRouter API key in client bundle** (3 files) | (see security.md) |
| 6 | **Capacitor `cleartext: true` in production** | `capacitor.config.ts` |
| 7 | **Biometric storage saves raw user password in keychain** | `src/lib/capacitor.ts` |
| 8 | **Stored-XSS surfaces** via `innerHTML`/`document.write` interpolating DB strings | `Marker.tsx`, fleet `LiveMap.tsx`, `PartnerDeliveryHandoff.tsx` |

Move every "VITE_*_SECRET" to a Supabase edge function. The `VITE_` prefix means it's in the public bundle by definition.

---

## P1 — High-value next sprint

**Performance (biggest user-facing wins):**
- Compress/resize `src/assets` PNGs (84 MB → likely <5 MB with WebP + correct dimensions)
- Configure `vite.config.ts` `manualChunks` properly (mapbox, leaflet, recharts, jspdf, html2canvas, @zxing/library all in separate chunks; only load on the routes that need them)
- Set sensible react-query defaults in `App.tsx:144` (`staleTime: 60_000`, `gcTime: 5*60_000`)
- Replace 13× `select('*', {count: 'exact'})` in `AdminDashboard.tsx:143-159` with a single SQL view or RPC

**Architecture:**
- Pick **one** toast system (sonner OR Radix `useToast`) and remove the other (currently both mounted, used by 50 + 109 files)
- Fix `<ProtectedRoute>` re-running DB existence probes on every protected route mount
- Add per-portal error boundaries (currently 1 global + 1 route-level for the whole app)

**Quality:**
- Resolve duplicate components: two `DriverLayout`, two `WeeklyMetricsForm`, three overlapping PDF report generators (`professional-weekly-report-pdf.ts` 2,051 + `nutrio-report-pdf.ts` 1,402 + `weekly-report-pdf.ts` 765)
- Lower Sentry `tracesSampleRate` from 1.0 (cost) and fix synthetic email-shaped user-id

---

## P2 — Maintenance backlog

- Tighten CSP: drop `unsafe-eval`/`unsafe-inline`, reconcile drift between `index.html` meta and `vercel.json` header, add Mapbox endpoints
- Strip 600 `console.*` calls (use a logger with prod-strip)
- Decompose remaining ~46 files over 500 lines (tackle the worst first)
- Reduce `: any` (288) and `as any` (299) — start with `AdminProfitDashboard.tsx` (18 in one file)
- Service-layer test coverage: `src/services/` has 0 tests despite being 8 files of business logic
- Move 25+ stale `*_SUMMARY.md`/`*AUDIT*.md`/`*REPORT*.md` from repo root into `docs/archive/` (CLAUDE.md says "no working files at root")
- Delete duplicate snapshot under `.claude/worktrees/silly-banzai-9e6744/` and empty `src/integration/` dir
- The `BrowserRouter basename="/nutrio"` will misbehave on native — add a Capacitor branch in `App.tsx`

---

## Strengths (worth preserving)

- Lazy-loaded routes are comprehensive
- Capacitor isolation in `src/lib/capacitor.ts` is clean
- Auth bootstrap order (`onAuthStateChange` before `getSession`) is correct
- Vitest config has per-file thresholds + MSW wired up
- Fleet portal has the cleanest DDD structure — use it as the template for refactoring other portals
- 0 TypeScript errors, 0 `debugger` statements, only 3 TODO/FIXMEs

---

## Suggested order of operations

1. **Today (1 hour):** Add `*.p12`/`*.mobileprovision` to `.gitignore`. Verify nothing is already staged.
2. **This week:** Remove the 4 P0 secrets/backdoors. Each is a small, surgical fix.
3. **Next sprint:** Asset compression + vite chunk config (huge user-visible win, low risk).
4. **Following sprint:** LanguageContext split + react-query defaults.
5. **Ongoing:** Service layer migration (one domain per PR), test coverage on services first.

---

## Caveats from the agents

- `npm audit` could not run in agent sandbox — run `npm audit --production` locally and fold HIGH/CRITICAL into P1.
- `npm run lint` likewise sandbox-blocked — verify locally; ESLint may surface more findings.
- DB-side security (RLS, edge functions) was *not* in scope — the existing `SECURITY_REMEDIATION_REPORT.md` (Feb 2026) covers that and is not contradicted.
