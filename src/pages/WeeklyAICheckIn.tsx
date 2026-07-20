import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  BatteryMedium,
  BrainCircuit,
  Check,
  ChevronRight,
  ClipboardCheck,
  Flame,
  Loader2,
  RotateCcw,
  Scale,
  ShieldCheck,
  Sparkles,
  Utensils,
} from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { useWeeklyAICheckIn, type WeeklyCheckInAnswers } from "@/hooks/useWeeklyAICheckIn";

type RatingField = "energy_rating" | "hunger_rating" | "recovery_rating" | "plan_adherence_rating";

const INITIAL_ANSWERS: WeeklyCheckInAnswers = {
  energy_rating: 0,
  hunger_rating: 0,
  recovery_rating: 0,
  plan_adherence_rating: 0,
  weight_kg: null,
  notes: null,
};

const macroStyles = {
  calories: { color: "#F97316", soft: "#FFF7ED", unit: "kcal", icon: Flame },
  protein: { color: "#7C83F6", soft: "#F3F4FF", unit: "g", icon: Utensils },
  carbs: { color: "#38BDF8", soft: "#EFF9FF", unit: "g", icon: BatteryMedium },
  fat: { color: "#FB6B7A", soft: "#FFF0F2", unit: "g", icon: Scale },
} as const;

