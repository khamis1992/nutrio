import { Sparkles, ChevronRight, Drumstick, Droplets, Leaf, Check, AlertCircle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface AIInsightImageCardProps {
  score: number;
  maxScore?: number;
  confidence: number;
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
    <div className="flex items-center justify-between px-1.5 py-0.5">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className={cn(
          "flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-lg",
          success ? "bg-emerald-50" : "bg-orange-50"
        )}>
          <span className={success ? "text-emerald-600" : "text-orange-500"}>
            {icon}
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-[12px] font-bold text-slate-800 truncate">{title}</p>
          <p className={cn(
            "text-[10px] font-semibold",
            success ? "text-emerald-600" : "text-orange-500"
          )}>
            {status}
          </p>
        </div>
      </div>
      <div className={cn(
        "flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full ml-2",
        success ? "bg-emerald-100" : "bg-orange-100"
      )}>
        {success
          ? <Check size={13} className="text-emerald-600" />
          : <AlertCircle size={13} className="text-orange-500" />
        }
      </div>
    </div>
  );
}

function SparkleDot({ className, delay }: { className?: string; delay?: string }) {
  return (
    <div
      className={cn("absolute h-[2px] w-[2px] rounded-full bg-violet-300/40", className)}
      style={delay ? { animationDelay: delay } : undefined}
    />
  );
}

export function AIInsightImageCard({
  score,
  maxScore = 100,
  confidence,
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
  const statusColor = overallGood ? "from-violet-600 via-purple-500 to-indigo-600" : "from-amber-500 via-orange-500 to-rose-500";
  const accentColor = overallGood ? "violet" : "amber";
  const accentHex = overallGood ? "#7C3AED" : "#F59E0B";

  return (
    <section className="relative mb-5 overflow-hidden rounded-[28px] border border-violet-100/60 bg-gradient-to-br from-[#f8f6ff] via-[#f3efff] to-[#fef9ff] p-5 shadow-[0_20px_50px_rgba(124,58,237,0.12),0_4px_12px_rgba(124,58,237,0.06)]">
      {/* Decorative dots */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <SparkleDot className="left-[8%] top-[12%]" />
        <SparkleDot className="left-[18%] top-[28%]" delay="0.4s" />
        <SparkleDot className="left-[78%] top-[10%]" delay="0.7s" />
        <SparkleDot className="left-[92%] top-[35%]" delay="0.2s" />
        <SparkleDot className="left-[85%] top-[58%]" delay="0.6s" />
        <SparkleDot className="left-[12%] top-[72%]" delay="0.3s" />
        <SparkleDot className="left-[45%] top-[5%]" delay="0.5s" />
        <SparkleDot className="left-[62%] top-[44%]" delay="0.8s" />
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-violet-200/15 blur-3xl" />
        <div className="absolute -bottom-6 -left-6 h-24 w-24 rounded-full bg-indigo-200/10 blur-2xl" />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-[38px] w-[38px] items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-[0_4px_12px_rgba(124,58,237,0.25)]">
              <Sparkles size={19} className="text-white" />
            </div>
            <div>
              <h3 className="text-[16px] font-extrabold tracking-[-0.02em] text-slate-900">{t("progress_ai_insight")}</h3>
              <p className="text-[11px] font-medium text-slate-400">{t("progress_smart_nutrition_analysis")}</p>
            </div>
          </div>
          {/* Score badge */}
          <div className="flex flex-col items-center shrink-0">
            <div className={cn(
              "rounded-2xl bg-gradient-to-br px-3.5 py-2 text-white shadow-lg",
              statusColor
            )}>
              <p className="text-[22px] font-black leading-none tracking-[-0.04em]">{score}</p>
              <p className="text-center text-[9px] font-semibold text-white/70">/{maxScore}</p>
            </div>
          </div>
        </div>

        {/* AI Summary section */}
        <div className="mt-4 rounded-2xl bg-white/70 backdrop-blur-sm p-3.5 shadow-sm ring-1 ring-violet-100/60">
          <div className="flex items-center gap-3">
            {/* Status icon ring */}
            <div className="relative flex h-[52px] w-[52px] shrink-0 items-center justify-center">
              <svg className="absolute inset-0 -rotate-90" viewBox="0 0 52 52">
                <circle cx="26" cy="26" r="22" fill="none" stroke="#E8E0F0" strokeWidth="3" />
                <circle
                  cx="26" cy="26" r="22"
                  fill="none"
                  stroke={accentHex}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={`${(score / maxScore) * 138} 138`}
                />
              </svg>
              <Sparkles size={20} className="text-violet-500" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-violet-400">{t("progress_ai_summary")}</p>
              <p className={cn(
                "mt-0.5 text-[15px] font-extrabold tracking-[-0.02em]",
                overallGood ? "text-violet-700" : "text-amber-600"
              )}>
                {mealQualityStatus}
              </p>
              {loading ? (
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-violet-300 border-t-violet-500" />
                  <span className="text-[11px] font-medium text-violet-300">{t("progress_generating_insight")}</span>
                </div>
              ) : (
                <p className="mt-1 text-[11px] font-medium leading-[1.5] text-slate-500 line-clamp-2">
                  {summary || t("progress_track_to_unlock_ai")}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Confidence pill */}
        <div className="mt-3 flex items-center gap-2">
          <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-bold text-violet-600">
            {t("progress_confidence", { value: confidence })}
          </span>
        </div>

        {/* Status Rows */}
        <div className="mt-3 space-y-1 rounded-2xl bg-white/60 backdrop-blur-sm p-2 ring-1 ring-violet-100/40">
          <StatusRow
            icon={<Drumstick size={14} />}
            title={t("nutrition_protein")}
            status={proteinStatus}
            success={proteinStatus.toLowerCase().includes("track") || proteinStatus.toLowerCase().includes("good")}
          />
          <div className="h-px bg-violet-50 mx-1" />
          <StatusRow
            icon={<Droplets size={14} />}
            title={t("nutrition_hydration")}
            status={hydrationStatus}
            success={hydrationStatus.toLowerCase().includes("track") || hydrationStatus.toLowerCase().includes("good")}
          />
          <div className="h-px bg-violet-50 mx-1" />
          <StatusRow
            icon={<Leaf size={14} />}
            title={t("nutrition_calories")}
            status={calorieStatus}
            success={calorieStatus.toLowerCase().includes("track") || calorieStatus.toLowerCase().includes("good")}
          />
        </div>

        {/* CTA Button */}
        <button
          onClick={onViewAnalysis}
          className="mt-4 flex w-full items-center justify-between rounded-2xl bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 px-5 py-3.5 text-left font-bold text-white shadow-[0_8px_24px_rgba(124,58,237,0.3)] active:scale-[0.98] transition-all hover:shadow-[0_12px_28px_rgba(124,58,237,0.4)]"
          aria-label={t("progress_view_full_ai_analysis")}
        >
          <span className="flex items-center gap-2.5">
            <Sparkles size={17} className="text-white/90" />
            <span className="text-[13px]">{t("progress_view_full_ai_analysis")}</span>
          </span>
          <ChevronRight size={18} className="text-white/80" />
        </button>
      </div>
    </section>
  );
}
