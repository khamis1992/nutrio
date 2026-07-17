import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Apple,
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronRight,
  Crown,
  Loader2,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Utensils,
  WalletCards,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { useLanguage } from "@/contexts/LanguageContext";
import { useSubscription } from "@/hooks/useSubscription";
import {
  useSubscriptionPlans,
  type DbSubscriptionPlan,
} from "@/hooks/useSubscriptionPlans";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type PlanTone = {
  icon: typeof Zap;
  iconClass: string;
  selectedClass: string;
  dotClass: string;
};

const TIER_DISPLAY: Record<
  string,
  { en: string; ar: string; eyebrow: { en: string; ar: string }; tone: PlanTone }
> = {
  fresh: {
    en: "Fresh Start",
    ar: "بداية منعشة",
    eyebrow: { en: "Simple start", ar: "بداية بسيطة" },
    tone: {
      icon: Sparkles,
      iconClass: "bg-[#EFF9FF] text-[#38BDF8]",
      selectedClass: "border-[#38BDF8] bg-[#F5FCFF]",
      dotClass: "bg-[#38BDF8]",
    },
  },
  healthy: {
    en: "Healthy Balance",
    ar: "توازن صحي",
    eyebrow: { en: "Best value", ar: "أفضل قيمة" },
    tone: {
      icon: Zap,
      iconClass: "bg-[#E9FBF7] text-[#22C7A1]",
      selectedClass: "border-[#22C7A1] bg-[#F3FCF9]",
      dotClass: "bg-[#22C7A1]",
    },
  },
  elite: {
    en: "Nutrio Elite",
    ar: "نخبة نوتريو",
    eyebrow: { en: "Most complete", ar: "الأكثر شمولاً" },
    tone: {
      icon: Crown,
      iconClass: "bg-[#FFF7ED] text-[#F97316]",
      selectedClass: "border-[#F97316] bg-[#FFFBF5]",
      dotClass: "bg-[#F97316]",
    },
  },
  weekly: {
    en: "Weekly Boost",
    ar: "دفعة أسبوعية",
    eyebrow: { en: "Flexible", ar: "مرنة" },
    tone: {
      icon: CalendarDays,
      iconClass: "bg-[#F3F4FF] text-[#7C83F6]",
      selectedClass: "border-[#7C83F6] bg-[#F8F8FF]",
      dotClass: "bg-[#7C83F6]",
    },
  },
};

const FALLBACK_TONE: PlanTone = {
  icon: Utensils,
  iconClass: "bg-[#F1F5F9] text-[#64748B]",
  selectedClass: "border-[#22C7A1] bg-[#F3FCF9]",
  dotClass: "bg-[#22C7A1]",
};

const intervalRank = (interval: string) => {
  if (interval === "monthly") return 0;
  if (interval === "annual") return 1;
  if (interval === "weekly") return 2;
  return 3;
};

