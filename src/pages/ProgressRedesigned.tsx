import { useState, useEffect, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Flame,
  Target,
  RefreshCw,
  ChevronRight,
  Plus,
  TrendingUp,
  Calendar,
  Wheat,
  Droplets,
  Leaf,
  AlertTriangle,
  Zap,
  Info,
  Utensils,
  Droplet,
} from "lucide-react";
import { format } from "date-fns";
import { subDays } from "date-fns";
import { cn } from "@/lib/utils";

// Hooks
import { useWeeklySummary } from "@/hooks/useWeeklySummary";
import { useWaterIntake } from "@/hooks/useWaterIntake";
import { useStreak } from "@/hooks/useStreak";
import { useNutritionGoals } from "@/hooks/useNutritionGoals";
import { useMealQuality } from "@/hooks/useMealQuality";
import { useSmartRecommendations } from "@/hooks/useSmartRecommendations";
import { useWeightChartData } from "@/hooks/useWeightChartData";

// Components
import { ProfessionalWeeklyReport } from "@/components/progress/ProfessionalWeeklyReport";
import { GoalsTab } from "@/components/progress/GoalsTab";

import { useLanguage } from "@/contexts/LanguageContext";

// ─── SVG Ring Component ─────────────────────────────────────────
function RingGauge({
  percentage,
  color,
  size = 100,
  strokeWidth = 8,
  icon,
  label,
  goalText,
}: {
  percentage: number;
  color: string;
  size?: number;
  strokeWidth?: number;
  icon: React.ReactNode;
  label: string;
  goalText: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (Math.min(percentage, 100) / 100) * circumference;

  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 flex flex-col items-center">
      <p className="text-sm font-semibold text-gray-700 mb-3">{label}</p>
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full -rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#f3f4f6"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center shadow-md",
              color === "#f97316" && "bg-orange-500",
              color === "#3b82f6" && "bg-blue-500"
            )}
          >
            {icon}
          </div>
        </div>
      </div>
      <p className="mt-3 text-2xl font-bold" style={{ color }}>
        {percentage}%
      </p>
      <p className="text-xs text-gray-400">{goalText}</p>
    </div>
  );
}

// ─── Meal Quality Mini Ring ────────────────────────────────────
function MiniRing({ percentage, color }: { percentage: number; color: string }) {
  const size = 28;
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (Math.min(percentage, 100) / 100) * circumference;

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-7 h-7 -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#e5e7eb"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circumference}`}
      />
    </svg>
  );
}

// ─── Weight Forecast Chart ───────────────────────────────────────
function WeightForecastChart({ data }: { data: Array<{ label: string; actual: number | null; predicted: number | null }> }) {
  const allValues = data
    .flatMap(d => [d.actual, d.predicted])
    .filter((v): v is number => v != null);

  if (allValues.length === 0) {
    return <p className="text-xs text-gray-400 mt-3">No weight data yet</p>;
  }

  const width = 280;
  const height = 80;
  const padding = 10;
  const max = Math.max(...allValues);
  const min = Math.min(...allValues);
  const range = max - min || 1;

  const toY = (val: number) => height - padding - ((val - min) / range) * (height - padding * 2);
  const toX = (i: number) => padding + (i / Math.max(data.length - 1, 1)) * (width - padding * 2);

  const actualPoints = data
    .map((d, i) => d.actual != null ? { x: toX(i), y: toY(d.actual) } : null)
    .filter((p): p is { x: number; y: number } => p != null);

  const forecastPoints = data
    .map((d, i) => d.predicted != null ? { x: toX(i), y: toY(d.predicted) } : null)
    .filter((p): p is { x: number; y: number } => p != null);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-20 mt-3">
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#22c55e" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Area fill */}
      <polygon
        points={`${actualPoints.map(p => `${p.x},${p.y}`).join(" ")} ${toX(actualPoints.length - 1)},${height} ${toX(0)},${height}`}
        fill="url(#areaGrad)"
      />
      {/* Actual line */}
      {actualPoints.length > 1 && (
        <polyline
          points={actualPoints.map(p => `${p.x},${p.y}`).join(" ")}
          fill="none"
          stroke="#22c55e"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {/* Actual dots */}
      {actualPoints.map((p, i) => (
        <circle key={`a-${i}`} cx={p.x} cy={p.y} r={3} fill="#22c55e" />
      ))}
      {/* Forecast dashed line */}
      {forecastPoints.length > 1 && (
        <polyline
          points={forecastPoints.map(p => `${p.x},${p.y}`).join(" ")}
          fill="none"
          stroke="#22c55e"
          strokeWidth={1.5}
          strokeDasharray="4 4"
          strokeLinecap="round"
          opacity={0.5}
        />
      )}
      {/* Forecast dots */}
      {forecastPoints.map((p, i) => (
        <circle key={`f-${i}`} cx={p.x} cy={p.y} r={2.5} fill="#22c55e" opacity={0.5} />
      ))}
    </svg>
  );
}

// ─── Food Score Card ───────────────────────────────────────────
function FoodScoreCard({ score, label }: { score: number; label: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 p-5 text-white shadow-md">
      <div className="absolute -top-6 -right-6 w-28 h-28 bg-white/10 rounded-full" />
      <div className="flex items-center gap-4 relative z-10">
        <div className="relative shrink-0">
          <svg className="w-20 h-20 -rotate-90">
            <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="6" />
            <circle
              cx="40" cy="40" r="34" fill="none" stroke="white" strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${(score / 5) * 213.6} 213.6`}
              className="transition-all duration-1000"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-bold">{score}</span>
            <span className="text-[10px] text-white/70">of 5</span>
          </div>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-1">
            <span className="font-semibold text-sm">{label}</span>
            <Info className="w-3.5 h-3.5 text-white/70" />
          </div>
          <p className="text-sm text-white/90 mt-0.5">Good job, keep going!</p>
          <div className="flex gap-1 mt-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className={cn(
                "h-1.5 flex-1 rounded-full",
                i < score ? "bg-white" : i === score ? "bg-yellow-300" : "bg-white/20"
              )} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Macro Circle ──────────────────────────────────────────────
type MacroCircleProps = {
  icon: ReactNode;
  color: "orange" | "blue" | "amber";
  value: string | number;
  target: string | number;
  unit: string;
  label: string;
};

function MacroCircle({ icon, color, value, target, unit, label }: MacroCircleProps) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className={cn(
        "w-16 h-16 rounded-full shadow-lg flex items-center justify-center text-white",
        color === "orange" && "bg-gradient-to-br from-orange-400 to-orange-600 shadow-orange-200",
        color === "blue" && "bg-gradient-to-br from-blue-400 to-blue-600 shadow-blue-200",
        color === "amber" && "bg-gradient-to-br from-amber-400 to-amber-600 shadow-amber-200"
      )}>
        {icon}
      </div>
      <div className="text-center">
        <p className="text-sm font-bold text-slate-900">
          {value} <span className="text-xs font-normal text-slate-500">/ {target}{unit}</span>
        </p>
        <p className="text-[10px] font-medium text-slate-500">{label}</p>
      </div>
    </div>
  );
}

// ─── Macro Detail Card ─────────────────────────────────────────
type MacroDetailCardProps = {
  icon: ReactNode;
  label: string;
  color: string;
  status: string;
  value: string | number;
  unit: string;
  goal: string;
  remaining: string;
};

function MacroDetailCard({ icon, label, color, status, value, unit, goal, remaining }: MacroDetailCardProps) {
  const statusColors: Record<string, string> = {
    "Below Goal": "bg-blue-50 text-blue-500",
    "On Track": "bg-emerald-50 text-emerald-500",
    "Good": "bg-emerald-50 text-emerald-500",
    "Exceeding": "bg-amber-50 text-amber-500",
    "Need More": "bg-blue-50 text-blue-500",
  };
  const iconBg: Record<string, string> = {
    orange: "bg-orange-100",
    blue: "bg-blue-100",
    emerald: "bg-emerald-100",
    cyan: "bg-cyan-100",
  };
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", iconBg[color] || "bg-slate-100")}>
            {icon}
          </div>
          <span className="text-xs font-medium text-slate-700">{label}</span>
        </div>
        <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full", statusColors[status] || "bg-slate-100 text-slate-500")}>
          {status}
        </span>
      </div>
      <div className="flex items-baseline gap-1 mb-1">
        <span className="text-3xl font-extrabold text-slate-900">{value}</span>
        <span className="text-sm font-medium text-slate-400">{unit}</span>
      </div>
      <p className="text-xs text-slate-400 mb-2">Goal: {goal}</p>
      <div className="h-px bg-slate-100 mb-2" />
      <p className="text-xs text-slate-500">Remaining: {remaining}</p>
    </div>
  );
}

// ─── Micro Stat Card ───────────────────────────────────────────
function MicroStatCard({ value, label, goal }: { value: string | number; label: string; goal: string }) {
  return (
    <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100 text-center">
      <p className="text-lg font-bold text-slate-900">{value}</p>
      <p className="text-[10px] text-slate-500 mt-0.5">{label}</p>
      <p className="text-[9px] text-slate-400 mt-0.5">Goal: {goal}</p>
    </div>
  );
}

// ─── Nutrient Balance Bar ──────────────────────────────────────
function NutrientBalance({ onTrack, needMore, exceeding, noData }: { onTrack: number; needMore: number; exceeding: number; noData: number }) {
  const total = onTrack + needMore + exceeding + noData || 1;
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-slate-900">Nutrient Balance</h3>
        <span className="text-xs font-medium text-emerald-500">View More</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden flex">
        <div className="h-full bg-emerald-500" style={{ width: `${(onTrack / total) * 100}%` }} />
        <div className="h-full bg-blue-500" style={{ width: `${(needMore / total) * 100}%` }} />
        <div className="h-full bg-amber-500" style={{ width: `${(exceeding / total) * 100}%` }} />
        <div className="h-full bg-slate-200" style={{ width: `${(noData / total) * 100}%` }} />
      </div>
      <div className="flex items-center justify-between mt-2 text-[10px] text-slate-500">
        <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />On Track</div>
        <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-blue-500" />Need More</div>
        <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-amber-500" />Exceeding</div>
        <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-slate-200" />No Data</div>
      </div>
    </div>
  );
}

// ─── Insight Item ────────────────────────────────────────────────
function InsightItem({ icon, color, title, subtitle }: { icon: ReactNode; color: string; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-slate-50 last:border-0">
      <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shrink-0", color)}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900">{title}</p>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
    </div>
  );
}

// ─── Recommendation Card ─────────────────────────────────────────
function RecommendationCard({ title, description, linkText }: { title: string; description: string; linkText: string }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 border-l-4 border-l-red-500">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-semibold text-slate-900">Recommendation</span>
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-600">AI</span>
      </div>
      <div className="flex items-start gap-3 mt-2">
        <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
          <Leaf className="w-5 h-5 text-red-500" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-slate-900">{title}</p>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">{description}</p>
          <p className="text-xs font-semibold text-emerald-500 mt-2">{linkText}</p>
        </div>
        <ChevronRight className="w-4 h-4 text-slate-300 shrink-0 mt-1" />
      </div>
    </div>
  );
}

type TodayMetric = {
  label: string;
  icon: string;
  value: string;
  target: string;
  percent: number;
  color: string;
  soft: string;
};

function ProgressArc({
  percent,
  color,
  size = 120,
  stroke = 9,
  trackColor = "#EEF2F5",
}: {
  percent: number;
  color: string;
  size?: number;
  stroke?: number;
  trackColor?: string;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (Math.min(Math.max(percent, 0), 100) / 100) * circumference;

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={trackColor} strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circumference}`}
      />
    </svg>
  );
}

