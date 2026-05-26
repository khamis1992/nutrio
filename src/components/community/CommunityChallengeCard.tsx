import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import {
  Trophy,
  Users,
  Flame,
  Medal,
  ChevronRight,
  Crown,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { springBouncy, fadeInUp } from "@/lib/animations";
import { startOfMonth, endOfMonth, format } from "date-fns";

interface LeaderboardEntry {
  userId: string;
  displayName: string;
  score: number;
  avatar?: string;
}

interface LiveChallenge {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  gradient: string;
  participants: number;
  daysLeft: number;
  leaderboard: LeaderboardEntry[];
}

function anonymizeName(name: string, index: number): string {
  if (!name || name.trim().length === 0) return `User #${String(index + 1000).slice(-4)}`;
  const parts = name.split(" ");
  if (parts.length >= 2) {
    return `${parts[0]} ${parts[1].charAt(0)}.`;
  }
  return parts[0];
}

export function CommunityChallengeCard() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [joined, setJoined] = useState<Set<string>>(new Set());
  const [challenges, setChallenges] = useState<LiveChallenge[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchChallenges = useCallback(async () => {
    try {
      const now = new Date();
      const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
      const monthEnd = format(endOfMonth(now), "yyyy-MM-dd");
      const daysRemain = endOfMonth(now).getDate() - now.getDate();

      const [
        { data: streakLeaders },
        { data: mealLeaders },
        { data: totalStreakers },
        { data: totalMealLoggers },
      ] = await Promise.all([
        supabase
          .from("user_streaks")
          .select("user_id, current_streak, user:profiles!inner(full_name)")
          .eq("streak_type", "logging")
          .order("current_streak", { ascending: false })
          .limit(3),
        supabase
          .from("progress_logs")
          .select("user_id, user:profiles!inner(full_name)")
          .gte("log_date", monthStart)
          .lte("log_date", monthEnd)
          .limit(0),
        supabase
          .from("user_streaks")
          .select("user_id", { count: "exact", head: true })
          .eq("streak_type", "logging"),
        supabase
          .from("progress_logs")
          .select("user_id", { count: "exact", head: true })
          .gte("log_date", monthStart)
          .lte("log_date", monthEnd),
      ]);

      // Count meals per user this month
      const mealCounts = new Map<string, number>();
      if (mealLeaders) {
        const { data: meals } = await supabase
          .from("progress_logs")
          .select("user_id")
          .gte("log_date", monthStart)
          .lte("log_date", monthEnd);

        (meals || []).forEach((m) => {
          mealCounts.set(m.user_id, (mealCounts.get(m.user_id) || 0) + 1);
        });
      }

      const sortedMealLeaders = Array.from(mealCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);

      const mealLeaderProfiles = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", sortedMealLeaders.map(([id]) => id));
      const nameMap = new Map(
        (mealLeaderProfiles.data || []).map((p) => [p.id, p.full_name || ""])
      );

      const leaderboard: LiveChallenge[] = [
        {
          id: "streak-challenge",
          title: "30-Day Streak Challenge",
          description: "Log your meals every day — who can keep the longest streak?",
          icon: Flame,
          gradient: "from-orange-400 to-rose-500",
          participants: (totalStreakers as any)?.count || 0,
          daysLeft: daysRemain,
          leaderboard: (streakLeaders || []).map((entry: any, i: number) => ({
            userId: entry.user_id,
            displayName: anonymizeName(entry.user?.full_name || "", i),
            score: entry.current_streak || 0,
          })),
        },
        {
          id: "meals-challenge",
          title: `Most Meals Logged — ${format(now, "MMMM")}`,
          description: `Who logged the most meals this month?`,
          icon: Medal,
          gradient: "from-violet-400 to-purple-600",
          participants: (totalMealLoggers as any)?.count || 0,
          daysLeft: daysRemain,
          leaderboard: sortedMealLeaders.map(([userId, count], i) => ({
            userId,
            displayName: anonymizeName(nameMap.get(userId) || "", i),
            score: count,
          })),
        },
      ];

      setChallenges(leaderboard);
    } catch (err) {
      console.error("Error fetching challenges:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChallenges();
  }, [fetchChallenges]);

  if (loading) {
    return (
      <Card className="overflow-hidden border-0 shadow-card">
        <div className="bg-gradient-to-r from-orange-400 to-rose-500 px-5 py-3">
          <Skeleton className="h-4 w-40 bg-white/20" />
        </div>
        <CardContent className="p-5 space-y-4">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-[120px] w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </CardContent>
      </Card>
    );
  }

  if (challenges.length === 0) {
    return (
      <Card className="overflow-hidden border-0 shadow-card">
        <div className="bg-gradient-to-r from-orange-400 to-rose-500 px-5 py-3">
          <CardTitle className="text-sm font-bold text-white">Community Challenge</CardTitle>
        </div>
        <CardContent className="p-8 text-center">
          <Trophy className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No active challenges right now</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Start logging meals to see the leaderboard</p>
        </CardContent>
      </Card>
    );
  }

  const challenge = challenges[activeIndex];
  const Icon = challenge.icon;
  const isJoined = joined.has(challenge.id);

  const handleJoin = () => {
    setJoined((prev) => {
      const next = new Set(prev);
      if (next.has(challenge.id)) {
        next.delete(challenge.id);
      } else {
        next.add(challenge.id);
      }
      return next;
    });
  };

  return (
    <motion.div variants={fadeInUp}>
      <Card className="overflow-hidden border-0 shadow-card">
        <div className={`bg-gradient-to-r ${challenge.gradient} px-5 py-3`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                <Icon className="w-4 h-4 text-white" />
              </div>
              <CardTitle className="text-sm font-bold text-white">
                Community Challenge
              </CardTitle>
            </div>
            <Badge className="bg-white/20 text-white border-0 text-[10px] font-semibold">
              <Sparkles className="w-3 h-3 mr-1" />
              Active
            </Badge>
          </div>
        </div>

        <CardContent className="p-5 space-y-4">
          <div>
            <h3 className="font-bold text-foreground">{challenge.title}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {challenge.description}
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              <span className="font-semibold text-foreground">
                {challenge.participants.toLocaleString()}
              </span>
              {" "}participants
            </div>
            <div className="flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-warning" />
              <span className="font-semibold text-foreground">
                {challenge.daysLeft}
              </span>
              {" "}days left
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Top 3 Leaderboard
            </p>
            {challenge.leaderboard.map((entry, i) => (
              <div
                key={entry.userId}
                className="flex items-center gap-3 py-1.5 px-3 rounded-xl bg-muted/50"
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    i === 0
                      ? "bg-warning text-warning-foreground"
                      : i === 1
                        ? "bg-muted-foreground/30 text-muted-foreground"
                        : "bg-muted-foreground/20 text-muted-foreground"
                  }`}
                >
                  {i + 1}
                </div>
                <div className="flex-1 flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Crown className="w-3 h-3 text-primary" />
                  </div>
                  <span className="text-xs font-medium text-foreground truncate">
                    {entry.displayName}
                  </span>
                </div>
                <span className="text-xs font-bold text-primary tabular-nums">
                  {entry.score}
                </span>
              </div>
            ))}
            {challenge.leaderboard.length === 0 && (
              <div className="py-3 px-3 rounded-xl bg-muted/50 text-center">
                <p className="text-xs text-muted-foreground">No entries yet — be the first!</p>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <motion.div className="flex-1" whileTap={{ scale: 0.97 }}>
              <Button
                className={`w-full rounded-xl h-10 text-sm font-semibold ${
                  isJoined
                    ? "bg-success/10 text-success hover:bg-success/20 border border-success/20"
                    : "bg-primary text-primary-foreground hover:bg-primary/90"
                }`}
                onClick={handleJoin}
              >
                {isJoined ? "Joined!" : "Join Challenge"}
              </Button>
            </motion.div>
            {challenges.length > 1 && (
              <Button
                variant="outline"
                size="icon"
                className="w-10 h-10 rounded-xl"
                onClick={() =>
                  setActiveIndex((prev) =>
                    prev === challenges.length - 1 ? 0 : prev + 1
                  )
                }
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}