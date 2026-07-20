import { supabase } from "@/integrations/supabase/client";

export type MealResponseEvidenceTier = "descriptive" | "early" | "medium" | "strong";
export type MealResponseSourceKind = "measured" | "observed" | "predicted" | "experiment";

export interface MealResponsePreferences {
  meal_response_enabled: boolean;
  glucose_analysis_enabled: boolean;
  post_meal_prompts_enabled: boolean;
  recommendation_use_enabled: boolean;
  coach_sharing_enabled: boolean;
  research_use_enabled: boolean;
}

export interface PendingMealResponseCheckIn {
  consumption_id: string;
  meal_name: string;
  image_url: string | null;
  consumed_at: string;
  prompt_offset_minutes: number;
}

export interface MealResponseEstimate {
  id: string;
  consumption_id: string | null;
  meal_id: string | null;
  meal_name: string;
  image_url: string | null;
  outcome: string;
  estimate: number | null;
  lower_bound: number | null;
  upper_bound: number | null;
  unit: string | null;
  evidence_tier: MealResponseEvidenceTier;
  source_kind: MealResponseSourceKind;
  confidence_score: number;
  eligible_episode_count: number;
  explanation_codes: string[];
  published_at: string;
}

export interface MealResponseExperimentSummary {
  id: string;
  title: string;
  status: "draft" | "active" | "paused" | "completed" | "cancelled";
  completed_repeats: number;
  minimum_repeats: number;
  next_assignment_label: string | null;
}

export interface MealResponseDashboardData {
  preferences: MealResponsePreferences;
  glucose_connected: boolean;
  eligible_episode_count: number;
  descriptive_episode_count: number;
  pending_check_ins: PendingMealResponseCheckIn[];
  estimates: MealResponseEstimate[];
  experiments: MealResponseExperimentSummary[];
}

export interface MealResponseCheckInInput {
  consumptionId: string;
  promptOffsetMinutes: number;
  satiety: number;
  energy: number;
  digestion: number;
  symptoms: string[];
  confounders: string[];
}

type RpcError = { code?: string; message?: string };
type RpcResult = { data: unknown; error: RpcError | null };
type RpcClient = { rpc: (name: string, args?: Record<string, unknown>) => Promise<RpcResult> };
const rpc = (supabase as unknown as RpcClient).rpc.bind(supabase);

const DEFAULT_PREFERENCES: MealResponsePreferences = {
  meal_response_enabled: false,
  glucose_analysis_enabled: false,
  post_meal_prompts_enabled: false,
  recommendation_use_enabled: false,
  coach_sharing_enabled: false,
  research_use_enabled: false,
};

const asObject = (value: unknown): Record<string, unknown> => (
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
);
const asArray = (value: unknown) => Array.isArray(value) ? value : [];
const asNumber = (value: unknown, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};
const asNullableNumber = (value: unknown) => value === null || value === undefined
  ? null
  : asNumber(value);
const asNullableString = (value: unknown) => typeof value === "string" && value ? value : null;

