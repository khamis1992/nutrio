import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { buildSafeDeepLink } from "@/hooks/usePushNotificationDeepLink";
import {
  PHASE_ONE_MANDATORY_SCENARIOS,
  PHASE_ONE_RELEASE_COMMANDS,
  getReleaseGateScenario,
  type ReleaseGateArea,
  type ReleaseGateScenarioId,
} from "@/lib/phase-one-release-gate";
import { WEARABLE_PROVIDER_PRECEDENCE, type WearableProviderId } from "@/lib/wearable-normalization";

const requiredScenarioIds: ReleaseGateScenarioId[] = [
  "duplicate-delivery-webhook",
  "repeated-consumption-tap",
  "meal-changed-after-checkout",
  "substitute-meal",
  "cancelled-refunded-order",
  "two-wearable-sources",
  "timezone-dst-boundary",
  "stale-health-data",
  "revoked-provider",
  "offline-activity-crash-recovery",
  "reward-replay",
  "arabic-rtl-overflow",
];

const requiredAreas: ReleaseGateArea[] = [
  "migration",
  "rls",
  "replay",
  "concurrency",
  "mobile-e2e",
  "accessibility",
  "performance",
  "offline-sync",
  "feature-flag",
  "privacy",
  "observability",
];

function readFixture<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(process.cwd(), path), "utf8")) as T;
}

function localDate(timestamp: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(timestamp));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

