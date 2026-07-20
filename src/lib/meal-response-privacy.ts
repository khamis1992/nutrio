import { supabase } from "@/integrations/supabase/client";

export type MealResponsePrivacyScope =
  | "meal_response"
  | "glucose_analysis"
  | "post_meal_prompts"
  | "recommendation_use"
  | "coach_sharing"
  | "research_use";

export interface MealResponsePrivacyResult {
  action: "revoke_scopes" | "delete_dataset";
  already_processed: boolean;
  scopes?: MealResponsePrivacyScope[];
  canonical_nutrition_logs_retained?: boolean;
  [key: string]: unknown;
}

export interface MealResponseExportPackage {
  schema_version: "meal-response-export-v1";
  request_id: string;
  preferences: Record<string, unknown>;
  consumptions: unknown[];
  check_ins: unknown[];
  episodes: unknown[];
  estimates: unknown[];
  experiments: unknown[];
  source_metadata: unknown[];
  glucose_sample_summary: Record<string, unknown>;
  consent_history: unknown[];
}

type RpcError = { message?: string };
type RpcResult = { data: unknown; error: RpcError | null };
type RpcClient = {
  rpc: (name: string, args: Record<string, unknown>) => Promise<RpcResult>;
};

const rpc = (supabase as unknown as RpcClient).rpc.bind(supabase);
const POLICY_VERSION = "2026-07-meal-response-v1";

function asObject(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function assertExportPackage(value: unknown): MealResponseExportPackage {
  const row = asObject(value);
  if (row.schema_version !== "meal-response-export-v1" || typeof row.request_id !== "string") {
    throw new Error("MEAL_RESPONSE_EXPORT_INVALID_RESPONSE");
  }

  return {
    schema_version: "meal-response-export-v1",
    request_id: row.request_id,
    preferences: asObject(row.preferences),
    consumptions: Array.isArray(row.consumptions) ? row.consumptions : [],
    check_ins: Array.isArray(row.check_ins) ? row.check_ins : [],
    episodes: Array.isArray(row.episodes) ? row.episodes : [],
    estimates: Array.isArray(row.estimates) ? row.estimates : [],
    experiments: Array.isArray(row.experiments) ? row.experiments : [],
    source_metadata: Array.isArray(row.source_metadata) ? row.source_metadata : [],
    glucose_sample_summary: asObject(row.glucose_sample_summary),
    consent_history: Array.isArray(row.consent_history) ? row.consent_history : [],
  };
}

function assertPrivacyResult(value: unknown): MealResponsePrivacyResult {
  const row = asObject(value);
  if (row.action !== "revoke_scopes" && row.action !== "delete_dataset") {
    throw new Error("MEAL_RESPONSE_PRIVACY_INVALID_RESPONSE");
  }
  return row as MealResponsePrivacyResult;
}

export async function exportMealResponseData(requestId: string = crypto.randomUUID()) {
  const { data, error } = await rpc("export_my_meal_response_data", {
    p_request_id: requestId,
  });
  if (error) throw new Error(error.message || "MEAL_RESPONSE_EXPORT_FAILED");
  return assertExportPackage(data);
}

export async function revokeMealResponseScopes(
  scopes: MealResponsePrivacyScope[],
  requestId: string = crypto.randomUUID(),
) {
  if (scopes.length === 0 || new Set(scopes).size !== scopes.length) {
    throw new Error("MEAL_RESPONSE_PRIVACY_SCOPES_REQUIRED");
  }
  const { data, error } = await rpc("revoke_my_meal_response_scopes", {
    p_scopes: scopes,
    p_request_id: requestId,
    p_policy_version: POLICY_VERSION,
  });
  if (error) throw new Error(error.message || "MEAL_RESPONSE_REVOKE_FAILED");
  return assertPrivacyResult(data);
}

export async function deleteMealResponseData(requestId: string = crypto.randomUUID()) {
  const { data, error } = await rpc("delete_my_meal_response_data", {
    p_request_id: requestId,
    p_policy_version: POLICY_VERSION,
  });
  if (error) throw new Error(error.message || "MEAL_RESPONSE_DELETE_FAILED");
  return assertPrivacyResult(data);
}
