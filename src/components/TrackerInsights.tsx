import { useState } from "react";
import { format, startOfWeek, startOfMonth, endOfMonth, addDays, addWeeks, subWeeks, addMonths, subMonths, eachDayOfInterval, startOfYear, endOfYear, subYears, addYears, eachMonthOfInterval } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer,
  LineChart, Line, Dot,
} from "recharts";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

// ─── Types ────────────────────────────────────────────────────────────────────
interface DaySteps { day: string; date: string; steps: number; }
interface WeightEntry { log_date: string; weight_kg: number | null; }

interface Props {
  userId: string | undefined;
  stepGoal: number;
  waterTargetMl: number;
  waterMl: number;
  measurements: WeightEntry[];
  bmi: number | null;
  bmiLabel: string | null;
  profile: { height_cm?: number | null; target_weight_kg?: number | null; current_weight_kg?: number | null } | null;
}

type Period = "Weekly" | "Monthly" | "Yearly";

function getStepsForDate(userId: string | undefined, dateStr: string): number {
  return parseInt(localStorage.getItem(`tracker_steps_${userId}_${dateStr}`) || "0", 10);
}

// ─── BMI Gauge ────────────────────────────────────────────────────────────────
function BmiGauge({ bmi }: { bmi: number }) {
  const { t } = useLanguage();
  const clampedBmi = Math.max(15, Math.min(40, bmi));
  // 0° = left (BMI 15), 180° = right (BMI 40)
  const angleDeg = ((clampedBmi - 15) / 25) * 180;
  const angleRad = ((angleDeg - 180) * Math.PI) / 180;
  const cx = 120, cy = 110, r = 90;
  const needleX = cx + r * Math.cos(angleRad);
  const needleY = cy + r * Math.sin(angleRad);

  const bmiRanges = [
    { label: `${t("underweight")} II`,   range: "BMI < 16.0",      color: "#6366f1" },
    { label: `${t("underweight")} I`,    range: "BMI 16.0 - 18.4", color: "#3b82f6" },
    { label: t("normal"),                range: "BMI 18.5 - 24.9", color: "#22c55e" },
    { label: t("overweight"),            range: "BMI 25.0 - 29.9", color: "#f59e0b" },
    { label: `${t("obese")} I`,          range: "BMI 30.0 - 34.9", color: "#f97316" },
    { label: `${t("obese")} II`,         range: "BMI 35.0 - 39.9", color: "#ef4444" },
  ];

  const getBmiColor = (b: number) => {
    if (b < 18.5) return "#3b82f6";
    if (b < 25) return "#22c55e";
    if (b < 30) return "#f59e0b";
    if (b < 35) return "#f97316";
    return "#ef4444";
  };

  // Arc segments (approximate): 6 segments across 180°
  const segments = [
    { start: 180, end: 210, color: "#6366f1" },
    { start: 210, end: 240, color: "#3b82f6" },
    { start: 240, end: 270, color: "#22c55e" },
    { start: 270, end: 300, color: "#f59e0b" },
    { start: 300, end: 330, color: "#f97316" },
    { start: 330, end: 360, color: "#ef4444" },
  ];

  function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
    const a = (angleDeg * Math.PI) / 180;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  }

  function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
    const s = polarToCartesian(cx, cy, r, startDeg);
    const e = polarToCartesian(cx, cy, r, endDeg);
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
  }

  return (
    <div>
      <svg viewBox="0 0 240 140" className="w-full">
        {/* Track */}
        <path d={arcPath(cx, cy, r, 180, 360)} fill="none" stroke="#e5e7eb" strokeWidth="18" strokeLinecap="butt" />
        {/* Colored segments */}
        {segments.map((seg, i) => (
          <path key={i} d={arcPath(cx, cy, r, seg.start, seg.end)} fill="none" stroke={seg.color} strokeWidth="18" strokeLinecap="butt" />
        ))}
        {/* Needle */}
        <line x1={cx} y1={cy} x2={needleX} y2={needleY} stroke="#1f2937" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="6" fill="#1f2937" />
        {/* BMI value above center */}
        <text x={cx} y={cy - 18} textAnchor="middle" fontSize="26" fontWeight="900" fill="#1f2937">{bmi.toFixed(1)}</text>
        {/* Label below center, outside the arc */}
        <text x={cx} y={cy + 20} textAnchor="middle" fontSize="9" fill="#9ca3af">BMI (kg/m²)</text>
      </svg>
      {/* Legend */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 px-2">
        {bmiRanges.map((r, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: r.color }} />
            <span className="text-[10px] text-gray-500 truncate">{r.label}</span>
            <span className="text-[10px] text-gray-400 ml-auto">{r.range}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 text-center">
        <span className="text-xs font-semibold px-3 py-1 rounded-full text-white" style={{ background: getBmiColor(bmi) }}>
          {bmi < 18.5 ? t("underweight") : bmi < 25 ? t("normal") : bmi < 30 ? t("overweight") : bmi < 35 ? `${t("obese")} I` : `${t("obese")} II`}
        </span>
      </div>
    </div>
  );
}

// ─── Section Card ─────────────────────────────────────────────────────────────
function SectionCard({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <p className="font-bold text-gray-900">{title}</p>
        <div className="flex gap-1">
          <span className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: accent + "22" }}>
            <svg viewBox="0 0 16 16" className="w-4 h-4" fill={accent}>
              <rect x="1" y="8" width="3" height="7" rx="1"/><rect x="6" y="5" width="3" height="10" rx="1"/><rect x="11" y="2" width="3" height="13" rx="1"/>
            </svg>
          </span>
        </div>
      </div>
      {children}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function TrackerInsights({ userId, stepGoal, waterTargetMl, waterMl, measurements, bmi, profile }: Props) {
  const { t } = useLanguage();
  const [period, setPeriod] = useState<Period>("Weekly");
  const [weekRef, setWeekRef] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [monthRef, setMonthRef] = useState(() => startOfMonth(new Date()));
  const [yearRef, setYearRef] = useState(() => startOfYear(new Date()));

  const todayStr = format(new Date(), "yyyy-MM-dd");

  // ── Weekly data (7 days) ──────────────────────────────────────────────────
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(weekRef, i);
    const dateStr = format(d, "yyyy-MM-dd");
    const s = getStepsForDate(userId, dateStr);
    return { day: format(d, "EEE"), date: dateStr, steps: s, cal: Math.round(s * 0.04) };
  });

  // ── Monthly data (every day in selected month) ───────────────────────────
  const monthDays = eachDayOfInterval({ start: monthRef, end: endOfMonth(monthRef) }).map((d) => {
    const dateStr = format(d, "yyyy-MM-dd");
    const s = getStepsForDate(userId, dateStr);
    return { day: format(d, "d"), date: dateStr, steps: s, cal: Math.round(s * 0.04) };
  });

  // ── Yearly data (one entry per month of selected year) ───────────────────
  const yearMonths = eachMonthOfInterval({ start: yearRef, end: endOfYear(yearRef) }).map((m) => {
    const days = eachDayOfInterval({ start: m, end: endOfMonth(m) });
    const totalSteps = days.reduce((sum, d) => sum + getStepsForDate(userId, format(d, "yyyy-MM-dd")), 0);
    const monthMeasurements = measurements.filter((me) => me.log_date.startsWith(format(m, "yyyy-MM")));
    const avgWeight = monthMeasurements.length
      ? monthMeasurements.reduce((s, me) => s + (me.weight_kg ?? 0), 0) / monthMeasurements.length
      : null;
    return { day: format(m, "MMM"), steps: totalSteps, cal: Math.round(totalSteps * 0.04), weight: avgWeight };
  });

  // ── Active dataset based on period ───────────────────────────────────────
  const chartData = period === "Weekly" ? weekDays : period === "Monthly" ? monthDays : yearMonths;

  // Water data: today's real value for weekly; 0 for other days (only today is tracked in-session)
  const waterData = chartData.map((d) => ({
    day: d.day,
    water: "date" in d && d.date === todayStr ? waterMl : 0,
  }));

  // Weight data filtered by selected period
  const weightData = (() => {
    if (period === "Weekly") {
      return measurements
        .filter((m) => {
          const d = m.log_date;
          const wStart = format(weekRef, "yyyy-MM-dd");
          const wEnd = format(addDays(weekRef, 6), "yyyy-MM-dd");
          return d >= wStart && d <= wEnd;
        })
        .map((m) => ({ day: format(new Date(m.log_date), "d"), weight: m.weight_kg ?? 0 }))
        .reverse();
    }
    if (period === "Monthly") {
      return measurements
        .filter((m) => m.log_date.startsWith(format(monthRef, "yyyy-MM")))
        .map((m) => ({ day: format(new Date(m.log_date), "d"), weight: m.weight_kg ?? 0 }))
        .reverse();
    }
    // Yearly: monthly averages
    return yearMonths.filter((m) => m.weight !== null).map((m) => ({ day: m.day, weight: m.weight ?? 0 }));
  })();

  // ── Date label & navigation ───────────────────────────────────────────────
  const dateLabel =
    period === "Weekly" ? `${format(weekRef, "MMM d")} - ${format(addDays(weekRef, 6), "MMM d, yyyy")}`
    : period === "Monthly" ? format(monthRef, "MMMM yyyy")
    : format(yearRef, "yyyy");

  const prevPeriod = () => {
    if (period === "Weekly") setWeekRef(subWeeks(weekRef, 1));
    else if (period === "Monthly") setMonthRef(subMonths(monthRef, 1));
    else setYearRef(subYears(yearRef, 1));
  };
  const nextPeriod = () => {
    if (period === "Weekly") setWeekRef(addWeeks(weekRef, 1));
    else if (period === "Monthly") setMonthRef(addMonths(monthRef, 1));
    else setYearRef(addYears(yearRef, 1));
  };

  const CHART_H = 140;

  return (
    <div className="space-y-4">
      {/* Period selector */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {([t("weekly"), t("monthly"), t("yearly")] as string[]).map((p, i) => {
          const periodKey = (["Weekly", "Monthly", "Yearly"] as Period[])[i];
          return (
          <button
            key={p}
            onClick={() => setPeriod(periodKey)}
            className={cn(
              "flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all",
              period === periodKey ? "bg-emerald-500 text-white shadow-sm" : "text-gray-500"
            )}
          >
            {p}
          </button>
        );
        })}
      </div>

      {/* Date range nav */}
      <div className="flex items-center justify-between">
        <button onClick={prevPeriod} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
          <ChevronLeft className="w-4 h-4 text-gray-600" />
        </button>
        <span className="text-sm font-semibold text-gray-700">{dateLabel}</span>
        <button onClick={nextPeriod} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
          <ChevronRight className="w-4 h-4 text-gray-600" />
        </button>
      </div>

      {/* Calorie Chart */}
      <SectionCard title={t("calorie_kcal")} accent="#22c55e">
        <ResponsiveContainer width="100%" height={CHART_H}>
          <BarChart data={chartData} margin={{ left: -20, right: 8, top: 8, bottom: 0 }} barSize={period === "Monthly" ? 8 : 18}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
            <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#9ca3af" }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#9ca3af" }} />
            <Tooltip formatter={(v: number) => [`${v} kcal`, t("calories")]} />
            <ReferenceLine y={Math.round(stepGoal * 0.04)} stroke="#22c55e" strokeDasharray="4 4" strokeWidth={1.5} />
            <Bar dataKey="cal" fill="#bbf7d0" radius={[4, 4, 0, 0]}
              label={false}
              activeBar={{ fill: "#22c55e" }}
            />
          </BarChart>
        </ResponsiveContainer>
        <div className="flex items-center gap-4 px-4 pb-3 text-xs text-gray-500">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-emerald-200 inline-block" /> {t("calorie")}</span>
          <span className="flex items-center gap-1"><span className="w-4 border-t-2 border-dashed border-emerald-500 inline-block" /> {t("calorie_intake_goal")}</span>
        </div>
      </SectionCard>

      {/* Water Chart */}
      <SectionCard title={t("water_ml")} accent="#3b82f6">
        <ResponsiveContainer width="100%" height={CHART_H}>
          <BarChart data={waterData} margin={{ left: -20, right: 8, top: 8, bottom: 0 }} barSize={period === "Monthly" ? 8 : 18}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
            <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#9ca3af" }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#9ca3af" }} />
            <Tooltip formatter={(v: number) => [`${v} mL`, t("water")]} />
            <ReferenceLine y={waterTargetMl} stroke="#3b82f6" strokeDasharray="4 4" strokeWidth={1.5} />
            <Bar dataKey="water" fill="#bfdbfe" radius={[4, 4, 0, 0]} activeBar={{ fill: "#3b82f6" }} />
          </BarChart>
        </ResponsiveContainer>
        <div className="flex items-center gap-4 px-4 pb-3 text-xs text-gray-500">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-blue-200 inline-block" /> {t("water")}</span>
          <span className="flex items-center gap-1"><span className="w-4 border-t-2 border-dashed border-blue-500 inline-block" /> {t("water_intake_goal")}</span>
        </div>
      </SectionCard>

      {/* Step Chart */}
      <SectionCard title={t("steps")} accent="#f97316">
        <ResponsiveContainer width="100%" height={CHART_H}>
          <BarChart data={chartData} margin={{ left: -20, right: 8, top: 8, bottom: 0 }} barSize={period === "Monthly" ? 8 : 18}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
            <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#9ca3af" }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#9ca3af" }} />
            <Tooltip formatter={(v: number) => [`${v.toLocaleString()}`, t("steps")]} />
            <ReferenceLine y={stepGoal} stroke="#f97316" strokeDasharray="4 4" strokeWidth={1.5} />
            <Bar dataKey="steps" fill="#fed7aa" radius={[4, 4, 0, 0]} activeBar={{ fill: "#f97316" }} />
          </BarChart>
        </ResponsiveContainer>
        <div className="flex items-center gap-4 px-4 pb-3 text-xs text-gray-500">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-orange-200 inline-block" /> {t("selected")}</span>
          <span className="flex items-center gap-1"><span className="w-4 border-t-2 border-dashed border-orange-500 inline-block" /> {t("step_goal")}</span>
        </div>
      </SectionCard>

      {/* Weight Chart */}
      <SectionCard title={t("weight_kg")} accent="#ef4444">
        {weightData.length < 2 ? (
          <p className="text-sm text-gray-400 px-4 pb-4">{t("log_more_weight")}</p>
        ) : (
          <ResponsiveContainer width="100%" height={CHART_H}>
            <LineChart data={weightData} margin={{ left: -20, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#9ca3af" }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#9ca3af" }} domain={["auto", "auto"]} />
              <Tooltip formatter={(v: number) => [`${v.toFixed(1)} kg`, t("weight")]} />
              {profile?.target_weight_kg && (
                <ReferenceLine y={profile.target_weight_kg} stroke="#ef4444" strokeDasharray="4 4" strokeWidth={1.5} />
              )}
              <Line
                type="monotone"
                dataKey="weight"
                stroke="#fca5a5"
                strokeWidth={2}
                dot={<Dot r={4} fill="#ef4444" stroke="#fff" strokeWidth={2} />}
                activeDot={{ r: 6, fill: "#ef4444" }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
        <div className="flex items-center gap-4 px-4 pb-3 text-xs text-gray-500">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-200 inline-block" /> {t("selected")}</span>
          {profile?.target_weight_kg && (
            <span className="flex items-center gap-1"><span className="w-4 border-t-2 border-dashed border-red-400 inline-block" /> {t("weight_goal")}</span>
          )}
        </div>
      </SectionCard>

      {/* BMI Gauge */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <p className="font-bold text-gray-900">{t("bmi")}</p>
          {bmi != null && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
              {bmi < 18.5 ? t("underweight") : bmi < 25 ? t("normal") : bmi < 30 ? t("overweight") : t("obese")}
            </span>
          )}
        </div>
        <div className="px-4 pb-4">
          {bmi != null ? <BmiGauge bmi={bmi} /> : (
            <p className="text-sm text-gray-400 py-4 text-center">{t("set_height_weight_bmi")}</p>
          )}
        </div>
      </div>
    </div>
  );
}
