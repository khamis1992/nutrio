export type ReleaseGateArea =
  | "migration"
  | "rls"
  | "replay"
  | "concurrency"
  | "mobile-e2e"
  | "accessibility"
  | "performance"
  | "offline-sync"
  | "feature-flag"
  | "privacy"
  | "observability";

export type ReleaseGateScenarioId =
  | "duplicate-delivery-webhook"
  | "repeated-consumption-tap"
  | "meal-changed-after-checkout"
  | "substitute-meal"
  | "cancelled-refunded-order"
  | "two-wearable-sources"
  | "timezone-dst-boundary"
  | "stale-health-data"
  | "revoked-provider"
  | "offline-activity-crash-recovery"
  | "reward-replay"
  | "arabic-rtl-overflow";

export interface ReleaseGateScenario {
  id: ReleaseGateScenarioId;
  title: string;
  areas: ReleaseGateArea[];
  fixture: string;
  requiredChecks: string[];
  owner: "agent-10";
}

export interface ReleaseGateCommand {
  id: string;
  command: string;
  purpose: string;
}

export const PHASE_ONE_MANDATORY_SCENARIOS: ReleaseGateScenario[] = [
  {
    id: "duplicate-delivery-webhook",
    title: "Duplicate delivery webhook converges to one delivered fact",
    areas: ["replay", "concurrency", "rls", "observability"],
    fixture: "fixtures/orders/delivery-webhook-duplicate.json",
    requiredChecks: [
      "same provider event id is accepted once",
      "delivery status history remains append-only",
      "delivery alone does not add consumed nutrition",
      "unauthorized webhook mutation is rejected",
    ],
    owner: "agent-10",
  },
  {
    id: "repeated-consumption-tap",
    title: "Repeated consumption confirmation is idempotent",
    areas: ["replay", "concurrency", "rls", "mobile-e2e"],
    fixture: "fixtures/consumption/repeated-tap.json",
    requiredChecks: [
      "same idempotency key returns existing result",
      "progress totals change exactly once",
      "meal history has one applied consumption record",
      "customer can edit through the approved RPC only",
    ],
    owner: "agent-10",
  },
  {
    id: "meal-changed-after-checkout",
    title: "Historical nutrition reads the checkout snapshot",
    areas: ["migration", "replay", "mobile-e2e"],
    fixture: "fixtures/orders/meal-snapshot-changed-catalog.json",
    requiredChecks: [
      "order item snapshot keeps original calories and macros",
      "current partner menu changes do not alter historical reports",
      "AI report reads snapshot for ordered meals",
    ],
    owner: "agent-10",
  },
  {
    id: "substitute-meal",
    title: "Substituted meal links original and replacement facts",
    areas: ["migration", "rls", "mobile-e2e"],
    fixture: "fixtures/consumption/substitution.json",
    requiredChecks: [
      "original planned or ordered meal remains visible",
      "replacement has its own immutable nutrition snapshot",
      "daily totals use replacement portion only",
      "non-owner cannot substitute the meal",
    ],
    owner: "agent-10",
  },
  {
    id: "cancelled-refunded-order",
    title: "Cancelled or refunded orders do not create intake or rewards",
    areas: ["rls", "replay", "privacy", "observability"],
    fixture: "fixtures/orders/cancelled-refunded.json",
    requiredChecks: [
      "cancelled order cannot be confirmed as consumed",
      "refund event does not award XP",
      "wallet and order audit remain consistent",
      "notification CTA does not deep-link to invalid confirmation",
    ],
    owner: "agent-10",
  },
  {
    id: "two-wearable-sources",
    title: "Two wearable providers dedupe and follow precedence",
    areas: ["migration", "replay", "privacy", "observability"],
    fixture: "fixtures/health/two-provider-samples.json",
    requiredChecks: [
      "provider, external id, checksum, and quality state are stored",
      "same metric follows documented precedence",
      "daily aggregates are rebuildable",
      "analytics payload excludes raw health samples",
    ],
    owner: "agent-10",
  },
  {
    id: "timezone-dst-boundary",
    title: "Timezone and DST boundaries keep facts on the correct local day",
    areas: ["migration", "mobile-e2e", "performance"],
    fixture: "fixtures/timezone/qatar-and-dst-boundary.json",
    requiredChecks: [
      "Qatar local day matches customer timezone",
      "provider samples with timezone offsets aggregate correctly",
      "reports do not shift meals across days",
    ],
    owner: "agent-10",
  },
  {
    id: "stale-health-data",
    title: "Stale health data is disclosed and not silently trusted",
    areas: ["privacy", "mobile-e2e", "observability"],
    fixture: "fixtures/health/stale-provider-data.json",
    requiredChecks: [
      "recommendation inputs include freshness state",
      "UI explains missing or stale health data",
      "ranking does not over-credit stale activity",
    ],
    owner: "agent-10",
  },
  {
    id: "revoked-provider",
    title: "Revoked health provider stops sync and honors deletion policy",
    areas: ["rls", "privacy", "offline-sync", "observability"],
    fixture: "fixtures/health/revoked-provider.json",
    requiredChecks: [
      "sync cursor is disabled after revoke",
      "new provider payloads are rejected",
      "delete or export behavior is verified",
      "user sees reconnect state",
    ],
    owner: "agent-10",
  },
  {
    id: "offline-activity-crash-recovery",
    title: "Offline activity recording recovers after app interruption",
    areas: ["offline-sync", "mobile-e2e", "replay"],
    fixture: "fixtures/activity/offline-crash-recovery.json",
    requiredChecks: [
      "local checkpoint restores active session",
      "resumed upload dedupes external activity id",
      "calories identify calculation source",
      "route privacy remains private by default",
    ],
    owner: "agent-10",
  },
  {
    id: "reward-replay",
    title: "Reward replay cannot duplicate XP or wallet value",
    areas: ["rls", "replay", "concurrency", "observability"],
    fixture: "fixtures/rewards/replay-source-event.json",
    requiredChecks: [
      "same source event creates one ledger entry",
      "reversed source event creates compensation",
      "client cannot self-award progress or XP",
      "leaderboard excludes private health details",
    ],
    owner: "agent-10",
  },
  {
    id: "arabic-rtl-overflow",
    title: "Arabic RTL mobile flows do not overflow or hide actions",
    areas: ["mobile-e2e", "accessibility", "feature-flag"],
    fixture: "fixtures/ui/arabic-rtl-mobile.json",
    requiredChecks: [
      "Arabic copy fits 360px mobile viewport",
      "critical CTAs remain visible and tappable",
      "RTL order is correct for forms and cards",
      "screen reader labels exist for icon-only controls",
    ],
    owner: "agent-10",
  },
];

