import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Leaf, ArrowLeft } from "lucide-react";
import { format, addDays, subWeeks, addWeeks, isSameDay, isToday } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatLocaleDate } from "@/lib/dateUtils";

interface ScheduleHeaderProps {
  currentWeekStart: Date; selectedDate: Date; weekDays: Date[];
  isUnlimited: boolean; remainingMeals: number; hasActiveSubscription: boolean; DAYS: string[];
  t: (key: string) => string; getDayStatus: (date: Date) => "empty" | "completed" | "partial" | "scheduled";
  onWeekChange: (start: Date) => void; onDateSelect: (date: Date) => void; onBack: () => void;
  dailyNutrition: { calories: number; protein: number; completed: number; total: number; };
}

const ScheduleHeader = ({ currentWeekStart, selectedDate, weekDays, isUnlimited, remainingMeals, hasActiveSubscription, DAYS, t, getDayStatus, onWeekChange, onDateSelect, onBack, dailyNutrition }: ScheduleHeaderProps) => {
  const { language, isRTL } = useLanguage();
  const weekRange = `${formatLocaleDate(currentWeekStart, language, { month: "short", day: "numeric" })} — ${formatLocaleDate(addDays(currentWeekStart, 6), language, { month: "short", day: "numeric", year: "numeric" })}`;

  return (
    <div className="sticky top-0 z-20">
      <div className="mx-auto w-full max-w-[430px] px-4 pt-3" style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}>
        <div className="rounded-[24px] bg-white ring-1 ring-slate-100 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between px-4 pt-4">
            <button
              onClick={onBack}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-800 active:scale-95"
              aria-label="Back"
            >
              <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={2.5} />
            </button>
            {hasActiveSubscription && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className={`flex h-8 min-w-[64px] items-center justify-center gap-1.5 rounded-full border px-3 text-[12px] font-extrabold backdrop-blur-sm ${
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
          </div>

          <div className="px-4 pb-2 pt-3" dir={isRTL ? "rtl" : "ltr"}>
            <p className="mb-1 text-[11px] font-extrabold uppercase tracking-[0.06em] text-slate-400">
              {isToday(selectedDate) ? t("today") : formatLocaleDate(selectedDate, language, { weekday: "long" })}
            </p>
            <h1 className="text-[22px] font-black tracking-[-0.02em] text-slate-900">
              {isToday(selectedDate)
                ? t("today_meals")
                : formatLocaleDate(selectedDate, language, { weekday: "long", month: "long", day: "numeric" })}
            </h1>
            <div className="mt-2 flex items-center gap-2">
              <div className="flex h-[24px] items-center gap-1.5 rounded-full bg-slate-50 px-2.5 text-[11px] font-bold text-slate-600 ring-1 ring-slate-200">
                <span>
                  {dailyNutrition.total > 0
                    ? `${dailyNutrition.completed}/${dailyNutrition.total} meals`
                    : t("meals_no_meals_scheduled")}
                </span>
              </div>
              {dailyNutrition.total > 0 && (
                <div className="flex h-[24px] items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-200">
                  <span>{dailyNutrition.calories.toLocaleString()} kcal</span>
                </div>
              )}
              <div className="ml-auto text-[11px] font-semibold text-slate-400">{weekRange}</div>
            </div>
          </div>

          <div className="px-2 pb-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => onWeekChange(subWeeks(currentWeekStart, 1))}
                className="ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 active:scale-95"
              >
                <ChevronLeft className="h-[16px] w-[16px] stroke-[2.5]" />
              </button>

              <div className="no-scrollbar -mx-1 flex flex-1 items-center gap-2 overflow-x-auto px-1">
                {weekDays.map((day, index) => {
                  const isSelected = isSameDay(day, selectedDate);
                  const isTodayDate = isToday(day);
                  const dayStatus = getDayStatus(day);
                  return (
                    <motion.button
                      key={day.toISOString()}
                      onClick={() => onDateSelect(day)}
                      whileTap={{ scale: 0.93 }}
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className={`flex h-[46px] min-w-[54px] flex-col items-center justify-center rounded-[14px] ring-1 transition-all ${
                        isSelected
                          ? "bg-emerald-500 text-white ring-emerald-500 shadow-[0_8px_18px_rgba(16,185,129,0.35)]"
                          : isTodayDate
                          ? "bg-slate-50 text-slate-900 ring-slate-200"
                          : "bg-white text-slate-700 ring-slate-200"
                      }`}
                    >
                      <span className={`text-[11px] font-extrabold ${isSelected ? "text-white/90" : "text-slate-400"}`}>
                        {DAYS[day.getDay()]}
                      </span>
                      <span className={`text-[14px] font-extrabold tracking-[-0.03em] ${isSelected ? "text-white" : "text-inherit"}`}>
                        {format(day, "d")}
                      </span>
                      <span
                        className={`mt-0.5 h-[3px] w-[14px] rounded-full ${
                          isSelected ? "bg-white/80" : dayStatus !== "empty" ? "bg-emerald-500/80" : "bg-slate-200"
                        }`}
                      />
                    </motion.button>
                  );
                })}
              </div>

              <button
                onClick={() => onWeekChange(addWeeks(currentWeekStart, 1))}
                className="mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 active:scale-95"
              >
                <ChevronRight className="h-[16px] w-[16px] stroke-[2.5]" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScheduleHeader;
