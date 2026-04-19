import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Crown, 
  Zap, 
  Star, 
  ArrowLeft, 
  Loader2, 
  Calendar,
  Utensils,
  RotateCcw,
  Snowflake,
  Check,
  X,
  AlertCircle,
  Shield,
  Clock,
  RefreshCcw,
  BadgePercent,
  Wallet,
  CreditCard,
  BellRing,
  CheckCircle2,
  Apple,
} from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { useRolloverCredits } from "@/hooks/useRolloverCredits";
import { useFreezeDaysRemaining } from "@/hooks/useSubscriptionFreeze";
import { useWallet } from "@/hooks/useWallet";
import { useSubscriptionPlans, type DbSubscriptionPlan } from "@/hooks/useSubscriptionPlans";
import { supabase } from "@/integrations/supabase/client";
import { RolloverCreditsWidget } from "@/components/RolloverCreditsWidget";
import { FreezeSubscriptionModal } from "@/components/subscription/FreezeSubscriptionModal";
import { CancellationFlow } from "@/components/CancellationFlow";
import { BillingIntervalToggle, type BillingInterval } from "@/components/BillingIntervalToggle";
import { format, differenceInDays } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { useLanguage } from "@/contexts/LanguageContext";

interface PlanType {
  id: string;
  name: string;
  price: number;
  period: string;
  mealsPerMonth: number;
  snacksPerMonth: number;
  dailyMeals: number;
  dailySnacks: number;
  pricePerMeal: number | null;
  tier: string;
  description: string;
  icon: typeof Star;
  features: string[];
  popular: boolean;
  isVip: boolean;
  color: string;
}

const TIER_META: Record<string, { icon: typeof Star; color: string; descriptionKey: string; popular: boolean; isVip: boolean }> = {
  elite:     { icon: Crown, color: "from-amber-500 to-amber-600",    descriptionKey: "plan_elite_desc",     popular: true,  isVip: false },
  healthy:   { icon: Zap,   color: "from-green-500 to-green-600",    descriptionKey: "plan_healthy_desc",   popular: false, isVip: false },
  fresh:     { icon: Star,  color: "from-blue-500 to-blue-600",      descriptionKey: "plan_fresh_desc",     popular: false, isVip: false },
  weekly:    { icon: Zap,   color: "from-purple-500 to-purple-600",  descriptionKey: "plan_weekly_desc",    popular: false, isVip: false },
  basic:     { icon: Star,  color: "from-slate-500 to-slate-600",   descriptionKey: "plan_basic_desc",    popular: false, isVip: false },
  standard:  { icon: Zap,   color: "from-primary to-primary/80",     descriptionKey: "plan_standard_desc", popular: true,  isVip: false },
  premium:   { icon: Crown, color: "from-amber-500 to-amber-600",  descriptionKey: "plan_premium_desc",  popular: false, isVip: false },
  vip:       { icon: Crown, color: "from-violet-500 to-purple-600", descriptionKey: "plan_vip_desc",      popular: false, isVip: true  },
};

const TIER_NAMES: Record<string, string> = {
  elite: "Elite (نخبة)",
  healthy: "Healthy (توازن)",
  fresh: "Fresh (بداية)",
  weekly: "Weekly Boost (اشتراك اسبوعي)",
  basic: "Basic",
  standard: "Standard", 
  premium: "Premium",
  vip: "VIP",
};

function dbPlanToUiPlan(p: DbSubscriptionPlan, billingInterval: BillingInterval, t: any, isRTL: boolean): PlanType {
  const meta = TIER_META[p.tier] ?? TIER_META.basic;
  const monthlyPrice = p.price_qar ?? 0;
  const price = billingInterval === "annual" ? monthlyPrice * 10 : monthlyPrice;
  const period = billingInterval === "annual" ? "year" : "month";
  const features = Array.isArray(p.features) ? p.features : [];
  const annualFeatures = billingInterval === "annual" ? [...features, `💰 ${t("save_17_percent_banner")}`] : features;
  
  // Use database description if available, otherwise fall back to language context
  const dbDescription = isRTL 
    ? (p.short_description_ar || p.description || t(meta.descriptionKey as any))
    : (p.short_description || p.description_en || t(meta.descriptionKey as any));
  
  return {
    id: p.id,
    name: TIER_NAMES[p.tier] || p.tier.charAt(0).toUpperCase() + p.tier.slice(1),
    price,
    period,
    mealsPerMonth: p.meals_per_month ?? 0,
    snacksPerMonth: p.snacks_per_month ?? 0,
    dailyMeals: p.daily_meals ?? 0,
    dailySnacks: p.daily_snacks ?? 0,
    pricePerMeal: p.price_per_meal ?? null,
    tier: p.tier,
    description: dbDescription,
    icon: meta.icon,
    features: annualFeatures,
    popular: meta.popular,
    isVip: meta.isVip,
    color: meta.color,
  };
}

export default function SubscriptionPage() {
  const { t, isRTL } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { 
    subscription, 
    loading, 
    hasActiveSubscription, 
    remainingMeals, 
    totalMeals, 
    mealsUsed,
    snacksPerMonth,
    snacksUsed,
    remainingSnacks,
    hasSnacks,
    isUnlimited, 
    isVip,
    refetch 
  } = useSubscription();

  const [rolloverCredits, setRolloverCredits] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const loadRollovers = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const { data, error } = await (supabase as any)
          .from('subscription_rollovers')
          .select('rollover_credits')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .gte('expiry_date', today);
        if (cancelled) return;
        if (error) { console.error('rollover fetch error:', error); return; }
        if (data) {
          const total = (data as { rollover_credits: number }[])
            .reduce((sum, r) => sum + (r.rollover_credits || 0), 0);
          setRolloverCredits(total);
        }
      } catch (err) {
        console.error('rollover fetch exception:', err);
      }
    };
    loadRollovers();
    return () => { cancelled = true; };
  }, [user]);

  const effectiveMealsLeft = isUnlimited ? Infinity : remainingMeals + rolloverCredits;

