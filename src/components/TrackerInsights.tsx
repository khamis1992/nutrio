import { useState } from "react";
import { format, startOfWeek, startOfMonth, endOfMonth, addDays, addWeeks, subWeeks, addMonths, subMonths, eachDayOfInterval, startOfYear, endOfYear, subYears, addYears, eachMonthOfInterval } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, LineChart, Line, Dot } from "recharts";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

/* ═══════════════════════════════════════════════
   DESIGN SYSTEM — Matching Tracker.tsx
   Cards: rounded-2xl, shadow, ring, unified emerald accent
   ═══════════════════════════════════════════════ */

interface DaySteps { day: string; date: string; steps: number; }
interface WeightEntry { log_date: string; weight_kg: number | null; }
interface Props { userId: string | undefined; stepGoal: number; waterTargetMl: number; waterMl: number; measurements: WeightEntry[]; bmi: number | null; bmiLabel: string | null; profile: { height_cm?: number | null; target_weight_kg?: number | null; current_weight_kg?: number | null } | null; }
type Period = "Weekly" | "Monthly" | "Yearly";

function getStepsForDate(userId: string | undefined, dateStr: string): number { return parseInt(localStorage.getItem(`tracker_steps_${userId}_${dateStr}`) || "0", 10); }

function SectionCard({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100 overflow-hidden">
      <div className="flex items-center gap-2 px-4 pt-4 pb-3">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: accent }} />
        <p className="font-extrabold text-slate-800 text-[14px]">{title}</p>
      </div>
      {children}
    </div>
  );
}

function BmiGauge({ bmi }: { bmi: number }) {
  const { t } = useLanguage();
  const clamped = Math.max(15, Math.min(40, bmi));
  const angleDeg = ((clamped - 15) / 25) * 180;
  const angleRad = ((angleDeg - 180) * Math.PI) / 180;
  const cx = 120, cy = 110, r = 90;
  const nx = cx + r * Math.cos(angleRad), ny = cy + r * Math.sin(angleRad);

  const segments = [{ s: 180, e: 210, c: "#6366f1" }, { s: 210, e: 240, c: "#3b82f6" }, { s: 240, e: 270, c: "#22c55e" }, { s: 270, e: 300, c: "#f59e0b" }, { s: 300, e: 330, c: "#f97316" }, { s: 330, e: 360, c: "#ef4444" }];
  const polar = (cx: number, cy: number, r: number, deg: number) => { const a = (deg * Math.PI) / 180; return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }; };
  const arc = (cx: number, cy: number, r: number, s: number, e: number) => { const p = polar(cx, cy, r, s), q = polar(cx, cy, r, e); return `M ${p.x} ${p.y} A ${r} ${r} 0 ${e - s > 180 ? 1 : 0} 1 ${q.x} ${q.y}`; };
  const ranges = [{ l: `${t("underweight")} II`, r: "BMI < 16.0", c: "#6366f1" }, { l: `${t("underweight")} I`, r: "BMI 16.0 - 18.4", c: "#3b82f6" }, { l: t("normal"), r: "BMI 18.5 - 24.9", c: "#22c55e" }, { l: t("overweight"), r: "BMI 25.0 - 29.9", c: "#f59e0b" }, { l: `${t("obese")} I`, r: "BMI 30.0 - 34.9", c: "#f97316" }, { l: `${t("obese")} II`, r: "BMI 35.0 - 39.9", c: "#ef4444" }];
  const bmiColor = (b: number) => b < 18.5 ? "#3b82f6" : b < 25 ? "#22c55e" : b < 30 ? "#f59e0b" : b < 35 ? "#f97316" : "#ef4444";

  return (
    <div>
      <svg viewBox="0 0 240 140" className="w-full">
        <path d={arc(cx, cy, r, 180, 360)} fill="none" stroke="#e5e7eb" strokeWidth="18" strokeLinecap="butt" />
        {segments.map((s, i) => <path key={i} d={arc(cx, cy, r, s.s, s.e)} fill="none" stroke={s.c} strokeWidth="18" strokeLinecap="butt" />)}
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#1f2937" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="6" fill="#1f2937" />
        <text x={cx} y={cy - 18} textAnchor="middle" fontSize="26" fontWeight="900" fill="#1f2937">{bmi.toFixed(1)}</text>
        <text x={cx} y={cy + 22} textAnchor="middle" fontSize="10" fill="#9ca3af">BMI (kg/m²)</text>
      </svg>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 px-2">
        {ranges.map((r, i) => <div key={i} className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: r.c }} /><span className="text-[10px] text-slate-500 truncate">{r.l}</span><span className="text-[10px] text-slate-400 ml-auto">{r.r}</span></div>)}
      </div>
      <div className="mt-2 text-center"><span className="text-[11px] font-semibold px-3 py-1 rounded-full text-white" style={{ background: bmiColor(bmi) }}>{bmi < 18.5 ? t("underweight") : bmi < 25 ? t("normal") : bmi < 30 ? t("overweight") : bmi < 35 ? `${t("obese")} I` : `${t("obese")} II`}</span></div>
    </div>
  );
}

