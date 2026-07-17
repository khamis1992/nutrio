import { useCallback, useEffect, useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import type { ProgramExercise } from "@/hooks/useCoachPrograms";

const dayKey = (programId: string, dayNumber: number) => `${programId}:${dayNumber}`;

export function useWorkoutDayLocks(clientId: string | undefined, exercises: ProgramExercise[]) {
  const [loggedDayKeys, setLoggedDayKeys] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const programDays = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const exercise of exercises) {
      const days = map.get(exercise.program_id) ?? [];
      if (!days.includes(exercise.day_number)) days.push(exercise.day_number);
      map.set(exercise.program_id, days);
    }

    for (const [programId, days] of map.entries()) {
      map.set(programId, days.sort((a, b) => a - b));
    }

    return map;
  }, [exercises]);

  useEffect(() => {
    if (!clientId || exercises.length === 0) {
      setLoggedDayKeys(new Set());
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);

    void (async () => {
      try {
        const programIds = [...new Set(exercises.map((exercise) => exercise.program_id))];
        const { data: sessions, error: sessionsError } = await supabase
          .from("coach_workout_sessions")
          .select("id, program_id, day_number, completed_at")
          .eq("user_id", clientId)
          .in("program_id", programIds)
          .not("completed_at", "is", null);

        if (sessionsError) throw sessionsError;

        const sessionRows = sessions || [];
        const sessionIds = sessionRows.map((session) => session.id);
        if (sessionIds.length === 0) {
          if (active) setLoggedDayKeys(new Set());
          return;
        }

        const { data: logs, error: logsError } = await supabase
          .from("coach_workout_set_logs")
          .select("session_id")
          .in("session_id", sessionIds)
          .eq("completed", true);

        if (logsError) throw logsError;
        if (!active) return;

        const loggedSessionIds = new Set((logs || []).map((log) => log.session_id));
        const nextLoggedDays = new Set<string>();
        for (const session of sessionRows) {
          if (session.program_id && loggedSessionIds.has(session.id)) {
            nextLoggedDays.add(dayKey(session.program_id, session.day_number));
          }
        }

        setLoggedDayKeys(nextLoggedDays);
      } catch (error) {
        console.error("Error loading workout day locks:", error);
        if (active) setLoggedDayKeys(new Set());
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [clientId, exercises]);

  const isDayLogged = useCallback(
    (programId: string, dayNumber: number) => loggedDayKeys.has(dayKey(programId, dayNumber)),
    [loggedDayKeys],
  );

  const getPreviousLockedDay = useCallback(
    (programId: string, dayNumber: number) => {
      const days = programDays.get(programId) ?? [];
      const previousDays = days.filter((day) => day < dayNumber);
      return previousDays.find((day) => !loggedDayKeys.has(dayKey(programId, day))) ?? null;
    },
    [loggedDayKeys, programDays],
  );

  const isDayUnlocked = useCallback(
    (programId: string, dayNumber: number) => getPreviousLockedDay(programId, dayNumber) === null,
    [getPreviousLockedDay],
  );

  return {
    loading,
    isDayLogged,
    isDayUnlocked,
    getPreviousLockedDay,
  };
}
