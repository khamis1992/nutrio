import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Check, Gift, Share2, TrendingUp, Users } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatCurrency } from "@/lib/currency";
import { fadeInUp, springBouncy } from "@/lib/animations";
import { cn } from "@/lib/utils";

interface TierInfo {
  name: string;
  color: string;
  minReferrals: number;
  bonus: number;
}

const TIERS: TierInfo[] = [
  { name: "Bronze", color: "from-amber-500 to-amber-600", minReferrals: 0, bonus: 0 },
  { name: "Silver", color: "from-slate-400 to-slate-500", minReferrals: 5, bonus: 5 },
  { name: "Gold", color: "from-yellow-400 to-yellow-500", minReferrals: 10, bonus: 10 },
  { name: "Platinum", color: "from-teal-400 to-teal-500", minReferrals: 25, bonus: 15 },
  { name: "Diamond", color: "from-violet-400 to-purple-500", minReferrals: 50, bonus: 20 },
];

export function ReferralMilestonesWidget() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const prefersReducedMotion = useReducedMotion();
  const [totalReferrals, setTotalReferrals] = useState(0);
  const [walletBalance, setWalletBalance] = useState(0);
  const [commissionRate, setCommissionRate] = useState(10);
  const [referralCode, setReferralCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("referral_code, affiliate_balance")
        .eq("user_id", user.id)
        .single();
      const { count } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("tier1_referrer_id", user.id);
      const { data: settings } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "affiliate_settings")
        .maybeSingle();

      setTotalReferrals(count || 0);
      setWalletBalance(Number(profile?.affiliate_balance || 0));
      setCommissionRate(((settings?.value as Record<string, number>) || {}).tier1_commission || 10);
      setReferralCode(profile?.referral_code || "");
    } catch (err) {
      console.error(err);
      toast.error("Failed to load referral milestones");
    } finally {
      setLoading(false);
    }
  }, [user]);

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

  const shareReferral = async () => {
    if (!referralCode) return;

    const refLink = `${window.location.origin}/auth?ref=${referralCode}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: t("affiliate_share_title") || "Join Nutrio!",
          text: t("affiliate_share_text") || "Get healthy meals delivered!",
          url: refLink,
        });
      } else {
        await navigator.clipboard.writeText(refLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // Native share can be cancelled by the user.
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 bg-white px-5 py-5">
        <div className="flex animate-pulse items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-slate-100" />
          <div className="space-y-2">
            <div className="h-4 w-36 rounded-full bg-slate-100" />
            <div className="h-3 w-24 rounded-full bg-slate-100" />
          </div>
        </div>
        <div className="h-24 animate-pulse rounded-[24px] bg-slate-50" />
      </div>
    );
  }

  const hasReferrals = totalReferrals > 0;
  const currentTierIndex = getCurrentTierIndex();
  const currentTier = TIERS[currentTierIndex];
  const nextTier = getNextTier();
  const nextMinimum = nextTier ? nextTier.minReferrals : currentTier.minReferrals;
  const referralProgress = nextTier
    ? Math.min(((totalReferrals - currentTier.minReferrals) / (nextMinimum - currentTier.minReferrals)) * 100, 100)
    : 100;

  return (
    <motion.div variants={fadeInUp}>
      <div className="bg-white">
        <div className="px-5 pb-4 pt-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                <Users className="h-5 w-5" strokeWidth={2.2} />
              </div>
              <div className="min-w-0">
                <h3 className="truncate text-[18px] font-black leading-tight text-slate-950">
                  {t("referral_milestones_title") || "Referral Milestones"}
                </h3>
                <p className="mt-1 text-[12px] font-bold text-slate-500">
                  {hasReferrals ? `${totalReferrals} ${totalReferrals === 1 ? "referral" : "referrals"}` : "Invite friends, earn rewards"}
                </p>
              </div>
            </div>
            {hasReferrals && (
              <span className={cn("shrink-0 rounded-full bg-gradient-to-r px-3 py-1.5 text-[11px] font-black text-white", currentTier.color)}>
                {currentTier.name}
              </span>
            )}
          </div>

          <div className="mt-5 rounded-[26px] bg-slate-50 p-4 ring-1 ring-slate-100">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">Next reward</p>
                <p className="mt-1 text-[17px] font-black text-slate-950">
                  {nextTier ? `${nextTier.name} tier` : "Top tier reached"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[24px] font-black leading-none text-emerald-600">{Math.round(referralProgress)}%</p>
                <p className="mt-1 text-[10px] font-bold text-slate-400">complete</p>
              </div>
            </div>

            <div className="grid grid-cols-5 gap-1.5">
              {TIERS.map((tier, idx) => {
                const achieved = totalReferrals >= tier.minReferrals;
                const isCurrent = idx === currentTierIndex;

                return (
                  <div key={tier.name} className="min-w-0">
                    <div
                      className={cn(
                        "h-2.5 rounded-full transition-colors",
                        achieved
                          ? isCurrent
                            ? "bg-emerald-600"
                            : "bg-emerald-300"
                          : "bg-white ring-1 ring-slate-200",
                      )}
                    />
                    <span className={cn("mt-2 block truncate text-center text-[8px] font-black", isCurrent ? "text-emerald-700" : achieved ? "text-emerald-600" : "text-slate-400")}>
                      {tier.name}
                    </span>
                  </div>
                );
              })}
            </div>

            {hasReferrals && nextTier && (
              <div className="mt-4 rounded-2xl bg-white px-3 py-3">
                <div className="flex items-center justify-between text-[12px]">
                  <span className="font-black text-slate-700">
                    <span className="text-emerald-700">{totalReferrals - currentTier.minReferrals}</span>
                    <span className="text-slate-400"> / {nextMinimum - currentTier.minReferrals} to {nextTier.name}</span>
                  </span>
                  {nextTier.bonus > 0 && (
                    <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[10px] font-black text-amber-700">
                      <Gift className="h-3 w-3" /> +{formatCurrency(nextTier.bonus)}
                    </span>
                  )}
                </div>
                <div className="mt-2 h-2 rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${Math.max(referralProgress, 3)}%` }} />
                </div>
              </div>
            )}

            {!hasReferrals && (
              <div className="mt-4 rounded-2xl bg-white px-3 py-3">
                <p className="text-[14px] font-black text-slate-900">{t("start_earning_rewards")}</p>
                <p className="mt-1 text-[12px] font-semibold leading-relaxed text-slate-500">
                  {t("share_link_earn")} <span className="font-black text-emerald-700">{commissionRate}%</span> on every friend's order, plus bonuses up to {formatCurrency(20)}.
                </p>
              </div>
            )}
          </div>

          {hasReferrals && (
            <Link
              to="/wallet"
              className="group mt-3 flex min-h-[68px] items-center gap-3 rounded-[22px] bg-emerald-50 px-4 py-3 ring-1 ring-emerald-100 transition-transform active:scale-[0.985]"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-emerald-700">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold text-slate-500">{t("wallet_credit")}</p>
                <p className="mt-0.5 text-[20px] font-black leading-tight text-slate-950">{formatCurrency(walletBalance)}</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] font-semibold text-slate-400">{t("use_toward")}</p>
                <p className="text-[10px] font-black text-emerald-600">subscription</p>
              </div>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-emerald-500" />
            </Link>
          )}
        </div>

        <div className="space-y-2.5 border-t border-slate-100 px-5 pb-5 pt-4">
          <Link
            to="/affiliate"
            className="flex min-h-[50px] items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 text-[14px] font-black text-white shadow-[0_12px_24px_rgba(16,185,129,0.2)] transition-transform active:scale-[0.98]"
          >
            <Gift className="h-4 w-4" /> {hasReferrals ? "Invite Friends & Earn" : "Start Referring"}
          </Link>
          <motion.button
            whileTap={prefersReducedMotion ? undefined : { scale: 0.97, transition: springBouncy }}
            onClick={shareReferral}
            className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-2xl bg-slate-50 px-4 text-[14px] font-black text-slate-700 ring-1 ring-slate-100 transition-colors hover:bg-slate-100"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-emerald-500" /> Link copied!
              </>
            ) : (
              <>
                <Share2 className="h-4 w-4" strokeWidth={2} /> Share referral link
              </>
            )}
          </motion.button>
          <p className="text-center text-[11px] font-semibold text-slate-400">
            {hasReferrals ? "Credit goes to your wallet - use toward next subscription" : `${commissionRate}% commission on every friend's order`}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
