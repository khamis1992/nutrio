import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface StreakData {
  currentStreak: number;
  bestStreak: number;
  streakType: string;
  lastLogDate: string | null;
}

export function useStreak(userId: string | undefined) {
  const [streaks, setStreaks] = useState<{
    logging: StreakData | null;
    goals: StreakData | null;
    weight: StreakData | null;
    water: StreakData | null;
  }>({ logging: null, goals: null, weight: null, water: null });
  const [loading, setLoading] = useState(true);

  const fetchStreaks = useCallback(async () => {
    if (!userId) return;

    try {
      setLoading(true);

      // Fetch all streak types
      const { data: streakData, error } = await (supabase as any)
        .from("user_streaks")
        .select("streak_type, current_streak, best_streak, last_log_date")
        .eq("user_id", userId);

      if (error) throw error;

      const streaksMap = {
        logging: null as StreakData | null,
        goals: null as StreakData | null,
        weight: null as StreakData | null,
        water: null as StreakData | null,
      };

      (streakData || []).forEach((streak: any) => {
        const data: StreakData = {
          currentStreak: streak.current_streak || 0,
          bestStreak: streak.best_streak || 0,
          streakType: streak.streak_type,
          lastLogDate: streak.last_log_date,
        };

        if (streak.streak_type === "logging") streaksMap.logging = data;
        else if (streak.streak_type === "goals") streaksMap.goals = data;
        else if (streak.streak_type === "weight") streaksMap.weight = data;
        else if (streak.streak_type === "water") streaksMap.water = data;
      });

      setStreaks(streaksMap);
    } catch (error) {
      console.error("Error fetching streaks:", error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchStreaks();
  }, [fetchStreaks]);

  return {
    streaks,
    loading,
    refresh: fetchStreaks,
  };
}
