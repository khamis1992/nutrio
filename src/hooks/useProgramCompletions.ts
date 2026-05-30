import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ExerciseCompletion {
  id: string;
  program_exercise_id: string;
  client_id: string;
  completed_at: string;
  notes: string | null;
}

export interface MealCompletion {
  id: string;
  program_meal_id: string;
  client_id: string;
  completed_at: string;
  notes: string | null;
}

/**
 * Hook for a client to track exercise and meal completions within their programs.
 * Fetches today's completions, provides toggle functions.
 */
export function useProgramCompletions(clientId: string | undefined) {
  const [exerciseCompletions, setExerciseCompletions] = useState<ExerciseCompletion[]>([]);
  const [mealCompletions, setMealCompletions] = useState<MealCompletion[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCompletions = useCallback(async () => {
    if (!clientId) {
      setExerciseCompletions([]);
      setMealCompletions([]);
      setLoading(false);
      return;
    }
    try {
      const today = new Date().toISOString().split("T")[0];
      const [{ data: exData }, { data: mealData }] = await Promise.all([
        supabase
          .from("program_exercise_completions")
          .select("id, program_exercise_id, client_id, completed_at, notes")
          .eq("client_id", clientId)
          .gte("completed_at", today),
        supabase
          .from("program_meal_completions")
          .select("id, program_meal_id, client_id, completed_at, notes")
          .eq("client_id", clientId)
          .gte("completed_at", today),
      ]);
      setExerciseCompletions((exData as ExerciseCompletion[]) || []);
      setMealCompletions((mealData as MealCompletion[]) || []);
    } catch (err) {
      console.error("Error fetching completions:", err);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  const toggleExercise = useCallback(
    async (programExerciseId: string) => {
      if (!clientId) return;
      const today = new Date().toISOString().split("T")[0];
      const existing = exerciseCompletions.find(
        (c) => c.program_exercise_id === programExerciseId
      );
      try {
        if (existing) {
          // Un-complete: delete
          const { error } = await supabase
            .from("program_exercise_completions")
            .delete()
            .eq("id", existing.id);
          if (error) throw error;
          setExerciseCompletions((prev) =>
            prev.filter((c) => c.id !== existing.id)
          );
        } else {
          // Complete: insert
          const { data, error } = await supabase
            .from("program_exercise_completions")
            .insert({
              program_exercise_id: programExerciseId,
              client_id: clientId,
              completed_at: today,
            })
            .select("id, program_exercise_id, client_id, completed_at, notes")
            .single();
          if (error) throw error;
          setExerciseCompletions((prev) => [
            ...prev,
            data as ExerciseCompletion,
          ]);
        }
      } catch (err) {
        console.error("Error toggling exercise completion:", err);
      }
    },
    [clientId, exerciseCompletions]
  );

  const toggleMeal = useCallback(
    async (programMealId: string) => {
      if (!clientId) return;
      const today = new Date().toISOString().split("T")[0];
      const existing = mealCompletions.find(
        (c) => c.program_meal_id === programMealId
      );
      try {
        if (existing) {
          const { error } = await supabase
            .from("program_meal_completions")
            .delete()
            .eq("id", existing.id);
          if (error) throw error;
          setMealCompletions((prev) =>
            prev.filter((c) => c.id !== existing.id)
          );
        } else {
          const { data, error } = await supabase
            .from("program_meal_completions")
            .insert({
              program_meal_id: programMealId,
              client_id: clientId,
              completed_at: today,
            })
            .select("id, program_meal_id, client_id, completed_at, notes")
            .single();
          if (error) throw error;
          setMealCompletions((prev) => [...prev, data as MealCompletion]);
        }
      } catch (err) {
        console.error("Error toggling meal completion:", err);
      }
    },
    [clientId, mealCompletions]
  );

  const isExerciseCompleted = useCallback(
    (programExerciseId: string) => {
      return exerciseCompletions.some(
        (c) => c.program_exercise_id === programExerciseId
      );
    },
    [exerciseCompletions]
  );

  const isMealCompleted = useCallback(
    (programMealId: string) => {
      return mealCompletions.some(
        (c) => c.program_meal_id === programMealId
      );
    },
    [mealCompletions]
  );

  useEffect(() => {
    fetchCompletions();
  }, [fetchCompletions]);

  return {
    exerciseCompletions,
    mealCompletions,
    loading,
    toggleExercise,
    toggleMeal,
    isExerciseCompleted,
    isMealCompleted,
    refresh: fetchCompletions,
  };
}
