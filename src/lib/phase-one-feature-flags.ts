import { isFeatureEnabled } from "@/lib/analytics";

export const PHASE_ONE_FEATURE_FLAGS = {
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
} as const;

export type PhaseOneFeature = keyof typeof PHASE_ONE_FEATURE_FLAGS;
export type PhaseOneFeatureFlag = (typeof PHASE_ONE_FEATURE_FLAGS)[PhaseOneFeature];

export interface PhaseOneFeatureDefinition {
  key: PhaseOneFeatureFlag;
  owner: `agent-${number}`;
  defaultEnabled: false;
  dependencies: readonly PhaseOneFeatureFlag[];
  rollbackAction: string;
  monitoringSignal: string;
  expiresOn: `${number}-${number}-${number}`;
}

const flags = PHASE_ONE_FEATURE_FLAGS;
const LOCAL_ENABLE_ALL_KEY = "nutrio_phase_one_enable_all";
const LOCAL_FLAGS_KEY = "nutrio_phase_one_flags";

function valueIsEnabled(value: unknown): boolean {
  return value === true || value === "true" || value === "1" || value === "on";
}

function commaListIncludes(value: unknown, flag: PhaseOneFeatureFlag): boolean {
  if (typeof value !== "string") return false;
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .includes(flag);
}

function readBooleanOverride(value: unknown): boolean | null {
  if (valueIsEnabled(value)) return true;
  if (value === false || value === "false" || value === "0" || value === "off") {
    return false;
  }
  return null;
}

function browserOverride(flag: PhaseOneFeatureFlag): boolean | null {
  if (typeof window === "undefined") return null;

  try {
    const enableAllOverride = readBooleanOverride(
      window.localStorage.getItem(LOCAL_ENABLE_ALL_KEY),
    );
    if (enableAllOverride !== null) return enableAllOverride;

    const rawFlags = window.localStorage.getItem(LOCAL_FLAGS_KEY);
    if (!rawFlags) return null;

    try {
      const parsed = JSON.parse(rawFlags) as unknown;
      if (Array.isArray(parsed)) return parsed.includes(flag) ? true : null;
      if (parsed && typeof parsed === "object") {
        return readBooleanOverride((parsed as Record<string, unknown>)[flag]);
      }
    } catch {
      return commaListIncludes(rawFlags, flag) ? true : null;
    }
  } catch {
    return null;
  }

  return null;
}

export function isPhaseOneFlagForcedOn(flag: PhaseOneFeatureFlag): boolean {
  const localOverride = browserOverride(flag);
  if (localOverride !== null) return localOverride;

  return (
    valueIsEnabled(import.meta.env.VITE_PHASE_ONE_ENABLE_ALL) ||
    commaListIncludes(import.meta.env.VITE_PHASE_ONE_FLAGS, flag)
  );
}

function enabledFlag(flag: PhaseOneFeatureFlag, defaultEnabled: boolean): boolean {
  const localOverride = browserOverride(flag);
  if (localOverride !== null) return localOverride;
  return isPhaseOneFlagForcedOn(flag) || isFeatureEnabled(flag, defaultEnabled);
}

export const PHASE_ONE_FEATURE_REGISTRY = {
  consumptionLifecycle: {
    key: flags.consumptionLifecycle,
    owner: "agent-1",
    defaultEnabled: false,
    dependencies: [],
    rollbackAction: "Restore the legacy delivered-meal progress action; retain append-only facts.",
    monitoringSignal: "consumption_duplicate_count and delivered_without_outcome_rate",
    expiresOn: "2026-10-31",
  },
  micronutrients: {
    key: flags.micronutrients,
    owner: "agent-2",
    defaultEnabled: false,
    dependencies: [],
    rollbackAction: "Hide validation and adequacy UI; preserve captured nutrient provenance.",
    monitoringSignal: "nutrition_snapshot_coverage and missing_nutrient_rate",
    expiresOn: "2026-10-31",
  },
  rankingV2: {
    key: flags.rankingV2,
    owner: "agent-3",
    defaultEnabled: false,
    dependencies: [
      flags.consumptionLifecycle,
      flags.micronutrients,
      flags.wearableNormalization,
    ],
    rollbackAction: "Return to the existing meal ranking while retaining audit rows.",
    monitoringSignal: "ranking_hard_gate_violation_count and ranking_p95_ms",
    expiresOn: "2026-11-30",
  },
  wearableNormalization: {
    key: flags.wearableNormalization,
    owner: "agent-4",
    defaultEnabled: false,
    dependencies: [],
    rollbackAction: "Stop normalized ingestion and use existing daily metric paths.",
    monitoringSignal: "health_sample_duplicate_rate and provider_sync_failure_rate",
    expiresOn: "2026-10-31",
  },
  outdoorRecording: {
    key: flags.outdoorRecording,
    owner: "agent-5",
    defaultEnabled: false,
    dependencies: [flags.wearableNormalization],
    rollbackAction: "Disable recording entry points; preserve recoverable local sessions.",
    monitoringSignal: "activity_recovery_failure_rate and route_upload_failure_rate",
    expiresOn: "2026-11-30",
  },
  trainingEnhancements: {
    key: flags.trainingEnhancements,
    owner: "agent-6",
    defaultEnabled: false,
    dependencies: [],
    rollbackAction: "Return to existing guided workout behavior without rewriting sessions.",
    monitoringSignal: "workout_completion_error_rate and progression_conflict_count",
    expiresOn: "2026-11-30",
  },
  cooperativeChallenges: {
    key: flags.cooperativeChallenges,
    owner: "agent-7",
    defaultEnabled: false,
    dependencies: [flags.consumptionLifecycle, flags.wearableNormalization],
    rollbackAction: "Disable cooperative enrollment and scoring; retain reward ledger entries.",
    monitoringSignal: "duplicate_reward_count and challenge_projection_lag",
    expiresOn: "2026-11-30",
  },
  healthContext: {
    key: flags.healthContext,
    owner: "agent-8",
    defaultEnabled: false,
    dependencies: [flags.rankingV2, flags.wearableNormalization],
    rollbackAction: "Stop context collection and exclude stored context from recommendations.",
    monitoringSignal: "health_context_consent_violation_count and context_delete_failure_count",
    expiresOn: "2026-12-31",
  },
  familyAccounts: {
    key: flags.familyAccounts,
    owner: "agent-0",
    defaultEnabled: false,
    dependencies: [],
    rollbackAction: "Hide family profile and beneficiary controls; retain consent history and assigned schedules.",
    monitoringSignal: "family_schedule_rejection_rate and family_allergen_conflict_count",
    expiresOn: "2026-12-31",
  },
  corporateBenefits: {
    key: flags.corporateBenefits,
    owner: "agent-0",
    defaultEnabled: false,
    dependencies: [],
    rollbackAction: "Hide workplace benefit and admin controls; retain benefit ledger and sponsor invoices.",
    monitoringSignal: "corporate_redemption_failure_rate and sponsor_invoice_replay_count",
    expiresOn: "2026-12-31",
  },
} as const satisfies Record<PhaseOneFeature, PhaseOneFeatureDefinition>;

export function isPhaseOneFeatureEnabled(feature: PhaseOneFeature): boolean {
  const definition = PHASE_ONE_FEATURE_REGISTRY[feature];
  const dependenciesEnabled = definition.dependencies.every((dependency) =>
    enabledFlag(dependency, false),
  );

  return dependenciesEnabled && enabledFlag(definition.key, definition.defaultEnabled);
}