const [activeTab, setActiveTab] = useState("overview");
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanType | null>(null);
  const [selectedBillingInterval, setSelectedBillingInterval] = useState<BillingInterval>("monthly");
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<"card" | "wallet">("card");

  // Promo code state
  const [promoCode, setPromoCode] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [appliedPromo, setAppliedPromo] = useState<{
    id: string;
    name: string;
    discountType: "percentage" | "fixed";
    discountValue: number;
    maxDiscountAmount: number | null;
    discountAmount: number;
  } | null>(null);

  // Auto-renewal state — initialised from DB once subscription loads
  const [autoRenew, setAutoRenew] = useState(true);
  const [autoRenewLoading, setAutoRenewLoading] = useState(false);

  useEffect(() => {
    if (subscription && (subscription as any).auto_renew !== undefined) {
      setAutoRenew((subscription as any).auto_renew);
    }
  }, [subscription]);

  const handleToggleAutoRenew = async (value: boolean) => {
    if (!subscription?.id) return;
    setAutoRenewLoading(true);
    const { error } = await (supabase.rpc as any)("toggle_subscription_auto_renew", {
      p_subscription_id: subscription.id,
      p_auto_renew: value,
    });
    if (error) {
      toast({ title: t("error"), description: t("auto_renewal_error"), variant: "destructive" });
    } else {
      setAutoRenew(value);
      toast({
        title: value ? t("auto_renew_enabled") : t("auto_renew_disabled"),
        description: value
          ? t("auto_renewal_on_desc")
          : t("auto_renewal_off_desc"),
      });
    }
    setAutoRenewLoading(false);
  };

  // Fetch wallet balance
  const { wallet } = useWallet();

  // Fetch rollover credits
  const { data: rolloverInfo } = useRolloverCredits(subscription?.id);
  
