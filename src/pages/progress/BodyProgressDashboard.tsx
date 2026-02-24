import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from "recharts";
import { 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  Scale, 
  Ruler, 
  Percent,
  Calendar,
  ChevronRight,
  Info,
  Award,
  Clock,
  Snowflake,
  RotateCcw,
  AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, subWeeks, startOfWeek, isSameWeek } from "date-fns";
import { WeeklyMetricsForm } from "@/components/body-progress/WeeklyMetricsForm";
import { FreezeSubscriptionModal } from "@/components/body-progress/FreezeSubscriptionModal";
import { RolloverCreditsDisplay } from "@/components/body-progress/RolloverCreditsDisplay";

interface BodyMetric {
  id: string;
  weight_kg: number;
  waist_cm: number | null;
  body_fat_percent: number | null;
  muscle_mass_percent: number | null;
  recorded_at: string;
  week_start: string;
}

interface HealthScore {
  id: string;
  overall_score: number;
  macro_adherence_score: number;
  meal_consistency_score: number;
  weight_logging_score: number;
  protein_accuracy_score: number;
  calculated_at: string;
}

interface SubscriptionFreeze {
  id: string;
  freeze_start_date: string;
  freeze_end_date: string;
  status: string;
  days_count: number;
}

interface RolloverCredit {
  id: string;
  rollover_credits: number;
  expires_at: string;
  consumed: boolean;
}

interface SubscriptionData {
  id: string;
  rollover_credits: number;
  freeze_days_used: number;
  freeze_days_remaining: number;
  billing_cycle_start: string;
  billing_cycle_end: string;
}

