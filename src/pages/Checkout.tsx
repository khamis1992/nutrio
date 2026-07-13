import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  CreditCard,
  Loader2,
  LockKeyhole,
  Phone,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
  WalletCards,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { sadadService, type SadadPaymentType } from "@/lib/sadad";
import { formatCurrency } from "@/lib/currency";

type CheckoutKind = "wallet" | "subscription" | "coach_subscription";
type CoachPlan = "weekly" | "monthly";

interface WalletPackageSummary {
  id: string;
  name: string;
  amount: number;
  bonus_amount: number | null;
  description: string | null;
}

interface PlanSummary {
  id: string;
  tier: string;
  name_ar: string | null;
  price_qar: number;
  billing_interval: string;
  meals_per_month: number;
  snacks_per_month: number | null;
  short_description: string | null;
  short_description_ar: string | null;
}

interface CoachSummary {
  id: string;
  name: string;
  avatarUrl: string | null;
  plan: CoachPlan;
  price: number;
  currency: string;
}

type CheckoutSummary =
  | { kind: "wallet"; item: WalletPackageSummary }
  | { kind: "subscription"; item: PlanSummary }
  | { kind: "coach_subscription"; item: CoachSummary };

const ERROR_MESSAGES: Record<string, { en: string; ar: string }> = {
  PAYMENT_PACKAGE_NOT_FOUND: {
    en: "This wallet package is no longer available.",
    ar: "حزمة المحفظة هذه لم تعد متاحة.",
  },
  PAYMENT_PLAN_NOT_FOUND: {
    en: "This subscription plan is not currently available.",
    ar: "خطة الاشتراك هذه غير متاحة حالياً.",
  },
  COACH_PRICING_NOT_FOUND: {
    en: "This coach is not accepting paid subscriptions right now.",
    ar: "هذا المدرب لا يستقبل اشتراكات مدفوعة حالياً.",
  },
  COACH_PLAN_INVALID: {
    en: "Choose a valid weekly or monthly coaching plan.",
    ar: "اختر خطة تدريب أسبوعية أو شهرية صحيحة.",
  },
  ACTIVE_COACH_SUBSCRIPTION_EXISTS: {
    en: "You already have an active subscription with this coach.",
    ar: "لديك اشتراك نشط مع هذا المدرب بالفعل.",
  },
  ACTIVE_SUBSCRIPTION_EXISTS: {
    en: "You already have an active subscription. Manage it from the subscription page.",
    ar: "لديك اشتراك نشط بالفعل. يمكنك إدارته من صفحة الاشتراك.",
  },
  SUBSCRIPTION_PLAN_UNCHANGED: {
    en: "This is already your current subscription plan.",
    ar: "هذه هي خطة اشتراكك الحالية بالفعل.",
  },
  SUBSCRIPTION_CYCLE_ALREADY_RENEWED: {
    en: "This subscription period has already been renewed.",
    ar: "تم تجديد فترة الاشتراك هذه بالفعل.",
  },
  SUBSCRIPTION_RENEWAL_TOO_EARLY: {
    en: "You can renew this plan after the current paid period ends.",
    ar: "يمكنك تجديد هذه الخطة بعد انتهاء الفترة المدفوعة الحالية.",
  },
  PAYMENT_FULFILLMENT_RETRY_REQUIRED: {
    en: "Your payment was received, but activation needs support review. You will not be charged again.",
    ar: "تم استلام دفعتك، لكن التفعيل يحتاج مراجعة الدعم. لن يتم خصم المبلغ مرة أخرى.",
  },
  QATAR_MOBILE_NUMBER_REQUIRED: {
    en: "Enter a valid Qatar mobile number.",
    ar: "أدخل رقم جوال قطري صحيحاً.",
  },
  SADAD_SERVER_CONFIGURATION_MISSING: {
    en: "Online payment is temporarily unavailable. Please contact support.",
    ar: "الدفع الإلكتروني غير متاح مؤقتاً. يرجى التواصل مع الدعم.",
  },
  PAYMENT_RATE_LIMITED: {
    en: "Too many payment attempts. Please wait a minute and try again.",
    ar: "محاولات دفع كثيرة. انتظر دقيقة ثم حاول مجدداً.",
  },
};

function normalizePhone(value: string): string {
  return value.replace(/[^\d+]/g, "").slice(0, 16);
}

