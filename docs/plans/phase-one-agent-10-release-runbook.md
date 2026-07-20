# Phase One Agent 10 Release Runbook

## Decision

**PASS.** Phase One completed its release gates on 2026-07-20. This decision
applies only to the scope defined by the Phase One multi-agent plan; it does
not claim that future product phases are implemented.

## Database procedure

`npm run test:db:phase1` validates two isolated Supabase projects:

1. **fresh/current** loads the authoritative Phase One baseline and applies
   all eight registry-owned integration-closure migrations.
2. **upgraded** starts at the Phase One integration cutoff and applies the
   same ordered closure set through the Supabase migration runner.

Both paths dynamically execute every `supabase/tests/phase-one-*.sql` file.
The final run passed in both modes and released the temporary database port.

## Command evidence

| Command | Result | Evidence |
|---|---|---|
| `npm run phase1:contracts` | PASS | Contracts, registry ownership, migration ranges, database loop, E2E requirements, and feature flags validated. |
| `npm run test:run` | PASS | 174 files passed; 968 tests passed and 5 todo (973 total). |
| `npm run test:db:phase1` | PASS | Fresh/current and upgraded paths passed all seven pgTAP files. |
| `npm run typecheck` | PASS | Exit 0 after regenerating the final linked-project Supabase types. |
| `npm run lint` | PASS | Exit 0; 0 errors and 122 existing warnings. |
| `npm run build` | PASS | Production Vite build completed after 6,348 modules transformed. |
| `npx playwright test e2e/system/mobile.spec.ts e2e/system/security.spec.ts --project=chromium` | PASS | 27 passed, 2 intentionally skipped, 0 failed. |

## Database results

The following pgTAP totals passed identically for fresh/current and upgraded
execution:

| pgTAP file | Result |
|---|---|
| `phase-one-health-context.sql` | PASS, 34 tests |
| `phase-one-notification-privacy.sql` | PASS, 9 tests |
| `phase-one-nutrition-quality.sql` | PASS, 37 tests |
| `phase-one-order-consumption.sql` | PASS, 47 tests |
| `phase-one-release-gate.sql` | PASS, 10 tests |
| `phase-one-reward-settlement.sql` | PASS, 39 tests |
| `phase-one-wearable.sql` | PASS, 22 tests |

## Supabase deployment

The eight integration-closure migrations were applied to the linked Supabase
project and recorded with remote aliases `20260720014456` through
`20260720015722`. Final TypeScript database types were generated from that
deployed schema.

Post-deploy advisor hardening removed the Phase One public-view security
definer findings, mutable `search_path` finding, anonymous trigger execution,
and anonymous wearable/micronutrient RPC execution. Seven remaining Phase One
advisor notices belong to authenticated, owner-validating `SECURITY DEFINER`
RPC entry points and are intentional. Other advisor notices are legacy/global
database maintenance work and are not Phase One release blockers.

Reference: [Supabase authenticated security-definer function lint](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

## Browser coverage

The mobile/security run covers English at 360px, Arabic RTL at 390px,
schedule, progress, recommendations, activity, outdoor recovery, workout
history, rewards, profile, accessibility names and landmarks, 44px targets,
overflow, dashboard budgets, session revocation, untrusted redirects, token
exposure, and feature-flag rollback.

## Rollback matrix

| Area | Control |
|---|---|
| Consumption | Disable `phase1-consumption-lifecycle`; retain append-only facts and committed snapshots. |
| Nutrition/ranking | Disable dependent rollout flags; preserve provenance and correction records. |
| Wearables/activity | Disable rollout flags and revoke provider credentials. |
| Cooperative rewards | Append compensating XP/wallet ledger entries. |
| Health context | Disable the flag and invoke the owner deletion workflow. |
| Notifications | Disable dispatch while retaining the private outbox and audit trail. |

## Release blockers

None for the defined Phase One scope.
