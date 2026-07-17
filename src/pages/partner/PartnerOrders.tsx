import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Clock,
  CheckCircle,
  Package,
  ChefHat,
  Truck,
  CircleDot,
  MapPin,
  Phone,
  Utensils,
  Flame,
  Info,
  MessageSquareText,
  CheckCheck,
  X,
  Play,
  Box,
  ArrowRight,
  AlertCircle,
  RefreshCw,
  ListChecks,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  WifiOff,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { PartnerLayout } from "@/components/PartnerLayout";
import { PartnerDeliveryHandoff } from "@/components/partner/PartnerDeliveryHandoff";
import { getQatarDay } from "@/lib/dateUtils";
import { formatCurrency } from "@/lib/currency";
import {
  createPartnerPosOrderPayload,
  flushPartnerPosOrders,
  readPartnerPosOrders,
  syncOrQueuePartnerPosOrder,
  type PartnerPosMenuItem,
  type PartnerPosOfflineOrder,
} from "@/lib/partner-pos-offline";

// Extended order status type with all new statuses
type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready"
  | "out_for_delivery"
  | "delivered"
  | "completed"
  | "cancelled";

// Status configuration with icons and colors
const STATUS_CONFIG: Record<
  OrderStatus,
  {
    label: string;
    icon: React.ReactNode;
    color: string;
    description: string;
  }
> = {
  pending: {
    label: "Pending",
    icon: <CircleDot className="h-4 w-4" />,
    color: "bg-[#F97316]/10 text-[#F97316] border-[#F97316]/20",
    description: "Waiting for you to accept",
  },
  confirmed: {
    label: "Confirmed",
    icon: <CheckCircle className="h-4 w-4" />,
    color: "bg-[#38BDF8]/10 text-[#0284C7] border-[#38BDF8]/25",
    description: "Accepted, ready to prepare",
  },
  preparing: {
    label: "Preparing",
    icon: <ChefHat className="h-4 w-4" />,
    color: "bg-[#7C83F6]/10 text-[#7C83F6] border-[#7C83F6]/25",
    description: "Currently cooking",
  },
  ready: {
    label: "Ready",
    icon: <Box className="h-4 w-4" />,
    color: "bg-[#22C7A1]/10 text-[#0B9B7E] border-[#22C7A1]/25",
    description: "Ready for pickup/delivery",
  },
  out_for_delivery: {
    label: "Out for Delivery",
    icon: <Truck className="h-4 w-4" />,
    color: "bg-[#020617]/10 text-[#020617] border-[#020617]/15",
    description: "Driver is on the way",
  },
  delivered: {
    label: "Delivered",
    icon: <CheckCheck className="h-4 w-4" />,
    color: "bg-[#22C7A1]/10 text-[#0B9B7E] border-[#22C7A1]/25",
    description: "Customer received the order",
  },
  completed: {
    label: "Completed",
    icon: <CheckCircle className="h-4 w-4" />,
    color: "bg-[#22C7A1]/10 text-[#0B9B7E] border-[#22C7A1]/25",
    description: "Order finished",
  },
  cancelled: {
    label: "Cancelled",
    icon: <X className="h-4 w-4" />,
    color: "bg-[#FB6B7A]/10 text-[#FB6B7A] border-[#FB6B7A]/25",
    description: "Order cancelled",
  },
};

// Action buttons configuration for each status
const ACTION_BUTTONS: Record<
  OrderStatus,
  Array<{
    action: OrderStatus;
    label: string;
    icon: React.ReactNode;
    variant: "default" | "secondary" | "outline" | "destructive";
  }>
> = {
  pending: [
    {
      action: "confirmed",
      label: "Accept Order",
      icon: <CheckCircle className="h-4 w-4" />,
      variant: "default",
    },
    {
      action: "cancelled",
      label: "Cancel Order",
      icon: <X className="h-4 w-4" />,
      variant: "destructive",
    },
  ],
  confirmed: [
    {
      action: "preparing",
      label: "Start Preparing",
      icon: <Play className="h-4 w-4" />,
      variant: "default",
    },
    {
      action: "cancelled",
      label: "Cancel Order",
      icon: <X className="h-4 w-4" />,
      variant: "destructive",
    },
  ],
  preparing: [
    {
      action: "ready",
      label: "Mark Ready",
      icon: <Box className="h-4 w-4" />,
      variant: "default",
    },
    {
      action: "cancelled",
      label: "Cancel Order",
      icon: <X className="h-4 w-4" />,
      variant: "destructive",
    },
  ],
  ready: [
    // Partners cannot transition to out_for_delivery - this is handled automatically
    // when a driver is assigned via the driver assignment system
    {
      action: "cancelled",
      label: "Cancel Order",
      icon: <X className="h-4 w-4" />,
      variant: "destructive",
    },
  ],
  out_for_delivery: [
    // Partners cannot change status once handed to driver
  ],
  delivered: [
    // Partners cannot change status - only customer can mark as completed
  ],
  completed: [
    // No actions for completed orders
  ],
  cancelled: [
    // No actions for cancelled orders
  ],
};

// Status flow visualization
const STATUS_FLOW: OrderStatus[] = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "out_for_delivery",
  "delivered",
  "completed",
];

interface ScheduleAddon {
  id: string;
  addon_name: string;
  quantity: number;
}

type KitchenItemStatus = "queued" | "preparing" | "ready";

interface KitchenOrderItem {
  item_key: string;
  item_name: string;
  quantity: number;
  status: KitchenItemStatus;
  started_at: string | null;
  ready_at: string | null;
}

interface KitchenItemStatusRow {
  order_source: "order" | "meal_schedule";
  order_id: string;
  item_key: string;
  item_name: string;
  quantity: number;
  status: KitchenItemStatus;
  started_at: string | null;
  ready_at: string | null;
}

interface TransformMaps {
  profilesMap: Record<
    string,
    { full_name: string | null; email: string | null }
  >;
  addressesMap: Record<string, Record<string, unknown>>;
  addonsMap: Record<string, ScheduleAddon[]>;
  driversMap: Record<string, Order["driver"]>;
  kitchenItemsMap: Record<string, KitchenItemStatusRow[]>;
}

function buildKitchenItemKey(source: Order["source"], orderId: string) {
  return `${source}:${orderId}`;
}

