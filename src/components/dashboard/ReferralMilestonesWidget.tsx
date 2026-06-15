import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { Users, Gift, Share2, Check, TrendingUp, Loader2, ArrowUpRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatCurrency } from "@/lib/currency";
import { fadeInUp, springBouncy } from "@/lib/animations";
import { cn } from "@/lib/utils";

interface TierInfo { name: string; color: string; minReferrals: number; bonus: number; }
const TIERS: TierInfo[] = [
  { name: "Bronze", color: "from-amber-500 to-amber-600", minReferrals: 0, bonus: 0 },
  { name: "Silver", color: "from-slate-400 to-slate-500", minReferrals: 5, bonus: 5 },
  { name: "Gold", color: "from-yellow-400 to-yellow-500", minReferrals: 10, bonus: 10 },
  { name: "Platinum", color: "from-teal-400 to-teal-500", minReferrals: 25, bonus: 15 },
  { name: "Diamond", color: "from-violet-400 to-purple-500", minReferrals: 50, bonus: 20 },
];

export function ReferralMilestonesWidget() {
  const { user } = useAuth(); const { t } = useLanguage(); const prefersReducedMotion = useReducedMotion();
  const [totalReferrals, setTotalReferrals] = useState(0); const [totalEarnings, setTotalEarnings] = useState(0);
  const [walletBalance, setWalletBalance] = useState(0); const [commissionRate, setCommissionRate] = useState(10);
  const [referralCode, setReferralCode] = useState(""); const [loading, setLoading] = useState(true); const [copied, setCopied] = useState(false);

  const fetchData = useCallback(async () => { if (!user) { setLoading(false); return; } try { const { data: p } = await supabase.from("profiles").select("referral_code, affiliate_balance, total_affiliate_earnings").eq("user_id", user.id).single(); const { count } = await supabase.from("profiles").select("*", { count: "exact", head: true }).eq("tier1_referrer_id", user.id); const { data: s } = await supabase.from("platform_settings").select("value").eq("key", "affiliate_settings").maybeSingle(); setTotalReferrals(count || 0); setTotalEarnings(Number(p?.total_affiliate_earnings || 0)); setWalletBalance(Number(p?.affiliate_balance || 0)); setCommissionRate(((s?.value as Record<string, number>) || {}).tier1_commission || 10); setReferralCode(p?.referral_code || ""); } catch (err) { console.error(err); toast.error("Failed to load referral milestones"); } finally { setLoading(false); } }, [user]);
  useEffect(() => { fetchData(); }, [fetchData]);

  const getCurrentTierIndex = () => { for (let i = TIERS.length - 1; i >= 0; i--) { if (totalReferrals >= TIERS[i].minReferrals) return i; } return 0; };
  const getNextTier = () => { const idx = getCurrentTierIndex(); return idx < TIERS.length - 1 ? TIERS[idx + 1] : null; };
  const shareReferral = async () => { if (!referralCode) return; const refLink = `${window.location.origin}/auth?ref=${referralCode}`; try { if (navigator.share) await navigator.share({ title: t("affiliate_share_title") || "Join Nutrio!", text: t("affiliate_share_text") || "Get healthy meals delivered!", url: refLink }); else { await navigator.clipboard.writeText(refLink); setCopied(true); setTimeout(() => setCopied(false), 2000); } } catch { /* */ } };

  if (loading) return <div className="rounded-2xl bg-slate-50 p-5 animate-pulse space-y-3"><div className="flex items-center gap-3"><div className="w-9 h-9 rounded-lg bg-slate-200" /><div className="h-4 w-24 bg-slate-200 rounded" /></div><div className="h-2 bg-slate-200 rounded-full" /></div>;

  const hasReferrals = totalReferrals > 0;
  const ci = getCurrentTierIndex(); const ct = TIERS[ci]; const nt = getNextTier(); const nm = nt ? nt.minReferrals : ct.minReferrals;
  const rp = nt ? Math.min(((totalReferrals - ct.minReferrals) / (nm - ct.minReferrals)) * 100, 100) : 100;

  return (
    <motion.div variants={fadeInUp}>
      <div className="rounded-2xl bg-[#F0FDF6] shadow-[0_1px_3px_rgba(15,23,42,0.04)] overflow-hidden">

        {/* Header + tier badge */}
        <div className="px-4 pt-4 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-emerald-500 flex items-center justify-center shadow-[0_3px_8px_rgba(16,185,129,0.2)]">
              <Users className="w-[16px] h-[16px] text-white" strokeWidth={1.8} />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-800">{t("referral_milestones_title") || "Referral Milestones"}</h3>
              <p className="text-[11px] text-slate-500">{hasReferrals ? `${totalReferrals} ${totalReferrals===1?"referral":"referrals"}` : "Invite friends, earn rewards"}</p>
            </div>
          </div>
          {hasReferrals && <span className={cn("text-[11px] font-bold text-white px-2.5 py-1 rounded-full bg-gradient-to-r", ct.color)}>{ct.name}</span>}
        </div>

        {/* Tier path */}
        <div className="px-4 pb-3">
          <div className="relative mb-2.5">
            <div className="absolute top-[12px] left-[10%] right-[10%] h-[2px] bg-slate-200 rounded-full" />
            {hasReferrals && <div className="absolute top-[12px] left-[10%] h-[2px] bg-emerald-400 rounded-full transition-all duration-500" style={{ width: `${Math.min(((ci+rp/100)/4)*80,80)}%` }} />}
            <div className="flex justify-between relative z-10">
              {TIERS.map((tier, idx) => {
                const achieved = totalReferrals >= tier.minReferrals; const isCurrent = idx === ci;
                return (<div key={tier.name} className="flex flex-col items-center gap-1">
                  <div className={cn("w-[26px] h-[26px] rounded-lg flex items-center justify-center text-[9px] font-extrabold transition-all", achieved?(isCurrent?"bg-emerald-500 text-white shadow-[0_0_12px_rgba(16,185,129,0.3)] ring-2 ring-emerald-100":"bg-emerald-400 text-white"):"bg-white text-slate-300 ring-1 ring-slate-200")}>{achieved?"✓":idx+1}</div>
                  <span className={cn("text-[8px] font-bold",isCurrent?"text-emerald-600":achieved?"text-emerald-500":"text-slate-400")}>{tier.name}</span>
                </div>);
              })}
            </div>
          </div>

          {hasReferrals && nt && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px]"><span className="font-bold text-slate-500"><span className="text-emerald-600">{totalReferrals-ct.minReferrals}</span><span className="text-slate-400"> / {nm-ct.minReferrals} to {nt.name}</span></span><span className="font-extrabold text-emerald-500">{Math.round(rp)}%</span></div>
              <div className="h-1.5 bg-slate-200 rounded-full"><div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{width:`${Math.max(rp,3)}%`}}/></div>
              {nt.bonus>0&&<p className="text-[10px] font-semibold text-amber-600 flex items-center gap-1"><Gift className="w-3 h-3"/> +{formatCurrency(nt.bonus)} bonus at {nt.name}</p>}
            </div>
          )}

          {!hasReferrals && (
            <div className="p-3 rounded-xl bg-white/70 mt-2">
              <p className="text-[13px] font-extrabold text-slate-800 mb-1">{t("start_earning_rewards")}</p>
              <p className="text-[11px] text-slate-500 leading-relaxed">{t("share_link_earn")} <span className="font-extrabold text-emerald-600">{commissionRate}%</span> on every friend's order — plus bonuses up to {formatCurrency(20)}.</p>
            </div>
          )}
        </div>

        {/* Wallet credit */}
        {hasReferrals && (
          <Link to="/wallet" className="mx-4 mb-3 p-3 rounded-xl bg-white flex items-center gap-3 hover:shadow-sm transition-shadow group">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center"><TrendingUp className="w-4 h-4 text-emerald-600" /></div>
            <div className="flex-1"><p className="text-[10px] font-semibold text-slate-500">{t("wallet_credit")}</p><p className="text-[16px] font-extrabold text-slate-800">{formatCurrency(walletBalance)}</p></div>
            <div className="text-right"><p className="text-[9px] text-slate-400">{t("use_toward")}</p><p className="text-[9px] font-bold text-emerald-600">subscription</p></div>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 transition-colors" />
          </Link>
        )}

        {/* CTAs */}
        <div className="px-4 pb-4 space-y-2">
          <Link to="/affiliate" className="flex items-center justify-center gap-2 py-2.5 rounded-full bg-emerald-500 text-white text-[13px] font-extrabold hover:bg-emerald-600 active:scale-[0.98] transition-all shadow-[0_4px_12px_rgba(16,185,129,0.25)]">
            <Gift className="w-3.5 h-3.5" /> {hasReferrals ? "Invite Friends & Earn" : "Start Referring"}
          </Link>
          <motion.button whileTap={prefersReducedMotion?undefined:{scale:0.97,transition:springBouncy}} onClick={shareReferral} className="w-full py-2.5 rounded-full bg-white text-[13px] font-bold text-slate-600 hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-200">
            {copied?(<><Check className="w-3.5 h-3.5 text-emerald-500"/> Link copied!</>):(<><Share2 className="w-3.5 h-3.5" strokeWidth={1.8}/> Share referral link</>)}
          </motion.button>
          <p className="text-[10px] text-center text-slate-400">
            {hasReferrals ? "Credit goes to your wallet — use toward next subscription" : `${commissionRate}% commission on every friend's order`}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