export function TrackerInsights({ userId, stepGoal, waterTargetMl, waterMl, measurements, bmi, profile }: Props) {
  const { t } = useLanguage();
  const [period, setPeriod] = useState<Period>("Weekly");
  const [weekRef, setWeekRef] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [monthRef, setMonthRef] = useState(() => startOfMonth(new Date()));
  const [yearRef, setYearRef] = useState(() => startOfYear(new Date()));
  const todayStr = format(new Date(), "yyyy-MM-dd");

  const weekDays = Array.from({ length: 7 }, (_, i) => { const d = addDays(weekRef, i); const ds = format(d, "yyyy-MM-dd"); return { day: format(d, "EEE"), date: ds, steps: getStepsForDate(userId, ds), cal: Math.round(getStepsForDate(userId, ds) * 0.04) }; });
  const monthDays = eachDayOfInterval({ start: monthRef, end: endOfMonth(monthRef) }).map((d) => { const ds = format(d, "yyyy-MM-dd"); const s = getStepsForDate(userId, ds); return { day: format(d, "d"), date: ds, steps: s, cal: Math.round(s * 0.04) }; });
  const yearMonths = eachMonthOfInterval({ start: yearRef, end: endOfYear(yearRef) }).map((m) => { const days = eachDayOfInterval({ start: m, end: endOfMonth(m) }); const ts = days.reduce((s, d) => s + getStepsForDate(userId, format(d, "yyyy-MM-dd")), 0); const mm = measurements.filter((me) => me.log_date.startsWith(format(m, "yyyy-MM"))); return { day: format(m, "MMM"), steps: ts, cal: Math.round(ts * 0.04), weight: mm.length ? mm.reduce((s, me) => s + (me.weight_kg ?? 0), 0) / mm.length : null }; });

  const chartData = period === "Weekly" ? weekDays : period === "Monthly" ? monthDays : yearMonths;
  const waterData = chartData.map((d) => ({ day: d.day, water: "date" in d && d.date === todayStr ? waterMl : 0 }));
  const weightData = (() => { if (period === "Weekly") return measurements.filter((m) => { const wS = format(weekRef, "yyyy-MM-dd"); const wE = format(addDays(weekRef, 6), "yyyy-MM-dd"); return m.log_date >= wS && m.log_date <= wE; }).map((m) => ({ day: format(new Date(m.log_date), "d"), weight: m.weight_kg ?? 0 })).reverse(); if (period === "Monthly") return measurements.filter((m) => m.log_date.startsWith(format(monthRef, "yyyy-MM"))).map((m) => ({ day: format(new Date(m.log_date), "d"), weight: m.weight_kg ?? 0 })).reverse(); return yearMonths.filter((m) => m.weight !== null).map((m) => ({ day: m.day, weight: m.weight ?? 0 })); })();

  const dl = period === "Weekly" ? `${format(weekRef, "MMM d")} - ${format(addDays(weekRef, 6), "MMM d, yyyy")}` : period === "Monthly" ? format(monthRef, "MMMM yyyy") : format(yearRef, "yyyy");
  const prev = () => { period === "Weekly" ? setWeekRef(subWeeks(weekRef, 1)) : period === "Monthly" ? setMonthRef(subMonths(monthRef, 1)) : setYearRef(subYears(yearRef, 1)); };
  const next = () => { period === "Weekly" ? setWeekRef(addWeeks(weekRef, 1)) : period === "Monthly" ? setMonthRef(addMonths(monthRef, 1)) : setYearRef(addYears(yearRef, 1)); };

  const CH = 140;
  const periods: Period[] = ["Weekly", "Monthly", "Yearly"];
  const periodLabels = [t("weekly"), t("monthly"), t("yearly")];

  return (
    <div className="space-y-4">

      {/* Period selector */}
      <div className="flex gap-1 bg-slate-100 rounded-full p-1">
        {periods.map((p, i) => (
          <button key={p} onClick={() => setPeriod(p)} className={cn("flex-1 py-2 rounded-full text-[12px] font-semibold transition-all", period === p ? "bg-white text-slate-900 shadow-[0_1px_3px_rgba(15,23,42,0.08)]" : "text-slate-500")}>{periodLabels[i]}</button>
        ))}
      </div>

      {/* Date nav */}
      <div className="flex items-center justify-between">
        <button onClick={prev} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100"><ChevronLeft className="w-4 h-4 text-slate-500" /></button>
        <span className="text-[13px] font-semibold text-slate-700">{dl}</span>
        <button onClick={next} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100"><ChevronRight className="w-4 h-4 text-slate-500" /></button>
      </div>

      {/* Calorie Chart */}
      <SectionCard title={t("calorie_kcal")} accent="#10B981">
        <ResponsiveContainer width="100%" height={CH}><BarChart data={chartData} margin={{ left: -20, right: 8, top: 8, bottom: 0 }} barSize={period === "Monthly" ? 8 : 18}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" /><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#94a3b8" }} /><YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#94a3b8" }} /><Tooltip formatter={(v: number) => [`${v} kcal`, t("calories")]} /><ReferenceLine y={Math.round(stepGoal * 0.04)} stroke="#10B981" strokeDasharray="4 4" strokeWidth={1.5} /><Bar dataKey="cal" fill="#A7F3D0" radius={[4, 4, 0, 0]} activeBar={{ fill: "#10B981" }} /></BarChart></ResponsiveContainer>
        <div className="flex items-center gap-4 px-4 pb-3 text-[11px] text-slate-500"><span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-emerald-200" /> {t("calorie")}</span><span className="flex items-center gap-1"><span className="w-4 border-t-2 border-dashed border-emerald-500" /> {t("calorie_intake_goal")}</span></div>
      </SectionCard>

      {/* Water Chart */}
      <SectionCard title={t("water_ml")} accent="#3B82F6">
        <ResponsiveContainer width="100%" height={CH}><BarChart data={waterData} margin={{ left: -20, right: 8, top: 8, bottom: 0 }} barSize={period === "Monthly" ? 8 : 18}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" /><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#94a3b8" }} /><YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#94a3b8" }} /><Tooltip formatter={(v: number) => [`${v} mL`, t("water")]} /><ReferenceLine y={waterTargetMl} stroke="#3B82F6" strokeDasharray="4 4" strokeWidth={1.5} /><Bar dataKey="water" fill="#BFDBFE" radius={[4, 4, 0, 0]} activeBar={{ fill: "#3B82F6" }} /></BarChart></ResponsiveContainer>
        <div className="flex items-center gap-4 px-4 pb-3 text-[11px] text-slate-500"><span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-blue-200" /> {t("water")}</span><span className="flex items-center gap-1"><span className="w-4 border-t-2 border-dashed border-blue-500" /> {t("water_intake_goal")}</span></div>
      </SectionCard>

      {/* Steps Chart */}
      <SectionCard title={t("steps")} accent="#F97316">
        <ResponsiveContainer width="100%" height={CH}><BarChart data={chartData} margin={{ left: -20, right: 8, top: 8, bottom: 0 }} barSize={period === "Monthly" ? 8 : 18}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" /><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#94a3b8" }} /><YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#94a3b8" }} /><Tooltip formatter={(v: number) => [`${v.toLocaleString()}`, t("steps")]} /><ReferenceLine y={stepGoal} stroke="#F97316" strokeDasharray="4 4" strokeWidth={1.5} /><Bar dataKey="steps" fill="#FED7AA" radius={[4, 4, 0, 0]} activeBar={{ fill: "#F97316" }} /></BarChart></ResponsiveContainer>
        <div className="flex items-center gap-4 px-4 pb-3 text-[11px] text-slate-500"><span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-orange-200" /> {t("selected")}</span><span className="flex items-center gap-1"><span className="w-4 border-t-2 border-dashed border-orange-500" /> {t("step_goal")}</span></div>
      </SectionCard>

      {/* Weight Chart */}
      <SectionCard title={t("weight_kg")} accent="#EF4444">
        {weightData.length < 2 ? <p className="text-[13px] text-slate-400 px-4 pb-4">{t("log_more_weight")}</p> : (
          <ResponsiveContainer width="100%" height={CH}><LineChart data={weightData} margin={{ left: -20, right: 8, top: 8, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" /><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#94a3b8" }} /><YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#94a3b8" }} domain={["auto", "auto"]} /><Tooltip formatter={(v: number) => [`${v.toFixed(1)} kg`, t("weight")]} />{profile?.target_weight_kg && <ReferenceLine y={profile.target_weight_kg} stroke="#EF4444" strokeDasharray="4 4" strokeWidth={1.5} />}<Line type="monotone" dataKey="weight" stroke="#FCA5A5" strokeWidth={2} dot={<Dot r={4} fill="#EF4444" stroke="#fff" strokeWidth={2} />} activeDot={{ r: 6, fill: "#EF4444" }} /></LineChart></ResponsiveContainer>
        )}
        <div className="flex items-center gap-4 px-4 pb-3 text-[11px] text-slate-500"><span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-200" /> {t("selected")}</span>{profile?.target_weight_kg && <span className="flex items-center gap-1"><span className="w-4 border-t-2 border-dashed border-red-400" /> {t("weight_goal")}</span>}</div>
      </SectionCard>

      {/* BMI Gauge */}
      <div className="rounded-2xl bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100 overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <p className="font-extrabold text-slate-800 text-[14px]">{t("bmi")}</p>
          {bmi != null && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">{bmi < 18.5 ? t("underweight") : bmi < 25 ? t("normal") : bmi < 30 ? t("overweight") : t("obese")}</span>}
        </div>
        <div className="px-4 pb-4">{bmi != null ? <BmiGauge bmi={bmi} /> : <p className="text-[13px] text-slate-400 py-4 text-center">{t("set_height_weight_bmi")}</p>}</div>
      </div>
    </div>
  );
}
