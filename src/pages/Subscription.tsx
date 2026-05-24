import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Loader2,
  Crown, Zap, Star, Clock, Apple, Utensils,
  Shield, ClipboardList, CalendarDays,
  type LucideIcon
} from "lucide-react";
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
import { differenceInDays, format } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

import { PlanPickerMode } from "@/components/subscription/PlanPickerMode";
import { type PlanCardData } from "@/components/subscription/PlanCard";
import { SubscriptionManage } from "@/components/subscription/SubscriptionManage";
import { SubscriptionPlansTab } from "@/components/subscription/SubscriptionPlansTab";
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

function dbPlanToUiPlan(p: DbSubscriptionPlan, billingInterval: BillingInterval, t: (key: string) => string, isRTL: boolean): PlanCardData {
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
        const { data, error } = await supabase
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
    if (subscription) {
      setAutoRenew((subscription as { auto_renew?: boolean }).auto_renew ?? true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscription?.id, (subscription as { auto_renew?: boolean })?.auto_renew]);

  const handleToggleAutoRenew = async (value: boolean) => {
    if (!subscription?.id) return;
    setAutoRenewLoading(true);
    const { error } = await supabase.rpc("toggle_subscription_auto_renew", {
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
      const walletBalance = wallet?.balance || 0;
      if (selectedPaymentMethod === "wallet" && walletBalance < selectedPlan.price) {
        throw new Error(`Insufficient wallet balance. You have QAR ${walletBalance.toFixed(2)} but need QAR ${selectedPlan.price}. Please top up your wallet or use a card.`);
      }

      const { data: upgradeResult, error } = await supabase.functions.invoke("upgrade-subscription", {
        body: {
          subscription_id: subscription.id,
          new_tier: selectedPlan.tier,
          new_billing_interval: selectedBillingInterval,
          payment_method: selectedPaymentMethod,
        },
      });

      if (error) throw error;

      const result = upgradeResult as { success: boolean; error?: string; code?: string; prorated_credit?: number; amount_due?: number };

      if (result.success) {
        const billingText = selectedBillingInterval === "annual" ? " (Annual billing - 17% savings)" : "";
        const paymentText = selectedPaymentMethod === "wallet" ? ` Paid QAR ${selectedPlan.price} from your wallet.` : "";

        toast({
          title: t("plan_updated_toast"),
          description: `Your subscription has been updated to ${selectedPlan.name} plan${billingText}.${paymentText} ${result.prorated_credit ? `Prorated credit: ${result.prorated_credit} QAR` : ""}`,
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
        throw new Error(result.error || "Failed to update subscription");
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
        const { data, error } = await supabase.rpc("reactivate_subscription", {
          p_subscription_id: subscription.id,
        });
        if (error) throw error;
        const result = data as { success?: boolean; error?: string } | null;
        if (!result?.success) throw new Error(result?.error || "Reactivation failed");

        toast({ title: t("subscription_reactivated_toast"), description: "Your subscription has been successfully reactivated!" });
        await refetch();
      } catch (err) {
        toast({ title: "Error", description: `Failed to reactivate subscription: ${err instanceof Error ? err.message : "Unknown error"}`, variant: "destructive" });
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

  const planName = subscription?.plan || "Healthy";
  const status = subscription?.status || "active";
  const startDate = subscription?.start_date || "";
  const endDate = subscription?.end_date || "";

  const statusLabels: Record<string, { label: string; className: string }> = {
    active: { label: t("status_active") || "Active", className: "bg-white/20 text-white" },
    cancelled: { label: t("cancelled_active") || "Cancelled", className: "bg-red-500/20 text-red-100" },
    pending: { label: t("paused") || "Paused", className: "bg-yellow-500/20 text-yellow-100" },
  };
  const statusInfo = statusLabels[status] || statusLabels.active;

  const planIcon = isVip ? Crown : Zap;
  const PlanIcon = planIcon;

  const heroMealCount = isUnlimited ? "∞" : isPaused ? "❄" : effectiveMealsLeft;
  const displayPlanName = planName
    .split(" ")
    .map((part) => part ? `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}` : part)
    .join(" ");
  const mealRingRadius = 36;
  const mealRingCircumference = 2 * Math.PI * mealRingRadius;
  const finiteMealsLeft = Number.isFinite(effectiveMealsLeft) ? Number(effectiveMealsLeft) : totalMeals;
  const mealRingProgress = totalMeals > 0 ? Math.max(0, Math.min(1, finiteMealsLeft / totalMeals)) : 0;
  const mealRingOffset = mealRingCircumference * (1 - mealRingProgress);
  const mealsSegmentCount = 14;
  const snacksSegmentCount = 8;
  const filledMealSegments = totalMeals > 0
    ? Math.max(mealsUsed > 0 ? 1 : 0, Math.round((mealsUsed / totalMeals) * mealsSegmentCount))
    : 0;
  const filledSnackSegments = snacksPerMonth > 0
    ? Math.max(snacksUsed > 0 ? 1 : 0, Math.round((snacksUsed / snacksPerMonth) * snacksSegmentCount))
    : 0;
  const heroStatusClass = status === "active"
    ? "bg-emerald-50 text-emerald-600"
    : status === "cancelled"
      ? "bg-red-50 text-red-600"
      : "bg-amber-50 text-amber-600";

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Header */}
      <div className="px-4 pb-1 pt-[max(env(safe-area-inset-top),16px)]">
        <button
          onClick={() => navigate(-1)}
          className="mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-slate-100 bg-white shadow-sm active:scale-95 transition-transform"
        >
          <ArrowLeft className="h-5 w-5 text-slate-700" />
        </button>
        <h1 className="text-[22px] font-extrabold leading-tight text-slate-950">
          {t("my_subscription") || "My Subscription"}
        </h1>
        <p className="mt-0.5 text-sm font-medium text-slate-500">
          Manage your meal plan and progress
        </p>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 px-4 pb-6">
        {/* Hero Card */}
        <div className="relative mt-2 overflow-hidden rounded-[28px] border border-slate-100 bg-white px-4 py-3.5 shadow-[0_18px_44px_rgba(15,23,42,0.07)]">
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-emerald-50/45 via-transparent to-transparent" />
          <div className="relative">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-700 shadow shadow-emerald-500/20">
                <PlanIcon className="h-4.5 w-4.5 text-white" />
              </div>
              <h2 className="text-base font-extrabold tracking-tight text-slate-950">
                {displayPlanName} Plan
              </h2>
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${heroStatusClass}`}>
                <span className="h-1.5 w-1.5 rotate-45 rounded-[2px] bg-current" />
                {statusInfo.label}
              </span>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1fr_1fr] md:items-center">
              <div className="flex items-center gap-3">
                <div className="relative h-[88px] w-[88px] shrink-0">
                  <svg className="h-[88px] w-[88px] -rotate-90" viewBox="0 0 112 112" aria-hidden="true">
                    <circle
                      cx="56"
                      cy="56"
                      r={mealRingRadius}
                      fill="none"
                      stroke="#E5E7EB"
                      strokeWidth="8"
                    />
                    <circle
                      cx="56"
                      cy="56"
                      r={mealRingRadius}
                      fill="none"
                      stroke="#16A34A"
                      strokeLinecap="round"
                      strokeWidth="8"
                      strokeDasharray={mealRingCircumference}
                      strokeDashoffset={mealRingOffset}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xl font-extrabold leading-none text-slate-950 tabular-nums">
                      {heroMealCount}
                    </span>
                    <span className="mt-0.5 text-xs font-bold text-emerald-700 tabular-nums">
                      / {isUnlimited ? "∞" : totalMeals}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-extrabold text-slate-950">Meals left</p>
                  <p className="mt-0.5 text-xs font-medium text-slate-500">This cycle</p>
                </div>
              </div>

              <div className="border-slate-100 md:border-l md:px-6">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50">
                    <Utensils className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-extrabold text-slate-950">
                      {mealsUsed} of {isUnlimited ? "∞" : totalMeals}
                    </p>
                    <p className="mt-0.5 text-xs font-medium text-slate-500">meals used</p>
                  </div>
                </div>
                <div className="mt-3 flex gap-[3px]">
                  {Array.from({ length: mealsSegmentCount }).map((_, i) => (
                    <span
                      key={i}
                      className={cn(
                        "h-1 flex-1 rounded-full",
                        i < filledMealSegments ? "bg-emerald-300" : "bg-slate-200"
                      )}
                    />
                  ))}
                </div>
                <p className="mt-3 flex items-center gap-1 text-xs font-medium text-slate-500">
                  <Clock className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="font-extrabold text-emerald-600">{Math.max(0, daysRemaining)} days</span>
                  until reset
                </p>
              </div>

              <div className="border-slate-100 md:border-l md:pl-6">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50">
                    <Apple className="h-5 w-5 text-orange-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-extrabold text-slate-950">
                      {snacksUsed} of {isUnlimited ? "∞" : snacksPerMonth}
                    </p>
                    <p className="mt-0.5 text-xs font-medium text-slate-500">snacks used</p>
                  </div>
                </div>
                <div className="mt-3 flex gap-[3px]">
                  {Array.from({ length: snacksSegmentCount }).map((_, i) => (
                    <span
                      key={i}
                      className={cn(
                        "h-1 flex-1 rounded-full",
                        i < filledSnackSegments ? "bg-orange-400" : "bg-slate-200"
                      )}
                    />
                  ))}
                </div>
                <p className="mt-3 text-xs font-medium text-slate-500">
                  <span className="font-extrabold text-orange-500">{isUnlimited ? "∞" : remainingSnacks}</span> snacks left
                </p>
              </div>

              {isPaused && (
                <div className="rounded-2xl bg-sky-50 px-4 py-3 md:col-span-3">
                  <p className="text-sm font-semibold text-sky-700">
                    Your subscription is currently frozen. Meal ordering is paused.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="flex items-center gap-2.5 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
            <CalendarDays className="h-5 w-5 shrink-0 text-[#22C55E]" />
            <div className="min-w-0">
              <p className="text-lg font-bold leading-none tabular-nums">{Math.max(0, daysRemaining)}</p>
              <p className="mt-0.5 text-[10px] font-medium text-slate-500">days left</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
            <Utensils className="h-5 w-5 shrink-0 text-[#22C55E]" />
            <div className="min-w-0">
              <p className="text-lg font-bold leading-none tabular-nums">{isUnlimited ? "∞" : totalMeals}</p>
              <p className="mt-0.5 text-[10px] font-medium text-slate-500">Monthly Meals</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
            <Apple className="h-5 w-5 shrink-0 text-red-500" />
            <div className="min-w-0">
              <p className="text-lg font-bold leading-none tabular-nums">{isUnlimited ? "∞" : remainingSnacks}</p>
              <p className="mt-0.5 text-[10px] font-medium text-slate-500">snacks left</p>
            </div>
          </div>
        </div>

        {/* Subscription Details */}
        <div className="overflow-hidden rounded-[22px] border border-slate-100 bg-white shadow-sm">
          <div className="flex items-center gap-2.5 border-b border-slate-50 px-5 pb-3 pt-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#22C55E]/10">
              <Shield className="h-4.5 w-4.5 text-[#22C55E]" />
            </div>
            <h3 className="font-bold text-slate-900">{t("subscription_details") || "Subscription Details"}</h3>
          </div>

          <div className="flex items-center justify-between border-b border-slate-50 px-5 py-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#22C55E]/10">
                <ClipboardList className="h-4 w-4 text-[#22C55E]" />
              </div>
              <span className="text-sm text-slate-500">{t("plan_label") || "Plan"}</span>
            </div>
            <span className="font-bold capitalize text-slate-900">{displayPlanName}</span>
          </div>

          <div className="flex items-center justify-between border-b border-slate-50 px-5 py-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#22C55E]/10">
                <Shield className="h-4 w-4 text-[#22C55E]" />
              </div>
              <span className="text-sm text-slate-500">{t("status_label") || "Status"}</span>
            </div>
            <span className="rounded-full bg-[#22C55E]/10 px-2.5 py-1 text-xs font-bold text-[#22C55E]">
              {statusInfo.label}
            </span>
          </div>

          <div className="flex items-center justify-between border-b border-slate-50 px-5 py-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#22C55E]/10">
                <CalendarDays className="h-4 w-4 text-[#22C55E]" />
              </div>
              <span className="text-sm text-slate-500">{t("start_date_label") || "Start Date"}</span>
            </div>
            <span className="text-sm font-semibold text-slate-900">
              {startDate ? format(new Date(startDate), "MMM dd, yyyy") : "—"}
            </span>
          </div>

          <div className="flex items-center justify-between px-5 py-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#22C55E]/10">
                <CalendarDays className="h-4 w-4 text-[#22C55E]" />
              </div>
              <span className="text-sm text-slate-500">{t("end_date_label") || "End Date"}</span>
            </div>
            <span className="text-sm font-semibold text-slate-900">
              {endDate ? format(new Date(endDate), "MMM dd, yyyy") : "—"}
            </span>
          </div>
        </div>

        {/* Available Plans */}
        <div className="pt-2">
          <div className="mb-3 text-center">
            <h3 className="text-base font-extrabold text-slate-950">{t("available_plans")}</h3>
            <p className="mt-0.5 text-xs font-medium text-slate-500">{t("upgrade_anytime")}</p>
          </div>
          <SubscriptionPlansTab
            plans={plans}
            billingInterval={selectedBillingInterval}
            onBillingIntervalChange={setSelectedBillingInterval}
            currentTier={subscription?.tier}
            onSelectPlan={(plan) => { setSelectedPlan(plan); setShowUpgradeDialog(true); }}
          />
        </div>

        {/* Settings Section */}
        <SubscriptionManage
          hasActiveSubscription={hasActiveSubscription}
          endDate={subscription?.end_date ?? null}
          subscriptionId={subscription?.id ?? null}
          subscriptionStatus={subscription?.status}
          freezeDays={freezeDays ?? null}
          isProcessing={isProcessing}
          onReactivate={handleReactivate}
          onRefetch={refetch}
          autoRenew={autoRenew}
          autoRenewLoading={autoRenewLoading}
          onToggleAutoRenew={handleToggleAutoRenew}
          rolloverCredits={rolloverCredits}
        />
      </div>

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
