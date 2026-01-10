import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search,
  Calendar,
  Utensils,
  User,
  CheckCircle,
  Clock,
  Store,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/AdminLayout";
import { formatCurrency } from "@/lib/currency";

interface OrderData {
  id: string;
  scheduled_date: string;
  meal_type: string;
  is_completed: boolean;
  created_at: string;
  meal: {
    name: string;
    price: number;
    restaurant: {
      name: string;
    };
  };
  profile: {
    full_name: string | null;
  } | null;
}

const AdminOrders = () => {
  const { user } = useAuth();

  const [orders, setOrders] = useState<OrderData[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    if (user) {
      fetchOrders();
    }
  }, [user]);

  const fetchOrders = async () => {
    const { data, error } = await supabase
      .from("meal_schedules")
      .select(`
        id,
        scheduled_date,
        meal_type,
        is_completed,
        created_at,
        user_id,
        meals:meal_id (
          name,
          price,
          restaurants:restaurant_id (name)
        )
      `)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("Error fetching orders:", error);
      return;
    }

    const userIds = [...new Set((data || []).map((o) => o.user_id))];
    let profilesMap: Record<string, { full_name: string | null }> = {};

    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);

      if (profiles) {
        profilesMap = profiles.reduce((acc, p) => {
          acc[p.user_id] = { full_name: p.full_name };
          return acc;
        }, {} as Record<string, { full_name: string | null }>);
      }
    }

    const ordersWithDetails: OrderData[] = (data || []).map((o: any) => ({
      id: o.id,
      scheduled_date: o.scheduled_date,
      meal_type: o.meal_type,
      is_completed: o.is_completed || false,
      created_at: o.created_at,
      meal: {
        name: o.meals?.name || "Unknown",
        price: o.meals?.price || 0,
        restaurant: {
          name: o.meals?.restaurants?.name || "Unknown",
        },
      },
      profile: profilesMap[o.user_id] || null,
    }));

    setOrders(ordersWithDetails);
  };

  const today = new Date().toISOString().split("T")[0];

  const filteredOrders = orders.filter((o) => {
    const matchesSearch =
      !searchQuery ||
      o.meal.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.meal.restaurant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.profile?.full_name?.toLowerCase().includes(searchQuery.toLowerCase());

    if (activeTab === "all") return matchesSearch;
    if (activeTab === "today") return matchesSearch && o.scheduled_date === today;
    if (activeTab === "upcoming") return matchesSearch && !o.is_completed && o.scheduled_date >= today;
    if (activeTab === "completed") return matchesSearch && o.is_completed;

    return matchesSearch;
  });

  const todayCount = orders.filter((o) => o.scheduled_date === today).length;

  return (
    <AdminLayout title="Order Management" subtitle={`${orders.length} total orders`}>
      <div className="space-y-4">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by meal, restaurant, or customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 min-h-[44px]"
          />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex overflow-x-auto gap-1 w-full sm:w-auto">
            <TabsTrigger value="all" className="whitespace-nowrap min-h-[44px]">All</TabsTrigger>
            <TabsTrigger value="today" className="relative whitespace-nowrap min-h-[44px]">
              Today
              {todayCount > 0 && (
                <Badge className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {todayCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="upcoming" className="whitespace-nowrap min-h-[44px]">Upcoming</TabsTrigger>
            <TabsTrigger value="completed" className="whitespace-nowrap min-h-[44px]">Completed</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="space-y-4 mt-4">
            {filteredOrders.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Utensils className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <p className="text-muted-foreground">No orders found</p>
                </CardContent>
              </Card>
            ) : (
              filteredOrders.map((order) => (
                <Card key={order.id}>
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex flex-col sm:flex-row items-start justify-between gap-3 sm:gap-4">
                      <div className="flex-1">
                        <div className="flex flex-wrap gap-2 mb-2">
                          <p className="font-semibold">{order.meal.name}</p>
                          <Badge
                            variant="outline"
                            className={
                              order.is_completed
                                ? "bg-green-500/10 text-green-600 border-green-500/20 text-xs sm:text-sm"
                                : order.scheduled_date < today
                                ? "bg-amber-500/10 text-amber-600 border-amber-500/20 text-xs sm:text-sm"
                                : "bg-blue-500/10 text-blue-600 border-blue-500/20 text-xs sm:text-sm"
                            }
                          >
                            {order.is_completed ? (
                              <>
                                <CheckCircle className="h-3 w-3 mr-1" />
                                <span className="hidden sm:inline">Completed</span>
                                <span className="sm:hidden">Done</span>
                              </>
                            ) : (
                              <>
                                <Clock className="h-3 w-3 mr-1" />
                                {order.scheduled_date < today ? (
                                  <>
                                    <span className="hidden sm:inline">Overdue</span>
                                    <span className="sm:hidden">Late</span>
                                  </>
                                ) : (
                                  <>
                                    <span className="hidden sm:inline">Pending</span>
                                    <span className="sm:hidden">Wait</span>
                                  </>
                                )}
                              </>
                            )}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap gap-2 sm:gap-3 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Store className="h-3 w-3" />
                            {order.meal.restaurant.name}
                          </span>
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {order.profile?.full_name || "Customer"}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(order.scheduled_date).toLocaleDateString()}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="secondary">{order.meal_type}</Badge>
                          <span className="text-sm font-medium">
                            {formatCurrency(order.meal.price)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminOrders;
