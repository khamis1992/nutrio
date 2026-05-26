import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Meal {
  id: string;
  name: string;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  prep_time_minutes: number | null;
  image_url: string | null;
  meal_type: string | null;
}

interface ScheduledMeal {
  id: string;
  scheduled_date: string;
  meal_type: string;
  meal_id: string;
  meal: {
    id: string;
    name: string;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    image_url: string | null;
  };
}

interface Substitute {
  meal: Meal;
  score: number;
  matchReasons: string[];
}

interface UnavailableMeal {
  scheduleId: string;
  scheduledDate: string;
  mealType: string;
  mealId: string;
  mealName: string;
  substitutes: Substitute[];
}

interface UseSmartSubstitutionsOptions {
  userId: string | undefined;
  schedules: ScheduledMeal[];
  enabled?: boolean;
}

const SIMILARITY_WEIGHTS = {
  calories: 0.40,
  protein: 0.25,
  carbs: 0.15,
  fat: 0.10,
  prepTime: 0.10,
};

const MAX_SUBSTITUTES = 3;

function computeSimilarity(
  original: { calories: number; protein_g: number; carbs_g: number; fat_g: number; prep_time_minutes?: number | null },
  candidate: Meal
): { score: number; reasons: string[] } {
  const reasons: string[] = [];

  const calDelta = original.calories > 0
    ? 1 - Math.min(Math.abs((candidate.calories || 0) - original.calories) / original.calories, 1)
    : 0.5;
  const proteinDelta = original.protein_g > 0
    ? 1 - Math.min(Math.abs((candidate.protein_g || 0) - original.protein_g) / original.protein_g, 1)
    : 0.5;
  const carbsDelta = original.carbs_g > 0
    ? 1 - Math.min(Math.abs((candidate.carbs_g || 0) - original.carbs_g) / original.carbs_g, 1)
    : 0.5;
  const fatDelta = original.fat_g > 0
    ? 1 - Math.min(Math.abs((candidate.fat_g || 0) - original.fat_g) / original.fat_g, 1)
    : 0.5;

  let prepTimeDelta = 0.5;
  if (original.prep_time_minutes && candidate.prep_time_minutes) {
    prepTimeDelta = 1 - Math.min(
      Math.abs(candidate.prep_time_minutes - original.prep_time_minutes) / Math.max(original.prep_time_minutes, 1),
      1
    );
  }

  const score =
    calDelta * SIMILARITY_WEIGHTS.calories +
    proteinDelta * SIMILARITY_WEIGHTS.protein +
    carbsDelta * SIMILARITY_WEIGHTS.carbs +
    fatDelta * SIMILARITY_WEIGHTS.fat +
    prepTimeDelta * SIMILARITY_WEIGHTS.prepTime;

  if (calDelta > 0.8) reasons.push("Similar calories");
  if (proteinDelta > 0.8) reasons.push("Similar protein");
  if (carbsDelta > 0.8) reasons.push("Similar carbs");
  if (prepTimeDelta > 0.8) reasons.push("Similar prep time");

  return { score, reasons: reasons.slice(0, 2) };
}

export function useSmartSubstitutions({
  userId,
  schedules,
  enabled = true,
}: UseSmartSubstitutionsOptions) {
  const [unavailableMeals, setUnavailableMeals] = useState<UnavailableMeal[]>([]);
  const [loading, setLoading] = useState(false);

  const checkAvailability = useCallback(async () => {
    if (!userId || !enabled || schedules.length === 0) {
      setUnavailableMeals([]);
      return;
    }

    setLoading(true);
    try {
      const mealIds = [...new Set(schedules.map((s) => s.meal_id))];

      const { data: mealsData, error } = await supabase
        .from("meals")
        .select("id, name, is_available")
        .in("id", mealIds);

      if (error) throw error;

      const availabilityMap = new Map<string, boolean>();
      for (const m of mealsData || []) {
        availabilityMap.set(m.id, m.is_available ?? true);
      }

      const unavailableIds = mealIds.filter((id) => !availabilityMap.get(id));

      if (unavailableIds.length === 0) {
        setUnavailableMeals([]);
        setLoading(false);
        return;
      }

      const unavailableSchedules = schedules.filter((s) => unavailableIds.includes(s.meal_id));

      const { data: allAvailableMeals, error: allErr } = await supabase
        .from("meals")
        .select(
          "id, name, calories, protein_g, carbs_g, fat_g, fiber_g, prep_time_minutes, image_url, meal_type"
        )
        .eq("is_available", true);

      if (allErr) throw allErr;

      const availableMeals = allAvailableMeals || [];

      const results: UnavailableMeal[] = [];

      for (const sched of unavailableSchedules) {
        const candidates = availableMeals
          .map((meal) => {
            const { score, reasons } = computeSimilarity(
              {
                calories: sched.meal.calories || 0,
                protein_g: sched.meal.protein_g || 0,
                carbs_g: sched.meal.carbs_g || 0,
                fat_g: sched.meal.fat_g || 0,
              },
              meal as Meal
            );
            return { meal: meal as Meal, score, matchReasons: reasons };
          })
          .sort((a, b) => b.score - a.score)
          .slice(0, MAX_SUBSTITUTES);

        results.push({
          scheduleId: sched.id,
          scheduledDate: sched.scheduled_date,
          mealType: sched.meal_type,
          mealId: sched.meal_id,
          mealName: sched.meal.name,
          substitutes: candidates,
        });
      }

      setUnavailableMeals(results);
    } catch (err) {
      console.error("Error checking meal availability:", err);
    } finally {
      setLoading(false);
    }
  }, [userId, schedules, enabled]);

  useEffect(() => {
    checkAvailability();
  }, [checkAvailability]);

  const dismissMeal = useCallback((scheduleId: string) => {
    setUnavailableMeals((prev) => prev.filter((m) => m.scheduleId !== scheduleId));
  }, []);

  const performSubstitution = useCallback(
    async (scheduleId: string, newMealId: string): Promise<boolean> => {
      try {
        const { error } = await supabase
          .from("meal_schedules")
          .update({ meal_id: newMealId } as Record<string, unknown>)
          .eq("id", scheduleId);

        if (error) throw error;

        setUnavailableMeals((prev) => prev.filter((m) => m.scheduleId !== scheduleId));
        return true;
      } catch (err) {
        console.error("Error substituting meal:", err);
        return false;
      }
    },
    []
  );

  return {
    unavailableMeals,
    loading,
    checkAvailability,
    dismissMeal,
    performSubstitution,
    hasUnavailable: unavailableMeals.length > 0,
  };
}
