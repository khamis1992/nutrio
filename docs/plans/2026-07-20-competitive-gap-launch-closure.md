# Nutrio Competitive Gap Launch Closure

Status: active  
Owner: product and engineering  
Source: `docs/reports/nutrio-competitive-strategy-report-ar.docx`

## Launch definition

Nutrio is launchable when the customer can move from a safe recommendation to
an available scheduled meal, confirm actual consumption, receive a bounded
weekly adjustment, and obtain human help without a safety, payment, privacy, or
operational bypass. A screen or database table alone does not close a gap.

## Workstreams

| Priority | Workstream | Acceptance evidence | Status |
|---|---|---|---|
| P0 | Safe Smart Substitute | Server filters allergies, diet, medicine, availability and branch capacity; atomic idempotent swap; audit event; negative RLS tests; mobile flow | Code complete; device gate pending |
| P0 | Nutrio Verified | Versioned recipe and portion; source/reviewer/tier/expiry; partner review workflow; customer badge and details; sampling and suspension | Code complete; device/pgTAP gate pending |
| P0 | Subscription operations | Swap, skip, pause, cancel, address, slot, credit and refund journeys pass end-to-end without manual database repair | Code/database gates passed; device gate pending |
| P1 | Adaptive Week | Smoothed trend and data-quality gate; bounded changes; health-context stops; user approval; version history and explanation | Code complete; device/pgTAP gate pending |
| P1 | Care Team | Licensed-role verification; assignment; secure notes/messages; plan approval; SLA and escalation; auditable scope boundaries | Code and remote schema complete; device/clean-schema gate pending |
| P1 | Arabic behavior layer | Reviewed micro-lessons; barrier reflection; contextual action; notification budget; preference controls; outcome experiment | Code and remote schema complete; device gate pending |
| P1 | Performance journey | Workout directive, recovery meal, delivery timing and coach instruction appear as one executable journey | Code complete; device gate pending |
| P1 | GLP-1 support | Legal, licensed dietitian, medical wording and DPIA gates signed; security/mobile pilot passes; protocol published | External gates pending |
| P2 | Family | Independent profiles, allergies, goals, schedules and consent; shared billing and allowance; minor safeguards | Code/database gates passed; device gate pending |
| P2 | Corporate | Organization, eligibility, sponsor billing, privacy isolation and aggregate reports | Code/database gates passed; AAL2/device gate pending |
| P2 | Meal Response / CGM | Native/direct provider path, episode coverage, privacy lifecycle, model governance and release verification | Partial; verification pending |
| P2 | Supplier quality | Branch SLA, complaint signals, nutrition variance and substitution outcomes affect supplier ranking | Code and remote schema complete; first AAL2 snapshot/device gate pending |
| P3 | Voice logging and fasting | Accessible voice capture and optional fasting journey without distracting from prepared meals | Deferred |

## Release gates

- [ ] All new user-owned tables have owner-positive and cross-user-negative RLS tests.
- [ ] Safety decisions are server-authoritative and cannot be bypassed by direct REST writes.
- [ ] Payment, credit, refund and wallet operations are atomic and replay-safe.
- [ ] Sensitive health payloads are absent from analytics, logs and push notifications.
- [ ] Arabic and English pass 375px and large-text mobile checks.
- [ ] Android safe areas, keyboard, back behavior and dock navigation pass on a real APK.
- [x] Android SDK setup, Capacitor sync, diagnostic APK build, clean-cache Gradle
  provenance regeneration, and strict release APK/AAB assembly pass. Production
  signing and two-device evidence remain part of the unchecked device gate.
- [x] Authenticated mobile Playwright checks pass for Arabic/English responsive,
  semantic, touch-target, performance, and offline-checkpoint coverage.
- [ ] Six-portal launch Playwright passes after adding coach credentials, admin
  TOTP, and valid dedicated launch accounts.
- [ ] Database migrations pass upgraded-project and clean-schema verification.
  Local execution reached the Supabase startup step on 2026-07-20 but Windows
  `WslService` is disabled and requires an Administrator session before Docker
  can start; no SQL assertion failed or ran in that attempt.
