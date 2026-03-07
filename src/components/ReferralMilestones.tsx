import { useState, useEffect } from "react";
import { Trophy, Gift, Check, Lock, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      // Fetch milestones
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

      // Fetch user achievements
      const { data: achievementsData, error: achievementsError } = await supabase
        .from("user_milestone_achievements")
        .select("milestone_id, achieved_at, bonus_credited")
        .eq("user_id", user!.id);

      if (achievementsError) {
        console.error("Error fetching achievements:", achievementsError);
      } else {
        setAchievements(achievementsData || []);
      }

      // Get current referral count
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

  const isAchieved = (milestoneId: string) => {
    return achievements.some((a) => a.milestone_id === milestoneId);
  };

  const getNextMilestone = () => {
    return milestones.find((m) => !isAchieved(m.id) && m.referral_count > currentReferrals);
  };

  const getProgressToNext = () => {
    const next = getNextMilestone();
    if (!next) return 100;
    
    const prevMilestone = milestones
      .filter((m) => m.referral_count < next.referral_count)
      .sort((a, b) => b.referral_count - a.referral_count)[0];
    
    const start = prevMilestone?.referral_count || 0;
    const end = next.referral_count;
    const current = currentReferrals;
    
    return Math.min(((current - start) / (end - start)) * 100, 100);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (milestones.length === 0) {
    return null;
  }

  const nextMilestone = getNextMilestone();
  const achievedCount = achievements.length;
  const totalBonusEarned = milestones
    .filter((m) => isAchieved(m.id))
    .reduce((sum, m) => sum + m.bonus_amount, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
            <Gift className="w-5 h-5 text-primary" />
            {t("affiliate_milestone_bonuses")}
          </CardTitle>
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
            {achievedCount}/{milestones.length} {t("affiliate_unlocked")}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress to next milestone */}
        {nextMilestone && (
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">{t("affiliate_progress_to")} {nextMilestone.name}</span>
              <span className="font-medium">{currentReferrals}/{nextMilestone.referral_count} {t("referrals")}</span>
            </div>
            <Progress value={getProgressToNext()} className="h-2 mb-2" />
            <p className="text-xs text-muted-foreground">
              {nextMilestone.referral_count - currentReferrals} {nextMilestone.referral_count - currentReferrals !== 1 ? t("affiliate_more_referrals") : t("affiliate_more_referral")} {t("affiliate_to_earn")} {formatCurrency(nextMilestone.bonus_amount)} {t("affiliate_bonus")}!
            </p>
          </div>
        )}

        {/* Total bonus earned */}
        {totalBonusEarned > 0 && (
          <div className="flex items-center justify-between bg-green-500/10 rounded-lg p-3">
            <span className="text-sm text-green-700">{t("affiliate_total_milestone_bonuses_earned")}</span>
            <span className="font-bold text-green-600">{formatCurrency(totalBonusEarned)}</span>
          </div>
        )}

        {/* Milestones list */}
        <div className="space-y-2">
          {milestones.map((milestone, index) => {
            const achieved = isAchieved(milestone.id);
            const isNext = nextMilestone?.id === milestone.id;
            const isLocked = !achieved && milestone.referral_count > currentReferrals;

            return (
              <div
                key={milestone.id}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                  achieved
                    ? "bg-green-500/10 border-green-500/30"
                    : isNext
                    ? "bg-primary/5 border-primary/30"
                    : "bg-muted/30 border-muted"
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    achieved
                      ? "bg-green-500 text-white"
                      : isNext
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {achieved ? (
                    <Check className="w-5 h-5" />
                  ) : isLocked ? (
                    <Lock className="w-4 h-4" />
                  ) : (
                    <Trophy className="w-5 h-5" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`font-medium ${achieved ? "text-green-700" : ""}`}>
                      {milestone.name}
                    </p>
                    {achieved && (
                      <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20 text-xs">
                        {t("affiliate_achieved")}
                      </Badge>
                    )}
                    {isNext && (
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs">
                        {t("affiliate_next_goal")}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {milestone.referral_count} {t("referrals")} • {formatCurrency(milestone.bonus_amount)} {t("affiliate_bonus")}
                  </p>
                </div>

                <div className="text-right">
                  <p className={`font-bold ${achieved ? "text-green-600" : "text-muted-foreground"}`}>
                    {formatCurrency(milestone.bonus_amount)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
