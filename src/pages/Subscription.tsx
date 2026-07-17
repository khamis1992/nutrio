import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Loader2,
  Crown, Zap, Clock, Apple, Utensils,
  Shield, ClipboardList, CalendarDays, HeartHandshake, Sparkles, ChevronRight
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { useFreezeDaysRemaining } from "@/hooks/useSubscriptionFreeze";
import { supabase } from "@/integrations/supabase/client";
import { differenceInDays, format } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

import { SubscriptionManage } from "@/components/subscription/SubscriptionManage";
import { ExpiryBanner } from "@/components/subscription/ExpiryBanner";

export default function SubscriptionPage() {
  const { t } = useLanguage();
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
    isUnlimited,
    isVip,
    isPaused,
    resumeSubscription,
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

  const [isProcessing, setIsProcessing] = useState(false);
  const { data: freezeDays } = useFreezeDaysRemaining(subscription?.id);

  const handleReactivate = async () => {
    if (!subscription?.id) return;

    if (!isPaused) {
      navigate("/subscription/plans?source=reactivation");
      return;
    }

    setIsProcessing(true);
    try {
      const resumed = await resumeSubscription();
      if (!resumed) throw new Error("Subscription cannot be resumed yet");
      await refetch();
    } catch (err) {
      toast({ title: "Error", description: `Failed to resume: ${err instanceof Error ? err.message : "Unknown error"}`, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReactivateDirect = async () => {
    navigate("/subscription/plans?source=reactivation");
  };

  const daysRemaining = subscription?.month_start_date
    ? 30 - differenceInDays(new Date(), new Date(subscription.month_start_date))
    : 30;

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
                    Your subscription ended. Choose a plan to reactivate securely and continue your meals.
                  </p>
                  <div className="mt-4 flex gap-3">
                    <button
                      data-testid="subscription-reactivate-btn"
                      onClick={handleReactivateDirect}
                      disabled={isProcessing}
                      className="inline-flex items-center gap-2 rounded-2xl border border-[#E5EAF1] bg-[#F6F8FB] px-5 py-3 text-sm font-bold text-[#020617] transition-transform active:scale-95"
                    >
                      {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Reactivate Now
                    </button>
                  </div>
                </div>
              </div>

            </div>
          </div>

        </>
      );
    }

    return (
      <div className="flex min-h-screen flex-col bg-[#F6F8FB] pb-24 pt-safe text-[#020617]">
        <header className="sticky top-0 z-20 border-b border-[#E5EAF1] bg-[#F6F8FB]/92 backdrop-blur-xl">
          <div className="mx-auto flex h-14 max-w-lg items-center gap-3 px-4 rtl:flex-row-reverse">
            <button
              onClick={() => navigate(-1)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-[#E5EAF1] active:scale-95"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-base font-extrabold">My Subscription</h1>
              <p className="text-xs font-medium text-[#94A3B8]">Manage your Nutrio membership</p>
            </div>
          </div>
        </header>

        <div className="mx-auto flex w-full max-w-lg flex-1 items-center px-4 py-8">
          <section className="w-full rounded-[28px] bg-white p-6 text-center shadow-[0_18px_45px_rgba(15,23,42,0.06)] ring-1 ring-[#E5EAF1]">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-[#EFFFFA] text-[#22C7A1] ring-1 ring-[#BFF4E6]">
              <Crown className="h-7 w-7" />
            </div>
            <h2 className="mt-5 text-xl font-black">No active subscription</h2>
            <p className="mx-auto mt-2 max-w-xs text-sm font-medium leading-6 text-[#64748B]">
              Choose a plan to receive meal credits and start scheduling your meals.
            </p>
            <button
              type="button"
              onClick={() => navigate("/subscription/plans")}
              className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#020617] text-sm font-extrabold text-white shadow-[0_10px_24px_rgba(2,6,23,0.16)] active:scale-[0.98]"
            >
              View subscription plans
              <ChevronRight className="h-4 w-4 rtl:rotate-180" />
            </button>
          </section>
        </div>
      </div>
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
            onRenew={() => navigate("/subscription/plans?source=reactivation")}
            onSeePlans={() => navigate("/subscription/plans")}
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

        {/* Settings Section */}
        <SubscriptionManage
          subscriptionId={subscription?.id ?? null}
          subscriptionStatus={subscription?.status}
          freezeDays={freezeDays ?? null}
          isProcessing={isProcessing}
          onReactivate={handleReactivate}
          onRefetch={refetch}
          rolloverCredits={rolloverCredits}
        />
      </div>

    </div>
  );
}
