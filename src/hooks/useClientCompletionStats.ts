import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ExerciseCompletionStat {
  program_exercise_id: string;
  completion_count: number;
  last_completed_at: string | null;
}

export interface MealCompletionStat {
  program_meal_id: string;
  completion_count: number;
  last_completed_at: string | null;
}

/**
 * Hook for coaches to view a client's exercise and meal completion stats
 * across their programs. Aggregates total completions per exercise/meal.
 */
export function useClientCompletionStats(clientId: string | undefined) {
  const [exerciseStats, setExerciseStats] = useState<ExerciseCompletionStat[]>(
    []
  );
  const [mealStats, setMealStats] = useState<MealCompletionStat[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    if (!clientId) {
      setExerciseStats([]);
      setMealStats([]);
      setLoading(false);
      return;
    }
    try {
      const [{ data: exData }, { data: mealData }] = await Promise.all([
        supabase
          .from("program_exercise_completions")
          .select("program_exercise_id, completed_at")
          .eq("client_id", clientId),
        supabase
          .from("program_meal_completions")
          .select("program_meal_id, completed_at")
          .eq("client_id", clientId),
      ]);

      // Aggregate exercise completions by program_exercise_id
      const exMap = new Map<
        string,
        { count: number; lastCompleted: string | null }
      >();
      for (const row of exData || []) {
        const id = row.program_exercise_id;
        const existing = exMap.get(id) || {
          count: 0,
          lastCompleted: null as string | null,
        };
        existing.count++;
        if (
          !existing.lastCompleted ||
          row.completed_at > existing.lastCompleted
        ) {
          existing.lastCompleted = row.completed_at;
        }
        exMap.set(id, existing);
      }
      setExerciseStats(
        Array.from(exMap.entries()).map(
          ([program_exercise_id, { count, lastCompleted }]) => ({
            program_exercise_id,
            completion_count: count,
            last_completed_at: lastCompleted,
          })
        )
      );

      // Aggregate meal completions by program_meal_id
      const mealMap = new Map<
        string,
        { count: number; lastCompleted: string | null }
      >();
      for (const row of mealData || []) {
        const id = row.program_meal_id;
        const existing = mealMap.get(id) || {
          count: 0,
          lastCompleted: null as string | null,
        };
        existing.count++;
        if (
          !existing.lastCompleted ||
          row.completed_at > existing.lastCompleted
        ) {
          existing.lastCompleted = row.completed_at;
        }
        mealMap.set(id, existing);
      }
      setMealStats(
        Array.from(mealMap.entries()).map(
          ([program_meal_id, { count, lastCompleted }]) => ({
            program_meal_id,
            completion_count: count,
            last_completed_at: lastCompleted,
          })
        )
      );
    } catch (err) {
      console.error("Error fetching completion stats:", err);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const getExerciseStat = useCallback(
    (programExerciseId: string): ExerciseCompletionStat | undefined => {
      return exerciseStats.find(
        (s) => s.program_exercise_id === programExerciseId
      );
    },
    [exerciseStats]
  );

  const getMealStat = useCallback(
    (programMealId: string): MealCompletionStat | undefined => {
      return mealStats.find((s) => s.program_meal_id === programMealId);
    },
    [mealStats]
  );

  return {
    exerciseStats,
    mealStats,
    loading,
    getExerciseStat,
    getMealStat,
    refresh: fetchStats,
  };
}
