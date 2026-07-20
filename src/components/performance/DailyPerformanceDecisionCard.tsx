import { useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import {
  AlertCircle,
  ArrowRight,
  CalendarClock,
  Dumbbell,
  HeartPulse,
  Loader2,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  Utensils,
} from "lucide-react";

import { useLanguage } from "@/contexts/LanguageContext";
import { BehaviorSupportAction } from "@/components/performance/BehaviorSupportAction";
import type { DailyPerformanceDecision, PerformanceMealCandidate } from "@/lib/daily-performance";
import { cn } from "@/lib/utils";

interface Props {
  decision?: DailyPerformanceDecision | null;
  meal?: PerformanceMealCandidate | null;
  loading?: boolean;
  error?: Error | null;
  onRefresh?: () => void;
  scheduledMeal?: {
    deliveryTimeSlot: string | null;
    mealType: string | null;
  } | null;
}

const COPY = {
  en: {
    eyebrow: "TODAY'S PERFORMANCE DECISION",
    train: "Train as planned",
    recover: "Recovery session",
    rest: "Rest and refuel",
    trainSummary: "Your workout, nutrition and recovery signals support training today.",
    recoverSummary: "Today's load is reduced to protect recovery while keeping momentum.",
    restSummary: "Recovery is the priority today. Nutrition supports the next session.",
    workout: "Workout",
    nutrition: "Nutrition guardrails",
    meal: "Safest matching meal",
    coach: "Coach direction",
    confidence: "confidence",
    openWorkout: "Start workout",
    openMeals: "View meals",
    scheduleMeal: "Schedule recovery meal",
    adjustMeal: "Adjust delivery",
    delivery: "Delivery step",
    deliveryPending: "Choose a delivery time to complete today's plan.",
    retry: "Try again",
    unavailable: "Today's decision is temporarily unavailable.",
    loading: "Building today's performance decision…",
    noMeal: "No currently available meal fits every safety and coach limit.",
    safety: "Safety first",
  },
  ar: {
    eyebrow: "قرار الأداء لليوم",
    train: "تدرّب حسب الخطة",
    recover: "جلسة تعافٍ",
    rest: "راحة وتغذية",
    trainSummary: "التمرين والتغذية ومؤشرات التعافي تدعم التدريب اليوم.",
    recoverSummary: "تم تخفيف حمل اليوم لحماية التعافي مع الحفاظ على الاستمرارية.",
    restSummary: "التعافي هو الأولوية اليوم، والتغذية تجهزك للجلسة القادمة.",
    workout: "التمرين",
    nutrition: "الحدود الغذائية",
    meal: "الوجبة الآمنة الأنسب",
    coach: "توجيه المدرب",
    confidence: "درجة الثقة",
    openWorkout: "ابدأ التمرين",
    openMeals: "عرض الوجبات",
    scheduleMeal: "جدول وجبة التعافي",
    adjustMeal: "تعديل التوصيل",
    delivery: "خطوة التوصيل",
    deliveryPending: "اختر وقت التوصيل لإكمال خطة اليوم.",
    retry: "إعادة المحاولة",
    unavailable: "تعذر تجهيز قرار اليوم مؤقتًا.",
    loading: "جاري بناء قرار الأداء لليوم…",
    noMeal: "لا توجد وجبة متاحة حاليًا تطابق كل حدود السلامة والمدرب.",
    safety: "السلامة أولًا",
  },
};

export function DailyPerformanceDecisionCard({ decision, meal, loading, error, onRefresh, scheduledMeal }: Props) {
  const navigate = useNavigate();
  const { language, isRTL } = useLanguage();
  const copy = COPY[language === "ar" ? "ar" : "en"];

  if (loading) {
    return (
      <section className="flex min-h-32 items-center justify-center rounded-[26px] border border-slate-200 bg-white p-5" aria-live="polite">
        <Loader2 className="me-2 h-5 w-5 animate-spin text-teal-600" />
        <p className="text-sm font-bold text-slate-600">{copy.loading}</p>
      </section>
    );
  }

  if (error || !decision) {
    return (
      <section className="rounded-[26px] border border-rose-200 bg-rose-50 p-5">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
          <div className="flex-1">
            <p className="text-sm font-extrabold text-slate-900">{copy.unavailable}</p>
            {onRefresh && (
              <button type="button" onClick={onRefresh} className="mt-3 flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 text-xs font-extrabold text-rose-700 ring-1 ring-rose-200">
                <RefreshCw className="h-4 w-4" /> {copy.retry}
              </button>
            )}
          </div>
        </div>
      </section>
    );
  }

  const modeTitle = copy[decision.mode];
  const summary = copy[`${decision.mode}Summary` as "trainSummary" | "recoverSummary" | "restSummary"];
  const dayNumber = Number(decision.evidence.workout_day_number ?? 1);
  const canStartWorkout = decision.mode !== "rest" && Boolean(decision.workout_program_id);

  return (
    <section
      className={cn(
        "overflow-hidden rounded-[28px] border p-5 shadow-[0_16px_45px_rgba(15,23,42,0.08)]",
        decision.mode === "train" && "border-teal-200 bg-gradient-to-br from-[#E9FFF9] to-white",
        decision.mode === "recover" && "border-violet-200 bg-gradient-to-br from-[#F2EFFF] to-white",
        decision.mode === "rest" && "border-sky-200 bg-gradient-to-br from-[#EEF9FF] to-white",
      )}
      dir={isRTL ? "rtl" : "ltr"}
      data-testid="daily-performance-decision"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-teal-700">{copy.eyebrow}</p>
          <h2 className="mt-1 text-[24px] font-black leading-tight text-slate-950">{modeTitle}</h2>
          <p className="mt-2 text-[12px] font-semibold leading-5 text-slate-600">{summary}</p>
        </div>
        <div className="shrink-0 rounded-2xl bg-white/85 px-3 py-2 text-center ring-1 ring-slate-200">
          <p className="text-lg font-black text-slate-950">{decision.confidence_score}%</p>
          <p className="text-[8px] font-extrabold uppercase text-slate-400">{copy.confidence}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-2">
        <DecisionRow icon={Dumbbell} label={copy.workout}>
          {decision.workout_title ?? modeTitle} · {decision.workout_intensity_percent}% · {decision.exercise_count}
        </DecisionRow>
        <DecisionRow icon={HeartPulse} label={copy.nutrition}>
          {decision.calorie_min}–{decision.calorie_max} kcal · {decision.protein_min_g}g protein · {decision.hydration_min_ml}ml
        </DecisionRow>
        <DecisionRow icon={Utensils} label={copy.meal}>
          {meal ? `${meal.name} · ${meal.calories ?? 0} kcal · ${meal.protein_g ?? 0}g` : copy.noMeal}
        </DecisionRow>
        <DecisionRow icon={CalendarClock} label={copy.delivery}>
          {scheduledMeal
            ? `${scheduledMeal.mealType ?? copy.meal} · ${scheduledMeal.deliveryTimeSlot ?? copy.adjustMeal}`
            : copy.deliveryPending}
        </DecisionRow>
        {decision.coach_message && (
          <DecisionRow icon={MessageCircle} label={copy.coach}>{decision.coach_message}</DecisionRow>
        )}
      </div>

      <BehaviorSupportAction />

      <div className={cn("mt-4 grid gap-2", canStartWorkout && meal ? "grid-cols-2" : "grid-cols-1")}>
        {canStartWorkout && (
          <button
            type="button"
            onClick={() => navigate(`/coach-programs/workout/${decision.workout_program_id}/day/${dayNumber}`)}
            className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-3 text-[11px] font-black text-white active:scale-[0.98]"
          >
            <Dumbbell className="h-4 w-4" /> {copy.openWorkout}
          </button>
        )}
        <button
          type="button"
          onClick={() => meal
            ? navigate(`/meals/${meal.id}`, { state: { openSchedule: true, source: "daily-performance" } })
            : navigate("/meals")}
          className={cn(
            "flex min-h-12 items-center justify-center gap-2 rounded-2xl px-3 text-[11px] font-black active:scale-[0.98]",
            canStartWorkout ? "bg-white text-slate-950 ring-1 ring-slate-300" : "bg-slate-950 text-white",
          )}
        >
          <CalendarClock className="h-4 w-4" />
          {scheduledMeal ? copy.adjustMeal : meal ? copy.scheduleMeal : copy.openMeals}
          <ArrowRight className={cn("h-4 w-4", isRTL && "rotate-180")} />
        </button>
      </div>
      <div className="mt-2 flex min-h-9 items-center justify-center gap-1.5 rounded-xl bg-white/70 px-3 text-[10px] font-extrabold text-emerald-700 ring-1 ring-emerald-200" title="Allergy and medication safety ranking is applied first">
        <ShieldCheck className="h-4 w-4" /> {copy.safety}
      </div>
    </section>
  );
}

function DecisionRow({ icon: Icon, label, children }: {
  icon: typeof Dumbbell;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-white/80 p-3 ring-1 ring-slate-200/80">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[9px] font-black uppercase tracking-wide text-slate-400">{label}</p>
        <p className="mt-0.5 text-[11px] font-bold leading-4 text-slate-800">{children}</p>
      </div>
    </div>
  );
}
