import type { LucideIcon } from "lucide-react";
import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  CalendarCheck,
  Check,
  ChevronDown,
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
      <div className="mx-auto mt-2 h-1 w-full overflow-hidden rounded-full bg-slate-100 shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)]" dir="ltr">
        <div className="h-full rounded-full" style={{ width: `${metric.value}%`, backgroundColor: metric.color }} />
      </div>
    </article>
  );
}

export function SectionHeader({ title, action, onClick }: { title: string; action?: string; onClick?: () => void }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-[16px] font-black tracking-tight text-slate-900">{title}</h2>
      {action ? (
        <button className="flex items-center gap-1 rounded-full bg-brand-soft px-3 py-1.5 text-[11px] font-bold text-brand transition-all active:scale-95" type="button" onClick={onClick}>
          {action}
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", onClick && "rotate-180")} strokeWidth={2.5} />
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
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, staggerChildren: 0.1 }}
    >
      {!hasEnoughTrendData && (
        <section className="mb-4 flex items-center gap-4 rounded-2xl bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-macro-protein-soft text-macro-protein ring-1 ring-macro-protein/20">
            <TrendingUp className="h-5 w-5" strokeWidth={2.2} />
          </div>
          <div className="min-w-0 flex-1 text-start">
            <div className="flex items-center justify-between gap-3">
              <h2 className="truncate text-[14px] font-black text-slate-900">{t("progress_collecting_title")}</h2>
              <span className="shrink-0 text-[12px] font-black text-macro-protein" dir="ltr">{Math.min(trendLoggedDays, 3)}/3</span>
            </div>
            <p className="mt-1 line-clamp-2 text-[11px] font-medium leading-tight text-slate-500">{t("progress_collecting_desc", { count: trendLoggedDays })}</p>
            <div className="mt-2.5 flex gap-1.5" aria-hidden="true" dir="ltr">
              {[0, 1, 2].map((index) => <span key={index} className={cn("h-1.5 flex-1 rounded-full", index < trendLoggedDays ? "bg-brand" : "bg-slate-100")} />)}
            </div>
          </div>
        </section>
      )}

      <div id="progress-panel-week" role="tabpanel" className="space-y-4">
        {/* Weekly Score Card */}
        <section className={cn(!hasEnoughTrendData && "hidden")}>
          {(() => {
            const pct = weeklySummary?.consistency?.percentage ?? 0;
            const protPct = weeklySummary?.macros?.protein?.percentage ?? 0;
            const waterDays = weekdayData.filter(d => d.waterGlasses >= waterTarget).length;
            const waterPct = Math.round((waterDays / 7) * 100);
            const weekScore = Math.round((pct + protPct + waterPct) / 3);
            const change = weeklySummary?.calories?.changePercent ?? 0;
            const streak = streaks.logging?.currentStreak ?? 0;
            const calTarget2 = activeGoal?.daily_calorie_target ?? 2000;
            const daysLogged2 = weekdayData.filter(d => d.calories > 0).length;
            const scoreColor = weekScore >= 80 ? "#A3E635" : weekScore >= 60 ? "#F97316" : "#FB6B7A";
            const scoreLabel = weekScore >= 80 ? t("progress_excellent_week") : weekScore >= 60 ? t("progress_good_progress_status") : t("progress_keep_going");
            
            return (
              <motion.article className="relative overflow-hidden rounded-[32px] bg-[#0F172A] p-6 shadow-[0_12px_40px_rgba(15,23,42,0.2)] ring-1 ring-slate-800">
                <div className="absolute left-1/2 top-1/2 h-[250px] w-[250px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#22C7A1]/10 blur-3xl" />
                <div className="absolute left-1/4 top-1/4 h-[150px] w-[150px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#7C83F6]/10 blur-3xl" />

                {/* ── Top banner ── */}
                <div className="relative flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="opacity-80">
                      <path d="M12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22" stroke="#22C7A1" strokeWidth="4" strokeLinecap="round" />
                      <path d="M12 22C6.47715 22 2 17.5228 2 12" stroke="#7C83F6" strokeWidth="4" strokeLinecap="round" />
                    </svg>
                    <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">{t("progress_weekly_performance")}</span>
                  </div>
                  {streak > 0 ? (
                    <div className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#F97316] to-[#FB6B7A] px-3 py-1.5 shadow-[0_2px_8px_rgba(249,115,22,0.25)]">
                      <Flame className="h-3.5 w-3.5 text-white" />
                      <span className="text-[11px] font-bold text-white" dir="ltr">{streak}d</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 rounded-full bg-slate-800/80 px-3 py-1.5 ring-1 ring-white/10">
                      <CalendarCheck className="h-3.5 w-3.5 text-slate-400" />
                      <span className="text-[11px] font-bold text-slate-300" dir="ltr">{t("progress_of_seven_days", { count: daysLogged2 })}</span>
                    </div>
                  )}
                </div>

                {/* ── 7-Day Strip ── */}
                <div className="relative mb-6 flex flex-col items-center">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-3">{t("progress_weekly_consistency")}</p>
                  <div className="flex w-full items-end justify-between px-2" dir="ltr">
                    {weekDayKeys.map((dayKey, i) => {
                      const dayData = weekdayData[i];
                      const logged = dayData && dayData.calories > 0;
                      const onTarget = logged && dayData.calories >= calTarget2 * 0.9 && dayData.calories <= calTarget2 * 1.1;
                      const isToday = i === new Date().getDay() - 1 || (new Date().getDay() === 0 && i === 6);
                      
                      const colors = ["#22C7A1", "#7C83F6", "#38BDF8", "#FB6B7A", "#F97316", "#A3E635", "#22C7A1"];
                      const dayColor = colors[i % colors.length];
                      
                      return (
                        <div key={dayKey} className="flex flex-col items-center gap-2">
                          <div 
                            className={cn(
                              "w-2 rounded-full transition-all duration-500",
                              logged ? (onTarget ? "h-8" : "bg-slate-500 h-6") : "bg-slate-800 h-2",
                              isToday && "ring-2 ring-white/20 ring-offset-2 ring-offset-[#0F172A]"
                            )}
                            style={logged && onTarget ? { backgroundColor: dayColor, boxShadow: `0 0 8px ${dayColor}40` } : undefined}
                          />
                          <span className={cn("text-[9px] font-bold uppercase", isToday ? "text-white" : "text-slate-500")}>
                            {t(dayKey).charAt(0)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* ── Score & Trend ── */}
                <div className="relative flex items-center justify-between rounded-2xl bg-slate-800/40 p-4 ring-1 ring-white/5 backdrop-blur-md">
                  <div className="text-start">
                    <div className="flex items-center gap-2">
                      <div
                        className="flex h-6 w-6 items-center justify-center rounded-full"
                        style={{ backgroundColor: `${scoreColor}20`, color: scoreColor }}
                      >
                        {weekScore >= 80 ? <Trophy className="h-3 w-3" /> : weekScore >= 60 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      </div>
                      <p className="text-[14px] font-black text-white">{scoreLabel}</p>
                    </div>
                    <p className="mt-1 text-[11px] font-bold text-slate-400" dir="ltr">
                      {change >= 0 ? `↑ +${Math.round(change)}%` : `↓ ${Math.round(change)}%`} {t("progress_vs_last_week")}
                    </p>
                  </div>
                  <div className="flex flex-col items-end text-end">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-xl text-[14px] font-black text-[#0F172A] shadow-[0_4px_12px_rgba(163,230,53,0.25)]"
                      style={{ backgroundColor: scoreColor, boxShadow: `0 4px 12px ${scoreColor}40` }}
                      dir="ltr"
                    >
                      {weekScore}
                    </div>
                    <p className="mt-1.5 text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">{t("progress_weekly_score")}</p>
                  </div>
                </div>
              </motion.article>
            );
          })()}
        </section>

        {/* ── Metric bars row ── */}
        <section className={cn("grid grid-cols-3 gap-3", !hasEnoughTrendData && "hidden")}>
          {(() => {
            const protPct = weeklySummary?.macros?.protein?.percentage ?? 0;
            const waterDays = weekdayData.filter(d => d.waterGlasses >= waterTarget).length;
            const calAvg = weeklySummary?.calories?.thisWeekAvg ?? 0;
            const calTarget2 = activeGoal?.daily_calorie_target ?? 2000;
            const calPct2 = calTarget2 > 0 ? Math.min(100, Math.round((calAvg / calTarget2) * 100)) : 0;

            return [
              { label: t('calories'), value: `${calPct2}%`, sub: `${calAvg.toLocaleString()} ${t("progress_avg_short")}`, pct: calPct2, color: '#F97316', gradient: 'from-[#F97316] to-[#FB923C]', shadow: 'shadow-[0_8px_20px_-6px_rgba(249,115,22,0.35)]' },
              { label: t('protein'), value: `${protPct}%`, sub: t("of_target"), pct: protPct, color: '#7C83F6', gradient: 'from-[#7C83F6] to-[#636BF4]', shadow: 'shadow-[0_8px_20px_-6px_rgba(124,131,246,0.35)]' },
              { label: t('progress_hydration'), value: `${waterDays}/7`, sub: t("days_met_goal"), pct: Math.round((waterDays / 7) * 100), color: '#38BDF8', gradient: 'from-[#38BDF8] to-[#0891B2]', shadow: 'shadow-[0_8px_20px_-6px_rgba(56,189,248,0.35)]' },
            ].map((m) => (
              <div key={m.label} className={cn("flex flex-col justify-between rounded-[24px] bg-gradient-to-br p-4 text-white ring-1 ring-white/10 transition-transform active:scale-[0.97]", m.gradient, m.shadow)}>
                <div className="flex items-start justify-between">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-[10px] font-black backdrop-blur-sm" dir="ltr">
                    {m.pct}%
                  </span>
                </div>
                <div className="mt-4 text-start">
                  <p className="text-[20px] font-black leading-none tracking-tight" dir="ltr">{m.value}</p>
                  <p className="mt-1 text-[10px] font-bold text-white/70">{m.sub}</p>
                  <p className="mt-1 text-[11px] font-bold text-white/90">{m.label}</p>
                  <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-black/20 shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]" dir="ltr">
                    <div className="h-full rounded-full bg-white transition-all duration-700" style={{ width: `${m.pct}%` }} />
                  </div>
                </div>
              </div>
            ));
          })()}
        </section>

        {/* Your Week - Calendar Grid with Rows */}
        <section className="rounded-[28px] bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-[16px] font-black tracking-tight text-slate-900">{t("progress_your_week")}</h3>
            <div className="flex items-center gap-3 text-[10px] font-bold text-slate-500">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-brand" /> {t("progress_on_track_legend")}</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-orange-400" /> {t("progress_partial_legend")}</span>
            </div>
          </div>
          
          {/* Calendar Grid */}
          <div className="overflow-x-auto pb-2 scrollbar-hide" dir="ltr">
            <table className="w-full text-center">
              <thead>
                <tr>
                  <th className="pb-3 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400 w-20 text-start"></th>
                  {weekDayKeys.map((dayKey) => (
                    <th key={dayKey} className="pb-3 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">{t(dayKey).substring(0, 3)}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {/* Meals Logged Row */}
                <tr>
                  <td className="py-3 text-[11px] font-bold text-slate-600 text-start">{t("progress_meals_logged")}</td>
                  {weekdayData.map((day, i) => {
                    const hasData = day.calories > 0;
                    const onTarget = hasData && day.calories >= calorieTarget * 0.9 && day.calories <= calorieTarget * 1.1;
                    const status = !hasData ? "none" : onTarget ? "on" : "partial";
                    return (
                      <td key={i} className="py-3">
                        <div className="flex flex-col items-center gap-1.5">
                          <div className={`h-7 w-7 rounded-full flex items-center justify-center ring-1 ${status === 'on' ? 'bg-brand-soft ring-brand/20' : status === 'partial' ? 'bg-orange-50 ring-orange-200' : 'bg-slate-50 ring-slate-100'}`}>
                            {status === 'on' ? <Check className="h-3.5 w-3.5 text-brand" strokeWidth={3} /> : status === 'partial' ? <div className="h-2 w-2 rounded-full bg-orange-400" /> : <div className="h-2 w-2 rounded-full bg-slate-300" />}
                          </div>
                          <span className="text-[10px] font-black text-slate-700">{hasData ? day.calories.toLocaleString() : "—"}</span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
                {/* Workouts Row */}
                <tr>
                  <td className="py-3 text-[11px] font-bold text-slate-600 text-start">{t("progress_workouts")}</td>
                  {weekdayData.map((day, i) => (
                    <td key={i} className="py-3">
                      <div className="flex justify-center">
                        <div className={`h-7 w-7 rounded-full flex items-center justify-center ring-1 ${day.hasWorkout ? 'bg-brand-soft ring-brand/20' : 'bg-slate-50 ring-slate-100'}`}>
                          {day.hasWorkout ? <Check className="h-3.5 w-3.5 text-brand" strokeWidth={3} /> : <div className="h-2 w-2 rounded-full bg-slate-300" />}
                        </div>
                      </div>
                    </td>
                  ))}
                </tr>
                {/* Water Goal Row */}
                <tr>
                  <td className="py-3 text-[11px] font-bold text-slate-600 text-start">{t("progress_water_goal")}</td>
                  {weekdayData.map((day, i) => (
                    <td key={i} className="py-3">
                      <div className="flex justify-center">
                        <div className={`h-7 w-7 rounded-full flex items-center justify-center ring-1 ${day.waterGlasses >= waterTarget ? 'bg-macro-water-soft ring-macro-water/20' : 'bg-slate-50 ring-slate-100'}`}>
                          {day.waterGlasses >= waterTarget ? <Check className="h-3.5 w-3.5 text-macro-water" strokeWidth={3} /> : <div className="h-2 w-2 rounded-full bg-slate-300" />}
                        </div>
                      </div>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Nutrient Trends with Line Graphs */}
        <section className="rounded-[28px] bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100">
          <SectionHeader title={t("progress_nutrient_trends")} />
          <div className="grid grid-cols-3 gap-3">
            {/* Calories Trend */}
            <article className="rounded-2xl bg-gradient-to-br from-[#F97316] to-[#FB923C] p-3 text-white shadow-[0_8px_20px_-6px_rgba(249,115,22,0.35)] ring-1 ring-white/10 text-start">
              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/70 mb-1">{t("progress_calories_avg")}</p>
              <p className="text-[20px] font-black tracking-tight" dir="ltr">
                {weeklySummary?.calories.thisWeekAvg.toLocaleString() ?? "—"}<span className="text-[10px] font-bold text-white/70 ml-1">{t("progress_kcal_unit")}</span>
              </p>
              <div className="mt-3 h-10 w-full" dir="ltr">
                <svg className="h-full w-full overflow-visible" viewBox="0 0 80 40" preserveAspectRatio="none">
                  <polyline
                    fill="none"
                    stroke="rgba(255,255,255,0.8)"
                    strokeWidth="2.5"
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
              </div>
              {hasEnoughTrendData ? (
                <div className="mt-2 flex items-center gap-1 text-[10px] font-bold text-white" dir="ltr">
                  {(weeklySummary?.calories.changePercent ?? 0) >= 0 ? <ArrowUp className="h-3 w-3" strokeWidth={2.5} /> : <ArrowDown className="h-3 w-3" strokeWidth={2.5} />}
                  {t("progress_vs_last_week_pct", { change: Math.abs(weeklySummary?.calories.changePercent ?? 0) })}
                </div>
              ) : (
                <p className="mt-2 text-[10px] font-bold text-white/70">{t("progress_trend_days_ready", { count: trendLoggedDays })}</p>
              )}
            </article>
            {/* Protein Trend */}
            <article className="rounded-2xl bg-gradient-to-br from-[#7C83F6] to-[#636BF4] p-3 text-white shadow-[0_8px_20px_-6px_rgba(124,131,246,0.35)] ring-1 ring-white/10 text-start">
              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/70 mb-1">{t("progress_protein_avg")}</p>
              <p className="text-[20px] font-black tracking-tight" dir="ltr">
                {weeklySummary?.macros.protein.consumed ?? "—"}<span className="text-[10px] font-bold text-white/70 ml-1">g</span>
              </p>
              <div className="mt-3 h-10 w-full" dir="ltr">
                <svg className="h-full w-full overflow-visible" viewBox="0 0 80 40" preserveAspectRatio="none">
                  <polyline
                    fill="none"
                    stroke="rgba(255,255,255,0.8)"
                    strokeWidth="2.5"
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
              </div>
              <div className="mt-2 flex items-center gap-1 text-[10px] font-bold text-white" dir="ltr">
                <ArrowUp className="h-3 w-3" strokeWidth={2.5} />
                {t("progress_of_target_pct", { value: weeklySummary?.macros.protein.percentage ?? 0 })}
              </div>
            </article>
            {/* Water Trend */}
            <article className="rounded-2xl bg-gradient-to-br from-[#38BDF8] to-[#0891B2] p-3 text-white shadow-[0_8px_20px_-6px_rgba(56,189,248,0.35)] ring-1 ring-white/10 text-start">
              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/70 mb-1">{t("progress_water_avg")}</p>
              <p className="text-[20px] font-black tracking-tight" dir="ltr">
                {(() => {
                  const avg = weekdayData.length > 0
                    ? weekdayData.reduce((s, d) => s + d.waterGlasses, 0) / weekdayData.length
                    : 0;
                  return <>{avg.toFixed(1)}<span className="text-[10px] font-bold text-white/70 ml-1">{t("progress_glasses")}</span></>;
                })()}
              </p>
              <div className="mt-3 h-10 w-full" dir="ltr">
                <svg className="h-full w-full overflow-visible" viewBox="0 0 80 40" preserveAspectRatio="none">
                  <polyline
                    fill="none"
                    stroke="rgba(255,255,255,0.8)"
                    strokeWidth="2.5"
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
              </div>
              <div className="mt-2 flex items-center gap-1 text-[10px] font-bold text-white" dir="ltr">
                <Check className="h-3 w-3" strokeWidth={2.5} />
                {t("progress_days_hit_goal", { count: weekdayData.filter(d => d.waterGlasses >= waterTarget).length })}
              </div>
            </article>
          </div>
        </section>

        {/* This Week vs Last Week */}
        <section className={cn(!hasEnoughTrendData && "hidden")}>
          <article className="rounded-[28px] bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100">
            <h3 className="mb-4 text-[16px] font-black tracking-tight text-slate-900 text-start">{t("progress_week_vs_last")}</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-macro-carbs-soft text-macro-carbs ring-1 ring-macro-carbs/20">
                    <Flame className="h-4 w-4" strokeWidth={2.2} />
                  </div>
                  <span className="text-[13px] font-bold text-slate-700">{t("progress_calories_compare")}</span>
                </div>
                <span className={cn("text-[13px] font-black", (weeklySummary?.calories.changePercent ?? 0) >= 0 ? 'text-brand' : 'text-macro-fat')} dir="ltr">
                  {(weeklySummary?.calories.changePercent ?? 0) >= 0 ? '+' : ''}{weeklySummary?.calories.changePercent ?? 0}% {(weeklySummary?.calories.trend === 'up' ? '↑' : weeklySummary?.calories.trend === 'down' ? '↓' : '→')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-macro-protein-soft text-macro-protein ring-1 ring-macro-protein/20">
                    <Target className="h-4 w-4" strokeWidth={2.2} />
                  </div>
                  <span className="text-[13px] font-bold text-slate-700">{t("progress_protein_compare")}</span>
                </div>
                <span className="text-[13px] font-black text-macro-protein" dir="ltr">
                  {t("progress_of_target_pct", { value: weeklySummary?.macros.protein.percentage ?? 0 })}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-macro-water-soft text-macro-water ring-1 ring-macro-water/20">
                    <Droplet className="h-4 w-4" strokeWidth={2.2} />
                  </div>
                  <span className="text-[13px] font-bold text-slate-700">{t("progress_water_compare")}</span>
                </div>
                <span className="text-[13px] font-black text-macro-water" dir="ltr">
                  {t("progress_of_seven_days", { count: weekdayData.filter(d => d.waterGlasses >= waterTarget).length })}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-soft text-brand ring-1 ring-brand/20">
                    <TrendingUp className="h-4 w-4" strokeWidth={2.2} />
                  </div>
                  <span className="text-[13px] font-bold text-slate-700">{t("progress_consistency_compare")}</span>
                </div>
                <span className="text-[13px] font-black text-brand" dir="ltr">
                  {weeklySummary?.consistency.percentage ?? 0}% {(weeklySummary?.consistency.percentage ?? 0) >= 70 ? '↑' : '→'}
                </span>
              </div>
            </div>
          </article>
        </section>

        {/* Habit Consistency & Goal Progress */}
        <section className="mb-5">
          <div className={cn("grid gap-3", hasEnoughTrendData ? "grid-cols-2" : "grid-cols-1")}>
            <article className="rounded-[24px] bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100">
              <h3 className="mb-4 text-[14px] font-black tracking-tight text-slate-900 text-start">{t("progress_habit_consistency")}</h3>
              <div className="space-y-4">
                {(() => {
                  const waterDays = weekdayData.filter(d => d.waterGlasses > 0).length;
                  const workoutDays = weekdayData.filter(d => d.hasWorkout).length;
                  const habits = [
                    { label: t('meal_logging_label'), days: weeklySummary?.consistency.daysLogged ?? 0, pct: weeklySummary?.consistency.percentage ?? 0, color: '#F97316' },
                    { label: t('water_tracking_label'), days: waterDays, pct: Math.round((waterDays / 7) * 100), color: '#38BDF8' },
                    { label: t('workouts_label'), days: workoutDays, pct: Math.round((workoutDays / 7) * 100), color: '#7C83F6' },
                  ];
                  return habits.map((habit) => (
                    <div key={habit.label}>
                      <div className="mb-1.5 flex justify-between text-[11px]">
                        <span className="font-bold text-slate-700">{habit.label}</span>
                        <span className="font-black text-slate-400" dir="ltr">{t("progress_of_seven_days", { count: habit.days })}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-100 shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)]" dir="ltr">
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${habit.pct}%`, backgroundColor: habit.color }} />
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </article>
            <article className={cn("rounded-[24px] bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100", !hasEnoughTrendData && "hidden")}>
              <h3 className="mb-4 text-[14px] font-black tracking-tight text-slate-900 text-start">{t("progress_weekly_goal_progress")}</h3>
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
                    <div className="relative mx-auto grid h-24 w-24 place-items-center" dir="ltr">
                      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 96 96">
                        <defs>
                          <linearGradient id="goal-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#22C7A1" />
                            <stop offset="100%" stopColor="#A3E635" />
                          </linearGradient>
                        </defs>
                        <circle cx="48" cy="48" r="40" fill="none" stroke="#F1F5F9" strokeWidth="6" />
                        <circle cx="48" cy="48" r="40" fill="none" stroke="url(#goal-gradient)" strokeLinecap="round" strokeWidth="6" strokeDasharray={`${dash.toFixed(1)} ${(circumference - dash).toFixed(1)}`} className="transition-all duration-1000 ease-out" />
                      </svg>
                      <div className="text-center">
                        <span className="text-[24px] font-black leading-none tracking-tight text-slate-900">{goalPct}%</span>
                        <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">{t("progress_completed")}</p>
                      </div>
                    </div>
                    <div className="mt-5 space-y-2.5">
                      {goals.map((goal) => (
                        <div key={goal.label} className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-slate-600">{goal.label}</span>
                          <div className={`grid h-5 w-5 place-items-center rounded-full ring-1 ${goal.done ? 'bg-brand-soft text-brand ring-brand/20' : 'bg-slate-50 text-slate-300 ring-slate-200'}`}>
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
          <SectionHeader 
            title={t("progress_weekly_performance_title")} 
            action={showWeekDetails ? t("progress_hide_details") : t("progress_view_details")} 
            onClick={() => setShowWeekDetails(!showWeekDetails)} 
          />
          <div className="grid grid-cols-4 gap-3">
            {weeklyMetrics.map((metric) => <MetricRing key={metric.label} metric={metric} />)}
          </div>
          <AnimatePresence>
            {showWeekDetails && weeklySummary && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 grid grid-cols-2 gap-3 overflow-hidden"
              >
                <article className="rounded-[24px] bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100 text-start">
                  <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">{t("progress_avg_calories_day")}</span>
                  <p className="mt-1 text-[28px] font-black tracking-tight text-slate-900" dir="ltr">
                    {weeklySummary.calories.thisWeekAvg}<span className="ml-1 text-[12px] font-bold text-slate-400">{t("progress_kcal_unit")}</span>
                  </p>
                  <span className="mt-1 block text-[11px] font-medium text-slate-500" dir="ltr">vs {weeklySummary.calories.lastWeekAvg} last week</span>
                </article>
                <article className="rounded-[24px] bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100 text-start">
                  <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">{t("progress_days_logged_label")}</span>
                  <p className="mt-1 text-[28px] font-black tracking-tight text-slate-900" dir="ltr">
                    {weeklySummary.consistency.daysLogged}<span className="text-[16px] font-bold text-slate-400">/7</span>
                  </p>
                  <span className="mt-1 block text-[11px] font-medium text-slate-500" dir="ltr">{t("progress_streak_label")} {weeklySummary.consistency.streak}</span>
                </article>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </div>
    </motion.div>
  );
}
