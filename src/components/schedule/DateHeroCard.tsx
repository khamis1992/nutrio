import { motion } from "framer-motion";
import { isToday } from "date-fns";
import { formatLocaleDate } from "@/lib/dateUtils";
import { useLanguage } from "@/contexts/LanguageContext";
import { Utensils, Flame } from "lucide-react";

interface DateHeroCardProps {
  selectedDate: Date;
  dailyNutrition: { calories: number; protein: number; completed: number; total: number; };
  t: (key: string) => string;
}

const ClocheIllustration = () => (
  <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center justify-center">
    <div className="relative h-[88px] w-[88px]">
      {/* Outer glow ring */}
      <div className="absolute inset-0 rounded-full bg-emerald-400/10 blur-md" />
      {/* Inner circle */}
      <div className="absolute inset-[8px] rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center">
        <svg viewBox="0 0 64 64" fill="none" className="h-10 w-10 text-emerald-400" aria-hidden="true">
          <path d="M12 42c1.8-14 10.5-22 20-22s18.2 8 20 22H12Z" fill="currentColor" opacity="0.8" />
          <path d="M10 46h44" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
          <path d="M30 20c0-3.5 2.5-6 6-6s6 2.5 6 6" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
          <circle cx="36" cy="54" r="3" fill="currentColor" opacity="0.6" />
        </svg>
      </div>
      {/* Decorative dots */}
      <span className="absolute left-[10px] top-[16px] h-[5px] w-[5px] rounded-full bg-amber-400 opacity-90" />
      <span className="absolute right-[8px] top-[13px] h-[6px] w-[6px] rounded-full bg-amber-300 opacity-80" />
      <span className="absolute left-[16px] top-[8px] h-[3px] w-[3px] rounded-full bg-emerald-300 opacity-70" />
      <span className="absolute right-[18px] top-[22px] h-[3px] w-[3px] rounded-full bg-white opacity-50" />
    </div>
  </div>
);

const DateHeroCard = ({ selectedDate, dailyNutrition, t }: DateHeroCardProps) => {
  const { language } = useLanguage();
  const completionPct = dailyNutrition.total > 0
    ? Math.round((dailyNutrition.completed / dailyNutrition.total) * 100)
    : 0;

  return (
    <motion.div
      key={selectedDate.toISOString()}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-2.5 mt-3.5"
    >
      <div className="relative overflow-hidden rounded-[22px] bg-[#0B1628] px-5 py-5 shadow-[0_8px_32px_rgba(6,78,59,0.25)]">
        {/* Background gradient layers */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#0B1628] via-[#0d1f35] to-[#0a2218]" />
        <div className="pointer-events-none absolute -top-8 -left-8 h-[120px] w-[120px] rounded-full bg-emerald-500/[0.08] blur-2xl" />
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-[60px] bg-gradient-to-t from-emerald-900/20 to-transparent" />

        {/* Content */}
        <div className="relative z-10 pr-[96px]">
          {/* Label */}
          <div className="mb-2 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-2.5 py-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-extrabold uppercase tracking-[0.06em] text-emerald-400">
                {isToday(selectedDate) ? t("today") : formatLocaleDate(selectedDate, language, { weekday: "long" })}
              </span>
            </span>
          </div>

          {/* Date title */}
          <h2 className="text-[21px] font-extrabold leading-tight tracking-[-0.03em] text-white">
            {isToday(selectedDate)
              ? t("today_meals")
              : formatLocaleDate(selectedDate, language, { weekday: "long", month: "long", day: "numeric" })}
          </h2>

          {/* Stats row */}
          {dailyNutrition.total > 0 ? (
            <div className="mt-3.5 flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20">
                  <Utensils className="h-2.5 w-2.5 text-emerald-400" />
                </div>
                <span className="text-[12px] font-bold text-white/80">
                  {dailyNutrition.completed}/{dailyNutrition.total} meals
                </span>
              </div>
              <span className="text-white/20">·</span>
              <div className="flex items-center gap-1.5">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/20">
                  <Flame className="h-2.5 w-2.5 text-amber-400" />
                </div>
                <span className="text-[12px] font-bold text-white/80">
                  {dailyNutrition.calories.toLocaleString()} kcal
                </span>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-[12px] font-semibold text-white/40">No meals scheduled</p>
          )}

          {/* Progress bar */}
          {dailyNutrition.total > 0 && (
            <div className="mt-3.5">
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${completionPct}%` }}
                  transition={{ duration: 0.8, type: "spring", bounce: 0.2 }}
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
                />
              </div>
            </div>
          )}
        </div>

        <ClocheIllustration />
      </div>
    </motion.div>
  );
};

export default DateHeroCard;
