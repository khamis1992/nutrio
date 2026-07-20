import { supabase } from "@/integrations/supabase/client";
import { syncCommunityChallengeProgressQuietly } from "@/lib/community-challenge-service";
import { getQatarDay } from "@/lib/dateUtils";
import type { Micronutrients } from "@/lib/nutrition-types";
import {
  enqueueOfflineMutation,
  flushOfflineMutations,
  isNetworkFailure,
  type OfflineMutation,
} from "@/lib/offline-mutation-queue";

interface ManualMealLogRpcClient {
  rpc(
    fn: "log_manual_meal_items" | "log_manual_meal_items_v2" | "log_manual_meal_items_v3",
    args: {
      p_items: Array<{
        name: string;
        calories: number;
        protein_g: number;
        carbs_g: number;
        fat_g: number;
        fiber_g: number;
        sugar_g: number;
        sodium_mg: number;
        image_url: string | null;
      }>;
      p_log_date: string;
      p_request_id: string;
      p_source: string;
      p_started_consuming_at?: string;
      p_time_precision?: "exact" | "estimated_15m" | "estimated_30m" | "date_only";
      p_timezone_name?: string;
      p_utc_offset_minutes?: number;
    },
  ): Promise<{
    data: {
      success?: boolean;
      duplicate?: boolean;
      history_ids?: string[];
      logged_count?: number;
      xp_awarded?: number;
      consumption_id?: string;
    } | null;
    error: { code?: string; message?: string } | null;
  }>;
}

const manualMealRpc = supabase as unknown as ManualMealLogRpcClient;

export interface MealLogItemInput extends Micronutrients {
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  image_url?: string | null;
  quantity?: number;
}

export interface LogMealItemsOptions {
  userId: string;
  items: MealLogItemInput[];
  logDate?: string;
  source?: string;
  awardXp?: boolean;
  track?: (event: string, properties?: Record<string, unknown>) => void;
  writeMealToHealth?: (mealData: {
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    timestamp: Date;
  }) => Promise<boolean>;
  requestId?: string;
  consumedAt?: Date;
  timePrecision?: "exact" | "estimated_15m" | "estimated_30m" | "date_only";
}

export interface LogMealItemsResult {
  persisted: true;
  loggedCount: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
}

export interface QueuedMealLogResult {
  persisted: false;
  queued: true;
  requestId: string;
  loggedCount: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
}

interface QueuedMealLogPayload {
  userId: string;
  items: MealLogItemInput[];
  logDate: string;
  source: string;
  requestId: string;
  consumedAt: string;
  timePrecision: "exact" | "estimated_15m" | "estimated_30m" | "date_only";
}

const roundedMacro = (value: number, quantity = 1) => Math.round(value * quantity);

const normalizeMealItems = (items: MealLogItemInput[]) => {
  if (items.length === 0) throw new Error("MEAL_ITEMS_REQUIRED");

  return items.map((item, index) => {
    const quantity = item.quantity ?? 1;
    const nutrition = [
      item.calories,
      item.protein_g,
      item.carbs_g,
      item.fat_g,
      item.fiber_g ?? 0,
      item.sugar_g ?? 0,
      item.sodium_mg ?? 0,
    ];

    if (
      !Number.isFinite(quantity)
      || quantity <= 0
      || nutrition.some((value) => !Number.isFinite(value) || value < 0)
    ) {
      throw new Error(`INVALID_MEAL_ITEM_AT_INDEX_${index + 1}`);
    }

    const normalizedItem = {
      name: item.name || "Meal",
      calories: roundedMacro(item.calories, quantity),
      protein_g: roundedMacro(item.protein_g, quantity),
      carbs_g: roundedMacro(item.carbs_g, quantity),
      fat_g: roundedMacro(item.fat_g, quantity),
      fiber_g: roundedMacro(item.fiber_g ?? 0, quantity),
      sugar_g: roundedMacro(item.sugar_g ?? 0, quantity),
      sodium_mg: roundedMacro(item.sodium_mg ?? 0, quantity),
      image_url: item.image_url || null,
    };

    if (
      normalizedItem.calories === 0
      && normalizedItem.protein_g === 0
      && normalizedItem.carbs_g === 0
      && normalizedItem.fat_g === 0
    ) {
      throw new Error(`EMPTY_NUTRITION_AT_INDEX_${index + 1}`);
    }

    return normalizedItem;
  });
};

const getMealTotals = (items: ReturnType<typeof normalizeMealItems>) => items.reduce(
  (sum, item) => ({
    calories: sum.calories + item.calories,
    protein: sum.protein + item.protein_g,
    carbs: sum.carbs + item.carbs_g,
    fat: sum.fat + item.fat_g,
    fiber: sum.fiber + item.fiber_g,
    sugar: sum.sugar + item.sugar_g,
    sodium: sum.sodium + item.sodium_mg,
  }),
  { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 },
);

