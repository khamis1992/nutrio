import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Flame, Plus, Calendar } from "lucide-react";
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
}

const MacroRing = ({
  value,
  max,
  label,
  color,
}: {
  value: number;
  max: number;
  label: string;
  color: string;
}) => {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const pct = Math.min((value / (max || 1)) * 100, 100);
  const offset = circ - (pct / 100) * circ;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-16 h-16">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r={r} fill="none" stroke="#f1f5f9" strokeWidth="5" />
          <motion.circle
            cx="32"
            cy="32"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold text-gray-800">{value}</span>
        </div>
      </div>
      <span className="text-[11px] text-gray-400">/ {max}g</span>
      <span className="text-xs font-semibold text-gray-600">{label}</span>
    </div>
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
}) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [totalBurned, setTotalBurned] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const todayStr = format(new Date(), "yyyy-MM-dd");

  // Load today's total burned calories on mount
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
  const today = format(new Date(), "EEE, MMM d");

  // Main ring geometry — shows calories REMAINING (starts full, depletes as you eat)
  const R = 68;
  const circ = 2 * Math.PI * R;
  const remainingPct = Math.min((calLeft / (focusCalories || 1)) * 100, 100);
  const offset = circ - (remainingPct / 100) * circ;

  // Ring color shifts green → orange → red as budget runs out
  const ringColor =
    remainingPct > 50 ? "hsl(var(--primary))" :
    remainingPct > 20 ? "#f97316" :
    "#ef4444";

  return (
    <>
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <div className="bg-white rounded-3xl shadow-sm overflow-hidden">

          {/* ── Date navigation row ── */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <button className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
              <ChevronLeft className="w-5 h-5 text-gray-400" />
            </button>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-800">{today}</span>
              <Calendar className="w-4 h-4 text-gray-400" />
            </div>
            <button className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* ── Calorie ring row ── */}
          <div className="flex items-center justify-between px-6 py-5">
            {/* Eaten */}
            <div className="flex flex-col items-center gap-0.5 min-w-[60px]">
              <span className="text-xs text-gray-400 font-medium">{t("nutrition_eaten")}</span>
              <motion.span
                className="text-2xl font-bold text-gray-800"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                {totalCalories}
              </motion.span>
              <span className="text-xs text-gray-400">{t("nutrition_cal")}</span>
            </div>

            {/* Big ring */}
            <div className="relative w-40 h-40">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 160 160">
                <circle cx="80" cy="80" r={R} fill="none" stroke="#f1f5f9" strokeWidth="12" />
                <motion.circle
                  cx="80"
                  cy="80"
                  r={R}
                  fill="none"
                  stroke={ringColor}
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={circ}
                  initial={{ strokeDashoffset: circ }}
                  animate={{ strokeDashoffset: offset }}
                  transition={{ duration: 1, ease: "easeOut" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <motion.span
                  className="text-3xl font-black text-gray-900 leading-none"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  {calLeft}
                </motion.span>
                <span className="text-xs text-gray-400 mt-1">{t("nutrition_cal_left")}</span>
              </div>
            </div>

            {/* Burned */}
            <div className="flex flex-col items-center gap-0.5 min-w-[60px]">
              <div className="flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-orange-400" />
                <span className="text-xs text-gray-400 font-medium">{t("nutrition_burned")}</span>
              </div>
              <motion.span
                className="text-2xl font-bold text-gray-800"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                {totalBurned}
              </motion.span>
              <span className="text-xs text-gray-400">{t("nutrition_cal")}</span>
            </div>
          </div>

          {/* ── Macro circles ── */}
          <div className="px-5 pb-4">
            <p className="text-xs text-gray-400 font-medium mb-4">{t("nutrition_eaten")}</p>
            <div className="flex justify-around">
              <MacroRing value={totalCarbs}   max={targetCarbs}   label={t("macro_carbs")}   color="#eab308" />
              <MacroRing value={totalProtein} max={targetProtein} label={t("macro_protein")} color="#f97316" />
              <MacroRing value={totalFat}     max={targetFat}     label={t("macro_fat")}     color="#94a3b8" />
            </div>
          </div>

          {/* ── Burned section ── */}
          <div className="px-5 pb-5 border-t border-gray-100">
            <p className="text-xs text-gray-400 font-medium mt-4 mb-3">{t("nutrition_burned")}</p>
            <div className="flex items-center gap-3">
              {/* Total burned summary */}
              <div className="flex-1 bg-gray-50 rounded-2xl p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center">
                  <Flame className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-[11px] text-gray-400">{t("nutrition_total_burned")}</p>
                  <p className="text-base font-bold text-gray-800 leading-none">{totalBurned}</p>
                  <p className="text-[10px] text-gray-400">
                    {totalBurned > 0 
                      ? t("nutrition_cal_from_activities") 
                      : t("nutrition_no_activities")}
                  </p>
                </div>
              </div>

              {/* Open activity logger */}
              <button
                onClick={() => setSheetOpen(true)}
                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm active:scale-95 transition-transform gradient-primary"
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
