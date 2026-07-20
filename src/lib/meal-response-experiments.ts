import { supabase } from "@/integrations/supabase/client";

export type MealResponseExperimentStatus =
  | "draft"
  | "active"
  | "paused"
  | "completed"
  | "cancelled";

export type MealResponseExperimentOutcome =
  | "glucose_peak_delta"
  | "glucose_positive_iauc"
  | "glucose_recovery_time";

export interface MealResponseExperimentArm {
  key: string;
  label: string;
  meal_id: string;
  calories: number;
  description?: string;
}

export interface MealResponseExperimentMeal {
  id: string;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  image_url: string | null;
}

export interface MealResponseExperiment {
  id: string;
  hypothesis: string;
  outcome_type: MealResponseExperimentOutcome;
  arms: [MealResponseExperimentArm, MealResponseExperimentArm];
  minimum_repeats_per_arm: number;
  protocol_version: string;
  status: MealResponseExperimentStatus;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MealResponseExperimentAssignment {
  id: string;
  experiment_id: string;
  sequence_number: number;
  arm_key: string;
  consumed_consumption_id: string | null;
  completed_at: string | null;
}

export interface MealResponseExperimentArmSummary {
  arm_key: string;
  label: string;
  eligible_repeats: number;
  distinct_days: number;
  mean: number | null;
  minimum: number | null;
  maximum: number | null;
}

export interface MealResponseExperimentDetail {
  experiment: MealResponseExperiment;
  assignments: MealResponseExperimentAssignment[];
  arm_summaries: MealResponseExperimentArmSummary[];
  causal_language_allowed: boolean;
  causal_abstention_reason: string | null;
  claim_scope: "descriptive_only" | "personal_n_of_1_association";
}

export interface CreateMealResponseExperimentInput {
  hypothesis: string;
  outcomeType: MealResponseExperimentOutcome;
  arms: [MealResponseExperimentArm, MealResponseExperimentArm];
  minimumRepeatsPerArm?: number;
  protocolVersion?: string;
  requestId?: string;
}

type RpcError = { message?: string };
type RpcResult = { data: unknown; error: RpcError | null };
type RpcClient = { rpc: (name: string, args?: Record<string, unknown>) => Promise<RpcResult> };
const rpc = (supabase as unknown as RpcClient).rpc.bind(supabase);

const asObject = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
const asArray = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const asString = (value: unknown, fallback = "") => typeof value === "string" ? value : fallback;
const asNullableString = (value: unknown) => typeof value === "string" && value ? value : null;
const asNumber = (value: unknown, fallback = 0) => {
  const result = Number(value);
  return Number.isFinite(result) ? result : fallback;
};
const asNullableNumber = (value: unknown) => value === null || value === undefined
  ? null
  : asNumber(value);

const normalizeArm = (value: unknown): MealResponseExperimentArm => {
  const arm = asObject(value);
  return {
    key: asString(arm.key),
    label: asString(arm.label),
    meal_id: asString(arm.meal_id),
    calories: asNumber(arm.calories),
    ...(typeof arm.description === "string" ? { description: arm.description } : {}),
  };
};

export function normalizeMealResponseExperiment(value: unknown): MealResponseExperiment {
  const experiment = asObject(value);
  const arms = asArray(experiment.arms).map(normalizeArm);
  if (arms.length !== 2 || arms.some((arm) => !arm.key || !arm.label || !arm.meal_id || arm.calories <= 0)) {
    throw new Error("INVALID_EXPERIMENT_ARMS");
  }
  const status = asString(experiment.status) as MealResponseExperimentStatus;
  const outcome = asString(experiment.outcome_type) as MealResponseExperimentOutcome;
  return {
    id: asString(experiment.id),
    hypothesis: asString(experiment.hypothesis),
    outcome_type: outcome,
    arms: [arms[0], arms[1]],
    minimum_repeats_per_arm: asNumber(experiment.minimum_repeats_per_arm, 4),
    protocol_version: asString(experiment.protocol_version, "n-of-1-v2"),
    status,
    started_at: asNullableString(experiment.started_at),
    completed_at: asNullableString(experiment.completed_at),
    created_at: asString(experiment.created_at),
    updated_at: asString(experiment.updated_at),
  };
}

const normalizeAssignment = (value: unknown): MealResponseExperimentAssignment => {
  const assignment = asObject(value);
  return {
    id: asString(assignment.id),
    experiment_id: asString(assignment.experiment_id),
    sequence_number: asNumber(assignment.sequence_number),
    arm_key: asString(assignment.arm_key),
    consumed_consumption_id: asNullableString(assignment.consumed_consumption_id),
    completed_at: asNullableString(assignment.completed_at),
  };
};

export function normalizeMealResponseExperimentDetail(value: unknown): MealResponseExperimentDetail {
  const detail = asObject(value);
  return {
    experiment: normalizeMealResponseExperiment(detail.experiment),
    assignments: asArray(detail.assignments).map(normalizeAssignment),
    arm_summaries: asArray(detail.arm_summaries).map((value) => {
      const summary = asObject(value);
      return {
        arm_key: asString(summary.arm_key),
        label: asString(summary.label),
        eligible_repeats: asNumber(summary.eligible_repeats),
        distinct_days: asNumber(summary.distinct_days),
        mean: asNullableNumber(summary.mean),
        minimum: asNullableNumber(summary.minimum),
        maximum: asNullableNumber(summary.maximum),
      };
    }),
    causal_language_allowed: Boolean(detail.causal_language_allowed),
    causal_abstention_reason: asNullableString(detail.causal_abstention_reason),
    claim_scope: detail.claim_scope === "personal_n_of_1_association"
      ? "personal_n_of_1_association"
      : "descriptive_only",
  };
}

const requestId = (provided?: string) => provided || crypto.randomUUID();

const unwrapExperiment = (value: unknown) =>
  normalizeMealResponseExperiment(asObject(value).experiment);

export async function createMealResponseExperiment(input: CreateMealResponseExperimentInput) {
  const { data, error } = await rpc("create_meal_response_experiment", {
    p_request_id: requestId(input.requestId),
    p_hypothesis: input.hypothesis,
    p_outcome_type: input.outcomeType,
    p_arms: input.arms,
    p_minimum_repeats_per_arm: input.minimumRepeatsPerArm ?? 4,
    p_protocol_version: input.protocolVersion ?? "n-of-1-v2",
  });
  if (error) throw new Error(error.message || "MEAL_RESPONSE_EXPERIMENT_CREATE_FAILED");
  return unwrapExperiment(data);
}

export async function getMealResponseExperimentCatalog(): Promise<MealResponseExperimentMeal[]> {
  const { data, error } = await rpc("get_meal_response_experiment_catalog");
  if (error) throw new Error(error.message || "MEAL_RESPONSE_EXPERIMENT_CATALOG_FAILED");
  return asArray(data).map((value) => {
    const meal = asObject(value);
    return {
      id: asString(meal.id),
      name: asString(meal.name),
      calories: asNumber(meal.calories),
      protein_g: asNumber(meal.protein_g),
      carbs_g: asNumber(meal.carbs_g),
      fat_g: asNumber(meal.fat_g),
      image_url: asNullableString(meal.image_url),
    };
  }).filter((meal) => meal.id && meal.name && meal.calories > 0);
}

async function changeExperimentStatus(
  rpcName: "start_meal_response_experiment" | "pause_meal_response_experiment" | "cancel_meal_response_experiment",
  experimentId: string,
  providedRequestId?: string,
) {
  const { data, error } = await rpc(rpcName, {
    p_experiment_id: experimentId,
    p_request_id: requestId(providedRequestId),
  });
  if (error) throw new Error(error.message || "MEAL_RESPONSE_EXPERIMENT_UPDATE_FAILED");
  return unwrapExperiment(data);
}

export const startMealResponseExperiment = (experimentId: string, providedRequestId?: string) =>
  changeExperimentStatus("start_meal_response_experiment", experimentId, providedRequestId);

export const pauseMealResponseExperiment = (experimentId: string, providedRequestId?: string) =>
  changeExperimentStatus("pause_meal_response_experiment", experimentId, providedRequestId);

export const cancelMealResponseExperiment = (experimentId: string, providedRequestId?: string) =>
  changeExperimentStatus("cancel_meal_response_experiment", experimentId, providedRequestId);

export async function linkMealResponseExperimentConsumption(
  experimentId: string,
  assignmentId: string,
  consumptionId: string,
  providedRequestId?: string,
) {
  const { data, error } = await rpc("link_meal_response_experiment_consumption", {
    p_experiment_id: experimentId,
    p_assignment_id: assignmentId,
    p_consumption_id: consumptionId,
    p_request_id: requestId(providedRequestId),
  });
  if (error) throw new Error(error.message || "MEAL_RESPONSE_EXPERIMENT_LINK_FAILED");
  const result = asObject(data);
  return {
    experiment: normalizeMealResponseExperiment(result.experiment),
    assignment: normalizeAssignment(result.assignment),
  };
}

export async function getMealResponseExperiment(experimentId: string) {
  const { data, error } = await rpc("get_my_meal_response_experiment", {
    p_experiment_id: experimentId,
  });
  if (error) throw new Error(error.message || "MEAL_RESPONSE_EXPERIMENT_LOAD_FAILED");
  return normalizeMealResponseExperimentDetail(data);
}
