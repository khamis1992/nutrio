import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import {
  AdminAlertDialogContent,
  AdminFilterBar,
  AdminKpiStrip,
  AdminPanel,
  AdminSheetContent,
  AdminWorkbenchHeader,
} from "@/components/admin/AdminPrimitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
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
  LayoutGrid,
  LayoutList,
  Maximize2,
  ClipboardList,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { downloadCsv } from "@/lib/csv";
import { formatCurrency } from "@/lib/currency";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { getQatarDay } from "@/lib/dateUtils";

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
const STATUS_CONFIG: Record<
  OrderStatus,
  {
    label: string;
    color: string;
    bgColor: string;
  }
> = {
  pending: {
    label: "In progress",
    color: "text-[#38BDF8]",
    bgColor: "bg-[#38BDF8]/10 border-[#38BDF8]/25",
  },
  confirmed: {
    label: "In progress",
    color: "text-[#38BDF8]",
    bgColor: "bg-[#38BDF8]/10 border-[#38BDF8]/25",
  },
  preparing: {
    label: "In progress",
    color: "text-[#7C83F6]",
    bgColor: "bg-[#7C83F6]/10 border-[#7C83F6]/25",
  },
  ready: {
    label: "In progress",
    color: "text-[#22C7A1]",
    bgColor: "bg-[#22C7A1]/10 border-[#22C7A1]/25",
  },
  out_for_delivery: {
    label: "In progress",
    color: "text-[#38BDF8]",
    bgColor: "bg-[#38BDF8]/10 border-[#38BDF8]/25",
  },
  delivered: {
    label: "Completed",
    color: "text-[#22C7A1]",
    bgColor: "bg-[#22C7A1]/10 border-[#22C7A1]/25",
  },
  completed: {
    label: "Completed",
    color: "text-[#22C7A1]",
    bgColor: "bg-[#22C7A1]/10 border-[#22C7A1]/25",
  },
  cancelled: {
    label: "Cancelled",
    color: "text-[#FB6B7A]",
    bgColor: "bg-[#FB6B7A]/10 border-[#FB6B7A]/25",
  },
};

// Original detailed status config for the table view and detail sheet
const STATUS_CONFIG_DETAILED: Record<
  OrderStatus,
  {
    label: string;
    color: string;
    bgColor: string;
  }
> = {
  pending: {
    label: "Pending",
    color: "text-[#38BDF8]",
    bgColor: "bg-[#38BDF8]/10 border-[#38BDF8]/25",
  },
  confirmed: {
    label: "Confirmed",
    color: "text-[#38BDF8]",
    bgColor: "bg-[#38BDF8]/10 border-[#38BDF8]/25",
  },
  preparing: {
    label: "Preparing",
    color: "text-[#7C83F6]",
    bgColor: "bg-[#7C83F6]/10 border-[#7C83F6]/25",
  },
  ready: {
    label: "Ready",
    color: "text-[#22C7A1]",
    bgColor: "bg-[#22C7A1]/10 border-[#22C7A1]/25",
  },
  out_for_delivery: {
    label: "Out for Delivery",
    color: "text-[#38BDF8]",
    bgColor: "bg-[#38BDF8]/10 border-[#38BDF8]/25",
  },
  delivered: {
    label: "Delivered",
    color: "text-[#22C7A1]",
    bgColor: "bg-[#22C7A1]/10 border-[#22C7A1]/25",
  },
  completed: {
    label: "Completed",
    color: "text-[#22C7A1]",
    bgColor: "bg-[#22C7A1]/10 border-[#22C7A1]/25",
  },
  cancelled: {
    label: "Cancelled",
    color: "text-[#FB6B7A]",
    bgColor: "bg-[#FB6B7A]/10 border-[#FB6B7A]/25",
  },
};

interface OrderData {
  id: string;
  source: "order" | "meal_schedule";
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
      commission_rate: number;
    };
  };
  profile: {
    full_name: string | null;
    email?: string;
  } | null;
}

// Short badge ID from order UUID (e.g. "A-1F")
const getOrderBadge = (id: string) => id.substring(0, 4).toUpperCase();

// ---- Order Card (grid view) ----
interface OrderCardProps {
  order: OrderData;
  isSelected: boolean;
  onSelect: () => void;
  onViewDetails: () => void;
}

