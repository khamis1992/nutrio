import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface StreakData {
  currentStreak: number;
  bestStreak: number;
  streakType: string;
  lastLogDate: string | null;
}

interface StreaksMap {
  logging: StreakData | null;
  goals: StreakData | null;
  weight: StreakData | null;
  water: StreakData | null;
}

async function fetchStreaks(userId: string): Promise<StreaksMap> {
  const { data: streakData, error } = await supabase
    .from("user_streaks")
    .select("streak_type, current_streak, best_streak, last_log_date")
    .eq("user_id", userId);

  if (error) throw error;

  const streaksMap: StreaksMap = {
    logging: null,
    goals: null,
    weight: null,
    water: null,
  };

  (streakData || []).forEach((streak) => {
    if (!streak.streak_type) return;
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

  return streaksMap;
}

export function useStreak(userId: string | undefined) {
  const { data: streaks = { logging: null, goals: null, weight: null, water: null }, isLoading: loading, error, refetch } = useQuery({
    queryKey: ["streaks", userId],
    queryFn: () => fetchStreaks(userId!),
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
  });

  return { streaks, loading, error, refresh: refetch };
}
