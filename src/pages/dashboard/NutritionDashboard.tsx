import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";
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

interface WeightLog {
  id: string;
  weight_kg: number;
  logged_at: string;
}

interface Adjustment {
  id: string;
  adjustment_type: string;
  ai_reason: string;
  confidence_score: number;
  was_accepted: boolean;
  created_at: string;
  previous_values: any;
  new_values: any;
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
  const [activeTab, setActiveTab] = useState<"overview" | "weight" | "adjustments">("overview");

  // Calculate weight change
  const calculateWeightChange = () => {
    if (weightLogs.length < 2) return 0;
    const latest = weightLogs[weightLogs.length - 1].weight_kg;
    const first = weightLogs[0].weight_kg;
    return parseFloat((latest - first).toFixed(1));
  };

  // Calculate average adherence
  const averageAdherence = () => {
    if (weeklyStats.length === 0) return 0;
    const total = weeklyStats.reduce((acc, week) => acc + week.adherence_rate, 0);
    return Math.round(total / weeklyStats.length);
  };

  // Fetch all data
  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch nutrition profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("target_calories, target_protein, target_carbs, target_fats, bmr, tdee")
        .eq("id", user.id)
        .single();

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

      // Fetch weight logs (last 30 days)
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
      const { data: weightData } = await supabase
        .from("weight_logs")
        .select("id, weight_kg, logged_at")
        .eq("user_id", user.id)
        .gte("logged_at", thirtyDaysAgo)
        .order("logged_at", { ascending: true });

      setWeightLogs(weightData || []);

