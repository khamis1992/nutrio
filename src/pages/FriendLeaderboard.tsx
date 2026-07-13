import { useState } from "react";
import { motion } from "framer-motion";
import { Trophy, Flame, Star, Salad, Medal, Zap, MoveLeft, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useFriendLeaderboard, FriendLeaderboardEntry } from "@/hooks/useFriendLeaderboard";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { fetchLatestNutritionScore } from "@/lib/pending-schema-queries";

type SortMode = "composite" | "streak" | "xp" | "nutrition";

const SORT_TABS: { key: SortMode; label: string; icon: typeof Trophy }[] = [
  { key: "composite", label: "Overall", icon: Trophy },
  { key: "streak", label: "Streak", icon: Flame },
  { key: "xp", label: "XP", icon: Zap },
  { key: "nutrition", label: "Nutrition", icon: Salad },
];

function sortEntries(entries: FriendLeaderboardEntry[], mode: SortMode) {
  const copy = [...entries];
  switch (mode) {
    case "streak":
      return copy.sort((a, b) => b.current_streak - a.current_streak);
    case "xp":
      return copy.sort((a, b) => b.xp - a.xp);
    case "nutrition":
      return copy.sort((a, b) => b.nutrition_score - a.nutrition_score);
    default:
      return copy.sort((a, b) => b.composite_score - a.composite_score);
  }
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n.charAt(0))
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const MEDAL_EMOJIS = ["🥇", "🥈", "🥉"];

