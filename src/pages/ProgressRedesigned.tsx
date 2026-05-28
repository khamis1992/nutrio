import type { LucideIcon } from "lucide-react";
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  Brain,
  CalendarCheck,
  Check,
  ChevronRight,
  Droplet,
  Dumbbell,
  Flame,
  Leaf,
  Lock,
  Minus,
  Plus,
  Scale,
  Sparkles,
  Target,
  Trophy,
  TrendingUp,
  UserRound,
  Wheat,
  Zap,
} from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useNutritionGoals } from "@/hooks/useNutritionGoals";
import { useWeeklySummary } from "@/hooks/useWeeklySummary";
import { useStreak } from "@/hooks/useStreak";
import { useTodayProgress } from "@/hooks/useTodayProgress";
import { useWaterIntake } from "@/hooks/useWaterIntake";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

type RingMetric = {
  label: string;
  value: number;
  status: string;
  Icon: LucideIcon;
  color: string;
  track: string;
};

const achievements = [
  { label: "First Week Complete", Icon: Trophy, unlocked: true },
  { label: "Protein Pro", Icon: Dumbbell, unlocked: true },
  { label: "Hydration Hero", Icon: Lock, unlocked: false },
  { label: "30-Day Streak", Icon: Lock, unlocked: false },
];

function ProgressRing({ value, size = 112, stroke = 8, color = "#51F3A0", label }: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  label?: string;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (Math.min(value, 100) / 100) * circumference;

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg className="absolute inset-0 -rotate-90" viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.13)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeWidth={stroke}
          strokeDasharray={`${dash} ${circumference}`}
        />
      </svg>
      <div className="text-center text-white drop-shadow-sm">
        <div className="text-[34px] font-black leading-none tracking-[-0.08em]">{value}<span className="text-[18px] tracking-normal">%</span></div>
        {label ? <div className="mt-1 text-[11px] font-semibold text-white/85">{label}</div> : null}
      </div>
    </div>
  );
}

function MetricRing({ metric }: { metric: RingMetric }) {
  const size = 86;
  const stroke = 5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (metric.value / 100) * circumference;
  const Icon = metric.Icon;

  return (
    <article className="rounded-[18px] border border-slate-100 bg-white px-2.5 py-3 text-center shadow-[0_14px_28px_rgba(15,23,42,0.06)]">
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
        <div className="flex flex-col items-center">
          <Icon className="h-5 w-5" style={{ color: metric.color }} strokeWidth={2.4} />
          <span className="mt-1 text-[11px] font-semibold text-slate-700">{metric.label}</span>
          <span className="text-[22px] font-black leading-none tracking-[-0.06em] text-[#111827]">{metric.value}%</span>
        </div>
      </div>
      <p className="mt-2 text-[11px] font-medium text-slate-500">{metric.status}</p>
      <div className="mx-auto mt-2 h-1 w-11 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full" style={{ width: `${metric.value}%`, backgroundColor: metric.color }} />
      </div>
    </article>
  );
}

function SectionHeader({ title, action, onClick }: { title: string; action?: string; onClick?: () => void }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-[17px] font-black tracking-[-0.04em] text-[#111827]">{title}</h2>
      {action ? (
        <button className="flex items-center gap-1 text-[13px] font-extrabold text-[#00A86B]" type="button" onClick={onClick}>
          {action}
          <ChevronRight className="h-4 w-4" strokeWidth={3} />
        </button>
      ) : null}
    </div>
  );
}

function HumanSilhouette() {
  return (
    <div className="relative mx-auto h-[92px] w-[50px] opacity-70">
      <div className="absolute left-1/2 top-0 h-5 w-5 -translate-x-1/2 rounded-full bg-emerald-200" />
      <div className="absolute left-1/2 top-[19px] h-[48px] w-[24px] -translate-x-1/2 rounded-t-full rounded-b-[18px] bg-emerald-100" />
      <div className="absolute left-[7px] top-[24px] h-[48px] w-2 rotate-12 rounded-full bg-emerald-100" />
      <div className="absolute right-[7px] top-[24px] h-[48px] w-2 -rotate-12 rounded-full bg-emerald-100" />
      <div className="absolute left-[17px] top-[62px] h-[30px] w-2 rotate-6 rounded-full bg-emerald-100" />
      <div className="absolute right-[17px] top-[62px] h-[30px] w-2 -rotate-6 rounded-full bg-emerald-100" />
    </div>
  );
}

const goalTypeLabel: Record<string, string> = {
  weight_loss: "Weight Loss",
  muscle_gain: "Muscle Gain",
  maintenance: "Maintenance",
  general_health: "Healthy Lifestyle",
};

