import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ArrowLeft, 
  Package, 
  ChefHat, 
  Truck, 
  CheckCircle2, 
  Clock,
  MapPin,
  Phone,
  RefreshCw,
  AlertTriangle
} from "lucide-react";

interface OrderItem {
  id: string;
  quantity: number;
  unit_price: number;
  meal_id: string;
  meals?: {
    name: string;
    image_url: string | null;
  };
}

interface ActiveOrder {
  id: string;
  status: string;
  total_price: number;
  delivery_date: string;
  meal_type: string | null;
  notes: string | null;
  created_at: string;
  restaurant_id: string;
  restaurants?: {
    name: string;
    phone: string | null;
    address: string | null;
  };
  order_items: OrderItem[];
}

const statusSteps = [
  { key: 'pending', label: 'Order Placed', icon: Package },
  { key: 'confirmed', label: 'Confirmed', icon: CheckCircle2 },
  { key: 'preparing', label: 'Preparing', icon: ChefHat },
  { key: 'out_for_delivery', label: 'On the Way', icon: Truck },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle2 },
];

const getStatusIndex = (status: string) => {
  const index = statusSteps.findIndex(s => s.key === status);
  return index === -1 ? 0 : index;
};

const getEstimatedTime = (status: string, deliveryDate: string) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = format(today, "yyyy-MM-dd");
  const isToday = deliveryDate === todayStr;
  
  if (!isToday) {
    return `Scheduled for ${new Date(deliveryDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`;
  }
  
  switch (status) {
    case 'pending':
      return 'Waiting for confirmation';
    case 'confirmed':
      return 'Starting preparation soon';
    case 'preparing':
      return '15-25 min remaining';
    case 'out_for_delivery':
      return '5-15 min remaining';
    case 'delivered':
      return 'Delivered';
    default:
      return 'Processing';
  }
};

