import { supabase } from "@/integrations/supabase/client";

export type ConsumptionSourceType = "order" | "meal_schedule";
export type ConsumptionStatus = "full" | "partial" | "skipped" | "substituted" | "reversed";
export type ConsumptionTimePrecision = "exact" | "estimated_15m" | "estimated_30m" | "date_only";

export interface NutritionSnapshot {
  schema_version?: number;
  meal_id?: string;
  order_item_id?: string | null;
  meal_name: string;
  image_url?: string | null;
  serving_quantity?: number;
  serving_unit?: string;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g?: number | null;
  sugar_g?: number | null;
  sodium_mg?: number | null;
  saturated_fat_g?: number | null;
  cholesterol_mg?: number | null;
  potassium_mg?: number | null;
  micronutrients?: Array<{
    nutrient_code: string;
    value: number | null;
    unit: string;
  }>;
  allergens?: Array<Record<string, unknown>>;
  diet_attributes?: Array<Record<string, unknown>>;
  nutrition_version?: number;
  provenance?: Record<string, unknown>;
  captured_at?: string;
  completeness_score?: number;
  missing_nutrient_codes?: string[];
  invalid_nutrient_codes?: string[];
  backfill_provenance?: Record<string, unknown> | null;
}

export interface AppliedNutrition {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g?: number;
  sodium_mg?: number;
  saturated_fat_g?: number;
  cholesterol_mg?: number;
  potassium_mg?: number;
}

export interface MealConsumption {
  id: string;
  status: ConsumptionStatus;
  portion_percent: number;
  portion?: number;
  substitute_meal_id: string | null;
  nutrition_snapshot: NutritionSnapshot;
  source_snapshot?: NutritionSnapshot | null;
  semantic_idempotency_key?: string | null;
  applied_calories: number;
  applied_protein_g: number;
  applied_carbs_g: number;
  applied_fat_g: number;
  applied_fiber_g: number;
  event_version: number;
  log_date: string;
  started_consuming_at?: string | null;
  finished_consuming_at?: string | null;
  time_precision?: ConsumptionTimePrecision | null;
  timezone_name?: string | null;
  utc_offset_minutes?: number | null;
}

export interface RecordMealConsumptionInput {
  sourceType: ConsumptionSourceType;
  sourceId: string;
  sourceMealId: string;
  status: ConsumptionStatus;
  portionPercent?: number;
  substituteMealId?: string | null;
  requestId?: string;
}

export interface RecordMealConsumptionResult {
  success: boolean;
  already_processed: boolean;
  consumption_id: string;
  meal_history_id?: string | null;
  event_version: number;
  event_type?: "consumed" | "skipped" | "substituted" | "reversed";
  semantic_idempotency_key?: string;
  status: ConsumptionStatus;
  portion_percent: number;
  portion?: number;
  nutrition: AppliedNutrition;
}

export interface MealConsumptionTimingInput {
  consumptionId: string;
  startedConsumingAt: string;
  finishedConsumingAt?: string | null;
  timePrecision: ConsumptionTimePrecision;
  timezoneName: string;
  utcOffsetMinutes: number;
}

type UntypedRpcClient = {
  rpc: (
    name: string,
    params: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message?: string } | null }>;
};

export function scaleNutrition(
  nutrition: NutritionSnapshot,
  portionPercent: number,
): AppliedNutrition {
  const factor = Math.max(0, Math.min(100, portionPercent)) / 100;
  return {
    calories: Math.round((nutrition.calories || 0) * factor),
    protein_g: Math.round((nutrition.protein_g || 0) * factor),
    carbs_g: Math.round((nutrition.carbs_g || 0) * factor),
    fat_g: Math.round((nutrition.fat_g || 0) * factor),
    fiber_g: Math.round((nutrition.fiber_g || 0) * factor),
    sugar_g: Math.round((nutrition.sugar_g || 0) * factor),
    sodium_mg: Math.round((nutrition.sodium_mg || 0) * factor),
    saturated_fat_g: Math.round((nutrition.saturated_fat_g || 0) * factor),
    cholesterol_mg: Math.round((nutrition.cholesterol_mg || 0) * factor),
    potassium_mg: Math.round((nutrition.potassium_mg || 0) * factor),
  };
}

export async function recordOrderMealConsumption(
  input: RecordMealConsumptionInput,
): Promise<RecordMealConsumptionResult> {
  const requestId = input.requestId || crypto.randomUUID();
  const { data, error } = await (supabase as unknown as UntypedRpcClient).rpc(
    "record_order_meal_consumption",
    {
      p_source_type: input.sourceType,
      p_source_id: input.sourceId,
      p_source_meal_id: input.sourceMealId,
      p_status: input.status,
      p_portion_percent: input.portionPercent ?? 100,
      p_substitute_meal_id: input.substituteMealId ?? null,
      p_request_id: requestId,
    },
  );

  if (error) throw new Error(error.message || "CONSUMPTION_UPDATE_FAILED");

  const result = data as RecordMealConsumptionResult | null;
  if (!result?.success) throw new Error("CONSUMPTION_UPDATE_FAILED");
  return result;
}

export async function getOrderMealConsumption(
  sourceType: ConsumptionSourceType,
  sourceId: string,
  sourceMealId: string,
): Promise<MealConsumption | null> {
  const { data, error } = await (supabase as unknown as UntypedRpcClient).rpc(
    "get_order_meal_consumption",
    {
      p_source_type: sourceType,
      p_source_id: sourceId,
      p_source_meal_id: sourceMealId,
    },
  );

  if (error) throw new Error(error.message || "CONSUMPTION_LOOKUP_FAILED");
  return data && typeof data === "object" ? data as MealConsumption : null;
}

export async function setMealConsumptionTiming(
  input: MealConsumptionTimingInput,
): Promise<boolean> {
  const { data, error } = await (supabase as unknown as UntypedRpcClient).rpc(
    "set_meal_consumption_timing",
    {
      p_consumption_id: input.consumptionId,
      p_started_consuming_at: input.startedConsumingAt,
      p_finished_consuming_at: input.finishedConsumingAt ?? null,
      p_time_precision: input.timePrecision,
      p_timezone_name: input.timezoneName,
      p_utc_offset_minutes: input.utcOffsetMinutes,
    },
  );

  if (error) {
    // Nutrition logging remains compatible while the timing migration rolls out.
    if (/function .* does not exist|could not find the function/i.test(error.message || "")) {
      return false;
    }
    throw new Error(error.message || "CONSUMPTION_TIMING_UPDATE_FAILED");
  }

  return Boolean((data as { success?: boolean } | null)?.success ?? data);
}
