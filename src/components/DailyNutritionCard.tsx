import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Flame, Plus, Calendar, Utensils, Droplets, Activity } from "lucide-react";
import { NavChevronLeft, NavChevronRight } from "@/components/ui/nav-chevron";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { LogActivitySheet } from "@/components/LogActivitySheet";

interface DailyNutritionCardProps {
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  focusCalories: number;
  targetProtein?: number;
  targetCarbs?: number;
  targetFat?: number;
  dayLabel?: string;
  burnedWalking?: number;
  burnedActivity?: number;
  onDateChange?: (date: Date) => void;
}

const MacroCard = ({
  value,
  max,
  label,
  icon,
  ringColor,
  bgClass,
  textClass,
}: {
  value: number;
  max: number;
  label: string;
  icon: React.ReactNode;
  ringColor: string;
  bgClass: string;
  textClass: string;
}) => {
  const pct = Math.min(Math.round((value / (max || 1)) * 100), 999);
  const isOver = value > max;
  const r = 18;
  const circ = 2 * Math.PI * r;
  const displayPct = Math.min(pct, 100);
  const offset = circ - (displayPct / 100) * circ;

  return (
    <motion.div
      initial={{ y: 12, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4 }}
      className={`flex-1 min-w-0 rounded-2xl p-2.5 sm:p-3.5 ${bgClass} relative overflow-hidden`}
    >
      {isOver && (
        <div className="absolute top-1.5 right-1.5 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-red-500 flex items-center justify-center">
          <span className="text-white text-[9px] sm:text-[10px] font-bold">!</span>
        </div>
      )}

      <div className="flex items-start justify-between mb-1.5 sm:mb-2">
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white/80 flex items-center justify-center shadow-sm">
          {icon}
        </div>
        <div className="relative w-9 h-9 sm:w-11 sm:h-11">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 44 44">
            <circle cx="22" cy="22" r={r} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="3.5" />
            <motion.circle
              cx="22" cy="22" r={r} fill="none"
              stroke={isOver ? "#ef4444" : ringColor}
              strokeWidth="3.5" strokeLinecap="round"
              strokeDasharray={circ}
              initial={{ strokeDashoffset: circ }}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[8px] sm:text-[10px] font-bold text-white">{value}g</span>
          </div>
        </div>
      </div>

      <p className={`text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide ${textClass} opacity-80`}>
        {label}
      </p>
      <p className={`text-lg sm:text-2xl font-black ${textClass} leading-none mt-0.5`}>
        {value}g
      </p>
      <div className="flex items-center justify-end gap-1 sm:gap-2 mt-1">
        <span className="text-[10px] sm:text-[11px] font-bold text-black/60">/{max}g</span>
        {isOver ? (
          <span className="text-[9px] sm:text-[10px] font-bold text-white bg-red-600 px-1 sm:px-1.5 py-0.5 rounded-full whitespace-nowrap">
            Over Goal
          </span>
        ) : (
          <span className="text-[9px] sm:text-[10px] font-bold text-black/60 bg-black/10 px-1 sm:px-1.5 py-0.5 rounded-full">
            {pct}%
          </span>
        )}
      </div>
    </motion.div>
  );
};

