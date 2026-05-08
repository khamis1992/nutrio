# Code Quality Audit — Nutrio

Scope: `src/` (React 18 + Vite + TypeScript SPA). Read-only audit. Date: 2026-05-08.

## Summary

| Metric | Value | Status |
|---|---|---|
| Total .ts/.tsx files in `src/` | ~440 (~134k LOC) | — |
| Files exceeding 500-line CLAUDE.md limit | **47+** in src/ | RED |
| Largest file | `src/contexts/LanguageContext.tsx` — **4,677 lines** | RED |
| `tsc --noEmit` errors | **0** | GREEN |
| `eslint` run | sandbox-blocked (could not capture output) | UNKNOWN |
| `: any` annotations | 288 occurrences across 113 files | YELLOW |
| `as any` casts | 299 occurrences across 86 files | YELLOW |
| `@ts-ignore` / `@ts-expect-error` | 1 (test file, justified) | GREEN |
| `console.*` calls in src/ | 600 across 214 files (48 are `log/debug/info`) | YELLOW |
| `debugger` statements | 0 | GREEN |
| `TODO`/`FIXME`/`HACK` markers | 3 | GREEN |
| Test files in src/ | 35 (mostly `components/` and `hooks/`) | YELLOW |
| Root `*_SUMMARY.md` files | 11 at repo root + duplicates in worktree | YELLOW |
| Root `*AUDIT*.md` / `*REPORT*.md` files | 14 at repo root | YELLOW |

**Top 10 oversized files (over 500 lines):**

| LOC | File | Suggested split |
|---:|---|---|
| 4,677 | `src/contexts/LanguageContext.tsx` | Extract `translations` dict to `src/locales/{en,ar}.ts`; keep context provider thin |
| 2,666 | `src/pages/admin/AdminRestaurantDetail.tsx` | Tabs → child route components (`/details`, `/menu`, `/orders`, `/branches`) |
| 2,051 | `src/lib/professional-weekly-report-pdf.ts` | Split per-section builders into `lib/reports/sections/*` |
| 1,619 | `src/pages/MealDetail.tsx` | Extract `MealHero`, `MealAddonsPanel`, `MealReviewsTab`, customization sheet |
| 1,544 | `src/pages/ProgressRedesigned.tsx` | Hoist tabs to lazy-loaded sub-routes |
| 1,490 | `src/pages/Schedule.tsx` | Extract date strip, meal list, filter chips into components |
| 1,454 | `src/pages/Onboarding.tsx` | One file per wizard step; share via `OnboardingContext` |
| 1,442 | `src/components/PremiumAnalyticsDashboard.tsx` | Split charts into `analytics/cards/*` |
| 1,433 | `src/pages/admin/AdminPayouts.tsx` | Extract data table, filters dialog, payout-action sheet |
| 1,429 | `src/pages/admin/AdminOrders.tsx` | Same pattern: filters, table, row actions, modal |

(Honorable mentions over 1k: `nutrio-report-pdf.ts` 1,402; `AdminRestaurants.tsx` 1,381; `LogMealDialog.tsx` 1,354; `Profile.tsx` 1,327.)

---

## Findings (top 12)

### 1. LanguageContext is a 4,677-line monolith — single file holds dictionary, provider, and hook

`src/contexts/LanguageContext.tsx` mixes two `translations` objects (en/ar) inline with `LanguageProvider`/`useLanguage`. ~226 commented-out lines suggest stale entries. This file alone is ~3.5% of the entire `src/` LOC and is touched by virtually every PR (large merge-conflict surface, slow IDE feedback).
**Recommendation:** Move dictionaries to `src/locales/en.ts` and `src/locales/ar.ts` (typed with `as const`), keep only the React context (~80 lines) in `LanguageContext.tsx`. Export `TranslationKey` type derived from the English dictionary so both languages stay in sync at compile time.

### 2. Page files over 1,000 lines, especially the admin portal — 13 files

