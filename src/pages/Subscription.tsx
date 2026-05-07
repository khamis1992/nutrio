import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Home, LayoutGrid, Settings } from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { useRolloverCredits } from "@/hooks/useRolloverCredits";
import { useFreezeDaysRemaining } from "@/hooks/useSubscriptionFreeze";
import { useWallet } from "@/hooks/useWallet";
import { useSubscriptionPlans, type DbSubscriptionPlan } from "@/hooks/useSubscriptionPlans";
import { supabase } from "@/integrations/supabase/client";
import { type BillingInterval } from "@/components/BillingIntervalToggle";
import { differenceInDays } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";
import { Crown, Zap, Star, type LucideIcon } from "lucide-react";

import { SwipeableTabs } from "@/components/subscription/SwipeableTabs";
import { HeroMealCard } from "@/components/subscription/HeroMealCard";
import { QuickStatChips } from "@/components/subscription/QuickStatChips";
import { PlanPickerMode } from "@/components/subscription/PlanPickerMode";
import { PlanCard, type PlanCardData } from "@/components/subscription/PlanCard";
import { SubscriptionOverview } from "@/components/subscription/SubscriptionOverview";
import { SubscriptionPlansTab } from "@/components/subscription/SubscriptionPlansTab";
import { SubscriptionManage } from "@/components/subscription/SubscriptionManage";
import { UpgradeBottomSheet } from "@/components/subscription/UpgradeBottomSheet";