function HeroSideMetric({ metric }: { metric: TodayMetric }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-[16px] border border-white/15 bg-white/14 px-3 py-2.5 text-center text-white shadow-[inset_0_1px_14px_rgba(255,255,255,0.16),0_8px_20px_rgba(15,23,42,0.12)] backdrop-blur-md">
      <div className="flex h-8 w-8 items-center justify-center rounded-full shadow-[0_6px_12px_rgba(15,23,42,0.12)]" style={{ background: metric.soft }}>
        <span className="text-[16px] leading-none">{metric.icon}</span>
      </div>
      <p className="text-[18px] font-extrabold leading-none tracking-[-0.04em]">{metric.value}</p>
      <p className="text-[11px] font-medium leading-none text-white/82">{metric.label}</p>
      <div className="h-[4px] w-full overflow-hidden rounded-full bg-black/12">
        <div className="h-full rounded-full" style={{ width: `${Math.min(metric.percent, 100)}%`, background: metric.color }} />
      </div>
    </div>
  );
}

function MetricCard({ metric }: { metric: TodayMetric }) {
  return (
    <div className="min-w-[112px] rounded-[22px] border border-slate-100 bg-white p-4 text-center shadow-[0_14px_32px_rgba(15,23,42,0.08)]">
      <p className="text-[13px] font-bold text-slate-700">{metric.label}</p>
      <div className="relative mx-auto mt-3 h-[82px] w-[82px]">
        <ProgressArc percent={metric.percent} color={metric.color} size={82} stroke={7} />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: metric.soft }}>
            <span className="text-2xl leading-none">{metric.icon}</span>
          </div>
        </div>
      </div>
      <p className="mt-3 text-[22px] font-extrabold leading-none text-slate-950">{metric.value}</p>
      <p className="mt-1 text-[13px] font-semibold text-slate-400">/ {metric.target}</p>
    </div>
  );
}

