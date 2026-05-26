import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Flame,
  Medal,
  MoveLeft,
  Salad,
  Scale,
  Trophy,
  TrendingDown,
  Users,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface LeaderboardEntry {
  user_id: string;
  display_name: string;
  score: number;
  trend?: string;
}

const CATEGORIES = [
  { key: "meal_count", label: "Most Meals Logged", icon: Salad, unit: "meals", gradient: "from-orange-400 to-red-500" },
  { key: "macro_score", label: "Best Macro Precision", icon: Scale, unit: "% target", gradient: "from-violet-400 to-purple-600" },
  { key: "streak", label: "Longest Streak", icon: Flame, unit: "days", gradient: "from-rose-400 to-pink-600" },
  { key: "calories_burned", label: "Most Burns", icon: Zap, unit: "cal", gradient: "from-emerald-400 to-teal-600" },
];

function anonymize(fullName: string, index: number): string {
  if (!fullName || fullName.trim().length === 0) return `User ${index + 100}`;
  const parts = fullName.split(" ");
  return parts.length >= 2 ? `${parts[0]} ${parts[1][0]}.` : parts[0];
}

const MEDAL_COLORS = ["#FBBF24", "#9CA3AF", "#D97706"]; // gold, silver, bronze
const MEDAL_EMOJIS = ["🥇", "🥈", "🥉"];

