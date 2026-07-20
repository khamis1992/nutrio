# QA, Security, and Release Gate Review

Date: 2026-07-19

Owner: Agent 10

## Scope

This review turns the Agent 10 section of `docs/plans/2026-07-19-nutrio-phase-one-multi-agent-plan.md` into a release gate for phase one. The goal is not to redesign the feature work owned by other agents. The goal is to stop individually correct branches from merging into a broken cross-system customer experience.

## Nutrio Baseline

Nutrio already has a useful testing foundation:

- Vitest unit and integration tests run through `npm run test:run`.
- Playwright system tests exist under `e2e/system`.
- Security coverage exists in `src/test/security-release-attestation.test.ts`.
- Phase-one research already identifies cross-service risks in order consumption, rewards, wearables, and meal ranking.

The missing piece is a stable, shared release matrix that all phase-one work can target before merge.

## Key Risks Agent 10 Must Catch

1. Replay and concurrency bugs that duplicate nutrition, XP, wallet credit, or order status.
2. RLS regressions that let customers, partners, drivers, or admins mutate data outside their role.
3. Health-provider ambiguity when Apple Health and Google Fit report overlapping facts.
4. Historical nutrition drift when a partner edits a meal after checkout.
5. Mobile UX failures in Arabic, RTL, small viewports, or interrupted/offline flows.
6. Feature rollout risk when new contracts cannot be rolled back safely.

## Phase-One Gate Artifact

`src/lib/phase-one-release-gate.ts` defines the mandatory scenario matrix. It includes:

- scenario id
- scenario title
- quality areas covered
- expected fixture path
- required checks
- release owner

`src/test/phase-one-release-gate.test.ts` verifies that every mandatory scenario is present and that release commands exist for unit, type, lint, full Vitest, mobile E2E, and security E2E gates.

## Mandatory Scenario Matrix

The release gate must cover:

- Duplicate delivery webhook
- Repeated consumption tap
- Meal changed after checkout
- Substitute meal
- Cancelled/refunded order
- Two wearable sources
- Timezone/DST boundary
- Stale health data
- Revoked provider
- Offline activity crash recovery
- Reward replay
- Arabic RTL overflow

## Data and Privacy Notes

- Health samples must not be sent to analytics as raw payloads.
- Rewards and leaderboard data must not expose private health details.
- Provider revocation must disable future sync and expose reconnect/deletion behavior.
- Order and meal snapshots must be immutable for reports and disputes.

## Release Decision

Phase one should not ship unless:

- the release matrix test passes,
- changed migrations and RLS policies are reviewed,
- focused feature tests pass for modified areas,
- `npm run typecheck` passes,
- `npm run lint` passes,
- the relevant mobile/security E2E tests pass or have a documented temporary exception.

## License Notes

No external product implementation is copied here. This review is based on Nutrio's local plan, codebase, and existing test structure.

## Behavior Intentionally Not Copied

Agent 10 should not import competitor flows or wearable-provider UX as-is. The gate only validates Nutrio's own contracts, privacy rules, and release safety.
