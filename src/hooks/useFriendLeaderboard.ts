import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FriendLeaderboardEntry {
  friend_user_id: string;
  friend_name: string;
  friend_avatar: string | null;
  current_streak: number;
  xp: number;
  level: number;
  total_meals_logged: number;
  nutrition_score: number;
  composite_score: number;
}

export function useFriendLeaderboard(userId: string | undefined) {
  return useQuery({
    queryKey: ["friend_leaderboard", userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data: friendships, error: friendshipsError } = await supabase
        .from("friendships")
        .select("requester_id,target_id")
        .eq("status", "accepted")
        .or(`requester_id.eq.${userId},target_id.eq.${userId}`);

      if (friendshipsError) throw friendshipsError;

      const friendIds = Array.from(
        new Set(
          (friendships ?? [])
            .map((friendship) =>
              friendship.requester_id === userId ? friendship.target_id : friendship.requester_id,
            )
            .filter(Boolean),
        ),
      );

      if (friendIds.length === 0) return [];

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id,full_name,avatar_url,streak_days,xp,level,total_meals_logged")
        .in("user_id", friendIds);

      if (profilesError) throw profilesError;

      const { data: nutritionRows, error: nutritionError } = await supabase
        .from("daily_performance_snapshots")
        .select("user_id,nutrition_score,snapshot_date")
        .in("user_id", friendIds)
        .order("snapshot_date", { ascending: false });

      if (nutritionError) throw nutritionError;

      const latestNutrition = new Map<string, number>();
      for (const row of nutritionRows ?? []) {
        if (!latestNutrition.has(row.user_id)) {
          latestNutrition.set(row.user_id, row.nutrition_score ?? 0);
        }
      }

      return (profiles ?? [])
        .map((profile) => {
          const nutritionScore = latestNutrition.get(profile.user_id) ?? 0;
          const currentStreak = profile.streak_days ?? 0;
          const xp = profile.xp ?? 0;
          const totalMealsLogged = profile.total_meals_logged ?? 0;
          const compositeScore =
            currentStreak * 3 +
            xp / 20 +
            nutritionScore +
            totalMealsLogged * 2;

          return {
            friend_user_id: profile.user_id,
            friend_name: profile.full_name || "Unknown",
            friend_avatar: profile.avatar_url,
            current_streak: currentStreak,
            xp,
            level: profile.level ?? 0,
            total_meals_logged: totalMealsLogged,
            nutrition_score: nutritionScore,
            composite_score: compositeScore,
          };
        })
        .sort((a, b) => b.composite_score - a.composite_score) as FriendLeaderboardEntry[];
    },
    enabled: !!userId,
    staleTime: 30_000,
  });
}