- [x] Lint (zero errors), typecheck, contracts, production build, and the full
  bounded-worker Vitest suite pass (183 files and 1,014 tests passed; 4
  integration tests skipped and 5 provider/concurrency cases remain todo).
- [ ] Run the 4 real-Supabase integration cases and 5 SADAD/subscription
  concurrency cases in the configured provider sandbox.
- [ ] Operational owners, incident route, rollback flag and dashboard exist for each launch feature.
- [x] Added a fail-closed, machine-readable launch readiness gate covering
  Supabase, real Android devices, all six portals, SADAD concurrency, GLP-1
  governance, Meal Response validation, supplier operations, and sensitive
  default-off feature flags.

## Current execution

### Safe Smart Substitute

- [x] Added server-owned candidate and substitution RPCs.
- [x] Added dietary, allergy, medicine, availability and branch-capacity gates.
- [x] Added idempotent append-only substitution audit events.
- [x] Blocked direct client changes to `meal_schedules.meal_id`.
- [x] Prevented automatic swaps when paid add-ons or meal-specific customization exist.
- [x] Replaced client-side similarity selection with server candidates.
- [x] Apply migration to the linked database using an isolated migration-history workdir.
- [ ] Replay migration against the clean schema baseline.
- [x] Add database positive/negative fixtures with two users and constrained branches.
- [ ] Pass mobile interaction and stale-availability retry tests.

### Nutrio Verified

- [x] Added version-bound verification requests, claims, samples, and audit events.
- [x] Required complete nutrition, source references, and independent evidence for stronger tiers.
- [x] Added AAL2 admin approval, needs-info, rejection, suspension, and sampling RPCs.
- [x] Automatically superseded current claims and open requests when nutrition changes.
- [x] Added privacy-safe customer claim RPC and expandable meal-detail badge.
- [x] Added partner request/resubmission workflow and per-meal status.
- [x] Added admin review and sampling operations to Nutrition Quality.
- [x] Applied migrations `20260720220000` through `20260720222000` to linked Supabase.
- [x] Passed focused Vitest, lint, typecheck, and production build.
- [ ] Execute fresh-schema pgTAP once Docker/CI database is available.
- [ ] Pass authenticated customer, partner, and AAL2 admin mobile visual checks.

### Subscription operations

- [x] Confirmed customer, admin, and direct-order cancellation routes use guarded RPCs rather than raw status writes.
- [x] Bound newly created schedules to the exact subscription that supplied quota while preserving the existing atomic scheduling contract.
- [x] Replaced direct delivery time/address updates with an owner-bound RPC that validates order state, delivery progress, address ownership, branch routing, and delivery repricing.
- [x] Made scheduled-meal cancellation idempotent and auditable with one cancellation event per schedule.
- [x] Restored monthly, weekly, and snack quota only on the exact subscription and original allocation period.
- [x] Removed the unsafe one-hour wallet-transaction heuristic; purchased capacity is not silently destroyed on cancellation.
- [x] Made add-on refunds replay-safe with an explicit schedule refund reference.
- [x] Reverse corporate benefit consumption and preserve its original allowance period when a sponsored schedule is cancelled.
- [x] Aligned cancellation with the canonical delivery-job lifecycle and preserved already-paid partner earnings for financial reconciliation.
- [x] Required a real AAL2 claim as well as the admin role for administrative cancellation.
- [x] Revoked direct authenticated insert, update, and delete privileges on `meal_schedules`.
- [x] Applied `20260720248000_secure_subscription_schedule_operations.sql` to linked Supabase.
- [x] Ran `supabase/tests/subscription-schedule-operations.sql` on the linked project.
- [ ] Run the complete clean-schema migration replay in CI.
- [ ] Pass customer/admin cancellation, delivery edit/reprice, snack quota, add-on refund, offline replay, and real-APK journeys.

### Adaptive Week

