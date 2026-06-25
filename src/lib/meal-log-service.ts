import { supabase } from "@/integrations/supabase/client";
import { syncCommunityChallengeProgressQuietly } from "@/lib/community-challenge-service";
import { getQatarDay } from "@/lib/dateUtils";

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

const roundedMacro = (value: number, quantity = 1) => Math.max(0, Math.round((value || 0) * quantity));

export async function logMealItems({
  userId,
  items,
  logDate = getQatarDay(),
  source = "manual",
  awardXp = true,
  track,
  writeMealToHealth,
}: LogMealItemsOptions) {
  const normalizedItems = items
    .map((item) => {
      const quantity = item.quantity ?? 1;
      return {
        name: item.name || "Meal",
        calories: roundedMacro(item.calories, quantity),
        protein_g: roundedMacro(item.protein_g, quantity),
        carbs_g: roundedMacro(item.carbs_g, quantity),
        fat_g: roundedMacro(item.fat_g, quantity),
        image_url: item.image_url || null,
      };
    })
    .filter((item) => item.calories > 0 || item.protein_g > 0 || item.carbs_g > 0 || item.fat_g > 0);

  if (normalizedItems.length === 0) {
    return { loggedCount: 0, calories: 0, protein: 0, carbs: 0, fat: 0 };
  }

  const totals = normalizedItems.reduce(
    (sum, item) => ({
      calories: sum.calories + item.calories,
      protein: sum.protein + item.protein_g,
      carbs: sum.carbs + item.carbs_g,
      fat: sum.fat + item.fat_g,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );

  const { data: existing, error: progressReadError } = await supabase
    .from("progress_logs")
    .select("id, calories_consumed, protein_consumed_g, carbs_consumed_g, fat_consumed_g")
    .eq("user_id", userId)
    .eq("log_date", logDate)
    .maybeSingle();

  if (progressReadError) throw progressReadError;

  if (existing) {
    const { error } = await supabase
      .from("progress_logs")
      .update({
        calories_consumed: (existing.calories_consumed || 0) + totals.calories,
        protein_consumed_g: (existing.protein_consumed_g || 0) + totals.protein,
        carbs_consumed_g: (existing.carbs_consumed_g || 0) + totals.carbs,
        fat_consumed_g: (existing.fat_consumed_g || 0) + totals.fat,
      })
      .eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("progress_logs").insert({
      user_id: userId,
      log_date: logDate,
      calories_consumed: totals.calories,
      protein_consumed_g: totals.protein,
      carbs_consumed_g: totals.carbs,
      fat_consumed_g: totals.fat,
    });
    if (error) throw error;
  }

  const { error: historyError } = await supabase.from("meal_history").insert(
    normalizedItems.map((item) => ({
      user_id: userId,
      name: item.name,
      calories: item.calories,
      protein_g: item.protein_g,
      carbs_g: item.carbs_g,
      fat_g: item.fat_g,
      image_url: item.image_url,
    })),
  );
  if (historyError) throw historyError;

  if (awardXp) {
    try {
      await supabase.rpc("award_xp_for_meal_log", {
        p_user_id: userId,
        p_xp_amount: 10 * normalizedItems.length,
      });
      track?.("xp_earned", { amount: 10 * normalizedItems.length, source });
    } catch (xpError) {
      console.warn("Failed to award meal log XP:", xpError);
    }

    try {
      await supabase.rpc("increment_meals_logged", { p_user_id: userId });
    } catch (counterError) {
      console.warn("Failed to increment meals logged:", counterError);
    }
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
    loggedCount: normalizedItems.length,
    calories: totals.calories,
    protein: totals.protein,
    carbs: totals.carbs,
    fat: totals.fat,
  };
}