export function normalizeMealResponseDashboard(value: unknown): MealResponseDashboardData {
  const row = asObject(value);
  const preferences = asObject(row.preferences);

  return {
    preferences: {
      meal_response_enabled: Boolean(preferences.meal_response_enabled),
      glucose_analysis_enabled: Boolean(preferences.glucose_analysis_enabled),
      post_meal_prompts_enabled: Boolean(preferences.post_meal_prompts_enabled),
      recommendation_use_enabled: Boolean(preferences.recommendation_use_enabled),
      coach_sharing_enabled: Boolean(preferences.coach_sharing_enabled),
      research_use_enabled: Boolean(preferences.research_use_enabled),
    },
    glucose_connected: Boolean(row.glucose_connected),
    eligible_episode_count: asNumber(row.eligible_episode_count),
    descriptive_episode_count: asNumber(row.descriptive_episode_count),
    pending_check_ins: asArray(row.pending_check_ins).map((item) => {
      const pending = asObject(item);
      return {
        consumption_id: String(pending.consumption_id || ""),
        meal_name: String(pending.meal_name || "Meal"),
        image_url: asNullableString(pending.image_url),
        consumed_at: String(pending.consumed_at || ""),
        prompt_offset_minutes: asNumber(pending.prompt_offset_minutes, 120),
      };
    }).filter((item) => item.consumption_id),
    estimates: asArray(row.estimates).map((item) => {
      const estimate = asObject(item);
      const evidenceTier = String(estimate.evidence_tier);
      const sourceKind = String(estimate.source_kind);
      return {
        id: String(estimate.id || ""),
        consumption_id: asNullableString(estimate.consumption_id),
        meal_id: asNullableString(estimate.meal_id),
        meal_name: String(estimate.meal_name || "Meal"),
        image_url: asNullableString(estimate.image_url),
        outcome: String(estimate.outcome || "response"),
        estimate: asNullableNumber(estimate.estimate),
        lower_bound: asNullableNumber(estimate.lower_bound),
        upper_bound: asNullableNumber(estimate.upper_bound),
        unit: asNullableString(estimate.unit),
        evidence_tier: ["descriptive", "early", "medium", "strong"].includes(evidenceTier)
          ? evidenceTier as MealResponseEvidenceTier
          : "descriptive",
        source_kind: ["measured", "observed", "predicted", "experiment"].includes(sourceKind)
          ? sourceKind as MealResponseSourceKind
          : "observed",
        confidence_score: Math.min(100, Math.max(0, asNumber(estimate.confidence_score))),
        eligible_episode_count: asNumber(estimate.eligible_episode_count),
        explanation_codes: asArray(estimate.explanation_codes).map(String),
        published_at: String(estimate.published_at || ""),
      };
    }).filter((item) => item.id),
    experiments: asArray(row.experiments).map((item) => {
      const experiment = asObject(item);
      const status = String(experiment.status);
      return {
        id: String(experiment.id || ""),
        title: String(experiment.title || "Personal meal comparison"),
        status: ["draft", "active", "paused", "completed", "cancelled"].includes(status)
          ? status as MealResponseExperimentSummary["status"]
          : "draft",
        completed_repeats: asNumber(experiment.completed_repeats),
        minimum_repeats: Math.max(1, asNumber(experiment.minimum_repeats, 6)),
        next_assignment_label: asNullableString(experiment.next_assignment_label),
      };
    }).filter((item) => item.id),
  };
}

export async function getMealResponseDashboard() {
  const { data, error } = await rpc("get_my_meal_response_dashboard");
  if (error) throw new Error(error.message || "MEAL_RESPONSE_LOAD_FAILED");
  return normalizeMealResponseDashboard(data);
}

export async function setMealResponsePreferences(preferences: MealResponsePreferences) {
  const { data, error } = await rpc("set_meal_response_preferences", {
    p_meal_response_enabled: preferences.meal_response_enabled,
    p_glucose_analysis_enabled: preferences.glucose_analysis_enabled,
    p_post_meal_prompts_enabled: preferences.post_meal_prompts_enabled,
    p_recommendation_use_enabled: preferences.recommendation_use_enabled,
    p_coach_sharing_enabled: preferences.coach_sharing_enabled,
    p_research_use_enabled: preferences.research_use_enabled,
    p_policy_version: "2026-07-meal-response-v1",
    p_request_id: crypto.randomUUID(),
  });
  if (error) throw new Error(error.message || "MEAL_RESPONSE_PREFERENCES_FAILED");
  return normalizeMealResponseDashboard({ preferences: asObject(data).preferences || data }).preferences;
}

export async function submitMealResponseCheckIn(input: MealResponseCheckInInput) {
  const { data, error } = await rpc("submit_meal_response_check_in", {
    p_consumption_id: input.consumptionId,
    p_request_id: crypto.randomUUID(),
    p_prompt_offset_minutes: input.promptOffsetMinutes,
    p_satiety: input.satiety,
    p_energy: input.energy,
    p_digestive_symptoms: input.symptoms,
    p_symptom_severity: Math.max(0, Math.min(4, 5 - input.digestion)),
    p_confounders: input.confounders,
    p_submitted_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message || "MEAL_RESPONSE_CHECK_IN_FAILED");
  const { error: buildError } = await supabase.functions.invoke("build-meal-response-episodes", {
    body: { consumption_id: input.consumptionId, limit: 1 },
  });
  if (buildError) {
    console.warn("Meal response episode rebuild was deferred:", buildError.message);
  }
  return data;
}

export async function recordMealResponseFeedback(
  estimateId: string,
  rating: "useful" | "not_accurate",
  reason?: string,
) {
  const { data, error } = await rpc("record_meal_response_insight_feedback", {
    p_estimate_id: estimateId,
    p_request_id: crypto.randomUUID(),
    p_useful: rating === "useful" ? true : null,
    p_accuracy_feedback: rating === "not_accurate" ? "not_accurate" : null,
    p_reason: reason || null,
  });
  if (error) throw new Error(error.message || "MEAL_RESPONSE_FEEDBACK_FAILED");
  return data;
}

export { DEFAULT_PREFERENCES };
