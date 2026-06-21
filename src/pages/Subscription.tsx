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
  elite:     { icon: Crown, color: "from-amber-400 to-amber-500",    descriptionKey: "plan_elite_desc",     popular: true,  isVip: false },
  healthy:   { icon: Zap,   color: "from-emerald-500 to-teal-500",   descriptionKey: "plan_healthy_desc",   popular: false, isVip: false },
  fresh:     { icon: Star,  color: "from-emerald-400 to-teal-500",   descriptionKey: "plan_fresh_desc",     popular: false, isVip: false },
  weekly:    { icon: Zap,   color: "from-emerald-500 to-teal-500",   descriptionKey: "plan_weekly_desc",    popular: false, isVip: false },
  basic:     { icon: Star,  color: "from-emerald-500 to-teal-500",   descriptionKey: "plan_basic_desc",    popular: false, isVip: false },
  standard:  { icon: Zap,   color: "from-emerald-500 to-teal-500",   descriptionKey: "plan_standard_desc", popular: true,  isVip: false },
  premium:   { icon: Crown, color: "from-amber-400 to-amber-500",    descriptionKey: "plan_premium_desc",  popular: false, isVip: false },
  vip:       { icon: Crown, color: "from-amber-400 to-amber-500",    descriptionKey: "plan_vip_desc",      popular: false, isVip: true  },
};