- [x] Replaced first-versus-last weight comparison with two-window medians and outlier removal.
- [x] Required four logged food days, four weight samples, two samples per trend window, and a 14-day span before changing targets.
- [x] Added explicit `change`, `maintain`, and `hold` decisions with reason codes and durable evidence.
- [x] Added low-energy, low-recovery, high-hunger, opted-in health-context, active-program, and unresolved-safety-event holds.
- [x] Capped changes to 5%, 100 kcal down, or 150 kcal up and prevented protein reductions.
- [x] Bound every proposal to the active goal ID, goal version, target snapshot, fingerprint, algorithm version, and expiry.
- [x] Recheck goal version, targets, expiry, fingerprint, and health safety while resolving under a database lock.
- [x] Removed the legacy browser-side target mutation path.
- [x] Applied migration `20260720230000_harden_adaptive_week.sql` to linked Supabase.
- [x] Passed focused Vitest and TypeScript checks.
- [ ] Execute `supabase/tests/adaptive-week-hardening.sql` against a fresh CI database.
- [ ] Pass authenticated Arabic/English 375px and real-APK approval, hold, and stale-review flows.

### Care Team

- [x] Added credential applications for dietitian, fitness-coach, and wellness roles with expiry, jurisdiction, documented scope, allowed actions, and prohibited medical actions.
- [x] Added AAL2 admin review, verified-directory projection, and accepting-client state.
- [x] Replaced single-coach exclusivity with one active professional per assignment type, allowing a dietitian and fitness coach on the same client team.
- [x] Added explicit consent scopes for macros, weight, hydration, meal adherence, workouts, health context, labs, meal response, and messages.
- [x] Replaced broad coach RLS with verified, active, consent-scoped access for measurements, hydration, meals, progress, goals, streaks, and workout records.
- [x] Made assignment, invite, note, session, plan-review, and escalation mutations RPC-only and auditable.
- [x] Added response SLA tracking, overdue escalation creation, generic push content, immutable note correction, and participant-scoped workspace projection.
- [x] Replaced unverified coach discovery with the verified professional directory and routed application, approval, request, invite, acceptance, notes, and sessions through guarded RPCs.
- [x] Applied Care Team foundation and hardening migrations to linked Supabase (remote aliases `20260720123504`, `20260720124250`, and `20260720124629`).
- [x] Restored the previously missing central admin-MFA migration on linked Supabase (remote alias `20260720124213`) and replaced remaining direct-role admin policies.
- [x] Passed 28/28 linked-database pgTAP assertions in a rollback transaction, focused Vitest, TypeScript, and lint with no errors.
- [ ] Replay the migration chain against a clean schema when Docker/CI Postgres is available.
- [ ] Pass authenticated client, professional, and AAL2 admin flows at 375px and on a real APK.

### Arabic behavior layer

- [x] Added six bilingual low-risk micro-lessons with explicit editorial review provenance and publication guards.
- [x] Added owner-bound barrier reflections, contextual intervention assignments, outcome events, and experiment variants.
- [x] Enforced user-controlled enablement, quiet hours, allowed contexts, and daily/weekly prompt budgets on the server.
- [x] Integrated one compact action/reflection unit inside the existing daily performance decision instead of adding another dashboard card.
- [x] Added settings controls for enablement, frequency, and quiet hours.
- [x] Applied `20260720243000_arabic_behavior_support.sql` to linked Supabase and passed focused contract tests and TypeScript.
- [ ] Pass Arabic/English 375px, large-text, quiet-hours, and real-APK checks.

### Performance journey

- [x] Unified workout mode, nutrition guardrails, safety-ranked meal, coach direction, and delivery step in the daily decision.
- [x] Open the recommended meal directly in schedule mode and show the actual delivery slot when already planned today.
- [x] Preserve the workout as the primary action on training days while keeping meal scheduling available in the same surface.
- [ ] Pass authenticated workout-to-meal-to-delivery Playwright and real-APK flows.

### Supplier quality