export default function BodyProgressDashboard() {
  const [bodyMetrics, setBodyMetrics] = useState<BodyMetric[]>([]);
  const [healthScore, setHealthScore] = useState<HealthScore | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [rollovers, setRollovers] = useState<RolloverCredit[]>([]);
  const [freezes, setFreezes] = useState<SubscriptionFreeze[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showMetricsForm, setShowMetricsForm] = useState(false);
  const [showFreezeModal, setShowFreezeModal] = useState(false);
  const [activeTab, setActiveTab] = useState("progress");

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch subscription data with freeze info
      const { data: subData } = await supabase
        .from("subscriptions")
        .select("id, rollover_credits, freeze_days_used, billing_cycle_start, billing_cycle_end")
        .eq("user_id", user.id)
        .eq("status", "active")
        .single();

      if (subData) {
        setSubscription({
          ...subData,
          freeze_days_remaining: Math.max(0, 7 - (subData.freeze_days_used || 0))
        });
      }

      // Fetch body metrics (last 12 weeks)
      const twelveWeeksAgo = subWeeks(new Date(), 12).toISOString();
      const { data: metricsData } = await supabase
        .from("user_body_metrics")
        .select("*")
        .eq("user_id", user.id)
        .gte("recorded_at", twelveWeeksAgo)
        .order("recorded_at", { ascending: true });

      setBodyMetrics(metricsData || []);

      // Fetch latest health score
      const { data: scoreData } = await supabase
        .from("user_health_scores")
        .select("*")
        .eq("user_id", user.id)
        .order("calculated_at", { ascending: false })
        .limit(1)
        .single();

      setHealthScore(scoreData || null);

      // Fetch rollover credits
      const { data: rolloverData } = await supabase
        .from("subscription_rollovers")
        .select("*")
        .eq("user_id", user.id)
        .eq("consumed", false)
        .gte("expires_at", new Date().toISOString())
        .order("created_at", { ascending: true });

      setRollovers(rolloverData || []);

      // Fetch freeze history
      const { data: freezeData } = await supabase
        .from("subscription_freezes")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5);

      setFreezes(freezeData || []);
    } catch (error) {
      console.error("Error fetching body progress data:", error);
      toast.error("Failed to load progress data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Calculate weight change
  const calculateWeightChange = () => {
    if (bodyMetrics.length < 2) return null;
    const latest = bodyMetrics[bodyMetrics.length - 1].weight_kg;
    const first = bodyMetrics[0].weight_kg;
    return {
      change: parseFloat((latest - first).toFixed(1)),
      percentage: parseFloat(((latest - first) / first * 100).toFixed(1))
    };
  };

  // Calculate waist change
  const calculateWaistChange = () => {
    const validMetrics = bodyMetrics.filter(m => m.waist_cm !== null);
    if (validMetrics.length < 2) return null;
    const latest = validMetrics[validMetrics.length - 1].waist_cm!;
    const first = validMetrics[0].waist_cm!;
    return {
      change: parseFloat((latest - first).toFixed(1)),
      percentage: parseFloat(((latest - first) / first * 100).toFixed(1))
    };
  };

  // Prepare chart data
  const weightChartData = bodyMetrics.map(metric => ({
    date: format(new Date(metric.recorded_at), "MMM d"),
    weight: metric.weight_kg,
    waist: metric.waist_cm,
    bodyFat: metric.body_fat_percent,
  }));

  const weightChange = calculateWeightChange();
  const waistChange = calculateWaistChange();

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-600";
    if (score >= 60) return "text-amber-600";
    return "text-red-600";
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return "bg-emerald-100";
    if (score >= 60) return "bg-amber-100";
    return "bg-red-100";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/20 pb-20">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-emerald-900 via-teal-900 to-cyan-900 text-white py-12 px-4">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-emerald-400 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-cyan-400 rounded-full blur-3xl" />
        </div>
        
        <div className="relative max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">
                Body Progress
              </h1>
              <p className="text-emerald-100">
                Track your transformation journey with detailed metrics
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                onClick={() => setShowFreezeModal(true)}
              >
                <Snowflake className="w-4 h-4 mr-2" />
                Freeze Subscription
              </Button>
              <Button
                className="bg-white text-emerald-900 hover:bg-emerald-50"
                onClick={() => setShowMetricsForm(true)}
              >
                <Scale className="w-4 h-4 mr-2" />
                Log Metrics
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Health Score Card */}
        {healthScore && (
          <Card className="mb-8 border-2 border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row md:items-center gap-6">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-20 h-20 rounded-full flex items-center justify-center",
                    getScoreBgColor(healthScore.overall_score)
                  )}>
                    <Award className={cn("w-10 h-10", getScoreColor(healthScore.overall_score))} />
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Health Compliance Score</p>
                    <div className="flex items-baseline gap-2">
                      <span className={cn("text-4xl font-bold", getScoreColor(healthScore.overall_score))}>
                        {healthScore.overall_score}%
                      </span>
                      <Badge variant="outline" className="text-xs">
                        AI Calculated
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-500">
                      Last updated: {format(new Date(healthScore.calculated_at), "MMM d, yyyy")}
                    </p>
                  </div>
                </div>

                <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-white rounded-lg shadow-sm">
                    <p className="text-xs text-slate-500 mb-1">Macro Adherence</p>
                    <p className={cn("text-lg font-semibold", getScoreColor(healthScore.macro_adherence_score))}>
                      {healthScore.macro_adherence_score}%
                    </p>
                    <p className="text-[10px] text-slate-400">40% weight</p>
                  </div>
                  <div className="text-center p-3 bg-white rounded-lg shadow-sm">
                    <p className="text-xs text-slate-500 mb-1">Meal Consistency</p>
                    <p className={cn("text-lg font-semibold", getScoreColor(healthScore.meal_consistency_score))}>
                      {healthScore.meal_consistency_score}%
                    </p>
                    <p className="text-[10px] text-slate-400">30% weight</p>
                  </div>
                  <div className="text-center p-3 bg-white rounded-lg shadow-sm">
                    <p className="text-xs text-slate-500 mb-1">Weight Logging</p>
                    <p className={cn("text-lg font-semibold", getScoreColor(healthScore.weight_logging_score))}>
                      {healthScore.weight_logging_score}%
                    </p>
                    <p className="text-[10px] text-slate-400">20% weight</p>
                  </div>
                  <div className="text-center p-3 bg-white rounded-lg shadow-sm">
                    <p className="text-xs text-slate-500 mb-1">Protein Accuracy</p>
                    <p className={cn("text-lg font-semibold", getScoreColor(healthScore.protein_accuracy_score))}>
                      {healthScore.protein_accuracy_score}%
                    </p>
                    <p className="text-[10px] text-slate-400">10% weight</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Grid */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-600">Weight Change</span>
                {weightChange && weightChange.change < 0 ? (
                  <TrendingDown className="w-4 h-4 text-emerald-500" />
                ) : (
                  <TrendingUp className="w-4 h-4 text-blue-500" />
                )}
              </div>
              <div className="flex items-baseline gap-1">
                <span className={cn(
                  "text-2xl font-bold",
                  weightChange && weightChange.change < 0 ? "text-emerald-600" : "text-blue-600"
                )}>
                  {weightChange ? `${weightChange.change > 0 ? "+" : ""}${weightChange.change}` : "--"}
                </span>
                <span className="text-sm text-slate-500">kg</span>
              </div>
              {weightChange && (
                <p className="text-xs text-slate-400 mt-1">
                  {weightChange.percentage}% from start
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-600">Waist Change</span>
                <Ruler className="w-4 h-4 text-violet-500" />
              </div>
              <div className="flex items-baseline gap-1">
                <span className={cn(
                  "text-2xl font-bold",
                  waistChange && waistChange.change < 0 ? "text-emerald-600" : "text-violet-600"
                )}>
                  {waistChange ? `${waistChange.change > 0 ? "+" : ""}${waistChange.change}` : "--"}
                </span>
                <span className="text-sm text-slate-500">cm</span>
              </div>
              {waistChange && (
                <p className="text-xs text-slate-400 mt-1">
                  {waistChange.percentage}% from start
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-600">Current Weight</span>
                <Scale className="w-4 h-4 text-orange-500" />
              </div>
              <div className="text-2xl font-bold text-orange-600">
                {bodyMetrics.length > 0 
                  ? bodyMetrics[bodyMetrics.length - 1].weight_kg 
                  : "--"}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {bodyMetrics.length > 0 
                  ? `Recorded ${format(new Date(bodyMetrics[bodyMetrics.length - 1].recorded_at), "MMM d")}`
                  : "No data yet"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-600">Tracking Weeks</span>
                <Calendar className="w-4 h-4 text-cyan-500" />
              </div>
              <div className="text-2xl font-bold text-cyan-600">
                {bodyMetrics.length}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {bodyMetrics.length === 1 ? "week" : "weeks"} of data
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="progress">
              <Activity className="w-4 h-4 mr-2" />
              Progress Charts
            </TabsTrigger>
            <TabsTrigger value="subscription">
              <RotateCcw className="w-4 h-4 mr-2" />
              Subscription
            </TabsTrigger>
            <TabsTrigger value="history">
              <Clock className="w-4 h-4 mr-2" />
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="progress" className="space-y-6">
            {/* Weight Progress Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingDown className="w-5 h-5 text-emerald-500" />
                  Weight Progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                {bodyMetrics.length > 1 ? (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={weightChartData}>
                        <defs>
                          <linearGradient id="weightGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis 
                          dataKey="date" 
                          stroke="#64748b"
                          fontSize={12}
                        />
                        <YAxis 
                          stroke="#64748b"
                          fontSize={12}
                          domain={["dataMin - 2", "dataMax + 2"]}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: "white", 
                            border: "1px solid #e2e8f0",
                            borderRadius: "8px"
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="weight"
                          stroke="#10b981"
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#weightGradient)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <Scale className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                    <p className="text-slate-600 mb-2">Start tracking your weight</p>
                    <p className="text-sm text-slate-400">
                      Log your metrics weekly to see progress over time
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Waist Progress Chart */}
            {bodyMetrics.some(m => m.waist_cm !== null) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Ruler className="w-5 h-5 text-violet-500" />
                    Waist Measurements
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={weightChartData.filter(d => d.waist !== null)}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis 
                          dataKey="date" 
                          stroke="#64748b"
                          fontSize={12}
                        />
                        <YAxis 
                          stroke="#64748b"
                          fontSize={12}
                          domain={["dataMin - 2", "dataMax + 2"]}
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
                          dataKey="waist"
                          stroke="#8b5cf6"
                          strokeWidth={2}
                          dot={{ fill: "#8b5cf6", strokeWidth: 2 }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Body Fat Chart */}
            {bodyMetrics.some(m => m.body_fat_percent !== null) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Percent className="w-5 h-5 text-amber-500" />
                    Body Fat %
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={weightChartData.filter(d => d.bodyFat !== null)}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis 
                          dataKey="date" 
                          stroke="#64748b"
                          fontSize={12}
                        />
                        <YAxis 
                          stroke="#64748b"
                          fontSize={12}
                          domain={["dataMin - 2", "dataMax + 2"]}
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
                          dataKey="bodyFat"
                          stroke="#f59e0b"
                          strokeWidth={2}
                          dot={{ fill: "#f59e0b", strokeWidth: 2 }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="subscription" className="space-y-6">
            {/* Rollover Credits */}
            {subscription && (
              <RolloverCreditsDisplay 
                rolloverCredits={subscription.rollover_credits}
                rollovers={rollovers}
                billingCycleEnd={subscription.billing_cycle_end}
              />
            )}

            {/* Freeze Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Snowflake className="w-5 h-5 text-cyan-500" />
                  Subscription Freeze
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-4 mb-6">
                  <div className="p-4 bg-slate-50 rounded-lg text-center">
                    <p className="text-sm text-slate-500 mb-1">Days Used This Cycle</p>
                    <p className="text-2xl font-bold text-slate-900">
                      {subscription?.freeze_days_used || 0}
                    </p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-lg text-center">
                    <p className="text-sm text-slate-500 mb-1">Days Remaining</p>
                    <p className="text-2xl font-bold text-emerald-600">
                      {subscription?.freeze_days_remaining || 7}
                    </p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-lg text-center">
                    <p className="text-sm text-slate-500 mb-1">Current Cycle Ends</p>
                    <p className="text-lg font-semibold text-slate-900">
                      {subscription?.billing_cycle_end 
                        ? format(new Date(subscription.billing_cycle_end), "MMM d, yyyy")
                        : "--"}
                    </p>
                  </div>
                </div>

                {freezes.length > 0 ? (
                  <div className="space-y-3">
                    <h4 className="font-semibold text-slate-900">Recent Freeze History</h4>
                    {freezes.map((freeze) => (
                      <div 
                        key={freeze.id}
                        className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <Snowflake className="w-5 h-5 text-cyan-500" />
                          <div>
                            <p className="font-medium text-slate-900">
                              {format(new Date(freeze.freeze_start_date), "MMM d")} - {format(new Date(freeze.freeze_end_date), "MMM d, yyyy")}
                            </p>
                            <p className="text-sm text-slate-500">
                              {freeze.days_count} days
                            </p>
                          </div>
                        </div>
                        <Badge 
                          variant={freeze.status === "completed" ? "default" : "secondary"}
                          className={cn(
                            freeze.status === "completed" && "bg-emerald-100 text-emerald-700"
                          )}
                        >
                          {freeze.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <Snowflake className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No freezes scheduled yet</p>
                    <p className="text-sm">You can freeze your subscription for up to 7 days per billing cycle</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            {/* Metrics History Table */}
            <Card>
              <CardHeader>
                <CardTitle>Weekly Metrics History</CardTitle>
              </CardHeader>
              <CardContent>
                {bodyMetrics.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600">Week</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600">Weight</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600">Waist</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600">Body Fat %</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600">Muscle %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...bodyMetrics].reverse().map((metric) => (
                          <tr key={metric.id} className="border-b border-slate-100">
                            <td className="py-3 px-4 text-slate-900">
                              {format(new Date(metric.week_start), "MMM d, yyyy")}
                            </td>
                            <td className="py-3 px-4">
                              <span className="font-medium">{metric.weight_kg} kg</span>
                            </td>
                            <td className="py-3 px-4">
                              {metric.waist_cm ? `${metric.waist_cm} cm` : "--"}
                            </td>
                            <td className="py-3 px-4">
                              {metric.body_fat_percent ? `${metric.body_fat_percent}%` : "--"}
                            </td>
                            <td className="py-3 px-4">
                              {metric.muscle_mass_percent ? `${metric.muscle_mass_percent}%` : "--"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-500">
                    <Activity className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No metrics recorded yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Modals */}
      <Dialog open={showMetricsForm} onOpenChange={setShowMetricsForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scale className="w-5 h-5" />
              Log Weekly Metrics
            </DialogTitle>
          </DialogHeader>
          <WeeklyMetricsForm 
            onSuccess={() => {
              setShowMetricsForm(false);
              fetchDashboardData();
              toast.success("Metrics logged successfully!");
            }}
            onCancel={() => setShowMetricsForm(false)}
          />
        </DialogContent>
      </Dialog>

      <FreezeSubscriptionModal
        isOpen={showFreezeModal}
        onClose={() => setShowFreezeModal(false)}
        subscription={subscription}
        onSuccess={() => {
          fetchDashboardData();
          toast.success("Freeze scheduled successfully!");
        }}
      />
    </div>
  );
}
