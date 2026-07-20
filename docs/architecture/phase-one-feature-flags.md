# Phase One Feature Flags

Nutrio uses the existing PostHog flag adapter in `src/lib/analytics.ts`. The
typed registry in `src/lib/phase-one-feature-flags.ts` is the source of truth
for keys, ownership, dependencies, monitoring, and retirement dates.

Operational overrides are available for release verification when PostHog is
not loaded yet:

- `VITE_PHASE_ONE_ENABLE_ALL=true` enables every phase-one flag and dependency.
- `VITE_PHASE_ONE_FLAGS=phase1-ranking-v2,phase1-micronutrients` enables only
  the listed flags.
- Browser QA can use `localStorage.nutrio_phase_one_enable_all = "true"` or
  `localStorage.nutrio_phase_one_flags` as a JSON array/object or comma list.

## Rollout policy

All phase-one flags default to `false`. A database migration may deploy before
its UI is enabled, but legacy behavior must continue while the flag is off.

1. Internal accounts and seeded fixtures.
2. Staff and partner nutrition validation where applicable.
3. Five-percent customer cohort; ranking runs in shadow mode first.
4. Twenty-five percent after safety and data-quality review.
5. Independent full rollout. Do not bundle all flags into one release switch.

Flag payloads may configure rollout mode or numeric thresholds, but must not
change safety gates, ownership, or privacy guarantees. In development and when
PostHog is unavailable, helpers return the registered default unless an explicit
phase-one operational override is present.

## Rollback requirements

- Turning a flag off must stop new writes from the feature path without
  deleting facts already recorded.
- Schema remains backward-compatible until a later cleanup release.
- Each owner supplies the monitoring query/event named in the typed registry.
- Expired flags are reviewed by Agent 0: remove after stable full rollout or
  extend with a documented reason.

## Route gates

Only Agent 0 edits `src/App.tsx` or `src/customer/routes.tsx`. New pages are
integrated in Wave 4 with an explicit flag gate and a valid legacy fallback;
hidden navigation alone is not access control.
