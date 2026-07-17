import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { syncCommunityChallengeProgressQuietly } from "@/lib/community-challenge-service";
import { getQatarDay } from "@/lib/dateUtils";

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
  wallet_reward_amount?: number;
  participation_mode: "individual" | "team";
  team_size: number;
  participant_count: number;
  start_date: string;
  end_date: string;
  is_joined: boolean;
  user_progress: number;
  user_rank: number;
  is_test?: boolean;
  test_leaderboard?: Array<{
    user_name: string;
    avatar_url: string | null;
    current_progress: number;
    rank: number;
  }>;
}

type ChallengeRow = {
  id: string;
  title: string;
  description: string | null;
  challenge_type: string | null;
  difficulty_level: string | null;
  category: string | null;
  target_value: number;
  reward_points: number | null;
  xp_reward: number | null;
  wallet_reward_amount?: number | null;
  participation_mode?: "individual" | "team" | null;
  team_size?: number | null;
  participant_count: number | null;
  start_date: string;
  end_date: string;
};

type ParticipantRow = {
  challenge_id: string;
  current_progress: number | null;
  completed_at: string | null;
};

type ChallengeQueryResult = {
  data: ChallengeRow[] | null;
  error: { message: string } | null;
};

const TEST_CHALLENGE_ID = "community-test-one-day";

function getTestJoinKey(userId: string, day: string) {
  return `nutrio:${TEST_CHALLENGE_ID}:joined:${userId}:${day}`;
}

function buildCommunityTestChallenge(userId: string, loggedMealsToday: number): CommunityChallenge {
  const today = getQatarDay();
  const tomorrowDate = new Date(`${today}T00:00:00+03:00`);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const isJoined = localStorage.getItem(getTestJoinKey(userId, today)) === "true";
  const progress = isJoined ? Math.min(loggedMealsToday, 1) : 0;

  return {
    id: TEST_CHALLENGE_ID,
    title: "One-Day Community Test",
    description: "Test event for today: log one meal and join the community leaderboard.",
    challenge_type: "meals",
    difficulty_level: "easy",
    category: "nutrition",
    target_value: 1,
    reward_points: 25,
    xp_reward: 25,
    wallet_reward_amount: 5,
    participation_mode: "individual",
    team_size: 5,
    participant_count: 0,
    start_date: today,
    end_date: getQatarDay(tomorrowDate),
    is_joined: isJoined,
    user_progress: progress,
    user_rank: isJoined ? 1 : 0,
    is_test: true,
  };
}

async function countTodayLoggedMeals(userId: string) {
  const today = getQatarDay();
  const { count, error } = await supabase
    .from("meal_history")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("logged_at", `${today}T00:00:00+03:00`)
    .lte("logged_at", `${today}T23:59:59+03:00`);

  if (error) throw error;
  return count ?? 0;
}

async function getCurrentUserLeaderboardName(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("full_name, avatar_url")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  return {
    name: data?.full_name?.trim() || "You",
    avatarUrl: data?.avatar_url || null,
  };
}

async function buildTestChallengeList(userId: string) {
  const [loggedMealsToday, profile] = await Promise.all([
    countTodayLoggedMeals(userId),
    getCurrentUserLeaderboardName(userId),
  ]);
  const testChallenge = buildCommunityTestChallenge(userId, loggedMealsToday);

  return [
    testChallenge.is_joined
      ? {
          ...testChallenge,
          participant_count: 1,
          test_leaderboard: [
            {
              user_name: profile.name,
              avatar_url: profile.avatarUrl,
              current_progress: testChallenge.user_progress,
              rank: 1,
            },
          ],
        }
      : testChallenge,
  ];
}

