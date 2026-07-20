# Phase One Merge Checklist

## Contract gate

- [ ] Workstream research review exists and covers sources, gap, minimum scope,
      privacy, license, and behavior not copied.
- [ ] Agent 0 accepted the contract note before shared schema/type work.
- [ ] Implementation conforms to all applicable ADRs without redefining them.
- [ ] Migration filenames fall inside the owner's range and are registered.
- [ ] Shared enum, generated type, route, and translation changes are deferred
      to Agent 0.

## Implementation gate

- [ ] Feature is independently default-off in the typed flag registry.
- [ ] Flag-off behavior preserves the current production path.
- [ ] Schema changes are additive and RLS is enabled with positive/negative tests.
- [ ] RPCs validate ownership and are safe under retry and concurrency.
- [ ] Domain events use ADR 0005; no one-off push pipeline was added.
- [ ] Missing nutrition is distinct from zero and historical reads use snapshots.
- [ ] Health or journal detail is absent from analytics/community/push payloads.

## Agent handoff

- [ ] Focused unit/integration/RPC/RLS tests pass.
- [x] `npm run lint` passes. Evidence 2026-07-20: exit 0, 0 errors, 122 warnings.
- [x] `npm run typecheck` passes. Evidence 2026-07-20: exit 0.
- [ ] Migration applies to fresh and upgraded fixtures.
- [ ] Arabic and English key manifest is attached.
- [ ] Rollback action and monitoring evidence are attached.
- [ ] Diff contains no central route, generated type, shared enum, or unrelated
      formatting changes.

## Wave 4 integration (Agent 0)

- [ ] Merge in dependency order: Agent 1 -> Agent 2 -> Agent 4 -> Agent 9 ->
      Agent 3 -> Agent 5 -> Agent 6 -> Agent 7 -> Agent 8.
- [ ] Resolve route requests centrally with valid flag-off fallbacks.
- [ ] Apply English and Arabic translation manifests together.
- [ ] Run migration collision and contract validation.
- [ ] Deploy integrated schema to the verification environment.
- [ ] Regenerate Supabase types exactly once and verify no unexplained diff.
- [ ] Agent 10 passes replay, concurrency, RLS, privacy, RTL, mobile, offline,
      performance, and per-flag rollback matrices.
- [ ] Record shipped, flagged, and deferred behavior in the release runbook.

## Integration closure intake

- [ ] Register and replay closure migrations `20260720185000` through
      `20260720204500`, including renamed grant hardening migration
      `20260720192700_harden_health_program_rpc_grants.sql`.
- [ ] Run health-program closure coverage in
      `src/lib/health-program-security.test.ts`.
- [ ] Run daily performance, meal response, manual consumption, secure wearable
      ingest, coach consumption, and notification closure tests under `src/test/`.
- [ ] Run every discovered `supabase/tests/phase-one-*.sql`, including
      `phase-one-nutrition-quality.sql`, on both fresh and upgraded replay paths.
- [ ] Confirm the fresh replay reaches pgTAP without relying on the synthesized
      `supabase/baseline/phase-one-schema.sql` dump.
- [ ] Confirm the upgraded pre-phase-one replay applies every phase-one and
      closure migration before pgTAP.
- [ ] Confirm the feature-flag validator passes after all shared feature code is
      integrated.
- [ ] Record exact command counts, failures, skips, and environment in the Agent
      10 release runbook.

## Current Agent 10 evidence

- [ ] Database gate passes. Current result: both modes applied all 20
      registry-owned closure migrations; 3/7 pgTAP files passed and 4/7 failed
      in each mode.
- [ ] Authenticated mobile/security E2E passes. Current Chromium result: 14
      passed, 13 failed, and 2 skipped.
- [ ] Accessibility assertions pass. Current failures include missing `main`
      landmarks and unnamed controls.
- [ ] Offline recovery passes. The checkpoint rendered, but bottom navigation
      intercepted the Recover action.
- [ ] Flag rollback passes. The outdoor route did not return to the legacy
      activity surface after overrides were cleared.
- [ ] Session revocation passes. Logout did not prevent subsequent dashboard
      access in the executed browser run.
- [x] Contract validator passes. Evidence 2026-07-20: exit 0.
- [x] Focused Agent 10 gate passes. Evidence 2026-07-20: 1 file, 19 tests.
- [x] Full Vitest suite passes. Evidence 2026-07-20: 173 files passed; 957
      tests passed and 5 todo (962 total); 23.42s.
- [x] Production build passes. Evidence 2026-07-20: 6,344 modules, 49.68s.
