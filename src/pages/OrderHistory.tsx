import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { CustomerNavigation } from "@/components/CustomerNavigation";
import { OneTapReorder } from "@/components/OneTapReorder";
import { 
  ArrowLeft, 
  Package,
  Clock,
  CheckCircle2,
  XCircle,
  Truck,
  RefreshCw,
  Calendar,
  Flame,
  ShoppingBag,
  UtensilsCrossed,
  Loader2,
  ChefHat,
  CircleDot,
  RotateCcw,
  Trash2
} from "lucide-react";
import { format } from "date-fns";

interface Restaurant {
  id: string;
  name: string;
  logo_url: string | null;
}

interface Meal {
  id: string;
  name: string;
  image_url: string | null;
  calories: number;
  restaurant_id: string;
}

interface OrderItem {
  id: string;
  quantity: number;
  meal_id: string;
  meal?: Meal;
}

interface Order {
  id: string;
  created_at: string;
  delivery_date: string;
  status: string;
  meal_type: string | null;
  notes: string | null;
  restaurant_id: string | null;
  restaurant?: Restaurant;
  order_items: OrderItem[];
}

interface ScheduledMeal {
  id: string;
  scheduled_date: string;
  meal_type: string;
  is_completed: boolean;
  order_status: string;
  created_at: string;
  meal_id: string;
  meal?: Meal & { restaurant?: Restaurant };
}

// Raw types from Supabase (with possible nulls)
interface RawOrder {
  id: string;
  created_at: string;
  delivery_date: string;
  status: string | null;
  meal_type: string | null;
  notes: string | null;
  restaurant_id: string | null;
}

interface RawOrderItem {
  id: string;
  order_id: string;
  quantity: number;
  meal_id: string | null;
}

interface RawScheduledMeal {
  id: string;
  scheduled_date: string;
  meal_type: string;
  is_completed: boolean | null;
  order_status: string | null;
  created_at: string;
  meal_id: string;
}

const statusConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  pending: { label: "Pending", icon: CircleDot, color: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  confirmed: { label: "Confirmed", icon: CheckCircle2, color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  preparing: { label: "Preparing", icon: ChefHat, color: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
  out_for_delivery: { label: "Out for Delivery", icon: Truck, color: "bg-orange-500/10 text-orange-600 border-orange-500/20" },
  delivered: { label: "Delivered", icon: CheckCircle2, color: "bg-green-500/10 text-green-600 border-green-500/20" },
  cancelled: { label: "Cancelled", icon: XCircle, color: "bg-red-500/10 text-red-600 border-red-500/20" },
};

const OrderHistory = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { toast } = useToast();
  const [reordering, setReordering] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("scheduled");
  const [refreshing, setRefreshing] = useState(false);
  
  // Orders state
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersPage, setOrdersPage] = useState(0);
  const [ordersHasMore, setOrdersHasMore] = useState(true);
  
  // Scheduled meals state
  const [scheduledMeals, setScheduledMeals] = useState<ScheduledMeal[]>([]);
  const [scheduledLoading, setScheduledLoading] = useState(false);
  const [scheduledPage, setScheduledPage] = useState(0);
  const [scheduledHasMore, setScheduledHasMore] = useState(true);
  
  // Pull to refresh handlers
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const minPullDistance = 80;

  // Fetch orders with manual relationship joining
  const fetchOrders = useCallback(async (page: number, append: boolean = false) => {
    if (!user) return;
    
    setOrdersLoading(true);
    try {
      const pageSize = 10;
      const from = page * pageSize;
      const to = from + pageSize - 1;

      // Fetch orders
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select("id, created_at, delivery_date, status, meal_type, notes, restaurant_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (ordersError) throw ordersError;
      
      if (!ordersData || ordersData.length === 0) {
        setOrdersHasMore(false);
        setOrdersLoading(false);
        return;
      }

      // Get unique restaurant IDs (filter out nulls)
      const restaurantIds = [...new Set(
        (ordersData as RawOrder[])
          .map(o => o.restaurant_id)
          .filter((id): id is string => id !== null)
      )];
      
      // Fetch restaurants
      let restaurantsData: Restaurant[] = [];
      if (restaurantIds.length > 0) {
        const { data: restaurants } = await supabase
          .from("restaurants")
          .select("id, name, logo_url")
          .in("id", restaurantIds);
        restaurantsData = restaurants || [];
      }

      // Fetch order items for these orders
      const orderIds = (ordersData as RawOrder[]).map(o => o.id);
      const { data: orderItemsData } = await supabase
        .from("order_items")
        .select("id, order_id, quantity, meal_id")
        .in("order_id", orderIds);

      // Get unique meal IDs from order items (filter out nulls)
      const mealIds = [...new Set(
        (orderItemsData || [] as RawOrderItem[])
          .map(oi => oi.meal_id)
          .filter((id): id is string => id !== null)
      )];
      
      // Fetch meals
      let mealsData: Meal[] = [];
      if (mealIds.length > 0) {
        const { data: meals } = await supabase
          .from("meals")
          .select("id, name, image_url, calories, restaurant_id")
          .in("id", mealIds);
        mealsData = meals || [];
      }

      // Transform and combine data
      const transformedOrders: Order[] = (ordersData as RawOrder[]).map(order => ({
        id: order.id,
        created_at: order.created_at,
        delivery_date: order.delivery_date,
        status: order.status || "pending",
        meal_type: order.meal_type,
        notes: order.notes,
        restaurant_id: order.restaurant_id,
        restaurant: restaurantsData.find(r => r.id === order.restaurant_id),
        order_items: (orderItemsData || [] as RawOrderItem[])
          .filter(oi => oi.order_id === order.id)
          .map(oi => ({
            id: oi.id,
            quantity: oi.quantity,
            meal_id: oi.meal_id || "",
            meal: mealsData.find(m => m.id === oi.meal_id),
          })),
      }));

      setOrders(prev => append ? [...prev, ...transformedOrders] : transformedOrders);
      setOrdersPage(page);
      setOrdersHasMore(ordersData.length === pageSize);
    } catch (error) {
      console.error("Error fetching orders:", error);
    } finally {
      setOrdersLoading(false);
    }
  }, [user]);

  // Fetch scheduled meals with manual relationship joining
  const fetchScheduledMeals = useCallback(async (page: number, append: boolean = false) => {
    if (!user) return;
    
    setScheduledLoading(true);
    try {
      const pageSize = 10;
      const from = page * pageSize;
      const to = from + pageSize - 1;

      // Fetch scheduled meals
      const { data: schedulesData, error: schedulesError } = await supabase
        .from("meal_schedules")
        .select("id, scheduled_date, meal_type, is_completed, order_status, created_at, meal_id")
        .eq("user_id", user.id)
        .order("scheduled_date", { ascending: false })
        .range(from, to);

      if (schedulesError) throw schedulesError;
      
      if (!schedulesData || schedulesData.length === 0) {
        setScheduledHasMore(false);
        setScheduledLoading(false);
        return;
      }

      // Get unique meal IDs
      const mealIds = [...new Set(
        (schedulesData as RawScheduledMeal[])
          .map(s => s.meal_id)
          .filter((id): id is string => !!id)
      )];
      
      // Fetch meals with restaurant info
      let mealsData: (Meal & { restaurant?: Restaurant })[] = [];
      if (mealIds.length > 0) {
        const { data: meals } = await supabase
          .from("meals")
          .select("id, name, image_url, calories, restaurant_id")
          .in("id", mealIds);
        
        if (meals && meals.length > 0) {
          // Get unique restaurant IDs (filter out nulls)
          const restaurantIds = [...new Set(
            meals
              .map(m => m.restaurant_id)
              .filter((id): id is string => id !== null)
          )];
          
          // Fetch restaurants
          let restaurantsData: Restaurant[] = [];
          if (restaurantIds.length > 0) {
            const { data: restaurants } = await supabase
              .from("restaurants")
              .select("id, name, logo_url")
              .in("id", restaurantIds);
            restaurantsData = restaurants || [];
          }
          
          // Combine meals with restaurants
          mealsData = meals.map(meal => ({
            ...meal,
            restaurant: restaurantsData.find(r => r.id === meal.restaurant_id),
          }));
        }
      }

      // Transform data
      const transformedSchedules: ScheduledMeal[] = (schedulesData as RawScheduledMeal[]).map(schedule => ({
        id: schedule.id,
        scheduled_date: schedule.scheduled_date,
        meal_type: schedule.meal_type,
        is_completed: schedule.is_completed || false,
        order_status: schedule.order_status || "pending",
        created_at: schedule.created_at,
        meal_id: schedule.meal_id,
        meal: mealsData.find(m => m.id === schedule.meal_id),
      }));

      setScheduledMeals(prev => append ? [...prev, ...transformedSchedules] : transformedSchedules);
      setScheduledPage(page);
      setScheduledHasMore(schedulesData.length === pageSize);
    } catch (error) {
      console.error("Error fetching scheduled meals:", error);
    } finally {
      setScheduledLoading(false);
    }
  }, [user]);

  // Pull to refresh functionality
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStart) return;
    
    const currentY = e.targetTouches[0].clientY;
    const distance = currentY - touchStart;
    
    // Only allow pull down when at top of page
    if (window.scrollY === 0 && distance > 0) {
      setPullDistance(Math.min(distance, 150));
    }
  };

  const handleTouchEnd = () => {
    if (!touchStart || !pullDistance) return;
    
    if (pullDistance > minPullDistance && window.scrollY === 0) {
      handleRefresh();
    }
    
    setPullDistance(0);
    setTouchStart(null);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchOrders(0, false),
      fetchScheduledMeals(0, false)
    ]);
    setRefreshing(false);
    toast({
      title: "Refreshed",
      description: "Your orders have been updated.",
    });
  };

  // Cancel order function
  const handleCancelOrder = async (orderId: string, orderType: 'scheduled' | 'order') => {
    if (!confirm("Are you sure you want to cancel this order?")) return;
    
    setCancelling(orderId);
    try {
      if (orderType === 'scheduled') {
        const { error } = await supabase
          .from("meal_schedules")
          .update({ order_status: 'cancelled' })
          .eq("id", orderId);
        
        if (error) throw error;
        
        // Update local state
        setScheduledMeals(prev => prev.map(meal => 
          meal.id === orderId ? { ...meal, order_status: 'cancelled' } : meal
        ));
      } else {
        const { error } = await supabase
          .from("orders")
          .update({ status: 'cancelled' })
          .eq("id", orderId);
        
        if (error) throw error;
        
        // Update local state
        setOrders(prev => prev.map(order => 
          order.id === orderId ? { ...order, status: 'cancelled' } : order
        ));
      }
      
      toast({
        title: "Order Cancelled",
        description: "Your order has been cancelled successfully.",
      });
    } catch (error) {
      console.error("Error cancelling order:", error);
      toast({
        title: "Error",
        description: "Failed to cancel order. Please try again.",
        variant: "destructive",
      });
    } finally {
      setCancelling(null);
    }
  };

  // Initial fetch
  useEffect(() => {
    if (user) {
      fetchOrders(0, false);
      fetchScheduledMeals(0, false);
    }
  }, [user, fetchOrders, fetchScheduledMeals]);

  // Real-time subscription for scheduled meals status updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('customer-meal-schedules')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'meal_schedules',
        },
        () => {
          // Refresh the list when an update occurs
          fetchScheduledMeals(0, false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchScheduledMeals]);

  // Check if user completed onboarding
  useEffect(() => {
    if (profile && !profile.onboarding_completed) {
      navigate("/onboarding");
    }
  }, [profile, navigate]);

  const loadMoreOrders = () => {
    if (!ordersLoading && ordersHasMore) {
      fetchOrders(ordersPage + 1, true);
    }
  };

  const loadMoreScheduled = () => {
    if (!scheduledLoading && scheduledHasMore) {
      fetchScheduledMeals(scheduledPage + 1, true);
    }
  };

  const handleReorder = async (order: Order) => {
    if (!user) return;
    
    setReordering(order.id);

    try {
      // Create new order with same items (subscription-based, no price)
      const tomorrow = new Date();
      tomorrow.setHours(0, 0, 0, 0);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { data: newOrder, error: orderError } = await supabase
        .from("orders")
        .insert({
          user_id: user.id,
          restaurant_id: order.restaurant?.id,
          delivery_date: format(tomorrow, "yyyy-MM-dd"),
          total_price: 0, // Subscription-based, no charge
          status: "pending",
          meal_type: order.meal_type,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const orderItems = order.order_items
        .filter(item => item.meal)
        .map(item => ({
          order_id: newOrder.id,
          meal_id: item.meal!.id,
          quantity: item.quantity,
          unit_price: 0, // Subscription-based
        }));

      if (orderItems.length > 0) {
        const { error: itemsError } = await supabase
          .from("order_items")
          .insert(orderItems);

        if (itemsError) throw itemsError;
      }

      toast({
        title: "Order placed!",
        description: "Your reorder has been placed successfully.",
      });

      // Refresh orders
      fetchOrders(0, false);
    } catch (error) {
      console.error("Error reordering:", error);
      toast({
        title: "Error",
        description: "Failed to place reorder. Please try again.",
        variant: "destructive",
      });
    } finally {
      setReordering(null);
    }
  };

  const getStatusInfo = (status: string) => {
    return statusConfig[status] || statusConfig.pending;
  };

  const getTotalCalories = (items: OrderItem[]) => {
    return items.reduce((sum, item) => sum + ((item.meal?.calories || 0) * item.quantity), 0);
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = format(today, "yyyy-MM-dd");
  const upcomingMeals = scheduledMeals.filter(m => !m.is_completed && m.scheduled_date >= todayStr);
  const completedMeals = scheduledMeals.filter(m => m.is_completed);

  const loading = ordersLoading || scheduledLoading;

  const renderScheduledMeals = (meals: ScheduledMeal[]) => {
    if (meals.length === 0) {
      return (
        <Card>
          <CardContent className="p-8 text-center">
            <ShoppingBag className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="font-semibold mb-2">No scheduled meals</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Schedule meals from your favorite restaurants!
            </p>
            <Button onClick={() => navigate("/meals")}>
              Browse Meals
            </Button>
          </CardContent>
        </Card>
      );
    }

    return meals.map((schedule) => {
      const statusInfo = getStatusInfo(schedule.order_status);
      const StatusIcon = statusInfo.icon;

      const canCancel = schedule.order_status === 'pending' || schedule.order_status === 'confirmed';
      
      return (
        <Card 
          key={schedule.id} 
          className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
        >
          <CardContent className="p-4" onClick={() => navigate(`/order/${schedule.id}`)}>
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center overflow-hidden">
                  {schedule.meal?.image_url ? (
                    <img 
                      src={schedule.meal.image_url} 
                      alt={schedule.meal.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <UtensilsCrossed className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <h3 className="font-semibold">
                    {schedule.meal?.name || "Unknown Meal"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {schedule.meal?.restaurant?.name || "Restaurant"}
                  </p>
                </div>
              </div>
              <Badge className={`${statusInfo.color} border`}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {statusInfo.label}
              </Badge>
            </div>

            {/* Order Summary */}
            <div className="flex items-center justify-between pt-3 border-t border-border">
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(schedule.scheduled_date), "MMM d, yyyy")}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {schedule.meal_type}
                </span>
                <span className="flex items-center gap-1">
                  <Flame className="h-3 w-3" />
                  {schedule.meal?.calories || 0} cal
                </span>
              </div>
              <Badge variant="secondary" className="bg-primary/10 text-primary text-xs">
                Included
              </Badge>
            </div>
          </CardContent>
          
          {/* Cancel Button */}
          {canCancel && (
            <div className="px-4 pb-4">
              <Button
                variant="outline"
                size="sm"
                className="w-full text-red-600 border-red-200 hover:bg-red-50"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCancelOrder(schedule.id, 'scheduled');
                }}
                disabled={cancelling === schedule.id}
              >
                {cancelling === schedule.id ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Cancel Order
              </Button>
            </div>
          )}
        </Card>
      );
    });
  };

  return (
    <div 
      className="min-h-screen bg-background pb-20"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull to Refresh Indicator */}
      {pullDistance > 0 && (
        <div 
          className="flex items-center justify-center transition-all duration-200"
          style={{ 
            height: `${pullDistance}px`,
            opacity: Math.min(pullDistance / minPullDistance, 1)
          }}
        >
          <div className="flex items-center gap-2 text-muted-foreground">
            <RotateCcw 
              className={`h-5 w-5 ${pullDistance > minPullDistance ? 'animate-spin' : ''}`}
              style={{ transform: `rotate(${pullDistance * 2}deg)` }}
            />
            <span className="text-sm">
              {pullDistance > minPullDistance ? 'Release to refresh' : 'Pull to refresh'}
            </span>
          </div>
        </div>
      )}
      
      {/* Refreshing Indicator */}
      {refreshing && (
        <div className="flex items-center justify-center py-4 bg-primary/5">
          <Loader2 className="h-5 w-5 animate-spin text-primary mr-2" />
          <span className="text-sm text-primary">Refreshing...</span>
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center justify-between p-4">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate("/dashboard")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">Order History</h1>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {loading && orders.length === 0 && scheduledMeals.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-3 w-full mb-4">
              <TabsTrigger value="scheduled" className="relative">
                Upcoming
                {upcomingMeals.length > 0 && (
                  <Badge className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                    {upcomingMeals.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
              <TabsTrigger value="orders">Orders</TabsTrigger>
            </TabsList>

            <TabsContent value="scheduled" className="space-y-4">
              {renderScheduledMeals(upcomingMeals)}
              {scheduledHasMore && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={loadMoreScheduled}
                  disabled={scheduledLoading}
                >
                  {scheduledLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    "Load More"
                  )}
                </Button>
              )}
            </TabsContent>

            <TabsContent value="completed" className="space-y-4">
              {renderScheduledMeals(completedMeals)}
              {scheduledHasMore && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={loadMoreScheduled}
                  disabled={scheduledLoading}
                >
                  {scheduledLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    "Load More"
                  )}
                </Button>
              )}
            </TabsContent>

            <TabsContent value="orders" className="space-y-4">
              {orders.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <ShoppingBag className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="font-semibold mb-2">No orders yet</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Start exploring our delicious meals and place your first order!
                    </p>
                    <Button onClick={() => navigate("/meals")}>
                      Browse Meals
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                orders.map((order) => {
                  const statusInfo = getStatusInfo(order.status);
                  const StatusIcon = statusInfo.icon;
                  const totalCalories = getTotalCalories(order.order_items);
                  
                  return (
                    <Card key={order.id} className="overflow-hidden">
                      <CardContent className="p-4">
                        {/* Order Header */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center overflow-hidden">
                              {order.restaurant?.logo_url ? (
                                <img 
                                  src={order.restaurant.logo_url} 
                                  alt={order.restaurant.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Package className="h-6 w-6 text-muted-foreground" />
                              )}
                            </div>
                            <div>
                              <h3 className="font-semibold">
                                {order.restaurant?.name || "Restaurant"}
                              </h3>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(order.created_at), "MMM d, yyyy 'at' h:mm a")}
                              </p>
                            </div>
                          </div>
                          <Badge className={`${statusInfo.color} border`}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {statusInfo.label}
                          </Badge>
                        </div>

                        {/* Order Items */}
                        <div className="space-y-2 mb-3">
                          {order.order_items.map((item) => (
                            <div 
                              key={item.id}
                              className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
                            >
                              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                                {item.meal?.image_url ? (
                                  <img 
                                    src={item.meal.image_url} 
                                    alt={item.meal.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <UtensilsCrossed className="h-4 w-4 text-muted-foreground" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {item.meal?.name || "Unknown meal"}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Qty: {item.quantity}
                                </p>
                              </div>
                              <Badge variant="secondary" className="text-xs bg-primary/10 text-primary">
                                Included
                              </Badge>
                            </div>
                          ))}
                        </div>

                        {/* Order Summary */}
                        <div className="flex items-center justify-between pt-3 border-t border-border">
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(order.delivery_date), "MMM d")}
                            </span>
                            <span className="flex items-center gap-1">
                              <Flame className="h-3 w-3" />
                              {totalCalories} cal
                            </span>
                          </div>
                          <Badge variant="secondary" className="bg-primary/10 text-primary">
                            Subscription Order
                          </Badge>
                        </div>

                        {/* One-Tap Reorder Button */}
                        {(order.status === "delivered" || order.status === "completed") && (
                          <OneTapReorder
                            orderId={order.id}
                            items={order.order_items.map((item) => ({
                              meal_id: item.meal_id,
                              meal_name: item.meal?.name || "Unknown Meal",
                              quantity: item.quantity,
                              price: 0, // Subscription orders have no price
                              image_url: item.meal?.image_url,
                              restaurant_id: order.restaurant_id || undefined,
                              restaurant_name: order.restaurant?.name,
                            }))}
                            orderTotal={0}
                            variant="outline"
                            size="default"
                            className="w-full mt-3"
                          />
                        )}
                      </CardContent>
                    </Card>
                  );
                })
              )}
              {ordersHasMore && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={loadMoreOrders}
                  disabled={ordersLoading}
                >
                  {ordersLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    `Load More (${ordersPage * 10}+ orders)`
                  )}
                </Button>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>

      <CustomerNavigation />
    </div>
  );
};

export default OrderHistory;
