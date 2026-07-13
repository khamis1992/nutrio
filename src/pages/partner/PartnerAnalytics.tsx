import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TrendingUp,
  DollarSign,
  ShoppingBag,
  Users,
  Utensils,
  Crown,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { PartnerLayout } from "@/components/PartnerLayout";
import { PremiumAnalyticsPaywall } from "@/components/PremiumAnalyticsPaywall";
import { PremiumAnalyticsDashboard } from "@/components/PremiumAnalyticsDashboard";
import { usePremiumAnalytics } from "@/hooks/usePremiumAnalytics";
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
import { formatCurrency } from "@/lib/currency";

interface DailyData {
  date: string;
  orders: number;
  revenue: number;
}

interface MealStats {
  name: string;
  orders: number;
  revenue: number;
}

const COLORS = ["#22C7A1", "#7C83F6", "#38BDF8", "#F97316", "#FB6B7A"];

/**
 * Analytics page revenue is computed from meal schedules and partner payout settings.
 * This is an approximation; actual earnings are tracked in partner_earnings (trigger-populated)
 * and displayed on the Earnings and Payouts pages. Small deltas between pages are expected.
 */
const PartnerAnalytics = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [topMeals, setTopMeals] = useState<MealStats[]>([]);
  const [mealTypeDistribution, setMealTypeDistribution] = useState<
    { name: string; value: number }[]
  >([]);
  const [totalStats, setTotalStats] = useState({
    totalOrders: 0,
    totalRevenue: 0,
    avgOrderValue: 0,
    uniqueCustomers: 0,
  });

  const {
    hasPremium,
    premiumUntil,
    hasPendingRequest,
    loading: premiumLoading,
    refetch: refetchPremium,
  } = usePremiumAnalytics(restaurantId);

  useEffect(() => {
    if (user) {
      fetchAnalytics();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchAnalytics = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Get partner's restaurant (include payout_rate for revenue calculation)
      const { data: restaurant } = await supabase
        .from("restaurants")
        .select("id, payout_rate, commission_rate")
        .eq("owner_id", user.id)
        .maybeSingle();

      if (!restaurant) {
        navigate("/partner");
        return;
      }

      setRestaurantId(restaurant.id);
      // Net payout per meal = gross adjusted by platform commission.
      const grossRate = restaurant.payout_rate || 0;
      const commissionRate = restaurant.commission_rate ?? 18;
      const payoutRate = grossRate * (1 - commissionRate / 100);

      // Get meals for this restaurant
      const { data: meals } = await supabase
        .from("meals")
        .select("id, name")
        .eq("restaurant_id", restaurant.id);

      const mealIds = meals?.map((m) => m.id) || [];
      const mealMap =
        meals?.reduce(
          (acc, m) => {
            acc[m.id] = { name: m.name };
            return acc;
          },
          {} as Record<string, { name: string }>,
        ) || {};

      if (mealIds.length === 0) {
        setLoading(false);
        return;
      }

      // Get all scheduled meals
      const { data: schedules } = await supabase
        .from("meal_schedules")
        .select("id, scheduled_date, meal_type, meal_id, user_id")
        .in("meal_id", mealIds);

      if (!schedules || schedules.length === 0) {
        setLoading(false);
        return;
      }

      // Calculate daily data for last 7 days
      const last7Days: DailyData[] = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split("T")[0];
        const daySchedules = schedules.filter(
          (s) => s.scheduled_date === dateStr,
        );
        const revenue = daySchedules.length * payoutRate;
        last7Days.push({
          date: date.toLocaleDateString("en-US", { weekday: "short" }),
          orders: daySchedules.length,
          revenue,
        });
      }
      setDailyData(last7Days);

      // Calculate top meals
      const mealCounts: Record<string, { orders: number; revenue: number }> =
        {};
      schedules.forEach((s) => {
        if (!mealCounts[s.meal_id]) {
          mealCounts[s.meal_id] = { orders: 0, revenue: 0 };
        }
        mealCounts[s.meal_id].orders++;
        mealCounts[s.meal_id].revenue += payoutRate;
      });

      const topMealsList = Object.entries(mealCounts)
        .map(([id, stats]) => ({
          name:
            (mealMap[id] as { name: string } | undefined)?.name || "Unknown",
          ...stats,
        }))
        .sort((a, b) => b.orders - a.orders)
        .slice(0, 5);
      setTopMeals(topMealsList);

      // Calculate meal type distribution
      const mealTypeCounts: Record<string, number> = {};
      schedules.forEach((s) => {
        mealTypeCounts[s.meal_type] = (mealTypeCounts[s.meal_type] || 0) + 1;
      });
      setMealTypeDistribution(
        Object.entries(mealTypeCounts).map(([name, value]) => ({
          name,
          value,
        })),
      );

      // Calculate total stats using payout_rate (subscription model)
      const uniqueCustomers = new Set(schedules.map((s) => s.user_id)).size;
      const totalRevenue = schedules.length * payoutRate;
      setTotalStats({
        totalOrders: schedules.length,
        totalRevenue,
        avgOrderValue:
          schedules.length > 0 ? totalRevenue / schedules.length : 0,
        uniqueCustomers,
      });
    } catch (error) {
      console.error("Error fetching analytics:", error);
      toast({
        title: "Error",
        description: "Failed to load analytics",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <PartnerLayout title="Analytics">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-2">
            <Skeleton className="h-24 rounded-3xl" />
            <Skeleton className="h-24 rounded-3xl" />
            <Skeleton className="h-24 rounded-3xl" />
            <Skeleton className="h-24 rounded-3xl" />
          </div>
          <Skeleton className="h-64 rounded-3xl" />
        </div>
      </PartnerLayout>
    );
  }

  return (
    <PartnerLayout title="Analytics">
      <div className="-m-6 min-h-screen bg-[#F6F8FB] p-4 text-[#020617] sm:p-6">
        <div className="mx-auto max-w-7xl space-y-4">
          <section className="overflow-hidden rounded-[28px] border border-[#E5EAF1] bg-white shadow-[0_22px_70px_rgba(2,6,23,0.06)]">
            <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between lg:p-5">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl bg-[#020617] text-white">
                  <TrendingUp className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[#7C83F6]">
                    Partner analytics
                  </p>
                  <h1 className="mt-1 text-2xl font-black tracking-tight text-[#020617]">
                    Performance intelligence
                  </h1>
                  <p className="mt-1 max-w-2xl text-sm font-medium text-[#64748B]">
                    Track demand, revenue trends, customer activity, and the
                    meals driving your business.
                  </p>
                </div>
              </div>
              <div className="rounded-3xl bg-[#020617] px-5 py-4 text-white">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-white/50">
                  Total revenue
                </p>
                <p className="mt-1 text-2xl font-black">
                  {formatCurrency(totalStats.totalRevenue)}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 border-t border-[#E5EAF1] bg-[#F6F8FB] p-4 lg:grid-cols-4">
              {[
                {
                  label: "Total orders",
                  value: totalStats.totalOrders,
                  icon: ShoppingBag,
                  color: "#7C83F6",
                  bg: "bg-[#7C83F6]/10",
                },
                {
                  label: "Revenue",
                  value: formatCurrency(totalStats.totalRevenue),
                  icon: DollarSign,
                  color: "#22C7A1",
                  bg: "bg-[#22C7A1]/10",
                },
                {
                  label: "Avg order",
                  value: formatCurrency(totalStats.avgOrderValue),
                  icon: TrendingUp,
                  color: "#38BDF8",
                  bg: "bg-[#38BDF8]/10",
                },
                {
                  label: "Customers",
                  value: totalStats.uniqueCustomers,
                  icon: Users,
                  color: "#F97316",
                  bg: "bg-[#F97316]/10",
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-3xl border border-[#E5EAF1] bg-white p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-black uppercase tracking-[0.12em] text-[#94A3B8]">
                        {stat.label}
                      </p>
                      <p className="mt-2 truncate text-xl font-black text-[#020617]">
                        {stat.value}
                      </p>
                    </div>
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${stat.bg}`}
                    >
                      <stat.icon
                        className="h-5 w-5"
                        style={{ color: stat.color }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <Tabs defaultValue="basic" className="space-y-4">
            <TabsList className="grid h-auto grid-cols-2 gap-2 rounded-[28px] border border-[#E5EAF1] bg-white p-2 shadow-[0_14px_36px_rgba(2,6,23,0.04)]">
              <TabsTrigger
                value="basic"
                className="min-h-14 rounded-3xl text-sm font-black text-[#64748B] data-[state=active]:bg-[#020617] data-[state=active]:text-white"
              >
                Basic analytics
              </TabsTrigger>
              <TabsTrigger
                value="premium"
                className="min-h-14 rounded-3xl text-sm font-black text-[#64748B] data-[state=active]:bg-[#020617] data-[state=active]:text-white"
              >
                <Crown className="mr-2 h-4 w-4" />
                Premium insights
              </TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4">
              <section className="grid gap-4 lg:grid-cols-2">
                <Card className="rounded-[28px] border border-[#E5EAF1] bg-white shadow-[0_14px_36px_rgba(2,6,23,0.04)]">
                  <CardContent className="p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#22C7A1]">
                          Revenue
                        </p>
                        <h2 className="mt-1 text-xl font-black text-[#020617]">
                          Last 7 days
                        </h2>
                      </div>
                      <DollarSign className="h-5 w-5 text-[#22C7A1]" />
                    </div>
                    <div className="h-56 md:h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={dailyData}>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#E5EAF1"
                          />
                          <XAxis
                            dataKey="date"
                            tick={{ fontSize: 11, fill: "#94A3B8" }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            tick={{ fontSize: 11, fill: "#94A3B8" }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "#fff",
                              border: "1px solid #E5EAF1",
                              borderRadius: "16px",
                              color: "#020617",
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="revenue"
                            stroke="#22C7A1"
                            strokeWidth={3}
                            dot={{ fill: "#22C7A1", r: 4 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-[28px] border border-[#E5EAF1] bg-white shadow-[0_14px_36px_rgba(2,6,23,0.04)]">
                  <CardContent className="p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#7C83F6]">
                          Orders
                        </p>
                        <h2 className="mt-1 text-xl font-black text-[#020617]">
                          Daily volume
                        </h2>
                      </div>
                      <ShoppingBag className="h-5 w-5 text-[#7C83F6]" />
                    </div>
                    <div className="h-56 md:h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dailyData}>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#E5EAF1"
                          />
                          <XAxis
                            dataKey="date"
                            tick={{ fontSize: 11, fill: "#94A3B8" }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            tick={{ fontSize: 11, fill: "#94A3B8" }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "#fff",
                              border: "1px solid #E5EAF1",
                              borderRadius: "16px",
                              color: "#020617",
                            }}
                          />
                          <Bar
                            dataKey="orders"
                            fill="#7C83F6"
                            radius={[10, 10, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </section>

              <section className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
                <Card className="rounded-[28px] border border-[#E5EAF1] bg-white shadow-[0_14px_36px_rgba(2,6,23,0.04)]">
                  <CardContent className="p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#F97316]">
                          Menu winners
                        </p>
                        <h2 className="mt-1 text-xl font-black text-[#020617]">
                          Top meals
                        </h2>
                      </div>
                      <Utensils className="h-5 w-5 text-[#F97316]" />
                    </div>
                    {topMeals.length === 0 ? (
                      <p className="rounded-3xl bg-[#F6F8FB] py-8 text-center text-sm font-bold text-[#94A3B8]">
                        No data yet
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {topMeals.map((meal, index) => (
                          <div
                            key={meal.name}
                            className="flex items-center justify-between gap-3 rounded-3xl border border-[#E5EAF1] bg-[#F6F8FB] p-3"
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-sm font-black text-[#020617]">
                                #{index + 1}
                              </span>
                              <span className="truncate font-black text-[#020617]">
                                {meal.name}
                              </span>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-sm font-black text-[#020617]">
                                {meal.orders} orders
                              </p>
                              <p className="text-xs font-bold text-[#94A3B8]">
                                {formatCurrency(meal.revenue)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="rounded-[28px] border border-[#E5EAF1] bg-white shadow-[0_14px_36px_rgba(2,6,23,0.04)]">
                  <CardContent className="p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#38BDF8]">
                          Distribution
                        </p>
                        <h2 className="mt-1 text-xl font-black text-[#020617]">
                          Meal types
                        </h2>
                      </div>
                      <ShoppingBag className="h-5 w-5 text-[#38BDF8]" />
                    </div>
                    {mealTypeDistribution.length === 0 ? (
                      <p className="rounded-3xl bg-[#F6F8FB] py-8 text-center text-sm font-bold text-[#94A3B8]">
                        No data yet
                      </p>
                    ) : (
                      <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={mealTypeDistribution}
                              cx="50%"
                              cy="50%"
                              innerRadius={48}
                              outerRadius={72}
                              paddingAngle={5}
                              dataKey="value"
                              label={({ name, percent }) =>
                                `${name} ${(percent * 100).toFixed(0)}%`
                              }
                              labelLine={false}
                              fontSize={11}
                            >
                              {mealTypeDistribution.map((_, index) => (
                                <Cell
                                  key={`cell-${index}`}
                                  fill={COLORS[index % COLORS.length]}
                                />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "#fff",
                                border: "1px solid #E5EAF1",
                                borderRadius: "16px",
                                color: "#020617",
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </section>
            </TabsContent>

            <TabsContent value="premium" className="space-y-4">
              {premiumLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-24 rounded-3xl" />
                  <Skeleton className="h-64 rounded-3xl" />
                </div>
              ) : hasPremium && restaurantId ? (
                <PremiumAnalyticsDashboard
                  restaurantId={restaurantId}
                  premiumUntil={premiumUntil}
                />
              ) : restaurantId && user ? (
                <PremiumAnalyticsPaywall
                  restaurantId={restaurantId}
                  partnerId={user.id}
                  onPurchase={refetchPremium}
                  hasPendingRequest={hasPendingRequest}
                />
              ) : (
                <Card className="rounded-[28px] border border-[#E5EAF1] bg-white">
                  <CardContent className="py-10 text-center text-sm font-bold text-[#94A3B8]">
                    Please set up your restaurant first
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </PartnerLayout>
  );
};

export default PartnerAnalytics;
