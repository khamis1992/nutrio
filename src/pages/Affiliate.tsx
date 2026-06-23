import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Copy,
  DollarSign,
  Gift,
  Loader2,
  Network,
  Share2,
  Sparkles,
  Star,
  TrendingUp,
  Trophy,
  Users,
  Wallet,
  X,
} from "lucide-react";

import { NavChevronRight } from "@/components/ui/nav-chevron";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAffiliateProgram } from "@/hooks/useAffiliateProgram";
import { useAffiliateApplication } from "@/hooks/useAffiliateApplication";
import { useProfile } from "@/hooks/useProfile";
import { formatCurrency } from "@/lib/currency";
import { AffiliateLeaderboard } from "@/components/AffiliateLeaderboard";
import { ReferralMilestones } from "@/components/ReferralMilestones";

function NativeHeader({
  title,
  onBack,
  right,
}: {
  title: string;
  onBack: () => void;
  right?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/70 bg-[#F8FAFC]/90 backdrop-blur-xl safe-area-top">
      <div className="mx-auto flex h-14 max-w-md items-center justify-between px-4">
        <button
          onClick={onBack}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#020617] shadow-sm ring-1 ring-slate-200 active:scale-95"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-[16px] font-black tracking-tight text-[#020617]">{title}</h1>
        <div className="flex h-10 w-10 items-center justify-end">{right}</div>
      </div>
    </header>
  );
}

function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 max-h-[90vh] overflow-y-auto rounded-t-[34px] border-t border-slate-100 bg-white shadow-2xl safe-area-bottom">
        <div className="flex justify-center pb-2 pt-3">
          <div className="h-1.5 w-12 rounded-full bg-slate-200" />
        </div>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 pb-3">
          <h2 className="text-[17px] font-black text-[#020617]">{title}</h2>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-50 text-slate-500 ring-1 ring-slate-100 active:scale-95"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </>
  );
}

function GlassStat({
  label,
  value,
  tone = "text-[#020617]",
}: {
  label: string;
  value: string | number;
  tone?: string;
}) {
  return (
    <div className="min-w-0 rounded-[18px] bg-white/12 px-3 py-3 ring-1 ring-white/15 backdrop-blur">
      <p className="truncate text-[10px] font-black uppercase tracking-[0.1em] text-white/55">{label}</p>
      <p className={`mt-1 truncate text-[20px] font-black leading-none ${tone}`}>{value}</p>
    </div>
  );
}

