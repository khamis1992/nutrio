# Phase One Migration Registry

## Reserved ranges

| Owner | Workstream | Reserved range | Depends on |
|---|---|---|---|
| Agent 1 | Consumption lifecycle | `20260720080000`-`20260720085959` | ADR 0001, ADR 0002, ADR 0005 |
| Agent 2 | Nutrition quality | `20260720090000`-`20260720095959` | ADR 0002, ADR 0005 |
| Agent 3 | Ranking v2 | `20260720100000`-`20260720105959` | Agents 1, 2, 4 |
| Agent 4 | Wearable normalization | `20260720110000`-`20260720115959` | ADR 0003, ADR 0005 |
| Agent 5 | Outdoor recording | `20260720120000`-`20260720125959` | Agent 4 contract |
| Agent 6 | Training enhancements | `20260720130000`-`20260720135959` | Existing workout schema audit |
| Agent 7 | Cooperative challenges | `20260720140000`-`20260720145959` | Agents 1, 4; reward ledger |
| Agent 8 | Health context | `20260720150000`-`20260720155959` | Agents 3, 4; consent contract |
| Agent 9 | Domain notifications | `20260720160000`-`20260720165959` | ADR 0005 |
| Agent 0 | Integration fixes only | `20260720170000`-`20260720185959` | Merged feature migrations |

A reservation prevents collisions; it is not permission to add a migration.
Use the next free second inside the assigned range and register the filename in
the change table before handoff.

## Existing authoritative baseline

| Migration | Contract retained |
|---|---|
| `20260712130000_secure_order_delivery_lifecycle.sql` | Status transitions, history, ownership checks, delivery RLS |
| `20260712135000_atomic_meal_scheduling.sql` | Atomic scheduling and request-item idempotency |
| `20260712138500_secure_delivered_meal_progress.sql` | Legacy explicit delivered-meal progress bridge |

Feature migrations extend these contracts additively. They must not weaken
their ownership checks or rewrite historical migration files.

## Change registration

