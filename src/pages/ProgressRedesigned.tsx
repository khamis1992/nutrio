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



const ProgressDashboard = () => {
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
    
    fetchTodayStats();
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

  const handleDownloadReport = async () => {
    if (!user || !weeklySummary) {
      toast({ title: "No data available", variant: "destructive" });
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

      await nutrioReportPDF.download(reportData);
      toast({ title: "Report downloaded!", description: "Your Nutrition Performance & Habit Intelligence report has been saved." });
    } catch (error) {
      console.error("Error generating report:", error);
      toast({ title: "Failed to generate report", variant: "destructive" });
    } finally {
      setGeneratingReport(false);
    }
  };

  const handleQuickWaterAdd = async (amount: number) => {
    try {
      await addWater(amount);
      toast({
        title: "Water added",
        description: `+${amount} glasses`,
      });
    } catch (error) {
      toast({
        title: "Failed to add water",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Native App Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200 safe-area-top">
        <div className="flex items-center justify-between px-4 h-14">
          <button
            onClick={() => navigate("/dashboard")}
            className="p-2 -ml-2 rounded-full hover:bg-slate-100 active:scale-95 transition-all"
          >
            <ArrowLeft className="w-6 h-6 text-slate-700" />
          </button>
          <h1 className="text-lg font-semibold text-slate-900">Progress</h1>
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
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
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
            {/* Hero Card - Dark Theme */}
            <div className="relative overflow-hidden rounded-3xl bg-slate-900 text-white p-6 shadow-2xl">
              {/* Background decorations */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-orange-500/20 to-amber-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-blue-500/10 to-cyan-500/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />
              
              <div className="relative">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center">
                      <Flame className="w-5 h-5 text-orange-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">Today's Progress</h3>
                      <p className="text-xs text-white/50">{format(new Date(), "EEEE, MMM d")}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur">
                    <div className={cn("w-2 h-2 rounded-full", 
                      (calorieProgress + proteinProgress) / 2 >= 80 ? "bg-emerald-400" : 
                      (calorieProgress + proteinProgress) / 2 >= 50 ? "bg-amber-400" : "bg-orange-400"
                    )} />
                    <span className="text-xs font-medium text-white/80">
                      {(calorieProgress + proteinProgress) / 2 >= 80 ? "Great" : 
                       (calorieProgress + proteinProgress) / 2 >= 50 ? "Good" : "Keep Going"}
                    </span>
                  </div>
                </div>

                {/* Main Stats Grid */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Calories */}
                  <div className="bg-white/5 backdrop-blur rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
                        <Flame className="w-4 h-4 text-orange-400" />
                      </div>
                      <span className="text-xs text-white/60">Calories</span>
                    </div>
                    <div className="flex items-baseline gap-1 mb-2">
                      <span className="text-2xl font-bold text-white">{todayCalories}</span>
                      <span className="text-sm text-white/40">/ {dailyCalorieTarget}</span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-orange-400 to-orange-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(calorieProgress, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-white/40 mt-2">{calorieProgress}% of daily goal</p>
                  </div>

                  {/* Protein */}
                  <div className="bg-white/5 backdrop-blur rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                        <Target className="w-4 h-4 text-blue-400" />
                      </div>
                      <span className="text-xs text-white/60">Protein</span>
                    </div>
                    <div className="flex items-baseline gap-1 mb-2">
                      <span className="text-2xl font-bold text-white">{todayProtein}g</span>
                      <span className="text-sm text-white/40">/ {dailyProteinTarget}g</span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-400 to-blue-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(proteinProgress, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-white/40 mt-2">{proteinProgress}% of daily goal</p>
                  </div>

                  {/* Water */}
                  <div className="bg-white/5 backdrop-blur rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                        <Droplets className="w-4 h-4 text-cyan-400" />
                      </div>
                      <span className="text-xs text-white/60">Water</span>
                    </div>
                    <div className="flex items-baseline gap-1 mb-2">
                      <span className="text-2xl font-bold text-white">{waterSummary?.total || 0}</span>
                      <span className="text-sm text-white/40">/ 8 glasses</span>
                    </div>
                    <div className="flex gap-1">
                      {[...Array(8)].map((_, i) => (
                        <div
                          key={i}
                          className={cn(
                            "h-1.5 flex-1 rounded-full transition-all",
                            i < (waterSummary?.total || 0) ? "bg-cyan-400" : "bg-white/10"
                          )}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-white/40 mt-2">{waterProgress}% hydration</p>
                  </div>

                  {/* Streak */}
                  <div className="bg-white/5 backdrop-blur rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                        <Flame className="w-4 h-4 text-amber-400" />
                      </div>
                      <span className="text-xs text-white/60">Streak</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-white">{streaks?.logging?.currentStreak || 0}</span>
                      <span className="text-sm text-white/40">days</span>
                    </div>
                    <p className="text-xs text-white/40 mt-2">
                      Best: {streaks?.logging?.bestStreak || 0} days
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Quick Add</h3>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-12 border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100"
                    onClick={() => handleQuickWaterAdd(1)}
                    disabled={waterLoading}
                  >
                    <Droplets className="w-4 h-4 mr-1" />
                    +1 Water
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-12"
                    onClick={() => setLogMealOpen(true)}
                  >
                    <Utensils className="w-4 h-4 mr-1" />
                    Log Meal
                  </Button>
                </div>
              </CardContent>
            </Card>

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
                        <p className="font-semibold text-slate-900">Meal Quality</p>
                        <p className="text-sm text-slate-500">Today's score</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300" />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recommendation */}
            {recommendations.length > 0 && (
              <Card className="border-0 shadow-sm bg-gradient-to-r from-blue-50 to-indigo-50">
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
      toast({ title: "Goal updated!", description: `${s.label} applied successfully.` });
      onGoalUpdated();
      refreshAdjustments();
    } else {
      toast({ title: "Failed to update", description: "Please try again.", variant: "destructive" });
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
      toast({ title: `${highConfidenceSuggestions.length} goals adjusted!`, description: "All high-confidence suggestions applied." });
      onGoalUpdated();
      refreshAdjustments();
    } else {
      toast({ title: "Failed", description: "Some updates failed. Please try again.", variant: "destructive" });
    }
  };

  const goalTypeConfig: Record<string, { label: string; icon: React.ReactNode; color: string; bgColor: string }> = {
    weight_loss: {
      label: "Weight Loss",
      icon: <TrendingDown className="w-5 h-5" />,
      color: "text-orange-600",
      bgColor: "bg-orange-500",
    },
    muscle_gain: {
      label: "Muscle Gain",
      icon: <Zap className="w-5 h-5" />,
      color: "text-blue-600",
      bgColor: "bg-blue-500",
    },
    maintenance: {
      label: "Maintenance",
      icon: <Minus className="w-5 h-5" />,
      color: "text-green-600",
      bgColor: "bg-green-500",
    },
    general_health: {
      label: "General Health",
      icon: <Sparkles className="w-5 h-5" />,
      color: "text-emerald-600",
      bgColor: "bg-emerald-500",
    },
  };

  const currentGoal = activeGoal ? goalTypeConfig[activeGoal.goal_type] || goalTypeConfig.general_health : null;

  const macroData = activeGoal ? [
    { label: "Calories", value: activeGoal.daily_calorie_target, unit: "kcal", color: "bg-orange-500", icon: <Flame className="w-4 h-4" /> },
    { label: "Protein", value: activeGoal.protein_target_g, unit: "g", color: "bg-blue-500", icon: <Target className="w-4 h-4" /> },
    { label: "Carbs", value: activeGoal.carbs_target_g, unit: "g", color: "bg-amber-500", icon: <Zap className="w-4 h-4" /> },
    { label: "Fat", value: activeGoal.fat_target_g, unit: "g", color: "bg-pink-500", icon: <Droplets className="w-4 h-4" /> },
  ] : [];

  const milestones = [
    { id: 1, title: "First Week Complete", description: "Logged meals for 7 days", achieved: true, icon: "🎯" },
    { id: 2, title: "Protein Pro", description: "Hit protein goal 5 days", achieved: true, icon: "💪" },
    { id: 3, title: "Hydration Hero", description: "Drank 8 glasses for a week", achieved: false, icon: "💧" },
  ];

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Hero Goal Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-5 shadow-xl">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative">
          {currentGoal ? (
            <>
              <div className="flex items-center gap-3 mb-4">
                <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center bg-white/20 backdrop-blur", currentGoal.color)}>
                  {currentGoal.icon}
                </div>
                <div>
                  <p className="text-white/60 text-sm">Active Goal</p>
                  <h3 className="text-xl font-bold">{currentGoal.label}</h3>
                </div>
              </div>
              
              {activeGoal?.target_weight_kg && (
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex-1 bg-white/10 rounded-lg p-3">
                    <p className="text-white/60 text-xs mb-1">Target Weight</p>
                    <p className="text-lg font-semibold">{activeGoal.target_weight_kg} kg</p>
                  </div>
                  {activeGoal.target_date && (
                    <div className="flex-1 bg-white/10 rounded-lg p-3">
                      <p className="text-white/60 text-xs mb-1">Target Date</p>
                      <p className="text-lg font-semibold">{new Date(activeGoal.target_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                    </div>
                  )}
                </div>
              )}
              
              <div className="flex items-center gap-2 text-white/80 text-sm">
                <Activity className="w-4 h-4" />
                <span>On track with your nutrition plan</span>
              </div>
            </>
          ) : (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-3">
                <Target className="w-8 h-8 text-white/60" />
              </div>
              <h3 className="text-lg font-semibold mb-1">No Active Goal</h3>
              <p className="text-white/60 text-sm mb-4">Set a goal to start tracking your progress</p>
            </div>
          )}
        </div>
      </div>

      {/* Daily Targets - Expandable */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <button 
          onClick={() => setExpandedSection(expandedSection === "macros" ? null : "macros")}
          className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white">
              <Zap className="w-5 h-5" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-slate-900">Daily Targets</h3>
              <p className="text-sm text-slate-500">Your nutrition goals</p>
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
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Body Metrics</h3>
              <p className="text-sm text-slate-500">Track your physical progress</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-sm text-slate-600">Current Weight</Label>
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
              <Label className="text-sm text-slate-600">Height</Label>
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
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Smart Adjustments</h3>
                <p className="text-sm text-slate-500">
                  {suggestions.length > 0
                    ? `${suggestions.length} suggestion${suggestions.length !== 1 ? "s" : ""} based on ${suggestions[0]?.daysAnalyzed ?? 0} days`
                    : "Goal optimization based on your data"}
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
              <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Applied History</p>
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
                  Analyzing your last 21 days…
                </div>
              ) : suggestions.length === 0 ? (
                <div className="text-sm text-slate-500 text-center py-3 space-y-1">
                  <p className="font-medium">
                    {activeGoal ? "Not enough data yet" : "No active goal"}
                  </p>
                  <p className="text-xs text-slate-400">
                    {activeGoal
                      ? "Log meals for at least 4 days to unlock personalized suggestions."
                      : "Set a nutrition goal first so we can analyze your progress."}
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
                        Apply {highConfidenceSuggestions.length} high-confidence changes
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
                                  <CheckCheck className="w-3 h-3" /> On track
                                </span>
                              ) : s.safetyBlock ? (
                                <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                                  <ShieldAlert className="w-3 h-3" /> Safety tip
                                </span>
                              ) : (
                                <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full", {
                                  "bg-emerald-100 text-emerald-700": s.confidence === "high",
                                  "bg-amber-100 text-amber-700": s.confidence === "medium",
                                  "bg-slate-100 text-slate-500": s.confidence === "low",
                                })}>
                                  {s.confidence === "high" ? "High confidence" : s.confidence === "medium" ? "Suggestion" : "Exploratory"}
                                </span>
                              )}
                              <span className="text-xs text-slate-400 capitalize">{s.category}</span>
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
                              {isExpanded ? "Hide impact" : "Expected impact"}
                            </button>
                            {!s.safetyBlock && (
                              <Button
                                size="sm"
                                variant={s.confidence === "high" ? "default" : "outline"}
                                className="rounded-xl text-xs h-8 px-4 shrink-0"
                                disabled={applyingId === s.id}
                                onClick={() => applyAdjustment(s)}
                              >
                                {applyingId === s.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Apply"}
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
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Milestones</h3>
              <p className="text-sm text-slate-500">{milestones.filter(m => m.achieved).length} of {milestones.length} achieved</p>
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
        Create New Goal
      </Button>

      {/* Create Goal Modal */}
      {showCreateGoal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <Card className="w-full max-w-md max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold">Create New Goal</h3>
                <button 
                  onClick={() => setShowCreateGoal(false)}
                  className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center"
                >
                  <span className="text-2xl leading-none">&times;</span>
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <Label className="text-sm text-slate-600 mb-2 block">Goal Type</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(goalTypeConfig).map(([key, config]) => (
                      <button
                        key={key}
                        className="p-3 rounded-xl border-2 border-slate-100 hover:border-primary/50 transition-colors text-left"
                      >
                        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center mb-2", config.color.replace("text-", "bg-").replace("600", "100"))}>
                          <div className={config.color}>{config.icon}</div>
                        </div>
                        <p className="font-medium text-sm">{config.label}</p>
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-slate-600 mb-2 block">Target Weight (kg)</Label>
                    <Input type="number" placeholder="70" className="h-12 rounded-xl" />
                  </div>
                  <div>
                    <Label className="text-sm text-slate-600 mb-2 block">Target Date</Label>
                    <Input type="date" className="h-12 rounded-xl" />
                  </div>
                </div>
                
                <Button className="w-full h-12 rounded-xl">
                  Create Goal
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
