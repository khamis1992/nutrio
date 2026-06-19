import { motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, subWeeks, addWeeks, isSameDay, isToday } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";

interface ScheduleHeaderProps {
  currentWeekStart: Date; selectedDate: Date; weekDays: Date[];
  isUnlimited: boolean; remainingMeals: number; hasActiveSubscription: boolean; DAYS: string[];
  t: (key: string) => string; getDayStatus: (date: Date) => "empty" | "completed" | "partial" | "scheduled";
  onWeekChange: (start: Date) => void; onDateSelect: (date: Date) => void; onBack: () => void;
  dailyNutrition: { calories: number; protein: number; completed: number; total: number; };
}

const ScheduleHeader = ({
  currentWeekStart, selectedDate, weekDays, isUnlimited, remainingMeals,
  hasActiveSubscription, DAYS, t, getDayStatus, onWeekChange, onDateSelect, onBack,
  dailyNutrition,
}: ScheduleHeaderProps) => {
  const { isRTL } = useLanguage();
  const reduceMotion = useReducedMotion();

  const noMealsText = isRTL
    ? "لا توجد وجبات مجدولة لهذا اليوم"
    : "No meals scheduled for today";

  return (
    <div
      className="sticky top-0 z-20 border-b border-white/60"
      style={{
        paddingTop: "env(safe-area-inset-top, 0px)",
        backgroundColor: "rgba(247,248,243,0.80)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
      }}
    >
      <motion.div
        aria-hidden
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="pointer-events-none absolute -right-16 top-0 h-[180px] w-[180px] rounded-full blur-3xl"
        style={{ backgroundColor: "rgba(16,185,129,0.12)" }}
      />

      <div className="relative mx-auto w-full max-w-[430px]">

        <div className="flex items-center justify-between px-5 pt-4 pb-2" dir={isRTL ? "rtl" : "ltr"}>
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
            {isRTL ? "الجدولة" : "SCHEDULE"}
          </p>
          <motion.button
            onClick={onBack}
            whileTap={{ scale: 0.92 }}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-700 ring-1 ring-white/80 shadow-[0_8px_24px_rgba(15,23,42,0.08)] active:scale-95 transition-all"
            aria-label="Back"
          >
            {isRTL ? <ChevronLeft className="h-[18px] w-[18px] stroke-[2.5]" /> : <ChevronRight className="h-[18px] w-[18px] stroke-[2.5]" />}
          </motion.button>
        </div>

        <motion.div
          initial={reduceMotion ? { opacity: 0 } : { y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
          className="px-5 pb-3"
          dir={isRTL ? "rtl" : "ltr"}
        >
          <h1 className="text-[34px] font-black tracking-[-0.04em] text-slate-950 leading-[1.0]">
            {isRTL ? "وجبات اليوم" : "Today's Meals"}
          </h1>
          <p className="mt-1 text-[13px] font-bold text-slate-400">
            {dailyNutrition.total > 0
              ? (isRTL
                ? `${dailyNutrition.completed}/${dailyNutrition.total} وجبات · ${dailyNutrition.calories.toLocaleString()} سعرة`
                : `${dailyNutrition.completed}/${dailyNutrition.total} meals · ${dailyNutrition.calories.toLocaleString()} kcal`)
              : noMealsText}
          </p>
        </motion.div>

        <div className="px-3 pb-4">
          <div className="flex items-center gap-1.5">
            <motion.button
              onClick={() => onWeekChange(isRTL ? addWeeks(currentWeekStart, 1) : subWeeks(currentWeekStart, 1))}
              whileTap={{ scale: 0.92 }}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/80 text-slate-600 ring-1 ring-white/80 shadow-[0_4px_12px_rgba(15,23,42,0.04)] active:scale-95 transition-all"
            >
              {isRTL ? <ChevronRight className="h-[16px] w-[16px] stroke-[2.5]" /> : <ChevronLeft className="h-[16px] w-[16px] stroke-[2.5]" />}
            </motion.button>

            <div className="no-scrollbar flex flex-1 items-center gap-1.5 overflow-x-auto">
              {weekDays.map((day, index) => {
                const isSelected = isSameDay(day, selectedDate);
                const isTodayDate = isToday(day);
                const dayStatus = getDayStatus(day);
                const dayName = isRTL
                  ? ["أ", "إ", "ث", "أ", "خ", "ج", "س"][day.getDay()]
                  : DAYS[day.getDay()];
                return (
                  <motion.button
                    key={day.toISOString()}
                    onClick={() => onDateSelect(day)}
                    whileTap={{ scale: 0.93 }}
                    initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.04, ease: [0.22, 1, 0.36, 1] }}
                    className={`flex h-[54px] min-w-[42px] flex-1 flex-col items-center justify-center rounded-[20px] transition-all ${
                      isSelected
                        ? "bg-emerald-500 text-white shadow-[0_8px_20px_rgba(16,185,129,0.35)]"
                        : isTodayDate
                        ? "bg-white/90 text-slate-900 ring-1 ring-white/80 shadow-[0_4px_12px_rgba(15,23,42,0.06)] backdrop-blur-sm"
                        : "bg-white/50 text-slate-600 ring-1 ring-white/40"
                    }`}
                  >
                    <span className={`text-[10px] font-bold ${isSelected ? "text-white/80" : "text-slate-400"}`}>
                      {dayName}
                    </span>
                    <span className={`text-[16px] font-extrabold tracking-tight ${isSelected ? "text-white" : isTodayDate ? "text-emerald-600" : "text-slate-800"}`}>
                      {format(day, "d")}
                    </span>
                    <span className={`mt-0.5 h-[4px] w-[14px] rounded-full ${
                      isSelected ? "bg-white/70" : dayStatus !== "empty" ? "bg-emerald-400" : "bg-transparent"
                    }`} />
                  </motion.button>
                );
              })}
            </div>

            <motion.button
              onClick={() => onWeekChange(isRTL ? subWeeks(currentWeekStart, 1) : addWeeks(currentWeekStart, 1))}
              whileTap={{ scale: 0.92 }}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/80 text-slate-600 ring-1 ring-white/80 shadow-[0_4px_12px_rgba(15,23,42,0.04)] active:scale-95 transition-all"
            >
              {isRTL ? <ChevronLeft className="h-[16px] w-[16px] stroke-[2.5]" /> : <ChevronRight className="h-[16px] w-[16px] stroke-[2.5]" />}
            </motion.button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ScheduleHeader;