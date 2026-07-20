import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Award, Gift, Medal, Trophy, Users, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { fetchActiveChallengesFromTable } from "@/hooks/useCommunityChallenges";
import { formatCurrencyCompact } from "@/lib/currency";

type ProfileSummary = {
  xp: number | null;
  level: number | null;
};

type ActiveChallenge = {
  id: string;
  title: string;
  target_value: number;
  user_progress: number;
  is_joined: boolean;
};

type LeaderboardEntry = {
  user_name: string | null;
  avatar_url: string | null;
  current_progress: number | null;
  rank: number | null;
  target_value: number | null;
};

type RewardTransaction = {
  reward_type: string;
  reward_value: number;
  status: string;
};

type QueryResult = {
  data: unknown[] | null;
  error: Error | null;
};

type UntypedQuery = PromiseLike<QueryResult> & {
  eq: (column: string, value: unknown) => UntypedQuery;
};

type UntypedSupabase = {
  from: (table: string) => {
    select: (columns: string) => UntypedQuery;
  };
};

type CommunityExperienceData = {
  profile: ProfileSummary | null;
  earnedBadges: number;
  rewardCount: number;
  rewardCredit: number;
  activeChallengeCount: number;
  joinedChallengeCount: number;
  challenge: ActiveChallenge | null;
  leaderboard: LeaderboardEntry[];
};

const db = supabase as unknown as UntypedSupabase;

const emptyData: CommunityExperienceData = {
  profile: null,
  earnedBadges: 0,
  rewardCount: 0,
  rewardCredit: 0,
  activeChallengeCount: 0,
  joinedChallengeCount: 0,
  challenge: null,
  leaderboard: [],
};

