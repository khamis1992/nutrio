import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface CommunityChallenge {
  id: string;
  title: string;
  description: string;
  challenge_type: string;
  difficulty_level: string;
  category: string;
  target_value: number;
  reward_points: number;
  xp_reward: number;
  participant_count: number;
  start_date: string;
  end_date: string;
  is_joined: boolean;
  user_progress: number;
  user_rank: number;
  is_local?: boolean;
}

interface PerformanceSnapshotRow {
  snapshot_date: string;
  nutrition_score: number | null;
  protein_consumed_g: number | null;
  protein_target_g: number | null;
  water_percent: number | null;
}

function buildPerformanceChallenges(rows: PerformanceSnapshotRow[]): CommunityChallenge[] {
  const today = new Date();
  const end = new Date(today);
  end.setDate(end.getDate() + 6);

  const highFuelDays = rows.filter((row) => (row.nutrition_score || 0) >= 80).length;
  const proteinDays = rows.filter((row) => (row.protein_target_g || 0) > 0 && (row.protein_consumed_g || 0) >= (row.protein_target_g || 0)).length;
  const hydrationDays = rows.filter((row) => (row.water_percent || 0) >= 100).length;

  const base = {
    difficulty_level: "medium",
    category: "performance",
    reward_points: 0,
    participant_count: 1,
    start_date: today.toISOString().split("T")[0],
    end_date: end.toISOString().split("T")[0],
    is_joined: true,
    user_rank: 1,
    is_local: true,
  };

  return [
    {
      ...base,
      id: "local-fuel-score",
      title: "Fuel Score Streak",
      description: "Hit 80+ Fuel Readiness on 5 days this week.",
      challenge_type: "streak",
      target_value: 5,
      xp_reward: 120,
      user_progress: highFuelDays,
    },
    {
      ...base,
      id: "local-protein-week",
      title: "Protein Week",
      description: "Reach your protein target on 5 days this week.",
      challenge_type: "nutrition",
      target_value: 5,
      xp_reward: 100,
      user_progress: proteinDays,
    },
    {
      ...base,
      id: "local-hydration-week",
      title: "Hydration Week",
      description: "Reach your water target on 5 days this week.",
      challenge_type: "hydration",
      target_value: 5,
      xp_reward: 80,
      user_progress: hydrationDays,
    },
  ];
}

export function useCommunityChallenges() {
  const { user } = useAuth();
  const [challenges, setChallenges] = useState<CommunityChallenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase.rpc("get_active_challenges", {
        p_user_id: user.id,
      });
      if (error) throw error;
      const remoteChallenges = (data as CommunityChallenge[]) ?? [];
      if (remoteChallenges.length > 0) {
        setChallenges(remoteChallenges);
        return;
      }

      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 6);
      const { data: snapshots, error: snapshotError } = await supabase
        .from("daily_performance_snapshots" as never)
        .select("snapshot_date, nutrition_score, protein_consumed_g, protein_target_g, water_percent")
        .eq("user_id", user.id)
        .gte("snapshot_date", weekAgo.toISOString().split("T")[0]);

      if (snapshotError) throw snapshotError;
      setChallenges(buildPerformanceChallenges((snapshots as unknown as PerformanceSnapshotRow[]) ?? []));
    } catch (err) {
      console.error("useCommunityChallenges fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  const joinChallenge = useCallback(async (challengeId: string) => {
    if (!user?.id) return;
    const challenge = challenges.find((item) => item.id === challengeId);
    if (challenge?.is_local) return;
    setJoiningId(challengeId);
    try {
      const { error } = await supabase.rpc("join_challenge", {
        p_challenge_id: challengeId,
        p_user_id: user.id,
      });
      if (error) {
        console.error("joinChallenge error:", error);
        return;
      }
      await fetch();
    } catch (err) {
      console.error("joinChallenge error:", err);
    } finally {
      setJoiningId(null);
    }
  }, [challenges, user?.id, fetch]);

  return { challenges, loading, joiningId, joinChallenge, refresh: fetch };
}