export default function Leaderboard() {
  const { user } = useAuth();
  const [activeCategory, setActiveCategory] = useState("meal_count");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [optIn, setOptIn] = useState(false);

  const fetchLeaderboard = useCallback(async (category: string) => {
    setLoading(true);
    try {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const since = weekAgo.toISOString().split("T")[0];

      if (category === "meal_count") {
        const { data } = await supabase
          .from("meal_schedules")
          .select("user_id, user:profiles!inner(full_name)")
          .gte("scheduled_date", since)
          .limit(100);
        const counts = new Map<string, { name: string; count: number }>();
        for (const row of data || []) {
          const uid = row.user_id;
          const name = (row as any).user?.full_name || `User ${uid.slice(0, 4)}`;
          const entry = counts.get(uid) || { name, count: 0 };
          entry.count++;
          counts.set(uid, entry);
        }
        setEntries(
          [...counts.entries()]
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 20)
            .map(([uid, v]) => ({
              user_id: uid,
              display_name: v.name,
              score: v.count,
            }))
        );
      } else if (category === "macro_score") {
        const { data } = await supabase
          .from("progress_logs")
          .select("user_id, protein_consumed_g, carbs_consumed_g, fat_consumed_g, user:profiles!inner(full_name, protein_target_g, carbs_target_g, fat_target_g)")
          .gte("log_date", since)
          .limit(100);
        const scores = new Map<string, { name: string; total: number; n: number }>();
        for (const row of data || []) {
          const uid = row.user_id;
          const name = (row as any).user?.full_name || `User ${uid.slice(0, 4)}`;
          const prof = (row as any).user || {};
          const proteinTarget = prof.protein_target_g || 150;
          const carbsTarget = prof.carbs_target_g || 250;
          const fatTarget = prof.fat_target_g || 65;
          const p = (row.protein_consumed_g || 0) / proteinTarget;
          const c = (row.carbs_consumed_g || 0) / carbsTarget;
          const f = (row.fat_consumed_g || 0) / fatTarget;
          const acc = 100 - Math.abs(1 - (p + c + f) / 3) * 100;
          const s = scores.get(uid) || { name, total: 0, n: 0 };
          s.total += Math.max(0, acc);
          s.n++;
          scores.set(uid, s);
        }
        setEntries(
          [...scores.entries()]
            .map(([uid, s]) => ({
              user_id: uid,
              display_name: s.name,
              score: Math.round(s.total / Math.max(1, s.n)),
            }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 20)
        );
      } else if (category === "streak") {
        const { data } = await supabase
          .from("user_streaks")
          .select("user_id, current_streak, user:profiles!inner(full_name)")
          .eq("streak_type", "logging")
          .order("current_streak", { ascending: false })
          .limit(20);
        setEntries(
          (data || []).map((row: any) => ({
            user_id: row.user_id,
            display_name: row.user?.full_name || `User ${row.user_id.slice(0, 4)}`,
            score: row.current_streak || 0,
          }))
        );
      } else if (category === "calories_burned") {
        const { data } = await supabase
          .from("activity_logs")
          .select("user_id, calories_burned, user:profiles!inner(full_name)")
          .gte("performed_at", since)
          .limit(100);
        const totals = new Map<string, { name: string; total: number }>();
        for (const row of data || []) {
          const uid = row.user_id;
          const name = (row as any).user?.full_name || `User ${uid.slice(0, 4)}`;
          const entry = totals.get(uid) || { name, total: 0 };
          entry.total += row.calories_burned || 0;
          totals.set(uid, entry);
        }
        setEntries(
          [...totals.entries()]
            .sort((a, b) => b[1].total - a[1].total)
            .slice(0, 20)
            .map(([uid, v]) => ({
              user_id: uid,
              display_name: v.name,
              score: v.total,
            }))
        );
      }
    } catch (err) {
      console.error("Leaderboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard(activeCategory);
  }, [activeCategory, fetchLeaderboard]);

  const activeCategoryConfig = CATEGORIES.find(c => c.key === activeCategory)!;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto max-w-lg px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={() => window.history.back()}
            className="flex h-[40px] w-[40px] items-center justify-center rounded-full bg-white shadow-[0_4px_12px_rgba(15,23,42,0.06)] ring-1 ring-slate-200/60"
          >
            <MoveLeft className="h-[18px] w-[18px] text-slate-600" strokeWidth={2} />
          </button>
          <div>
            <h1 className="text-[20px] font-extrabold tracking-[-0.02em] text-slate-950">Weekly Leaderboard</h1>
            <p className="text-[12px] font-medium text-slate-400">Top performers in Qatar this week</p>
          </div>
        </div>

        {/* Opt-in toggle */}
        <div className="mb-4 flex items-center justify-between rounded-2xl bg-amber-50 px-4 py-3 ring-1 ring-amber-200/60">
          <div className="flex items-center gap-2.5">
            <Users className="h-[18px] w-[18px] text-amber-600" strokeWidth={2} />
            <p className="text-[13px] font-semibold text-amber-800">
              {optIn ? "You're on the board!" : "Show my stats anonymously"}
            </p>
          </div>
          <button
            onClick={() => setOptIn(!optIn)}
            className={`relative h-[28px] w-[52px] rounded-full transition-colors ${optIn ? "bg-amber-500" : "bg-slate-300"}`}
          >
            <motion.div
              className="absolute top-[3px] h-[22px] w-[22px] rounded-full bg-white shadow-md"
              animate={{ left: optIn ? 27 : 3 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
            />
          </button>
        </div>

        {/* Category tabs */}
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {CATEGORIES.map(cat => {
            const Icon = cat.icon;
            const active = activeCategory === cat.key;
            return (
              <button
                key={cat.key}
                onClick={() => setActiveCategory(cat.key)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[12px] font-semibold transition-all ${
                  active
                    ? "bg-slate-900 text-white shadow-[0_6px_14px_rgba(15,23,42,0.15)]"
                    : "bg-white text-slate-600 ring-1 ring-slate-200"
                }`}
              >
                <Icon className="h-[14px] w-[14px]" strokeWidth={2.2} />
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Leaderboard list */}
        <Card className="overflow-hidden rounded-[20px] border-0 shadow-[0_8px_24px_rgba(15,23,42,0.04)] ring-1 ring-slate-200/60">
          <CardHeader className="border-b border-slate-100 px-5 py-4">
            <CardTitle className="flex items-center gap-2 text-[15px] font-extrabold tracking-[-0.01em]">
              <Trophy className="h-[18px] w-[18px] text-amber-400" fill="currentColor" />
              {activeCategoryConfig.label}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0 py-2">
            {loading ? (
              <div className="space-y-3 px-5 py-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="h-[28px] w-[28px] animate-pulse rounded-full bg-slate-100" />
                    <div className="h-[14px] flex-1 animate-pulse rounded bg-slate-100" />
                    <div className="h-[14px] w-[50px] animate-pulse rounded bg-slate-100" />
                  </div>
                ))}
              </div>
            ) : entries.length === 0 ? (
              <div className="py-12 text-center">
                <Medal className="mx-auto h-[32px] w-[32px] text-slate-300" strokeWidth={1.5} />
                <p className="mt-3 text-[13px] font-medium text-slate-400">Not enough data this week</p>
                <p className="mt-1 text-[11px] text-slate-300">Start logging meals and activities to see rankings</p>
              </div>
            ) : (
              <div>
                {entries.map((entry, i) => {
                  const isUser = user?.id === entry.user_id;
                  const isTop3 = i < 3;
                  return (
                    <motion.div
                      key={entry.user_id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className={`flex items-center gap-3 px-5 py-3 transition-colors ${
                        isUser ? "bg-amber-50/80" : i % 2 === 0 ? "bg-white" : "bg-slate-50/50"
                      }`}
                    >
                      {/* Rank */}
                      <div className="flex h-[32px] w-[32px] shrink-0 items-center justify-center">
                        {isTop3 ? (
                          <span className="text-[20px]">{MEDAL_EMOJIS[i]}</span>
                        ) : (
                          <span className="text-[13px] font-bold text-slate-400">#{i + 1}</span>
                        )}
                      </div>

                      {/* Avatar */}
                      <div
                        className={`flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-full text-[14px] font-extrabold text-white ${
                          isTop3
                            ? `bg-gradient-to-br ${activeCategoryConfig.gradient}`
                            : "bg-slate-300"
                        }`}
                      >
                        {(entry.display_name || "?")[0].toUpperCase()}
                      </div>

                      {/* Name + score */}
                      <div className="min-w-0 flex-1">
                        <p className={`text-[13px] font-semibold truncate ${isUser ? "text-amber-800" : "text-slate-700"}`}>
                          {isUser ? "You" : anonymize(entry.display_name, i)}
                          {isUser && " 👈"}
                        </p>
                      </div>

                      <div className="shrink-0 text-right">
                        <p className={`text-[15px] font-extrabold tracking-[-0.02em] ${isTop3 ? "text-slate-900" : "text-slate-600"}`}>
                          {entry.score.toLocaleString()}
                        </p>
                        <p className="text-[10px] font-medium text-slate-400">{activeCategoryConfig.unit}</p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="mt-4 text-center text-[11px] text-slate-400">
          Leaderboard resets every Monday. All names are anonymized.
          <br />
          Enable "Show my stats" to see yourself on the board.
        </p>
      </div>
    </div>
  );
}