function mergeKitchenItems(
  source: Order["source"],
  orderId: string,
  meal: Order["meal"],
  addons: ScheduleAddon[],
  kitchenRows: KitchenItemStatusRow[],
): KitchenOrderItem[] {
  const persisted = new Map(kitchenRows.map((row) => [row.item_key, row]));
  const baseItems: KitchenOrderItem[] = [];

  if (meal) {
    baseItems.push({
      item_key: `meal:${meal.id}`,
      item_name: meal.name,
      quantity: 1,
      status: "queued",
      started_at: null,
      ready_at: null,
    });
  }

  for (const addon of addons) {
    baseItems.push({
      item_key: `addon:${addon.id}`,
      item_name: addon.addon_name,
      quantity: addon.quantity,
      status: "queued",
      started_at: null,
      ready_at: null,
    });
  }

  if (baseItems.length === 0) {
    baseItems.push({
      item_key: `${source}:${orderId}:item`,
      item_name: "Kitchen item",
      quantity: 1,
      status: "queued",
      started_at: null,
      ready_at: null,
    });
  }

  return baseItems.map((item) => {
    const saved = persisted.get(item.item_key);
    return saved
      ? {
          ...item,
          item_name: saved.item_name || item.item_name,
          quantity: saved.quantity || item.quantity,
          status: saved.status,
          started_at: saved.started_at,
          ready_at: saved.ready_at,
        }
      : item;
  });
}

/** Type-safe transform: raw Supabase row to Order. All `as` casts are contained here. */
function transformScheduleToOrder(
  s: Record<string, unknown>,
  maps: TransformMaps,
): Order {
  const id = s.id as string;
  const source: Order["source"] = "meal_schedule";
  const meal = s.meals as Order["meal"];
  const addons = maps.addonsMap[id] || [];

  return {
    id,
    source,
    order_status: ((s.order_status as string) || "pending") as OrderStatus,
    scheduled_date: s.scheduled_date as string,
    delivery_time_slot: (s.delivery_time_slot as string) || null,
    meal_type: s.meal_type as string,
    delivery_type: (s.delivery_type as string) || "standard",
    delivery_fee: s.delivery_fee as number | null,
    addons_total: (s.addons_total as number) || 0,
    restaurant_note: (s.restaurant_note as string) || null,
    created_at: s.created_at as string,
    cancellation_reason: null,
    meal,
    customer: maps.profilesMap[s.user_id as string]
      ? {
          full_name: maps.profilesMap[s.user_id as string].full_name,
          phone: null,
        }
      : null,
    delivery_address: maps.addressesMap[s.user_id as string]
      ? {
          address_line1: maps.addressesMap[s.user_id as string]
            .address_line1 as string,
          address_line2: maps.addressesMap[s.user_id as string]
            .address_line2 as string | null,
          city: maps.addressesMap[s.user_id as string].city as string | null,
          phone: maps.addressesMap[s.user_id as string].phone as string | null,
          delivery_instructions: maps.addressesMap[s.user_id as string]
            .delivery_instructions as string | null,
        }
      : null,
    addons,
    driver: maps.driversMap[s.id as string] ?? null,
    kitchen_items: mergeKitchenItems(
      source,
      id,
      meal,
      addons,
      maps.kitchenItemsMap[buildKitchenItemKey(source, id)] || [],
    ),
  };
}

function normalizeDirectOrderStatus(status: string | null): OrderStatus {
  if (status === "ready_for_pickup") return "ready";
  if (status === "picked_up") return "out_for_delivery";
  return (status || "pending") as OrderStatus;
}

function transformDirectOrderToOrder(
  order: Record<string, unknown>,
  profilesMap: TransformMaps["profilesMap"],
  mealsMap: Record<string, Order["meal"]>,
  kitchenItemsMap: TransformMaps["kitchenItemsMap"],
): Order {
  const createdAt = order.created_at as string;
  const userId = order.user_id as string | null;
  const profile = userId ? profilesMap[userId] : null;
  const id = order.id as string;
  const source: Order["source"] = "order";
  const meal = mealsMap[order.meal_id as string] || null;

  return {
    id,
    source,
    order_status: normalizeDirectOrderStatus(order.status as string | null),
    scheduled_date: getQatarDay(new Date(createdAt)),
    delivery_time_slot: (order.estimated_delivery_time as string) || null,
    meal_type: "order",
    delivery_type: "delivery",
    delivery_fee: order.delivery_fee as number | null,
    addons_total: 0,
    restaurant_note: (order.special_instructions as string) || (order.notes as string) || null,
    created_at: createdAt,
    cancellation_reason: null,
    meal,
    customer: {
      full_name: profile?.full_name || null,
      phone: (order.phone_number as string) || null,
    },
    delivery_address: order.delivery_address
      ? {
          address_line1: order.delivery_address as string,
          address_line2: null,
          city: null,
          phone: (order.phone_number as string) || null,
          delivery_instructions: (order.special_instructions as string) || null,
        }
      : null,
    addons: [],
    driver: null,
    kitchen_items: mergeKitchenItems(
      source,
      id,
      meal,
      [],
      kitchenItemsMap[buildKitchenItemKey(source, id)] || [],
    ),
  };
}

/** Type-safe transform: raw schedule_addons rows to lookup map. */
function buildAddonsMap(
  addonsData: unknown[],
): Record<string, ScheduleAddon[]> {
  const rows = addonsData as Array<Record<string, unknown>>;
  return rows.reduce<Record<string, ScheduleAddon[]>>((acc, a) => {
    const scheduleId = a.schedule_id as string;
    const addon = a.addon as Record<string, unknown> | null;
    if (!acc[scheduleId]) acc[scheduleId] = [];
    acc[scheduleId].push({
      id: (a.id as string) || `${scheduleId}-${(addon?.name as string) || ""}`,
      addon_name: (addon?.name as string) || "Add-on",
      quantity: a.quantity as number,
    });
    return acc;
  }, {});
}

interface Order {
  id: string;
  source: "order" | "meal_schedule";
  order_status: OrderStatus;
  scheduled_date: string;
  delivery_time_slot: string | null;
  meal_type: string;
  delivery_type: string;
  delivery_fee: number | null;
  addons_total: number | null;
  restaurant_note: string | null;
  created_at: string;
  cancellation_reason: string | null;
  meal: {
    id: string;
    name: string;
    image_url: string | null;
    calories: number;
    price: number;
  } | null;
  customer: {
    full_name: string | null;
    phone: string | null;
  } | null;
  delivery_address: {
    address_line1: string;
    address_line2: string | null;
    city: string | null;
    phone: string | null;
    delivery_instructions: string | null;
  } | null;
  addons: ScheduleAddon[];
  kitchen_items: KitchenOrderItem[];
  driver: {
    id: string;
    full_name: string | null;
  } | null;
}

interface PosCartItem {
  meal: PartnerPosMenuItem;
  quantity: number;
}

type KitchenQueryResult<T> = Promise<{
  data: T[] | null;
  error: { message: string } | null;
}>;

type KitchenRpcResult = Promise<{
  data: unknown;
  error: Error | null;
}>;

