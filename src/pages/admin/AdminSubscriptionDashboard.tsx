import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { 
  Users, 
  CreditCard, 
  TrendingUp, 
  TrendingDown,
  Activity,
  DollarSign,
  Calendar,
  Zap,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Download,
  Filter
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, subDays, startOfMonth } from "date-fns";

interface SubscriptionStats {
  total_subscribers: number;
  active_subscribers: number;
  churned_this_month: number;
  mrr: number; // Monthly Recurring Revenue
  arr: number; // Annual Run Rate
}

interface PlanDistribution {
  name: string;
  count: number;
  revenue: number;
  color: string;
}

interface DailyMetric {
  date: string;
  new_subscribers: number;
  churned: number;
  revenue: number;
}

export default function AdminSubscriptionDashboard() {
  const [stats, setStats] = useState<SubscriptionStats | null>(null);
  const [planDistribution, setPlanDistribution] = useState<PlanDistribution[]>([]);
  const [dailyMetrics, setDailyMetrics] = useState<DailyMetric[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState<"7d" | "30d" | "90d">("30d");

  const fetchSubscriptionData = async () => {
    setIsLoading(true);
    try {
      // Calculate date range
      const days = dateRange === "7d" ? 7 : dateRange === "30d" ? 30 : 90;
      const startDate = subDays(new Date(), days).toISOString();

      // Fetch subscriptions with plan info
      const { data: subscriptions } = await supabase
        .from("subscriptions")
        .select(`
          id,
          status,
          price_qar,
          plan_id,
          created_at,
          plan:subscription_plans(name)
        `)
        .gte("created_at", startDate);

      if (subscriptions) {
        // Calculate stats
        const activeSubs = subscriptions.filter(s => s.status === "active");
        const totalSubscribers = new Set(subscriptions.map(s => s.id)).size;
        const activeSubscribers = activeSubs.length;
        
        // Calculate MRR from active subscriptions
        const mrr = activeSubs.reduce((sum, s) => sum + (s.price_qar || 0), 0);
        const arr = mrr * 12;

        // Get churned this month (simplified - would need more complex logic in production)
        const thisMonthStart = startOfMonth(new Date()).toISOString();
        const churnedThisMonth = subscriptions.filter(
          s => s.status !== "active" && s.created_at >= thisMonthStart
        ).length;

        setStats({
          total_subscribers: totalSubscribers,
          active_subscribers: activeSubscribers,
          churned_this_month: churnedThisMonth,
          mrr: mrr,
          arr: arr,
        });

        // Calculate plan distribution
        const planCounts: Record<string, { count: number; revenue: number; color: string }> = {};
        const colors = ["#1e40af", "#3b82f6", "#60a5fa"]; // Navy to light blue
        
        activeSubs.forEach((sub, index) => {
          const planName = sub.plan?.name || "Unknown";
          if (!planCounts[planName]) {
            planCounts[planName] = { count: 0, revenue: 0, color: colors[index % colors.length] };
          }
          planCounts[planName].count += 1;
          planCounts[planName].revenue += sub.price_qar || 0;
        });

        const distribution = Object.entries(planCounts).map(([name, data]) => ({
          name,
          count: data.count,
          revenue: data.revenue,
          color: data.color,
        }));

        setPlanDistribution(distribution);

        // Prepare daily metrics
        const dailyMap: Record<string, { new: number; churned: number; revenue: number }> = {};
        
        subscriptions.forEach(sub => {
          const date = format(new Date(sub.created_at), "MMM d");
          if (!dailyMap[date]) {
            dailyMap[date] = { new: 0, churned: 0, revenue: 0 };
          }
          if (sub.status === "active") {
            dailyMap[date].new += 1;
            dailyMap[date].revenue += sub.price_qar || 0;
          } else {
            dailyMap[date].churned += 1;
          }
        });

        const metrics = Object.entries(dailyMap).map(([date, data]) => ({
          date,
          new_subscribers: data.new,
          churned: data.churned,
          revenue: data.revenue,
        }));

        setDailyMetrics(metrics);
      }
    } catch (error) {
      console.error("Error fetching subscription data:", error);
      toast.error("Failed to load subscription data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscriptionData();
  }, [dateRange]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-6 h-6 text-blue-600" />
                Subscription Management
              </h1>
              <p className="text-slate-500 text-sm mt-0.5">
                Monitor subscriber growth, revenue, and plan performance
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex bg-slate-100 rounded-lg p-1">
                {(["7d", "30d", "90d"] as const).map((range) => (
                  <button
                    key={range}
                    onClick={() => setDateRange(range)}
                    className={cn(
                      "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                      dateRange === range
                        ? "bg-white text-blue-600 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    {range === "7d" ? "7D" : range === "30d" ? "30D" : "90D"}
                  </button>
                ))}
              </div>
              <Button variant="outline" size="sm" className="gap-2">
                <Download className="w-4 h-4" />
                Export
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Key Metrics */}
        <div className="grid md:grid-cols-5 gap-4 mb-8">
          <Card className="bg-white border-slate-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-500 text-sm">Total Subscribers</span>
                <Users className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-2xl font-bold text-slate-900">
                {stats?.total_subscribers.toLocaleString() || 0}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-slate-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-500 text-sm">Active</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-bold text-emerald-600">
                {stats?.active_subscribers.toLocaleString() || 0}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-slate-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-500 text-sm">Churned (MTD)</span>
                <AlertCircle className="w-4 h-4 text-red-600" />
              </div>
              <div className="text-2xl font-bold text-red-600">
                {stats?.churned_this_month || 0}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-600 to-blue-700 border-blue-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-blue-100 text-sm">MRR</span>
                <DollarSign className="w-4 h-4 text-blue-200" />
              </div>
              <div className="text-2xl font-bold">
                {stats?.mrr.toLocaleString() || 0}
              </div>
              <span className="text-blue-200 text-xs">QAR/month</span>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-indigo-600 to-indigo-700 border-indigo-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-indigo-100 text-sm">ARR</span>
                <TrendingUp className="w-4 h-4 text-indigo-200" />
              </div>
              <div className="text-2xl font-bold">
                {stats?.arr.toLocaleString() || 0}
              </div>
              <span className="text-indigo-200 text-xs">QAR/year</span>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {/* Revenue Trend */}
          <Card className="md:col-span-2 bg-white border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-slate-900 text-base font-semibold flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                Revenue & Subscriber Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailyMetrics}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                    <YAxis yAxisId="left" stroke="#64748b" fontSize={12} />
                    <YAxis yAxisId="right" orientation="right" stroke="#64748b" fontSize={12} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "white", 
                        border: "1px solid #e2e8f0",
                        borderRadius: "8px"
                      }}
                    />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="new_subscribers"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={{ fill: "#3b82f6", strokeWidth: 2 }}
                      name="New Subscribers"
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="revenue"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={{ fill: "#10b981", strokeWidth: 2 }}
                      name="Revenue (QAR)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Plan Distribution */}
          <Card className="bg-white border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-slate-900 text-base font-semibold flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-blue-600" />
                Plan Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={planDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={5}
                      dataKey="count"
                    >
                      {planDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 mt-4">
                {planDistribution.map((plan) => (
                  <div key={plan.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: plan.color }}
                      />
                      <span className="text-slate-700">{plan.name}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-slate-500">{plan.count}</span>
                      <span className="text-slate-900 font-medium">
                        {plan.revenue.toLocaleString()} QAR
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-4 gap-4">
          <Card className="bg-white border-slate-200 hover:border-blue-300 transition-colors cursor-pointer">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-medium text-slate-900">Manage Users</h3>
                  <p className="text-sm text-slate-500">View and edit subscribers</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-slate-200 hover:border-emerald-300 transition-colors cursor-pointer">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-medium text-slate-900">AI Engine</h3>
                  <p className="text-sm text-slate-500">Monitor AI performance</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-slate-200 hover:border-amber-300 transition-colors cursor-pointer">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-medium text-slate-900">Payouts</h3>
                  <p className="text-sm text-slate-500">Process restaurant payouts</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-slate-200 hover:border-violet-300 transition-colors cursor-pointer">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center">
                  <Activity className="w-5 h-5 text-violet-600" />
                </div>
                <div>
                  <h3 className="font-medium text-slate-900">Analytics</h3>
                  <p className="text-sm text-slate-500">Deep dive reports</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