export const PHASE_ONE_RELEASE_COMMANDS: ReleaseGateCommand[] = [
  {
    id: "unit-contracts",
    command: "npm run test:run -- src/test/phase-one-release-gate.test.ts",
    purpose: "Validate the Agent 10 release matrix and mandatory scenario coverage.",
  },
  {
    id: "database-contracts",
    command: "npm run test:db:phase1",
    purpose: "Execute isolated PostgreSQL RLS, localization, retry, and dead-letter assertions.",
  },
  {
    id: "typecheck",
    command: "npm run typecheck",
    purpose: "Block releases with TypeScript or route/type integration errors.",
  },
  {
    id: "lint",
    command: "npm run lint",
    purpose: "Block releases with lint or unsafe pattern regressions.",
  },
  {
    id: "full-vitest",
    command: "npm run test:run",
    purpose: "Run the full unit and integration suite before release signoff.",
  },
  {
    id: "mobile-e2e",
    command: "npm run test:e2e -- e2e/system/mobile.spec.ts",
    purpose: "Verify mobile viewport, RTL, and critical interaction behavior.",
  },
  {
    id: "security-e2e",
    command: "npm run test:e2e -- e2e/system/security.spec.ts",
    purpose: "Verify browser-level security flows and authorization boundaries.",
  },
  {
    id: "production-readiness-evidence",
    command: "npm run launch:readiness:strict",
    purpose: "Fail closed unless every external launch owner supplied complete, reviewable evidence.",
  },
];

export function getReleaseGateScenario(id: ReleaseGateScenarioId): ReleaseGateScenario {
  const scenario = PHASE_ONE_MANDATORY_SCENARIOS.find((item) => item.id === id);
  if (!scenario) {
    throw new Error(`Unknown phase-one release scenario: ${id}`);
  }
  return scenario;
}
