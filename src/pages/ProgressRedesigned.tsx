import type { LucideIcon } from "lucide-react";
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  Apple,
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  Brain,
  CalendarCheck,
  Check,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Crown,
  Droplet,
  Dumbbell,
  Flame,
  Info,
  Leaf,
  Lock,
  Minus,
  Plus,
  Scale,
  Sparkles,
  Star,
  Target,
  Trophy,
  TrendingUp,
  TrendingDown,
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
import { useWeightChartData } from "@/hooks/useWeightChartData";
import { useClientGoalProposals } from "@/hooks/useClientGoalProposals";
import { useSmartRecommendations } from "@/hooks/useSmartRecommendations";
import { useMealQuality } from "@/hooks/useMealQuality";
import { useAIInsight } from "@/hooks/useAIInsight";
import { AIInsightImageCard } from "@/components/progress/AIInsightImageCard";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useBadges } from "@/hooks/useBadges";
import { useWeekdayData } from "@/hooks/useWeekdayData";
import { BadgeCard } from "@/components/BadgeCard";

type RingMetric = {
  label: string;
  value: number;
  status: string;
  Icon: LucideIcon;
  color: string;
  track: string;
};



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
  const { badges, unlockedCount, totalCount } = useBadges(user?.id);
  const { days: weekdayData } = useWeekdayData(user?.id, activeGoal?.daily_calorie_target ?? 2000);
  const calorieTarget = activeGoal?.daily_calorie_target ?? 2000;
  const { toast } = useToast();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<"today" | "week" | "goals">("today");
  const [showGoalPicker, setShowGoalPicker] = useState(false);
  const [showWeightInput, setShowWeightInput] = useState(false);
  const [newWeight, setNewWeight] = useState("");
  const [showWeekDetails, setShowWeekDetails] = useState(false);
  const [showAllWeekBadges, setShowAllWeekBadges] = useState(false);
  const [showWaterTracker, setShowWaterTracker] = useState(false);
  const {
    proposals: coachProposals,
    progress: coachGoalProgress,
    loading: coachGoalsLoading,
    acceptGoal: acceptCoachGoal,
    rejectGoal: rejectCoachGoal,
  } = useClientGoalProposals(user?.id);
  const { recommendations: smartRecs, loading: smartRecsLoading, refresh: refreshRecs } = useSmartRecommendations(user?.id);
  const { averageScore: mealQualityScore, weeklyQuality } = useMealQuality(user?.id);
  const { weightChartData: weightHistory } = useWeightChartData(user?.id);

  const aiContext = useMemo(() => {
    if (!weeklySummary) return null;
    const weekScores = weeklyQuality.map((d) => d.avgScore);
    const thisWeek = weekScores.length >= 3 ? weekScores.slice(-3).reduce((a: number, b: number) => a + b, 0) / weekScores.slice(-3).length : mealQualityScore;
    const lastWeek = weekScores.length >= 6 ? weekScores.slice(0, 3).reduce((a: number, b: number) => a + b, 0) / weekScores.slice(0, 3).length : null;
    return {
      weeklyMacros: {
        avgCalories: weeklySummary.calories?.thisWeekAvg ?? 0,
        avgProtein: weeklySummary.macros?.protein?.consumed ?? 0,
        avgCarbs: weeklySummary.macros?.carbs?.consumed ?? 0,
        avgFat: weeklySummary.macros?.fat?.consumed ?? 0,
      },
      goals: {
        calorieTarget: activeGoal?.daily_calorie_target ?? 2000,
        proteinTarget: activeGoal?.protein_target_g ?? 120,
        goalType: activeGoal?.goal_type ?? "general",
      },
      mealQuality: {
        avgScore: Math.round(thisWeek),
        trend: lastWeek && lastWeek > 0 ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : null,
      },
      streak: {
        current: streaks?.logging?.currentStreak ?? 2,
        best: streaks?.logging?.bestStreak ?? 2,
      },
      daysLogged: weeklySummary?.consistency?.daysLogged ?? 0,
      waterAvg: waterSummary?.total ?? 0,
    };
  }, [weeklySummary, weeklyQuality, mealQualityScore, activeGoal, streaks, waterSummary]);

  const { insight: aiInsight, loading: aiInsightLoading } = useAIInsight(user?.id, aiContext);
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

  const goalRingValue = useMemo(() => {
    const proteinPct = weeklySummary?.macros?.protein?.percentage ?? 0;
    const consistencyPct = weeklySummary?.consistency?.percentage ?? 0;
    switch (goalType) {
      case "weight_loss": return progressPct;
      case "muscle_gain": return proteinPct;
      case "maintenance": return consistencyPct;
      default: return Math.round((progressPct + proteinPct + consistencyPct) / 3);
    }
  }, [goalType, progressPct, weeklySummary]);

  const goalRingLabel = useMemo(() => {
    switch (goalType) {
      case "weight_loss": return "to target";
      case "muscle_gain": return "protein goal";
      case "maintenance": return "on track";
      default: return "wellness";
    }
  }, [goalType]);

  const goalRightMetric = useMemo(() => {
    switch (goalType) {
      case "weight_loss": return { label: "Current Weight", value: `${currentWeight.toFixed(1)}`, unit: "kg ▾" };
      case "muscle_gain": return { label: "Weekly Avg Protein", value: `${weeklySummary?.macros?.protein?.consumed ?? 0}`, unit: "g" };
      case "maintenance": return { label: "Current Weight", value: `${currentWeight.toFixed(1)}`, unit: "kg ▾" };
      default: return { label: "Current Streak", value: `${streaks.logging?.currentStreak ?? 0}`, unit: "days" };
    }
  }, [goalType, currentWeight, weeklySummary, streaks]);

  const goalSubLabel = useMemo(() => {
    const isLoss = goalType === "weight_loss";
    switch (goalType) {
      case "weight_loss": return isLoss ? `−${weightDiff.toFixed(0)} kg target` : `+${weightDiff.toFixed(0)} kg target`;
      case "muscle_gain": return `target: ${activeGoal?.protein_target_g ?? 120}g`;
      case "maintenance": return "stay within range";
      default: return `best: ${streaks.logging?.bestStreak ?? 0} days`;
    }
  }, [goalType, weightDiff, activeGoal, streaks]);

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

  const todayLogged = streaks.logging?.lastLogDate === format(new Date(), "yyyy-MM-dd");

  const keepGoingMessage = useMemo(() => {
    const logStreak = streaks.logging?.currentStreak ?? 0;
    switch (goalType) {
      case "weight_loss":
        if (currentWeight <= goalWeight) return "You hit your goal weight! Set a new target to keep the momentum.";
        return `Only ${Math.max(1, Math.round(weightDiff))} kg left to reach your target weight.`;
      case "muscle_gain":
        if (currentWeight >= goalWeight) return "Goal weight reached! Time to set a new target and keep building.";
        return `${Math.max(1, Math.round(weightDiff))} kg to go — keep hitting protein and pushing heavier.`;
      case "maintenance":
        if (!todayLogged) return "Log today's meals to stay on track with your maintenance plan.";
        return logStreak > 0
          ? `${logStreak}-day streak — consistency is key for maintenance.`
          : "Start your streak — consistency keeps you at your best.";
      default:
        if (!todayLogged) return "Log your meals today to build healthy tracking habits.";
        return logStreak > 0
          ? `${logStreak}-day streak! Each day builds a healthier you.`
          : "Start tracking today — small steps lead to big changes.";
    }
  }, [goalType, currentWeight, goalWeight, weightDiff, streaks, todayLogged]);

  const keepGoingSubtext = useMemo(() => {
    const proteinPct = weeklySummary?.macros?.protein?.percentage ?? 0;
    switch (goalType) {
      case "weight_loss":
        return proteinPct >= 80 ? "Protein intake is solid — keep it up to preserve muscle." : "Boost protein to protect muscle while losing weight.";
      case "muscle_gain":
        return proteinPct >= 80 ? "Protein on point — your muscles are getting what they need." : "Increase protein to fuel muscle growth effectively.";
      case "maintenance":
        return "Stay balanced with your macros and keep moving daily.";
      default:
        return "Aim for balanced meals with protein, carbs, and healthy fats.";
    }
  }, [goalType, weeklySummary]);

  const weeklyChecklist = useMemo(() => {
    const logStreak = streaks.logging?.currentStreak ?? 0;
    const waterStreak = streaks.water?.currentStreak ?? 0;
    const proteinPct = weeklySummary?.macros?.protein?.percentage ?? 0;
    const calPct = activeGoal?.daily_calorie_target
      ? Math.min(100, Math.round(((weeklySummary?.calories?.thisWeekAvg ?? 0) / activeGoal.daily_calorie_target) * 100))
      : 0;
    switch (goalType) {
      case "weight_loss":
        return [
          { label: "Calorie Deficit", Icon: Flame, color: "#F97316", done: calPct <= 100 && calPct > 0 },
          { label: `${logStreak} Day Streak`, Icon: CalendarCheck, color: "#10B981", done: logStreak > 0 },
          { label: "Protein Target", Icon: Target, color: "#3B82F6", done: proteinPct >= 80 },
          { label: "Water Intake", Icon: Droplet, color: "#60A5FA", done: waterStreak > 0 },
        ];
      case "muscle_gain":
        return [
          { label: "Protein Target", Icon: Target, color: "#3B82F6", done: proteinPct >= 80 },
          { label: "Calorie Surplus", Icon: Flame, color: "#F97316", done: calPct >= 90 },
          { label: `${logStreak} Day Streak`, Icon: CalendarCheck, color: "#10B981", done: logStreak > 0 },
          { label: "Workouts Logged", Icon: Activity, color: "#8B5CF6", done: weekdayData.filter(d => d.hasWorkout).length >= 3 },
        ];
      case "maintenance":
        return [
          { label: "Calories On Track", Icon: Flame, color: "#F97316", done: calPct >= 80 && calPct <= 110 },
          { label: `${logStreak} Day Streak`, Icon: CalendarCheck, color: "#10B981", done: logStreak > 0 },
          { label: "Balanced Macros", Icon: Leaf, color: "#10B981", done: proteinPct >= 70 },
          { label: "Water Intake", Icon: Droplet, color: "#60A5FA", done: waterStreak > 0 },
        ];
      default:
        return [
          { label: "Meals Logged", Icon: Apple, color: "#10B981", done: todayLogged },
          { label: `${logStreak} Day Streak`, Icon: CalendarCheck, color: "#10B981", done: logStreak > 0 },
          { label: "Protein Target", Icon: Target, color: "#3B82F6", done: proteinPct >= 70 },
          { label: "Water Intake", Icon: Droplet, color: "#60A5FA", done: waterStreak > 0 },
        ];
    }
  }, [goalType, streaks, weeklySummary, activeGoal, todayLogged, weekdayData]);

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
          <h1 className="text-[23px] font-black tracking-[-0.06em] text-[#111827]">Progress</h1>
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

        {activeTab === "today" && (() => {
          const calTarget = activeGoal?.daily_calorie_target ?? 2078;
          const proteinTarget = activeGoal?.protein_target_g ?? 182;
          const carbsTarget = activeGoal?.carbs_target_g ?? 240;
          const fatTarget = activeGoal?.fat_target_g ?? 70;
          const calConsumed = todayProgress.calories ?? 0;
          const proteinConsumed = todayProgress.protein ?? 0;
          const carbsConsumed = todayProgress.carbs ?? 0;
          const fatConsumed = todayProgress.fat ?? 0;
          const dailyPct = calTarget > 0 ? Math.min(100, Math.round((calConsumed / calTarget) * 100)) : 0;
          const proteinPct = proteinTarget > 0 ? Math.min(100, Math.round((proteinConsumed / proteinTarget) * 100)) : 0;
          const carbsPct = carbsTarget > 0 ? Math.min(100, Math.round((carbsConsumed / carbsTarget) * 100)) : 0;
          const fatPct = fatTarget > 0 ? Math.min(100, Math.round((fatConsumed / fatTarget) * 100)) : 0;
          const overallPct = Math.round((dailyPct + proteinPct) / 2);
          const realMealScore = mealQualityScore > 0 ? Math.round(mealQualityScore) : overallPct;
          const mealQualityScoreLabel = realMealScore >= 80 ? "Good" : realMealScore >= 60 ? "Moderate" : "Needs Work";
          const weekScores = weeklyQuality.map((d) => d.avgScore);
          const daysLogged = weekScores.length;
          const completeness = Math.min(1, daysLogged / 7);
          let consistencyFactor = 0.5;
          if (daysLogged >= 2) {
            const mean = weekScores.reduce((a: number, b: number) => a + b, 0) / daysLogged;
            const variance = weekScores.reduce((a: number, s: number) => a + (s - mean) ** 2, 0) / daysLogged;
            const stdDev = Math.sqrt(variance);
            const cv = mean > 0 ? stdDev / mean : 1;
            consistencyFactor = Math.max(0, 1 - Math.min(1, cv));
          }
          const aiConfidence = Math.round(completeness * consistencyFactor * 100);
          const thisWeekAvg = weekScores.length >= 3 ? weekScores.slice(-3).reduce((a: number, b: number) => a + b, 0) / weekScores.slice(-3).length : realMealScore;
          const lastWeekAvg = weekScores.length >= 6 ? weekScores.slice(0, 3).reduce((a: number, b: number) => a + b, 0) / weekScores.slice(0, 3).length : null;
          const scoreTrend = lastWeekAvg && lastWeekAvg > 0
            ? Math.round(((thisWeekAvg - lastWeekAvg) / lastWeekAvg) * 100)
            : null;
          const dayName = format(new Date(), "EEEE, MMMM d");
          const streakDays = profile?.streak_days ?? 0;
          const weekDays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
          const todayIdx = (new Date().getDay() + 6) % 7;
          const loggedDates = new Set(
            weekdayData.filter((d) => d.calories > 0).map((d) => d.date)
          );

          const smartRecItems = smartRecs.slice(0, 3);

          return (
            <>
              <section className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-[20px] font-black tracking-[-0.04em] text-slate-900">Hello, {firstName}! 👋</h2>
                  <p className="text-[13px] text-slate-500 font-medium">Here's your daily nutrition overview.</p>
                </div>
              </section>

              <section className="mb-5">
                {activeGoal ? (
                  <article className="relative overflow-hidden rounded-[24px] bg-[radial-gradient(120%_120%_at_80%_-10%,rgba(255,255,255,0.14)_0%,transparent_45%),radial-gradient(130%_130%_at_-20%_0%,rgba(255,255,255,0.10)_0%,transparent_50%),linear-gradient(135deg,#0EA76B_0%,#0B8C6A_50%,#0A6D64_100%)] p-5 text-white shadow-[0_22px_48px_rgba(15,118,110,0.28)]">
                    <div className="pointer-events-none absolute inset-0 opacity-[0.18] mix-blend-soft-light [background-image:radial-gradient(circle_at_14%_22%,white_1px,transparent_1px),radial-gradient(circle_at_78%_18%,white_1.2px,transparent_2px),radial-gradient(circle_at_46%_62%,white_1.2px,transparent_2px),radial-gradient(circle_at_92%_12%,white_1px,transparent_1px)]" />

                    <div className="relative z-10 flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider backdrop-blur-sm">
                          <CalendarCheck className="h-4 w-4" />
                          Today • {dayName}
                        </div>

                        <div className="flex items-start gap-2 mb-3">
                          <Flame className="mt-0.5 h-5 w-5 text-amber-300" />
                          <div>
                            <p className="text-[26px] font-black leading-none tracking-[-0.06em]">{calConsumed.toLocaleString()}<span className="ml-1 text-[14px] font-bold">kcal</span></p>
                            <p className="mt-0.5 text-[11px] font-semibold text-white/80">of {calTarget.toLocaleString()} kcal</p>
                          </div>
                        </div>

                        <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/18">
                          <div className="h-full rounded-full bg-gradient-to-r from-amber-300 via-orange-400 to-rose-400" style={{ width: `${dailyPct}%` }} />
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <div className="rounded-[12px] bg-white/12 px-3 py-2 backdrop-blur-sm">
                            <div className="mb-1 flex items-center justify-between">
                              <span className="text-[10px] font-extrabold uppercase text-white/85">Protein</span>
                              <Target className="h-4 w-4 text-blue-200" />
                            </div>
                            <div className="flex items-baseline gap-1">
                              <span className="text-[16px] font-black leading-none">{proteinConsumed}</span>
                              <span className="text-[10px] font-semibold text-white/80">/ {proteinTarget}g</span>
                            </div>
                            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/20">
                              <div className="h-full rounded-full bg-blue-300" style={{ width: `${proteinPct}%` }} />
                            </div>
                          </div>

                          <div className="rounded-[12px] bg-white/12 px-3 py-2 backdrop-blur-sm">
                            <div className="mb-1 flex items-center justify-between">
                              <span className="text-[10px] font-extrabold uppercase text-white/85">Hydration</span>
                              <Droplet className="h-4 w-4 text-sky-200" />
                            </div>
                            <div className="flex items-baseline gap-1">
                              <span className="text-[16px] font-black leading-none">{waterGlasses}</span>
                              <span className="text-[10px] font-semibold text-white/80">/ {waterTarget} glasses</span>
                            </div>
                            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/20">
                              <div className="h-full rounded-full bg-sky-300" style={{ width: `${Math.min(100, Math.round((waterGlasses / waterTarget) * 100))}%` }} />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 pt-1">
                        <svg width="118" height="118" viewBox="0 0 118 118" className="-rotate-90">
                          <defs>
                            <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
                              <stop offset="0%" stopColor="#5CF0A7" />
                              <stop offset="100%" stopColor="#A7F3D0" />
                            </linearGradient>
                          </defs>
                          <circle cx="59" cy="59" r="50" fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="9" />
                          <circle cx="59" cy="59" r="50" fill="none" stroke="url(#ringGrad)" strokeLinecap="round" strokeWidth="9" strokeDasharray={`${(overallPct / 100) * (2 * Math.PI * 50)} ${2 * Math.PI * 50}`} />
                        </svg>
                        <div className="-mt-24 rotate-0 text-center">
                          <div className="text-[30px] font-black leading-none">{overallPct}<span className="text-[14px]">%</span></div>
                          <div className="mt-1 text-[10px] font-semibold text-white/85">Daily Score</div>
                          <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-1 text-[10px] font-bold backdrop-blur-sm">
                            <Star className="h-3.5 w-3.5 text-amber-300 fill-amber-300" />
                            {overallPct >= 70 ? "Great start" : "Keep going"}
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                ) : (
                  <article className="relative overflow-hidden rounded-[24px] bg-[radial-gradient(120%_120%_at_80%_-10%,rgba(255,255,255,0.14)_0%,transparent_45%),radial-gradient(130%_130%_at_-20%_0%,rgba(255,255,255,0.10)_0%,transparent_50%),linear-gradient(135deg,#0EA76B_0%,#0B8C6A_50%,#0A6D64_100%)] p-5 text-white shadow-[0_22px_48px_rgba(15,118,110,0.28)]">
                    <div className="pointer-events-none absolute inset-0 opacity-[0.18] mix-blend-soft-light [background-image:radial-gradient(circle_at_14%_22%,white_1px,transparent_1px),radial-gradient(circle_at_78%_18%,white_1.2px,transparent_2px),radial-gradient(circle_at_46%_62%,white_1.2px,transparent_2px),radial-gradient(circle_at_92%_12%,white_1px,transparent_1px)]" />

                    <div className="relative z-10 flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider backdrop-blur-sm">
                          <CalendarCheck className="h-4 w-4" />
                          Today • {dayName}
                        </div>

                        <div className="flex items-start gap-2 mb-3">
                          <Flame className="mt-0.5 h-5 w-5 text-amber-300" />
                          <div>
                            <p className="text-[26px] font-black leading-none tracking-[-0.06em]">{calConsumed.toLocaleString()}<span className="ml-1 text-[14px] font-bold">kcal</span></p>
                            <p className="mt-0.5 text-[11px] font-semibold text-white/80">calories logged today</p>
                          </div>
                        </div>

                        <div className="mb-3 rounded-[14px] bg-white/10 px-4 py-3 backdrop-blur-sm">
                          <div className="flex items-center gap-2 mb-2">
                            <Target className="h-5 w-5 text-amber-300" />
                            <p className="text-[14px] font-black">Set a nutrition goal</p>
                          </div>
                          <p className="text-[11px] font-medium leading-relaxed text-white/80">
                            Set your calorie and macro targets to track daily progress and get personalized insights.
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => setActiveTab("goals")}
                          className="flex w-full items-center justify-center gap-2 rounded-[14px] bg-white py-3 text-[14px] font-black text-emerald-700 shadow-[0_8px_20px_rgba(0,0,0,0.12)] active:scale-[0.98] transition-transform"
                        >
                          <Target className="h-4 w-4" />
                          Set Your Goal
                        </button>
                      </div>

                      <div className="shrink-0 pt-1">
                        <div className="relative grid h-[118px] w-[118px] place-items-center">
                          <svg width="118" height="118" viewBox="0 0 118 118" className="absolute inset-0 -rotate-90">
                            <circle cx="59" cy="59" r="50" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="9" />
                            <circle cx="59" cy="59" r="50" fill="none" stroke="rgba(255,255,255,0.25)" strokeLinecap="round" strokeWidth="9" strokeDasharray="15 299" opacity="0.5" />
                          </svg>
                          <div className="text-center">
                            <Target className="mx-auto h-9 w-9 text-amber-300" />
                            <div className="mt-2 text-[10px] font-semibold text-white/70">Goal not set</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                )}
              </section>

              {/* Nutrient Cards Row */}
              {activeGoal ? (
                <section className="mb-5">
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { icon: Flame, label: "Calories", current: calConsumed, target: calTarget, unit: "kcal", color: "#F97316", bg: "#FFF7ED" },
                      { icon: Target, label: "Protein", current: proteinConsumed, target: proteinTarget, unit: "g", color: "#3B82F6", bg: "#EFF6FF" },
                      { icon: Leaf, label: "Carbs", current: carbsConsumed, target: carbsTarget, unit: "g", color: "#10B981", bg: "#ECFDF5" },
                      { icon: Droplet, label: "Fat", current: fatConsumed, target: fatTarget, unit: "g", color: "#8B5CF6", bg: "#F5F3FF" },
                    ].map((n) => {
                      const NIcon = n.icon;
                      const pct = n.target > 0 ? Math.min(100, Math.round((n.current / n.target) * 100)) : 0;
                      return (
                        <article key={n.label} className="rounded-[14px] border border-slate-100 bg-white p-2.5 text-center shadow-[0_6px_16px_rgba(15,23,42,0.05)]">
                          <div className="mx-auto mb-1.5 grid h-7 w-7 place-items-center rounded-full" style={{ backgroundColor: n.bg }}>
                            <NIcon className="h-3.5 w-3.5" style={{ color: n.color }} />
                          </div>
                          <p className="text-[9px] font-bold text-slate-500">{n.label}</p>
                          <p className="text-[14px] font-black tracking-[-0.03em] text-slate-900">{n.current}<span className="text-[9px] font-bold text-slate-400">/{n.target}</span></p>
                          <p className="text-[8px] font-semibold text-slate-400">{n.unit}</p>
                          <div className="mx-auto mt-1.5 h-1 w-full overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: n.color }} />
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              ) : null}

              {/* Streak Section */}
              <section className="mb-5">
                <article className="rounded-[18px] border border-slate-100 bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="grid h-8 w-8 place-items-center rounded-full bg-orange-100">
                        <Flame className="h-4 w-4 text-orange-500" />
                      </div>
                      <div>
                        <p className="text-[14px] font-black text-slate-900">Streak</p>
                        <p className="text-[10px] font-medium text-slate-500">{streakDays > 0 ? "Keep it going!" : loggedDates.has(format(new Date(), "yyyy-MM-dd")) ? "Start your streak today!" : "Log a meal to start!"}</p>
                      </div>
                    </div>
                    <span className="rounded-full bg-orange-100 px-3 py-1 text-[11px] font-bold text-orange-600">{streakDays} Day Streak</span>
                  </div>
                  <div className="flex items-center justify-between">
                    {weekDays.map((d, i) => {
                      const dateStr = weekdayData[i]?.date;
                      const isLogged = dateStr ? loggedDates.has(dateStr) : false;
                      const isToday = i === todayIdx;
                      return (
                        <div key={i} className="flex flex-col items-center gap-1.5">
                          <span className="text-[10px] font-bold text-slate-400">{d}</span>
                          <div className={`grid h-8 w-8 place-items-center rounded-full ${isLogged ? 'bg-emerald-100' : isToday ? 'bg-orange-400' : 'bg-slate-100'}`}>
                            {isLogged ? <Check className="h-4 w-4 text-emerald-600" strokeWidth={3} /> : isToday ? <Flame className="h-4 w-4 text-white" /> : <span className="h-2 w-2 rounded-full bg-slate-300" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </article>
              </section>

              {/* AI Insight */}
              <AIInsightImageCard
                score={realMealScore}
                confidence={aiConfidence}
                mealQualityStatus={mealQualityScoreLabel}
                summary={aiInsight || (scoreTrend !== null ? `${scoreTrend >= 0 ? '+' : ''}${scoreTrend}% vs last week` : "")}
                proteinStatus={proteinPct >= 80 ? "On Track" : "Need More"}
                hydrationStatus={(waterSummary?.percentage ?? 0) >= 60 ? "On Track" : "Need More"}
                calorieStatus={dailyPct >= 80 ? "On Track" : dailyPct >= 50 ? "Need More" : "Off Track"}
                loading={aiInsightLoading}
                onViewAnalysis={() => navigate("/ai-report")}
              />

              {/* Smart Recommendations */}
              <section className="mb-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[14px] font-black text-slate-900">Smart Recommendations</h3>

                </div>

                {smartRecsLoading ? (
                  <div className="space-y-2.5">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="animate-pulse rounded-[14px] border border-slate-100 bg-white p-4 shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
                        <div className="flex items-start gap-3">
                          <div className="h-9 w-9 rounded-full bg-slate-200" />
                          <div className="flex-1 space-y-2">
                            <div className="h-3 w-2/3 rounded-full bg-slate-200" />
                            <div className="h-2.5 w-full rounded-full bg-slate-100" />
                            <div className="h-1.5 w-1/2 rounded-full bg-slate-100" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : smartRecItems.length > 0 ? (
                  <div className="space-y-2.5">
                    {smartRecItems.map((r) => {
                      const catIcons: Record<string, LucideIcon> = {
                        nutrition: Apple,
                        hydration: Droplet,
                        activity: Zap,
                        sleep: Star,
                        general: Sparkles,
                      };
                      const catColors: Record<string, string> = {
                        nutrition: "bg-emerald-100 text-emerald-600",
                        hydration: "bg-blue-100 text-blue-600",
                        activity: "bg-orange-100 text-orange-600",
                        sleep: "bg-purple-100 text-purple-600",
                        general: "bg-indigo-100 text-indigo-600",
                      };
                      const priorityBadge: Record<string, string> = {
                        high: "bg-red-100 text-red-700",
                        medium: "bg-amber-100 text-amber-700",
                        low: "bg-slate-100 text-slate-600",
                      };
                      const CatIcon = catIcons[r.category] || Sparkles;
                      const iconColors = catColors[r.category] || "bg-slate-100 text-slate-600";
                      const badgeColors = priorityBadge[r.priority] || "bg-slate-100 text-slate-600";
                      const progress = r.progress;

                      return (
                        <button
                          key={r.id}
                          type="button"
                          className="w-full rounded-[14px] border border-l-4 border-slate-100 bg-white p-4 text-left shadow-[0_6px_16px_rgba(15,23,42,0.04)] active:scale-[0.99] transition-transform"
                          style={{ borderLeftColor: r.priority === "high" ? "#EF4444" : r.priority === "medium" ? "#F59E0B" : "#94A3B8" }}
                          onClick={() => {
                            if (r.action_link) navigate(r.action_link);
                          }}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${iconColors.split(" ")[0]}`}>
                              <CatIcon className={`h-4.5 w-4.5 ${iconColors.split(" ")[1]}`} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-0.5">
                                <p className="text-[13px] font-bold text-slate-900 truncate">{r.title}</p>
                                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase ${badgeColors}`}>
                                  {r.priority}
                                </span>
                              </div>
                              <p className="text-[11px] leading-relaxed text-slate-500 line-clamp-2">{r.description}</p>
                              {progress && (
                                <div className="mt-2">
                                  <div className="mb-1 flex items-center justify-between text-[10px]">
                                    <span className="font-semibold text-slate-500">{progress.value}/{progress.max} {progress.unit}</span>
                                    <span className="font-bold text-slate-400">{Math.round((progress.value / progress.max) * 100)}%</span>
                                  </div>
                                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                                    <div
                                      className="h-full rounded-full"
                                      style={{
                                        width: `${Math.min(100, Math.round((progress.value / progress.max) * 100))}%`,
                                        backgroundColor: r.priority === "high" ? "#EF4444" : r.priority === "medium" ? "#F59E0B" : "#10B981",
                                      }}
                                    />
                                  </div>
                                </div>
                              )}
                              {r.action_text && r.action_link && (
                                <p className="mt-2 text-[10px] font-bold text-emerald-600">{r.action_text} →</p>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </section>

              {/* Weight Forecast */}
              {(() => {
                const actualPoints = weightHistory.filter((p) => p.actual !== null);
                const predictedPoints = weightHistory.filter((p) => p.predicted !== null);
                const allPoints = weightHistory.filter((p) => p.actual !== null || p.predicted !== null);

                if (allPoints.length < 2) {
                  return (
                    <section className="mb-5">
                      <article className="rounded-[18px] border border-slate-100 bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-[14px] font-black text-slate-900">Weight Forecast</h3>
                          <span className="text-[11px] font-bold text-emerald-600">Target: {goalWeight} kg</span>
                        </div>
                        <p className="text-[12px] text-slate-400 py-4 text-center">Log your weight a few times to see a trend.</p>
                      </article>
                    </section>
                  );
                }

                const weights = actualPoints.map((p) => p.actual!);
                const minW = Math.min(...weights);
                const maxW = Math.max(...weights);
                const padding = Math.max(1, (maxW - minW) * 0.3);
                const yMin = minW - padding;
                const yMax = maxW + padding;
                const yRange = yMax - yMin || 1;

                const toX = (i: number) => (i / Math.max(allPoints.length - 1, 1)) * 200;
                const toY = (w: number) => 60 - ((w - yMin) / yRange) * 48;

                const actualLinePoints = actualPoints
                  .map((p, i) => {
                    const allIdx = allPoints.indexOf(p);
                    return `${toX(allIdx)},${toY(p.actual!)}`;
                  })
                  .join(" ");

                const predictedLinePoints = predictedPoints
                  .map((p, i) => {
                    const allIdx = allPoints.indexOf(p);
                    const prevActual = actualPoints[actualPoints.length - 1];
                    if (i === 0 && prevActual) {
                      return `${toX(allPoints.indexOf(prevActual))},${toY(prevActual.actual!)} ${toX(allIdx)},${toY(p.predicted!)}`;
                    }
                    return `${toX(allIdx)},${toY(p.predicted!)}`;
                  })
                  .join(" ");

                const slope = actualPoints.length >= 2
                  ? (weights[weights.length - 1] - weights[0]) / Math.max(1, weights.length - 1)
                  : 0;
                const weeklyChange = slope * 7;
                const daysToGoal = goalWeight && slope !== 0
                  ? Math.round((goalWeight - currentWeight) / slope)
                  : null;

                return (
                  <section className="mb-5">
                    <article className="rounded-[18px] border border-slate-100 bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-[14px] font-black text-slate-900">Weight Forecast</h3>
                        <span className="text-[11px] font-bold text-emerald-600">Target: {goalWeight} kg</span>
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">{currentWeight} kg Today</span>
                      </div>
                      <svg className="w-full h-16" viewBox="0 0 200 60" preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="wg" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10B981" stopOpacity="0.2" />
                            <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        <path d={`M${actualLinePoints.split(" ")[0]} L${actualLinePoints.split(" ").slice(-1)[0]} L200,60 L0,60 Z`} fill="url(#wg)" />

                        {actualLinePoints && (
                          <polyline
                            fill="none"
                            stroke="#10B981"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            points={actualLinePoints}
                          />
                        )}

                        {predictedLinePoints && (
                          <polyline
                            fill="none"
                            stroke="#10B981"
                            strokeWidth="2"
                            strokeDasharray="4,3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            points={predictedLinePoints}
                          />
                        )}

                        {actualPoints.map((p, i) => {
                          const allIdx = allPoints.indexOf(p);
                          return (
                            <circle key={p.date} cx={toX(allIdx)} cy={toY(p.actual!)} r="3" fill="#10B981" />
                          );
                        })}
                      </svg>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-[11px] font-semibold text-slate-600">
                          {weeklyChange !== 0
                            ? `${weeklyChange < 0 ? "Losing" : "Gaining"} ${Math.abs(weeklyChange).toFixed(1)} kg/week`
                            : "Weight stable"}
                          {daysToGoal && daysToGoal > 0 ? ` · ~${daysToGoal} days to goal` : ""}
                        </p>
                        <p className="text-[10px] font-medium text-slate-400">
                          {weeklyChange < 0 ? "On track" : weeklyChange > 0 ? "Trending up" : "Steady"}
                        </p>
                      </div>
                    </article>
                  </section>
                );
              })()}

              {/* Log Today's Progress Button */}
              <button
                type="button"
                className="mb-6 flex w-full items-center justify-center gap-2 rounded-[16px] bg-emerald-500 py-4 text-[15px] font-black text-white shadow-[0_12px_28px_rgba(16,185,129,0.3)] active:scale-[0.98] transition-transform"
                onClick={() => navigate("/tracker")}
              >
                <Plus className="h-5 w-5" />
                Log Today's Progress
              </button>
            </>
          );
        })()}

        {activeTab === "week" && (
          <>
            {/* Weekly Score Card */}
            <section className="mb-5">
              <article className="relative overflow-hidden rounded-[22px] bg-gradient-to-br from-teal-600 via-emerald-600 to-teal-700 p-5 text-white shadow-[0_18px_40px_rgba(16,185,129,0.25)]">
                <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_20%_30%,white_1px,transparent_1px),radial-gradient(circle_at_80%_20%,white_1px,transparent_1px)]" />
                <div className="relative z-10 flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="text-[12px] font-bold text-white/90">Weekly Score</span>
                      <Info className="h-3.5 w-3.5 text-white/60" />
                    </div>
                    <div className="text-[48px] font-black leading-none tracking-[-0.06em]">
                      {weeklySummary?.consistency?.score ?? 82}<span className="text-[24px] font-bold text-white/70"> / 100</span>
                    </div>
                    <p className="mt-1 text-[11px] font-semibold text-white/80">+12 pts vs last week</p>
                  </div>
                  <div className="relative grid h-20 w-20 place-items-center">
                    <svg className="absolute inset-0 -rotate-90" viewBox="0 0 80 80">
                      <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="6" />
                      <circle cx="40" cy="40" r="34" fill="none" stroke="#5CF0A7" strokeLinecap="round" strokeWidth="6" strokeDasharray={`${((weeklySummary?.consistency?.score ?? 82) / 100) * 213.6} 213.6`} />
                    </svg>
                    <Crown className="h-7 w-7 text-amber-300" />
                  </div>
                </div>
                <div className="relative z-10 mt-5 flex justify-between gap-2">
                  <div className="flex-1 text-center rounded-[14px] bg-white/15 px-2 py-2.5 backdrop-blur-sm">
                    <Flame className="mx-auto h-5 w-5 text-orange-400" />
                    <p className="mt-1 text-[11px] font-bold text-white">5 Day Streak</p>
                    <p className="text-[9px] text-white/70">Keep it up!</p>
                  </div>
                  <div className="flex-1 text-center rounded-[14px] bg-white/15 px-2 py-2.5 backdrop-blur-sm">
                    <Leaf className="mx-auto h-5 w-5 text-green-300" />
                    <p className="mt-1 text-[11px] font-bold text-white">82% Nutrition</p>
                    <p className="text-[9px] text-white/70">Consistency</p>
                  </div>
                  <div className="flex-1 text-center rounded-[14px] bg-white/15 px-2 py-2.5 backdrop-blur-sm">
                    <Droplet className="mx-auto h-5 w-5 text-blue-300" />
                    <p className="mt-1 text-[11px] font-bold text-white">+12% Water</p>
                    <p className="text-[9px] text-white/70">vs last week</p>
                  </div>
                </div>
              </article>
            </section>

            <section className="mb-4 overflow-hidden rounded-[24px] bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/80">
              <div className="flex items-center gap-3 px-5 pt-5 pb-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#10B981] to-[#059669] shadow-[0_6px_14px_rgba(16,185,129,0.25)]">
                  <Trophy className="h-5 w-5 text-white" strokeWidth={2.5} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[15px] font-extrabold tracking-[-0.02em] text-slate-950">Keep going, {firstName}! 💪</h3>
                  <p className="mt-0.5 text-[11px] font-medium text-slate-500">{keepGoingMessage}</p>
                </div>
              </div>
            </section>

            {/* Achievements */}
            <section className="mb-5">
              <article className="rounded-[18px] border border-slate-100 bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                <h3 className="text-[13px] font-black text-slate-800 mb-3">Achievements</h3>
                <div className="grid grid-cols-4 gap-2">
                  {[...badges].sort((a, b) => (b.unlocked ? 1 : 0) - (a.unlocked ? 1 : 0)).slice(0, showAllWeekBadges ? totalCount : 4).map((badge) => (
                    <BadgeCard key={badge.id} badge={badge} variant="compact" />
                  ))}
                </div>
                <button
                  onClick={() => setShowAllWeekBadges(!showAllWeekBadges)}
                  className="mt-3 w-full flex items-center justify-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-700"
                >
                  {showAllWeekBadges ? (
                    <>Show Less <ChevronUp className="h-3 w-3" /></>
                  ) : (
                    <>View All ({totalCount}) <ChevronDown className="h-3 w-3" /></>
                  )}
                </button>
              </article>
            </section>

            {/* Your Week - Calendar Grid with Rows */}
            <section className="mb-5">
              <article className="rounded-[20px] border border-slate-100 bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.06)]">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[16px] font-black tracking-[-0.04em] text-slate-900">Your Week</h3>
                  <div className="flex items-center gap-3 text-[10px]">
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> On Track</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-orange-400" /> Partial</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-300" /> No Data</span>
                  </div>
                </div>
                
                {/* Calendar Grid */}
                <div className="overflow-x-auto">
                  <table className="w-full text-center">
                    <thead>
                      <tr>
                        <th className="pb-2 text-[11px] font-bold text-slate-400 w-20"></th>
                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                          <th key={day} className="pb-2 text-[11px] font-bold text-slate-400">{day}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {/* Meals Logged Row */}
                      <tr>
                        <td className="py-2 text-[10px] font-semibold text-slate-500 text-left">Meals Logged</td>
                        {weekdayData.map((day, i) => {
                          const hasData = day.calories > 0;
                          const onTarget = hasData && day.calories >= calorieTarget * 0.9 && day.calories <= calorieTarget * 1.1;
                          const status = !hasData ? "none" : onTarget ? "on" : "partial";
                          return (
                            <td key={i} className="py-2">
                              <div className="flex flex-col items-center gap-1">
                                <div className={`h-6 w-6 rounded-full flex items-center justify-center ${status === 'on' ? 'bg-emerald-100' : status === 'partial' ? 'bg-orange-100' : 'bg-slate-100'}`}>
                                  {status === 'on' ? <Check className="h-3 w-3 text-emerald-600" strokeWidth={3} /> : status === 'partial' ? <div className="h-2 w-2 rounded-full bg-orange-400" /> : <div className="h-2 w-2 rounded-full bg-slate-300" />}
                                </div>
                                <span className="text-[9px] font-bold text-slate-600">{hasData ? day.calories.toLocaleString() : "—"}</span>
                                <span className="text-[8px] text-slate-400">kcal</span>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                      {/* Workouts Row */}
                      <tr>
                        <td className="py-2 text-[10px] font-semibold text-slate-500 text-left">Workouts</td>
                        {weekdayData.map((day, i) => (
                          <td key={i} className="py-2">
                            <div className="flex justify-center">
                              <div className={`h-6 w-6 rounded-full flex items-center justify-center ${day.hasWorkout ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                                {day.hasWorkout ? <Check className="h-3 w-3 text-emerald-600" strokeWidth={3} /> : <div className="h-2 w-2 rounded-full bg-slate-300" />}
                              </div>
                            </div>
                          </td>
                        ))}
                      </tr>
                      {/* Water Goal Row */}
                      <tr>
                        <td className="py-2 text-[10px] font-semibold text-slate-500 text-left">Water Goal</td>
                        {weekdayData.map((day, i) => (
                          <td key={i} className="py-2">
                            <div className="flex justify-center">
                              <div className={`h-6 w-6 rounded-full flex items-center justify-center ${day.waterGlasses >= 8 ? 'bg-blue-100' : 'bg-slate-100'}`}>
                                {day.waterGlasses >= 8 ? <Check className="h-3 w-3 text-blue-600" strokeWidth={3} /> : <div className="h-2 w-2 rounded-full bg-slate-300" />}
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
              <SectionHeader title="Nutrient Trends" />
              <div className="grid grid-cols-3 gap-2.5">
                {/* Calories Trend */}
                <article className="rounded-[16px] border border-slate-100 bg-white p-3 shadow-[0_8px_20px_rgba(15,23,42,0.05)]">
                  <p className="text-[10px] font-semibold text-slate-500 mb-1">Calories (avg)</p>
                  <p className="text-[24px] font-black tracking-[-0.04em] text-slate-900">
                    {weeklySummary?.calories.thisWeekAvg.toLocaleString() ?? "—"}<span className="text-[12px] font-semibold text-slate-400 ml-0.5">kcal</span>
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
                  <div className="flex items-center gap-1 text-[10px] font-bold mt-1" style={{ color: (weeklySummary?.calories.changePercent ?? 0) >= 0 ? "#059669" : "#EF4444" }}>
                    {(weeklySummary?.calories.changePercent ?? 0) >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                    {Math.abs(weeklySummary?.calories.changePercent ?? 0)}% vs last week
                  </div>
                </article>
                {/* Protein Trend */}
                <article className="rounded-[16px] border border-slate-100 bg-white p-3 shadow-[0_8px_20px_rgba(15,23,42,0.05)]">
                  <p className="text-[10px] font-semibold text-slate-500 mb-1">Protein (avg)</p>
                  <p className="text-[24px] font-black tracking-[-0.04em] text-slate-900">
                    {weeklySummary?.macros.protein.consumed ?? "—"}<span className="text-[12px] font-semibold text-slate-400 ml-0.5">g</span>
                  </p>
                  <svg className="w-full h-10 mt-2" viewBox="0 0 80 40" preserveAspectRatio="none">
                    <polyline
                      fill="none"
                      stroke="#3B82F6"
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
                  <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 mt-1">
                    <ArrowUp className="h-3 w-3" />
                    {weeklySummary?.macros.protein.percentage ?? 0}% of target
                  </div>
                </article>
                {/* Water Trend */}
                <article className="rounded-[16px] border border-slate-100 bg-white p-3 shadow-[0_8px_20px_rgba(15,23,42,0.05)]">
                  <p className="text-[10px] font-semibold text-slate-500 mb-1">Water (avg)</p>
                  <p className="text-[24px] font-black tracking-[-0.04em] text-slate-900">
                    {(() => {
                      const avg = weekdayData.length > 0
                        ? weekdayData.reduce((s, d) => s + d.waterGlasses, 0) / weekdayData.length
                        : 0;
                      return <>{avg.toFixed(1)}<span className="text-[12px] font-semibold text-slate-400 ml-0.5">Glasses</span></>;
                    })()}
                  </p>
                  <svg className="w-full h-10 mt-2" viewBox="0 0 80 40" preserveAspectRatio="none">
                    <polyline
                      fill="none"
                      stroke="#0EA5E9"
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
                  <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 mt-1">
                    <Check className="h-3 w-3" />
                    {weekdayData.filter(d => d.waterGlasses >= 8).length}/7 days hit goal
                  </div>
                </article>
              </div>
            </section>

            {/* This Week Highlights - 3 Separate Cards */}
            <section className="mb-5">
              <h3 className="text-[14px] font-black text-slate-800 mb-3">This Week Highlights</h3>
              <div className="grid grid-cols-3 gap-2.5">
                <article className="rounded-[16px] border border-slate-100 bg-white p-3 shadow-[0_8px_20px_rgba(15,23,42,0.05)] text-center">
                  <div className="grid h-10 w-10 mx-auto place-items-center rounded-full bg-amber-100 mb-2">
                    <Trophy className="h-5 w-5 text-amber-600" />
                  </div>
                  <p className="text-[10px] font-bold text-slate-700">Best Protein Day</p>
                  <p className="text-[9px] text-slate-500">
                    {(() => {
                      const best = weekdayData.reduce((a, b) => b.protein > a.protein ? b : a, weekdayData[0]);
                      return best?.dayLabel ?? "—";
                    })()}
                  </p>
                  <p className="text-[14px] font-black text-slate-900">
                    {(() => {
                      const max = Math.max(...weekdayData.map(d => d.protein));
                      return max > 0 ? `${max} g` : "—";
                    })()}
                  </p>
                </article>
                <article className="rounded-[16px] border border-slate-100 bg-white p-3 shadow-[0_8px_20px_rgba(15,23,42,0.05)] text-center">
                  <div className="grid h-10 w-10 mx-auto place-items-center rounded-full bg-orange-100 mb-2">
                    <Flame className="h-5 w-5 text-orange-500" />
                  </div>
                  <p className="text-[10px] font-bold text-slate-700">Highest Calories</p>
                  <p className="text-[9px] text-slate-500">
                    {(() => {
                      const best = weekdayData.reduce((a, b) => b.calories > a.calories ? b : a, weekdayData[0]);
                      return best?.dayLabel ?? "—";
                    })()}
                  </p>
                  <p className="text-[14px] font-black text-slate-900">
                    {(() => {
                      const max = Math.max(...weekdayData.map(d => d.calories));
                      return max > 0 ? `${max.toLocaleString()} kcal` : "—";
                    })()}
                  </p>
                </article>
                <article className="rounded-[16px] border border-slate-100 bg-white p-3 shadow-[0_8px_20px_rgba(15,23,42,0.05)] text-center">
                  <div className="grid h-10 w-10 mx-auto place-items-center rounded-full bg-blue-100 mb-2">
                    <Droplet className="h-5 w-5 text-blue-500" />
                  </div>
                  <p className="text-[10px] font-bold text-slate-700">Most Hydrated</p>
                  <p className="text-[9px] text-slate-500">
                    {(() => {
                      const best = weekdayData.reduce((a, b) => b.waterGlasses > a.waterGlasses ? b : a, weekdayData[0]);
                      return best?.dayLabel ?? "—";
                    })()}
                  </p>
                  <p className="text-[14px] font-black text-slate-900">
                    {(() => {
                      const max = Math.max(...weekdayData.map(d => d.waterGlasses));
                      return max > 0 ? `${max} Glasses` : "—";
                    })()}
                  </p>
                </article>
              </div>
            </section>

            {/* This Week vs Last Week */}
            <section className="mb-5">
              <article className="rounded-[18px] border border-slate-100 bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                <h3 className="text-[13px] font-black text-slate-800 mb-3">This Week vs Last Week</h3>
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Flame className="h-4 w-4" style={{ color: '#F97316' }} />
                      <span className="text-[11px] font-semibold text-slate-600">Calories</span>
                    </div>
                    <span className={`text-[11px] font-bold ${(weeklySummary?.calories.changePercent ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {(weeklySummary?.calories.changePercent ?? 0) >= 0 ? '+' : ''}{weeklySummary?.calories.changePercent ?? 0}% {(weeklySummary?.calories.trend === 'up' ? '↑' : weeklySummary?.calories.trend === 'down' ? '↓' : '→')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4" style={{ color: '#3B82F6' }} />
                      <span className="text-[11px] font-semibold text-slate-600">Protein</span>
                    </div>
                    <span className="text-[11px] font-bold text-emerald-600">
                      {weeklySummary?.macros.protein.percentage ?? 0}% of target
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Droplet className="h-4 w-4" style={{ color: '#0EA5E9' }} />
                      <span className="text-[11px] font-semibold text-slate-600">Water</span>
                    </div>
                    <span className="text-[11px] font-bold text-emerald-600">
                      {weekdayData.filter(d => d.waterGlasses >= 8).length}/7 days
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" style={{ color: '#10B981' }} />
                      <span className="text-[11px] font-semibold text-slate-600">Consistency</span>
                    </div>
                    <span className="text-[11px] font-bold text-emerald-600">
                      {weeklySummary?.consistency.percentage ?? 0}% {weeklySummary?.consistency.percentage >= 70 ? '↑' : '→'}
                    </span>
                  </div>
                </div>
              </article>
            </section>

            {/* Habit Consistency & Goal Progress */}
            <section className="mb-5">
              <div className="grid grid-cols-2 gap-3">
                <article className="rounded-[18px] border border-slate-100 bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                  <h3 className="text-[13px] font-black text-slate-800 mb-3">Habit Consistency</h3>
                  <div className="space-y-3">
                    {(() => {
                      const waterDays = weekdayData.filter(d => d.waterGlasses > 0).length;
                      const workoutDays = weekdayData.filter(d => d.hasWorkout).length;
                      const habits = [
                        { label: 'Meal Logging', days: weeklySummary?.consistency.daysLogged ?? 0, pct: weeklySummary?.consistency.percentage ?? 0, color: '#10B981' },
                        { label: 'Water Tracking', days: waterDays, pct: Math.round((waterDays / 7) * 100), color: '#0EA5E9' },
                        { label: 'Workouts', days: workoutDays, pct: Math.round((workoutDays / 7) * 100), color: '#8B5CF6' },
                      ];
                      return habits.map((habit) => (
                        <div key={habit.label}>
                          <div className="flex justify-between text-[10px] mb-1">
                            <span className="font-semibold text-slate-600">{habit.label}</span>
                            <span className="font-bold text-slate-500">{habit.days}/7 days</span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-100">
                            <div className="h-full rounded-full" style={{ width: `${habit.pct}%`, backgroundColor: habit.color }} />
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </article>
                <article className="rounded-[18px] border border-slate-100 bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                  <h3 className="text-[13px] font-black text-slate-800 mb-2">Weekly Goal Progress</h3>
                  {(() => {
                    const calOnTarget = weeklySummary && Math.abs(weeklySummary.calories.thisWeekAvg - (activeGoal?.daily_calorie_target ?? 2000)) <= 200;
                    const proteinOnTarget = (weeklySummary?.macros.protein.percentage ?? 0) >= 80;
                    const waterOnTarget = weekdayData.filter(d => d.waterGlasses >= 8).length >= 4;
                    const activityOnTarget = weekdayData.filter(d => d.hasWorkout).length >= 3;
                    const goals = [
                      { label: 'Calories Goal', done: calOnTarget },
                      { label: 'Protein Goal', done: proteinOnTarget },
                      { label: 'Water Goal', done: waterOnTarget },
                      { label: 'Activity Goal', done: activityOnTarget },
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
                            <circle cx="48" cy="48" r="40" fill="none" stroke="#10B981" strokeLinecap="round" strokeWidth="6" strokeDasharray={`${dash.toFixed(1)} ${(circumference - dash).toFixed(1)}`} />
                          </svg>
                          <div className="text-center">
                            <span className="text-[22px] font-black text-slate-900">{goalPct}%</span>
                            <p className="text-[9px] font-semibold text-slate-500">Completed</p>
                          </div>
                        </div>
                        <div className="mt-3 space-y-1.5">
                          {goals.map((goal) => (
                            <div key={goal.label} className="flex items-center justify-between text-[10px]">
                              <span className="font-semibold text-slate-600">{goal.label}</span>
                              <div className={`grid h-5 w-5 place-items-center rounded-full ${goal.done ? 'bg-emerald-100 text-emerald-600' : 'border border-slate-200 text-slate-300'}`}>
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
          </>
        )}

        {activeTab === "goals" && (
          <>
            <section className="mb-6">
              <SectionHeader title="Goal Focus" />
              <article className="relative overflow-hidden rounded-[28px] bg-[radial-gradient(140%_140%_at_70%_-10%,rgba(255,193,120,0.18)_0%,transparent_55%),radial-gradient(130%_130%_at_-20%_80%,rgba(16,185,129,0.25)_0%,transparent_50%),linear-gradient(145deg,#0D5C54_0%,#0A6D58_35%,#096650_70%,#074A44_100%)] text-white shadow-[0_24px_56px_rgba(7,74,68,0.35)]">
                <div className="pointer-events-none absolute inset-0 opacity-[0.12] mix-blend-soft-light [background-image:radial-gradient(circle_at_18%_20%,white_1.5px,transparent_2px),radial-gradient(circle_at_72%_28%,white_1px,transparent_1.5px),radial-gradient(circle_at_40%_52%,white_1.2px,transparent_1.8px),radial-gradient(circle_at_88%_18%,white_1px,transparent_1px),radial-gradient(circle_at_10%_75%,white_1px,transparent_1px)]" />
                <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-amber-400/8 blur-3xl" />
                <div className="pointer-events-none absolute -left-8 -bottom-8 h-36 w-36 rounded-full bg-emerald-300/8 blur-3xl" />

                <div className="relative z-10 p-5">
                  {/* Header row: icon, title, change goal button */}
                  <div className="flex items-start gap-3 mb-5">
                    <div className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-2xl bg-white/12 shadow-inner shadow-white/5">
                      {(() => { const GI = goalTypeIcon[goalType] ?? Leaf; return <GI className="h-[22px] w-[22px] text-white" strokeWidth={2.2} />; })()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="text-[20px] font-black tracking-[-0.04em] text-white leading-tight">{goalName}</h3>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${goalType === "weight_loss" ? "bg-amber-400/20 text-amber-300" : goalType === "muscle_gain" ? "bg-blue-400/20 text-blue-300" : "bg-emerald-400/20 text-emerald-300"}`}>
                          Active
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowGoalPicker((v) => !v)}
                      className={`shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 ${showGoalPicker ? "border-white/40 bg-white/15 text-white" : "border-white/20 bg-white/8 text-white/70 hover:bg-white/14 hover:border-white/30"}`}
                    >
                      Change Goal
                    </button>
                  </div>

                  {/* Goal picker — inline pills */}
                  {showGoalPicker && (
                    <div className="mb-5 flex flex-wrap gap-1.5">
                      {Object.entries(goalTypeLabel).map(([key, label]) => {
                        const Icon = goalTypeIcon[key] ?? Leaf;
                        const isActive = goalType === key;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => handleGoalChange(key)}
                            className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[11px] font-extrabold transition-all duration-200 active:scale-95 ${isActive ? "bg-white text-emerald-700 shadow-lg shadow-black/10 scale-105" : "bg-white/8 text-white/70 hover:bg-white/14"}`}
                          >
                            <Icon className="h-3.5 w-3.5" strokeWidth={isActive ? 2.5 : 1.8} />
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Goal progress ring */}
                  {goalWeight > 0 || goalType !== "weight_loss" ? (
                    <div className="flex items-center gap-5">
                      <div className="relative grid h-[100px] w-[100px] shrink-0 place-items-center">
                        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
                          <defs>
                            <linearGradient id="progGlow" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="rgba(255,255,255,0.95)" />
                              <stop offset="50%" stopColor="rgba(255,255,255,0.85)" />
                              <stop offset="100%" stopColor="rgba(255,255,255,0.6)" />
                            </linearGradient>
                          </defs>
                          <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="5" />
                          <circle cx="50" cy="50" r="40" fill="none" stroke="url(#progGlow)" strokeLinecap="round" strokeWidth="5" strokeDasharray={`${(goalRingValue / 100) * 251.3} 251.3`} className="animate-pulse" />
                        </svg>
                        <div className="text-center">
                          <span className="block text-[24px] font-black leading-none tracking-[-0.06em] text-white">{goalRingValue}<span className="text-[12px] font-bold">%</span></span>
                          <span className="block text-[9px] font-bold text-white/50 mt-0.5">{goalRingLabel}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => { setShowWeightInput(!showWeightInput); setNewWeight(String(currentWeight)); }}
                        className="flex-1 min-w-0 text-left active:scale-[0.98] transition-transform"
                      >
                        <p className="text-[10px] font-extrabold uppercase tracking-widest text-white/40 mb-1">{goalRightMetric.label}</p>
                        <div className="flex items-baseline gap-1">
                          <span className="text-[36px] font-black leading-none tracking-[-0.06em] text-white">{goalRightMetric.value}</span>
                          <span className="text-[12px] font-bold text-white/40">{goalRightMetric.unit}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[13px] font-extrabold ${goalType === "weight_loss" ? "text-amber-300" : goalType === "muscle_gain" ? "text-blue-300" : "text-emerald-300"}`}>
                            {goalSubLabel}
                          </span>
                          <div className="flex-1 h-1 overflow-hidden rounded-full bg-white/10">
                            <div className="h-full rounded-full bg-gradient-to-r from-amber-300/80 to-white/60" style={{ width: `${goalRingValue}%` }} />
                          </div>
                        </div>
                      </button>
                    </div>
                  ) : goalType === "weight_loss" || goalType === "muscle_gain" ? (
                    <div className="mb-2 py-4 text-center">
                      <p className="text-[14px] font-bold text-white/70 mb-2">Set a target weight to track progress</p>
                      <button
                        type="button"
                        onClick={() => setShowWeightInput(true)}
                        className="inline-flex items-center gap-2 rounded-full bg-white/12 px-4 py-2 text-[12px] font-black text-white hover:bg-white/20 transition-colors"
                      >
                        <Plus className="h-4 w-4" />
                        Set Weight Goal
                      </button>
                    </div>
                  ) : null}

                  {/* Macro river — horizontal flowing pills */}
                  <div className="mt-5 pt-4 border-t border-white/8">
                    <p className="text-[9px] font-extrabold uppercase tracking-[0.15em] text-white/30 mb-2.5">Daily Targets</p>
                    <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
                      {[
                        { label: "Calories", value: activeGoal?.daily_calorie_target ?? 2000, unit: "kcal", color: "border-l-amber-400 bg-amber-400/10" },
                        { label: "Protein", value: activeGoal?.protein_target_g ?? 120, unit: "g", color: "border-l-blue-400 bg-blue-400/10" },
                        { label: "Carbs", value: activeGoal?.carbs_target_g ?? 250, unit: "g", color: "border-l-orange-400 bg-orange-400/10" },
                        { label: "Fat", value: activeGoal?.fat_target_g ?? 65, unit: "g", color: "border-l-purple-400 bg-purple-400/10" },
                        { label: "Fiber", value: activeGoal?.fiber_target_g ?? 25, unit: "g", color: "border-l-emerald-400 bg-emerald-400/10" },
                      ].map((m) => (
                        <div key={m.label} className={`flex items-center gap-2 shrink-0 rounded-[12px] border-l-2 ${m.color} px-3 py-2 backdrop-blur-sm`}>
                          <span className="text-[15px] font-black leading-none text-white">{m.value.toLocaleString()}</span>
                          <div className="text-right">
                            <span className="block text-[8px] font-bold text-white/40">{m.unit}</span>
                            <span className="block text-[9px] font-extrabold text-white/50">{m.label}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </article>
            </section>

        {showWeightInput && (
          <div className="mb-5 rounded-[18px] bg-white/95 backdrop-blur-lg border border-slate-200 p-4 shadow-[0_10px_24px_rgba(0,0,0,0.06)]">
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

        </>
        )}

        {coachProposals.length > 0 && (
        <section className="mb-5">
          <SectionHeader title="Coach Goals" />
          <div className="space-y-3">
            {coachProposals.map((proposal) => {
              const prog = coachGoalProgress.find((p) => p.proposalId === proposal.id);
              const goalTypeDisplay: Record<string, string> = {
                weight_target: "Weight Target",
                calorie_target: "Calorie Target",
                macro_target: "Macro Target",
                meal_adherence: "Meal Adherence",
                workout_frequency: "Workout Frequency",
                streak_target: "Streak Target",
              };
              const goalIcon: Record<string, LucideIcon> = {
                weight_target: Scale,
                calorie_target: Flame,
                macro_target: Target,
                meal_adherence: Leaf,
                workout_frequency: Dumbbell,
                streak_target: CalendarCheck,
              };
              const Icon = goalIcon[proposal.goal_type] ?? Target;
              const isProposed = proposal.status === "proposed";

              return (
                <article
                  key={proposal.id}
                  className={`overflow-hidden rounded-[20px] border bg-white shadow-[0_16px_34px_rgba(15,23,42,0.06)] ${
                    isProposed ? "border-amber-200" : "border-emerald-200"
                  }`}
                >
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${
                        isProposed
                          ? "bg-amber-100 text-amber-600"
                          : "bg-emerald-100 text-emerald-600"
                      }`}>
                        <Icon className="h-5 w-5" strokeWidth={2.2} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-[15px] font-black tracking-[-0.03em] text-slate-900">
                            {goalTypeDisplay[proposal.goal_type] ?? proposal.goal_type}
                          </h4>
                          <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                            isProposed
                              ? "bg-amber-100 text-amber-700"
                              : "bg-emerald-100 text-emerald-700"
                          }`}>
                            {isProposed ? "NEW" : "ACTIVE"}
                          </span>
                        </div>
                        <p className="text-[11px] font-medium text-slate-500">
                          From {proposal.coach_name}
                          {proposal.deadline && prog?.daysRemaining != null && (
                            <> · {prog.daysRemaining} days left</>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center gap-3">
                      <div className="rounded-[12px] bg-slate-50 px-3 py-2 text-center">
                        <p className="text-[18px] font-black text-slate-900">{prog?.currentValue ?? "—"}</p>
                        <p className="text-[9px] font-bold text-slate-400">CURRENT</p>
                      </div>
                      <div className="flex-1">
                        <div className="h-2 rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              isProposed ? "bg-amber-400" : "bg-gradient-to-r from-emerald-400 to-emerald-600"
                            }`}
                            style={{ width: `${prog?.progressPct ?? 0}%` }}
                          />
                        </div>
                      </div>
                      <div className="rounded-[12px] bg-emerald-50 px-3 py-2 text-center">
                        <p className="text-[18px] font-black text-emerald-700">{proposal.target_value}</p>
                        <p className="text-[9px] font-bold text-emerald-400">TARGET</p>
                      </div>
                    </div>

                    {prog && (
                      <p className="mt-2 text-[11px] font-semibold text-slate-500">
                        {prog.progressPct}% of goal reached · {prog.unit}
                      </p>
                    )}

                    {proposal.notes && (
                      <p className="mt-2 text-[12px] text-slate-600 italic">"{proposal.notes}"</p>
                    )}

                    {isProposed && (
                      <div className="mt-4 flex gap-2">
                        <button
                          type="button"
                          onClick={() => acceptCoachGoal(proposal.id)}
                          className="flex-1 h-11 rounded-[12px] bg-emerald-600 text-[13px] font-bold text-white active:scale-95 transition-all hover:bg-emerald-700"
                        >
                          Accept Goal
                        </button>
                        <button
                          type="button"
                          onClick={() => rejectCoachGoal(proposal.id)}
                          className="h-11 rounded-[12px] bg-slate-100 px-5 text-[13px] font-bold text-slate-500 active:scale-95 transition-all hover:bg-slate-200"
                        >
                          Decline
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
        )}

        {activeTab === "week" && (
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
        )}

        {activeTab === "today" && (
        <section className="mb-5">
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
                  <p className="mt-1 text-[24px] font-black tracking-[-0.06em]">{activeGoal?.target_weight_kg ? `${goalWeight}` : "—"}<span className="ml-1 text-[12px] font-bold">kg</span></p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-500">BMI</p>
                  <p className="mt-1 text-[24px] font-black tracking-[-0.06em]">{bmi}</p>
                  <p className="text-[11px] font-extrabold text-[#00A86B]">{bmiLabel}</p>
                </div>
              </div>
            </div>
            {activeGoal?.target_weight_kg && (
            <div className="mt-5 h-2 rounded-full bg-slate-100">
              <div className="relative h-full rounded-full bg-gradient-to-r from-emerald-200 to-emerald-500" style={{ width: `${progressPct}%` }}>
                <span className="absolute right-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full bg-emerald-500 shadow" />
              </div>
            </div>
            )}
          </article>
        </section>
        )}


      </div>
    </main>
  );
}
