import { useMemo, useState } from "react";
import type { ReactNode } from "react";
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
const chartHeight = 190;

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

function Panel({
  title,
  eyebrow,
  icon,
  children,
  action,
  className,
}: {
  title: string;
  eyebrow?: string;
  icon: ReactNode;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("overflow-hidden rounded-[30px] bg-white/95 shadow-[0_16px_36px_rgba(15,23,42,0.06)] ring-1 ring-white", className)}>
      <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-50 text-slate-700 ring-1 ring-slate-100">
            {icon}
          </div>
          <div className="min-w-0">
            {eyebrow && <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-400">{eyebrow}</p>}
            <h2 className="truncate text-[18px] font-black leading-tight text-slate-950">{title}</h2>
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function SummaryCard({
  label,
  value,
  sub,
  icon,
  tone,
  progress,
}: {
  label: string;
  value: string;
  sub: string;
  icon: ReactNode;
  tone: "emerald" | "blue" | "orange" | "teal";
  progress?: number;
}) {
  const styles = {
    emerald: {
      icon: "bg-slate-100 text-[#020617] ring-slate-200",
      label: "text-slate-500",
      bar: "bg-[#020617]",
      wash: "before:from-slate-50",
    },
    blue: {
      icon: "bg-slate-100 text-[#020617] ring-slate-200",
      label: "text-slate-500",
      bar: "bg-[#020617]",
      wash: "before:from-slate-50",
    },
    orange: {
      icon: "bg-slate-100 text-[#020617] ring-slate-200",
      label: "text-slate-500",
      bar: "bg-[#020617]",
      wash: "before:from-slate-50",
    },
    teal: {
      icon: "bg-slate-100 text-[#020617] ring-slate-200",
      label: "text-slate-500",
      bar: "bg-[#020617]",
      wash: "before:from-slate-50",
    },
  };
  const toneStyle = styles[tone];

  return (
    <div className={cn(
      "relative min-h-[138px] w-[154px] shrink-0 overflow-hidden rounded-[26px] bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.055)] ring-1 ring-slate-100",
      "before:absolute before:inset-x-0 before:top-0 before:h-20 before:bg-gradient-to-b before:to-transparent",
      toneStyle.wash
    )}>
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={cn("text-[11px] font-black uppercase tracking-[0.14em]", toneStyle.label)}>{label}</p>
          <p className="mt-3 text-[28px] font-black leading-none tracking-[-0.04em] text-slate-950">{value}</p>
        </div>
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ring-1", toneStyle.icon)}>
          {icon}
        </div>
      </div>

      <div className="relative mt-2">
        <p className="min-h-8 text-[12px] font-bold leading-4 text-slate-500">{sub}</p>
        {progress !== undefined && (
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className={cn("h-full rounded-full transition-all", toneStyle.bar)}
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
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
    <div className="flex h-[190px] flex-col items-center justify-center px-6 text-center">
      <Sparkles className="h-5 w-5 text-slate-300" />
      <p className="mt-2 text-[13px] font-bold text-slate-500">{label}</p>
    </div>
  );
}

function BmiGauge({ bmi, label }: { bmi: number; label: string }) {
  const clamped = Math.max(15, Math.min(40, bmi));
  const pct = ((clamped - 15) / 25) * 100;
  const markerLeft = `calc(${pct}% - 8px)`;
  const tone = bmi < 18.5 ? "bg-blue-500" : bmi < 25 ? "bg-emerald-500" : bmi < 30 ? "bg-amber-500" : "bg-red-500";

  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[44px] font-black leading-none tracking-[-0.04em] text-slate-950">{bmi.toFixed(1)}</p>
          <p className="mt-1 text-[12px] font-bold text-slate-400">BMI kg/m2</p>
        </div>
        <span className={cn("rounded-full px-3 py-1.5 text-[12px] font-black text-white", tone)}>{label}</span>
      </div>

      <div className="relative mt-5">
        <div className="flex h-3 overflow-hidden rounded-full">
          <div className="flex-1 bg-blue-400" />
          <div className="flex-1 bg-emerald-500" />
          <div className="flex-1 bg-amber-400" />
          <div className="flex-1 bg-red-500" />
        </div>
        <div className="absolute -top-1.5 h-6 w-4 rounded-full bg-white shadow-[0_6px_14px_rgba(2,6,23,0.18)] ring-2 ring-[#020617]" style={{ left: markerLeft }} />
      </div>

      <div className="mt-2 grid grid-cols-4 text-center text-[9px] font-bold text-slate-400">
        <span>15</span>
        <span>22.5</span>
        <span>30</span>
        <span>40</span>
      </div>
    </div>
  );
}

export function TrackerInsights({ userId, stepGoal, waterTargetMl, waterMl, measurements, bmi, bmiLabel, profile }: Props) {
  const { t } = useLanguage();
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
    <div className="space-y-3">
      <section className="relative overflow-hidden rounded-[32px] bg-white p-5 text-slate-950 shadow-[0_18px_40px_rgba(15,23,42,0.07)] ring-1 ring-slate-100">
        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">{t("insights")}</p>
            <h2 className="mt-1 text-[28px] font-black leading-tight tracking-[-0.03em]">Progress insights</h2>
            <p className="mt-2 text-[12px] font-semibold leading-5 text-slate-500">
              {activeDays > 0
                ? `${activeDays} active ${activeDays === 1 ? "day" : "days"} in this view with ${compactNumber(totalSteps)} total steps.`
                : "Start logging movement, water, and weight to build your trend line."}
            </p>
          </div>
          <div className="relative flex h-[82px] w-[82px] shrink-0 items-center justify-center rounded-full bg-white/65 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_12px_26px_rgba(16,185,129,0.12)] ring-1 ring-white">
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 82 82" aria-hidden="true">
              <circle cx="41" cy="41" r="32" fill="none" stroke="rgba(15,23,42,0.08)" strokeWidth="7" />
              <circle
                cx="41"
                cy="41"
                r="32"
                fill="none"
                stroke="#020617"
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={`${(goalRate / 100) * 201} 201`}
              />
            </svg>
            <div className="text-center">
              <p className="text-[22px] font-black leading-none text-[#020617]">{goalRate}%</p>
              <p className="mt-0.5 text-[9px] font-black uppercase tracking-wide text-slate-400">goal</p>
            </div>
          </div>
        </div>

        <div className="relative mt-5 grid grid-cols-3 gap-2">
          <div className="rounded-[20px] bg-white/64 p-3 shadow-sm ring-1 ring-white/80 backdrop-blur-md">
            <p className="text-[20px] font-black leading-none">{goalRate}%</p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">goal hit</p>
          </div>
          <div className="rounded-[20px] bg-white/64 p-3 shadow-sm ring-1 ring-white/80 backdrop-blur-md">
            <p className="text-[20px] font-black leading-none">{compactNumber(avgSteps)}</p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">avg steps</p>
          </div>
          <div className="rounded-[20px] bg-white/64 p-3 shadow-sm ring-1 ring-white/80 backdrop-blur-md">
            <p className="text-[20px] font-black leading-none">{compactNumber(totalCalories)}</p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-orange-700">kcal</p>
          </div>
        </div>
      </section>

      <div className="rounded-[28px] bg-white/95 p-2 shadow-[0_14px_34px_rgba(15,23,42,0.05)] ring-1 ring-white">
        <div className="grid grid-cols-3 gap-1 rounded-full bg-slate-100 p-1">
          {periods.map((item, index) => (
            <button
              key={item}
              onClick={() => setPeriod(item)}
              className={cn(
                "flex min-h-10 items-center justify-center rounded-full text-[12px] font-black transition-all",
                period === item ? "bg-[#020617] text-white shadow-[0_8px_18px_rgba(2,6,23,0.16)]" : "text-slate-500"
              )}
            >
              {periodLabels[index]}
            </button>
          ))}
        </div>

        <div className="mt-2 flex items-center justify-between px-1">
          <button onClick={previousPeriod} className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 text-slate-600 ring-1 ring-slate-100" aria-label="Previous period">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex min-h-10 items-center gap-2 rounded-full bg-slate-50 px-3 text-[13px] font-black text-slate-800 ring-1 ring-slate-100">
            <CalendarDays className="h-4 w-4 text-[#020617]" />
            {dateLabel}
          </div>
          <button onClick={nextPeriod} className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 text-slate-600 ring-1 ring-slate-100" aria-label="Next period">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <SummaryCard
          label={t("steps")}
          value={compactNumber(totalSteps)}
          sub={`${goalHits}/${chartData.length} goal days reached`}
          icon={<Footprints className="h-4 w-4" />}
          tone="orange"
          progress={goalRate}
        />
        <SummaryCard
          label={t("water")}
          value={`${waterPct}%`}
          sub={`${waterMl.toLocaleString()} / ${waterTargetMl.toLocaleString()} mL today`}
          icon={<Droplets className="h-4 w-4" />}
          tone="blue"
          progress={waterPct}
        />
        <SummaryCard
          label="Today"
          value={`${todayStepsPct}%`}
          sub={`${todaySteps.toLocaleString()} / ${stepGoal.toLocaleString()} steps`}
          icon={<Target className="h-4 w-4" />}
          tone="emerald"
          progress={todayStepsPct}
        />
        <SummaryCard
          label={t("weight")}
          value={latestWeight != null ? `${latestWeight.toFixed(1)}` : "--"}
          sub={weightDelta != null ? `${weightDelta > 0 ? "+" : ""}${weightDelta.toFixed(1)} kg overall` : t("log_more_weight")}
          icon={<Scale className="h-4 w-4" />}
          tone="teal"
        />
      </div>

      {weeklyDelta !== null && (
        <div className={cn(
          "overflow-hidden rounded-[26px] bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.055)] ring-1",
          "ring-slate-100"
        )}>
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-1",
              "bg-slate-100 text-[#020617] ring-slate-200"
            )}>
              {weeklyDelta >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Weekly momentum</p>
              <p className="mt-1 text-[15px] font-black leading-tight text-slate-950">
                {weeklyDelta >= 0 ? "+" : ""}{weeklyDelta}% vs previous week
              </p>
              <p className="mt-1 text-[12px] font-semibold leading-5 text-slate-500">
                Based on locally tracked steps for the selected week.
              </p>
            </div>
          </div>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-[#020617]"
              style={{ width: `${Math.min(100, Math.abs(weeklyDelta))}%` }}
            />
          </div>
        </div>
      )}

      <Panel title={t("steps")} eyebrow="Movement" icon={<Footprints className="h-5 w-5 text-[#020617]" />}>
        {hasActivityData ? (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart data={chartData} margin={{ left: -22, right: 12, top: 8, bottom: 0 }} barSize={period === "Monthly" ? 7 : 20}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="transparent" />
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#94a3b8", fontWeight: 700 }} />
              <YAxis hide />
              <Tooltip formatter={(value: number) => [`${value.toLocaleString()}`, t("steps")]} cursor={{ fill: "#f1f5f9" }} />
              <ReferenceLine y={stepGoal} stroke="#020617" strokeDasharray="5 5" strokeWidth={1.5} />
              <Bar dataKey="steps" fill="#CBD5E1" radius={[8, 8, 0, 0]} activeBar={{ fill: "#020617" }} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart label="No step data in this period yet." />
        )}
        <div className="flex flex-wrap items-center gap-4 px-4 pb-4 text-[11px] font-bold text-slate-500">
          <LegendItem color="#CBD5E1" label={t("steps")} />
          <LegendItem color="#020617" label={t("step_goal")} dashed />
        </div>
      </Panel>

      <Panel title={t("calorie_kcal")} eyebrow="Estimated Burn" icon={<Flame className="h-5 w-5 text-[#020617]" />}>
        {hasActivityData ? (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart data={chartData} margin={{ left: -22, right: 12, top: 8, bottom: 0 }} barSize={period === "Monthly" ? 7 : 20}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="transparent" />
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#94a3b8", fontWeight: 700 }} />
              <YAxis hide />
              <Tooltip formatter={(value: number) => [`${value} kcal`, t("calories")]} cursor={{ fill: "#f1f5f9" }} />
              <ReferenceLine y={Math.round(stepGoal * 0.04)} stroke="#020617" strokeDasharray="5 5" strokeWidth={1.5} />
              <Bar dataKey="cal" fill="#CBD5E1" radius={[8, 8, 0, 0]} activeBar={{ fill: "#020617" }} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart label="Calories will appear once steps are tracked." />
        )}
        <div className="flex flex-wrap items-center gap-4 px-4 pb-4 text-[11px] font-bold text-slate-500">
          <LegendItem color="#CBD5E1" label={t("calorie")} />
          <LegendItem color="#020617" label={t("calorie_intake_goal")} dashed />
        </div>
      </Panel>

      <Panel title={t("water_ml")} eyebrow="Hydration" icon={<Droplets className="h-5 w-5 text-[#020617]" />}>
        {hasWaterData ? (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart data={waterData} margin={{ left: -22, right: 12, top: 8, bottom: 0 }} barSize={period === "Monthly" ? 7 : 20}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="transparent" />
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#94a3b8", fontWeight: 700 }} />
              <YAxis hide />
              <Tooltip formatter={(value: number) => [`${value} mL`, t("water")]} cursor={{ fill: "#f1f5f9" }} />
              <ReferenceLine y={waterTargetMl} stroke="#020617" strokeDasharray="5 5" strokeWidth={1.5} />
              <Bar dataKey="water" fill="#CBD5E1" radius={[8, 8, 0, 0]} activeBar={{ fill: "#020617" }} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart label="Hydration data will appear after your next water log." />
        )}
        <div className="flex flex-wrap items-center gap-4 px-4 pb-4 text-[11px] font-bold text-slate-500">
          <LegendItem color="#CBD5E1" label={t("water")} />
          <LegendItem color="#020617" label={t("water_intake_goal")} dashed />
        </div>
      </Panel>

      <Panel title={t("weight_kg")} eyebrow="Body Trend" icon={<Scale className="h-5 w-5 text-[#020617]" />}>
        {weightData.length >= 2 ? (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <LineChart data={weightData} margin={{ left: -22, right: 12, top: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="transparent" />
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#94a3b8", fontWeight: 700 }} />
              <YAxis hide domain={["auto", "auto"]} />
              <Tooltip formatter={(value: number) => [`${value.toFixed(1)} kg`, t("weight")]} />
              {profile?.target_weight_kg && <ReferenceLine y={profile.target_weight_kg} stroke="#020617" strokeDasharray="5 5" strokeWidth={1.5} />}
              <Line type="monotone" dataKey="weight" stroke="#020617" strokeWidth={3} dot={<Dot r={4} fill="#020617" stroke="#fff" strokeWidth={2} />} activeDot={{ r: 6, fill: "#020617" }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart label={t("log_more_weight")} />
        )}
        <div className="flex flex-wrap items-center gap-4 px-4 pb-4 text-[11px] font-bold text-slate-500">
          <LegendItem color="#020617" label={t("weight")} />
          {profile?.target_weight_kg && <LegendItem color="#020617" label={t("weight_goal")} dashed />}
        </div>
      </Panel>

      <Panel title={t("bmi")} eyebrow="Body Composition" icon={<Activity className="h-5 w-5 text-[#020617]" />}>
        <div className="px-4 pb-4">
          {bmi != null ? (
            <BmiGauge bmi={bmi} label={bmiLabel ?? (bmi < 18.5 ? t("underweight") : bmi < 25 ? t("normal") : bmi < 30 ? t("overweight") : t("obese"))} />
          ) : (
            <div className="rounded-[22px] bg-slate-50 p-5 text-center">
              <BarChart3 className="mx-auto h-6 w-6 text-slate-300" />
              <p className="mt-2 text-[13px] font-bold text-slate-500">{t("set_height_weight_bmi")}</p>
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}