13 page files exceed 1,000 LOC; another ~25 sit between 500-1000. Admin pages (`AdminRestaurantDetail`, `AdminPayouts`, `AdminOrders`, `AdminRestaurants`, `AdminUsers`, `AdminNotifications`, `AdminSettings`, `AdminAffiliateApplications`) follow the same anti-pattern: page-as-god-component holding tabs, filters, modals, and table-row logic.
**Recommendation:** Apply consistent refactor template: each admin page becomes `<page>.tsx` (route shell + state) plus `<page>/components/{Filters,Table,RowActions,DetailDrawer}.tsx`. Move data fetching into `src/hooks/admin/use<Page>.ts`. Target: keep page shell under 250 lines.

### 3. Three overlapping PDF report generators — 4,218 lines combined

`src/lib/professional-weekly-report-pdf.ts` (2,051), `src/lib/nutrio-report-pdf.ts` (1,402), `src/lib/weekly-report-pdf.ts` (765) plus `src/lib/invoice-pdf.ts` (358) and `src/lib/ai-report-generator.ts` (708) — likely duplicating jsPDF setup, header rendering, color tokens, and table builders. `ProfessionalWeeklyReport.tsx` (786) and `ProfessionalWeightReport.tsx` (473) are the React side of the same domain.
**Recommendation:** Audit which of the three weekly-report generators is actually wired up (Grep imports). Delete the unused ones. Extract shared primitives into `src/lib/pdf/{theme,header,footer,table}.ts`. Goal: collapse to one generator under 600 lines.

### 4. Duplicate components living in two paths (parallel-rewrite drift)

- `src/components/DriverLayout.tsx` (182 lines, props-based wrapper) vs `src/components/driver/DriverLayout.tsx` (334 lines, route Outlet-based). Both register their own driver/online state and Supabase subscriptions.
- `src/components/body-progress/WeeklyMetricsForm.tsx` (177) vs `src/components/body-metrics/WeeklyMetricsForm.tsx` (199) — two near-identical forms.
- `src/components/progress/ProfessionalWeeklyReport.tsx` and `ProfessionalWeightReport.tsx` likely overlap.

**Recommendation:** Pick the canonical version of each pair (the route-Outlet `DriverLayout` and the newer `body-progress/WeeklyMetricsForm` look more current), grep all imports, migrate, then delete the loser. Add a CODEOWNERS / lint rule blocking new top-level components when a domain folder exists.

### 5. Empty/stale top-level directory: `src/integration` (singular) co-exists with `src/integrations` (plural)

`src/integration/` exists on disk but is empty; `src/integrations/supabase/` holds the actual code. This is a footgun for any future contributor running `import from "@/integration/..."`.
**Recommendation:** Delete `src/integration/` (read-only here, flagging only).

### 6. Wide use of `any` in shared service / hook layer — 288 `: any` and 299 `as any`

Concentrations of `any` at boundaries that should be the most strongly typed:
- `src/hooks/useWallet.ts` (10 `: any` + 5 `as any`), `useTopMeals.ts` (12 + 7), `useSmartAdjustments.ts` (9 + 8), `useGoogleFitWorkouts.ts` (3 + 12), `useAdaptiveGoals.ts` (10 `: any`).
- `src/lib/capacitor.ts` (10 + 7), `src/lib/cache.ts` (4 + 3).
- `src/pages/admin/AdminProfitDashboard.tsx` has **18 `as any`** — a clear hotspot.
- `src/integrations/supabase/delivery.ts` 3 + 2.

Combined with 0 typecheck errors, this is the codebase paying for type-safety with escape hatches rather than fixing the underlying types.
**Recommendation:** Generate Supabase types via `supabase gen types typescript` (the project already has `@supabase/supabase-js`) and import from `src/integrations/supabase/types.ts` everywhere a query result is destructured. For hooks, define a `Row<T>` helper. Add eslint rule `@typescript-eslint/no-explicit-any: warn` to stop the bleed; aim to bring `as any` count under 50 in 6 weeks.

### 7. `console.log/debug/info` left in production code paths — 48 hits across 19 files

Notable: `src/fleet/services/trackingSocket.ts` (7), `src/lib/notifications/push.ts` (7), `src/hooks/useGoogleFitWorkouts.ts` (5), `src/fleet/pages/LiveTracking.tsx` (4). 600 total `console.*` if you include warn/error, of which `error`/`warn` are usually legitimate.
**Recommendation:** Replace `console.log/debug/info` with the project's existing `src/lib/sentry.ts` / `src/lib/analytics.ts` instrumentation. Add a Vite `define` to strip `console.log` in production (`drop_console: true` in terser options) and an eslint `no-console: ['warn', { allow: ['warn','error'] }]`.

