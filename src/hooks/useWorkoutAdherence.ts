import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface WorkoutDayAdherence {
  date: string;
  dayLabel: string;
  sessionsCompleted: number;
  exercisesCompleted: number;
  totalExercises: number;
}

export interface ExerciseHistoryEntry {
  session_id: string;
  exercise_name: string;
  set_number: number;
  reps: number | null;
  weight_kg: number | null;
  completed_at: string;
}

export interface WorkoutAdherenceAlert {
  type: "no_workout" | "low_adherence" | "expired_program";
  message: string;
  severity: "warning" | "error";
}

/**
 * Hook for coaches to see workout adherence, exercise history,
 * and alerts for a specific client.
 */
export function useWorkoutAdherence(clientId: string | undefined) {
  const [weekAdherence, setWeekAdherence] = useState<WorkoutDayAdherence[]>([]);
  const [exerciseHistory, setExerciseHistory] = useState<ExerciseHistoryEntry[]>([]);
  const [alerts, setAlerts] = useState<WorkoutAdherenceAlert[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAdherence = useCallback(async () => {
    if (!clientId) {
      setWeekAdherence([]);
      setExerciseHistory([]);
      setAlerts([]);
      setLoading(false);
      return;
    }

    try {
      // Fetch last 7 days of workout sessions
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const weekStart = sevenDaysAgo.toISOString().split("T")[0];

      const { data: sessions } = await supabase
        .from("coach_workout_sessions")
        .select("id, started_at, completed_at, day_number, program_id")
        .eq("user_id", clientId)
        .gte("started_at", weekStart)
        .order("started_at", { ascending: true });

      // Fetch set logs for those sessions
      const sessionIds = (sessions || []).map((s) => s.id);
      let setLogsData: Array<{
        session_id: string;
        exercise_name: string;
        set_number: number;
        reps: number | null;
        weight_kg: number | null;
        completed: boolean;
      }> = [];

      if (sessionIds.length > 0) {
        const { data: logs } = await supabase
          .from("coach_workout_set_logs")
          .select("session_id, exercise_name, set_number, reps, weight_kg, completed")
          .in("session_id", sessionIds);
        setLogsData = logs || [];
      }

      // Build 7-day adherence
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const adherence: WorkoutDayAdherence[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split("T")[0];
        const daySessions = (sessions || []).filter(
          (s) => s.started_at.startsWith(dateStr)
        );
        const dayLogs = setLogsData.filter((l) =>
          daySessions.some((s) => s.id === l.session_id)
        );
        const completedExercises = new Set(
          dayLogs.filter((l) => l.completed).map((l) => l.exercise_name)
        ).size;
        adherence.push({
          date: dateStr,
          dayLabel: dayNames[d.getDay()],
          sessionsCompleted: daySessions.filter((s) => s.completed_at).length,
          exercisesCompleted: completedExercises,
          totalExercises: Math.max(completedExercises, daySessions.length > 0 ? completedExercises : 0),
        });
      }
      setWeekAdherence(adherence);

      // Build exercise history from ALL sessions (not just last 7 days)
      const { data: allSessions } = await supabase
        .from("coach_workout_sessions")
        .select("id, started_at")
        .eq("user_id", clientId)
        .order("started_at", { ascending: false })
        .limit(20);

      const allSessionIds = (allSessions || []).map((s) => s.id);
      if (allSessionIds.length > 0) {
        const { data: allLogs } = await supabase
          .from("coach_workout_set_logs")
          .select("session_id, exercise_name, set_number, reps, weight_kg, completed")
          .in("session_id", allSessionIds);

        const historyMap: ExerciseHistoryEntry[] = [];
        for (const log of allLogs || []) {
          const session = allSessions?.find((s) => s.id === log.session_id);
          if (session && log.completed) {
            historyMap.push({
              session_id: log.session_id,
              exercise_name: log.exercise_name,
              set_number: log.set_number,
              reps: log.reps,
              weight_kg: log.weight_kg,
              completed_at: session.started_at,
            });
          }
        }
        setExerciseHistory(historyMap);
      }

      // Generate alerts
      const newAlerts: WorkoutAdherenceAlert[] = [];

      // Check: no workout in 3+ days
      const lastSession = sessions?.length
        ? sessions[sessions.length - 1]
        : null;
      if (lastSession) {
        const daysSinceLast = Math.floor(
          (Date.now() - new Date(lastSession.started_at).getTime()) / 86400000
        );
        if (daysSinceLast >= 3) {
          newAlerts.push({
            type: "no_workout",
            message: `No workout in ${daysSinceLast} days`,
            severity: daysSinceLast >= 5 ? "error" : "warning",
          });
        }
      }

      // Check: weekly adherence below 50%
      const completedDays = adherence.filter(
        (d) => d.sessionsCompleted > 0
      ).length;
      if (completedDays < 4 && adherence.some((d) => d.totalExercises > 0)) {
        newAlerts.push({
          type: "low_adherence",
          message: `Only ${completedDays}/7 workout days this week`,
          severity: "warning",
        });
      }

      setAlerts(newAlerts);
    } catch (err) {
      console.error("Error fetching workout adherence:", err);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchAdherence();
  }, [fetchAdherence]);

  /** Get last N weight entries for a specific exercise (for progressive overload) */
  const getExerciseWeightHistory = useCallback(
    (exerciseName: string, limit = 5): ExerciseHistoryEntry[] => {
      return exerciseHistory
        .filter((e) => e.exercise_name === exerciseName && e.weight_kg !== null)
        .slice(0, limit);
    },
    [exerciseHistory]
  );

  /** Get weight trend for an exercise: 'up' | 'down' | 'flat' | 'none' */
  const getExerciseTrend = useCallback(
    (exerciseName: string): "up" | "down" | "flat" | "none" => {
      const history = getExerciseWeightHistory(exerciseName, 3);
      if (history.length < 2) return "none";
      const weights = history.map((h) => h.weight_kg!);
      const latest = weights[0];
      const previous = weights[weights.length - 1];
      const diff = latest - previous;
      if (Math.abs(diff) < 0.5) return "flat";
      return diff > 0 ? "up" : "down";
    },
    [getExerciseWeightHistory]
  );

  const overallWeeklyPct =
    weekAdherence.length > 0
      ? Math.round(
          (weekAdherence.filter((d) => d.sessionsCompleted > 0).length /
            weekAdherence.length) *
            100
        )
      : 0;

  return {
    weekAdherence,
    exerciseHistory,
    alerts,
    overallWeeklyPct,
    loading,
    getExerciseWeightHistory,
    getExerciseTrend,
    refresh: fetchAdherence,
  };
}
