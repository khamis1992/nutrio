import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { GoalsManagement } from "@/components/GoalsManagement";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft,
  Flame,
  Droplets,
  Target,
  TrendingUp,
  TrendingDown,
  Scale,
  Droplet,
  Trophy,
  Trash2,
} from "lucide-react";
import { format, subDays } from "date-fns";

import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { ProgressRings } from "@/components/progress/ProgressRings";
import { ProfessionalWeeklyReport } from "@/components/progress/ProfessionalWeeklyReport";
import { WeeklyReportData } from "@/lib/professional-weekly-report-pdf";
import { nutrioReportPDF } from "@/lib/nutrio-report-pdf";
import { generateWeeklyMealPlan, loadMealPlanImages } from "@/lib/meal-plan-generator";

// Hooks
import { useWeeklySummary } from "@/hooks/useWeeklySummary";
import { useWaterIntake } from "@/hooks/useWaterIntake";
import { useStreak } from "@/hooks/useStreak";
import { useBodyMeasurements } from "@/hooks/useBodyMeasurements";
import { useNutritionGoals } from "@/hooks/useNutritionGoals";
import { useMealQuality } from "@/hooks/useMealQuality";
import { useSmartRecommendations } from "@/hooks/useSmartRecommendations";

const ProgressNative = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  useProfile();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") as "today" | "week" | "weight" | "goals" | null;
  const [activeTab, setActiveTab] = useState<"today" | "week" | "weight" | "goals">(initialTab || "today");
  
  // Update URL when tab changes
  const handleTabChange = (tab: "today" | "week" | "weight" | "goals") => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };
  const [generatingReport, setGeneratingReport] = useState(false);
  const [showWeightView, setShowWeightView] = useState(false);
  const [weightEntries, setWeightEntries] = useState<any[]>([]);
  const [currentWeight, setCurrentWeight] = useState("");
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAllEntries, setShowAllEntries] = useState(false);
  const [dailyData, setDailyData] = useState<WeeklyReportData['dailyData']>([]);

  // Data hooks
  const { summary: weeklySummary } = useWeeklySummary(user?.id);
  const { dailySummary: waterSummary, loading: waterLoading, addWater } = useWaterIntake(user?.id);
  const { streaks } = useStreak(user?.id);
  const { latestMeasurement } = useBodyMeasurements(user?.id);
  const { activeGoal, milestones } = useNutritionGoals(user?.id);
  const { averageScore } = useMealQuality(user?.id);
  const { recommendations, refresh: refreshRecommendations } = useSmartRecommendations(user?.id);

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

  const dailyCalorieTarget = activeGoal?.daily_calorie_target || 2000;
  const dailyProteinTarget = activeGoal?.protein_target_g || 120;

  const calorieProgress = Math.min(100, Math.round((todayStats.calories / dailyCalorieTarget) * 100));
  const proteinProgress = Math.min(100, Math.round((todayStats.protein / dailyProteinTarget) * 100));

  const handleQuickWaterAdd = async (amount: number) => {
    try {
      await addWater(amount);
      toast({ title: t("water_added"), description: `+${amount} ${t("glasses")}` });
    } catch (error) {
      toast({ title: t("failed_add_water"), variant: "destructive" });
    }
  };

  const handleDownloadReport = async () => {
    if (!user || !weeklySummary) {
      toast({ title: t("no_data_available"), variant: "destructive" });
      return;
    }

    setGeneratingReport(true);
    try {
      const weekStart = subDays(new Date(), 7);
      const weekEnd = new Date();

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
        ? lastWeekLogs.reduce((sum, log) => sum + (log.calories_consumed || 0), 0) / lastWeekLogs.length
        : 0;

      const dailyData: WeeklyReportData['dailyData'] = [];
      for (let i = 0; i < 7; i++) {
        const date = subDays(weekEnd, i);
        const dateStr = date.toISOString().split('T')[0];
        const log = dailyLogs?.find((l: any) => l.log_date === dateStr);
        const waterLog = waterLogs?.find((w: any) => w.log_date === dateStr);
        
        dailyData.unshift({
          date: dateStr,
          calories: log?.calories_consumed || 0,
          protein: log?.protein_consumed_g || 0,
          carbs: log?.carbs_consumed_g || 0,
          fat: log?.fat_consumed_g || 0,
          weight: log?.weight_kg || null,
          water: waterLog?.glasses || 0,
        });
      }

      const weightChange = latestMeasurement?.weight_kg && activeGoal?.target_weight_kg
        ? latestMeasurement.weight_kg - activeGoal.target_weight_kg
        : null;

      const weightProgress = activeGoal?.target_weight_kg && latestMeasurement?.weight_kg
        ? ((latestMeasurement.weight_kg - (activeGoal.target_weight_kg + 20)) / 20) * 100
        : 0;

      const reportData: WeeklyReportData = {
        userName: user.email?.split('@')[0] || 'User',
        userEmail: user.email || '',
        reportDate: new Date().toISOString(),
        weekStart: weekStart.toISOString(),
        weekEnd: weekEnd.toISOString(),
        currentWeight: latestMeasurement?.weight_kg || null,
        weightChange: weightChange,
        weightGoal: activeGoal?.target_weight_kg || null,
        weightProgress: Math.max(0, Math.min(100, weightProgress)),
        avgCalories: weeklySummary?.calories.thisWeekAvg || 0,
        calorieTarget: dailyCalorieTarget,
        calorieProgress: calorieProgress,
        avgProtein: weeklySummary?.macros.protein.consumed || 0,
        proteinTarget: dailyProteinTarget,
        avgCarbs: weeklySummary?.macros.carbs.consumed || 0,
        carbsTarget: 250,
        avgFat: weeklySummary?.macros.fat.consumed || 0,
        fatTarget: 65,
        dailyData: dailyData,
        consistencyScore: weeklySummary?.consistency.percentage || 0,
        daysLogged: weeklySummary?.consistency.daysLogged || 0,
        totalDays: 7,
        mealQualityScore: averageScore || 0,
        waterAverage: dailyData.reduce((sum, d) => sum + d.water, 0) / 7,
        currentStreak: streaks?.logging?.currentStreak || 0,
        bestStreak: streaks?.logging?.bestStreak || 0,
        activeGoal: activeGoal?.goal_type || null,
        goalProgress: activeGoal?.target_weight_kg && latestMeasurement?.weight_kg
          ? Math.round(((activeGoal.target_weight_kg + 20 - latestMeasurement.weight_kg) / 20) * 100)
          : 0,
        milestonesAchieved: milestones.filter(m => m.achieved_at).length,
        totalMilestones: milestones.length,
        insights: recommendations.slice(0, 3).map(r => r.description),
        recommendations: recommendations.slice(0, 3).map(r => `${r.title}: ${r.description}`),
        vsLastWeek: {
          calories: weeklySummary ? weeklySummary.calories.thisWeekAvg - lastWeekAvg : 0,
          weight: weightChange || 0,
          consistency: weeklySummary?.consistency.percentage || 0,
        },
      };

      // Generate meal plan and load images for PDF
      const mealPlan = await generateWeeklyMealPlan(dailyCalorieTarget, dailyProteinTarget);
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
      reportData.mealPlan = mealPlanWithEmbeddedImages;
      reportData.mealImages = mealImages;

      await nutrioReportPDF.download(reportData);
      toast({ title: t("report_downloaded"), description: t("report_saved") });
    } catch (error) {
      console.error("Error generating report:", error);
      toast({ title: t("failed_generate_report"), variant: "destructive" });
    } finally {
      setGeneratingReport(false);
    }
  };

  
  // Weight tracking
  const fetchWeightEntries = async () => {
    if (!user) return;
    const { data } = await supabase.from("body_measurements").select("*").eq("user_id", user.id).order("log_date", { ascending: false });
    setWeightEntries(data || []);
  };

  const handleAddWeight = async () => {
    if (!user || !currentWeight) return;
    const weight = parseFloat(currentWeight);
    if (isNaN(weight) || weight <= 0) return;
    setIsSubmitting(true);
    await supabase.from("body_measurements").upsert({ user_id: user.id, weight_kg: weight, log_date: selectedDate }, { onConflict: "user_id,log_date" });
    setCurrentWeight("");
    fetchWeightEntries();
    setIsSubmitting(false);
  };

  const handleDeleteWeight = async (id: string) => {
    await supabase.from("body_measurements").delete().eq("id", id);
    fetchWeightEntries();
  };

  const weightStats = {
    current: weightEntries[0]?.weight_kg,
    change: weightEntries.length > 1 ? weightEntries[0].weight_kg - weightEntries[weightEntries.length - 1].weight_kg : 0,
    count: weightEntries.length
  };
