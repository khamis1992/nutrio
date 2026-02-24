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
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import { cn } from "@/lib/utils";

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

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6"];

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
      const { data: rolloverData } = await supabase
        .from("subscription_rollovers")
        .select("rollover_credits, consumed");

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
        .from("user_body_metrics")
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

      // Generate monthly data (mock data for last 6 months)
      const months = [];
      for (let i = 5; i >= 0; i--) {
        const date = subDays(new Date(), i * 30);
        months.push({
          month: format(date, "MMM"),
          rollovers: Math.floor(Math.random() * 50) + 20,
          freezes: Math.floor(Math.random() * 30) + 10,
          healthScores: Math.floor(Math.random() * 100) + 50,
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
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 py-6 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Retention Analytics</h1>
              <p className="text-slate-600 mt-1">
                Track subscription retention metrics and body progress engagement
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={fetchAnalytics}
                disabled={isLoading}
              >
                <RefreshCw className={cn("w-4 h-4 mr-2", isLoading && "animate-spin")} />
                Refresh
              </Button>
              <Button
                variant="outline"
                onClick={handleExport}
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Overview Stats */}
        <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Total Rollovers</p>
                  <p className="text-2xl font-bold text-emerald-600">
                    {metrics.totalRollovers}
                  </p>
                </div>
                <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                  <RotateCcw className="w-5 h-5 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Rollover Credits</p>
                  <p className="text-2xl font-bold text-teal-600">
                    {metrics.totalRolloverCredits}
                  </p>
                </div>
                <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center">
                  <Award className="w-5 h-5 text-teal-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Active Freezes</p>
                  <p className="text-2xl font-bold text-cyan-600">
                    {metrics.activeFreezes}
                  </p>
                </div>
                <div className="w-10 h-10 bg-cyan-100 rounded-full flex items-center justify-center">
                  <Snowflake className="w-5 h-5 text-cyan-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Completed Freezes</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {metrics.completedFreezes}
                  </p>
                </div>
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Avg Health Score</p>
                  <p className={cn(
                    "text-2xl font-bold",
                    metrics.averageHealthScore >= 80 ? "text-emerald-600" :
                    metrics.averageHealthScore >= 60 ? "text-amber-600" : "text-red-600"
                  )}>
                    {metrics.averageHealthScore}%
                  </p>
                </div>
                <div className="w-10 h-10 bg-violet-100 rounded-full flex items-center justify-center">
                  <Activity className="w-5 h-5 text-violet-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Users Tracking</p>
                  <p className="text-2xl font-bold text-indigo-600">
                    {metrics.usersWithMetrics}
                  </p>
                </div>
                <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                  <Users className="w-5 h-5 text-indigo-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">
              <TrendingUp className="w-4 h-4 mr-2" />
              Trends
            </TabsTrigger>
            <TabsTrigger value="health">
              <Activity className="w-4 h-4 mr-2" />
              Health Scores
            </TabsTrigger>
            <TabsTrigger value="engagement">
              <Target className="w-4 h-4 mr-2" />
              Engagement
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-500" />
                  Monthly Retention Trends
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
                  </div>
                ) : (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={monthlyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
                        <YAxis stroke="#64748b" fontSize={12} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: "white", 
                            border: "1px solid #e2e8f0",
                            borderRadius: "8px"
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="rollovers"
                          name="Rollovers"
                          stroke="#10b981"
                          strokeWidth={2}
                          dot={{ fill: "#10b981" }}
                        />
                        <Line
                          type="monotone"
                          dataKey="freezes"
                          name="Freezes"
                          stroke="#3b82f6"
                          strokeWidth={2}
                          dot={{ fill: "#3b82f6" }}
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
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-violet-500" />
                    Health Score Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
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
                            {healthScoreDistribution.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-slate-500">
                      <Activity className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No health score data yet</p>
                    </div>
                  )}
                  <div className="flex flex-wrap justify-center gap-3 mt-4">
                    {healthScoreDistribution.map((item, index) => (
                      <div key={item.name} className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="text-sm text-slate-600">{item.name}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-indigo-500" />
                    User Engagement
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                      <span className="text-slate-600">Users with Body Metrics</span>
                      <Badge variant="secondary" className="text-lg">
                        {metrics.usersWithMetrics}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                      <span className="text-slate-600">Active Freezes</span>
                      <Badge variant="secondary" className="text-lg">
                        {metrics.activeFreezes}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                      <span className="text-slate-600">Total Rollover Events</span>
                      <Badge variant="secondary" className="text-lg">
                        {metrics.totalRollovers}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="engagement" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-amber-500" />
                  Feature Usage Comparison
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
                  </div>
                ) : (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthlyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
                        <YAxis stroke="#64748b" fontSize={12} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: "white", 
                            border: "1px solid #e2e8f0",
                            borderRadius: "8px"
                          }}
                        />
                        <Bar dataKey="rollovers" name="Rollovers" fill="#10b981" />
                        <Bar dataKey="freezes" name="Freezes" fill="#3b82f6" />
                        <Bar dataKey="healthScores" name="Health Logs" fill="#8b5cf6" />
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
  );
}
