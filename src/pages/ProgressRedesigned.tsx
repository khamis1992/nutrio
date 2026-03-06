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
import { Switch } from "@/components/ui/switch";
import { ProfessionalWeeklyReport } from "@/components/progress/ProfessionalWeeklyReport";
import { useLanguage } from "@/contexts/LanguageContext";



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
  const { activeGoal, milestones, updateGoalTargets, refresh: refreshGoals } = useNutritionGoals(user?.id);
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
            <ArrowLeft className="w-6 h-6 text-slate-700 rtl-flip-back" />
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

            {/* Stats Grid — 4 colored cards */}
            <div className="grid grid-cols-2 gap-3">
              {/* Calories — Orange */}
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 text-white p-4 shadow-md">
                <div className="absolute -top-4 -right-4 w-20 h-20 bg-white/10 rounded-full" />
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                    <Flame className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-xs text-white/80 font-medium">{t("calories")}</span>
                </div>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-2xl font-bold">{todayCalories}</span>
                  <span className="text-sm text-white/60">/ {dailyCalorieTarget}</span>
                </div>
                <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                  <div className="h-full bg-white rounded-full transition-all duration-500" style={{ width: `${Math.min(calorieProgress, 100)}%` }} />
                </div>
                <p className="text-xs text-white/60 mt-2">{calorieProgress}% {t("of_goal")}</p>
              </div>

              {/* Protein — Blue */}
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-white p-4 shadow-md">
                <div className="absolute -top-4 -right-4 w-20 h-20 bg-white/10 rounded-full" />
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                    <Target className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-xs text-white/80 font-medium">{t("protein")}</span>
                </div>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-2xl font-bold">{todayProtein}g</span>
                  <span className="text-sm text-white/60">/ {dailyProteinTarget}g</span>
                </div>
                <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                  <div className="h-full bg-white rounded-full transition-all duration-500" style={{ width: `${Math.min(proteinProgress, 100)}%` }} />
                </div>
                <p className="text-xs text-white/60 mt-2">{proteinProgress}% {t("of_goal")}</p>
              </div>

              {/* Burned — Amber */}
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-white p-4 shadow-md">
                <div className="absolute -top-4 -right-4 w-20 h-20 bg-white/10 rounded-full" />
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                    <Flame className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-xs text-white/80 font-medium">{t("burned")}</span>
                </div>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-2xl font-bold">{todayBurned}</span>
                  <span className="text-sm text-white/60">cal</span>
                </div>
                <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                  <div className="h-full bg-white rounded-full transition-all duration-500" style={{ width: `${Math.min((todayBurned / 500) * 100, 100)}%` }} />
                </div>
                <p className="text-xs text-white/60 mt-2">{todayBurned > 0 ? t("from_activities") : t("no_activities_yet")}</p>
              </div>

              {/* Streak — Emerald */}
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white p-4 shadow-md">
                <div className="absolute -top-4 -right-4 w-20 h-20 bg-white/10 rounded-full" />
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                    <Flame className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-xs text-white/80 font-medium">{t("streak")}</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold">{streaks?.logging?.currentStreak || 0}</span>
                  <span className="text-sm text-white/60">{t("days")}</span>
                </div>
                <p className="text-xs text-white/60 mt-2">{t("best_streak")}: {streaks?.logging?.bestStreak || 0} {t("days")}</p>
              </div>
            </div>


            {/* Meal Quality */}
            {!qualityLoading && (
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white font-bold text-lg">
                        {averageScore || 0}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{t("meal_quality")}</p>
                        <p className="text-sm text-slate-500">{t("todays_score")}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300" />
                  </div>
                </CardContent>
              </Card>
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
}

const GoalsTab = ({ activeGoal, userId, updateGoalTargets, onGoalUpdated }: GoalsTabProps) => {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [showCreateGoal, setShowCreateGoal] = useState(false);
  const [smartAdjustment, setSmartAdjustment] = useState(true);
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
      <Card className="border-0 shadow-sm bg-gradient-to-r from-emerald-50 to-teal-50 overflow-hidden">
        <div className="p-4">
          {/* Header row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">{t("smart_adjustments")}</h3>
                <p className="text-sm text-slate-500">
                  {suggestions.length > 0
                    ? t("suggestions_based_on_days", { count: suggestions.length, plural: suggestions.length !== 1 ? "s" : "", days: suggestions[0]?.daysAnalyzed ?? 0 })
                    : t("goal_optimization")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {adjustHistory.length > 0 && (
                <button
                  className="text-slate-400 hover:text-slate-600 p-1"
                  onClick={() => setShowHistory(h => !h)}
                  title="View history"
                >
                  <History className="w-4 h-4" />
                </button>
              )}
              <Switch checked={smartAdjustment} onCheckedChange={setSmartAdjustment} />
            </div>
          </div>

          {/* History panel */}
          {showHistory && adjustHistory.length > 0 && (
            <div className="mt-3 pt-3 border-t border-emerald-200/50">
              <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">{t("applied_history")}</p>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {adjustHistory.slice(0, 8).map(h => (
                  <div key={h.id} className="flex items-center justify-between bg-white/70 rounded-xl px-3 py-2">
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
                        <button className="text-slate-300 hover:text-emerald-500" onClick={() => { recordFeedback(h.id, "helpful"); setFeedbackId(h.id); }}>
                          <ThumbsUp className="w-3.5 h-3.5" />
                        </button>
                        <button className="text-slate-300 hover:text-red-400" onClick={() => { recordFeedback(h.id, "not_helpful"); setFeedbackId(h.id); }}>
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
            <div className="mt-4 pt-4 border-t border-emerald-200/50 space-y-3">
              {adjustLoading ? (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t("analyzing_21_days")}
                </div>
              ) : suggestions.length === 0 ? (
                <div className="text-sm text-slate-500 text-center py-3 space-y-1">
                  <p className="font-medium">
                    {activeGoal ? t("not_enough_data") : t("no_active_goal")}
                  </p>
                  <p className="text-xs text-slate-400">
                    {activeGoal
                      ? t("log_meals_4_days")
                      : t("set_nutrition_goal_first")}
                  </p>
                </div>
              ) : (
                <>
                  {/* Apply all high-confidence banner */}
                  {highConfidenceSuggestions.length > 1 && (
                    <button
                      className="w-full flex items-center justify-between bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl px-4 py-2.5 transition-colors"
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

                  {/* Individual suggestion cards */}
                  {suggestions.map((s) => {
                    const unit = s.field.includes("calorie") ? " kcal" : "g";
                    const diff = s.suggestedValue - s.currentValue;
                    const isExpanded = expandedImpact === s.id;
                    return (
                      <div
                        key={s.id}
                        className={cn(
                          "bg-white rounded-2xl border shadow-sm overflow-hidden transition-all",
                          s.safetyBlock ? "border-amber-200" : s.confidence === "high" ? "border-emerald-200" : "border-slate-100"
                        )}
                      >
                        <div className="p-4">
                          {/* Top row: badges + dismiss */}
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {s.id === "on-track" ? (
                                <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                                  <CheckCheck className="w-3 h-3" /> {t("on_track")}
                                </span>
                              ) : s.safetyBlock ? (
                                <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                                  <ShieldAlert className="w-3 h-3" /> {t("safety_tip")}
                                </span>
                              ) : (
                                <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full", {
                                  "bg-emerald-100 text-emerald-700": s.confidence === "high",
                                  "bg-amber-100 text-amber-700": s.confidence === "medium",
                                  "bg-slate-100 text-slate-500": s.confidence === "low",
                                })}>
                                  {s.confidence === "high" ? t("high_confidence") : s.confidence === "medium" ? t("suggestion") : t("exploratory")}
                                </span>
                              )}
                              <span className="text-xs text-slate-400 capitalize">{t(s.category)}</span>
                            </div>
                            <button
                              className="text-slate-300 hover:text-slate-500 p-0.5"
                              onClick={() => dismiss(s.id)}
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Confidence bar */}
                          <div className="flex items-center gap-2 mb-3">
                            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={cn("h-full rounded-full transition-all", {
                                  "bg-emerald-500": s.confidence === "high",
                                  "bg-amber-400": s.confidence === "medium",
                                  "bg-slate-300": s.confidence === "low",
                                })}
                                style={{ width: `${s.confidenceScore}%` }}
                              />
                            </div>
                            <span className="text-xs text-slate-400 tabular-nums w-8 text-right">{s.confidenceScore}%</span>
                          </div>

                          {/* Label + reason */}
                          <p className="text-sm font-semibold text-slate-800 mb-1">{s.label}</p>
                          <p className="text-sm text-slate-500 leading-snug">{s.reason}</p>

                          {/* Value change */}
                          <div className="flex items-center gap-2 mt-3">
                            <span className="text-sm text-slate-400 line-through">{s.currentValue}{unit}</span>
                            <span className="text-slate-300">→</span>
                            <span className={cn("text-sm font-bold", s.direction === "down" ? "text-blue-600" : "text-emerald-600")}>
                              {s.suggestedValue}{unit}
                            </span>
                            <span className={cn("text-xs ml-1", s.direction === "down" ? "text-blue-400" : "text-emerald-400")}>
                              ({diff > 0 ? "+" : ""}{diff}{unit})
                            </span>
                          </div>

                          {/* Impact toggle + Apply */}
                          <div className="flex items-center justify-between mt-3 gap-2">
                            <button
                              className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors"
                              onClick={() => setExpandedImpact(isExpanded ? null : s.id)}
                            >
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              {isExpanded ? t("hide_impact") : t("expected_impact")}
                            </button>
                            {!s.safetyBlock && (
                              <Button
                                size="sm"
                                variant={s.confidence === "high" ? "default" : "outline"}
                                className="rounded-xl text-xs h-8 px-4 shrink-0"
                                disabled={applyingId === s.id}
                                onClick={() => applyAdjustment(s)}
                              >
                                {applyingId === s.id ? <Loader2 className="w-3 h-3 animate-spin" /> : t("apply")}
                              </Button>
                            )}
                          </div>

                          {/* Impact preview */}
                          {isExpanded && (
                            <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500 leading-relaxed">
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
      </Card>

      {/* Milestones */}
      <Card className="border-0 shadow-sm">
        <div className="p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-white">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">{t("milestones")}</h3>
              <p className="text-sm text-slate-500">{milestones.filter(m => m.achieved).length} / {milestones.length} {t("achieved")}</p>
            </div>
          </div>
          
          <div className="space-y-2">
            {milestones.map((milestone) => (
              <div 
                key={milestone.id}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-xl transition-colors",
                  milestone.achieved ? "bg-amber-50" : "bg-slate-50"
                )}
              >
                <div className="text-2xl">{milestone.icon}</div>
                <div className="flex-1">
                  <p className={cn("font-medium text-sm", milestone.achieved ? "text-slate-900" : "text-slate-600")}>
                    {milestone.title}
                  </p>
                  <p className="text-xs text-slate-500">{milestone.description}</p>
                </div>
                {milestone.achieved && (
                  <Award className="w-5 h-5 text-amber-500" />
                )}
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Create New Goal Button */}
      <Button 
        onClick={() => setShowCreateGoal(true)}
        className="w-full h-14 text-base font-semibold rounded-xl shadow-lg shadow-primary/25 bg-gradient-to-r from-primary to-primary/90 hover:opacity-90 transition-opacity"
      >
        <Plus className="w-5 h-5 mr-2" />
        {t("create_new_goal")}
      </Button>

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
                        className="p-3 rounded-xl border-2 border-slate-100 hover:border-primary/50 transition-colors text-left"
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
                    <Input type="number" placeholder="70" className="h-12 rounded-xl" />
                  </div>
                  <div>
                    <Label className="text-sm text-slate-600 mb-2 block">{t("target_date")}</Label>
                    <Input type="date" className="h-12 rounded-xl" />
                  </div>
                </div>
                
                <Button className="w-full h-12 rounded-xl">
                  {t("create_goal")}
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
