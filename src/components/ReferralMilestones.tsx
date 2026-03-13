import { useState, useEffect } from "react";
import { Trophy, Gift, Check, Lock, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/currency";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";

interface Milestone {
  id: string;
  referral_count: number;
  bonus_amount: number;
  bonus_type: string;
  name: string;
  description: string | null;
}

interface Achievement {
  milestone_id: string;
  achieved_at: string;
  bonus_credited: boolean;
}

export function ReferralMilestones() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [currentReferrals, setCurrentReferrals] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      const { data: milestonesData, error: milestonesError } = await supabase
        .from("referral_milestones")
        .select("*")
        .eq("is_active", true)
        .order("referral_count", { ascending: true });

      if (milestonesError) {
        console.error("Error fetching milestones:", milestonesError);
      } else {
        setMilestones(milestonesData || []);
      }

      const { data: achievementsData, error: achievementsError } = await supabase
        .from("user_milestone_achievements")
        .select("milestone_id, achieved_at, bonus_credited")
        .eq("user_id", user!.id);

      if (achievementsError) {
        console.error("Error fetching achievements:", achievementsError);
      } else {
        setAchievements(achievementsData || []);
      }

      const { count } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("tier1_referrer_id", user!.id);

      setCurrentReferrals(count || 0);
    } catch (error) {
      console.error("Error fetching milestone data:", error);
    } finally {
      setLoading(false);
    }
  };

  const isAchieved = (milestoneId: string) =>
    achievements.some((a) => a.milestone_id === milestoneId);

  const getNextMilestone = () =>
    milestones.find((m) => !isAchieved(m.id) && m.referral_count > currentReferrals);

  const getProgressToNext = () => {
    const next = getNextMilestone();
    if (!next) return 100;
    const prevMilestone = milestones
      .filter((m) => m.referral_count < next.referral_count)
      .sort((a, b) => b.referral_count - a.referral_count)[0];
    const start = prevMilestone?.referral_count || 0;
    return Math.min(((currentReferrals - start) / (next.referral_count - start)) * 100, 100);
  };

  if (loading) {
    return (
      <div className="bg-card/95 rounded-3xl border border-border/70 shadow-md p-4 flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (milestones.length === 0) return null;

  const nextMilestone = getNextMilestone();
  const achievedCount = achievements.length;
  const totalBonusEarned = milestones
    .filter((m) => isAchieved(m.id))
    .reduce((sum, m) => sum + m.bonus_amount, 0);
  const progressPct = getProgressToNext();

  const visibleMilestones = expanded ? milestones : milestones.slice(0, 3);

  return (
    <div className="bg-card/95 rounded-3xl border border-border/70 shadow-md p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Gift className="h-4.5 w-4.5 text-primary" />
          </div>
          <p className="font-bold text-foreground">{t("affiliate_milestone_bonuses")}</p>
        </div>
        <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full">
          {achievedCount}/{milestones.length} {t("affiliate_unlocked")}
        </span>
      </div>

      {/* Total bonus earned chip */}
      {totalBonusEarned > 0 && (
        <div className="flex items-center justify-between bg-green-500/10 rounded-2xl px-4 py-3">
          <span className="text-sm font-semibold text-green-700">{t("affiliate_total_milestone_bonuses_earned")}</span>
          <span className="font-bold text-green-600">{formatCurrency(totalBonusEarned)}</span>
        </div>
      )}

      {/* Progress to next milestone */}
      {nextMilestone && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{t("affiliate_progress_to")} {nextMilestone.name}</span>
            <span className="font-semibold">{currentReferrals}/{nextMilestone.referral_count}</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full gradient-primary rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {nextMilestone.referral_count - currentReferrals}{" "}
            {nextMilestone.referral_count - currentReferrals !== 1
              ? t("affiliate_more_referrals")
              : t("affiliate_more_referral")}{" "}
            {t("affiliate_to_earn")} {formatCurrency(nextMilestone.bonus_amount)} {t("affiliate_bonus")}!
          </p>
        </div>
      )}

      {/* Milestones list */}
      <div className="space-y-2">
        {visibleMilestones.map((milestone) => {
          const achieved = isAchieved(milestone.id);
          const isNext = nextMilestone?.id === milestone.id;

          return (
            <div
              key={milestone.id}
              className={`flex items-center gap-3 px-3 py-3 rounded-2xl border transition-all ${
                achieved
                  ? "bg-green-500/10 border-green-500/20"
                  : isNext
                  ? "bg-primary/5 border-primary/20"
                  : "bg-muted/40 border-transparent"
              }`}
            >
              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                  achieved
                    ? "bg-green-500 text-white"
                    : isNext
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {achieved ? (
                  <Check className="w-5 h-5" />
                ) : milestone.referral_count > currentReferrals ? (
                  <Lock className="w-4 h-4" />
                ) : (
                  <Trophy className="w-5 h-5" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className={`font-semibold text-sm truncate ${achieved ? "text-green-700" : "text-foreground"}`}>
                    {milestone.name}
                  </p>
                  {achieved && (
                    <span className="text-[10px] font-bold bg-green-500/15 text-green-600 px-1.5 py-0.5 rounded-full">
                      {t("affiliate_achieved")}
                    </span>
                  )}
                  {isNext && (
                    <span className="text-[10px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                      {t("affiliate_next_goal")}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {milestone.referral_count} {t("referrals")}
                </p>
              </div>

              <p className={`font-bold text-sm shrink-0 ${achieved ? "text-green-600" : "text-muted-foreground"}`}>
                {formatCurrency(milestone.bonus_amount)}
              </p>
            </div>
          );
        })}
      </div>

      {/* Expand / collapse */}
      {milestones.length > 3 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-muted-foreground active:text-foreground transition-colors touch-manipulation"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" />
              {t("affiliate_show_less")}
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" />
              {t("affiliate_show_more")} ({milestones.length - 3})
            </>
          )}
        </button>
      )}
    </div>
  );
}