| Timestamp | Owner | Purpose | RLS/RPC tests | Rollback/disable path | Status |
|---|---|---|---|---|---|
| `20260719180000` | Agent 5 | Outdoor activity experience and offline-safe activity upload | `src/lib/outdoor-activity.test.ts`, release fixtures | `phase1-outdoor-recording` off | Remote applied; release-gate approved |
| `20260719130000` | Agent 6 | Prescribed versus actual workout sets | Workout sequence and set-prescription tests | `phase1-training-enhancements` off | Remote applied; release-gate approved |
| `20260719140000` | Agent 6 | Structured workout set definitions | Workout sequence and set-prescription tests | `phase1-training-enhancements` off | Remote applied; release-gate approved |
| `20260719150000` | Agent 6 | Guided workout session experience | Guided workout and workout history tests | `phase1-training-enhancements` off | Remote applied; release-gate approved |
| `20260719160000` | Agent 6 | Multidimensional workout progression | Workout progression tests | `phase1-training-enhancements` off | Remote applied; release-gate approved |
| `20260719170000` | Agent 6 | Workout templates and scheduling | Workout sequence tests | `phase1-training-enhancements` off | Remote applied; release-gate approved |
| `20260720080000` | Agent 1 | Order consumption lifecycle | `src/lib/order-consumption.test.ts`, `src/test/order-consumption-security.test.ts`, fresh-schema pgTAP | `phase1-consumption-lifecycle` off | Remote applied; release-gate approved |
| `20260720090000` | Agent 2 | Meal nutrition completeness, provenance, micronutrients, and missing-data queue | `src/lib/nutrition-quality.test.ts`, release fixtures | Keep UI behind `phase1-nutrition-quality` and dependent flags | Remote applied; release-gate approved |
| `20260720100000` | Agent 3 | Explainable meal ranking audit table and bounded RPC | `src/test/meal-ranking-audit-security.test.ts`, recommendation tests | Keep ranking v2 behind its rollout flag | Remote applied; release-gate approved |
| `20260720110000` | Agent 4 | Wearable data normalization and provider precedence | `src/lib/wearable-normalization.test.ts`, health fixtures | `phase1-wearable-normalization` off | Remote applied; release-gate approved |
| `20260720130000` | Agent 6 | Strength equipment profiles | `src/lib/strength-training.test.ts` | `phase1-training-enhancements` off | Remote applied; release-gate approved |
| `20260720140000` | Agent 7 | Flexible adherence and reward compensation | `src/lib/adherence.test.ts`, `src/test/adherence-challenge-security.test.ts`, reward fixture | `phase1-cooperative-challenges` off | Remote applied; release-gate approved |
| `20260720150000` | Agent 8 | Private health context, consent, export, and deletion | `src/lib/health-context.test.ts`, `src/test/health-context-security.test.ts` | `phase1-health-context` off; delete dataset RPC | Remote applied; release-gate approved |
| `20260720160000` | Agent 9 | Domain notification event observability and unified mapping | `src/lib/notification-contracts.test.ts`, fresh-schema pgTAP | Notification feature flags off | Remote applied; release-gate approved |
| `20260720161000` | Agent 9 | Notification preference baseline compatibility | `src/lib/notification-contracts.test.ts` | Keep notification dispatch flags off | Remote applied; release-gate approved |
| `20260720170000` | Agent 0 | Consumption ADR alignment: immutable snapshots, normalized portion, and semantic identity | `src/test/order-consumption-security.test.ts`, fresh-schema pgTAP | `phase1-consumption-lifecycle` off | Remote applied; release-gate approved |
| `20260720172000` | Agent 0 | Initial phase-one rollout activation | Contract and feature-flag tests | Superseded by consent-aware ranking activation below | Remote applied; superseded |
| `20260720173000` | Agent 0 | Prioritize rollover meal usage | Consumption and scheduling integration tests | Disable rollover preference | Remote applied; release-gate approved |
| `20260720180000` | Agent 0 | Secure Google Fit credential lifecycle and disconnect revocation | Health sync and disconnect tests | Disconnect provider and revoke server credential | Remote alias `20260719210634`; release-gate approved |
| `20260720181000` | Agent 0 | Challenge XP reversal and wallet reward settlement | Adherence, challenge security, and reward replay tests | Append compensating ledger entries | Remote alias `20260719212050`; release-gate approved |
| `20260720182000` | Agent 0 | Consent-aware health context ranking v2.1 activation | Health context and recommendation tests | Disable health context or ranking v2 | Remote alias `20260719213036`; release-gate approved |
| `20260720183000` | Agent 0 / Agent 9 | Domain event to preference, quiet-hours, translated delivery, retry, and dead-letter pipeline | Notification tests and fresh-schema pgTAP | Disable cron/notification flags; retain outbox | Remote alias `20260719214408`; release-gate approved |
| `20260720184000` | Agent 0 | Phase-one security-advisor hardening | Supabase advisor and fresh-schema pgTAP | Forward-only grants/view/function hardening | Remote alias `20260719225647`; release-gate approved |
| `20260720185000` | Separate workstream | Daily performance program | `src/test/daily-performance-security.test.ts` | Disable program entry points; preserve private facts | Verification pending |
| `20260720190000` | Separate workstream | Health support program foundation | `src/lib/health-program-security.test.ts` | Keep catalog unpublished and enrollment unavailable | Verification pending |
| `20260720190500` | Separate workstream | Health program catalog preview | `src/lib/health-program-security.test.ts` | Remove preview exposure | Verification pending |
| `20260720191000` | Separate workstream | Health program review gates | `src/lib/health-program-security.test.ts` | Keep versions unpublished | Verification pending |
| `20260720191500` | Separate workstream | Health program user deletion | `src/lib/health-program-security.test.ts` | Forward-only privacy RPC hardening | Verification pending |
| `20260720192000` | Separate workstream | Health program onboarding baseline | `src/lib/health-program-security.test.ts` | Disable onboarding activation | Verification pending |
| `20260720192500` | Integration closure | Restore health-context default-off behavior | `src/test/health-context-security.test.ts` | Keep `phase1-health-context` off | Remote alias `20260720014456`; release-gate approved |
| `20260720192600` | Integration closure | Notification privacy hardening | `supabase/tests/phase-one-notification-privacy.sql` | Disable dispatch; retain private outbox | Remote alias `20260720014517`; release-gate approved |
| `20260720192700` | Separate workstream | Harden health-program RPC grants | `src/lib/health-program-security.test.ts` | Forward-only grant hardening | Verification pending |
| `20260720193000` | Integration closure | Complete wearable provenance and precedence | `supabase/tests/phase-one-wearable.sql` | Disable normalized ingestion | Remote alias `20260720014538`; release-gate approved |
| `20260720194000` | Integration closure | Immutable committed-order nutrition | `supabase/tests/phase-one-order-consumption.sql` | Preserve committed snapshots; disable new UI | Remote alias `20260720014608`; release-gate approved |
| `20260720195000` | Integration closure | Complete nutrition-quality contract | `supabase/tests/phase-one-nutrition-quality.sql` | Disable micronutrient surfaces | Remote alias `20260720014628`; release-gate approved |
| `20260720200000` | Separate workstream | Meal-response engine foundation | `src/test/meal-response-engine-foundation.test.ts` | Disable meal-response entry points | Verification pending |
| `20260720201000` | Separate workstream | Unified manual meal consumption | `src/test/manual-meal-consumption-v3.test.ts` | Restore legacy manual logging route | Verification pending |
| `20260720201200` | Separate workstream | Secure wearable ingest execution | `src/test/secure-wearable-ingest-execution.test.ts` | Disable wearable ingest | Verification pending |
| `20260720201500` | Separate workstream | Coach-program consumption | `src/test/coach-program-consumption.test.ts` | Disable coach-program consumption entry point | Verification pending |
| `20260720202000` | Separate workstream | Meal-response notifications | `src/test/meal-response-notifications.test.ts` | Disable notification mapping and dispatch | Verification pending |
| `20260720202500` | Separate workstream | Meal-response N-of-1 experiments | `src/test/meal-response-n-of-1-migration.test.ts` | Disable experiment enrollment and assignment | Verification pending |
| `20260720203000` | Separate workstream | Meal-response privacy lifecycle | `src/test/meal-response-privacy-lifecycle.test.ts` | Disable collection; retain export/deletion controls | Verification pending |
| `20260720203500` | Separate workstream | Meal-response model governance | `src/test/meal-response-model-governance.test.ts` | Disable model-backed estimates | Verification pending |
| `20260720204000` | Separate workstream | Meal-response experiment hardening | `src/lib/meal-response-experiments.test.ts` and `src/test/meal-response-n-of-1-migration.test.ts` | Disable experiment enrollment and assignment | Verification pending |
| `20260720204500` | Separate workstream | Auto-link meal-response experiments | `src/lib/meal-response-experiments.test.ts` and `src/test/meal-response-n-of-1-migration.test.ts` | Disable experiment enrollment and assignment | Verification pending |
| `20260720205000` | Separate workstream | Meal-response advisor hardening | Supabase security advisor | Forward-only RLS and grant hardening | Verification pending |
| `20260720205500` | Separate workstream | Single open meal-response experiment | `src/test/meal-response-experiment-hardening.test.ts` | Disable experiment enrollment and assignment | Verification pending |
| `20260720205600` | Integration closure | Harden reward-settlement permissions | `supabase/tests/phase-one-reward-settlement.sql` | Keep internal settlement functions restricted to `service_role`; compensate through ledger RPCs | Remote alias `20260720014648`; release-gate approved |
| `20260720205700` | Integration closure | Owner-only health-context consent history read access | `supabase/tests/phase-one-health-context.sql` | Revoke authenticated table access and drop the owner-read policy | Remote alias `20260720014718`; release-gate approved |
| `20260720205800` | Integration closure | Post-deploy advisor hardening for phase-one views and RPC grants | Phase-one pgTAP suite and Supabase security advisor | Restore only the minimum role-specific grants required by a failing workflow | Remote alias `20260720015722`; release-gate approved |
| `20260720210000` | Competitive gap closure | Server-authoritative safe meal substitution, immutable audit and direct-write guard | `src/test/safe-smart-substitution.test.ts`; schedule integration tests | Hide substitution entry point; preserve audit and direct-write guard | Remote applied; focused tests and typecheck passed |
| `20260720220000` | Competitive gap closure | Nutrio Verified requests, version-bound claims, AAL2 review, sampling, suspension and safe public view | `src/test/nutrio-verified-contract.test.ts`; fresh-schema pgTAP pending | Hide verification surfaces; preserve audit and invalidation trigger | Remote applied; focused tests, lint, typecheck and build passed |
| `20260720221000` | Competitive gap closure | Privacy-minimized customer, partner and AAL2 admin portal contracts | `src/test/nutrio-verified-contract.test.ts` | Revoke portal RPC execution while retaining verification records | Remote applied; focused tests, lint, typecheck and build passed |
| `20260720222000` | Competitive gap closure | Owner-scoped needs-info resubmission without duplicate requests | `src/test/nutrio-verified-contract.test.ts` | Revoke resubmission RPC; partners retain read-only status | Remote applied; focused tests, lint, typecheck and build passed |
| `20260720230000` | Competitive gap closure | Adaptive Week v2: robust trend, data-quality and health holds, bounded target changes, stale-proposal rejection | `src/test/adaptive-week-hardening.test.ts`, `src/hooks/useWeeklyAICheckIn.test.tsx`, `supabase/tests/adaptive-week-hardening.sql` | Revoke create/resolve RPC execution; existing targets and audit history remain intact | Remote applied; focused tests and typecheck passed; pgTAP/device gates pending |
| `20260720240000` | Competitive gap closure | Verified Care Team credentials, scoped multi-professional assignments, secure notes/messages/sessions, plan review, SLA and escalation | `src/test/care-team-foundation.test.ts`, `supabase/tests/care-team-foundation.sql` | Hide care entry points and revoke mutation RPCs; retain assignments and audit history read-only | Remote alias `20260720123504`; 28/28 linked pgTAP assertions passed |
| `20260720241000` | Competitive gap closure | Defense-in-depth AAL2 review trigger and verified-professional notification policy | `supabase/tests/care-team-foundation.sql` | Restore prior notification policy only if verified care messaging is disabled | Remote alias `20260720124250`; linked pgTAP passed |
| `20260720242000` | Competitive gap closure | Participant-scoped Care Team workspace projection for reviews and escalations | `src/test/care-team-foundation.test.ts`; participant RLS fixture | Revoke workspace RPC; retain durable review and escalation records | Remote alias `20260720124629`; linked verification passed |
| `20260720243000` | Competitive gap closure | Bilingual behavior lessons, reflection, intervention outcomes, preference controls, quiet hours and prompt budgets | `src/test/behavior-support.test.ts`; owner/cross-user pgTAP pending | Disable behavior support and revoke RPCs; retain outcome history | Remote applied; focused tests and typecheck passed |
| `20260720244000` | Competitive gap closure | Branch supplier-quality incidents, evidence snapshots and bounded quality-aware rerouting | `src/test/supplier-quality-routing.test.ts`; constrained routing fixture pending | Revoke incident/quality RPCs and restore the base router name | Remote applied; focused tests and typecheck passed |
| `20260720245000` | Competitive gap closure | AAL2-admin execution grant for supplier-quality refresh | Authenticated AAL1/AAL2 negative/positive fixture pending | Revoke refresh from `authenticated`; service refresh remains available | Remote applied; first AAL2 refresh pending |
| `20260720246000` | Competitive gap closure | Authorized family profiles, minor safeguards, independent goals/allergies/allowance and atomic beneficiary scheduling | `src/test/family-profiles-security.test.ts`; `supabase/tests/family-profiles-and-safeguards.sql`; device fixtures pending | Hide family scheduling selector; revoke family RPCs; preserve consent history | Remote applied; focused tests and linked pgTAP passed |
| `20260720247000` | Competitive gap closure | Privacy-isolated corporate eligibility, consent, atomic sponsored scheduling, aggregate reporting and sponsor invoices | `src/test/corporate-benefits-security.test.ts`; `supabase/tests/corporate-benefits-foundation.sql`; device/AAL2 fixtures pending | Hide workplace benefit/admin route; revoke corporate RPCs; preserve invoices and benefit ledger | Remote applied; focused tests and linked pgTAP passed |
| `20260720248000` | Competitive gap closure | Exact subscription allocation, replay-safe cancellation/refund and guarded delivery rerouting/repricing | `src/test/secure-subscription-schedule-operations.test.ts`; `supabase/tests/subscription-schedule-operations.sql`; web/APK E2E pending | Re-enable legacy RPC names only behind a maintenance window; preserve operation ledger and allocation column | Remote applied; focused tests and linked pgTAP passed; web/APK E2E pending |
| `20260720249000` | Competitive gap closure | Restrict Nutrio Verified projection to scoped RPCs and enforce invoker-security semantics | `supabase/tests/nutrio-verified-view-security.sql`; Supabase security advisor | Regrant direct view read only if the scoped public RPC is unavailable | Remote applied through an isolated CLI workdir; dry run selected only `20260720249000`; remote ledger confirmed; pgTAP and advisor rerun pending MCP OAuth |

`Release-gate approved` means the upgraded linked project and a clean schema
baseline passed the Agent 10 database gate, focused and full tests, typecheck,
lint, production build, and mobile/security E2E checks for this release candidate.

## Rules

1. One semantic schema change per migration; include its indexes, policies,
   grants, comments, and deterministic backfill where inseparable.
2. New user-owned tables enable RLS in the same migration and receive positive
   and negative policy tests.
3. Security-definer functions set `search_path`, validate `auth.uid()`, and do
   not trust caller-supplied ownership.
4. Feature branches are additive. Renames, drops, enum value replacement, and
   destructive cleanup require a later Agent 0 migration.
5. Shared enums are owned by Agent 0. Workstreams submit required logical
   values in their contract note before implementation.
6. Agents do not regenerate `src/integrations/supabase/types.ts`. Agent 0 owns
   regeneration from the final integrated deployed schema; this was completed
   for the phase-one release candidate.
7. Every migration passes both upgraded-database verification and a clean
   phase-one schema-baseline test.
8. No migration may be merged while its owning feature lacks a default-off
   flag and tested rollback action.
