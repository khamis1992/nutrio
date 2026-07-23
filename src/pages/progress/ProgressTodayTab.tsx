import { useNavigate } from "react-router-dom";
import { addDays, format, startOfDay, subDays } from "date-fns";
import { formatLocaleDate } from "@/lib/dateUtils";
import {
  CalendarDays,
  Droplets,
  Flame,
  Lock,
  Minus,
  Plus,
  Target,
} from "lucide-react";
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
import { useRef, useEffect, useMemo, useState } from "react";

/** Local noon avoids TZ day-shift when parsing yyyy-MM-dd */
function localDateFromKey(key: string): Date {
  return new Date(`${key}T12:00:00`);
}

function toDateKey(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

interface ProgressTodayTabProps {
  selectedDate: Date;
  calendarDate: string;
  setCalendarDate: (v: string) => void;
  showCalendar: boolean;
  setShowCalendar: (v: boolean | ((prev: boolean) => boolean)) => void;
}

function ScoreRing({ value, size = 96 }: { value: number; size?: number }) {
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const dash = (pct / 100) * c;
  const color = pct >= 80 ? "#10B981" : pct >= 50 ? "#F59E0B" : "#F43F5E";

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} dir="ltr">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EEF0F3" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          initial={{ strokeDasharray: `0 ${c}` }}
          animate={{ strokeDasharray: `${dash} ${c}` }}
          transition={{ duration: 0.85, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[26px] font-black leading-none tracking-tight text-slate-950">{value}</span>
        <span className="mt-0.5 text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">/100</span>
      </div>
    </div>
  );
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
  const { activeGoal, loading: goalsLoading } = useNutritionGoals(user?.id);
  const { summary: weeklySummary } = useWeeklySummary(user?.id);
  const { streaks } = useStreak(user?.id);
  const { todayProgress } = useTodayProgress(user?.id, selectedDate, 0);
  const { dailySummary: waterSummary, addWater: addWaterIntake, decrementWater } = useWaterIntake(user?.id, selectedDate);
  const { days: weekdayData } = useWeekdayData(user?.id, activeGoal?.daily_calorie_target ?? 2000);
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const selectedCellRef = useRef<HTMLButtonElement>(null);
  const isBootstrapping = Boolean(user?.id) && goalsLoading;

  const selectedDateKey = format(selectedDate, "yyyy-MM-dd");
  const todayKey = format(new Date(), "yyyy-MM-dd");
  const isSelectedToday = selectedDateKey === todayKey;
  const waterGlasses = waterSummary?.total ?? 0;
  const waterTarget = waterSummary?.target ?? 8;
  const streakDays = streaks.logging?.currentStreak ?? 0;

  // Stable 7-day window — does NOT re-anchor when tapping a day inside the strip
  const [windowStartKey, setWindowStartKey] = useState(() =>
    toDateKey(subDays(startOfDay(new Date()), 6)),
  );

  // Only slide the window when the selected date is outside it (e.g. date picker)
  useEffect(() => {
    const selected = startOfDay(localDateFromKey(selectedDateKey));
    const start = startOfDay(localDateFromKey(windowStartKey));
    const end = addDays(start, 6);
    if (selected < start) {
      setWindowStartKey(toDateKey(selected));
    } else if (selected > end) {
      setWindowStartKey(toDateKey(subDays(selected, 6)));
    }
  }, [selectedDateKey, windowStartKey]);

  const pagerDays = useMemo(() => {
    const start = localDateFromKey(windowStartKey);
    const calTarget = activeGoal?.daily_calorie_target ?? 2000;
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(start, i);
      const dateStr = toDateKey(d);
      const isSelected = dateStr === selectedDateKey;
      let status: "none" | "partial" | "logged" = "none";
      const dayCal = isSelected
        ? (todayProgress.calories ?? 0)
        : (weekdayData.find((wd) => wd.date === dateStr)?.calories ?? 0);
      if (dayCal > 0) status = dayCal >= calTarget * 0.9 ? "logged" : "partial";
      return {
        dateStr,
        dayLetter: formatLocaleDate(d, language, { weekday: "narrow" }),
        dayNum: format(d, "d"),
        isSelected,
        isToday: dateStr === todayKey,
        status,
      };
    });
  }, [
    windowStartKey,
    selectedDateKey,
    todayKey,
    language,
    activeGoal?.daily_calorie_target,
    todayProgress.calories,
    weekdayData,
  ]);

  // Scroll selected into view only when it was outside the strip (window moved)
  useEffect(() => {
    selectedCellRef.current?.scrollIntoView({ inline: "nearest", behavior: "smooth", block: "nearest" });
  }, [windowStartKey]);

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
    const ok = await decrementWater();
    if (!ok) {
      toast({ description: t("failed_to_update"), variant: "destructive" });
      return;
    }
    toast({ description: t("progress_water_removed"), duration: 1200 });
  };

  if (isBootstrapping) {
    return (
      <section id="progress-panel-today" role="tabpanel" aria-busy="true" className="space-y-4">
        <div className="h-8 w-40 animate-pulse rounded-full bg-slate-200/80" />
        <div className="h-14 animate-pulse rounded-[20px] bg-white ring-1 ring-slate-100" />
        <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-[112px_1fr]">
          <div className="h-36 animate-pulse rounded-[20px] bg-white ring-1 ring-slate-100" />
          <div className="h-36 animate-pulse rounded-[20px] bg-slate-200/70" />
        </div>
        <div className="h-40 animate-pulse rounded-[20px] bg-white ring-1 ring-slate-100" />
        <div className="h-36 animate-pulse rounded-[20px] bg-white ring-1 ring-slate-100" />
      </section>
    );
  }

  if (!activeGoal) {
    return (
      <section
        id="progress-panel-today"
        role="tabpanel"
        className="flex flex-col items-center rounded-[20px] bg-white px-5 py-8 text-center shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100"
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
          <Target className="h-7 w-7" strokeWidth={2.2} />
        </div>
        <h2 className="mt-4 text-[20px] font-extrabold text-slate-950">{t("progress_no_goal_title")}</h2>
        <p className="mt-2 text-[14px] font-medium leading-relaxed text-slate-500">{t("progress_no_goal_desc")}</p>
        <button
          type="button"
          onClick={() => navigate("/edit-goal")}
          className="mt-5 flex h-12 min-h-[48px] w-full items-center justify-center rounded-full bg-emerald-500 text-[15px] font-extrabold text-white shadow-[0_4px_14px_rgba(16,185,129,0.28)] active:scale-[0.98]"
        >
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
  const calRemaining = calTarget - calConsumed;
  const dailyPct = calTarget > 0 ? Math.min(100, Math.round((calConsumed / calTarget) * 100)) : 0;
  const proteinPct = proteinTarget > 0 ? Math.min(100, Math.round((proteinConsumed / proteinTarget) * 100)) : 0;
  const carbsPct = carbsTarget > 0 ? Math.min(100, Math.round((carbsConsumed / carbsTarget) * 100)) : 0;
  const fatPct = fatTarget > 0 ? Math.min(100, Math.round((fatConsumed / fatTarget) * 100)) : 0;
  const hydrationPct = Math.min(100, waterSummary?.percentage ?? 0);
  const weeklyLoggedDays =
    weeklySummary?.consistency?.daysLogged ?? weekdayData.filter((d) => d.calories > 0).length;
  const weeklyConsistencyPct =
    weeklySummary?.consistency?.percentage ?? Math.round((weeklyLoggedDays / 7) * 100);
  const nutritionScore = computeNutritionScore({
    caloriePct: dailyPct,
    proteinPct,
    hydrationPct,
    weeklyConsistencyPct: isSelectedToday ? weeklyConsistencyPct : undefined,
  });
  const scoreLabel =
    nutritionScore >= 80
      ? t("progress_great_day")
      : nutritionScore >= 50
        ? t("progress_on_track")
        : t("progress_keep_going");
  const dateTitle = formatLocaleDate(selectedDate, language, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  const macros = [
    { label: t("protein"), current: proteinConsumed, target: proteinTarget, pct: proteinPct, color: "#6366F1", soft: "bg-indigo-50 text-indigo-600" },
    { label: t("carbs"), current: carbsConsumed, target: carbsTarget, pct: carbsPct, color: "#F97316", soft: "bg-orange-50 text-orange-600" },
    { label: t("fat_label"), current: fatConsumed, target: fatTarget, pct: fatPct, color: "#F43F5E", soft: "bg-rose-50 text-rose-600" },
  ];

  return (
    <motion.div
      id="progress-panel-today"
      role="tabpanel"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
      className="space-y-4"
    >
      {/* Header — large title mobile pattern */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 text-start">
          <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-slate-400">
            {isSelectedToday ? t("today") : t("progress_past_snapshot")}
          </p>
          <h2 className="mt-1 truncate text-[20px] font-extrabold leading-tight tracking-tight text-slate-950">
            {dateTitle}
          </h2>
        </div>
        {!isSelectedToday ? (
          <span className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-2xl bg-slate-100 px-3 py-2 text-[12px] font-bold text-slate-500">
            <Lock className="h-3.5 w-3.5" strokeWidth={2.5} />
            {t("progress_read_only")}
          </span>
        ) : (
          <div
            className={cn(
              "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-2xl py-1.5 pe-3 ps-1.5 ring-1",
              streakDays > 0
                ? "bg-gradient-to-br from-orange-50 to-amber-50 ring-orange-100"
                : "bg-slate-50 ring-slate-100"
            )}
            title={t("daily_streak")}
            aria-label={
              streakDays > 0
                ? t("progress_day_streak", { count: streakDays })
                : t("progress_start_streak")
            }
          >
            <span
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-xl shadow-sm",
                streakDays > 0
                  ? "bg-gradient-to-br from-[#F97316] to-[#FB6B7A] text-white"
                  : "bg-white text-slate-400 ring-1 ring-slate-100"
              )}
            >
              <Flame
                className={cn("h-4 w-4", streakDays > 0 && "fill-current")}
                strokeWidth={2.4}
              />
            </span>
            <span className="flex min-w-0 flex-col items-start gap-0.5 leading-none text-start">
              <span
                className={cn(
                  "text-[9px] font-bold uppercase tracking-[0.1em]",
                  streakDays > 0 ? "text-orange-500" : "text-slate-400"
                )}
              >
                {t("daily_streak")}
              </span>
              <span
                className={cn(
                  "text-[13px] font-black tabular-nums",
                  streakDays > 0 ? "text-slate-900" : "text-slate-500"
                )}
                dir="ltr"
              >
                {streakDays > 0
                  ? t("progress_day_streak", { count: streakDays })
                  : t("progress_start_streak")}
              </span>
            </span>
          </div>
        )}
      </div>

      {/* Week strip — mobile date chips */}
      <div className="rounded-2xl bg-white p-2 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide" dir="ltr">
          {pagerDays.map((day) => (
            <button
              key={day.dateStr}
              ref={day.isSelected ? selectedCellRef : null}
              type="button"
              onClick={() => setCalendarDate(day.dateStr)}
              aria-pressed={day.isSelected}
              aria-label={day.dateStr}
              className={cn(
                "relative flex h-[58px] min-w-[42px] flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-1 transition-all active:scale-95",
                day.isSelected
                  ? "bg-gradient-to-b from-[#0F172A] to-[#1E293B] text-white shadow-[0_6px_16px_rgba(15,23,42,0.2)]"
                  : day.isToday
                    ? "bg-emerald-50 text-slate-900 ring-1 ring-emerald-200/80"
                    : "bg-transparent text-slate-500 hover:bg-slate-50"
              )}
            >
              <span
                className={cn(
                  "text-[10px] font-bold uppercase leading-none tracking-wide",
                  day.isSelected ? "text-white/60" : day.isToday ? "text-emerald-600" : "text-slate-400"
                )}
              >
                {day.dayLetter}
              </span>
              <span
                className={cn(
                  "text-[16px] font-black leading-none tabular-nums",
                  day.isSelected ? "text-white" : "text-slate-900"
                )}
              >
                {day.dayNum}
              </span>
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  day.isSelected && "bg-[#A3E635] shadow-[0_0_6px_rgba(163,230,53,0.8)]",
                  !day.isSelected && day.status === "logged" && "bg-[#22C7A1]",
                  !day.isSelected && day.status === "partial" && "bg-[#F97316]",
                  !day.isSelected && day.status === "none" && (day.isToday ? "bg-emerald-300" : "bg-slate-200")
                )}
              />
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowCalendar((open) => !open)}
            aria-label={t("progress_select_date")}
            aria-expanded={showCalendar}
            className={cn(
              "flex h-[58px] w-11 shrink-0 items-center justify-center rounded-2xl transition-all active:scale-95",
              showCalendar
                ? "bg-emerald-500 text-white shadow-[0_4px_12px_rgba(16,185,129,0.3)]"
                : "bg-slate-50 text-slate-500 ring-1 ring-slate-100"
            )}
          >
            <CalendarDays className="h-5 w-5" strokeWidth={2.2} />
          </button>
        </div>
      </div>

      {showCalendar && (
        <div className="rounded-[20px] bg-white p-3 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100">
          <div className="flex items-center gap-2">
            <input
              data-testid="progress-date-input"
              type="date"
              max={format(new Date(), "yyyy-MM-dd")}
              value={calendarDate}
              onChange={(e) => setCalendarDate(e.target.value)}
              className="h-12 min-h-[48px] min-w-0 flex-1 rounded-full bg-slate-50 px-4 text-[15px] font-bold text-slate-900 outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-emerald-500/25"
            />
            <button
              data-testid="progress-view-btn"
              type="button"
              onClick={() => setShowCalendar(false)}
              className="h-12 min-h-[48px] shrink-0 rounded-full bg-slate-950 px-5 text-[14px] font-extrabold text-white active:scale-95"
            >
              {t("view")}
            </button>
          </div>
        </div>
      )}

      {/* Score + calories — stacked on narrow, side-by-side when space */}
      <section className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-[112px_1fr]">
        <div className="flex flex-col items-center justify-center rounded-[20px] bg-white px-3 py-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100">
          <ScoreRing value={nutritionScore} size={96} />
          <p className="mt-2 max-w-[130px] text-center text-[12px] font-extrabold leading-snug text-slate-900">
            {scoreLabel}
          </p>
        </div>

        <div className="flex min-h-[132px] flex-col justify-between rounded-[20px] bg-slate-950 p-4 text-white shadow-[0_6px_18px_rgba(15,23,42,0.12)]">
          <div className="text-start">
            <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-white/50">
              {calRemaining > 0 ? t("progress_remaining") : t("progress_over_target")}
            </p>
            <p className="mt-1.5 flex items-baseline gap-1">
              <span className="text-[28px] font-black leading-none tracking-tight" dir="ltr">
                {Math.abs(calRemaining).toLocaleString()}
              </span>
              <span className="text-[13px] font-bold text-white/45">kcal</span>
            </p>
            <p className="mt-1.5 text-[12px] font-semibold text-white/55" dir="ltr">
              {calConsumed.toLocaleString()} / {calTarget.toLocaleString()}
            </p>
          </div>
          <div className="mt-3">
            <div className="mb-1.5 flex justify-between text-[12px] font-bold text-white/50">
              <span>{t("calories")}</span>
              <span dir="ltr">{dailyPct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10" dir="ltr">
              <motion.div
                className="h-full rounded-full bg-emerald-400"
                initial={{ width: 0 }}
                animate={{ width: `${dailyPct}%` }}
                transition={{ duration: 0.7, ease: "easeOut" }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Macros — list cells 48px+ */}
      <section className="rounded-[20px] bg-white p-3 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100">
        <div className="mb-2 flex h-2 overflow-hidden rounded-full bg-slate-100" dir="ltr">
          {(() => {
            const total = Math.max(1, proteinConsumed + carbsConsumed + fatConsumed);
            return (
              <>
                <div className="h-full bg-indigo-500" style={{ width: `${(proteinConsumed / total) * 100}%` }} />
                <div className="h-full bg-orange-500" style={{ width: `${(carbsConsumed / total) * 100}%` }} />
                <div className="h-full bg-rose-500" style={{ width: `${(fatConsumed / total) * 100}%` }} />
              </>
            );
          })()}
        </div>
        <div className="divide-y divide-slate-50">
          {macros.map((m) => (
            <div key={m.label} className="flex min-h-[52px] items-center gap-3 px-1 py-2.5">
              <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px]", m.soft)}>
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: m.color }} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[14px] font-bold text-slate-800">{m.label}</p>
                  <p className="text-[14px] font-extrabold text-slate-950" dir="ltr">
                    {m.current}
                    <span className="text-[12px] font-bold text-slate-400">/{m.target}g</span>
                  </p>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100" dir="ltr">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${m.pct}%`, backgroundColor: m.color }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Hydration */}
      <section
        className="rounded-[20px] bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100"
        aria-label={t("progress_hydration_today")}
      >
        <div className="flex items-center gap-3 text-start">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-sky-50 text-sky-600">
            <Droplets className="h-5 w-5" strokeWidth={2.4} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-extrabold text-slate-900">{t("progress_hydration_today")}</p>
            <p className="mt-0.5 text-[12px] font-semibold text-slate-500" dir="ltr">
              {t("progress_water_glasses_status", { current: waterGlasses, target: waterTarget })}
            </p>
          </div>
          <p className="shrink-0 text-[28px] font-black leading-none tracking-tight text-slate-950" dir="ltr">
            {hydrationPct}
            <span className="text-[13px] font-bold text-slate-400">%</span>
          </p>
        </div>

        <div
          className="mt-4 flex flex-wrap gap-2"
          dir="ltr"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={hydrationPct}
          aria-label={t("progress_hydration_today")}
        >
          {Array.from({ length: Math.max(waterTarget, waterGlasses) }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-3 w-3 rounded-full transition-all",
                i < waterGlasses ? "bg-sky-500" : "bg-slate-200"
              )}
            />
          ))}
        </div>

        {isSelectedToday && (
          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={handleWaterRemove}
              disabled={waterGlasses <= 0}
              aria-label={t("progress_remove_water")}
              className="flex h-12 min-h-[48px] w-12 min-w-[48px] items-center justify-center rounded-full bg-slate-100 text-slate-700 active:scale-90 disabled:opacity-40"
            >
              <Minus className="h-5 w-5" strokeWidth={2.5} />
            </button>
            <button
              type="button"
              onClick={handleWaterAdd}
              aria-label={t("progress_add_water")}
              className="flex h-12 min-h-[48px] flex-1 items-center justify-center gap-2 rounded-full bg-sky-500 text-[14px] font-extrabold text-white shadow-[0_4px_12px_rgba(14,165,233,0.28)] active:scale-[0.98]"
            >
              <Plus className="h-5 w-5" strokeWidth={2.5} />
              {t("progress_add_water")}
            </button>
          </div>
        )}
      </section>

      {!isSelectedToday && (
        <section className="rounded-[16px] bg-slate-50 p-4 text-start ring-1 ring-slate-100/70">
          <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-slate-400">{t("progress_past_snapshot")}</p>
          <p className="mt-1 text-[13px] font-medium leading-snug text-slate-500">{t("progress_past_snapshot_desc")}</p>
        </section>
      )}
    </motion.div>
  );
}
