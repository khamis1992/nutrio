import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, ChevronDown, FlaskConical, Gauge, ShieldCheck } from "lucide-react";

import { useLanguage } from "@/contexts/LanguageContext";
import { useMealResponse } from "@/hooks/useMealResponse";
import type { MealResponseEstimate } from "@/lib/meal-response";
import { cn } from "@/lib/utils";

const outcomeCopy: Record<string, { en: string; ar: string }> = {
  glucose_peak_delta: { en: "Glucose rise", ar: "ارتفاع الجلوكوز" },
  glucose_positive_iauc: { en: "Glucose exposure", ar: "استجابة الجلوكوز" },
  glucose_recovery_time: { en: "Recovery time", ar: "وقت عودة الجلوكوز" },
  satiety_90m: { en: "Fullness after 90 min", ar: "الشبع بعد 90 دقيقة" },
  satiety_180m: { en: "Fullness after 3 hours", ar: "الشبع بعد 3 ساعات" },
  energy_90m: { en: "Energy after 90 min", ar: "الطاقة بعد 90 دقيقة" },
  digestive_comfort: { en: "Digestive comfort", ar: "الراحة الهضمية" },
};

const sourceCopy = {
  measured: { en: "Measured", ar: "مقاس" },
  observed: { en: "Self-reported", ar: "مسجل ذاتيًا" },
  predicted: { en: "Predicted", ar: "متنبأ" },
  experiment: { en: "Experiment-backed", ar: "مدعوم بتجربة" },
} as const;

const tierStyle = {
  descriptive: "bg-[#F6F8FB] text-[#64748B]",
  early: "bg-[#EFF9FF] text-[#0284C7]",
  medium: "bg-[#F3F4FF] text-[#6268D9]",
  strong: "bg-[#EFFFFA] text-[#0D9F7F]",
} as const;

function formatValue(value: number | null) {
  if (value === null) return "-";
  return Math.abs(value) >= 100 ? Math.round(value).toLocaleString() : value.toFixed(1).replace(/\.0$/, "");
}

