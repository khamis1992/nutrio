import { useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { 
  ArrowLeft, 
  Users, 
  DollarSign, 
  TrendingUp, 
  Crown,
  Gift,
  Copy,
  Share2,
  Check,
  ChevronRight,
  Wallet,
  Clock,
  Network,
  Trophy,
  Star,
  Loader2,
  AlertTriangle,
  Building
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter 
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useAffiliateProgram } from "@/hooks/useAffiliateProgram";
import { useAffiliateApplication } from "@/hooks/useAffiliateApplication";
import { useProfile } from "@/hooks/useProfile";
import { formatCurrency } from "@/lib/currency";
import { CustomerNavigation } from "@/components/CustomerNavigation";
import { AffiliateLeaderboard } from "@/components/AffiliateLeaderboard";
import { ReferralMilestones } from "@/components/ReferralMilestones";
import { AffiliateApplicationCard } from "@/components/AffiliateApplicationCard";

// ── Shared native header ──────────────────────────────────────────────────
function NativeHeader({ title, onBack, right }: { title: string; onBack: () => void; right?: ReactNode }) {
  return (
    <header className="sticky top-0 z-40 bg-background/70 backdrop-blur-xl border-b border-border/70">
      <div className="px-4 pt-[env(safe-area-inset-top)] h-16 flex items-center justify-between">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 active:scale-95 transition-all"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="text-lg font-bold tracking-tight">{title}</h1>
        <div className="w-10 flex justify-end">{right}</div>
      </div>
    </header>
  );
}

export default function Affiliate() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
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
    getNextTier 
  } = useAffiliateProgram();

  const [copied, setCopied] = useState(false);
  const [payoutDialogOpen, setPayoutDialogOpen] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutMethod, setPayoutMethod] = useState("bank_transfer");
  const [payoutDetails, setPayoutDetails] = useState({ accountName: "", accountNumber: "", bankName: "" });
  const [processingPayout, setProcessingPayout] = useState(false);
  const [activeTab, setActiveTab] = useState<"commissions" | "network" | "payouts">("commissions");

  const referralCode = profile?.referral_code || "";
  const referralLink = `${window.location.origin}/auth?ref=${referralCode}`;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      toast({ title: "Copied!", description: "Referral link copied to clipboard" });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({ title: "Error", description: "Failed to copy link", variant: "destructive" });
    }
  };

  const shareReferral = async () => {
    const shareData = {
      title: "Join NUTRIO",
      text: `Join NUTRIO with my link and we both earn rewards!`,
      url: referralLink
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        copyToClipboard();
      }
    } catch (error) {
      // User cancelled
    }
  };

  const handleRequestPayout = async () => {
    const amount = parseFloat(payoutAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Invalid amount", variant: "destructive" });
      return;
    }

    setProcessingPayout(true);
    const result = await requestPayout(amount, payoutMethod, payoutDetails);
    setProcessingPayout(false);

    if (result.success) {
      toast({ title: "Payout requested!", description: "Your payout request has been submitted." });
      setPayoutDialogOpen(false);
      setPayoutAmount("");
    } else {
      toast({ title: "Error", description: result.error, variant: "destructive" });
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
        <p className="text-sm text-muted-foreground">Loading affiliate data…</p>
      </div>
    );
  }

  // ── Not approved ─────────────────────────────────────────────────────────
  if (!isApprovedAffiliate) {
    return (
      <div className="min-h-screen pb-24">
        <NativeHeader title="Affiliate Program" onBack={() => navigate(-1)} />
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
        <NativeHeader title="Affiliate Program" onBack={() => navigate(-1)} />
        <div className="px-4 pt-8 flex flex-col items-center text-center gap-4">
          <div className="w-20 h-20 rounded-3xl bg-amber-100 flex items-center justify-center">
            <AlertTriangle className="h-10 w-10 text-amber-500" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Program Unavailable</h2>
          <p className="text-sm text-muted-foreground max-w-xs">The affiliate program is currently disabled. Check back soon!</p>
        </div>
        <CustomerNavigation />
      </div>
    );
  }

  // ── Active affiliate dashboard ────────────────────────────────────────────

  return (
    <div className="min-h-screen pb-24">
      {/* Native header with tier badge */}
      <NativeHeader
        title="Affiliate"
        onBack={() => navigate(-1)}
        right={
          <span className={`text-xs font-bold text-white px-2.5 py-1 rounded-full bg-gradient-to-r ${tierInfo.color}`}>
            {tierInfo.name}
          </span>
        }
      />

      <div className="px-4 pt-4 space-y-4">

        {/* ── Hero earnings card ── */}
        <div className="gradient-primary rounded-3xl px-5 py-5 text-white shadow-lg shadow-primary/20">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-white/70" />
            <span className="text-xs font-semibold text-white/70 uppercase tracking-wider">Total Earnings</span>
          </div>
          <p className="text-4xl font-bold mb-5">{formatCurrency(stats.totalEarnings)}</p>

          {/* Available / Pending chips */}
          <div className="flex gap-3 mb-5">
            <div className="flex-1 bg-white/15 rounded-2xl px-4 py-3">
              <p className="text-xs text-white/70 mb-0.5">Available</p>
              <p className="text-lg font-bold">{formatCurrency(stats.availableBalance)}</p>
            </div>
            <div className="flex-1 bg-white/15 rounded-2xl px-4 py-3">
              <p className="text-xs text-white/70 mb-0.5">Pending</p>
              <p className="text-lg font-bold">{formatCurrency(stats.pendingBalance)}</p>
            </div>
          </div>

          <button
            onClick={() => setPayoutDialogOpen(true)}
            disabled={stats.availableBalance < settings.min_payout_threshold}
            className="w-full flex items-center justify-center gap-2 bg-white text-primary font-bold rounded-2xl py-3 active:scale-[0.98] transition-all disabled:opacity-50 shadow-sm"
          >
            <Wallet className="h-4 w-4" />
            Request Payout
          </button>
          {stats.availableBalance < settings.min_payout_threshold && (
            <p className="text-xs text-center text-white/60 mt-2">
              Minimum payout: {formatCurrency(settings.min_payout_threshold)}
            </p>
          )}
        </div>

        {/* ── Tier progress card ── */}
        <div className="bg-card/95 rounded-3xl border border-border/70 shadow-md p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
                <Trophy className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="font-bold text-foreground">Your Tier</p>
                <p className="text-xs text-muted-foreground">{tierInfo.name}</p>
              </div>
            </div>
            <span className={`text-xs font-bold text-white px-3 py-1 rounded-full bg-gradient-to-r ${tierInfo.color}`}>
              {tierInfo.name}
            </span>
          </div>

          {nextTierInfo && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Progress to {nextTierInfo.name}</span>
                <span className="font-semibold">{stats.tier1Referrals}/{nextTierInfo.minReferrals}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full gradient-primary rounded-full transition-all"
                  style={{ width: `${progressToNextTier}%` }}
                />
              </div>
            </div>
          )}

          {/* 3 tier stats */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { n: stats.tier1Referrals, label: "Tier 1", rate: settings.tier1_commission, color: "text-primary bg-primary/10" },
              { n: stats.tier2Referrals, label: "Tier 2", rate: settings.tier2_commission, color: "text-violet-600 bg-violet-500/10" },
              { n: stats.tier3Referrals, label: "Tier 3", rate: settings.tier3_commission, color: "text-cyan-600 bg-cyan-500/10" },
            ].map(({ n, label, rate, color }) => (
              <div key={label} className={`rounded-2xl p-3 text-center ${color}`}>
                <p className="text-xl font-bold">{n}</p>
                <p className="text-xs font-semibold opacity-70">{label}</p>
                <p className="text-xs font-bold">{rate}%</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Share & Earn card ── */}
        <div className="bg-card/95 rounded-3xl border border-border/70 shadow-md p-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Gift className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-bold text-foreground">Share & Earn</p>
              <p className="text-xs text-muted-foreground">
                {settings.tier1_commission}% · {settings.tier2_commission}% · {settings.tier3_commission}% commission tiers
              </p>
            </div>
          </div>

          {/* Referral code display */}
          <div className="bg-primary/5 border border-primary/15 rounded-2xl px-4 py-4 text-center">
            <p className="text-xs text-muted-foreground mb-2 font-semibold uppercase tracking-wider">Your Referral Code</p>
            <div className="flex items-center justify-center gap-3">
              <span className="text-3xl font-mono font-extrabold tracking-widest text-primary">
                {referralCode}
              </span>
              <button
                onClick={copyToClipboard}
                className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center active:scale-95 transition-all"
              >
                {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4 text-primary" />}
              </button>
            </div>
          </div>

          {/* Share buttons */}
          <div className="flex gap-3">
            <button
              onClick={copyToClipboard}
              className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold rounded-2xl py-3 active:scale-[0.98] transition-all shadow-sm shadow-primary/20"
            >
              <Copy className="h-4 w-4" />
              Copy Link
            </button>
            <button
              onClick={shareReferral}
              className="flex-1 flex items-center justify-center gap-2 bg-muted text-foreground font-semibold rounded-2xl py-3 active:scale-[0.98] transition-all border border-border/70"
            >
              <Share2 className="h-4 w-4" />
              Share
            </button>
          </div>
        </div>

        {/* ── Milestones & Leaderboard ── */}
        <ReferralMilestones />
        <AffiliateLeaderboard />

        {/* ── iOS-style segment tabs ── */}
        <div className="bg-muted rounded-2xl p-1 flex gap-1">
          {(["commissions", "network", "payouts"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold capitalize transition-all ${
                activeTab === tab ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* ── Commissions tab ── */}
        {activeTab === "commissions" && (
          <div className="space-y-3">
            {commissions.length === 0 ? (
              <div className="flex flex-col items-center py-14 gap-3">
                <div className="w-16 h-16 rounded-3xl bg-muted flex items-center justify-center">
                  <DollarSign className="h-8 w-8 text-muted-foreground/40" />
                </div>
                <p className="font-semibold text-foreground">No commissions yet</p>
                <p className="text-sm text-muted-foreground">Start sharing to earn!</p>
              </div>
            ) : commissions.map((commission) => {
              const tierColor = commission.tier === 1 ? "bg-primary/10 text-primary" : commission.tier === 2 ? "bg-violet-500/10 text-violet-600" : "bg-cyan-500/10 text-cyan-600";
              return (
                <div key={commission.id} className="bg-card/95 rounded-3xl border border-border/70 shadow-sm p-4 flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${tierColor}`}>
                    <Star className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground">Tier {commission.tier} Commission</p>
                    <p className="text-xs text-muted-foreground">{commission.commission_rate}% of {formatCurrency(commission.order_amount)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-primary">+{formatCurrency(commission.commission_amount)}</p>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${commission.status === "approved" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                      {commission.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Network tab ── */}
        {activeTab === "network" && (
          <div className="space-y-3">
            {network.length > 0 && (
              <button
                onClick={() => navigate("/affiliate/tracking")}
                className="w-full flex items-center gap-3 bg-card/95 border border-border/70 rounded-3xl px-4 py-3.5 shadow-sm active:scale-[0.98] transition-all"
              >
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-primary" />
                </div>
                <span className="flex-1 text-sm font-semibold text-left text-foreground">View Detailed Referral Stats</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
            {network.length === 0 ? (
              <div className="flex flex-col items-center py-14 gap-3">
                <div className="w-16 h-16 rounded-3xl bg-muted flex items-center justify-center">
                  <Network className="h-8 w-8 text-muted-foreground/40" />
                </div>
                <p className="font-semibold text-foreground">No network yet</p>
                <p className="text-sm text-muted-foreground">Share your link to grow your network!</p>
              </div>
            ) : network.map((member) => {
              const tierColor = member.tier === 1 ? "bg-primary/10 text-primary" : member.tier === 2 ? "bg-violet-500/10 text-violet-600" : "bg-cyan-500/10 text-cyan-600";
              return (
                <div key={member.id} className="bg-card/95 rounded-3xl border border-border/70 shadow-sm p-4 flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${tierColor}`}>
                    <Users className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate">{member.full_name || "Anonymous"}</p>
                    <p className="text-xs text-muted-foreground">Joined {new Date(member.created_at).toLocaleDateString()}</p>
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${tierColor}`}>
                    Tier {member.tier}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Payouts tab ── */}
        {activeTab === "payouts" && (
          <div className="space-y-3">
            {payouts.length === 0 ? (
              <div className="flex flex-col items-center py-14 gap-3">
                <div className="w-16 h-16 rounded-3xl bg-muted flex items-center justify-center">
                  <Wallet className="h-8 w-8 text-muted-foreground/40" />
                </div>
                <p className="font-semibold text-foreground">No payout history</p>
                <p className="text-sm text-muted-foreground">Request your first payout when eligible!</p>
              </div>
            ) : payouts.map((payout) => (
              <div key={payout.id} className="bg-card/95 rounded-3xl border border-border/70 shadow-sm p-4 flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-green-500/10 flex items-center justify-center shrink-0">
                  <DollarSign className="w-5 h-5 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-foreground">{formatCurrency(payout.amount)}</p>
                  <p className="text-xs text-muted-foreground capitalize">{payout.payout_method.replace("_", " ")}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                    payout.status === "completed" ? "bg-primary/10 text-primary" :
                    payout.status === "processing" ? "bg-amber-100 text-amber-600" : "bg-muted text-muted-foreground"
                  }`}>
                    {payout.status}
                  </span>
                  <p className="text-xs text-muted-foreground mt-1">{new Date(payout.requested_at).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── How it works ── */}
        <div className="bg-card/95 rounded-3xl border border-border/70 shadow-md p-4 space-y-4">
          <p className="font-bold text-foreground">How Multi-Tier Earning Works</p>
          {[
            { n: "1", label: `Tier 1 — Direct Referrals (${settings.tier1_commission}%)`, desc: "Earn on every order from people you directly refer", color: "bg-primary/10 text-primary" },
            { n: "2", label: `Tier 2 — Their Referrals (${settings.tier2_commission}%)`, desc: "Earn when your referrals refer others", color: "bg-violet-500/10 text-violet-600" },
            { n: "3", label: `Tier 3 — Extended Network (${settings.tier3_commission}%)`, desc: "Earn from 3 levels deep in your network", color: "bg-cyan-500/10 text-cyan-600" },
          ].map(({ n, label, desc, color }) => (
            <div key={n} className="flex items-start gap-3">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 font-bold text-sm ${color}`}>{n}</div>
              <div>
                <p className="font-semibold text-sm text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Payout Dialog ── */}
      <Dialog open={payoutDialogOpen} onOpenChange={setPayoutDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Request Payout</DialogTitle>
            <DialogDescription>
              Available: <span className="font-semibold text-primary">{formatCurrency(stats.availableBalance)}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="amount" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Amount</Label>
              <Input id="amount" type="number" placeholder="Enter amount" value={payoutAmount} onChange={(e) => setPayoutAmount(e.target.value)} className="rounded-2xl h-12" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="method" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Payout Method</Label>
              <Select value={payoutMethod} onValueChange={setPayoutMethod}>
                <SelectTrigger className="rounded-2xl h-12"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-2xl">
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="paypal">PayPal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {payoutMethod === "bank_transfer" && (
              <>
                {[
                  { id: "accountName", label: "Account Name", field: "accountName" as const },
                  { id: "bankName",    label: "Bank Name",    field: "bankName" as const },
                  { id: "accountNumber", label: "Account Number", field: "accountNumber" as const },
                ].map(({ id, label, field }) => (
                  <div key={id} className="space-y-1.5">
                    <Label htmlFor={id} className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</Label>
                    <Input id={id} value={payoutDetails[field]} onChange={(e) => setPayoutDetails({ ...payoutDetails, [field]: e.target.value })} className="rounded-2xl h-12" />
                  </div>
                ))}
              </>
            )}
          </div>

          <DialogFooter className="gap-2 mt-2">
            <Button variant="outline" className="rounded-2xl flex-1" onClick={() => setPayoutDialogOpen(false)}>Cancel</Button>
            <Button className="rounded-2xl flex-1 shadow-sm shadow-primary/20" onClick={handleRequestPayout} disabled={processingPayout}>
              {processingPayout && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Request Payout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CustomerNavigation />
    </div>
  );
}