type KitchenQueueClient = {
  from: (table: "kitchen_queue_items") => {
    select: (columns: string) => {
      in: (column: string, values: string[]) => {
        in: (column: string, values: string[]) => KitchenQueryResult<KitchenItemStatusRow>;
      };
    };
  };
  rpc: (
    functionName: "partner_update_kitchen_item_status",
    args: {
      p_source: Order["source"];
      p_order_id: string;
      p_item_key: string;
      p_status: KitchenItemStatus;
      p_item_name: string;
      p_quantity: number;
      p_all_item_keys: string[];
    },
  ) => KitchenRpcResult;
};

const kitchenQueueClient = supabase as unknown as KitchenQueueClient;

const PartnerOrders = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [restaurantName, setRestaurantName] = useState<string>("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState("active");
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [posMenuItems, setPosMenuItems] = useState<PartnerPosMenuItem[]>([]);
  const [posCart, setPosCart] = useState<PosCartItem[]>([]);
  const [posCustomerName, setPosCustomerName] = useState("");
  const [posPhoneNumber, setPosPhoneNumber] = useState("");
  const [posNotes, setPosNotes] = useState("");
  const [pendingPosOrders, setPendingPosOrders] = useState<PartnerPosOfflineOrder[]>([]);
  const [posSyncing, setPosSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Manual refresh function
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchOrders();
    setRefreshing(false);
    setLastUpdate(new Date());
  };

  useEffect(() => {
    if (user) {
      fetchOrders();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const refreshPendingPosOrders = () => {
    if (!user) return;
    setPendingPosOrders(readPartnerPosOrders(user.id, restaurantId));
  };

  useEffect(() => {
    refreshPendingPosOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, restaurantId]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      void syncPendingPosOrders();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Polling for new orders (fallback for real-time, compliments NewOrderNotificationBanner)
  useEffect(() => {
    if (!restaurantId) return;

    // Poll every 10 seconds for new orders as a fallback
    pollIntervalRef.current = setInterval(() => {
      fetchOrders();
      setLastUpdate(new Date());
    }, 10000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  // Subscribe to real-time updates. INSERT is handled by NewOrderNotificationBanner.
  useEffect(() => {
    if (!restaurantId) return;

    const channel = supabase
      .channel("partner-meal-schedules")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "meal_schedules",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => {
          // Show toast notification for status changes
          if (payload.eventType === "UPDATE") {
            const newStatus = (payload.new as { order_status: string })
              .order_status;
            const oldStatus = (payload.old as { order_status: string })
              .order_status;

            if (newStatus !== oldStatus) {
              const statusMessages: Record<string, string> = {
                confirmed: "Order confirmed - preparing to cook",
                preparing: "Order is being prepared",
                ready: "Order is ready for pickup",
                out_for_delivery: "Order has been picked up by driver",
                delivered: "Order delivered to customer",
                completed: "Order completed",
                cancelled: "Order has been cancelled",
              };

              if (statusMessages[newStatus]) {
                toast({
                  title: "Order Updated",
                  description: statusMessages[newStatus],
                });
              }
            }
          }

          // Add small delay to ensure DB transaction is committed
          setTimeout(() => {
            fetchOrders();
          }, 500);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        () => {
          setTimeout(() => fetchOrders(), 500);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId, toast]);

  const fetchOrders = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Get partner's restaurant
      const { data: restaurant, error: restaurantError } = await supabase
        .from("restaurants")
        .select("id, name")
        .eq("owner_id", user.id)
        .maybeSingle();

      if (restaurantError) throw restaurantError;
      if (!restaurant) {
        // If no restaurant found, wait briefly and retry in case auth is still settling
        await new Promise((resolve) => setTimeout(resolve, 1500));
        const { data: retryRestaurant } = await supabase
          .from("restaurants")
          .select("id, name")
          .eq("owner_id", user.id)
          .maybeSingle();
        if (!retryRestaurant) {
          navigate("/partner");
          return;
        }
        setRestaurantId(retryRestaurant.id);
        setRestaurantName(retryRestaurant.name);
        return fetchOrders();
      }

      setRestaurantId(restaurant.id);
      setRestaurantName(restaurant.name);

      // Get all meal IDs for this restaurant
      const { data: meals, error: mealsError } = await supabase
        .from("meals")
        .select("id, name, image_url, calories, price")
        .eq("restaurant_id", restaurant.id);

      if (mealsError) throw mealsError;

      const mealIds = meals?.map((m) => m.id) || [];
      setPosMenuItems(
        (meals || []).map((meal) => ({
          id: meal.id,
          name: meal.name,
          price: meal.price ?? 0,
          image_url: meal.image_url,
        })),
      );
      const partnerMealsMap: Record<string, Order["meal"]> = Object.fromEntries(
        (meals || []).map((meal) => [meal.id, {
          ...meal,
          calories: meal.calories ?? 0,
          price: meal.price ?? 0,
        }]),
      );

      // Only show today's meals so the restaurant doesn't prepare future orders early
      const today = getQatarDay();

      const [scheduleResult, directOrderResult] = await Promise.all([
        mealIds.length > 0
          ? supabase
              .from("meal_schedules")
              .select(`
          id,
          scheduled_date,
          delivery_time_slot,
          meal_type,
          order_status,
          delivery_type,
          delivery_fee,
          addons_total,
          restaurant_note,
          created_at,
          user_id,
          meals:meals!meal_schedules_meal_id_fkey (
            id,
            name,
            image_url,
            calories,
            price
          )
              `)
              .in("meal_id", mealIds)
              .or(
                `scheduled_date.eq.${today},order_status.in.(confirmed,preparing,ready,out_for_delivery)`,
              )
              .order("scheduled_date", { ascending: true })
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from("orders")
          .select(`
            id,
            status,
            created_at,
            user_id,
            delivery_address,
            delivery_fee,
            phone_number,
            special_instructions,
            notes,
            estimated_delivery_time,
            meal_id
          `)
          .eq("restaurant_id", restaurant.id)
          .order("created_at", { ascending: false })
          .limit(100),
      ]);

      const { data: schedules, error: schedulesError } = scheduleResult;
      const { data: directOrders, error: directOrdersError } = directOrderResult;

      if (schedulesError) throw schedulesError;
      if (directOrdersError) throw directOrdersError;

      // Get user info from auth
      const userIds = [
        ...new Set(
          [
            ...((schedules || []) as Array<Record<string, unknown>>).map(
              (s: Record<string, unknown>) => s.user_id as string,
            ),
            ...((directOrders || []) as Array<Record<string, unknown>>).map(
              (o: Record<string, unknown>) => o.user_id as string,
            ),
          ].filter(Boolean),
        ),
      ];

      let addressesMap: Record<string, Record<string, unknown>> = {};
      let profilesMap: Record<
        string,
        { full_name: string | null; email: string | null }
      > = {};

      if (userIds.length > 0) {
        // Fetch default addresses
        const { data: addresses } = await supabase
          .from("user_addresses")
          .select(
            "user_id, address_line1, address_line2, city, phone, delivery_instructions, is_default",
          )
          .in("user_id", userIds)
          .eq("is_default", true);

        if (addresses) {
          addressesMap = addresses.reduce(
            (
              acc: Record<string, Record<string, unknown>>,
              a: Record<string, unknown>,
            ) => {
              acc[a.user_id as string] = a;
              return acc;
            },
            {} as Record<string, Record<string, unknown>>,
          );
        }

        // Fetch customer names from profiles (profiles has no 'phone' column)
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, email")
          .in("user_id", userIds);

        if (profiles) {
          profilesMap = profiles.reduce(
            (
              acc: Record<
                string,
                { full_name: string | null; email: string | null }
              >,
              p: Record<string, unknown>,
            ) => {
              acc[p.user_id as string] = {
                full_name: p.full_name as string | null,
                email: p.email as string | null,
              };
              return acc;
            },
            {},
          );
        }
      }

      // Fetch addons for each schedule
      const scheduleIds = ((schedules || []) as Array<Record<string, unknown>>).map(
        (s: Record<string, unknown>) => s.id as string,
      );
      let addonsMap: Record<string, ScheduleAddon[]> = {};

      if (scheduleIds.length > 0) {
        const { data: addonsData } = await supabase
          .from("schedule_addons")
          .select(
            `
            id,
            schedule_id,
            quantity,
            addon:meal_addons (name)
          `,
          )
          .in("schedule_id", scheduleIds);

        if (addonsData) {
          addonsMap = buildAddonsMap(addonsData);
        }
      }

      const directOrderIds = ((directOrders || []) as Array<Record<string, unknown>>).map(
        (order: Record<string, unknown>) => order.id as string,
      );
      const allKitchenOrderIds = [...scheduleIds, ...directOrderIds];
      let kitchenItemsMap: Record<string, KitchenItemStatusRow[]> = {};

      if (allKitchenOrderIds.length > 0) {
        const { data: kitchenRows, error: kitchenRowsError } = await kitchenQueueClient
          .from("kitchen_queue_items")
          .select("order_source, order_id, item_key, item_name, quantity, status, started_at, ready_at")
          .in("order_id", allKitchenOrderIds)
          .in("order_source", ["meal_schedule", "order"]);

        if (kitchenRowsError) {
          console.warn("Kitchen item statuses unavailable:", kitchenRowsError.message);
        } else {
          kitchenItemsMap = ((kitchenRows || []) as KitchenItemStatusRow[]).reduce<Record<string, KitchenItemStatusRow[]>>(
            (acc, row) => {
              const key = buildKitchenItemKey(row.order_source, row.order_id);
              if (!acc[key]) acc[key] = [];
              acc[key].push(row);
              return acc;
            },
            {},
          );
        }
      }

      const driversMap: Record<string, Order["driver"]> = {};

      // Transform data via typed helper
      const maps: TransformMaps = {
        profilesMap,
        addressesMap,
        addonsMap,
        driversMap,
        kitchenItemsMap,
      };
      const transformedOrders: Order[] = ((schedules || []) as Array<Record<string, unknown>>).map(
        (s: Record<string, unknown>) => transformScheduleToOrder(s, maps),
      );

      const transformedDirectOrders = ((directOrders || []) as Array<Record<string, unknown>>)
        .filter((order: Record<string, unknown>) => {
          const status = order.status as string;
          const isClosed = status === "completed" || status === "cancelled";
          return !isClosed || getQatarDay(new Date(order.created_at as string)) === today;
        })
        .map((order: Record<string, unknown>) =>
          transformDirectOrderToOrder(order, profilesMap, partnerMealsMap, kitchenItemsMap),
        );

      setOrders(
        [...transformedOrders, ...transformedDirectOrders].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        ),
      );
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : (error as { message?: string } | null)?.message || "Failed to load orders";
      console.error("Error fetching orders:", message, error);
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: OrderStatus) => {
    try {
      const order = orders.find((item) => item.id === orderId);
      if (!order) throw new Error("Order not found");

      const { error } = await supabase.rpc("partner_update_order_status", {
        p_source: order.source,
        p_order_id: orderId,
        p_new_status: newStatus,
      });

      if (error) throw error;

      const statusLabel = STATUS_CONFIG[newStatus].label;
      toast({
        title: "Status updated",
        description: `Order marked as ${statusLabel}`,
      });

      // Update local state
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId ? { ...o, order_status: newStatus } : o,
        ),
      );
    } catch (error: unknown) {
      console.error("Error updating order:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to update order status",
        variant: "destructive",
      });
    }
  };

  const updateKitchenItemStatus = async (
    order: Order,
    item: KitchenOrderItem,
    status: KitchenItemStatus,
  ) => {
    try {
      const allItemKeys = order.kitchen_items.map((kitchenItem) => kitchenItem.item_key);
      const { error } = await kitchenQueueClient.rpc("partner_update_kitchen_item_status", {
        p_source: order.source,
        p_order_id: order.id,
        p_item_key: item.item_key,
        p_status: status,
        p_item_name: item.item_name,
        p_quantity: item.quantity,
        p_all_item_keys: allItemKeys,
      });

      if (error) throw error;

      const updatedItems = order.kitchen_items.map((kitchenItem) =>
        kitchenItem.item_key === item.item_key
          ? {
              ...kitchenItem,
              status,
              started_at: status === "preparing" || status === "ready"
                ? kitchenItem.started_at || new Date().toISOString()
                : kitchenItem.started_at,
              ready_at: status === "ready" ? kitchenItem.ready_at || new Date().toISOString() : null,
            }
          : kitchenItem,
      );
      const allReady = updatedItems.every((kitchenItem) => kitchenItem.status === "ready");

      setOrders((prev) =>
        prev.map((existingOrder) =>
          existingOrder.id === order.id && existingOrder.source === order.source
            ? {
                ...existingOrder,
                order_status: allReady ? "ready" : status === "preparing" ? "preparing" : existingOrder.order_status,
                kitchen_items: updatedItems,
              }
            : existingOrder,
        ),
      );

      toast({
        title: status === "ready" ? "Item ready" : "Item started",
        description: `${item.item_name} marked as ${status}`,
      });
    } catch (error: unknown) {
      console.error("Error updating kitchen item:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to update kitchen item",
        variant: "destructive",
      });
    }
  };

  const addPosItem = (meal: PartnerPosMenuItem) => {
    setPosCart((current) => {
      const existing = current.find((item) => item.meal.id === meal.id);
      if (existing) {
        return current.map((item) =>
          item.meal.id === meal.id
            ? { ...item, quantity: Math.min(99, item.quantity + 1) }
            : item,
        );
      }
      return [...current, { meal, quantity: 1 }];
    });
  };

  const changePosQuantity = (mealId: string, delta: number) => {
    setPosCart((current) =>
      current
        .map((item) =>
          item.meal.id === mealId
            ? { ...item, quantity: item.quantity + delta }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  };

  const posTotal = posCart.reduce(
    (sum, item) => sum + item.quantity * Number(item.meal.price || 0),
    0,
  );

  const syncPendingPosOrders = async () => {
    if (!user || posSyncing) return;
    setPosSyncing(true);
    try {
      const result = await flushPartnerPosOrders(user.id);
      refreshPendingPosOrders();
      if (result.synced > 0) {
        await fetchOrders();
        toast({
          title: "POS synced",
          description: `${result.synced} offline ticket${result.synced === 1 ? "" : "s"} sent to the kitchen.`,
        });
      }
    } catch (error) {
      toast({
        title: "POS sync failed",
        description: error instanceof Error ? error.message : "Try again when the connection is stable.",
        variant: "destructive",
      });
    } finally {
      setPosSyncing(false);
    }
  };

  const createPosOrder = async () => {
    if (!user || !restaurantId) return;
    try {
      const payload = createPartnerPosOrderPayload({
        restaurantId,
        restaurantName,
        items: posCart,
        customerName: posCustomerName,
        phoneNumber: posPhoneNumber,
        notes: posNotes,
      });

      const result = await syncOrQueuePartnerPosOrder({ userId: user.id, payload });
      setPosCart([]);
      setPosCustomerName("");
      setPosPhoneNumber("");
      setPosNotes("");
      refreshPendingPosOrders();

      if (result.synced) {
        await fetchOrders();
        toast({
          title: "POS order sent",
          description: "The ticket is now in today's kitchen flow.",
        });
      } else {
        toast({
          title: "Saved offline",
          description: "The ticket will sync automatically when connection returns.",
        });
      }
    } catch (error) {
      toast({
        title: "Could not create POS order",
        description: error instanceof Error && error.message === "POS_CART_EMPTY"
          ? "Add at least one menu item first."
          : error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const activeOrders = orders.filter(
    (o) => o.order_status !== "completed" && o.order_status !== "cancelled",
  );

  const completedOrders = orders.filter((o) => o.order_status === "completed");

  const cancelledOrders = orders.filter((o) => o.order_status === "cancelled");
  const pendingOrders = activeOrders.filter(
    (o) => o.order_status === "pending",
  ).length;
  const preparingOrders = activeOrders.filter(
    (o) => o.order_status === "preparing",
  ).length;
  const readyOrders = activeOrders.filter(
    (o) => o.order_status === "ready",
  ).length;

  if (loading) {
    return (
      <PartnerLayout title="Orders">
        <div className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </PartnerLayout>
    );
  }

  // Status Progress Bar Component
  const StatusProgressBar = ({
    currentStatus,
  }: {
    currentStatus: OrderStatus;
  }) => {
    if (currentStatus === "cancelled") {
      return (
        <div className="flex items-center gap-2 rounded-2xl border border-[#FB6B7A]/25 bg-[#FB6B7A]/10 p-3 text-[#FB6B7A]">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm font-black">Order Cancelled</span>
        </div>
      );
    }

    const currentIndex = STATUS_FLOW.indexOf(currentStatus);

    return (
      <div className="w-full">
        <div className="mb-2 flex items-center justify-between text-xs font-black text-[#94A3B8]">
          <span>Progress</span>
          <span>
            Step {currentIndex + 1} of {STATUS_FLOW.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {STATUS_FLOW.map((status, index) => {
            const isActive = index <= currentIndex;
            const isCurrent = index === currentIndex;

            return (
              <div key={status} className="flex items-center flex-1">
                <div
                  className={`h-2 flex-1 rounded-full transition-all duration-300 ${
                    isActive
                      ? isCurrent
                        ? "bg-[#020617]"
                        : "bg-[#22C7A1]"
                      : "bg-[#E5EAF1]"
                  }`}
                />
                {index < STATUS_FLOW.length - 1 && (
                  <ArrowRight className="mx-0.5 h-3 w-3 text-[#94A3B8]" />
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex justify-between text-[10px] font-bold uppercase text-[#94A3B8]">
          <span>Order</span>
          <span>Ready</span>
          <span>Complete</span>
        </div>
      </div>
    );
  };

  const KitchenItemFlow = ({ order }: { order: Order }) => {
    const readyCount = order.kitchen_items.filter((item) => item.status === "ready").length;
    const progress = order.kitchen_items.length > 0
      ? Math.round((readyCount / order.kitchen_items.length) * 100)
      : 0;
    const disabled = ["ready", "out_for_delivery", "delivered", "completed", "cancelled"].includes(order.order_status);

    const itemStatusStyle: Record<KitchenItemStatus, string> = {
      queued: "bg-[#F6F8FB] text-[#64748B] border-[#E5EAF1]",
      preparing: "bg-[#7C83F6]/10 text-[#7C83F6] border-[#7C83F6]/25",
      ready: "bg-[#22C7A1]/10 text-[#0B9B7E] border-[#22C7A1]/25",
    };

    return (
      <div className="mt-4 rounded-3xl border border-[#E5EAF1] bg-white p-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#020617] text-white">
              <ListChecks className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#7C83F6]">KDS items</p>
              <p className="text-sm font-black text-[#020617]">{readyCount}/{order.kitchen_items.length} ready</p>
            </div>
          </div>
          <span className="rounded-full bg-[#F6F8FB] px-3 py-1 text-xs font-black text-[#94A3B8] ring-1 ring-[#E5EAF1]">
            {progress}%
          </span>
        </div>

        <div className="mb-3 h-2 overflow-hidden rounded-full bg-[#E5EAF1]">
          <div className="h-full rounded-full bg-[#22C7A1] transition-all" style={{ width: `${progress}%` }} />
        </div>

        <div className="space-y-2">
          {order.kitchen_items.map((item) => {
            const nextStatus: KitchenItemStatus | null =
              item.status === "queued" ? "preparing" : item.status === "preparing" ? "ready" : null;

            return (
              <div key={item.item_key} className="flex flex-col gap-2 rounded-2xl border border-[#E5EAF1] bg-[#F6F8FB] p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-black text-[#020617]">{item.item_name}</p>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black text-[#64748B] ring-1 ring-[#E5EAF1]">
                      x{item.quantity}
                    </span>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black capitalize ${itemStatusStyle[item.status]}`}>
                      {item.status}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] font-semibold text-[#94A3B8]">
                    {item.status === "ready"
                      ? "Ready for handoff"
                      : item.status === "preparing"
                        ? "Cooking in progress"
                        : "Waiting to start"}
                  </p>
                </div>

                {nextStatus && !disabled ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => updateKitchenItemStatus(order, item, nextStatus)}
                    className={`h-10 rounded-2xl px-4 text-xs font-black ${
                      nextStatus === "ready"
                        ? "bg-[#22C7A1] text-white hover:bg-[#1FB492]"
                        : "bg-[#020617] text-white hover:bg-[#020617]/90"
                    }`}
                  >
                    {nextStatus === "ready" ? <CheckCircle className="mr-1 h-4 w-4" /> : <Play className="mr-1 h-4 w-4" />}
                    {nextStatus === "ready" ? "Ready" : "Start"}
                  </Button>
                ) : (
                  <span className="inline-flex h-10 items-center justify-center rounded-2xl bg-white px-4 text-xs font-black text-[#22C7A1] ring-1 ring-[#E5EAF1]">
                    <CheckCheck className="mr-1 h-4 w-4" />
                    Done
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderOrders = (ordersList: Order[], showActions = false) => {
    if (ordersList.length === 0) {
      return (
        <Card className="rounded-[28px] border border-dashed border-[#E5EAF1] bg-white shadow-[0_14px_36px_rgba(2,6,23,0.04)]">
          <CardContent className="flex flex-col items-center justify-center px-4 py-14 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[#7C83F6]/10 text-[#7C83F6]">
              <Package className="h-7 w-7" />
            </div>
            <p className="mt-4 text-lg font-black text-[#020617]">
              No orders found
            </p>
            <p className="mt-1 max-w-sm text-sm font-medium text-[#94A3B8]">
              Orders for today will appear here as soon as customers schedule
              your meals.
            </p>
          </CardContent>
        </Card>
      );
    }

    return ordersList.map((order) => {
      const statusConfig = STATUS_CONFIG[order.order_status];
      const availableActions = ACTION_BUTTONS[order.order_status] || [];
      const orderDate = order.scheduled_date
        ? new Date(order.scheduled_date + "T00:00:00").toLocaleDateString(
            undefined,
            {
              weekday: "short",
              month: "short",
              day: "numeric",
            },
          )
        : new Date(order.created_at).toLocaleDateString();

      return (
        <article
          key={order.id}
          data-testid={`partner-order-${order.id}`}
          data-order-source={order.source}
          className="overflow-hidden rounded-[28px] border border-[#E5EAF1] bg-white shadow-[0_14px_36px_rgba(2,6,23,0.04)]"
        >
          <div className="p-4 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex min-w-0 gap-3">
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-3xl bg-[#F6F8FB]">
                  {order.meal?.image_url ? (
                    <img
                      src={order.meal.image_url}
                      alt={order.meal.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Utensils className="h-7 w-7 text-[#94A3B8]" />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-black uppercase tracking-[0.12em] text-[#94A3B8]">
                      ORD-{order.id.slice(-6).toUpperCase()}
                    </span>
                    <Badge
                      variant="outline"
                      className={`rounded-full border px-3 py-1 text-xs font-black ${statusConfig.color}`}
                    >
                      <span className="flex items-center gap-1">
                        {statusConfig.icon}
                        {statusConfig.label}
                      </span>
                    </Badge>
                    {order.driver && (
                      <Badge className="rounded-full bg-[#22C7A1]/10 px-3 py-1 text-xs font-black text-[#0B9B7E] hover:bg-[#22C7A1]/10">
                        <Truck className="mr-1 h-3 w-3" />
                        Driver assigned
                      </Badge>
                    )}
                  </div>
                  <h3 className="mt-2 truncate text-lg font-black text-[#020617]">
                    {order.meal?.name || "Meal"}
                  </h3>
                  <p className="mt-1 text-sm font-medium text-[#64748B]">
                    {statusConfig.description}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-bold text-[#64748B]">
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#F6F8FB] px-3 py-1">
                      <Clock className="h-3.5 w-3.5 text-[#020617]" />
                      {orderDate} -{" "}
                      <span className="capitalize">{order.meal_type}</span>
                    </span>
                    {order.delivery_time_slot && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#F97316]/10 px-3 py-1 text-[#F97316]">
                        <Clock className="h-3.5 w-3.5" />
                        Deliver by {order.delivery_time_slot}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#22C7A1]/10 px-3 py-1 text-[#0B9B7E]">
                      <Flame className="h-3.5 w-3.5" />
                      {order.meal?.calories || 0} cal
                    </span>
                    {order.addons.length > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#7C83F6]/10 px-3 py-1 text-[#7C83F6]">
                        <Package className="h-3.5 w-3.5" />
                        {order.addons.length} add-ons
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {showActions && availableActions.length > 0 && (
                <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
                  {availableActions.map((action) => (
                    <Button
                      key={action.action}
                      size="sm"
                      variant={
                        action.variant === "destructive" ? "outline" : "default"
                      }
                      onClick={() => updateOrderStatus(order.id, action.action)}
                      className={`h-10 rounded-2xl px-4 font-black ${
                        action.variant === "destructive"
                          ? "border-[#FB6B7A]/30 bg-[#FB6B7A]/10 text-[#FB6B7A] hover:bg-[#FB6B7A]/15 hover:text-[#FB6B7A]"
                          : "bg-[#020617] text-white hover:bg-[#020617]/90"
                      }`}
                    >
                      {action.icon}
                      {action.label}
                    </Button>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 rounded-3xl border border-[#E5EAF1] bg-[#F6F8FB] p-3">
              <StatusProgressBar currentStatus={order.order_status} />
            </div>

            {order.order_status !== "cancelled" && order.kitchen_items.length > 0 && (
              <KitchenItemFlow order={order} />
            )}

            {order.order_status === "cancelled" &&
              order.cancellation_reason && (
                <div className="mt-3 flex items-start gap-2 rounded-3xl border border-[#FB6B7A]/25 bg-[#FB6B7A]/10 p-3 text-sm font-medium text-[#FB6B7A]">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    <strong>Reason:</strong> {order.cancellation_reason}
                  </span>
                </div>
              )}

            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <div className="rounded-3xl border border-[#E5EAF1] bg-white p-3">
                <p className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                  Customer
                </p>
                {order.customer?.full_name ? (
                  <p className="font-black text-[#020617]">
                    {order.customer.full_name}
                  </p>
                ) : (
                  <p className="font-medium text-[#94A3B8]">
                    Customer details unavailable
                  </p>
                )}
                {order.customer?.phone && (
                  <p className="mt-1 flex items-center gap-1 text-sm font-medium text-[#64748B]">
                    <Phone className="h-3.5 w-3.5" />
                    {order.customer.phone}
                  </p>
                )}
                {order.addons.length > 0 && (
                  <p className="mt-2 text-xs font-bold text-[#64748B]">
                    {order.addons
                      .map((addon) => `${addon.addon_name} x${addon.quantity}`)
                      .join(", ")}
                  </p>
                )}
              </div>

              {order.delivery_address && (
                <div className="rounded-3xl border border-[#E5EAF1] bg-white p-3">
                  <p className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                    <MapPin className="h-4 w-4 text-[#38BDF8]" />
                    Delivery address
                  </p>
                  <p className="text-sm font-bold text-[#020617]">
                    {order.delivery_address.address_line1}
                    {order.delivery_address.address_line2 &&
                      `, ${order.delivery_address.address_line2}`}
                    {order.delivery_address.city &&
                      `, ${order.delivery_address.city}`}
                  </p>
                  {order.delivery_address.phone && (
                    <p className="mt-1 flex items-center gap-1 text-sm font-medium text-[#64748B]">
                      <Phone className="h-3.5 w-3.5" />
                      {order.delivery_address.phone}
                    </p>
                  )}
                  {order.delivery_address.delivery_instructions && (
                    <p className="mt-2 flex items-start gap-1 text-sm font-bold text-[#F97316]">
                      <Info className="mt-0.5 h-3.5 w-3.5" />
                      {order.delivery_address.delivery_instructions}
                    </p>
                  )}
                </div>
              )}
            </div>

            {order.restaurant_note && (
              <div className="mt-3 rounded-3xl border border-[#F97316]/25 bg-[#F97316]/10 p-3">
                <p className="mb-1 flex items-center gap-2 text-sm font-black text-[#020617]">
                  <MessageSquareText className="h-4 w-4 text-[#F97316]" />
                  Customer note for kitchen
                </p>
                <p className="whitespace-pre-wrap text-sm font-medium text-[#64748B]">
                  {order.restaurant_note}
                </p>
              </div>
            )}

            {(order.order_status === "ready" ||
              order.order_status === "out_for_delivery") && (
              <div className="mt-4 border-t border-[#E5EAF1] pt-4">
                <PartnerDeliveryHandoff
                  scheduleId={order.id}
                  source={order.source}
                  restaurantName={restaurantName}
                />
              </div>
            )}

            {showActions &&
              availableActions.length === 0 &&
              order.order_status === "out_for_delivery" && (
                <div className="mt-4 flex items-center gap-2 rounded-3xl bg-[#F6F8FB] p-3 text-sm font-bold text-[#64748B]">
                  <Truck className="h-4 w-4 text-[#020617]" />
                  <span>
                    Driver is delivering this order. No action needed.
                  </span>
                </div>
              )}
          </div>
        </article>
      );
    });
  };

  const renderPos = () => (
    <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
      <section className="rounded-[28px] border border-[#E5EAF1] bg-white p-4 shadow-[0_14px_36px_rgba(2,6,23,0.04)]">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#22C7A1]">
              Offline-first POS
            </p>
            <h2 className="mt-1 text-xl font-black text-[#020617]">Counter order</h2>
            <p className="mt-1 text-sm font-semibold text-[#64748B]">
              Create walk-in tickets even when the connection drops.
            </p>
          </div>
          <div className={`inline-flex h-10 items-center gap-2 rounded-2xl px-3 text-xs font-black ${
            isOnline
              ? "bg-[#22C7A1]/10 text-[#0B9B7E]"
              : "bg-[#F97316]/10 text-[#F97316]"
          }`}>
            {isOnline ? <CheckCircle className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
            {isOnline ? "Online" : "Offline mode"}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {posMenuItems.map((meal) => (
            <button
              key={meal.id}
              type="button"
              onClick={() => addPosItem(meal)}
              className="group flex min-h-[118px] flex-col justify-between rounded-3xl border border-[#E5EAF1] bg-[#F6F8FB] p-3 text-left transition hover:border-[#7C83F6]/40 hover:bg-white hover:shadow-[0_16px_36px_rgba(2,6,23,0.06)]"
            >
              <div className="flex items-start gap-3">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-2xl bg-white">
                  {meal.image_url ? (
                    <img src={meal.image_url} alt={meal.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Utensils className="h-5 w-5 text-[#94A3B8]" />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="line-clamp-2 text-sm font-black leading-5 text-[#020617]">{meal.name}</p>
                  <p className="mt-1 text-xs font-bold text-[#64748B]">{formatCurrency(Number(meal.price || 0))}</p>
                </div>
              </div>
              <span className="mt-3 inline-flex h-9 items-center justify-center rounded-2xl bg-white text-xs font-black text-[#020617] ring-1 ring-[#E5EAF1] group-hover:bg-[#020617] group-hover:text-white">
                <Plus className="mr-1 h-4 w-4" />
                Add
              </span>
            </button>
          ))}
        </div>
      </section>

      <aside className="space-y-4">
        <section className="rounded-[28px] border border-[#E5EAF1] bg-white p-4 shadow-[0_14px_36px_rgba(2,6,23,0.04)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#7C83F6]">Ticket</p>
              <h2 className="mt-1 text-xl font-black text-[#020617]">{formatCurrency(posTotal)}</h2>
            </div>
            <span className="flex h-12 w-12 items-center justify-center rounded-3xl bg-[#020617] text-white">
              <ShoppingCart className="h-5 w-5" />
            </span>
          </div>

          <div className="space-y-2">
            {posCart.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-[#E5EAF1] bg-[#F6F8FB] p-5 text-center">
                <p className="text-sm font-black text-[#020617]">No items yet</p>
                <p className="mt-1 text-xs font-semibold text-[#94A3B8]">Tap meals to build a counter ticket.</p>
              </div>
            ) : (
              posCart.map((item) => (
                <div key={item.meal.id} className="rounded-3xl border border-[#E5EAF1] bg-[#F6F8FB] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-[#020617]">{item.meal.name}</p>
                      <p className="mt-1 text-xs font-bold text-[#64748B]">
                        {formatCurrency(Number(item.meal.price || 0))} x {item.quantity}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => changePosQuantity(item.meal.id, -item.quantity)}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white text-[#FB6B7A] ring-1 ring-[#E5EAF1]"
                      aria-label="Remove item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => changePosQuantity(item.meal.id, -1)}
                      className="h-9 w-9 rounded-2xl border-[#E5EAF1] bg-white"
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="flex h-9 min-w-12 items-center justify-center rounded-2xl bg-white px-3 text-sm font-black text-[#020617] ring-1 ring-[#E5EAF1]">
                      {item.quantity}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => changePosQuantity(item.meal.id, 1)}
                      className="h-9 w-9 rounded-2xl border-[#E5EAF1] bg-white"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-4 grid gap-2">
            <Input
              value={posCustomerName}
              onChange={(event) => setPosCustomerName(event.target.value)}
              placeholder="Customer name optional"
              className="h-12 rounded-2xl border-[#E5EAF1] bg-[#F6F8FB] font-semibold"
            />
            <Input
              value={posPhoneNumber}
              onChange={(event) => setPosPhoneNumber(event.target.value)}
              placeholder="Phone optional"
              className="h-12 rounded-2xl border-[#E5EAF1] bg-[#F6F8FB] font-semibold"
            />
            <Input
              value={posNotes}
              onChange={(event) => setPosNotes(event.target.value)}
              placeholder="Kitchen note optional"
              className="h-12 rounded-2xl border-[#E5EAF1] bg-[#F6F8FB] font-semibold"
            />
          </div>

          <Button
            type="button"
            onClick={createPosOrder}
            disabled={posCart.length === 0}
            className="mt-4 h-12 w-full rounded-2xl bg-[#020617] font-black text-white hover:bg-[#020617]/90"
          >
            {isOnline ? "Send to kitchen" : "Save offline ticket"}
          </Button>
        </section>

        <section className="rounded-[28px] border border-[#E5EAF1] bg-white p-4 shadow-[0_14px_36px_rgba(2,6,23,0.04)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#F97316]">Sync queue</p>
              <p className="mt-1 text-lg font-black text-[#020617]">{pendingPosOrders.length} pending</p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={syncPendingPosOrders}
              disabled={posSyncing || pendingPosOrders.length === 0 || !isOnline}
              className="h-10 rounded-2xl border-[#E5EAF1] bg-white px-4 font-black"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${posSyncing ? "animate-spin" : ""}`} />
              Sync
            </Button>
          </div>
          {pendingPosOrders.length > 0 && (
            <div className="mt-3 space-y-2">
              {pendingPosOrders.slice(0, 4).map((ticket) => (
                <div key={ticket.id} className="rounded-2xl bg-[#F6F8FB] px-3 py-2">
                  <p className="text-xs font-black text-[#020617]">POS-{ticket.id.slice(0, 8).toUpperCase()}</p>
                  <p className="mt-0.5 text-[11px] font-semibold text-[#64748B]">
                    {ticket.payload.items.length} item group{ticket.payload.items.length === 1 ? "" : "s"} - {formatCurrency(ticket.payload.totalAmount)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </aside>
    </div>
  );

  return (
    <PartnerLayout title="Orders">
      <div className="-m-6 min-h-screen bg-[#F6F8FB] p-4 text-[#020617] sm:p-6">
        <div className="mx-auto max-w-7xl space-y-4">
          <section className="overflow-hidden rounded-[28px] border border-[#E5EAF1] bg-white shadow-[0_22px_70px_rgba(2,6,23,0.06)]">
            <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between lg:p-5">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl bg-[#020617] text-white">
                  <Package className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[#22C7A1]">
                    Partner orders
                  </p>
                  <h1 className="mt-1 text-2xl font-black tracking-tight text-[#020617]">
                    Today's kitchen flow
                  </h1>
                  <p className="mt-1 max-w-2xl text-sm font-medium text-[#64748B]">
                    {activeOrders.length} active - {completedOrders.length}{" "}
                    completed - Updated {lastUpdate.toLocaleTimeString()}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={handleRefresh}
                disabled={refreshing}
                className="h-12 rounded-2xl border-[#E5EAF1] bg-white px-5 font-black text-[#020617] hover:bg-[#F6F8FB]"
              >
                <RefreshCw
                  className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
                />
                {refreshing ? "Refreshing" : "Refresh"}
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3 border-t border-[#E5EAF1] bg-[#F6F8FB] p-4 lg:grid-cols-4">
              {[
                {
                  label: "Active",
                  value: activeOrders.length,
                  icon: CircleDot,
                  color: "#7C83F6",
                  bg: "bg-[#7C83F6]/10",
                },
                {
                  label: "Pending",
                  value: pendingOrders,
                  icon: Clock,
                  color: "#F97316",
                  bg: "bg-[#F97316]/10",
                },
                {
                  label: "Preparing",
                  value: preparingOrders,
                  icon: ChefHat,
                  color: "#22C7A1",
                  bg: "bg-[#22C7A1]/10",
                },
                {
                  label: "Ready",
                  value: readyOrders,
                  icon: Box,
                  color: "#38BDF8",
                  bg: "bg-[#38BDF8]/10",
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-3xl border border-[#E5EAF1] bg-white p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.12em] text-[#94A3B8]">
                        {stat.label}
                      </p>
                      <p className="mt-2 text-2xl font-black text-[#020617]">
                        {stat.value}
                      </p>
                    </div>
                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-2xl ${stat.bg}`}
                    >
                      <stat.icon
                        className="h-5 w-5"
                        style={{ color: stat.color }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid h-auto grid-cols-2 gap-2 rounded-[28px] border border-[#E5EAF1] bg-white p-2 shadow-[0_14px_36px_rgba(2,6,23,0.04)] md:grid-cols-4">
              {[
                {
                  value: "active",
                  label: "Active",
                  count: activeOrders.length,
                },
                {
                  value: "pos",
                  label: "POS",
                  count: pendingPosOrders.length,
                },
                {
                  value: "completed",
                  label: "Completed",
                  count: completedOrders.length,
                },
                {
                  value: "cancelled",
                  label: "Cancelled",
                  count: cancelledOrders.length,
                },
              ].map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="min-h-14 rounded-3xl text-sm font-black text-[#64748B] data-[state=active]:bg-[#020617] data-[state=active]:text-white"
                >
                  <span>{tab.label}</span>
                  {tab.count > 0 && (
                    <span className="ml-2 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-white px-2 text-xs font-black text-[#020617]">
                      {tab.count}
                    </span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="active" className="mt-4 space-y-4">
              {renderOrders(activeOrders, true)}
            </TabsContent>
            <TabsContent value="pos" className="mt-4">
              {renderPos()}
            </TabsContent>
            <TabsContent value="completed" className="mt-4 space-y-4">
              {renderOrders(completedOrders)}
            </TabsContent>
            <TabsContent value="cancelled" className="mt-4 space-y-4">
              {renderOrders(cancelledOrders)}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </PartnerLayout>
  );
};

export default PartnerOrders;
