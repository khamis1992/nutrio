import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Loader2,
  Crown, Zap, Star, Clock, Apple, Utensils,
  Shield, ClipboardList, CalendarDays, HeartHandshake, Sparkles,
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
import { useRecoveryStatus, useRecoveryOffers, useReactivateSubscription, useApplyRecoveryOffer, useDismissRecovery } from "@/hooks/useSubscriptionRecovery";
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
import { RecoveryOfferSheet } from "@/components/subscription/RecoveryOfferSheet";
import { ExpiryBanner } from "@/components/subscription/ExpiryBanner";

const TIER_META: Record<string, { icon: LucideIcon; color: string; descriptionKey: string; popular: boolean; isVip: boolean }> = {
  elite:     { icon: Crown, color: "from-amber-400 to-orange-500",   descriptionKey: "plan_elite_desc",     popular: true,  isVip: false },
  healthy:   { icon: Zap,   color: "from-emerald-400 to-emerald-600", descriptionKey: "plan_healthy_desc",   popular: false, isVip: false },
  fresh:     { icon: Star,  color: "from-emerald-400 to-emerald-600", descriptionKey: "plan_fresh_desc",     popular: false, isVip: false },
  weekly:    { icon: Zap,   color: "from-emerald-400 to-emerald-600", descriptionKey: "plan_weekly_desc",    popular: false, isVip: false },
  basic:     { icon: Star,  color: "from-emerald-400 to-emerald-600", descriptionKey: "plan_basic_desc",    popular: false, isVip: false },
  standard:  { icon: Zap,   color: "from-emerald-400 to-emerald-600", descriptionKey: "plan_standard_desc", popular: true,  isVip: false },
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
    isExpired,
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

  const { status: recoveryStatus, isLoading: recoveryLoading } = useRecoveryStatus();
  const { offers: recoveryOffers } = useRecoveryOffers();
  const { reactivate: handleReactivateSub } = useReactivateSubscription();
  const { applyOffer } = useApplyRecoveryOffer();
  const { dismiss } = useDismissRecovery();
  const [showRecoverySheet, setShowRecoverySheet] = useState(false);
  const [isApplyingOffer, setIsApplyingOffer] = useState(false);

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
        const result = await handleReactivateSub(subscription.id);
        if (!result.success) throw new Error(result.error || "Reactivation failed");
        await refetch();
      } catch (err) {
        toast({ title: "Error", description: `Failed to reactivate: ${err instanceof Error ? err.message : "Unknown error"}`, variant: "destructive" });
      }
    }
    setIsProcessing(false);
  };

  const handleShowRecoverySheet = () => setShowRecoverySheet(true);

  const handleApplyOffer = async (offerCode: string) => {
    if (!subscription?.id) return;
    setIsApplyingOffer(true);
    try {
      const result = await applyOffer(subscription.id, offerCode);
      if (result.success) {
        setShowRecoverySheet(false);
        await refetch();
      } else {
        toast({ title: "Error", description: result.error || "Failed to apply offer", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error", description: `Failed to apply offer: ${err instanceof Error ? err.message : "Unknown error"}`, variant: "destructive" });
    }
    setIsApplyingOffer(false);
  };

  const handleDismissRecovery = async () => {
    await dismiss();
    setShowRecoverySheet(false);
  };

  const handleReactivateDirect = async () => {
    if (!subscription?.id) return;
    setIsProcessing(true);
    try {
      const result = await handleReactivateSub(subscription.id);
      if (result.success) {
        setShowRecoverySheet(false);
        await refetch();
      } else {
        toast({ title: "Error", description: result.error || "Failed to reactivate", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error", description: `Failed to reactivate: ${err instanceof Error ? err.message : "Unknown error"}`, variant: "destructive" });
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
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#F6F8FB]">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white ring-1 ring-[#E5EAF1]">
          <Loader2 className="h-6 w-6 animate-spin text-[#22C7A1]" />
        </div>
        <p className="text-sm font-medium text-[#94A3B8]">{t("loading_subscription")}</p>
      </div>
    );
  }

  if (!hasActiveSubscription) {
    if (isExpired && subscription?.id) {
      return (
        <>
          <div className="flex min-h-screen flex-col bg-[#F6F8FB] pb-24 pt-safe text-[#020617]">
            <div className="sticky top-0 z-20 border-b border-[#E5EAF1] bg-[#F6F8FB]/92 backdrop-blur-xl">
              <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3 rtl:flex-row-reverse">
                <button
                  data-testid="subscription-back-btn"
                  onClick={() => navigate(-1)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[#020617] shadow-sm ring-1 ring-[#E5EAF1] transition-transform active:scale-95"
                  aria-label="Go back"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div className="min-w-0">
                  <h1 className="truncate text-base font-extrabold text-[#020617]">My Subscription</h1>
                  <p className="truncate text-xs font-medium text-[#94A3B8]">Reactivate to continue enjoying meals</p>
                </div>
              </div>
            </div>

            <div className="mx-auto flex w-full max-w-lg flex-1 flex-col space-y-4 overflow-y-auto px-4 py-4">
              {/* Recovery Banner */}
              <div className="relative overflow-hidden rounded-[28px] border border-[#E5EAF1] bg-white p-5 text-[#020617] shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
                <div className="absolute right-0 top-0 h-32 w-32 text-[#22C7A1] opacity-10">
                  <HeartHandshake className="w-full h-full" />
                </div>
                <div className="relative">
                  <div className="inline-flex items-center gap-2 rounded-full bg-[#E6FBF5] px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-[#22C7A1] ring-1 ring-[#BFF4E6]">
                    <Sparkles className="h-3.5 w-3.5" />
                    Subscription Expired
                  </div>
                  <h2 className="mt-3 text-xl font-black leading-tight">We miss you!</h2>
                  <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-[#94A3B8]">
                    Your subscription ended. Don't worry — we have exclusive offers to welcome you back.
                  </p>
                  <div className="mt-4 flex gap-3">
                    <button
                      data-testid="subscription-welcome-offers-btn"
                      onClick={handleShowRecoverySheet}
                      disabled={recoveryLoading || isProcessing}
                      className="inline-flex items-center gap-2 rounded-2xl bg-[#020617] px-5 py-3 text-sm font-extrabold text-white shadow-lg transition-transform active:scale-95"
                    >
                      <Sparkles className="h-4 w-4" />
                      See Welcome Offers
                    </button>
                    <button
                      data-testid="subscription-reactivate-btn"
                      onClick={handleReactivateDirect}
                      disabled={recoveryLoading || isProcessing}
                      className="inline-flex items-center gap-2 rounded-2xl border border-[#E5EAF1] bg-[#F6F8FB] px-5 py-3 text-sm font-bold text-[#020617] transition-transform active:scale-95"
                    >
                      {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Reactivate Now
                    </button>
                  </div>
                </div>
              </div>

              {/* Plan Picker */}
              <PlanPickerMode
                plans={plans}
                billingInterval={selectedBillingInterval}
                onBillingIntervalChange={setSelectedBillingInterval}
                vipAnnualSavings={vipAnnualSavings}
              />
            </div>
          </div>

          <RecoveryOfferSheet
            isOpen={showRecoverySheet}
            onClose={() => setShowRecoverySheet(false)}
            offers={recoveryOffers}
            daysSinceExpiry={recoveryStatus?.days_since_expiry ?? 1}
            subscriptionId={subscription.id}
            isApplying={isApplyingOffer}
            onApplyOffer={handleApplyOffer}
            onDismiss={handleDismissRecovery}
            onReactivateDirect={handleReactivateDirect}
          />
        </>
      );
    }

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
    active: { label: t("status_active") || "Active", className: "bg-[#E6FBF5] text-[#22C7A1] ring-1 ring-[#BFF4E6]" },
    cancelled: { label: t("cancelled_active") || "Cancelled", className: "bg-red-50 text-red-600 ring-1 ring-red-100" },
    pending: { label: t("paused") || "Paused", className: "bg-[#FFF1F3] text-[#FB6B7A] ring-1 ring-[#FFD3DA]" },
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
    <div className="flex min-h-screen flex-col bg-[#F6F8FB] pb-24 pt-safe text-[#020617]">
      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-[#E5EAF1] bg-[#F6F8FB]/92 backdrop-blur-xl">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3 rtl:flex-row-reverse">
        <button
          data-testid="subscription-back-btn"
          onClick={() => navigate(-1)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[#020617] shadow-sm ring-1 ring-[#E5EAF1] transition-transform active:scale-95"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
          <div className="min-w-0">
            <h1 className="truncate text-base font-extrabold text-[#020617]">
              {t("my_subscription") || "My Subscription"}
            </h1>
            <p className="truncate text-xs font-medium text-[#94A3B8]">
              Manage your meal plan and progress
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col space-y-4 overflow-y-auto px-4 py-4">
        {/* Hero Card */}
        <div className="relative overflow-hidden rounded-[28px] bg-white p-5 text-[#020617] shadow-[0_18px_45px_rgba(15,23,42,0.06)] ring-1 ring-[#E5EAF1]">
          <div className="relative">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className={`mb-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.12em] ${statusInfo.className}`}>
                  <PlanIcon className="h-3.5 w-3.5" />
                  {statusInfo.label}
                </div>
                <h2 className="truncate text-2xl font-black leading-tight tracking-tight">
                  {displayPlanName} Plan
                </h2>
                <p className="mt-2 max-w-[15rem] text-sm font-medium leading-relaxed text-[#94A3B8]">
                  {Math.max(0, daysRemaining)} days left in this cycle
                </p>
              </div>
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#020617] text-white shadow-[0_10px_24px_rgba(2,6,23,0.18)]">
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
                      stroke="#E5EAF1"
                      strokeWidth="8"
                    />
                    <circle
                      cx="56"
                      cy="56"
                      r={mealRingRadius}
                      fill="none"
                      stroke="#22C7A1"
                      strokeLinecap="round"
                      strokeWidth="8"
                      strokeDasharray={mealRingCircumference}
                      strokeDashoffset={mealRingOffset}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="max-w-[4rem] truncate text-xl font-extrabold leading-none text-[#020617] tabular-nums">
                      {heroMealCount}
                    </span>
                    <span className="mt-0.5 text-xs font-bold text-[#94A3B8] tabular-nums">
                      / {isUnlimited ? "All" : totalMeals}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-extrabold text-[#020617]">{t("subscription_meals_left")}</p>
                  <p className="mt-0.5 text-xs font-medium text-[#94A3B8]">{t("subscription_this_cycle")}</p>
                </div>
              </div>

              <div className="rounded-2xl bg-[#F6F8FB] p-3 ring-1 ring-[#E5EAF1]">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E6FBF5] ring-1 ring-[#BFF4E6]">
                    <Utensils className="h-5 w-5 text-[#22C7A1]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-extrabold text-[#020617]">
                      {mealsUsed} of {isUnlimited ? "All" : totalMeals}
                    </p>
                    <p className="mt-0.5 text-xs font-medium text-[#94A3B8]">meals used</p>
                  </div>
                </div>
                <div className="mt-3 flex gap-[3px]">
                  {Array.from({ length: mealsSegmentCount }).map((_, i) => (
                    <span
                      key={i}
                      className={cn(
                        "h-1 flex-1 rounded-full",
                        i < filledMealSegments ? "bg-[#22C7A1]" : "bg-[#E5EAF1]"
                      )}
                    />
                  ))}
                </div>
                <p className="mt-3 flex items-center gap-1 text-xs font-medium text-[#94A3B8]">
                  <Clock className="h-3.5 w-3.5 text-[#22C7A1]" />
                  <span className="font-extrabold text-[#020617]">{Math.max(0, daysRemaining)} days</span>
                  until reset
                </p>
              </div>

              <div className="rounded-2xl bg-[#F6F8FB] p-3 ring-1 ring-[#E5EAF1]">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FFF1F3] ring-1 ring-[#FFD3DA]">
                    <Apple className="h-5 w-5 text-[#FB6B7A]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-extrabold text-[#020617]">
                      {snacksUsed} of {isUnlimited ? "All" : snacksPerMonth}
                    </p>
                    <p className="mt-0.5 text-xs font-medium text-[#94A3B8]">snacks used</p>
                  </div>
                </div>
                <div className="mt-3 flex gap-[3px]">
                  {Array.from({ length: snacksSegmentCount }).map((_, i) => (
                    <span
                      key={i}
                      className={cn(
                        "h-1 flex-1 rounded-full",
                        i < filledSnackSegments ? "bg-[#FB6B7A]" : "bg-[#E5EAF1]"
                      )}
                    />
                  ))}
                </div>
                <p className="mt-3 text-xs font-medium text-[#94A3B8]">
                  <span className="font-extrabold text-[#FB6B7A]">{isUnlimited ? "All" : remainingSnacks}</span> snacks left
                </p>
              </div>

              {isPaused && (
                <div className="rounded-2xl bg-[#FFF1F3] px-4 py-3 ring-1 ring-[#FFD3DA]">
                  <p className="text-sm font-semibold text-[#FB6B7A]">
                    Your subscription is currently frozen. Meal ordering is paused.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="flex min-h-[78px] flex-col justify-between rounded-2xl bg-white p-3 shadow-sm ring-1 ring-[#E5EAF1]">
            <CalendarDays className="h-5 w-5 shrink-0 text-[#38BDF8]" />
            <div className="min-w-0">
              <p className="text-lg font-black leading-none text-[#020617] tabular-nums">{Math.max(0, daysRemaining)}</p>
              <p className="mt-0.5 text-[10px] font-bold text-[#94A3B8]">days left</p>
            </div>
          </div>
          <div className="flex min-h-[78px] flex-col justify-between rounded-2xl bg-white p-3 shadow-sm ring-1 ring-[#E5EAF1]">
            <Utensils className="h-5 w-5 shrink-0 text-[#22C7A1]" />
            <div className="min-w-0">
              <p className="text-lg font-black leading-none text-[#020617] tabular-nums">{isUnlimited ? "All" : totalMeals}</p>
              <p className="mt-0.5 truncate text-[10px] font-bold text-[#94A3B8]">{t("subscription_monthly_meals")}</p>
            </div>
          </div>
          <div className="flex min-h-[78px] flex-col justify-between rounded-2xl bg-white p-3 shadow-sm ring-1 ring-[#E5EAF1]">
            <Apple className="h-5 w-5 shrink-0 text-[#FB6B7A]" />
            <div className="min-w-0">
              <p className="text-lg font-black leading-none text-[#020617] tabular-nums">{isUnlimited ? "All" : remainingSnacks}</p>
              <p className="mt-0.5 text-[10px] font-bold text-[#94A3B8]">snacks left</p>
            </div>
          </div>
        </div>

        {hasActiveSubscription && (
          <ExpiryBanner
            status={status}
            endDate={endDate || null}
            onRenew={() => setShowUpgradeDialog(true)}
            onSeePlans={() => {
              const el = document.getElementById("available-plans");
              el?.scrollIntoView({ behavior: "smooth" });
            }}
          />
        )}

        {/* Subscription Details */}
        <div className="overflow-hidden rounded-[28px] bg-white shadow-sm ring-1 ring-[#E5EAF1]">
          <div className="flex items-center gap-2.5 border-b border-[#E5EAF1] px-5 pb-3 pt-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#EEF2FF] ring-1 ring-[#D8DDFF]">
              <Shield className="h-5 w-5 text-[#7C83F6]" />
            </div>
            <h3 className="font-black text-[#020617]">{t("subscription_details") || "Subscription Details"}</h3>
          </div>

          <div className="flex items-center justify-between gap-4 border-b border-[#E5EAF1] px-5 py-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#F6F8FB] ring-1 ring-[#E5EAF1]">
                <ClipboardList className="h-4 w-4 text-[#22C7A1]" />
              </div>
              <span className="text-sm font-semibold text-[#94A3B8]">{t("plan_label") || "Plan"}</span>
            </div>
            <span className="truncate text-sm font-extrabold capitalize text-[#020617]">{displayPlanName}</span>
          </div>

          <div className="flex items-center justify-between gap-4 border-b border-[#E5EAF1] px-5 py-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#F6F8FB] ring-1 ring-[#E5EAF1]">
                <Shield className="h-4 w-4 text-[#7C83F6]" />
              </div>
              <span className="text-sm font-semibold text-[#94A3B8]">{t("status_label") || "Status"}</span>
            </div>
            <span className="rounded-full bg-[#E6FBF5] px-2.5 py-1 text-xs font-extrabold text-[#22C7A1] ring-1 ring-[#BFF4E6]">
              {statusInfo.label}
            </span>
          </div>

          <div className="flex items-center justify-between gap-4 border-b border-[#E5EAF1] px-5 py-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#F6F8FB] ring-1 ring-[#E5EAF1]">
                <CalendarDays className="h-4 w-4 text-[#38BDF8]" />
              </div>
              <span className="text-sm font-semibold text-[#94A3B8]">{t("start_date_label") || "Start Date"}</span>
            </div>
            <span className="text-sm font-extrabold text-[#020617]">
              {startDate ? format(new Date(startDate), "MMM dd, yyyy") : "-"}
            </span>
          </div>

          <div className="flex items-center justify-between gap-4 px-5 py-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#F6F8FB] ring-1 ring-[#E5EAF1]">
                <CalendarDays className="h-4 w-4 text-[#38BDF8]" />
              </div>
              <span className="text-sm font-semibold text-[#94A3B8]">{t("end_date_label") || "End Date"}</span>
            </div>
            <span className="text-sm font-extrabold text-[#020617]">
              {endDate ? format(new Date(endDate), "MMM dd, yyyy") : "-"}
            </span>
          </div>
        </div>

        {/* Available Plans */}
        <div id="available-plans" className="pt-1">
          <div className="mb-3 px-1">
            <h3 className="text-base font-black text-[#020617]">{t("available_plans")}</h3>
            <p className="mt-0.5 text-xs font-medium text-[#94A3B8]">{t("upgrade_anytime")}</p>
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
