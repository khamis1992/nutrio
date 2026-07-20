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
  restaurant_id?: string | null;
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
  onSubstituted?: () => void | Promise<void>;
}

interface SafeSubstituteCandidate {
  meal_id: string;
  name: string;
  image_url: string | null;
  restaurant_id: string | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  prep_time_minutes: number | null;
  score: number;
  reason_codes: string[];
}

interface SafeSubstituteResponse {
  candidates?: SafeSubstituteCandidate[];
}

const reasonLabels: Record<string, string> = {
  safety_checked: "Safety checked",
  diet_checked: "Diet matched",
  delivery_checked: "Delivery confirmed",
  nutrition_match: "Nutrition matched",
};

interface RpcClient {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message?: string } | null }>;
}

const rpcClient = supabase as unknown as RpcClient;

export function useSmartSubstitutions({
  userId,
  schedules,
  enabled = true,
  onSubstituted,
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
      const mealIds = [...new Set(schedules.map((s) => s.meal_id).filter(Boolean))] as string[];
      if (mealIds.length === 0) { setUnavailableMeals([]); setLoading(false); return; }

      const { data: mealsData, error } = await supabase
        .from("public_meal_catalog" as "meals")
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

      const results = await Promise.all(unavailableSchedules.map(async (sched): Promise<UnavailableMeal> => {
        const { data, error: candidatesError } = await rpcClient.rpc("get_safe_meal_substitutes", {
          p_schedule_id: sched.id,
          p_limit: 3,
        });
        if (candidatesError) throw candidatesError;

        const payload = (data ?? {}) as SafeSubstituteResponse;
        const substitutes = (payload.candidates ?? []).map((candidate): Substitute => ({
          meal: {
            id: candidate.meal_id,
            name: candidate.name,
            calories: candidate.calories,
            protein_g: candidate.protein_g,
            carbs_g: candidate.carbs_g,
            fat_g: candidate.fat_g,
            fiber_g: candidate.fiber_g,
            prep_time_minutes: candidate.prep_time_minutes,
            image_url: candidate.image_url,
            meal_type: sched.meal_type,
            restaurant_id: candidate.restaurant_id,
          },
          score: Number(candidate.score),
          matchReasons: candidate.reason_codes.map((code) => reasonLabels[code] ?? code),
        }));

        return {
          scheduleId: sched.id,
          scheduledDate: sched.scheduled_date,
          mealType: sched.meal_type,
          mealId: sched.meal_id,
          mealName: sched.meal.name,
          substitutes,
        };
      }));

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
        const { error } = await rpcClient.rpc("perform_safe_meal_substitution", {
          p_schedule_id: scheduleId,
          p_substitute_meal_id: newMealId,
          p_request_id: crypto.randomUUID(),
        });

        if (error) throw error;

        setUnavailableMeals((prev) => prev.filter((m) => m.scheduleId !== scheduleId));
        await onSubstituted?.();
        return true;
      } catch (err) {
        console.error("Error substituting meal:", err);
        return false;
      }
    },
    [onSubstituted]
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
