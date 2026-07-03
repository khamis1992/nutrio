import { useState, useEffect } from "react";
import { PartnerLayout } from "@/components/PartnerLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
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
  CheckCircle2,
} from "lucide-react";
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

/**
 * Earnings Dashboard reads from partner_earnings, the canonical partner earnings source.
 * Analytics and payouts can differ slightly because they use different accounting cutoffs.
 */
export default function PartnerEarningsDashboard() {
  const [earnings, setEarnings] = useState<EarningsSummary | null>(null);
  const [dailyData, setDailyData] = useState<DailyEarning[]>([]);
  const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState<"7d" | "30d" | "90d" | "all">(
    "30d",
  );
  const [payoutRate, setPayoutRate] = useState<number>(0); // gross per meal
  const [commissionRate, setCommissionRate] = useState<number>(18); // % platform takes

  const fetchEarningsData = async () => {
    setIsLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
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
      setCommissionRate(restaurant.commission_rate ?? 18);

      // Calculate date range
      const days =
        dateRange === "7d"
          ? 7
          : dateRange === "30d"
            ? 30
            : dateRange === "90d"
              ? 90
              : null;
      const startDate = days ? subDays(new Date(), days).toISOString() : null;

      // Fetch earnings
      let query = supabase
        .from("partner_earnings")
        .select("net_amount, created_at, status")
        .eq("restaurant_id", restaurantId)
        .order("created_at", { ascending: true });

      if (startDate) {
        query = query.gte("created_at", startDate);
      }

      const { data: earningsData } = await query;

      // Calculate summary
      const totalEarnings =
        earningsData?.reduce((sum, e) => sum + e.net_amount, 0) || 0;
      const pendingPayout =
        earningsData
          ?.filter((e) => e.status !== "paid")
          .reduce((sum, e) => sum + e.net_amount, 0) || 0;
      const mealsSold = earningsData?.length || 0;
      const avgPerMeal = mealsSold > 0 ? totalEarnings / mealsSold : 45;

      // Calculate this month vs last month
      const now = new Date();
      const thisMonthStart = startOfMonth(now).toISOString();
      const lastMonthStart = startOfMonth(subDays(now, 30)).toISOString();
      const lastMonthEnd = endOfMonth(subDays(now, 30)).toISOString();

      const thisMonthEarnings =
        earningsData
          ?.filter((e) => e.created_at && e.created_at >= thisMonthStart)
          .reduce((sum, e) => sum + e.net_amount, 0) || 0;

      const lastMonthEarnings =
        earningsData
          ?.filter(
            (e) =>
              e.created_at &&
              e.created_at >= lastMonthStart &&
              e.created_at <= lastMonthEnd,
          )
          .reduce((sum, e) => sum + e.net_amount, 0) || 0;

      const growthRate =
        lastMonthEarnings > 0
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
      earningsData?.forEach((earning) => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange]);

  if (isLoading) {
    return (
      <PartnerLayout
        title="Earnings"
        subtitle="Track restaurant performance and payouts"
      >
        <div className="-m-6 min-h-screen bg-[#F6F8FB] p-4 sm:p-6">
          <div className="mx-auto max-w-7xl space-y-4">
            <Skeleton className="h-52 rounded-[30px] bg-white" />
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Skeleton className="h-24 rounded-[22px] bg-white" />
              <Skeleton className="h-24 rounded-[22px] bg-white" />
              <Skeleton className="h-24 rounded-[22px] bg-white" />
              <Skeleton className="h-24 rounded-[22px] bg-white" />
            </div>
            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <Skeleton className="h-80 rounded-[28px] bg-white" />
              <Skeleton className="h-80 rounded-[28px] bg-white" />
            </div>
          </div>
        </div>
      </PartnerLayout>
    );
  }

  const totalEarnings = earnings?.total_earnings ?? 0;
  const pendingPayout = earnings?.pending_payout ?? 0;
  const mealsSold = earnings?.meals_sold ?? 0;
  const growthRate = earnings?.growth_rate ?? 0;
  const netPerMeal =
    payoutRate > 0
      ? payoutRate * (1 - commissionRate / 100)
      : (earnings?.avg_per_meal ?? 0);
  const commissionPerMeal =
    payoutRate > 0 ? payoutRate * (commissionRate / 100) : 0;
  const nextPayoutDate = format(subDays(new Date(), -3), "MMM d");
  const nextPayoutFullDate = format(subDays(new Date(), -3), "MMMM d, yyyy");
  const rangeLabel =
    dateRange === "7d"
      ? "7 days"
      : dateRange === "30d"
        ? "30 days"
        : dateRange === "90d"
          ? "90 days"
          : "all time";

  const statusStyles: Record<
    string,
    { label: string; icon: JSX.Element; className: string }
  > = {
    completed: {
      label: "Paid",
      icon: <CheckCircle2 className="mr-1 h-3.5 w-3.5" />,
      className: "border-[#22C7A1]/25 bg-[#22C7A1]/10 text-[#0B9B7E]",
    },
    paid: {
      label: "Paid",
      icon: <CheckCircle2 className="mr-1 h-3.5 w-3.5" />,
      className: "border-[#22C7A1]/25 bg-[#22C7A1]/10 text-[#0B9B7E]",
    },
    pending: {
      label: "Pending",
      icon: <Clock className="mr-1 h-3.5 w-3.5" />,
      className: "border-[#F97316]/25 bg-[#F97316]/10 text-[#F97316]",
    },
    processing: {
      label: "Processing",
      icon: <Clock className="mr-1 h-3.5 w-3.5" />,
      className: "border-[#F97316]/25 bg-[#F97316]/10 text-[#F97316]",
    },
    failed: {
      label: "Failed",
      icon: <AlertCircle className="mr-1 h-3.5 w-3.5" />,
      className: "border-[#FB6B7A]/25 bg-[#FB6B7A]/10 text-[#FB6B7A]",
    },
  };

  return (
    <PartnerLayout
      title="Earnings"
      subtitle="Track restaurant performance and payouts"
    >
      <div className="-m-6 min-h-screen bg-[#F6F8FB] p-4 text-[#020617] sm:p-6">
        <div className="mx-auto max-w-7xl space-y-4">
          <section className="overflow-hidden rounded-[30px] border border-[#E5EAF1] bg-white shadow-sm">
            <div className="grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="space-y-5 p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-[#22C7A1]/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-[#0B9B7E]">
                      <DollarSign className="h-3.5 w-3.5" />
                      Earnings command
                    </div>
                    <h1 className="mt-3 text-2xl font-black tracking-tight text-[#020617] sm:text-3xl">
                      Revenue performance
                    </h1>
                    <p className="mt-2 max-w-xl text-sm font-medium leading-6 text-[#64748B]">
                      Monitor paid meals, net revenue, payout readiness, and the
                      rate structure used for your restaurant settlements.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    className="min-h-11 rounded-2xl border-[#E5EAF1] bg-white font-black text-[#020617] hover:bg-[#F6F8FB]"
                    onClick={downloadStatement}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Statement
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-2xl border border-[#22C7A1]/20 bg-[#22C7A1]/10 p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#0B9B7E]">
                      Total earnings
                    </p>
                    <p className="mt-1 text-lg font-black text-[#020617]">
                      {totalEarnings.toLocaleString()}
                    </p>
                    <p className="text-xs font-bold text-[#94A3B8]">QAR</p>
                  </div>
                  <div className="rounded-2xl border border-[#F97316]/20 bg-[#F97316]/10 p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#F97316]">
                      Pending payout
                    </p>
                    <p className="mt-1 text-lg font-black text-[#020617]">
                      {pendingPayout.toLocaleString()}
                    </p>
                    <p className="text-xs font-bold text-[#94A3B8]">QAR</p>
                  </div>
                  <div className="rounded-2xl border border-[#38BDF8]/20 bg-[#38BDF8]/10 p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#0284C7]">
                      Meals sold
                    </p>
                    <p className="mt-1 text-lg font-black text-[#020617]">
                      {mealsSold}
                    </p>
                    <p className="text-xs font-bold text-[#94A3B8]">orders</p>
                  </div>
                  <div className="rounded-2xl border border-[#7C83F6]/20 bg-[#7C83F6]/10 p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#7C83F6]">
                      Growth
                    </p>
                    <p className="mt-1 text-lg font-black text-[#020617]">
                      {growthRate >= 0 ? "+" : ""}
                      {growthRate.toFixed(1)}%
                    </p>
                    <p className="text-xs font-bold text-[#94A3B8]">
                      vs last month
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-[#020617] p-5 text-white sm:p-6">
                <div className="flex h-full flex-col justify-between gap-6 rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/55">
                      Available signal
                    </p>
                    <p className="mt-3 text-4xl font-black tracking-tight">
                      {pendingPayout.toLocaleString()} QAR
                    </p>
                    <p className="mt-3 text-sm font-semibold leading-6 text-white/65">
                      Pending balance is based on unpaid earnings in the
                      selected {rangeLabel} window. Payouts are handled from the
                      payouts center.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-2xl bg-white/10 p-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/45">
                        Net / meal
                      </p>
                      <p className="mt-1 text-lg font-black text-white">
                        {netPerMeal > 0 ? netPerMeal.toFixed(2) : "-"}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white/10 p-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/45">
                        Next payout
                      </p>
                      <p className="mt-1 text-lg font-black text-white">
                        {nextPayoutDate}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-3 rounded-[24px] border border-[#E5EAF1] bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="grid grid-cols-4 gap-1 rounded-2xl bg-[#F6F8FB] p-1">
              {(["7d", "30d", "90d", "all"] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setDateRange(range)}
                  className={`min-h-10 rounded-xl px-3 text-xs font-black transition ${
                    dateRange === range
                      ? "bg-[#020617] text-white shadow-sm"
                      : "text-[#64748B] hover:text-[#020617]"
                  }`}
                >
                  {range === "7d"
                    ? "7 Days"
                    : range === "30d"
                      ? "30 Days"
                      : range === "90d"
                        ? "90 Days"
                        : "All Time"}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 rounded-2xl bg-[#F6F8FB] px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-[#94A3B8]">
              <Calendar className="h-4 w-4 text-[#7C83F6]" />
              Showing {rangeLabel}
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-[28px] border border-[#E5EAF1] bg-white p-5 shadow-sm">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[#7C83F6]">
                    Earnings trend
                  </p>
                  <h2 className="mt-1 text-xl font-black tracking-tight text-[#020617]">
                    Daily revenue curve
                  </h2>
                  <p className="mt-1 text-sm font-medium text-[#94A3B8]">
                    Net earnings grouped by day for the selected range.
                  </p>
                </div>
                <div className="rounded-2xl bg-[#22C7A1]/10 p-3 text-[#0B9B7E]">
                  <TrendingUp className="h-5 w-5" />
                </div>
              </div>

              {dailyData.length > 0 ? (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dailyData}>
                      <defs>
                        <linearGradient
                          id="colorEarnings"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#22C7A1"
                            stopOpacity={0.28}
                          />
                          <stop
                            offset="95%"
                            stopColor="#22C7A1"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#E5EAF1"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="date"
                        tick={{
                          fontSize: 11,
                          fill: "#94A3B8",
                          fontWeight: 700,
                        }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tick={{
                          fontSize: 11,
                          fill: "#94A3B8",
                          fontWeight: 700,
                        }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        formatter={(value: number) => [
                          `${Number(value).toLocaleString()} QAR`,
                          "Earnings",
                        ]}
                        contentStyle={{
                          fontSize: 12,
                          borderRadius: 16,
                          borderColor: "#E5EAF1",
                          color: "#020617",
                        }}
                        cursor={{ stroke: "#7C83F6", strokeWidth: 1 }}
                      />
                      <Area
                        type="monotone"
                        dataKey="earnings"
                        stroke="#22C7A1"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#colorEarnings)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex h-72 flex-col items-center justify-center rounded-[24px] border border-dashed border-[#E5EAF1] bg-[#F6F8FB] text-center">
                  <TrendingUp className="mb-3 h-8 w-8 text-[#94A3B8]" />
                  <p className="text-sm font-bold text-[#020617]">
                    No earnings in this range
                  </p>
                  <p className="mt-1 text-xs font-medium text-[#94A3B8]">
                    Completed customer meals will appear here.
                  </p>
                </div>
              )}
            </div>

            <div className="rounded-[28px] border border-[#E5EAF1] bg-white p-5 shadow-sm">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[#7C83F6]">
                    This month
                  </p>
                  <h2 className="mt-1 text-xl font-black tracking-tight text-[#020617]">
                    Settlement math
                  </h2>
                </div>
                <Wallet className="h-5 w-5 text-[#22C7A1]" />
              </div>

              <div className="space-y-3">
                <div className="rounded-[22px] border border-[#22C7A1]/20 bg-[#22C7A1]/10 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-bold text-[#64748B]">
                      This month earnings
                    </span>
                    <span className="text-xl font-black text-[#020617]">
                      {(earnings?.this_month ?? 0).toLocaleString()} QAR
                    </span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                    <div className="h-full w-3/4 rounded-full bg-[#22C7A1]" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-[20px] border border-[#E5EAF1] bg-[#F6F8FB] p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                      Gross / meal
                    </p>
                    <p className="mt-1 text-lg font-black text-[#020617]">
                      {payoutRate > 0 ? payoutRate.toFixed(2) : "-"}
                    </p>
                    <p className="text-xs font-bold text-[#94A3B8]">QAR</p>
                  </div>
                  <div className="rounded-[20px] border border-[#FB6B7A]/20 bg-[#FB6B7A]/10 p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#FB6B7A]">
                      Commission
                    </p>
                    <p className="mt-1 text-lg font-black text-[#020617]">
                      {commissionRate}%
                    </p>
                    <p className="text-xs font-bold text-[#94A3B8]">
                      {commissionPerMeal > 0
                        ? `${commissionPerMeal.toFixed(2)} QAR`
                        : "admin rate"}
                    </p>
                  </div>
                </div>

                <div className="rounded-[22px] border border-[#E5EAF1] bg-[#F6F8FB] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-bold text-[#64748B]">
                      Net after commission
                    </span>
                    <Badge
                      variant="outline"
                      className="rounded-full border-[#22C7A1]/25 bg-[#22C7A1]/10 font-black text-[#0B9B7E]"
                    >
                      {netPerMeal > 0
                        ? `${netPerMeal.toFixed(2)} QAR / meal`
                        : "No rate yet"}
                    </Badge>
                  </div>
                  <p className="mt-3 text-xs font-medium leading-5 text-[#94A3B8]">
                    Gross rate and commission are managed by the admin and
                    reflected in partner earnings.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-[#E5EAF1] bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#7C83F6]">
                  Payout history
                </p>
                <h2 className="mt-1 text-xl font-black tracking-tight text-[#020617]">
                  Recent transfers
                </h2>
              </div>
              <Badge className="rounded-full border-[#E5EAF1] bg-[#F6F8FB] text-[#020617] hover:bg-[#F6F8FB]">
                {payouts.length} records
              </Badge>
            </div>

            {payouts.length > 0 ? (
              <div className="space-y-3">
                {payouts.map((payout) => {
                  const cfg =
                    statusStyles[payout.status ?? "pending"] ??
                    statusStyles.failed;
                  return (
                    <div
                      key={payout.id}
                      className="grid gap-3 rounded-[22px] border border-[#E5EAF1] bg-[#F6F8FB] p-4 sm:grid-cols-[1.2fr_0.8fr_0.8fr_1fr] sm:items-center"
                    >
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                          Period
                        </p>
                        <p className="mt-1 text-sm font-black text-[#020617]">
                          {format(new Date(payout.period_start), "MMM d")} -{" "}
                          {format(new Date(payout.period_end), "MMM d")}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                          Amount
                        </p>
                        <p className="mt-1 text-sm font-black text-[#0B9B7E]">
                          {payout.amount.toLocaleString()} QAR
                        </p>
                      </div>
                      <div>
                        <Badge
                          variant="outline"
                          className={`rounded-full font-black ${cfg.className}`}
                        >
                          {cfg.icon}
                          {cfg.label}
                        </Badge>
                      </div>
                      <div className="min-w-0 sm:text-right">
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                          Reference
                        </p>
                        <p className="mt-1 truncate font-mono text-xs font-bold text-[#64748B]">
                          {payout.reference_number || "-"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-[24px] border border-dashed border-[#E5EAF1] bg-[#F6F8FB] p-10 text-center">
                <FileText className="mx-auto mb-3 h-10 w-10 text-[#94A3B8]" />
                <p className="text-sm font-black text-[#020617]">
                  No payouts yet
                </p>
                <p className="mt-1 text-xs font-medium text-[#94A3B8]">
                  Payouts are processed every 3 days.
                </p>
              </div>
            )}
          </section>

          <section className="grid gap-4 md:grid-cols-3">
            <div className="rounded-[24px] border border-[#E5EAF1] bg-white p-5 shadow-sm">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#38BDF8]/10 text-[#0284C7]">
                <Calendar className="h-5 w-5" />
              </div>
              <h3 className="text-base font-black text-[#020617]">
                Payout schedule
              </h3>
              <p className="mt-2 text-sm font-medium leading-6 text-[#64748B]">
                Earnings are transferred every 3 days. Next payout:{" "}
                {nextPayoutFullDate}.
              </p>
            </div>
            <div className="rounded-[24px] border border-[#E5EAF1] bg-white p-5 shadow-sm">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#22C7A1]/10 text-[#0B9B7E]">
                <DollarSign className="h-5 w-5" />
              </div>
              <h3 className="text-base font-black text-[#020617]">
                Payout structure
              </h3>
              <p className="mt-2 text-sm font-medium leading-6 text-[#64748B]">
                You receive{" "}
                {netPerMeal > 0
                  ? `${netPerMeal.toFixed(2)} QAR net`
                  : "a configured rate"}{" "}
                per meal after {commissionRate}% platform commission.
              </p>
            </div>
            <div className="rounded-[24px] border border-[#E5EAF1] bg-white p-5 shadow-sm">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F97316]/10 text-[#F97316]">
                <ArrowUpRight className="h-5 w-5" />
              </div>
              <h3 className="text-base font-black text-[#020617]">
                Growth tips
              </h3>
              <p className="mt-2 text-sm font-medium leading-6 text-[#64748B]">
                Keep meal photos sharp and macros accurate to improve visibility
                in AI recommendations.
              </p>
            </div>
          </section>
        </div>
      </div>
    </PartnerLayout>
  );
}
