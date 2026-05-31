import { motion } from "framer-motion";
import { ChevronDown, ChevronLeft, ChevronRight, Leaf } from "lucide-react";
import { format, addDays, subWeeks, addWeeks, isSameDay, isToday } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatLocaleDate } from "@/lib/dateUtils";

interface ScheduleHeaderProps {
  currentWeekStart: Date; selectedDate: Date; weekDays: Date[];
  isUnlimited: boolean; remainingMeals: number; hasActiveSubscription: boolean; DAYS: string[];
  t: (key: string) => string; getDayStatus: (date: Date) => "empty" | "completed" | "partial" | "scheduled";
  onWeekChange: (start: Date) => void; onDateSelect: (date: Date) => void; onBack: () => void;
}

const ScheduleHeader = ({ currentWeekStart, selectedDate, weekDays, isUnlimited, remainingMeals, hasActiveSubscription, DAYS, t, getDayStatus, onWeekChange, onDateSelect, onBack }: ScheduleHeaderProps) => {
  const { language } = useLanguage();
  const getMarkerClass = (dayStatus: "empty" | "completed" | "partial" | "scheduled", selected: boolean) => {
    if (selected) return "bg-emerald-300/70"; if (dayStatus !== "empty") return "bg-emerald-500"; return "bg-slate-300";
  };

  return (
    <div className="sticky top-0 z-20 border-b border-slate-100 bg-white/95 backdrop-blur-xl safe-top">
      <div className="mx-auto max-w-[432px] px-[18px] pb-4 pt-4">
        <div className="relative flex h-12 items-start justify-center">
          <button onClick={onBack} className="absolute left-0 top-0 flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-500 shadow-[0_1px_3px_rgba(15,23,42,0.06)] ring-1 ring-slate-100 active:scale-95 transition">
            <ChevronLeft className="h-[18px] w-[18px] stroke-[2.5]" />
          </button>
          <div className="text-center">
            <h1 className="text-[18px] font-extrabold text-slate-900 tracking-[-0.03em]">{t("my_schedule")}</h1>
            <p className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-semibold text-slate-500">
              {formatLocaleDate(currentWeekStart, language, { month: "short", day: "numeric" })} — {formatLocaleDate(addDays(currentWeekStart, 6), language, { month: "short", day: "numeric", year: "numeric" })}
              <ChevronDown className="h-3 w-3 stroke-[2.5]" />
            </p>
          </div>
          {hasActiveSubscription && (
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className={`absolute right-0 top-1 flex h-7 min-w-[56px] items-center justify-center gap-1.5 rounded-full px-3 text-[12px] font-extrabold text-white shadow-[0_4px_12px_rgba(16,185,129,0.25)] ${
                isUnlimited ? "bg-emerald-500" : remainingMeals <= 0 ? "bg-red-500" : remainingMeals <= 3 ? "bg-amber-500" : "bg-emerald-500"}`}>
              <Leaf className="h-[14px] w-[14px] stroke-[2.5]" /><span>{isUnlimited ? "∞" : remainingMeals}</span>
            </motion.div>
          )}
        </div>

        <div className="mt-6 flex items-center gap-4">
          <button onClick={() => onWeekChange(subWeeks(currentWeekStart, 1))} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-slate-500 shadow-[0_1px_3px_rgba(15,23,42,0.06)] ring-1 ring-slate-100 active:scale-95 transition">
            <ChevronLeft className="h-[18px] w-[18px] stroke-[2.5]" />
          </button>
          <div className="flex flex-1 items-center justify-between">
            {weekDays.map((day, index) => {
              const isSelected = isSameDay(day, selectedDate);
              const isTodayDate = isToday(day);
              const dayStatus = getDayStatus(day);
              return (
                <motion.button key={day.toISOString()} onClick={() => onDateSelect(day)} whileTap={{ scale: 0.85 }} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }}
                  className={`relative flex h-[54px] w-[36px] flex-col items-center justify-center overflow-hidden rounded-full transition-all ${
                    isSelected ? "bg-emerald-500 shadow-[0_8px_20px_rgba(16,185,129,0.3)]" : isTodayDate ? "bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)] ring-1 ring-slate-100" : "bg-transparent active:bg-slate-50"}`}>
                  {isSelected && <motion.div layoutId="selectedDayBg" className="absolute inset-0 bg-emerald-500" transition={{ type: "spring", bounce: 0.2, duration: 0.5 }} />}
                  <span className={`relative z-10 mb-1.5 text-[12px] font-extrabold ${isSelected ? "text-white/90" : "text-slate-400"}`}>{DAYS[day.getDay()]}</span>
                  <span className={`relative z-10 text-[15px] font-extrabold tracking-[-0.03em] ${isSelected ? "text-white" : isTodayDate ? "text-slate-900" : "text-slate-900"}`}>{format(day, "d")}</span>
                  <span className={`relative z-10 mt-2 h-[3px] w-[3px] rounded-full ${getMarkerClass(dayStatus, isSelected)}`} />
                </motion.button>
              );
            })}
          </div>
          <button onClick={() => onWeekChange(addWeeks(currentWeekStart, 1))} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-slate-500 shadow-[0_1px_3px_rgba(15,23,42,0.06)] ring-1 ring-slate-100 active:scale-95 transition">
            <ChevronRight className="h-[18px] w-[18px] stroke-[2.5]" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScheduleHeader;
