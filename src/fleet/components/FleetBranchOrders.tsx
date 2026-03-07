import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { 
  MapPin, 
  Navigation, 
  Clock, 
  Package, 
  ChefHat,
  Truck,
  RefreshCw,
  Filter,
  ChevronRight,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistance, calculateDistance } from "@/lib/distance";

interface RestaurantBranch {
  id: string;
  restaurant_id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  phone_number: string | null;
  is_active: boolean;
  restaurant_name?: string;
}

interface BranchOrder {
  id: string;
  created_at: string;
  status: string;
  total_amount: number;
  delivery_address: string;
  restaurant_branch_id: string;
  restaurant_name?: string;
  customer_name?: string;
  customer_phone?: string;
  estimated_delivery_time?: string;
}

interface FleetBranchOrdersProps {
  driverLat?: number;
  driverLng?: number;
  onAssignDriver?: (orderId: string, branchId: string) => void;
}

export function FleetBranchOrders({ driverLat, driverLng }: FleetBranchOrdersProps) {
  const [branches, setBranches] = useState<RestaurantBranch[]>([]);
  const [branchOrders, setBranchOrders] = useState<Map<string, BranchOrder[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(
    driverLat && driverLng ? { lat: driverLat, lng: driverLng } : null
  );
  const [filter, setFilter] = useState<"all" | "pending" | "preparing" | "ready">("all");

  useEffect(() => {
    fetchBranchesAndOrders();
  }, []);

  const fetchBranchesAndOrders = async () => {
    try {
      setLoading(true);

      // Fetch all active branches with restaurant info
      const { data: branchesData, error: branchError } = await supabase
        .from('restaurant_branches')
        .select(`
          *,
          restaurant:restaurants(name)
        `)
        .eq('is_active', true);

      if (branchError) throw branchError;

      // Fetch orders with restaurant_branch_id
      const { data: ordersData, error: orderError } = await supabase
        .from('orders')
        .select(`
          *,
          restaurant:restaurants(name)
        `)
        .in('status', ['pending', 'confirmed', 'preparing', 'ready_for_pickup'])
        .not('restaurant_branch_id', 'is', null)
        .order('created_at', { ascending: false });

      if (orderError) throw orderError;

      // Group orders by branch
      const ordersByBranch = new Map<string, BranchOrder[]>();
      for (const order of ordersData || []) {
        const branchId = order.restaurant_branch_id;
        if (!ordersByBranch.has(branchId)) {
          ordersByBranch.set(branchId, []);
        }
        ordersByBranch.get(branchId)!.push({
          ...order,
          restaurant_name: order.restaurant?.name,
        });
      }

      // Enrich branch data
      const enrichedBranches: RestaurantBranch[] = (branchesData || []).map(b => ({
        ...b,
        restaurant_name: (b as any).restaurant?.name,
      }));

      setBranches(enrichedBranches);
      setBranchOrders(ordersByBranch);
    } catch (error) {
      console.error("Error fetching branch orders:", error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate distance from driver to each branch
  const getBranchDistance = (branch: RestaurantBranch) => {
    if (!driverLocation) return null;
    return calculateDistance(
      driverLocation.lat,
      driverLocation.lng,
      Number(branch.latitude),
      Number(branch.longitude)
    );
  };

  // Sort branches by distance
  const sortedBranches = [...branches].sort((a, b) => {
    const distA = getBranchDistance(a);
    const distB = getBranchDistance(b);
    if (distA === null && distB === null) return 0;
    if (distA === null) return 1;
    if (distB === null) return -1;
    return distA - distB;
  });

  // Filter orders by status
  const getFilteredOrders = (orders: BranchOrder[]) => {
    if (filter === "all") return orders;
    return orders.filter(o => o.status === filter);
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

  const totalOrders = Array.from(branchOrders.values()).flat().length;
  const readyOrders = Array.from(branchOrders.values())
    .flat()
    .filter(o => o.status === "ready_for_pickup").length;

  return (
    <Card className="bg-gradient-to-br from-slate-50 to-white">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MapPin className="h-5 w-5 text-primary" />
            Branch Orders
            <Badge variant="secondary" className="ml-2">
              {totalOrders} total
            </Badge>
            {readyOrders > 0 && (
              <Badge className="bg-green-500">{readyOrders} ready</Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchBranchesAndOrders}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Driver Location Input */}
        <div className="flex gap-2 mt-2">
          <Input
            placeholder="Driver lat (e.g., 25.2850)"
            className="h-8 text-sm"
            value={driverLocation?.lat || ""}
            onChange={(e) => {
              const lat = parseFloat(e.target.value);
              if (!isNaN(lat)) {
                setDriverLocation(prev => prev ? { ...prev, lat } : { lat, lng: 0 });
              }
            }}
          />
          <Input
            placeholder="Driver lng (e.g., 51.5300)"
            className="h-8 text-sm"
            value={driverLocation?.lng || ""}
            onChange={(e) => {
              const lng = parseFloat(e.target.value);
              if (!isNaN(lng)) {
                setDriverLocation(prev => prev ? { ...prev, lng } : { lat: 0, lng });
              }
            }}
          />
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="h-8 text-sm border rounded px-2"
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="preparing">Preparing</option>
            <option value="ready">Ready</option>
          </select>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {sortedBranches.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No branches with active orders</p>
          </div>
        ) : (
          sortedBranches.map((branch) => {
            const orders = branchOrders.get(branch.id) || [];
            const filteredOrders = getFilteredOrders(orders);
            const distance = getBranchDistance(branch);
            const hasReadyOrders = orders.some(o => o.status === "ready_for_pickup");

            if (filter !== "all" && filteredOrders.length === 0) return null;

            return (
              <div
                key={branch.id}
                className={`border rounded-lg p-3 transition-colors ${
                  selectedBranch === branch.id
                    ? "border-primary bg-primary/5"
                    : "hover:border-primary/50"
                }`}
                onClick={() => setSelectedBranch(
                  selectedBranch === branch.id ? null : branch.id
                )}
              >
                {/* Branch Header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <ChefHat className="h-4 w-4 text-orange-500" />
                    <span className="font-medium text-sm">
                      {branch.restaurant_name || "Restaurant"}
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      {branch.name}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    {distance !== null && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Navigation className="h-3 w-3" />
                        {formatDistance(distance)}
                      </span>
                    )}
                    <Badge
                      className={hasReadyOrders ? "bg-green-500" : "bg-slate-"}
                    >
                      {orders.length} orders
                    </Badge>
                    <ChevronRight className={`h-4 w-4 transition-transform ${
                      selectedBranch === branch.id ? "rotate-90" : ""
                    }`} />
                  </div>
                </div>

                {/* Branch Address */}
                <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {branch.address || "No address"}
                </p>

                {/* Orders List (Expanded) */}
                {selectedBranch === branch.id && filteredOrders.length > 0 && (
                  <div className="mt-3 pt-3 border-t space-y-2">
                    {filteredOrders.map((order) => (
                      <div
                        key={order.id}
                        className="flex items-center justify-between bg-white p-2 rounded border"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium">
                              {order.id.slice(0, 8)}...
                            </span>
                            {getStatusBadge(order.status)}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {order.delivery_address?.slice(0, 30)}...
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">
                            {order.total_amount} QAR
                          </p>
                          {order.status === "ready_for_pickup" && (
                            <Button size="sm" variant="outline" className="h-6 text-xs mt-1">
                              <Truck className="h-3 w-3 mr-1" />
                              Assign Driver
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
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

export default FleetBranchOrders;
