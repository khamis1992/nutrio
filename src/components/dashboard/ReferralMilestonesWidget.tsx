import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { Users, Gift, ChevronRight, Share2, Copy, Check, TrendingUp, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAffiliateApplication } from "@/hooks/useAffiliateApplication";
import { formatCurrency } from "@/lib/currency";
import { fadeInUp, springBouncy } from "@/lib/animations";
import { cn } from "@/lib/utils";

interface TierInfo {
  name: string;
  color: string;
  bg: string;
  border: string;
  text: string;
  minReferrals: number;
  bonus: number;
}

const TIERS: TierInfo[] = [
  {
    name: "Bronze",
    color: "from-amber-600 to-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-700",
    minReferrals: 0,
    bonus: 0,
  },
  {
    name: "Silver",
    color: "from-slate-400 to-slate-500",
    bg: "bg-slate-50",
    border: "border-slate-200",
    text: "text-slate-600",
    minReferrals: 5,
    bonus: 5,
  },
  {
    name: "Gold",
    color: "from-yellow-400 to-yellow-500",
    bg: "bg-yellow-50",
    border: "border-yellow-200",
    text: "text-yellow-600",
    minReferrals: 10,
    bonus: 10,
  },
  {
    name: "Platinum",
    color: "from-cyan-400 to-cyan-500",
    bg: "bg-cyan-50",
    border: "border-cyan-200",
    text: "text-cyan-600",
    minReferrals: 25,
    bonus: 15,
  },
  {
    name: "Diamond",
    color: "from-violet-400 to-purple-500",
    bg: "bg-violet-50",
    border: "border-violet-200",
    text: "text-violet-600",
    minReferrals: 50,
    bonus: 20,
  },
];

