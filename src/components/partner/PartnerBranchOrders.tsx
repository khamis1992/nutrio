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
  RefreshCw,
  Phone,
  User,
  Truck,
  CheckCircle,
  AlertCircle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
}

interface BranchOrder {
  id: string;
  created_at: string;
  status: string;
  total_amount: number;
  delivery_address: string;
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
  const [customerLat, setCustomerLat] = useState<number | null>(null);
  const [customerLng, setCustomerLng] = useState<number | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "preparing" | "ready">("all");

  useEffect(() => {
    if (user) {
      fetchPartnerBranches();
    }
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
      
      setBranches(branchData || []);
      
      // Auto-select first branch
      if (branchData && branchData.length > 0) {
        setSelectedBranch(branchData[0]);
      }
    } catch (error) {
      console.error("Error fetching partner branches:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBranchOrders = async (branchId: string) => {
    try {
      // Fetch orders assigned to this specific branch
      const { data: ordersData, error: orderError } = await supabase
        .from('orders')
        .select(`
          *,
          meals:order_items(meal_id, meals(name, quantity))
        `)
        .eq('restaurant_branch_id', branchId)
        .in('status', ['pending', 'confirmed', 'preparing', 'ready_for_pickup'])
        .order('created_at', { ascending: false });

      if (orderError) throw orderError;
      setOrders(ordersData || []);
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

  if (branches.length === 0) {
    return (
      <Card className="bg-amber-50 border-amber-200">
        <CardContent className="pt-6">
          <div className="text-center">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 text-amber-500" />
            <p className="font-medium text-amber-800">No Branches Found</p>
            <p className="text-sm text-amber-600 mt-1">
              Please contact support to add your restaurant branches.
            </p>
          </div>
        </CardContent>
      </Card>
    );
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