### 8. Lint configuration could not be exercised — coverage status unknown

`npm run lint` (`eslint .`) was blocked by the sandbox during this audit; `npx tsc --noEmit` ran cleanly (0 errors). Without a lint signal, rules like `react-hooks/exhaustive-deps`, `react-refresh/only-export-components`, and `no-unused-vars` are unverified.
**Recommendation:** Run `npm run lint -- --format json -o eslint-report.json` locally / in CI. Add a CI gate that fails on any lint error (currently absent — `lint` is not in `check:all` until you read carefully: `check:all` does call lint). Verify CI is actually running it.

### 9. `eslint-disable` lines without justification — 9 occurrences

`src/components/CancellationFlow/index.tsx` (5), plus `RestaurantDetail.tsx`, `OrderTrackingHub.tsx`, `lib/debounce.ts`, `lib/notifications/push.test.ts`. Most are inline disables without a `--` comment explaining why.
**Recommendation:** Require eslint-disable directives to include a reason (`eslint-disable-next-line rule -- explanation`); this is configurable via `eslint-comments/require-description`. Audit the 5 in `CancellationFlow` first — likely they hide a real `react-hooks/exhaustive-deps` issue.

### 10. Test coverage gaps — entire feature areas have zero tests

35 `.test.{ts,tsx}` files in `src/` against ~400 source files (~9% file coverage by structural count). Areas with **no tests at all**:
- `src/services/` (8 files: walletService, blood-work, blood-work-ai, driver-location-service, taste-aware-menu-generator, taste-profile-calculator, translationService, health/googleFit) — these are pure logic, the easiest place to add unit tests and the highest ROI.
- `src/pages/admin/` (30 files) — no admin-page tests.
- `src/pages/partner/` (15 files) — no partner-page tests.
- `src/pages/driver/` and `src/fleet/**` — no tests.
- `src/lib/`: covered files are `analytics`, `dateUtils`, `ipCheck`, `retry`, `notifications/push` only. Missing: `currency`, `nutrition-calculator`, `meal-plan-generator`, `payment-simulation`, `sadad`, `email-templates`, `distance`, `blood-markers` — all pure-logic candidates.

**Recommendation:** Prioritize a `src/services/*.test.ts` sweep (target: 1 test file per service in 1 sprint). Add a Vitest coverage threshold (start at 30% line, raise quarterly).

### 11. Many large files have only a `default export` and zero local components — feature envy & god-objects

`MealDetail.tsx` (1,619 lines), `Schedule.tsx` (1,490), `Onboarding.tsx` (1,454), `LogMealDialog.tsx` (1,354), `Profile.tsx` (1,327): each holds dozens of `useState`, several `useEffect` blocks, and inline JSX subtrees that are clearly separate concerns. They also pull in 30-50+ imports each (`MealDetail.tsx` imports 15+ icons alone), inflating bundle for the whole route.
**Recommendation:** Apply the "Page Composition Pattern" — page file owns *only* routing, layout, and orchestration. Extract every JSX subtree larger than ~80 lines into a sibling component file. State that's only consumed by an extracted subtree should move with it (use Context or `useReducer` if cross-cutting).

### 12. Stale planning markdown clutter at repo root — ~25 files plus a duplicated worktree

11 `*_SUMMARY.md`, 5 `*AUDIT*.md`, 6 `*REPORT*.md` files at repo root, plus an entire shadow copy under `.claude/worktrees/silly-banzai-9e6744/`. CLAUDE.md says "NEVER save working files… to root — use `/src`, `/tests`, `/docs`, `/config`, `/scripts`". Examples of likely-stale: `EMERGENCY_FIXES_SUMMARY.md`, `WEEK4_PROGRESS.md`, `WEEK5_COMPLETE.md`, `WEEK6_COMPLETE.md`, `IMPLEMENTATION_COMPLETE.md`, `IMPLEMENTATION_PROGRESS.md`, `FINAL_STEPS.md`, `audit_results.json` and `nul` (untracked). Also two `IMPLEMENTATION_SUMMARY.md` (root + `docs/`).
**Recommendation:** Move historical reports into `docs/archive/YYYY-MM/` (or delete after copying anything load-bearing into `docs/`). Delete the `.claude/worktrees/silly-banzai-9e6744/` snapshot entirely — it's a stale full-tree copy (per the Glob results, it duplicates every audit/report/summary file). Add `.claude/worktrees/` to `.gitignore` if not already. The `nul` file in the working tree is a Windows shell mishap (`>nul` ran as a redirection on a Unix shell) — safe to remove.

