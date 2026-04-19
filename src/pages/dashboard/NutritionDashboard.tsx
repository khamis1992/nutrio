import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/accent-tabs";
import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  Flame, 
  Dumbbell, 
  Wheat, 
  Droplets,
  Calendar,
  Award,
  AlertCircle,
  ChevronRight,
  RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, subDays, isSameDay } from "date-fns";
import { DashboardStatsGrid } from "./components/DashboardStatsGrid";
import { WeightProgress } from "./components/WeightProgress";
import { MacroDistribution } from "./components/MacroDistribution";
import { WeeklyAdherence } from "./components/WeeklyAdherence";
import { AdjustmentItem } from "./components/AdjustmentItem";
import { QuickActions } from "./components/QuickActions";
import { StatsGridSkeleton, EmptyStateSkeleton } from "./components/DashboardSkeletons";
import { WeightChartSkeleton, MacroChartSkeleton, EmptyMacroState } from "./components/ChartSkeletons";
import { AdjustmentListSkeleton, EmptyAdjustmentsSkeleton } from "./components/AdjustmentSkeletons";

interface WeightLog {
  id: string;
  weight_kg: number;
  logged_at: string;
}

interface AdjustmentValues {
  calories?: number;
  protein?: number;
  carbs?: number;
  fats?: number;
}

interface Adjustment {
  id: string;
  adjustment_type: string;
  ai_reason: string;
  confidence_score: number;
  was_accepted: boolean;
  created_at: string;
  previous_values?: AdjustmentValues;
  new_values?: AdjustmentValues;
}

interface WeeklyStats {
  week_start: string;
  adherence_rate: number;
  meals_planned: number;
  meals_ordered: number;
}

interface NutritionData {
  target_calories: number;
  target_protein: number;
  target_carbs: number;
  target_fats: number;
  bmr: number;
  tdee: number;
}

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444"];

