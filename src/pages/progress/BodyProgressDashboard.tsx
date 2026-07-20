import { useLanguage } from "@/contexts/LanguageContext";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  Scale, 
  Ruler, 
  Percent,
  Calendar,
  Clock,
  Snowflake,
  RotateCcw
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, subWeeks } from "date-fns";
import { WeeklyMetricsForm } from "@/components/body-metrics/WeeklyMetricsForm";
import { FreezeSubscriptionModal } from "@/components/body-progress/FreezeSubscriptionModal";
import { RolloverCreditsDisplay } from "@/components/body-progress/RolloverCreditsDisplay";
import { BodyFatChart } from "@/components/charts/BodyFatChart";
import { WaistChart } from "@/components/charts/WaistChart";
import { WeightTrendChart } from "@/components/charts/WeightTrendChart";
import { ComplianceScoreCard } from "@/components/health-score/ComplianceScoreCard";

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
  const { t } = useLanguage();
  const [bodyMetrics, setBodyMetrics] = useState<BodyMetric[]>([]);
  const [healthScore, setHealthScore] = useState<HealthScore | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [rollovers, setRollovers] = useState<RolloverCredit[]>([]);
  const [freezes, setFreezes] = useState<SubscriptionFreeze[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showMetricsForm, setShowMetricsForm] = useState(false);
  const [showFreezeModal, setShowFreezeModal] = useState(false);
  const [activeTab, setActiveTab] = useState("progress");

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);

      // Fetch subscription data with freeze info
      const { data: subData } = await supabase
        .from("subscriptions")
        .select("id, rollover_credits, freeze_days_used, month_start_date, next_renewal_date, end_date")
        .eq("user_id", user.id)
        .eq("status", "active")
        .single();

      if (subData) {
        setSubscription({
          id: subData.id,
          rollover_credits: subData.rollover_credits ?? 0,
          freeze_days_used: subData.freeze_days_used ?? 0,
          freeze_days_remaining: Math.max(0, 7 - (subData.freeze_days_used ?? 0)),
          billing_cycle_start: subData.month_start_date ?? new Date().toISOString(),
          billing_cycle_end: subData.next_renewal_date ?? subData.end_date ?? new Date().toISOString(),
        });
      }

      // Fetch body metrics (last 12 weeks)
      const twelveWeeksAgo = subWeeks(new Date(), 12).toISOString();
      const { data: metricsData } = await supabase
        .from("body_measurements")
        .select("id, weight_kg, waist_cm, body_fat_percent, muscle_mass_percent, log_date")
        .eq("user_id", user.id)
        .gte("log_date", twelveWeeksAgo.split("T")[0])
        .order("log_date", { ascending: true });

      setBodyMetrics((metricsData || []).map((metric) => ({
        id: metric.id,
        weight_kg: metric.weight_kg || 0,
        waist_cm: metric.waist_cm,
        body_fat_percent: metric.body_fat_percent,
        muscle_mass_percent: metric.muscle_mass_percent,
        recorded_at: metric.log_date,
        week_start: metric.log_date,
      })));

      // Fetch latest health score
      const { data: scoreData } = await supabase
        .from("user_health_scores")
        .select("*")
        .eq("user_id", user.id)
        .order("calculated_at", { ascending: false })
        .limit(1)
        .single();

      setHealthScore(scoreData ? {
        id: scoreData.id,
        overall_score: scoreData.overall_score,
        macro_adherence_score: scoreData.macro_adherence_score ?? 0,
        meal_consistency_score: scoreData.meal_consistency_score ?? 0,
        weight_logging_score: scoreData.weight_logging_score ?? 0,
        protein_accuracy_score: scoreData.protein_accuracy_score ?? 0,
        calculated_at: scoreData.calculated_at ?? new Date().toISOString(),
      } : null);

      // Fetch rollover credits
      const { data: rolloverData } = await supabase
        .from("subscription_rollovers")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active")
        .gte("expiry_date", new Date().toISOString().slice(0, 10))
        .order("created_at", { ascending: true });

      setRollovers((rolloverData || []).map((rollover) => ({
        id: rollover.id,
        rollover_credits: rollover.rollover_credits,
        expires_at: rollover.expiry_date,
        consumed: rollover.status !== "active",
      })));

      // Fetch freeze history
      const { data: freezeData } = await supabase
        .from("subscription_freezes")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5);

      setFreezes((freezeData || []).map((freeze) => ({
        id: freeze.id,
        freeze_start_date: freeze.freeze_start_date,
        freeze_end_date: freeze.freeze_end_date,
        status: freeze.status,
        days_count: freeze.freeze_days,
      })));
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

  const getScoreCategory = (score: number): "green" | "orange" | "red" => {
    if (score >= 80) return "green";
    if (score >= 60) return "orange";
    return "red";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-4">
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
          <ComplianceScoreCard
            className="mb-8 border-2 border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50"
            score={healthScore.overall_score}
            category={getScoreCategory(healthScore.overall_score)}
            breakdown={{
              macro_adherence: healthScore.macro_adherence_score,
              meal_consistency: healthScore.meal_consistency_score,
              weight_logging: healthScore.weight_logging_score,
              protein_accuracy: healthScore.protein_accuracy_score,
            }}
          />
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
                  <WeightTrendChart data={weightChartData} />
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
                  <WaistChart data={weightChartData} />
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
                  <BodyFatChart data={weightChartData} />
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
                    <p>{t("no_freezes_scheduled")}</p>
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
                <CardTitle>{t("weekly_metrics_history")}</CardTitle>
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
                    <p>{t("no_metrics_recorded")}</p>
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
          {currentUserId ? (
            <WeeklyMetricsForm
              userId={currentUserId}
              onSuccess={() => {
                setShowMetricsForm(false);
                fetchDashboardData();
              }}
            />
          ) : (
            <p className="py-8 text-center text-sm text-slate-500">
              Sign in to log weekly metrics.
            </p>
          )}
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
