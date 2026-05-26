import { motion } from "framer-motion";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Leaf,
} from "lucide-react";
import { format, addDays, subWeeks, addWeeks, isSameDay, isToday } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatLocaleDate } from "@/lib/dateUtils";

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
  onJumpToToday: () => void;
  onBack: () => void;
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
}: ScheduleHeaderProps) => {
  const { language } = useLanguage();

  const getMarkerClass = (index: number, dayStatus: "empty" | "completed" | "partial" | "scheduled", selected: boolean) => {
    if (selected) return "bg-emerald-300/70";
    if (dayStatus !== "empty" || index >= 4) return "bg-[#00AE78]";
    return "bg-slate-300";
  };

  return (
    <div className="sticky top-0 z-20 border-b border-[#E8ECF2] bg-[#FCFCFB]/95 backdrop-blur-xl safe-top">
      <div className="mx-auto max-w-[432px] px-[18px] pb-[17px] pt-[17px]">
        <div className="relative flex h-[48px] items-start justify-center">
          <button
            onClick={onBack}
            className="absolute left-0 top-0 flex h-[36px] w-[36px] cursor-pointer items-center justify-center rounded-full bg-white text-[#071428] shadow-[0_12px_28px_rgba(15,23,42,0.10)] transition-all active:scale-95"
          >
            <ChevronLeft className="h-[18px] w-[18px] stroke-[3]" />
          </button>

          <div className="text-center">
            <h1 className="text-[18px] font-black leading-[22px] tracking-[-0.04em] text-[#071428]">{t("my_schedule")}</h1>
            <p className="mt-[6px] inline-flex items-center gap-1 text-[12px] font-bold leading-none text-[#808A9C]">
              {formatLocaleDate(currentWeekStart, language, { month: "short", day: "numeric" })} — {formatLocaleDate(addDays(currentWeekStart, 6), language, { month: "short", day: "numeric", year: "numeric" })}
              <ChevronDown className="h-[12px] w-[12px] stroke-[3]" />
            </p>
          </div>

          {hasActiveSubscription && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={`absolute right-0 top-[4px] flex h-[28px] min-w-[58px] items-center justify-center gap-[7px] rounded-full px-[13px] text-[13px] font-black text-white shadow-[0_13px_24px_rgba(0,174,120,0.28)] ${
                isUnlimited
                  ? "bg-gradient-to-r from-[#11C884] to-[#03A96E]"
                  : remainingMeals <= 0
                  ? "bg-gradient-to-r from-red-400 to-rose-500"
                  : remainingMeals <= 3
                  ? "bg-gradient-to-r from-amber-400 to-orange-500"
                  : "bg-gradient-to-r from-[#11C884] to-[#03A96E]"
              }`}
            >
              <Leaf className="h-[15px] w-[15px] stroke-[2.5]" />
              <span>{isUnlimited ? "∞" : remainingMeals}</span>
            </motion.div>
          )}
        </div>

        <div className="mt-[27px] flex items-center gap-[18px]">
          <button
            onClick={() => onWeekChange(subWeeks(currentWeekStart, 1))}
            className="flex h-[36px] w-[36px] shrink-0 cursor-pointer items-center justify-center rounded-full bg-white text-[#071428] shadow-[0_12px_28px_rgba(15,23,42,0.10)] transition-all active:scale-95"
          >
            <ChevronLeft className="h-[18px] w-[18px] stroke-[3]" />
          </button>

          <div className="flex flex-1 items-center justify-between">
            {weekDays.map((day, index) => {
              const isSelected = isSameDay(day, selectedDate);
              const isTodayDate = isToday(day);
              const dayStatus = getDayStatus(day);
              return (
                <motion.button
                  key={day.toISOString()}
                  onClick={() => onDateSelect(day)}
                  whileTap={{ scale: 0.85 }}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className={`relative flex h-[58px] w-[36px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-full transition-all ${
                    isSelected
                      ? "bg-gradient-to-b from-[#11C884] to-[#04A96F] shadow-[0_14px_28px_rgba(0,174,120,0.30)]"
                      : isTodayDate
                      ? "bg-white"
                      : "bg-transparent active:bg-slate-50"
                  }`}
                >
                  {isSelected && (
                    <motion.div
                      layoutId="selectedDayBg"
                      className="absolute inset-0 bg-gradient-to-b from-[#11C884] to-[#04A96F]"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                    />
                  )}
                  <span className={`relative z-10 mb-[6px] text-[12px] font-black leading-none ${
                    isSelected ? "text-white/90" : "text-[#7E899B]"
                  }`}>
                    {DAYS[day.getDay()]}
                  </span>
                  <span className={`relative z-10 text-[15px] font-black leading-none tracking-[-0.03em] ${
                    isSelected ? "text-white" : isTodayDate ? "text-[#071428]" : "text-[#071428]"
                  }`}>
                    {format(day, "d")}
                  </span>
                  <span className={`relative z-10 mt-[8px] h-[3px] w-[3px] rounded-full ${getMarkerClass(index, dayStatus, isSelected)}`} />
                </motion.button>
              );
            })}
          </div>

          <button
            onClick={() => onWeekChange(addWeeks(currentWeekStart, 1))}
            className="flex h-[36px] w-[36px] shrink-0 cursor-pointer items-center justify-center rounded-full bg-white text-[#071428] shadow-[0_12px_28px_rgba(15,23,42,0.10)] transition-all active:scale-95"
          >
            <ChevronRight className="h-[18px] w-[18px] stroke-[3]" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScheduleHeader;