const OrderCard = ({
  order,
  isSelected,
  onSelect,
  onViewDetails,
}: OrderCardProps) => {
  const statusCfg = STATUS_CONFIG[order.order_status];
  const isFinished =
    order.order_status === "completed" ||
    order.order_status === "delivered" ||
    order.order_status === "cancelled";

  let dateLabel = "";
  let timeLabel = "";
  try {
    const d = new Date(order.scheduled_date);
    dateLabel = format(d, "EEE, MMM d, yyyy");
    // Only show time if the date string includes a time component
    if (
      order.scheduled_date.includes("T") ||
      order.scheduled_date.includes(" ")
    ) {
      timeLabel = format(d, "hh:mm aa");
    }
  } catch {
    dateLabel = order.scheduled_date;
  }

  return (
    <div
      data-testid={`admin-order-${order.id}`}
      data-order-source={order.source}
      className={cn(
        "relative flex flex-col gap-4 rounded-[28px] border border-[#E5EAF1] bg-white p-4 shadow-[0_14px_34px_rgba(2,6,23,0.05)] transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_45px_rgba(2,6,23,0.08)] sm:p-5",
        isSelected && "border-[#22C7A1] ring-2 ring-[#22C7A1]/20",
      )}
    >
      {/* Selection checkbox */}
      <div className="absolute top-4 right-4">
        <Checkbox checked={isSelected} onCheckedChange={onSelect} />
      </div>

      {/* Top row: badge + name + status */}
      <div className="flex items-start gap-3 pr-8">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-[#22C7A1]/12">
          <span className="text-xs font-black leading-none text-[#22C7A1]">
            {getOrderBadge(order.id)}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="truncate text-base font-black text-[#020617]">
            {order.profile?.full_name || "Customer"}
          </p>
          <p className="mt-0.5 text-xs font-bold text-[#94A3B8]">
            Order #{order.id.substring(0, 8).toUpperCase()}
          </p>
        </div>
        <Badge
          variant="outline"
          className={`min-h-8 shrink-0 rounded-full border px-3 py-1 text-xs font-extrabold ${statusCfg.bgColor} ${statusCfg.color}`}
        >
          {statusCfg.label}
        </Badge>
      </div>

      {/* Date / time row */}
      <div className="flex items-center justify-between rounded-2xl bg-[#F6F8FB] px-3 py-2 text-sm font-bold text-[#94A3B8]">
        <span>{dateLabel}</span>
        {timeLabel && (
          <span className="font-black text-[#020617]">{timeLabel}</span>
        )}
      </div>

      {/* Items mini-table */}
      <div>
        <div className="mb-1 grid grid-cols-[1fr_auto_auto] gap-x-3 px-0.5 text-xs font-extrabold uppercase tracking-[0.08em] text-[#94A3B8]">
          <span>Items</span>
          <span>Qty</span>
          <span>Price</span>
        </div>
        <div className="divide-y divide-[#E5EAF1]">
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 text-sm py-1.5 px-0.5">
            <span className="truncate font-bold text-[#020617]">
              {order.meal.name}
            </span>
            <span className="text-center font-bold text-[#94A3B8]">1</span>
            <span className="text-right font-black text-[#020617]">
              {formatCurrency(order.meal.price)}
            </span>
          </div>
        </div>
      </div>

      {/* Total row */}
      <div className="flex items-center justify-between border-t border-[#E5EAF1] pt-1">
        <span className="text-sm font-bold text-[#94A3B8]">
          Total{" "}
          <span className="text-xs font-bold text-[#94A3B8]">(before tax)</span>
        </span>
        <span className="font-black text-[#020617]">
          {formatCurrency(order.meal.price)}
        </span>
      </div>

      {/* Footer: item count + action */}
      <div className="flex items-center justify-between">
        <button
          onClick={onViewDetails}
          className="flex min-h-11 items-center gap-1.5 rounded-2xl px-1 text-sm font-bold text-[#94A3B8] transition-colors hover:text-[#020617]"
        >
          <span>1 item</span>
          <Maximize2 className="w-3.5 h-3.5" />
        </button>

        {isFinished ? (
          order.order_status === "cancelled" ? (
            <span className="text-sm font-black text-[#FB6B7A]">Cancelled</span>
          ) : (
            <span className="text-sm font-black text-[#22C7A1]">Paid</span>
          )
        ) : (
          <Button
            variant="outline"
            className="h-11 rounded-2xl border-[#22C7A1]/30 bg-[#22C7A1]/10 px-4 text-sm font-extrabold text-[#020617] hover:bg-[#22C7A1]/15"
            onClick={onViewDetails}
          >
            Pay bill
          </Button>
        )}
      </div>
    </div>
  );
};

// ---- Main page ----
const AdminOrders = () => {
  const { toast } = useToast();
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [selectedOrder, setSelectedOrder] = useState<OrderData | null>(null);
  const [orderPendingCancel, setOrderPendingCancel] =
    useState<OrderData | null>(null);
  const [activeTab, setActiveTab] = useState<
    "all" | "today" | "upcoming" | "completed" | "overdue"
  >("all");
  const [sortField, setSortField] = useState<
    "created_at" | "scheduled_date" | "meal_name"
  >("created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const today = getQatarDay();

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("admin-orders-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "meal_schedules" },
        () => {
          fetchOrders();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          fetchOrders();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const [schedulesResult, activeSchedulesResult, directOrdersResult] =
        await Promise.all([
          supabase
            .from("meal_schedules")
            .select(
              `
          id,
          scheduled_date,
          meal_type,
          is_completed,
          order_status,
          created_at,
          user_id,
          meal_id
        `,
            )
            .order("created_at", { ascending: false })
            .limit(100),
          supabase
            .from("meal_schedules")
            .select(
              `
          id,
          scheduled_date,
          meal_type,
          is_completed,
          order_status,
          created_at,
          user_id,
          meal_id
        `,
            )
            .eq("is_completed", false)
            .in("order_status", [
              "confirmed",
              "preparing",
              "ready",
              "out_for_delivery",
            ])
            .order("created_at", { ascending: false }),
          supabase
            .from("orders")
            .select(
              "id, created_at, status, user_id, meal_id, restaurant_id, total_amount",
            )
            .order("created_at", { ascending: false })
            .limit(100),
        ]);

      const { data: recentSchedules, error: schedulesError } = schedulesResult;
      const { data: activeSchedules, error: activeSchedulesError } =
        activeSchedulesResult;
      const { data: directOrders, error: directOrdersError } =
        directOrdersResult;

      if (schedulesError) throw schedulesError;
      if (activeSchedulesError) throw activeSchedulesError;
      if (directOrdersError) throw directOrdersError;

      const activeScheduleIds = new Set(
        (activeSchedules || []).map((schedule) => schedule.id),
      );
      const schedulesData = [
        ...(activeSchedules || []),
        ...(recentSchedules || []).filter(
          (schedule) => !activeScheduleIds.has(schedule.id),
        ),
      ];

      const mealIds = [
        ...new Set(
          [
            ...(schedulesData || []).map((o) => o.meal_id),
            ...(directOrders || []).map((o) => o.meal_id),
          ].filter((mealId): mealId is string => typeof mealId === "string"),
        ),
      ];
      let mealsMap: Record<
        string,
        { name: string; price: number; restaurant_id: string }
      > = {};

      if (mealIds.length > 0) {
        const { data: meals } = await supabase
          .from("meals")
          .select("id, name, price, restaurant_id")
          .in("id", mealIds);

        if (meals) {
          mealsMap = meals.reduce(
            (acc, m) => {
              acc[m.id] = {
                name: m.name,
                price: m.price || 0,
                restaurant_id: m.restaurant_id || "",
              };
              return acc;
            },
            {} as Record<
              string,
              { name: string; price: number; restaurant_id: string }
            >,
          );
        }
      }

      const restaurantIds = [
        ...new Set(
          Object.values(mealsMap)
            .map((m) => m.restaurant_id)
            .concat((directOrders || []).map((o) => o.restaurant_id || ""))
            .filter(Boolean),
        ),
      ];
      let restaurantsMap: Record<
        string,
        { name: string; commission_rate: number }
      > = {};

      if (restaurantIds.length > 0) {
        const { data: restaurants } = await supabase
          .from("restaurants")
          .select("id, name, commission_rate")
          .in("id", restaurantIds);

        if (restaurants) {
          restaurantsMap = restaurants.reduce(
            (acc, r) => {
              acc[r.id] = {
                name: r.name,
                commission_rate: r.commission_rate ?? 18,
              };
              return acc;
            },
            {} as Record<string, { name: string; commission_rate: number }>,
          );
        }
      }

      const userIds = [
        ...new Set([
          ...(schedulesData || []).map((o) => o.user_id),
          ...((directOrders || [])
            .map((o) => o.user_id)
            .filter(Boolean) as string[]),
        ]),
      ];
      let profilesMap: Record<
        string,
        { full_name: string | null; email?: string }
      > = {};

      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", userIds);

        if (profiles) {
          profilesMap = profiles.reduce(
            (acc, p: { user_id: string; full_name: string | null }) => {
              acc[p.user_id] = { full_name: p.full_name };
              return acc;
            },
            {} as Record<string, { full_name: string | null }>,
          );
        }
      }

      const ordersWithDetails: OrderData[] = (schedulesData || []).map((o) => {
        const meal = mealsMap[o.meal_id] || {
          name: "Unknown",
          price: 0,
          restaurant_id: "",
        };
        const restaurant = restaurantsMap[meal.restaurant_id] || {
          name: "Unknown",
          commission_rate: 18,
        };

        return {
          id: o.id,
          source: "meal_schedule",
          scheduled_date: o.scheduled_date,
          meal_type: o.meal_type,
          order_status: (o.order_status || "pending") as OrderStatus,
          is_completed: o.is_completed ?? false,
          created_at: o.created_at || new Date(0).toISOString(),
          meal: {
            name: meal.name,
            price: meal.price,
            restaurant: {
              name: restaurant.name,
              commission_rate: restaurant.commission_rate,
            },
          },
          profile: profilesMap[o.user_id] || null,
        };
      });

      const directOrdersWithDetails: OrderData[] = (directOrders || []).map(
        (o) => {
          const meal = o.meal_id ? mealsMap[o.meal_id] : null;
          const restaurantId = o.restaurant_id || meal?.restaurant_id || "";
          const normalizedStatus =
            o.status === "ready_for_pickup"
              ? "ready"
              : o.status === "picked_up"
                ? "out_for_delivery"
                : o.status;

          return {
            id: o.id,
            source: "order",
            scheduled_date: getQatarDay(new Date(o.created_at)),
            meal_type: "order",
            order_status: normalizedStatus as OrderStatus,
            is_completed: o.status === "completed" || o.status === "delivered",
            created_at: o.created_at,
            meal: {
              name: meal?.name || "Order",
              price: o.total_amount || meal?.price || 0,
              restaurant: {
                name: restaurantsMap[restaurantId]?.name || "Unknown",
                commission_rate:
                  restaurantsMap[restaurantId]?.commission_rate ?? 18,
              },
            },
            profile: o.user_id ? profilesMap[o.user_id] || null : null,
          };
        },
      );

      setOrders(
        [...ordersWithDetails, ...directOrdersWithDetails].sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        ),
      );
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
    const headers = [
      "Order ID",
      "Meal",
      "Restaurant",
      "Customer",
      "Meal Type",
      "Meal Price (QAR)",
      "Platform Fee (QAR)",
      "Restaurant Payout (QAR)",
      "Scheduled Date",
      "Status",
      "Created At",
    ];
    const rows = filteredOrders.map((o) => [
      o.id,
      o.meal.name,
      o.meal.restaurant.name,
      o.profile?.full_name || "Customer",
      o.meal_type,
      o.meal.price.toFixed(2),
      (o.meal.price * (o.meal.restaurant.commission_rate / 100)).toFixed(2),
      (o.meal.price * (1 - o.meal.restaurant.commission_rate / 100)).toFixed(2),
      o.scheduled_date,
      STATUS_CONFIG_DETAILED[o.order_status]?.label || o.order_status,
      format(new Date(o.created_at), "yyyy-MM-dd HH:mm"),
    ]);

    downloadCsv(
      [headers, ...rows],
      `orders-export-${format(new Date(), "yyyy-MM-dd")}.csv`,
    );

    toast({
      title: "Export Complete",
      description: `${rows.length} orders exported to CSV.`,
    });
  };

  const cancelOrder = async (orderId: string) => {
    try {
      const order = orders.find((item) => item.id === orderId);
      if (!order) throw new Error("Order not found");

      const { data, error } = await supabase.rpc("admin_update_order_status", {
        p_source: order.source,
        p_order_id: orderId,
        p_new_status: "cancelled",
        p_reason: undefined,
      });

      if (error) throw error;
      const result = data as { success?: boolean; error?: string } | null;
      if (!result?.success)
        throw new Error(result?.error || "Cancellation failed.");

      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? { ...o, order_status: "cancelled" as OrderStatus }
            : o,
        ),
      );

      if (selectedOrder?.id === orderId) {
        setSelectedOrder((prev) =>
          prev ? { ...prev, order_status: "cancelled" as OrderStatus } : null,
        );
      }

      toast({
        title: "Order Cancelled",
        description:
          "The order has been cancelled. meal credit and add-ons refunded.",
      });
    } catch (error: unknown) {
      console.error("Error cancelling order:", error);
      const message =
        error instanceof Error ? error.message : "Failed to cancel order";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    }
  };

  const handleBulkCancel = async () => {
    const ids = Array.from(selectedOrders);
    let successCount = 0;
    for (const id of ids) {
      try {
        const selected = orders.find((order) => order.id === id);
        if (!selected) continue;
        const { data, error } = await supabase.rpc(
          "admin_update_order_status",
          {
            p_source: selected.source,
            p_order_id: id,
            p_new_status: "cancelled",
            p_reason: undefined,
          },
        );
        const result = data as { success?: boolean } | null;
        if (!error && result?.success) {
          successCount++;
          setOrders((prev) =>
            prev.map((o) =>
              o.id === id
                ? { ...o, order_status: "cancelled" as OrderStatus }
                : o,
            ),
          );
        }
      } catch {
        // Silently skip
      }
    }
    setSelectedOrders(new Set());
    toast({
      title: "Bulk Cancel",
      description: `${successCount} of ${ids.length} orders cancelled.`,
    });
  };

  const handleBulkComplete = async () => {
    const ids = Array.from(selectedOrders);
    let successCount = 0;
    for (const id of ids) {
      try {
        const selected = orders.find((order) => order.id === id);
        if (selected?.order_status !== "delivered") continue;

        const { error } = await supabase.rpc("admin_update_order_status", {
          p_source: selected.source,
          p_order_id: id,
          p_new_status: "completed",
          p_reason: undefined,
        });
        if (!error) {
          successCount++;
          setOrders((prev) =>
            prev.map((o) =>
              o.id === id
                ? { ...o, order_status: "completed" as OrderStatus }
                : o,
            ),
          );
        }
      } catch {
        // Silently skip
      }
    }
    setSelectedOrders(new Set());
    toast({
      title: "Bulk Complete",
      description: `${successCount} of ${ids.length} orders marked as completed.`,
    });
  };

  const filteredOrders = orders
    .filter((o) => {
      const matchesSearch =
        !searchQuery ||
        o.meal.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.meal.restaurant.name
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        o.profile?.full_name?.toLowerCase().includes(searchQuery.toLowerCase());

      if (activeTab === "all") return matchesSearch;
      if (activeTab === "today")
        return matchesSearch && o.scheduled_date === today;
      if (activeTab === "upcoming")
        return (
          matchesSearch &&
          o.order_status !== "completed" &&
          o.order_status !== "cancelled" &&
          o.scheduled_date >= today
        );
      if (activeTab === "completed")
        return matchesSearch && o.order_status === "completed";
      if (activeTab === "overdue")
        return (
          matchesSearch &&
          o.order_status !== "completed" &&
          o.order_status !== "cancelled" &&
          o.scheduled_date < today
        );

      return matchesSearch;
    })
    .sort((a, b) => {
      let comparison = 0;
      if (sortField === "created_at") {
        comparison =
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else if (sortField === "scheduled_date") {
        comparison =
          new Date(a.scheduled_date).getTime() -
          new Date(b.scheduled_date).getTime();
      } else if (sortField === "meal_name") {
        comparison = a.meal.name.localeCompare(b.meal.name);
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

  const getDetailStatusBadge = (order: OrderData) => {
    const config = STATUS_CONFIG_DETAILED[order.order_status];
    return (
      <Badge
        variant="outline"
        className={
          config?.bgColor || "border-[#E5EAF1] bg-[#F6F8FB] text-[#94A3B8]"
        }
      >
        <CheckCircle className="h-3 w-3 mr-1" />
        {config?.label || order.order_status}
      </Badge>
    );
  };

  const stats = {
    total: orders.length,
    today: orders.filter((o) => o.scheduled_date === today).length,
    upcoming: orders.filter(
      (o) =>
        o.order_status !== "completed" &&
        o.order_status !== "cancelled" &&
        o.scheduled_date >= today,
    ).length,
    completed: orders.filter((o) => o.order_status === "completed").length,
    cancelled: orders.filter((o) => o.order_status === "cancelled").length,
    overdue: orders.filter(
      (o) =>
        o.order_status !== "completed" &&
        o.order_status !== "cancelled" &&
        o.scheduled_date < today,
    ).length,
    totalRevenue: orders
      .filter(
        (o) => o.order_status === "completed" || o.order_status === "delivered",
      )
      .reduce(
        (sum, order) =>
          sum +
          order.meal.price * (order.meal.restaurant.commission_rate / 100),
        0,
      ),
  };

  const openDetail = (order: OrderData) => {
    setSelectedOrder(order);
    setIsDetailOpen(true);
  };

  const requestCancelOrder = (order: OrderData) => {
    setOrderPendingCancel(order);
  };

  const confirmCancelOrder = async () => {
    if (!orderPendingCancel) return;
    const orderId = orderPendingCancel.id;
    setOrderPendingCancel(null);
    await cancelOrder(orderId);
  };

  return (
    <AdminLayout
      title="Order Management"
      subtitle={`${stats.total} total orders`}
    >
      <div className="space-y-4 bg-[#F6F8FB] text-[#020617] sm:space-y-5">
        <AdminWorkbenchHeader
          eyebrow="Operations queue"
          title="Order command desk"
          icon={ClipboardList}
          accent="#22C7A1"
          description="Track meal schedules, delivery readiness, overdue work, cancellations, and platform fees without jumping between reports."
          meta={[
            { label: "Today", value: stats.today },
            { label: "Upcoming", value: stats.upcoming },
            { label: "Overdue", value: stats.overdue },
          ]}
          actions={
            <>
              <Button
                variant="outline"
                onClick={exportToCSV}
                className="h-11 rounded-[14px] border-[#E5EAF1] bg-white px-4 font-black text-[#020617] hover:bg-[#F6F8FB]"
              >
                <Download className="mr-2 h-4 w-4 text-[#38BDF8]" />
                Export
              </Button>
              <Button
                variant="outline"
                onClick={fetchOrders}
                disabled={loading}
                className="h-11 rounded-[14px] border-[#E5EAF1] bg-white px-4 font-black text-[#020617] hover:bg-[#F6F8FB]"
              >
                <RefreshCw
                  className={`mr-2 h-4 w-4 text-[#22C7A1] ${
                    loading ? "animate-spin" : ""
                  }`}
                />
                Refresh
              </Button>
            </>
          }
        />

        <AdminKpiStrip
          className="2xl:grid-cols-5"
          items={[
            {
              label: "Total Orders",
              value: stats.total,
              helper: "All schedule records",
              icon: ShoppingBag,
              accent: "#22C7A1",
            },
            {
              label: "Today",
              value: stats.today,
              helper: "Due in the current day",
              icon: Calendar,
              accent: "#38BDF8",
            },
            {
              label: "Completed",
              value: stats.completed,
              helper: "Closed successfully",
              icon: CheckCircle,
              accent: "#22C7A1",
            },
            {
              label: "Overdue",
              value: stats.overdue,
              helper: "Needs operator review",
              icon: Clock,
              accent: "#FB6B7A",
            },
            {
              label: "Platform fees",
              value: formatCurrency(stats.totalRevenue),
              helper: "Collected from completed work",
              icon: DollarSign,
              accent: "#7C83F6",
            },
          ]}
        />

        <div className="flex gap-2 overflow-x-auto rounded-[18px] border border-[#E5EAF1] bg-white p-2 shadow-[0_10px_28px_rgba(2,6,23,0.035)]">
          {[
            { value: "all", label: "All", count: stats.total },
            { value: "today", label: "Today", count: stats.today },
            { value: "upcoming", label: "Upcoming", count: stats.upcoming },
            {
              value: "completed",
              label: "Completed",
              count: stats.completed,
            },
            { value: "overdue", label: "Overdue", count: stats.overdue },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() =>
                setActiveTab(
                  tab.value as
                    | "all"
                    | "today"
                    | "upcoming"
                    | "completed"
                    | "overdue",
                )
              }
              className={`min-h-11 shrink-0 rounded-[14px] border px-4 text-sm font-extrabold transition-colors ${
                activeTab === tab.value
                  ? "border-[#22C7A1]/30 bg-[#22C7A1]/10 text-[#020617]"
                  : "border-transparent bg-[#F6F8FB] text-[#94A3B8] hover:border-[#E5EAF1] hover:text-[#020617]"
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-2 rounded-full border border-[#E5EAF1] bg-white text-xs text-[#020617]"
                >
                  {tab.count}
                </Badge>
              )}
            </button>
          ))}
        </div>

        <AdminFilterBar title="Order queue">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {/* Left: title + search */}
            <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
                <Input
                  placeholder="Search by meal, restaurant, or customer..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-12 rounded-2xl border-[#E5EAF1] bg-[#F6F8FB] pl-11 text-sm font-bold text-[#020617] placeholder:text-[#94A3B8]"
                />
              </div>
            </div>

            {/* Right: view toggle + sort + export + refresh */}
            <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:shrink-0">
              {/* View toggle */}
              <div className="flex min-h-[52px] items-center overflow-hidden rounded-2xl border border-[#E5EAF1] bg-[#F6F8FB] p-1">
                <button
                  onClick={() => setViewMode("list")}
                  className={`grid h-11 w-11 place-items-center rounded-[14px] transition-colors ${
                    viewMode === "list"
                      ? "bg-white text-[#22C7A1] shadow-sm"
                      : "text-[#94A3B8] hover:bg-white"
                  }`}
                  title="List view"
                >
                  <LayoutList className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode("grid")}
                  className={`grid h-11 w-11 place-items-center rounded-[14px] transition-colors ${
                    viewMode === "grid"
                      ? "bg-white text-[#22C7A1] shadow-sm"
                      : "text-[#94A3B8] hover:bg-white"
                  }`}
                  title="Grid view"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
              </div>

              {/* Sort dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-11 rounded-2xl border-[#E5EAF1] bg-white font-extrabold text-[#020617]"
                  >
                    Sort by
                    <ChevronDown className="w-3.5 h-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="rounded-[18px] border-[#E5EAF1] bg-white text-[#020617] shadow-[0_18px_42px_rgba(2,6,23,0.12)]"
                >
                  <DropdownMenuItem
                    onClick={() => handleSort("created_at")}
                    className={sortField === "created_at" ? "font-medium" : ""}
                  >
                    Created At
                    {sortField === "created_at" &&
                      (sortDirection === "asc" ? (
                        <ChevronUp className="ml-2 w-3 h-3" />
                      ) : (
                        <ChevronDown className="ml-2 w-3 h-3" />
                      ))}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleSort("scheduled_date")}
                    className={
                      sortField === "scheduled_date" ? "font-medium" : ""
                    }
                  >
                    Scheduled Date
                    {sortField === "scheduled_date" &&
                      (sortDirection === "asc" ? (
                        <ChevronUp className="ml-2 w-3 h-3" />
                      ) : (
                        <ChevronDown className="ml-2 w-3 h-3" />
                      ))}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleSort("meal_name")}
                    className={sortField === "meal_name" ? "font-medium" : ""}
                  >
                    Meal Name
                    {sortField === "meal_name" &&
                      (sortDirection === "asc" ? (
                        <ChevronUp className="ml-2 w-3 h-3" />
                      ) : (
                        <ChevronDown className="ml-2 w-3 h-3" />
                      ))}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Export */}
              <Button
                variant="outline"
                size="sm"
                onClick={exportToCSV}
                className="h-11 rounded-2xl border-[#E5EAF1] bg-white font-extrabold text-[#020617]"
              >
                <Download className="w-4 h-4" />
                Export
              </Button>

              {/* Refresh */}
              <Button
                variant="outline"
                size="icon"
                onClick={fetchOrders}
                disabled={loading}
                aria-label="Refresh orders"
                className="h-11 w-11 rounded-2xl border-[#E5EAF1] bg-white text-[#020617]"
              >
                <RefreshCw
                  className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
                />
              </Button>
            </div>
          </div>
        </AdminFilterBar>

        {/* Bulk Actions */}
        {selectedOrders.size > 0 && (
          <div className="flex items-center justify-between rounded-[24px] border border-[#22C7A1]/25 bg-[#22C7A1]/10 p-3">
            <span className="text-sm font-extrabold text-[#22C7A1]">
              {selectedOrders.size} order{selectedOrders.size > 1 ? "s" : ""}{" "}
              selected
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleBulkComplete}
                className="min-h-[44px] rounded-2xl border-[#22C7A1]/25 bg-white font-extrabold text-[#22C7A1]"
              >
                Mark as Completed
              </Button>
              <Button
                variant="outline"
                className="min-h-[44px] rounded-2xl border-[#FB6B7A]/25 bg-white font-extrabold text-[#FB6B7A]"
                onClick={handleBulkCancel}
              >
                Cancel Selected
              </Button>
            </div>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-[#22C7A1]" />
            <p className="text-sm font-bold text-[#94A3B8]">
              Loading orders...
            </p>
          </div>
        )}

        {/* Empty state */}
        {!loading && filteredOrders.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-[28px] border border-[#E5EAF1] bg-white py-16 shadow-[0_14px_34px_rgba(2,6,23,0.05)]">
            <div className="flex h-16 w-16 items-center justify-center rounded-[24px] bg-[#F6F8FB] ring-1 ring-[#E5EAF1]">
              <Utensils className="h-7 w-7 text-[#94A3B8]" />
            </div>
            <p className="text-lg font-black text-[#020617]">No orders found</p>
            <p className="text-sm font-semibold text-[#94A3B8]">
              Try adjusting your filters
            </p>
          </div>
        )}

        {/* Grid view */}
        {!loading && filteredOrders.length > 0 && viewMode === "grid" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                isSelected={selectedOrders.has(order.id)}
                onSelect={() => toggleOrderSelection(order.id)}
                onViewDetails={() => openDetail(order)}
              />
            ))}
          </div>
        )}

        {/* List (table) view */}
        {!loading && filteredOrders.length > 0 && viewMode === "list" && (
          <>
            <div className="grid gap-3 md:hidden">
              {filteredOrders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  isSelected={selectedOrders.has(order.id)}
                  onSelect={() => toggleOrderSelection(order.id)}
                  onViewDetails={() => openDetail(order)}
                />
              ))}
            </div>
            <AdminPanel className="hidden md:block">
              <div className="border-b border-[#E5EAF1] bg-[#F6F8FB] px-6 py-5">
                <h2 className="text-lg font-black text-[#020617]">Orders</h2>
              </div>
              <div className="p-0">
                <Table>
                  <TableHeader className="bg-[#F6F8FB]">
                    <TableRow className="border-[#E5EAF1] hover:bg-transparent">
                      <TableHead className="w-10 pl-6">
                        <Checkbox
                          checked={
                            selectedOrders.size === filteredOrders.length &&
                            filteredOrders.length > 0
                          }
                          onCheckedChange={selectAllOrders}
                        />
                      </TableHead>
                      <TableHead>
                        <button
                          onClick={() => handleSort("meal_name")}
                          className="flex min-h-11 items-center gap-1 rounded-2xl px-2 text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8] transition-colors hover:text-[#020617]"
                        >
                          Meal
                          {sortField === "meal_name" &&
                            (sortDirection === "asc" ? (
                              <ChevronUp className="w-3 h-3" />
                            ) : (
                              <ChevronDown className="w-3 h-3" />
                            ))}
                        </button>
                      </TableHead>
                      <TableHead className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                        Restaurant
                      </TableHead>
                      <TableHead className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                        Customer
                      </TableHead>
                      <TableHead className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                        Meal Type
                      </TableHead>
                      <TableHead className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                        Price
                      </TableHead>
                      <TableHead>
                        <button
                          onClick={() => handleSort("scheduled_date")}
                          className="flex min-h-11 items-center gap-1 rounded-2xl px-2 text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8] transition-colors hover:text-[#020617]"
                        >
                          Scheduled
                          {sortField === "scheduled_date" &&
                            (sortDirection === "asc" ? (
                              <ChevronUp className="w-3 h-3" />
                            ) : (
                              <ChevronDown className="w-3 h-3" />
                            ))}
                        </button>
                      </TableHead>
                      <TableHead className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                        Status
                      </TableHead>
                      <TableHead className="w-20 text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((order) => (
                      <TableRow
                        key={order.id}
                        className="border-[#E5EAF1] transition-colors hover:bg-[#F6F8FB]/70"
                      >
                        <TableCell className="pl-6">
                          <Checkbox
                            checked={selectedOrders.has(order.id)}
                            onCheckedChange={() =>
                              toggleOrderSelection(order.id)
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[#22C7A1]/10">
                              <Utensils className="h-5 w-5 text-[#22C7A1]" />
                            </div>
                            <p className="font-black text-[#020617]">
                              {order.meal.name}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm font-semibold text-[#94A3B8]">
                            <Store className="w-3 h-3" />
                            {order.meal.restaurant.name}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm font-semibold text-[#94A3B8]">
                            <User className="w-3 h-3" />
                            {order.profile?.full_name || "Customer"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className="rounded-full bg-[#F6F8FB] font-extrabold text-[#020617]"
                          >
                            {order.meal_type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="font-black text-[#020617]">
                            {formatCurrency(order.meal.price)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm font-semibold text-[#94A3B8]">
                            <Calendar className="h-3 w-3 text-[#38BDF8]" />
                            {format(
                              new Date(order.scheduled_date),
                              "MMM d, yyyy",
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{getDetailStatusBadge(order)}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-11 w-11 rounded-2xl text-[#94A3B8] hover:bg-[#F6F8FB] hover:text-[#020617]"
                                aria-label="Open order actions"
                              >
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="rounded-[18px] border-[#E5EAF1] bg-white text-[#020617] shadow-[0_18px_42px_rgba(2,6,23,0.12)]"
                            >
                              <DropdownMenuItem
                                onClick={() => openDetail(order)}
                              >
                                <Eye className="w-4 h-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {order.order_status !== "completed" &&
                                order.order_status !== "cancelled" && (
                                  <DropdownMenuItem
                                    className="text-[#FB6B7A] focus:bg-[#FB6B7A]/10 focus:text-[#FB6B7A]"
                                    onClick={() => requestCancelOrder(order)}
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
                    ))}
                  </TableBody>
                </Table>
              </div>
            </AdminPanel>
          </>
        )}

        {/* Order Detail Sheet */}
        <Sheet open={isDetailOpen} onOpenChange={setIsDetailOpen}>
          <AdminSheetContent size="xl">
            {selectedOrder && (
              <>
                <SheetHeader className="border-b border-[#E5EAF1] bg-[#F6F8FB] p-5 text-left shadow-[0_12px_30px_rgba(2,6,23,0.05)]">
                  <div className="flex items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-[24px] bg-[#22C7A1]/12">
                      <Utensils className="h-8 w-8 text-[#22C7A1]" />
                    </div>
                    <div>
                      <SheetTitle className="text-xl font-black text-[#020617]">
                        {selectedOrder.meal.name}
                      </SheetTitle>
                      <SheetDescription>
                        {getDetailStatusBadge(selectedOrder)}
                      </SheetDescription>
                    </div>
                  </div>
                </SheetHeader>

                <div className="space-y-6 p-5">
                  {/* Order Info */}
                  <AdminPanel className="rounded-[24px] shadow-none">
                    <div className="border-b border-[#E5EAF1] bg-[#F6F8FB] px-5 py-3">
                      <h3 className="text-sm font-extrabold uppercase tracking-wider text-[#94A3B8]">
                        Order Details
                      </h3>
                    </div>
                    <div className="space-y-3 px-5 pb-5 pt-4">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <p className="text-xs font-bold text-[#94A3B8]">
                            Order ID
                          </p>
                          <code className="text-sm font-mono font-bold text-[#020617]">
                            {selectedOrder.id.substring(0, 16)}...
                          </code>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-[#94A3B8]">
                            Meal Type
                          </p>
                          <Badge
                            variant="secondary"
                            className="rounded-full bg-[#F6F8FB] font-extrabold text-[#020617]"
                          >
                            {selectedOrder.meal_type}
                          </Badge>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-[#94A3B8]">
                            Scheduled Date
                          </p>
                          <p className="text-sm font-black text-[#020617]">
                            {format(
                              new Date(selectedOrder.scheduled_date),
                              "MMM d, yyyy",
                            )}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-[#94A3B8]">
                            Created
                          </p>
                          <p className="text-sm font-black text-[#020617]">
                            {format(
                              new Date(selectedOrder.created_at),
                              "MMM d, yyyy",
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  </AdminPanel>

                  {/* Pricing Breakdown */}
                  <AdminPanel className="rounded-[24px] shadow-none">
                    <div className="border-b border-[#E5EAF1] bg-[#F6F8FB] px-5 py-3">
                      <h3 className="text-sm font-extrabold uppercase tracking-wider text-[#94A3B8]">
                        Pricing Breakdown
                      </h3>
                    </div>
                    <div className="space-y-2 px-5 pb-5 pt-4">
                      <div className="flex justify-between text-sm font-semibold">
                        <span className="text-[#94A3B8]">
                          Meal Price (set by restaurant)
                        </span>
                        <span className="font-black text-[#020617]">
                          {formatCurrency(selectedOrder.meal.price)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm font-bold text-[#FB6B7A]">
                        <span>
                          Platform Fee (
                          {selectedOrder.meal.restaurant.commission_rate}%)
                        </span>
                        <span>
                          -{" "}
                          {formatCurrency(
                            selectedOrder.meal.price *
                              (selectedOrder.meal.restaurant.commission_rate /
                                100),
                          )}
                        </span>
                      </div>
                      <div className="mt-1 flex justify-between border-t border-[#E5EAF1] pt-2 text-sm font-black">
                        <span>Restaurant Payout</span>
                        <span className="text-[#22C7A1]">
                          {formatCurrency(
                            selectedOrder.meal.price *
                              (1 -
                                selectedOrder.meal.restaurant.commission_rate /
                                  100),
                          )}
                        </span>
                      </div>
                    </div>
                  </AdminPanel>

                  {/* Restaurant */}
                  <AdminPanel className="rounded-[24px] shadow-none">
                    <div className="border-b border-[#E5EAF1] bg-[#F6F8FB] px-5 py-3">
                      <h3 className="text-sm font-extrabold uppercase tracking-wider text-[#94A3B8]">
                        Restaurant
                      </h3>
                    </div>
                    <div className="px-5 pb-5 pt-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#38BDF8]/10">
                          <Store className="h-5 w-5 text-[#38BDF8]" />
                        </div>
                        <div>
                          <p className="font-black text-[#020617]">
                            {selectedOrder.meal.restaurant.name}
                          </p>
                          <p className="text-xs font-bold text-[#94A3B8]">
                            Meal Provider
                          </p>
                        </div>
                      </div>
                    </div>
                  </AdminPanel>

                  {/* Customer */}
                  <AdminPanel className="rounded-[24px] shadow-none">
                    <div className="border-b border-[#E5EAF1] bg-[#F6F8FB] px-5 py-3">
                      <h3 className="text-sm font-extrabold uppercase tracking-wider text-[#94A3B8]">
                        Customer
                      </h3>
                    </div>
                    <div className="px-5 pb-5 pt-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#7C83F6]/10">
                          <User className="h-5 w-5 text-[#7C83F6]" />
                        </div>
                        <div>
                          <p className="font-black text-[#020617]">
                            {selectedOrder.profile?.full_name || "Customer"}
                          </p>
                          <p className="text-xs font-bold text-[#94A3B8]">
                            {selectedOrder.profile?.email || "No email"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </AdminPanel>

                  {/* Actions */}
                  {selectedOrder.order_status !== "completed" &&
                    selectedOrder.order_status !== "cancelled" && (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          className="h-12 flex-1 rounded-2xl border-[#FB6B7A]/25 bg-white font-extrabold text-[#FB6B7A] hover:bg-[#FB6B7A]/10"
                          onClick={() => requestCancelOrder(selectedOrder)}
                        >
                          Cancel Order
                        </Button>
                      </div>
                    )}

                  {selectedOrder.order_status === "cancelled" && (
                    <div className="rounded-[24px] border border-[#FB6B7A]/25 bg-[#FB6B7A]/10 p-4">
                      <p className="text-sm font-extrabold text-[#FB6B7A]">
                        This order has been cancelled
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </AdminSheetContent>
        </Sheet>

        <AlertDialog
          open={!!orderPendingCancel}
          onOpenChange={(open) => !open && setOrderPendingCancel(null)}
        >
          <AdminAlertDialogContent>
            <AlertDialogHeader className="border-b border-[#E5EAF1] bg-[#F6F8FB] px-5 py-4 text-left">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FB6B7A]/10 text-[#FB6B7A]">
                  <XCircle className="h-5 w-5" />
                </span>
                <div>
                  <AlertDialogTitle className="text-xl font-black text-[#020617]">
                    Cancel order?
                  </AlertDialogTitle>
                  <AlertDialogDescription className="mt-1 font-semibold leading-6 text-[#94A3B8]">
                    This will cancel{" "}
                    {orderPendingCancel?.meal.name || "the selected order"} and
                    keep the admin record visible for review.
                  </AlertDialogDescription>
                </div>
              </div>
            </AlertDialogHeader>
            <div className="px-5 py-4">
              <div className="rounded-[20px] border border-[#FB6B7A]/20 bg-[#FB6B7A]/10 p-4">
                <p className="text-sm font-black text-[#020617]">
                  Refund workflow
                </p>
                <p className="mt-1 text-sm font-semibold leading-6 text-[#94A3B8]">
                  Meal credit and add-ons are refunded by the cancellation
                  action. Use this only when the order should no longer be
                  prepared or delivered.
                </p>
              </div>
            </div>
            <AlertDialogFooter className="gap-2 sm:gap-3 border-t border-[#E5EAF1] bg-[#F6F8FB] px-5 py-4">
              <AlertDialogCancel className="min-h-[44px] rounded-2xl border-[#E5EAF1] bg-white font-black text-[#020617] hover:bg-white">
                Keep order
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmCancelOrder}
                className="min-h-[44px] rounded-2xl bg-[#FB6B7A] font-black text-white hover:bg-[#FB6B7A]/90"
              >
                Cancel order
              </AlertDialogAction>
            </AlertDialogFooter>
          </AdminAlertDialogContent>
        </AlertDialog>
      </div>
    </AdminLayout>
  );
};

export default AdminOrders;
