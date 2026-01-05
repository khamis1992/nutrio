import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
} from "recharts";
import {
  ArrowLeft,
  Scale,
  Target,
  TrendingUp,
  TrendingDown,
  Flame,
  Beef,
  Wheat,
  Droplets,
  Plus,
  Home,
  UtensilsCrossed,
  CalendarDays,
  Calendar,
  User,
} from "lucide-react";
import { format, subDays, parseISO, startOfWeek, endOfWeek, eachDayOfInterval } from "date-fns";

interface ProgressLog {
  id: string;
  log_date: string;
  weight_kg: number | null;
  calories_consumed: number | null;
  protein_consumed_g: number | null;
  carbs_consumed_g: number | null;
  fat_consumed_g: number | null;
  notes: string | null;
}

const Progress = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { toast } = useToast();
  const [logs, setLogs] = useState<ProgressLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [todayWeight, setTodayWeight] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<"weight" | "nutrition">("weight");

  useEffect(() => {
    if (profile && !profile.onboarding_completed) {
      navigate("/onboarding");
    }
  }, [profile, navigate]);

  useEffect(() => {
    fetchLogs();
  }, [user]);

  const fetchLogs = async () => {
    if (!user) return;

    setLoading(true);
    const thirtyDaysAgo = format(subDays(new Date(), 30), "yyyy-MM-dd");

    const { data, error } = await supabase
      .from("progress_logs")
      .select("*")
      .eq("user_id", user.id)
      .gte("log_date", thirtyDaysAgo)
      .order("log_date", { ascending: true });

    if (error) {
      console.error("Error fetching progress logs:", error);
    } else {
      setLogs(data || []);
      // Check if there's a log for today
      const today = format(new Date(), "yyyy-MM-dd");
      const todayLog = data?.find((log) => log.log_date === today);
      if (todayLog?.weight_kg) {
        setTodayWeight(todayLog.weight_kg.toString());
      }
    }
    setLoading(false);
  };

  const logWeight = async () => {
    if (!user || !todayWeight) return;

    setSubmitting(true);
    const today = format(new Date(), "yyyy-MM-dd");
    const weight = parseFloat(todayWeight);

    // Check if log exists for today
    const existingLog = logs.find((log) => log.log_date === today);

    if (existingLog) {
      const { error } = await supabase
        .from("progress_logs")
        .update({ weight_kg: weight })
        .eq("id", existingLog.id);

      if (error) {
        toast({
          title: "Error",
          description: "Failed to update weight",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Updated",
          description: "Weight logged successfully",
        });
        fetchLogs();
      }
    } else {
      const { error } = await supabase.from("progress_logs").insert({
        user_id: user.id,
        log_date: today,
        weight_kg: weight,
      });

      if (error) {
        toast({
          title: "Error",
          description: "Failed to log weight",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Weight logged successfully",
        });
        fetchLogs();
      }
    }
    setSubmitting(false);
  };

  // Calculate stats
  const weightLogs = logs.filter((log) => log.weight_kg !== null);
  const latestWeight = weightLogs[weightLogs.length - 1]?.weight_kg || profile?.current_weight_kg || 0;
  const startWeight = weightLogs[0]?.weight_kg || profile?.current_weight_kg || 0;
  const weightChange = latestWeight - startWeight;
  const targetWeight = profile?.target_weight_kg || 0;
  const remainingToGoal = targetWeight ? latestWeight - targetWeight : 0;

  // Weekly nutrition averages
  const thisWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const thisWeekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
  const thisWeekLogs = logs.filter((log) => {
    const logDate = parseISO(log.log_date);
    return logDate >= thisWeekStart && logDate <= thisWeekEnd;
  });

  const avgCalories = thisWeekLogs.length > 0
    ? Math.round(thisWeekLogs.reduce((sum, log) => sum + (log.calories_consumed || 0), 0) / thisWeekLogs.length)
    : 0;
  const avgProtein = thisWeekLogs.length > 0
    ? Math.round(thisWeekLogs.reduce((sum, log) => sum + (log.protein_consumed_g || 0), 0) / thisWeekLogs.length)
    : 0;
  const avgCarbs = thisWeekLogs.length > 0
    ? Math.round(thisWeekLogs.reduce((sum, log) => sum + (log.carbs_consumed_g || 0), 0) / thisWeekLogs.length)
    : 0;
  const avgFat = thisWeekLogs.length > 0
    ? Math.round(thisWeekLogs.reduce((sum, log) => sum + (log.fat_consumed_g || 0), 0) / thisWeekLogs.length)
    : 0;

  // Chart data
  const weightChartData = weightLogs.map((log) => ({
    date: format(parseISO(log.log_date), "MMM d"),
    weight: log.weight_kg,
    target: targetWeight,
  }));

  const nutritionChartData = logs
    .filter((log) => log.calories_consumed !== null)
    .map((log) => ({
      date: format(parseISO(log.log_date), "MMM d"),
      calories: log.calories_consumed,
      target: profile?.daily_calorie_target || 2000,
    }));

  const macroChartData = logs
    .filter((log) => log.protein_consumed_g !== null)
    .slice(-7)
    .map((log) => ({
      date: format(parseISO(log.log_date), "EEE"),
      protein: log.protein_consumed_g,
      carbs: log.carbs_consumed_g,
      fat: log.fat_consumed_g,
    }));

  const chartConfig = {
    weight: { label: "Weight", color: "hsl(var(--primary))" },
    target: { label: "Target", color: "hsl(var(--muted-foreground))" },
    calories: { label: "Calories", color: "hsl(38 92% 50%)" },
    protein: { label: "Protein", color: "hsl(0 84% 60%)" },
    carbs: { label: "Carbs", color: "hsl(38 92% 50%)" },
    fat: { label: "Fat", color: "hsl(200 80% 50%)" },
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center justify-between p-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/dashboard")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">Progress</h1>
          <div className="w-10" />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="p-4 space-y-6">
          {/* Weight Entry Card */}
          <Card className="p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Scale className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold">Log Today's Weight</h2>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(), "EEEE, MMMM d")}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <Label htmlFor="weight" className="sr-only">
                  Weight in kg
                </Label>
                <Input
                  id="weight"
                  type="number"
                  step="0.1"
                  placeholder="Enter weight in kg"
                  value={todayWeight}
                  onChange={(e) => setTodayWeight(e.target.value)}
                />
              </div>
              <Button onClick={logWeight} disabled={!todayWeight || submitting}>
                <Plus className="h-4 w-4 mr-1" />
                Log
              </Button>
            </div>
          </Card>

          {/* Stats Overview */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Scale className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Current</span>
              </div>
              <p className="text-2xl font-bold">{latestWeight.toFixed(1)} kg</p>
              {weightChange !== 0 && (
                <div className={`flex items-center gap-1 text-sm ${
                  weightChange < 0 ? "text-primary" : "text-warning"
                }`}>
                  {weightChange < 0 ? (
                    <TrendingDown className="h-3 w-3" />
                  ) : (
                    <TrendingUp className="h-3 w-3" />
                  )}
                  <span>{Math.abs(weightChange).toFixed(1)} kg</span>
                </div>
              )}
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Goal</span>
              </div>
              <p className="text-2xl font-bold">{targetWeight.toFixed(1)} kg</p>
              {remainingToGoal !== 0 && (
                <p className="text-sm text-muted-foreground">
                  {Math.abs(remainingToGoal).toFixed(1)} kg to go
                </p>
              )}
            </Card>
          </div>

          {/* Tab Selector */}
          <div className="flex gap-2 p-1 bg-muted rounded-lg">
            <Button
              variant={activeTab === "weight" ? "default" : "ghost"}
              className="flex-1"
              onClick={() => setActiveTab("weight")}
            >
              <Scale className="h-4 w-4 mr-2" />
              Weight
            </Button>
            <Button
              variant={activeTab === "nutrition" ? "default" : "ghost"}
              className="flex-1"
              onClick={() => setActiveTab("nutrition")}
            >
              <Flame className="h-4 w-4 mr-2" />
              Nutrition
            </Button>
          </div>

          {activeTab === "weight" ? (
            <>
              {/* Weight Chart */}
              <Card className="p-4">
                <h3 className="font-semibold mb-4">Weight Trend</h3>
                {weightChartData.length > 1 ? (
                  <ChartContainer config={chartConfig} className="h-[200px] w-full">
                    <AreaChart data={weightChartData}>
                      <defs>
                        <linearGradient id="weightGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="date"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis
                        domain={["dataMin - 2", "dataMax + 2"]}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12 }}
                        width={40}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      {targetWeight > 0 && (
                        <Line
                          type="monotone"
                          dataKey="target"
                          stroke="hsl(var(--muted-foreground))"
                          strokeDasharray="5 5"
                          strokeWidth={1}
                          dot={false}
                        />
                      )}
                      <Area
                        type="monotone"
                        dataKey="weight"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        fill="url(#weightGradient)"
                      />
                    </AreaChart>
                  </ChartContainer>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Log more weights to see trends</p>
                    </div>
                  </div>
                )}
              </Card>
            </>
          ) : (
            <>
              {/* Weekly Nutrition Summary */}
              <Card className="p-4">
                <h3 className="font-semibold mb-4">This Week's Averages</h3>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="p-3 rounded-lg bg-orange-500/10">
                    <Flame className="h-5 w-5 mx-auto mb-1 text-orange-500" />
                    <p className="text-lg font-bold">{avgCalories}</p>
                    <p className="text-xs text-muted-foreground">kcal</p>
                  </div>
                  <div className="p-3 rounded-lg bg-red-500/10">
                    <Beef className="h-5 w-5 mx-auto mb-1 text-red-500" />
                    <p className="text-lg font-bold">{avgProtein}g</p>
                    <p className="text-xs text-muted-foreground">protein</p>
                  </div>
                  <div className="p-3 rounded-lg bg-amber-500/10">
                    <Wheat className="h-5 w-5 mx-auto mb-1 text-amber-500" />
                    <p className="text-lg font-bold">{avgCarbs}g</p>
                    <p className="text-xs text-muted-foreground">carbs</p>
                  </div>
                  <div className="p-3 rounded-lg bg-blue-500/10">
                    <Droplets className="h-5 w-5 mx-auto mb-1 text-blue-500" />
                    <p className="text-lg font-bold">{avgFat}g</p>
                    <p className="text-xs text-muted-foreground">fat</p>
                  </div>
                </div>
              </Card>

              {/* Calorie Chart */}
              <Card className="p-4">
                <h3 className="font-semibold mb-4">Calorie Trend</h3>
                {nutritionChartData.length > 1 ? (
                  <ChartContainer config={chartConfig} className="h-[200px] w-full">
                    <AreaChart data={nutritionChartData}>
                      <defs>
                        <linearGradient id="calorieGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(38 92% 50%)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(38 92% 50%)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="date"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12 }}
                        width={50}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line
                        type="monotone"
                        dataKey="target"
                        stroke="hsl(var(--muted-foreground))"
                        strokeDasharray="5 5"
                        strokeWidth={1}
                        dot={false}
                      />
                      <Area
                        type="monotone"
                        dataKey="calories"
                        stroke="hsl(38 92% 50%)"
                        strokeWidth={2}
                        fill="url(#calorieGradient)"
                      />
                    </AreaChart>
                  </ChartContainer>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Complete meals to track nutrition</p>
                    </div>
                  </div>
                )}
              </Card>

              {/* Macro Chart */}
              <Card className="p-4">
                <h3 className="font-semibold mb-4">Macros (Last 7 Days)</h3>
                {macroChartData.length > 0 ? (
                  <ChartContainer config={chartConfig} className="h-[200px] w-full">
                    <BarChart data={macroChartData}>
                      <XAxis
                        dataKey="date"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12 }}
                        width={40}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar
                        dataKey="protein"
                        fill="hsl(0 84% 60%)"
                        radius={[2, 2, 0, 0]}
                        stackId="stack"
                      />
                      <Bar
                        dataKey="carbs"
                        fill="hsl(38 92% 50%)"
                        radius={[0, 0, 0, 0]}
                        stackId="stack"
                      />
                      <Bar
                        dataKey="fat"
                        fill="hsl(200 80% 50%)"
                        radius={[2, 2, 0, 0]}
                        stackId="stack"
                      />
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No macro data available yet</p>
                    </div>
                  </div>
                )}
              </Card>
            </>
          )}
        </div>
      )}

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border">
        <div className="flex items-center justify-around py-2">
          <Button
            variant="ghost"
            className="flex flex-col items-center gap-1 h-auto py-2"
            onClick={() => navigate("/dashboard")}
          >
            <Home className="h-5 w-5" />
            <span className="text-xs">Home</span>
          </Button>
          <Button
            variant="ghost"
            className="flex flex-col items-center gap-1 h-auto py-2"
            onClick={() => navigate("/meals")}
          >
            <UtensilsCrossed className="h-5 w-5" />
            <span className="text-xs">Meals</span>
          </Button>
          <Button
            variant="ghost"
            className="flex flex-col items-center gap-1 h-auto py-2"
            onClick={() => navigate("/schedule")}
          >
            <CalendarDays className="h-5 w-5" />
            <span className="text-xs">Schedule</span>
          </Button>
          <Button
            variant="ghost"
            className="flex flex-col items-center gap-1 h-auto py-2 text-primary"
          >
            <TrendingUp className="h-5 w-5" />
            <span className="text-xs">Progress</span>
          </Button>
          <Button
            variant="ghost"
            className="flex flex-col items-center gap-1 h-auto py-2"
            onClick={() => navigate("/profile")}
          >
            <User className="h-5 w-5" />
            <span className="text-xs">Profile</span>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Progress;
