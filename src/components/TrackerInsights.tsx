import { useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  eachDayOfInterval,
  eachMonthOfInterval,
  endOfMonth,
  endOfYear,
  format,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subMonths,
  subWeeks,
  subYears,
} from "date-fns";
import {
  Activity,
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Droplets,
  Flame,
  Footprints,
  Scale,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Dot,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { motion } from "framer-motion";

import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface WeightEntry {
  log_date: string;
  weight_kg: number | null;
}

interface Props {
  userId: string | undefined;
  stepGoal: number;
  waterTargetMl: number;
  waterMl: number;
  measurements: WeightEntry[];
  bmi: number | null;
  bmiLabel: string | null;
  profile: {
    height_cm?: number | null;
    target_weight_kg?: number | null;
    current_weight_kg?: number | null;
  } | null;
}

type Period = "Weekly" | "Monthly" | "Yearly";

type ActivityPoint = {
  day: string;
  date?: string;
  steps: number;
  cal: number;
  weight?: number | null;
};

const periods: Period[] = ["Weekly", "Monthly", "Yearly"];

function getStepsForDate(userId: string | undefined, dateStr: string): number {
  return parseInt(localStorage.getItem(`tracker_steps_${userId}_${dateStr}`) || "0", 10);
}

function compactNumber(value: number): string {
  return Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function metricDelta(current: number, previous: number): number {
  if (!previous) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function LegendItem({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-3 w-3 rounded-sm", dashed && "h-0 w-5 border-t-2 border-dashed")} style={dashed ? { borderColor: color } : { backgroundColor: color }} />
      {label}
    </span>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-[160px] flex-col items-center justify-center rounded-2xl bg-slate-50 px-6 text-center ring-1 ring-slate-100/50">
      <Sparkles className="h-5 w-5 text-slate-300" />
      <p className="mt-2 text-[12px] font-medium text-slate-500">{label}</p>
    </div>
  );
}

function BmiGauge({ bmi, label, t }: { bmi: number; label: string; t: (key: string) => string }) {
  const clamped = Math.max(15, Math.min(40, bmi));
  const pct = ((clamped - 15) / 25) * 100;
  const markerLeft = `calc(${pct}% - 8px)`;
  const tone = bmi < 18.5 ? "bg-macro-water" : bmi < 25 ? "bg-brand" : bmi < 30 ? "bg-macro-carbs" : "bg-macro-fat";

  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div className="text-start">
          <p className="text-[32px] font-black leading-none tracking-tight text-slate-900" dir="ltr">{bmi.toFixed(1)}</p>
          <p className="mt-1 text-[11px] font-bold text-slate-400" dir="ltr">{t("bmi")} kg/m²</p>
        </div>
        <span className={cn("rounded-full px-2 py-1 text-[10px] font-bold text-white shadow-sm", tone)}>{label}</span>
      </div>

      <div className="relative mt-5" dir="ltr">
        <div className="flex h-2 overflow-hidden rounded-full shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)]">
          <div className="flex-1 bg-macro-water" />
          <div className="flex-1 bg-brand" />
          <div className="flex-1 bg-macro-carbs" />
          <div className="flex-1 bg-macro-fat" />
        </div>
        <motion.div
          className="absolute -top-1.5 h-5 w-3 rounded-full bg-white shadow-[0_2px_8px_rgba(15,23,42,0.15)] ring-1 ring-slate-200"
          initial={{ left: 0 }}
          animate={{ left: markerLeft }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>

      <div className="mt-2 flex justify-between text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400" dir="ltr">
        <span>15</span>
        <span>22.5</span>
        <span>30</span>
        <span>40</span>
      </div>
    </div>
  );
}

export function TrackerInsights({ userId, stepGoal, waterTargetMl, waterMl, measurements, bmi, bmiLabel, profile }: Props) {
  const { t, isRTL } = useLanguage();
  const [period, setPeriod] = useState<Period>("Weekly");
  const [weekRef, setWeekRef] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [monthRef, setMonthRef] = useState(() => startOfMonth(new Date()));
  const [yearRef, setYearRef] = useState(() => startOfYear(new Date()));
  const todayStr = format(new Date(), "yyyy-MM-dd");

  const weekDays = useMemo<ActivityPoint[]>(
    () => Array.from({ length: 7 }, (_, i) => {
      const d = addDays(weekRef, i);
      const date = format(d, "yyyy-MM-dd");
      const steps = getStepsForDate(userId, date);
      return { day: format(d, "EEE"), date, steps, cal: Math.round(steps * 0.04) };
    }),
    [userId, weekRef]
  );

  const monthDays = useMemo<ActivityPoint[]>(
    () => eachDayOfInterval({ start: monthRef, end: endOfMonth(monthRef) }).map((d) => {
      const date = format(d, "yyyy-MM-dd");
      const steps = getStepsForDate(userId, date);
      return { day: format(d, "d"), date, steps, cal: Math.round(steps * 0.04) };
    }),
    [userId, monthRef]
  );

  const yearMonths = useMemo<ActivityPoint[]>(
    () => eachMonthOfInterval({ start: yearRef, end: endOfYear(yearRef) }).map((m) => {
      const days = eachDayOfInterval({ start: m, end: endOfMonth(m) });
      const steps = days.reduce((sum, d) => sum + getStepsForDate(userId, format(d, "yyyy-MM-dd")), 0);
      const monthWeight = measurements.filter((entry) => entry.log_date.startsWith(format(m, "yyyy-MM")));
      return {
        day: format(m, "MMM"),
        steps,
        cal: Math.round(steps * 0.04),
        weight: monthWeight.length
          ? monthWeight.reduce((sum, entry) => sum + (entry.weight_kg ?? 0), 0) / monthWeight.length
          : null,
      };
    }),
    [measurements, userId, yearRef]
  );

  const chartData = period === "Weekly" ? weekDays : period === "Monthly" ? monthDays : yearMonths;
  const dateLabel = period === "Weekly"
    ? `${format(weekRef, "MMM d")} - ${format(addDays(weekRef, 6), "MMM d, yyyy")}`
    : period === "Monthly"
      ? format(monthRef, "MMMM yyyy")
      : format(yearRef, "yyyy");

  const previousPeriod = () => {
    if (period === "Weekly") setWeekRef(subWeeks(weekRef, 1));
    if (period === "Monthly") setMonthRef(subMonths(monthRef, 1));
    if (period === "Yearly") setYearRef(subYears(yearRef, 1));
  };

  const nextPeriod = () => {
    if (period === "Weekly") setWeekRef(addWeeks(weekRef, 1));
    if (period === "Monthly") setMonthRef(addMonths(monthRef, 1));
    if (period === "Yearly") setYearRef(addYears(yearRef, 1));
  };

  const periodLabels = [t("weekly"), t("monthly"), t("yearly")];
  const waterData = chartData.map((d) => ({ day: d.day, water: d.date === todayStr ? waterMl : 0 }));
  const weightData = useMemo(() => {
    if (period === "Weekly") {
      const start = format(weekRef, "yyyy-MM-dd");
      const end = format(addDays(weekRef, 6), "yyyy-MM-dd");
      return measurements
        .filter((entry) => entry.log_date >= start && entry.log_date <= end)
        .map((entry) => ({ day: format(new Date(entry.log_date), "EEE"), weight: entry.weight_kg ?? 0 }))
        .reverse();
    }

    if (period === "Monthly") {
      return measurements
        .filter((entry) => entry.log_date.startsWith(format(monthRef, "yyyy-MM")))
        .map((entry) => ({ day: format(new Date(entry.log_date), "d"), weight: entry.weight_kg ?? 0 }))
        .reverse();
    }

    return yearMonths.filter((entry) => entry.weight !== null).map((entry) => ({ day: entry.day, weight: entry.weight ?? 0 }));
  }, [measurements, monthRef, period, weekRef, yearMonths]);

  const totalSteps = chartData.reduce((sum, point) => sum + point.steps, 0);
  const activeDays = chartData.filter((point) => point.steps > 0).length;
  const avgSteps = chartData.length ? Math.round(totalSteps / chartData.length) : 0;
  const totalCalories = chartData.reduce((sum, point) => sum + point.cal, 0);
  const goalHits = chartData.filter((point) => point.steps >= stepGoal).length;
  const goalRate = chartData.length ? Math.round((goalHits / chartData.length) * 100) : 0;
  const waterPct = Math.min(100, Math.round((waterMl / Math.max(1, waterTargetMl)) * 100));
  const todaySteps = getStepsForDate(userId, todayStr);
  const todayStepsPct = Math.min(100, Math.round((todaySteps / Math.max(1, stepGoal)) * 100));
  const firstWeight = measurements[measurements.length - 1]?.weight_kg ?? null;
  const latestWeight = measurements[0]?.weight_kg ?? profile?.current_weight_kg ?? null;
  const weightDelta = firstWeight != null && latestWeight != null ? latestWeight - firstWeight : null;
  const previousWindowSteps = period === "Weekly"
    ? Array.from({ length: 7 }, (_, i) => getStepsForDate(userId, format(addDays(subWeeks(weekRef, 1), i), "yyyy-MM-dd"))).reduce((sum, steps) => sum + steps, 0)
    : 0;
  const weeklyDelta = period === "Weekly" ? metricDelta(totalSteps, previousWindowSteps) : null;

  const hasActivityData = chartData.some((point) => point.steps > 0);
  const hasWaterData = waterMl > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, staggerChildren: 0.1 }}
      className="space-y-5"
    >
      {/* ── Period Switcher ── */}
      <div className="flex flex-col items-center gap-4">
        <div className="flex w-full gap-6 border-b border-slate-200/60">
          {periods.map((item, index) => (
            <button
              key={item}
              onClick={() => setPeriod(item)}
              className={cn(
                "relative flex-1 pb-3 text-[14px] font-bold transition-colors",
                period === item ? "text-slate-900" : "text-slate-400 hover:text-slate-600"
              )}
            >
              {periodLabels[index]}
              {period === item && (
                <motion.div layoutId="insights-period-indicator" className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full bg-brand" />
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <button onClick={previousPeriod} className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-600 transition-all hover:bg-slate-100 active:scale-95" aria-label={t("previous_period")}>
            <ChevronLeft className={cn("h-4 w-4", isRTL && "rotate-180")} />
          </button>
          <div className="flex items-center gap-2 text-[13px] font-bold text-slate-800">
            <CalendarDays className="h-4 w-4 text-slate-400" />
            <span dir="ltr">{dateLabel}</span>
          </div>
          <button onClick={nextPeriod} className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-600 transition-all hover:bg-slate-100 active:scale-95" aria-label={t("next_period")}>
            <ChevronRight className={cn("h-4 w-4", isRTL && "rotate-180")} />
          </button>
        </div>
      </div>

      {/* ── Summary Hero ── */}
      <motion.section className="relative overflow-hidden rounded-[32px] bg-[#0F172A] p-6 shadow-[0_8px_32px_rgba(15,23,42,0.12)] ring-1 ring-slate-800">
        <div className="absolute left-1/2 top-1/2 h-[200px] w-[200px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/10 blur-3xl" />
        
        <div className="relative flex flex-col items-center text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{t("progress_insights")}</p>
          <div className="mt-2 flex items-baseline justify-center gap-1">
            <span className="bg-gradient-to-br from-white to-slate-400 bg-clip-text text-[48px] font-black leading-none tracking-tight text-transparent" dir="ltr">{goalRate}%</span>
          </div>
          <p className="mt-2 text-[12px] font-medium text-slate-400">
            {activeDays > 0
              ? t("tracker_active_days_summary", { days: activeDays, steps: compactNumber(totalSteps) })
              : t("tracker_empty_insights")}
          </p>

          <div className="mt-6 flex w-full justify-between border-t border-white/10 pt-5">
            <div className="flex flex-col items-center">
              <p className="text-[16px] font-black text-white" dir="ltr">{goalRate}%</p>
              <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.1em] text-brand">{t("goal_hit")}</p>
            </div>
            <div className="flex flex-col items-center">
              <p className="text-[16px] font-black text-white" dir="ltr">{compactNumber(avgSteps)}</p>
              <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.1em] text-macro-protein">{t("avg_steps")}</p>
            </div>
            <div className="flex flex-col items-center">
              <p className="text-[16px] font-black text-white" dir="ltr">{compactNumber(totalCalories)}</p>
              <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.1em] text-macro-carbs">kcal</p>
            </div>
          </div>
        </div>
      </motion.section>

      {/* ── Featured Chart: Steps ── */}
      <section className="rounded-[28px] bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Footprints className="h-4 w-4 text-macro-protein" />
            <span className="text-[14px] font-bold text-slate-900">{t("steps")}</span>
          </div>
        </div>
        {hasActivityData ? (
          <div dir="ltr">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ left: -22, right: 12, top: 8, bottom: 0 }} barSize={period === "Monthly" ? 7 : 20}>
                <defs>
                  <linearGradient id="steps-bar-gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7C83F6" />
                    <stop offset="100%" stopColor="#9399F8" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#94a3b8", fontWeight: 700 }} />
                <YAxis hide />
                <Tooltip 
                  formatter={(value: number) => [`${value.toLocaleString()}`, t("steps")]} 
                  cursor={{ fill: "#F8FAFC" }}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #F1F5F9', boxShadow: '0 4px 12px rgba(15,23,42,0.08)', fontWeight: 'bold', fontSize: '12px' }}
                />
                <ReferenceLine y={stepGoal} stroke="#7C83F6" strokeDasharray="4 4" strokeWidth={1.5} opacity={0.5} />
                <Bar dataKey="steps" fill="url(#steps-bar-gradient)" radius={[4, 4, 0, 0]} activeBar={{ fill: "#636BF4" }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyChart label={t("no_step_data_period")} />
        )}
        <div className="mt-2 flex flex-wrap items-center gap-4 text-[11px] font-bold text-slate-500" dir="ltr">
          <LegendItem color="#7C83F6" label={t("steps")} />
          <LegendItem color="#7C83F6" label={t("step_goal")} dashed />
        </div>
      </section>

      {/* ── Stat Grid 2x2 ── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col justify-between rounded-[24px] bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100">
          <div className="flex items-start justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-macro-protein-soft text-macro-protein ring-1 ring-macro-protein/20">
              <Footprints className="h-5 w-5" strokeWidth={2.2} />
            </div>
            <span className="text-[11px] font-bold text-slate-400" dir="ltr">{goalRate}%</span>
          </div>
          <div className="mt-4 text-start">
            <p className="text-[24px] font-black leading-none tracking-tight text-slate-900" dir="ltr">{compactNumber(totalSteps)}</p>
            <p className="mt-1 text-[11px] font-bold text-slate-400">{t("steps")}</p>
            <p className="mt-2 text-[10px] font-medium text-slate-500">{t("goal_days_reached", { current: goalHits, total: chartData.length })}</p>
            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-slate-100">
              <motion.div className="h-full rounded-full bg-macro-protein" initial={{ width: 0 }} animate={{ width: `${goalRate}%` }} transition={{ duration: 1 }} />
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-[24px] bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100">
          <div className="flex items-start justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-macro-water-soft text-macro-water ring-1 ring-macro-water/20">
              <Droplets className="h-5 w-5" strokeWidth={2.2} />
            </div>
            <span className="text-[11px] font-bold text-slate-400" dir="ltr">{waterPct}%</span>
          </div>
          <div className="mt-4 text-start">
            <p className="text-[24px] font-black leading-none tracking-tight text-slate-900" dir="ltr">{waterPct}%</p>
            <p className="mt-1 text-[11px] font-bold text-slate-400">{t("water")}</p>
            <p className="mt-2 text-[10px] font-medium text-slate-500">{t("water_today_summary", { current: waterMl.toLocaleString(), target: waterTargetMl.toLocaleString() })}</p>
            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-slate-100">
              <motion.div className="h-full rounded-full bg-macro-water" initial={{ width: 0 }} animate={{ width: `${waterPct}%` }} transition={{ duration: 1 }} />
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-[24px] bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100">
          <div className="flex items-start justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft text-brand ring-1 ring-brand/20">
              <Target className="h-5 w-5" strokeWidth={2.2} />
            </div>
            <span className="text-[11px] font-bold text-slate-400" dir="ltr">{todayStepsPct}%</span>
          </div>
          <div className="mt-4 text-start">
            <p className="text-[24px] font-black leading-none tracking-tight text-slate-900" dir="ltr">{todayStepsPct}%</p>
            <p className="mt-1 text-[11px] font-bold text-slate-400">{t("today")}</p>
            <p className="mt-2 text-[10px] font-medium text-slate-500">{t("steps_goal_summary", { current: todaySteps.toLocaleString(), target: stepGoal.toLocaleString() })}</p>
            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-slate-100">
              <motion.div className="h-full rounded-full bg-brand" initial={{ width: 0 }} animate={{ width: `${todayStepsPct}%` }} transition={{ duration: 1 }} />
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-[24px] bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100">
          <div className="flex items-start justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft text-brand ring-1 ring-brand/20">
              <Scale className="h-5 w-5" strokeWidth={2.2} />
            </div>
          </div>
          <div className="mt-4 text-start">
            <p className="text-[24px] font-black leading-none tracking-tight text-slate-900" dir="ltr">{latestWeight != null ? `${latestWeight.toFixed(1)}` : "--"}</p>
            <p className="mt-1 text-[11px] font-bold text-slate-400">{t("weight")}</p>
            <p className="mt-2 text-[10px] font-medium text-slate-500">{weightDelta != null ? t("weight_delta_overall", { value: `${weightDelta > 0 ? "+" : ""}${weightDelta.toFixed(1)}` }) : t("log_more_weight")}</p>
          </div>
        </div>
      </div>

      {/* ── Momentum ── */}
      {weeklyDelta !== null && (
        <div className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100">
          <div className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-1",
            weeklyDelta >= 0 ? "bg-brand-soft text-brand ring-brand/20" : "bg-macro-fat-soft text-macro-fat ring-macro-fat/20"
          )}>
            {weeklyDelta >= 0 ? <TrendingUp className="h-5 w-5" strokeWidth={2.5} /> : <TrendingDown className="h-5 w-5" strokeWidth={2.5} />}
          </div>
          <div className="min-w-0 flex-1 text-start">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{t("weekly_momentum")}</p>
            <p className="mt-0.5 text-[14px] font-black leading-tight tracking-tight text-slate-900" dir="ltr">
              {t("vs_previous_week", { value: `${weeklyDelta >= 0 ? "+" : ""}${weeklyDelta}` })}
            </p>
          </div>
        </div>
      )}

      {/* ── Secondary Charts ── */}
      <div className="space-y-4 pt-2">
        <section className="rounded-[28px] bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-macro-carbs" />
              <span className="text-[14px] font-bold text-slate-900">{t("calorie_kcal")}</span>
            </div>
          </div>
          {hasActivityData ? (
            <div dir="ltr">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{ left: -22, right: 12, top: 8, bottom: 0 }} barSize={period === "Monthly" ? 7 : 20}>
                  <defs>
                    <linearGradient id="cal-bar-gradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#F97316" />
                      <stop offset="100%" stopColor="#FB923C" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#94a3b8", fontWeight: 700 }} />
                  <YAxis hide />
                  <Tooltip 
                    formatter={(value: number) => [`${value} kcal`, t("calories")]} 
                    cursor={{ fill: "#F8FAFC" }}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #F1F5F9', boxShadow: '0 4px 12px rgba(15,23,42,0.08)', fontWeight: 'bold', fontSize: '12px' }}
                  />
                  <ReferenceLine y={Math.round(stepGoal * 0.04)} stroke="#F97316" strokeDasharray="4 4" strokeWidth={1.5} opacity={0.5} />
                  <Bar dataKey="cal" fill="url(#cal-bar-gradient)" radius={[4, 4, 0, 0]} activeBar={{ fill: "#EA580C" }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyChart label={t("calories_after_steps_tracked")} />
          )}
          <div className="mt-2 flex flex-wrap items-center gap-4 text-[11px] font-bold text-slate-500" dir="ltr">
            <LegendItem color="#F97316" label={t("calorie")} />
            <LegendItem color="#F97316" label={t("calorie_intake_goal")} dashed />
          </div>
        </section>

        <section className="rounded-[28px] bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Droplets className="h-4 w-4 text-macro-water" />
              <span className="text-[14px] font-bold text-slate-900">{t("water_ml")}</span>
            </div>
          </div>
          {hasWaterData ? (
            <div dir="ltr">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={waterData} margin={{ left: -22, right: 12, top: 8, bottom: 0 }} barSize={period === "Monthly" ? 7 : 20}>
                  <defs>
                    <linearGradient id="water-bar-gradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#38BDF8" />
                      <stop offset="100%" stopColor="#7DD3FC" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#94a3b8", fontWeight: 700 }} />
                  <YAxis hide />
                  <Tooltip 
                    formatter={(value: number) => [`${value} mL`, t("water")]} 
                    cursor={{ fill: "#F8FAFC" }}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #F1F5F9', boxShadow: '0 4px 12px rgba(15,23,42,0.08)', fontWeight: 'bold', fontSize: '12px' }}
                  />
                  <ReferenceLine y={waterTargetMl} stroke="#38BDF8" strokeDasharray="4 4" strokeWidth={1.5} opacity={0.5} />
                  <Bar dataKey="water" fill="url(#water-bar-gradient)" radius={[4, 4, 0, 0]} activeBar={{ fill: "#0EA5E9" }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyChart label={t("hydration_after_water_log")} />
          )}
          <div className="mt-2 flex flex-wrap items-center gap-4 text-[11px] font-bold text-slate-500" dir="ltr">
            <LegendItem color="#38BDF8" label={t("water")} />
            <LegendItem color="#38BDF8" label={t("water_intake_goal")} dashed />
          </div>
        </section>

        <section className="rounded-[28px] bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scale className="h-4 w-4 text-brand" />
              <span className="text-[14px] font-bold text-slate-900">{t("weight_kg")}</span>
            </div>
          </div>
          {weightData.length >= 2 ? (
            <div dir="ltr">
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={weightData} margin={{ left: -22, right: 12, top: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#94a3b8", fontWeight: 700 }} />
                  <YAxis hide domain={["auto", "auto"]} />
                  <Tooltip 
                    formatter={(value: number) => [`${value.toFixed(1)} kg`, t("weight")]}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #F1F5F9', boxShadow: '0 4px 12px rgba(15,23,42,0.08)', fontWeight: 'bold', fontSize: '12px' }}
                  />
                  {profile?.target_weight_kg && <ReferenceLine y={profile.target_weight_kg} stroke="#22C7A1" strokeDasharray="4 4" strokeWidth={1.5} opacity={0.5} />}
                  <Line type="monotone" dataKey="weight" stroke="#22C7A1" strokeWidth={3} dot={<Dot r={4} fill="#22C7A1" stroke="#fff" strokeWidth={2} />} activeDot={{ r: 6, fill: "#10B981" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyChart label={t("log_more_weight")} />
          )}
          <div className="mt-2 flex flex-wrap items-center gap-4 text-[11px] font-bold text-slate-500" dir="ltr">
            <LegendItem color="#22C7A1" label={t("weight")} />
            {profile?.target_weight_kg && <LegendItem color="#22C7A1" label={t("weight_goal")} dashed />}
          </div>
        </section>
      </div>

      {/* ── BMI Section ── */}
      <section className="rounded-[24px] bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100">
        <div className="mb-4 flex items-center gap-2">
          <Activity className="h-4 w-4 text-macro-carbs" />
          <span className="text-[14px] font-bold text-slate-900">{t("bmi")}</span>
        </div>
        {bmi != null ? (
          <BmiGauge bmi={bmi} label={bmiLabel ?? (bmi < 18.5 ? t("underweight") : bmi < 25 ? t("normal") : bmi < 30 ? t("overweight") : t("obese"))} t={t} />
        ) : (
          <div className="flex flex-col items-center justify-center rounded-2xl bg-slate-50 py-6 ring-1 ring-slate-100/50">
            <BarChart3 className="h-6 w-6 text-slate-300" />
            <p className="mt-3 text-[12px] font-medium text-slate-500">{t("set_height_weight_bmi")}</p>
          </div>
        )}
      </section>
    </motion.div>
  );
}