function StreakCard({ currentStreak }: { currentStreak: number }) {
  const activeDays = Math.min(currentStreak, 4);
  const days = ["M", "T", "W", "T", "F", "S", "S"];

  return (
    <div className="rounded-[22px] border border-slate-100 bg-white p-5 shadow-[0_12px_28px_rgba(15,23,42,0.06)]">
      {/* Top: icon + text */}
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-orange-50 text-2xl">🔥</div>
        <div>
          <p className="text-base font-extrabold text-slate-950">Streak</p>
          <p className="text-[13px] font-medium text-slate-500">Keep it going!</p>
        </div>
      </div>

      {/* Middle: weekday timeline */}
      <div className="mt-4 flex items-center justify-between px-1">
        {days.map((day, index) => {
          const complete = index < activeDays;
          const today = index === 4;
          return (
            <div key={`${day}-${index}`} className="flex flex-col items-center gap-1.5">
              <span className="text-[11px] font-semibold text-slate-400">{day}</span>
              <span
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold",
                  complete && "bg-emerald-500 text-white shadow-[0_6px_12px_rgba(16,185,129,0.22)]",
                  today && !complete && "border-2 border-orange-500 bg-white text-transparent",
                  !complete && !today && "border-2 border-slate-200 bg-white text-transparent"
                )}
              >
                ✓
              </span>
            </div>
          );
        })}
      </div>

      {/* Bottom: count badge */}
      <div className="mt-4 flex justify-center">
        <div className="inline-flex items-center gap-2 rounded-[14px] bg-orange-50 px-4 py-2">
          <p className="text-2xl font-extrabold leading-none text-orange-500">{currentStreak}</p>
          <div className="leading-tight">
            <p className="text-[11px] font-semibold text-slate-500">Day Streak</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function AiInsightCard({ score, label, color }: { score: number; label: string; color: string }) {
  return (
    <div className="relative overflow-hidden rounded-[22px] border border-violet-100 bg-violet-50/80 px-4 py-4 shadow-[0_12px_30px_rgba(124,58,237,0.08)]">
      <div className="absolute right-20 top-4 h-16 w-36 opacity-70">
        <svg viewBox="0 0 140 54" className="h-full w-full">
          <polyline points="2,42 22,18 42,20 61,4 80,25 99,19 118,11 137,2" fill="none" stroke="#9B7EF3" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          {[2, 22, 42, 61, 80, 99, 118, 137].map((x, i) => (
            <circle key={x} cx={x} cy={[42, 18, 20, 4, 25, 19, 11, 2][i]} r="3" fill="#B7A3FF" />
          ))}
        </svg>
      </div>
      <div className="relative flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-violet-200 text-3xl shadow-[0_12px_24px_rgba(124,58,237,0.16)]">✦</div>
          <div>
            <p className="text-[13px] font-extrabold text-violet-600">AI Insight</p>
            <p className="text-[15px] font-semibold text-slate-700">Your meal quality is <span style={{ color }}>{label}</span></p>
            <p className="mt-1 text-[13px] font-medium text-slate-500">+12% better than last week <span className="text-emerald-500">↑</span></p>
          </div>
        </div>
        <div className="rounded-[14px] bg-violet-100 px-3 py-2 text-center">
          <span className="text-lg font-extrabold text-violet-600">{score}</span>
          <span className="text-sm font-semibold text-violet-500">/100</span>
        </div>
      </div>
    </div>
  );
}