---

## Positive findings

- **Zero TypeScript errors** under strict-ish config — the `as any` escape valves work, but the absence of leaked errors is real.
- **Zero `debugger` statements** committed.
- **Only 3 TODO/FIXME markers** across the entire `src/` tree — exceptionally low for a codebase this size.
- **No `@ts-ignore` in production code** — the only `@ts-expect-error` is correctly used in a test that intentionally passes a wrong type.
- **No `React.FC` proliferation** — only 5 occurrences total, idiomatic React 18 function components elsewhere.
- **Test infrastructure is in place** — Vitest + Testing Library + MSW + Playwright are wired; the gap is coverage, not setup.
- **shadcn/ui pattern applied cleanly** in `src/components/ui/` — 50+ primitive components, mostly well under 250 lines (sidebar.tsx at 637 is the only outlier; that one mirrors the upstream shadcn template).

---

## Suggested next steps (priority order)

1. **Quick wins (1-2 days):** delete `src/integration/` empty dir, the `nul` file, `.claude/worktrees/silly-banzai-9e6744/`. Move root `*_SUMMARY.md`/`*AUDIT*.md`/`*REPORT*.md` to `docs/archive/`. Add `no-console` lint rule and Vite terser `drop_console`.
2. **Week 1:** extract `LanguageContext` translations into `src/locales/{en,ar}.ts`. Resolve duplicate `DriverLayout` and `WeeklyMetricsForm`.
3. **Week 2-3:** decompose top 5 oversized pages (`MealDetail`, `Schedule`, `Onboarding`, `AdminRestaurantDetail`, `AdminPayouts`). Generate Supabase types and replace ~50 `any`s in hooks.
4. **Week 4:** add unit tests for `src/services/*` and `src/lib/{currency,nutrition-calculator,meal-plan-generator}.ts`. Set Vitest coverage threshold at 30%.
5. **Continuous:** enforce 500-line file-size rule via a custom eslint rule or pre-commit `wc -l` check; `npm run lint` should be a hard CI gate.

---

Files referenced (for parent agent):
- C:\Users\khamis\Documents\nutrio\src\contexts\LanguageContext.tsx
- C:\Users\khamis\Documents\nutrio\src\pages\admin\AdminRestaurantDetail.tsx
- C:\Users\khamis\Documents\nutrio\src\pages\admin\AdminProfitDashboard.tsx
- C:\Users\khamis\Documents\nutrio\src\pages\MealDetail.tsx
- C:\Users\khamis\Documents\nutrio\src\pages\Schedule.tsx
- C:\Users\khamis\Documents\nutrio\src\pages\Onboarding.tsx
- C:\Users\khamis\Documents\nutrio\src\components\DriverLayout.tsx
- C:\Users\khamis\Documents\nutrio\src\components\driver\DriverLayout.tsx
- C:\Users\khamis\Documents\nutrio\src\components\body-progress\WeeklyMetricsForm.tsx
- C:\Users\khamis\Documents\nutrio\src\components\body-metrics\WeeklyMetricsForm.tsx
- C:\Users\khamis\Documents\nutrio\src\lib\professional-weekly-report-pdf.ts
- C:\Users\khamis\Documents\nutrio\src\lib\nutrio-report-pdf.ts
- C:\Users\khamis\Documents\nutrio\src\lib\weekly-report-pdf.ts
- C:\Users\khamis\Documents\nutrio\src\fleet\services\trackingSocket.ts
- C:\Users\khamis\Documents\nutrio\src\lib\notifications\push.ts
- C:\Users\khamis\Documents\nutrio\src\components\CancellationFlow\index.tsx
- C:\Users\khamis\Documents\nutrio\src\integration (empty dir — delete)
- C:\Users\khamis\Documents\nutrio\.claude\worktrees\silly-banzai-9e6744 (stale copy)
