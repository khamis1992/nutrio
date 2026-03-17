import { useState, useMemo, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useFleetStats } from "@/fleet/hooks/useDrivers";
import { useCity } from "@/fleet/context/CityContext";
import { 
  Users, 
  Truck, 
  Package, 
  Clock, 
  TrendingUp, 
  MapPin, 
  Activity,
  ChevronRight,
  Plus,
  BarChart2,
} from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface ActivityEntry {
  id: string;
  action: string;
  performedAt: string | null;
  driverName: string;
  reason: string | null;
}

export default function FleetDashboard() {
  const { selectedCities } = useCity();
  const cityIds = useMemo(() => selectedCities.map(c => c.id), [selectedCities]);
  const { stats, isLoading } = useFleetStats(cityIds);
  const [selectedCity, setSelectedCity] = useState<string>("all");
  const [recentActivity, setRecentActivity] = useState<ActivityEntry[]>([]);

  useEffect(() => {
    async function loadActivity() {
      const { data } = await supabase
        .from("driver_assignment_history")
        .select("id, action, performed_at, reason, driver_id")
        .order("performed_at", { ascending: false })
        .limit(5);

      if (!data) return;

      const driverIds = [...new Set(data.map(r => r.driver_id).filter(Boolean))];
      let nameMap: Record<string, string> = {};
      if (driverIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, phone_number")
          .in("id", driverIds);
        (profiles || []).forEach(p => {
          nameMap[p.id] = p.full_name || p.phone_number || "Driver";
        });
      }

      setRecentActivity(
        data.map(r => ({
          id: r.id,
          action: r.action,
          performedAt: r.performed_at,
          driverName: r.driver_id ? (nameMap[r.driver_id] || "Driver") : "Driver",
          reason: r.reason,
        }))
      );
    }
    loadActivity().catch(console.error);
  }, []);

  const getStatusColor = (isOnline: boolean) => 
    isOnline ? "bg-green-500" : "bg-gray-400";

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 w-full" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  // Safety check - ensure we have valid stats
  const safeStats = stats || {
    totalDrivers: 0,
    activeDrivers: 0,
    onlineDrivers: 0,
    ordersInProgress: 0,
    todayDeliveries: 0,
    averageDeliveryTime: 0,
    cities: []
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Fleet Dashboard</h1>
          <p className="text-muted-foreground">Overview of your fleet operations</p>
        </div>
        <div className="flex items-center gap-2">
          <select 
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            className="px-3 py-2 border rounded-lg bg-background"
          >
            <option value="all">All Cities</option>
            <option value="doha">Doha</option>
            <option value="rayyan">Al Rayyan</option>
          </select>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{safeStats.totalDrivers}</p>
                <p className="text-xs text-muted-foreground">Total Drivers</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <div className={`w-3 h-3 rounded-full ${getStatusColor(true)}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{safeStats.onlineDrivers}</p>
                <p className="text-xs text-muted-foreground">Online Now</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Package className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{safeStats.ordersInProgress}</p>
                <p className="text-xs text-muted-foreground">Active Orders</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{safeStats.todayDeliveries}</p>
                <p className="text-xs text-muted-foreground">Today's Deliveries</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      {/* Dispatch Center — primary entry point */}
      <Link to="/fleet/dispatch">
        <Card className="hover:border-primary/60 transition-colors cursor-pointer border-primary/30 bg-primary/5">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center shrink-0">
                  <Package className="h-6 w-6 text-primary-foreground" />
                </div>
                <div>
                  <p className="font-semibold text-base">Dispatch Center</p>
                  <p className="text-sm text-muted-foreground">
                    Assign orders to drivers — live queue, bulk assign, and auto rules
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
            </div>
          </CardContent>
        </Card>
      </Link>

      {/* Secondary quick links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Link to="/fleet/drivers">
          <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
            <CardContent className="pt-4 text-center">
              <Users className="h-6 w-6 mx-auto mb-2 text-primary" />
              <p className="font-medium text-sm">Drivers</p>
            </CardContent>
          </Card>
        </Link>
        <Link to="/fleet/vehicles">
          <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
            <CardContent className="pt-4 text-center">
              <Truck className="h-6 w-6 mx-auto mb-2 text-amber-500" />
              <p className="font-medium text-sm">Vehicles</p>
            </CardContent>
          </Card>
        </Link>
        <Link to="/fleet/tracking">
          <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
            <CardContent className="pt-4 text-center">
              <MapPin className="h-6 w-6 mx-auto mb-2 text-green-500" />
              <p className="font-medium text-sm">Live Tracking</p>
            </CardContent>
          </Card>
        </Link>
        <Link to="/fleet/analytics">
          <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
            <CardContent className="pt-4 text-center">
              <BarChart2 className="h-6 w-6 mx-auto mb-2 text-violet-500" />
              <p className="font-medium text-sm">Analytics</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Driver Status Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Driver Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-8">
            <div className="relative w-32 h-32">
              <svg className="w-full h-full" viewBox="0 0 36 36">
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#e5e7eb"
                  strokeWidth="3"
                />
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth="3"
                  strokeDasharray={`${(safeStats.onlineDrivers / Math.max(safeStats.totalDrivers, 1)) * 100}, 100`}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xl font-bold">{Math.round((safeStats.onlineDrivers / Math.max(safeStats.totalDrivers, 1)) * 100)}%</span>
              </div>
            </div>
            <div className="flex-1 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-sm">Online</span>
                </div>
                <span className="font-medium">{safeStats.onlineDrivers}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-gray-400" />
                  <span className="text-sm">Offline</span>
                </div>
                <span className="font-medium">{safeStats.totalDrivers - safeStats.onlineDrivers}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Recent Activity</CardTitle>
          <Link to="/fleet/dispatch">
            <Button variant="ghost" size="sm">
              Go to Dispatch <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {recentActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No recent dispatch activity.</p>
          ) : (
            <div className="space-y-3">
              {recentActivity.map((entry) => {
                const isAssign = entry.action === "assigned";
                const isReassign = entry.action === "reassigned";
                const iconColor = isAssign ? "text-green-500" : isReassign ? "text-blue-500" : "text-amber-500";
                const bgColor = isAssign ? "bg-green-500/10" : isReassign ? "bg-blue-500/10" : "bg-amber-500/10";
                const label = isAssign ? "Order assigned" : isReassign ? "Order reassigned" : entry.action.replace(/_/g, " ");
                return (
                  <div key={entry.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg ${bgColor} flex items-center justify-center`}>
                        <Activity className={`h-5 w-5 ${iconColor}`} />
                      </div>
                      <div>
                        <p className="font-medium capitalize">{label}</p>
                        <p className="text-sm text-muted-foreground">
                          {entry.driverName}{entry.reason ? ` — ${entry.reason}` : ""}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm text-muted-foreground whitespace-nowrap">
                      {entry.performedAt ? formatDistanceToNow(new Date(entry.performedAt), { addSuffix: true }) : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Driver CTA */}
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-lg">Need more drivers?</h3>
              <p className="text-muted-foreground text-sm mt-1">
                Add new drivers to expand your fleet coverage
              </p>
            </div>
            <Link to="/fleet/drivers">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Driver
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