// Fetch freeze info
  const { data: freezeDays } = useFreezeDaysRemaining(subscription?.id);

  const { plans: dbPlans } = useSubscriptionPlans();
  // Map all active plans — dbPlanToUiPlan handles annual price calculation
  const plans = dbPlans
    .map(p => dbPlanToUiPlan(p, selectedBillingInterval, t, isRTL));

  // VIP monthly price (used for annual savings display)
  const vipPlan = plans.find(p => p.tier === "vip");
  const vipMonthlyPrice = vipPlan
    ? selectedBillingInterval === "annual"
      ? vipPlan.price / 10
      : vipPlan.price
    : 0;
  const vipAnnualSavings = vipMonthlyPrice * 2;

  const applyPromoCode = async () => {
    if (!promoCode.trim() || !selectedPlan) return;
    setPromoLoading(true);
    setPromoError(null);
    setAppliedPromo(null);

    try {
      const { data, error } = await supabase
        .from("promotions")
        .select("id, name, discount_type, discount_value, max_discount_amount, min_order_amount, max_uses, uses_count, max_uses_per_user, valid_from, valid_until, is_active")
        .eq("code", promoCode.trim().toUpperCase())
        .eq("is_active", true)
        .maybeSingle();

      if (error) throw error;
      if (!data) { setPromoError("Invalid or expired promo code."); return; }

      const now = new Date();
      if (data.valid_until && new Date(data.valid_until) < now) { setPromoError("This promo code has expired."); return; }
      if (data.max_uses !== null && data.uses_count >= data.max_uses) { setPromoError("This promo code has reached its usage limit."); return; }
      if (data.min_order_amount !== null && selectedPlan.price < Number(data.min_order_amount)) {
        setPromoError(`Minimum order amount is ${formatCurrency(Number(data.min_order_amount))}.`); return;
      }

      // Check per-user usage limit
      if (data.max_uses_per_user && user) {
        const { count } = await supabase
          .from("promotion_usage")
          .select("id", { count: "exact", head: true })
          .eq("promotion_id", data.id)
          .eq("user_id", user.id);
        if (count && count >= data.max_uses_per_user) {
          setPromoError("You have already used this promo code."); return;
        }
      }

      const basePrice = selectedPlan.price;
      let discountAmount = 0;
      if (data.discount_type === "percentage") {
        discountAmount = basePrice * (Number(data.discount_value) / 100);
        if (data.max_discount_amount) discountAmount = Math.min(discountAmount, Number(data.max_discount_amount));
      } else {
        discountAmount = Math.min(Number(data.discount_value), basePrice);
      }

      setAppliedPromo({
        id: data.id,
        name: data.name,
        discountType: data.discount_type as "percentage" | "fixed",
        discountValue: Number(data.discount_value),
        maxDiscountAmount: data.max_discount_amount ? Number(data.max_discount_amount) : null,
        discountAmount: Math.round(discountAmount * 100) / 100,
      });
    } catch {
      setPromoError("Failed to validate promo code. Please try again.");
    } finally {
      setPromoLoading(false);
    }
  };

  const handleUpgrade = async () => {
    if (!selectedPlan || !user || !subscription?.id) return;
    setIsProcessing(true);

    try {
      console.log("Updating subscription:", {
        subscriptionId: subscription.id,
        currentPlan: subscription.plan,
        newPlan: selectedPlan.tier,
        newMealsPerMonth: selectedPlan.mealsPerMonth,
        billingInterval: selectedBillingInterval,
        paymentMethod: selectedPaymentMethod,
      });

      // If wallet payment selected, check balance first
      if (selectedPaymentMethod === "wallet") {
        const walletBalance = wallet?.balance || 0;
        
        if (walletBalance < selectedPlan.price) {
          throw new Error(`Insufficient wallet balance. You have QAR ${walletBalance.toFixed(2)} but need QAR ${selectedPlan.price}. Please top up your wallet or use a card.`);
        }

        // Deduct from wallet
        const { error: walletError } = await (supabase.rpc as any)("credit_wallet", {
          p_user_id: user.id,
          p_amount: -selectedPlan.price,
          p_type: "debit",
          p_reference_type: "subscription_upgrade",
          p_reference_id: subscription.id,
          p_description: `Subscription upgrade to ${selectedPlan.name} plan`,
          p_metadata: null,
        });

        if (walletError) throw walletError;
      }

      // Use the upgrade_subscription RPC for proper proration and billing interval handling
      const { data: result, error } = await (supabase.rpc as any)("upgrade_subscription", {
        p_subscription_id: subscription.id,
        p_new_tier: selectedPlan.tier,
        p_new_billing_interval: selectedBillingInterval,
      });

      if (error) throw error;

      const upgradeResult = result as { 
        success: boolean; 
        error?: string; 
        prorated_credit?: number; 
        amount_due?: number;
      };

      if (upgradeResult.success) {
        const billingText = selectedBillingInterval === "annual" ? " (Annual billing - 17% savings)" : "";
        const paymentText = selectedPaymentMethod === "wallet" 
          ? ` Paid QAR ${selectedPlan.price} from your wallet.` 
          : "";
        
        toast({
          title: t("plan_updated_toast"),
          description: `Your subscription has been updated to ${selectedPlan.name} plan${billingText}.${paymentText} ${upgradeResult.prorated_credit ? `Prorated credit: ${upgradeResult.prorated_credit} QAR` : ""}`,
        });
        // Record promo usage if a code was applied (best-effort)
        if (appliedPromo && user) {
          try {
            await supabase.from("promotion_usage").insert({
              promotion_id: appliedPromo.id,
              user_id: user.id,
              discount_applied: appliedPromo.discountAmount,
            });
            // Increment uses_count directly
            const { data: promoRow } = await supabase
              .from("promotions")
              .select("uses_count")
              .eq("id", appliedPromo.id)
              .single();
            if (promoRow) {
              await supabase.from("promotions")
                .update({ uses_count: (promoRow.uses_count || 0) + 1 })
                .eq("id", appliedPromo.id);
            }
          } catch {
            // non-critical — don't block the user
          }
        }

        // Refresh subscription data without page reload
        await refetch();
        setShowUpgradeDialog(false);
        setSelectedPlan(null);
        setSelectedPaymentMethod("card");
        setPromoCode("");
        setAppliedPromo(null);
        setPromoError(null);
      } else {
        throw new Error(upgradeResult.error || "Failed to update subscription");
      }
    } catch (err) {
      console.error("Error in handleUpgrade:", err);
      const message = err instanceof Error ? err.message : "An unexpected error occurred. Please try again.";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    }
    
    setIsProcessing(false);
  };


  const handleReactivate = async () => {
    setIsProcessing(true);
    
    if (subscription?.id) {
      try {
        const { data, error } = await (supabase.rpc as any)("reactivate_subscription", {
          p_subscription_id: subscription.id,
        });

        if (error) throw error;
        const result = data as any;
        if (!result?.success) {
          throw new Error(result?.error || "Reactivation failed");
        }

        toast({
          title: t("subscription_reactivated_toast"),
          description: "Your subscription has been successfully reactivated!",
        });
        await refetch();
      } catch (err: any) {
        console.error("Reactivate error:", err);
        toast({
          title: "Error",
          description: `Failed to reactivate subscription: ${err.message}`,
          variant: "destructive",
        });
      }
    }
    
    setIsProcessing(false);
  };

  // Calculate days remaining in cycle
  const daysRemaining = subscription?.month_start_date 
    ? 30 - differenceInDays(new Date(), new Date(subscription.month_start_date))
    : 30;

  const percentageUsed = totalMeals > 0 ? (mealsUsed / totalMeals) * 100 : 0;

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
        <p className="text-sm text-muted-foreground">{t("loading_subscription")}</p>
      </div>
    );
  }

  // ── No subscription — plan picker ────────────────────────────────────────
  if (!hasActiveSubscription) {
    return (
      <div className="min-h-screen pb-36">
        {/* Native header */}
        <header className="sticky top-0 z-40 bg-background/70 backdrop-blur-xl border-b border-border/70">
          <div className="px-4 pt-[env(safe-area-inset-top)] h-16 flex items-center gap-3 rtl:flex-row-reverse">
            <button
              onClick={() => navigate(-1)}
              className="w-10 h-10 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 active:scale-95 transition-all"
            >
            <ArrowLeft className="h-5 w-5 text-foreground" />
            </button>
            <h1 className="text-lg font-bold tracking-tight">{t("choose_plan")}</h1>
          </div>
        </header>

        <div className="px-4 pt-6 space-y-5">
          {/* Hero card */}
          <div className="gradient-primary rounded-3xl px-5 py-6 text-white shadow-lg shadow-primary/20">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-4 w-4 text-white/80" />
              <span className="text-xs font-semibold text-white/80 uppercase tracking-wider">{t("start_your_journey")}</span>
            </div>
            <h2 className="text-2xl font-bold leading-tight mb-1">{t("fuel_your_health")}</h2>
            <p className="text-sm text-white/70">{t("plan_hero_desc")}</p>
          </div>

          {/* Billing toggle */}
          <BillingIntervalToggle
            value={selectedBillingInterval}
            onChange={setSelectedBillingInterval}
            savingsPercent={17}
          />

          {/* Annual savings banner */}
          {selectedBillingInterval === "annual" && (
            <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-2xl px-4 py-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <BadgePercent className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">{t("save_17_percent_banner")}</p>
                <p className="text-xs text-muted-foreground">{t("pay_annual_desc")} {vipAnnualSavings.toLocaleString()} QAR/yr</p>
              </div>
            </div>
          )}

          {/* Plan cards */}
          <div className="space-y-3">
            {plans.map((plan) => {
              const Icon = plan.icon;
              return (
                <div
                  key={plan.id}
                  className={`relative bg-card/95 rounded-3xl border shadow-md overflow-hidden transition-all ${
                    plan.popular
                      ? "border-primary shadow-primary/15"
                      : plan.isVip
                      ? "border-violet-400 shadow-violet-400/15"
                      : "border-border/70"
                  }`}
                >
                  {/* Badge ribbon */}
                  {plan.popular && (
                    <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-bl-2xl">
                      {t("most_popular")}
                    </div>
                  )}
                  {plan.isVip && (
                    <div className="absolute top-0 right-0 bg-gradient-to-r from-violet-500 to-purple-600 text-white text-xs font-bold px-3 py-1 rounded-bl-2xl">
                      {t("vip_elite")}
                    </div>
                  )}
                  {selectedBillingInterval === "annual" && !plan.popular && !plan.isVip && (
                    <div className="absolute top-0 right-0 bg-primary/80 text-primary-foreground text-xs font-bold px-3 py-1 rounded-bl-2xl">
                      {t("save_17_percent")}
                    </div>
                  )}

                  <div className="p-4">
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${plan.color} flex items-center justify-center shadow-sm`}>
                        <Icon className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-foreground">{plan.name}</h3>
                        <p className="text-xs text-muted-foreground">{plan.description}</p>
                      </div>
                      <div className="ml-auto text-right">
                        <p className="text-xl font-bold text-foreground">{formatCurrency(plan.price)}</p>
                        <p className="text-xs text-muted-foreground">/{plan.period}</p>
                      </div>
                    </div>

                    <div className={`flex items-center gap-2 px-3 py-2 rounded-2xl mb-3 ${plan.isVip ? "bg-violet-500/10" : "bg-primary/8"}`}>
                      <Utensils className={`h-4 w-4 ${plan.isVip ? "text-violet-500" : "text-primary"}`} />
                      <p className={`text-sm font-semibold ${plan.isVip ? "text-violet-600" : "text-primary"}`}>
                        {plan.mealsPerMonth === 0 ? t("unlimited_meals") : `${plan.mealsPerMonth} ${t("meals_per_month")}`}
                      </p>
                    </div>

                    <ul className="space-y-2 mb-4">
                      {plan.features.slice(0, 4).map((feature, idx) => (
                        <li key={idx} className="flex items-center gap-2.5">
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${plan.isVip ? "bg-violet-100" : "bg-primary/10"}`}>
                            <Check className={`h-3 h-3 ${plan.isVip ? "text-violet-600" : "text-primary"}`} />
                          </div>
                          <span className="text-sm text-foreground">{feature}</span>
                        </li>
                      ))}
                      {plan.features.length > 4 && (
                        <li className="text-xs text-muted-foreground pl-7">+{plan.features.length - 4} {t("more_benefits")}</li>
                      )}
                    </ul>

                    <Button
                      className={`w-full rounded-2xl h-12 text-base font-semibold ${
                        plan.isVip
                          ? "bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 shadow-md shadow-violet-500/20"
                          : plan.popular
                          ? "shadow-md shadow-primary/20"
                          : ""
                      }`}
                      variant={plan.popular || plan.isVip ? "default" : "outline"}
                      onClick={() => navigate("/subscription/plans")}
                    >
                      {t("get_started_btn")}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── Active subscription ───────────────────────────────────────────────────

  return (
    <div className="min-h-screen pb-36">
      {/* Native header */}
      <header className="sticky top-0 z-40 bg-background/70 backdrop-blur-xl border-b border-border/70">
        <div className="px-4 pt-[env(safe-area-inset-top)] h-16 flex items-center gap-3 rtl:flex-row-reverse">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 active:scale-95 transition-all"
          >
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <h1 className="text-lg font-bold tracking-tight">{t("my_subscription")}</h1>
        </div>
      </header>

      <div className="px-4 pt-4 space-y-4">
        {/* Hero plan card */}
        <div className={`rounded-3xl px-5 py-5 text-white shadow-lg overflow-hidden relative ${
          isVip
            ? "bg-gradient-to-br from-violet-500 to-purple-700 shadow-violet-500/25"
            : "gradient-primary shadow-primary/20"
        }`}>
          {/* Header row */}
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                {isVip ? <Crown className="h-6 w-6 text-white" /> : <Zap className="h-6 w-6 text-white" />}
              </div>
              <div>
                <h2 className="text-lg font-extrabold uppercase tracking-wide">
                  {subscription?.plan || 'Standard'} {t("plan_label")}
                </h2>
                <p className="text-sm text-white/80 capitalize">
                  {subscription?.status === 'cancelled'
                    ? `Cancelled · ends ${subscription?.end_date ? format(new Date(subscription.end_date), "MMM dd") : ""}`
                    : subscription?.status}
                  {isVip && " · VIP"}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-4xl font-extrabold leading-none">{isUnlimited ? '∞' : effectiveMealsLeft}</p>
              <p className="text-xs text-white/70 mt-1">{isUnlimited ? t("unlimited") : t("meals_left")}</p>
              {!isUnlimited && rolloverCredits > 0 && remainingMeals === 0 && (
                <p className="text-xs text-white/60 mt-0.5">({rolloverCredits} rollover)</p>
              )}
            </div>
          </div>

          {/* Segmented meal bar */}
          {!isUnlimited && (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Utensils className="h-5 w-5 text-white/90 shrink-0" />
                <div className="flex gap-[3px] flex-1">
                  {Array.from({ length: totalMeals }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-3 flex-1 rounded-sm transition-all ${
                        i < mealsUsed ? "bg-white" : "bg-white/20"
                      }`}
                    />
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-white/80 pl-8">
                <span>{mealsUsed} {t("of")} {totalMeals} {t("meals")} {t("used")}</span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {daysRemaining} {t("days")} {t("until_reset")}
                </span>
              </div>
            </div>
          )}

          {/* Segmented snack bar */}
          {hasSnacks && !isUnlimited && snacksPerMonth > 0 && (
            <div className="space-y-2 mt-3">
              <div className="flex items-center gap-3">
                <Apple className="h-5 w-5 text-white/90 shrink-0" />
                <div className="flex gap-[3px] flex-1">
                  {Array.from({ length: snacksPerMonth }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-3 flex-1 rounded-sm transition-all ${
                        i < snacksUsed
                          ? "bg-gradient-to-r from-red-400 to-amber-400"
                          : "bg-white/20"
                      }`}
                    />
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-white/80 pl-8">
                <span>{snacksUsed} {t("of")} {snacksPerMonth} snacks {t("used")}</span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  {remainingSnacks} left
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Quick stat chips */}
        <div className="flex gap-1.5 sm:gap-2 overflow-x-auto scrollbar-hide pb-1">
          <div className="shrink-0 flex items-center gap-1.5 sm:gap-2 bg-card/95 border border-border/70 rounded-2xl px-3 sm:px-4 py-2 sm:py-3 shadow-sm">
            <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
            <div>
              <p className="text-sm sm:text-base font-bold text-foreground leading-none">{daysRemaining}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">{t("days_left")}</p>
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-1.5 sm:gap-2 bg-card/95 border border-border/70 rounded-2xl px-3 sm:px-4 py-2 sm:py-3 shadow-sm">
            <Utensils className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
            <div>
              <p className="text-sm sm:text-base font-bold text-foreground leading-none">{isUnlimited ? '∞' : totalMeals}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">{t("monthly_meals")}</p>
            </div>
          </div>
          {hasSnacks && (
            <div className="shrink-0 flex items-center gap-1.5 sm:gap-2 bg-card/95 border border-border/70 rounded-2xl px-3 sm:px-4 py-2 sm:py-3 shadow-sm">
              <span className="text-base sm:text-lg leading-none">🍎</span>
              <div>
                <p className={`text-sm sm:text-base font-bold leading-none ${
                  remainingSnacks === 0 && !isUnlimited ? "text-red-600" : "text-foreground"
                }`}>
                  {isUnlimited ? '∞' : remainingSnacks}
                </p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">snacks left</p>
              </div>
            </div>
          )}
          {rolloverInfo && rolloverInfo.rollover_credits > 0 && (
            <div className="shrink-0 flex items-center gap-1.5 sm:gap-2 bg-amber-50 border border-amber-200 rounded-2xl px-3 sm:px-4 py-2 sm:py-3 shadow-sm">
              <RotateCcw className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-600" />
              <div>
                <p className="text-sm sm:text-base font-bold text-amber-600 leading-none">{rolloverInfo.rollover_credits}</p>
                <p className="text-[10px] sm:text-xs text-amber-600">{t("rollover")}</p>
              </div>
            </div>
          )}
        </div>

{/* iOS-style segment tabs */}
        <div className="bg-muted rounded-2xl p-1 flex gap-1">
          {[
            { id: "overview", label: t("overview") },
            { id: "manage",   label: t("manage") },
            { id: "plans",    label: t("plans") },
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
                activeTab === id
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW TAB ── */}
        {activeTab === "overview" && (
          <div className="space-y-4">

            {/* Details card */}
            <div className="bg-card/95 rounded-3xl border border-border/70 shadow-md overflow-hidden">
              <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-border/60">
                <Shield className="h-4 w-4 text-primary" />
                <h3 className="font-bold text-foreground">{t("subscription_details")}</h3>
              </div>
              {[
                { label: t("plan_label"), value: <span className="font-semibold capitalize">{subscription?.plan || "Standard"}</span> },
                {
                  label: t("status_label"),
                  value: (
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                      subscription?.status === "cancelled"
                        ? "bg-red-100 text-red-600"
                        : "bg-primary/10 text-primary"
                    }`}>
                      {subscription?.status === "cancelled" ? t("cancelled_active") : subscription?.status === "active" ? t("status_active") : subscription?.status === "paused" ? t("paused") : subscription?.status}
                    </span>
                  ),
                },
                {
                  label: t("start_date_label"),
                  value: <span className="font-semibold">{subscription?.start_date ? format(new Date(subscription.start_date), "MMM dd, yyyy") : "—"}</span>,
                },
                {
                  label: t("end_date_label"),
                  value: <span className="font-semibold">{subscription?.end_date ? format(new Date(subscription.end_date), "MMM dd, yyyy") : "—"}</span>,
                },
              ].map(({ label, value }, idx, arr) => (
                <div key={label} className={`flex items-center justify-between px-4 py-3.5 ${idx < arr.length - 1 ? "border-b border-border/50" : ""}`}>
                  <span className="text-sm text-muted-foreground">{label}</span>
                  {value}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── MANAGE TAB ── */}
        {activeTab === "manage" && (
          <div className="space-y-3">
            <RolloverCreditsWidget
              hasActiveSubscription={hasActiveSubscription}
              subscriptionEndDate={subscription?.end_date ?? null}
            />

            {/* Freeze card */}
            <div className={`bg-card/95 rounded-3xl border shadow-md p-4 space-y-3 ${
              freezeDays?.remaining === 0 ? "border-muted" : "border-border/70"
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    freezeDays?.remaining === 0 ? "bg-muted" : "bg-blue-100"
                  }`}>
                    <Snowflake className={`h-4 w-4 ${freezeDays?.remaining === 0 ? "text-muted-foreground" : "text-blue-600"}`} />
                  </div>
                  <div>
                    <p className="font-bold text-foreground text-sm">{t("freeze_subscription")}</p>
                    <p className="text-xs text-muted-foreground">{t("freeze_desc")}</p>
                  </div>
                </div>
                {freezeDays && (
                  <span className={`text-sm font-bold px-2.5 py-1 rounded-full border ${
                    freezeDays.remaining === 0
                      ? "text-muted-foreground bg-muted border-border/50"
                      : "text-blue-600 bg-blue-50 border-blue-100"
                  }`}>
                    {freezeDays.remaining}/{freezeDays.total}d
                  </span>
                )}
              </div>

              {freezeDays && (
                <div className="space-y-1">
                  <div className={`h-2 rounded-full overflow-hidden ${freezeDays.remaining === 0 ? "bg-muted" : "bg-blue-100"}`}>
                    <div
                      className={`h-full rounded-full transition-all ${freezeDays.remaining === 0 ? "bg-muted-foreground/30" : "bg-blue-500"}`}
                      style={{ width: `${((freezeDays.total - freezeDays.remaining) / freezeDays.total) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {freezeDays.remaining === 0
                      ? t("all_freeze_days_used")
                      : `${freezeDays.remaining} ${t("freeze_days_remaining")}`}
                  </p>
                </div>
              )}

              {freezeDays?.remaining === 0 ? (
                <div className="flex items-start gap-3 bg-muted/60 rounded-2xl px-4 py-3">
                  <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">{t("no_freeze_days")}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t("all_freeze_days_used")}
                      {subscription?.next_renewal_date
                        ? ` on ${format(new Date(subscription.next_renewal_date), "MMM dd, yyyy")}`
                        : ""}.
                    </p>
                  </div>
                </div>
              ) : (
                subscription?.id && (
                  <FreezeSubscriptionModal
                    subscriptionId={subscription.id}
                    trigger={
                      <Button className="w-full rounded-2xl h-11 font-semibold">
                        <Snowflake className="h-4 w-4 mr-2" />
                        {t("schedule_freeze_btn")}
                      </Button>
                    }
                  />
                )
              )}
            </div>

            {/* Cancel / Reactivate card */}
            {subscription?.status === "cancelled" ? (
              <div className="bg-card/95 rounded-3xl border border-border/70 shadow-md p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                    <RefreshCcw className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-bold text-foreground text-sm">{t("reactivate_plan")}</p>
                    <p className="text-xs text-muted-foreground">{t("reactivate_desc")}</p>
                  </div>
                </div>
                <Button
                  className="w-full rounded-2xl h-11 font-semibold shadow-sm shadow-primary/20"
                  onClick={handleReactivate}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("reactivating")}</>
                  ) : (
                    <><RefreshCcw className="h-4 w-4 mr-2" />{t("reactivate_subscription")}</>
                  )}
                </Button>
              </div>
            ) : (
              <div className="bg-card/95 rounded-3xl border border-border/70 shadow-md p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                  </div>
                  <div>
                    <p className="font-bold text-foreground text-sm">{t("cancel_subscription")}</p>
                    <p className="text-xs text-muted-foreground">{t("cancel_desc")}</p>
                  </div>
                </div>
                <button
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl border border-red-200 text-red-600 bg-red-50/60 text-sm font-semibold hover:bg-red-50 active:scale-[0.98] transition-all"
                  onClick={() => setShowCancelDialog(true)}
                >
                  <X className="h-4 w-4" />
                  {t("cancel_subscription")}
                </button>
              </div>
            )}

            <CancellationFlow
              isOpen={showCancelDialog}
              onClose={() => setShowCancelDialog(false)}
              subscriptionId={subscription?.id || null}
              onCancelled={async () => {
                await refetch();
                setShowCancelDialog(false);
              }}
/>
          </div>
        )}

        {/* ── PLANS TAB ── */}
        {activeTab === "plans" && (
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="font-bold text-foreground">{t("available_plans")}</h3>
              <p className="text-sm text-muted-foreground">{t("upgrade_anytime")}</p>
            </div>

            <BillingIntervalToggle
              value={selectedBillingInterval}
              onChange={setSelectedBillingInterval}
              savingsPercent={17}
            />

            {selectedBillingInterval === "annual" && (
              <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-2xl px-4 py-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <BadgePercent className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">Save 17% — 2 months free</p>
                  <p className="text-xs text-muted-foreground">Save up to {vipAnnualSavings.toLocaleString()} QAR per year</p>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {plans.map((plan) => {
                const Icon = plan.icon;
                const isCurrentPlan = subscription?.tier === plan.tier;
                const currentPlanPrice = plans.find(p => p.tier === subscription?.tier)?.price ?? 0;

                let buttonText = t("upgrade");
                let isPrimary = true;
                if (isCurrentPlan) { buttonText = t("current_plan"); isPrimary = false; }
                else if (plan.price < currentPlanPrice) { buttonText = t("downgrade_btn"); isPrimary = false; }

                return (
                  <div
                    key={plan.id}
                    className={`bg-card/95 rounded-3xl border shadow-md p-4 transition-all ${
                      isCurrentPlan ? "border-primary ring-1 ring-primary/20 shadow-primary/10" : "border-border/70"
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${plan.color} flex items-center justify-center shadow-sm`}>
                        <Icon className="h-5 w-5 text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-foreground">{plan.name}</h3>
                          {isCurrentPlan && (
                            <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">{t("current_badge")}</span>
                          )}
                        </div>
                        {plan.description && (
                          <p className="text-xs text-muted-foreground leading-snug">{plan.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground">{plan.mealsPerMonth === 0 ? t("unlimited_meals") : `${plan.mealsPerMonth} ${t("meals_per_month_spaced")}`}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-foreground">{formatCurrency(plan.price)}</p>
                        <p className="text-xs text-muted-foreground">/{plan.period}</p>
                        {selectedBillingInterval === "annual" && (
                          <p className="text-xs text-green-600 font-medium">
                            {formatCurrency(Math.round(plan.price / 12))}/mo
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Plan details block */}
                    <div className="bg-muted/50 rounded-2xl px-3 py-2.5 mb-3 space-y-1.5">
                      {plan.snacksPerMonth > 0 && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Meals + Snacks</span>
                          <span className="font-semibold text-foreground">
                            {plan.mealsPerMonth === 0 ? "∞" : plan.mealsPerMonth} meals + {plan.snacksPerMonth} snacks
                          </span>
                        </div>
                      )}
                      {(plan.dailyMeals > 0 || plan.dailySnacks > 0) && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Daily</span>
                          <span className="font-semibold text-foreground">
                            {plan.dailyMeals} meal{plan.dailyMeals !== 1 ? "s" : ""} + {plan.dailySnacks} snack{plan.dailySnacks !== 1 ? "s" : ""}
                          </span>
                        </div>
                      )}
                    </div>

                    <Button
                      variant={isPrimary ? "default" : "outline"}
                      className="w-full rounded-2xl h-11 font-semibold"
                      disabled={isCurrentPlan}
                      onClick={() => { setSelectedPlan(plan); setShowUpgradeDialog(true); }}
                    >
                      {buttonText}
                    </Button>
                  </div>
                );
              })}
            </div>

            {/* Auto-Renewal card */}
            <div className="bg-card/95 rounded-3xl border border-border/70 shadow-md p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                    <BellRing className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-bold text-foreground text-sm">{t("auto_renewal_title")}</p>
                    <p className="text-xs text-muted-foreground">
                      {autoRenew ? t("auto_renewal_on_desc") : t("auto_renewal_off_desc")}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={autoRenew}
                  onCheckedChange={handleToggleAutoRenew}
                  disabled={autoRenewLoading || subscription?.status === "cancelled"}
                />
              </div>
              {!autoRenew && subscription?.status !== "cancelled" && (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-2xl px-3 py-2.5">
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">
                    {t("subscription_expire_warning")}{" "}
                    <span className="font-semibold">
                      {subscription?.end_date ? format(new Date(subscription.end_date), "MMM dd, yyyy") : t("end_of_billing_period")}
                    </span>{" "}
                    and will not renew automatically.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Change-plan dialog — kept as-is */}
      <Dialog open={showUpgradeDialog} onOpenChange={(open) => {
        setShowUpgradeDialog(open);
        if (!open) {
          setPromoCode("");
          setAppliedPromo(null);
          setPromoError(null);
          setSelectedPlan(null);
          setSelectedPaymentMethod("card");
        }
      }}>
        <DialogContent className="sm:max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle>
              {(() => {
                if (!selectedPlan || !subscription) return t("change_plan");
                const currentPrice = plans.find(p => p.tier === subscription.tier)?.price ?? 0;
                return selectedPlan.price > currentPrice ? `${t("upgrade")} ${t("subscription")}` : `${t("downgrade_btn")} ${t("subscription")}`;
              })()}
            </DialogTitle>
            <DialogDescription>
              {selectedPlan ? (() => {
                const currentPrice = plans.find(p => p.tier === subscription?.tier)?.price ?? 0;
                return `${selectedPlan.price > currentPrice ? t("upgrade") : t("downgrade_btn")} - ${selectedPlan.name}`;
              })() : t("select_plan_to_change")}
            </DialogDescription>
          </DialogHeader>

          {selectedPlan && (
            <div className="bg-muted rounded-2xl p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-semibold">{selectedPlan.name} {t("plan_label")}</span>
                <span className="font-bold">{formatCurrency(selectedPlan.price)}/{selectedPlan.period}</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {selectedPlan.mealsPerMonth === 0 ? t("unlimited_meals") : `${selectedPlan.mealsPerMonth} ${t("meals_per_month")}`}
              </p>
              <div className="pt-2 border-t border-border/50">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Billing:</span>
                  <span className="font-semibold capitalize">{selectedBillingInterval}</span>
                  {selectedBillingInterval === "annual" && (
                    <span className="text-primary text-xs font-semibold">(Save 17%)</span>
                  )}
                </div>
                {selectedBillingInterval === "annual" && (
                  <div className="mt-2 text-xs text-primary bg-primary/5 border border-primary/15 p-2 rounded-xl">
                    Pay for 10 months, get 2 months free — save {(selectedPlan.price * 0.17).toFixed(0)} QAR/yr.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Promo Code */}
          {selectedPlan && (
            <div className="space-y-2">
              <p className="text-sm font-semibold flex items-center gap-1.5">
                <BadgePercent className="h-4 w-4 text-primary" />
                {t("promo_code_label")}
              </p>
              <div className="flex gap-2">
                <Input
                  value={promoCode}
                  onChange={(e) => {
                    setPromoCode(e.target.value.toUpperCase());
                    setPromoError(null);
                    if (appliedPromo) setAppliedPromo(null);
                  }}
                  placeholder={t("enter_promo_code")}
                  className="rounded-xl flex-1"
                  disabled={!!appliedPromo || promoLoading}
                />
                {appliedPromo ? (
                  <Button
                    variant="outline"
                    className="rounded-xl text-destructive border-destructive/30 hover:bg-destructive/5"
                    onClick={() => { setAppliedPromo(null); setPromoCode(""); setPromoError(null); }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="rounded-xl"
                    onClick={applyPromoCode}
                    disabled={!promoCode.trim() || promoLoading}
                  >
                    {promoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("apply_btn")}
                  </Button>
                )}
              </div>

              {promoError && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> {promoError}
                </p>
              )}

              {appliedPromo && (
                <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-xl px-3 py-2">
                  <div>
                    <p className="text-sm font-semibold text-primary">{appliedPromo.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {appliedPromo.discountType === "percentage"
                        ? `${appliedPromo.discountValue}% off`
                        : `${formatCurrency(appliedPromo.discountValue)} off`}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-primary">
                    −{formatCurrency(appliedPromo.discountAmount)}
                  </span>
                </div>
              )}

              {appliedPromo && (
                <div className="flex items-center justify-between text-sm font-bold border-t pt-2">
                  <span>{t("total_after_discount")}</span>
                  <span className="text-primary">
                    {formatCurrency(Math.max(0, selectedPlan.price - appliedPromo.discountAmount))}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Payment Method Selection */}
          {selectedPlan && (
            <div className="space-y-3">
              <p className="text-sm font-semibold">{t("payment_method_label")}</p>
              <div className="grid grid-cols-2 gap-3">
                {/* Card Payment Option */}
                <button
                  onClick={() => setSelectedPaymentMethod("card")}
                  className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all ${
                    selectedPaymentMethod === "card"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <CreditCard className={`h-6 w-6 mb-2 ${selectedPaymentMethod === "card" ? "text-primary" : "text-muted-foreground"}`} />
                  <span className={`text-sm font-semibold ${selectedPaymentMethod === "card" ? "text-primary" : "text-foreground"}`}>
                    {t("card_label")}
                  </span>
                  <span className="text-xs text-muted-foreground">Credit/Debit</span>
                </button>

                {/* Wallet Payment Option */}
                <button
                  onClick={() => setSelectedPaymentMethod("wallet")}
                  className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all ${
                    selectedPaymentMethod === "wallet"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <Wallet className={`h-6 w-6 mb-2 ${selectedPaymentMethod === "wallet" ? "text-primary" : "text-muted-foreground"}`} />
                  <span className={`text-sm font-semibold ${selectedPaymentMethod === "wallet" ? "text-primary" : "text-foreground"}`}>
                    {t("wallet_label")}
                  </span>
                  {wallet && (
                    <span className="text-xs text-muted-foreground">
                      {t("balance")}: {formatCurrency(wallet.balance)}
                    </span>
                  )}
                </button>
              </div>

              {/* Wallet Balance Warning */}
              {selectedPaymentMethod === "wallet" && selectedPlan && wallet && wallet.balance < selectedPlan.price && (
                <Alert className="rounded-2xl bg-amber-50 border-amber-200">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-800 text-xs">
                    {t("insufficient_wallet_balance")} {t("balance")}: {formatCurrency(wallet.balance)}.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <Alert className="rounded-2xl">
            <Clock className="h-4 w-4" />
            <AlertDescription>
              Your plan change takes effect on the next billing cycle.
              {selectedBillingInterval === "annual"
                ? " Annual billing gives you 2 months free."
                : " You'll be charged the new rate from then."}
            </AlertDescription>
          </Alert>

          <DialogFooter className="mt-2 gap-2">
            <Button variant="outline" className="rounded-2xl" onClick={() => setShowUpgradeDialog(false)}>
              {t("cancel_btn")}
            </Button>
            <Button className="rounded-2xl" onClick={handleUpgrade} disabled={isProcessing || !selectedPlan}>
              {isProcessing ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />{t("processing")}</>
              ) : (
                (() => {
                  if (!selectedPlan || !subscription) return t("confirm");
                  const currentPrice = plans.find(p => p.tier === subscription.tier)?.price ?? 0;
                  return selectedPlan.price > currentPrice ? t("confirm_upgrade") : t("confirm_downgrade");
                })()
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
