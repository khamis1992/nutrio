import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Wallet, TrendingUp, Calendar, DollarSign, ArrowUpRight, Gift } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

import { useNavigate } from "react-router-dom";

export default function DriverEarnings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [driverId, setDriverId] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);
  const [stats, setStats] = useState({
    today: { deliveries: 0, earnings: 0 },
    week: { deliveries: 0, earnings: 0 },
    month: { deliveries: 0, earnings: 0 },
    tips: 0,
  });
  const [recentEarnings, setRecentEarnings] = useState<{ id: string; amount: number; type: string; description: string; created_at: string }[]>([]);

  useEffect(() => {
    if (user) {
      fetchDriverData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (driverId) {
      fetchEarnings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId]);

  const fetchDriverData = async () => {
    if (!user) return;

    try {
      const { data: driver, error } = await supabase
        .from("drivers")
        .select("id, wallet_balance")
        .eq("user_id", user.id)
        .single();

      if (error) throw error;
      setDriverId(driver.id);
      setBalance(driver.wallet_balance || 0);
    } catch (error) {
      console.error("Error fetching driver data:", error);
      setLoading(false);
    }
  };

  const fetchEarnings = async () => {
    if (!driverId) return;

    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(todayStart);
      weekStart.setDate(weekStart.getDate() - 7);
      const monthStart = new Date(todayStart);
      monthStart.setDate(monthStart.getDate() - 30);

      const { data: deliveries, error } = await supabase
        .from("delivery_jobs")
        .select("delivery_fee, driver_earnings, delivered_at, created_at")
        .eq("driver_id", driverId)
        .in("status", ["completed"])
        .gte("delivered_at", monthStart.toISOString())
        .order("delivered_at", { ascending: false });

      if (error) throw error;

      const todayDeliveries = (deliveries || []).filter(
        (d) => d.delivered_at && new Date(d.delivered_at) >= todayStart
      );
      const weekDeliveries = (deliveries || []).filter(
        (d) => d.delivered_at && new Date(d.delivered_at) >= weekStart
      );
      const monthDeliveries = deliveries || [];

      const calcEarnings = (list: Record<string, unknown>[]) =>
        list.reduce((sum, d) => sum + ((d.driver_earnings as number) || 0), 0);
      const calcTips = (list: Record<string, unknown>[]) =>
        list.reduce((sum, d) => sum + (((d.driver_earnings as number) || 0) * 0.2), 0); // Estimate 20% as tips

      setStats({
        today: {
          deliveries: todayDeliveries.length,
          earnings: calcEarnings(todayDeliveries),
        },
        week: {
          deliveries: weekDeliveries.length,
          earnings: calcEarnings(weekDeliveries),
        },
        month: {
          deliveries: monthDeliveries.length,
          earnings: calcEarnings(monthDeliveries),
        },
        tips: calcTips(monthDeliveries),
      });

      setRecentEarnings((deliveries || []).slice(0, 10));
    } catch (error) {
      console.error("Error fetching earnings:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
        <Card className="bg-gradient-to-br from-green-500 to-emerald-600 text-white">
          <CardContent className="py-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-green-100">Available Balance</span>
              <Wallet className="h-5 w-5 text-green-100" />
            </div>
            <p className="text-4xl font-bold mb-4">QAR {balance.toFixed(2)}</p>
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => navigate("/driver/payouts")}
            >
              Request Payout
            </Button>
          </CardContent>
        </Card>

        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="py-4 text-center">
              <p className="text-xl font-bold text-green-600">QAR {stats.today.earnings.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">Today</p>
              <p className="text-xs text-muted-foreground">{stats.today.deliveries} orders</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <p className="text-xl font-bold text-green-600">QAR {stats.week.earnings.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">This Week</p>
              <p className="text-xs text-muted-foreground">{stats.week.deliveries} orders</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <p className="text-xl font-bold text-green-600">QAR {stats.month.earnings.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">This Month</p>
              <p className="text-xs text-muted-foreground">{stats.month.deliveries} orders</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                  <Gift className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="font-medium">Tips (30 days)</p>
                  <p className="text-sm text-muted-foreground">{stats.tips > 0 ? "Keep up the great work!" : "Tips can boost your earnings"}</p>
                </div>
              </div>
              <p className="text-xl font-bold text-amber-600">QAR {stats.tips.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recent Earnings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentEarnings.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No earnings yet
              </p>
            ) : (
              recentEarnings.map((earning, index) => (
                <div key={index} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center">
                      <DollarSign className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        QAR {((earning.delivery_fee || 0) + (earning.tip_amount || 0)).toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(earning.delivered_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  {earning.tip_amount > 0 && (
                    <Badge variant="outline" className="text-green-600 border-green-500/50">
                      +QAR {earning.tip_amount.toFixed(2)} tip
                    </Badge>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
    </div>
  );
}
