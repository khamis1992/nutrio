import type { LucideIcon } from "lucide-react";
import { useState } from "react";
import {
  Activity,
  Check,
  ChevronDown,
  Droplets,
  Flame,
  Target,
  TrendingDown,
  TrendingUp,
  Utensils,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNutritionGoals } from "@/hooks/useNutritionGoals";
import { useWeeklySummary } from "@/hooks/useWeeklySummary";
import { useStreak } from "@/hooks/useStreak";
import { useWaterIntake } from "@/hooks/useWaterIntake";
import { useWeekdayData } from "@/hooks/useWeekdayData";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { PROGRESS_COLORS } from "./progress-colors";
import { motion, AnimatePresence } from "framer-motion";

export type RingMetric = {
  label: string;
  value: number;
  status: string;
  Icon: LucideIcon;
  color: string;
  track: string;
};

// eslint-disable-next-line react-refresh/only-export-components
export const weekDayKeys = [
  "progress_mon",
  "progress_tue",
  "progress_wed",
  "progress_thu",
  "progress_fri",
  "progress_sat",
  "progress_sun",
] as const;

export function MetricRing({ metric }: { metric: RingMetric }) {
  const size = 72;
  const stroke = 5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (metric.value / 100) * circumference;
  const Icon = metric.Icon;

  return (
    <article className="overflow-hidden rounded-2xl bg-white p-3 text-center shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100">
      <div className="relative mx-auto grid place-items-center" style={{ width: size, height: size }} dir="ltr">
        <svg className="absolute inset-0 -rotate-90" viewBox={`0 0 ${size} ${size}`}>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#F1F5F9" strokeWidth={stroke} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={metric.color}
            strokeLinecap="round"
            strokeWidth={stroke}
            strokeDasharray={`${dash} ${circumference}`}
          />
        </svg>
        <div className="flex flex-col items-center gap-0.5">
          <Icon className="h-4 w-4" style={{ color: metric.color }} strokeWidth={2.4} />
          <span className="text-[16px] font-black leading-none tracking-tight text-slate-900">{metric.value}%</span>
        </div>
      </div>
      <p className="mt-2 truncate text-[10px] font-bold text-slate-500">{metric.label}</p>
      <p className="mt-0.5 truncate text-[9px] font-semibold text-slate-400">{metric.status}</p>
    </article>
  );
}

export function SectionHeader({ title, action, onClick }: { title: string; action?: string; onClick?: () => void }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="text-[16px] font-black tracking-tight text-slate-900">{title}</h2>
      {action ? (
        <button
          type="button"
          onClick={onClick}
          className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-extrabold text-slate-700 active:scale-95"
        >
          {action}
          <ChevronDown className="h-3.5 w-3.5" strokeWidth={2.5} />
        </button>
      ) : null}
    </div>
  );
}

