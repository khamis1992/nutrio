import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Scale,
  TrendingDown,
  TrendingUp,
  Target,
  Activity,
  ChevronRight,
  Plus,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import {
  XAxis,
  YAxis,
  ResponsiveContainer,
  Area,
  AreaChart,
  Tooltip,
} from "recharts";
import { format, differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface WeightEntry {
  id: string;
  weight_kg: number | null;
  log_date: string;
  body_fat_percent?: number | null;
  muscle_mass_percent?: number | null;
}

interface ProfessionalWeightReportProps {
  userId: string | undefined;
  latestWeight: number | null | undefined;
  targetWeight: number | null | undefined;
  goalType?: string | null;
  entries?: WeightEntry[];
}

export function ProfessionalWeightReport({
  userId,
  latestWeight,
  targetWeight,
  goalType,
  entries = [],
}: ProfessionalWeightReportProps) {
  const navigate = useNavigate();
  const [newWeight, setNewWeight] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [weightHistory, setWeightHistory] = useState<WeightEntry[]>(entries);

  useEffect(() => {
    const fetchWeightHistory = async () => {
      if (!userId) return;
      const { data } = await supabase
        .from("body_measurements")
        .select("id, weight_kg, log_date, body_fat_percent, muscle_mass_percent")
        .eq("user_id", userId)
        .order("log_date", { ascending: false })
        .limit(30);
      if (data) setWeightHistory(data as WeightEntry[]);
    };
    fetchWeightHistory();
  }, [userId, entries]);

  const handleAddWeight = async () => {
    if (!userId || !newWeight) return;
    const weight = parseFloat(newWeight);
    if (isNaN(weight) || weight <= 0) {
      toast.error("Please enter a valid weight");
      return;
    }
    setIsSubmitting(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const { error } = await supabase.from("body_measurements").upsert(
        {
          user_id: userId,
          weight_kg: weight,
          log_date: today,
        },
        { onConflict: "user_id,log_date", ignoreDuplicates: false }
      );
      if (error) throw error;
      toast.success("Weight logged successfully");
      setNewWeight("");
      const { data } = await supabase
        .from("body_measurements")
        .select("id, weight_kg, log_date, body_fat_percent, muscle_mass_percent")
        .eq("user_id", userId)
        .order("log_date", { ascending: false })
        .limit(30);
      if (data) setWeightHistory(data as WeightEntry[]);
    } catch (err) {
      toast.error("Failed to log weight");
    } finally {
      setIsSubmitting(false);
    }
  };

  const stats = useMemo(() => {
    const sortedHistory = [...weightHistory].sort((a, b) => new Date(b.log_date).getTime() - new Date(a.log_date).getTime());
    const current = sortedHistory[0]?.weight_kg || latestWeight;
    const previous = sortedHistory[1]?.weight_kg;
    const startWeight = sortedHistory[sortedHistory.length - 1]?.weight_kg;
    const totalChange = current && startWeight ? current - startWeight : null;
    const weeklyChange = current && previous ? current - previous : null;
    const daysTracking = sortedHistory.length > 0 ? differenceInDays(new Date(), new Date(sortedHistory[sortedHistory.length - 1].log_date)) : 0;
    const goal = targetWeight;
    const remainingToGoal = current && goal ? Math.abs(current - goal) : null;
    const progressPercent = current && goal && startWeight ? Math.min(100, Math.max(0, ((startWeight - current) / (startWeight - goal)) * 100)) : 0;
    const bmi = current ? (current / 1.75 ** 2).toFixed(1) : null;
    return { current, previous, startWeight, totalChange, weeklyChange, daysTracking, goal, remainingToGoal, progressPercent, bmi, sortedHistory };
  }, [weightHistory, latestWeight, targetWeight]);

  const chartData = useMemo(() => {
    return [...weightHistory]
      .sort((a, b) => new Date(a.log_date).getTime() - new Date(b.log_date).getTime())
      .slice(-14)
      .map((entry) => ({
        date: format(new Date(entry.log_date), "MMM dd"),
        weight: entry.weight_kg,
      }));
  }, [weightHistory]);

  const getBMIStatus = (bmi: number): { label: string; color: string; advice: string } => {
    if (bmi < 18.5) return { label: "Underweight", color: "text-blue-500", advice: "Consider nutrient-dense meals to reach healthy weight" };
    if (bmi < 25) return { label: "Healthy", color: "text-emerald-500", advice: "Great job maintaining a healthy weight range" };
    if (bmi < 30) return { label: "Overweight", color: "text-amber-500", advice: "Focus on balanced nutrition and regular activity" };
    return { label: "Obese", color: "text-red-500", advice: "Consult with healthcare provider for personalized guidance" };
  };

  const getTrendAnalysis = () => {
    if (!stats.weeklyChange) return { trend: "stable", message: "Start logging to see your trend", icon: Activity };
    if (goalType === "weight_loss") {
      if (stats.weeklyChange < 0) return { trend: "on-track", message: "Excellent! You're moving toward your goal", icon: TrendingDown };
      return { trend: "needs-attention", message: "Focus on your calorie deficit this week", icon: AlertCircle };
    }
    if (goalType === "muscle_gain") {
      if (stats.weeklyChange! > 0) return { trend: "on-track", message: "Great progress! Keep building", icon: TrendingUp };
      return { trend: "needs-attention", message: "Increase protein intake to support growth", icon: AlertCircle };
    }
    return { trend: "stable", message: "Maintaining consistently", icon: CheckCircle2 };
  };

  const trendAnalysis = getTrendAnalysis();
  const bmiStatus = stats.bmi ? getBMIStatus(parseFloat(stats.bmi)) : null;

  const recommendations = useMemo(() => {
    const recs = [];
    if (goalType === "weight_loss") {
      recs.push({ icon: "🥗", title: "Nutrition Focus", text: "Prioritize protein-rich meals to preserve muscle while losing fat" });
      recs.push({ icon: "💧", title: "Hydration", text: "Drink 8+ glasses of water daily to support metabolism" });
      recs.push({ icon: "🏃", title: "Activity", text: "Aim for 150+ minutes of moderate exercise weekly" });
    } else if (goalType === "muscle_gain") {
      recs.push({ icon: "💪", title: "Protein Timing", text: "Consume protein within 30 mins post-workout for optimal recovery" });
      recs.push({ icon: "😴", title: "Recovery", text: "Get 7-9 hours of quality sleep for muscle repair" });
      recs.push({ icon: "🍽️", title: "Caloric Surplus", text: "Eat 300-500 calories above maintenance for lean gains" });
    } else {
      recs.push({ icon: "⚖️", title: "Balance", text: "Maintain consistent eating patterns for stable weight" });
      recs.push({ icon: "🎯", title: "Consistency", text: "Log your weight regularly to track patterns" });
      recs.push({ icon: "❤️", title: "Wellness", text: "Focus on overall health, not just the scale" });
    }
    return recs;
  }, [goalType]);

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-5 text-white shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
              <Scale className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-medium text-slate-300">Weight Report</span>
          </div>
          <span className="text-xs text-slate-400">{format(new Date(), "MMMM dd, yyyy")}</span>
        </div>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs text-slate-400 mb-1">Current Weight</p>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-bold tracking-tight">{stats.current?.toFixed(1) || "--"}</span>
              <span className="text-lg text-slate-400">kg</span>
            </div>
            {stats.goal && (
              <p className="text-sm text-slate-400 mt-2">
                Target: <span className="text-emerald-400 font-medium">{stats.goal} kg</span>
              </p>
            )}
          </div>
          <div className="text-right">
            {stats.weeklyChange !== null && (
              <div
                className={cn(
                  "inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium",
                  stats.weeklyChange < 0
                    ? "bg-emerald-500/20 text-emerald-400"
                    : stats.weeklyChange > 0
                      ? "bg-amber-500/20 text-amber-400"
                      : "bg-slate-600/50 text-slate-300"
                )}
              >
                {stats.weeklyChange < 0 ? (
                  <>
                    <TrendingDown className="w-4 h-4" />
                    {Math.abs(stats.weeklyChange).toFixed(1)} kg
                  </>
                ) : stats.weeklyChange > 0 ? (
                  <>
                    <TrendingUp className="w-4 h-4" />
                    +{stats.weeklyChange.toFixed(1)} kg
                  </>
                ) : (
                  "Stable"
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {stats.goal && stats.startWeight && (
        <Card className="border-0 shadow-lg overflow-hidden">
          <CardContent className="p-0">
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-emerald-600" />
                  <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Goal Progress</span>
                </div>
                <span className="text-lg font-bold text-emerald-600">{Math.round(stats.progressPercent)}%</span>
              </div>
              <div className="h-3 bg-emerald-100 dark:bg-emerald-900/50 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${Math.min(100, stats.progressPercent)}%` }}
                />
              </div>
              <div className="flex justify-between mt-2 text-xs text-emerald-600/70 dark:text-emerald-400/70">
                <span>Start: {stats.startWeight} kg</span>
                <span>Target: {stats.goal} kg</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-3 gap-3">
        <Card className="border-0 shadow-md bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-violet-600 dark:text-violet-400 mb-1">BMI</p>
            <p className="text-2xl font-bold text-violet-700 dark:text-violet-300">{stats.bmi || "--"}</p>
            {bmiStatus && <p className={cn("text-xs mt-1 font-medium", bmiStatus.color)}>{bmiStatus.label}</p>}
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-amber-600 dark:text-amber-400 mb-1">Total Change</p>
            <p
              className={cn(
                "text-2xl font-bold",
                stats.totalChange && stats.totalChange < 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : stats.totalChange && stats.totalChange > 0
                    ? "text-orange-600 dark:text-orange-400"
                    : "text-slate-600 dark:text-slate-400"
              )}
            >
              {stats.totalChange ? (stats.totalChange > 0 ? "+" : "") + stats.totalChange.toFixed(1) : "--"}
            </p>
            <p className="text-xs text-amber-600/70 dark:text-amber-400/70 mt-1">kg</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md bg-gradient-to-br from-sky-50 to-cyan-50 dark:from-sky-950/30 dark:to-cyan-950/30">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-sky-600 dark:text-sky-400 mb-1">Tracking</p>
            <p className="text-2xl font-bold text-sky-700 dark:text-sky-300">{stats.daysTracking}</p>
            <p className="text-xs text-sky-600/70 dark:text-sky-400/70 mt-1">days</p>
          </CardContent>
        </Card>
      </div>

      {chartData.length > 1 && (
        <Card className="border-0 shadow-lg overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm">Weight Trend</h3>
              <span className="text-xs text-muted-foreground">Last {chartData.length} entries</span>
            </div>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="weightGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    domain={["dataMin - 1", "dataMax + 1"]}
                    tickFormatter={(v) => `${v}`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    formatter={(value: number) => [`${value} kg`, "Weight"]}
                  />
                  <Area type="monotone" dataKey="weight" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#weightGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-0 shadow-lg overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <div
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center",
                trendAnalysis.trend === "on-track"
                  ? "bg-emerald-100 dark:bg-emerald-900/30"
                  : trendAnalysis.trend === "needs-attention"
                    ? "bg-amber-100 dark:bg-amber-900/30"
                    : "bg-slate-100 dark:bg-slate-800"
              )}
            >
              <trendAnalysis.icon
                className={cn(
                  "w-5 h-5",
                  trendAnalysis.trend === "on-track"
                    ? "text-emerald-600"
                    : trendAnalysis.trend === "needs-attention"
                      ? "text-amber-600"
                      : "text-slate-500"
                )}
              />
            </div>
            <div>
              <p className="font-medium text-sm">Status Analysis</p>
              <p className="text-xs text-muted-foreground">{trendAnalysis.message}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-lg overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <h3 className="font-semibold text-sm">Professional Recommendations</h3>
          </div>
          <div className="space-y-3">
            {recommendations.map((rec, index) => (
              <div key={index} className="flex items-start gap-3 p-3 rounded-xl bg-muted/50">
                <span className="text-lg">{rec.icon}</span>
                <div>
                  <p className="font-medium text-sm">{rec.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{rec.text}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-lg">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">Log Weight</h3>
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => navigate("/weight-tracking")}>
              Full History <ChevronRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
          <div className="flex gap-2">
            <Input
              type="number"
              step="0.1"
              placeholder="Enter weight (kg)"
              value={newWeight}
              onChange={(e) => setNewWeight(e.target.value)}
              className="flex-1 h-11"
            />
            <Button className="h-11 px-4" onClick={handleAddWeight} disabled={isSubmitting || !newWeight}>
              {isSubmitting ? (
                <span className="animate-spin">⏳</span>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-1" />
                  Log
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {weightHistory.length > 0 && (
        <Card className="border-0 shadow-lg">
          <CardContent className="p-4">
            <h3 className="font-semibold text-sm mb-3">Recent Entries</h3>
            <div className="space-y-2">
              {weightHistory.slice(0, 5).map((entry, index) => {
                const prevEntry = weightHistory[index + 1];
                const change = entry.weight_kg && prevEntry?.weight_kg ? entry.weight_kg - prevEntry.weight_kg : null;
                return (
                  <div key={entry.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Scale className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{entry.weight_kg?.toFixed(1) || "--"} kg</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(entry.log_date), "MMM dd, yyyy")}</p>
                      </div>
                    </div>
                    {change !== null && (
                      <div
                        className={cn(
                          "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full",
                          change < 0
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                            : change > 0
                              ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                        )}
                      >
                        {change < 0 ? <TrendingDown className="w-3 h-3" /> : change > 0 ? <TrendingUp className="w-3 h-3" /> : null}
                        {change > 0 ? "+" : ""}
                        {change.toFixed(1)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {bmiStatus && (
        <Card className="border-0 shadow-lg bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Activity className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">Health Insight</p>
                <p className="text-xs text-muted-foreground mt-1">{bmiStatus.advice}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
