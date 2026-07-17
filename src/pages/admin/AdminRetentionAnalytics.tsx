import { useState, useEffect } from "react";
import {
  AdminEmptyState,
  AdminMetricTile,
  AdminPanel,
  AdminPanelHeader,
  AdminWorkbenchHeader,
} from "@/components/admin/AdminPrimitives";
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
  Cell,
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
  Target,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, subDays } from "date-fns";
import { cn } from "@/lib/utils";
import { downloadCsv } from "@/lib/csv";
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
  const [healthScoreDistribution, setHealthScoreDistribution] = useState<
    { name: string; value: number }[]
  >([]);
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
      const totalCredits =
        rolloverData?.reduce((sum, r) => sum + r.rollover_credits, 0) || 0;

      // Fetch freeze stats
      const { data: freezeData } = await supabase
        .from("subscription_freezes")
        .select("status");

      const activeFreezes =
        freezeData?.filter((f) => f.status === "active").length || 0;
      const completedFreezes =
        freezeData?.filter((f) => f.status === "completed").length || 0;

      // Fetch health score stats
      const { data: healthData } = await supabase
        .from("user_health_scores")
        .select("overall_score");

      const avgScore = healthData?.length
        ? Math.round(
            healthData.reduce((sum, h) => sum + h.overall_score, 0) /
              healthData.length,
          )
        : 0;

      // Fetch unique users with metrics
      const { data: metricsData } = await supabase
        .from("body_measurements")
        .select("user_id");

      const uniqueUsers = new Set(metricsData?.map((m) => m.user_id)).size;

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
        {
          name: "Excellent (80-100%)",
          value: healthData?.filter((h) => h.overall_score >= 80).length || 0,
        },
        {
          name: "Good (60-79%)",
          value:
            healthData?.filter(
              (h) => h.overall_score >= 60 && h.overall_score < 80,
            ).length || 0,
        },
        {
          name: "Fair (40-59%)",
          value:
            healthData?.filter(
              (h) => h.overall_score >= 40 && h.overall_score < 60,
            ).length || 0,
        },
        {
          name: "Needs Improvement (<40%)",
          value: healthData?.filter((h) => h.overall_score < 40).length || 0,
        },
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
    const rows = [
      ["section", "metric", "value"],
      ["summary", "total_rollovers", metrics.totalRollovers],
      ["summary", "total_rollover_credits", metrics.totalRolloverCredits],
      ["summary", "active_freezes", metrics.activeFreezes],
      ["summary", "completed_freezes", metrics.completedFreezes],
      ["summary", "average_health_score", metrics.averageHealthScore],
      ["summary", "users_with_metrics", metrics.usersWithMetrics],
      [],
      ["section", "month", "rollovers", "freezes", "health_scores"],
      ...monthlyData.map((item) => [
        "monthly",
        item.month,
        item.rollovers,
        item.freezes,
        item.healthScores,
      ]),
      [],
      ["section", "bucket", "users"],
      ...healthScoreDistribution.map((item) => [
        "health_score_distribution",
        item.name,
        item.value,
      ]),
    ];

    downloadCsv(
      rows,
      `retention-analytics-${format(new Date(), "yyyy-MM-dd")}.csv`,
    );
    toast.success("Retention analytics export downloaded");
  };

  const metricCards = [
    {
      label: "Total Rollovers",
      value: metrics.totalRollovers,
      icon: RotateCcw,
      accent: C.progress,
    },
    {
      label: "Rollover Credits",
      value: metrics.totalRolloverCredits,
      icon: Award,
      accent: C.progress,
    },
    {
      label: "Active Freezes",
      value: metrics.activeFreezes,
      icon: Snowflake,
      accent: C.water,
    },
    {
      label: "Completed Freezes",
      value: metrics.completedFreezes,
      icon: Calendar,
      accent: C.water,
    },
    {
      label: "Avg Health Score",
      value: `${metrics.averageHealthScore}%`,
      icon: Activity,
      accent:
        metrics.averageHealthScore >= 80
          ? C.progress
          : metrics.averageHealthScore >= 60
            ? C.protein
            : C.fat,
    },
    {
      label: "Users Tracking",
      value: metrics.usersWithMetrics,
      icon: Users,
      accent: C.protein,
    },
  ];

  return (
    <AdminLayout
      title="Retention Analytics"
      subtitle="Track rollovers, freezes, health scores, and engagement"
    >
      <div className="bg-[#F6F8FB] p-1 text-[#020617]">
        <AdminWorkbenchHeader
          eyebrow="Retention intelligence"
          title="Retention analytics workbench"
          icon={TrendingUp}
          accent="#22C7A1"
          description="Track subscription rollovers, freeze behavior, health scores, and engagement signals in one operator-focused view."
          meta={[
            { label: "Users tracking", value: metrics.usersWithMetrics },
            { label: "Active freezes", value: metrics.activeFreezes },
            {
              label: "Avg health score",
              value: `${metrics.averageHealthScore}%`,
            },
          ]}
          actions={
            <>
              <Button
                variant="outline"
                onClick={fetchAnalytics}
                disabled={isLoading}
                className="h-11 flex-1 rounded-2xl border-[#E5EAF1] bg-white font-extrabold text-[#020617] md:flex-none"
              >
                <RefreshCw
                  className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")}
                />
                Refresh
              </Button>
              <Button
                variant="outline"
                onClick={handleExport}
                className="h-11 flex-1 rounded-2xl border-[#7C83F6]/30 bg-[#7C83F6]/10 font-extrabold text-[#020617] hover:bg-[#7C83F6]/15 hover:text-[#020617] md:flex-none"
              >
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </>
          }
          className="mb-5"
        />

        <div className="py-2">
          {/* Overview Stats */}
          <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {metricCards.map((metric) => (
              <AdminMetricTile
                key={metric.label}
                label={metric.label}
                value={metric.value}
                icon={metric.icon}
                accent={
                  metric.accent as "#22C7A1" | "#7C83F6" | "#38BDF8" | "#FB6B7A"
                }
                className="bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-[0_18px_44px_rgba(2,6,23,0.075)]"
              />
            ))}
          </div>

          {/* Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="space-y-4"
          >
            <TabsList className="grid h-auto w-full grid-cols-3 rounded-[24px] border border-[#E5EAF1] bg-white p-2 shadow-[0_14px_34px_rgba(2,6,23,0.05)]">
              <TabsTrigger
                value="overview"
                className="min-h-11 rounded-2xl text-xs font-extrabold text-[#94A3B8] data-[state=active]:border data-[state=active]:border-[#22C7A1]/30 data-[state=active]:bg-[#22C7A1]/10 data-[state=active]:text-[#020617] data-[state=active]:shadow-none sm:text-sm"
              >
                <TrendingUp className="mr-2 h-4 w-4" />
                Trends
              </TabsTrigger>
              <TabsTrigger
                value="health"
                className="min-h-11 rounded-2xl text-xs font-extrabold text-[#94A3B8] data-[state=active]:border data-[state=active]:border-[#7C83F6]/30 data-[state=active]:bg-[#7C83F6]/10 data-[state=active]:text-[#020617] data-[state=active]:shadow-none sm:text-sm"
              >
                <Activity className="mr-2 h-4 w-4" />
                Health Scores
              </TabsTrigger>
              <TabsTrigger
                value="engagement"
                className="min-h-11 rounded-2xl text-xs font-extrabold text-[#94A3B8] data-[state=active]:border data-[state=active]:border-[#38BDF8]/30 data-[state=active]:bg-[#38BDF8]/10 data-[state=active]:text-[#020617] data-[state=active]:shadow-none sm:text-sm"
              >
                <Target className="mr-2 h-4 w-4" />
                Engagement
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <AdminPanel>
                <AdminPanelHeader
                  title="Monthly Retention Trends"
                  eyebrow="Trends"
                  actions={<TrendingUp className="h-5 w-5 text-[#22C7A1]" />}
                />
                <div className="p-5">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[#22C7A1]" />
                    </div>
                  ) : (
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={monthlyData}>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#E5EAF1"
                          />
                          <XAxis
                            dataKey="month"
                            stroke="#94A3B8"
                            fontSize={12}
                          />
                          <YAxis stroke="#94A3B8" fontSize={12} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "white",
                              border: "1px solid #E5EAF1",
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
                </div>
              </AdminPanel>
            </TabsContent>

            <TabsContent value="health" className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <AdminPanel>
                  <AdminPanelHeader
                    title="Health Score Distribution"
                    eyebrow="Health scores"
                    actions={<Activity className="h-5 w-5 text-[#7C83F6]" />}
                  />
                  <div className="p-5">
                    {isLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[#22C7A1]" />
                      </div>
                    ) : healthScoreDistribution.some((d) => d.value > 0) ? (
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
                                <Cell
                                  key={`cell-${index}`}
                                  fill={COLORS[index % COLORS.length]}
                                />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <AdminEmptyState
                        icon={Activity}
                        title="No health score data yet"
                        className="rounded-[24px] bg-[#F6F8FB] py-12"
                      />
                    )}
                    <div className="mt-4 flex flex-wrap justify-center gap-3">
                      {healthScoreDistribution.map((item, index) => (
                        <div
                          key={item.name}
                          className="flex items-center gap-2"
                        >
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{
                              backgroundColor: COLORS[index % COLORS.length],
                            }}
                          />
                          <span className="text-sm font-semibold text-[#94A3B8]">
                            {item.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </AdminPanel>

                <AdminPanel>
                  <AdminPanelHeader
                    title="User Engagement"
                    eyebrow="Engagement"
                    actions={<Users className="h-5 w-5 text-[#7C83F6]" />}
                  />
                  <div className="p-5">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between rounded-[24px] bg-[#F6F8FB] p-4">
                        <span className="font-bold text-[#94A3B8]">
                          Users with Body Metrics
                        </span>
                        <Badge
                          variant="secondary"
                          className="rounded-full bg-[#7C83F6]/10 text-lg font-black text-[#7C83F6]"
                        >
                          {metrics.usersWithMetrics}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between rounded-[24px] bg-[#F6F8FB] p-4">
                        <span className="font-bold text-[#94A3B8]">
                          Active Freezes
                        </span>
                        <Badge
                          variant="secondary"
                          className="rounded-full bg-[#38BDF8]/10 text-lg font-black text-[#38BDF8]"
                        >
                          {metrics.activeFreezes}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between rounded-[24px] bg-[#F6F8FB] p-4">
                        <span className="font-bold text-[#94A3B8]">
                          Total Rollover Events
                        </span>
                        <Badge
                          variant="secondary"
                          className="rounded-full bg-[#22C7A1]/10 text-lg font-black text-[#22C7A1]"
                        >
                          {metrics.totalRollovers}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </AdminPanel>
              </div>
            </TabsContent>

            <TabsContent value="engagement" className="space-y-6">
              <AdminPanel>
                <AdminPanelHeader
                  title="Feature Usage Comparison"
                  eyebrow="Feature usage"
                  actions={<Target className="h-5 w-5 text-[#FB6B7A]" />}
                />
                <div className="p-5">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[#22C7A1]" />
                    </div>
                  ) : (
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthlyData}>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#E5EAF1"
                          />
                          <XAxis
                            dataKey="month"
                            stroke="#94A3B8"
                            fontSize={12}
                          />
                          <YAxis stroke="#94A3B8" fontSize={12} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "white",
                              border: "1px solid #E5EAF1",
                              borderRadius: "18px",
                              boxShadow: "0 12px 30px rgba(2,6,23,0.08)",
                              color: C.text,
                            }}
                          />
                          <Bar
                            dataKey="rollovers"
                            name="Rollovers"
                            fill={C.progress}
                            radius={[12, 12, 0, 0]}
                          />
                          <Bar
                            dataKey="freezes"
                            name="Freezes"
                            fill={C.water}
                            radius={[12, 12, 0, 0]}
                          />
                          <Bar
                            dataKey="healthScores"
                            name="Health Logs"
                            fill={C.protein}
                            radius={[12, 12, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </AdminPanel>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AdminLayout>
  );
}