function isValidQatarPhone(value: string): boolean {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 8) digits = `974${digits}`;
  return /^974\d{8}$/.test(digits);
}

export default function Checkout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { isRTL } = useLanguage();

  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const requestedKind = params.get("type") as CheckoutKind | null;
  const referenceId = requestedKind === "wallet"
    ? params.get("packageId")
    : requestedKind === "subscription"
      ? params.get("planId")
      : requestedKind === "coach_subscription"
        ? params.get("coachId")
        : null;
  const subscriptionId = params.get("subscriptionId") ?? undefined;
  const coachPlanParam = params.get("plan");
  const coachPlan: CoachPlan | null = coachPlanParam === "weekly" || coachPlanParam === "monthly"
    ? coachPlanParam
    : null;

  const [summary, setSummary] = useState<CheckoutSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [phone, setPhone] = useState(() => {
    const metadata = user?.user_metadata as Record<string, unknown> | undefined;
    const candidate = user?.phone || metadata?.phone || metadata?.mobile;
    return typeof candidate === "string" ? candidate : "";
  });

  useEffect(() => {
    document.title = `${isRTL ? "الدفع الآمن" : "Secure checkout"} - Nutrio`;
  }, [isRTL]);

  useEffect(() => {
    let cancelled = false;

    async function loadSummary() {
      if (
        !user
        || !referenceId
        || !["wallet", "subscription", "coach_subscription"].includes(requestedKind ?? "")
        || (requestedKind === "coach_subscription" && !coachPlan)
      ) {
        if (!cancelled) {
          setLoadError("INVALID_CHECKOUT_REFERENCE");
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      setLoadError(null);

      try {
        if (requestedKind === "wallet") {
          const { data, error } = await supabase
            .from("wallet_topup_packages")
            .select("id,name,amount,bonus_amount,description")
            .eq("id", referenceId)
            .eq("is_active", true)
            .maybeSingle();

          if (error) throw error;
          if (!data) throw new Error("PAYMENT_PACKAGE_NOT_FOUND");
          if (!cancelled) setSummary({ kind: "wallet", item: data });
        } else if (requestedKind === "subscription") {
          const { data, error } = await supabase
            .from("subscription_plans")
            .select(
              "id,tier,name_ar,price_qar,billing_interval,meals_per_month,snacks_per_month,short_description,short_description_ar",
            )
            .eq("id", referenceId)
            .eq("is_active", true)
            .maybeSingle();

          if (error) throw error;
          if (!data) throw new Error("PAYMENT_PLAN_NOT_FOUND");
          if (!cancelled) setSummary({ kind: "subscription", item: data });
        } else {
          const [pricingResult, profileResult] = await Promise.all([
            supabase
              .from("coach_pricing")
              .select("coach_id,price_per_week,price_per_month,currency,is_active")
              .eq("coach_id", referenceId)
              .eq("is_active", true)
              .maybeSingle(),
            supabase
              .from("profiles")
              .select("full_name,avatar_url")
              .eq("user_id", referenceId)
              .maybeSingle(),
          ]);

          if (pricingResult.error) throw pricingResult.error;
          if (profileResult.error) throw profileResult.error;
          if (!pricingResult.data || !coachPlan) throw new Error("COACH_PRICING_NOT_FOUND");

          const coachPrice = coachPlan === "weekly"
            ? Number(pricingResult.data.price_per_week)
            : Number(pricingResult.data.price_per_month);
          if (!Number.isFinite(coachPrice) || coachPrice <= 0) {
            throw new Error("COACH_PRICING_NOT_FOUND");
          }

          if (!cancelled) {
            setSummary({
              kind: "coach_subscription",
              item: {
                id: pricingResult.data.coach_id,
                name: profileResult.data?.full_name || "Nutrio coach",
                avatarUrl: profileResult.data?.avatar_url || null,
                plan: coachPlan,
                price: coachPrice,
                currency: pricingResult.data.currency || "QAR",
              },
            });
          }
        }
      } catch (error) {
        console.error("Unable to load checkout summary", error);
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "CHECKOUT_LOAD_FAILED");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadSummary();
    return () => {
      cancelled = true;
    };
  }, [coachPlan, referenceId, requestedKind, user]);

  const amount = summary?.item
    ? summary.kind === "wallet"
      ? Number(summary.item.amount)
      : summary.kind === "subscription"
        ? Number(summary.item.price_qar)
        : Number(summary.item.price)
    : 0;
  const phoneValid = isValidQatarPhone(phone);

  const translateError = (code: string | null): string => {
    if (!code) return "";
    const known = Object.entries(ERROR_MESSAGES).find(([key]) => code.includes(key))?.[1];
    if (known) return isRTL ? known.ar : known.en;
    if (code === "INVALID_CHECKOUT_REFERENCE") {
      return isRTL
        ? "اختر حزمة محفظة أو خطة اشتراك أولاً."
        : "Choose a wallet package or subscription plan first.";
    }
    return isRTL
      ? "تعذر بدء الدفع. لم يتم خصم أي مبلغ. حاول مجدداً أو تواصل مع الدعم."
      : "Payment could not be started. Nothing was charged. Try again or contact support.";
  };

  const handlePayment = async () => {
    if (!summary || !referenceId || !phoneValid || processing) return;

    setProcessing(true);
    setPaymentError(null);

    try {
      const paymentType: SadadPaymentType = summary.kind === "wallet"
        ? "wallet_topup"
        : summary.kind;
      const checkout = await sadadService.createPayment({
        paymentType,
        referenceId,
        subscriptionId,
        coachPlan: summary.kind === "coach_subscription" ? summary.item.plan : undefined,
        mobileNumber: phone,
        language: isRTL ? "ar" : "en",
      });

      sessionStorage.setItem("nutrio_pending_payment", checkout.payment_id);
      sadadService.submitHostedCheckout(checkout);
    } catch (error) {
      console.error("Unable to start SADAD checkout", error);
      setPaymentError(error instanceof Error ? error.message : "PAYMENT_CREATION_FAILED");
      setProcessing(false);
    }
  };

  const fallbackTarget = requestedKind === "wallet"
    ? "/wallet"
    : requestedKind === "coach_subscription" && referenceId
      ? `/coach-subscription?coachId=${encodeURIComponent(referenceId)}`
      : "/subscription";

  return (
    <main
      className="min-h-screen bg-[#F4F8F6] pb-[calc(28px+env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)]"
      dir={isRTL ? "rtl" : "ltr"}
    >
      <div className="mx-auto min-h-screen w-full max-w-[430px] bg-[#F8FBF9]">
        <header className="flex h-[72px] items-center gap-3 border-b border-[#103F32]/[0.06] px-4">
          <button
            type="button"
            data-testid="checkout-back-btn"
            onClick={() => navigate(-1)}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-[#103F32] shadow-[0_7px_22px_rgba(16,63,50,0.08)] ring-1 ring-[#103F32]/[0.06] transition active:scale-95"
            aria-label={isRTL ? "رجوع" : "Go back"}
          >
            <ArrowLeft className={`h-5 w-5 ${isRTL ? "rotate-180" : ""}`} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#18A984]">
              {isRTL ? "دفع محمي" : "Protected payment"}
            </p>
            <h1 className="truncate text-[20px] font-black text-[#071B16]">
              {isRTL ? "إتمام الدفع" : "Complete payment"}
            </h1>
          </div>
          <div className="grid h-11 w-11 place-items-center rounded-full bg-[#E7F8F2] text-[#12866A]">
            <LockKeyhole className="h-5 w-5" />
          </div>
        </header>

        <div className="space-y-4 px-4 py-5">
          {loading ? (
            <div className="grid min-h-[360px] place-items-center rounded-[28px] bg-white ring-1 ring-[#103F32]/[0.06]">
              <div className="text-center">
                <Loader2 className="mx-auto h-7 w-7 animate-spin text-[#18A984]" />
                <p className="mt-3 text-sm font-bold text-[#49645C]">
                  {isRTL ? "جاري تحميل بيانات الدفع..." : "Loading payment details..."}
                </p>
              </div>
            </div>
          ) : loadError || !summary ? (
            <section className="rounded-[28px] bg-white p-6 text-center shadow-[0_16px_40px_rgba(16,63,50,0.06)] ring-1 ring-[#103F32]/[0.06]">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#FFF1EE] text-[#F05A47]">
                <ReceiptText className="h-7 w-7" />
              </div>
              <h2 className="mt-4 text-lg font-black text-[#071B16]">
                {isRTL ? "لا يمكن فتح الدفع" : "Checkout unavailable"}
              </h2>
              <p className="mx-auto mt-2 max-w-[18rem] text-sm font-medium leading-6 text-[#62786F]">
                {translateError(loadError)}
              </p>
              <button
                type="button"
                onClick={() => navigate(fallbackTarget, { replace: true })}
                className="mt-5 h-12 w-full rounded-2xl bg-[#103F32] text-sm font-extrabold text-white transition active:scale-[0.99]"
              >
                {requestedKind === "wallet"
                  ? isRTL ? "العودة إلى المحفظة" : "Back to wallet"
                  : requestedKind === "coach_subscription"
                    ? isRTL ? "العودة إلى المدرب" : "Back to coach"
                    : isRTL ? "عرض خطط الاشتراك" : "View subscription plans"}
              </button>
            </section>
          ) : (
            <>
              <section className="overflow-hidden rounded-[30px] bg-[#103F32] p-5 text-white shadow-[0_20px_48px_rgba(16,63,50,0.20)]">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[11px] font-extrabold uppercase tracking-[0.13em] text-[#70E4C4]">
                      {summary.kind === "wallet"
                        ? isRTL ? "شحن المحفظة" : "Wallet top-up"
                        : summary.kind === "subscription"
                          ? isRTL ? "اشتراك نوتريو" : "Nutrio subscription"
                          : isRTL ? "اشتراك التدريب" : "Coach subscription"}
                    </p>
                    <h2 className="mt-2 text-[23px] font-black leading-tight">
                      {summary.kind === "wallet"
                        ? summary.item.name
                        : summary.kind === "subscription"
                          ? isRTL
                            ? summary.item.name_ar || summary.item.tier
                            : summary.item.tier
                          : summary.item.name}
                    </h2>
                    <p className="mt-2 max-w-[16rem] text-sm font-medium leading-5 text-white/70">
                      {summary.kind === "wallet"
                        ? summary.item.description || (isRTL ? "رصيد جاهز للاستخدام داخل التطبيق." : "Balance ready to use across Nutrio.")
                        : summary.kind === "subscription"
                          ? isRTL
                            ? summary.item.short_description_ar || "خطة تغذية ووجبات مرتبطة بحسابك."
                            : summary.item.short_description || "Nutrition and meal access linked to your account."
                          : isRTL
                            ? `خطة تدريب ${summary.item.plan === "weekly" ? "أسبوعية" : "شهرية"} مع مدربك.`
                            : `${summary.item.plan === "weekly" ? "Weekly" : "Monthly"} coaching access with your coach.`}
                    </p>
                  </div>
                  <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/10 text-[#70E4C4] ring-1 ring-white/10">
                    {summary.kind === "wallet"
                      ? <WalletCards className="h-7 w-7" />
                      : summary.kind === "subscription"
                        ? <Sparkles className="h-7 w-7" />
                        : summary.item.avatarUrl
                          ? <img src={summary.item.avatarUrl} alt="" className="h-full w-full rounded-2xl object-cover" />
                          : <UserRoundCheck className="h-7 w-7" />}
                  </div>
                </div>

                <div className="mt-6 flex items-end justify-between border-t border-white/10 pt-5">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/55">
                      {isRTL ? "المبلغ المستحق" : "Amount due"}
                    </p>
                    <p className="mt-1 text-[30px] font-black leading-none">{formatCurrency(amount)}</p>
                  </div>
                  <div className="rounded-full bg-[#24B893]/20 px-3 py-1.5 text-[11px] font-extrabold text-[#8AF0D4]">
                    QAR
                  </div>
                </div>
              </section>

              <section className="rounded-[26px] bg-white p-5 shadow-[0_14px_36px_rgba(16,63,50,0.05)] ring-1 ring-[#103F32]/[0.07]">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#E8F8F3] text-[#12866A]">
                    <ReceiptText className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-[#071B16]">
                      {isRTL ? "ملخص الطلب" : "Order summary"}
                    </h3>
                    <p className="text-xs font-medium text-[#71857E]">
                      {isRTL ? "محسوب من بيانات نوتريو الحالية" : "Calculated from current Nutrio data"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-3 border-t border-[#103F32]/[0.07] pt-4">
                  {summary.kind === "wallet" ? (
                    <>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-[#62786F]">{isRTL ? "الرصيد المدفوع" : "Paid balance"}</span>
                        <span className="font-extrabold text-[#071B16]">{formatCurrency(summary.item.amount)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-[#12866A]">{isRTL ? "رصيد إضافي" : "Bonus credit"}</span>
                        <span className="font-extrabold text-[#12866A]">+{formatCurrency(summary.item.bonus_amount || 0)}</span>
                      </div>
                    </>
                  ) : summary.kind === "subscription" ? (
                    <>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-[#62786F]">{isRTL ? "الفوترة" : "Billing"}</span>
                        <span className="font-extrabold capitalize text-[#071B16]">{summary.item.billing_interval}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-[#62786F]">{isRTL ? "الوجبات" : "Meals"}</span>
                        <span className="font-extrabold text-[#071B16]">{summary.item.meals_per_month}</span>
                      </div>
                      {(summary.item.snacks_per_month || 0) > 0 && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-semibold text-[#62786F]">{isRTL ? "الوجبات الخفيفة" : "Snacks"}</span>
                          <span className="font-extrabold text-[#071B16]">{summary.item.snacks_per_month}</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-[#62786F]">{isRTL ? "المدرب" : "Coach"}</span>
                        <span className="font-extrabold text-[#071B16]">{summary.item.name}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-[#62786F]">{isRTL ? "مدة الخطة" : "Plan period"}</span>
                        <span className="font-extrabold capitalize text-[#071B16]">
                          {isRTL
                            ? summary.item.plan === "weekly" ? "أسبوعية" : "شهرية"
                            : summary.item.plan}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </section>

              <section className="rounded-[26px] bg-white p-5 shadow-[0_14px_36px_rgba(16,63,50,0.05)] ring-1 ring-[#103F32]/[0.07]">
                <label htmlFor="checkout-phone" className="text-sm font-black text-[#071B16]">
                  {isRTL ? "رقم الجوال لدى SADAD" : "SADAD mobile number"}
                </label>
                <p className="mt-1 text-xs font-medium leading-5 text-[#71857E]">
                  {isRTL ? "استخدم رقم جوال قطري مرتبط بحسابك." : "Use a Qatar mobile number linked to your account."}
                </p>
                <div className={`mt-3 flex h-[54px] items-center gap-3 rounded-2xl border bg-[#F7FAF8] px-4 ${phone && !phoneValid ? "border-[#F05A47]" : "border-[#103F32]/10"}`}>
                  <Phone className="h-5 w-5 shrink-0 text-[#18A984]" />
                  <input
                    id="checkout-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={phone}
                    onChange={(event) => setPhone(normalizePhone(event.target.value))}
                    placeholder="+974 5000 0000"
                    className="min-w-0 flex-1 bg-transparent text-base font-bold text-[#071B16] outline-none placeholder:text-[#9DADA7]"
                    aria-invalid={Boolean(phone && !phoneValid)}
                  />
                  {phoneValid && <Check className="h-5 w-5 text-[#18A984]" />}
                </div>
                {phone && !phoneValid && (
                  <p className="mt-2 text-xs font-bold text-[#D94736]">
                    {isRTL ? "أدخل 8 أرقام قطرية أو الرقم بصيغة +974." : "Enter 8 Qatar digits or the full +974 number."}
                  </p>
                )}
              </section>

              {paymentError && (
                <div role="alert" className="rounded-2xl border border-[#F05A47]/20 bg-[#FFF2EF] px-4 py-3 text-sm font-bold leading-5 text-[#B73B2D]">
                  {translateError(paymentError)}
                </div>
              )}

              <button
                type="button"
                data-testid="checkout-place-order-btn"
                onClick={handlePayment}
                disabled={!phoneValid || processing}
                className="flex h-[58px] w-full items-center justify-center gap-3 rounded-[20px] bg-[#103F32] px-5 text-base font-black text-white shadow-[0_16px_34px_rgba(16,63,50,0.22)] transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
              >
                {processing ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <CreditCard className="h-5 w-5" />
                )}
                <span>{processing ? (isRTL ? "جاري التحويل..." : "Redirecting...") : (isRTL ? "الدفع عبر SADAD" : "Pay with SADAD")}</span>
                {!processing && <ChevronRight className={`h-5 w-5 ${isRTL ? "rotate-180" : ""}`} />}
              </button>

              <div className="flex items-start gap-3 rounded-2xl bg-[#EAF8F3] px-4 py-3 text-[#275F50]">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#18A984]" />
                <p className="text-xs font-semibold leading-5">
                  {isRTL
                    ? "لن يضاف الرصيد أو يتفعّل الاشتراك إلا بعد تحقق الخادم من نتيجة SADAD."
                    : "Balance or subscription access is granted only after the server verifies SADAD's result."}
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