- [x] Added order-bound supplier incidents so users cannot submit an unverified branch complaint.
- [x] Added 90-day branch snapshots combining on-time delivery, preparation SLA, verified reviews, weighted incidents, and nutrition sample outcomes.
- [x] Wrapped the existing capacity/distance router and applied a bounded quality adjustment only among already eligible branches.
- [x] Added an AAL2 admin operations panel for recalculation, branch status, evidence summaries, and routing impact.
- [x] Applied `20260720244000_supplier_quality_routing.sql` and `20260720245000_supplier_quality_admin_refresh.sql` to linked Supabase.
- [x] Passed focused contract tests and TypeScript.
- [ ] Run the first 90-day snapshot from an authenticated AAL2 admin session; service-role impersonation was intentionally rejected.
- [ ] Pass partner/admin mobile checks and verify routing outcomes against constrained branch fixtures.

### Family

- [x] Replaced direct family-profile CRUD with owner-bound RPCs and forced RLS.
- [x] Added explicit adult authorization or guardian consent, immutable consent events, and minor relationship safeguards.
- [x] Added independent allergies, nutrition goals, hydration target, and monthly meal allowance per profile.
- [x] Added a beneficiary selector to the meal scheduling sheet without duplicating the scheduling journey.
- [x] Made schedule creation, allergen checking, allowance enforcement, and family assignment one idempotent database transaction.
- [x] Prevented request replay from consuming a second allowance or changing the original beneficiary.
- [x] Closed the legacy post-scheduling assignment path so it also enforces consent, state, date, allergy, and monthly allowance rules.
- [x] Added a pgTAP contract covering tables, RPCs, direct-write denial, and anonymous denial.
- [x] Applied `20260720246000_family_profiles_and_safeguards.sql` to linked Supabase.
- [x] Passed focused Vitest and linked-project pgTAP contract.
- [ ] Pass 375px, large-text, allergy-conflict, exhausted-allowance, offline-replay, and real-APK flows.

### Corporate benefits

- [x] Added privacy-isolated organizations, sponsor roles, employee eligibility, consent, benefit events, and immutable issued invoices.
- [x] Added an opt-in workplace benefit inside the existing meal scheduling sheet and disabled it for family beneficiaries.
- [x] Made scheduling and benefit redemption one idempotent transaction with a locked monthly allowance.
- [x] Added an AAL2 admin operations page for contracts, eligibility, allowances, and invoice drafts.
- [x] Limited sponsor output to aggregate utilization and separated billing totals from consented engagement totals.
- [x] Required AAL2 for both Nutrio administrators and sponsor administrators.
- [x] Bound every redemption and reversal to its original allowance period and reject idempotent replay through a different membership.
- [x] Reverse sponsored allowance atomically when the associated meal schedule is cancelled.
- [x] Added a pgTAP contract covering privacy isolation, RPC ownership, and anonymous denial.
- [x] Applied `20260720247000_corporate_benefits_foundation.sql` to linked Supabase.
- [x] Passed focused Vitest and linked-project pgTAP contract.
- [ ] Run authenticated AAL1/AAL2 and invoice replay fixtures.
- [ ] Pass employee consent, sponsored scheduling, allowance exhaustion, admin operations, and real-APK flows.

### Meal Response / CGM

- [x] Added consent and preference controls, meal-response episodes, evidence tiers, and explicit abstention states.
- [x] Added N-of-1 experiment enrollment, privacy export/deletion, single-open-experiment hardening, and model governance.
- [x] Added automatic episode/experiment linking without exposing raw health payloads to analytics or push notifications.
- [ ] Complete direct provider device validation and document provider-specific provenance and disconnect behavior.
- [ ] Run pilot calibration before enabling any model-backed outcome claim; estimates must remain abstained when coverage is insufficient.
- [ ] Pass authenticated privacy lifecycle, provider reconnect, delayed sensor data, and real-device verification.

## External dependencies

GLP-1 publication cannot be completed by engineering alone. The program remains
draft until genuine signed evidence is received for Qatar legal review,
DHP-licensed dietitian review, medical safety wording, and the data-protection
impact assessment. Engineering must not fabricate reviewer identities or mark
these gates complete.
