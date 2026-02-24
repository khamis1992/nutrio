import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  ShoppingBag,
  Calendar,
  Utensils,
  User,
  CheckCircle,
  Clock,
  Store,
  MoreHorizontal,
  Eye,
  Download,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Loader2,
  DollarSign,
  XCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/currency";
import { format } from "date-fns";

// Order status type matching database
type OrderStatus = 
  | "pending" 
  | "confirmed" 
  | "preparing" 
  | "ready" 
  | "out_for_delivery" 
  | "delivered" 
  | "completed" 
  | "cancelled";

// Status configuration for display
const STATUS_CONFIG: Record<OrderStatus, { 
  label: string; 
  color: string;
  bgColor: string;
}> = {
  pending: {
    label: "Pending",
    color: "text-amber-600",
    bgColor: "bg-amber-500/10 border-amber-500/20",
  },
  confirmed: {
    label: "Confirmed",
    color: "text-blue-600",
    bgColor: "bg-blue-500/10 border-blue-500/20",
  },
  preparing: {
    label: "Preparing",
    color: "text-purple-600",
    bgColor: "bg-purple-500/10 border-purple-500/20",
  },
  ready: {
    label: "Ready",
    color: "text-cyan-600",
    bgColor: "bg-cyan-500/10 border-cyan-500/20",
  },
  out_for_delivery: {
    label: "Out for Delivery",
    color: "text-indigo-600",
    bgColor: "bg-indigo-500/10 border-indigo-500/20",
  },
  delivered: {
    label: "Delivered",
    color: "text-green-600",
    bgColor: "bg-green-500/10 border-green-500/20",
  },
  completed: {
    label: "Completed",
    color: "text-emerald-600",
    bgColor: "bg-emerald-500/10 border-emerald-500/20",
  },
  cancelled: {
    label: "Cancelled",
    color: "text-red-600",
    bgColor: "bg-red-500/10 border-red-500/20",
  },
};

interface OrderData {
  id: string;
  scheduled_date: string;
  meal_type: string;
  order_status: OrderStatus;
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
    email?: string;
  } | null;
}