export default function SubscriptionPlans() {
  const { language, t } = useLanguage();
  const isArabic = language === "ar";
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isReactivation = searchParams.get("source") === "reactivation";
  const { plans, loading, error } = useSubscriptionPlans();
  const { subscription } = useSubscription();

  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [selectedInterval, setSelectedInterval] = useState<string>("monthly");
  const [isProcessing, setIsProcessing] = useState(false);

  const copy = isArabic
    ? {
        title: isReactivation ? "إعادة تفعيل الاشتراك" : "اختر خطة الوجبات",
        subtitle: isReactivation
          ? "اختر الخطة المناسبة للعودة إلى روتينك"
          : "قارن الرصيد والمزايا قبل الاشتراك",
        welcome: "مرحباً بعودتك",
        welcomeTitle: "استأنف خطتك بسهولة",
        welcomeBody: "خطة واحدة واضحة، ويمكنك مراجعة التكلفة والتفاصيل قبل الدفع.",
        previous: "خطتك السابقة",
        billing: "دورة الدفع",
        choose: "اختر خطتك",
        selected: "محددة",
        included: "المتضمن في الخطة",
        meals: "وجبة",
        mealsWeek: "وجبات أسبوعياً",
        snacks: "وجبة خفيفة",
        pricePerMeal: "للوجبة تقريباً",
        features: "مزايا الخطة",
        noFeatures: "مرونة في اختيار وجدولة الوجبات",
        review: "ستراجع الطلب والتكلفة النهائية قبل الدفع.",
        secure: "دفع آمن",
        activation: "تفعيل فوري",
        noFees: "دون رسوم مخفية",
        monthly: "شهري",
        annual: "سنوي",
        weekly: "أسبوعي",
        month: "شهر",
        year: "سنة",
        week: "أسبوع",
        continue: isReactivation ? "متابعة إعادة التفعيل" : "متابعة الاشتراك",
        current: "خطتك الحالية",
        retry: "إعادة المحاولة",
        loadError: "تعذر تحميل الخطط حالياً",
        signIn: "يرجى تسجيل الدخول للاشتراك",
        processError: "تعذرت متابعة الاشتراك",
      }
    : {
        title: isReactivation ? "Reactivate subscription" : "Choose a meal plan",
        subtitle: isReactivation
          ? "Pick the right plan to restart your routine"
          : "Compare credits and benefits before subscribing",
        welcome: "Welcome back",
        welcomeTitle: "Restart without the guesswork",
        welcomeBody: "Choose one clear plan and review every detail before payment.",
        previous: "Previous plan",
        billing: "Billing cycle",
        choose: "Choose your plan",
        selected: "Selected",
        included: "What is included",
        meals: "meals",
        mealsWeek: "meals per week",
        snacks: "snacks",
        pricePerMeal: "approx. per meal",
        features: "Plan benefits",
        noFeatures: "Flexible meal selection and scheduling",
        review: "You will review the final order and total before payment.",
        secure: "Secure payment",
        activation: "Instant activation",
        noFees: "No hidden fees",
        monthly: "Monthly",
        annual: "Annual",
        weekly: "Weekly",
        month: "month",
        year: "year",
        week: "week",
        continue: isReactivation ? "Continue reactivation" : "Continue to checkout",
        current: "Current plan",
        retry: "Try again",
        loadError: t("subscription_plans_load_error") || "Plans could not be loaded",
        signIn: "Please sign in to subscribe",
        processError: "Unable to continue with this subscription",
      };

  const intervals = useMemo(
    () => [...new Set(plans.map((plan) => plan.billing_interval))].sort(
      (a, b) => intervalRank(a) - intervalRank(b),
    ),
    [plans],
  );

  useEffect(() => {
    if (plans.length === 0) return;
    const previousInterval = subscription?.billing_interval;
    const nextInterval = previousInterval && intervals.includes(previousInterval)
      ? previousInterval
      : intervals.includes("monthly")
        ? "monthly"
        : intervals[0];
    setSelectedInterval(nextInterval);
  }, [intervals, plans.length, subscription?.billing_interval]);

  const filteredPlans = useMemo(
    () => plans
      .filter((plan) => plan.billing_interval === selectedInterval)
      .sort((a, b) => {
        if (isReactivation && subscription?.tier) {
          if (a.tier === subscription.tier && b.tier !== subscription.tier) return -1;
          if (a.tier !== subscription.tier && b.tier === subscription.tier) return 1;
        }
        return a.price_qar - b.price_qar;
      }),
    [isReactivation, plans, selectedInterval, subscription?.tier],
  );

  useEffect(() => {
    if (filteredPlans.length === 0) {
      setSelectedPlanId(null);
      return;
    }
    const selectionStillVisible = filteredPlans.some((plan) => plan.id === selectedPlanId);
    if (selectionStillVisible) return;
    const previousPlan = filteredPlans.find((plan) => plan.tier === subscription?.tier);
    setSelectedPlanId((previousPlan ?? filteredPlans[0]).id);
  }, [filteredPlans, selectedPlanId, subscription?.tier]);

  const selectedPlan = filteredPlans.find((plan) => plan.id === selectedPlanId) ?? null;

  const getDisplay = (plan: DbSubscriptionPlan) => {
    const display = TIER_DISPLAY[plan.tier];
    return {
      name: isArabic
        ? plan.name_ar || display?.ar || plan.tier
        : display?.en || plan.tier,
      eyebrow: display
        ? isArabic ? display.eyebrow.ar : display.eyebrow.en
        : isArabic ? "خطة وجبات" : "Meal plan",
      tone: display?.tone ?? FALLBACK_TONE,
    };
  };

  const getIntervalLabel = (interval: string) => {
    if (interval === "annual") return copy.annual;
    if (interval === "weekly") return copy.weekly;
    return copy.monthly;
  };

  const getPeriodLabel = (interval: string) => {
    if (interval === "annual") return copy.year;
    if (interval === "weekly") return copy.week;
    return copy.month;
  };

  const handleContinue = async () => {
    if (!selectedPlan) return;
    setIsProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error(copy.signIn);
        navigate("/subscription");
        return;
      }
      const query = new URLSearchParams({
        type: "subscription",
        planId: selectedPlan.id,
      });
      if (subscription?.id) query.set("subscriptionId", subscription.id);
      if (isReactivation) query.set("source", "reactivation");
      navigate(`/checkout?${query.toString()}`);
    } catch (checkoutError) {
      console.error("Subscription checkout error:", checkoutError);
      toast.error(copy.processError);
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F6F8FB]">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-[#E5EAF1]">
            <Loader2 className="h-6 w-6 animate-spin text-[#22C7A1]" />
          </div>
          <span className="text-xs font-semibold text-[#94A3B8]">{copy.title}</span>
        </div>
      </div>
    );
  }

  if (error || plans.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F6F8FB] px-6">
        <section className="w-full max-w-sm rounded-[28px] bg-white p-6 text-center shadow-[0_18px_45px_rgba(15,23,42,0.06)] ring-1 ring-[#E5EAF1]">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFF1F3] text-[#FB6B7A]">
            <RotateCcw className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-lg font-black text-[#020617]">{copy.loadError}</h1>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 h-12 w-full rounded-2xl bg-[#020617] text-sm font-extrabold text-white active:scale-[0.98]"
          >
            {copy.retry}
          </button>
        </section>
      </div>
    );
  }

  const selectedDisplay = selectedPlan ? getDisplay(selectedPlan) : null;
  const SelectedIcon = selectedDisplay?.tone.icon ?? Utensils;
  const pricePerMeal = selectedPlan && selectedPlan.meals_per_month > 0
    ? selectedPlan.price_per_meal ?? selectedPlan.price_qar / selectedPlan.meals_per_month
    : 0;
  const localizedDescription = selectedPlan
    ? isArabic
      ? selectedPlan.short_description_ar || selectedPlan.description || selectedPlan.short_description
      : selectedPlan.short_description || selectedPlan.description_en || selectedPlan.description
    : null;
  const isCurrentSelection = Boolean(
    selectedPlan
      && subscription?.tier === selectedPlan.tier
      && (subscription.billing_interval ?? "monthly") === selectedPlan.billing_interval
      && subscription.status !== "expired",
  );

  return (
    <div className="min-h-screen bg-[#F6F8FB] pb-[calc(112px+env(safe-area-inset-bottom))] text-[#020617]">
      <header className="sticky top-0 z-40 border-b border-[#E5EAF1] bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-lg items-center gap-3 px-4 rtl:flex-row-reverse">
          <button
            type="button"
            data-testid="subscription-plans-back-btn"
            onClick={() => navigate(-1)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F6F8FB] ring-1 ring-[#E5EAF1] transition active:scale-95"
            aria-label={isArabic ? "رجوع" : "Go back"}
          >
            <ArrowLeft className="h-5 w-5 rtl:rotate-180" />
          </button>
          <div className="min-w-0 flex-1 text-start">
            <h1 className="truncate text-[16px] font-black">{copy.title}</h1>
            <p className="mt-0.5 truncate text-[11px] font-semibold text-[#94A3B8]">{copy.subtitle}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg px-4 py-4">
        {isReactivation && (
          <section className="overflow-hidden rounded-[24px] border border-[#BFF4E6] bg-[#EEFCF8] p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-[#22C7A1] shadow-sm">
                <RotateCcw className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1 text-start">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#0F9F82]">{copy.welcome}</p>
                <h2 className="mt-1 text-[17px] font-black leading-tight">{copy.welcomeTitle}</h2>
                <p className="mt-1.5 text-[12px] font-medium leading-5 text-[#64748B]">{copy.welcomeBody}</p>
              </div>
            </div>
            {subscription?.tier && (
              <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#CDEFE5] pt-3 text-start">
                <span className="text-[11px] font-semibold text-[#64748B]">{copy.previous}</span>
                <span className="truncate text-[12px] font-black text-[#0F9F82]">
                  {TIER_DISPLAY[subscription.tier]
                    ? isArabic ? TIER_DISPLAY[subscription.tier].ar : TIER_DISPLAY[subscription.tier].en
                    : subscription.tier}
                </span>
              </div>
            )}
          </section>
        )}

        {intervals.length > 1 && (
          <section className="mt-5">
            <p className="mb-2 px-1 text-start text-[11px] font-black uppercase tracking-[0.1em] text-[#94A3B8]">{copy.billing}</p>
            <div className="grid grid-cols-2 gap-1 rounded-2xl bg-[#E9EDF3] p-1">
              {intervals.map((interval) => (
                <button
                  type="button"
                  key={interval}
                  onClick={() => setSelectedInterval(interval)}
                  className={cn(
                    "min-h-11 rounded-xl px-3 text-[13px] font-extrabold transition",
                    selectedInterval === interval
                      ? "bg-white text-[#020617] shadow-sm"
                      : "text-[#64748B]",
                  )}
                >
                  {getIntervalLabel(interval)}
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="mt-5">
          <div className="mb-3 flex items-end justify-between gap-3 px-1">
            <div className="text-start">
              <p className="text-[11px] font-black uppercase tracking-[0.1em] text-[#22C7A1]">{copy.choose}</p>
              <p className="mt-0.5 text-[12px] font-semibold text-[#94A3B8]">
                {filteredPlans.length} {isArabic ? "خيارات متاحة" : "options available"}
              </p>
            </div>
          </div>

          <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {filteredPlans.map((plan) => {
              const display = getDisplay(plan);
              const Icon = display.tone.icon;
              const selected = selectedPlanId === plan.id;
              const wasPrevious = isReactivation
                && subscription?.tier === plan.tier
                && (subscription.billing_interval ?? "monthly") === plan.billing_interval;

              return (
                <button
                  type="button"
                  key={plan.id}
                  onClick={() => setSelectedPlanId(plan.id)}
                  className={cn(
                    "relative min-h-[142px] w-[164px] shrink-0 snap-center rounded-[22px] border bg-white p-4 text-start shadow-[0_8px_24px_rgba(15,23,42,0.05)] transition active:scale-[0.98]",
                    selected ? display.tone.selectedClass : "border-[#E5EAF1]",
                  )}
                  aria-pressed={selected}
                >
                  <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl", display.tone.iconClass)}>
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  <p className="mt-3 truncate text-[14px] font-black">{display.name}</p>
                  <p className="mt-1 text-[10px] font-bold text-[#94A3B8]">{display.eyebrow}</p>
                  <div className="mt-2 flex items-baseline gap-1 rtl:flex-row-reverse rtl:justify-end">
                    <span className="text-[16px] font-black tabular-nums">{plan.price_qar.toLocaleString()}</span>
                    <span className="text-[9px] font-bold text-[#64748B]">QAR</span>
                  </div>
                  {wasPrevious && (
                    <span className="absolute end-3 top-3 h-2 w-2 rounded-full bg-[#22C7A1] ring-4 ring-[#E6FBF5]" aria-label={copy.previous} />
                  )}
                  {selected && (
                    <span className="absolute end-3 bottom-3 flex h-5 w-5 items-center justify-center rounded-full bg-[#020617] text-white">
                      <Check className="h-3 w-3" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {selectedPlan && selectedDisplay && (
          <section className="mt-4 overflow-hidden rounded-[28px] bg-white shadow-[0_16px_40px_rgba(15,23,42,0.07)] ring-1 ring-[#E5EAF1]">
            <div className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3 text-start">
                  <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl", selectedDisplay.tone.iconClass)}>
                    <SelectedIcon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-[#22C7A1]">
                      <span className={cn("h-1.5 w-1.5 rounded-full", selectedDisplay.tone.dotClass)} />
                      {copy.selected}
                    </span>
                    <h2 className="mt-1 truncate text-[19px] font-black">{selectedDisplay.name}</h2>
                  </div>
                </div>
                <div className="shrink-0 text-end">
                  <p className="text-[24px] font-black leading-none tabular-nums">{selectedPlan.price_qar.toLocaleString()}</p>
                  <p className="mt-1 text-[10px] font-bold text-[#94A3B8]">QAR / {getPeriodLabel(selectedPlan.billing_interval)}</p>
                </div>
              </div>

              {localizedDescription && (
                <p className="mt-4 text-start text-[12px] font-medium leading-5 text-[#64748B]">{localizedDescription}</p>
              )}

              <div className="mt-5 grid grid-cols-3 gap-2">
                <div className="rounded-2xl bg-[#F6F8FB] p-3 text-center">
                  <Utensils className="mx-auto h-4 w-4 text-[#22C7A1]" />
                  <p className="mt-2 text-[16px] font-black tabular-nums">{selectedPlan.meals_per_month}</p>
                  <p className="mt-0.5 text-[9px] font-bold leading-tight text-[#94A3B8]">{copy.meals}</p>
                </div>
                <div className="rounded-2xl bg-[#F6F8FB] p-3 text-center">
                  <CalendarDays className="mx-auto h-4 w-4 text-[#7C83F6]" />
                  <p className="mt-2 text-[16px] font-black tabular-nums">{selectedPlan.meals_per_week}</p>
                  <p className="mt-0.5 text-[9px] font-bold leading-tight text-[#94A3B8]">{copy.mealsWeek}</p>
                </div>
                <div className="rounded-2xl bg-[#F6F8FB] p-3 text-center">
                  <Apple className="mx-auto h-4 w-4 text-[#FB6B7A]" />
                  <p className="mt-2 text-[16px] font-black tabular-nums">{selectedPlan.snacks_per_month}</p>
                  <p className="mt-0.5 text-[9px] font-bold leading-tight text-[#94A3B8]">{copy.snacks}</p>
                </div>
              </div>

              {pricePerMeal > 0 && (
                <div className="mt-3 flex items-center justify-between rounded-2xl border border-[#E5EAF1] px-4 py-3 text-start">
                  <span className="text-[11px] font-semibold text-[#64748B]">{copy.pricePerMeal}</span>
                  <span className="text-[13px] font-black tabular-nums">{pricePerMeal.toFixed(2)} QAR</span>
                </div>
              )}
            </div>

            <div className="border-t border-[#E5EAF1] bg-[#FBFCFE] p-5">
              <h3 className="text-start text-[12px] font-black">{copy.features}</h3>
              <ul className="mt-3 space-y-3">
                {(selectedPlan.features?.length ? selectedPlan.features.slice(0, 5) : [copy.noFeatures]).map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-start">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#E6FBF5] text-[#22C7A1]">
                      <Check className="h-3 w-3" />
                    </span>
                    <span className="text-[12px] font-semibold leading-5 text-[#475569]">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        <section className="mt-4 rounded-[22px] border border-[#E5EAF1] bg-white px-4 py-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { icon: ShieldCheck, label: copy.secure },
              { icon: Zap, label: copy.activation },
              { icon: WalletCards, label: copy.noFees },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="min-w-0">
                <Icon className="mx-auto h-4 w-4 text-[#22C7A1]" />
                <p className="mt-2 text-[9px] font-bold leading-tight text-[#64748B]">{label}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 border-t border-[#E5EAF1] pt-3 text-center text-[10px] font-medium leading-4 text-[#94A3B8]">{copy.review}</p>
        </section>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[#E5EAF1] bg-white/96 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1 text-start">
            <p className="truncate text-[12px] font-black">{selectedDisplay?.name}</p>
            <p className="mt-0.5 text-[10px] font-semibold text-[#94A3B8]">
              {selectedPlan ? `${selectedPlan.price_qar.toLocaleString()} QAR / ${getPeriodLabel(selectedPlan.billing_interval)}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={handleContinue}
            disabled={!selectedPlan || isProcessing || isCurrentSelection}
            className="flex min-h-12 min-w-[188px] items-center justify-center gap-2 rounded-2xl bg-[#020617] px-5 text-[12px] font-black text-white shadow-[0_10px_24px_rgba(2,6,23,0.18)] transition active:scale-[0.98] disabled:bg-[#CBD5E1] disabled:shadow-none"
          >
            {isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <span>{isCurrentSelection ? copy.current : copy.continue}</span>
                <ChevronRight className="h-4 w-4 rtl:rotate-180" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