function MiniSpark({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(...values, 1);
  const pts = values
    .map((v, i) => {
      const x = (i / Math.max(values.length - 1, 1)) * 80;
      const y = 34 - (v / max) * 26;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg className="h-9 w-full" viewBox="0 0 80 40" preserveAspectRatio="none">
      <polyline fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" points={pts} />
    </svg>
  );
}

export default function ProgressWeekTab() {
  const { user } = useAuth();
  const { activeGoal } = useNutritionGoals(user?.id);
  const { summary: weeklySummary } = useWeeklySummary(user?.id);
  const { streaks } = useStreak(user?.id);
  const { dailySummary: waterSummary } = useWaterIntake(user?.id, new Date());
  const calorieTarget = activeGoal?.daily_calorie_target ?? 2000;
  const { days: weekdayData } = useWeekdayData(user?.id, calorieTarget);
  const { t } = useLanguage();
  const [showWeekDetails, setShowWeekDetails] = useState(false);

  const waterTarget = waterSummary?.target ?? 8;
  const trendLoggedDays = weekdayData.filter((day) => day.calories > 0).length;
  const hasEnoughTrendData = trendLoggedDays >= 3;

  const consistencyPct = weeklySummary?.consistency?.percentage ?? 0;
  const protPct = weeklySummary?.macros?.protein?.percentage ?? 0;
  const waterDays = weekdayData.filter((d) => d.waterGlasses >= waterTarget).length;
  const waterPct = Math.round((waterDays / 7) * 100);
  const weekScore = Math.round((consistencyPct + protPct + waterPct) / 3);
  const change = weeklySummary?.calories?.changePercent ?? 0;
  const streak = streaks.logging?.currentStreak ?? 0;
  const daysLogged = weekdayData.filter((d) => d.calories > 0).length;
  const calAvg = weeklySummary?.calories?.thisWeekAvg ?? 0;
  const calPct = calorieTarget > 0 ? Math.min(100, Math.round((calAvg / calorieTarget) * 100)) : 0;
  const scoreLabel =
    weekScore >= 80
      ? t("progress_excellent_week")
      : weekScore >= 60
        ? t("progress_good_progress_status")
        : t("progress_keep_going");
  const maxCal = Math.max(...weekdayData.map((d) => d.calories), 1);
  const TrendIcon = change >= 0 ? TrendingUp : TrendingDown;

  return (
    <motion.div
      id="progress-panel-week"
      role="tabpanel"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
      className="space-y-4"
    >
      {!hasEnoughTrendData && (
        <section className="rounded-[24px] bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
              <TrendingUp className="h-5 w-5" strokeWidth={2.3} />
            </div>
            <div className="min-w-0 flex-1 text-start">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-[14px] font-black text-slate-950">{t("progress_collecting_title")}</h2>
                <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[12px] font-black text-sky-700" dir="ltr">
                  {Math.min(trendLoggedDays, 3)}/3
                </span>
              </div>
              <p className="mt-1 text-[12px] font-medium leading-snug text-slate-500">
                {t("progress_collecting_desc", { count: trendLoggedDays })}
              </p>
              <div className="mt-2.5 flex gap-1.5" dir="ltr">
                {[0, 1, 2].map((i) => (
                  <span key={i} className={cn("h-1.5 flex-1 rounded-full", i < trendLoggedDays ? "bg-sky-500" : "bg-slate-100")} />
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Week score hero */}
      <section className="rounded-[20px] bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 text-start">
            <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-slate-400">
              {t("progress_weekly_performance")}
            </p>
            <p className="mt-1 text-[18px] font-extrabold leading-snug tracking-tight text-slate-950">{scoreLabel}</p>
            <div className="mt-2 inline-flex min-h-8 items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1.5 text-[12px] font-bold text-slate-600 ring-1 ring-slate-100">
              <TrendIcon className={cn("h-4 w-4", change >= 0 ? "text-emerald-600" : "text-rose-500")} strokeWidth={2.5} />
              <span dir="ltr">
                {change >= 0 ? `+${Math.round(change)}%` : `${Math.round(change)}%`} {t("progress_vs_last_week")}
              </span>
            </div>
          </div>
          <div
            className={cn(
              "flex h-[72px] min-w-[72px] shrink-0 flex-col items-center justify-center rounded-[20px] px-2.5 text-white",
              weekScore >= 80 ? "bg-emerald-500" : weekScore >= 60 ? "bg-amber-500" : "bg-rose-500"
            )}
            aria-label={`${t("progress_weekly_score")}: ${weekScore}`}
          >
            <span className="text-[28px] font-black leading-none tabular-nums tracking-tight" dir="ltr">
              {weekScore}
            </span>
            <span className="mt-1 max-w-[64px] text-center text-[9px] font-extrabold uppercase leading-none tracking-[0.08em] text-white/85">
              {t("progress_score")}
            </span>
          </div>
        </div>

        {streak > 0 && (
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-extrabold text-orange-600" dir="ltr">
            <Flame className="h-3.5 w-3.5" strokeWidth={2.5} />
            {streak}d · {t("progress_of_seven_days", { count: daysLogged })}
          </div>
        )}

        {/* 7-day bars */}
        <div className="mt-4">
          <p className="mb-2.5 text-[12px] font-bold uppercase tracking-[0.1em] text-slate-400">
            {t("progress_weekly_consistency")}
          </p>
          <div className="flex h-24 items-end justify-between gap-1" dir="ltr">
            {weekDayKeys.map((dayKey, i) => {
              const day = weekdayData[i];
              const h = day?.calories ? Math.max(16, Math.round((day.calories / maxCal) * 100)) : 12;
              const onTarget =
                !!day?.calories && day.calories >= calorieTarget * 0.9 && day.calories <= calorieTarget * 1.1;
              const partial = !!day?.calories && !onTarget;
              return (
                <div key={dayKey} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                  <div
                    className={cn(
                      "w-full max-w-[28px] rounded-t-lg transition-all",
                      onTarget && "bg-emerald-500",
                      partial && "bg-amber-400",
                      !day?.calories && "bg-slate-100"
                    )}
                    style={{ height: `${h}%` }}
                  />
                  <span className="text-[11px] font-bold uppercase text-slate-400">{t(dayKey).charAt(0)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* KPI row */}
      <section className="grid grid-cols-3 gap-2">
        {[
          {
            label: t("calories"),
            value: `${calPct}%`,
            sub: `${calAvg.toLocaleString()} ${t("progress_avg_short")}`,
            Icon: Flame,
            color: "text-orange-600",
            bg: "bg-orange-50",
            values: weekdayData.map((d) => d.calories),
            spark: "#F97316",
          },
          {
            label: t("protein"),
            value: `${protPct}%`,
            sub: t("of_target"),
            Icon: Target,
            color: "text-indigo-600",
            bg: "bg-indigo-50",
            values: weekdayData.map((d) => d.protein),
            spark: "#6366F1",
          },
          {
            label: t("progress_hydration"),
            value: `${waterDays}/7`,
            sub: t("days_met_goal"),
            Icon: Droplets,
            color: "text-sky-600",
            bg: "bg-sky-50",
            values: weekdayData.map((d) => d.waterGlasses),
            spark: "#0EA5E9",
          },
        ].map((card) => (
          <article
            key={card.label}
            className="min-w-0 rounded-[16px] bg-white p-2.5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100"
          >
            <div className={cn("mb-2 flex h-8 w-8 items-center justify-center rounded-xl", card.bg, card.color)}>
              <card.Icon className="h-4 w-4" strokeWidth={2.4} />
            </div>
            <p className={cn("text-[16px] font-black leading-none", card.color)} dir="ltr">
              {card.value}
            </p>
            <p className="mt-1 truncate text-[12px] font-extrabold text-slate-900">{card.label}</p>
            <p className="truncate text-[11px] font-semibold text-slate-400">{card.sub}</p>
            <div className="mt-1.5 opacity-90">
              <MiniSpark values={card.values} color={card.spark} />
            </div>
          </article>
        ))}
      </section>

      {/* Day feed */}
      <section className="rounded-[20px] bg-white p-3 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100">
        <div className="mb-2 flex items-center justify-between gap-2 px-1">
          <h3 className="text-[15px] font-extrabold text-slate-950">{t("progress_your_week")}</h3>
          <div className="flex shrink-0 items-center gap-2 text-[11px] font-bold text-slate-400">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> {t("progress_on_track_legend")}
            </span>
          </div>
        </div>
        <div className="space-y-1.5">
          {weekdayData.map((day, i) => {
            const hasData = day.calories > 0;
            const onTarget =
              hasData && day.calories >= calorieTarget * 0.9 && day.calories <= calorieTarget * 1.1;
            const status = !hasData ? "none" : onTarget ? "on" : "partial";
            return (
              <div
                key={weekDayKeys[i]}
                className="flex min-h-[52px] items-center gap-2.5 rounded-[14px] bg-slate-50/90 px-2.5 py-2 ring-1 ring-slate-100/60"
              >
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-[12px] text-[11px] font-extrabold uppercase",
                    status === "on" && "bg-emerald-500 text-white",
                    status === "partial" && "bg-amber-400 text-white",
                    status === "none" && "bg-white text-slate-400 ring-1 ring-slate-200"
                  )}
                >
                  {t(weekDayKeys[i]).slice(0, 3)}
                </div>
                <div className="min-w-0 flex-1 text-start">
                  <p className="text-[14px] font-extrabold text-slate-900" dir="ltr">
                    {hasData ? `${day.calories.toLocaleString()} kcal` : "—"}
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] font-semibold text-slate-500">
                    <span className="inline-flex items-center gap-1" dir="ltr">
                      <Utensils className="h-3.5 w-3.5" /> P {day.protein}g
                    </span>
                    <span className="inline-flex items-center gap-1" dir="ltr">
                      <Droplets className="h-3.5 w-3.5" /> {day.waterGlasses}/{waterTarget}
                    </span>
                    {day.hasWorkout && (
                      <span className="inline-flex items-center gap-1">
                        <Activity className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </div>
                </div>
                {status === "on" ? (
                  <Check className="h-5 w-5 shrink-0 text-emerald-500" strokeWidth={3} />
                ) : (
                  <span
                    className={cn(
                      "h-2.5 w-2.5 shrink-0 rounded-full",
                      status === "partial" ? "bg-amber-400" : "bg-slate-200"
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Habits */}
      <section className="rounded-[28px] bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100">
        <h3 className="mb-4 text-[15px] font-black text-slate-950">{t("progress_habit_consistency")}</h3>
        <div className="space-y-4">
          {(() => {
            const waterTrackDays = weekdayData.filter((d) => d.waterGlasses > 0).length;
            const workoutDays = weekdayData.filter((d) => d.hasWorkout).length;
            const habits = [
              {
                label: t("meal_logging_label"),
                days: weeklySummary?.consistency.daysLogged ?? 0,
                pct: weeklySummary?.consistency.percentage ?? 0,
                color: "#10B981",
                Icon: Utensils,
                soft: "bg-emerald-50 text-emerald-600",
              },
              {
                label: t("water_tracking_label"),
                days: waterTrackDays,
                pct: Math.round((waterTrackDays / 7) * 100),
                color: "#0EA5E9",
                Icon: Droplets,
                soft: "bg-sky-50 text-sky-600",
              },
              {
                label: t("workouts_label"),
                days: workoutDays,
                pct: Math.round((workoutDays / 7) * 100),
                color: "#6366F1",
                Icon: Activity,
                soft: "bg-indigo-50 text-indigo-600",
              },
            ];
            return habits.map((h) => (
              <div key={h.label} className="flex items-center gap-3">
                <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl", h.soft)}>
                  <h.Icon className="h-4.5 w-4.5" strokeWidth={2.3} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex justify-between text-[12px]">
                    <span className="font-bold text-slate-800">{h.label}</span>
                    <span className="font-black text-slate-400" dir="ltr">
                      {t("progress_of_seven_days", { count: h.days })}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100" dir="ltr">
                    <div className="h-full rounded-full" style={{ width: `${h.pct}%`, backgroundColor: h.color }} />
                  </div>
                </div>
              </div>
            ));
          })()}
        </div>
      </section>

      {/* Weekly goals checklist */}
      {hasEnoughTrendData && (
        <section className="rounded-[28px] bg-slate-950 p-5 text-white">
          <h3 className="mb-4 text-[15px] font-black">{t("progress_weekly_goal_progress")}</h3>
          {(() => {
            const calOnTarget =
              weeklySummary && Math.abs(weeklySummary.calories.thisWeekAvg - calorieTarget) <= 200;
            const proteinOnTarget = (weeklySummary?.macros.protein.percentage ?? 0) >= 80;
            const waterOnTarget = waterDays >= 4;
            const activityOnTarget = weekdayData.filter((d) => d.hasWorkout).length >= 3;
            const goals = [
              { label: t("calories_goal"), done: !!calOnTarget },
              { label: t("protein_goal_label"), done: proteinOnTarget },
              { label: t("water_goal"), done: waterOnTarget },
              { label: t("activity_goal"), done: activityOnTarget },
            ];
            const doneCount = goals.filter((g) => g.done).length;
            const goalPct = Math.round((doneCount / goals.length) * 100);
            return (
              <>
                <div className="mb-4 flex items-end justify-between">
                  <div>
                    <p className="text-[36px] font-black leading-none" dir="ltr">
                      {goalPct}%
                    </p>
                    <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-white/45">
                      {t("progress_completed")}
                    </p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-emerald-400">
                    <Target className="h-6 w-6" strokeWidth={2.3} />
                  </div>
                </div>
                <div className="space-y-2">
                  {goals.map((g) => (
                    <div
                      key={g.label}
                      className="flex items-center justify-between rounded-2xl bg-white/5 px-3 py-2.5 ring-1 ring-white/10"
                    >
                      <span className="text-[12px] font-bold text-white/85">{g.label}</span>
                      <span
                        className={cn(
                          "flex h-6 w-6 items-center justify-center rounded-full",
                          g.done ? "bg-emerald-400 text-slate-950" : "bg-white/10 text-white/35"
                        )}
                      >
                        {g.done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
        </section>
      )}

      {/* Compare + details */}
      {hasEnoughTrendData && (
        <section className="rounded-[28px] bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100">
          <h3 className="mb-3 text-[15px] font-black text-slate-950">{t("progress_week_vs_last")}</h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              {
                label: t("progress_calories_compare"),
                value: `${change >= 0 ? "+" : ""}${weeklySummary?.calories.changePercent ?? 0}%`,
                color: change >= 0 ? "text-emerald-600" : "text-rose-500",
              },
              {
                label: t("progress_protein_compare"),
                value: t("progress_of_target_pct", { value: weeklySummary?.macros.protein.percentage ?? 0 }),
                color: "text-indigo-600",
              },
              {
                label: t("progress_water_compare"),
                value: t("progress_of_seven_days", { count: waterDays }),
                color: "text-sky-600",
              },
              {
                label: t("progress_consistency_compare"),
                value: `${weeklySummary?.consistency.percentage ?? 0}%`,
                color: "text-emerald-600",
              },
            ].map((row) => (
              <div key={row.label} className="rounded-[18px] bg-slate-50 p-3 text-start ring-1 ring-slate-100/70">
                <p className="text-[11px] font-bold text-slate-500">{row.label}</p>
                <p className={cn("mt-1 text-[17px] font-black", row.color)} dir="ltr">
                  {row.value}
                </p>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowWeekDetails((v) => !v)}
            className="mt-4 flex h-12 w-full items-center justify-center gap-1.5 rounded-full bg-slate-950 text-[13px] font-extrabold text-white active:scale-[0.98]"
          >
            {showWeekDetails ? t("progress_hide_details") : t("progress_view_details")}
            <ChevronDown className={cn("h-4 w-4 transition-transform", showWeekDetails && "rotate-180")} strokeWidth={2.5} />
          </button>

          <AnimatePresence>
            {showWeekDetails && weeklySummary && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 grid grid-cols-2 gap-2 overflow-hidden"
              >
                <article className="rounded-[18px] bg-emerald-50 p-4 text-start">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700/70">
                    {t("progress_avg_calories_day")}
                  </p>
                  <p className="mt-1 text-[22px] font-black text-slate-950" dir="ltr">
                    {weeklySummary.calories.thisWeekAvg}
                    <span className="ms-1 text-[11px] font-bold text-slate-400">{t("progress_kcal_unit")}</span>
                  </p>
                </article>
                <article className="rounded-[18px] bg-sky-50 p-4 text-start">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-sky-700/70">
                    {t("progress_days_logged_label")}
                  </p>
                  <p className="mt-1 text-[22px] font-black text-slate-950" dir="ltr">
                    {weeklySummary.consistency.daysLogged}
                    <span className="text-[13px] font-bold text-slate-400">/7</span>
                  </p>
                  <p className="mt-0.5 text-[11px] font-semibold text-slate-500" dir="ltr">
                    {t("progress_streak_label")} {weeklySummary.consistency.streak}
                  </p>
                </article>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      )}

      <span className="sr-only" aria-hidden="true">
        {PROGRESS_COLORS.calories}
      </span>
    </motion.div>
  );
}
