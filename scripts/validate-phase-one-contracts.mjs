import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const requiredFiles = [
  "docs/research/architecture-integration-review.md",
  "docs/research/order-to-consumption-review.md",
  "docs/research/meal-nutrition-quality-and-micronutrients-review.md",
  "docs/research/explainable-meal-ranking-review.md",
  "docs/research/wearable-data-platform-review.md",
  "docs/research/outdoor-activity-review.md",
  "docs/research/strength-training-review.md",
  "docs/research/adherence-team-rewards-review.md",
  "docs/research/health-context-and-cycle-review.md",
  "docs/research/notifications-analytics-observability-review.md",
  "docs/research/qa-security-release-gate-review.md",
  "docs/architecture/adr/0001-meal-facts.md",
  "docs/architecture/adr/0002-immutable-nutrition-snapshots.md",
  "docs/architecture/adr/0003-health-event-provenance.md",
  "docs/architecture/adr/0004-recommendation-results.md",
  "docs/architecture/adr/0005-domain-events-and-notifications.md",
  "docs/architecture/phase-one-migration-registry.md",
  "docs/architecture/phase-one-feature-flags.md",
  "docs/architecture/phase-one-merge-checklist.md",
  "src/lib/phase-one-feature-flags.ts",
  "src/App.tsx",
  "src/customer/routes.tsx",
  "docs/contracts/agent-1-order-consumption-contract-note.md",
  "docs/contracts/agent-2-nutrition-quality-contract-note.md",
  "docs/research/explainable-meal-ranking-contract-note.md",
  "docs/contracts/agent-4-wearable-contract-note.md",
  "docs/contracts/agent-5-outdoor-activity-contract-note.md",
  "docs/contracts/agent-6-strength-training-contract-note.md",
  "docs/plans/2026-07-19-agent-7-contract-note.md",
  "docs/contracts/agent-8-health-context-contract-note.md",
  "docs/research/notifications-analytics-observability-contract-note.md",
  "docs/plans/phase-one-agent-10-release-runbook.md",
];

const read = (file) => readFileSync(resolve(root, file), "utf8");
const fail = (message) => {
  throw new Error(`[phase1-contracts] ${message}`);
};

for (const file of requiredFiles) read(file);

const migrationRegistry = read("docs/architecture/phase-one-migration-registry.md");
const ranges = [...migrationRegistry.matchAll(/`(\d{14})`-`(\d{14})`/g)].map(
  ([, start, end]) => ({ start: Number(start), end: Number(end) }),
);

if (ranges.length !== 10) fail(`expected 10 migration ranges, found ${ranges.length}`);

const sortedRanges = ranges.toSorted((left, right) => left.start - right.start);
for (let index = 0; index < sortedRanges.length; index += 1) {
  const range = sortedRanges[index];
  if (range.start > range.end) fail(`invalid migration range starting ${range.start}`);
  if (index > 0 && sortedRanges[index - 1].end >= range.start) {
    fail(`overlapping migration range starting ${range.start}`);
  }
}

const migrationFiles = readdirSync(resolve(root, "supabase/migrations"));
const phaseOneMigrationTimestamps = new Map();
const reservedStart = Math.min(...ranges.map(({ start }) => start));
const reservedEnd = Math.max(...ranges.map(({ end }) => end));
for (const file of migrationFiles) {
  const timestamp = Number(file.slice(0, 14));
  if (!Number.isFinite(timestamp) || timestamp < 20260719130000) {
    continue;
  }

  if (phaseOneMigrationTimestamps.has(timestamp)) {
    fail(`duplicate phase-one migration timestamp in ${phaseOneMigrationTimestamps.get(timestamp)} and ${file}`);
  }
  phaseOneMigrationTimestamps.set(timestamp, file);

  if (timestamp >= reservedStart && timestamp <= reservedEnd) {
    const matches = ranges.filter(({ start, end }) => timestamp >= start && timestamp <= end);
    if (matches.length !== 1) fail(`migration ${file} is outside or overlaps reserved ranges`);
  }
}

const registeredTimestamps = [...migrationRegistry.matchAll(/^\| `(\d{14})` \|/gm)].map(([, value]) => Number(value));
for (const timestamp of registeredTimestamps) {
  if (!migrationFiles.some((file) => file.startsWith(String(timestamp)))) {
    fail(`registered migration ${timestamp} is missing from supabase/migrations`);
  }
}
for (const [timestamp, file] of phaseOneMigrationTimestamps) {
  if (!registeredTimestamps.includes(timestamp)) {
    fail(`phase-one or closure migration ${file} is not registered`);
  }
}

const phaseOneSqlTests = readdirSync(resolve(root, "supabase/tests"))
  .filter((file) => /^phase-one-.*\.sql$/.test(file))
  .toSorted();
const allSqlTests = readdirSync(resolve(root, "supabase/tests"))
  .filter((file) => file.endsWith(".sql"))
  .toSorted();