function LightStat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  tone: string;
}) {
  return (
    <div className="min-w-0 rounded-[18px] bg-slate-50/80 px-3 py-3 ring-1 ring-slate-200/80 backdrop-blur">
      <div className={`flex min-w-0 items-center gap-1.5 ${tone}`}>
        <Icon className="h-4 w-4 shrink-0" strokeWidth={2.4} />
        <span className="truncate text-[18px] font-black leading-none">{value}</span>
      </div>
      <p className="mt-1.5 text-[9px] font-black uppercase tracking-[0.08em] text-slate-400">{label}</p>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  desc,
}: {
  icon: React.ElementType;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex flex-col items-center rounded-[28px] bg-white px-6 py-10 text-center shadow-[0_12px_30px_rgba(15,23,42,0.05)] ring-1 ring-slate-100">
      <div className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-slate-50 text-[#020617] ring-1 ring-slate-100">
        <Icon className="h-7 w-7" />
      </div>
      <p className="mt-4 font-black text-[#020617]">{title}</p>
      <p className="mt-1 max-w-[280px] text-[13px] font-semibold leading-relaxed text-slate-500">{desc}</p>
    </div>
  );
}

export default function Affiliate() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();
  const { profile } = useProfile();
  const {
    application,
    isApprovedAffiliate,
    loading: applicationLoading,
    hasApplied,
    isPending,
    isRejected,
    applyForAffiliate,
  } = useAffiliateApplication();
  const {
    settings,
    stats,
    commissions,
    payouts,
    network,
    loading,
    requestPayout,
    getTierInfo,
    getNextTier,
  } = useAffiliateProgram();

  const [copied, setCopied] = useState(false);
  const [payoutSheetOpen, setPayoutSheetOpen] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutMethod, setPayoutMethod] = useState("bank_transfer");
  const [payoutDetails, setPayoutDetails] = useState({
    accountName: "",
    accountNumber: "",
    bankName: "",
  });
  const [processingPayout, setProcessingPayout] = useState(false);
  const [applicationNote, setApplicationNote] = useState("");
  const [submittingApplication, setSubmittingApplication] = useState(false);
  const [activeTab, setActiveTab] = useState<"commissions" | "network" | "payouts">("commissions");

  useEffect(() => {
    document.title = `${t("affiliate_title")} - Nutrio`;
  }, [t]);

  const referralCode = profile?.referral_code || "";
  const referralLink = `${window.location.origin}/auth?ref=${referralCode}`;
  const tierInfo = getTierInfo(stats.currentTier);
  const nextTier = getNextTier(stats.currentTier);
  const nextTierInfo = nextTier ? getTierInfo(nextTier) : null;
  const progressToNextTier = nextTierInfo
    ? Math.min((stats.tier1Referrals / nextTierInfo.minReferrals) * 100, 100)
    : 100;

  const totalNetwork = stats.totalReferrals || network.length;
  const statusLabel = useMemo(() => {
    if (isPending) return t("affiliatePending");
    if (isRejected) return t("affiliateNotApproved");
    if (hasApplied) return t("affiliate_pending");
    return t("affiliateJoinProgram");
  }, [hasApplied, isPending, isRejected, t]);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      toast({
        title: t("affiliate_copied"),
        description: t("affiliate_link_copied_message"),
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: t("affiliate_error"),
        description: t("affiliate_copy_failed"),
        variant: "destructive",
      });
    }
  };

  const shareReferral = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: t("affiliate_share_title"),
          text: t("affiliate_share_text"),
          url: referralLink,
        });
      } else {
        copyToClipboard();
      }
    } catch {
      // Share was cancelled.
    }
  };

  const handleApplicationSubmit = async () => {
    setSubmittingApplication(true);
    const result = await applyForAffiliate(applicationNote);
    setSubmittingApplication(false);

    if (result.success) {
      toast({
        title: t("affiliateApplicationSubmitted"),
        description: t("affiliateApplicationSubmittedDescription"),
      });
      setApplicationNote("");
    } else {
      toast({
        title: t("affiliate_error"),
        description: result.error || t("affiliateApplicationFailed"),
        variant: "destructive",
      });
    }
  };

  const handleRequestPayout = async () => {
    const amount = parseFloat(payoutAmount);
    if (Number.isNaN(amount) || amount <= 0) {
      toast({ title: t("affiliate_invalid_amount"), variant: "destructive" });
      return;
    }

    setProcessingPayout(true);
    const result = await requestPayout(amount, payoutMethod, payoutDetails);
    setProcessingPayout(false);

    if (result.success) {
      toast({
        title: t("affiliate_payout_requested"),
        description: t("affiliate_payout_submitted"),
      });
      setPayoutSheetOpen(false);
      setPayoutAmount("");
    } else {
      toast({ title: t("affiliate_error"), description: result.error, variant: "destructive" });
    }
  };

  if (loading || applicationLoading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC]">
        <div className="mx-auto max-w-md space-y-4 px-4 py-6">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="space-y-3 rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-100">
              <div className="flex items-center gap-3">
                <Skeleton className="h-12 w-12 rounded-2xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
              <div className="grid grid-cols-2 gap-3">
                <Skeleton className="h-16 rounded-2xl" />
                <Skeleton className="h-16 rounded-2xl" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!settings.enabled) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] pb-20">
        <NativeHeader title={t("affiliate_title")} onBack={() => navigate(-1)} />
        <main className="mx-auto max-w-md px-4 pt-8">
          <div className="rounded-[32px] bg-white p-6 text-center shadow-[0_14px_36px_rgba(15,23,42,0.06)] ring-1 ring-slate-100">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[28px] bg-amber-50 text-amber-600">
              <AlertTriangle className="h-9 w-9" />
            </div>
            <h2 className="mt-5 text-[22px] font-black text-[#020617]">{t("affiliate_program_unavailable")}</h2>
            <p className="mt-2 text-[14px] font-semibold leading-relaxed text-slate-500">
              {t("affiliate_program_disabled_message")}
            </p>
          </div>
        </main>
      </div>
    );
  }

  if (!isApprovedAffiliate) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] pb-24">
        <NativeHeader title={t("affiliate_title")} onBack={() => navigate(-1)} />
        <main className="mx-auto max-w-md space-y-4 px-4 pt-4">
          <section className="relative overflow-hidden rounded-[34px] bg-[#020617] p-5 text-white shadow-[0_20px_45px_rgba(2,6,23,0.22)]">
            <div className="absolute -right-10 -top-12 h-44 w-44 rounded-full bg-white/10" />
            <div className="absolute bottom-4 right-4 h-28 w-28 overflow-hidden rounded-[28px] bg-white/10 ring-1 ring-white/15">
              <img src="/meals/grilled-chicken-salad.jpg" alt="" className="h-full w-full object-cover opacity-90" />
            </div>
            <div className="relative z-10 max-w-[250px]">
              <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white/10 px-3 text-[11px] font-black uppercase tracking-[0.1em] text-white/80 ring-1 ring-white/15">
                <Sparkles className="h-3.5 w-3.5 text-orange-300" />
                Creator rewards
              </span>
              <h2 className="mt-5 text-[30px] font-black leading-[1.02] tracking-tight">Earn from healthy referrals.</h2>
              <p className="mt-3 text-[13px] font-semibold leading-relaxed text-white/68">
                Share Nutrio with friends, clients, or your community. When approved, your link unlocks tiered commissions and payout tracking.
              </p>
            </div>
            <div className="relative z-10 mt-6 grid grid-cols-3 gap-2">
              <GlassStat label="Tier 1" value={`${settings.tier1_commission}%`} tone="text-white" />
              <GlassStat label="Tier 2" value={`${settings.tier2_commission}%`} tone="text-white" />
              <GlassStat label="Tier 3" value={`${settings.tier3_commission}%`} tone="text-white" />
            </div>
          </section>

          <section className="rounded-[30px] bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.06)] ring-1 ring-slate-100">
            {hasApplied && (
              <div
                className={`mb-4 rounded-[24px] p-4 ring-1 ${
                  isRejected
                    ? "bg-white ring-rose-100"
                    : isPending
                    ? "bg-white ring-slate-200"
                    : "bg-white ring-slate-200"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
                      isRejected
                        ? "bg-rose-50 text-rose-600"
                        : isPending
                        ? "bg-slate-100 text-[#020617]"
                        : "bg-slate-100 text-[#020617]"
                    }`}
                  >
                    {isRejected ? <X className="h-5 w-5" strokeWidth={2.5} /> : <Loader2 className="h-5 w-5 animate-spin" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[15px] font-black leading-tight text-[#020617]">{statusLabel}</p>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] ${
                          isRejected ? "bg-rose-50 text-rose-600" : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {isRejected ? "Not approved" : "Review"}
                      </span>
                    </div>
                    <p className="mt-1 text-[13px] font-semibold leading-5 text-slate-500">
                      {isPending ? t("affiliatePendingDescription") : t("affiliateNotApprovedDescription")}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Application</p>
                <h3 className="mt-1 text-[21px] font-black text-[#020617]">
                  {hasApplied ? t("affiliateJoinProgram") : statusLabel}
                </h3>
                <p className="mt-1 text-[13px] font-semibold leading-relaxed text-slate-500">
                  {t("affiliateJoinDescription")}
                </p>
              </div>
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-slate-50 text-[#020617] ring-1 ring-slate-100">
                <Gift className="h-5 w-5" />
              </div>
            </div>

            {application?.rejection_reason && (
              <div className="mt-4 rounded-[20px] bg-rose-50 px-4 py-3 text-[13px] font-semibold text-rose-700 ring-1 ring-rose-100">
                {t("affiliateRejectionReason", { reason: application.rejection_reason })}
              </div>
            )}

            {!hasApplied && (
              <div className="mt-5 space-y-3">
                <textarea
                  value={applicationNote}
                  onChange={(event) => setApplicationNote(event.target.value)}
                  placeholder={t("affiliateNotePlaceholder")}
                  className="min-h-[112px] w-full resize-none rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3 text-[14px] font-semibold text-[#020617] outline-none placeholder:text-slate-400 focus:border-[#020617] focus:bg-white"
                />
                <button
                  onClick={handleApplicationSubmit}
                  disabled={submittingApplication}
                  className="flex h-13 min-h-[52px] w-full items-center justify-center gap-2 rounded-[20px] bg-[#020617] px-4 text-[15px] font-black text-white shadow-[0_14px_28px_rgba(2,6,23,0.18)] active:scale-[0.98] disabled:opacity-60"
                >
                  {submittingApplication && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t("apply_affiliate_program")}
                </button>
              </div>
            )}
          </section>

          <section className="grid grid-cols-3 gap-2">
            <LightStat icon={DollarSign} label={t("affiliateEarnCommissions")} value={`${settings.tier1_commission}%`} tone="text-orange-700" />
            <LightStat icon={Network} label={t("affiliate3TierRewards")} value="3" tone="text-[#020617]" />
            <LightStat icon={Wallet} label={t("affiliateMonthlyPayouts")} value="QAR" tone="text-sky-700" />
          </section>

          <section className="rounded-[30px] bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.06)] ring-1 ring-slate-100">
            <p className="text-[15px] font-black text-[#020617]">{t("affiliate_how_it_works")}</p>
            <div className="mt-4 space-y-3">
              {[
                { n: "1", label: t("affiliate_tier1_desc"), desc: t("affiliate_tier1_explanation") },
                { n: "2", label: t("affiliate_tier2_desc"), desc: t("affiliate_tier2_explanation") },
                { n: "3", label: t("affiliate_tier3_desc"), desc: t("affiliate_tier3_explanation") },
              ].map((step) => (
                <div key={step.n} className="flex gap-3 rounded-[20px] bg-slate-50 p-3 ring-1 ring-slate-100">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#020617] text-[13px] font-black text-white">
                    {step.n}
                  </span>
                  <div>
                    <p className="text-[13px] font-black text-[#020617]">{step.label}</p>
                    <p className="mt-0.5 text-[12px] font-semibold leading-relaxed text-slate-500">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24">
      <NativeHeader
        title={t("affiliate_title")}
        onBack={() => navigate(-1)}
        right={
          <span className="rounded-full bg-[#020617] px-2.5 py-1 text-[10px] font-black text-white">
            {tierInfo.name}
          </span>
        }
      />

      <main className="mx-auto max-w-md space-y-4 px-4 pt-4">
        <section className="rounded-[34px] bg-[#020617] p-5 text-white shadow-[0_20px_45px_rgba(2,6,23,0.24)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/55">{t("affiliate_total_earnings")}</p>
              <p className="mt-2 text-[36px] font-black leading-none tracking-tight">{formatCurrency(stats.totalEarnings)}</p>
            </div>
            <div className="flex h-[52px] w-[52px] items-center justify-center rounded-[20px] bg-white/10 ring-1 ring-white/15">
              <Trophy className="h-6 w-6 text-orange-300" />
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2.5">
            <GlassStat label={t("affiliate_available")} value={formatCurrency(stats.availableBalance)} tone="text-white" />
            <GlassStat label={t("affiliate_pending")} value={formatCurrency(stats.pendingBalance)} tone="text-white" />
          </div>

          <button
            onClick={() => setPayoutSheetOpen(true)}
            disabled={stats.availableBalance < settings.min_payout_threshold}
            className="mt-4 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[20px] bg-white px-4 text-[15px] font-black text-[#020617] active:scale-[0.98] disabled:opacity-50"
          >
            <Wallet className="h-4 w-4" />
            {t("affiliate_request_payout")}
          </button>
          {stats.availableBalance < settings.min_payout_threshold && (
            <p className="mt-2 text-center text-[11px] font-semibold text-white/50">
              {t("affiliate_minimum_payout")}: {formatCurrency(settings.min_payout_threshold)}
            </p>
          )}
        </section>

        <section className="rounded-[30px] bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.06)] ring-1 ring-slate-100">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-[18px] bg-amber-50 text-amber-600 ring-1 ring-amber-100">
                <Trophy className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[14px] font-black text-[#020617]">{t("affiliate_your_tier")}</p>
                <p className="text-[12px] font-semibold text-slate-500">{tierInfo.name}</p>
              </div>
            </div>
            <span className="rounded-full bg-slate-950 px-3 py-1.5 text-[11px] font-black text-white">{tierInfo.name}</span>
          </div>

          {nextTierInfo && (
            <div className="mt-4">
              <div className="mb-2 flex justify-between text-[12px] font-bold text-slate-500">
                <span>{t("affiliate_progress_to")} {nextTierInfo.name}</span>
                <span>{stats.tier1Referrals}/{nextTierInfo.minReferrals}</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-[#020617]" style={{ width: `${Math.max(progressToNextTier, 4)}%` }} />
              </div>
            </div>
          )}

          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              { n: stats.tier1Referrals, label: t("affiliate_tier1_label"), rate: settings.tier1_commission, tone: "text-orange-700" },
              { n: stats.tier2Referrals, label: t("affiliate_tier2_label"), rate: settings.tier2_commission, tone: "text-[#020617]" },
              { n: stats.tier3Referrals, label: t("affiliate_tier3_label"), rate: settings.tier3_commission, tone: "text-sky-700" },
            ].map((item) => (
              <div key={item.label} className="rounded-[18px] bg-slate-50 px-2.5 py-3 ring-1 ring-slate-100">
                <p className={`text-[20px] font-black leading-none ${item.tone}`}>{item.n}</p>
                <p className="mt-1 truncate text-[9px] font-black uppercase tracking-[0.08em] text-slate-400">{item.label}</p>
                <p className="mt-1 text-[11px] font-black text-[#020617]">{item.rate}%</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[30px] bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.06)] ring-1 ring-slate-100">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-[18px] bg-slate-50 text-[#020617] ring-1 ring-slate-100">
              <Gift className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[14px] font-black text-[#020617]">{t("affiliate_share_and_earn")}</p>
              <p className="text-[12px] font-semibold text-slate-500">
                {settings.tier1_commission}% / {settings.tier2_commission}% / {settings.tier3_commission}% {t("affiliate_commission_tiers")}
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-[24px] bg-slate-50 px-4 py-4 text-center ring-1 ring-slate-100">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{t("affiliate_your_referral_code")}</p>
            <div className="mt-2 flex items-center justify-center gap-3">
              <span className="truncate font-mono text-[28px] font-black tracking-[0.12em] text-[#020617]">{referralCode}</span>
              <button
                onClick={copyToClipboard}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#020617] ring-1 ring-slate-200 active:scale-95"
                aria-label={t("affiliate_copy_link")}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <button
              onClick={copyToClipboard}
              className="flex min-h-[50px] items-center justify-center gap-2 rounded-[18px] bg-[#020617] px-3 text-[14px] font-black text-white active:scale-[0.98]"
            >
              <Copy className="h-4 w-4" />
              {t("affiliate_copy_link")}
            </button>
            <button
              onClick={shareReferral}
              className="flex min-h-[50px] items-center justify-center gap-2 rounded-[18px] bg-slate-50 px-3 text-[14px] font-black text-[#020617] ring-1 ring-slate-200 active:scale-[0.98]"
            >
              <Share2 className="h-4 w-4" />
              {t("affiliate_share")}
            </button>
          </div>
        </section>

        <ReferralMilestones />
        <AffiliateLeaderboard />

        <section className="rounded-[24px] bg-slate-100/80 p-1 ring-1 ring-slate-200/70">
          <div className="grid grid-cols-3 gap-1">
            {(["commissions", "network", "payouts"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`min-h-[42px] rounded-[18px] text-[12px] font-black capitalize transition ${
                  activeTab === tab ? "bg-[#020617] text-white shadow-sm" : "text-slate-500"
                }`}
              >
                {t(`affiliate_tab_${tab}`)}
              </button>
            ))}
          </div>
        </section>

        {activeTab === "commissions" && (
          <section className="space-y-2.5">
            {commissions.length === 0 ? (
              <EmptyState icon={DollarSign} title={t("affiliate_no_commissions")} desc={t("affiliate_start_sharing")} />
            ) : (
              commissions.map((commission) => (
                <div key={commission.id} className="flex items-center gap-3 rounded-[26px] bg-white p-4 shadow-sm ring-1 ring-slate-100">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] bg-orange-50 text-orange-700 ring-1 ring-orange-100">
                    <Star className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-black text-[#020617]">
                      {t("affiliate_tier_commission").replace("{tier}", String(commission.tier))}
                    </p>
                    <p className="text-[12px] font-semibold text-slate-500">
                      {commission.commission_rate}% {t("affiliate_of")} {formatCurrency(commission.order_amount)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[14px] font-black text-[#020617]">+{formatCurrency(commission.commission_amount)}</p>
                    <span className="rounded-full bg-slate-50 px-2 py-1 text-[10px] font-black text-slate-500 ring-1 ring-slate-100">
                      {commission.status === "approved" ? t("affiliate_approved") : t("affiliate_pending")}
                    </span>
                  </div>
                </div>
              ))
            )}
          </section>
        )}

        {activeTab === "network" && (
          <section className="space-y-2.5">
            {network.length > 0 && (
              <button
                onClick={() => navigate("/affiliate/tracking")}
                className="flex min-h-[58px] w-full items-center gap-3 rounded-[26px] bg-white px-4 shadow-sm ring-1 ring-slate-100 active:scale-[0.98]"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-[16px] bg-slate-50 text-[#020617] ring-1 ring-slate-100">
                  <TrendingUp className="h-4 w-4" />
                </span>
                <span className="flex-1 text-start text-[14px] font-black text-[#020617]">{t("affiliate_view_stats")}</span>
                <NavChevronRight className="h-4 w-4 text-slate-400" />
              </button>
            )}
            {network.length === 0 ? (
              <EmptyState icon={Network} title={t("affiliate_no_network")} desc={t("affiliate_grow_network")} />
            ) : (
              network.map((member) => (
                <div key={member.id} className="flex items-center gap-3 rounded-[26px] bg-white p-4 shadow-sm ring-1 ring-slate-100">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] bg-slate-50 text-[#020617] ring-1 ring-slate-100">
                    <Users className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-black text-[#020617]">{member.full_name || t("affiliate_anonymous")}</p>
                    <p className="text-[12px] font-semibold text-slate-500">
                      {t("affiliate_joined")} {new Date(member.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-black text-[#020617] ring-1 ring-slate-100">
                    {t("affiliate_tier")} {member.tier}
                  </span>
                </div>
              ))
            )}
          </section>
        )}

        {activeTab === "payouts" && (
          <section className="space-y-2.5">
            {payouts.length === 0 ? (
              <EmptyState icon={Wallet} title={t("affiliate_no_payouts")} desc={t("affiliate_request_first_payout")} />
            ) : (
              payouts.map((payout) => (
                <div key={payout.id} className="flex items-center gap-3 rounded-[26px] bg-white p-4 shadow-sm ring-1 ring-slate-100">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] bg-slate-50 text-[#020617] ring-1 ring-slate-100">
                    <DollarSign className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-black text-[#020617]">{formatCurrency(payout.amount)}</p>
                    <p className="text-[12px] font-semibold capitalize text-slate-500">{payout.payout_method.replace("_", " ")}</p>
                  </div>
                  <div className="text-right">
                    <span className="rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-black text-[#020617] ring-1 ring-slate-100">
                      {payout.status === "completed"
                        ? t("affiliate_status_completed")
                        : payout.status === "processing"
                        ? t("affiliate_status_processing")
                        : t("affiliate_status_pending")}
                    </span>
                    <p className="mt-1 text-[11px] font-semibold text-slate-400">
                      {new Date(payout.requested_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </section>
        )}

        <section className="rounded-[30px] bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.06)] ring-1 ring-slate-100">
          <p className="text-[15px] font-black text-[#020617]">{t("affiliate_how_it_works")}</p>
          <div className="mt-4 space-y-3">
            {[
              { n: "1", label: t("affiliate_tier1_desc"), desc: t("affiliate_tier1_explanation") },
              { n: "2", label: t("affiliate_tier2_desc"), desc: t("affiliate_tier2_explanation") },
              { n: "3", label: t("affiliate_tier3_desc"), desc: t("affiliate_tier3_explanation") },
            ].map((step) => (
              <div key={step.n} className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#020617] text-[12px] font-black text-white">
                  {step.n}
                </span>
                <div>
                  <p className="text-[13px] font-black text-[#020617]">{step.label}</p>
                  <p className="mt-0.5 text-[12px] font-semibold leading-relaxed text-slate-500">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <BottomSheet open={payoutSheetOpen} onClose={() => setPayoutSheetOpen(false)} title={t("affiliate_request_payout")}>
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-[22px] bg-slate-50 px-4 py-3 ring-1 ring-slate-100">
            <span className="text-[13px] font-semibold text-slate-500">{t("affiliate_available_label")}</span>
            <span className="font-black text-[#020617]">{formatCurrency(stats.availableBalance)}</span>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="amount" className="text-[11px] font-black uppercase tracking-[0.08em] text-slate-400">
              {t("affiliate_amount_label")}
            </Label>
            <Input
              id="amount"
              type="number"
              placeholder={t("affiliate_amount_placeholder")}
              value={payoutAmount}
              onChange={(event) => setPayoutAmount(event.target.value)}
              className="h-12 rounded-[18px] border-slate-200 bg-slate-50 font-bold focus:border-[#020617]"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="method" className="text-[11px] font-black uppercase tracking-[0.08em] text-slate-400">
              {t("affiliate_payout_method_label")}
            </Label>
            <Select value={payoutMethod} onValueChange={setPayoutMethod}>
              <SelectTrigger className="h-12 rounded-[18px] border-slate-200 bg-slate-50 font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-[18px]">
                <SelectItem value="bank_transfer">{t("affiliate_payout_bank_transfer")}</SelectItem>
                <SelectItem value="paypal">{t("affiliate_payout_paypal")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {payoutMethod === "bank_transfer" && (
            <>
              {[
                { id: "accountName", label: t("affiliate_account_name_label"), field: "accountName" as const },
                { id: "bankName", label: t("affiliate_bank_name_label"), field: "bankName" as const },
                { id: "accountNumber", label: t("affiliate_account_number_label"), field: "accountNumber" as const },
              ].map(({ id, label, field }) => (
                <div key={id} className="space-y-1.5">
                  <Label htmlFor={id} className="text-[11px] font-black uppercase tracking-[0.08em] text-slate-400">
                    {label}
                  </Label>
                  <Input
                    id={id}
                    value={payoutDetails[field]}
                    onChange={(event) => setPayoutDetails({ ...payoutDetails, [field]: event.target.value })}
                    className="h-12 rounded-[18px] border-slate-200 bg-slate-50 font-bold focus:border-[#020617]"
                  />
                </div>
              ))}
            </>
          )}

          <div className="grid grid-cols-2 gap-2.5 pt-2">
            <button
              onClick={() => setPayoutSheetOpen(false)}
              className="min-h-[52px] rounded-[18px] bg-slate-50 text-[14px] font-black text-[#020617] ring-1 ring-slate-200 active:scale-[0.98]"
            >
              {t("affiliate_cancel")}
            </button>
            <button
              onClick={handleRequestPayout}
              disabled={processingPayout}
              className="flex min-h-[52px] items-center justify-center gap-2 rounded-[18px] bg-[#020617] text-[14px] font-black text-white active:scale-[0.98] disabled:opacity-60"
            >
              {processingPayout && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("affiliate_request_payout_button")}
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