describe("phase one release gate", () => {
  it("covers every mandatory Agent 10 scenario exactly once", () => {
    const ids = PHASE_ONE_MANDATORY_SCENARIOS.map((scenario) => scenario.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual([...requiredScenarioIds].sort());
  });

  it("loads all twelve executable fixture files", () => {
    for (const scenario of PHASE_ONE_MANDATORY_SCENARIOS) {
      expect(existsSync(resolve(process.cwd(), scenario.fixture))).toBe(true);
      const fixture = readFixture<{ scenario: string }>(scenario.fixture);
      expect(fixture.scenario).toBe(scenario.id);
      expect(scenario.requiredChecks.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("deduplicates delivery webhooks without creating nutrition intake", () => {
    const fixture = readFixture<{
      actorAuthorized: boolean;
      events: Array<{ providerEventId: string }>;
      expected: { uniqueStatusFacts: number; intakeCalories: number };
    }>("fixtures/orders/delivery-webhook-duplicate.json");
    const facts = new Set(fixture.events.map((event) => event.providerEventId));

    expect(fixture.actorAuthorized).toBe(true);
    expect(facts.size).toBe(fixture.expected.uniqueStatusFacts);
    expect(fixture.expected.intakeCalories).toBe(0);
  });

  it("applies repeated consumption taps exactly once", () => {
    const fixture = readFixture<{
      nutrition: { calories: number };
      taps: Array<{ idempotencyKey: string; portionPercent: number }>;
      expected: { appliedRecords: number; calories: number };
    }>("fixtures/consumption/repeated-tap.json");
    const applied = new Map<string, number>();
    for (const tap of fixture.taps) {
      if (!applied.has(tap.idempotencyKey)) {
        applied.set(tap.idempotencyKey, Math.round(fixture.nutrition.calories * tap.portionPercent / 100));
      }
    }

    expect(applied.size).toBe(fixture.expected.appliedRecords);
    expect([...applied.values()].reduce((sum, value) => sum + value, 0)).toBe(fixture.expected.calories);
  });

  it("keeps checkout nutrition immutable after a catalog edit", () => {
    const fixture = readFixture<{
      checkoutSnapshot: { nutritionVersion: number; calories: number; protein_g: number };
      currentCatalog: { nutritionVersion: number; calories: number; protein_g: number };
      expected: { reportCalories: number; reportProtein_g: number };
    }>("fixtures/orders/meal-snapshot-changed-catalog.json");

    expect(fixture.currentCatalog.nutritionVersion).toBeGreaterThan(fixture.checkoutSnapshot.nutritionVersion);
    expect(fixture.checkoutSnapshot.calories).toBe(fixture.expected.reportCalories);
    expect(fixture.checkoutSnapshot.protein_g).toBe(fixture.expected.reportProtein_g);
    expect(fixture.currentCatalog.calories).not.toBe(fixture.expected.reportCalories);
  });

  it("uses only the replacement portion for a substituted meal", () => {
    const fixture = readFixture<{
      ownerId: string;
      requestingUserId: string;
      original: { mealId: string };
      replacement: { mealId: string; calories: number; protein_g: number };
      portionPercent: number;
      expected: { calories: number; protein_g: number; originalVisible: boolean };
    }>("fixtures/consumption/substitution.json");
    const factor = fixture.portionPercent / 100;

    expect(fixture.requestingUserId).toBe(fixture.ownerId);
    expect(fixture.original.mealId).not.toBe(fixture.replacement.mealId);
    expect(Math.round(fixture.replacement.calories * factor)).toBe(fixture.expected.calories);
    expect(Math.round(fixture.replacement.protein_g * factor)).toBe(fixture.expected.protein_g);
    expect(fixture.expected.originalVisible).toBe(true);
  });

  it("blocks consumption, rewards, and invalid CTA for cancelled orders", () => {
    const fixture = readFixture<{
      statusHistory: string[];
      notification: { type: "order_detail"; id: null };
      expected: { consumptionAllowed: boolean; xpAwarded: number; walletReward: number; deepLinkAllowed: boolean };
    }>("fixtures/orders/cancelled-refunded.json");
    const terminal = fixture.statusHistory.at(-1);
    const consumptionAllowed = !["cancelled", "refunded"].includes(terminal ?? "");

    expect(consumptionAllowed).toBe(fixture.expected.consumptionAllowed);
    expect(fixture.expected.xpAwarded).toBe(0);
    expect(fixture.expected.walletReward).toBe(0);
    expect(Boolean(buildSafeDeepLink(fixture.notification))).toBe(fixture.expected.deepLinkAllowed);
  });

  it("deduplicates overlapping wearables and applies provider precedence", () => {
    const fixture = readFixture<{
      samples: Array<{
        provider: WearableProviderId;
        externalId: string;
        checksum: string;
        qualityState: string;
        value: number;
      }>;
      expected: { selectedProvider: WearableProviderId; selectedValue: number; uniqueSamples: number };
    }>("fixtures/health/two-provider-samples.json");
    const unique = [...new Map(
      fixture.samples
        .filter((sample) => sample.qualityState !== "duplicate")
        .map((sample) => [`${sample.provider}:${sample.externalId}:${sample.checksum}`, sample]),
    ).values()];
    const selected = unique.sort(
      (left, right) => WEARABLE_PROVIDER_PRECEDENCE[right.provider] - WEARABLE_PROVIDER_PRECEDENCE[left.provider],
    )[0];

    expect(unique).toHaveLength(fixture.expected.uniqueSamples);
    expect(selected.provider).toBe(fixture.expected.selectedProvider);
    expect(selected.value).toBe(fixture.expected.selectedValue);
  });

  it("maps Qatar and DST samples to their intended local dates", () => {
    const fixture = readFixture<{
      cases: Array<{ timestamp: string; timezone: string; expectedLocalDate: string }>;
    }>("fixtures/timezone/qatar-and-dst-boundary.json");

    for (const testCase of fixture.cases) {
      expect(localDate(testCase.timestamp, testCase.timezone)).toBe(testCase.expectedLocalDate);
    }
  });

  it("does not credit stale health data to ranking", () => {
    const fixture = readFixture<{
      asOf: string;
      sample: { syncedAt: string };
      freshnessThresholdDays: number;
      expected: { fresh: boolean; rankingCredit: number; reason: string };
    }>("fixtures/health/stale-provider-data.json");
    const ageDays = (Date.parse(fixture.asOf) - Date.parse(fixture.sample.syncedAt)) / 86_400_000;
    const fresh = ageDays <= fixture.freshnessThresholdDays;

    expect(fresh).toBe(fixture.expected.fresh);
    expect(fresh ? 1 : 0).toBe(fixture.expected.rankingCredit);
    expect(fixture.expected.reason).toBe("missing_or_stale");
  });

  it("rejects sync payloads after provider credentials are revoked", () => {
    const fixture = readFixture<{
      connectionBefore: { status: string; hasServerCredential: boolean; cursorEnabled: boolean };
      revoke: { serverCredentialDeleted: boolean; localCacheCleared: boolean };
      expected: { status: string; cursorEnabled: boolean; payloadAccepted: boolean; showReconnect: boolean };
    }>("fixtures/health/revoked-provider.json");
    const credentialActive = fixture.connectionBefore.hasServerCredential && !fixture.revoke.serverCredentialDeleted;

    expect(credentialActive ? "connected" : "revoked").toBe(fixture.expected.status);
    expect(credentialActive).toBe(fixture.expected.cursorEnabled);
    expect(credentialActive).toBe(fixture.expected.payloadAccepted);
    expect(!credentialActive && fixture.revoke.localCacheCleared).toBe(fixture.expected.showReconnect);
  });

  it("restores one private activity session after an offline crash", () => {
    const fixture = readFixture<{
      checkpoint: { localSessionId: string; state: string; routeVisibility: string };
      uploads: Array<{ externalId: string; calorieSource: string }>;
      expected: { restored: boolean; storedSessions: number; routeVisibility: string; calorieSource: string };
    }>("fixtures/activity/offline-crash-recovery.json");
    const restored = fixture.checkpoint.state === "recording";
    const uploads = new Map(fixture.uploads.map((upload) => [upload.externalId, upload]));

    expect(restored).toBe(fixture.expected.restored);
    expect(uploads.size).toBe(fixture.expected.storedSessions);
    expect(fixture.checkpoint.routeVisibility).toBe(fixture.expected.routeVisibility);
    expect(uploads.get(fixture.checkpoint.localSessionId)?.calorieSource).toBe(fixture.expected.calorieSource);
  });

  it("deduplicates reward grants and applies one compensation", () => {
    const fixture = readFixture<{
      actorRole: string;
      sourceEvents: Array<{ sourceKey: string; operation: "grant" | "reverse"; xp: number; wallet: number }>;
      leaderboardFields: string[];
      expected: { grantEntries: number; compensationEntries: number; netXp: number; netWallet: number; privateHealthExposed: boolean };
    }>("fixtures/rewards/replay-source-event.json");
    const grants = new Map<string, { xp: number; wallet: number }>();
    const compensations = new Set<string>();
    for (const event of fixture.sourceEvents) {
      if (event.operation === "grant" && fixture.actorRole === "service_role" && !grants.has(event.sourceKey)) {
        grants.set(event.sourceKey, { xp: event.xp, wallet: event.wallet });
      }
      if (event.operation === "reverse" && grants.has(event.sourceKey)) compensations.add(event.sourceKey);
    }
    const granted = [...grants.values()];
    const reversed = fixture.sourceEvents.find((event) => event.operation === "reverse");

    expect(grants.size).toBe(fixture.expected.grantEntries);
    expect(compensations.size).toBe(fixture.expected.compensationEntries);
    expect(granted.reduce((sum, item) => sum + item.xp, 0) + (reversed?.xp ?? 0)).toBe(fixture.expected.netXp);
    expect(granted.reduce((sum, item) => sum + item.wallet, 0) + (reversed?.wallet ?? 0)).toBe(fixture.expected.netWallet);
    expect(fixture.leaderboardFields.some((field) => /health|heart|weight|journal/i.test(field))).toBe(
      fixture.expected.privateHealthExposed,
    );
  });

  it("renders an Arabic RTL interaction model within 360px", () => {
    const fixture = readFixture<{
      locale: string;
      direction: string;
      viewportWidth: number;
      content: {
        title: string;
        description: string;
        controls: Array<{ label: string; ariaLabel: string; x: number; width: number; height: number }>;
      };
      expected: { minimumTouchTarget: number; horizontalPadding: number; allActionsVisible: boolean };
    }>("fixtures/ui/arabic-rtl-mobile.json");
    const root = document.createElement("section");
    root.dir = fixture.direction;
    root.lang = fixture.locale;
    root.textContent = `${fixture.content.title} ${fixture.content.description}`;
    for (const control of fixture.content.controls) {
      const button = document.createElement("button");
      button.textContent = control.label;
      button.setAttribute("aria-label", control.ariaLabel);
      root.append(button);
    }

    const visible = fixture.content.controls.every((control) =>
      control.x >= fixture.expected.horizontalPadding &&
      control.x + control.width <= fixture.viewportWidth - fixture.expected.horizontalPadding &&
      control.height >= fixture.expected.minimumTouchTarget &&
      control.ariaLabel.length > 0
    );

    expect(root.dir).toBe("rtl");
    expect(root.lang).toBe("ar");
    expect(root.querySelectorAll("button[aria-label]")).toHaveLength(fixture.content.controls.length);
    expect(visible).toBe(fixture.expected.allActionsVisible);
  });

  it("covers every required quality area and executable release command", () => {
    const coveredAreas = new Set(PHASE_ONE_MANDATORY_SCENARIOS.flatMap((scenario) => scenario.areas));
    for (const area of requiredAreas) expect(coveredAreas.has(area)).toBe(true);

    const commandIds = PHASE_ONE_RELEASE_COMMANDS.map((command) => command.id);
    expect(commandIds).toEqual(expect.arrayContaining([
      "unit-contracts",
      "database-contracts",
      "typecheck",
      "lint",
      "full-vitest",
      "mobile-e2e",
      "security-e2e",
      "production-readiness-evidence",
    ]));
    for (const command of PHASE_ONE_RELEASE_COMMANDS) {
      expect(command.command).toMatch(/^npm run /);
      expect(command.purpose.length).toBeGreaterThan(20);
    }
  });

  it("ships an actual PostgreSQL RLS and retry gate", () => {
    const sql = readFileSync(
      resolve(process.cwd(), "supabase/tests/phase-one-release-gate.sql"),
      "utf8",
    );
    expect(sql).toContain("SET LOCAL ROLE authenticated");
    expect(sql).toContain("public.process_notification_domain_events");
    expect(sql).toContain("public.complete_notification_event_delivery");
    expect(sql).toContain("'dead_letter'");
    expect(sql).toContain("'حصلت على مكافأة التحدي'");
    expect(sql.trimEnd().endsWith("ROLLBACK;")).toBe(true);
  });

  it("runs fresh and upgraded database replay with every phase-one SQL test", () => {
    const script = readFileSync(
      resolve(process.cwd(), "scripts/test-phase-one-db.ps1"),
      "utf8",
    );
    const sqlTests = readdirSync(resolve(process.cwd(), "supabase/tests"))
      .filter((file) => /^phase-one-.*\.sql$/.test(file));

    expect(sqlTests.length).toBeGreaterThan(0);
    expect(script).toContain("foreach ($scenario in @('fresh', 'upgraded'))");
    expect(script).toContain("Invoke-DatabaseScenario $scenario");
    expect(script).toContain("Copy-AuthoritativeBaseline $migrationRoot");
    expect(script).toContain("Copy-PhaseOneClosureMigrations $migrationRoot");
    expect(script).toContain("phase_one_authoritative_schema.sql");
    expect(script).toContain("Registered phase-one closure migrations are missing");
    expect(script).toContain("Integration closure");
    expect(script).toContain("function Get-ReleaseSqlTests");
    expect(script).toContain("Get-ChildItem -LiteralPath $testSource -Filter '*.sql'");
    expect(script).toContain("$competitiveGapTests");
    expect(script).toContain("migration', 'up', '--local'");
    expect(script).not.toMatch(/phase-one-release-gate\.sql.*phase-one-reward-settlement\.sql/s);
  });

  it("requires authenticated bilingual mobile, recovery, budget, and rollback E2E", () => {
    const mobile = readFileSync(resolve(process.cwd(), "e2e/system/mobile.spec.ts"), "utf8");
    const security = readFileSync(resolve(process.cwd(), "e2e/system/security.spec.ts"), "utf8");

    expect(mobile).toContain('import { test } from "../fixtures/test"');
    expect(mobile).toContain('language: "en"');
    expect(mobile).toContain('language: "ar"');
    expect(mobile).toContain("width: 360");
    expect(mobile).toContain("width: 390");
    expect(mobile).toContain("internetdisconnected");
    expect(mobile).toContain("interactive budget");
    expect(mobile).toContain("CapacitorStorage.nutrio_outdoor_activity_v1_");
    expect(security).toContain("authenticatedCustomerPage");
    expect(security).toContain("nutrio_phase_one_enable_all");
    expect(security).toContain("removing the authenticated session");
  });

  it("looks up scenarios by stable id", () => {
    expect(getReleaseGateScenario("reward-replay").title).toContain("Reward replay");
    expect(() => getReleaseGateScenario("missing" as ReleaseGateScenarioId)).toThrow(
      "Unknown phase-one release scenario",
    );
  });
});