if (phaseOneSqlTests.length === 0) fail("no supabase/tests/phase-one-*.sql files found");
for (const test of [
  "phase-one-health-context.sql",
  "phase-one-notification-privacy.sql",
  "phase-one-nutrition-quality.sql",
  "phase-one-order-consumption.sql",
  "phase-one-release-gate.sql",
  "phase-one-reward-settlement.sql",
  "phase-one-wearable.sql",
]) {
  if (!phaseOneSqlTests.includes(test)) fail(`missing phase-one database test ${test}`);
}
for (const test of [
  "nutrio-verified-view-security.sql",
  "family-profiles-and-safeguards.sql",
  "corporate-benefits-foundation.sql",
  "subscription-schedule-operations.sql",
]) {
  if (!allSqlTests.includes(test)) fail(`missing competitive-gap database test ${test}`);
}

const databaseGate = read("scripts/test-phase-one-db.ps1");
for (const evidence of [
  "foreach ($scenario in @('fresh', 'upgraded'))",
  "Invoke-DatabaseScenario $scenario",
  "Copy-AuthoritativeBaseline $migrationRoot",
  "Copy-PhaseOneClosureMigrations $migrationRoot",
  "Registered phase-one closure migrations are missing",
  "Integration closure",
  "Get-ReleaseSqlTests",
  "nutrio-verified-view-security.sql",
  "family-profiles-and-safeguards.sql",
  "corporate-benefits-foundation.sql",
  "subscription-schedule-operations.sql",
  "migration', 'up', '--local'",
]) {
  if (!databaseGate.includes(evidence)) fail(`database gate is missing: ${evidence}`);
}

const flagRegistry = read("src/lib/phase-one-feature-flags.ts");
const expectedFlags = [
  "phase1-consumption-lifecycle",
  "phase1-micronutrients",
  "phase1-ranking-v2",
  "phase1-wearable-normalization",
  "phase1-outdoor-recording",
  "phase1-training-enhancements",
  "phase1-cooperative-challenges",
  "phase1-health-context",
  "competitive-family-accounts",
  "competitive-corporate-benefits",
];

for (const flag of expectedFlags) {
  if (!flagRegistry.includes(`\"${flag}\"`)) fail(`missing feature flag ${flag}`);
}

const runtimeFlagEvidence = {
  "phase1-consumption-lifecycle": ["src/pages/Schedule.tsx"],
  "phase1-micronutrients": ["src/pages/ProgressRedesigned.tsx"],
  "phase1-ranking-v2": ["src/hooks/useMealRecommendations.ts"],
  "phase1-wearable-normalization": ["src/hooks/useHealthKitIntegration.ts"],
  "phase1-outdoor-recording": ["src/customer/routes.tsx", "src/pages/LogActivity.tsx"],
  "phase1-training-enhancements": ["src/pages/nutrio/GuidedWorkout.tsx"],
  "phase1-cooperative-challenges": ["src/pages/Rewards.tsx"],
  "phase1-health-context": ["src/components/health/HealthContextPanel.tsx"],
  "competitive-family-accounts": ["src/pages/Profile.tsx", "src/pages/MealDetail.tsx"],
  "competitive-corporate-benefits": ["src/pages/Profile.tsx", "src/pages/MealDetail.tsx", "src/pages/admin/AdminCorporateBenefits.tsx"],
};

for (const [flag, files] of Object.entries(runtimeFlagEvidence)) {
  const featureName = Object.entries({
    consumptionLifecycle: "phase1-consumption-lifecycle",
    micronutrients: "phase1-micronutrients",
    rankingV2: "phase1-ranking-v2",
    wearableNormalization: "phase1-wearable-normalization",
    outdoorRecording: "phase1-outdoor-recording",
    trainingEnhancements: "phase1-training-enhancements",
    cooperativeChallenges: "phase1-cooperative-challenges",
    healthContext: "phase1-health-context",
    familyAccounts: "competitive-family-accounts",
    corporateBenefits: "competitive-corporate-benefits",
  }).find(([, value]) => value === flag)?.[0];

  if (!featureName || !files.some((file) => read(file).includes(`isPhaseOneFeatureEnabled(\"${featureName}\")`))) {
    fail(`missing runtime gate for ${flag}`);
  }
}

const defaultOffCount = flagRegistry.match(/defaultEnabled: false,/g)?.length ?? 0;
if (defaultOffCount !== expectedFlags.length) {
  fail(`expected ${expectedFlags.length} default-off flags, found ${defaultOffCount}`);
}

const mobileE2e = read("e2e/system/mobile.spec.ts");
for (const evidence of [
  "authenticatedCustomerPage",
  'language: "en"',
  'language: "ar"',
  "width: 360",
  "width: 390",
  "interactive budget",
  "internetdisconnected",
  "nutrio_phase_one_flags",
]) {
  if (!mobileE2e.includes(evidence)) fail(`mobile E2E is missing: ${evidence}`);
}

const securityE2e = read("e2e/system/security.spec.ts");
for (const evidence of [
  "authenticatedCustomerPage",
  "nutrio_phase_one_enable_all",
  "removing the authenticated session",
  "phase-one-xss",
]) {
  if (!securityE2e.includes(evidence)) fail(`security E2E is missing: ${evidence}`);
}

console.log("Phase one contracts, migration ranges, and feature flags are valid.");
