import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { syncCommunityChallengeProgressQuietly } from "@/lib/community-challenge-service";

export interface WorkoutSetLog {
  id: string;
  session_id: string;
  program_exercise_id: string | null;
  exercise_name: string;
  set_number: number;
  reps: number | null;
  weight_kg: number | null;
  completed: boolean;
  notes: string | null;
}

export interface WorkoutSession {
  id: string;
  user_id: string;
  program_id: string | null;
  day_number: number;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
  notes: string | null;
}

/**
 * Hook for managing a guided workout session.
 * Handles start, log sets, complete, and auto-complete program_exercise_completions.
 */
export function useWorkoutSession() {
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [setLogs, setSetLogs] = useState<WorkoutSetLog[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Start elapsed timer when session changes
  useEffect(() => {
    if (session && !session.completed_at) {
      const started = new Date(session.started_at).getTime();
      timerRef.current = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - started) / 1000));
      }, 1000);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
    if (session?.completed_at && timerRef.current) {
      clearInterval(timerRef.current);
    }
  }, [session]);

  const startSession = useCallback(
    async (userId: string, programId: string, dayNumber: number) => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("coach_workout_sessions")
          .insert({
            user_id: userId,
            program_id: programId,
            day_number: dayNumber,
          })
          .select()
          .single();

        if (error) throw error;
        setSession(data as WorkoutSession);
        setSetLogs([]);
        setElapsedSeconds(0);
        return { success: true, data: data as WorkoutSession };
      } catch (err) {
        console.error("Error starting workout session:", err);
        return { success: false, error: err as Error };
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const logSet = useCallback(
    async (params: {
      program_exercise_id?: string;
      exercise_name: string;
      set_number: number;
      reps?: number;
      weight_kg?: number;
      completed?: boolean;
      notes?: string;
    }) => {
      if (!session) return { success: false, error: new Error("No active session") };
      try {
        const { data, error } = await supabase
          .from("coach_workout_set_logs")
          .insert({
            session_id: session.id,
            program_exercise_id: params.program_exercise_id || null,
            exercise_name: params.exercise_name,
            set_number: params.set_number,
            reps: params.reps || null,
            weight_kg: params.weight_kg || null,
            completed: params.completed !== undefined ? params.completed : true,
            notes: params.notes || null,
          })
          .select()
          .single();

        if (error) throw error;
        setSetLogs((prev) => [...prev, data as WorkoutSetLog]);
        return { success: true, data: data as WorkoutSetLog };
      } catch (err) {
        console.error("Error logging set:", err);
        return { success: false, error: err as Error };
      }
    },
    [session]
  );

  const completeSession = useCallback(
    async (userId: string, exerciseIds: string[]) => {
      if (!session) return { success: false, error: new Error("No active session") };
      setLoading(true);
      try {
        const durationSeconds = Math.floor(
          (Date.now() - new Date(session.started_at).getTime()) / 1000
        );

        const { data, error } = await supabase
          .from("coach_workout_sessions")
          .update({
            completed_at: new Date().toISOString(),
            duration_seconds: durationSeconds,
          })
          .eq("id", session.id)
          .select()
          .single();

        if (error) throw error;
        setSession(data as WorkoutSession);

        // Auto-complete program_exercise_completions for all exercises in this session
        if (exerciseIds.length > 0) {
          const today = new Date().toISOString().split("T")[0];
          const completions = exerciseIds.map((exId) => ({
            program_exercise_id: exId,
            client_id: userId,
            completed_at: today,
          }));

          // Use upsert to avoid duplicate key violations
          const { error: completionError } = await supabase
            .from("program_exercise_completions")
            .upsert(completions, {
              onConflict: "program_exercise_id,client_id,completed_at",
            });

          if (completionError) {
            console.error("Error auto-completing exercises:", completionError);
          }
        }
        await syncCommunityChallengeProgressQuietly(userId);

        return { success: true, data: data as WorkoutSession };
      } catch (err) {
        console.error("Error completing session:", err);
        return { success: false, error: err as Error };
      } finally {
        setLoading(false);
      }
    },
    [session]
  );

  const resetSession = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setSession(null);
    setSetLogs([]);
    setElapsedSeconds(0);
  }, []);

  return {
    session,
    setLogs,
    elapsedSeconds,
    loading,
    startSession,
    logSet,
    completeSession,
    resetSession,
  };
}