export const DailyNutritionCard: React.FC<DailyNutritionCardProps> = ({
  totalCalories,
  totalProtein,
  totalCarbs,
  totalFat,
  focusCalories,
  targetProtein = 128,
  targetCarbs = 224,
  targetFat = 64,
  onDateChange,
}) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [totalBurned, setTotalBurned] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const isToday = selectedDate >= todayStart;
  const todayStr = format(selectedDate, "yyyy-MM-dd");

  const goToPrevDay = () => {
    const prev = new Date(selectedDate);
    prev.setDate(prev.getDate() - 1);
    setSelectedDate(prev);
    onDateChange?.(prev);
  };

  const goToNextDay = () => {
    if (isToday) return;
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + 1);
    setSelectedDate(next);
    onDateChange?.(next);
  };

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("workout_sessions")
        .select("calories_burned")
        .eq("user_id", user.id)
        .eq("session_date", todayStr);
      if (data) {
        setTotalBurned(data.reduce((sum, s) => sum + (s.calories_burned ?? 0), 0));
      }
    };
    load();
  }, [user, todayStr]);

  const calLeft = Math.max(0, focusCalories - totalCalories + totalBurned);
  const dateLabel = format(selectedDate, "EEE, MMM d");
  const remainingPct = Math.min((calLeft / (focusCalories || 1)) * 100, 100);

  const R = 62;
  const circ = 2 * Math.PI * R;
  const offset = circ - (remainingPct / 100) * circ;

  const ringColor =
    remainingPct > 50 ? "#f97316" :
    remainingPct > 20 ? "#fb923c" :
    "#ef4444";

  return (
    <>
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <div className="rounded-3xl overflow-hidden border border-gray-100" style={{
          background: "#ffffff",
          boxShadow: "0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)",
        }}>

          {/* Date navigation */}
          <div className="flex items-center justify-between px-3 sm:px-5 py-3 sm:py-4">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Calendar className="w-4 h-4 text-gray-500" />
              <span className="font-bold text-gray-700 text-[13px] sm:text-sm">{dateLabel}</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                onClick={goToPrevDay}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-all active:scale-95 border border-gray-200 bg-white"
                style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
              >
                <NavChevronLeft className="w-4 h-4 text-gray-500" />
              </button>
              <button
                onClick={goToNextDay}
                disabled={isToday}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-all active:scale-95 disabled:opacity-30 border border-gray-200 bg-white"
                style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
              >
                <NavChevronRight className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Calorie hero section */}
          <div className="mx-3 sm:mx-4 mb-3 sm:mb-4 rounded-2xl px-3 sm:px-5 py-4 sm:py-5 flex items-center justify-between border border-gray-100" style={{
            background: "#f8f9fb",
            boxShadow: "inset 0 2px 6px rgba(0,0,0,0.04)",
          }}>
            {/* Nutrition consumed */}
            <div className="flex flex-col items-start gap-0.5 sm:gap-1 min-w-0 flex-shrink-0">
              <span className="text-[10px] sm:text-[11px] text-gray-500 font-medium">{t("nutrition_eaten")}</span>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <motion.span
                  className="text-2xl sm:text-3xl font-black text-gray-800 leading-none"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  {totalCalories}
                </motion.span>
                <Utensils className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
              </div>
              <span className="text-[10px] sm:text-xs text-gray-400">{t("nutrition_cal")}</span>
            </div>

            {/* Central ring */}
            <div className="relative w-28 h-28 sm:w-36 sm:h-36 mx-1 sm:mx-2 flex-shrink-0">
              <div className="absolute inset-0 rounded-full border border-gray-200" style={{
                background: "#f3f4f6",
                boxShadow: "0 4px 12px rgba(0,0,0,0.08), inset 0 1px 2px rgba(255,255,255,0.8)",
              }} />
              <div className="absolute inset-[5px] sm:inset-[6px] rounded-full bg-white border border-gray-100" style={{
                boxShadow: "inset 0 2px 6px rgba(0,0,0,0.05)",
              }}>
                <svg className="w-full h-full -rotate-90" viewBox="0 0 140 140">
                  <circle cx="70" cy="70" r={R} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="10" />
                  <motion.circle
                    cx="70" cy="70" r={R} fill="none"
                    stroke={ringColor} strokeWidth="10" strokeLinecap="round"
                    strokeDasharray={circ}
                    initial={{ strokeDashoffset: circ }}
                    animate={{ strokeDashoffset: offset }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    style={{ filter: "drop-shadow(0 2px 4px rgba(249,115,22,0.3))" }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <motion.span
                    className="text-xl sm:text-2xl font-black text-gray-900 leading-none"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3 }}
                  >
                    {calLeft}
                  </motion.span>
                  <span className="text-[9px] sm:text-[10px] font-bold text-orange-500 mt-0.5 uppercase tracking-wide">
                    {t("nutrition_cal_left")}
                  </span>
                  <span className="text-[8px] sm:text-[9px] text-gray-400 mt-0.5">
                    {Math.round(remainingPct)}% Remaining
                  </span>
                </div>
              </div>
            </div>

            {/* Daily burned */}
            <div className="flex flex-col items-end gap-0.5 sm:gap-1 min-w-0 flex-shrink-0">
              <span className="text-[10px] sm:text-[11px] text-gray-500 font-medium">{t("nutrition_burned")}</span>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="text-xl sm:text-2xl">🔥</span>
                <motion.span
                  className="text-2xl sm:text-3xl font-black text-gray-800 leading-none"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  {totalBurned}
                </motion.span>
              </div>
              <span className="text-[10px] sm:text-xs text-gray-400">{t("nutrition_cal")}</span>
            </div>
          </div>

          {/* Macro cards */}
          <div className="px-3 sm:px-4 pb-3 sm:pb-4 flex gap-2 sm:gap-2.5">
            <MacroCard
              value={totalCarbs} max={targetCarbs} label={t("macro_carbs")}
              icon={<span className="text-sm">🌾</span>}
              ringColor="#ffffff"
              bgClass="bg-gradient-to-br from-amber-400 to-yellow-500"
              textClass="text-white"
            />
            <MacroCard
              value={totalProtein} max={targetProtein} label={t("macro_protein")}
              icon={<span className="text-sm">💪</span>}
              ringColor="#ffffff"
              bgClass="bg-gradient-to-br from-orange-400 to-orange-500"
              textClass="text-white"
            />
            <MacroCard
              value={totalFat} max={targetFat} label={t("macro_fat")}
              icon={<span className="text-sm">🥑</span>}
              ringColor={totalFat > targetFat ? "#ef4444" : "#ffffff"}
              bgClass="bg-gradient-to-br from-slate-500 to-slate-600"
              textClass="text-white"
            />
          </div>

          {/* Activity details */}
          <div className="px-3 sm:px-4 pb-3 sm:pb-4">
            <p className="text-[10px] sm:text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Activity Details
            </p>
            <div className="flex items-center gap-2 sm:gap-2.5">
              <div className="flex-1 min-w-0 rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3 flex items-center gap-2 sm:gap-3 border border-gray-100 bg-gray-50">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-orange-400 to-orange-500 flex items-center justify-center shadow-sm flex-shrink-0">
                  <Flame className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] sm:text-[10px] text-gray-400 font-medium truncate">{t("nutrition_total_burned")}</p>
                  <p className="text-base sm:text-lg font-black text-gray-800 leading-none">{totalBurned} Cal</p>
                </div>
              </div>

              <div className="flex-1 min-w-0 rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3 flex items-center gap-2 sm:gap-3 border border-gray-100 bg-gray-50">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-500 flex items-center justify-center shadow-sm flex-shrink-0">
                  <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] sm:text-[10px] text-gray-400 font-medium truncate">Activities</p>
                  <p className="text-base sm:text-lg font-black text-gray-800 leading-none">{totalBurned} cal</p>
                </div>
              </div>

              <button
                onClick={() => setSheetOpen(true)}
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform bg-gradient-to-br from-emerald-400 to-emerald-500 shadow-lg shadow-emerald-500/30"
              >
                <Plus className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      <LogActivitySheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onBurnedUpdate={setTotalBurned}
      />
    </>
  );
};