export function ReferralMilestonesWidget() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const prefersReducedMotion = useReducedMotion();
  const { isApprovedAffiliate } = useAffiliateApplication();

  const [totalReferrals, setTotalReferrals] = useState(0);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [commissionRate, setCommissionRate] = useState(10);
  const [referralCode, setReferralCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [visible, setVisible] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const { data: profileData } = await supabase
        .from("profiles")
        .select(
          "referral_code, affiliate_balance, total_affiliate_earnings, affiliate_tier, tier1_referrer_id"
        )
        .eq("user_id", user.id)
        .single();

      const { count } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("tier1_referrer_id", user.id);

      const referralCount = count || 0;

      const { data: settingsData } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "affiliate_settings")
        .maybeSingle();

      const settings = (settingsData?.value as Record<string, number>) || {};
      const rate = settings.tier1_commission || 10;

      setTotalReferrals(referralCount);
      setTotalEarnings(Number(profileData?.total_affiliate_earnings || 0));
      setCommissionRate(rate);
      setReferralCode(profileData?.referral_code || "");

      const hasReferrals = referralCount > 0;
      setVisible(hasReferrals || isApprovedAffiliate);
    } catch (err) {
      console.error("ReferralMilestonesWidget fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [user, isApprovedAffiliate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getCurrentTierIndex = () => {
    for (let i = TIERS.length - 1; i >= 0; i--) {
      if (totalReferrals >= TIERS[i].minReferrals) return i;
    }
    return 0;
  };

  const getNextTier = () => {
    const idx = getCurrentTierIndex();
    return idx < TIERS.length - 1 ? TIERS[idx + 1] : null;
  };

  const copyToClipboard = async () => {
    if (!referralCode) return;
    const refLink = `${window.location.origin}/auth?ref=${referralCode}`;
    try {
      await navigator.clipboard.writeText(refLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable
    }
  };

  const shareReferral = async () => {
    if (!referralCode) {
      copyToClipboard();
      return;
    }
    const refLink = `${window.location.origin}/auth?ref=${referralCode}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: t("affiliate_share_title") || "Join Nutrio!",
          text: t("affiliate_share_text") || "Get healthy meals delivered!",
          url: refLink,
        });
      } else {
        copyToClipboard();
      }
    } catch {
      // user cancelled
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 p-4 animate-pulse">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-200" />
          <div className="flex-1">
            <div className="h-4 w-20 bg-emerald-200 rounded mb-1" />
            <div className="h-3 w-28 bg-emerald-100 rounded" />
          </div>
        </div>
        <div className="h-2 bg-emerald-200 rounded-full" />
      </div>
    );
  }

  if (!visible) return null;

  const currentTierIdx = getCurrentTierIndex();
  const currentTier = TIERS[currentTierIdx];
  const nextTier = getNextTier();
  const nextMin = nextTier ? nextTier.minReferrals : currentTier.minReferrals;
  const prevMin = currentTierIdx > 0 ? TIERS[currentTierIdx - 1].minReferrals : 0;
  const rangeProgress = nextTier
    ? Math.min(
        ((totalReferrals - currentTier.minReferrals) /
          (nextMin - currentTier.minReferrals)) *
          100,
        100
      )
    : 100;

  return (
    <motion.div variants={fadeInUp}>
      <div className="rounded-2xl bg-gradient-to-br from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-200 overflow-hidden shadow-sm">
        <div className="px-4 pt-4 pb-3 space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-sm">
                <Users className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-emerald-900">
                  {t("referral_milestones_title") || "Referral Milestones"}
                </h3>
                <p className="text-[10px] text-emerald-600">
                  {totalReferrals}{" "}
                  {totalReferrals === 1
                    ? t("referral_count_singular") || "referral"
                    : t("referral_count_plural") || "referrals"}
                </p>
              </div>
            </div>
            <span
              className={cn(
                "text-[11px] font-bold text-white px-2.5 py-1 rounded-full bg-gradient-to-r",
                currentTier.color
              )}
            >
              {currentTier.name}
            </span>
          </div>

          {/* Tier progress bar */}
          <div className="space-y-2">
            {/* Tier dots */}
            <div className="flex items-center justify-between relative">
              <div className="absolute top-3 left-0 right-0 h-0.5 bg-emerald-200 mx-4" />
              {TIERS.slice(0, 4).map((tier, idx) => {
                const achieved = totalReferrals >= tier.minReferrals;
                const isCurrent = idx === currentTierIdx;
                return (
                  <div key={tier.name} className="relative z-10 flex flex-col items-center gap-1">
                    <div
                      className={cn(
                        "w-3 h-3 rounded-full border-2",
                        achieved
                          ? isCurrent
                            ? "bg-emerald-500 border-emerald-600 shadow-sm shadow-emerald-500/30"
                            : "bg-emerald-400 border-emerald-500"
                          : "bg-white border-emerald-200"
                      )}
                    />
                    <span
                      className={cn(
                        "text-[9px] font-semibold",
                        isCurrent ? "text-emerald-700" : "text-emerald-400"
                      )}
                    >
                      {tier.name}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Progress bar to next tier */}
            {nextTier && (
              <div className="space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-emerald-600 font-medium">
                    {totalReferrals}/{nextMin} {t("referrals_to") || "referrals to"}{" "}
                    {nextTier.name}
                  </span>
                  <span className="text-emerald-400">
                    {nextTier.bonus > 0 &&
                      `+${formatCurrency(nextTier.bonus)} ${t("bonus_label") || "bonus"}`}
                  </span>
                </div>
                <div className="h-1.5 bg-emerald-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full transition-all duration-500"
                    style={{ width: `${rangeProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Commission earned */}
          {totalEarnings > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/60 border border-emerald-100">
              <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] text-emerald-500">
                  {t("commission_earned") || "Commission earned"}
                </p>
                <p className="text-xs font-bold text-emerald-700">
                  {formatCurrency(totalEarnings)}
                </p>
              </div>
            </div>
          )}

          {/* Actions row */}
          <div className="flex gap-2">
            <Link
              to="/affiliate"
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600 active:scale-[0.98] transition-all shadow-sm"
            >
              <Gift className="w-3.5 h-3.5" />
              {t("invite_friends") || "Invite Friends"}
            </Link>
            <motion.button
              whileTap={prefersReducedMotion ? undefined : { scale: 0.95, transition: springBouncy }}
              onClick={shareReferral}
              className="px-3 py-2.5 rounded-xl bg-white border border-emerald-200 text-emerald-700 text-xs font-semibold hover:bg-emerald-50 active:scale-[0.98] transition-all flex items-center gap-1.5"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  {t("copied") || "Copied"}
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5" />
                  {t("share") || "Share"}
                </>
              )}
            </motion.button>
          </div>
        </div>

        {/* Inline retention CTA */}
        <div className="px-4 pb-4">
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-white/70 border border-emerald-100">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shrink-0">
              <Gift className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-emerald-800">
                {t("earn_when_friends_join") || `Earn ${formatCurrency(commissionRate > 0 && totalEarnings > 0 ? 50 : 50)} when friends join!`}
              </p>
              <p className="text-[10px] text-emerald-500">
                {t("earn_commission_on_orders") || `${commissionRate}% commission on their orders`}
              </p>
            </div>
            <motion.button
              whileTap={prefersReducedMotion ? undefined : { scale: 0.95, transition: springBouncy }}
              onClick={shareReferral}
              className="shrink-0 w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center hover:bg-emerald-600 transition-colors"
            >
              <Share2 className="w-3.5 h-3.5" />
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