      // Fetch AI adjustments
      const { data: adjustmentData } = await supabase
        .from("ai_nutrition_adjustments")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5);

      setAdjustments(adjustmentData || []);

      // Fetch weekly adherence
      const { data: adherenceData } = await supabase
        .from("weekly_adherence")
        .select("week_start, adherence_rate, meals_planned, meals_ordered")
        .eq("user_id", user.id)
        .order("week_start", { ascending: false })
        .limit(4);

      setWeeklyStats(adherenceData || []);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Generate adjustment recommendation
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

      if (data.recommendation.type !== "no_change") {
        toast.success("AI adjustment recommendation ready!");
        await fetchDashboardData();
      } else {
        toast.info("No adjustment needed at this time");
      }
    } catch (error) {
      toast.error("Failed to generate adjustment");
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Prepare chart data
  const weightChartData = weightLogs.map(log => ({
    date: format(new Date(log.logged_at), "MMM d"),
    weight: log.weight_kg,
  }));

  const macroData = nutritionData ? [
    { name: "Protein", value: nutritionData.target_protein, color: COLORS[0] },
    { name: "Carbs", value: nutritionData.target_carbs, color: COLORS[1] },
    { name: "Fats", value: nutritionData.target_fats, color: COLORS[2] },
  ] : [];

  const weightChange = calculateWeightChange();
  const avgAdherence = averageAdherence();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 pb-20">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-emerald-900 via-teal-900 to-cyan-900 text-white py-12 px-4">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-emerald-400 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-cyan-400 rounded-full blur-3xl" />
        </div>
        
        <div className="relative max-w-6xl mx-auto">
          <div className="flex items-center justify-between">
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
              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              onClick={handleRequestAdjustment}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Request AI Adjustment
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Tab Navigation */}
        <div className="flex gap-2 mb-8">
          {[
            { id: "overview", label: "Overview", icon: Target },
            { id: "weight", label: "Weight Progress", icon: TrendingDown },
            { id: "adjustments", label: "AI Adjustments", icon: Target },
          ].map((tab) => (
            <Button
              key={tab.id}
              variant={activeTab === tab.id ? "default" : "outline"}
              className={cn(
                "flex-1",
                activeTab === tab.id 
                  ? "bg-emerald-600 hover:bg-emerald-700" 
                  : "hover:bg-slate-100"
              )}
              onClick={() => setActiveTab(tab.id as any)}
            >
              <tab.icon className="w-4 h-4 mr-2" />
              {tab.label}
            </Button>
          ))}
        </div>

        {activeTab === "overview" && (
          <>
            {/* Stats Grid */}
            <div className="grid md:grid-cols-4 gap-4 mb-8">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-600">Weight Change</span>
                    {weightChange < 0 ? (
                      <TrendingDown className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <TrendingUp className="w-4 h-4 text-blue-500" />
                    )}
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className={cn(
                      "text-2xl font-bold",
                      weightChange < 0 ? "text-emerald-600" : "text-blue-600"
                    )}>
                      {weightChange > 0 ? "+" : ""}{weightChange}
                    </span>
                    <span className="text-sm text-slate-500">kg</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Last 30 days</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-600">Plan Adherence</span>
                    <Calendar className="w-4 h-4 text-violet-500" />
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-violet-600">
                      {avgAdherence}
                    </span>
                    <span className="text-sm text-slate-500">%</span>
                  </div>
                  <Progress value={avgAdherence} className="mt-2 h-2" />
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-600">Daily Calories</span>
                    <Flame className="w-4 h-4 text-orange-500" />
                  </div>
                  <div className="text-2xl font-bold text-orange-600">
                    {nutritionData?.target_calories || 2000}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Target</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-600">AI Adjustments</span>
                  </div>
                  <div className="text-2xl font-bold text-amber-600">
                    {adjustments.length}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Total made</p>
                </CardContent>
              </Card>
            </div>

            {/* Macro Distribution */}
            <div className="grid md:grid-cols-2 gap-8 mb-8">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-emerald-500" />
                    Macro Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {nutritionData && (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={macroData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {macroData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  <div className="flex justify-center gap-4 mt-4">
                    {macroData.map((macro) => (
                      <div key={macro.name} className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: macro.color }}
                        />
                        <span className="text-sm text-slate-600">
                          {macro.name}: {macro.value}g
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Weekly Adherence */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-violet-500" />
                    Weekly Adherence
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {weeklyStats.length > 0 ? (
                    weeklyStats.map((week) => (
                      <div key={week.week_start} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-600">
                            Week of {format(new Date(week.week_start), "MMM d")}
                          </span>
                          <span className="font-medium text-slate-900">
                            {Math.round(week.adherence_rate)}%
                          </span>
                        </div>
                        <Progress value={week.adherence_rate} className="h-2" />
                        <p className="text-xs text-slate-400">
                          {week.meals_ordered} / {week.meals_planned} meals ordered
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-slate-400">
                      <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No weekly data yet</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {activeTab === "weight" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-emerald-500" />
                Weight Progress (Last 30 Days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {weightLogs.length > 1 ? (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={weightChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis 
                        dataKey="date" 
                        stroke="#64748b"
                        fontSize={12}
                      />
                      <YAxis 
                        stroke="#64748b"
                        fontSize={12}
                        domain={["dataMin - 1", "dataMax + 1"]}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: "white", 
                          border: "1px solid #e2e8f0",
                          borderRadius: "8px"
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="weight"
                        stroke="#10b981"
                        strokeWidth={2}
                        dot={{ fill: "#10b981", strokeWidth: 2 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="text-center py-16">
                  <TrendingDown className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                  <p className="text-slate-600 mb-2">Start tracking your weight</p>
                  <p className="text-sm text-slate-400">
                    Log your weight regularly to see progress
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === "adjustments" && (
          <div className="space-y-4">
            {adjustments.length > 0 ? (
              adjustments.map((adjustment) => (
                <Card 
                  key={adjustment.id}
                  className={cn(
                    "transition-all hover:shadow-lg",
                    adjustment.was_accepted ? "border-emerald-200 bg-emerald-50/30" : ""
                  )}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge 
                            variant={adjustment.was_accepted ? "default" : "secondary"}
                            className={cn(
                              adjustment.was_accepted 
                                ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" 
                                : ""
                            )}
                          >
                            {adjustment.was_accepted ? (
                              <>
                                <Award className="w-3 h-3 mr-1" />
                                Applied
                              </>
                            ) : (
                              "Pending"
                            )}
                          </Badge>
                          <span className="text-sm text-slate-400">
                            {format(new Date(adjustment.created_at), "MMM d, yyyy")}
                          </span>
                        </div>
                        
                        <h3 className="font-semibold text-slate-900 mb-2 capitalize">
                          {adjustment.adjustment_type} Adjustment
                        </h3>
                        
                        <p className="text-slate-600 text-sm mb-3">
                          {adjustment.ai_reason}
                        </p>

                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-1 text-slate-500">
                            Confidence: {Math.round((adjustment.confidence_score || 0) * 100)}%
                          </div>
                          {adjustment.previous_values && adjustment.new_values && (
                            <div className="flex items-center gap-2">
                              <span className="text-slate-400">
                                {adjustment.previous_values.calories} → {adjustment.new_values.calories} cal
                              </span>
                              <ChevronRight className="w-4 h-4 text-slate-400" />
                            </div>
                          )}
                        </div>
                      </div>

                      {!adjustment.was_accepted && (
                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                          Review
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
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
          </div>
        )}

        {/* Quick Actions */}
        <div className="mt-8 grid md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200">
            <CardContent className="p-6">
              <h3 className="font-semibold text-emerald-900 mb-2 flex items-center gap-2">
                <Target className="w-5 h-5" />
                Update Goals
              </h3>
              <p className="text-sm text-emerald-700 mb-4">
                Changed your fitness goals? Update your targets.
              </p>
              <Button variant="outline" className="w-full border-emerald-300 text-emerald-700 hover:bg-emerald-100">
                Edit Profile
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-violet-50 to-purple-50 border-violet-200">
            <CardContent className="p-6">
              <h3 className="font-semibold text-violet-900 mb-2 flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                View Meal Plan
              </h3>
              <p className="text-sm text-violet-700 mb-4">
                Check your AI-generated weekly meal plan.
              </p>
              <Button variant="outline" className="w-full border-violet-300 text-violet-700 hover:bg-violet-100">
                Open Planner
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
            <CardContent className="p-6">
              <h3 className="font-semibold text-amber-900 mb-2 flex items-center gap-2">
                <Dumbbell className="w-5 h-5" />
                Log Weight
              </h3>
              <p className="text-sm text-amber-700 mb-4">
                Track your progress with regular weigh-ins.
              </p>
              <Button variant="outline" className="w-full border-amber-300 text-amber-700 hover:bg-amber-100">
                Add Entry
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