return (
    <div className="min-h-screen bg-background pb-24">
      {/* Native App Header with App Colors */}
      <header className="sticky top-0 z-50 bg-gradient-to-r from-primary to-accent pt-safe">
        <div className="flex items-center justify-between px-4 h-14 rtl:flex-row-reverse">
          <button
            onClick={() => navigate("/dashboard")}
            className="p-2 -ml-2 rounded-full hover:bg-white/20 active:scale-95 transition-all"
          >
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <h1 className="text-lg font-semibold text-white tracking-wide">{t("progress")}</h1>
          <div className="w-10" />
        </div>

        {/* Segmented Control */}
        <div className="px-4 pb-3">
          <div className="flex rounded-lg p-1 bg-white/20">
            {(["today", "week", "goals"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => handleTabChange(tab)}
                className={cn(
                  "flex-1 py-2.5 px-4 text-sm font-medium rounded-md transition-all duration-300",
                  activeTab === tab
                    ? "bg-white text-primary shadow-sm"
                    : "text-white/80 hover:text-white"
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
            {showWeightView ? (
              <>
                {/* Weight View Header */}
                <div className="flex items-center gap-3 mb-4 rtl:flex-row-reverse">
                  <button onClick={() => setShowWeightView(false)} className="p-2 -ml-2 rounded-full hover:bg-muted">
                    <ArrowLeft className="w-6 h-6" />
                  </button>
                  <h2 className="text-lg font-semibold">{t("weight_tracking")}</h2>
                </div>

                {/* Current Weight Card */}
                <Card className="border-0 overflow-hidden bg-gradient-to-br from-primary to-accent">
                  <CardContent className="p-6">
                    <div className="text-center">
                      <p className="text-white/80 text-sm mb-1">{t("current_weight")}</p>
                      <div className="flex items-baseline justify-center gap-2">
                        <span className="text-5xl font-bold text-white">{weightStats.current?.toFixed(1) || latestMeasurement?.weight_kg || "--"}</span>
                        <span className="text-lg text-white/80">kg</span>
                      </div>
                      {weightStats.change !== 0 && (
                        <div className={`flex items-center justify-center gap-1 mt-2 px-3 py-1 rounded-full bg-white/20 w-fit mx-auto ${weightStats.change < 0 ? 'text-green-300' : 'text-red-300'}`}>
                          {weightStats.change < 0 ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
                          <span className="text-sm font-medium">{Math.abs(weightStats.change).toFixed(1)} kg {weightStats.change < 0 ? t("weight_lost") : t("weight_gained")}</span>
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-3 mt-6 pt-6 border-t border-white/20">
                      <div className="text-center"><p className="text-white/70 text-xs">{t("goal")}</p><p className="text-white font-bold">{activeGoal?.target_weight_kg || "--"}</p></div>
                      <div className="text-center"><p className="text-white/70 text-xs">{t("entries")}</p><p className="text-white font-bold">{weightStats.count}</p></div>
                      <div className="text-center"><p className="text-white/70 text-xs">BMI</p><p className="text-white font-bold">--</p></div>
                    </div>
                  </CardContent>
                </Card>

                {/* Log Weight Form */}
                <Card className="border-0">
                  <CardContent className="p-4 space-y-3">
                    <div><Label className="text-sm">{t("weight_date_label")}</Label><Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="mt-1" /></div>
                    <div><Label className="text-sm">{t("weight_input_label")}</Label>
                      <div className="flex gap-2 mt-1">
                        <Input type="number" step="0.1" placeholder="0.0" value={currentWeight} onChange={(e) => setCurrentWeight(e.target.value)} className="flex-1" />
                        <Button onClick={handleAddWeight} disabled={isSubmitting || !currentWeight}>{isSubmitting ? "..." : t("add_entry")}</Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Weight History */}
                <Card className="border-0">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{t("history")}</CardTitle>
                      <Button variant="ghost" size="sm" onClick={() => setShowAllEntries(!showAllEntries)}>{showAllEntries ? t("show_less") : t("show_all")}</Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {(showAllEntries ? weightEntries : weightEntries.slice(0, 5)).map((entry) => (
                        <div key={entry.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center"><Scale className="w-5 h-5 text-primary" /></div>
                            <div>
                              <p className="font-semibold">{entry.weight_kg?.toFixed(1)} kg</p>
                              <p className="text-xs text-muted-foreground">{format(new Date(entry.log_date), "MMM dd, yyyy")}</p>
                            </div>
                          </div>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteWeight(entry.id)}><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      ))}
                      {weightEntries.length === 0 && <p className="text-center text-muted-foreground py-4">{t("no_weight_entries")}</p>}
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <>
            {/* Weight Status Card */}
            <Card className="border-0 overflow-hidden bg-gradient-to-br from-muted to-secondary transition-transform active:scale-[0.98]">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{t("current_weight")}</p>
                    <p className="text-3xl font-bold mt-1 text-foreground">
                      {latestMeasurement?.weight_kg || "--"} 
                      <span className="text-lg font-normal text-muted-foreground">kg</span>
                    </p>
                    {activeGoal?.target_weight_kg && (
                      <p className="text-xs mt-1 text-accent">{t("goal")}: {activeGoal.target_weight_kg}kg</p>
                    )}
                  </div>
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <Scale className="w-8 h-8 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Progress Rings - Overall Progress */}
            <ProgressRings
              weeklySummary={weeklySummary}
              waterPercentage={waterSummary?.percentage || 0}
              mealQualityScore={averageScore || 0}
              loading={false}
            />

            {/* Nutrition Dashboard - 2x2 Grid */}
            <div>
              <h2 className="text-sm font-semibold mb-3 px-1 text-foreground">{t("today_nutrition")}</h2>
              <div className="grid grid-cols-2 gap-3">
                {/* Calories */}
                <Card className="border-0 bg-muted transition-transform active:scale-[0.98]">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-full bg-warning/20 flex items-center justify-center">
                        <Flame className="w-4 h-4 text-warning" />
                      </div>
                      <span className="text-xs font-medium text-muted-foreground">{t("calories")}</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">
                      {todayStats.calories}
                      <span className="text-xs font-normal ml-1 text-muted-foreground">/{dailyCalorieTarget}</span>
                    </p>
                    <div className="mt-2">
                      <div className="h-1.5 rounded-full overflow-hidden bg-border">
                        <div 
                          className="h-full rounded-full transition-all duration-500 bg-warning"
                          style={{ width: `${calorieProgress}%` }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Protein */}
                <Card className="border-0 bg-muted transition-transform active:scale-[0.98]">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                        <Target className="w-4 h-4 text-primary" />
                      </div>
                      <span className="text-xs font-medium text-muted-foreground">{t("protein")}</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">
                      {Math.round(todayStats.protein)}g
                      <span className="text-xs font-normal ml-1 text-muted-foreground">/{dailyProteinTarget}g</span>
                    </p>
                    <div className="mt-2">
                      <div className="h-1.5 rounded-full overflow-hidden bg-border">
                        <div 
                          className="h-full rounded-full transition-all duration-500 bg-primary"
                          style={{ width: `${proteinProgress}%` }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Water */}
                <Card className="border-0 bg-muted transition-transform active:scale-[0.98]">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-full bg-cyan-500/15 flex items-center justify-center">
                        <Droplet className="w-4 h-4 text-cyan-500" />
                      </div>
                      <span className="text-xs font-medium text-muted-foreground">{t("water")}</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">
                      {waterSummary?.total || 0}
                      <span className="text-xs font-normal ml-1 text-muted-foreground">/8 glasses</span>
                    </p>
                    <div className="mt-2 flex gap-1">
                      {[...Array(8)].map((_, i) => (
                        <div 
                          key={i}
                          className="h-1.5 flex-1 rounded-full"
                          style={{ 
                            backgroundColor: i < (waterSummary?.total || 0) 
                              ? "hsl(199 89% 48%)" 
                              : "hsl(var(--border))"
                          }}
                        />
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Meal Quality */}
                <Card className="border-0 bg-muted transition-transform active:scale-[0.98]">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                        <Trophy className="w-4 h-4 text-primary" />
                      </div>
                      <span className="text-xs font-medium text-muted-foreground">{t("quality")}</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <p className="text-2xl font-bold text-foreground">
                        {averageScore || 0}
                      </p>
                      <span className="text-xs text-muted-foreground">/100</span>
                    </div>
                    <p className="text-xs mt-2 text-muted-foreground">
                      {averageScore && averageScore >= 80 ? t("excellent_quality") : 
                       averageScore && averageScore >= 60 ? t("good_progress_quality") : t("keep_improving_quality")}
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Quick Actions */}
            <Card className="border-0 shadow-lg bg-gradient-to-r from-primary to-accent">
              <CardContent className="p-4">
                <p className="text-sm font-medium text-white/90 mb-3">{t("quick_log")}</p>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="flex-1 h-11 bg-white/20 text-white border-0 hover:bg-white/30"
                    onClick={() => handleQuickWaterAdd(1)}
                    disabled={waterLoading}
                  >
                    <Droplets className="w-4 h-4 mr-1.5" />
                    {t("water")}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="flex-1 h-11 bg-white/20 text-white border-0 hover:bg-white/30"
                    onClick={() => { setShowWeightView(true); fetchWeightEntries(); }}
                  >
                    <Scale className="w-4 h-4 mr-1.5" />
                    {t("weight")}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Streak Status */}
            <Card className="border-0 bg-muted transition-transform active:scale-[0.98]">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-warning/15 flex items-center justify-center">
                      <Flame className="w-6 h-6 text-warning" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">
                        {streaks?.logging?.currentStreak || 0} {t("day_streak")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("best_streak")}: {streaks?.logging?.bestStreak || 0} {t("days")}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-primary">
                      {weeklySummary?.consistency.percentage || 0}%
                    </p>
                    <p className="text-xs text-muted-foreground">{t("consistency")}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Smart Insight */}
            {recommendations.length > 0 && (
              <Card className="border-0 overflow-hidden bg-primary/5 border border-primary/20 transition-transform active:scale-[0.98]">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <TrendingUp className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm text-foreground">
                        {recommendations[0].title}
                      </p>
                      <p className="text-xs mt-1 leading-relaxed text-muted-foreground">
                        {recommendations[0].description}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
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
            onRefreshRecommendations={refreshRecommendations}
          />
        )}

        {/* GOALS TAB */}
        {activeTab === "goals" && (
          <GoalsManagement />
        )}
      </main>

    </div>
  );
};

export default ProgressNative;
