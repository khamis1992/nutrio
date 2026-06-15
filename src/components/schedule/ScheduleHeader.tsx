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
}

const ScheduleHeader = ({ currentWeekStart, selectedDate, weekDays, isUnlimited, remainingMeals, hasActiveSubscription, DAYS, t, getDayStatus, onWeekChange, onDateSelect, onBack }: ScheduleHeaderProps) => {
  const { language } = useLanguage();

  const getMarkerClass = (dayStatus: "empty" | "completed" | "partial" | "scheduled", selected: boolean) => {
    if (selected) return "bg-emerald-300/70";
    if (dayStatus !== "empty") return "bg-emerald-400";
    return "bg-white/30";
  };

  return (
    <div className="sticky top-0 z-20">
      <div className="mx-auto w-full max-w-[430px] overflow-hidden">

        {/* ── Gradient Banner ── */}
        <div
          className="relative overflow-hidden"
          style={{
            background: "linear-gradient(135deg, #064e3b 0%, #065f46 50%, #059669 100%)",
            paddingTop: "env(safe-area-inset-top, 0px)",
          }}
        >
          {/* Illustration background */}
          <img
            src="/schedule-header-illustration.png"
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
            style={{ opacity: 0.18, mixBlendMode: "luminosity" }}
          />

          {/* Ambient glow circles */}
          <div className="pointer-events-none absolute -right-12 -top-12 h-[180px] w-[180px] rounded-full" style={{ background: "radial-gradient(circle, rgba(52,211,153,0.25) 0%, transparent 70%)" }} />
          <div className="pointer-events-none absolute -bottom-8 -left-8 h-[140px] w-[140px] rounded-full" style={{ background: "radial-gradient(circle, rgba(16,185,129,0.18) 0%, transparent 70%)" }} />

          <div className="relative z-10 px-5 pt-5 pb-0">
            {/* Top row: back + badge */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={onBack}
                className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/15 text-white backdrop-blur-sm transition active:scale-95"
                aria-label="Back"
              >
                <ArrowLeft className="h-[20px] w-[20px]" strokeWidth={2.5} />
              </button>

              {hasActiveSubscription && (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className={`flex h-8 min-w-[60px] items-center justify-center gap-1.5 rounded-full border border-white/20 bg-white/15 px-3 text-[12px] font-extrabold text-white backdrop-blur-sm shadow-[0_4px_12px_rgba(0,0,0,0.15)] ${
                    remainingMeals <= 0 && !isUnlimited ? "!bg-red-500/80 !border-red-300/40" : remainingMeals <= 3 && !isUnlimited ? "!bg-amber-500/80 !border-amber-300/40" : ""
                  }`}
                >
                  <Leaf className="h-[13px] w-[13px] stroke-[2.5]" />
                  <span>{isUnlimited ? "∞" : remainingMeals}</span>
                </motion.div>
              )}
            </div>

            {/* Title block */}
            <div className="mb-5">
              <h1 className="text-[30px] font-black leading-[1.1] tracking-[-0.03em] text-white">
                My{" "}
                <em className="not-italic text-emerald-300">{t("my_schedule")}</em>
              </h1>
              <p className="mt-1.5 text-[13px] font-medium text-white/65">
                {formatLocaleDate(currentWeekStart, language, { month: "short", day: "numeric" })}
                {" — "}
                {formatLocaleDate(addDays(currentWeekStart, 6), language, { month: "short", day: "numeric", year: "numeric" })}
              </p>
            </div>

            {/* Week days — floats on gradient */}
            <div className="-mx-5 rounded-t-[20px] bg-white px-4 pt-4 pb-3 shadow-[0_-8px_24px_rgba(0,0,0,0.15)]">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => onWeekChange(subWeeks(currentWeekStart, 1))}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 active:scale-95 transition"
                >
                  <ChevronLeft className="h-[16px] w-[16px] stroke-[2.5]" />
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
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.03 }}
                        className={`relative flex h-[54px] w-[36px] flex-col items-center justify-center overflow-hidden rounded-full transition-all ${
                          isSelected
                            ? "bg-emerald-500 shadow-[0_8px_20px_rgba(16,185,129,0.3)]"
                            : isTodayDate
                            ? "bg-slate-100 ring-1 ring-slate-200"
                            : "bg-transparent active:bg-slate-50"
                        }`}
                      >
                        {isSelected && (
                          <motion.div
                            layoutId="selectedDayBg"
                            className="absolute inset-0 bg-emerald-500"
                            transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                          />
                        )}
                        <span className={`relative z-10 mb-1.5 text-[11px] font-extrabold ${isSelected ? "text-white/90" : "text-slate-400"}`}>
                          {DAYS[day.getDay()]}
                        </span>
                        <span className={`relative z-10 text-[15px] font-extrabold tracking-[-0.03em] ${isSelected ? "text-white" : isTodayDate ? "text-slate-900" : "text-slate-700"}`}>
                          {format(day, "d")}
                        </span>
                        <span className={`relative z-10 mt-1.5 h-[4px] w-[4px] rounded-full ${
                          isSelected ? "bg-white/70" : dayStatus !== "empty" ? "bg-emerald-500" : "bg-slate-200"
                        }`} />
                      </motion.button>
                    );
                  })}
                </div>

                <button
                  onClick={() => onWeekChange(addWeeks(currentWeekStart, 1))}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 active:scale-95 transition"
                >
                  <ChevronRight className="h-[16px] w-[16px] stroke-[2.5]" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScheduleHeader;