export default function WeeklyAICheckIn() {
  const navigate = useNavigate();
  const { isRTL } = useLanguage();
  const { review, loading, submitting, resolving, error, submit, resolve } = useWeeklyAICheckIn();
  const [answers, setAnswers] = useState(INITIAL_ANSWERS);
  const [showReview, setShowReview] = useState(false);
  const [editing, setEditing] = useState(false);

  const copy = isRTL ? {
    title: "المراجعة الأسبوعية",
    eyebrow: "NUTRIO AI CHECK-IN",
    introTitle: "لنضبط خطتك للأسبوع القادم",
    intro: "أخبرنا كيف سار أسبوعك. نراجع سجلاتك وإجاباتك قبل اقتراح أي تغيير.",
    energy: "كيف كان مستوى طاقتك؟",
    hunger: "كيف كان الجوع بين الوجبات؟",
    recovery: "كيف كان نومك وتعافيك؟",
    adherence: "ما مدى سهولة الالتزام بالخطة؟",
    weight: "الوزن الحالي (اختياري)",
    note: "هل هناك شيء يجب أن نأخذه بالحسبان؟ (اختياري)",
    notePlaceholder: "مثال: سفر، ضغط عمل، أو تغيير في التمارين",
    low: "منخفض",
    high: "ممتاز",
    submit: "تحليل أسبوعي",
    reviewTitle: "اقتراح الأسبوع القادم",
    reviewIntro: "راجع الفرق قبل التطبيق",
    current: "الحالي",
    proposed: "المقترح",
    noChange: "لا تغيير",
    evidence: "ما الذي اعتمدنا عليه؟",
    days: "أيام مسجلة",
    adherenceRate: "الالتزام بالأهداف",
    weightTrend: "تغير الوزن",
    confidence: "ثقة التحليل",
    apply: "تطبيق الأهداف الجديدة",
    keep: "تأكيد الأهداف الحالية",
    dismiss: "ليس هذا الأسبوع",
    applied: "تم تحديث أهدافك",
    appliedBody: "ستظهر السعرات والماكروز الجديدة في لوحة التغذية الآن.",
    dismissed: "تم الاحتفاظ بأهدافك الحالية لهذا الأسبوع.",
    required: "أجب عن الأسئلة الأربعة أولاً",
    failed: "تعذر إكمال المراجعة. حاول مرة أخرى.",
    safety: "هذا اقتراح إرشادي مبني على البيانات المتاحة، وليس تشخيصاً طبياً. التغيير لا يحدث إلا بموافقتك.",
    edit: "تعديل الإجابات",
    back: "رجوع",
  } : {
    title: "Weekly check-in",
    eyebrow: "NUTRIO AI CHECK-IN",
    introTitle: "Tune next week's plan",
    intro: "Tell us how the week felt. We review your logs and answers before suggesting any change.",
    energy: "How was your energy?",
    hunger: "How was hunger between meals?",
    recovery: "How was your sleep and recovery?",
    adherence: "How easy was the plan to follow?",
    weight: "Current weight (optional)",
    note: "Anything we should account for? (optional)",
    notePlaceholder: "For example: travel, work stress, or a training change",
    low: "Low",
    high: "Great",
    submit: "Review my week",
    reviewTitle: "Next week's recommendation",
    reviewIntro: "Review every change before applying",
    current: "Current",
    proposed: "Proposed",
    noChange: "No change",
    evidence: "What informed this review?",
    days: "days logged",
    adherenceRate: "target adherence",
    weightTrend: "weight change",
    confidence: "analysis confidence",
    apply: "Apply new targets",
    keep: "Confirm current targets",
    dismiss: "Not this week",
    applied: "Your targets are updated",
    appliedBody: "The new calories and macros now appear across your nutrition dashboard.",
    dismissed: "Your current targets remain in place for this week.",
    required: "Answer all four questions first",
    failed: "We couldn't complete the review. Please try again.",
    safety: "This is guidance based on available data, not medical advice. Nothing changes without your approval.",
    edit: "Edit answers",
    back: "Back",
  };

  const activeReview = review && !editing && (showReview || review.status !== "dismissed") ? review : null;
  const mealResponseLabel = isRTL
    ? "\u0627\u0633\u062a\u062c\u0627\u0628\u0627\u062a \u0648\u062c\u0628\u0627\u062a \u0645\u0624\u0647\u0644\u0629"
    : "qualified meal responses";
  const mealResponseContext = isRTL
    ? "\u062a\u0638\u0647\u0631 \u0647\u0630\u0647 \u0627\u0644\u0623\u062f\u0644\u0629 \u0644\u0644\u0633\u064a\u0627\u0642 \u0641\u0642\u0637\u060c \u0648\u0644\u0627 \u062a\u0637\u0628\u0642 \u0623\u064a \u062a\u063a\u064a\u064a\u0631 \u062a\u0644\u0642\u0627\u0626\u064a\u0627."
    : "Meal-response evidence is context only and never applies a change automatically.";
  const adaptiveCopy = isRTL ? {
    staleTitle: "انتهت صلاحية هذه المراجعة",
    staleBody: "تغيرت أهدافك أو بيانات السلامة منذ إنشاء الاقتراح. أجرِ مراجعة جديدة قبل تطبيق أي تغيير.",
    reviewAgain: "إجراء مراجعة جديدة",
    dataQuality: "جودة البيانات",
    highQuality: "عالية",
    mediumQuality: "متوسطة",
    lowQuality: "غير كافية",
    smoothedTrend: "الاتجاه الأسبوعي",
    holdTitle: "توقف احترازي",
    maintainTitle: "استمرار بالخطة",
    changeTitle: "تعديل مقترح",
    holdBody: "لن نغيّر أهدافك حتى تتحسن البيانات أو تتم مراجعة سياق السلامة.",
    reasons: "أسباب القرار",
    proteinProtected: "تم الحفاظ على هدف البروتين أثناء التعديل.",
  } : {
    staleTitle: "This review is no longer current",
    staleBody: "Your goal or safety context changed after this recommendation was created. Run a fresh review before applying anything.",
    reviewAgain: "Run a fresh review",
    dataQuality: "data quality",
    highQuality: "High",
    mediumQuality: "Medium",
    lowQuality: "Not enough",
    smoothedTrend: "weekly trend",
    holdTitle: "Safety hold",
    maintainTitle: "Keep current plan",
    changeTitle: "Suggested adjustment",
    holdBody: "We will not change your targets until the data improves or the safety context is reviewed.",
    reasons: "Why this decision",
    proteinProtected: "Your protein target is protected during this adjustment.",
  };
  const allRated = [answers.energy_rating, answers.hunger_rating, answers.recovery_rating, answers.plan_adherence_rating]
    .every((value) => value > 0);
  const hasChanges = useMemo(() => {
    if (!activeReview) return false;
    return (Object.keys(macroStyles) as Array<keyof typeof macroStyles>).some(
      (key) => activeReview.current_targets[key] !== activeReview.proposed_targets[key],
    );
  }, [activeReview]);
  const dataQualityLabel = activeReview?.data_quality.label === "high"
    ? adaptiveCopy.highQuality
    : activeReview?.data_quality.label === "medium"
      ? adaptiveCopy.mediumQuality
      : adaptiveCopy.lowQuality;
  const decisionLabel = activeReview?.recommendation_state === "change"
    ? adaptiveCopy.changeTitle
    : activeReview?.recommendation_state === "hold"
      ? adaptiveCopy.holdTitle
      : adaptiveCopy.maintainTitle;
  const reasonLabels = activeReview
    ? [...activeReview.reason_codes, ...activeReview.hold_reasons]
      .map((code) => getReasonLabel(code, isRTL))
      .filter((label, index, labels) => labels.indexOf(label) === index)
    : [];

  const ratingQuestions: Array<{ field: RatingField; label: string }> = [
    { field: "energy_rating", label: copy.energy },
    { field: "hunger_rating", label: copy.hunger },
    { field: "recovery_rating", label: copy.recovery },
    { field: "plan_adherence_rating", label: copy.adherence },
  ];
  const macroLabels: Record<keyof typeof macroStyles, string> = isRTL
    ? { calories: "السعرات", protein: "البروتين", carbs: "الكربوهيدرات", fat: "الدهون" }
    : { calories: "Calories", protein: "Protein", carbs: "Carbs", fat: "Fat" };

  const handleSubmit = async () => {
    if (!allRated) {
      toast.error(copy.required);
      return;
    }
    const result = await submit(answers);
    if (result) {
      setShowReview(true);
      setEditing(false);
      window.setTimeout(() => {
        document.querySelector("main")?.parentElement?.scrollTo({ top: 0, behavior: "smooth" });
      }, 0);
    } else {
      toast.error(copy.failed);
    }
  };

  const handleResolve = async (decision: "apply" | "dismiss") => {
    const success = await resolve(decision);
    if (!success) {
      toast.error(copy.failed);
      return;
    }
    toast.success(decision === "apply" ? copy.applied : copy.dismissed);
    if (decision === "dismiss") navigate("/ai-report");
  };

  if (loading) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-[430px] bg-[#F6F8FB] px-4 pt-5">
        <div className="h-14 animate-pulse rounded-2xl bg-white" />
        <div className="mt-4 h-44 animate-pulse rounded-[28px] bg-white" />
        <div className="mt-4 h-80 animate-pulse rounded-[28px] bg-white" />
      </main>
    );
  }

  return (
    <main dir={isRTL ? "rtl" : "ltr"} className="mx-auto min-h-screen w-full max-w-[430px] bg-[#F6F8FB] text-[#07142F]">
      <header className="sticky top-0 z-20 flex h-[72px] items-center gap-3 border-b border-[#E5EAF1] bg-white/95 px-4 backdrop-blur-xl">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label={copy.back}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#E5EAF1] bg-white text-[#07142F] shadow-sm"
        >
          {isRTL ? <ArrowRight className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-extrabold tracking-[0.14em] text-[#22C7A1]">{copy.eyebrow}</p>
          <h1 className="truncate text-[18px] font-black">{copy.title}</h1>
        </div>
        <div className="grid h-11 w-11 place-items-center rounded-full bg-[#EFFFFA] text-[#0CA789]">
          <ClipboardCheck className="h-5 w-5" />
        </div>
      </header>

      <div className="space-y-4 px-4 pb-[calc(112px+env(safe-area-inset-bottom))] pt-4">
        {!activeReview ? (
          <>
            <section className="rounded-[28px] bg-white p-5 shadow-[0_16px_38px_rgba(15,23,42,0.07)] ring-1 ring-[#E5EAF1]">
              <div>
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#07142F] text-white">
                  <BrainCircuit className="h-6 w-6" />
                </div>
                <h2 className="mt-5 max-w-[290px] text-[25px] font-black leading-[1.15]">{copy.introTitle}</h2>
                <p className="mt-2 max-w-[330px] text-[14px] font-semibold leading-6 text-[#64748B]">{copy.intro}</p>
                <div className="mt-5 flex items-center gap-2 text-[12px] font-extrabold text-[#0CA789]">
                  <ShieldCheck className="h-4 w-4" />
                  <span>{isRTL ? "لن نغيّر أهدافك دون موافقتك" : "You approve every target change"}</span>
                </div>
              </div>
            </section>

            <section className="rounded-[28px] bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.06)] ring-1 ring-[#E5EAF1]">
              <div className="space-y-7">
                {ratingQuestions.map((question, questionIndex) => (
                  <fieldset key={question.field}>
                    <legend className="mb-3 flex items-center gap-3 text-[15px] font-black">
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-[#F3F4FF] text-[12px] text-[#7C83F6]">{questionIndex + 1}</span>
                      {question.label}
                    </legend>
                    <div className="grid grid-cols-5 gap-2">
                      {[1, 2, 3, 4, 5].map((rating) => {
                        const selected = answers[question.field] === rating;
                        return (
                          <button
                            key={rating}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => setAnswers((current) => ({ ...current, [question.field]: rating }))}
                            className={`h-12 rounded-2xl text-sm font-black transition ${selected ? "bg-[#07142F] text-white shadow-md" : "bg-[#F6F8FB] text-[#64748B] ring-1 ring-[#E5EAF1]"}`}
                          >
                            {rating}
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-2 flex justify-between text-[10px] font-bold text-[#94A3B8]">
                      <span>{copy.low}</span><span>{copy.high}</span>
                    </div>
                  </fieldset>
                ))}
              </div>

              <div className="mt-7 border-t border-[#E5EAF1] pt-5">
                <label className="text-[13px] font-black" htmlFor="weekly-weight">{copy.weight}</label>
                <div className="relative mt-2">
                  <Scale className="absolute start-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#94A3B8]" />
                  <input
                    id="weekly-weight"
                    type="number"
                    inputMode="decimal"
                    min="25"
                    max="350"
                    step="0.1"
                    value={answers.weight_kg ?? ""}
                    onChange={(event) => setAnswers((current) => ({ ...current, weight_kg: event.target.value ? Number(event.target.value) : null }))}
                    className="h-14 w-full rounded-2xl border border-[#E5EAF1] bg-[#F6F8FB] pe-14 ps-12 text-[16px] font-black outline-none focus:border-[#22C7A1] focus:ring-4 focus:ring-[#22C7A1]/10"
                    placeholder="--.-"
                  />
                  <span className="absolute end-4 top-1/2 -translate-y-1/2 text-xs font-bold text-[#94A3B8]">kg</span>
                </div>
                <label className="mt-5 block text-[13px] font-black" htmlFor="weekly-note">{copy.note}</label>
                <textarea
                  id="weekly-note"
                  maxLength={500}
                  rows={3}
                  value={answers.notes ?? ""}
                  onChange={(event) => setAnswers((current) => ({ ...current, notes: event.target.value || null }))}
                  placeholder={copy.notePlaceholder}
                  className="mt-2 w-full resize-none rounded-2xl border border-[#E5EAF1] bg-[#F6F8FB] p-4 text-sm font-semibold leading-6 outline-none placeholder:text-[#94A3B8] focus:border-[#22C7A1] focus:ring-4 focus:ring-[#22C7A1]/10"
                />
              </div>
            </section>

            {error && <p role="alert" className="rounded-2xl bg-[#FFF0F2] px-4 py-3 text-sm font-bold text-[#D92D4A]">{copy.failed}</p>}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#07142F] px-5 text-[15px] font-black text-white shadow-[0_12px_26px_rgba(7,20,47,0.2)] disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5 text-[#47E1C2]" />}
              {copy.submit}
              {!submitting && <ChevronRight className={`h-5 w-5 ${isRTL ? "rotate-180" : ""}`} />}
            </button>
          </>
        ) : activeReview.status === "stale" ? (
          <section className="rounded-[28px] bg-white p-6 text-center shadow-[0_16px_38px_rgba(15,23,42,0.07)] ring-1 ring-[#E5EAF1]">
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-[#FFF7ED] text-[#F97316] ring-8 ring-[#FFF7ED]/70">
              <RotateCcw className="h-9 w-9" strokeWidth={2.5} />
            </div>
            <h2 className="mt-6 text-[23px] font-black">{adaptiveCopy.staleTitle}</h2>
            <p className="mx-auto mt-2 max-w-[320px] text-sm font-semibold leading-6 text-[#64748B]">{adaptiveCopy.staleBody}</p>
            <button
              type="button"
              onClick={() => {
                setEditing(true);
                setShowReview(false);
              }}
              className="mt-7 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#020617] px-5 text-sm font-black text-white"
            >
              <RotateCcw className="h-5 w-5" />
              {adaptiveCopy.reviewAgain}
            </button>
          </section>
        ) : activeReview.status === "applied" ? (
          <section className="rounded-[28px] bg-white p-6 text-center shadow-[0_16px_38px_rgba(15,23,42,0.07)] ring-1 ring-[#E5EAF1]">
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-[#EFFFFA] text-[#0CA789] ring-8 ring-[#EFFFFA]/60">
              <Check className="h-9 w-9" strokeWidth={3} />
            </div>
            <h2 className="mt-6 text-[24px] font-black">{copy.applied}</h2>
            <p className="mx-auto mt-2 max-w-[300px] text-sm font-semibold leading-6 text-[#64748B]">{copy.appliedBody}</p>
            <button type="button" onClick={() => navigate("/dashboard/nutrition")} className="mt-7 h-14 w-full rounded-2xl bg-[#07142F] px-5 text-sm font-black text-white">
              {isRTL ? "فتح لوحة التغذية" : "Open nutrition dashboard"}
            </button>
          </section>
        ) : (
          <>
            <section className="overflow-hidden rounded-[28px] bg-white shadow-[0_16px_38px_rgba(15,23,42,0.07)] ring-1 ring-[#E5EAF1]">
              <div className="bg-[#07142F] p-5 text-white">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black tracking-[0.14em] text-[#47E1C2]">{copy.eyebrow}</p>
                    <h2 className="mt-1 text-[23px] font-black leading-tight text-white">{copy.reviewTitle}</h2>
                    <p className="mt-2 text-[13px] font-semibold text-white/65">{copy.reviewIntro}</p>
                  </div>
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/10 text-[#47E1C2]">
                    <Sparkles className="h-6 w-6" />
                  </div>
                </div>
                <div className="mt-5 flex items-center justify-between rounded-2xl bg-white/8 px-4 py-3">
                  <span className="text-xs font-bold text-white/65">{decisionLabel}</span>
                  <span className="text-sm font-black">{dataQualityLabel}</span>
                </div>
              </div>
              <div className="p-5">
                <p className="text-[14px] font-bold leading-6 text-[#334155]">{activeReview.review_summary}</p>
                <div className="mt-5 space-y-3">
                  {(Object.keys(macroStyles) as Array<keyof typeof macroStyles>).map((key) => {
                    const style = macroStyles[key];
                    const Icon = style.icon;
                    const current = activeReview.current_targets[key];
                    const proposed = activeReview.proposed_targets[key];
                    const difference = proposed - current;
                    return (
                      <div key={key} className="grid grid-cols-[44px_1fr_auto] items-center gap-3 rounded-2xl bg-[#F8FAFC] p-3 ring-1 ring-[#E5EAF1]">
                        <div className="grid h-11 w-11 place-items-center rounded-xl" style={{ color: style.color, backgroundColor: style.soft }}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-[11px] font-extrabold uppercase text-[#94A3B8]">{macroLabels[key]}</p>
                          <p className="mt-1 text-sm font-black">
                            {current}<span className="mx-1.5 text-[#CBD5E1]">→</span>{proposed} <span className="text-[10px] text-[#94A3B8]">{style.unit}</span>
                          </p>
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${difference === 0 ? "bg-white text-[#64748B]" : difference > 0 ? "bg-[#EFFFFA] text-[#0CA789]" : "bg-[#FFF0F2] text-[#D92D4A]"}`}>
                          {difference === 0 ? copy.noChange : `${difference > 0 ? "+" : ""}${difference}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            <section className="rounded-[28px] bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.06)] ring-1 ring-[#E5EAF1]">
              <h3 className="flex items-center gap-2 text-[16px] font-black"><BrainCircuit className="h-5 w-5 text-[#7C83F6]" />{copy.evidence}</h3>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Evidence value={`${activeReview.days_logged}/7`} label={copy.days} />
                <Evidence value={`${Math.round(activeReview.adherence_rate * 100)}%`} label={copy.adherenceRate} />
                <Evidence
                  value={activeReview.weight_trend.weekly_rate_kg == null
                    ? "--"
                    : `${activeReview.weight_trend.weekly_rate_kg > 0 ? "+" : ""}${activeReview.weight_trend.weekly_rate_kg.toFixed(2)} kg`}
                  label={adaptiveCopy.smoothedTrend}
                />
                <Evidence value={dataQualityLabel} label={adaptiveCopy.dataQuality} />
                {(activeReview.meal_response_evidence.enabled
                  || activeReview.meal_response_evidence.eligible_episode_count > 0) && (
                  <Evidence
                    value={String(activeReview.meal_response_evidence.eligible_episode_count)}
                    label={mealResponseLabel}
                  />
                )}
              </div>
              {activeReview.meal_response_evidence.summary && (
                <p className="mt-4 rounded-2xl bg-[#EFF9FF] p-3 text-[11px] font-semibold leading-5 text-[#246786]">
                  {activeReview.meal_response_evidence.summary}
                </p>
              )}
              {(activeReview.meal_response_evidence.enabled
                || activeReview.meal_response_evidence.eligible_episode_count > 0) && (
                <p className="mt-3 text-[10px] font-semibold leading-4 text-[#64748B]">
                  {mealResponseContext}
                </p>
              )}
              {reasonLabels.length > 0 && (
                <div className={`mt-4 rounded-2xl p-4 ${activeReview.recommendation_state === "hold" ? "bg-[#FFF0F2]" : "bg-[#F3F4FF]"}`}>
                  <p className={`text-[11px] font-black uppercase ${activeReview.recommendation_state === "hold" ? "text-[#D92D4A]" : "text-[#6168D9]"}`}>
                    {adaptiveCopy.reasons}
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {reasonLabels.map((label) => (
                      <li key={label} className="flex items-start gap-2 text-[11px] font-semibold leading-5 text-[#475569]">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#22C7A1]" />
                        <span>{label}</span>
                      </li>
                    ))}
                  </ul>
                  {activeReview.recommendation_state === "hold" && (
                    <p className="mt-2 text-[11px] font-bold leading-5 text-[#D92D4A]">{adaptiveCopy.holdBody}</p>
                  )}
                </div>
              )}
              {activeReview.recommendation_state === "change" && (
                <p className="mt-3 rounded-2xl bg-[#EFFFFA] p-3 text-[11px] font-bold leading-5 text-[#087F6A]">
                  {adaptiveCopy.proteinProtected}
                </p>
              )}
              <p className="mt-4 rounded-2xl bg-[#FFF7ED] p-3 text-[11px] font-semibold leading-5 text-[#9A5B13]">{copy.safety}</p>
            </section>

            {error && <p role="alert" className="rounded-2xl bg-[#FFF0F2] px-4 py-3 text-sm font-bold text-[#D92D4A]">{copy.failed}</p>}
            <button
              type="button"
              onClick={() => handleResolve("apply")}
              disabled={resolving}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#22C7A1] px-5 text-[15px] font-black text-[#07142F] shadow-[0_12px_26px_rgba(34,199,161,0.22)] disabled:opacity-60"
            >
              {resolving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
              {hasChanges ? copy.apply : copy.keep}
            </button>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setEditing(true)} className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-white text-xs font-black text-[#64748B] ring-1 ring-[#E5EAF1]">
                <RotateCcw className="h-4 w-4" />{copy.edit}
              </button>
              <button type="button" onClick={() => handleResolve("dismiss")} disabled={resolving} className="h-12 rounded-2xl bg-white text-xs font-black text-[#64748B] ring-1 ring-[#E5EAF1] disabled:opacity-60">
                {copy.dismiss}
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function getReasonLabel(code: string, isRTL: boolean) {
  const labels: Record<string, [string, string]> = {
    "data.minimum_not_met": ["Not enough consistent food and weight data yet", "لا توجد بيانات غذاء ووزن متسقة بما يكفي بعد"],
    "safety.context_requires_hold": ["Recent feedback or health context requires holding the plan", "تتطلب الملاحظات أو البيانات الصحية الحديثة تثبيت الخطة"],
    "trend.smoothed_plateau": ["The smoothed weight trend is stable", "اتجاه الوزن المحسوب بالوسيط مستقر"],
    "adherence.sufficient": ["Logging and adherence are sufficient for a small adjustment", "التسجيل والالتزام كافيان لتعديل صغير"],
    "change.bounded": ["The change is capped at 5% and within the weekly safety limit", "التغيير محدود بـ 5% وضمن الحد الأسبوعي الآمن"],
    "trend.no_bounded_change_needed": ["The reliable trend does not support a target change", "الاتجاه الموثوق لا يدعم تغيير الأهداف"],
    "safety.calorie_floor": ["The calorie safety floor prevents a further reduction", "حد السعرات الآمن يمنع خفضًا إضافيًا"],
    "safety.calorie_ceiling": ["The configured calorie ceiling prevents a further increase", "الحد الأعلى للسعرات يمنع زيادة إضافية"],
    "feedback.low_energy": ["Energy was low", "مستوى الطاقة كان منخفضًا"],
    "feedback.low_recovery": ["Recovery was low", "مستوى التعافي كان منخفضًا"],
    "feedback.high_hunger": ["Hunger was high", "مستوى الجوع كان مرتفعًا"],
    "context.high_stress": ["Recent stress was high", "مستوى الضغط الحديث كان مرتفعًا"],
    "context.low_appetite": ["Recent appetite was low", "الشهية الحديثة كانت منخفضة"],
    "context.low_energy": ["Recent health journal energy was low", "الطاقة المسجلة حديثًا كانت منخفضة"],
    "context.digestive_discomfort": ["Recent digestive discomfort was reported", "تم تسجيل انزعاج هضمي حديث"],
    "program.active_health_protocol": ["An active health program controls nutrition changes", "يوجد برنامج صحي نشط يتحكم في تغييرات التغذية"],
    "program.unresolved_safety_event": ["A health-program safety event needs review", "توجد إشارة سلامة في البرنامج الصحي تحتاج إلى مراجعة"],
    "goal.active_goal_required": ["An active nutrition goal is required", "يلزم وجود هدف تغذية نشط"],
    "settings.adaptive_review_disabled": ["Adaptive reviews are disabled in settings", "المراجعات التكيفية معطلة من الإعدادات"],
  };
  const label = labels[code];
  return label ? label[isRTL ? 1 : 0] : code.replace(/[._]/g, " ");
}

function Evidence({ value, label }: { value: string; label: string }) {
  return (
    <div className="min-h-[84px] rounded-2xl bg-[#F6F8FB] p-3 ring-1 ring-[#E5EAF1]">
      <p className="text-[21px] font-black leading-none text-[#07142F]">{value}</p>
      <p className="mt-2 text-[10px] font-extrabold uppercase leading-4 text-[#94A3B8]">{label}</p>
    </div>
  );
}
