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
const TRACKER_CHART_COLORS = {
  text: "#020617",
  surface: "#F6F8FB",
  track: "#E5EAF1",
  progress: "#22C7A1",
  steps: "#7C83F6",
  water: "#38BDF8",
  calories: "#F97316",
  fat: "#FB6B7A",
};

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
    <section className={cn("overflow-hidden rounded-[28px] bg-white shadow-[0_8px_32px_rgba(15,23,42,0.08)] ring-1 ring-slate-100", className)}>
      <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#F6F8FB] text-[#020617] ring-1 ring-[#E5EAF1]">
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
      icon: "bg-[#EFFFFA] text-[#22C7A1] ring-[#22C7A1]/20",
      label: "text-[#22C7A1]",
      bar: "bg-[#22C7A1]",
      wash: "before:from-[#EFFFFA]",
    },
    blue: {
      icon: "bg-[#EFF9FF] text-[#38BDF8] ring-[#38BDF8]/20",
      label: "text-[#38BDF8]",
      bar: "bg-[#38BDF8]",
      wash: "before:from-[#EFF9FF]",
    },
    orange: {
      icon: "bg-[#F3F4FF] text-[#7C83F6] ring-[#7C83F6]/20",
      label: "text-[#7C83F6]",
      bar: "bg-[#7C83F6]",
      wash: "before:from-[#F3F4FF]",
    },
    teal: {
      icon: "bg-[#EFFFFA] text-[#22C7A1] ring-[#22C7A1]/20",
      label: "text-[#22C7A1]",
      bar: "bg-[#22C7A1]",
      wash: "before:from-[#EFFFFA]",
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
  const tone = bmi < 18.5 ? "bg-[#38BDF8]" : bmi < 25 ? "bg-[#22C7A1]" : bmi < 30 ? "bg-[#F97316]" : "bg-[#FB6B7A]";

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
          <div className="flex-1 bg-[#38BDF8]" />
          <div className="flex-1 bg-[#22C7A1]" />
          <div className="flex-1 bg-[#F97316]" />
          <div className="flex-1 bg-[#FB6B7A]" />
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
      <section className="relative overflow-hidden rounded-[28px] bg-white p-5 text-[#020617] shadow-[0_8px_32px_rgba(15,23,42,0.10)] ring-1 ring-slate-100">
        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">{t("insights")}</p>
            <h2 className="mt-1 text-[20px] font-black leading-tight tracking-[-0.04em] text-slate-900">{t("progress_insights")}</h2>
            <p className="mt-2 text-[12px] font-semibold leading-5 text-slate-500">
              {activeDays > 0
                ? t("tracker_active_days_summary", { days: activeDays, steps: compactNumber(totalSteps) })
                : t("tracker_empty_insights")}
            </p>
          </div>
          <div className="relative flex h-[82px] w-[82px] shrink-0 items-center justify-center rounded-full bg-[#F6F8FB] ring-1 ring-[#E5EAF1]">
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 82 82" aria-hidden="true">
              <circle cx="41" cy="41" r="32" fill="none" stroke="rgba(15,23,42,0.08)" strokeWidth="7" />
              <circle
                cx="41"
                cy="41"
                r="32"
                fill="none"
                stroke={TRACKER_CHART_COLORS.progress}
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={`${(goalRate / 100) * 201} 201`}
              />
            </svg>
            <div className="text-center">
              <p className="text-[22px] font-black leading-none text-[#020617]">{goalRate}%</p>
              <p className="mt-0.5 text-[9px] font-black uppercase tracking-wide text-slate-400">{t("goal")}</p>
            </div>
          </div>
        </div>

        <div className="relative mt-5 grid grid-cols-3 gap-2">
          <div className="rounded-[20px] bg-[#EFFFFA] p-3 ring-1 ring-[#22C7A1]/20">
            <p className="text-[20px] font-black leading-none">{goalRate}%</p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">{t("goal_hit")}</p>
          </div>
          <div className="rounded-[20px] bg-[#F3F4FF] p-3 ring-1 ring-[#7C83F6]/20">
            <p className="text-[20px] font-black leading-none">{compactNumber(avgSteps)}</p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">{t("avg_steps")}</p>
          </div>
          <div className="rounded-[20px] bg-[#FFF7ED] p-3 ring-1 ring-[#F97316]/20">
            <p className="text-[20px] font-black leading-none">{compactNumber(totalCalories)}</p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-[#F97316]">kcal</p>
          </div>
        </div>
      </section>

      <div className="rounded-[28px] bg-white p-2 shadow-[0_14px_34px_rgba(15,23,42,0.05)] ring-1 ring-slate-100">
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
          <button onClick={previousPeriod} className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 text-slate-600 ring-1 ring-slate-100" aria-label={t("previous_period")}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex min-h-10 items-center gap-2 rounded-full bg-slate-50 px-3 text-[13px] font-black text-slate-800 ring-1 ring-slate-100">
            <CalendarDays className="h-4 w-4 text-[#7C83F6]" />
            {dateLabel}
          </div>
          <button onClick={nextPeriod} className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 text-slate-600 ring-1 ring-slate-100" aria-label={t("next_period")}>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <SummaryCard
          label={t("steps")}
          value={compactNumber(totalSteps)}
          sub={t("goal_days_reached", { current: goalHits, total: chartData.length })}
          icon={<Footprints className="h-4 w-4" />}
          tone="orange"
          progress={goalRate}
        />
        <SummaryCard
          label={t("water")}
          value={`${waterPct}%`}
          sub={t("water_today_summary", { current: waterMl.toLocaleString(), target: waterTargetMl.toLocaleString() })}
          icon={<Droplets className="h-4 w-4" />}
          tone="blue"
          progress={waterPct}
        />
        <SummaryCard
          label={t("today")}
          value={`${todayStepsPct}%`}
          sub={t("steps_goal_summary", { current: todaySteps.toLocaleString(), target: stepGoal.toLocaleString() })}
          icon={<Target className="h-4 w-4" />}
          tone="emerald"
          progress={todayStepsPct}
        />
        <SummaryCard
          label={t("weight")}
          value={latestWeight != null ? `${latestWeight.toFixed(1)}` : "--"}
          sub={weightDelta != null ? t("weight_delta_overall", { value: `${weightDelta > 0 ? "+" : ""}${weightDelta.toFixed(1)}` }) : t("log_more_weight")}
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
              weeklyDelta >= 0 ? "bg-[#EFFFFA] text-[#22C7A1] ring-[#22C7A1]/20" : "bg-[#FFF0F2] text-[#FB6B7A] ring-[#FB6B7A]/20"
            )}>
              {weeklyDelta >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">{t("weekly_momentum")}</p>
              <p className="mt-1 text-[15px] font-black leading-tight text-slate-950">
                {t("vs_previous_week", { value: `${weeklyDelta >= 0 ? "+" : ""}${weeklyDelta}` })}
              </p>
              <p className="mt-1 text-[12px] font-semibold leading-5 text-slate-500">
                {t("weekly_momentum_based_on_steps")}
              </p>
            </div>
          </div>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className={cn("h-full rounded-full", weeklyDelta >= 0 ? "bg-[#22C7A1]" : "bg-[#FB6B7A]")}
              style={{ width: `${Math.min(100, Math.abs(weeklyDelta))}%` }}
            />
          </div>
        </div>
      )}

      <Panel title={t("steps")} eyebrow={t("movement")} icon={<Footprints className="h-5 w-5 text-[#7C83F6]" />}>
        {hasActivityData ? (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart data={chartData} margin={{ left: -22, right: 12, top: 8, bottom: 0 }} barSize={period === "Monthly" ? 7 : 20}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="transparent" />
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#94a3b8", fontWeight: 700 }} />
              <YAxis hide />
              <Tooltip formatter={(value: number) => [`${value.toLocaleString()}`, t("steps")]} cursor={{ fill: "#f1f5f9" }} />
              <ReferenceLine y={stepGoal} stroke={TRACKER_CHART_COLORS.steps} strokeDasharray="5 5" strokeWidth={1.5} />
              <Bar dataKey="steps" fill="#DDE1FF" radius={[8, 8, 0, 0]} activeBar={{ fill: TRACKER_CHART_COLORS.steps }} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart label={t("no_step_data_period")} />
        )}
        <div className="flex flex-wrap items-center gap-4 px-4 pb-4 text-[11px] font-bold text-slate-500">
          <LegendItem color="#7C83F6" label={t("steps")} />
          <LegendItem color="#7C83F6" label={t("step_goal")} dashed />
        </div>
      </Panel>

      <Panel title={t("calorie_kcal")} eyebrow={t("estimated_burn")} icon={<Flame className="h-5 w-5 text-[#F97316]" />}>
        {hasActivityData ? (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart data={chartData} margin={{ left: -22, right: 12, top: 8, bottom: 0 }} barSize={period === "Monthly" ? 7 : 20}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="transparent" />
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#94a3b8", fontWeight: 700 }} />
              <YAxis hide />
              <Tooltip formatter={(value: number) => [`${value} kcal`, t("calories")]} cursor={{ fill: "#f1f5f9" }} />
              <ReferenceLine y={Math.round(stepGoal * 0.04)} stroke={TRACKER_CHART_COLORS.calories} strokeDasharray="5 5" strokeWidth={1.5} />
              <Bar dataKey="cal" fill="#FFE5D0" radius={[8, 8, 0, 0]} activeBar={{ fill: TRACKER_CHART_COLORS.calories }} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart label={t("calories_after_steps_tracked")} />
        )}
        <div className="flex flex-wrap items-center gap-4 px-4 pb-4 text-[11px] font-bold text-slate-500">
          <LegendItem color="#F97316" label={t("calorie")} />
          <LegendItem color="#F97316" label={t("calorie_intake_goal")} dashed />
        </div>
      </Panel>

      <Panel title={t("water_ml")} eyebrow={t("hydration")} icon={<Droplets className="h-5 w-5 text-[#38BDF8]" />}>
        {hasWaterData ? (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart data={waterData} margin={{ left: -22, right: 12, top: 8, bottom: 0 }} barSize={period === "Monthly" ? 7 : 20}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="transparent" />
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#94a3b8", fontWeight: 700 }} />
              <YAxis hide />
              <Tooltip formatter={(value: number) => [`${value} mL`, t("water")]} cursor={{ fill: "#f1f5f9" }} />
              <ReferenceLine y={waterTargetMl} stroke={TRACKER_CHART_COLORS.water} strokeDasharray="5 5" strokeWidth={1.5} />
              <Bar dataKey="water" fill="#DDF3FF" radius={[8, 8, 0, 0]} activeBar={{ fill: TRACKER_CHART_COLORS.water }} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart label={t("hydration_after_water_log")} />
        )}
        <div className="flex flex-wrap items-center gap-4 px-4 pb-4 text-[11px] font-bold text-slate-500">
          <LegendItem color="#38BDF8" label={t("water")} />
          <LegendItem color="#38BDF8" label={t("water_intake_goal")} dashed />
        </div>
      </Panel>

      <Panel title={t("weight_kg")} eyebrow={t("body_trend")} icon={<Scale className="h-5 w-5 text-[#22C7A1]" />}>
        {weightData.length >= 2 ? (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <LineChart data={weightData} margin={{ left: -22, right: 12, top: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="transparent" />
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#94a3b8", fontWeight: 700 }} />
              <YAxis hide domain={["auto", "auto"]} />
              <Tooltip formatter={(value: number) => [`${value.toFixed(1)} kg`, t("weight")]} />
              {profile?.target_weight_kg && <ReferenceLine y={profile.target_weight_kg} stroke={TRACKER_CHART_COLORS.progress} strokeDasharray="5 5" strokeWidth={1.5} />}
              <Line type="monotone" dataKey="weight" stroke={TRACKER_CHART_COLORS.progress} strokeWidth={3} dot={<Dot r={4} fill={TRACKER_CHART_COLORS.progress} stroke="#fff" strokeWidth={2} />} activeDot={{ r: 6, fill: TRACKER_CHART_COLORS.progress }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart label={t("log_more_weight")} />
        )}
        <div className="flex flex-wrap items-center gap-4 px-4 pb-4 text-[11px] font-bold text-slate-500">
          <LegendItem color="#22C7A1" label={t("weight")} />
          {profile?.target_weight_kg && <LegendItem color="#22C7A1" label={t("weight_goal")} dashed />}
        </div>
      </Panel>

      <Panel title={t("bmi")} eyebrow={t("body_composition")} icon={<Activity className="h-5 w-5 text-[#F97316]" />}>
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
