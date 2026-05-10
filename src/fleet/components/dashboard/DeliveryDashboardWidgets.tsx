/**
 * Delivery Dashboard Widgets
 * - Active deliveries count with driver status
 * - On-time delivery rate
 * - Average delivery time
 */

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Truck, Clock, CheckCircle2, TrendingUp, Loader2 } from "lucide-react";

interface DeliveryStats {
  activeDeliveries: number;
  driversOnline: number;
  onTimeRate: number;
  avgDeliveryTime: number; // minutes
  todayCompleted: number;
}

export function DeliveryDashboardWidgets() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DeliveryStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();

      const [
        { count: activeCount },
        { count: todayCompleted },
        { count: onlineDrivers },
        { data: deliveryTimes },
      ] = await Promise.all([
        supabase
          .from("delivery_jobs")
          .select("*", { count: "exact", head: true })
          .in("status", ["claimed", "picked_up", "on_the_way"]),
        supabase
          .from("delivery_jobs")
          .select("*", { count: "exact", head: true })
          .in("status", ["delivered", "completed"])
          .gte("delivered_at", todayISO),
        supabase
          .from("drivers")
          .select("*", { count: "exact", head: true })
          .eq("is_online", true),
        supabase
          .from("delivery_jobs")
          .select("created_at, delivered_at, estimated_delivery_time")
          .in("status", ["delivered", "completed"])
          .gte("delivered_at", todayISO)
          .limit(200),
      ]);

      // Calculate avg delivery time
      let avgTime = 0;
      let onTime = 0;
      let total = 0;

      (deliveryTimes || []).forEach((d: { delivered_at?: string; created_at?: string; estimated_delivery_time?: string }) => {
        if (d.delivered_at && d.created_at) {
          const mins = (new Date(d.delivered_at).getTime() - new Date(d.created_at).getTime()) / 60000;
          avgTime += mins;
          total++;
          if (d.estimated_delivery_time) {
            const est = new Date(d.estimated_delivery_time).getTime();
            if (new Date(d.delivered_at).getTime() <= est) onTime++;
          }
        }
      });

      avgTime = total > 0 ? Math.round(avgTime / total) : 0;
      const onTimeRate = total > 0 ? Math.round((onTime / total) * 100) : 0;

      setStats({
        activeDeliveries: activeCount || 0,
        driversOnline: onlineDrivers || 0,
        onTimeRate,
        avgDeliveryTime: avgTime,
        todayCompleted: todayCompleted || 0,
      });
    } catch (err) {
      console.error("Error fetching delivery stats:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  // Realtime subscription for delivery_jobs changes
  useEffect(() => {
    const channel = supabase
      .channel("delivery-dashboard-stats")
      .on("postgres_changes", { event: "*", schema: "public", table: "delivery_jobs" }, () => fetchStats())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "drivers" }, () => fetchStats())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchStats]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}><CardContent className="py-4 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></CardContent></Card>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const widgets = [
    { label: "Active Deliveries", value: stats.activeDeliveries, icon: Truck, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Drivers Online", value: stats.driversOnline, icon: TrendingUp, color: "text-green-600", bg: "bg-green-50" },
    { label: "On-Time Rate", value: `${stats.onTimeRate}%`, icon: CheckCircle2, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "Avg Delivery", value: `${stats.avgDeliveryTime}m`, icon: Clock, color: "text-purple-600", bg: "bg-purple-50" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {widgets.map(({ label, value, icon: Icon, color, bg }) => (
        <Card key={label} className="hover:shadow-md transition-shadow">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{value}</p>
                <p className="text-xs text-gray-500">{label}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