export async function fetchActiveChallengesFromTable(userId: string): Promise<CommunityChallenge[]> {
  const today = getQatarDay();
  const challengeSelect =
    "id,title,description,challenge_type,difficulty_level,category,target_value,reward_points,xp_reward,wallet_reward_amount,participation_mode,team_size,participant_count,start_date,end_date";
  const challengeSelectWithoutTeams =
    "id,title,description,challenge_type,difficulty_level,category,target_value,reward_points,xp_reward,wallet_reward_amount,participant_count,start_date,end_date";
  const challengeSelectWithoutWallet =
    "id,title,description,challenge_type,difficulty_level,category,target_value,reward_points,xp_reward,participation_mode,team_size,participant_count,start_date,end_date";
  const legacyChallengeSelect =
    "id,title,description,challenge_type,difficulty_level,category,target_value,reward_points,xp_reward,participant_count,start_date,end_date";

  const query = (columns: string, includeDateWindow: boolean) => {
    let request = supabase
      .from("community_challenges")
      .select(columns)
      .eq("is_active", true);

    if (includeDateWindow) {
      request = request.lte("start_date", today).gte("end_date", today);
    }

    return request.order("start_date", { ascending: false }) as unknown as Promise<ChallengeQueryResult>;
  };

  const runCompatibleQuery = async (includeDateWindow: boolean) => {
    const candidates = [
      { columns: challengeSelect, wallet: true, teams: true },
      { columns: challengeSelectWithoutTeams, wallet: true, teams: false },
      { columns: challengeSelectWithoutWallet, wallet: false, teams: true },
      { columns: legacyChallengeSelect, wallet: false, teams: false },
    ];

    let lastResult: ChallengeQueryResult = { data: null, error: null };
    for (const candidate of candidates) {
      lastResult = await query(candidate.columns, includeDateWindow);
      if (!lastResult.error) {
        lastResult.data = lastResult.data?.map((row) => ({
          ...row,
          wallet_reward_amount: candidate.wallet ? row.wallet_reward_amount : 0,
          participation_mode: candidate.teams
            ? row.participation_mode ?? "individual"
            : "individual",
          team_size: candidate.teams ? row.team_size ?? 5 : 5,
        })) ?? null;
        return lastResult;
      }

      const isSchemaMismatch =
        lastResult.error.message.includes("participation_mode") ||
        lastResult.error.message.includes("team_size") ||
        lastResult.error.message.includes("wallet_reward_amount");
      if (!isSchemaMismatch) return lastResult;
    }

    return lastResult;
  };

  let { data, error } = await runCompatibleQuery(true);

  if (error) throw error;

  if ((data?.length ?? 0) === 0) {
    const enabledFallback = await runCompatibleQuery(false);
    data = enabledFallback.data;
    error = enabledFallback.error;

    if (error) throw error;
  }

  const rows = data ?? [];
  if (rows.length === 0) return [];

  const challengeIds = rows.map((challenge) => challenge.id);
  const { data: participantData, error: participantError } = await supabase
    .from("challenge_participants")
    .select("challenge_id,current_progress,completed_at")
    .eq("user_id", userId)
    .in("challenge_id", challengeIds);

  if (participantError) throw participantError;

  const participantByChallenge = new Map(
    ((participantData ?? []) as ParticipantRow[]).map((participant) => [
      participant.challenge_id,
      participant,
    ]),
  );

  return rows.map((challenge) => {
    const participant = participantByChallenge.get(challenge.id);

    return {
      id: challenge.id,
      title: challenge.title,
      description: challenge.description ?? "",
      challenge_type: challenge.challenge_type ?? "meals",
      difficulty_level: challenge.difficulty_level ?? "easy",
      category: challenge.category ?? "community",
      target_value: Number(challenge.target_value || 0),
      reward_points: Number(challenge.reward_points || 0),
      xp_reward: Number(challenge.xp_reward || 0),
      wallet_reward_amount: Number(challenge.wallet_reward_amount || 0),
      participation_mode: challenge.participation_mode ?? "individual",
      team_size: Number(challenge.team_size || 5),
      participant_count: Number(challenge.participant_count || 0),
      start_date: challenge.start_date,
      end_date: challenge.end_date,
      is_joined: Boolean(participant),
      user_progress: Number(participant?.current_progress || 0),
      user_rank: 0,
    };
  });
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
      const remoteChallenges = await fetchActiveChallengesFromTable(user.id);
      if (remoteChallenges.length > 0) {
        setChallenges(remoteChallenges);
        return;
      }

      setChallenges(await buildTestChallengeList(user.id));
    } catch {
      setChallenges(await buildTestChallengeList(user.id));
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`community-challenges:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "challenge_participants",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void fetch();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "meal_history",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void fetch();
        },
      )
      .subscribe();

    const refresh = () => {
      void fetch();
    };

    window.addEventListener("nutrio:meal-progress-changed", refresh);

    return () => {
      window.removeEventListener("nutrio:meal-progress-changed", refresh);
      void supabase.removeChannel(channel);
    };
  }, [fetch, user?.id]);

  const joinChallenge = useCallback(async (challengeId: string) => {
    if (!user?.id) return;
    const challenge = challenges.find((item) => item.id === challengeId);
    if (!challenge) return;
    if (challenge.is_test) {
      localStorage.setItem(getTestJoinKey(user.id, getQatarDay()), "true");
      await fetch();
      return;
    }
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
      await syncCommunityChallengeProgressQuietly(user.id);
      await fetch();
    } catch (err) {
      console.error("joinChallenge error:", err);
    } finally {
      setJoiningId(null);
    }
  }, [challenges, user?.id, fetch]);

  return { challenges, loading, joiningId, joinChallenge, refresh: fetch };
}