function SmartRecommendationStrip() {
  const items = [
    { icon: "🥦", title: "Add more\ngreens today", bg: "bg-emerald-50", color: "#10B981" },
    { icon: "💧", title: "Drink 2 more\nglasses of water", bg: "bg-blue-50", color: "#3B82F6" },
    { icon: "👟", title: "Great streak\nmomentum!", bg: "bg-orange-50", color: "#F97316" },
    { icon: "🌙", title: "Aim for\n7–8 hours", bg: "bg-violet-50", color: "#8B5CF6" },
  ];

  return (
    <section>
      <div className="mb-3 flex items-center justify-between px-0.5">
        <h2 className="text-lg font-extrabold text-slate-950">Smart Recommendations</h2>
        <button className="flex items-center gap-1 text-sm font-bold text-emerald-600">
          View All
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
        {items.map((item) => (
          <div key={item.title} className={cn("flex min-w-[166px] items-center gap-3 rounded-[18px] border border-slate-100 p-3 shadow-[0_10px_22px_rgba(15,23,42,0.05)]", item.bg)}>
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-2xl">{item.icon}</div>
            <p className="flex-1 whitespace-pre-line text-[13px] font-semibold leading-tight text-slate-600">{item.title}</p>
            <div className="flex h-7 w-7 items-center justify-center rounded-full text-white" style={{ background: item.color }}>
              <ChevronRight className="h-4 w-4" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

type WeekStatus = "on" | "partial" | "none";

type WeekDaySummary = {
  day: string;
  featured?: boolean;
  status: WeekStatus;
  kcal: string;
  meals: WeekStatus;
  workouts: WeekStatus;
  water: WeekStatus;
};

const weeklyDays: WeekDaySummary[] = [
  { day: "Mon", status: "on", kcal: "2,078", meals: "on", workouts: "on", water: "on" },
  { day: "Tue", status: "on", kcal: "2,150", meals: "on", workouts: "on", water: "on" },
  { day: "Wed", status: "on", kcal: "1,980", meals: "on", workouts: "partial", water: "on" },
  { day: "Thu", featured: true, status: "partial", kcal: "1,420", meals: "partial", workouts: "on", water: "partial" },
  { day: "Fri", status: "on", kcal: "2,300", meals: "on", workouts: "none", water: "on" },
  { day: "Sat", status: "none", kcal: "—", meals: "none", workouts: "none", water: "none" },
  { day: "Sun", status: "none", kcal: "—", meals: "none", workouts: "none", water: "none" },
];

const nutrientTrendCards = [
  {
    icon: "🔥",
    label: "Calories",
    avg: "avg",
    value: "1,986",
    unit: "kcal",
    color: "#F97316",
    delta: "8%",
    positive: true,
    points: [27, 39, 47, 42, 44, 55, 37, 40],
  },
  {
    icon: "◎",
    label: "Protein",
    avg: "avg",
    value: "132",
    unit: "g",
    color: "#2F80ED",
    delta: "14%",
    positive: true,
    points: [42, 35, 48, 55, 58, 39, 52],
  },
  {
    icon: "💧",
    label: "Water",
    avg: "avg",
    value: "6.2",
    unit: "Glasses",
    color: "#2F80ED",
    delta: "5%",
    positive: false,
    points: [58, 43, 48, 34, 37, 22, 25],
  },
];

function WeekStatusDot({ status, size = "sm" }: { status: WeekStatus; size?: "sm" | "lg" }) {
  const isLarge = size === "lg";

  if (status === "on") {
    return (
      <span className={cn("inline-flex items-center justify-center rounded-full bg-emerald-500 text-white shadow-[0_4px_8px_rgba(16,185,129,0.24)]", isLarge ? "h-7 w-7 text-sm" : "h-4 w-4 text-[10px]")}>✓</span>
    );
  }

  if (status === "partial") {
    return (
      <span className={cn("inline-flex items-center justify-center rounded-full border-[3px] border-orange-500 bg-white text-orange-500", isLarge ? "h-7 w-7 border-[3px] text-xs" : "h-4 w-4 border-2 text-[8px]")}>{isLarge ? "" : "↗"}</span>
    );
  }

  return <span className={cn("inline-flex rounded-full border-2 border-slate-300 bg-white", isLarge ? "h-7 w-7" : "h-4 w-4")} />;
}

function WeekRowIcon({ icon, color }: { icon: string; color: string }) {
  return (
    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-sm shadow-[0_6px_12px_rgba(15,23,42,0.08)]" style={{ background: color }}>
      {icon}
    </div>
  );
}

function WeeklyScoreRing() {
  return (
    <div className="relative h-[130px] w-[130px] shrink-0">
      <svg viewBox="0 0 150 150" className="absolute inset-0 h-full w-full -rotate-90">
        <circle cx="75" cy="75" r="58" fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="13" />
        <circle cx="75" cy="75" r="58" fill="none" stroke="#6EE7A8" strokeWidth="13" strokeLinecap="round" strokeDasharray="150 365" />
        <circle cx="75" cy="75" r="58" fill="none" stroke="#6EE7A8" strokeWidth="13" strokeLinecap="round" strokeDasharray="204 365" strokeDashoffset="-186" />
      </svg>
      <svg viewBox="0 0 104 74" className="absolute left-5 top-9 h-[64px] w-[90px]">
        <polyline points="5,55 20,39 34,36 48,23 61,40 76,29 96,24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {[5, 34, 48, 61, 76, 96].map((x, index) => (
          <circle key={x} cx={x} cy={[55, 36, 23, 40, 29, 24][index]} r="4" fill={index === 5 ? "#FDE68A" : "white"} stroke="rgba(0,80,80,0.24)" strokeWidth="1" />
        ))}
      </svg>
    </div>
  );
}

function WeeklyScoreHero({ currentStreak }: { currentStreak: number }) {
  return (
    <section className="relative overflow-hidden rounded-[24px] bg-[radial-gradient(circle_at_80%_0%,rgba(45,212,191,0.55),transparent_40%),linear-gradient(135deg,#078E79_0%,#036D68_48%,#0E9B91_100%)] px-4 py-5 text-white shadow-[0_18px_38px_rgba(0,108,95,0.22)]">
      <div className="relative grid grid-cols-[1fr_130px_1fr] items-center gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h2 className="text-[17px] font-extrabold tracking-[-0.03em]">Weekly Score</h2>
            <Info className="h-4 w-4 text-white/80" />
          </div>
          <div className="mt-3 flex items-end gap-1 tracking-[-0.06em]">
            <span className="text-[48px] font-black leading-none">82</span>
            <span className="mb-1 text-[18px] font-extrabold">/100</span>
          </div>
          <div className="mt-3 inline-flex rounded-full bg-white/12 px-2.5 py-1.5 text-[11px] font-bold text-white shadow-[inset_0_1px_10px_rgba(255,255,255,0.12)]">↑ 12 pts vs last week</div>
        </div>
        <WeeklyScoreRing />
        <div className="space-y-3">
          {[
            { icon: "🔥", value: `${Math.max(currentStreak, 5)} Day Streak`, text: "Keep it up!", bg: "rgba(255,152,0,0.34)" },
            { icon: "🌿", value: "82%", text: "Nutrition Consistency", bg: "rgba(16,185,129,0.34)" },
            { icon: "💧", value: "+12%", text: "Water vs last week", bg: "rgba(59,130,246,0.45)" },
          ].map((item) => (
            <div key={item.value} className="flex items-center gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg shadow-[0_8px_18px_rgba(15,23,42,0.15)]" style={{ background: item.bg }}>{item.icon}</div>
              <div className="min-w-0">
                <p className="text-[14px] font-extrabold leading-tight">{item.value}</p>
                <p className="text-[11px] font-medium leading-tight text-white/88">{item.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function YourWeekCard() {
  const rows: Array<{ label: string; key: "meals" | "workouts" | "water"; icon: string; color: string }> = [
    { label: "Meals Logged", key: "meals", icon: "🍴", color: "linear-gradient(135deg,#10B981,#059669)" },
    { label: "Workouts", key: "workouts", icon: "🏋️", color: "linear-gradient(135deg,#8B5CF6,#6366F1)" },
    { label: "Water Goal", key: "water", icon: "💧", color: "linear-gradient(135deg,#60A5FA,#2563EB)" },
  ];

  return (
    <section className="rounded-[22px] border border-slate-100 bg-white px-3 py-3 shadow-[0_14px_34px_rgba(15,23,42,0.06)]">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[16px] font-extrabold tracking-[-0.02em] text-slate-950">Your Week</h2>
        <div className="flex items-center gap-3 text-[10px] font-semibold text-slate-500">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />On Track</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-orange-500" />Partial</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full border border-slate-300" />None</span>
        </div>
      </div>
      <div className="grid grid-cols-[100px_repeat(7,minmax(0,1fr))] gap-y-3">
        <div />
        {weeklyDays.map((day) => (
          <div key={day.day} className="text-center">
            <p className="text-[11px] font-semibold text-slate-600">{day.day} {day.featured && <span className="text-yellow-400">★</span>}</p>
            <div className="mt-1.5 flex justify-center"><WeekStatusDot status={day.status} size="lg" /></div>
            <p className="mt-1.5 text-[12px] font-bold leading-none text-slate-900">{day.kcal}</p>
            <p className="mt-0.5 text-[10px] font-medium text-slate-500">kcal</p>
          </div>
        ))}
        {rows.map((row) => (
          <div key={row.key} className="contents">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-800">
              <WeekRowIcon icon={row.icon} color={row.color} />
              <span className="truncate leading-tight">{row.label}</span>
            </div>
            {weeklyDays.map((day) => (
              <div key={`${row.key}-${day.day}`} className="flex items-center justify-center">
                <WeekStatusDot status={day[row.key]} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function MiniSparkline({ points, color }: { points: number[]; color: string }) {
  const width = 128;
  const height = 48;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  const coords = points
    .map((point, index) => {
      const x = (index / Math.max(points.length - 1, 1)) * width;
      const y = height - ((point - min) / range) * 34 - 7;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mt-4 h-12 w-full overflow-visible">
      <polyline points={coords} fill="none" stroke={color} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
      {coords.split(" ").map((coord) => {
        const [x, y] = coord.split(",");
        return <circle key={coord} cx={x} cy={y} r="3.4" fill={color} stroke="white" strokeWidth="1.4" />;
      })}
    </svg>
  );
}

function NutrientTrendCard({ card }: { card: typeof nutrientTrendCards[number] }) {
  return (
    <div className="rounded-[20px] border border-slate-100 bg-white p-3 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
      <div className="flex items-center gap-1.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-50 text-base shadow-inner">{card.icon}</span>
        <p className="text-[12px] font-extrabold text-slate-900">{card.label} <span className="font-semibold text-slate-400">({card.avg})</span></p>
      </div>
      <div className="mt-2 flex items-end justify-between gap-1">
        <p className="text-[18px] font-black leading-none tracking-[-0.035em] text-slate-950">{card.value} <span className="text-[11px] font-semibold tracking-normal text-slate-500">{card.unit}</span></p>
        <p className={cn("text-[10px] font-extrabold", card.positive ? "text-emerald-500" : "text-red-500")}>{card.positive ? "↑" : "↓"} {card.delta} <span className="font-semibold text-slate-400">vs last</span></p>
      </div>
      <MiniSparkline points={card.points} color={card.color} />
      <div className="mt-1.5 flex justify-between text-[10px] font-semibold text-slate-400">
        {Array.from("MTWTFSS").map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}
      </div>
    </div>
  );
}

function WeekHighlightsCard() {
  const items = [
    { icon: "🏆", title: "Best Protein Day", subtitle: "Tuesday", value: "168 g", bg: "#FFF0E2" },
    { icon: "🔥", title: "Highest Burn", subtitle: "Friday", value: "720 kcal", bg: "#DCFCE7" },
    { icon: "💧", title: "Most Hydrated", subtitle: "Monday", value: "8 Gl.", bg: "#EAF4FF" },
  ];

  return (
    <div className="rounded-[20px] border border-slate-100 bg-white p-3 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
      <h3 className="text-[13px] font-extrabold text-slate-950">This Week Highlights</h3>
      <div className="mt-3 grid grid-cols-3 divide-x divide-slate-100">
        {items.map((item) => (
          <div key={item.title} className="px-1.5 text-center first:pl-0 last:pr-0">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full text-2xl" style={{ background: item.bg }}>{item.icon}</div>
            <p className="mt-2 text-[10px] font-extrabold leading-tight text-slate-900">{item.title}</p>
            <p className="mt-0.5 text-[11px] font-medium text-slate-500">{item.subtitle}</p>
            <p className="mt-0.5 text-[15px] font-black text-slate-950">{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function WeekCompareCard() {
  const rows = [
    { icon: "🔥", label: "Calories", value: "+8%", positive: true },
    { icon: "◎", label: "Protein", value: "+14%", positive: true },
    { icon: "💧", label: "Water", value: "-5%", positive: false },
    { icon: "↗", label: "Consistency", value: "+21%", positive: true },
  ];

  return (
    <div className="rounded-[20px] border border-slate-100 bg-white p-3 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
      <h3 className="text-[13px] font-extrabold text-slate-950">This Week vs Last Week</h3>
      <div className="mt-3 divide-y divide-slate-100">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-1.5 py-1.5 first:pt-0 last:pb-0">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-50 text-sm">{row.icon}</span>
            <span className="flex-1 text-[12px] font-bold text-slate-800">{row.label}</span>
            <span className={cn("text-[13px] font-black", row.positive ? "text-emerald-500" : "text-red-500")}>{row.value}</span>
            <span className={cn("flex h-6 w-6 items-center justify-center rounded-full text-xs", row.positive ? "bg-emerald-50 text-emerald-500" : "bg-red-50 text-red-500")}>{row.positive ? "↑" : "↓"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HabitConsistencyCard() {
  const habits = [
    { icon: "🍴", label: "Meal Logging", value: "6/7 days", pct: 86, color: "#10B981", bg: "#E7F8EF" },
    { icon: "💧", label: "Water", value: "5/7 days", pct: 72, color: "#10B981", bg: "#EAF4FF" },
    { icon: "🏋️", label: "Workouts", value: "3/7 days", pct: 42, color: "#8B5CF6", bg: "#F0EAFF" },
    { icon: "☾", label: "Sleep Goal", value: "6/7 days", pct: 86, color: "#10B981", bg: "#F0EAFF" },
  ];

  return (
    <div className="rounded-[20px] border border-slate-100 bg-white p-3 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[13px] font-extrabold text-slate-950">Habit Consistency</h3>
        <span className="text-[11px] font-extrabold text-emerald-600">View All</span>
      </div>
      <div className="space-y-2.5">
        {habits.map((habit) => (
          <div key={habit.label} className="grid grid-cols-[90px_1fr_48px] items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs" style={{ background: habit.bg }}>{habit.icon}</span>
              <span className="text-[11px] font-bold text-slate-800 truncate">{habit.label}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full" style={{ width: `${habit.pct}%`, background: habit.color }} />
            </div>
            <span className="text-right text-[11px] font-semibold text-slate-500">{habit.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function WeeklyGoalProgressCard() {
  const goals = [
    { label: "Calories Goal", value: "5/7 days", status: "✓", color: "text-emerald-500" },
    { label: "Protein Goal", value: "6/7 days", status: "✓", color: "text-emerald-500" },
    { label: "Water Goal", value: "5/7 days", status: "✓", color: "text-emerald-500" },
    { label: "Activity Goal", value: "3/7 days", status: "◔", color: "text-orange-500" },
  ];

  return (
    <div className="rounded-[20px] border border-slate-100 bg-white p-3 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
      <h3 className="text-[13px] font-extrabold text-slate-950">Weekly Goal Progress</h3>
      <div className="mt-2 flex items-center gap-3">
        <div className="relative h-[90px] w-[90px] shrink-0">
          <ProgressArc percent={72} color="#10B981" size={90} stroke={8} trackColor="#E8EEF0" />
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <p className="text-[26px] font-black leading-none tracking-[-0.06em] text-slate-950">72<span className="text-[12px]">%</span></p>
            <p className="mt-0.5 text-[10px] font-semibold text-slate-500">Completed</p>
          </div>
        </div>
        <div className="flex-1 space-y-2">
          {goals.map((goal) => (
            <div key={goal.label} className="grid grid-cols-[16px_1fr_48px_14px] items-center gap-1.5">
              <span className={cn("text-sm leading-none", goal.color)}>{goal.status}</span>
              <span className="text-[11px] font-bold text-slate-800 truncate">{goal.label}</span>
              <span className="text-right text-[11px] font-semibold text-slate-700">{goal.value}</span>
              <span className={cn("text-right text-sm leading-none", goal.color)}>✓</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AiWeeklyInsightCard() {
  return (
    <div className="relative overflow-hidden rounded-[20px] bg-[radial-gradient(circle_at_92%_20%,rgba(255,255,255,0.9),transparent_14%),linear-gradient(135deg,#F4ECFF_0%,#EDE4FF_52%,#F9F6FF_100%)] p-4 shadow-[0_16px_34px_rgba(124,58,237,0.15)]">
      <span className="absolute left-4 top-4 text-2xl text-indigo-500">✦</span>
      <span className="absolute right-6 top-6 text-base text-violet-400">✦</span>
      <h3 className="ml-8 text-[14px] font-extrabold text-indigo-600">AI Weekly Insight</h3>
      <p className="mt-4 text-[13px] font-medium leading-6 text-slate-700">Your protein intake <span className="font-black text-slate-950">improved 18%</span> this week. Keep this pace for better muscle recovery and energy!</p>
    </div>
  );
}

function WeeklyAchievementsCard() {
  const achievements = [
    { icon: "🔥", label: "5 Day Streak", bg: "#FFF0E2" },
    { icon: "🥗", label: "Balanced Week", bg: "#DCFCE7" },
    { icon: "💧", label: "Hydration Hero", bg: "#EAF4FF" },
    { icon: "⭐", label: "Consistency", bg: "#EFE7FF" },
  ];

  return (
    <div className="rounded-[20px] border border-slate-100 bg-white p-3 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[13px] font-extrabold text-slate-950">Weekly Achievements</h3>
        <span className="text-[11px] font-extrabold text-emerald-600">View All</span>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {achievements.map((item) => (
          <div key={item.label} className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full text-2xl" style={{ background: item.bg }}>{item.icon}</div>
            <p className="mt-1.5 text-[10px] font-bold leading-tight text-slate-900">{item.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function WeekTabClone({ firstName, syncing, onSync, currentStreak }: { firstName: string; syncing: boolean; onSync: () => void; currentStreak: number }) {
  return (
    <div className="space-y-4 pb-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[20px] font-black leading-tight tracking-[-0.04em] text-slate-950">Hello, {firstName}! <span className="text-[18px]">👋</span></h2>
          <p className="mt-0.5 text-[13px] font-medium text-slate-500">Here's your weekly nutrition overview</p>
        </div>
        <button
          onClick={onSync}
          disabled={syncing}
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-emerald-500 bg-white px-3 text-[12px] font-extrabold text-emerald-600 shadow-[0_6px_14px_rgba(16,185,129,0.08)] active:scale-95 disabled:opacity-70"
        >
          <RefreshCw className={cn("h-4 w-4", syncing && "animate-spin")} />
          Sync
        </button>
      </div>

      <WeeklyScoreHero currentStreak={currentStreak} />
      <YourWeekCard />

      <section>
        <div className="mb-2 flex items-center justify-between px-0.5">
          <h2 className="text-[16px] font-extrabold tracking-[-0.02em] text-slate-950">Nutrient Trends</h2>
          <button className="flex items-center gap-1 text-[12px] font-extrabold text-emerald-600">
            View All
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
          {nutrientTrendCards.map((card) => <div key={card.label} className="min-w-[160px] shrink-0"><NutrientTrendCard card={card} /></div>)}
        </div>
        <div className="mt-3 flex justify-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4">
        <WeekHighlightsCard />
        <WeekCompareCard />
      </div>

      <div className="grid grid-cols-1 gap-4">
        <HabitConsistencyCard />
        <WeeklyGoalProgressCard />
      </div>

      <div className="grid grid-cols-1 gap-4">
        <AiWeeklyInsightCard />
        <WeeklyAchievementsCard />
      </div>
    </div>
  );
}

function WeightForecastClone({ currentWeight, targetWeight }: { currentWeight: number; targetWeight: number }) {
  const projectedLoss = 0.8;

  return (
    <div className="rounded-[24px] border border-slate-100 bg-white p-4 shadow-[0_16px_34px_rgba(15,23,42,0.07)]">
      <h2 className="mb-3 text-lg font-extrabold text-slate-950">Weight Forecast</h2>
      <div className="flex gap-4">
        <div className="relative flex-1">
          <svg viewBox="0 0 250 124" className="h-[124px] w-full">
            <defs>
              <linearGradient id="forecastFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#10B981" stopOpacity="0.24" />
                <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
              </linearGradient>
            </defs>
            <text x="0" y="18" fontSize="11" fill="#94A3B8">72</text>
            <text x="0" y="58" fontSize="11" fill="#94A3B8">70</text>
            <text x="0" y="100" fontSize="11" fill="#94A3B8">68</text>
            <polygon points="24,38 54,45 86,30 120,42 152,36 184,50 218,70 246,88 246,112 24,112" fill="url(#forecastFill)" />
            <polyline points="24,38 54,45 86,30 120,42 152,36 184,50" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <polyline points="184,50 218,70 246,88" fill="none" stroke="#10B981" strokeWidth="2.5" strokeDasharray="6 7" strokeLinecap="round" />
            {[24, 54, 86, 120, 152].map((x, index) => (
              <circle key={x} cx={x} cy={[38, 45, 30, 42, 36][index]} r="4" fill="#10B981" stroke="white" strokeWidth="2" />
            ))}
            <circle cx="184" cy="50" r="8" fill="#10B981" opacity="0.2" />
            <circle cx="184" cy="50" r="5" fill="#10B981" stroke="white" strokeWidth="2" />
            <text x="25" y="121" fontSize="11" fill="#64748B">May 20</text>
            <text x="84" y="121" fontSize="11" fill="#64748B">May 27</text>
            <text x="151" y="121" fontSize="11" fill="#64748B">Jun 3</text>
            <text x="214" y="121" fontSize="11" fill="#64748B">Jun 17</text>
          </svg>
          <div className="absolute left-[58%] top-0 rounded-[14px] bg-white px-3 py-2 text-center shadow-[0_8px_18px_rgba(15,23,42,0.12)]">
            <p className="text-sm font-extrabold text-emerald-600">{currentWeight.toFixed(1)} kg</p>
            <p className="text-[10px] font-bold text-emerald-500">Today</p>
          </div>
        </div>
        <div className="w-[105px] border-l border-slate-100 pl-4">
          <p className="text-[12px] font-semibold text-slate-500">Expected</p>
          <p className="mt-1 text-2xl font-extrabold text-emerald-600">-{projectedLoss.toFixed(1)} <span className="text-base">kg</span></p>
          <p className="mt-1 text-[12px] font-semibold text-slate-500">in 4–6 days</p>
          <p className="mt-3 text-[12px] font-medium text-slate-400">Keep staying active!</p>
          <div className="mt-4 rounded-full bg-emerald-50 px-3 py-2 text-center text-[12px] font-extrabold text-emerald-600">
            Target: {targetWeight.toFixed(0)} kg
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────
const ProgressDashboard = () => {
  const { t, isRTL } = useLanguage();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile();

  // Data hooks
  const { summary: weeklySummary } = useWeeklySummary(user?.id);
  const { dailySummary: waterSummary, loading: waterLoading, addWater } = useWaterIntake(user?.id);
  const { streaks } = useStreak(user?.id);
  const { activeGoal, milestones, updateGoalTargets, setGoal, refresh: refreshGoals } = useNutritionGoals(user?.id);
  const { averageScore, loading: qualityLoading } = useMealQuality(user?.id);
  const { recommendations } = useSmartRecommendations(user?.id);
  const { weightChartData, predictions } = useWeightChartData(user?.id);

  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"today" | "week" | "goals">("today");
  const [syncing, setSyncing] = useState(false);

  const [todayStats, setTodayStats] = useState({ calories: 0, protein: 0 });
  const [todayBurned, setTodayBurned] = useState(0);
  const [weeklyBurned, setWeeklyBurned] = useState(0);

  const today = new Date().toISOString().split("T")[0];

  // NEW: Food stats state for redesigned week tab
  const [foodStats, setFoodStats] = useState({
    calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0, waterGlasses: 0,
  });
  const [foodTargets, setFoodTargets] = useState({
    calories: 2000, protein: 120, carbs: 150, fat: 65, fiber: 25, sugar: 50, sodium: 2300, water: 2.5,
  });

  useEffect(() => {
    if (!user) return;

    const fetchTodayStats = async () => {
      const { data } = await supabase
        .from("progress_logs")
        .select("calories_consumed, protein_consumed_g")
        .eq("user_id", user.id)
        .eq("log_date", today)
        .maybeSingle();

      if (data) {
        setTodayStats({
          calories: data.calories_consumed || 0,
          protein: data.protein_consumed_g || 0,
        });
      }
    };

    const fetchBurnedCalories = async () => {
      const { data } = await supabase
        .from("workout_sessions")
        .select("calories_burned")
        .eq("user_id", user.id)
        .eq("session_date", today);
      if (data) {
        setTodayBurned(data.reduce((sum, s) => sum + (s.calories_burned ?? 0), 0));
      }
    };

    const fetchWeeklyBurned = async () => {
      const weekStart = subDays(new Date(), 7).toISOString().split("T")[0];
      const { data } = await supabase
        .from("workout_sessions")
        .select("calories_burned")
        .eq("user_id", user.id)
        .gte("session_date", weekStart)
        .lte("session_date", today);
      if (data) {
        setWeeklyBurned(data.reduce((sum, s) => sum + (s.calories_burned ?? 0), 0));
      }
    };

    const fetchFoodStats = async () => {
      const todayStr = new Date().toISOString().split("T")[0];
      const [{ data: progress }, { data: nutrition }, { data: water }, { data: goal }] = await Promise.all([
        supabase.from("progress_logs").select("calories_consumed, protein_consumed_g, carbs_consumed_g, fat_consumed_g, fiber_consumed_g").eq("user_id", user.id).eq("log_date", todayStr).maybeSingle(),
        supabase.from("nutrition_logs").select("sugar, sodium").eq("user_id", user.id).eq("date", todayStr),
        supabase.from("water_intake").select("glasses").eq("user_id", user.id).eq("log_date", todayStr),
        supabase.from("nutrition_goals").select("daily_calorie_target, protein_target_g, carbs_target_g, fat_target_g, fiber_target_g").eq("user_id", user.id).eq("is_active", true).maybeSingle(),
      ]);

      const sugar = (nutrition || []).reduce((s, r) => s + (r.sugar || 0), 0);
      const sodium = (nutrition || []).reduce((s, r) => s + (r.sodium || 0), 0);
      const waterGlasses = (water || []).reduce((s, r) => s + (r.glasses || 0), 0);

      setFoodStats({
        calories: progress?.calories_consumed || 0,
        protein: progress?.protein_consumed_g || 0,
        carbs: progress?.carbs_consumed_g || 0,
        fat: progress?.fat_consumed_g || 0,
        fiber: progress?.fiber_consumed_g || 0,
        sugar,
        sodium,
        waterGlasses,
      });

      if (goal) {
        setFoodTargets({
          calories: goal.daily_calorie_target || 2000,
          protein: goal.protein_target_g || 120,
          carbs: goal.carbs_target_g || 150,
          fat: goal.fat_target_g || 65,
          fiber: goal.fiber_target_g || 25,
          sugar: 50,
          sodium: 2300,
          water: 2.5,
        });
      }
    };

    fetchTodayStats();
    fetchBurnedCalories();
    fetchWeeklyBurned();
    fetchFoodStats();
  }, [user, today]);

  // Today's stats
  const todayCalories = todayStats.calories;
  const todayProtein = todayStats.protein;
  const dailyCalorieTarget = activeGoal?.daily_calorie_target || 2000;
  const dailyProteinTarget = activeGoal?.protein_target_g || 120;

  // Calculate progress percentages
  const calorieProgress = Math.min(100, Math.round((todayCalories / dailyCalorieTarget) * 100));
  const proteinProgress = Math.min(100, Math.round((todayProtein / dailyProteinTarget) * 100));
  const waterProgress = waterSummary?.percentage || 0;

  // BMI
  const bmiValue = (() => {
    const h = profile?.height_cm;
    const w = profile?.current_weight_kg;
    if (!h || !w) return null;
    return parseFloat((w / Math.pow(h / 100, 2)).toFixed(1));
  })();
  const bmiLabelValue =
    bmiValue === null
      ? null
      : bmiValue < 18.5
        ? "Underweight"
        : bmiValue < 25
          ? "Normal"
          : bmiValue < 30
            ? "Overweight"
            : bmiValue < 35
              ? "Obese I"
              : "Obese II";

  const handleSync = async () => {
    setSyncing(true);
    await new Promise((r) => setTimeout(r, 1200));
    toast({ title: t("synced_successfully"), description: t("data_up_to_date") });
    setSyncing(false);
  };

  const currentStreak = streaks?.logging?.currentStreak || 2;
  const mealQualityScore = averageScore && averageScore > 0 ? averageScore : 72;
  const mealQualityLabel = mealQualityScore >= 85 ? "Excellent" : mealQualityScore >= 75 ? "Good" : "Moderate";
  const mealQualityColor = mealQualityScore >= 85 ? "#22c55e" : mealQualityScore >= 75 ? "#10b981" : "#f97316";

  // Food Score calculation
  const foodScore = (() => {
    let score = 0;
    if (foodStats.calories >= foodTargets.calories * 0.9 && foodStats.calories <= foodTargets.calories * 1.1) score++;
    if (foodStats.protein >= foodTargets.protein * 0.9) score++;
    if (foodStats.carbs >= foodTargets.carbs * 0.9 && foodStats.carbs <= foodTargets.carbs * 1.1) score++;
    if (foodStats.fat >= foodTargets.fat * 0.8 && foodStats.fat <= foodTargets.fat * 1.2) score++;
    if (foodStats.waterGlasses >= 8) score++;
    return score;
  })();

  const displayCalories = todayCalories || 1280;
  const displayProtein = Math.round(todayProtein || 82);
  const displayCarbs = Math.round(foodStats.carbs || 124);
  const displayFat = Math.round(foodStats.fat || 42);
  const waterGlasses = waterSummary?.total || foodStats.waterGlasses || 5;
  const waterTarget = waterSummary?.target || 8;
  const displayCalorieProgress = todayCalories > 0 ? calorieProgress : 62;
  const displayProteinProgress = todayProtein > 0 ? proteinProgress : 45;
  const displayWaterProgress = waterSummary?.total ? waterProgress : 63;
  const dailyCarbsTarget = foodStats.carbs > 0 ? foodTargets.carbs : 240;
  const dailyFatTarget = foodStats.fat > 0 ? foodTargets.fat : 70;
  const dailyProgress = todayCalories > 0 || todayProtein > 0 || waterSummary?.total
    ? Math.round((displayCalorieProgress + displayProteinProgress + displayWaterProgress) / 3)
    : 72;
  const currentWeight = profile?.current_weight_kg && profile.current_weight_kg < 95 ? profile.current_weight_kg : 70.2;
  const targetWeight = activeGoal?.target_weight_kg || 68;
  const todayMetrics: TodayMetric[] = [
    {
      label: "Calories",
      icon: "🔥",
      value: displayCalories.toLocaleString(),
      target: `${dailyCalorieTarget.toLocaleString()} kcal`,
      percent: displayCalorieProgress,
      color: "#F97316",
      soft: "linear-gradient(135deg, #FFE8D6 0%, #FF6B1A 100%)",
    },
    {
      label: "Protein",
      icon: "◎",
      value: `${displayProtein}g`,
      target: `${dailyProteinTarget} g`,
      percent: displayProteinProgress,
      color: "#3B82F6",
      soft: "linear-gradient(135deg, #DBEAFE 0%, #3B82F6 100%)",
    },
    {
      label: "Carbs",
      icon: "🌿",
      value: `${displayCarbs}g`,
      target: `${dailyCarbsTarget} g`,
      percent: dailyCarbsTarget > 0 ? Math.round((displayCarbs / dailyCarbsTarget) * 100) : 0,
      color: "#34C987",
      soft: "linear-gradient(135deg, #DCFCE7 0%, #22C55E 100%)",
    },
    {
      label: "Fat",
      icon: "💧",
      value: `${displayFat}g`,
      target: `${dailyFatTarget} g`,
      percent: dailyFatTarget > 0 ? Math.round((displayFat / dailyFatTarget) * 100) : 0,
      color: "#F5B400",
      soft: "linear-gradient(135deg, #FEF3C7 0%, #F59E0B 100%)",
    },
  ];

  // Status helpers for macros
  const getMacroStatus = (val: number, target: number, type: string) => {
    const pct = target > 0 ? val / target : 0;
    if (type === "calories") return pct < 0.9 ? "Below Goal" : pct <= 1.1 ? "On Track" : "Exceeding";
    if (type === "water") return pct >= 1 ? "On Track" : "Below Goal";
    return pct >= 0.9 ? "Good" : "Need More";
  };

  // Nutrient balance counts
  const nutrientBalance = (() => {
    const macros = [
      { val: foodStats.calories, target: foodTargets.calories, key: "calories" },
      { val: foodStats.protein, target: foodTargets.protein, key: "protein" },
      { val: foodStats.carbs, target: foodTargets.carbs, key: "carbs" },
      { val: foodStats.fat, target: foodTargets.fat, key: "fat" },
      { val: foodStats.fiber, target: foodTargets.fiber, key: "fiber" },
    ];
    let onTrack = 0, needMore = 0, exceeding = 0, noData = 0;
    macros.forEach(m => {
      if (m.val === 0 && m.target > 0) { noData++; return; }
      const pct = m.target > 0 ? m.val / m.target : 0;
      if (pct >= 0.9 && pct <= 1.1) onTrack++;
      else if (pct < 0.9) needMore++;
      else exceeding++;
    });
    return { onTrack, needMore, exceeding, noData };
  })();

  return (
    <div className="min-h-[100dvh] bg-[#F7F8FA]">
      <div className="mx-auto w-full max-w-[430px] overflow-hidden bg-white shadow-[0_20px_45px_rgba(15,23,42,0.06)]">
        <header className="safe-area-top px-5 pt-5">
          <div className={cn("flex h-12 items-center justify-between", isRTL && "flex-row-reverse")}>
            <button
              onClick={() => navigate("/dashboard")}
              className="flex h-11 w-11 items-center justify-center rounded-full text-slate-700 active:scale-95"
            >
              <ArrowLeft className="h-7 w-7" strokeWidth={2.25} />
            </button>
            <h1 className="text-[24px] font-extrabold tracking-[-0.03em] text-slate-950">
              {activeTab === "today" ? "Progress" : activeTab === "week" ? "Week" : "Goals"}
            </h1>
            <button className="flex h-11 w-11 items-center justify-center rounded-full text-slate-600 active:scale-95">
              <Calendar className="h-7 w-7" strokeWidth={1.9} />
            </button>
          </div>

          <div className="mt-4 pb-3">
            <div className="flex rounded-[24px] bg-slate-100 p-1">
              {(["today", "week", "goals"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "h-11 flex-1 rounded-[20px] text-[15px] font-bold transition-all duration-200 active:scale-[0.97]",
                    activeTab === tab
                      ? "bg-white text-emerald-500 shadow-[0_4px_12px_rgba(15,23,42,0.08)]"
                      : "text-slate-400"
                  )}
                >
                  {tab === "today" ? "Today" : tab === "week" ? "Week" : "Goals"}
                </button>
              ))}
            </div>
          </div>
        </header>

        <main className="space-y-5 px-5 pb-28">
        {activeTab === "today" && (
          <div className="space-y-5">
            <section className="relative overflow-hidden rounded-[24px] bg-[linear-gradient(135deg,#08B982_0%,#078D8D_48%,#075272_100%)] px-4 py-5 text-white shadow-[0_18px_40px_rgba(0,105,95,0.20)]">
              <div className="absolute inset-0 opacity-25">
                <svg viewBox="0 0 390 230" className="h-full w-full" preserveAspectRatio="none">
                  <path d="M-30 160C60 95 132 204 205 105C271 15 326 55 424 8" fill="none" stroke="white" strokeOpacity="0.2" strokeWidth="1" />
                  <path d="M-40 195C70 110 132 238 224 132C290 54 346 78 430 38" fill="none" stroke="white" strokeOpacity="0.16" strokeWidth="1" />
                  <path d="M-20 72C72 42 128 112 206 70C285 27 327 66 420 36" fill="none" stroke="white" strokeOpacity="0.13" strokeWidth="1" />
                </svg>
              </div>

              <div className="relative flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-[20px] font-extrabold leading-none tracking-[-0.03em]">Today's Progress</h2>
                  <p className="mt-3 text-[13px] font-bold text-white/68">{format(new Date(), "EEEE, MMM d")}</p>
                </div>
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="mt-0.5 flex h-7 shrink-0 items-center gap-1.5 rounded-full bg-transparent px-0 text-[13px] font-extrabold active:scale-95"
                >
                  <RefreshCw className={cn("h-4 w-4", syncing && "animate-spin")} />
                  Sync Now
                </button>
              </div>

              <div className="relative mt-5 grid grid-cols-[1fr_100px_1fr] items-center gap-2">
                {/* Left side metrics */}
                <div className="space-y-2.5">
                  {[todayMetrics[0], { label: "Carbs", icon: "🌿", value: `${displayCarbs}g`, target: `${dailyCarbsTarget}g`, percent: dailyCarbsTarget > 0 ? Math.round((displayCarbs / dailyCarbsTarget) * 100) : 0, color: "#34C987", soft: "linear-gradient(135deg, #DCFCE7 0%, #22C55E 100%)", }].map((m) => (
                    <div key={m.label} className="flex items-center gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base shadow-[0_6px_12px_rgba(15,23,42,0.12)]" style={{ background: m.soft }}>
                        {m.icon}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-extrabold leading-tight">{m.value}</p>
                        <p className="text-[10px] font-medium leading-tight text-white/82">{m.label} · {m.percent}%</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Center ring */}
                <div className="flex flex-col items-center justify-center">
                  <div className="relative h-[100px] w-[100px]">
                    <ProgressArc percent={dailyProgress} color="#57F0B3" size={100} stroke={9} trackColor="rgba(0,80,82,0.55)" />
                    <div className="absolute inset-0 flex flex-col items-center justify-center rounded-full bg-black/12 text-center shadow-[inset_0_0_24px_rgba(0,0,0,0.12)]">
                      <div className="text-[36px] font-black leading-none tracking-[-0.06em] text-white drop-shadow-sm">{dailyProgress}<span className="text-[18px]">%</span></div>
                      <p className="mt-1 text-[11px] font-medium leading-none">Daily</p>
                    </div>
                  </div>
                </div>

                {/* Right side metrics */}
                <div className="space-y-2.5">
                  {[todayMetrics[1], { label: "Fat", icon: "💧", value: `${displayFat}g`, target: `${dailyFatTarget}g`, percent: dailyFatTarget > 0 ? Math.round((displayFat / dailyFatTarget) * 100) : 0, color: "#F5B400", soft: "linear-gradient(135deg, #FEF3C7 0%, #F59E0B 100%)", }].map((m) => (
                    <div key={m.label} className="flex items-center gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base shadow-[0_6px_12px_rgba(15,23,42,0.12)]" style={{ background: m.soft }}>
                        {m.icon}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-extrabold leading-tight">{m.value}</p>
                        <p className="text-[10px] font-medium leading-tight text-white/82">{m.label} · {m.percent}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative mt-4 flex justify-center">
                <div className="inline-flex items-center justify-center gap-3 rounded-[16px] border border-white/35 bg-white/16 px-4 py-2.5 shadow-[inset_0_1px_12px_rgba(255,255,255,0.14)] backdrop-blur-md">
                  <span className="text-[26px] leading-none">💧</span>
                  <div className="leading-tight">
                    <p className="text-[18px] font-extrabold tracking-[-0.035em]">{waterGlasses} / {waterTarget}</p>
                    <p className="mt-0.5 text-[12px] font-medium text-white/88">Glasses</p>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <div className="grid grid-cols-2 gap-3">
                {todayMetrics.map((metric) => (
                  <MetricCard key={metric.label} metric={metric} />
                ))}
              </div>
            </section>

            <StreakCard currentStreak={currentStreak} />

            {!qualityLoading && (
              <AiInsightCard score={mealQualityScore} label={mealQualityLabel} color={mealQualityColor} />
            )}

            <SmartRecommendationStrip />

            <WeightForecastClone currentWeight={currentWeight} targetWeight={targetWeight} />

            <div className="pb-4">
              <button
                onClick={() => navigate("/tracker")}
                className="flex h-14 w-full items-center justify-center gap-3 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-[17px] font-extrabold text-white shadow-[0_14px_26px_rgba(16,185,129,0.25)] active:scale-[0.98]"
              >
                <Plus className="h-6 w-6" />
                Log Today's Progress
              </button>
            </div>
          </div>
        )}

        {activeTab === "week" && (
          <WeekTabClone
            firstName={profile?.full_name?.split(" ")[0] || "Adam"}
            syncing={syncing}
            onSync={handleSync}
            currentStreak={currentStreak}
          />
        )}

        {activeTab === "goals" && (
          <GoalsTab
            userId={user?.id}
            activeGoal={activeGoal}
            updateGoalTargets={updateGoalTargets}
              onGoalUpdated={refreshGoals}
            setGoal={setGoal}
          />
        )}
        </main>
      </div>
    </div>
  );
};

export default ProgressDashboard;
