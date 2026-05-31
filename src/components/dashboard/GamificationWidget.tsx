import { useState, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Trophy, Star, ChevronRight, Zap, Lock } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { springBouncy } from "@/lib/animations";
import { cn } from "@/lib/utils";

interface DBadge {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: string;
  xp_reward: number;
}

interface EarnedBadge {
  badge_id: string;
  unlocked_at: string;
}

export function GamificationDashboardWidget() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const prefersReducedMotion = useReducedMotion();
  const [xp, setXp] = useState(0);
  const [level, setLevel] = useState(1);
  const [xpToNextLevel, setXpToNextLevel] = useState(100);
  const [badges, setBadges] = useState<DBadge[]>([]);
  const [earnedIds, setEarnedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchData = async () => {
      try {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("level")
          .eq("user_id", user.id)
          .single();

        if (profileError) throw profileError;

        const userXp = profile?.xp || 0;
        const userLevel = profile?.level || 1;
        const needed = userLevel * 100;

        if (!cancelled) {
          setXp(userXp);
          setLevel(userLevel);
          setXpToNextLevel(needed);
        }

        const [{ data: allBadges }, { data: earned }] = await Promise.all([
          supabase
            .from("badges")
            .select("id, name, description, icon, rarity, xp_reward")
            .order("xp_reward", { ascending: true }),
          supabase
            .from("user_badges")
            .select("badge_id, unlocked_at")
            .eq("user_id", user.id),
        ]);

        if (cancelled) return;

        setBadges((allBadges || []) as unknown as DBadge[]);
        setEarnedIds(new Set((earned || []).map((b: EarnedBadge) => b.badge_id)));
      } catch (err) {
        console.error("GamificationDashboardWidget fetch error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const xpProgress = Math.min((xp / xpToNextLevel) * 100, 100);
  const nextBadges = badges.filter((b) => !earnedIds.has(b.id));
  const nextBadge = nextBadges.length > 0 ? nextBadges[0] : null;
  const xpToNextBadge = nextBadge ? Math.max(0, nextBadge.xp_reward - xp) : 0;

  const earnedBadges = badges.filter((b) => earnedIds.has(b.id));

  const rarityConfig: Record<string, { bg: string; border: string; gradient: string }> = {
    common: { bg: "bg-gray-50", border: "border-gray-200", gradient: "from-gray-400 to-gray-500" },
    rare: { bg: "bg-blue-50", border: "border-blue-200", gradient: "from-blue-400 to-blue-600" },
    epic: { bg: "bg-purple-50", border: "border-purple-200", gradient: "from-purple-400 to-purple-600" },
    legendary: { bg: "bg-amber-50", border: "border-amber-200", gradient: "from-amber-400 to-amber-600" },
  };

  const badgeIcon = (iconName: string) => {
    const map: Record<string, React.ReactNode> = {
      star: <Star className="w-5 h-5" />,
      flame: <Zap className="w-5 h-5" />,
      trophy: <Trophy className="w-5 h-5" />,
      target: <Star className="w-5 h-5" />,
      crown: <Trophy className="w-5 h-5" />,
      medal: <Zap className="w-5 h-5" />,
      award: <Trophy className="w-5 h-5" />,
      zap: <Zap className="w-5 h-5" />,
      shield: <Star className="w-5 h-5" />,
      heart: <Star className="w-5 h-5" />,
    };
    return map[iconName?.toLowerCase()] || <Star className="w-5 h-5" />;
  };

  if (loading) {
    return (
      <div className="rounded-2xl bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-200 p-4 animate-pulse">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl bg-violet-200" />
          <div className="flex-1">
            <div className="h-4 w-20 bg-violet-200 rounded mb-1" />
            <div className="h-3 w-28 bg-violet-100 rounded" />
          </div>
        </div>
        <div className="h-2 bg-violet-200 rounded-full" />
      </div>
    );
  }

  return (
    <motion.div
      className="rounded-2xl bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-200 overflow-hidden"
      whileTap={prefersReducedMotion ? undefined : { scale: 0.99, transition: springBouncy }}
    >
      <motion.div
        className="p-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-sm">
            <Trophy className="w-4.5 h-4.5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-violet-900">
              {t("level_label") || `Level ${level}`}
            </p>
            <p className="text-[10px] text-violet-500">
              {xpToNextBadge > 0 && nextBadge
                ? (t("xp_to_badge") || `${xpToNextBadge} XP to ${nextBadge.name}`)
                  .replace("{xp}", String(xpToNextBadge))
                  .replace("{badge}", nextBadge.name)
                : t("max_level") || "Max level reached!"}
            </p>
          </div>
          <motion.div
            animate={prefersReducedMotion ? {} : { rotate: expanded ? 90 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronRight className="w-4 h-4 text-violet-400" />
          </motion.div>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-[10px]">
            <span className="text-violet-600 font-medium">
              {xp} / {xpToNextLevel} XP
            </span>
            <span className="text-violet-400">
              {t("earned_badges") || `${earnedBadges.length} badges`}
            </span>
          </div>
          <Progress value={xpProgress} className="h-1.5 bg-violet-200 [&>div]:bg-violet-500" />
        </div>
      </motion.div>

      {expanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="px-4 pb-4 space-y-3"
        >
          {earnedBadges.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-violet-800 mb-2">
                {t("earned_badges") || "Earned Badges"}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {earnedBadges.map((badge) => {
                  const cfg = rarityConfig[badge.rarity] || rarityConfig.common;
                  return (
                    <div
                      key={badge.id}
                      className={cn(
                        "rounded-lg border p-1.5 flex items-center gap-1.5",
                        cfg.bg,
                        cfg.border
                      )}
                      title={`${badge.name}: ${badge.description}`}
                    >
                      <div
                        className={cn(
                          "w-6 h-6 rounded flex items-center justify-center text-white bg-gradient-to-br",
                          cfg.gradient
                        )}
                      >
                        {badgeIcon(badge.icon)}
                      </div>
                      <span className="text-[10px] font-medium text-slate-700 hidden sm:inline">
                        {badge.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {nextBadges.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-violet-800 mb-2">
                {t("upcoming_badges") || "Up Next"}
              </p>
              <div className="space-y-1.5">
                {nextBadges.slice(0, 4).map((badge) => {
                  const cfg = rarityConfig[badge.rarity] || rarityConfig.common;
                  return (
                    <div
                      key={badge.id}
                      className="flex items-center gap-2 p-2 rounded-lg bg-white/50 border border-violet-100"
                    >
                      <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center">
                        <Lock className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-700">
                          {badge.name}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          +{badge.xp_reward} XP
                        </p>
                      </div>
                      <span
                        className={cn(
                          "text-[9px] font-medium px-2 py-0.5 rounded-full capitalize",
                          cfg.bg,
                          cfg.border
                        )}
                      >
                        {badge.rarity}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="text-[10px] text-violet-500 leading-relaxed bg-white/50 p-2.5 rounded-xl border border-violet-100">
            <p className="font-semibold mb-1 text-violet-700">
              {t("how_to_earn") || "How to earn XP"}
            </p>
            <ul className="space-y-0.5 list-disc list-inside">
              <li>{t("earn_xp_log_meal") || "Log meals daily"}</li>
              <li>{t("earn_xp_streak") || "Maintain your streaks"}</li>
              <li>{t("earn_xp_goals") || "Hit your macro targets"}</li>
              <li>{t("earn_xp_badges") || "Unlock badges"}</li>
            </ul>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
