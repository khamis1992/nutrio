import type { LucideIcon } from "lucide-react";
import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  CalendarCheck,
  Check,
  ChevronRight,
  Droplet,
  Flame,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
  Wheat,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNutritionGoals } from "@/hooks/useNutritionGoals";
import { useWeeklySummary } from "@/hooks/useWeeklySummary";
import { useStreak } from "@/hooks/useStreak";
import { useWaterIntake } from "@/hooks/useWaterIntake";
import { useWeekdayData } from "@/hooks/useWeekdayData";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { DualDonut } from "@/components/progress/DualDonut";
import { PROGRESS_COLORS } from "./progress-colors";

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
    <article className="overflow-hidden rounded-[18px] border border-slate-100 bg-white p-2 text-center shadow-[0_14px_28px_rgba(15,23,42,0.06)]">
      <div className="relative mx-auto grid place-items-center" style={{ width: size, height: size }}>
        <svg className="absolute inset-0 -rotate-90" viewBox={`0 0 ${size} ${size}`}>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#EEF2F7" strokeWidth={stroke} />
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
          <span className="text-[16px] font-black leading-none tracking-[-0.04em] text-[#111827]">{metric.value}%</span>
        </div>
      </div>
      <p className="mt-1 truncate text-[10px] font-semibold text-slate-700">{metric.label}</p>
      <p className="mt-0.5 truncate text-[9px] font-medium text-slate-400">{metric.status}</p>
      <div className="mx-auto mt-1.5 h-1 w-full overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full" style={{ width: `${metric.value}%`, backgroundColor: metric.color }} />
      </div>
    </article>
  );
}

