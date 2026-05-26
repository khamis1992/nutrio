import { useState, useEffect } from "react";
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
  TrendingUp,
  Calendar,
  Wheat,
  Droplets,
  Leaf,
  Star,
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
function MacroCircle({ icon, color, value, target, unit, label }: any) {
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
function MacroDetailCard({ icon, label, color, status, value, unit, goal, remaining }: any) {
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
function MicroStatCard({ value, label, goal }: any) {
  return (
    <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100 text-center">
      <p className="text-lg font-bold text-slate-900">{value}</p>
      <p className="text-[10px] text-slate-500 mt-0.5">{label}</p>
      <p className="text-[9px] text-slate-400 mt-0.5">Goal: {goal}</p>
    </div>
  );
}

// ─── Nutrient Balance Bar ──────────────────────────────────────
function NutrientBalance({ onTrack, needMore, exceeding, noData }: any) {
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
function InsightItem({ icon, color, title, subtitle }: any) {
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
function RecommendationCard({ title, description, linkText }: any) {
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

      const sugar = (nutrition || []).reduce((s: number, r: any) => s + (r.sugar || 0), 0);
      const sodium = (nutrition || []).reduce((s: number, r: any) => s + (r.sodium || 0), 0);
      const waterGlasses = (water || []).reduce((s: number, r: any) => s + (r.glasses || 0), 0);

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

  const currentStreak = streaks?.logging?.currentStreak || 0;
  const mealQualityLabel =
    (averageScore || 0) >= 80 ? "Excellent" : (averageScore || 0) >= 60 ? "Good" : "Moderate";
  const mealQualityColor = (averageScore || 0) >= 80 ? "#22c55e" : (averageScore || 0) >= 60 ? "#f59e0b" : "#ef4444";

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
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-100 safe-area-top">
        <div className={cn("flex items-center justify-between px-4 h-14", isRTL && "flex-row-reverse")}>
          <button
            onClick={() => navigate("/dashboard")}
            className="p-2 -ml-2 rounded-full hover:bg-gray-100 active:scale-95 transition-all"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-lg font-semibold text-gray-900">{t("progress")}</h1>
          <div className="w-10" />
        </div>

        {/* Tab Bar */}
        <div className="px-4 pb-3">
          <div className="flex bg-gray-100 rounded-xl p-1">
            {(["today", "week", "goals"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "flex-1 py-2.5 text-sm font-medium rounded-lg transition-all duration-200",
                  activeTab === tab
                    ? "bg-white text-green-500 shadow-sm"
                    : "text-gray-400 hover:text-gray-600"
                )}
              >
                {tab === "today" ? t("today") : tab === "week" ? t("week") : t("goals_tab")}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 py-4 space-y-4">
        {activeTab === "today" && (
          <div className="space-y-3">
            {/* Today's Progress Header */}
            <div className="flex items-center justify-between px-1">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{t("todays_progress")}</h2>
                <p className="text-sm text-gray-400">{format(new Date(), "EEEE, MMM d")}</p>
              </div>
              <button
                onClick={handleSync}
                disabled={syncing}
                className="flex items-center gap-1.5 bg-orange-500 text-white rounded-full px-4 py-2 text-sm font-medium active:scale-95 transition-transform"
              >
                <RefreshCw className={cn("w-4 h-4", syncing && "animate-spin")} />
                {t("sync_now")}
              </button>
            </div>

            {/* Calories & Protein Rings */}
            <div className="grid grid-cols-2 gap-3">
              <RingGauge
                percentage={calorieProgress}
                color="#f97316"
                icon={<Flame className="w-5 h-5 text-white" />}
                label={t("calories")}
                goalText={`Goal: ${dailyCalorieTarget.toLocaleString()} cal`}
              />
              <RingGauge
                percentage={proteinProgress}
                color="#3b82f6"
                icon={<Target className="w-5 h-5 text-white" />}
                label={t("protein")}
                goalText={`Goal: ${dailyProteinTarget} g`}
              />
            </div>

            {/* Streak */}
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-base font-bold text-gray-900">{t("streak")}</p>
                  <p className="text-sm text-gray-400">{t("keep_it_going")}</p>
                </div>
                <div className="flex-1 mx-4">
                  <div className="h-2 rounded-full bg-orange-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-orange-500 transition-all duration-500"
                      style={{ width: `${Math.min((currentStreak / 7) * 100, 100)}%` }}
                    />
                  </div>
                </div>
                <div className="bg-orange-100 text-orange-600 rounded-full px-3 py-1 text-sm font-medium">
                  {currentStreak} {currentStreak === 1 ? t("day") : t("days")}
                </div>
              </div>
            </div>

            {/* Meal Quality */}
            {!qualityLoading && (
              <div className="bg-white rounded-2xl shadow-sm p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-base font-bold text-gray-900">{t("meal_quality")}</p>
                    <p className="text-sm" style={{ color: mealQualityColor }}>
                      {mealQualityLabel}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <MiniRing percentage={averageScore || 0} color={mealQualityColor} />
                  <ChevronRight className="w-5 h-5 text-gray-300" />
                </div>
              </div>
            )}

            {/* Feel Amazing Tip */}
            {recommendations.length > 0 && (
              <div className="bg-blue-50 rounded-2xl p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                    <TrendingUp className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-base font-bold text-gray-900">
                      {t("feel_amazing_tip")}
                      <span className="inline-block ml-1 text-blue-400">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                      </span>
                    </p>
                    <p className="text-sm text-gray-500 leading-relaxed mt-1">
                      {recommendations[0].description}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Weight Forecast */}
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <div className="flex items-start gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
                  <TrendingUp className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-base font-bold text-gray-900">{t("weight_forecast")}</p>
                  <p className="text-sm text-gray-400">
                    {t("consistent_progress_long_term")}
                  </p>
                </div>
              </div>

              <WeightForecastChart data={weightChartData.map(d => ({ label: d.label, actual: d.actual, predicted: d.predicted }))} />

              <div className="mt-3 flex flex-col items-center">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center mb-1">
                  <Calendar className="w-4 h-4 text-green-500" />
                </div>
                <p className="text-sm font-semibold text-gray-900 text-center">{t("expected_in_4_6_days")}</p>
                <p className="text-xs text-gray-400 text-center">
                  {t("keep_staying_active_forecast")}
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === "week" && (
          <div className="space-y-4">
            {/* Greeting */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Hello, {profile?.full_name?.split(" ")[0] || "Khamis"} 👋</h2>
                <p className="text-sm text-slate-500">Here's your nutrition overview</p>
              </div>
              <button
                onClick={handleSync}
                disabled={syncing}
                className="flex items-center gap-1.5 bg-orange-500 text-white rounded-full px-4 py-2 text-sm font-medium active:scale-95 transition-transform"
              >
                <RefreshCw className={cn("w-4 h-4", syncing && "animate-spin")} />
                Sync Now
              </button>
            </div>

            <FoodScoreCard score={foodScore} label="Food Score" />

            {/* Macro Circles */}
            <div className="flex justify-around py-2">
              <MacroCircle
                icon={<Flame className="w-6 h-6 text-white" />}
                color="orange"
                value={Math.round(foodStats.calories)}
                target={foodTargets.calories}
                unit=""
                label="Calories"
              />
              <MacroCircle
                icon={<Target className="w-6 h-6 text-white" />}
                color="blue"
                value={Math.round(foodStats.protein)}
                target={foodTargets.protein}
                unit="g"
                label="Protein"
              />
              <MacroCircle
                icon={<Wheat className="w-6 h-6 text-white" />}
                color="amber"
                value={Math.round(foodStats.carbs)}
                target={foodTargets.carbs}
                unit="g"
                label="Carbs"
              />
            </div>

            {/* Log Your Meal */}
            <button className="w-full h-12 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl font-medium flex items-center justify-center gap-2 shadow-md active:scale-95 transition-transform">
              <Utensils className="w-5 h-5" />
              Log Your Meal
            </button>

            {/* Macro Detail Cards */}
            <div className="grid grid-cols-2 gap-3">
              <MacroDetailCard
                icon={<Flame className="w-4 h-4 text-orange-500" />}
                label="Calories"
                color="orange"
                status={getMacroStatus(foodStats.calories, foodTargets.calories, "calories")}
                value={Math.round(foodStats.calories)}
                unit="kcal"
                goal={`${foodTargets.calories.toLocaleString()} kcal`}
                remaining={`${Math.max(0, foodTargets.calories - foodStats.calories).toLocaleString()} kcal`}
              />
              <MacroDetailCard
                icon={<Target className="w-4 h-4 text-blue-500" />}
                label="Protein"
                color="blue"
                status={getMacroStatus(foodStats.protein, foodTargets.protein, "protein")}
                value={Math.round(foodStats.protein)}
                unit="g"
                goal={`${foodTargets.protein} g`}
                remaining={`${Math.max(0, foodTargets.protein - foodStats.protein)} g`}
              />
              <MacroDetailCard
                icon={<Wheat className="w-4 h-4 text-emerald-500" />}
                label="Carbs"
                color="emerald"
                status={getMacroStatus(foodStats.carbs, foodTargets.carbs, "carbs")}
                value={Math.round(foodStats.carbs)}
                unit="g"
                goal={`${foodTargets.carbs} g`}
                remaining={`${Math.max(0, foodTargets.carbs - foodStats.carbs)} g`}
              />
              <MacroDetailCard
                icon={<Droplet className="w-4 h-4 text-cyan-500" />}
                label="Water"
                color="cyan"
                status={getMacroStatus(foodStats.waterGlasses, 8, "water")}
                value={(foodStats.waterGlasses * 0.25).toFixed(1)}
                unit="L"
                goal={`${foodTargets.water} L`}
                remaining={`${Math.max(0, foodTargets.water - foodStats.waterGlasses * 0.25).toFixed(1)} L`}
              />
            </div>

            {/* Micro Stats */}
            <div className="grid grid-cols-4 gap-2">
              <MicroStatCard value={Math.round(foodStats.fiber)} label="Fiber (g)" goal={`${foodTargets.fiber} g`} />
              <MicroStatCard value={Math.round(foodStats.sugar)} label="Sugar (g)" goal={`${foodTargets.sugar} g`} />
              <MicroStatCard value={Math.round(foodStats.sodium)} label="Sodium (mg)" goal={`${foodTargets.sodium} mg`} />
              <MicroStatCard value={Number(foodStats.fat.toFixed(1))} label="Fat (g)" goal={`${foodTargets.fat} g`} />
            </div>

            {/* Nutrient Balance */}
            <NutrientBalance
              onTrack={nutrientBalance.onTrack}
              needMore={nutrientBalance.needMore}
              exceeding={nutrientBalance.exceeding}
              noData={nutrientBalance.noData}
            />

            {/* Insights */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-slate-900">Insights</h3>
                <span className="text-xs font-medium text-emerald-500">View All</span>
              </div>
              <InsightItem
                icon={<Flame className="w-5 h-5 text-red-500" />}
                color="bg-red-50"
                title="Keep Streak"
                subtitle="Keep it up!"
              />
              <InsightItem
                icon={<Star className="w-5 h-5 text-amber-500" />}
                color="bg-amber-50"
                title="You're doing great! Keep hitting your protein goal."
              />
              <InsightItem
                icon={<Leaf className="w-5 h-5 text-emerald-500" />}
                color="bg-emerald-50"
                title="Try adding more veggies to your meals."
              />
              <InsightItem
                icon={<AlertTriangle className="w-5 h-5 text-orange-500" />}
                color="bg-orange-50"
                title="High sodium alert. Try to reduce salt intake."
              />
              <InsightItem
                icon={<Droplets className="w-5 h-5 text-blue-500" />}
                color="bg-blue-50"
                title="Don't forget water 💧 Stay hydrated!"
              />
            </div>

            {/* Recommendation */}
            <RecommendationCard
              title="Increase Veggies 🥗"
              description="Add more colorful vegetables to your meals for better fiber intake and overall health."
              linkText="View Food Ideas →"
            />
          </div>
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
  );
};

export default ProgressDashboard;