const TIER_NAMES: Record<string, string> = {
  elite: "Elite",
  healthy: "Healthy",
  fresh: "Fresh",
  weekly: "Weekly Boost",
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
  useEffect(() => { document.title = `${t("subscription")} - Nutrio`; }, [t]);
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
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#f6fbf7]">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#eefaf6]">
          <Loader2 className="h-6 w-6 animate-spin text-[#24b893]" />
        </div>
        <p className="text-sm font-medium text-emerald-950/55">{t("loading_subscription")}</p>
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

  const heroMealCount = isUnlimited ? "All" : isPaused ? "Paused" : effectiveMealsLeft;
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
  return (
    <div className="flex min-h-screen flex-col bg-[#f6fbf7] pb-24 pt-safe">
      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-emerald-900/5 bg-[#f6fbf7]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3 rtl:flex-row-reverse">
        <button
          onClick={() => navigate(-1)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-emerald-950 shadow-sm transition-transform active:scale-95"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
          <div className="min-w-0">
            <h1 className="truncate text-base font-extrabold text-emerald-950">
              {t("my_subscription") || "My Subscription"}
            </h1>
            <p className="truncate text-xs font-medium text-emerald-900/55">
              Manage your meal plan and progress
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col space-y-4 overflow-y-auto px-4 py-4">
        {/* Hero Card */}
        <div className="relative overflow-hidden rounded-[28px] bg-[#103f32] p-5 text-white shadow-[0_18px_45px_rgba(16,63,50,0.20)]">
          <div className="relative">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.12em] text-emerald-100">
                  <PlanIcon className="h-3.5 w-3.5" />
                  {statusInfo.label}
                </div>
                <h2 className="truncate text-2xl font-black leading-tight tracking-tight">
                  {displayPlanName} Plan
                </h2>
                <p className="mt-2 max-w-[15rem] text-sm font-medium leading-relaxed text-white/75">
                  {Math.max(0, daysRemaining)} days left in this cycle
                </p>
              </div>
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#24b893] text-white shadow-lg shadow-black/10">
                <PlanIcon className="h-7 w-7" />
              </div>
            </div>

            <div className="mt-6 grid gap-4">
              <div className="flex items-center gap-3">
                <div className="relative h-[88px] w-[88px] shrink-0">
                  <svg className="h-[88px] w-[88px] -rotate-90" viewBox="0 0 112 112" aria-hidden="true">
                    <circle
                      cx="56"
                      cy="56"
                      r={mealRingRadius}
                      fill="none"
                      stroke="rgba(255,255,255,0.18)"
                      strokeWidth="8"
                    />
                    <circle
                      cx="56"
                      cy="56"
                      r={mealRingRadius}
                      fill="none"
                      stroke="#6DE3C4"
                      strokeLinecap="round"
                      strokeWidth="8"
                      strokeDasharray={mealRingCircumference}
                      strokeDashoffset={mealRingOffset}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="max-w-[4rem] truncate text-xl font-extrabold leading-none text-white tabular-nums">
                      {heroMealCount}
                    </span>
                    <span className="mt-0.5 text-xs font-bold text-emerald-100 tabular-nums">
                      / {isUnlimited ? "All" : totalMeals}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-extrabold text-white">{t("subscription_meals_left")}</p>
                  <p className="mt-0.5 text-xs font-medium text-white/65">{t("subscription_this_cycle")}</p>
                </div>
              </div>

              <div className="rounded-2xl bg-white/10 p-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10">
                    <Utensils className="h-5 w-5 text-[#6de3c4]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-extrabold text-white">
                      {mealsUsed} of {isUnlimited ? "All" : totalMeals}
                    </p>
                    <p className="mt-0.5 text-xs font-medium text-white/65">meals used</p>
                  </div>
                </div>
                <div className="mt-3 flex gap-[3px]">
                  {Array.from({ length: mealsSegmentCount }).map((_, i) => (
                    <span
                      key={i}
                      className={cn(
                        "h-1 flex-1 rounded-full",
                        i < filledMealSegments ? "bg-[#6de3c4]" : "bg-white/15"
                      )}
                    />
                  ))}
                </div>
                <p className="mt-3 flex items-center gap-1 text-xs font-medium text-white/65">
                  <Clock className="h-3.5 w-3.5 text-[#6de3c4]" />
                  <span className="font-extrabold text-white">{Math.max(0, daysRemaining)} days</span>
                  until reset
                </p>
              </div>

              <div className="rounded-2xl bg-white/10 p-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10">
                    <Apple className="h-5 w-5 text-amber-300" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-extrabold text-white">
                      {snacksUsed} of {isUnlimited ? "All" : snacksPerMonth}
                    </p>
                    <p className="mt-0.5 text-xs font-medium text-white/65">snacks used</p>
                  </div>
                </div>
                <div className="mt-3 flex gap-[3px]">
                  {Array.from({ length: snacksSegmentCount }).map((_, i) => (
                    <span
                      key={i}
                      className={cn(
                        "h-1 flex-1 rounded-full",
                        i < filledSnackSegments ? "bg-amber-300" : "bg-white/15"
                      )}
                    />
                  ))}
                </div>
                <p className="mt-3 text-xs font-medium text-white/65">
                  <span className="font-extrabold text-amber-300">{isUnlimited ? "All" : remainingSnacks}</span> snacks left
                </p>
              </div>

              {isPaused && (
                <div className="rounded-2xl bg-white/10 px-4 py-3">
                  <p className="text-sm font-semibold text-white">
                    Your subscription is currently frozen. Meal ordering is paused.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="flex min-h-[78px] flex-col justify-between rounded-2xl border border-emerald-200/80 bg-white p-3 shadow-sm">
            <CalendarDays className="h-5 w-5 shrink-0 text-[#24b893]" />
            <div className="min-w-0">
              <p className="text-lg font-black leading-none text-emerald-950 tabular-nums">{Math.max(0, daysRemaining)}</p>
              <p className="mt-0.5 text-[10px] font-bold text-emerald-950/50">days left</p>
            </div>
          </div>
          <div className="flex min-h-[78px] flex-col justify-between rounded-2xl border border-emerald-200/80 bg-white p-3 shadow-sm">
            <Utensils className="h-5 w-5 shrink-0 text-[#24b893]" />
            <div className="min-w-0">
              <p className="text-lg font-black leading-none text-emerald-950 tabular-nums">{isUnlimited ? "All" : totalMeals}</p>
              <p className="mt-0.5 truncate text-[10px] font-bold text-emerald-950/50">{t("subscription_monthly_meals")}</p>
            </div>
          </div>
          <div className="flex min-h-[78px] flex-col justify-between rounded-2xl border border-emerald-200/80 bg-white p-3 shadow-sm">
            <Apple className="h-5 w-5 shrink-0 text-amber-500" />
            <div className="min-w-0">
              <p className="text-lg font-black leading-none text-emerald-950 tabular-nums">{isUnlimited ? "All" : remainingSnacks}</p>
              <p className="mt-0.5 text-[10px] font-bold text-emerald-950/50">snacks left</p>
            </div>
          </div>
        </div>

        {/* Subscription Details */}
        <div className="overflow-hidden rounded-[28px] border border-emerald-200/80 bg-white shadow-sm">
          <div className="flex items-center gap-2.5 border-b border-emerald-900/5 px-5 pb-3 pt-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#eefaf6]">
              <Shield className="h-5 w-5 text-[#24b893]" />
            </div>
            <h3 className="font-black text-emerald-950">{t("subscription_details") || "Subscription Details"}</h3>
          </div>

          <div className="flex items-center justify-between gap-4 border-b border-emerald-900/5 px-5 py-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#eefaf6]">
                <ClipboardList className="h-4 w-4 text-[#24b893]" />
              </div>
              <span className="text-sm font-semibold text-emerald-950/55">{t("plan_label") || "Plan"}</span>
            </div>
            <span className="truncate text-sm font-extrabold capitalize text-emerald-950">{displayPlanName}</span>
          </div>

          <div className="flex items-center justify-between gap-4 border-b border-emerald-900/5 px-5 py-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#eefaf6]">
                <Shield className="h-4 w-4 text-[#24b893]" />
              </div>
              <span className="text-sm font-semibold text-emerald-950/55">{t("status_label") || "Status"}</span>
            </div>
            <span className="rounded-full bg-[#e6f8f2] px-2.5 py-1 text-xs font-extrabold text-[#12856c]">
              {statusInfo.label}
            </span>
          </div>

          <div className="flex items-center justify-between gap-4 border-b border-emerald-900/5 px-5 py-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#eefaf6]">
                <CalendarDays className="h-4 w-4 text-[#24b893]" />
              </div>
              <span className="text-sm font-semibold text-emerald-950/55">{t("start_date_label") || "Start Date"}</span>
            </div>
            <span className="text-sm font-extrabold text-emerald-950">
              {startDate ? format(new Date(startDate), "MMM dd, yyyy") : "-"}
            </span>
          </div>

          <div className="flex items-center justify-between gap-4 px-5 py-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#eefaf6]">
                <CalendarDays className="h-4 w-4 text-[#24b893]" />
              </div>
              <span className="text-sm font-semibold text-emerald-950/55">{t("end_date_label") || "End Date"}</span>
            </div>
            <span className="text-sm font-extrabold text-emerald-950">
              {endDate ? format(new Date(endDate), "MMM dd, yyyy") : "-"}
            </span>
          </div>
        </div>

        {/* Available Plans */}
        <div className="pt-1">
          <div className="mb-3 px-1">
            <h3 className="text-base font-black text-emerald-950">{t("available_plans")}</h3>
            <p className="mt-0.5 text-xs font-medium text-emerald-950/50">{t("upgrade_anytime")}</p>
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