export default function FriendLeaderboard() {
  const { user } = useAuth();
  const [sortMode, setSortMode] = useState<SortMode>("composite");
  const { data: leaderboard = [], isLoading } = useFriendLeaderboard(user?.id);

  const { data: myStats } = useQuery({
    queryKey: ["my_leaderboard_stats", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("profiles")
        .select("xp, level, streak_days, total_meals_logged")
        .eq("user_id", user.id)
        .single();
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: myNutritionScore } = useQuery({
    queryKey: ["my_nutrition_score", user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      return fetchLatestNutritionScore(user.id);
    },
    enabled: !!user?.id,
  });

  const myCompositeScore =
    (myStats?.streak_days ?? 0) * 3 +
    (myStats?.xp ?? 0) / 20 +
    (myNutritionScore ?? 0) +
    (myStats?.total_meals_logged ?? 0) * 2;

  const sorted = sortEntries(leaderboard, sortMode);
  const myRank = sorted.findIndex((e) => e.friend_user_id === user?.id) + 1;


  return (
    <div className="min-h-screen bg-[#F5F7FA] pb-20">
      <div className="bg-gradient-to-br from-[#10A86C] to-[#059A5A] px-5 pt-12 pb-6 shadow-[0_8px_24px_rgba(16,185,129,0.2)]">
        <div className="flex items-center gap-3">
          <button
            data-testid="friend-leaderboard-back-btn"
            onClick={() => window.history.back()}
            className="flex h-[40px] w-[40px] items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm hover:bg-white/30"
          >
            <MoveLeft className="h-[18px] w-[18px]" strokeWidth={2} />
          </button>
          <div>
            <h1 className="text-[28px] font-black tracking-[-0.03em] text-white">
              Friend Leaderboard
            </h1>
            <p className="mt-1 text-[15px] font-medium text-white/80">
              Compare streaks, XP, and nutrition scores
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 py-6">
        {myStats && (
          <div className="mb-4 rounded-[22px] bg-gradient-to-br from-amber-50 to-amber-100/60 p-4 shadow-sm ring-1 ring-amber-200/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md">
                  <Medal className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-[15px] font-bold text-amber-900">
                    Your Rank: {myRank > 0 ? `#${myRank}` : "—"}
                  </p>
                  <div className="mt-1 flex items-center gap-3 text-[13px] font-semibold text-amber-700">
                    <span className="flex items-center gap-1">
                      <Flame className="h-3.5 w-3.5" /> {myStats.streak_days ?? 0}
                    </span>
                    <span className="flex items-center gap-1">
                      <Zap className="h-3.5 w-3.5" /> {myStats.xp ?? 0} XP
                    </span>
                    <span className="flex items-center gap-1">
                      <Star className="h-3.5 w-3.5" /> Lv.{myStats.level ?? 0}
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[22px] font-black text-amber-600">
                  {Math.round(myCompositeScore)}
                </p>
                <p className="text-[11px] font-medium text-amber-500">score</p>
              </div>
            </div>
          </div>
        )}

        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {SORT_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = sortMode === tab.key;
            return (
              <button
                key={tab.key}
                data-testid={`friend-leaderboard-tab-${tab.key}`}
                onClick={() => setSortMode(tab.key)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2.5 text-[14px] font-bold transition-all ${
                  active
                    ? "bg-[#10A86C] text-white shadow-[0_4px_12px_rgba(16,185,129,0.3)]"
                    : "bg-white text-[#6B7588] ring-1 ring-[#E5EAF0]"
                }`}
              >
                <Icon className="h-4 w-4" strokeWidth={2.2} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-[#E5EAF0]">
                <div className="h-14 w-14 animate-pulse rounded-full bg-[#E5EAF0]" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 animate-pulse rounded bg-[#E5EAF0]" />
                  <div className="h-3 w-24 animate-pulse rounded bg-[#E5EAF0]" />
                </div>
                <div className="h-6 w-16 animate-pulse rounded bg-[#E5EAF0]" />
              </div>
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#F1F3F6]">
              <Users className="h-10 w-10 text-[#7A869A]" strokeWidth={1.5} />
            </div>
            <p className="mt-4 text-[18px] font-bold text-[#111827]">
              No friends yet
            </p>
            <p className="mt-2 text-center text-[15px] font-medium text-[#6B7588]">
              Add friends to start comparing your progress
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sorted.map((entry, i) => {
              const isUser = entry.friend_user_id === user?.id;
              const isTop3 = i < 3;
              const score =
                sortMode === "streak"
                  ? entry.current_streak
                  : sortMode === "xp"
                  ? entry.xp
                  : sortMode === "nutrition"
                  ? entry.nutrition_score
                  : entry.composite_score;

              const unit =
                sortMode === "streak"
                  ? "days"
                  : sortMode === "xp"
                  ? "XP"
                  : sortMode === "nutrition"
                  ? "/100"
                  : "pts";

              return (
                <motion.div
                  key={entry.friend_user_id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className={`flex items-center gap-3 rounded-[22px] p-4 shadow-sm ring-1 transition-all ${
                    isUser
                      ? "bg-gradient-to-r from-[#10A86C]/5 to-white ring-[#10A86C]/30"
                      : "bg-white ring-[#E5EAF0]"
                  }`}
                >
                  <div className="flex w-8 shrink-0 items-center justify-center">
                    {isTop3 ? (
                      <span className="text-[20px]">{MEDAL_EMOJIS[i]}</span>
                    ) : (
                      <span className="text-[13px] font-bold text-[#9CA3AF]">
                        #{i + 1}
                      </span>
                    )}
                  </div>

                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#10A86C] to-[#059A5A] text-white shadow-[0_4px_12px_rgba(16,185,129,0.2)]">
                    {entry.friend_avatar ? (
                      <img
                        src={entry.friend_avatar}
                        alt={entry.friend_name}
                        className="h-full w-full rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-[18px] font-bold">
                        {getInitials(entry.friend_name)}
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[17px] font-bold text-[#111827]">
                      {entry.friend_name}
                    </p>
                    <div className="mt-1 flex items-center gap-2 text-[13px] font-medium text-[#6B7588]">
                      <span className="flex items-center gap-1">
                        <Flame className="h-3.5 w-3.5 text-[#FF850F]" />
                        {entry.current_streak}
                      </span>
                      <span>Lv.{entry.level}</span>
                      <span>{entry.nutrition_score}%</span>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-[20px] font-black text-[#111827]">
                      {score.toLocaleString()}
                    </p>
                    <p className="text-[11px] font-medium text-[#9CA3AF]">{unit}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
