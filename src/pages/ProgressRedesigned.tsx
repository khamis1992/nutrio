import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { LogMealDialog } from "@/components/LogMealDialog";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Flame,
  Droplets,
  Target,
  TrendingUp,
  ChevronRight,
  Utensils,
  Scale,
  Trophy,
  Zap,
  Activity,
  TrendingDown,
  Minus,
  Plus,
  Award,
  Sparkles,
  Loader2,
  X,
  ChevronDown,
  ChevronUp,
  ThumbsUp,
  ThumbsDown,
  History,
  ShieldAlert,
  CheckCheck,
} from "lucide-react";
import { format, subDays } from "date-fns";
import { CustomerNavigation } from "@/components/CustomerNavigation";
import { cn } from "@/lib/utils";
import type { WeeklyReportData } from "@/lib/professional-weekly-report-pdf";
import { nutrioReportPDF } from "@/lib/nutrio-report-pdf";
import { generateWeeklyMealPlan, loadMealPlanImages } from "@/lib/meal-plan-generator";

// Hooks
import { useWeeklySummary } from "@/hooks/useWeeklySummary";
import { useWaterIntake } from "@/hooks/useWaterIntake";
import { useStreak } from "@/hooks/useStreak";

import { useNutritionGoals } from "@/hooks/useNutritionGoals";
import { useMealQuality } from "@/hooks/useMealQuality";
import { WeightPredictionChart } from "@/components/WeightPredictionChart";

import { useSmartRecommendations } from "@/hooks/useSmartRecommendations";
import { useSmartAdjustments, type AdjustmentSuggestion } from "@/hooks/useSmartAdjustments";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProfessionalWeeklyReport } from "@/components/progress/ProfessionalWeeklyReport";
import { useLanguage } from "@/contexts/LanguageContext";
import { calculateBMR, calculateTDEE, calculateTargetCalories, calculateMacros } from "@/lib/nutrition-calculator";



