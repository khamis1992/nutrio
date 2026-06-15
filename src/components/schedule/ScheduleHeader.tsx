import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Leaf } from "lucide-react";
import { format, addDays, subWeeks, addWeeks, isSameDay, isToday } from "date-fns";
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

  const todayLabel = isToday(selectedDate)
    ? (isRTL ? "اليوم" : "Today")
    : format(selectedDate, "EEEE, d MMM");

  const noMealsText = isRTL
    ? "لا توجد وجبات مجدولة لهذا اليوم"
    : "No meals scheduled for today";

  return (
    <div className="sticky top-0 z-20 bg-white border-b border-slate-100 shadow-[0_1px_0_rgba(15,23,42,0.04)]"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
      <div className="mx-auto w-full max-w-[430px]">

        {/* ── Row 1: Back button + Remaining meals badge ── */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2" dir={isRTL ? "rtl" : "ltr"}>
          {/* Remaining meals badge — left in LTR, right in RTL */}
          {hasActiveSubscription && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={`flex h-8 min-w-[64px] items-center justify-center gap-1.5 rounded-full border px-3 text-[12px] font-extrabold ${
                remainingMeals <= 0 && !isUnlimited
                  ? "bg-red-50 text-red-700 border-red-200"
                  : remainingMeals <= 3 && !isUnlimited
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : "bg-emerald-50 text-emerald-700 border-emerald-200"
              }`}
            >
              <Leaf className="h-[13px] w-[13px] stroke-[2.5]" />
              <span>{isUnlimited ? "∞" : remainingMeals}</span>
            </motion.div>
          )}
          {!hasActiveSubscription && <div />}

          {/* Back button — right in LTR, left in RTL */}
          <button
            onClick={onBack}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 active:scale-95 transition-all"
            aria-label="Back"
          >
            <ChevronRight className="h-[18px] w-[18px] stroke-[2.5]" />
          </button>
        </div>

        {/* ── Row 2: Title + subtitle ── */}
        <div className="px-4 pb-3 text-right" dir="rtl">
          <h1 className="text-[26px] font-black tracking-[-0.02em] text-slate-900 leading-tight">
            {isRTL ? "وجبات اليوم" : "Today's Meals"}
          </h1>
          <p className="mt-0.5 text-[13px] font-medium text-slate-400">
            {dailyNutrition.total > 0
              ? (isRTL
                ? `${dailyNutrition.completed}/${dailyNutrition.total} وجبات · ${dailyNutrition.calories.toLocaleString()} سعرة`
                : `${dailyNutrition.completed}/${dailyNutrition.total} meals · ${dailyNutrition.calories.toLocaleString()} kcal`)
              : noMealsText}
          </p>
        </div>

        {/* ── Row 3: Week navigation + day pills ── */}
        <div className="px-3 pb-3">
          <div className="flex items-center gap-1.5">
            {/* Prev week */}
            <button
              onClick={() => onWeekChange(isRTL ? addWeeks(currentWeekStart, 1) : subWeeks(currentWeekStart, 1))}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 active:scale-95 transition-all"
            >
              <ChevronLeft className="h-[16px] w-[16px] stroke-[2.5]" />
            </button>

            {/* Day pills */}
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
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className={`flex h-[52px] min-w-[40px] flex-1 flex-col items-center justify-center rounded-[14px] transition-all ${
                      isSelected
                        ? "bg-emerald-500 text-white shadow-[0_6px_16px_rgba(16,185,129,0.35)]"
                        : isTodayDate
                        ? "bg-slate-50 text-slate-900 ring-1 ring-slate-200"
                        : "bg-white text-slate-600 ring-1 ring-slate-100"
                    }`}
                  >
                    <span className={`text-[10px] font-bold ${isSelected ? "text-white/80" : "text-slate-400"}`}>
                      {dayName}
                    </span>
                    <span className={`text-[15px] font-extrabold tracking-tight ${isSelected ? "text-white" : isTodayDate ? "text-emerald-600" : "text-slate-800"}`}>
                      {format(day, "d")}
                    </span>
                    {/* Status dot */}
                    <span className={`mt-0.5 h-[3px] w-[12px] rounded-full ${
                      isSelected ? "bg-white/70" : dayStatus !== "empty" ? "bg-emerald-400" : "bg-transparent"
                    }`} />
                  </motion.button>
                );
              })}
            </div>

            {/* Next week */}
            <button
              onClick={() => onWeekChange(isRTL ? subWeeks(currentWeekStart, 1) : addWeeks(currentWeekStart, 1))}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 active:scale-95 transition-all"
            >
              <ChevronRight className="h-[16px] w-[16px] stroke-[2.5]" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ScheduleHeader;
