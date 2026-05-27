import { useState, type ReactNode } from "react";
import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  Bot,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Dumbbell,
  Flame,
  Leaf,
  Lock,
  Scale,
  Sparkles,
  Sprout,
  Trophy,
  TrendingUp,
  UserRound,
  Zap,
} from "lucide-react";

import goalWomanReference from "@/assets/goal-woman-reference.png";
import { CreateGoalModal } from "@/components/progress/CreateGoalModal";
import { useProfile } from "@/hooks/useProfile";
import { cn } from "@/lib/utils";

interface GoalsTabProps {
  userId: string | undefined;
  activeGoal: {
    goal_type: string;
    target_weight_kg: number | null;
    target_date: string | null;
    daily_calorie_target: number;
    protein_target_g: number;
    carbs_target_g: number;
    fat_target_g: number;
    fiber_target_g: number;
  } | null;
  updateGoalTargets: (updates: Record<string, number>) => Promise<boolean>;
  onGoalUpdated: () => void;
  setGoal: (goal: {
    goal_type: "weight_loss" | "muscle_gain" | "maintenance" | "general_health";
    target_weight_kg: number | null;
    target_date: string | null;
    daily_calorie_target: number;
    protein_target_g: number;
    carbs_target_g: number;
    fat_target_g: number;
    fiber_target_g: number;
    is_active: boolean;
  }) => Promise<void>;
}