export default function DeliveryTracking() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { settings, loading: settingsLoading } = usePlatformSettings();
  const [orders, setOrders] = useState<ActiveOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchActiveOrders = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        restaurants (name, phone, address),
        order_items (
          id,
          quantity,
          unit_price,
          meal_id,
          meals (name, image_url)
        )
      `)
      .eq('user_id', user.id)
      .in('status', ['pending', 'confirmed', 'preparing'] as const)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setOrders(data as ActiveOrder[]);
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    if (settings.features.delivery_tracking) {
      fetchActiveOrders();

      // Set up realtime subscription for order updates
      const channel = supabase
        .channel('order-tracking')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'orders',
            filter: `user_id=eq.${user?.id}`,
          },
          () => {
            fetchActiveOrders();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } else if (!settingsLoading) {
      setLoading(false);
    }
  }, [user, settings.features.delivery_tracking, settingsLoading]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchActiveOrders();
  };

  if (loading || settingsLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center gap-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              <Skeleton className="h-6 w-40" />
            </div>
          </div>
        </header>
        <main className="container mx-auto px-4 py-6 space-y-4">
          {[1, 2].map(i => (
            <Skeleton key={i} className="h-64 w-full rounded-xl" />
          ))}
        </main>
      </div>
    );
  }

  // Show disabled state if feature is turned off
  if (!settings.features.delivery_tracking) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => navigate(-1)}
                className="rounded-full"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-xl font-bold">Track Orders</h1>
            </div>
          </div>
        </header>
        <main className="container mx-auto px-4 py-12">
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="pt-6 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-500/20 flex items-center justify-center">
                <AlertTriangle className="h-8 w-8 text-amber-500" />
              </div>
              <h2 className="text-xl font-bold mb-2">Delivery Tracking Unavailable</h2>
              <p className="text-muted-foreground mb-6">
                Real-time delivery tracking is currently disabled. Please check back later.
              </p>
              <Button onClick={() => navigate("/dashboard")}>
                Return to Dashboard
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => navigate(-1)}
                className="rounded-full"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-xl font-bold">Track Orders</h1>
                <p className="text-sm text-muted-foreground">
                  {orders.length} active order{orders.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="icon"
              onClick={handleRefresh}
              disabled={refreshing}
              className="rounded-full"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {orders.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Package className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg mb-2">No Active Orders</h3>
              <p className="text-muted-foreground mb-4">
                You don't have any orders being prepared or delivered right now.
              </p>
              <Button onClick={() => navigate('/meals')}>
                Browse Meals
              </Button>
            </CardContent>
          </Card>
        ) : (
          orders.map(order => {
            const currentStep = getStatusIndex(order.status);
            const estimatedTime = getEstimatedTime(order.status, order.delivery_date);
            
            return (
              <Card key={order.id} className="overflow-hidden">
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        {order.restaurants?.name || 'Restaurant'}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        Order #{order.id.slice(0, 8).toUpperCase()}
                      </p>
                    </div>
                    <Badge 
                      variant={order.status === 'out_for_delivery' ? 'default' : 'secondary'}
                      className="capitalize"
                    >
                      {order.status.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-6">
                  {/* Estimated Time */}
                  <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-lg">
                    <Clock className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium text-sm">Estimated Delivery</p>
                      <p className="text-primary font-semibold">{estimatedTime}</p>
                    </div>
                  </div>

                  {/* Progress Timeline */}
                  <div className="relative">
                    <div className="flex justify-between gap-1 sm:gap-2">
                      {statusSteps.slice(0, 4).map((step, index) => {
                        const StepIcon = step.icon;
                        const isCompleted = index <= currentStep;
                        const isCurrent = index === currentStep;

                        return (
                          <div
                            key={step.key}
                            className="flex flex-col items-center relative z-10 flex-1 min-w-0"
                          >
                            <div
                              className={`
                                h-10 w-10 rounded-full flex items-center justify-center transition-all shrink-0
                                ${isCompleted
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted text-muted-foreground'
                                }
                                ${isCurrent ? 'ring-4 ring-primary/20' : ''}
                              `}
                            >
                              <StepIcon className="h-5 w-5" />
                            </div>
                            <span
                              className={`
                                text-[10px] sm:text-xs mt-2 text-center
                                ${isCompleted ? 'text-foreground font-medium' : 'text-muted-foreground'}
                              `}
                            >
                              {step.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Progress Line */}
                    <div className="absolute top-5 left-[10%] right-[10%] h-0.5 bg-muted -z-0">
                      <div 
                        className="h-full bg-primary transition-all duration-500"
                        style={{ width: `${(currentStep / 3) * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Order Items */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Order Items</p>
                    <div className="space-y-2">
                      {order.order_items.map(item => (
                        <div 
                          key={item.id}
                          className="flex items-center gap-3 p-2 bg-muted/50 rounded-lg"
                        >
                          {item.meals?.image_url ? (
                            <img 
                              src={item.meals.image_url} 
                              alt={item.meals?.name}
                              className="h-12 w-12 rounded-lg object-cover"
                            />
                          ) : (
                            <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
                              <ChefHat className="h-5 w-5 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">
                              {item.meals?.name || 'Meal'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Qty: {item.quantity} × ${Number(item.unit_price).toFixed(2)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Restaurant Contact */}
                  {(order.restaurants?.address || order.restaurants?.phone) && (
                    <div className="pt-4 border-t border-border space-y-2">
                      {order.restaurants?.address && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin className="h-4 w-4" />
                          <span>{order.restaurants.address}</span>
                        </div>
                      )}
                      {order.restaurants?.phone && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Phone className="h-4 w-4" />
                          <a 
                            href={`tel:${order.restaurants.phone}`}
                            className="text-primary hover:underline"
                          >
                            {order.restaurants.phone}
                          </a>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Total */}
                  <div className="flex items-center justify-between pt-4 border-t border-border">
                    <span className="font-medium">Total</span>
                    <span className="text-lg font-bold text-primary">
                      ${Number(order.total_price).toFixed(2)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}

        {/* View Past Orders Link */}
        {orders.length > 0 && (
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => navigate('/orders')}
          >
            View Order History
          </Button>
        )}
      </main>
    </div>
  );
}
