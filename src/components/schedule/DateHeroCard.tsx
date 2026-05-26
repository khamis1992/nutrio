import { motion } from "framer-motion";
import { isToday } from "date-fns";
import { formatLocaleDate } from "@/lib/dateUtils";
import { useLanguage } from "@/contexts/LanguageContext";

interface DateHeroCardProps {
  selectedDate: Date;
  dailyNutrition: {
    calories: number;
    protein: number;
    completed: number;
    total: number;
  };
  t: (key: string) => string;
}

const ClocheIllustration = () => (
  <div className="absolute right-[23px] top-[27px] h-[76px] w-[76px] rounded-full border border-white/18 bg-white/[0.03]">
    <div className="absolute inset-[16px] text-[#58D79E] opacity-80">
      <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <path d="M17 40c1.4-12.5 9.2-20.2 20-20.2S55.6 27.5 57 40H17Z" fill="currentColor" opacity="0.72" />
        <path d="M15 44h44" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
        <path d="M31 20c0-3 2.3-5 5-5s5 2 5 5" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
        <path d="M36 53h.1" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
      </svg>
    </div>
    <span className="absolute left-[14px] top-[21px] h-[5px] w-[5px] rounded-full bg-[#F5D66E]" />
    <span className="absolute right-[13px] top-[18px] h-[6px] w-[6px] rounded-full bg-[#F5D66E]" />
    <span className="absolute left-[20px] top-[13px] h-[3px] w-[3px] rounded-full bg-[#F5D66E]" />
  </div>
);

const DateHeroCard = ({ selectedDate, dailyNutrition, t }: DateHeroCardProps) => {
  const { language } = useLanguage();
  return (
    <motion.div
      key={selectedDate.toISOString()}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-[10px] mt-[14px]"
    >
      <div className="relative min-h-[126px] overflow-hidden rounded-[26px] bg-[linear-gradient(135deg,#06242B_0%,#063036_46%,#087057_100%)] px-[22px] py-[20px] shadow-[0_22px_45px_rgba(6,48,52,0.18)]">
        <div className="pointer-events-none absolute bottom-[-40px] right-[18px] h-[98px] w-[150px] rounded-full bg-emerald-300/10 blur-[2px]" />
        <div className="pointer-events-none absolute bottom-[-24px] right-[-20px] h-[86px] w-[86px] rounded-full bg-[#0E8B67]/30 blur-xl" />
        <div className="relative z-10">
          <div>
            <p className="mb-[15px] text-[11px] font-black uppercase leading-none tracking-[0.04em] text-[#14CF8A]">
              {isToday(selectedDate) ? t("today") : formatLocaleDate(selectedDate, language, { weekday: "long" })}
            </p>
            <h2 className="text-[24px] font-black leading-none tracking-[-0.055em] text-white">
              {isToday(selectedDate) ? t("today_meals") : formatLocaleDate(selectedDate, language, { weekday: "long", month: "long", day: "numeric" })}
            </h2>
          </div>
          <p className="mt-[22px] text-[13px] font-black leading-none tracking-[-0.02em] text-white">
            {dailyNutrition.total > 0 ? `${dailyNutrition.completed}/${dailyNutrition.total} meals · ${dailyNutrition.calories.toLocaleString()} kcal` : "No meals scheduled"}
          </p>
        </div>
        <ClocheIllustration />
      </div>
    </motion.div>
  );
};

export default DateHeroCard;
