import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, Flame, Utensils } from "lucide-react";
import { addWeeks, format, isSameDay, isToday, subWeeks } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";

interface ScheduleHeaderProps {
  currentWeekStart: Date;
  selectedDate: Date;
  weekDays: Date[];
  isUnlimited: boolean;
  remainingMeals: number;
  hasActiveSubscription: boolean;
  DAYS: string[];
  t: (key: string) => string;
  getDayStatus: (date: Date) => "empty" | "completed" | "partial" | "scheduled";
  onWeekChange: (start: Date) => void;
  onDateSelect: (date: Date) => void;
  onBack: () => void;
  dailyNutrition: { calories: number; protein: number; completed: number; total: number };
}

const ScheduleHeader = ({
  currentWeekStart,
  selectedDate,
  weekDays,
  isUnlimited,
  remainingMeals,
  hasActiveSubscription,
  DAYS,
  t,
  getDayStatus,
  onWeekChange,
  onDateSelect,
  onBack,
  dailyNutrition,
}: ScheduleHeaderProps) => {
  const { isRTL } = useLanguage();
  const reduceMotion = useReducedMotion();
  const weekRange = `${format(weekDays[0], "MMM d")} - ${format(weekDays[6], "MMM d")}`;
  const mealsLeft = isUnlimited ? "∞" : Math.max(remainingMeals, 0).toLocaleString();

  return (
    <header
      className="sticky top-0 z-20 border-b border-[#E5EAF1] bg-[#F6F8FB]/92 backdrop-blur-2xl"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      dir={isRTL ? "rtl" : "ltr"}
    >
      <div className="mx-auto w-full max-w-[430px] px-4 pb-3 pt-3">
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#020617] shadow-sm ring-1 ring-[#E5EAF1] active:scale-95"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={2.5} />
          </button>

          <div className="text-center">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#7C83F6]">
              {isRTL ? "الجدولة" : "Schedule"}
            </p>
            <p className="text-[15px] font-black text-[#020617]">{weekRange}</p>
          </div>

          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#020617] shadow-sm ring-1 ring-[#E5EAF1]">
            <CalendarDays className="h-5 w-5" strokeWidth={2.4} />
          </div>
        </div>

        <motion.div
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mt-4 rounded-[28px] bg-white p-4 shadow-[0_16px_38px_rgba(2,6,23,0.07)] ring-1 ring-[#E5EAF1]"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[12px] font-extrabold uppercase tracking-[0.12em] text-[#22C7A1]">
                {isToday(selectedDate) ? t("today") : format(selectedDate, "EEEE")}
              </p>
              <h1 className="mt-1 text-[28px] font-black leading-none tracking-normal text-[#020617]">
                {isRTL ? "وجبات اليوم" : "Today's meals"}
              </h1>
            </div>
            {hasActiveSubscription && (
              <div className="rounded-[18px] bg-[#EFFFFA] px-3 py-2 text-center ring-1 ring-[#22C7A1]/20">
                <p className="text-[20px] font-black leading-none text-[#020617]">{mealsLeft}</p>
                <p className="mt-1 text-[9px] font-extrabold uppercase tracking-[0.08em] text-[#22C7A1]">left</p>
              </div>
            )}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="flex min-h-[94px] flex-col items-center justify-center rounded-[18px] bg-[#F6F8FB] p-3 text-center ring-1 ring-[#E5EAF1]">
              <Utensils className="mb-2 h-4 w-4 text-[#22C7A1]" />
              <p className="w-full text-[20px] font-black tabular-nums text-[#020617]">{dailyNutrition.total}</p>
              <p className="w-full text-[10px] font-bold uppercase tracking-[0.08em] text-[#94A3B8]">meals</p>
            </div>
            <div className="flex min-h-[94px] flex-col items-center justify-center rounded-[18px] bg-[#FFF7ED] p-3 text-center ring-1 ring-[#F97316]/20">
              <Flame className="mb-2 h-4 w-4 text-[#F97316]" />
              <p className="w-full text-[20px] font-black tabular-nums text-[#020617]">{dailyNutrition.calories.toLocaleString()}</p>
              <p className="w-full text-[10px] font-bold uppercase tracking-[0.08em] text-[#94A3B8]">kcal</p>
            </div>
            <div className="flex min-h-[94px] flex-col items-center justify-center rounded-[18px] bg-[#EFF9FF] p-3 text-center ring-1 ring-[#38BDF8]/20">
              <CalendarDays className="mb-2 h-4 w-4 text-[#38BDF8]" />
              <p className="w-full text-[20px] font-black tabular-nums text-[#020617]">{dailyNutrition.completed}/{dailyNutrition.total}</p>
              <p className="w-full text-[10px] font-bold uppercase tracking-[0.08em] text-[#94A3B8]">done</p>
            </div>
          </div>
        </motion.div>

        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={() => onWeekChange(isRTL ? addWeeks(currentWeekStart, 1) : subWeeks(currentWeekStart, 1))}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#020617] shadow-sm ring-1 ring-[#E5EAF1] active:scale-95"
            aria-label="Previous week"
          >
            {isRTL ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
          </button>

          <div className="-mx-1 flex flex-1 gap-1.5 overflow-x-auto px-1 pb-1 scrollbar-hide">
            {weekDays.map((day) => {
              const selected = isSameDay(day, selectedDate);
              const today = isToday(day);
              const status = getDayStatus(day);
              const dayName = isRTL ? ["أ", "إ", "ث", "أ", "خ", "ج", "س"][day.getDay()] : DAYS[day.getDay()];

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => onDateSelect(day)}
                  className={`flex h-[62px] min-w-[46px] flex-col items-center justify-center rounded-[18px] transition active:scale-95 ${
                    selected
                      ? "bg-[#020617] text-white shadow-[0_12px_26px_rgba(2,6,23,0.20)]"
                      : today
                        ? "bg-[#EFFFFA] text-[#020617] ring-1 ring-[#22C7A1]/20"
                        : "bg-white text-[#020617] ring-1 ring-[#E5EAF1]"
                  }`}
                >
                  <span className={`text-[10px] font-black uppercase ${selected ? "text-white/65" : "text-[#94A3B8]"}`}>{dayName}</span>
                  <span className="mt-1 text-[17px] font-black tabular-nums">{format(day, "d")}</span>
                  <span className={`mt-1 h-1.5 w-5 rounded-full ${selected ? "bg-white/75" : status !== "empty" ? "bg-[#22C7A1]" : "bg-transparent"}`} />
                </button>
              );
            })}
          </div>

          <button
            onClick={() => onWeekChange(isRTL ? subWeeks(currentWeekStart, 1) : addWeeks(currentWeekStart, 1))}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#020617] shadow-sm ring-1 ring-[#E5EAF1] active:scale-95"
            aria-label="Next week"
          >
            {isRTL ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
          </button>
        </div>
      </div>
    </header>
  );
};

export default ScheduleHeader;