const AdminOrders = () => {
  const { toast } = useToast();
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [selectedOrder, setSelectedOrder] = useState<OrderData | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "today" | "upcoming" | "completed" | "overdue">("all");
  const [sortField, setSortField] = useState<"created_at" | "scheduled_date" | "meal_name">("created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      // Fetch meal schedules with meal info
      const { data: schedulesData, error: schedulesError } = await supabase
        .from("meal_schedules")
        .select(`
          id,
          scheduled_date,
          meal_type,
          is_completed,
          order_status,
          created_at,
          user_id,
          meal_id
        `)
        .order("created_at", { ascending: false })
        .limit(100);

      if (schedulesError) throw schedulesError;

      // Get unique meal IDs
      const mealIds = [...new Set((schedulesData || []).map((o) => o.meal_id).filter(Boolean))];
      let mealsMap: Record<string, { name: string; price: number; restaurant_id: string }> = {};

      if (mealIds.length > 0) {
        const { data: meals } = await supabase
          .from("meals")
          .select("id, name, price, restaurant_id")
          .in("id", mealIds);

        if (meals) {
          mealsMap = meals.reduce((acc, m) => {
            acc[m.id] = { name: m.name, price: m.price || 0, restaurant_id: m.restaurant_id };
            return acc;
          }, {} as Record<string, { name: string; price: number; restaurant_id: string }>);
        }
      }

      // Get unique restaurant IDs from meals
      const restaurantIds = [...new Set(Object.values(mealsMap).map((m) => m.restaurant_id).filter(Boolean))];
      let restaurantsMap: Record<string, { name: string }> = {};

      if (restaurantIds.length > 0) {
        const { data: restaurants } = await supabase
          .from("restaurants")
          .select("id, name")
          .in("id", restaurantIds);

        if (restaurants) {
          restaurantsMap = restaurants.reduce((acc, r) => {
            acc[r.id] = { name: r.name };
            return acc;
          }, {} as Record<string, { name: string }>);
        }
      }

      // Get unique user IDs
      const userIds = [...new Set((schedulesData || []).map((o) => o.user_id))];
      let profilesMap: Record<string, { full_name: string | null; email?: string }> = {};

      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", userIds);

        if (profiles) {
          profilesMap = profiles.reduce((acc, p: any) => {
            acc[p.user_id] = { full_name: p.full_name };
            return acc;
          }, {} as Record<string, { full_name: string | null }>);
        }
      }

      const ordersWithDetails: OrderData[] = (schedulesData || []).map((o: any) => {
        const meal = mealsMap[o.meal_id] || { name: "Unknown", price: 0, restaurant_id: "" };
        const restaurant = restaurantsMap[meal.restaurant_id] || { name: "Unknown" };
        
        return {
          id: o.id,
          scheduled_date: o.scheduled_date,
          meal_type: o.meal_type,
          order_status: (o.order_status || "pending") as OrderStatus,
          is_completed: o.is_completed || false,
          created_at: o.created_at,
          meal: {
            name: meal.name,
            price: meal.price,
            restaurant: {
              name: restaurant.name,
            },
          },
          profile: profilesMap[o.user_id] || null,
        };
      });

      setOrders(ordersWithDetails);
    } catch (error) {
      console.error("Error fetching orders:", error);
      toast({
        title: "Error",
        description: "Failed to load orders. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  const selectAllOrders = () => {
    if (selectedOrders.size === filteredOrders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(filteredOrders.map((o) => o.id)));
    }
  };

  const handleSort = (field: "created_at" | "scheduled_date" | "meal_name") => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const exportToCSV = () => {
    const headers = ["Order ID", "Meal", "Restaurant", "Customer", "Meal Type", "Price", "Scheduled Date", "Status", "Created At"];
    const rows = filteredOrders.map((o) => [
      o.id,
      o.meal.name,
      o.meal.restaurant.name,
      o.profile?.full_name || "Customer",
      o.meal_type,
      formatCurrency(o.meal.price),
      o.scheduled_date,
      STATUS_CONFIG[o.order_status]?.label || o.order_status,
      format(new Date(o.created_at), "yyyy-MM-dd HH:mm"),
    ]);
    
    const csv = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orders-export-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({ title: "Export Complete", description: `${rows.length} orders exported to CSV.` });
  };

  // Cancel order function for admin
  const cancelOrder = async (orderId: string) => {
    try {
      const { error } = await supabase
        .from("meal_schedules")
        .update({ order_status: "cancelled" })
        .eq("id", orderId);

      if (error) throw error;

      // Update local state
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId ? { ...o, order_status: "cancelled" as OrderStatus } : o
        )
      );

      // If detail view is open, update selected order too
      if (selectedOrder?.id === orderId) {
        setSelectedOrder((prev) =>
          prev ? { ...prev, order_status: "cancelled" as OrderStatus } : null
        );
      }

      toast({
        title: "Order Cancelled",
        description: "The order has been cancelled successfully.",
      });
    } catch (error: any) {
      console.error("Error cancelling order:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to cancel order",
        variant: "destructive",
      });
    }
  };

  const filteredOrders = orders
    .filter((o) => {
      const matchesSearch =
        !searchQuery ||
        o.meal.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.meal.restaurant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.profile?.full_name?.toLowerCase().includes(searchQuery.toLowerCase());

      if (activeTab === "all") return matchesSearch;
      if (activeTab === "today") return matchesSearch && o.scheduled_date === today;
      if (activeTab === "upcoming") return matchesSearch && o.order_status !== "completed" && o.order_status !== "cancelled" && o.scheduled_date >= today;
      if (activeTab === "completed") return matchesSearch && o.order_status === "completed";
      if (activeTab === "overdue") return matchesSearch && o.order_status !== "completed" && o.order_status !== "cancelled" && o.scheduled_date < today;

      return matchesSearch;
    })
    .sort((a, b) => {
      let comparison = 0;
      if (sortField === "created_at") {
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else if (sortField === "scheduled_date") {
        comparison = new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime();
      } else if (sortField === "meal_name") {
        comparison = a.meal.name.localeCompare(b.meal.name);
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

  const getStatusBadge = (order: OrderData) => {
    const config = STATUS_CONFIG[order.order_status];
    return (
      <Badge variant="outline" className={config?.bgColor || "bg-gray-500/10 text-gray-600 border-gray-500/20"}>
        <CheckCircle className="h-3 w-3 mr-1" />
        {config?.label || order.order_status}
      </Badge>
    );
  };

  // Calculate stats
  const stats = {
    total: orders.length,
    today: orders.filter((o) => o.scheduled_date === today).length,
    upcoming: orders.filter((o) => o.order_status !== "completed" && o.order_status !== "cancelled" && o.scheduled_date >= today).length,
    completed: orders.filter((o) => o.order_status === "completed").length,
    overdue: orders.filter((o) => o.order_status !== "completed" && o.order_status !== "cancelled" && o.scheduled_date < today).length,
    totalRevenue: orders.reduce((sum, o) => sum + o.meal.price, 0),
  };

  return (
    <AdminLayout title="Order Management" subtitle={`${stats.total} total orders`}>
      <div className="space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <ShoppingBag className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total Orders</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.today}</p>
                  <p className="text-xs text-muted-foreground">Today</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.completed}</p>
                  <p className="text-xs text-muted-foreground">Completed</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.overdue}</p>
                  <p className="text-xs text-muted-foreground">Overdue</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</p>
                  <p className="text-xs text-muted-foreground">Total Revenue</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2">
          {[
            { value: "all", label: "All", count: stats.total },
            { value: "today", label: "Today", count: stats.today },
            { value: "upcoming", label: "Upcoming", count: stats.upcoming },
            { value: "completed", label: "Completed", count: stats.completed },
            { value: "overdue", label: "Overdue", count: stats.overdue },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value as any)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  {tab.count}
                </Badge>
              )}
            </button>
          ))}
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by meal, restaurant, or customer..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" onClick={exportToCSV} className="gap-2">
                  <Download className="w-4 h-4" />
                  Export
                </Button>
                <Button variant="outline" size="icon" onClick={fetchOrders} disabled={loading}>
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bulk Actions */}
        {selectedOrders.size > 0 && (
          <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg flex items-center justify-between">
            <span className="text-sm text-primary font-medium">
              {selectedOrders.size} order{selectedOrders.size > 1 ? "s" : ""} selected
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                Mark as Completed
              </Button>
              <Button variant="outline" size="sm" className="text-red-600 border-red-200">
                Cancel Selected
              </Button>
            </div>
          </div>
        )}

        {/* Orders Table */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold">Orders</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-10 pl-6">
                    <Checkbox
                      checked={selectedOrders.size === filteredOrders.length && filteredOrders.length > 0}
                      onCheckedChange={selectAllOrders}
                    />
                  </TableHead>
                  <TableHead>
                    <button onClick={() => handleSort("meal_name")} className="flex items-center gap-1 hover:text-foreground transition-colors">
                      Meal
                      {sortField === "meal_name" && (sortDirection === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                    </button>
                  </TableHead>
                  <TableHead>Restaurant</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Meal Type</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>
                    <button onClick={() => handleSort("scheduled_date")} className="flex items-center gap-1 hover:text-foreground transition-colors">
                      Scheduled
                      {sortField === "scheduled_date" && (sortDirection === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                    </button>
                  </TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12">
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        <p className="text-muted-foreground text-sm">Loading orders...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                          <Utensils className="w-6 h-6 text-muted-foreground" />
                        </div>
                        <p className="text-muted-foreground">No orders found</p>
                        <p className="text-muted-foreground/70 text-sm">Try adjusting your filters</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOrders.map((order) => (
                    <TableRow key={order.id} className="hover:bg-muted/50 transition-colors">
                      <TableCell className="pl-6">
                        <Checkbox
                          checked={selectedOrders.has(order.id)}
                          onCheckedChange={() => toggleOrderSelection(order.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Utensils className="w-5 h-5 text-primary" />
                          </div>
                          <p className="font-medium">{order.meal.name}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Store className="w-3 h-3" />
                          {order.meal.restaurant.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <User className="w-3 h-3" />
                          {order.profile?.full_name || "Customer"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{order.meal_type}</Badge>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{formatCurrency(order.meal.price)}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(order.scheduled_date), "MMM d, yyyy")}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(order)}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedOrder(order);
                                setIsDetailOpen(true);
                              }}
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {order.order_status !== "completed" && order.order_status !== "cancelled" && (
                              <DropdownMenuItem 
                                className="text-red-600 focus:text-red-600 focus:bg-red-500/10"
                                onClick={() => {
                                  if (confirm("Are you sure you want to cancel this order?")) {
                                    cancelOrder(order.id);
                                  }
                                }}
                              >
                                <XCircle className="w-4 h-4 mr-2" />
                                Cancel Order
                              </DropdownMenuItem>
                            )}
                            {order.order_status === "cancelled" && (
                              <DropdownMenuItem disabled>
                                <XCircle className="w-4 h-4 mr-2" />
                                Order Cancelled
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Order Detail Sheet */}
        <Sheet open={isDetailOpen} onOpenChange={setIsDetailOpen}>
          <SheetContent className="w-full sm:max-w-xl">
            {selectedOrder && (
              <>
                <SheetHeader className="pb-6 border-b">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Utensils className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                      <SheetTitle className="text-xl">{selectedOrder.meal.name}</SheetTitle>
                      <SheetDescription>{getStatusBadge(selectedOrder)}</SheetDescription>
                    </div>
                  </div>
                </SheetHeader>

                <div className="mt-6 space-y-6">
                  {/* Order Info */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                        Order Details
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Order ID</p>
                          <code className="text-sm font-mono">{selectedOrder.id.substring(0, 16)}...</code>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Meal Type</p>
                          <Badge variant="secondary">{selectedOrder.meal_type}</Badge>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Price</p>
                          <p className="text-lg font-semibold">{formatCurrency(selectedOrder.meal.price)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Scheduled Date</p>
                          <p className="text-sm">{format(new Date(selectedOrder.scheduled_date), "MMM d, yyyy")}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Restaurant */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                        Restaurant
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                          <Store className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium">{selectedOrder.meal.restaurant.name}</p>
                          <p className="text-xs text-muted-foreground">Meal Provider</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Customer */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                        Customer
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{selectedOrder.profile?.full_name || "Customer"}</p>
                          <p className="text-xs text-muted-foreground">{selectedOrder.profile?.email || "No email"}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Actions */}
                  {selectedOrder.order_status !== "completed" && selectedOrder.order_status !== "cancelled" && (
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                        onClick={() => {
                          if (confirm("Are you sure you want to cancel this order?")) {
                            cancelOrder(selectedOrder.id);
                          }
                        }}
                      >
                        Cancel Order
                      </Button>
                    </div>
                  )}
                  
                  {selectedOrder.order_status === "cancelled" && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-600 font-medium">This order has been cancelled</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </AdminLayout>
  );
};

export default AdminOrders;
