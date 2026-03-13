import { useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { NavChevronRight } from "@/components/ui/nav-chevron";
import {
  ArrowLeft,
  Users,
  DollarSign,
  TrendingUp,
  Gift,
  Copy,
  Share2,
  Check,
  Wallet,
  Network,
  Trophy,
  Star,
  Loader2,
  AlertTriangle,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAffiliateProgram } from "@/hooks/useAffiliateProgram";
import { useAffiliateApplication } from "@/hooks/useAffiliateApplication";
import { useProfile } from "@/hooks/useProfile";
import { formatCurrency } from "@/lib/currency";
import { CustomerNavigation } from "@/components/CustomerNavigation";
import { AffiliateLeaderboard } from "@/components/AffiliateLeaderboard";
import { ReferralMilestones } from "@/components/ReferralMilestones";
import { AffiliateApplicationCard } from "@/components/AffiliateApplicationCard";

// ── Native App Header ────────────────────────────────────────────────────────
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
    <header className="sticky top-0 z-40 bg-background/85 backdrop-blur-2xl border-b border-border/50 safe-area-top">
      <div className="px-4 h-14 flex items-center justify-between">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-2xl bg-muted/80 flex items-center justify-center active:scale-90 transition-all touch-manipulation"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="text-base font-bold tracking-tight text-foreground">{title}</h1>
        <div className="w-10 h-10 flex items-center justify-end">{right}</div>
      </div>
    </header>
  );
}

// ── Bottom Sheet ─────────────────────────────────────────────────────────────
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
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-3xl shadow-2xl max-h-[90vh] overflow-y-auto safe-area-bottom">
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/25" />
        </div>
        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-3 pt-1 border-b border-border/50">
          <h2 className="text-base font-bold text-foreground">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center active:scale-90 transition-all"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </>
  );
}