export default function NutritionDashboard() {
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats[]>([]);
  const [nutritionData, setNutritionData] = useState<NutritionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const calculateWeightChange = () => {
    if (weightLogs.length < 2) return 0;
    const latest = weightLogs[weightLogs.length - 1].weight_kg;
    const first = weightLogs[0].weight_kg;
    return parseFloat((latest - first).toFixed(1));
  };

  const averageAdherence = () => {
    if (weeklyStats.length === 0) return 0;
    const total = weeklyStats.reduce((acc, week) => acc + week.adherence_rate, 0);
    return Math.round(total / weeklyStats.length);
  };

  const fetchDashboardData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("target_calories, target_protein, target_carbs, target_fats, bmr, tdee")
        .eq("id", user.id)
        .single();

      if (profileError) throw profileError;

      if (profile) {
        setNutritionData({
          target_calories: profile.target_calories || 2000,
          target_protein: profile.target_protein || 150,
          target_carbs: profile.target_carbs || 200,
          target_fats: profile.target_fats || 65,
          bmr: profile.bmr || 1800,
          tdee: profile.tdee || 2200,
        });
      }

      const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
      const { data: weightData, error: weightError } = await supabase
        .from("weight_logs")
        .select("id, weight_kg, logged_at")
        .eq("user_id", user.id)
        .gte("logged_at", thirtyDaysAgo)
        .order("logged_at", { ascending: true });

      if (weightError) throw weightError;
      setWeightLogs(weightData || []);

      const { data: adjustmentData, error: adjustmentError } = await supabase
        .from("ai_nutrition_adjustments")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (adjustmentError) throw adjustmentError;
      setAdjustments(adjustmentData || []);

      const { data: adherenceData, error: adherenceError } = await supabase
        .from("weekly_adherence")
        .select("week_start, adherence_rate, meals_planned, meals_ordered")
        .eq("user_id", user.id)
        .order("week_start", { ascending: false })
        .limit(4);

      if (adherenceError) throw adherenceError;
      setWeeklyStats(adherenceData || []);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load dashboard data";
      console.error("Error fetching dashboard data:", errorMessage);
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestAdjustment = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase.functions.invoke("dynamic-adjustment-engine", {
        body: {
          user_id: user.id,
          auto_apply: false,
        },
      });

      if (error) throw error;

      if (data && "recommendation" in data && data.recommendation && "type" in data.recommendation && data.recommendation.type !== "no-change") {
        toast.success("AI adjustment recommendation ready!");
        await fetchDashboardData();
      } else {
        toast.info("No adjustment needed at this time");
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to generate adjustment";
      toast.error(errorMessage);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const weightChange = calculateWeightChange();
  const avgAdherence = averageAdherence();

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Something went wrong</h3>
            <p className="text-slate-600 mb-6">{error}</p>
            <Button onClick={fetchDashboardData} className="w-full">
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
        <div className="relative overflow-hidden bg-gradient-to-r from-emerald-900 via-teal-900 to-cyan-900 text-white py-12 px-4">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-0 right-1/4 w-96 h-96 bg-emerald-400 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-cyan-400 rounded-full blur-3xl" />
          </div>
          <div className="relative max-w-6xl mx-auto">
            <div className="flex items-center justify-between">
              <div>
                <Skeleton className="h-10 w-64 mb-2" />
                <Skeleton className="h-5 w-48" />
              </div>
              <Skeleton className="h-10 w-48 rounded-md" />
            </div>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-4 py-8">
          <Skeleton className="h-12 w-96 mb-8" />
          <StatsGridSkeleton />
          <div className="grid md:grid-cols-2 gap-8">
            <MacroChartSkeleton />
            <div className="p-6">
              <Skeleton className="h-6 w-40 mb-4" />
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                    <Skeleton className="h-2 w-full" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const macroData = nutritionData ? [
    { name: "Protein", value: nutritionData.target_protein, color: COLORS[0] },
    { name: "Carbs", value: nutritionData.target_carbs, color: COLORS[1] },
    { name: "Fats", value: nutritionData.target_fats, color: COLORS[2] },
  ] : [];

  const weightChartData = weightLogs.map(log => ({
    date: format(new Date(log.logged_at), "MMM d"),
    weight: log.weight_kg,
  }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 pb-20">
      <div className="relative overflow-hidden bg-gradient-to-r from-emerald-900 via-teal-900 to-cyan-900 text-white py-12 px-4">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-emerald-400 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-cyan-400 rounded-full blur-3xl" />
        </div>
        
        <div className="relative max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">
                Nutrition Dashboard
              </h1>
              <p className="text-emerald-100">
                Track your progress and AI-powered insights
              </p>
            </div>
            <Button
              variant="outline"
              className="bg-white/10 border-white/20 text-white hover:bg-white/20 transition-colors"
              onClick={handleRequestAdjustment}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Request AI Adjustment
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid grid-cols-3 mb-8 w-full max-w-md mx-auto">
            <TabsTrigger 
              value="overview" 
              className="data-[state=active]:font-semibold"
              aria-label="Overview tab"
            >
              <Target className="w-4 h-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger 
              value="weight" 
              className="data-[state=active]:font-semibold"
              aria-label="Weight progress tab"
            >
              <TrendingDown className="w-4 h-4 mr-2" />
              Weight Progress
            </TabsTrigger>
            <TabsTrigger 
              value="adjustments" 
              className="data-[state=active]:font-semibold"
              aria-label="AI adjustments tab"
            >
              <AlertCircle className="w-4 h-4 mr-2" />
              AI Adjustments
            </TabsTrigger>
          </TabsList>

          <TabsContent 
            value="overview" 
            className="space-y-6 focus-visible:outline-none"
          >
            <DashboardStatsGrid 
              weightLogs={weightLogs}
              adjustments={adjustments}
              weeklyStats={weeklyStats}
              nutritionData={nutritionData}
              calculateWeightChange={calculateWeightChange}
              averageAdherence={averageAdherence}
              onRefresh={fetchDashboardData}
            />

            <div className="grid md:grid-cols-2 gap-8">
              {nutritionData ? (
                <MacroDistribution nutritionData={nutritionData} />
              ) : (
                <EmptyMacroState />
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-violet-500" />
                    Weekly Adherence
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {weeklyStats.length > 0 ? (
                    <WeeklyAdherence weeklyStats={weeklyStats} />
                  ) : (
                    <div className="text-center py-8 text-slate-400">
                      <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No weekly data yet</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent 
            value="weight" 
            className="focus-visible:outline-none"
          >
            {weightLogs.length > 1 ? (
              <WeightProgress weightLogs={weightLogs} />
            ) : (
              <div className="text-center py-16">
                <TrendingDown className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                <p className="text-slate-600 mb-2">Start tracking your weight</p>
                <p className="text-sm text-slate-400">
                  Log your weight regularly to see progress
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent 
            value="adjustments" 
            className="space-y-4 focus-visible:outline-none"
          >
            {adjustments.length > 0 ? (
              <div className="space-y-4">
                {adjustments.map((adjustment) => (
                  <AdjustmentItem key={adjustment.id} adjustment={adjustment} />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">
                    No AI Adjustments Yet
                  </h3>
                  <p className="text-slate-600 mb-4 max-w-md mx-auto">
                    Our AI monitors your progress and suggests adjustments when needed. 
                    Continue tracking your meals and weight for personalized recommendations.
                  </p>
                  <Button 
                    variant="outline" 
                    onClick={handleRequestAdjustment}
                    className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                  >
                    Request AI Analysis
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        <QuickActions />
      </div>
    </div>
  );
}
