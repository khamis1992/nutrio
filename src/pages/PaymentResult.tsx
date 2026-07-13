import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Loader2,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatCurrency } from "@/lib/currency";
import { sadadService, type SadadPaymentStatus } from "@/lib/sadad";

type ResultState = "loading" | "pending" | "success" | "failed" | "invalid";

export default function PaymentResult() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isRTL } = useLanguage();
  const paymentId = searchParams.get("paymentId")
    || sessionStorage.getItem("nutrio_pending_payment")
    || "";

  const [state, setState] = useState<ResultState>(paymentId ? "loading" : "invalid");
  const [payment, setPayment] = useState<SadadPaymentStatus | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    document.title = `${isRTL ? "نتيجة الدفع" : "Payment result"} - Nutrio`;
  }, [isRTL]);

  const refreshStatus = useCallback(async () => {
    if (!paymentId) {
      setState("invalid");
      return true;
    }

    try {
      const result = await sadadService.getPaymentStatus(paymentId);
      setPayment(result);
      setMessage(null);

      if (result.status === "completed" && result.fulfillment_status === "completed") {
        sessionStorage.removeItem("nutrio_pending_payment");
        setState("success");
        return true;
      }
      if (result.status === "failed" || result.status === "refunded" || result.fulfillment_status === "failed") {
        setState("failed");
        return true;
      }

      setState("pending");
      return false;
    } catch (error) {
      console.error("Unable to verify payment status", error);
      setMessage(error instanceof Error ? error.message : "PAYMENT_STATUS_LOOKUP_FAILED");
      setState("pending");
      return false;
    }
  }, [paymentId]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;

    async function poll() {
      if (cancelled) return;
      const terminal = await refreshStatus();
      attempts += 1;

      if (!cancelled && !terminal && attempts < 30) {
        timer = setTimeout(poll, 2_000);
      }
    }

    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [refreshStatus]);

  const coachId = typeof payment?.metadata?.coach_id === "string"
    ? payment.metadata.coach_id
    : null;
  const destination = payment?.payment_type === "wallet_topup"
    ? "/wallet"
    : payment?.payment_type === "coach_subscription" && coachId
      ? `/coach-onboarding?coachId=${encodeURIComponent(coachId)}`
      : "/subscription";
  const content = {
    loading: {
      icon: <Loader2 className="h-8 w-8 animate-spin" />,
      iconClass: "bg-[#E8F8F3] text-[#18A984]",
      title: isRTL ? "جاري التحقق من الدفع" : "Verifying your payment",
      description: isRTL ? "نتأكد من نتيجة SADAD الآمنة." : "We are checking SADAD's verified result.",
    },
    pending: {
      icon: <Clock3 className="h-8 w-8" />,
      iconClass: "bg-[#FFF7E8] text-[#E78C18]",
      title: isRTL ? "الدفع قيد المعالجة" : "Payment is processing",
      description: isRTL
        ? "قد يستغرق تأكيد البنك لحظات. لا تحاول الدفع مرة أخرى."
        : "Bank confirmation can take a moment. Do not submit another payment.",
    },
    success: {
      icon: <CheckCircle2 className="h-8 w-8" />,
      iconClass: "bg-[#E8F8F3] text-[#18A984]",
      title: isRTL ? "تم الدفع بنجاح" : "Payment successful",
      description: payment?.payment_type === "wallet_topup"
        ? isRTL ? "تم تحديث رصيد محفظتك." : "Your wallet balance has been updated."
        : payment?.payment_type === "coach_subscription"
          ? isRTL ? "تم تفعيل اشتراكك مع المدرب." : "Your coach subscription has been activated."
          : isRTL ? "تم تفعيل اشتراكك." : "Your subscription has been activated.",
    },
    failed: {
      icon: <CircleAlert className="h-8 w-8" />,
      iconClass: "bg-[#FFF0ED] text-[#E25240]",
      title: isRTL ? "لم تكتمل العملية" : "Payment was not completed",
      description: payment?.fulfillment_status === "failed"
        ? isRTL
          ? "تم استلام الدفع لكن تعذر تطبيقه تلقائياً. تواصل مع الدعم ولا تدفع مرة أخرى."
          : "Payment was received but could not be applied automatically. Contact support and do not pay again."
        : isRTL ? "لم يتم خصم أو تطبيق أي رصيد." : "No balance or subscription access was applied.",
    },
    invalid: {
      icon: <ReceiptText className="h-8 w-8" />,
      iconClass: "bg-[#F1F5F3] text-[#62786F]",
      title: isRTL ? "مرجع الدفع غير موجود" : "Payment reference missing",
      description: isRTL ? "افتح العملية من المحفظة أو صفحة الاشتراك." : "Start from your wallet or subscription page.",
    },
  }[state];

  return (
    <main
      className="min-h-screen bg-[#F4F8F6] px-4 pb-[calc(28px+env(safe-area-inset-bottom))] pt-[calc(24px+env(safe-area-inset-top))]"
      dir={isRTL ? "rtl" : "ltr"}
    >
      <div className="mx-auto flex min-h-[calc(100vh-52px)] w-full max-w-[430px] flex-col justify-center">
        <section className="rounded-[32px] bg-white p-6 text-center shadow-[0_24px_60px_rgba(16,63,50,0.10)] ring-1 ring-[#103F32]/[0.06]">
          <div className={`mx-auto grid h-16 w-16 place-items-center rounded-2xl ${content.iconClass}`}>
            {content.icon}
          </div>

          <h1 className="mt-5 text-[24px] font-black leading-tight text-[#071B16]">{content.title}</h1>
          <p className="mx-auto mt-2 max-w-[19rem] text-sm font-medium leading-6 text-[#62786F]">
            {content.description}
          </p>

          {payment && (
            <div className="mt-6 rounded-[22px] bg-[#F6FAF8] p-4 text-start ring-1 ring-[#103F32]/[0.06]">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-bold text-[#71857E]">{isRTL ? "المبلغ" : "Amount"}</span>
                <span className="text-base font-black text-[#071B16]">{formatCurrency(payment.amount)}</span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 border-t border-[#103F32]/[0.07] pt-3">
                <span className="text-xs font-bold text-[#71857E]">{isRTL ? "المرجع" : "Reference"}</span>
                <span className="max-w-[12rem] truncate font-mono text-[11px] font-bold text-[#49645C]">
                  {payment.transaction_id || payment.payment_id}
                </span>
              </div>
            </div>
          )}

          {message && state === "pending" && (
            <p className="mt-4 rounded-2xl bg-[#FFF7E8] px-4 py-3 text-xs font-bold leading-5 text-[#9B641A]">
              {isRTL ? "تعذر التحقق مؤقتاً. سنحاول مجدداً." : "Verification is temporarily unavailable. We will retry."}
            </p>
          )}

          <div className="mt-6 space-y-3">
            {state === "success" && (
              <button
                type="button"
                onClick={() => navigate(destination, { replace: true })}
                className="flex h-13 min-h-[52px] w-full items-center justify-center gap-2 rounded-[18px] bg-[#103F32] px-4 text-sm font-black text-white transition active:scale-[0.99]"
              >
                {payment?.payment_type === "wallet_topup"
                  ? isRTL ? "فتح المحفظة" : "Open wallet"
                  : payment?.payment_type === "coach_subscription"
                    ? isRTL ? "بدء التدريب" : "Start coaching"
                    : isRTL ? "فتح الاشتراك" : "Open subscription"}
                <ArrowRight className={`h-4 w-4 ${isRTL ? "rotate-180" : ""}`} />
              </button>
            )}

            {(state === "pending" || state === "loading") && (
              <button
                type="button"
                onClick={() => void refreshStatus()}
                disabled={state === "loading"}
                className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[18px] bg-[#103F32] px-4 text-sm font-black text-white transition active:scale-[0.99] disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${state === "loading" ? "animate-spin" : ""}`} />
                {isRTL ? "تحديث الحالة" : "Refresh status"}
              </button>
            )}

            {(state === "failed" || state === "invalid") && (
              <button
                type="button"
                onClick={() => navigate(state === "invalid" ? "/dashboard" : destination, { replace: true })}
                className="min-h-[52px] w-full rounded-[18px] bg-[#103F32] px-4 text-sm font-black text-white transition active:scale-[0.99]"
              >
                {isRTL ? "العودة" : "Go back"}
              </button>
            )}

            {state === "failed" && payment?.fulfillment_status === "failed" && (
              <button
                type="button"
                onClick={() => navigate("/support")}
                className="min-h-[48px] w-full rounded-[18px] bg-[#E8F8F3] px-4 text-sm font-black text-[#12866A] transition active:scale-[0.99]"
              >
                {isRTL ? "التواصل مع الدعم" : "Contact support"}
              </button>
            )}
          </div>

          <div className="mt-6 flex items-start gap-2 border-t border-[#103F32]/[0.07] pt-4 text-start text-[#62786F]">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#18A984]" />
            <p className="text-[11px] font-semibold leading-5">
              {isRTL
                ? "هذه الحالة مأخوذة من سجل الدفع على الخادم وليست من رابط المتصفح."
                : "This status comes from the server payment record, not from browser URL parameters."}
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