const goalTypeIcon: Record<string, LucideIcon> = {
  weight_loss: Scale,
  muscle_gain: Dumbbell,
  maintenance: Leaf,
  general_health: Leaf,
};

export default function ProgressRedesigned() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const { activeGoal, setGoal, updateGoalTargets, goals, loading: goalsLoading } = useNutritionGoals(user?.id);
  const { summary: weeklySummary, loading: summaryLoading } = useWeeklySummary(user?.id);
  const { streaks, loading: streaksLoading } = useStreak(user?.id);
  const { todayProgress } = useTodayProgress(user?.id, new Date(), 0);
  const { dailySummary: waterSummary, addWater: addWaterIntake } = useWaterIntake(user?.id);
  const { toast } = useToast();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<"today" | "week" | "goals">("goals");
  const [showGoalPicker, setShowGoalPicker] = useState(false);
  const [showWeightInput, setShowWeightInput] = useState(false);
  const [newWeight, setNewWeight] = useState("");
  const [showWeekDetails, setShowWeekDetails] = useState(false);
  const [showWaterTracker, setShowWaterTracker] = useState(false);
  const [isApplyingSuggestion, setIsApplyingSuggestion] = useState(false);
  const [isLoggingWeight, setIsLoggingWeight] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarDate, setCalendarDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const currentWeight = profile?.current_weight_kg ?? 75;
  const goalWeight = activeGoal?.target_weight_kg ?? currentWeight;
  const height = profile?.height_cm ?? 175;
  const firstName = profile?.full_name?.split(" ")[0] ?? "Adam";
  const goalType = activeGoal?.goal_type ?? "weight_loss";
  const goalName = goalTypeLabel[goalType] ?? "Weight Loss";
  const weightDiff = Math.abs(currentWeight - goalWeight);
  const bmi = height > 0 ? Number((currentWeight / Math.pow(height / 100, 2)).toFixed(1)) : 24.5;
  const bmiLabel = bmi < 18.5 ? "Underweight" : bmi < 25 ? "Healthy" : bmi < 30 ? "Overweight" : "High";

  const progressPct = useMemo(() => {
    if (goalWeight > 0 && currentWeight > goalWeight) {
      return Math.max(5, Math.min(95, Math.round((1 - (currentWeight - goalWeight) / (currentWeight + 10 - goalWeight)) * 100)));
    }
    return 72;
  }, [currentWeight, goalWeight]);

  const isLoading = profileLoading || goalsLoading;

  const weeklyMetrics: RingMetric[] = useMemo(() => {
    const macros = weeklySummary?.macros;
    const cals = weeklySummary?.calories;
    const calTarget = activeGoal?.daily_calorie_target ?? 2000;
    const calPct = calTarget > 0 ? Math.min(100, Math.round(((cals?.thisWeekAvg ?? 0) / calTarget) * 100)) : 0;
    const getStatus = (pct: number) => (pct >= 80 ? "Excellent" : pct >= 60 ? "On Track" : "Improve");
    return [
      { label: "Calories", value: calPct, status: getStatus(calPct), Icon: Flame, color: "#F97316", track: "#FFEDD5" },
      { label: "Protein", value: macros?.protein?.percentage ?? 0, status: getStatus(macros?.protein?.percentage ?? 0), Icon: Target, color: "#3B82F6", track: "#DBEAFE" },
      { label: "Carbs", value: macros?.carbs?.percentage ?? 0, status: getStatus(macros?.carbs?.percentage ?? 0), Icon: Wheat, color: "#F7B731", track: "#FEF3C7" },
      { label: "Fat", value: macros?.fat?.percentage ?? 0, status: getStatus(macros?.fat?.percentage ?? 0), Icon: Droplet, color: "#10B981", track: "#D1FAE5" },
    ];
  }, [weeklySummary, activeGoal?.daily_calorie_target]);

  const weeklyChecklist = useMemo(() => {
    const logStreak = streaks.logging?.currentStreak ?? 0;
    const waterStreak = streaks.water?.currentStreak ?? 0;
    const todayLogged = streaks.logging?.lastLogDate === format(new Date(), "yyyy-MM-dd");
    return [
      { label: "Calories On Track", Icon: Droplet, color: "#10B981", done: todayLogged },
      { label: `${logStreak} Day Streak`, Icon: CalendarCheck, color: "#10B981", done: logStreak > 0 },
      { label: "Water Improved", Icon: Droplet, color: "#60A5FA", done: waterStreak > 0 },
      { label: "Late Night Snacking", Icon: AlertCircle, color: "#FB923C", done: false },
    ];
  }, [streaks, activeGoal?.goal_type, weeklySummary?.macros]);

  const coachRecommendation = useMemo(() => {
    const protein = activeGoal?.protein_target_g ?? 120;
    const macros = weeklySummary?.macros;
    const proteinPct = macros?.protein?.percentage ?? 0;
    if (goalType === "muscle_gain") {
      if (proteinPct < 70) return `Increase protein to ${protein}g daily — you're at ${macros?.protein?.consumed ?? 0}g this week. Muscle needs fuel.`;
      return `Solid protein intake! Keep hitting ${protein}g daily and push heavier lifts for gains.`;
    }
    if (goalType === "weight_loss") {
      return `Stay in a calorie deficit while keeping protein at ${protein}g daily to preserve muscle while burning fat.`;
    }
    return `Keep balanced macros — ${protein}g protein, ${activeGoal?.carbs_target_g ?? 200}g carbs, ${activeGoal?.fat_target_g ?? 65}g fat daily for optimal health.`;
  }, [goalType, activeGoal, weeklySummary]);

  const handleGoalChange = async (newGoalType: string) => {
    if (newGoalType === goalType) {
      setShowGoalPicker(false);
      return;
    }
    try {
      await setGoal({
        goal_type: newGoalType as "weight_loss" | "muscle_gain" | "general_health" | "maintenance",
        target_weight_kg: activeGoal?.target_weight_kg ?? null,
        target_date: activeGoal?.target_date ?? null,
        daily_calorie_target: activeGoal?.daily_calorie_target ?? 2000,
        protein_target_g: activeGoal?.protein_target_g ?? 120,
        carbs_target_g: activeGoal?.carbs_target_g ?? 200,
        fat_target_g: activeGoal?.fat_target_g ?? 65,
        fiber_target_g: activeGoal?.fiber_target_g ?? 25,
        is_active: true,
      });
      toast({ description: `Goal changed to ${goalTypeLabel[newGoalType]}` });
      setShowGoalPicker(false);
    } catch {
      toast({ description: "Failed to change goal. Try again.", variant: "destructive" });
    }
  };

  const isGoalLoss = goalType === "weight_loss";
  const targetLabel = isGoalLoss ? `−${weightDiff.toFixed(0)} kg target` : `+${weightDiff.toFixed(0)} kg target`;

  const waterGlasses = waterSummary?.total ?? 0;
  const waterTarget = 8;

  const handleLogWeight = async () => {
    const w = parseFloat(newWeight);
    if (!w || w <= 0 || !user?.id) return;
    setIsLoggingWeight(true);
    try {
      await supabase.from("progress_logs").upsert({
        user_id: user.id,
        log_date: format(new Date(), "yyyy-MM-dd"),
        weight_kg: w,
      }, { onConflict: "user_id,log_date" });
      await supabase.from("profiles").update({ current_weight_kg: w }).eq("user_id", user.id);
      await supabase.from("weight_entries").insert({
        user_id: user.id,
        weight_kg: w,
        log_date: format(new Date(), "yyyy-MM-dd"),
      });
      toast({ description: `Weight logged: ${w} kg` });
      setNewWeight("");
      setShowWeightInput(false);
      window.location.reload();
    } catch {
      toast({ description: "Failed to log weight", variant: "destructive" });
    } finally {
      setIsLoggingWeight(false);
    }
  };

  const handleApplySuggestion = async () => {
    if (!activeGoal || !updateGoalTargets) return;
    setIsApplyingSuggestion(true);
    try {
      const currentProtein = activeGoal.protein_target_g;
      const newProtein = goalType === "muscle_gain" ? currentProtein + 10 : currentProtein;
      await updateGoalTargets({ protein_target_g: newProtein });
      toast({ description: `Protein target updated to ${newProtein}g` });
    } catch {
      toast({ description: "Failed to update targets", variant: "destructive" });
    } finally {
      setIsApplyingSuggestion(false);
    }
  };

  const handleWaterAdd = async () => {
    if (!user?.id) return;
    await addWaterIntake(1);
    toast({ description: "+1 glass 💧", duration: 1200 });
  };

  const handleWaterRemove = async () => {
    if (!user?.id || waterGlasses <= 0) return;
    await addWaterIntake(-1);
    toast({ description: "-1 glass", duration: 1200 });
  };

  return (
    <main className="min-h-screen bg-[#FAFBFC] text-[#101827]">
      <div className="mx-auto min-h-screen w-full max-w-[430px] bg-white px-5 pb-8 pt-[calc(env(safe-area-inset-top,0px)+20px)] shadow-[0_24px_80px_rgba(15,23,42,0.06)]">
        <header className="mb-6 flex items-center justify-between px-0.5">
          <button
            aria-label="Go back"
            className="grid h-10 w-10 place-items-center rounded-full text-[#0F172A] active:bg-slate-100"
            onClick={() => navigate(-1)}
            type="button"
          >
            <ArrowLeft className="h-7 w-7" strokeWidth={2.6} />
          </button>
          <h1 className="text-[23px] font-black tracking-[-0.06em] text-[#111827]">Goals</h1>
          <button
            aria-label="Open calendar"
            className="grid h-10 w-10 place-items-center rounded-full text-[#0F172A] active:bg-slate-100"
            type="button"
            onClick={() => setShowCalendar(!showCalendar)}
          >
            <CalendarCheck className="h-[26px] w-[26px]" strokeWidth={2.4} />
          </button>
        </header>

        {showCalendar && (
          <div className="mb-6 rounded-[18px] border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.08)]">
            <label className="mb-2 block text-[13px] font-extrabold text-slate-700">Select date to view progress</label>
            <div className="flex items-center gap-3">
              <input
                type="date"
                value={calendarDate}
                onChange={(e) => setCalendarDate(e.target.value)}
                className="h-11 flex-1 rounded-[12px] border border-slate-200 bg-[#F8FAFC] px-3 text-[14px] font-semibold text-slate-800"
              />
              <button
                className="h-11 rounded-[12px] bg-emerald-600 px-4 text-[13px] font-black text-white active:scale-95"
                type="button"
                onClick={() => { toast({ description: `Showing data for ${calendarDate}` }); setShowCalendar(false); }}
              >
                View
              </button>
            </div>
          </div>
        )}

        <div className="mb-6 grid h-[58px] grid-cols-3 rounded-full bg-[#F3F6FA] p-1 shadow-inner shadow-slate-200/60">
          {['Today', 'Week', 'Goals'].map((tab) => {
            const tabKey = tab.toLowerCase() as "today" | "week" | "goals";
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tabKey)}
                className={`rounded-full text-[14px] font-extrabold transition-colors ${activeTab === tabKey ? 'bg-white text-[#00A86B] shadow-[0_10px_22px_rgba(15,23,42,0.10)]' : 'text-slate-500'}`}
                type="button"
              >
                {tab}
              </button>
            );
          })}
        </div>

        <section className="relative mb-7 overflow-hidden rounded-[22px] bg-[radial-gradient(circle_at_62%_35%,rgba(81,243,160,0.22),transparent_33%),linear-gradient(135deg,#06966E_0%,#007D67_46%,#006754_100%)] p-5 text-white shadow-[0_18px_40px_rgba(0,128,96,0.24)]">
          <div className="absolute inset-0 opacity-35 [background-image:radial-gradient(circle_at_12%_22%,white_1px,transparent_1px),radial-gradient(circle_at_74%_20%,white_1.5px,transparent_2px),radial-gradient(circle_at_44%_44%,white_1.5px,transparent_2px),radial-gradient(circle_at_92%_12%,white_1.5px,transparent_2px),radial-gradient(circle_at_70%_82%,white_1px,transparent_1px)]" />

          <div className="relative z-10">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-black uppercase backdrop-blur-md">
                  <Flame className="h-5 w-5 fill-orange-400 text-orange-400" />
                  Active Goal
                </div>
                <h2 className="text-[25px] font-black leading-none tracking-[-0.06em]">{goalName}</h2>
                <p className="mt-2 text-[13px] font-medium text-white/90">Your transformation progress</p>

                <div className="mt-4 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => { setShowWeightInput(!showWeightInput); setNewWeight(String(currentWeight)); }}
                    className="rounded-[12px] bg-white/12 px-3 py-2 text-center shadow-inner shadow-white/5 backdrop-blur-md hover:bg-white/18 active:scale-95 transition-all"
                  >
                    <div className="text-[22px] font-black leading-none">{currentWeight}<span className="ml-1 text-[11px]">kg</span></div>
                    <div className="mt-1 text-[10px] text-white/75">Current ▾</div>
                  </button>
                  <ArrowLeft className="h-5 w-5 rotate-180 text-white shrink-0" />
                  <div className="rounded-[12px] bg-white/12 px-3 py-2 text-center shadow-inner shadow-white/5 backdrop-blur-md">
                    <div className="text-[22px] font-black leading-none">{goalWeight}<span className="ml-1 text-[11px]">kg</span></div>
                    <div className="mt-1 text-[10px] text-white/75">Goal</div>
                  </div>
                </div>
              </div>

              <div className="shrink-0">
                <ProgressRing value={progressPct} label="Progress" />
                <div className="mt-4 flex justify-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-white" />
                  <span className="h-2 w-2 rounded-full bg-white/25" />
                  <span className="h-2 w-2 rounded-full bg-white/25" />
                  <span className="h-2 w-2 rounded-full bg-white/25" />
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3 text-[12px] font-extrabold text-white/90">
              <span>{targetLabel}</span>
              <span className="h-1 w-1 rounded-full bg-white/70" />
              <span>82% consistency</span>
            </div>

            <div className="mt-3 inline-flex items-center gap-2 rounded-[10px] bg-white/12 px-3 py-2 backdrop-blur-md">
              <TrendingUp className="h-6 w-6 text-[#5CF0A7]" strokeWidth={2.6} />
              <p className="text-[10px] font-bold leading-tight text-white/90">You're ahead of last month!</p>
            </div>
          </div>
        </section>

        {showWeightInput && (
          <div className="mb-7 -mt-4 rounded-b-[22px] bg-white/95 backdrop-blur-lg border border-white/30 p-4 shadow-[0_10px_24px_rgba(0,0,0,0.08)]">
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={newWeight}
                onChange={(e) => setNewWeight(e.target.value)}
                placeholder={`${currentWeight}`}
                step="0.1"
                className="h-12 flex-1 rounded-[12px] border border-slate-200 bg-[#F8FAFC] px-4 text-[18px] font-bold text-slate-800"
              />
              <span className="text-[14px] font-bold text-slate-500">kg</span>
              <button
                type="button"
                onClick={handleLogWeight}
                disabled={isLoggingWeight}
                className="h-12 rounded-[12px] bg-emerald-600 px-5 text-[14px] font-black text-white active:scale-95 disabled:opacity-60"
              >
                {isLoggingWeight ? "..." : "Save"}
              </button>
            </div>
          </div>
        )}

        {activeTab === "today" && (
          <>
            <section className="mb-5">
              <SectionHeader title="Today's Nutrition" />
              <div className="grid grid-cols-2 gap-3">
                <article className="rounded-[20px] border border-slate-100 bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.055)]">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="grid h-8 w-8 place-items-center rounded-full bg-orange-100 text-orange-500">
                      <Flame className="h-4 w-4" />
                    </div>
                    <span className="text-[12px] font-extrabold text-slate-600">Calories</span>
                  </div>
                  <p className="text-[32px] font-black tracking-[-0.06em] text-slate-950">{todayProgress.calories}</p>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-gradient-to-r from-orange-400 to-orange-500" style={{ width: `${Math.min(100, ((todayProgress.calories / (activeGoal?.daily_calorie_target || 2000)) * 100))}%` }} />
                  </div>
                  <p className="mt-1 text-[11px] font-semibold text-slate-500">of {activeGoal?.daily_calorie_target ?? 2000} kcal</p>
                </article>
                <article className="rounded-[20px] border border-slate-100 bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.055)]">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="grid h-8 w-8 place-items-center rounded-full bg-blue-100 text-blue-500">
                      <Dumbbell className="h-4 w-4" />
                    </div>
                    <span className="text-[12px] font-extrabold text-slate-600">Protein</span>
                  </div>
                  <p className="text-[32px] font-black tracking-[-0.06em] text-slate-950">{todayProgress.protein}<span className="ml-1 text-[14px] font-bold text-slate-400">g</span></p>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-gradient-to-r from-blue-400 to-blue-600" style={{ width: `${Math.min(100, ((todayProgress.protein / (activeGoal?.protein_target_g || 120)) * 100))}%` }} />
                  </div>
                  <p className="mt-1 text-[11px] font-semibold text-slate-500">of {activeGoal?.protein_target_g ?? 120}g</p>
                </article>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <article className="rounded-[16px] border border-slate-100 bg-white px-3 py-2.5 shadow-[0_8px_20px_rgba(15,23,42,0.04)]">
                  <span className="text-[11px] font-semibold text-slate-500">Carbs</span>
                  <p className="text-[26px] font-black tracking-[-0.05em] text-slate-950">{todayProgress.carbs}<span className="ml-1 text-[11px] font-bold text-slate-400">g</span></p>
                  <span className="text-[10px] font-semibold text-slate-400">of {activeGoal?.carbs_target_g ?? 200}g</span>
                </article>
                <article className="rounded-[16px] border border-slate-100 bg-white px-3 py-2.5 shadow-[0_8px_20px_rgba(15,23,42,0.04)]">
                  <span className="text-[11px] font-semibold text-slate-500">Fat</span>
                  <p className="text-[26px] font-black tracking-[-0.05em] text-slate-950">{todayProgress.fat}<span className="ml-1 text-[11px] font-bold text-slate-400">g</span></p>
                  <span className="text-[10px] font-semibold text-slate-400">of {activeGoal?.fat_target_g ?? 65}g</span>
                </article>
              </div>
            </section>

            <section className="mb-5">
              <SectionHeader title="Water Tracker" />
              <article className="rounded-[20px] border border-blue-50 bg-[linear-gradient(135deg,#F0F9FF_0%,#EFF6FF_50%,#F5F9FF_100%)] p-4 shadow-[0_12px_28px_rgba(59,130,246,0.08)]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="grid h-12 w-12 place-items-center rounded-full bg-blue-100 text-blue-500">
                      <Droplet className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-[24px] font-black tracking-[-0.05em] text-slate-950">{waterGlasses}<span className="text-slate-400">/{(waterTarget)}</span></p>
                      <p className="text-[12px] font-semibold text-slate-500">glasses today</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleWaterRemove}
                      className="grid h-11 w-11 place-items-center rounded-full bg-white shadow-[0_6px_14px_rgba(0,0,0,0.06)] text-slate-600 active:scale-95 border border-slate-200"
                    >
                      <Minus className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={handleWaterAdd}
                      className="grid h-11 w-11 place-items-center rounded-full bg-blue-500 shadow-[0_6px_14px_rgba(59,130,246,0.3)] text-white active:scale-95"
                    >
                      <Plus className="h-5 w-5" />
                    </button>
                  </div>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-blue-100">
                  <div className="h-full rounded-full bg-gradient-to-r from-blue-400 to-blue-600" style={{ width: `${Math.min(100, (waterGlasses / waterTarget) * 100)}%` }} />
                </div>
              </article>
            </section>
          </>
        )}

        {activeTab !== "today" && (
          <>
            <section className="mb-6">
              <SectionHeader title="Goal Focus" />
              <div className="rounded-[24px] bg-gradient-to-br from-emerald-50/80 to-teal-50/60 border border-emerald-200/60 p-5">
                <div className="flex items-center gap-4 mb-4">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[16px] bg-gradient-to-br from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-600/20">
                    <Target className="h-6 w-6" strokeWidth={2.2} />
                  </div>
                   <div className="min-w-0">
                     <h3 className="text-[18px] font-black text-slate-900 truncate">{goalName}</h3>
                     <p className="text-[12px] text-slate-500 font-semibold">Active nutrition goal</p>
                   </div>
                   <button
                     type="button"
                     onClick={() => setShowGoalPicker((v) => !v)}
                     className="ml-auto shrink-0 rounded-[14px] bg-white/90 border border-emerald-200 px-3.5 py-1.5 text-[12px] font-extrabold text-emerald-700 hover:bg-emerald-50 transition-colors active:scale-95"
                   >
                     Change
                   </button>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: "Calories", value: activeGoal?.daily_calorie_target ?? 2000, unit: "kcal", Icon: Flame },
                    { label: "Protein", value: activeGoal?.protein_target_g ?? 120, unit: "g", Icon: Target },
                    { label: "Carbs", value: activeGoal?.carbs_target_g ?? 200, unit: "g", Icon: Wheat },
                    { label: "Fat", value: activeGoal?.fat_target_g ?? 65, unit: "g", Icon: Droplet },
                  ].map((m) => {
                    const MI = m.Icon;
                    return (
                      <div key={m.label} className="rounded-[16px] bg-white/80 border border-slate-100 px-2.5 py-3 text-center">
                        <MI className="mx-auto mb-1.5 h-4 w-4 text-emerald-600" strokeWidth={2.4} />
                        <span className="block text-[16px] font-black text-slate-900 leading-[1.1]">{m.value.toLocaleString()}</span>
                        <span className="block text-[10px] font-bold text-slate-400 mt-0.5">{m.unit} {m.label}</span>
                      </div>
                    );
                  })}
                </div>

                {showGoalPicker && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {Object.entries(goalTypeLabel).map(([key, label]) => {
                      const Icon = goalTypeIcon[key] ?? Leaf;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => handleGoalChange(key)}
                          className={`flex items-center gap-1.5 rounded-[14px] px-3 py-2 text-[12px] font-extrabold transition-all active:scale-95 ${
                            goalType === key
                              ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
                              : "bg-white border border-slate-200 text-slate-700 hover:border-emerald-300 hover:text-emerald-700"
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" strokeWidth={2.4} />
                          {label}
                        </button>
                      );
                    })}
                  </div>
                )}

                <p className="mt-3 text-[11px] leading-relaxed text-slate-500 bg-white/60 rounded-[14px] px-3 py-2.5">
                  {isGoalLoss
                    ? `Focus on a calorie deficit with ${activeGoal?.protein_target_g ?? 120}g protein to preserve muscle while losing weight.`
                    : goalType === "muscle_gain"
                    ? `Aim for a calorie surplus with ${activeGoal?.protein_target_g ?? 150}g+ protein to fuel muscle growth.`
                    : `Stay balanced with ${activeGoal?.protein_target_g ?? 120}g protein, ${activeGoal?.carbs_target_g ?? 200}g carbs, and ${activeGoal?.fat_target_g ?? 65}g fat daily.`}
                </p>
              </div>
        </section>

        <section className="mb-5">
          <SectionHeader action={showWeekDetails ? "Hide Details" : "View Details"} title="Weekly Performance" onClick={() => setShowWeekDetails(!showWeekDetails)} />
          <div className="grid grid-cols-4 gap-2.5">
            {weeklyMetrics.map((metric) => <MetricRing key={metric.label} metric={metric} />)}
          </div>
          {showWeekDetails && weeklySummary && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <article className="rounded-[16px] border border-slate-100 bg-white px-3 py-2.5 shadow-[0_8px_20px_rgba(15,23,42,0.04)]">
                <span className="text-[11px] font-semibold text-slate-500">Avg Calories/Day</span>
                <p className="text-[26px] font-black tracking-[-0.05em] text-slate-950">{weeklySummary.calories.thisWeekAvg}<span className="ml-1 text-[11px] font-bold text-slate-400">kcal</span></p>
                <span className="text-[10px] font-semibold text-slate-400">vs {weeklySummary.calories.lastWeekAvg} last week</span>
              </article>
              <article className="rounded-[16px] border border-slate-100 bg-white px-3 py-2.5 shadow-[0_8px_20px_rgba(15,23,42,0.04)]">
                <span className="text-[11px] font-semibold text-slate-500">Days Logged</span>
                <p className="text-[26px] font-black tracking-[-0.05em] text-slate-950">{weeklySummary.consistency.daysLogged}<span className="text-slate-400">/7</span></p>
                <span className="text-[10px] font-semibold text-slate-400">streak: {weeklySummary.consistency.streak}</span>
              </article>
            </div>
          )}
        </section>

        <section className="mb-5 flex flex-col gap-4">
          <article className="rounded-[20px] border border-slate-100 bg-white p-5 shadow-[0_16px_34px_rgba(15,23,42,0.06)]">
            <div className="mb-5 flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-full bg-emerald-100 text-emerald-600">
                <UserRound className="h-5 w-5" />
              </div>
              <h3 className="text-[16px] font-black tracking-[-0.04em]">Body Metrics</h3>
            </div>
            <div className="grid grid-cols-[1fr_64px_1fr] items-center gap-3">
              <div className="space-y-6">
                <div>
                  <p className="text-[11px] font-semibold text-slate-500">Current Weight</p>
                  <p className="mt-1 text-[24px] font-black tracking-[-0.06em]">{currentWeight}<span className="ml-1 text-[12px] font-bold">kg</span></p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-500">Height</p>
                  <p className="mt-1 text-[22px] font-black tracking-[-0.05em]">{height}<span className="ml-1 text-[12px] font-bold">cm</span></p>
                </div>
              </div>
              <HumanSilhouette />
              <div className="space-y-6 text-right">
                <div>
                  <p className="text-[11px] font-semibold text-slate-500">Goal Weight</p>
                  <p className="mt-1 text-[24px] font-black tracking-[-0.06em]">{goalWeight}<span className="ml-1 text-[12px] font-bold">kg</span></p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-500">BMI</p>
                  <p className="mt-1 text-[24px] font-black tracking-[-0.06em]">{bmi}</p>
                  <p className="text-[11px] font-extrabold text-[#00A86B]">{bmiLabel}</p>
                </div>
              </div>
            </div>
            <div className="mt-5 h-2 rounded-full bg-slate-100">
              <div className="relative h-full rounded-full bg-gradient-to-r from-emerald-200 to-emerald-500" style={{ width: `${progressPct}%` }}>
                <span className="absolute right-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full bg-emerald-500 shadow" />
              </div>
            </div>
          </article>

          <article className="relative overflow-hidden rounded-[20px] border border-violet-50 bg-[radial-gradient(circle_at_7%_18%,rgba(139,92,246,0.22),transparent_22%),linear-gradient(135deg,#FFFFFF_0%,#F5F0FF_55%,#FFFFFF_100%)] p-5 shadow-[0_16px_34px_rgba(76,29,149,0.10)]">
            <div className="mb-5 flex items-center gap-3">
              <div className="relative grid h-11 w-11 place-items-center">
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-600 shadow-[0_8px_24px_rgba(139,92,246,0.35)]" />
                <Brain className="relative z-10 h-[22px] w-[22px] text-white" strokeWidth={2} />
              </div>
              <h3 className="text-[18px] font-black tracking-[-0.05em]">AI Coach</h3>
              <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-black text-emerald-600">NEW</span>
            </div>
            <p className="text-[14px] font-medium leading-[1.55] text-slate-600">{coachRecommendation}</p>
            <button
              className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-[12px] bg-gradient-to-r from-[#10B981] to-[#009B72] text-[14px] font-black text-white shadow-[0_12px_20px_rgba(16,185,129,0.24)] disabled:opacity-60"
              type="button"
              onClick={handleApplySuggestion}
              disabled={isApplyingSuggestion}
            >
              <Sparkles className="h-5 w-5" />
              {isApplyingSuggestion ? "Applying..." : "Apply Suggestion"}
            </button>
          </article>
        </section>

        <section className="mb-5 flex flex-col gap-4">
          <article className="rounded-[20px] border border-slate-100 bg-white p-5 shadow-[0_16px_34px_rgba(15,23,42,0.06)]">
            <h3 className="mb-4 text-[17px] font-black tracking-[-0.05em]">This Week</h3>
            <div className="space-y-4">
              {weeklyChecklist.map((item) => {
                const Icon = item.Icon;
                return (
                  <div key={item.label} className="flex items-center gap-3">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={{ backgroundColor: `${item.color}1A`, color: item.color }}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="min-w-0 flex-1 text-[13px] font-semibold text-slate-600">{item.label}</span>
                    <div className={`grid h-7 w-7 place-items-center rounded-full ${item.done ? "bg-emerald-100 text-emerald-600" : "bg-orange-100 text-orange-500"}`}>
                      {item.done ? <Check className="h-5 w-5" strokeWidth={3} /> : <span className="text-sm font-black">!</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </article>

          <article className="rounded-[20px] border border-slate-100 bg-white p-5 shadow-[0_16px_34px_rgba(15,23,42,0.06)]">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-[17px] font-black tracking-[-0.05em]">Achievements</h3>
              <button className="text-[13px] font-black text-[#00A86B]" type="button">View All</button>
            </div>
            <div className="grid grid-cols-4 gap-3 text-center">
              {achievements.map((achievement) => {
                const Icon = achievement.Icon;
                return (
                  <div key={achievement.label} className="flex flex-col items-center">
                    <div className={`grid h-[52px] w-[52px] place-items-center rounded-[16px] border shadow-inner ${achievement.unlocked ? "border-amber-200 bg-gradient-to-br from-amber-200 to-amber-500 text-amber-800" : "border-slate-300 bg-gradient-to-br from-slate-100 to-slate-300 text-slate-500"}`}>
                      <Icon className="h-7 w-7" />
                    </div>
                    <p className="mt-2.5 text-[11px] font-semibold leading-[1.15] text-slate-600">{achievement.label}</p>
                  </div>
                );
              })}
            </div>
            <div className="mt-5 flex items-center gap-3">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full w-1/2 rounded-full bg-[#10B981]" />
              </div>
              <p className="text-[12px] font-black text-[#00A86B]">2 <span className="font-semibold text-slate-500">/ 4 Unlocked</span></p>
              <div className="h-1.5 flex-1 rounded-full bg-slate-100" />
            </div>
          </article>
        </section>
        </>)}

        <section className="mb-4 overflow-hidden rounded-[24px] bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/80">
          <div className="flex items-center gap-3 px-5 pt-5 pb-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#10B981] to-[#059669] shadow-[0_6px_14px_rgba(16,185,129,0.25)]">
              <Trophy className="h-5 w-5 text-white" strokeWidth={2.5} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-[15px] font-extrabold tracking-[-0.02em] text-slate-950">Keep going, {firstName}! 💪</h3>
              <p className="mt-0.5 text-[11px] font-medium text-slate-500">Only {Math.max(1, Math.round(weightDiff))} kg left to unlock your first milestone</p>
            </div>
          </div>
          <div className="flex items-center gap-3 border-t border-slate-50 bg-[linear-gradient(100deg,#ECFDF5_0%,#F0FDF6_50%,#EFF6FF_100%)] px-5 py-3">
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-100">
                <TrendingUp className="h-4 w-4 text-[#10B981]" strokeWidth={2.5} />
              </div>
              <p className="text-[11px] font-semibold text-slate-700">Better than <span className="font-extrabold text-[#059669]">68%</span> of users</p>
            </div>
            <div className="h-5 w-px bg-slate-200" />
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-amber-100">
                <Zap className="h-4 w-4 text-amber-600" strokeWidth={2.5} />
              </div>
              <p className="text-[11px] font-semibold text-slate-700"><span className="font-extrabold text-amber-600">82%</span> consistency</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