export default function Affiliate() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();
  const { profile } = useProfile();
  const { isApprovedAffiliate, loading: applicationLoading } = useAffiliateApplication();
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
  const [activeTab, setActiveTab] = useState<"commissions" | "network" | "payouts">(
    "commissions"
  );

  const referralCode = profile?.referral_code || "";
  const referralLink = `${window.location.origin}/auth?ref=${referralCode}`;

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
      // User cancelled
    }
  };

  const handleRequestPayout = async () => {
    const amount = parseFloat(payoutAmount);
    if (isNaN(amount) || amount <= 0) {
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

  const tierInfo = getTierInfo(stats.currentTier);
  const nextTier = getNextTier(stats.currentTier);
  const nextTierInfo = nextTier ? getTierInfo(nextTier) : null;
  const progressToNextTier = nextTierInfo
    ? Math.min((stats.tier1Referrals / nextTierInfo.minReferrals) * 100, 100)
    : 100;

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading || applicationLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
        <p className="text-sm text-muted-foreground">{t("affiliate_loading_data")}</p>
      </div>
    );
  }

  // ── Not approved ──────────────────────────────────────────────────────────
  if (!isApprovedAffiliate) {
    return (
      <div className="min-h-screen pb-24">
        <NativeHeader title={t("affiliate_title")} onBack={() => navigate(-1)} />
        <div className="px-4 pt-5 space-y-4">
          <AffiliateApplicationCard />
        </div>
        <CustomerNavigation />
      </div>
    );
  }

  // ── Program disabled ──────────────────────────────────────────────────────
  if (!settings.enabled) {
    return (
      <div className="min-h-screen pb-24">
        <NativeHeader title={t("affiliate_title")} onBack={() => navigate(-1)} />
        <div className="px-4 pt-12 flex flex-col items-center text-center gap-4">
          <div className="w-20 h-20 rounded-3xl bg-amber-100 flex items-center justify-center">
            <AlertTriangle className="h-10 w-10 text-amber-500" />
          </div>
          <h2 className="text-xl font-bold text-foreground">
            {t("affiliate_program_unavailable")}
          </h2>
          <p className="text-sm text-muted-foreground max-w-xs">
            {t("affiliate_program_disabled_message")}
          </p>
        </div>
        <CustomerNavigation />
      </div>
    );
  }

  // ── Active affiliate dashboard ────────────────────────────────────────────
  return (
    <div className="min-h-screen pb-28">
      {/* Header */}
      <NativeHeader
        title={t("affiliate_title")}
        onBack={() => navigate(-1)}
        right={
          <span
            className={`text-[11px] font-bold text-white px-2 py-0.5 rounded-full bg-gradient-to-r ${tierInfo.color}`}
          >
            {tierInfo.name}
          </span>
        }
      />

      <div className="px-4 pt-4 space-y-3">

        {/* ── Hero earnings card ── */}
        <div className="gradient-primary rounded-3xl px-5 pt-5 pb-4 text-white shadow-lg shadow-primary/25">
          <p className="text-xs font-semibold text-white/60 uppercase tracking-widest mb-1">
            {t("affiliate_total_earnings")}
          </p>
          <p className="text-4xl font-extrabold mb-4 tracking-tight">
            {formatCurrency(stats.totalEarnings)}
          </p>

          {/* Available / Pending */}
          <div className="grid grid-cols-2 gap-2.5 mb-4">
            <div className="bg-white/15 rounded-2xl px-4 py-3">
              <p className="text-[11px] text-white/60 mb-0.5 font-medium">{t("affiliate_available")}</p>
              <p className="text-lg font-bold">{formatCurrency(stats.availableBalance)}</p>
            </div>
            <div className="bg-white/15 rounded-2xl px-4 py-3">
              <p className="text-[11px] text-white/60 mb-0.5 font-medium">{t("affiliate_pending")}</p>
              <p className="text-lg font-bold">{formatCurrency(stats.pendingBalance)}</p>
            </div>
          </div>

          <button
            onClick={() => setPayoutSheetOpen(true)}
            disabled={stats.availableBalance < settings.min_payout_threshold}
            className="w-full flex items-center justify-center gap-2 bg-white text-primary font-bold rounded-2xl py-3 active:scale-[0.98] transition-all disabled:opacity-50 shadow-sm text-sm"
          >
            <Wallet className="h-4 w-4" />
            {t("affiliate_request_payout")}
          </button>
          {stats.availableBalance < settings.min_payout_threshold && (
            <p className="text-[11px] text-center text-white/50 mt-2">
              {t("affiliate_minimum_payout")}: {formatCurrency(settings.min_payout_threshold)}
            </p>
          )}
        </div>

        {/* ── Tier progress card ── */}
        <div className="bg-card/95 rounded-3xl border border-border/60 shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
                <Trophy className="h-4.5 w-4.5 text-amber-500" />
              </div>
              <div>
                <p className="font-bold text-sm text-foreground">{t("affiliate_your_tier")}</p>
                <p className="text-xs text-muted-foreground">{tierInfo.name}</p>
              </div>
            </div>
            <span
              className={`text-[11px] font-bold text-white px-2.5 py-1 rounded-full bg-gradient-to-r ${tierInfo.color}`}
            >
              {tierInfo.name}
            </span>
          </div>

          {nextTierInfo && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  {t("affiliate_progress_to")} {nextTierInfo.name}
                </span>
                <span className="font-semibold">
                  {stats.tier1Referrals}/{nextTierInfo.minReferrals}
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full gradient-primary rounded-full transition-all duration-500"
                  style={{ width: `${progressToNextTier}%` }}
                />
              </div>
            </div>
          )}

          {/* 3 tier stats */}
          <div className="grid grid-cols-3 gap-2">
            {[
              {
                n: stats.tier1Referrals,
                label: t("affiliate_tier1_label"),
                rate: settings.tier1_commission,
                color: "text-primary bg-primary/10",
              },
              {
                n: stats.tier2Referrals,
                label: t("affiliate_tier2_label"),
                rate: settings.tier2_commission,
                color: "text-violet-600 bg-violet-500/10",
              },
              {
                n: stats.tier3Referrals,
                label: t("affiliate_tier3_label"),
                rate: settings.tier3_commission,
                color: "text-cyan-600 bg-cyan-500/10",
              },
            ].map(({ n, label, rate, color }) => (
              <div key={label} className={`rounded-2xl p-3 text-center ${color}`}>
                <p className="text-xl font-bold">{n}</p>
                <p className="text-[10px] font-semibold opacity-70 leading-tight">{label}</p>
                <p className="text-xs font-bold mt-0.5">{rate}%</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Share & Earn card ── */}
        <div className="bg-card/95 rounded-3xl border border-border/60 shadow-sm p-4 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Gift className="h-4.5 w-4.5 text-primary" />
            </div>
            <div>
              <p className="font-bold text-sm text-foreground">{t("affiliate_share_and_earn")}</p>
              <p className="text-xs text-muted-foreground">
                {settings.tier1_commission}% · {settings.tier2_commission}% ·{" "}
                {settings.tier3_commission}% {t("affiliate_commission_tiers")}
              </p>
            </div>
          </div>

          {/* Referral code */}
          <div className="bg-primary/5 border border-primary/15 rounded-2xl px-4 py-4 text-center">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">
              {t("affiliate_your_referral_code")}
            </p>
            <div className="flex items-center justify-center gap-3">
              <span className="text-3xl font-mono font-extrabold tracking-widest text-primary">
                {referralCode}
              </span>
              <button
                onClick={copyToClipboard}
                className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center active:scale-95 transition-all"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-primary" />
                ) : (
                  <Copy className="h-4 w-4 text-primary" />
                )}
              </button>
            </div>
          </div>

          {/* Share buttons */}
          <div className="flex gap-2.5">
            <button
              onClick={copyToClipboard}
              className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold rounded-2xl py-3 active:scale-[0.98] transition-all shadow-sm shadow-primary/20 text-sm"
            >
              <Copy className="h-4 w-4" />
              {t("affiliate_copy_link")}
            </button>
            <button
              onClick={shareReferral}
              className="flex-1 flex items-center justify-center gap-2 bg-muted text-foreground font-semibold rounded-2xl py-3 active:scale-[0.98] transition-all border border-border/60 text-sm"
            >
              <Share2 className="h-4 w-4" />
              {t("affiliate_share")}
            </button>
          </div>
        </div>

        {/* ── Milestones & Leaderboard ── */}
        <ReferralMilestones />
        <AffiliateLeaderboard />

        {/* ── Segment tabs ── */}
        <div className="bg-muted/80 rounded-2xl p-1 flex gap-1">
          {(["commissions", "network", "payouts"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-semibold capitalize transition-all touch-manipulation ${
                activeTab === tab
                  ? "bg-card text-foreground shadow-sm ring-1 ring-black/5"
                  : "text-muted-foreground active:bg-muted/70"
              }`}
            >
              {t(`affiliate_tab_${tab}`)}
            </button>
          ))}
        </div>

        {/* ── Commissions tab ── */}
        {activeTab === "commissions" && (
          <div className="space-y-2.5">
            {commissions.length === 0 ? (
              <EmptyState icon={DollarSign} title={t("affiliate_no_commissions")} desc={t("affiliate_start_sharing")} />
            ) : (
              commissions.map((commission) => {
                const tierColor =
                  commission.tier === 1
                    ? "bg-primary/10 text-primary"
                    : commission.tier === 2
                    ? "bg-violet-500/10 text-violet-600"
                    : "bg-cyan-500/10 text-cyan-600";
                return (
                  <div
                    key={commission.id}
                    className="bg-card/95 rounded-3xl border border-border/60 shadow-sm p-4 flex items-center gap-3"
                  >
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${tierColor}`}
                    >
                      <Star className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-foreground">
                        {t("affiliate_tier_commission").replace("{tier}", String(commission.tier))}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {commission.commission_rate}% {t("affiliate_of")}{" "}
                        {formatCurrency(commission.order_amount)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-primary text-sm">
                        +{formatCurrency(commission.commission_amount)}
                      </p>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          commission.status === "approved"
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {commission.status === "approved"
                          ? t("affiliate_approved")
                          : t("affiliate_pending")}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── Network tab ── */}
        {activeTab === "network" && (
          <div className="space-y-2.5">
            {network.length > 0 && (
              <button
                onClick={() => navigate("/affiliate/tracking")}
                className="w-full flex items-center gap-3 bg-card/95 border border-border/60 rounded-3xl px-4 py-3.5 shadow-sm active:scale-[0.98] transition-all"
              >
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-primary" />
                </div>
                <span className="flex-1 text-sm font-semibold text-foreground text-start">
                  {t("affiliate_view_stats")}
                </span>
                <NavChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
            {network.length === 0 ? (
              <EmptyState icon={Network} title={t("affiliate_no_network")} desc={t("affiliate_grow_network")} />
            ) : (
              network.map((member) => {
                const tierColor =
                  member.tier === 1
                    ? "bg-primary/10 text-primary"
                    : member.tier === 2
                    ? "bg-violet-500/10 text-violet-600"
                    : "bg-cyan-500/10 text-cyan-600";
                return (
                  <div
                    key={member.id}
                    className="bg-card/95 rounded-3xl border border-border/60 shadow-sm p-4 flex items-center gap-3"
                  >
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${tierColor}`}
                    >
                      <Users className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-foreground truncate">
                        {member.full_name || t("affiliate_anonymous")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("affiliate_joined")}{" "}
                        {new Date(member.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${tierColor}`}
                    >
                      {t("affiliate_tier")} {member.tier}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── Payouts tab ── */}
        {activeTab === "payouts" && (
          <div className="space-y-2.5">
            {payouts.length === 0 ? (
              <EmptyState icon={Wallet} title={t("affiliate_no_payouts")} desc={t("affiliate_request_first_payout")} />
            ) : (
              payouts.map((payout) => (
                <div
                  key={payout.id}
                  className="bg-card/95 rounded-3xl border border-border/60 shadow-sm p-4 flex items-center gap-3"
                >
                  <div className="w-11 h-11 rounded-2xl bg-green-500/10 flex items-center justify-center shrink-0">
                    <DollarSign className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-foreground">
                      {formatCurrency(payout.amount)}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {payout.payout_method.replace("_", " ")}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                        payout.status === "completed"
                          ? "bg-primary/10 text-primary"
                          : payout.status === "processing"
                          ? "bg-amber-100 text-amber-600"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {payout.status === "completed"
                        ? t("affiliate_status_completed")
                        : payout.status === "processing"
                        ? t("affiliate_status_processing")
                        : t("affiliate_status_pending")}
                    </span>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(payout.requested_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── How it works ── */}
        <div className="bg-card/95 rounded-3xl border border-border/60 shadow-sm p-4 space-y-3">
          <p className="font-bold text-sm text-foreground">{t("affiliate_how_it_works")}</p>
          {[
            {
              n: "1",
              label: t("affiliate_tier1_desc"),
              desc: t("affiliate_tier1_explanation"),
              color: "bg-primary/10 text-primary",
            },
            {
              n: "2",
              label: t("affiliate_tier2_desc"),
              desc: t("affiliate_tier2_explanation"),
              color: "bg-violet-500/10 text-violet-600",
            },
            {
              n: "3",
              label: t("affiliate_tier3_desc"),
              desc: t("affiliate_tier3_explanation"),
              color: "bg-cyan-500/10 text-cyan-600",
            },
          ].map(({ n, label, desc, color }) => (
            <div key={n} className="flex items-start gap-3">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 font-bold text-sm ${color}`}
              >
                {n}
              </div>
              <div>
                <p className="font-semibold text-sm text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Payout Bottom Sheet ── */}
      <BottomSheet
        open={payoutSheetOpen}
        onClose={() => setPayoutSheetOpen(false)}
        title={t("affiliate_request_payout")}
      >
        <div className="space-y-4">
          <div className="bg-primary/5 rounded-2xl px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t("affiliate_available_label")}</span>
            <span className="font-bold text-primary">{formatCurrency(stats.availableBalance)}</span>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="amount" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {t("affiliate_amount_label")}
            </Label>
            <Input
              id="amount"
              type="number"
              placeholder={t("affiliate_amount_placeholder")}
              value={payoutAmount}
              onChange={(e) => setPayoutAmount(e.target.value)}
              className="rounded-2xl h-12"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="method" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {t("affiliate_payout_method_label")}
            </Label>
            <Select value={payoutMethod} onValueChange={setPayoutMethod}>
              <SelectTrigger className="rounded-2xl h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-2xl">
                <SelectItem value="bank_transfer">{t("affiliate_payout_bank_transfer")}</SelectItem>
                <SelectItem value="paypal">{t("affiliate_payout_paypal")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {payoutMethod === "bank_transfer" && (
            <>
              {(
                [
                  { id: "accountName", label: t("affiliate_account_name_label"), field: "accountName" as const },
                  { id: "bankName", label: t("affiliate_bank_name_label"), field: "bankName" as const },
                  { id: "accountNumber", label: t("affiliate_account_number_label"), field: "accountNumber" as const },
                ] as const
              ).map(({ id, label, field }) => (
                <div key={id} className="space-y-1.5">
                  <Label htmlFor={id} className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {label}
                  </Label>
                  <Input
                    id={id}
                    value={payoutDetails[field]}
                    onChange={(e) =>
                      setPayoutDetails({ ...payoutDetails, [field]: e.target.value })
                    }
                    className="rounded-2xl h-12"
                  />
                </div>
              ))}
            </>
          )}

          <div className="flex gap-2.5 pt-2 pb-2">
            <button
              onClick={() => setPayoutSheetOpen(false)}
              className="flex-1 py-3.5 rounded-2xl border border-border font-semibold text-sm text-foreground active:scale-[0.98] transition-all"
            >
              {t("affiliate_cancel")}
            </button>
            <button
              onClick={handleRequestPayout}
              disabled={processingPayout}
              className="flex-1 py-3.5 rounded-2xl bg-primary text-primary-foreground font-bold text-sm active:scale-[0.98] transition-all shadow-sm shadow-primary/20 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {processingPayout && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("affiliate_request_payout_button")}
            </button>
          </div>
        </div>
      </BottomSheet>

      <CustomerNavigation />
    </div>
  );
}

// ── Shared empty state ────────────────────────────────────────────────────────
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
    <div className="flex flex-col items-center py-12 gap-3">
      <div className="w-16 h-16 rounded-3xl bg-muted flex items-center justify-center">
        <Icon className="h-8 w-8 text-muted-foreground/40" />
      </div>
      <p className="font-semibold text-foreground">{title}</p>
      <p className="text-sm text-muted-foreground text-center">{desc}</p>
    </div>
  );
}