function initials(name: string | null) {
  if (!name) return "N";
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function CommunityExperienceHub() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [data, setData] = useState<CommunityExperienceData>(emptyData);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [profileResult, badgeResult, activeChallenges, rewardsResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("xp, level")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("user_badges")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id),
        fetchActiveChallengesFromTable(user.id),
        db
          .from("reward_transactions")
          .select("reward_type, reward_value, status")
          .eq("user_id", user.id),
      ]);

      if (profileResult.error) throw profileResult.error;
      if (badgeResult.error) throw badgeResult.error;
      if (rewardsResult.error) throw rewardsResult.error;

      const joinedChallenges = activeChallenges.filter((challenge) => challenge.is_joined);
      const challenge =
        joinedChallenges
          .slice()
          .sort((a, b) => {
            const aPct = a.target_value > 0 ? a.user_progress / a.target_value : 0;
            const bPct = b.target_value > 0 ? b.user_progress / b.target_value : 0;
            return bPct - aPct;
          })[0] ?? null;

      let leaderboard: LeaderboardEntry[] = [];
      if (challenge?.id) {
        const { data: leaderboardData } = await supabase
          .from("challenge_leaderboard")
          .select("user_name, avatar_url, current_progress, rank, target_value")
          .eq("challenge_id", challenge.id)
          .order("rank", { ascending: true })
          .limit(5);
        leaderboard = (leaderboardData ?? []) as LeaderboardEntry[];
      }

      const rewardRows = (rewardsResult.data ?? []) as RewardTransaction[];
      const activeRewardRows = rewardRows.filter((reward) =>
        ["granted", "claimed"].includes(reward.status),
      );
      const rewardCredit = activeRewardRows
        .filter((reward) => reward.reward_type === "wallet_credit")
        .reduce((sum, reward) => sum + Number(reward.reward_value || 0), 0);

      setData({
        profile: profileResult.data as ProfileSummary | null,
        earnedBadges: badgeResult.count ?? 0,
        rewardCount: activeRewardRows.length,
        rewardCredit,
        activeChallengeCount: activeChallenges.length,
        joinedChallengeCount: joinedChallenges.length,
        challenge,
        leaderboard,
      });
    } catch (error) {
      console.error("CommunityExperienceHub fetch error:", error);
      setData(emptyData);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!user?.id) return;

    const refresh = () => {
      void fetchData();
    };

    const channel = supabase
      .channel(`community-experience:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles", filter: `user_id=eq.${user.id}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "user_badges", filter: `user_id=eq.${user.id}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "reward_transactions", filter: `user_id=eq.${user.id}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "challenge_participants", filter: `user_id=eq.${user.id}` }, refresh)
      .subscribe();

    window.addEventListener("nutrio:meal-progress-changed", refresh);

    return () => {
      window.removeEventListener("nutrio:meal-progress-changed", refresh);
      void supabase.removeChannel(channel);
    };
  }, [fetchData, user?.id]);

  const xp = data.profile?.xp ?? 0;
  const level = data.profile?.level ?? 1;
  const xpToNext = Math.max(100, level * 100);
  const xpProgress = Math.min(100, Math.round(((xp % xpToNext) / xpToNext) * 100));
  const challengeProgress = data.challenge?.target_value
    ? Math.min(100, Math.round((data.challenge.user_progress / data.challenge.target_value) * 100))
    : 0;

  if (loading) {
    return (
      <div className="space-y-3 p-5">
        <div className="h-28 animate-pulse rounded-[24px] bg-slate-100" />
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-20 animate-pulse rounded-[22px] bg-slate-100" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 bg-white p-5">
      <motion.div
        whileTap={{ scale: 0.985 }}
        onClick={() => navigate("/rewards")}
        className="cursor-pointer rounded-[28px] bg-[#F6F8FB] p-4 ring-1 ring-[#E5EAF1]"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#7C83F6]">{t("community_rewards")}</p>
            <h3 className="mt-1 text-[22px] font-black leading-tight text-[#020617]">{t("community_level", { level })}</h3>
            <p className="mt-1 text-[12px] font-bold text-[#64748B]">
              {data.rewardCount > 0
                ? `${data.rewardCount} ${t("rewards")} - ${formatCurrencyCompact(data.rewardCredit)} ${t("wallet")}`
                : t("community_join_challenge_hint")}
            </p>
          </div>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#020617] text-white">
            <Award className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-white">
            <div className="h-full rounded-full bg-[#22C7A1]" style={{ width: `${Math.max(4, xpProgress)}%` }} />
          </div>
          <span className="text-[11px] font-black text-[#64748B]">{xp} XP</span>
        </div>
      </motion.div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: t("community_active_events"), value: data.activeChallengeCount, Icon: Trophy, className: "text-[#22C7A1] bg-[#EFFFFA]" },
          { label: t("community_joined"), value: data.joinedChallengeCount, Icon: Users, className: "text-[#38BDF8] bg-sky-50" },
          { label: t("community_stat_badges"), value: data.earnedBadges, Icon: Medal, className: "text-[#7C83F6] bg-violet-50" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-[22px] bg-white p-3 ring-1 ring-[#E5EAF1]">
            <div className={`mb-3 flex h-8 w-8 items-center justify-center rounded-full ${stat.className}`}>
              <stat.Icon className="h-4 w-4" />
            </div>
            <p className="text-[20px] font-black leading-none text-[#020617]">{stat.value}</p>
            <p className="mt-1 text-[10px] font-black uppercase tracking-wide text-[#94A3B8]">{stat.label}</p>
          </div>
        ))}
      </div>

      {data.challenge ? (
        <button
          onClick={() => document.getElementById("community-challenges")?.scrollIntoView({ behavior: "smooth", block: "start" })}
          className="flex w-full items-center gap-3 rounded-[24px] bg-[#020617] p-3 text-left text-white transition active:scale-[0.985]"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10">
            <Zap className="h-5 w-5 text-[#22C7A1]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-black">{data.challenge.title}</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15">
              <div className="h-full rounded-full bg-[#22C7A1]" style={{ width: `${Math.max(4, challengeProgress)}%` }} />
            </div>
          </div>
          <span className="text-[12px] font-black text-white/70">{challengeProgress}%</span>
        </button>
      ) : (
        <button
          onClick={() => document.getElementById("community-challenges")?.scrollIntoView({ behavior: "smooth", block: "start" })}
          className="flex w-full items-center gap-3 rounded-[24px] bg-[#F6F8FB] p-3 text-left ring-1 ring-[#E5EAF1] transition active:scale-[0.985]"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-[#22C7A1] ring-1 ring-[#E5EAF1]">
            <Trophy className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-black text-[#020617]">{t("community_join_a_challenge")}</p>
            <p className="mt-0.5 truncate text-[11px] font-bold text-[#64748B]">{t("community_join_challenge_hint")}</p>
          </div>
        </button>
      )}

      {data.leaderboard.length > 0 && (
        <div className="rounded-[26px] bg-[#F6F8FB] p-4 ring-1 ring-[#E5EAF1]">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">{t("community_leaderboard")}</p>
              <h3 className="text-[17px] font-black text-[#020617]">{t("community_top_challengers")}</h3>
            </div>
            <Gift className="h-5 w-5 text-[#22C7A1]" />
          </div>
          <div className="space-y-2">
            {data.leaderboard.map((entry) => (
              <div key={`${entry.rank}-${entry.user_name}`} className="flex items-center gap-3 rounded-[18px] bg-white p-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#020617] text-[11px] font-black text-white">
                  {entry.rank}
                </div>
                {entry.avatar_url ? (
                  <img src={entry.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F6F8FB] text-[11px] font-black text-[#94A3B8]">
                    {initials(entry.user_name)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-black text-[#020617]">{entry.user_name ?? t("community_member")}</p>
                  <p className="text-[10px] font-bold text-[#94A3B8]">
                    {entry.current_progress ?? 0}/{entry.target_value ?? data.challenge?.target_value ?? 0}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
