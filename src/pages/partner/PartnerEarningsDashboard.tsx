import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from "recharts";
import { 
  DollarSign, 
  TrendingUp, 
  Utensils, 
  Clock, 
  Download,
  Calendar,
  Wallet,
  FileText,
  ArrowUpRight,
  AlertCircle,
  CheckCircle2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";

interface EarningsSummary {
  total_earnings: number;
  pending_payout: number;
  meals_sold: number;
  avg_per_meal: number;
  this_month: number;
  last_month: number;
  growth_rate: number;
}

interface DailyEarning {
  date: string;
  earnings: number;
  meals: number;
}

interface PayoutRecord {
  id: string;
  period_start: string;
  period_end: string;
  amount: number;
  status: string | null;
  processed_at: string | null;
  reference_number: string | null;
}

export default function PartnerEarningsDashboard() {
  const [earnings, setEarnings] = useState<EarningsSummary | null>(null);
  const [dailyData, setDailyData] = useState<DailyEarning[]>([]);
  const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState<"7d" | "30d" | "90d">("30d");
  const [payoutRate, setPayoutRate] = useState<number>(0);   // gross per meal
  const [commissionRate, setCommissionRate] = useState<number>(18); // % platform takes

  const fetchEarningsData = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get restaurant ID and payout_rate for this user
      const { data: restaurant } = await supabase
        .from("restaurants")
        .select("id, payout_rate, commission_rate")
        .eq("owner_id", user.id)
        .single();

      if (!restaurant) {
        toast.error("Restaurant not found");
        return;
      }

      const restaurantId = restaurant.id;
      setPayoutRate(restaurant.payout_rate || 0);
      setCommissionRate((restaurant as any).commission_rate ?? 18);

      // Calculate date range
      const days = dateRange === "7d" ? 7 : dateRange === "30d" ? 30 : 90;
      const startDate = subDays(new Date(), days).toISOString();

      // Fetch earnings
      const { data: earningsData } = await supabase
        .from("partner_earnings")
        .select("net_amount, created_at, status")
        .eq("restaurant_id", restaurantId)
        .gte("created_at", startDate)
        .order("created_at", { ascending: true });

      // Calculate summary
      const totalEarnings = earningsData?.reduce((sum, e) => sum + e.net_amount, 0) || 0;
      const pendingPayout = earningsData?.filter(e => e.status !== 'paid').reduce((sum, e) => sum + e.net_amount, 0) || 0;
      const mealsSold = earningsData?.length || 0;
      const avgPerMeal = mealsSold > 0 ? totalEarnings / mealsSold : 45;

      // Calculate this month vs last month
      const now = new Date();
      const thisMonthStart = startOfMonth(now).toISOString();
      const lastMonthStart = startOfMonth(subDays(now, 30)).toISOString();
      const lastMonthEnd = endOfMonth(subDays(now, 30)).toISOString();

      const thisMonthEarnings = earningsData
        ?.filter(e => e.created_at && e.created_at >= thisMonthStart)
        .reduce((sum, e) => sum + e.net_amount, 0) || 0;

      const lastMonthEarnings = earningsData
        ?.filter(e => e.created_at && e.created_at >= lastMonthStart && e.created_at <= lastMonthEnd)
        .reduce((sum, e) => sum + e.net_amount, 0) || 0;

      const growthRate = lastMonthEarnings > 0 
        ? ((thisMonthEarnings - lastMonthEarnings) / lastMonthEarnings) * 100 
        : 0;

      setEarnings({
        total_earnings: totalEarnings,
        pending_payout: pendingPayout,
        meals_sold: mealsSold,
        avg_per_meal: avgPerMeal,
        this_month: thisMonthEarnings,
        last_month: lastMonthEarnings,
        growth_rate: growthRate,
      });

      // Prepare daily chart data
      const dailyMap: Record<string, { earnings: number; meals: number }> = {};
      earningsData?.forEach(earning => {
        if (!earning.created_at) return;
        const date = format(new Date(earning.created_at), "MMM d");
        if (!dailyMap[date]) {
          dailyMap[date] = { earnings: 0, meals: 0 };
        }
        dailyMap[date].earnings += earning.net_amount;
        dailyMap[date].meals += 1;
      });

      const chartData = Object.entries(dailyMap).map(([date, data]) => ({
        date,
        earnings: data.earnings,
        meals: data.meals,
      }));

      setDailyData(chartData);

      // Fetch payouts
      const { data: payoutData } = await supabase
        .from("partner_payouts")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("created_at", { ascending: false })
        .limit(5);

      setPayouts(payoutData || []);
    } catch (error) {
      console.error("Error fetching earnings:", error);
      toast.error("Failed to load earnings data");
    } finally {
      setIsLoading(false);
    }
  };

  const downloadStatement = () => {
    toast.success("Statement download started");
  };

  useEffect(() => {
    fetchEarningsData();
  }, [dateRange]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] bg-slate-950">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <Wallet className="w-6 h-6 text-cyan-500" />
                Earnings Dashboard
              </h1>
              <p className="text-slate-400 mt-1">
                Track your restaurant performance and payouts
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex bg-slate-800 rounded-lg p-1">
                {(["7d", "30d", "90d"] as const).map((range) => (
                  <button
                    key={range}
                    onClick={() => setDateRange(range)}
                    className={cn(
                      "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                      dateRange === range
                        ? "bg-cyan-600 text-white"
                        : "text-slate-400 hover:text-white"
                    )}
                  >
                    {range === "7d" ? "7 Days" : range === "30d" ? "30 Days" : "90 Days"}
                  </button>
                ))}
              </div>
              <Button
                variant="outline"
                className="border-slate-700 text-slate-300 hover:bg-slate-800"
                onClick={downloadStatement}
              >
                <Download className="w-4 h-4 mr-2" />
                Statement
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats Grid */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400 text-sm">Total Earnings</span>
                <DollarSign className="w-5 h-5 text-cyan-500" />
              </div>
              <div className="text-3xl font-bold text-white">
                {earnings?.total_earnings.toLocaleString() || 0}
              </div>
              <span className="text-slate-500 text-sm">QAR</span>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400 text-sm">Pending Payout</span>
                <Clock className="w-5 h-5 text-amber-500" />
              </div>
              <div className="text-3xl font-bold text-amber-400">
                {earnings?.pending_payout.toLocaleString() || 0}
              </div>
              <span className="text-slate-500 text-sm">QAR</span>
              {earnings && earnings.pending_payout > 0 && (
                <p className="text-xs text-amber-500/70 mt-1">
                  Next payout in 3 days
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400 text-sm">Meals Sold</span>
                <Utensils className="w-5 h-5 text-emerald-500" />
              </div>
              <div className="text-3xl font-bold text-white">
                {earnings?.meals_sold || 0}
              </div>
              <span className="text-slate-500 text-sm">orders</span>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400 text-sm">Monthly Growth</span>
                <TrendingUp className={cn(
                  "w-5 h-5",
                  (earnings?.growth_rate || 0) >= 0 ? "text-emerald-500" : "text-red-500"
                )} />
              </div>
              <div className={cn(
                "text-3xl font-bold",
                (earnings?.growth_rate || 0) >= 0 ? "text-emerald-400" : "text-red-400"
              )}>
                {earnings && earnings.growth_rate >= 0 ? "+" : ""}
                {earnings?.growth_rate.toFixed(1) || 0}%
              </div>
              <span className="text-slate-500 text-sm">vs last month</span>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {/* Earnings Chart */}
          <Card className="md:col-span-2 bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-slate-100 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-cyan-500" />
                Earnings Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailyData}>
                    <defs>
                      <linearGradient id="colorEarnings" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                    <YAxis stroke="#64748b" fontSize={12} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "#0f172a", 
                        border: "1px solid #1e293b",
                        borderRadius: "8px",
                        color: "#f1f5f9"
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="earnings"
                      stroke="#06b6d4"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorEarnings)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-slate-100">This Month</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-slate-400">Earnings</span>
                  <span className="text-2xl font-bold text-cyan-400">
                    {earnings?.this_month.toLocaleString() || 0} QAR
                  </span>
                </div>
                <Progress 
                  value={75} 
                  className="h-2 bg-slate-800"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-slate-400">You Earn / Meal</span>
                  <span className="text-2xl font-bold text-emerald-400">
                    {payoutRate > 0
                      ? (payoutRate * (1 - commissionRate / 100)).toFixed(2)
                      : (earnings?.avg_per_meal.toFixed(0) || "—")} QAR
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Net after {commissionRate}% platform commission
                </p>
              </div>

              <div className="pt-4 border-t border-slate-800">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-slate-400">Gross / Meal</span>
                  <Badge variant="outline" className="border-slate-500/50 text-slate-300">
                    {payoutRate > 0 ? `${payoutRate.toFixed(2)} QAR` : "Set by admin"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Commission</span>
                  <Badge variant="outline" className="border-red-500/50 text-red-400">
                    {commissionRate}% = {payoutRate > 0 ? `${(payoutRate * commissionRate / 100).toFixed(2)} QAR` : "—"}
                  </Badge>
                </div>
              </div>

              <div className="pt-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Next Payout</span>
                  <span className="text-cyan-400 font-medium">
                    {format(subDays(new Date(), -3), "MMM d")}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Payout History */}
        <Card className="bg-slate-900 border-slate-800 mb-8">
          <CardHeader>
            <CardTitle className="text-slate-100 flex items-center gap-2">
              <FileText className="w-5 h-5 text-cyan-500" />
              Payout History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {payouts.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">Period</th>
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">Amount</th>
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">Status</th>
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">Reference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payouts.map((payout) => (
                      <tr key={payout.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                        <td className="py-4 px-4">
                          <div className="text-slate-200">
                            {format(new Date(payout.period_start), "MMM d")} - {format(new Date(payout.period_end), "MMM d")}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-cyan-400 font-medium">
                            {payout.amount.toLocaleString()} QAR
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <Badge 
                            variant="outline"
                            className={cn(
                              payout.status === "completed"
                                ? "border-emerald-500/50 text-emerald-400"
                                : payout.status === "pending"
                                ? "border-amber-500/50 text-amber-400"
                                : "border-red-500/50 text-red-400"
                            )}
                          >
                            {payout.status === "completed" ? (
                              <><CheckCircle2 className="w-3 h-3 mr-1" /> Paid</>
                            ) : payout.status === "pending" ? (
                              <><Clock className="w-3 h-3 mr-1" /> Pending</>
                            ) : (
                              <><AlertCircle className="w-3 h-3 mr-1" /> Failed</>
                            )}
                          </Badge>
                        </td>
                        <td className="py-4 px-4 text-slate-400 text-sm font-mono">
                          {payout.reference_number || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 mx-auto mb-3 text-slate-600" />
                <p className="text-slate-400">No payouts yet</p>
                <p className="text-sm text-slate-500 mt-1">
                  Payouts are processed every 3 days
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Cards */}
        <div className="grid md:grid-cols-3 gap-4">
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-6">
              <h3 className="font-semibold text-slate-200 mb-2 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-cyan-500" />
                Payout Schedule
              </h3>
              <p className="text-sm text-slate-400">
                Earnings are automatically transferred to your bank account every 3 days. 
                Next payout: {format(subDays(new Date(), -3), "MMMM d, yyyy")}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-6">
              <h3 className="font-semibold text-slate-200 mb-2 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-500" />
                Payout Structure
              </h3>
              <p className="text-sm text-slate-400">
                You receive {payoutRate > 0
                  ? `${(payoutRate * (1 - commissionRate / 100)).toFixed(2)} QAR (net)`
                  : "a rate"} per meal after {commissionRate}% platform commission.
                Your gross rate and commission are set by the admin.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-6">
              <h3 className="font-semibold text-slate-200 mb-2 flex items-center gap-2">
                <ArrowUpRight className="w-4 h-4 text-amber-500" />
                Growth Tips
              </h3>
              <p className="text-sm text-slate-400">
                Upload high-quality photos and maintain accurate macro information to 
                improve your meal visibility in AI recommendations.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