const TIER_META: Record<string, { icon: LucideIcon; color: string; descriptionKey: string; popular: boolean; isVip: boolean }> = {
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

function dbPlanToUiPlan(p: DbSubscriptionPlan, billingInterval: BillingInterval, t: any, isRTL: boolean): PlanCardData {
  const meta = TIER_META[p.tier] ?? TIER_META.basic;
  const monthlyPrice = p.price_qar ?? 0;
  const price = billingInterval === "annual" ? monthlyPrice * 10 : monthlyPrice;
  const period = billingInterval === "annual" ? "year" : "month";
  const features = Array.isArray(p.features) ? p.features : [];
  const annualFeatures = billingInterval === "annual" ? [...features, `${t("save_17_percent_banner")}`] : features;

  const description = isRTL
    ? (p.short_description_ar || p.description || "")
    : (p.short_description || p.description_en || "");

  return {
    id: p.id,
    name: TIER_NAMES[p.tier] || p.tier.charAt(0).toUpperCase() + p.tier.slice(1),
    price,
    period,
    mealsPerMonth: p.meals_per_month ?? 0,
    snacksPerMonth: p.snacks_per_month ?? 0,
    dailyMeals: p.daily_meals ?? 0,
    dailySnacks: p.daily_snacks ?? 0,
    tier: p.tier,
    description,
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
    isPaused,
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

  const [selectedPlan, setSelectedPlan] = useState<PlanCardData | null>(null);
  const [selectedBillingInterval, setSelectedBillingInterval] = useState<BillingInterval>("monthly");
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<"card" | "wallet">("card");

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

  const [autoRenew, setAutoRenew] = useState(true);
  const [autoRenewLoading, setAutoRenewLoading] = useState(false);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);

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
        description: value ? t("auto_renewal_on_desc") : t("auto_renewal_off_desc"),
      });
    }
    setAutoRenewLoading(false);
  };

  const { wallet } = useWallet();
  const { data: rolloverInfo } = useRolloverCredits(subscription?.id);
  const { data: freezeDays } = useFreezeDaysRemaining(subscription?.id);

  const { plans: dbPlans } = useSubscriptionPlans();
  const plans = dbPlans.map(p => dbPlanToUiPlan(p, selectedBillingInterval, t, isRTL));

  const vipPlan = plans.find(p => p.tier === "vip");
  const vipMonthlyPrice = vipPlan
    ? selectedBillingInterval === "annual" ? vipPlan.price / 10 : vipPlan.price
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
      if (selectedPaymentMethod === "wallet") {
        const walletBalance = wallet?.balance || 0;
        if (walletBalance < selectedPlan.price) {
          throw new Error(`Insufficient wallet balance. You have QAR ${walletBalance.toFixed(2)} but need QAR ${selectedPlan.price}. Please top up your wallet or use a card.`);
        }
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

      const { data: result, error } = await (supabase.rpc as any)("upgrade_subscription", {
        p_subscription_id: subscription.id,
        p_new_tier: selectedPlan.tier,
        p_new_billing_interval: selectedBillingInterval,
      });

      if (error) throw error;

      const upgradeResult = result as { success: boolean; error?: string; prorated_credit?: number; amount_due?: number };

      if (upgradeResult.success) {
        const billingText = selectedBillingInterval === "annual" ? " (Annual billing - 17% savings)" : "";
        const paymentText = selectedPaymentMethod === "wallet" ? ` Paid QAR ${selectedPlan.price} from your wallet.` : "";

        toast({
          title: t("plan_updated_toast"),
          description: `Your subscription has been updated to ${selectedPlan.name} plan${billingText}.${paymentText} ${upgradeResult.prorated_credit ? `Prorated credit: ${upgradeResult.prorated_credit} QAR` : ""}`,
        });

        if (appliedPromo && user) {
          try {
            await supabase.from("promotion_usage").insert({
              promotion_id: appliedPromo.id,
              user_id: user.id,
              discount_applied: appliedPromo.discountAmount,
            });
            const { data: promoRow } = await supabase.from("promotions")
              .select("uses_count").eq("id", appliedPromo.id).single();
            if (promoRow) {
              await supabase.from("promotions")
                .update({ uses_count: (promoRow.uses_count || 0) + 1 })
                .eq("id", appliedPromo.id);
            }
          } catch { /* non-critical */ }
        }

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
      const message = err instanceof Error ? err.message : "An unexpected error occurred.";
      toast({ title: "Error", description: message, variant: "destructive" });
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
        if (!result?.success) throw new Error(result?.error || "Reactivation failed");

        toast({ title: t("subscription_reactivated_toast"), description: "Your subscription has been successfully reactivated!" });
        await refetch();
      } catch (err: any) {
        toast({ title: "Error", description: `Failed to reactivate subscription: ${err.message}`, variant: "destructive" });
      }
    }
    setIsProcessing(false);
  };

  const daysRemaining = subscription?.month_start_date
    ? 30 - differenceInDays(new Date(), new Date(subscription.month_start_date))
    : 30;

  const closeUpgradeDialog = () => {
    setShowUpgradeDialog(false);
    setPromoCode("");
    setAppliedPromo(null);
    setPromoError(null);
    setSelectedPlan(null);
    setSelectedPaymentMethod("card");
  };

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

  if (!hasActiveSubscription) {
    return (
      <PlanPickerMode
        plans={plans}
        billingInterval={selectedBillingInterval}
        onBillingIntervalChange={setSelectedBillingInterval}
        vipAnnualSavings={vipAnnualSavings}
      />
    );
  }

  const statChips = [
    { icon: "calendar" as const, value: daysRemaining, label: t("days_left") },
    { icon: "meals" as const, value: isUnlimited ? "∞" : totalMeals, label: t("monthly_meals") },
  ];

  if (hasSnacks) {
    statChips.push({
      icon: "snacks" as const,
      value: isUnlimited ? "∞" : remainingSnacks,
      label: "snacks left",
      variant: remainingSnacks === 0 && !isUnlimited ? "danger" as const : "default" as const,
    });
  }

  if (rolloverInfo && rolloverInfo.rollover_credits > 0) {
    statChips.push({
      icon: "rollover" as const,
      value: rolloverInfo.rollover_credits,
      label: t("rollover"),
      variant: "warning" as const,
    });
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="px-4 pt-[env(safe-area-inset-top)] h-14 flex items-center gap-3 rtl:flex-row-reverse">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full bg-muted/80 flex items-center justify-center hover:bg-muted active:scale-95 transition-all"
          >
            <ArrowLeft className="h-4 w-4 text-foreground" />
          </button>
          <h1 className="text-base font-bold tracking-tight">{t("my_subscription")}</h1>
        </div>
      </header>

      <div className="px-4 pt-4 pb-2 space-y-4">
        <HeroMealCard
          planName={subscription?.plan || "Standard"}
          status={subscription?.status || "active"}
          statusLabel={subscription?.status === "active" ? t("status_active") : subscription?.status === "paused" ? t("paused") : subscription?.status || "active"}
          isVip={isVip}
          isUnlimited={isUnlimited}
          isPaused={isPaused}
          effectiveMealsLeft={effectiveMealsLeft}
          totalMeals={totalMeals}
          mealsUsed={mealsUsed}
          daysRemaining={daysRemaining}
          snacksPerMonth={snacksPerMonth}
          snacksUsed={snacksUsed}
          remainingSnacks={remainingSnacks}
          hasSnacks={hasSnacks}
          rolloverCredits={rolloverCredits}
          remainingMeals={remainingMeals}
          endDate={subscription?.end_date}
        />

        <QuickStatChips chips={statChips} />
      </div>

      <SwipeableTabs
        tabs={[
          { id: "overview", label: "Overview", icon: <Home className="h-5 w-5" /> },
          { id: "plans", label: "Plans", icon: <LayoutGrid className="h-5 w-5" /> },
          { id: "settings", label: "Settings", icon: <Settings className="h-5 w-5" /> },
        ]}
        defaultTab="overview"
      >
        {(activeTab) => (
          <div className="px-4 py-3">
            {activeTab === "overview" && (
              <SubscriptionOverview
                planName={subscription?.plan || "Standard"}
                status={subscription?.status || "active"}
                startDate={subscription?.start_date || ""}
                endDate={subscription?.end_date || ""}
              />
            )}
            {activeTab === "plans" && (
              <SubscriptionPlansTab
                plans={plans}
                billingInterval={selectedBillingInterval}
                onBillingIntervalChange={setSelectedBillingInterval}
                vipAnnualSavings={vipAnnualSavings}
                currentTier={subscription?.tier}
                autoRenew={autoRenew}
                autoRenewLoading={autoRenewLoading}
                onToggleAutoRenew={handleToggleAutoRenew}
                onSelectPlan={(plan) => { setSelectedPlan(plan); setShowUpgradeDialog(true); }}
                endDate={subscription?.end_date}
                status={subscription?.status}
              />
            )}
            {activeTab === "settings" && (
              <SubscriptionManage
                hasActiveSubscription={hasActiveSubscription}
                endDate={subscription?.end_date ?? null}
                subscriptionId={subscription?.id ?? null}
                subscriptionStatus={subscription?.status}
                freezeDays={freezeDays ?? null}
                isProcessing={isProcessing}
                onReactivate={handleReactivate}
                onRefetch={refetch}
              />
            )}
          </div>
        )}
      </SwipeableTabs>

      <UpgradeBottomSheet
        open={showUpgradeDialog}
        onClose={closeUpgradeDialog}
        selectedPlan={selectedPlan}
        billingInterval={selectedBillingInterval}
        walletBalance={wallet?.balance || 0}
        promoCode={promoCode}
        promoLoading={promoLoading}
        promoError={promoError}
        appliedPromo={appliedPromo}
        onPromoCodeChange={(code) => {
          setPromoCode(code);
          setPromoError(null);
          if (appliedPromo) setAppliedPromo(null);
        }}
        onApplyPromo={applyPromoCode}
        onClearPromo={() => { setAppliedPromo(null); setPromoCode(""); setPromoError(null); }}
        selectedPaymentMethod={selectedPaymentMethod}
        onPaymentMethodChange={setSelectedPaymentMethod}
        isProcessing={isProcessing}
        onConfirm={handleUpgrade}
        currentTier={subscription?.tier}
      />
    </div>
  );
}
