import { Sparkles, ChevronRight, Drumstick, Droplets, Leaf, Check, AlertCircle, Brain } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface AIInsightImageCardProps {
  score: number;
  maxScore?: number;
  confidence: number;
  confidenceExplanation?: string;
  mealQualityStatus: string;
  summary: string;
  proteinStatus: string;
  hydrationStatus: string;
  calorieStatus: string;
  loading?: boolean;
  onViewAnalysis?: () => void;
}

function StatusRow({
  icon,
  title,
  status,
  success,
}: {
  icon: React.ReactNode;
  title: string;
  status: string;
  success?: boolean;
}) {
  return (
    <div className="flex min-h-[54px] items-center justify-between gap-3 rounded-[18px] bg-slate-50/80 px-3 py-2">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px]",
          success ? "bg-emerald-50" : "bg-orange-50"
        )}>
          <span className={success ? "text-emerald-600" : "text-orange-500"}>
            {icon}
          </span>
        </div>
        <div className="min-w-0">
          <p className="truncate text-[12px] font-black text-slate-900">{title}</p>
          <p className={cn(
            "text-[10px] font-black",
            success ? "text-emerald-600" : "text-orange-500"
          )}>
            {status}
          </p>
        </div>
      </div>
      <div className={cn(
        "ml-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
        success ? "bg-emerald-100" : "bg-orange-100"
      )}>
        {success
          ? <Check size={14} className="text-emerald-600" />
          : <AlertCircle size={14} className="text-orange-500" />
        }
      </div>
    </div>
  );
}

export function AIInsightImageCard({
  score,
  maxScore = 100,
  confidence,
  confidenceExplanation,
  mealQualityStatus,
  summary,
  proteinStatus,
  hydrationStatus,
  calorieStatus,
  loading,
  onViewAnalysis,
}: AIInsightImageCardProps) {
  const { t } = useLanguage();
  const overallGood = score >= 60;
  const scoreColor = overallGood ? "#f97316" : "#fb923c";
  const scoreBg = overallGood ? "bg-orange-500" : "bg-amber-500";
  const ringValue = Math.min(100, Math.max(0, Math.round((score / maxScore) * 100)));

  return (
    <section className="mb-5 overflow-hidden rounded-[28px] border border-orange-100 bg-white p-4 shadow-[0_14px_36px_rgba(15,23,42,0.07)]">
      <div className="rounded-[24px] bg-gradient-to-br from-orange-50 via-white to-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-white text-orange-500 shadow-[0_10px_22px_rgba(249,115,22,0.12)]">
              <Brain size={22} />
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-[17px] font-black tracking-[-0.02em] text-slate-950">{t("progress_ai_insight")}</h3>
              <p className="truncate text-[11px] font-bold text-slate-500">{t("progress_smart_nutrition_analysis")}</p>
            </div>
          </div>

          <div className="relative grid h-[58px] w-[58px] shrink-0 place-items-center">
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 58 58">
              <circle cx="29" cy="29" r="24" fill="none" stroke="#fed7aa" strokeWidth="6" />
              <circle
                cx="29"
                cy="29"
                r="24"
                fill="none"
                stroke={scoreColor}
                strokeDasharray={`${(ringValue / 100) * 150.8} 150.8`}
                strokeLinecap="round"
                strokeWidth="6"
              />
            </svg>
            <div className={cn("grid h-11 w-11 place-items-center rounded-full text-white", scoreBg)}>
              <div className="text-center">
                <p className="text-[18px] font-black leading-none">{score}</p>
                <p className="text-[8px] font-black leading-none text-white/80">/{maxScore}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-[22px] border border-orange-100 bg-white p-4 shadow-[0_8px_20px_rgba(15,23,42,0.04)]">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[16px] bg-orange-50 text-orange-500">
              <Sparkles size={19} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-orange-500">{t("progress_ai_summary")}</p>
              <p className={cn(
                "mt-1 text-[16px] font-black tracking-[-0.02em]",
                overallGood ? "text-slate-950" : "text-orange-700"
              )}>
                {mealQualityStatus}
              </p>
              {loading ? (
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-orange-200 border-t-orange-500" />
                  <span className="text-[11px] font-bold text-orange-400">{t("progress_generating_insight")}</span>
                </div>
              ) : (
                <p className="mt-1.5 line-clamp-3 text-[12px] font-semibold leading-relaxed text-slate-500">
                  {summary || t("progress_track_to_unlock_ai")}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-[18px] bg-white/80 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">{t("progress_confidence", { value: confidence })}</span>
            <span className="text-[12px] font-black text-orange-600">{confidence}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-orange-100">
            <div className="h-full rounded-full bg-orange-500 transition-all duration-700" style={{ width: `${Math.min(100, Math.max(0, confidence))}%` }} />
          </div>
          {confidenceExplanation ? (
            <p className="mt-2 text-[11px] font-semibold leading-relaxed text-slate-500">
              {confidenceExplanation}
            </p>
          ) : null}
        </div>

        <div className="mt-4 space-y-2">
          <StatusRow
            icon={<Drumstick size={14} />}
            title={t("nutrition_protein")}
            status={proteinStatus}
            success={proteinStatus.toLowerCase().includes("track") || proteinStatus.toLowerCase().includes("good")}
          />
          <StatusRow
            icon={<Droplets size={14} />}
            title={t("nutrition_hydration")}
            status={hydrationStatus}
            success={hydrationStatus.toLowerCase().includes("track") || hydrationStatus.toLowerCase().includes("good")}
          />
          <StatusRow
            icon={<Leaf size={14} />}
            title={t("nutrition_calories")}
            status={calorieStatus}
            success={calorieStatus.toLowerCase().includes("track") || calorieStatus.toLowerCase().includes("good")}
          />
        </div>

        <button
          onClick={onViewAnalysis}
          className="mt-4 flex min-h-12 w-full items-center justify-between rounded-[18px] bg-slate-950 px-5 text-left font-bold text-white shadow-[0_10px_24px_rgba(15,23,42,0.18)] transition-all active:scale-[0.98]"
          aria-label={t("progress_view_full_ai_analysis")}
        >
          <span className="flex items-center gap-2.5">
            <Sparkles size={17} className="text-orange-300" />
            <span className="text-[13px]">{t("progress_view_full_ai_analysis")}</span>
          </span>
          <ChevronRight size={18} className="text-orange-200" />
        </button>
      </div>
    </section>
  );
}