export function MealResponseInsightCard({ mealId }: { mealId: string }) {
  const navigate = useNavigate();
  const { language, isRTL } = useLanguage();
  const { data, isLoading } = useMealResponse();
  const [showWhy, setShowWhy] = useState(false);
  const estimates = useMemo(
    () => data?.estimates.filter((estimate) => estimate.meal_id === mealId).slice(0, 3) ?? [],
    [data?.estimates, mealId],
  );
  const enabled = data?.preferences.meal_response_enabled === true;

  if (isLoading) return null;

  if (!enabled || estimates.length === 0) {
    return (
      <section className="rounded-[28px] bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.06)] ring-1 ring-[#E5EAF1]">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#F3F4FF] text-[#7C83F6]">
            <Activity className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase text-[#7C83F6]">
              {isRTL ? "استجابتك" : "YOUR RESPONSE"}
            </p>
            <h2 className="mt-1 text-[18px] font-black text-[#020617]">
              {isRTL ? "لا يوجد دليل كافٍ لهذه الوجبة بعد" : "Not enough evidence for this meal yet"}
            </h2>
            <p className="mt-1.5 text-[12px] font-semibold leading-5 text-[#64748B]">
              {isRTL
                ? "أكد وقت تناول الوجبة وأكمل تقييمات قصيرة. لن نعرض نتيجة حتى تصبح البيانات قابلة للاعتماد."
                : "Confirm when you ate and complete short check-ins. Nutrio will not show a result until the data is reliable."}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate("/health/meal-response")}
          className="mt-4 min-h-11 w-full rounded-full bg-[#020617] px-4 text-[12px] font-black text-white"
        >
          {isRTL ? "فتح استجابة الوجبات" : "Open Meal Response"}
        </button>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-[28px] bg-white shadow-[0_16px_38px_rgba(15,23,42,0.07)] ring-1 ring-[#E5EAF1]">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase text-[#22C7A1]">
              {isRTL ? "استجابتك لهذه الوجبة" : "YOUR OBSERVED RESPONSE"}
            </p>
            <h2 className="mt-1 text-[20px] font-black text-[#020617]">
              {isRTL ? "ما تعلمناه حتى الآن" : "What Nutrio has learned so far"}
            </h2>
          </div>
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#EFFFFA] text-[#22C7A1]">
            <Gauge className="h-5 w-5" />
          </span>
        </div>

        <div className="mt-4 divide-y divide-[#E5EAF1]">
          {estimates.map((estimate) => (
            <OutcomeRow key={estimate.id} estimate={estimate} language={language} />
          ))}
        </div>

        <button
          type="button"
          aria-expanded={showWhy}
          onClick={() => setShowWhy((current) => !current)}
          className="mt-3 flex min-h-11 w-full items-center justify-between gap-3 rounded-2xl bg-[#F6F8FB] px-4 text-start"
        >
          <span className="flex min-w-0 items-center gap-2 text-[12px] font-black text-[#020617]">
            <ShieldCheck className="h-4 w-4 shrink-0 text-[#22C7A1]" />
            {isRTL ? "لماذا أرى هذه النتيجة؟" : "Why am I seeing this?"}
          </span>
          <ChevronDown className={cn("h-4 w-4 shrink-0 text-[#94A3B8] transition", showWhy && "rotate-180")} />
        </button>

        {showWhy ? (
          <div className="mt-3 rounded-2xl border border-[#E5EAF1] p-4">
            <p className="text-[11px] font-semibold leading-5 text-[#64748B]">
              {isRTL
                ? "تعتمد النتائج على أوقات الوجبات المؤكدة والقياسات أو التقييمات المتكررة المؤهلة. نستبعد النوافذ التي تحتوي وجبة متداخلة أو تغطية ضعيفة، ولا نعرض هذه الملاحظة كتشخيص طبي."
                : "Results use confirmed meal times and eligible repeated measurements or check-ins. Windows with overlapping meals or weak coverage are excluded, and this is never presented as a medical diagnosis."}
            </p>
            <button type="button" onClick={() => navigate("/health/meal-response")} className="mt-3 inline-flex min-h-11 items-center gap-2 text-[12px] font-black text-[#020617]">
              <FlaskConical className="h-4 w-4 text-[#7C83F6]" />
              {isRTL ? "عرض الأنماط والتجارب" : "View patterns and experiments"}
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function OutcomeRow({ estimate, language }: { estimate: MealResponseEstimate; language: "en" | "ar" }) {
  const outcome = outcomeCopy[estimate.outcome]?.[language] ?? estimate.outcome.replace(/_/g, " ");
  const source = sourceCopy[estimate.source_kind][language];
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="truncate text-[13px] font-black text-[#020617]">{outcome}</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <span className={cn("rounded-full px-2 py-1 text-[9px] font-black", tierStyle[estimate.evidence_tier])}>{estimate.evidence_tier}</span>
          <span className="rounded-full bg-[#F6F8FB] px-2 py-1 text-[9px] font-black text-[#64748B]">{source}</span>
          <span className="rounded-full bg-[#F6F8FB] px-2 py-1 text-[9px] font-black text-[#64748B]">{estimate.eligible_episode_count}x</span>
        </div>
      </div>
      <div className="text-end">
        <p className="text-[20px] font-black text-[#020617]">
          {formatValue(estimate.estimate)} <span className="text-[10px] text-[#94A3B8]">{estimate.unit}</span>
        </p>
        {estimate.lower_bound !== null && estimate.upper_bound !== null ? (
          <p className="mt-1 text-[9px] font-bold text-[#94A3B8]">
            {formatValue(estimate.lower_bound)}-{formatValue(estimate.upper_bound)}
          </p>
        ) : null}
      </div>
    </div>
  );
}
