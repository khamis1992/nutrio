import { useNavigate } from "react-router-dom";
import { CalendarCheck, Droplet, Flame, Lock, Minus, Plus, Target } from "lucide-react";
import { format, subDays } from "date-fns";
import { formatLocaleDate } from "@/lib/dateUtils";
import { useAuth } from "@/contexts/AuthContext";
import { useNutritionGoals } from "@/hooks/useNutritionGoals";
import { useWeeklySummary } from "@/hooks/useWeeklySummary";
import { useStreak } from "@/hooks/useStreak";
import { useTodayProgress } from "@/hooks/useTodayProgress";
import { useWaterIntake } from "@/hooks/useWaterIntake";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useWeekdayData } from "@/hooks/useWeekdayData";
import { computeNutritionScore } from "@/lib/nutrition-score";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useRef, useEffect } from "react";

interface ProgressTodayTabProps {
  selectedDate: Date;
  calendarDate: string;
  setCalendarDate: (v: string) => void;
  showCalendar: boolean;
  setShowCalendar: (v: boolean | ((prev: boolean) => boolean)) => void;
}

export default function ProgressTodayTab({
  selectedDate,
  calendarDate,
  setCalendarDate,
  showCalendar,
  setShowCalendar,
}: ProgressTodayTabProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeGoal } = useNutritionGoals(user?.id);
  const { summary: weeklySummary } = useWeeklySummary(user?.id);
  const { streaks } = useStreak(user?.id);
  const { todayProgress } = useTodayProgress(user?.id, selectedDate, 0);
  const { dailySummary: waterSummary, addWater: addWaterIntake, decrementWater } = useWaterIntake(user?.id, selectedDate);
  const { days: weekdayData } = useWeekdayData(user?.id, activeGoal?.daily_calorie_target ?? 2000);
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const selectedCellRef = useRef<HTMLButtonElement>(null);

  const selectedDateKey = format(selectedDate, "yyyy-MM-dd");
  const isSelectedToday = selectedDateKey === format(new Date(), "yyyy-MM-dd");
  const waterGlasses = waterSummary?.total ?? 0;
  const waterTarget = waterSummary?.target ?? 8;

  const pagerDays = Array.from({ length: 7 }, (_, i) => {
    const d = subDays(selectedDate, 6 - i);
    const dateStr = format(d, "yyyy-MM-dd");
    const isSelected = dateStr === selectedDateKey;
    
    let status: "none" | "partial" | "logged" = "none";
    const calTarget = activeGoal?.daily_calorie_target ?? 2000;
    const dayCal = isSelected
      ? (todayProgress.calories ?? 0)
      : (weekdayData.find((wd) => wd.date === dateStr)?.calories ?? 0);
    if (dayCal > 0) {
      status = dayCal >= calTarget * 0.9 ? "logged" : "partial";
    }

    return {
      date: d,
      dateStr,
      dayLetter: formatLocaleDate(d, language, { weekday: "narrow" }),
      dayNum: format(d, "d"),
      isSelected,
      isToday: dateStr === format(new Date(), "yyyy-MM-dd"),
      status
    };
  });

  useEffect(() => {
    if (selectedCellRef.current) {
      selectedCellRef.current.scrollIntoView({ inline: "center", behavior: "smooth", block: "nearest" });
    }
  }, [selectedDateKey]);

  const handleWaterAdd = async () => {
    if (!user?.id) return;
    try {
      await addWaterIntake(1);
      toast({ description: t("progress_water_added"), duration: 1200 });
    } catch {
      toast({ description: t("failed_to_update"), variant: "destructive" });
    }
  };

  const handleWaterRemove = async () => {
    if (!user?.id || waterGlasses <= 0) return;
    const didDecrement = await decrementWater();
    if (!didDecrement) {
      toast({ description: t("failed_to_update"), variant: "destructive" });
      return;
    }
    toast({ description: t("progress_water_removed"), duration: 1200 });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, staggerChildren: 0.1 }}
    >
      <div className="mb-4 flex items-center gap-2 overflow-x-auto px-1 pb-2 scrollbar-hide" dir="ltr">
        {pagerDays.map((day, i) => {
          const colors = ["#22C7A1", "#7C83F6", "#38BDF8", "#FB6B7A", "#F97316", "#A3E635", "#22C7A1"];
          const dayColor = colors[i % colors.length];
          
          return (
            <button
              key={day.dateStr}
              ref={day.isSelected ? selectedCellRef : null}
              onClick={() => setCalendarDate(day.dateStr)}
              className={cn(
                "relative flex min-w-[44px] flex-col items-center justify-center gap-1.5 rounded-full py-2.5 transition-all active:scale-95",
                day.isSelected ? "bg-slate-900 shadow-[0_4px_12px_rgba(15,23,42,0.15)]" : "bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100 hover:bg-slate-50"
              )}
            >
              <span className={cn("text-[10px] font-bold uppercase", day.isSelected ? "text-slate-400" : "text-slate-400")}>
                {day.dayLetter}
              </span>
              <span className={cn("text-[15px] font-black leading-none", day.isSelected ? "text-white" : "text-slate-900")}>
                {day.dayNum}
              </span>
              <div className="mt-0.5 flex h-1.5 w-1.5 items-center justify-center">
                {day.status === "logged" ? (
                  <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: dayColor, boxShadow: `0 0 4px ${dayColor}80` }} />
                ) : day.status === "partial" ? (
                  <div className="h-1.5 w-1.5 rounded-full bg-orange-400" />
                ) : (
                  <div className="h-1 w-1 rounded-full bg-slate-200" />
                )}
              </div>
              {day.isToday && !day.isSelected && (
                <div className="absolute -top-0.5 right-1/2 h-1.5 w-1.5 translate-x-1/2 rounded-full bg-[#A3E635] ring-2 ring-white" />
              )}
              {day.isSelected && (
                <motion.div layoutId="pager-indicator" className="absolute bottom-0 left-1/2 h-0.5 w-4 -translate-x-1/2 rounded-t-full bg-gradient-to-r from-[#22C7A1] to-[#A3E635]" />
              )}
            </button>
          );
        })}
        <button
          onClick={() => setShowCalendar(true)}
          className="ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-slate-400 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100 transition-all hover:bg-slate-50 hover:text-slate-600 active:scale-95"
        >
          <CalendarCheck className="h-5 w-5" strokeWidth={2.2} />
        </button>
      </div>

      {showCalendar && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mb-5 overflow-hidden rounded-2xl bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100"
        >
          <div className="flex items-center gap-3">
            <input
              data-testid="progress-date-input"
              type="date"
              max={format(new Date(), "yyyy-MM-dd")}
              value={calendarDate}
              onChange={(e) => setCalendarDate(e.target.value)}
              className="h-12 min-w-0 flex-1 rounded-xl bg-slate-50 px-4 text-[15px] font-bold text-slate-900 outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-brand"
            />
            <button
              data-testid="progress-view-btn"
              className="h-12 rounded-xl bg-slate-900 px-5 text-[14px] font-bold text-white shadow-sm transition-all active:scale-95"
              type="button"
              onClick={() => setShowCalendar(false)}
            >
              {t("view")}
            </button>
          </div>
        </motion.div>
      )}

      {(() => {
        if (!activeGoal) {
          return (
            <section id="progress-panel-today" role="tabpanel" className="flex flex-col items-center justify-center rounded-[32px] bg-white p-8 text-center shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-soft text-brand ring-1 ring-brand/20">
                <Target className="h-8 w-8" strokeWidth={2.2} />
              </div>
              <h2 className="mt-5 text-[22px] font-black tracking-tight text-slate-900">{t("progress_no_goal_title")}</h2>
              <p className="mt-2 text-[14px] font-medium text-slate-500">{t("progress_no_goal_desc")}</p>
              <button type="button" onClick={() => navigate("/edit-goal")} className="mt-6 h-14 w-full rounded-full bg-slate-900 text-[15px] font-bold text-white shadow-[0_4px_12px_rgba(15,23,42,0.15)] transition-all active:scale-[0.98]">
                {t("progress_set_goal")}
              </button>
            </section>
          );
        }
        const calTarget = activeGoal.daily_calorie_target;
        const proteinTarget = activeGoal.protein_target_g;
        const carbsTarget = activeGoal.carbs_target_g;
        const fatTarget = activeGoal.fat_target_g;
        const calConsumed = todayProgress.calories ?? 0;
        const proteinConsumed = todayProgress.protein ?? 0;
        const carbsConsumed = todayProgress.carbs ?? 0;
        const fatConsumed = todayProgress.fat ?? 0;
        const dailyPct = calTarget > 0 ? Math.min(100, Math.round((calConsumed / calTarget) * 100)) : 0;
        const proteinPct = proteinTarget > 0 ? Math.min(100, Math.round((proteinConsumed / proteinTarget) * 100)) : 0;
        const carbsPct = carbsTarget > 0 ? Math.min(100, Math.round((carbsConsumed / carbsTarget) * 100)) : 0;
        const fatPct = fatTarget > 0 ? Math.min(100, Math.round((fatConsumed / fatTarget) * 100)) : 0;
        const hydrationPct = Math.min(100, waterSummary?.percentage ?? 0);
        const weeklyLoggedDays = weeklySummary?.consistency?.daysLogged ?? weekdayData.filter((d) => d.calories > 0).length;
        const weeklyConsistencyPct = weeklySummary?.consistency?.percentage ?? Math.round((weeklyLoggedDays / 7) * 100);
        const nutritionScore = computeNutritionScore({
          caloriePct: dailyPct,
          proteinPct,
          hydrationPct,
          weeklyConsistencyPct: isSelectedToday ? weeklyConsistencyPct : undefined,
        });
        
        return (
          <div id="progress-panel-today" role="tabpanel" className="space-y-4">
            {/* ── HERO: Journal Entry Header ── */}
            <div className="mb-6 px-2 text-start">
              <div className="flex items-center justify-between">
                <h2 className="text-[22px] font-black tracking-tight text-slate-900">
                  {formatLocaleDate(selectedDate, language, { weekday: "long", month: "long", day: "numeric" })}
                </h2>
                {!isSelectedToday ? (
                  <div className="flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 ring-1 ring-slate-200">
                    <Lock className="h-3 w-3 text-slate-400" />
                    <span className="text-[10px] font-bold text-slate-500">{t("progress_read_only")}</span>
                  </div>
                ) : (streaks.logging?.currentStreak ?? 0) > 0 ? (
                  <div className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#F97316] to-[#FB6B7A] px-2.5 py-1 shadow-[0_2px_8px_rgba(249,115,22,0.25)]">
                    <Flame className="h-3 w-3 text-white" />
                    <span className="text-[10px] font-bold text-white" dir="ltr">{streaks.logging?.currentStreak}d</span>
                  </div>
                ) : null}
              </div>
              
              <div className="mt-4 flex items-center gap-4">
                <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] ring-1 ring-slate-100/50" dir="ltr">
                  <svg className="absolute inset-0 h-full w-full -rotate-90 drop-shadow-sm" viewBox="0 0 64 64">
                    <defs>
                      <linearGradient id="score-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#22C7A1" />
                        <stop offset="25%" stopColor="#7C83F6" />
                        <stop offset="50%" stopColor="#38BDF8" />
                        <stop offset="75%" stopColor="#FB6B7A" />
                        <stop offset="100%" stopColor="#F97316" />
                      </linearGradient>
                    </defs>
                    <circle cx="32" cy="32" r="28" fill="none" stroke="#F8FAFC" strokeWidth="4" />
                    <motion.circle
                      cx="32"
                      cy="32"
                      r="28"
                      fill="none"
                      stroke="url(#score-gradient)"
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeDasharray={`${(nutritionScore / 100) * 175.9} 175.9`}
                      pathLength="100"
                      transition={{ duration: 1.2, ease: "easeOut" }}
                    />
                  </svg>
                  <span className={cn("text-[20px] font-black leading-none tracking-tight", nutritionScore >= 80 ? "bg-gradient-to-br from-[#A3E635] to-[#22C7A1] bg-clip-text text-transparent" : nutritionScore >= 50 ? "text-[#F97316]" : "text-[#FB6B7A]")}>
                    {nutritionScore}
                  </span>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{t("progress_daily_score")}</p>
                  <p className="mt-0.5 text-[15px] font-black text-slate-900">
                    {nutritionScore >= 80 ? t("progress_great_day") : nutritionScore >= 50 ? t("progress_on_track") : t("progress_keep_going")}
                  </p>
                </div>
              </div>
            </div>

            {/* ── Story Card: Nutrition ── */}
            <section className="rounded-[28px] bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100">
              <div className="mb-5 flex items-start justify-between text-start">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                    {calTarget - calConsumed > 0 ? t("progress_remaining") : t("progress_over_target")}
                  </p>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className={cn("text-[32px] font-black leading-none tracking-tight", calTarget - calConsumed > 0 ? "text-slate-900" : "text-[#FB6B7A]")} dir="ltr">
                      {Math.abs(calTarget - calConsumed).toLocaleString()}
                    </span>
                    <span className="text-[12px] font-bold text-slate-500" dir="ltr">/ {calTarget.toLocaleString()} kcal</span>
                  </div>
                </div>
              </div>

              {/* Stacked Macro Bar */}
              <div className="mb-6 flex h-3 w-full overflow-hidden rounded-full bg-slate-100 shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)]" dir="ltr">
                {(() => {
                  const total = Math.max(1, proteinConsumed + carbsConsumed + fatConsumed);
                  const pPct = (proteinConsumed / total) * 100;
                  const cPct = (carbsConsumed / total) * 100;
                  const fPct = (fatConsumed / total) * 100;
                  return (
                    <>
                      <motion.div className="h-full bg-gradient-to-r from-[#7C83F6] to-[#636BF4]" initial={{ width: 0 }} animate={{ width: `${pPct}%` }} transition={{ duration: 1 }} />
                      <motion.div className="h-full bg-gradient-to-r from-[#F97316] to-[#FB923C]" initial={{ width: 0 }} animate={{ width: `${cPct}%` }} transition={{ duration: 1, delay: 0.1 }} />
                      <motion.div className="h-full bg-gradient-to-r from-[#FB6B7A] to-[#F43F5E]" initial={{ width: 0 }} animate={{ width: `${fPct}%` }} transition={{ duration: 1, delay: 0.2 }} />
                    </>
                  );
                })()}
              </div>

              <div className="space-y-4">
                {[
                  { label: t('protein'), current: proteinConsumed, target: proteinTarget, unit: 'g', pct: proteinPct, color: '#7C83F6', bg: 'bg-[#7C83F6]/10' },
                  { label: t('carbs'), current: carbsConsumed, target: carbsTarget, unit: 'g', pct: carbsPct, color: '#F97316', bg: 'bg-[#F97316]/10' },
                  { label: t('fat_label'), current: fatConsumed, target: fatTarget, unit: 'g', pct: fatPct, color: '#FB6B7A', bg: 'bg-[#FB6B7A]/10' },
                ].map((m) => (
                  <div key={m.label} className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: m.bg }}>
                      <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: m.color, boxShadow: `0 0 8px ${m.color}80` }} />
                    </div>
                    <div className="min-w-0 flex-1 text-start">
                      <div className="flex items-center justify-between">
                        <p className="text-[12px] font-bold text-slate-700">{m.label}</p>
                        <div className="flex items-baseline gap-0.5" dir="ltr">
                          <span className="text-[14px] font-black text-slate-900">{m.current}</span>
                          <span className="text-[10px] font-bold text-slate-400">/{m.target}{m.unit}</span>
                        </div>
                      </div>
                      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-slate-100" dir="ltr">
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${m.pct}%`, backgroundColor: m.color }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* ── Story Card: Hydration ── */}
            <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#38BDF8] to-[#0891B2] p-5 shadow-[0_12px_30px_-8px_rgba(56,189,248,0.4)] ring-1 ring-white/10 text-white">
              <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
              
              <div className="relative flex items-start justify-between">
                <div className="text-start">
                  <div className="flex items-center gap-2">
                    <Droplet className="h-4 w-4 text-white/90" strokeWidth={2.5} />
                    <p className="text-[12px] font-bold text-white/90">{t("progress_hydration_today")}</p>
                  </div>
                  <div className="mt-3 flex items-baseline gap-1.5">
                    <span className="text-[32px] font-black leading-none tracking-tight" dir="ltr">{hydrationPct}%</span>
                    <span className="text-[12px] font-bold text-white/70">{t("progress_hydration_goal")}</span>
                  </div>
                  <p className="mt-1 text-[12px] font-medium text-white/80" dir="ltr">
                    {t("progress_water_glasses_status", { current: waterGlasses, target: waterTarget })}
                  </p>
                </div>

                {isSelectedToday && (
                  <div className="flex flex-col items-center gap-2 rounded-full bg-black/10 p-1.5 backdrop-blur-md ring-1 ring-white/20">
                    <button
                      type="button"
                      onClick={handleWaterAdd}
                      aria-label={t("progress_add_water")}
                      className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#0891B2] shadow-[0_4px_12px_rgba(0,0,0,0.15)] transition-all active:scale-90"
                    >
                      <Plus className="h-5 w-5" strokeWidth={2.5} />
                    </button>
                    <button
                      type="button"
                      onClick={handleWaterRemove}
                      disabled={waterGlasses <= 0}
                      aria-label={t("progress_remove_water")}
                      className="flex h-11 w-11 items-center justify-center rounded-full bg-white/20 text-white shadow-sm ring-1 ring-white/30 transition-all active:scale-90 disabled:opacity-40"
                    >
                      <Minus className="h-5 w-5" strokeWidth={2.5} />
                    </button>
                  </div>
                )}
              </div>

              <div className="relative mt-5 flex flex-wrap gap-1.5" dir="ltr" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={hydrationPct} aria-label={t("progress_hydration_today")}>
                {Array.from({ length: Math.max(waterTarget, waterGlasses) }).map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "h-6 w-6 rounded-full transition-all duration-500",
                      i < waterGlasses ? "bg-white shadow-[0_2px_8px_rgba(0,0,0,0.1)]" : "border-2 border-white/30 bg-transparent"
                    )}
                  />
                ))}
              </div>
            </section>

            {!isSelectedToday && (
              <section className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100/50 text-start">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{t("progress_past_snapshot")}</p>
                <p className="mt-1 text-[12px] font-medium leading-tight text-slate-500">{t("progress_past_snapshot_desc")}</p>
              </section>
            )}
          </div>
        );
      })()}
    </motion.div>
  );
}