export function SectionHeader({ title, action, onClick }: { title: string; action?: string; onClick?: () => void }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-[17px] font-black tracking-[-0.04em] text-[#111827]">{title}</h2>
      {action ? (
        <button className="flex items-center gap-1 text-[13px] font-extrabold text-[#22C7A1]" type="button" onClick={onClick}>
          {action}
          <ChevronRight className="h-4 w-4" strokeWidth={3} />
        </button>
      ) : null}
    </div>
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

  const weeklyMetrics: RingMetric[] = (() => {
    const macros = weeklySummary?.macros;
    const cals = weeklySummary?.calories;
    const calTarget = activeGoal?.daily_calorie_target ?? 2000;
    const calPct = calTarget > 0 ? Math.min(100, Math.round(((cals?.thisWeekAvg ?? 0) / calTarget) * 100)) : 0;
    const getStatus = (pct: number) => (pct >= 80 ? t("progress_excellent") : pct >= 60 ? t("progress_on_track_status") : t("progress_improve"));
    return [
      { label: t("calories"), value: calPct, status: getStatus(calPct), Icon: Flame, color: "#F97316", track: "#FFEDD5" },
      { label: t("protein"), value: macros?.protein?.percentage ?? 0, status: getStatus(macros?.protein?.percentage ?? 0), Icon: Target, color: PROGRESS_COLORS.protein, track: "#F3F4FF" },
      { label: t("carbs"), value: macros?.carbs?.percentage ?? 0, status: getStatus(macros?.carbs?.percentage ?? 0), Icon: Wheat, color: "#F7B731", track: "#FEF3C7" },
      { label: t("fat_label"), value: macros?.fat?.percentage ?? 0, status: getStatus(macros?.fat?.percentage ?? 0), Icon: Droplet, color: PROGRESS_COLORS.fat, track: "#FFF0F2" },
    ];
  })();

  return (
    <>
      {!hasEnoughTrendData && (
        <section className="mb-3 flex items-center gap-3 rounded-[18px] border border-[#E5EAF1] bg-white p-3 shadow-[0_8px_22px_rgba(15,23,42,0.05)]">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-[#F3F4FF] text-[#7C83F6]">
            <TrendingUp className="h-5 w-5" strokeWidth={2.4} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <h2 className="truncate text-[13px] font-black text-[#020617]">{t("progress_collecting_title")}</h2>
              <span className="shrink-0 text-[11px] font-black text-[#7C83F6]">{Math.min(trendLoggedDays, 3)}/3</span>
            </div>
            <p className="mt-0.5 line-clamp-2 text-[11px] font-semibold leading-4 text-[#64748B]">{t("progress_collecting_desc", { count: trendLoggedDays })}</p>
            <div className="mt-2 flex gap-1.5" aria-hidden="true">
              {[0, 1, 2].map((index) => <span key={index} className={cn("h-1.5 flex-1 rounded-full", index < trendLoggedDays ? "bg-[#22C7A1]" : "bg-[#E5EAF1]")} />)}
            </div>
          </div>
        </section>
      )}

      <div id="progress-panel-week" role="tabpanel">
        {/* Weekly Score Card */}
        <section className={cn("mb-5", !hasEnoughTrendData && "hidden")}>
          {(() => {
            const pct = weeklySummary?.consistency?.percentage ?? 0;
            const protPct = weeklySummary?.macros?.protein?.percentage ?? 0;
            const waterDays = weekdayData.filter(d => d.waterGlasses >= waterTarget).length;
            const waterPct = Math.round((waterDays / 7) * 100);
            const weekScore = Math.round((pct + protPct + waterPct) / 3);
            const change = weeklySummary?.calories?.changePercent ?? 0;
            const streak = streaks.logging?.currentStreak ?? 0;
            const calAvg = weeklySummary?.calories?.thisWeekAvg ?? 0;
            const calTarget2 = activeGoal?.daily_calorie_target ?? 2000;
            const calPct2 = calTarget2 > 0 ? Math.min(100, Math.round((calAvg / calTarget2) * 100)) : 0;
            const daysLogged2 = weekdayData.filter(d => d.calories > 0).length;
            const scoreColor = weekScore >= 80 ? PROGRESS_COLORS.calories : weekScore >= 60 ? PROGRESS_COLORS.carbs : PROGRESS_COLORS.fat;
            const scoreLabel = weekScore >= 80 ? t("progress_excellent_week") : weekScore >= 60 ? t("progress_good_progress_status") : t("progress_keep_going");
            return (
              <article className="overflow-hidden rounded-[28px] bg-white shadow-[0_8px_32px_rgba(15,23,42,0.10)] ring-1 ring-slate-100">

                {/* ── Top banner ── */}
                <div className="flex items-center justify-between px-5 pt-4 pb-5">
                  <div>
                    <p className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">{t("progress_this_week")}</p>
                    <p className="text-[15px] font-black text-slate-900">{t("progress_weekly_performance")}</p>
                  </div>
                  {streak > 0 ? (
                    <div className="flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1.5 ring-1 ring-orange-100">
                      <Flame className="h-3.5 w-3.5 text-orange-500" />
                      <span className="text-[12px] font-black text-orange-600">{streak}d</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1.5 ring-1 ring-slate-100">
                      <CalendarCheck className="h-3.5 w-3.5 text-slate-400" />
                      <span className="text-[11px] font-bold text-slate-500">{t("progress_of_seven_days", { count: daysLogged2 })}</span>
                    </div>
                  )}
                </div>

                {/* ── Dual donut + right stats ── */}
                <div className="flex items-center gap-4 px-5 pb-7 pt-1">
                  <DualDonut
                    outerPct={pct}
                    outerColor="#818CF8"
                    innerPct={weekScore}
                    innerColor={scoreColor}
                    centerValue={weekScore}
                    centerUnit={t("progress_score_label")}
                    legend={[
                      { color: PROGRESS_COLORS.protein, label: t("progress_consistency_short") },
                      { color: scoreColor, label: t("progress_score") }
                    ]}
                  />

                  {/* Right stats */}
                  <div className="flex-1 min-w-0 space-y-2.5">
                    {/* Score label */}
                    <div className="rounded-[14px] bg-slate-50 px-3 py-2.5">
                      <p className="text-[9px] font-extrabold uppercase tracking-wide text-slate-400">{t("progress_weekly_score")}</p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-[22px] font-black leading-none" style={{ color: scoreColor }}>{weekScore}</span>
                        <span className="text-[10px] font-bold text-slate-400">/ 100</span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${weekScore}%`, backgroundColor: scoreColor }} />
                      </div>
                    </div>

                    {/* Score badge + trend */}
                    <div className="flex items-center gap-2">
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]"
                        style={{ backgroundColor: `${scoreColor}18` }}
                      >
                        {weekScore >= 80 ? <Trophy className="h-4 w-4" style={{ color: scoreColor }} /> : weekScore >= 60 ? <TrendingUp className="h-4 w-4" style={{ color: scoreColor }} /> : <TrendingDown className="h-4 w-4" style={{ color: scoreColor }} />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-black text-slate-900">{scoreLabel}</p>
                        <p className="text-[9px] text-slate-400">
                          {change >= 0 ? `↑ +${Math.round(change)}%` : `↓ ${Math.round(change)}%`} {t("progress_vs_last_week")}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Divider ── */}
                <div className="mx-5 h-px bg-slate-100" />

                {/* ── Metric bars row ── */}
                <div className="grid grid-cols-3 gap-px bg-slate-100">
                  {[
                    { label: t('calories'), value: `${calPct2}%`, sub: `${calAvg.toLocaleString()} ${t("progress_avg_short")}`, pct: calPct2, color: '#FB923C' },
                    { label: t('protein'), value: `${protPct}%`, sub: t("of_target"), pct: protPct, color: '#818CF8' },
                    { label: t('progress_hydration'), value: `${waterDays}/7`, sub: t("days_met_goal"), pct: Math.round((waterDays / 7) * 100), color: '#38BDF8' },
                  ].map((m) => (
                    <div key={m.label} className="flex flex-col items-center bg-white px-2 py-3">
                      <div className="mb-1.5 h-1 w-full overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${m.pct}%`, backgroundColor: m.color }} />
                      </div>
                      <p className="text-[15px] font-black text-slate-900">{m.value}</p>
                      <p className="mt-0.5 text-[9px] font-semibold text-slate-400">{m.sub}</p>
                      <p className="mt-0.5 text-[9px] font-extrabold uppercase tracking-wide" style={{ color: m.color }}>{m.label}</p>
                    </div>
                  ))}
                </div>

                {/* ── Days logged strip ── */}
                <div className="flex items-center gap-2 px-5 py-3">
                  <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400 shrink-0">{t("progress_days_logged")}</p>
                  <div className="flex flex-1 items-center gap-1">
                    {weekDayKeys.map((dayKey, i) => {
                      const dayData = weekdayData[i];
                      const logged = dayData && dayData.calories > 0;
                      return (
                        <div key={dayKey} className="flex flex-1 flex-col items-center gap-1">
                          <div
                            className="h-4 w-full rounded-full transition-colors duration-300"
                            style={{ backgroundColor: logged ? PROGRESS_COLORS.calories : PROGRESS_COLORS.track }}
                          />
                          <span className="max-w-full truncate text-[8px] font-bold text-slate-400" title={t(dayKey)}>{t(dayKey)}</span>
                        </div>
                      );
                    })}
                  </div>
                  <span className="text-[12px] font-black text-slate-700 shrink-0">{daysLogged2}<span className="text-[10px] font-semibold text-slate-400">/7</span></span>
                </div>

              </article>
            );
          })()}
        </section>

        {/* Your Week - Calendar Grid with Rows */}
        <section className="mb-5">
          <article className="rounded-[20px] border border-slate-100 bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[16px] font-black tracking-[-0.04em] text-slate-900">{t("progress_your_week")}</h3>
              <div className="flex items-center gap-3 text-[10px]">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#22C7A1]" /> {t("progress_on_track_legend")}</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-orange-400" /> {t("progress_partial_legend")}</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-300" /> {t("progress_no_data_legend")}</span>
              </div>
            </div>
            
            {/* Calendar Grid */}
            <div className="overflow-x-auto">
              <table className="w-full text-center">
                <thead>
                  <tr>
                    <th className="pb-2 text-[11px] font-bold text-slate-500 w-20"></th>
                    {weekDayKeys.map((dayKey) => (
                      <th key={dayKey} className="pb-2 text-[11px] font-bold text-slate-500">{t(dayKey)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Meals Logged Row */}
                  <tr>
                    <td className="py-2 text-[10px] font-semibold text-slate-500 text-left">{t("progress_meals_logged")}</td>
                    {weekdayData.map((day, i) => {
                      const hasData = day.calories > 0;
                      const onTarget = hasData && day.calories >= calorieTarget * 0.9 && day.calories <= calorieTarget * 1.1;
                      const status = !hasData ? "none" : onTarget ? "on" : "partial";
                      return (
                        <td key={i} className="py-2">
                          <div className="flex flex-col items-center gap-1">
                            <div className={`h-6 w-6 rounded-full flex items-center justify-center ${status === 'on' ? 'bg-[#EFFFFA]' : status === 'partial' ? 'bg-orange-100' : 'bg-slate-100'}`}>
                              {status === 'on' ? <Check className="h-3 w-3 text-[#22C7A1]" strokeWidth={3} /> : status === 'partial' ? <div className="h-2 w-2 rounded-full bg-orange-400" /> : <div className="h-2 w-2 rounded-full bg-slate-300" />}
                            </div>
                            <span className="text-[9px] font-bold text-slate-600">{hasData ? day.calories.toLocaleString() : "—"}</span>
                            <span className="text-[8px] text-slate-500">kcal</span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                  {/* Workouts Row */}
                  <tr>
                    <td className="py-2 text-[10px] font-semibold text-slate-500 text-left">{t("progress_workouts")}</td>
                    {weekdayData.map((day, i) => (
                      <td key={i} className="py-2">
                        <div className="flex justify-center">
                          <div className={`h-6 w-6 rounded-full flex items-center justify-center ${day.hasWorkout ? 'bg-[#EFFFFA]' : 'bg-slate-100'}`}>
                            {day.hasWorkout ? <Check className="h-3 w-3 text-[#22C7A1]" strokeWidth={3} /> : <div className="h-2 w-2 rounded-full bg-slate-300" />}
                          </div>
                        </div>
                      </td>
                    ))}
                  </tr>
                  {/* Water Goal Row */}
                  <tr>
                    <td className="py-2 text-[10px] font-semibold text-slate-500 text-left">{t("progress_water_goal")}</td>
                    {weekdayData.map((day, i) => (
                      <td key={i} className="py-2">
                        <div className="flex justify-center">
                          <div className={`h-6 w-6 rounded-full flex items-center justify-center ${day.waterGlasses >= waterTarget ? 'bg-[#EFF9FF]' : 'bg-slate-100'}`}>
                            {day.waterGlasses >= waterTarget ? <Check className="h-3 w-3 text-[#38BDF8]" strokeWidth={3} /> : <div className="h-2 w-2 rounded-full bg-slate-300" />}
                          </div>
                        </div>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </article>
        </section>

        {/* Nutrient Trends with Line Graphs */}
        <section className="mb-5">
          <SectionHeader title={t("progress_nutrient_trends")} />
          <div className="grid grid-cols-3 gap-2.5">
            {/* Calories Trend */}
            <article className="rounded-[16px] border border-slate-100 bg-white p-3 shadow-[0_8px_20px_rgba(15,23,42,0.05)]">
              <p className="text-[10px] font-semibold text-slate-500 mb-1">{t("progress_calories_avg")}</p>
              <p className="text-[24px] font-black tracking-[-0.04em] text-slate-900">
                {weeklySummary?.calories.thisWeekAvg.toLocaleString() ?? "—"}<span className="text-[12px] font-semibold text-slate-500 ml-0.5">{t("progress_kcal_unit")}</span>
              </p>
              <svg className="w-full h-10 mt-2" viewBox="0 0 80 40" preserveAspectRatio="none">
                <polyline
                  fill="none"
                  stroke="#F97316"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={(() => {
                    const vals = weekdayData.map(d => d.calories);
                    const max = Math.max(...vals, 1);
                    const xs = [0, 13, 27, 40, 53, 67, 80];
                    return xs.map((x, i) => `${x},${35 - (vals[i] / max) * 30}`).join(" ");
                  })()}
                />
              </svg>
              {hasEnoughTrendData ? (
                <div className="mt-1 flex items-center gap-1 text-[10px] font-bold" style={{ color: (weeklySummary?.calories.changePercent ?? 0) >= 0 ? PROGRESS_COLORS.calories : PROGRESS_COLORS.fat }}>
                  {(weeklySummary?.calories.changePercent ?? 0) >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                  {t("progress_vs_last_week_pct", { change: Math.abs(weeklySummary?.calories.changePercent ?? 0) })}
                </div>
              ) : (
                <p className="mt-1 text-[10px] font-bold text-[#94A3B8]">{t("progress_trend_days_ready", { count: trendLoggedDays })}</p>
              )}
            </article>
            {/* Protein Trend */}
            <article className="rounded-[16px] border border-slate-100 bg-white p-3 shadow-[0_8px_20px_rgba(15,23,42,0.05)]">
              <p className="text-[10px] font-semibold text-slate-500 mb-1">{t("progress_protein_avg")}</p>
              <p className="text-[24px] font-black tracking-[-0.04em] text-slate-900">
                {weeklySummary?.macros.protein.consumed ?? "—"}<span className="text-[12px] font-semibold text-slate-500 ml-0.5">g</span>
              </p>
              <svg className="w-full h-10 mt-2" viewBox="0 0 80 40" preserveAspectRatio="none">
                <polyline
                  fill="none"
                  stroke={PROGRESS_COLORS.protein}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={(() => {
                    const vals = weekdayData.map(d => d.protein);
                    const max = Math.max(...vals, 1);
                    const xs = [0, 13, 27, 40, 53, 67, 80];
                    return xs.map((x, i) => `${x},${35 - (vals[i] / max) * 30}`).join(" ");
                  })()}
                />
              </svg>
              <div className="flex items-center gap-1 text-[10px] font-bold text-[#7C83F6] mt-1">
                <ArrowUp className="h-3 w-3" />
                {t("progress_of_target_pct", { value: weeklySummary?.macros.protein.percentage ?? 0 })}
              </div>
            </article>
            {/* Water Trend */}
            <article className="rounded-[16px] border border-slate-100 bg-white p-3 shadow-[0_8px_20px_rgba(15,23,42,0.05)]">
              <p className="text-[10px] font-semibold text-slate-500 mb-1">{t("progress_water_avg")}</p>
              <p className="text-[24px] font-black tracking-[-0.04em] text-slate-900">
                {(() => {
                  const avg = weekdayData.length > 0
                    ? weekdayData.reduce((s, d) => s + d.waterGlasses, 0) / weekdayData.length
                    : 0;
                  return <>{avg.toFixed(1)}<span className="text-[12px] font-semibold text-slate-500 ml-0.5">{t("progress_glasses")}</span></>;
                })()}
              </p>
              <svg className="w-full h-10 mt-2" viewBox="0 0 80 40" preserveAspectRatio="none">
                <polyline
                  fill="none"
                  stroke={PROGRESS_COLORS.water}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={(() => {
                    const vals = weekdayData.map(d => d.waterGlasses);
                    const max = Math.max(...vals, 1);
                    const xs = [0, 13, 27, 40, 53, 67, 80];
                    return xs.map((x, i) => `${x},${35 - (vals[i] / max) * 30}`).join(" ");
                  })()}
                />
              </svg>
              <div className="flex items-center gap-1 text-[10px] font-bold text-[#38BDF8] mt-1">
                <Check className="h-3 w-3" />
                {t("progress_days_hit_goal", { count: weekdayData.filter(d => d.waterGlasses >= waterTarget).length })}
              </div>
            </article>
          </div>
        </section>

        {/* This Week Highlights - 3 Separate Cards */}
        <section className="mb-5">
          <h3 className="mb-3 text-[14px] font-black text-[#020617]">{t("progress_week_highlights")}</h3>
          <div className="grid grid-cols-3 gap-2">
            <article className="min-w-0 rounded-[20px] border border-[#E5EAF1] bg-white p-2.5 text-center shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
              <div className="grid h-10 w-10 mx-auto place-items-center rounded-full bg-amber-100 mb-2">
                <Trophy className="h-5 w-5 text-amber-600" />
              </div>
              <p className="min-h-[26px] text-[9px] font-black leading-[1.25] text-[#020617]">{t("progress_best_protein")}</p>
              <p className="truncate text-[9px] font-bold text-[#94A3B8]">
                {(() => {
                  const best = weekdayData.reduce((a, b) => b.protein > a.protein ? b : a, weekdayData[0]);
                  return best?.dayLabel ?? "—";
                })()}
              </p>
              <p className="mt-1 truncate text-[15px] font-black leading-none text-[#020617]">
                {(() => {
                  const max = Math.max(...weekdayData.map(d => d.protein));
                  return max > 0 ? `${max} g` : "—";
                })()}
              </p>
            </article>
            <article className="min-w-0 rounded-[20px] border border-[#E5EAF1] bg-white p-2.5 text-center shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
              <div className="grid h-10 w-10 mx-auto place-items-center rounded-full bg-orange-100 mb-2">
                <Flame className="h-5 w-5 text-orange-500" />
              </div>
              <p className="min-h-[26px] text-[9px] font-black leading-[1.25] text-[#020617]">{t("progress_highest_calories")}</p>
              <p className="truncate text-[9px] font-bold text-[#94A3B8]">
                {(() => {
                  const best = weekdayData.reduce((a, b) => b.calories > a.calories ? b : a, weekdayData[0]);
                  return best?.dayLabel ?? "—";
                })()}
              </p>
              <p className="mt-1 truncate text-[15px] font-black leading-none text-[#020617]">
                {(() => {
                  const max = Math.max(...weekdayData.map(d => d.calories));
                  return max > 0 ? `${max.toLocaleString()} kcal` : "—";
                })()}
              </p>
            </article>
            <article className="min-w-0 rounded-[20px] border border-[#E5EAF1] bg-white p-2.5 text-center shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
              <div className="grid h-10 w-10 mx-auto place-items-center rounded-full bg-[#EFF9FF] mb-2">
                <Droplet className="h-5 w-5 text-[#38BDF8]" />
              </div>
              <p className="min-h-[26px] text-[9px] font-black leading-[1.25] text-[#020617]">{t("progress_most_hydrated")}</p>
              <p className="truncate text-[9px] font-bold text-[#94A3B8]">
                {(() => {
                  const best = weekdayData.reduce((a, b) => b.waterGlasses > a.waterGlasses ? b : a, weekdayData[0]);
                  return best?.dayLabel ?? "—";
                })()}
              </p>
              <p className="mt-1 truncate text-[15px] font-black leading-none text-[#020617]">
                {(() => {
                  const max = Math.max(...weekdayData.map(d => d.waterGlasses));
                  return max > 0 ? `${Number(max.toFixed(1)).toString()} ${t("progress_glasses")}` : "—";
                })()}
              </p>
            </article>
          </div>
        </section>

        {/* This Week vs Last Week */}
        <section className={cn("mb-5", !hasEnoughTrendData && "hidden")}>
          <article className="rounded-[18px] border border-slate-100 bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
            <h3 className="text-[13px] font-black text-slate-800 mb-3">{t("progress_week_vs_last")}</h3>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Flame className="h-4 w-4" style={{ color: '#F97316' }} />
                  <span className="text-[11px] font-semibold text-slate-600">{t("progress_calories_compare")}</span>
                </div>
                <span className={`text-[11px] font-bold ${(weeklySummary?.calories.changePercent ?? 0) >= 0 ? 'text-[#22C7A1]' : 'text-[#FB6B7A]'}`}>
                  {(weeklySummary?.calories.changePercent ?? 0) >= 0 ? '+' : ''}{weeklySummary?.calories.changePercent ?? 0}% {(weeklySummary?.calories.trend === 'up' ? '↑' : weeklySummary?.calories.trend === 'down' ? '↓' : '→')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4" style={{ color: PROGRESS_COLORS.protein }} />
                  <span className="text-[11px] font-semibold text-slate-600">{t("progress_protein_compare")}</span>
                </div>
                <span className="text-[11px] font-bold text-[#7C83F6]">
                  {t("progress_of_target_pct", { value: weeklySummary?.macros.protein.percentage ?? 0 })}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Droplet className="h-4 w-4" style={{ color: PROGRESS_COLORS.water }} />
                  <span className="text-[11px] font-semibold text-slate-600">{t("progress_water_compare")}</span>
                </div>
                <span className="text-[11px] font-bold text-[#38BDF8]">
                  {t("progress_of_seven_days", { count: weekdayData.filter(d => d.waterGlasses >= waterTarget).length })}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" style={{ color: PROGRESS_COLORS.calories }} />
                  <span className="text-[11px] font-semibold text-slate-600">{t("progress_consistency_compare")}</span>
                </div>
                <span className="text-[11px] font-bold text-[#22C7A1]">
                  {weeklySummary?.consistency.percentage ?? 0}% {(weeklySummary?.consistency.percentage ?? 0) >= 70 ? '↑' : '→'}
                </span>
              </div>
            </div>
          </article>
        </section>

        {/* Habit Consistency & Goal Progress */}
        <section className="mb-5">
          <div className={cn("grid gap-3", hasEnoughTrendData ? "grid-cols-2" : "grid-cols-1")}>
            <article className="rounded-[18px] border border-slate-100 bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
              <h3 className="text-[13px] font-black text-slate-800 mb-3">{t("progress_habit_consistency")}</h3>
              <div className="space-y-3">
                {(() => {
                  const waterDays = weekdayData.filter(d => d.waterGlasses > 0).length;
                  const workoutDays = weekdayData.filter(d => d.hasWorkout).length;
                  const habits = [
                    { label: t('meal_logging_label'), days: weeklySummary?.consistency.daysLogged ?? 0, pct: weeklySummary?.consistency.percentage ?? 0, color: PROGRESS_COLORS.calories },
                    { label: t('water_tracking_label'), days: waterDays, pct: Math.round((waterDays / 7) * 100), color: PROGRESS_COLORS.water },
                    { label: t('workouts_label'), days: workoutDays, pct: Math.round((workoutDays / 7) * 100), color: PROGRESS_COLORS.protein },
                  ];
                  return habits.map((habit) => (
                    <div key={habit.label}>
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="font-semibold text-slate-600">{habit.label}</span>
                        <span className="font-bold text-slate-500">{t("progress_of_seven_days", { count: habit.days })}</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100">
                        <div className="h-full rounded-full" style={{ width: `${habit.pct}%`, backgroundColor: habit.color }} />
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </article>
            <article className={cn("rounded-[18px] border border-slate-100 bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]", !hasEnoughTrendData && "hidden")}>
              <h3 className="text-[13px] font-black text-slate-800 mb-2">{t("progress_weekly_goal_progress")}</h3>
              {(() => {
                const calOnTarget = weeklySummary && Math.abs(weeklySummary.calories.thisWeekAvg - (activeGoal?.daily_calorie_target ?? 2000)) <= 200;
                const proteinOnTarget = (weeklySummary?.macros.protein.percentage ?? 0) >= 80;
                const waterOnTarget = weekdayData.filter(d => d.waterGlasses >= waterTarget).length >= 4;
                const activityOnTarget = weekdayData.filter(d => d.hasWorkout).length >= 3;
                const goals = [
                  { label: t('calories_goal'), done: calOnTarget },
                  { label: t('protein_goal_label'), done: proteinOnTarget },
                  { label: t('water_goal'), done: waterOnTarget },
                  { label: t('activity_goal'), done: activityOnTarget },
                ];
                const doneCount = goals.filter(g => g.done).length;
                const goalPct = Math.round((doneCount / goals.length) * 100);
                const circumference = 2 * Math.PI * 40;
                const dash = (goalPct / 100) * circumference;
                return (
                  <>
                    <div className="relative grid h-24 w-24 mx-auto place-items-center">
                      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 96 96">
                        <circle cx="48" cy="48" r="40" fill="none" stroke="#EEF2F7" strokeWidth="6" />
                        <circle cx="48" cy="48" r="40" fill="none" stroke={PROGRESS_COLORS.calories} strokeLinecap="round" strokeWidth="6" strokeDasharray={`${dash.toFixed(1)} ${(circumference - dash).toFixed(1)}`} />
                      </svg>
                      <div className="text-center">
                        <span className="text-[22px] font-black text-slate-900">{goalPct}%</span>
                        <p className="text-[9px] font-semibold text-slate-500">{t("progress_completed")}</p>
                      </div>
                    </div>
                    <div className="mt-3 space-y-1.5">
                      {goals.map((goal) => (
                        <div key={goal.label} className="flex items-center justify-between text-[10px]">
                          <span className="font-semibold text-slate-600">{goal.label}</span>
                          <div className={`grid h-5 w-5 place-items-center rounded-full ${goal.done ? 'bg-[#EFFFFA] text-[#22C7A1]' : 'border border-slate-200 text-slate-300'}`}>
                            {goal.done ? <Check className="h-3 w-3" strokeWidth={3} /> : <span className="text-[8px]">○</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}
            </article>
          </div>
        </section>

        <section className="mb-5">
          <SectionHeader action={showWeekDetails ? t("progress_hide_details") : t("progress_view_details")} title={t("progress_weekly_performance_title")} onClick={() => setShowWeekDetails(!showWeekDetails)} />
          <div className="grid grid-cols-4 gap-2.5">
            {weeklyMetrics.map((metric) => <MetricRing key={metric.label} metric={metric} />)}
          </div>
          {showWeekDetails && weeklySummary && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <article className="rounded-[16px] border border-slate-100 bg-white px-3 py-2.5 shadow-[0_8px_20px_rgba(15,23,42,0.04)]">
                <span className="text-[11px] font-semibold text-slate-500">{t("progress_avg_calories_day")}</span>
                <p className="text-[26px] font-black tracking-[-0.05em] text-slate-950">{weeklySummary.calories.thisWeekAvg}<span className="ml-1 text-[11px] font-bold text-slate-500">{t("progress_kcal_unit")}</span></p>
                <span className="text-[10px] font-semibold text-slate-500">vs {weeklySummary.calories.lastWeekAvg} last week</span>
              </article>
              <article className="rounded-[16px] border border-slate-100 bg-white px-3 py-2.5 shadow-[0_8px_20px_rgba(15,23,42,0.04)]">
                <span className="text-[11px] font-semibold text-slate-500">{t("progress_days_logged_label")}</span>
                <p className="text-[26px] font-black tracking-[-0.05em] text-slate-950">{weeklySummary.consistency.daysLogged}<span className="text-slate-500">/7</span></p>
                <span className="text-[10px] font-semibold text-slate-500">{t("progress_streak_label")} {weeklySummary.consistency.streak}</span>
              </article>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
