import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { 
  MapPin, 
  Navigation, 
  Clock, 
  ChefHat,
  RefreshCw,
  Phone,
  User,
  Truck,
  CheckCircle,
  Save,
  Settings2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistance, calculateDistance } from "@/lib/distance";
import { toast } from "@/components/ui/use-toast";

interface RestaurantBranch {
  id: string;
  restaurant_id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  phone_number: string | null;
  is_active: boolean;
  is_accepting_orders: boolean;
  max_orders_per_slot: number;
  service_radius_km: number;
  avg_prep_time_minutes: number;
  routing_priority: number;
  routing_notes: string | null;
}

interface BranchOrder {
  id: string;
  created_at: string;
  status: string;
  total_amount: number;
  delivery_address: string;
  delivery_lat: number | null;
  delivery_lng: number | null;
  customer_name?: string;
  customer_phone?: string;
  estimated_delivery_time?: string;
  meals?: {
    name: string;
    quantity: number;
  }[];
}

/**
 * Partner Branch Orders Component
 * Shows only orders assigned to this partner's specific branch
 * Partners can only see their own branch's orders
 */
export function PartnerBranchOrders() {
  const { user } = useAuth();
  const [branches, setBranches] = useState<RestaurantBranch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<RestaurantBranch | null>(null);
  const [orders, setOrders] = useState<BranchOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "preparing" | "ready">("all");
  const [savingRouting, setSavingRouting] = useState(false);

  useEffect(() => {
    if (user) {
      fetchPartnerBranches();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (selectedBranch) {
      fetchBranchOrders(selectedBranch.id);
    }
  }, [selectedBranch]);

  const fetchPartnerBranches = async () => {
    if (!user) return;

    try {
      // First get the restaurant owned by this user
      const { data: restaurant, error: restaurantError } = await supabase
        .from('restaurants')
        .select('id')
        .eq('owner_id', user.id)
        .single();

      if (restaurantError) throw restaurantError;
      if (!restaurant) {
        setLoading(false);
        return;
      }

      // Then get branches for that restaurant
      const { data: branchData, error: branchError } = await supabase
        .from('restaurant_branches')
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .eq('is_active', true)
        .order('name');

      if (branchError) throw branchError;
      
      const normalizedBranches = ((branchData || []) as unknown as RestaurantBranch[]).map((branch) => ({
        ...branch,
        is_active: branch.is_active ?? false,
        is_accepting_orders: branch.is_accepting_orders ?? true,
        max_orders_per_slot: branch.max_orders_per_slot ?? 20,
        service_radius_km: branch.service_radius_km ?? 12,
        avg_prep_time_minutes: branch.avg_prep_time_minutes ?? 20,
        routing_priority: branch.routing_priority ?? 0,
        routing_notes: branch.routing_notes ?? null,
      }));
      setBranches(normalizedBranches);
      
      // Auto-select first branch
      if (normalizedBranches.length > 0) {
        setSelectedBranch(normalizedBranches[0]);
      }
    } catch (error) {
      console.error("Error fetching partner branches:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateSelectedBranch = (updates: Partial<RestaurantBranch>) => {
    if (!selectedBranch) return;

    const nextBranch = { ...selectedBranch, ...updates };
    setSelectedBranch(nextBranch);
    setBranches((current) =>
      current.map((branch) => (branch.id === nextBranch.id ? nextBranch : branch))
    );
  };

  const saveRoutingSettings = async () => {
    if (!selectedBranch) return;

    setSavingRouting(true);
    try {
      const { error } = await supabase.rpc("update_restaurant_branch_routing" as never, {
        p_branch_id: selectedBranch.id,
        p_is_accepting_orders: selectedBranch.is_accepting_orders,
        p_max_orders_per_slot: selectedBranch.max_orders_per_slot,
        p_service_radius_km: selectedBranch.service_radius_km,
        p_avg_prep_time_minutes: selectedBranch.avg_prep_time_minutes,
        p_routing_priority: selectedBranch.routing_priority,
        p_routing_notes: selectedBranch.routing_notes,
      } as never);

      if (error) throw error;

      toast({
        title: "Branch routing updated",
        description: "New orders will use these routing rules automatically.",
      });
    } catch (error) {
      console.error("Error saving branch routing settings:", error);
      toast({
        title: "Could not save branch routing",
        description: "Check your permissions and try again.",
        variant: "destructive",
      });
    } finally {
      setSavingRouting(false);
    }
  };

  const fetchBranchOrders = async (branchId: string) => {
    try {
      // Fetch orders assigned to this specific branch
      const { data: ordersData, error: orderError } = await supabase
        .from('orders')
        .select(`
          *,
          meals:order_items(quantity, meals(name))
        `)
        .eq('restaurant_branch_id', branchId)
        .in('status', ['pending', 'confirmed', 'preparing', 'ready_for_pickup'])
        .order('created_at', { ascending: false });

      if (orderError) throw orderError;
      const normalizedOrders: BranchOrder[] = (ordersData || []).map((order) => ({
        id: order.id,
        created_at: order.created_at,
        status: order.status,
        total_amount: order.total_amount ?? 0,
        delivery_address: order.delivery_address ?? "",
        delivery_lat: order.delivery_lat,
        delivery_lng: order.delivery_lng,
        customer_phone: order.phone_number ?? undefined,
        estimated_delivery_time: order.estimated_delivery_time ?? undefined,
        meals: order.meals.flatMap((item) =>
          item.meals
            ? [{ name: item.meals.name, quantity: item.quantity ?? 1 }]
            : []
        ),
      }));
      setOrders(normalizedOrders);
    } catch (error) {
      console.error("Error fetching branch orders:", error);
    }
  };

  // Calculate distance from branch to customer (for delivery estimation)
  const getDeliveryDistance = (deliveryLat?: number, deliveryLng?: number) => {
    if (!selectedBranch || !deliveryLat || !deliveryLng) return null;
    return calculateDistance(
      Number(selectedBranch.latitude),
      Number(selectedBranch.longitude),
      deliveryLat,
      deliveryLng
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700">Pending</Badge>;
      case "confirmed":
        return <Badge variant="outline" className="bg-blue-50 text-blue-700">Confirmed</Badge>;
      case "preparing":
        return <Badge variant="outline" className="bg-orange-50 text-orange-700">Preparing</Badge>;
      case "ready_for_pickup":
        return <Badge variant="outline" className="bg-green-50 text-green-700">Ready</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredOrders = orders.filter(order => {
    if (filter === "all") return true;
    return order.status === filter;
  });

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Branch Orders
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Branches are optional — single-location restaurants don't need them
  if (branches.length === 0) {
    return null;
  }

  const pendingCount = orders.filter(o => o.status === "pending").length;
  const preparingCount = orders.filter(o => o.status === "preparing").length;
  const readyCount = orders.filter(o => o.status === "ready_for_pickup").length;

  return (
    <Card className="bg-gradient-to-br from-slate-50 to-white">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MapPin className="h-5 w-5 text-primary" />
            Branch Orders
            <Badge variant="secondary" className="ml-2">
              {orders.length} total
            </Badge>
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => selectedBranch && fetchBranchOrders(selectedBranch.id)}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {/* Branch Selector */}
        <div className="flex gap-2 mt-2">
          {branches.map(branch => (
            <Button
              key={branch.id}
              variant={selectedBranch?.id === branch.id ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedBranch(branch)}
              className="text-xs"
            >
              <ChefHat className="h-3 w-3 mr-1" />
              {branch.name}
            </Button>
          ))}
        </div>

        {selectedBranch && (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-[#020617]">
                  <Settings2 className="h-4 w-4 text-[#22C7A1]" />
                  Routing controls
                </div>
                <p className="mt-1 text-xs text-[#64748B]">
                  Capacity and service rules for {selectedBranch.name}.
                </p>
              </div>
              <div className="flex items-center gap-2 rounded-full bg-[#F6F8FB] px-3 py-2">
                <Label htmlFor="branch-accepting-orders" className="text-xs font-semibold text-[#020617]">
                  Accepting
                </Label>
                <Switch
                  id="branch-accepting-orders"
                  checked={selectedBranch.is_accepting_orders}
                  onCheckedChange={(checked) => updateSelectedBranch({ is_accepting_orders: checked })}
                />
              </div>
            </div>

            <Separator className="my-4" />

            <div className="grid gap-3 sm:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="branch-slot-capacity" className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
                  Slot capacity
                </Label>
                <Input
                  id="branch-slot-capacity"
                  type="number"
                  min={1}
                  max={500}
                  value={selectedBranch.max_orders_per_slot}
                  onChange={(event) =>
                    updateSelectedBranch({
                      max_orders_per_slot: Math.min(500, Math.max(1, Number(event.target.value) || 1)),
                    })
                  }
                  className="h-11 rounded-xl border-slate-200 bg-[#F6F8FB] text-[#020617]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="branch-service-radius" className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
                  Radius km
                </Label>
                <Input
                  id="branch-service-radius"
                  type="number"
                  min={0.1}
                  max={250}
                  step={0.5}
                  value={selectedBranch.service_radius_km}
                  onChange={(event) =>
                    updateSelectedBranch({
                      service_radius_km: Math.min(250, Math.max(0.1, Number(event.target.value) || 0.1)),
                    })
                  }
                  className="h-11 rounded-xl border-slate-200 bg-[#F6F8FB] text-[#020617]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="branch-prep-time" className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
                  Prep min
                </Label>
                <Input
                  id="branch-prep-time"
                  type="number"
                  min={0}
                  max={240}
                  value={selectedBranch.avg_prep_time_minutes}
                  onChange={(event) =>
                    updateSelectedBranch({
                      avg_prep_time_minutes: Math.min(240, Math.max(0, Number(event.target.value) || 0)),
                    })
                  }
                  className="h-11 rounded-xl border-slate-200 bg-[#F6F8FB] text-[#020617]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="branch-routing-priority" className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
                  Priority
                </Label>
                <Input
                  id="branch-routing-priority"
                  type="number"
                  value={selectedBranch.routing_priority}
                  onChange={(event) =>
                    updateSelectedBranch({
                      routing_priority: Number(event.target.value) || 0,
                    })
                  }
                  className="h-11 rounded-xl border-slate-200 bg-[#F6F8FB] text-[#020617]"
                />
              </div>
            </div>

            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <Input
                value={selectedBranch.routing_notes ?? ""}
                onChange={(event) => updateSelectedBranch({ routing_notes: event.target.value })}
                placeholder="Internal routing note"
                className="h-11 rounded-xl border-slate-200 bg-[#F6F8FB] text-[#020617]"
              />
              <Button
                onClick={saveRoutingSettings}
                disabled={savingRouting}
                className="h-11 rounded-xl bg-[#020617] px-5 text-white hover:bg-[#111827]"
              >
                {savingRouting ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save routing
              </Button>
            </div>
          </div>
        )}

        {/* Filter Buttons */}
        <div className="flex gap-2 mt-2">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("all")}
            className="text-xs"
          >
            All {orders.length}
          </Button>
          <Button
            variant={filter === "pending" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("pending")}
            className="text-xs"
          >
            Pending {pendingCount}
          </Button>
          <Button
            variant={filter === "preparing" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("preparing")}
            className="text-xs"
          >
            Preparing {preparingCount}
          </Button>
          <Button
            variant={filter === "ready" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("ready")}
            className="text-xs"
          >
            Ready {readyCount}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No orders in this category</p>
          </div>
        ) : (
          filteredOrders.map((order) => {
            const distance = getDeliveryDistance(
              order.delivery_lat || undefined,
              order.delivery_lng || undefined
            );

            return (
              <div
                key={order.id}
                className="border rounded-lg p-4 bg-white"
              >
                {/* Order Header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-medium">
                      #{order.id.slice(0, 8)}
                    </span>
                    {getStatusBadge(order.status)}
                  </div>
                  <span className="font-semibold">
                    {order.total_amount} QAR
                  </span>
                </div>

                {/* Customer Info */}
                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                  <div className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {order.customer_name || "Customer"}
                  </div>
                  {order.customer_phone && (
                    <div className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {order.customer_phone}
                    </div>
                  )}
                </div>

                {/* Delivery Address */}
                <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
                  <MapPin className="h-3 w-3" />
                  {order.delivery_address || "No address"}
                </div>

                {/* Distance & ETA */}
                {distance !== null && (
                  <div className="flex items-center gap-2 text-sm">
                    <Badge variant="outline" className="bg-blue-50 text-blue-700">
                      <Navigation className="h-3 w-3 mr-1" />
                      {formatDistance(distance)} away
                    </Badge>
                  </div>
                )}

                {/* Order Time */}
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                  <Clock className="h-3 w-3" />
                  {new Date(order.created_at).toLocaleString()}
                </div>

                {/* Ready for Pickup Action */}
                {order.status === "ready_for_pickup" && (
                  <div className="mt-3 pt-3 border-t">
                    <div className="flex items-center justify-between">
                      <Badge className="bg-green-500">
                        <Truck className="h-3 w-3 mr-1" />
                        Ready for Driver Pickup
                      </Badge>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

export default PartnerBranchOrders;
