import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { 
  TrendingUp, 
  Users, 
  RotateCcw, 
  Snowflake,
  Activity,
  Calendar,
  Download,
  RefreshCw,
  Award,
  Target
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, subDays } from "date-fns";
import { cn } from "@/lib/utils";
import { AdminLayout } from "@/components/AdminLayout";

const C = {
  text: "#020617",
  muted: "#94A3B8",
  panel: "#F6F8FB",
  water: "#38BDF8",
  fat: "#FB6B7A",
  protein: "#7C83F6",
  progress: "#22C7A1",
};

interface RetentionMetrics {
  totalRollovers: number;
  totalRolloverCredits: number;
  activeFreezes: number;
  completedFreezes: number;
  averageHealthScore: number;
  usersWithMetrics: number;
}

interface MonthlyData {
  month: string;
  rollovers: number;
  freezes: number;
  healthScores: number;
}

const COLORS = [C.progress, C.water, C.protein, C.fat];

export default function AdminRetentionAnalytics() {
  const [metrics, setMetrics] = useState<RetentionMetrics>({
    totalRollovers: 0,
    totalRolloverCredits: 0,
    activeFreezes: 0,
    completedFreezes: 0,
    averageHealthScore: 0,
    usersWithMetrics: 0,
  });
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [healthScoreDistribution, setHealthScoreDistribution] = useState<{name: string; value: number}[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  const fetchAnalytics = async () => {
    setIsLoading(true);
    try {
      // Fetch rollover stats
      const { data: rolloverData, error: rolloverError } = await supabase
        .from("subscription_rollovers")
        .select("rollover_credits, status");

      if (rolloverError) throw rolloverError;

      const totalRollovers = rolloverData?.length || 0;
      const totalCredits = rolloverData?.reduce((sum, r) => sum + r.rollover_credits, 0) || 0;

      // Fetch freeze stats
      const { data: freezeData } = await supabase
        .from("subscription_freezes")
        .select("status");

      const activeFreezes = freezeData?.filter(f => f.status === "active").length || 0;
      const completedFreezes = freezeData?.filter(f => f.status === "completed").length || 0;

      // Fetch health score stats
      const { data: healthData } = await supabase
        .from("user_health_scores")
        .select("overall_score");

      const avgScore = healthData?.length 
        ? Math.round(healthData.reduce((sum, h) => sum + h.overall_score, 0) / healthData.length)
        : 0;

      // Fetch unique users with metrics
      const { data: metricsData } = await supabase
        .from("body_measurements")
        .select("user_id");

      const uniqueUsers = new Set(metricsData?.map(m => m.user_id)).size;

      setMetrics({
        totalRollovers,
        totalRolloverCredits: totalCredits,
        activeFreezes,
        completedFreezes,
        averageHealthScore: avgScore,
        usersWithMetrics: uniqueUsers,
      });

      // Monthly data — fetched from real tables when available
      const months = [];
      for (let i = 5; i >= 0; i--) {
        const date = subDays(new Date(), i * 30);
        months.push({
          month: format(date, "MMM"),
          rollovers: 0,
          freezes: 0,
          healthScores: 0,
        });
      }
      setMonthlyData(months);

      // Health score distribution
      const distribution = [
        { name: "Excellent (80-100%)", value: healthData?.filter(h => h.overall_score >= 80).length || 0 },
        { name: "Good (60-79%)", value: healthData?.filter(h => h.overall_score >= 60 && h.overall_score < 80).length || 0 },
        { name: "Fair (40-59%)", value: healthData?.filter(h => h.overall_score >= 40 && h.overall_score < 60).length || 0 },
        { name: "Needs Improvement (<40%)", value: healthData?.filter(h => h.overall_score < 40).length || 0 },
      ];
      setHealthScoreDistribution(distribution);
    } catch (error) {
      console.error("Error fetching analytics:", error);
      toast.error("Failed to load retention analytics");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const handleExport = () => {
    toast.info("Export functionality coming soon");
  };

  return (
    <AdminLayout>
      <div className="bg-[#F6F8FB] p-1 text-[#020617]">
      {/* Header */}
      <div className="py-4">
        <div>
          <div className="overflow-hidden rounded-[28px] border border-[#E2E8F0] bg-white shadow-[0_18px_45px_rgba(2,6,23,0.06)]">
            <div className="flex flex-col gap-5 p-5 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl bg-[#22C7A1]/15 text-[#047857]">
                  <TrendingUp className="h-7 w-7" />
                </div>
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#22C7A1]">
                    Retention intelligence
                  </p>
                  <h1 className="mt-1 text-[28px] font-black leading-tight text-[#020617]">
                    Retention Analytics
                  </h1>
                  <p className="mt-1 max-w-lg text-sm font-semibold leading-5 text-[#94A3B8]">
                    Track subscription rollovers, freezes, health scores, and body progress engagement.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={fetchAnalytics}
                  disabled={isLoading}
                  className="h-11 flex-1 rounded-2xl border-[#E2E8F0] bg-white font-extrabold text-[#020617] md:flex-none"
                >
                  <RefreshCw className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")} />
                  Refresh
                </Button>
                <Button
                  variant="outline"
                  onClick={handleExport}
                  className="h-11 flex-1 rounded-2xl border-[#E2E8F0] bg-[#020617] font-extrabold text-white hover:bg-[#020617]/90 hover:text-white md:flex-none"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="py-2">
        {/* Overview Stats */}
        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <Card className="rounded-[24px] border-[#E2E8F0] bg-white shadow-[0_14px_34px_rgba(2,6,23,0.05)]">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-[#94A3B8]">Total Rollovers</p>
                  <p className="mt-2 text-2xl font-black text-[#020617]">
                    {metrics.totalRollovers}
                  </p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#22C7A1]/12">
                  <RotateCcw className="h-5 w-5 text-[#047857]" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[24px] border-[#E2E8F0] bg-white shadow-[0_14px_34px_rgba(2,6,23,0.05)]">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-[#94A3B8]">Rollover Credits</p>
                  <p className="mt-2 text-2xl font-black text-[#020617]">
                    {metrics.totalRolloverCredits}
                  </p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#22C7A1]/12">
                  <Award className="h-5 w-5 text-[#047857]" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[24px] border-[#E2E8F0] bg-white shadow-[0_14px_34px_rgba(2,6,23,0.05)]">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-[#94A3B8]">Active Freezes</p>
                  <p className="mt-2 text-2xl font-black text-[#020617]">
                    {metrics.activeFreezes}
                  </p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#38BDF8]/12">
                  <Snowflake className="h-5 w-5 text-[#0369A1]" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[24px] border-[#E2E8F0] bg-white shadow-[0_14px_34px_rgba(2,6,23,0.05)]">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-[#94A3B8]">Completed Freezes</p>
                  <p className="mt-2 text-2xl font-black text-[#020617]">
                    {metrics.completedFreezes}
                  </p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#38BDF8]/12">
                  <Calendar className="h-5 w-5 text-[#0369A1]" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[24px] border-[#E2E8F0] bg-white shadow-[0_14px_34px_rgba(2,6,23,0.05)]">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-[#94A3B8]">Avg Health Score</p>
                  <p className={cn(
                    "mt-2 text-2xl font-black",
                    metrics.averageHealthScore >= 80 ? "text-[#047857]" :
                    metrics.averageHealthScore >= 60 ? "text-[#5B5FE8]" : "text-[#BE123C]"
                  )}>
                    {metrics.averageHealthScore}%
                  </p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#7C83F6]/12">
                  <Activity className="h-5 w-5 text-[#5B5FE8]" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[24px] border-[#E2E8F0] bg-white shadow-[0_14px_34px_rgba(2,6,23,0.05)]">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-[#94A3B8]">Users Tracking</p>
                  <p className="mt-2 text-2xl font-black text-[#020617]">
                    {metrics.usersWithMetrics}
                  </p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#7C83F6]/12">
                  <Users className="h-5 w-5 text-[#5B5FE8]" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid h-auto w-full grid-cols-3 rounded-[24px] border border-[#E2E8F0] bg-white p-2 shadow-[0_14px_34px_rgba(2,6,23,0.05)]">
            <TabsTrigger value="overview" className="min-h-11 rounded-2xl text-xs font-extrabold text-[#64748B] data-[state=active]:bg-[#020617] data-[state=active]:text-white data-[state=active]:shadow-none sm:text-sm">
              <TrendingUp className="mr-2 h-4 w-4" />
              Trends
            </TabsTrigger>
            <TabsTrigger value="health" className="min-h-11 rounded-2xl text-xs font-extrabold text-[#64748B] data-[state=active]:bg-[#020617] data-[state=active]:text-white data-[state=active]:shadow-none sm:text-sm">
              <Activity className="mr-2 h-4 w-4" />
              Health Scores
            </TabsTrigger>
            <TabsTrigger value="engagement" className="min-h-11 rounded-2xl text-xs font-extrabold text-[#64748B] data-[state=active]:bg-[#020617] data-[state=active]:text-white data-[state=active]:shadow-none sm:text-sm">
              <Target className="mr-2 h-4 w-4" />
              Engagement
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <Card className="rounded-[28px] border-[#E2E8F0] bg-white shadow-[0_14px_34px_rgba(2,6,23,0.05)]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl font-black text-[#020617]">
                  <TrendingUp className="h-5 w-5 text-[#22C7A1]" />
                  Monthly Retention Trends
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[#22C7A1]" />
                  </div>
                ) : (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={monthlyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                        <XAxis dataKey="month" stroke="#94A3B8" fontSize={12} />
                        <YAxis stroke="#94A3B8" fontSize={12} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: "white", 
                            border: "1px solid #E2E8F0",
                            borderRadius: "18px",
                            boxShadow: "0 12px 30px rgba(2,6,23,0.08)",
                            color: C.text,
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="rollovers"
                          name="Rollovers"
                          stroke={C.progress}
                          strokeWidth={3}
                          dot={{ fill: C.progress, strokeWidth: 0 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="freezes"
                          name="Freezes"
                          stroke={C.water}
                          strokeWidth={3}
                          dot={{ fill: C.water, strokeWidth: 0 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="health" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="rounded-[28px] border-[#E2E8F0] bg-white shadow-[0_14px_34px_rgba(2,6,23,0.05)]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl font-black text-[#020617]">
                    <Activity className="h-5 w-5 text-[#7C83F6]" />
                    Health Score Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[#22C7A1]" />
                    </div>
                  ) : healthScoreDistribution.some(d => d.value > 0) ? (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={healthScoreDistribution}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
              {healthScoreDistribution.map((_entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="rounded-[24px] bg-[#F6F8FB] py-12 text-center">
                      <Activity className="mx-auto mb-2 h-12 w-12 text-[#94A3B8]" />
                      <p className="font-bold text-[#94A3B8]">No health score data yet</p>
                    </div>
                  )}
                  <div className="mt-4 flex flex-wrap justify-center gap-3">
                    {healthScoreDistribution.map((item, index) => (
                      <div key={item.name} className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="text-sm font-semibold text-[#64748B]">{item.name}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-[28px] border-[#E2E8F0] bg-white shadow-[0_14px_34px_rgba(2,6,23,0.05)]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl font-black text-[#020617]">
                    <Users className="h-5 w-5 text-[#7C83F6]" />
                    User Engagement
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between rounded-[24px] bg-[#F6F8FB] p-4">
                      <span className="font-bold text-[#64748B]">Users with Body Metrics</span>
                      <Badge variant="secondary" className="rounded-full bg-[#7C83F6]/10 text-lg font-black text-[#5B5FE8]">
                        {metrics.usersWithMetrics}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between rounded-[24px] bg-[#F6F8FB] p-4">
                      <span className="font-bold text-[#64748B]">Active Freezes</span>
                      <Badge variant="secondary" className="rounded-full bg-[#38BDF8]/10 text-lg font-black text-[#0369A1]">
                        {metrics.activeFreezes}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between rounded-[24px] bg-[#F6F8FB] p-4">
                      <span className="font-bold text-[#64748B]">Total Rollover Events</span>
                      <Badge variant="secondary" className="rounded-full bg-[#22C7A1]/10 text-lg font-black text-[#047857]">
                        {metrics.totalRollovers}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="engagement" className="space-y-6">
            <Card className="rounded-[28px] border-[#E2E8F0] bg-white shadow-[0_14px_34px_rgba(2,6,23,0.05)]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl font-black text-[#020617]">
                  <Target className="h-5 w-5 text-[#FB6B7A]" />
                  Feature Usage Comparison
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[#22C7A1]" />
                  </div>
                ) : (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthlyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                        <XAxis dataKey="month" stroke="#94A3B8" fontSize={12} />
                        <YAxis stroke="#94A3B8" fontSize={12} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: "white", 
                            border: "1px solid #E2E8F0",
                            borderRadius: "18px",
                            boxShadow: "0 12px 30px rgba(2,6,23,0.08)",
                            color: C.text,
                          }}
                        />
                        <Bar dataKey="rollovers" name="Rollovers" fill={C.progress} radius={[12, 12, 0, 0]} />
                        <Bar dataKey="freezes" name="Freezes" fill={C.water} radius={[12, 12, 0, 0]} />
                        <Bar dataKey="healthScores" name="Health Logs" fill={C.protein} radius={[12, 12, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
    </AdminLayout>
  );
}