function ProgressRing({
  percent,
  size = 118,
  stroke = 10,
  trackColor = "rgba(255,255,255,0.18)",
  progressColor = "#57F0B3",
}: {
  percent: number;
  size?: number;
  stroke?: number;
  trackColor?: string;
  progressColor?: string;
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
        stroke={progressColor}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circumference}`}
      />
    </svg>
  );
}

function SectionHeader({
  title,
  action,
}: {
  title: string;
  action: string;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-[18px] font-extrabold tracking-[-0.02em] text-slate-950">{title}</h2>
      <button className="flex h-10 items-center gap-1 rounded-full text-[14px] font-extrabold text-emerald-600 active:scale-95">
        {action}
        <ChevronRight className="h-5 w-5" strokeWidth={2.5} />
      </button>
    </div>
  );
}

function HexBadge({
  children,
  locked = false,
}: {
  children: ReactNode;
  locked?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid h-[58px] w-[58px] place-items-center text-[24px] shadow-[0_8px_16px_rgba(245,158,11,0.18)]",
        locked ? "bg-[linear-gradient(145deg,#E2E8F0,#94A3B8)]" : "bg-[linear-gradient(145deg,#FFE082,#F59E0B)]"
      )}
      style={{
        clipPath: "polygon(25% 6%, 75% 6%, 100% 50%, 75% 94%, 25% 94%, 0 50%)",
      }}
    >
      {locked ? <Lock className="h-6 w-6 text-white" /> : children}
    </div>
  );
}

function FocusIcon({
  children,
  color,
  active,
}: {
  children: ReactNode;
  color: string;
  active: boolean;
}) {
  return (
    <div
      className="grid h-12 w-12 place-items-center rounded-[15px] shadow-[inset_0_1px_5px_rgba(255,255,255,0.55)]"
      style={{
        color,
        background: active ? `${color}22` : "linear-gradient(180deg,#FFFFFF,#F8FAFC)",
      }}
    >
      {children}
    </div>
  );
}

function PerfRingCard({
  label,
  percent,
  ringColor,
  statusText,
  icon,
}: {
  label: string;
  percent: number;
  ringColor: string;
  statusText: string;
  icon: ReactNode;
}) {
  return (
    <div className="flex min-w-[88px] flex-1 flex-col items-center rounded-[18px] border border-slate-100 bg-white px-3 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
      <div className="relative h-[78px] w-[78px]">
        <ProgressRing percent={percent} size={78} stroke={6} trackColor="#E9EEF2" progressColor={ringColor} />
        <div className="absolute inset-0 grid place-items-center">{icon}</div>
      </div>
      <p className="mt-1 text-center text-[12px] font-bold leading-tight text-slate-600">{label}</p>
      <p className="text-[26px] font-black leading-none tracking-[-0.04em] text-slate-950">{percent}%</p>
      <p className="mt-1 text-[12px] font-semibold text-slate-500">{statusText}</p>
      <div className="mt-2 h-1.5 w-14 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full" style={{ width: `${percent}%`, background: ringColor }} />
      </div>
    </div>
  );
}

const goalFocusCategories = [
  { id: "weight_loss", label: "Weight Loss", icon: <Scale className="h-7 w-7" />, color: "#10B981" },
  { id: "muscle_gain", label: "Muscle Gain", icon: <Dumbbell className="h-7 w-7" />, color: "#3B82F6" },
  { id: "general_health", label: "Healthy Lifestyle", icon: <Leaf className="h-7 w-7" />, color: "#10B981" },
  { id: "keto", label: "Keto", icon: <Flame className="h-7 w-7" />, color: "#F97316" },
  { id: "balance", label: "Balance", icon: <Sprout className="h-7 w-7" />, color: "#8B5CF6" },
  { id: "energy", label: "Energy", icon: <Zap className="h-7 w-7" />, color: "#F59E0B" },
];

const goalTypeLabel: Record<string, string> = {
  weight_loss: "Weight Loss",
  muscle_gain: "Muscle Gain",
  maintenance: "Maintenance",
  general_health: "Healthy Lifestyle",
};

export const GoalsTab = ({
  activeGoal,
  onGoalUpdated,
  setGoal,
}: GoalsTabProps) => {
  const { profile } = useProfile();
  const [showCreateGoal, setShowCreateGoal] = useState(false);
  const [selectedFocus, setSelectedFocus] = useState(activeGoal?.goal_type || "weight_loss");

  const currentWeight = profile?.current_weight_kg || 75;
  const goalWeight = activeGoal?.target_weight_kg || 63;
  const height = profile?.height_cm || 175;
  const firstName = profile?.full_name?.split(" ")[0] || "Adam";
  const goalName = goalTypeLabel[activeGoal?.goal_type || "weight_loss"] || "Weight Loss";
  const weightDiff = Math.abs(currentWeight - goalWeight);
  const bmi = height > 0 ? Number((currentWeight / Math.pow(height / 100, 2)).toFixed(1)) : 24.5;
  const bmiLabel = bmi < 18.5 ? "Underweight" : bmi < 25 ? "Healthy" : bmi < 30 ? "Overweight" : "High";
  const progressPct =
    goalWeight > 0 && currentWeight > goalWeight
      ? Math.max(0, Math.min(100, Math.round((1 - (currentWeight - goalWeight) / (currentWeight + 10 - goalWeight)) * 100)))
      : 72;

  return (
    <div className="space-y-5 pb-2 animate-in fade-in duration-300">
      <section className="relative min-h-[360px] overflow-hidden rounded-[24px] bg-[linear-gradient(135deg,#069D76_0%,#078B85_52%,#036667_100%)] px-4 pb-4 pt-4 text-white shadow-[0_18px_38px_rgba(0,108,95,0.22)]">
        {/* Background wavy lines */}
        <div className="absolute inset-0 opacity-30">
          <svg viewBox="0 0 390 360" className="h-full w-full" preserveAspectRatio="none">
            <path d="M-26 88C70 31 143 118 225 64C306 10 349 48 424 17" fill="none" stroke="white" strokeOpacity="0.22" />
            <path d="M-44 169C53 92 129 206 224 101C291 28 340 52 431 30" fill="none" stroke="white" strokeOpacity="0.16" />
            <path d="M-25 194C68 115 145 229 238 137C302 73 350 88 424 58" fill="none" stroke="white" strokeOpacity="0.14" />
            <path d="M-25 254C68 175 145 289 238 197C302 133 350 148 424 118" fill="none" stroke="white" strokeOpacity="0.12" />
          </svg>
        </div>

        {/* Decorative dots */}
        <div className="absolute right-[40%] top-[28%] h-1 w-1 rounded-full bg-white/30" />
        <div className="absolute right-[34%] top-[40%] h-1 w-1 rounded-full bg-white/30" />
        <div className="absolute right-[30%] top-[20%] h-1.5 w-1.5 rounded-full bg-white/25" />

        {/* Woman image - right side */}
        <div className="absolute right-0 bottom-0 top-0 w-[140px] overflow-hidden">
          <img src={goalWomanReference} alt="" className="h-full w-full object-cover object-center" />
        </div>

        {/* Progress ring - between text and woman */}
          <div className="absolute left-1/2 top-[48%] -translate-x-1/2 -translate-y-1/2 h-[140px] w-[140px]">
            <ProgressRing percent={progressPct} size={140} stroke={10} />
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <p className="text-[40px] font-black leading-none tracking-[-0.07em] drop-shadow-md">
                {progressPct}
                <span className="text-[20px]">%</span>
              </p>
              <p className="mt-1 text-[13px] font-semibold text-white/95 drop-shadow-sm">Progress</p>
            </div>
          </div>

        {/* Top-left content */}
        <div className="relative">
          <div className="mb-3 flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-orange-500 shadow-[0_6px_12px_rgba(249,115,22,0.3)]">
              <Flame className="h-5 w-5 fill-white text-white" />
            </div>
          <span className="rounded-full bg-white border border-emerald-400 text-emerald-600 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.08em]">
            Active Goal
          </span>
          </div>

          <h2 className="text-[34px] font-black leading-[1.05] tracking-[-0.045em]">{goalName}</h2>
          <p className="mt-1 text-[14px] font-semibold text-white/85">Your transformation progress</p>

          {/* Current → Goal */}
          <div className="mt-4 flex items-center gap-2">
            <div className="min-w-[78px] rounded-[14px] border border-white/10 bg-white/14 px-3 py-2 shadow-[inset_0_1px_8px_rgba(255,255,255,0.12)] backdrop-blur-md">
              <div className="flex items-baseline gap-0.5">
                <p className="text-[22px] font-black leading-none">{currentWeight}</p>
                <p className="text-[11px] font-extrabold text-white/80">kg</p>
              </div>
              <p className="mt-1 text-[11px] font-semibold text-white/74">Current</p>
            </div>
            <ArrowRight className="h-5 w-5 shrink-0 text-white/75" />
            <div className="min-w-[78px] rounded-[14px] border border-white/10 bg-white/14 px-3 py-2 shadow-[inset_0_1px_8px_rgba(255,255,255,0.12)] backdrop-blur-md">
              <div className="flex items-baseline gap-0.5">
                <p className="text-[22px] font-black leading-none">{goalWeight}</p>
                <p className="text-[11px] font-extrabold text-white/80">kg</p>
              </div>
              <p className="mt-1 text-[11px] font-semibold text-white/74">Goal</p>
            </div>
          </div>

          {/* Stats line */}
          <p className="mt-3 text-[13px] font-extrabold text-white/90">
            -{weightDiff.toFixed(0)} kg target <span className="px-1 text-white/60">•</span> 82% consistency
          </p>

          {/* Ahead of last month pill */}
          <div className="mt-3 inline-flex items-center gap-2 rounded-[13px] border border-white/10 bg-white/14 px-3 py-2 backdrop-blur-md">
            <TrendingUp className="h-5 w-5 text-[#57F0B3]" />
            <span className="text-[12px] font-bold leading-tight">You're ahead of<br />last month!</span>
          </div>
        </div>

        {/* Pagination dots */}
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2">
          {[0, 1, 2, 3].map((dot) => (
            <span key={dot} className={cn("h-1.5 rounded-full transition-all", dot === 0 ? "w-1.5 bg-white" : "w-1.5 bg-white/35")} />
          ))}
        </div>
      </section>

      <section>
        <SectionHeader title="Goal Focus" action="View All" />
        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {goalFocusCategories.slice(0, 4).map((category) => {
            const active = selectedFocus === category.id;
            return (
              <button
                key={category.id}
                onClick={() => setSelectedFocus(category.id)}
                className={cn(
                  "flex min-h-[114px] min-w-[82px] flex-col items-center justify-center gap-2 rounded-[18px] border bg-white px-2.5 py-3 shadow-[0_10px_22px_rgba(15,23,42,0.045)] transition-all active:scale-95",
                  active ? "border-emerald-400 shadow-emerald-100" : "border-slate-100"
                )}
              >
                <FocusIcon color={category.color} active={active}>{category.icon}</FocusIcon>
                <span className="text-center text-[12px] font-extrabold leading-[1.12]" style={{ color: active ? category.color : "#1F2937" }}>
                  {category.label}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <SectionHeader title="Weekly Performance" action="View Details" />
        <div className="grid grid-cols-4 gap-3">
          <PerfRingCard label="Calories" percent={72} ringColor="#F97316" statusText="On Track" icon={<Flame className="h-6 w-6 fill-orange-100 text-orange-500" />} />
          <PerfRingCard label="Protein" percent={58} ringColor="#3B82F6" statusText="Improve" icon={<BadgeCheck className="h-6 w-6 text-blue-500" />} />
          <PerfRingCard label="Carbs" percent={61} ringColor="#F5B51B" statusText="Stable" icon={<Sprout className="h-6 w-6 text-amber-500" />} />
          <PerfRingCard label="Fat" percent={81} ringColor="#10B981" statusText="Excellent" icon={<Flame className="h-6 w-6 text-emerald-500" />} />
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-[20px] border border-slate-100 bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.055)]">
          <div className="mb-4 flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-emerald-100 text-emerald-600">
              <UserRound className="h-4 w-4" />
            </div>
            <h3 className="text-[15px] font-extrabold text-slate-950">Body Metrics</h3>
          </div>
          <div className="grid grid-cols-[1fr_48px_1fr] items-center gap-2">
            <div className="space-y-4">
              <div>
                <p className="text-[11px] font-semibold text-slate-500">Current Weight</p>
                <p className="text-[23px] font-black tracking-[-0.04em] text-slate-950">{currentWeight}<span className="ml-1 text-[12px] font-bold text-slate-500">kg</span></p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-500">Height</p>
                <p className="text-[22px] font-black tracking-[-0.04em] text-slate-950">{height}<span className="ml-1 text-[12px] font-bold text-slate-500">cm</span></p>
              </div>
            </div>
            <svg viewBox="0 0 48 92" className="h-[94px] w-12 justify-self-center" fill="none">
              <path d="M24 17c4.3 0 7.8-3.5 7.8-7.8S28.3 1.4 24 1.4s-7.8 3.5-7.8 7.8S19.7 17 24 17Z" fill="#CFFAE7" stroke="#7DE6C4" strokeWidth="1.5" />
              <path d="M17.4 20.2c-3 4.4-4.2 15.7-4.7 25.6-.3 6.2-2.9 12-6.5 17.1M30.6 20.2c3 4.4 4.2 15.7 4.7 25.6.3 6.2 2.9 12 6.5 17.1M17.7 22.4c1.6 4.2 4.1 6.3 6.3 6.3s4.7-2.1 6.3-6.3M16.2 46.6h15.6M18.7 46.6 15.2 88M29.3 46.6 32.8 88" stroke="#7DE6C4" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
            <div className="space-y-4 text-left">
              <div>
                <p className="text-[11px] font-semibold text-slate-500">Goal Weight</p>
                <p className="text-[23px] font-black tracking-[-0.04em] text-slate-950">{goalWeight}<span className="ml-1 text-[12px] font-bold text-slate-500">kg</span></p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-500">BMI</p>
                <p className="text-[22px] font-black tracking-[-0.04em] text-slate-950">{bmi}</p>
                <p className="text-[11px] font-extrabold text-emerald-600">{bmiLabel}</p>
              </div>
            </div>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-[linear-gradient(90deg,#A7F3D0,#10B981)]" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[20px] bg-[linear-gradient(135deg,#F3EFFF_0%,#ECE8FF_50%,#F8F7FF_100%)] p-4 shadow-[0_12px_28px_rgba(109,40,217,0.09)]">
          <Sparkles className="absolute right-4 top-9 h-4 w-4 text-white" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-violet-100 text-violet-600 shadow-[0_8px_14px_rgba(124,58,237,0.18)]">
                <Bot className="h-6 w-6" />
              </div>
              <h3 className="text-[18px] font-black tracking-[-0.03em] text-slate-950">AI Coach</h3>
            </div>
            <span className="rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-black text-emerald-600">NEW</span>
          </div>
          <div className="mt-4 flex gap-3">
            <div className="grid h-[58px] w-[58px] shrink-0 place-items-center rounded-full bg-[linear-gradient(180deg,#EEF2FF,#A5B4FC)] text-indigo-700 shadow-[0_10px_18px_rgba(99,102,241,0.22)]">
              <Bot className="h-8 w-8" />
            </div>
            <p className="text-[14px] font-semibold leading-[1.35] text-slate-700">
              Increase protein intake by 18g daily to improve fat burning and muscle retention.
            </p>
          </div>
          <button className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-[12px] bg-emerald-600 text-[15px] font-black text-white shadow-[0_10px_18px_rgba(16,185,129,0.22)] active:scale-[0.98]">
            <Sparkles className="h-5 w-5" />
            Apply Suggestion
          </button>
        </div>
      </section>

      <section className="grid grid-cols-[0.96fr_1.54fr] gap-3">
        <div className="rounded-[20px] border border-slate-100 bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.055)]">
          <h3 className="mb-4 text-[17px] font-black tracking-[-0.03em] text-slate-950">This Week</h3>
          <div className="space-y-3">
            {[
              { icon: <Flame className="h-4 w-4" />, label: "Calories On Track", done: true, color: "bg-emerald-100 text-emerald-600" },
              { icon: <CalendarDays className="h-4 w-4" />, label: "5 Day Streak", done: true, color: "bg-emerald-100 text-emerald-600" },
              { icon: <Zap className="h-4 w-4" />, label: "Water Improved", done: true, color: "bg-blue-100 text-blue-500" },
              { icon: <AlertCircle className="h-4 w-4" />, label: "Late Night Snacking", done: false, color: "bg-orange-100 text-orange-500" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full", item.color)}>{item.icon}</span>
                <span className="min-w-0 flex-1 truncate text-[12px] font-bold text-slate-600">{item.label}</span>
                {item.done ? <CheckCircle2 className="h-5 w-5 shrink-0 fill-emerald-100 text-emerald-500" /> : <AlertCircle className="h-5 w-5 shrink-0 fill-orange-100 text-orange-500" />}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[20px] border border-slate-100 bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.055)]">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-[17px] font-black tracking-[-0.03em] text-slate-950">Achievements</h3>
            <button className="text-[13px] font-black text-emerald-600">View All</button>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "First Week Complete", icon: <Trophy className="h-7 w-7 fill-amber-200 text-amber-700" />, locked: false },
              { label: "Protein Pro", icon: <Dumbbell className="h-7 w-7 text-orange-200" />, locked: false },
              { label: "Hydration Hero", icon: null, locked: true },
              { label: "30-Day Streak", icon: null, locked: true },
            ].map((badge) => (
              <div key={badge.label} className="flex flex-col items-center gap-2 text-center">
                <HexBadge locked={badge.locked}>{badge.icon}</HexBadge>
                <p className="text-[11px] font-bold leading-[1.12] text-slate-600">{badge.label}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full w-1/2 rounded-full bg-emerald-500" />
            </div>
            <span className="whitespace-nowrap text-[12px] font-black text-emerald-600">2 <span className="text-slate-400">/ 4 Unlocked</span></span>
            <div className="h-1.5 flex-1 rounded-full bg-slate-100" />
          </div>
        </div>
      </section>

      <section className="flex items-center gap-3 rounded-[20px] border border-emerald-100 bg-[linear-gradient(100deg,#E7FFF5_0%,#ECFFF8_48%,#F7FBFF_100%)] p-3 shadow-[0_12px_28px_rgba(16,185,129,0.08)]">
        <div className="grid h-[60px] w-[60px] shrink-0 place-items-center rounded-full bg-emerald-100 shadow-[inset_0_1px_10px_rgba(255,255,255,0.55)]">
          <Trophy className="h-8 w-8 fill-amber-300 text-amber-600" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-1 text-[15px] font-black tracking-[-0.025em] leading-tight text-slate-950">
            Keep going, {firstName}!
            <Dumbbell className="h-4 w-4 text-amber-500" />
          </h3>
          <p className="mt-1 text-[11px] font-semibold leading-[1.3] text-slate-600">
            Only {Math.max(1, Math.round(weightDiff - 9))} kg left to unlock your first transformation milestone.
          </p>
        </div>
        <div className="min-w-[110px] shrink-0 rounded-[12px] bg-white/85 p-2 shadow-[0_10px_22px_rgba(15,23,42,0.06)]">
          <TrendingUp className="h-5 w-5 text-emerald-600" />
          <p className="mt-1 text-[10px] font-semibold leading-tight text-slate-600">
            You're doing better than <span className="font-black text-emerald-600">68%</span> of users this week!
          </p>
        </div>
      </section>

      <CreateGoalModal
        open={showCreateGoal}
        onClose={() => setShowCreateGoal(false)}
        onGoalUpdated={onGoalUpdated}
        setGoal={setGoal}
      />
    </div>
  );
};
