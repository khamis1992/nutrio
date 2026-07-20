import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { syncCommunityChallengeProgressQuietly } from "@/lib/community-challenge-service";

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

export type ProgramMealTimePrecision =
  | "exact"
  | "estimated_15m"
  | "estimated_30m"
  | "date_only";

export interface ProgramMealCompletionTiming {
  startedConsumingAt?: string | null;
  timePrecision?: ProgramMealTimePrecision;
  timezoneName?: string;
  utcOffsetMinutes?: number;
}

type UntypedRpcClient = {
  rpc: (
    name: string,
    params: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message?: string } | null }>;
};

/**
 * Hook for a client to track exercise and meal completions within their programs.
 * Fetches today's exercise completions and canonical meal projections.
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
      const [exerciseResult, mealResult] = await Promise.all([
        supabase
          .from("program_exercise_completions")
          .select("id, program_exercise_id, client_id, completed_at, notes")
          .eq("client_id", clientId)
          .gte("completed_at", today),
        supabase
          .from("program_meal_completions")
          .select("id, program_meal_id, client_id, completed_at, notes")
          .eq("client_id", clientId),
      ]);
      if (exerciseResult.error) throw exerciseResult.error;
      if (mealResult.error) throw mealResult.error;
      setExerciseCompletions((exerciseResult.data as ExerciseCompletion[]) || []);
      setMealCompletions((mealResult.data as MealCompletion[]) || []);
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
        await syncCommunityChallengeProgressQuietly(clientId);
      } catch (err) {
        console.error("Error toggling exercise completion:", err);
      }
    },
    [clientId, exerciseCompletions]
  );

  const toggleMeal = useCallback(
    async (
      programMealId: string,
      timing: ProgramMealCompletionTiming = {},
    ) => {
      if (!clientId) return;
      const existing = mealCompletions.find(
        (c) => c.program_meal_id === programMealId
      );
      try {
        const timePrecision = timing.timePrecision ?? "exact";
        const startedConsumingAt = timePrecision === "date_only"
          ? null
          : timing.startedConsumingAt ?? new Date().toISOString();
        const timezoneName = timing.timezoneName
          ?? Intl.DateTimeFormat().resolvedOptions().timeZone
          ?? "Asia/Qatar";
        const offsetDate = startedConsumingAt ? new Date(startedConsumingAt) : new Date();
        const utcOffsetMinutes = timing.utcOffsetMinutes
          ?? -offsetDate.getTimezoneOffset();
        const { data, error } = await (supabase as unknown as UntypedRpcClient).rpc(
          "record_coach_program_meal_consumption",
          {
            p_program_meal_id: programMealId,
            p_status: existing ? "reversed" : "full",
            p_request_id: crypto.randomUUID(),
            p_started_consuming_at: startedConsumingAt,
            p_time_precision: timePrecision,
            p_timezone_name: timezoneName,
            p_utc_offset_minutes: utcOffsetMinutes,
          },
        );
        if (error) throw new Error(error.message || "PROGRAM_MEAL_COMPLETION_FAILED");
        if (!(data as { success?: boolean } | null)?.success) {
          throw new Error("PROGRAM_MEAL_COMPLETION_FAILED");
        }
        await fetchCompletions();
        await syncCommunityChallengeProgressQuietly(clientId);
      } catch (err) {
        console.error("Error toggling meal completion:", err);
      }
    },
    [clientId, fetchCompletions, mealCompletions]
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
