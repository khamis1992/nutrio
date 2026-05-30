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
      setChallenges((data as CommunityChallenge[]) ?? []);
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
  }, [user?.id, fetch]);

  return { challenges, loading, joiningId, joinChallenge, refresh: fetch };
}
