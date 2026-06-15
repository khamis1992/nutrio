import { motion } from "framer-motion";
import { isToday } from "date-fns";
import { formatLocaleDate } from "@/lib/dateUtils";
import { useLanguage } from "@/contexts/LanguageContext";

interface DateHeroCardProps { selectedDate: Date; dailyNutrition: { calories: number; protein: number; completed: number; total: number; }; t: (key: string) => string; }

const ClocheIllustration = ({ isRTL }: { isRTL: boolean }) => (
  <div className={`absolute top-6 h-[72px] w-[72px] rounded-full border border-white/10 bg-white/[0.03] ${isRTL ? 'left-5' : 'right-5'}`}>
    <div className="absolute inset-[14px] text-emerald-400 opacity-70">
      <svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><path d="M17 40c1.4-12.5 9.2-20.2 20-20.2S55.6 27.5 57 40H17Z" fill="currentColor" opacity="0.72" /><path d="M15 44h44" stroke="currentColor" strokeWidth="5" strokeLinecap="round" /><path d="M31 20c0-3 2.3-5 5-5s5 2 5 5" stroke="currentColor" strokeWidth="5" strokeLinecap="round" /><path d="M36 53h.1" stroke="currentColor" strokeWidth="7" strokeLinecap="round" /></svg>
    </div>
    <span className="absolute left-[12px] top-[18px] h-[5px] w-[5px] rounded-full bg-amber-400" />
    <span className="absolute right-[11px] top-[15px] h-[6px] w-[6px] rounded-full bg-amber-400" />
    <span className="absolute left-[18px] top-[10px] h-[3px] w-[3px] rounded-full bg-amber-400" />
  </div>
);

const DateHeroCard = ({ selectedDate, dailyNutrition, t }: DateHeroCardProps) => {
  const { language, isRTL } = useLanguage();
  return (
    <motion.div key={selectedDate.toISOString()} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-2.5 mt-3.5">
      <div className="relative min-h-[120px] overflow-hidden rounded-2xl bg-[#0F172A] px-5 py-5 shadow-[0_4px_20px_rgba(15,23,42,0.18)]">
        <div className={`pointer-events-none absolute -bottom-10 h-[90px] w-[140px] rounded-full bg-emerald-300/[0.06] blur-[2px] ${isRTL ? "left-4" : "right-4"}`} />
        <div className={`pointer-events-none absolute -bottom-6 h-[80px] w-[80px] rounded-full bg-emerald-500/[0.12] blur-xl ${isRTL ? "left-[-16px]" : "right-[-16px]"}`} />
        <div className="relative z-10" dir={isRTL ? "rtl" : "ltr"}>
          <p className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.04em] text-emerald-400 leading-relaxed">
            {isToday(selectedDate) ? t("today") : formatLocaleDate(selectedDate, language, { weekday: "long" })}
          </p>
          <h2 className="text-[22px] font-extrabold leading-snug tracking-[-0.04em] text-white">
            {isToday(selectedDate) ? t("today_meals") : formatLocaleDate(selectedDate, language, { weekday: "long", month: "long", day: "numeric" })}
          </h2>
          <p className="mt-5 text-[13px] font-extrabold text-white/80 leading-relaxed">
            {dailyNutrition.total > 0 ? `${dailyNutrition.completed}/${dailyNutrition.total} meals · ${dailyNutrition.calories.toLocaleString()} kcal` : t("meals_no_meals_scheduled")}
          </p>
        </div>
        <ClocheIllustration isRTL={isRTL} />
      </div>
    </motion.div>
  );
};

export default DateHeroCard;
