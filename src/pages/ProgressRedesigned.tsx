import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Flame,
  Droplets,
  Target,
  TrendingUp,
  ChevronRight,
  Award,
  Utensils,
  Scale,
  Trophy,
  Plus,
} from "lucide-react";
import { format, subDays } from "date-fns";
import { CustomerNavigation } from "@/components/CustomerNavigation";
import { cn } from "@/lib/utils";

// Hooks
import { useWeeklySummary } from "@/hooks/useWeeklySummary";
import { useWaterIntake } from "@/hooks/useWaterIntake";
import { useStreak } from "@/hooks/useStreak";
import { useBodyMeasurements } from "@/hooks/useBodyMeasurements";
import { useNutritionGoals } from "@/hooks/useNutritionGoals";
import { useMealQuality } from "@/hooks/useMealQuality";
import { useWeeklyReport } from "@/hooks/useWeeklyReport";
import { useSmartRecommendations } from "@/hooks/useSmartRecommendations";

interface DashboardMetric {
  id: string;
  label: string;
  value: string | number;
  subValue?: string;
  icon: React.ReactNode;
  color: string;
  progress?: number;
  onClick?: () => void;
}

const ProgressDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  useProfile(); // Hook called for side effects
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"today" | "week" | "goals">("today");

  // Data hooks
  const { summary: weeklySummary } = useWeeklySummary(user?.id);
  const { dailySummary: waterSummary, loading: waterLoading, addWater } = useWaterIntake(user?.id);
  const { streaks } = useStreak(user?.id);
  const { latestMeasurement } = useBodyMeasurements(user?.id);
  const { activeGoal, milestones, loading: goalsLoading } = useNutritionGoals(user?.id);
  const { averageScore, loading: qualityLoading } = useMealQuality(user?.id);
  const { currentWeekReport, loading: reportLoading } = useWeeklyReport(user?.id);
  const { recommendations } = useSmartRecommendations(user?.id);

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

  // Today's stats
  const todayCalories = todayStats.calories;
  const todayProtein = todayStats.protein;
  const dailyCalorieTarget = activeGoal?.daily_calorie_target || 2000;
  const dailyProteinTarget = activeGoal?.protein_target_g || 120;

  // Calculate progress percentages
  const calorieProgress = Math.min(100, Math.round((todayCalories / dailyCalorieTarget) * 100));
  const proteinProgress = Math.min(100, Math.round((todayProtein / dailyProteinTarget) * 100));
  const waterProgress = waterSummary?.percentage || 0;

  // Dashboard metrics
  const getMetrics = (): DashboardMetric[] => [
    {
      id: "calories",
      label: "Calories",
      value: todayCalories,
      subValue: `/${dailyCalorieTarget}`,
      icon: <Flame className="w-5 h-5" />,
      color: "bg-orange-500",
      progress: calorieProgress,
    },
    {
      id: "protein",
      label: "Protein",
      value: `${todayProtein}g`,
      subValue: `/${dailyProteinTarget}g`,
      icon: <Target className="w-5 h-5" />,
      color: "bg-blue-500",
      progress: proteinProgress,
    },
    {
      id: "water",
      label: "Water",
      value: `${waterSummary?.total || 0}`,
      subValue: "/8 glasses",
      icon: <Droplets className="w-5 h-5" />,
      color: "bg-cyan-500",
      progress: waterProgress,
    },
    {
      id: "streak",
      label: "Streak",
      value: streaks?.logging?.currentStreak || 0,
      subValue: "days",
      icon: <Flame className="w-5 h-5" />,
      color: "bg-red-500",
    },
  ];

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
            {/* Hero Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
              {getMetrics().map((metric) => (
                <Card
                  key={metric.id}
                  className="border-0 shadow-sm active:scale-[0.98] transition-transform"
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className={cn("p-2 rounded-lg", metric.color.replace("bg-", "bg-opacity-10 bg-"))}>
                        <div className={cn("text-white", metric.color)}>
                          {metric.icon}
                        </div>
                      </div>
                      <span className="text-2xl font-bold text-slate-900">
                        {metric.value}
                        <span className="text-sm font-normal text-slate-400">
                          {metric.subValue}
                        </span>
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 mb-2">{metric.label}</p>
                    {metric.progress !== undefined && (
                      <div className="space-y-1">
                        <Progress value={metric.progress} className="h-1.5" />
                        <p className="text-xs text-slate-400 text-right">{metric.progress}%</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
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
                    onClick={() => navigate("/meals")}
                  >
                    <Utensils className="w-4 h-4 mr-1" />
                    Log Meal
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-12"
                    onClick={() => navigate("/progress?tab=weight")}
                  >
                    <Scale className="w-4 h-4 mr-1" />
                    Weight
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
          </>
        )}

        {/* WEEK TAB */}
        {activeTab === "week" && (
          <>
            {/* Weekly Summary */}
            {weeklySummary && (
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <h3 className="font-semibold text-slate-900 mb-4">This Week</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-slate-900">
                        {Math.round(weeklySummary.calories.thisWeekAvg)}
                      </p>
                      <p className="text-xs text-slate-500">Avg Calories</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-slate-900">
                        {weeklySummary.consistency.daysLogged}
                      </p>
                      <p className="text-xs text-slate-500">Days Logged</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-slate-900">
                        {weeklySummary.consistency.percentage}%
                      </p>
                      <p className="text-xs text-slate-500">Consistency</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Weekly Report */}
            {currentWeekReport && !reportLoading && (
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-slate-900">Weekly Report</h3>
                    <span className="text-xs text-slate-400">
                      {format(subDays(new Date(), 7), "MMM d")} - {format(new Date(), "MMM d")}
                    </span>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Avg Calories</span>
                      <span className="font-semibold">{Math.round(currentWeekReport.avg_calories)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Protein</span>
                      <span className="font-semibold">{Math.round(currentWeekReport.avg_protein)}g</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Consistency</span>
                      <span className="font-semibold">{currentWeekReport.consistency_score}%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Body Measurements Summary */}
            {latestMeasurement && (
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500">Current Weight</p>
                      <p className="text-2xl font-bold text-slate-900">
                        {latestMeasurement.weight_kg} kg
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" className="text-slate-400">
                      <ChevronRight className="w-5 h-5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* GOALS TAB */}
        {activeTab === "goals" && (
          <>
            {/* Active Goal */}
            {activeGoal && !goalsLoading && (
              <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-teal-50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Target className="w-5 h-5 text-emerald-600" />
                    <h3 className="font-semibold text-emerald-900">Active Goal</h3>
                  </div>
                  <p className="text-lg font-medium text-slate-900 capitalize mb-4">
                    {activeGoal.goal_type.replace("_", " ")}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white/50 rounded-lg p-3">
                      <p className="text-xs text-slate-500">Daily Calories</p>
                      <p className="text-lg font-bold">{activeGoal.daily_calorie_target}</p>
                    </div>
                    <div className="bg-white/50 rounded-lg p-3">
                      <p className="text-xs text-slate-500">Protein Target</p>
                      <p className="text-lg font-bold">{activeGoal.protein_target_g}g</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Milestones */}
            {milestones.length > 0 && (
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-amber-500" />
                    Milestones
                  </h3>
                  <div className="space-y-3">
                    {milestones.slice(0, 3).map((milestone) => (
                      <div
                        key={milestone.id}
                        className="flex items-center gap-3 p-3 rounded-lg bg-slate-50"
                      >
                        <div
                          className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                            milestone.achieved_at
                              ? "bg-amber-100 text-amber-600"
                              : "bg-slate-200 text-slate-400"
                          )}
                        >
                          <Award className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-slate-900">
                            {milestone.description}
                          </p>
                          {milestone.achieved_at && (
                            <p className="text-xs text-amber-600">Achieved!</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Add Goal Button */}
            <Button
              className="w-full h-12"
              onClick={() => setActiveTab("goals")}
            >
              <Plus className="w-5 h-5 mr-2" />
              Manage Goals
            </Button>
          </>
        )}
      </main>

      <CustomerNavigation />
    </div>
  );
};

export default ProgressDashboard;
