import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, Flame, Utensils } from "lucide-react";
import { addWeeks, format, isSameDay, isToday, subWeeks } from "date-fns";

import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

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
  const weekRange = `${format(weekDays[0], "MMM d")} - ${format(weekDays[6], "MMM d")}`;
  const selectedDayLabel = isToday(selectedDate) ? t("today") : format(selectedDate, "EEEE");
  const mealsLeft = isUnlimited ? "∞" : Math.max(remainingMeals, 0).toLocaleString();

  return (
    <header
      className="sticky top-0 z-30 border-b border-[#E5EAF1] bg-white/95 backdrop-blur-xl"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      dir={isRTL ? "rtl" : "ltr"}
    >
      <div className="mx-auto w-full max-w-[430px] px-4 pb-3 pt-2">
        <div className="flex h-12 items-center justify-between">
          <button
            onClick={onBack}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F6F8FB] text-[#020617] ring-1 ring-[#E5EAF1] active:scale-95"
            aria-label="Back"
          >
            <ArrowLeft className={cn("h-5 w-5", isRTL && "rotate-180")} strokeWidth={2.4} />
          </button>

          <div className="text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#7C83F6]">Meal schedule</p>
            <h1 className="mt-0.5 text-[17px] font-black text-[#020617]">{selectedDayLabel}</h1>
          </div>

          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F3F4FF] text-[#7C83F6] ring-1 ring-[#7C83F6]/15">
            <CalendarDays className="h-5 w-5" strokeWidth={2.3} />
          </span>
        </div>

        <div className="mt-2 flex items-center justify-between px-1">
          <button
            onClick={() => onWeekChange(isRTL ? addWeeks(currentWeekStart, 1) : subWeeks(currentWeekStart, 1))}
            className="flex h-9 w-9 items-center justify-center rounded-full text-[#64748B] active:bg-[#F6F8FB]"
            aria-label="Previous week"
          >
            {isRTL ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
          </button>
          <p className="text-[12px] font-extrabold text-[#64748B]">{weekRange}</p>
          <button
            onClick={() => onWeekChange(isRTL ? subWeeks(currentWeekStart, 1) : addWeeks(currentWeekStart, 1))}
            className="flex h-9 w-9 items-center justify-center rounded-full text-[#64748B] active:bg-[#F6F8FB]"
            aria-label="Next week"
          >
            {isRTL ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
          </button>
        </div>

        <div className="mt-1 grid grid-cols-7 gap-1.5">
          {weekDays.map((day) => {
            const selected = isSameDay(day, selectedDate);
            const today = isToday(day);
            const status = getDayStatus(day);
            const dayName = DAYS[day.getDay()];

            return (
              <button
                key={day.toISOString()}
                onClick={() => onDateSelect(day)}
                className={cn(
                  "relative flex h-[58px] min-w-0 flex-col items-center justify-center rounded-[16px] transition active:scale-95",
                  selected
                    ? "bg-[#020617] text-white shadow-[0_9px_20px_rgba(2,6,23,0.18)]"
                    : today
                      ? "bg-[#E9FBF6] text-[#020617] ring-1 ring-[#22C7A1]/20"
                      : "bg-[#F6F8FB] text-[#020617]",
                )}
              >
                <span className={cn("text-[9px] font-black uppercase", selected ? "text-white/60" : "text-[#94A3B8]")}>{dayName}</span>
                <span className="mt-1 text-[16px] font-black tabular-nums">{format(day, "d")}</span>
                <span
                  className={cn(
                    "absolute bottom-1.5 h-1 w-1 rounded-full",
                    selected && status !== "empty"
                      ? "bg-[#22C7A1]"
                      : status === "completed"
                        ? "bg-[#22C7A1]"
                        : status === "partial"
                          ? "bg-[#FB6B7A]"
                          : status === "scheduled"
                            ? "bg-[#7C83F6]"
                            : "bg-transparent",
                  )}
                />
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex items-center gap-2 overflow-hidden rounded-[15px] bg-[#F6F8FB] px-3 py-2.5 ring-1 ring-[#E5EAF1]">
          <span className="inline-flex min-w-0 items-center gap-1.5 text-[11px] font-extrabold text-[#64748B]">
            <Utensils className="h-3.5 w-3.5 text-[#22C7A1]" />
            {dailyNutrition.total} planned
          </span>
          <span className="h-4 w-px bg-[#DDE5EF]" />
          <span className="inline-flex min-w-0 items-center gap-1.5 text-[11px] font-extrabold text-[#64748B]">
            <Flame className="h-3.5 w-3.5 text-[#FB6B7A]" />
            {dailyNutrition.calories.toLocaleString()} kcal
          </span>
          {hasActiveSubscription ? (
            <span className="ml-auto shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-[#22C7A1] ring-1 ring-[#E5EAF1]">
              {mealsLeft} left
            </span>
          ) : null}
        </div>
      </div>
    </header>
  );
};

export default ScheduleHeader;
