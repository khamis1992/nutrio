import { supabase } from "@/integrations/supabase/client";
import { syncCommunityChallengeProgressQuietly } from "@/lib/community-challenge-service";
import { getQatarDay } from "@/lib/dateUtils";

type ManualMealLogRpcClient = typeof supabase & {
  rpc(
    fn: "log_manual_meal_items",
    args: {
      p_items: Array<{
        name: string;
        calories: number;
        protein_g: number;
        carbs_g: number;
        fat_g: number;
        image_url: string | null;
      }>;
      p_log_date: string;
      p_request_id: string;
      p_source: string;
    },
  ): Promise<{
    data: {
      success?: boolean;
      duplicate?: boolean;
      history_ids?: string[];
      logged_count?: number;
      xp_awarded?: number;
    } | null;
    error: { message?: string } | null;
  }>;
};

const manualMealRpc = supabase as ManualMealLogRpcClient;

export interface MealLogItemInput {
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
}

export interface LogMealItemsResult {
  persisted: true;
  loggedCount: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

const roundedMacro = (value: number, quantity = 1) => Math.round(value * quantity);

export async function logMealItems({
  userId,
  items,
  logDate = getQatarDay(),
  source = "manual",
  awardXp: _awardXp = true,
  track,
  writeMealToHealth,
}: LogMealItemsOptions): Promise<LogMealItemsResult> {
  if (items.length === 0) throw new Error("MEAL_ITEMS_REQUIRED");

  const normalizedItems = items.map((item, index) => {
    const quantity = item.quantity ?? 1;
    const nutrition = [item.calories, item.protein_g, item.carbs_g, item.fat_g];

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

  const totals = normalizedItems.reduce(
    (sum, item) => ({
      calories: sum.calories + item.calories,
      protein: sum.protein + item.protein_g,
      carbs: sum.carbs + item.carbs_g,
      fat: sum.fat + item.fat_g,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );

  const requestId = globalThis.crypto.randomUUID();
  const { data: logResult, error: logError } = await manualMealRpc.rpc(
    "log_manual_meal_items",
    {
      p_items: normalizedItems,
      p_log_date: logDate,
      p_request_id: requestId,
      p_source: source,
    },
  );
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
  };
}