const ProgressDashboard = () => {
  const { t, isRTL } = useLanguage();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile();
  const [logMealOpen, setLogMealOpen] = useState(false);
  const [weightChartData, setWeightChartData] = useState<Array<{
    date: string;
    label: string;
    actual: number | null;
    predicted: number | null;
    lower: number | null;
    upper: number | null;
  }>>([]);

  // Build weight chart data from real logs + local linear-regression forecast
  useEffect(() => {
    if (!user?.id) return;

    const buildChart = async () => {
      const since = new Date();
      since.setDate(since.getDate() - 60);
      const sinceStr = since.toISOString().split("T")[0];

      // Pull from BOTH tables in parallel
      const [{ data: bodyLogs }, { data: progressLogs }] = await Promise.all([
        supabase
          .from("body_measurements")
          .select("log_date, weight_kg")
          .eq("user_id", user.id)
          .not("weight_kg", "is", null)
          .gte("log_date", sinceStr)
          .order("log_date", { ascending: true }),
        supabase
          .from("progress_logs")
          .select("log_date, weight_kg")
          .eq("user_id", user.id)
          .not("weight_kg", "is", null)
          .gte("log_date", sinceStr)
          .order("log_date", { ascending: true }),
      ]);

      // Merge by date — body_measurements takes priority
      const byDate = new Map<string, number>();
      for (const row of (progressLogs || [])) {
        if (row.weight_kg > 0) byDate.set(row.log_date, Number(row.weight_kg));
      }
      for (const row of (bodyLogs || [])) {
        if (row.weight_kg > 0) byDate.set(row.log_date, Number(row.weight_kg));
      }

      const sortedLogs = Array.from(byDate.entries())
        .sort(([a], [b]) => a.localeCompare(b));

      if (sortedLogs.length === 0) return; // nothing to show

      // Linear regression over logged points
      const ys = sortedLogs.map(([, w]) => w);
      const n = ys.length;
      const xs = ys.map((_, i) => i);
      const xMean = xs.reduce((a, b) => a + b, 0) / n;
      const yMean = ys.reduce((a, b) => a + b, 0) / n;
      const xSS = xs.reduce((a, x) => a + (x - xMean) ** 2, 0);
      const slope = xSS === 0 ? 0 :
        xs.reduce((acc, x, i) => acc + (x - xMean) * (ys[i] - yMean), 0) / xSS;
      const residuals = ys.map((y, i) => Math.abs(y - (yMean + slope * (i - xMean))));
      const stdErr = Math.max(0.2, Math.sqrt(residuals.reduce((a, b) => a + b * b, 0) / n));
      const lastWeight = ys[n - 1];

      // Historical points
      const history = sortedLogs.map(([date, w]) => ({
        date,
        label: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        actual: w,
        predicted: null,
        lower: null,
        upper: null,
      }));

      // 4-week future predictions
      const future = [7, 14, 21, 28].map((days) => {
        const pw = Math.round((lastWeight + slope * days) * 10) / 10;
        const d = new Date();
        d.setDate(d.getDate() + days);
        return {
          date: d.toISOString().split("T")[0],
          label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          actual: null,
          predicted: pw,
          lower: Math.round((pw - stdErr * 1.5) * 10) / 10,
          upper: Math.round((pw + stdErr * 1.5) * 10) / 10,
        };
      });

      setWeightChartData([...history, ...future]);
    };

    buildChart();
  }, [user?.id]);

  // Keep predictions compatible with WeightPredictionChart prop
  const predictions = weightChartData
    .filter(d => d.predicted !== null)
    .map(d => ({
      date: d.date,
      predicted_weight: d.predicted!,
      confidence_lower: d.lower!,
      confidence_upper: d.upper!,
    }));
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"today" | "week" | "goals">("today");

  // Data hooks
  const { summary: weeklySummary } = useWeeklySummary(user?.id);
  const { dailySummary: waterSummary, loading: waterLoading, addWater } = useWaterIntake(user?.id);
  const { streaks } = useStreak(user?.id);
  const { activeGoal, milestones, updateGoalTargets, setGoal, refresh: refreshGoals } = useNutritionGoals(user?.id);
  const { averageScore, loading: qualityLoading } = useMealQuality(user?.id);

  const { recommendations } = useSmartRecommendations(user?.id);
  const [dailyData, setDailyData] = useState<WeeklyReportData['dailyData']>([]);
  const [generatingReport, setGeneratingReport] = useState(false);

  // Get today's nutrition data
  const today = new Date().toISOString().split('T')[0];
  const [todayStats, setTodayStats] = useState({ calories: 0, protein: 0 });
  const [todayBurned, setTodayBurned] = useState(0);
  const [weeklyBurned, setWeeklyBurned] = useState(0);
  
  useEffect(() => {
    if (!user) return;
    
    const fetchTodayStats = async () => {
      const { data } = await supabase
        .from('progress_logs')
        .select('calories_consumed, protein_consumed_g')
        .eq('user_id', user.id)
        .eq('log_date', today)
        .maybeSingle();
      
      if (data) {
        setTodayStats({
          calories: data.calories_consumed || 0,
          protein: data.protein_consumed_g || 0
        });
      }
    };
    
    const fetchBurnedCalories = async () => {
      const { data } = await supabase
        .from('workout_sessions')
        .select('calories_burned')
        .eq('user_id', user.id)
        .eq('session_date', today);
      if (data) {
        setTodayBurned(data.reduce((sum, s) => sum + (s.calories_burned ?? 0), 0));
      }
    };

    const fetchWeeklyBurned = async () => {
      const weekStart = subDays(new Date(), 7).toISOString().split('T')[0];
      const { data } = await supabase
        .from('workout_sessions')
        .select('calories_burned')
        .eq('user_id', user.id)
        .gte('session_date', weekStart)
        .lte('session_date', today);
      if (data) {
        setWeeklyBurned(data.reduce((sum, s) => sum + (s.calories_burned ?? 0), 0));
      }
    };
    
    fetchTodayStats();
    fetchBurnedCalories();
    fetchWeeklyBurned();
  }, [user, today]);

  // Fetch daily data for weekly report
  useEffect(() => {
    if (!user) return;

    const fetchDailyData = async () => {
      const weekEnd = new Date();
      const weekStart = subDays(weekEnd, 7);

      const { data: dailyLogs } = await supabase
        .from('progress_logs')
        .select('log_date, calories_consumed, protein_consumed_g, carbs_consumed_g, fat_consumed_g, weight_kg')
        .eq('user_id', user.id)
        .gte('log_date', weekStart.toISOString().split('T')[0])
        .lte('log_date', weekEnd.toISOString().split('T')[0])
        .order('log_date');

      const { data: waterLogs } = await (supabase as any)
        .from('water_intake')
        .select('log_date, glasses')
        .eq('user_id', user.id)
        .gte('log_date', weekStart.toISOString().split('T')[0])
        .lte('log_date', weekEnd.toISOString().split('T')[0]);

      const data: WeeklyReportData['dailyData'] = [];
      for (let i = 0; i < 7; i++) {
        const date = subDays(weekEnd, i);
        const dateStr = date.toISOString().split('T')[0];
        const log = dailyLogs?.find((l: any) => l.log_date === dateStr);
        const waterLog = waterLogs?.find((w: any) => w.log_date === dateStr);
        
        data.unshift({
          date: dateStr,
          calories: log?.calories_consumed || 0,
          protein: log?.protein_consumed_g || 0,
          carbs: log?.carbs_consumed_g || 0,
          fat: log?.fat_consumed_g || 0,
          weight: log?.weight_kg || null,
          water: waterLog?.glasses || 0,
        });
      }
      setDailyData(data);
    };

    fetchDailyData();
  }, [user]);

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
  const bmiLabelValue = bmiValue === null ? null
    : bmiValue < 18.5 ? "Underweight"
    : bmiValue < 25   ? "Normal"
    : bmiValue < 30   ? "Overweight"
    : bmiValue < 35   ? "Obese I"
    : "Obese II";

  const handleDownloadReport = async () => {
    if (!user || !weeklySummary) {
      toast({ title: t("no_data_available"), variant: "destructive" });
      return;
    }

    setGeneratingReport(true);
    try {
      const weekEnd = new Date();
      const weekStart = subDays(weekEnd, 7);

      const { data: dailyLogs } = await supabase
        .from('progress_logs')
        .select('log_date, calories_consumed, protein_consumed_g, carbs_consumed_g, fat_consumed_g, weight_kg')
        .eq('user_id', user.id)
        .gte('log_date', weekStart.toISOString().split('T')[0])
        .lte('log_date', weekEnd.toISOString().split('T')[0])
        .order('log_date');

      const { data: waterLogs } = await (supabase as any)
        .from('water_intake')
        .select('log_date, glasses')
        .eq('user_id', user.id)
        .gte('log_date', weekStart.toISOString().split('T')[0])
        .lte('log_date', weekEnd.toISOString().split('T')[0]);

      const lastWeekStart = subDays(weekStart, 7);
      const { data: lastWeekLogs } = await supabase
        .from('progress_logs')
        .select('calories_consumed')
        .eq('user_id', user.id)
        .gte('log_date', lastWeekStart.toISOString().split('T')[0])
        .lt('log_date', weekStart.toISOString().split('T')[0]);

      const lastWeekAvg = lastWeekLogs && lastWeekLogs.length > 0
        ? lastWeekLogs.reduce((sum: number, log: any) => sum + (log.calories_consumed || 0), 0) / lastWeekLogs.length
        : 0;

      // Generate AI meal plan for next week
      const mealPlan = await generateWeeklyMealPlan(dailyCalorieTarget, dailyProteinTarget);

      // Load meal images for the PDF
      const mealImages = await loadMealPlanImages(mealPlan);
      const mealPlanWithEmbeddedImages = mealPlan.map((day) => {
        const embed = (meal: typeof day.breakfast) =>
          meal
            ? { ...meal, image_url: mealImages.get(meal.id) || meal.image_url }
            : meal;
        return {
          ...day,
          breakfast: embed(day.breakfast),
          lunch: embed(day.lunch),
          dinner: embed(day.dinner),
          snack: embed(day.snack),
        };
      });

      const reportDailyData: WeeklyReportData['dailyData'] = [];
      for (let i = 0; i < 7; i++) {
        const date = subDays(weekEnd, i);
        const dateStr = date.toISOString().split('T')[0];
        const log = dailyLogs?.find((l: any) => l.log_date === dateStr);
        const waterLog = waterLogs?.find((w: any) => w.log_date === dateStr);
        
        reportDailyData.unshift({
          date: dateStr,
          calories: log?.calories_consumed || 0,
          protein: log?.protein_consumed_g || 0,
          carbs: log?.carbs_consumed_g || 0,
          fat: log?.fat_consumed_g || 0,
          weight: log?.weight_kg || null,
          water: waterLog?.glasses || 0,
        });
      }

      const reportData: WeeklyReportData = {
        userName: user.email?.split('@')[0] || 'User',
        userEmail: user.email || '',
        reportDate: new Date().toISOString(),
        weekStart: weekStart.toISOString(),
        weekEnd: weekEnd.toISOString(),
        currentWeight: null,
        weightChange: null,
        weightGoal: activeGoal?.target_weight_kg || null,
        weightProgress: 0,
        avgCalories: weeklySummary?.calories.thisWeekAvg || 0,
        calorieTarget: dailyCalorieTarget,
        calorieProgress: calorieProgress,
        avgProtein: weeklySummary?.macros?.protein?.consumed || 0,
        proteinTarget: dailyProteinTarget,
        avgCarbs: weeklySummary?.macros?.carbs?.consumed || 0,
        carbsTarget: 250,
        avgFat: weeklySummary?.macros?.fat?.consumed || 0,
        fatTarget: 65,
        dailyData: reportDailyData,
        consistencyScore: weeklySummary?.consistency?.percentage || 0,
        daysLogged: weeklySummary?.consistency?.daysLogged || 0,
        totalDays: 7,
        mealQualityScore: averageScore || 0,
        waterAverage: reportDailyData.reduce((sum, d) => sum + d.water, 0) / 7,
        currentStreak: streaks?.logging?.currentStreak || 0,
        bestStreak: streaks?.logging?.bestStreak || 0,
        activeGoal: activeGoal?.goal_type || null,
        goalProgress: 0,
        milestonesAchieved: milestones?.filter((m: any) => m.achieved_at).length || 0,
        totalMilestones: milestones?.length || 0,
        insights: recommendations.slice(0, 3).map(r => r.description),
        recommendations: recommendations.slice(0, 3).map(r => `${r.title}: ${r.description}`),
        vsLastWeek: {
          calories: weeklySummary ? weeklySummary.calories.thisWeekAvg - lastWeekAvg : 0,
          weight: 0,
          consistency: weeklySummary?.consistency?.percentage || 0,
        },
        mealPlan: mealPlanWithEmbeddedImages,
        mealImages,
      };

      // ── Fetch Tracker Insights ──
      const { data: weightHistory } = await (supabase as any)
        .from('body_measurements')
        .select('log_date, weight_kg')
        .eq('user_id', user.id)
        .gte('log_date', weekStart.toISOString().split('T')[0])
        .lte('log_date', weekEnd.toISOString().split('T')[0])
        .order('log_date');

      // Steps are stored in localStorage keyed by user ID + date
      const dailySteps = Array.from({ length: 7 }, (_, i) => {
        const d = subDays(weekEnd, 6 - i);
        const dateStr = d.toISOString().split('T')[0];
        const steps = parseInt(localStorage.getItem(`tracker_steps_${user.id}_${dateStr}`) || '0', 10);
        return { date: dateStr, steps };
      });

      // Water in mL (glasses * 250)
      const dailyWater = Array.from({ length: 7 }, (_, i) => {
        const d = subDays(weekEnd, 6 - i);
        const dateStr = d.toISOString().split('T')[0];
        const waterLog = waterLogs?.find((w: any) => w.log_date === dateStr);
        return { date: dateStr, waterMl: (waterLog?.glasses || 0) * 250 };
      });

      // BMI calculation
      const heightCm = profile?.height_cm || null;
      const currentWeightKg = profile?.current_weight_kg || null;
      const bmi = heightCm && currentWeightKg
        ? parseFloat((currentWeightKg / Math.pow(heightCm / 100, 2)).toFixed(1))
        : null;
      const bmiLabel = bmi === null ? null
        : bmi < 18.5 ? 'Underweight'
        : bmi < 25 ? 'Normal'
        : bmi < 30 ? 'Overweight'
        : bmi < 35 ? 'Obese I'
        : 'Obese II';

      reportData.trackerInsights = {
        dailySteps,
        dailyWater,
        weightHistory: (weightHistory || []).map((w: any) => ({ date: w.log_date, weight_kg: w.weight_kg })),
        bmi,
        bmiLabel,
        heightCm,
        stepGoal: 6000,
        waterTargetMl: 2500,
      };

      await nutrioReportPDF.download(reportData);
      toast({ title: t("report_downloaded"), description: "Your Nutrition Performance & Habit Intelligence report has been saved." });
    } catch (error) {
      console.error("Error generating report:", error);
      toast({ title: t("report_failed"), variant: "destructive" });
    } finally {
      setGeneratingReport(false);
    }
  };

  const handleQuickWaterAdd = async (amount: number) => {
    try {
      await addWater(amount);
      toast({
        title: t("water_added"),
        description: `+${amount} ${t("glasses")}`,
      });
    } catch (error) {
      toast({
        title: t("failed_add_water"),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Native App Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200 safe-area-top">
        <div className="flex items-center justify-between px-4 h-14 rtl:flex-row-reverse">
          <button
            onClick={() => navigate("/dashboard")}
            className="p-2 -ml-2 rounded-full hover:bg-slate-100 active:scale-95 transition-all"
          >
            <ArrowLeft className="w-6 h-6 text-slate-700" />
          </button>
          <h1 className="text-lg font-semibold text-slate-900">{t("progress")}</h1>
          <div className="w-10" /> {/* Spacer for balance */}
        </div>

        {/* Segmented Control - iOS Style */}
        <div className="px-4 pb-3">
          <div className="flex bg-slate-100 rounded-lg p-1">
            {(["today", "week", "goals"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "flex-1 py-2 px-4 text-sm font-medium rounded-md transition-all duration-200",
                  activeTab === tab
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
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
        {/* TODAY TAB */}
        {activeTab === "today" && (
          <>
            {/* Today Header */}
            <div className="flex items-center justify-between px-1">
              <div>
                <h3 className="font-bold text-slate-900">{t("todays_progress")}</h3>
                <p className="text-xs text-slate-500">{format(new Date(), "EEEE, MMM d")}</p>
              </div>
              <div className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-white",
                (calorieProgress + proteinProgress) / 2 >= 80 ? "bg-emerald-500" :
                (calorieProgress + proteinProgress) / 2 >= 50 ? "bg-amber-500" : "bg-orange-500"
              )}>
                <div className="w-1.5 h-1.5 rounded-full bg-white/70" />
                {(calorieProgress + proteinProgress) / 2 >= 80 ? t("great") :
                 (calorieProgress + proteinProgress) / 2 >= 50 ? t("good") : t("keep_going")}
              </div>
            </div>

            {/* Ring Gauge Cards — Calories & Protein */}
            <div className="grid grid-cols-2 gap-3">
              {/* Calories Ring */}
              <div className="relative rounded-2xl bg-white p-4 shadow-sm flex flex-col items-center">
                <p className="text-sm font-semibold text-slate-700 mb-3">{t("calories")}</p>
                <div className="relative w-28 h-28">
                  <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="#f1f5f9" strokeWidth="8" />
                    <circle
                      cx="50" cy="50" r="42" fill="none"
                      stroke="url(#calGrad)" strokeWidth="8" strokeLinecap="round"
                      strokeDasharray={`${Math.min(calorieProgress, 100) * 2.639} 263.9`}
                      className="transition-all duration-700"
                    />
                    <defs>
                      <linearGradient id="calGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#f97316" />
                        <stop offset="100%" stopColor="#ef4444" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-300/40">
                      <Flame className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </div>
                <div className="mt-3 text-center">
                  <p className="text-lg font-bold text-slate-900">
                    <span className="text-orange-500">{todayCalories}</span>
                    <span className="text-slate-400 text-sm font-normal">/{dailyCalorieTarget}</span>
                  </p>
                  <p className="text-xs text-slate-400">{calorieProgress}% {t("of_goal")}</p>
                </div>
              </div>

              {/* Protein Ring */}
              <div className="relative rounded-2xl bg-white p-4 shadow-sm flex flex-col items-center">
                <p className="text-sm font-semibold text-slate-700 mb-3">{t("protein")}</p>
                <div className="relative w-28 h-28">
                  <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="#f1f5f9" strokeWidth="8" />
                    <circle
                      cx="50" cy="50" r="42" fill="none"
                      stroke="url(#proGrad)" strokeWidth="8" strokeLinecap="round"
                      strokeDasharray={`${Math.min(proteinProgress, 100) * 2.639} 263.9`}
                      className="transition-all duration-700"
                    />
                    <defs>
                      <linearGradient id="proGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#3b82f6" />
                        <stop offset="100%" stopColor="#6366f1" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-300/40">
                      <Target className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </div>
                <div className="mt-3 text-center">
                  <p className="text-lg font-bold text-slate-900">
                    <span className="text-blue-500">{todayProtein}g</span>
                    <span className="text-slate-400 text-sm font-normal">/{dailyProteinTarget}g</span>
                  </p>
                  <p className="text-xs text-slate-400">{proteinProgress}% {t("of_goal")}</p>
                </div>
              </div>
            </div>

            {/* Burned — Horizontal bar */}
            <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
              <div className="flex items-center gap-4 px-4 py-3">
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-semibold text-slate-700">{t("burned")}</span>
                </div>
                <div className="flex-1 h-2 rounded-full bg-amber-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-700"
                    style={{ width: `${Math.min((todayBurned / 500) * 100, 100)}%` }}
                  />
                </div>
                <div className="shrink-0 bg-gradient-to-r from-amber-500 to-amber-600 text-white text-sm font-bold px-3 py-1 rounded-lg">
                  {todayBurned} cal
                </div>
              </div>
              <p className="text-xs text-slate-400 px-4 pb-3 -mt-1">{todayBurned > 0 ? t("from_activities") : t("no_activities_yet")}</p>
            </div>

            {/* Meal Quality */}
            {!qualityLoading && (
              <div className="rounded-2xl bg-white shadow-sm">
                <div className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-base font-bold text-slate-900">{t("meal_quality")}</p>
                    <p className="text-xs text-slate-400">{t("todays_score")}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="relative w-11 h-11">
                      <svg viewBox="0 0 44 44" className="w-full h-full -rotate-90">
                        <circle cx="22" cy="22" r="18" fill="none" stroke="#d1fae5" strokeWidth="4" />
                        <circle
                          cx="22" cy="22" r="18" fill="none"
                          stroke="#10b981" strokeWidth="4" strokeLinecap="round"
                          strokeDasharray={`${Math.min((averageScore || 0) * 1.131, 113.1)} 113.1`}
                          className="transition-all duration-700"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-sm font-bold text-emerald-600">{averageScore || 0}</span>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300" />
                  </div>
                </div>
              </div>
            )}

            {/* Recommendation */}
            {recommendations.length > 0 && (
              <Card className="border-0 shadow-sm bg-blue-50">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                      <TrendingUp className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900 text-sm">
                        {recommendations[0].title}
                      </p>
                      <p className="text-xs text-slate-600 mt-1">
                        {recommendations[0].description}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          {/* Weight Prediction Chart — always rendered, shows empty state when no data */}
          <WeightPredictionChart
            predictions={predictions}
            weightChartData={weightChartData}
            currentWeight={profile?.current_weight_kg || 0}
            targetWeight={profile?.target_weight_kg || 0}
          />
          </>
        )}

        {/* WEEK TAB */}
        {activeTab === "week" && (
          <ProfessionalWeeklyReport
            userId={user?.id}
            weeklySummary={weeklySummary}
            activeGoal={activeGoal}
            streaks={streaks}
            averageScore={averageScore}
            waterSummary={waterSummary}
            milestones={milestones}
            recommendations={recommendations}
            dailyData={dailyData}
            onDownload={handleDownloadReport}
            generatingReport={generatingReport}
            weeklyBurned={weeklyBurned}
            bmi={bmiValue}
            bmiLabel={bmiLabelValue}
          />
        )}

        {/* GOALS TAB */}
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

      <CustomerNavigation />

      {user && (
        <LogMealDialog
          open={logMealOpen}
          onOpenChange={setLogMealOpen}
          userId={user.id}
          onMealLogged={() => {}}
        />
      )}
    </div>
  );
};

// Goals Tab Component
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

const GoalsTab = ({ activeGoal, userId, updateGoalTargets, onGoalUpdated, setGoal }: GoalsTabProps) => {
  const { toast } = useToast();
  const { t } = useLanguage();
  const { profile } = useProfile();
  const [showCreateGoal, setShowCreateGoal] = useState(false);
  const [creatingGoal, setCreatingGoal] = useState(false);
  const [selectedGoalType, setSelectedGoalType] = useState<"weight_loss" | "muscle_gain" | "maintenance" | "general_health">("general_health");
  const [goalTargetWeight, setGoalTargetWeight] = useState("");
  const [goalTargetDate, setGoalTargetDate] = useState("");
  const [smartAdjustment, setSmartAdjustment] = useState(true);

  // Map dialog goal type to nutrition calculator goal
  const toCalcGoal = (type: string): "lose" | "gain" | "maintain" => {
    if (type === "weight_loss") return "lose";
    if (type === "muscle_gain") return "gain";
    return "maintain";
  };

  // Calculate personalized targets from user profile + goal type
  const calculateGoalTargets = (goalType: string) => {
    const calcGoal = toCalcGoal(goalType);
    const p = profile;
    if (
      p?.current_weight_kg && p?.height_cm && p?.age &&
      p?.gender && p.gender !== "prefer_not_to_say" && p?.activity_level
    ) {
      const bmr = calculateBMR(p.gender as "male" | "female", p.current_weight_kg, p.height_cm, p.age);
      const tdee = calculateTDEE(bmr, p.activity_level);
      const dailyCalories = calculateTargetCalories(tdee, calcGoal);
      const macros = calculateMacros(dailyCalories, calcGoal);
      return {
        daily_calorie_target: dailyCalories,
        protein_target_g: macros.protein,
        carbs_target_g: macros.carbs,
        fat_target_g: macros.fat,
        fiber_target_g: calcGoal === "lose" ? 35 : 30,
      };
    }
    // Sensible fallbacks when profile is incomplete
    const fallbacks: Record<string, { daily_calorie_target: number; protein_target_g: number; carbs_target_g: number; fat_target_g: number; fiber_target_g: number }> = {
      weight_loss:    { daily_calorie_target: 1600, protein_target_g: 140, carbs_target_g: 140, fat_target_g: 53,  fiber_target_g: 35 },
      muscle_gain:    { daily_calorie_target: 2500, protein_target_g: 188, carbs_target_g: 281, fat_target_g: 69,  fiber_target_g: 30 },
      maintenance:    { daily_calorie_target: 2000, protein_target_g: 150, carbs_target_g: 200, fat_target_g: 67,  fiber_target_g: 30 },
      general_health: { daily_calorie_target: 2000, protein_target_g: 120, carbs_target_g: 250, fat_target_g: 65,  fiber_target_g: 30 },
    };
    return fallbacks[goalType] ?? fallbacks.general_health;
  };

  const computedTargets = calculateGoalTargets(selectedGoalType);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [applyingAll, setApplyingAll] = useState(false);
  const [expandedImpact, setExpandedImpact] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [feedbackId, setFeedbackId] = useState<string | null>(null);

  const {
    suggestions,
    highConfidenceSuggestions,
    loading: adjustLoading,
    history: adjustHistory,
    dismiss,
    recordApply,
    recordFeedback,
    refresh: refreshAdjustments,
  } = useSmartAdjustments(userId, activeGoal, smartAdjustment);

  const [expandedSection, setExpandedSection] = useState<string | null>("macros");

  const applyAdjustment = async (s: AdjustmentSuggestion) => {
    if (s.safetyBlock) return;
    setApplyingId(s.id);
    const ok = await updateGoalTargets({ [s.field]: s.suggestedValue });
    setApplyingId(null);
    if (ok) {
      recordApply(s);
      toast({ title: t("goal_updated"), description: `${s.label} ${t("applied_successfully")}` });
      onGoalUpdated();
      refreshAdjustments();
    } else {
      toast({ title: t("failed_to_update"), description: t("please_try_again"), variant: "destructive" });
    }
  };

  const applyAllHighConfidence = async () => {
    if (highConfidenceSuggestions.length === 0) return;
    setApplyingAll(true);
    const updates: Record<string, number> = {};
    highConfidenceSuggestions.forEach(s => { updates[s.field] = s.suggestedValue; });
    const ok = await updateGoalTargets(updates);
    setApplyingAll(false);
    if (ok) {
      highConfidenceSuggestions.forEach(s => recordApply(s));
      toast({ title: `${highConfidenceSuggestions.length} ${t("goals_adjusted")}`, description: t("all_high_confidence_applied") });
      onGoalUpdated();
      refreshAdjustments();
    } else {
      toast({ title: t("failed_to_update"), description: t("some_updates_failed"), variant: "destructive" });
    }
  };

  const goalTypeConfig: Record<string, { label: string; icon: React.ReactNode; color: string; bgColor: string }> = {
    weight_loss: {
      label: "weight_loss",
      icon: <TrendingDown className="w-5 h-5" />,
      color: "text-orange-600",
      bgColor: "bg-orange-500",
    },
    muscle_gain: {
      label: "muscle_gain",
      icon: <Zap className="w-5 h-5" />,
      color: "text-blue-600",
      bgColor: "bg-blue-500",
    },
    maintenance: {
      label: "maintenance_goal",
      icon: <Minus className="w-5 h-5" />,
      color: "text-amber-600",
      bgColor: "bg-amber-500",
    },
    general_health: {
      label: "general_health",
      icon: <Sparkles className="w-5 h-5" />,
      color: "text-emerald-600",
      bgColor: "bg-emerald-500",
    },
  };

  const currentGoal = activeGoal ? goalTypeConfig[activeGoal.goal_type] || goalTypeConfig.general_health : null;

  const macroData = activeGoal ? [
    { label: t("calories"), value: activeGoal.daily_calorie_target, unit: "kcal", color: "bg-orange-500", icon: <Flame className="w-4 h-4" /> },
    { label: t("protein"), value: activeGoal.protein_target_g, unit: "g", color: "bg-blue-500", icon: <Target className="w-4 h-4" /> },
    { label: t("carbs"), value: activeGoal.carbs_target_g, unit: "g", color: "bg-amber-500", icon: <Zap className="w-4 h-4" /> },
    { label: t("fat"), value: activeGoal.fat_target_g, unit: "g", color: "bg-emerald-500", icon: <Droplets className="w-4 h-4" /> },
  ] : [];

  const milestones = [
    { id: 1, title: t("first_week_complete"), description: t("logged_meals_7_days"), achieved: true, icon: "🎯" },
    { id: 2, title: t("protein_pro"), description: t("hit_protein_goal_5_days"), achieved: true, icon: "💪" },
    { id: 3, title: t("hydration_hero"), description: t("drank_8_glasses"), achieved: false, icon: "💧" },
  ];

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Create New Goal Button */}
      <button
        onClick={() => setShowCreateGoal(true)}
        className="w-full flex items-center gap-4 bg-white rounded-2xl px-4 py-3.5 shadow-sm active:scale-[0.98] transition-transform"
      >
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Plus className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 text-left">
          <p className="text-[15px] font-semibold text-slate-900">{t("create_new_goal")}</p>
          <p className="text-xs text-slate-400 mt-0.5">{t("create_goal_description")}</p>
        </div>
        <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
      </button>

      {/* Hero Goal Card */}
      {currentGoal ? (
        <div className={cn("relative overflow-hidden rounded-2xl text-white p-5 shadow-md", currentGoal.bgColor)}>
          <div className="absolute -top-6 -right-6 w-28 h-28 bg-white/10 rounded-full" />
          <div className="absolute -bottom-4 -left-4 w-20 h-20 bg-white/10 rounded-full" />
          <div className="relative">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center text-white">
                {currentGoal.icon}
              </div>
              <div>
                <p className="text-white/70 text-sm">{t("active_goal")}</p>
                <h3 className="text-xl font-bold">{t(currentGoal.label)}</h3>
              </div>
            </div>
            {activeGoal?.target_weight_kg && (
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 bg-white/15 rounded-xl p-3">
                  <p className="text-white/70 text-xs mb-1">{t("target_weight")}</p>
                  <p className="text-lg font-bold">{activeGoal.target_weight_kg} kg</p>
                </div>
                {activeGoal.target_date && (
                  <div className="flex-1 bg-white/15 rounded-xl p-3">
                    <p className="text-white/70 text-xs mb-1">{t("target_date")}</p>
                    <p className="text-lg font-bold">{new Date(activeGoal.target_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                  </div>
                )}
              </div>
            )}
            <div className="flex items-center gap-2 text-white/80 text-sm">
              <Activity className="w-4 h-4" />
              <span>{t("on_track_nutrition")}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 p-5 shadow-sm">
          <div className="text-center py-4">
            <div className="w-16 h-16 rounded-full bg-slate-300 flex items-center justify-center mx-auto mb-3">
              <Target className="w-8 h-8 text-slate-500" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800 mb-1">{t("no_active_goal")}</h3>
            <p className="text-slate-500 text-sm mb-4">{t("set_goal_hint")}</p>
          </div>
        </div>
      )}

      {/* Daily Targets - Expandable */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <button 
          onClick={() => setExpandedSection(expandedSection === "macros" ? null : "macros")}
          className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white">
              <Zap className="w-5 h-5" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-slate-900">{t("daily_targets")}</h3>
              <p className="text-sm text-slate-500">{t("your_nutrition_goals")}</p>
            </div>
          </div>
          {expandedSection === "macros" ? (
            <ChevronRight className="w-5 h-5 text-slate-400 rotate-90 transition-transform" />
          ) : (
            <ChevronRight className="w-5 h-5 text-slate-400 transition-transform" />
          )}
        </button>
        
        {expandedSection === "macros" && (
          <div className="px-4 pb-4">
            <div className="grid grid-cols-2 gap-3">
              {macroData.map((macro) => (
                <div key={macro.label} className="bg-slate-50 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-white", macro.color)}>
                      {macro.icon}
                    </div>
                    <span className="text-sm text-slate-600">{macro.label}</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">
                    {macro.value}
                    <span className="text-sm font-normal text-slate-400 ml-1">{macro.unit}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Body Metrics */}
      <Card className="border-0 shadow-sm">
        <div className="p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">{t("body_metrics")}</h3>
              <p className="text-sm text-slate-500">{t("track_physical_progress")}</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-sm text-slate-600">{t("current_weight")}</Label>
              <div className="relative">
                <Input 
                  type="number" 
                  placeholder="75" 
                  className="h-12 rounded-xl pr-12"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">kg</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-slate-600">{t("height")}</Label>
              <div className="relative">
                <Input 
                  type="number" 
                  placeholder="175" 
                  className="h-12 rounded-xl pr-12"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">cm</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Smart Adjustments */}
      <div className="rounded-2xl bg-white overflow-hidden shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <Target className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-[15px]">{t("smart_adjustments")}</h3>
              <p className="text-xs text-slate-400">
                {suggestions.length > 0
                  ? t("suggestions_based_on_days", { count: suggestions.length, plural: suggestions.length !== 1 ? "s" : "", days: suggestions[0]?.daysAnalyzed ?? 0 })
                  : t("goal_optimization")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {adjustHistory.length > 0 && (
              <button
                className="text-slate-400 hover:text-slate-600 p-1 transition-colors"
                onClick={() => setShowHistory(h => !h)}
              >
                <History className="w-4 h-4" />
              </button>
            )}
            <button
              role="switch"
              aria-checked={smartAdjustment}
              onClick={() => setSmartAdjustment(!smartAdjustment)}
              className={cn(
                "relative inline-flex h-7 w-14 items-center rounded-full transition-colors duration-300",
                smartAdjustment ? "bg-emerald-500" : "bg-slate-300"
              )}
            >
              <span className={cn(
                "absolute text-[9px] font-bold uppercase tracking-wide transition-opacity duration-200",
                smartAdjustment ? "left-2 text-white opacity-100" : "left-2 text-white opacity-0"
              )}>ON</span>
              <span className={cn(
                "absolute text-[9px] font-bold uppercase tracking-wide transition-opacity duration-200",
                !smartAdjustment ? "right-2 text-slate-500 opacity-100" : "right-2 text-slate-500 opacity-0"
              )}>OFF</span>
              <span className={cn(
                "inline-block h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-300",
                smartAdjustment ? "translate-x-8" : "translate-x-1"
              )} />
            </button>
          </div>
        </div>

        {/* History panel */}
        {showHistory && adjustHistory.length > 0 && (
          <div className="mx-5 mb-3 pt-3 border-t border-slate-100">
            <p className="text-[10px] font-semibold text-slate-400 mb-2 uppercase tracking-wide">{t("applied_history")}</p>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {adjustHistory.slice(0, 8).map(h => (
                <div key={h.id} className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2">
                  <div>
                    <p className="text-xs font-medium text-slate-700">{h.field.replace(/_/g, " ").replace("target", "").trim()}</p>
                    <p className="text-xs text-slate-400">
                      {h.oldValue} → <span className="text-emerald-600 font-semibold">{h.newValue}</span>
                      {" · "}{new Date(h.appliedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </p>
                  </div>
                  {h.feedback ? (
                    <span className="text-xs text-slate-400">{h.feedback === "helpful" ? "👍" : "👎"}</span>
                  ) : (
                    <div className="flex gap-1">
                      <button className="text-slate-300 hover:text-emerald-500 transition-colors" onClick={() => { recordFeedback(h.id, "helpful"); setFeedbackId(h.id); }}>
                        <ThumbsUp className="w-3.5 h-3.5" />
                      </button>
                      <button className="text-slate-300 hover:text-red-400 transition-colors" onClick={() => { recordFeedback(h.id, "not_helpful"); setFeedbackId(h.id); }}>
                        <ThumbsDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Suggestions */}
        {smartAdjustment && (
          <div className="px-5 pb-5 space-y-3">
            {adjustLoading ? (
              <div className="flex items-center gap-2 text-sm text-slate-400 py-4">
                <Loader2 className="w-4 h-4 animate-spin" />
                {t("analyzing_21_days")}
              </div>
            ) : suggestions.length === 0 ? (
              <div className="text-sm text-slate-500 text-center py-6 space-y-1">
                <p className="font-medium">
                  {activeGoal ? t("not_enough_data") : t("no_active_goal")}
                </p>
                <p className="text-xs text-slate-400">
                  {activeGoal ? t("log_meals_4_days") : t("set_nutrition_goal_first")}
                </p>
              </div>
            ) : (
              <>
                {highConfidenceSuggestions.length > 1 && (
                  <button
                    className="w-full flex items-center justify-between bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl px-4 py-2.5 transition-colors active:scale-[0.98]"
                    disabled={applyingAll}
                    onClick={applyAllHighConfidence}
                  >
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <CheckCheck className="w-4 h-4" />
                      {t("apply")} {highConfidenceSuggestions.length} {t("high_confidence_changes")}
                    </div>
                    {applyingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                )}

                {suggestions.map((s) => {
                  const unit = s.field.includes("calorie") ? " kcal" : "g";
                  const diff = s.suggestedValue - s.currentValue;
                  const isExpanded = expandedImpact === s.id;
                  const pct = s.confidenceScore;
                  const nutrientName = s.field.replace("_target_g", "").replace("daily_calorie_target", "calories").replace(/_/g, " ");

                  return (
                    <div key={s.id} className="rounded-2xl bg-slate-50 border border-slate-100 overflow-hidden">
                      <div className="p-4">
                        {/* Top badges */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-1.5">
                            {s.id === "on-track" ? (
                              <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                                <CheckCheck className="w-3 h-3" /> {t("on_track")}
                              </span>
                            ) : s.safetyBlock ? (
                              <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                                <ShieldAlert className="w-3 h-3" /> {t("safety_tip")}
                              </span>
                            ) : (
                              <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", {
                                "bg-emerald-100 text-emerald-700": s.confidence === "high",
                                "bg-amber-100 text-amber-700": s.confidence === "medium",
                                "bg-slate-200 text-slate-500": s.confidence === "low",
                              })}>
                                {s.confidence === "high" ? t("high_confidence") : s.confidence === "medium" ? t("suggestion") : t("exploratory")}
                              </span>
                            )}
                            <span className="text-[10px] text-slate-400 capitalize">{t(s.category)}</span>
                          </div>
                          <button className="text-slate-300 hover:text-slate-500 p-0.5 transition-colors" onClick={() => dismiss(s.id)}>
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Gauge + Info layout */}
                        <div className="flex gap-4">
                          {/* Gauge ring */}
                          <div className="shrink-0 flex flex-col items-center">
                            <div className="relative w-20 h-20">
                              <svg viewBox="0 0 80 80" className="w-20 h-20 -rotate-90">
                                <circle cx="40" cy="40" r="32" fill="none" stroke="#f1f5f9" strokeWidth="6" />
                                <circle
                                  cx="40" cy="40" r="32"
                                  fill="none"
                                  stroke="url(#gaugeGradLight)"
                                  strokeWidth="6"
                                  strokeLinecap="round"
                                  strokeDasharray={`${Math.min(pct, 100) * 2.01} 201`}
                                  className="transition-all duration-700"
                                />
                                <defs>
                                  <linearGradient id="gaugeGradLight" x1="0%" y1="0%" x2="100%" y2="0%">
                                    <stop offset="0%" stopColor="#34d399" />
                                    <stop offset="100%" stopColor="#10b981" />
                                  </linearGradient>
                                </defs>
                              </svg>
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-lg font-extrabold text-slate-800 leading-none">{pct}%</span>
                              </div>
                            </div>
                            <p className="text-[9px] text-slate-400 text-center mt-1 capitalize">{nutrientName} · {t("high_confidence")}</p>
                          </div>

                          {/* Info side */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-800 mb-1">{s.label}</p>
                            <p className="text-xs text-slate-500 leading-relaxed">{s.reason}</p>
                          </div>
                        </div>

                        {/* Step-down journey */}
                        <div className="mt-4 pt-3 border-t border-slate-200">
                          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-3">{t("target_step_down_journey")}</p>
                          <div className="flex items-center gap-1">
                            <div className="flex flex-col items-center">
                              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-100" />
                              <p className="text-[9px] text-emerald-600 font-semibold mt-1">{s.currentValue}{unit}</p>
                              <p className="text-[8px] text-slate-400">{t("current_average")}</p>
                            </div>
                            <div className="flex-1 h-px bg-gradient-to-r from-emerald-400 to-teal-400 relative mx-1">
                              <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 flex items-center gap-0.5 bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded text-[9px] text-teal-700 font-semibold whitespace-nowrap">
                                {diff > 0 ? "↑" : "↓"} {diff > 0 ? "+" : ""}{diff}{unit}
                              </div>
                            </div>
                            <div className="flex flex-col items-center">
                              <div className="w-2.5 h-2.5 rounded-full bg-teal-500 ring-2 ring-teal-100" />
                              <p className="text-[9px] text-teal-600 font-semibold mt-1">{s.suggestedValue}{unit}</p>
                              <p className="text-[8px] text-slate-400">{t("smart_goal")}</p>
                            </div>
                          </div>
                        </div>

                        {/* Estimated Benefits */}
                        <div className="mt-3 pt-3 border-t border-slate-200">
                          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">{t("estimated_benefits")}</p>
                          <div className="grid grid-cols-3 gap-1.5">
                            {[
                              { label: t("habit_consistency"), value: "+18%" },
                              { label: t("reduced_daily_pressure") },
                              { label: t("sustained_support") },
                            ].map((b, i) => (
                              <div key={i} className="bg-white border border-slate-100 rounded-xl px-2 py-2 text-center">
                                {b.value && <p className="text-xs font-bold text-emerald-600 mb-0.5">{b.value}</p>}
                                <p className="text-[9px] text-slate-500 leading-tight">{b.label}</p>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Footer: Impact + Apply */}
                        <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-200">
                          <button
                            className="flex items-center gap-1.5 text-xs text-teal-600 hover:text-teal-700 transition-colors active:scale-[0.98]"
                            onClick={() => setExpandedImpact(isExpanded ? null : s.id)}
                          >
                            <TrendingUp className="w-3.5 h-3.5" />
                            {isExpanded ? t("hide_impact") : t("view_impact_projection")}
                          </button>
                          {!s.safetyBlock && (
                            <button
                              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold px-4 py-2 rounded-full transition-colors active:scale-[0.95] disabled:opacity-50"
                              disabled={applyingId === s.id}
                              onClick={() => applyAdjustment(s)}
                            >
                              {applyingId === s.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <>
                                  <CheckCheck className="w-3.5 h-3.5" />
                                  {t("apply").toUpperCase()}
                                </>
                              )}
                            </button>
                          )}
                        </div>

                        {/* Expanded impact */}
                        {isExpanded && (
                          <div className="mt-3 pt-3 border-t border-slate-200 text-xs text-slate-500 leading-relaxed">
                            {s.impact}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}
      </div>

      {/* Milestones */}
      <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md shadow-amber-200/50">
                <Trophy className="w-4.5 h-4.5 text-white w-[18px] h-[18px]" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">{t("milestones")}</h3>
                <p className="text-[11px] text-slate-400">
                  {milestones.filter(m => m.achieved).length} / {milestones.length} {t("achieved")}
                </p>
              </div>
            </div>
            <span className="text-xs font-semibold text-amber-500 bg-amber-50 px-2.5 py-1 rounded-full">
              {Math.round((milestones.filter(m => m.achieved).length / milestones.length) * 100)}%
            </span>
          </div>

          {/* Overall progress bar */}
          <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-700"
              style={{ width: `${Math.round((milestones.filter(m => m.achieved).length / milestones.length) * 100)}%` }}
            />
          </div>
        </div>

        {/* Milestone rows */}
        <div className="divide-y divide-slate-50">
          {milestones.map((milestone) => (
            <div
              key={milestone.id}
              className={cn(
                "flex items-center gap-4 px-5 py-3.5 transition-colors",
                milestone.achieved ? "bg-amber-50/60" : "bg-white"
              )}
            >
              {/* Emoji badge */}
              <div className={cn(
                "w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0",
                milestone.achieved ? "bg-amber-100" : "bg-slate-100"
              )}>
                {milestone.icon}
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "font-semibold text-sm truncate",
                  milestone.achieved ? "text-slate-900" : "text-slate-500"
                )}>
                  {milestone.title}
                </p>
                <p className="text-[11px] text-slate-400 truncate">{milestone.description}</p>
              </div>

              {/* Status badge */}
              {milestone.achieved ? (
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm shadow-amber-200/60 shrink-0">
                  <Award className="w-3.5 h-3.5 text-white" />
                </div>
              ) : (
                <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                  <div className="w-3 h-3 rounded-full border-2 border-slate-300" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Create Goal Modal */}
      {showCreateGoal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <Card className="w-full max-w-md max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold">{t("create_new_goal")}</h3>
                <button 
                  onClick={() => setShowCreateGoal(false)}
                  className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center"
                >
                  <span className="text-2xl leading-none">&times;</span>
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <Label className="text-sm text-slate-600 mb-2 block">{t("goal_type")}</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(goalTypeConfig).map(([key, config]) => (
                      <button
                        key={key}
                        onClick={() => setSelectedGoalType(key as typeof selectedGoalType)}
                        className={cn(
                          "p-3 rounded-xl border-2 transition-colors text-left",
                          selectedGoalType === key
                            ? "border-primary bg-primary/5"
                            : "border-slate-100 hover:border-primary/50"
                        )}
                      >
                        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center mb-2", config.color.replace("text-", "bg-").replace("600", "100"))}>
                          <div className={config.color}>{config.icon}</div>
                        </div>
                        <p className="font-medium text-sm">{t(config.label as any)}</p>
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-slate-600 mb-2 block">{t("target_weight_kg")}</Label>
                    <Input
                      type="number"
                      placeholder="70"
                      className="h-12 rounded-xl"
                      value={goalTargetWeight}
                      onChange={(e) => setGoalTargetWeight(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-sm text-slate-600 mb-2 block">{t("target_date")}</Label>
                    <Input
                      type="date"
                      className="h-12 rounded-xl"
                      value={goalTargetDate}
                      onChange={(e) => setGoalTargetDate(e.target.value)}
                    />
                  </div>
                </div>

                {/* Calculated targets preview */}
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 space-y-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    {profile?.current_weight_kg && profile?.height_cm ? "Your personalized targets" : "Recommended targets"}
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Flame className="w-4 h-4 text-orange-500 shrink-0" />
                      <span className="text-slate-600">Calories</span>
                      <span className="ml-auto font-semibold">{computedTargets.daily_calorie_target}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-blue-500 shrink-0" />
                      <span className="text-slate-600">Protein</span>
                      <span className="ml-auto font-semibold">{computedTargets.protein_target_g}g</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-yellow-500 shrink-0" />
                      <span className="text-slate-600">Carbs</span>
                      <span className="ml-auto font-semibold">{computedTargets.carbs_target_g}g</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Droplets className="w-4 h-4 text-cyan-500 shrink-0" />
                      <span className="text-slate-600">Fat</span>
                      <span className="ml-auto font-semibold">{computedTargets.fat_target_g}g</span>
                    </div>
                  </div>
                  {!profile?.current_weight_kg && (
                    <p className="text-xs text-slate-400 mt-1">Complete your profile for personalized targets</p>
                  )}
                </div>
                
                <Button
                  className="w-full h-12 rounded-xl"
                  disabled={creatingGoal}
                  onClick={async () => {
                    try {
                      setCreatingGoal(true);
                      await setGoal({
                        goal_type: selectedGoalType,
                        target_weight_kg: goalTargetWeight ? parseFloat(goalTargetWeight) : null,
                        target_date: goalTargetDate || null,
                        ...computedTargets,
                        is_active: true,
                      });
                      toast({ title: t("goal_created_successfully") });
                      setShowCreateGoal(false);
                      setGoalTargetWeight("");
                      setGoalTargetDate("");
                      setSelectedGoalType("general_health");
                      onGoalUpdated();
                    } catch {
                      toast({ title: t("failed_to_create_goal"), variant: "destructive" });
                    } finally {
                      setCreatingGoal(false);
                    }
                  }}
                >
                  {creatingGoal ? <Loader2 className="w-4 h-4 animate-spin" /> : t("create_goal")}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ProgressDashboard;
