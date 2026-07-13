import { motion, useReducedMotion } from "framer-motion";
import { TrendingUp, Dumbbell, Activity, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useBodyMetricsCorrelation } from "@/hooks/useBodyMetricsCorrelation";

export function BodyCorrelationWidget() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();
  const { correlation, loading } = useBodyMetricsCorrelation(undefined);

  if (loading || !correlation || !correlation.hasData || !correlation.topInsight) return null;

  const highCount = correlation.proteinGroups.high.count;
  const lowCount = correlation.proteinGroups.low.count;
  const barMax = Math.max(highCount, lowCount, 1);

  return (
    <motion.div
      initial={prefersReducedMotion ? undefined : { opacity: 0, y: 12 }}
      animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
      transition={prefersReducedMotion ? undefined : { type: "spring", stiffness: 260, damping: 28 }}
      className="mt-4 cursor-pointer rounded-[20px] bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 p-3.5 ring-1 ring-emerald-100/60 shadow-[0_6px_18px_rgba(16,185,129,0.06)]"
      onClick={() => navigate("/progress")}
    >
      <div className="flex items-center gap-2.5">
        <div className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#10B981] to-[#059669] shadow-[0_6px_14px_rgba(16,185,129,0.22)]">
          <Dumbbell className="h-[16px] w-[16px] text-white" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold tracking-[-0.01em] text-slate-900">
            Body & Nutrition Link
          </p>
          <p className="mt-0.5 text-[11px] font-medium leading-snug text-slate-600 line-clamp-2">
            {correlation.topInsight}
          </p>
        </div>
        <ChevronRight className="h-[14px] w-[14px] shrink-0 text-emerald-500" strokeWidth={2.5} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-white/70 p-2.5 shadow-[0_2px_6px_rgba(0,0,0,0.03)]">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.03em] text-emerald-600">{t("high_protein")}</span>
            <Activity className="h-[12px] w-[12px] text-emerald-500" strokeWidth={2} />
          </div>
          <p className="text-[18px] font-extrabold leading-none tracking-[-0.03em] text-slate-900">
            {correlation.proteinGroups.high.avgProtein}g
          </p>
          <div className="mt-1.5 flex items-center gap-0.5">
            <div className="h-[4px] flex-1 rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500"
                style={{ width: `${(highCount / barMax) * 100}%` }}
              />
            </div>
            <span className="text-[10px] font-medium text-slate-500">{highCount}w</span>
          </div>
        </div>

        <div className="rounded-xl bg-white/70 p-2.5 shadow-[0_2px_6px_rgba(0,0,0,0.03)]">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.03em] text-amber-600">{t("low_protein")}</span>
            <Activity className="h-[12px] w-[12px] text-amber-500" strokeWidth={2} />
          </div>
          <p className="text-[18px] font-extrabold leading-none tracking-[-0.03em] text-slate-900">
            {correlation.proteinGroups.low.avgProtein}g
          </p>
          <div className="mt-1.5 flex items-center gap-0.5">
            <div className="h-[4px] flex-1 rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500"
                style={{ width: `${(lowCount / barMax) * 100}%` }}
              />
            </div>
            <span className="text-[10px] font-medium text-slate-500">{lowCount}w</span>
          </div>
        </div>
      </div>

      <motion.div
        className="mt-2.5 flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 text-[10px] font-semibold text-emerald-600 shadow-[0_2px_4px_rgba(0,0,0,0.03)]"
        whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
      >
        <TrendingUp className="h-[11px] w-[11px]" strokeWidth={2.5} />
        {correlation.proteinGroups.high.avgMuscleChange != null && correlation.proteinGroups.high.avgMuscleChange > 0
          ? `+${correlation.proteinGroups.high.avgMuscleChange.toFixed(1)}% muscle per high-protein week`
          : "Track weekly metrics to see trends"}
      </motion.div>
    </motion.div>
  );
}