export async function logMealItems({
  userId,
  items,
  logDate = getQatarDay(),
  source = "manual",
  awardXp: _awardXp = true,
  track,
  writeMealToHealth,
  requestId = globalThis.crypto.randomUUID(),
  consumedAt = new Date(),
  timePrecision = "exact",
}: LogMealItemsOptions): Promise<LogMealItemsResult> {
  const normalizedItems = normalizeMealItems(items);
  const totals = getMealTotals(normalizedItems);
  const rpcArgs = {
    p_items: normalizedItems,
    p_log_date: logDate,
    p_request_id: requestId,
    p_source: source,
  };
  const v3Args = {
    ...rpcArgs,
    p_started_consuming_at: consumedAt.toISOString(),
    p_time_precision: timePrecision,
    p_timezone_name: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Qatar",
    p_utc_offset_minutes: -consumedAt.getTimezoneOffset(),
  };
  let { data: logResult, error: logError } = await manualMealRpc.rpc(
    "log_manual_meal_items_v3",
    v3Args,
  );

  // Older deployed backends keep working while the canonical V3 migration rolls out.
  if (logError && ["PGRST202", "42883"].includes(logError.code || "")) {
    ({ data: logResult, error: logError } = await manualMealRpc.rpc(
      "log_manual_meal_items_v2",
      rpcArgs,
    ));
  }
  if (logError && ["PGRST202", "42883"].includes(logError.code || "")) {
    ({ data: logResult, error: logError } = await manualMealRpc.rpc("log_manual_meal_items", rpcArgs));
  }
  if (logError) throw logError;

  const persistedCount = logResult?.logged_count
    ?? (logResult?.duplicate ? logResult.history_ids?.length : undefined);
  if (logResult?.success !== true || persistedCount !== normalizedItems.length) {
    throw new Error("MEAL_LOG_NOT_PERSISTED");
  }

  if ((logResult?.xp_awarded || 0) > 0) {
    track?.("xp_earned", { amount: logResult?.xp_awarded, source });
  }

  if (writeMealToHealth) {
    try {
      await writeMealToHealth({
        name: normalizedItems.length === 1 ? normalizedItems[0].name : `${normalizedItems.length} food items`,
        calories: totals.calories,
        protein: totals.protein,
        carbs: totals.carbs,
        fat: totals.fat,
        timestamp: new Date(),
      });
    } catch (healthError) {
      console.warn("Failed to write meal to Health app:", healthError);
    }
  }

  track?.("meal_logged", {
    source,
    items: normalizedItems.length,
    total_calories: totals.calories,
  });

  await syncCommunityChallengeProgressQuietly(userId);

  return {
    persisted: true,
    loggedCount: normalizedItems.length,
    calories: totals.calories,
    protein: totals.protein,
    carbs: totals.carbs,
    fat: totals.fat,
    fiber: totals.fiber,
    sugar: totals.sugar,
    sodium: totals.sodium,
  };
}

export async function logMealItemsResilient(
  options: LogMealItemsOptions,
): Promise<LogMealItemsResult | QueuedMealLogResult> {
  const requestId = options.requestId || globalThis.crypto.randomUUID();
  const normalizedItems = normalizeMealItems(options.items);
  const totals = getMealTotals(normalizedItems);
  const payload: QueuedMealLogPayload = {
    userId: options.userId,
    items: options.items,
    logDate: options.logDate || getQatarDay(),
    source: options.source || "manual",
    requestId,
    consumedAt: (options.consumedAt || new Date()).toISOString(),
    timePrecision: options.timePrecision || "exact",
  };

  const queue = () => {
    enqueueOfflineMutation({
      id: requestId,
      kind: "meal-log",
      userId: options.userId,
      payload,
    });
    return {
      persisted: false as const,
      queued: true as const,
      requestId,
      loggedCount: normalizedItems.length,
      ...totals,
    };
  };

  if (typeof navigator !== "undefined" && navigator.onLine === false) return queue();

  try {
    return await logMealItems({ ...options, requestId });
  } catch (error) {
    if (isNetworkFailure(error)) return queue();
    throw error;
  }
}

export async function flushQueuedMealLogs(userId: string) {
  return flushOfflineMutations(userId, {
    "meal-log": async (mutation: OfflineMutation) => {
      const payload = mutation.payload as QueuedMealLogPayload;
      await logMealItems({ ...payload, consumedAt: new Date(payload.consumedAt) });
    },
  });
}
