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
  LayoutGrid,
  LayoutList,
  Maximize2,
  Plus,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/currency";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const C = {
  text: "#020617",
  muted: "#94A3B8",
  panel: "#F6F8FB",
  water: "#38BDF8",
  fat: "#FB6B7A",
  protein: "#7C83F6",
  progress: "#22C7A1",
};

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
    color: "text-[#0369A1]",
    bgColor: "bg-[#38BDF8]/10 border-[#38BDF8]/25",
  },
  confirmed: {
    label: "In progress",
    color: "text-[#0369A1]",
    bgColor: "bg-[#38BDF8]/10 border-[#38BDF8]/25",
  },
  preparing: {
    label: "In progress",
    color: "text-[#5B5FE8]",
    bgColor: "bg-[#7C83F6]/10 border-[#7C83F6]/25",
  },
  ready: {
    label: "In progress",
    color: "text-[#047857]",
    bgColor: "bg-[#22C7A1]/10 border-[#22C7A1]/25",
  },
  out_for_delivery: {
    label: "In progress",
    color: "text-[#0369A1]",
    bgColor: "bg-[#38BDF8]/10 border-[#38BDF8]/25",
  },
  delivered: {
    label: "Completed",
    color: "text-[#047857]",
    bgColor: "bg-[#22C7A1]/10 border-[#22C7A1]/25",
  },
  completed: {
    label: "Completed",
    color: "text-[#047857]",
    bgColor: "bg-[#22C7A1]/10 border-[#22C7A1]/25",
  },
  cancelled: {
    label: "Cancelled",
    color: "text-[#BE123C]",
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
    color: "text-[#0369A1]",
    bgColor: "bg-[#38BDF8]/10 border-[#38BDF8]/25",
  },
  confirmed: {
    label: "Confirmed",
    color: "text-[#0369A1]",
    bgColor: "bg-[#38BDF8]/10 border-[#38BDF8]/25",
  },
  preparing: {
    label: "Preparing",
    color: "text-[#5B5FE8]",
    bgColor: "bg-[#7C83F6]/10 border-[#7C83F6]/25",
  },
  ready: {
    label: "Ready",
    color: "text-[#047857]",
    bgColor: "bg-[#22C7A1]/10 border-[#22C7A1]/25",
  },
  out_for_delivery: {
    label: "Out for Delivery",
    color: "text-[#0369A1]",
    bgColor: "bg-[#38BDF8]/10 border-[#38BDF8]/25",
  },
  delivered: {
    label: "Delivered",
    color: "text-[#047857]",
    bgColor: "bg-[#22C7A1]/10 border-[#22C7A1]/25",
  },
  completed: {
    label: "Completed",
    color: "text-[#047857]",
    bgColor: "bg-[#22C7A1]/10 border-[#22C7A1]/25",
  },
  cancelled: {
    label: "Cancelled",
    color: "text-[#BE123C]",
    bgColor: "bg-[#FB6B7A]/10 border-[#FB6B7A]/25",
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

// Short badge ID from order UUID (e.g. "A-1F")
const getOrderBadge = (id: string) => id.substring(0, 4).toUpperCase();

// ---- Order Card (grid view) ----
interface OrderCardProps {
  order: OrderData;
  isSelected: boolean;
  onSelect: () => void;
  onViewDetails: () => void;
  onCancel: () => void;
}

const OrderCard = ({
  order,
  isSelected,
  onSelect,
  onViewDetails,
  onCancel,
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
    if (order.scheduled_date.includes("T") || order.scheduled_date.includes(" ")) {
      timeLabel = format(d, "hh:mm aa");
    }
  } catch {
    dateLabel = order.scheduled_date;
  }

  return (
    <div
      className={cn(
        "relative flex flex-col gap-4 rounded-[28px] border border-[#E2E8F0] bg-white p-4 shadow-[0_14px_34px_rgba(2,6,23,0.05)] transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_45px_rgba(2,6,23,0.08)] sm:p-5",
        isSelected && "border-[#22C7A1] ring-2 ring-[#22C7A1]/20"
      )}
    >
      {/* Selection checkbox */}
      <div className="absolute top-4 right-4">
        <Checkbox checked={isSelected} onCheckedChange={onSelect} />
      </div>

      {/* Top row: badge + name + status */}
      <div className="flex items-start gap-3 pr-8">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-[#22C7A1]/12">
          <span className="text-xs font-black leading-none text-[#047857]">
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
          className={`h-8 shrink-0 rounded-full border px-3 text-xs font-extrabold ${statusCfg.bgColor} ${statusCfg.color}`}
        >
          {statusCfg.label}
        </Badge>
      </div>

      {/* Date / time row */}
      <div className="flex items-center justify-between rounded-2xl bg-[#F6F8FB] px-3 py-2 text-sm font-bold text-[#94A3B8]">
        <span>{dateLabel}</span>
        {timeLabel && <span className="font-black text-[#020617]">{timeLabel}</span>}
      </div>

      {/* Items mini-table */}
      <div>
        <div className="mb-1 grid grid-cols-[1fr_auto_auto] gap-x-3 px-0.5 text-xs font-extrabold uppercase tracking-[0.08em] text-[#94A3B8]">
          <span>Items</span>
          <span>Qty</span>
          <span>Price</span>
        </div>
        <div className="divide-y divide-[#E2E8F0]">
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 text-sm py-1.5 px-0.5">
            <span className="truncate font-bold text-[#020617]">{order.meal.name}</span>
            <span className="text-center font-bold text-[#94A3B8]">1</span>
            <span className="text-right font-black text-[#020617]">
              {formatCurrency(order.meal.price)}
            </span>
          </div>
        </div>
      </div>

      {/* Total row */}
      <div className="flex items-center justify-between border-t border-[#E2E8F0] pt-1">
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
            size="sm"
            className="h-11 rounded-2xl bg-[#020617] px-4 text-sm font-extrabold text-white hover:bg-[#020617]/90"
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
  const [activeTab, setActiveTab] = useState<
    "all" | "today" | "upcoming" | "completed" | "overdue"
  >("all");
  const [sortField, setSortField] = useState<
    "created_at" | "scheduled_date" | "meal_name"
  >("created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const today = new Date().toISOString().split("T")[0];

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
        () => { fetchOrders(); }
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
      const { data: schedulesData, error: schedulesError } = await supabase
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
        `
        )
        .order("created_at", { ascending: false })
        .limit(100);

      if (schedulesError) throw schedulesError;

      const mealIds = [
        ...new Set(
          (schedulesData || []).map((o) => o.meal_id).filter(Boolean)
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
                restaurant_id: m.restaurant_id,
              };
              return acc;
            },
            {} as Record<
              string,
              { name: string; price: number; restaurant_id: string }
            >
          );
        }
      }

      const restaurantIds = [
        ...new Set(
          Object.values(mealsMap)
            .map((m) => m.restaurant_id)
            .filter(Boolean)
        ),
      ];
      let restaurantsMap: Record<string, { name: string }> = {};

      if (restaurantIds.length > 0) {
        const { data: restaurants } = await supabase
          .from("restaurants")
          .select("id, name")
          .in("id", restaurantIds);

        if (restaurants) {
          restaurantsMap = restaurants.reduce(
            (acc, r) => {
              acc[r.id] = { name: r.name };
              return acc;
            },
            {} as Record<string, { name: string }>
          );
        }
      }

      const userIds = [
        ...new Set((schedulesData || []).map((o) => o.user_id)),
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
            {} as Record<string, { full_name: string | null }>
          );
        }
      }

      const ordersWithDetails: OrderData[] = (schedulesData || []).map(
        (o: { id: string; scheduled_date: string; meal_type: string; is_completed: boolean; order_status: string; created_at: string; user_id: string; meal_id: string | null }) => {
          const meal = mealsMap[o.meal_id] || {
            name: "Unknown",
            price: 0,
            restaurant_id: "",
          };
          const restaurant = restaurantsMap[meal.restaurant_id] || {
            name: "Unknown",
          };

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
              restaurant: { name: restaurant.name },
            },
            profile: profilesMap[o.user_id] || null,
          };
        }
      );

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

  const handleSort = (
    field: "created_at" | "scheduled_date" | "meal_name"
  ) => {
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
      "Platform Fee 18% (QAR)",
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
      (o.meal.price * 0.18).toFixed(2),
      (o.meal.price * 0.82).toFixed(2),
      o.scheduled_date,
      STATUS_CONFIG_DETAILED[o.order_status]?.label || o.order_status,
      format(new Date(o.created_at), "yyyy-MM-dd HH:mm"),
    ]);

    const csv = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orders-export-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Export Complete",
      description: `${rows.length} orders exported to CSV.`,
    });
  };

  const cancelOrder = async (orderId: string) => {
    try {
      const { data, error } = await supabase.rpc("admin_cancel_meal_schedule", {
        p_schedule_id: orderId,
        p_reason: null,
      });

      if (error) throw error;
      const result = data as { success?: boolean; error?: string } | null;
      if (!result?.success) throw new Error(result?.error || "Cancellation failed.");

      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? { ...o, order_status: "cancelled" as OrderStatus }
            : o
        )
      );

      if (selectedOrder?.id === orderId) {
        setSelectedOrder((prev) =>
          prev ? { ...prev, order_status: "cancelled" as OrderStatus } : null
        );
      }

      toast({
        title: "Order Cancelled",
        description: "The order has been cancelled. meal credit and add-ons refunded.",
      });
    } catch (error: unknown) {
      console.error("Error cancelling order:", error);
      const message = error instanceof Error ? error.message : "Failed to cancel order";
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
        const { data, error } = await supabase.rpc("admin_cancel_meal_schedule", {
          p_schedule_id: id,
          p_reason: null,
        });
        const result = data as { success?: boolean } | null;
        if (!error && result?.success) {
          successCount++;
          setOrders((prev) =>
            prev.map((o) => o.id === id ? { ...o, order_status: "cancelled" as OrderStatus } : o)
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
        const { error } = await supabase
          .from("meal_schedules")
          .update({ is_completed: true, completed_at: new Date().toISOString(), order_status: "completed" })
          .eq("id", id);
        if (!error) {
          successCount++;
          setOrders((prev) =>
            prev.map((o) => o.id === id ? { ...o, is_completed: true, order_status: "completed" as OrderStatus } : o)
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
        o.profile?.full_name
          ?.toLowerCase()
          .includes(searchQuery.toLowerCase());

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
          config?.bgColor || "bg-gray-500/10 text-gray-600 border-gray-500/20"
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
        o.scheduled_date >= today
    ).length,
    completed: orders.filter((o) => o.order_status === "completed").length,
    cancelled: orders.filter((o) => o.order_status === "cancelled").length,
    overdue: orders.filter(
      (o) =>
        o.order_status !== "completed" &&
        o.order_status !== "cancelled" &&
        o.scheduled_date < today
    ).length,
    totalRevenue: orders
      .filter((o) => o.order_status !== "cancelled")
      .reduce((sum, o) => sum + o.meal.price * 0.18, 0),
  };

  const openDetail = (order: OrderData) => {
    setSelectedOrder(order);
    setIsDetailOpen(true);
  };

  return (
    <AdminLayout
      title="Order Management"
      subtitle={`${stats.total} total orders`}
    >
      <div className="space-y-4 bg-[#F6F8FB] text-[#020617] sm:space-y-5">
        <section className="overflow-hidden rounded-[28px] border border-[#E2E8F0] bg-white shadow-[0_18px_45px_rgba(2,6,23,0.06)]">
          <div className="flex items-start justify-between gap-4 p-5">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#22C7A1]">
                Orders desk
              </p>
              <h1 className="mt-1 text-[28px] font-black leading-tight text-[#020617]">
                Order Management
              </h1>
              <p className="mt-1 max-w-md text-sm font-semibold leading-5 text-[#94A3B8]">
                Review meal schedules, customer orders, status changes, platform fees, and bulk actions.
              </p>
            </div>
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl bg-[#22C7A1]/15 text-[#047857]">
              <ShoppingBag className="h-7 w-7" />
            </div>
          </div>
        </section>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Card className="rounded-[24px] border-[#E2E8F0] bg-white shadow-[0_14px_34px_rgba(2,6,23,0.05)]">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#22C7A1]/12">
                  <ShoppingBag className="h-5 w-5 text-[#047857]" />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-black text-[#020617]">{stats.total}</p>
                  <p className="text-xs font-bold text-[#94A3B8]">Total Orders</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[24px] border-[#E2E8F0] bg-white shadow-[0_14px_34px_rgba(2,6,23,0.05)]">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#38BDF8]/12">
                  <Calendar className="h-5 w-5 text-[#0369A1]" />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-black text-[#020617]">{stats.today}</p>
                  <p className="text-xs font-bold text-[#94A3B8]">Today</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[24px] border-[#E2E8F0] bg-white shadow-[0_14px_34px_rgba(2,6,23,0.05)]">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#22C7A1]/12">
                  <CheckCircle className="h-5 w-5 text-[#047857]" />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-black text-[#020617]">{stats.completed}</p>
                  <p className="text-xs font-bold text-[#94A3B8]">Completed</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[24px] border-[#E2E8F0] bg-white shadow-[0_14px_34px_rgba(2,6,23,0.05)]">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FB6B7A]/12">
                  <Clock className="h-5 w-5 text-[#BE123C]" />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-black text-[#020617]">{stats.overdue}</p>
                  <p className="text-xs font-bold text-[#94A3B8]">Overdue</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="col-span-2 rounded-[24px] border-[#E2E8F0] bg-white shadow-[0_14px_34px_rgba(2,6,23,0.05)] md:col-span-1">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#7C83F6]/12">
                  <DollarSign className="h-5 w-5 text-[#5B5FE8]" />
                </div>
                <div className="min-w-0">
                  <p className="text-xl font-black text-[#020617]">
                    {formatCurrency(stats.totalRevenue)}
                  </p>
                  <p className="text-xs font-bold text-[#94A3B8]">
                    Platform Fees (18%)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto rounded-[24px] border border-[#E2E8F0] bg-white p-2 shadow-[0_14px_34px_rgba(2,6,23,0.05)]">
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
              onClick={() => setActiveTab(tab.value as "all" | "today" | "upcoming" | "completed" | "overdue")}
              className={`min-h-11 shrink-0 rounded-2xl px-4 text-sm font-extrabold transition-colors ${
                activeTab === tab.value
                  ? "bg-[#020617] text-white shadow-[0_10px_22px_rgba(2,6,23,0.14)]"
                  : "bg-[#F6F8FB] text-[#64748B] hover:bg-[#EEF2F7]"
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <Badge variant="secondary" className="ml-2 rounded-full bg-white/80 text-xs text-[#020617]">
                  {tab.count}
                </Badge>
              )}
            </button>
          ))}
        </div>

        {/* Order list header bar (matches design) */}
        <div className="rounded-[28px] border border-[#E2E8F0] bg-white p-4 shadow-[0_14px_34px_rgba(2,6,23,0.05)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Left: title + search */}
          <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            <h2 className="whitespace-nowrap text-lg font-black text-[#020617]">
              Order list
            </h2>
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
              <Input
                placeholder="Search by meal, restaurant, or customer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-12 rounded-2xl border-[#E2E8F0] bg-[#F6F8FB] pl-11 text-sm font-bold text-[#020617] placeholder:text-[#94A3B8]"
              />
            </div>
          </div>

          {/* Right: view toggle + sort + export + refresh */}
          <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:shrink-0">
            {/* View toggle */}
            <div className="flex h-11 items-center overflow-hidden rounded-2xl border border-[#E2E8F0] bg-[#F6F8FB] p-1">
              <button
                onClick={() => setViewMode("list")}
                className={`grid h-9 w-9 place-items-center rounded-xl transition-colors ${
                  viewMode === "list"
                    ? "bg-[#020617] text-white"
                    : "text-[#94A3B8] hover:bg-white"
                }`}
                title="List view"
              >
                <LayoutList className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`grid h-9 w-9 place-items-center rounded-xl transition-colors ${
                  viewMode === "grid"
                    ? "bg-[#020617] text-white"
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
                <Button variant="outline" size="sm" className="h-11 rounded-2xl border-[#E2E8F0] bg-white font-extrabold text-[#020617]">
                  Sort by
                  <ChevronDown className="w-3.5 h-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
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
              className="h-11 rounded-2xl border-[#E2E8F0] bg-white font-extrabold text-[#020617]"
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
              className="h-11 w-11 rounded-2xl border-[#E2E8F0] bg-white text-[#020617]"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
            </Button>

            {/* Add new (placeholder) */}
            <Button
              size="sm"
              className="h-11 rounded-2xl bg-[#22C7A1] font-extrabold text-white hover:bg-[#1DB492]"
            >
              <Plus className="w-4 h-4" />
              Add new
            </Button>
          </div>
        </div>
        </div>

        {/* Bulk Actions */}
        {selectedOrders.size > 0 && (
          <div className="flex items-center justify-between rounded-[24px] border border-[#22C7A1]/25 bg-[#22C7A1]/10 p-3">
            <span className="text-sm font-extrabold text-[#047857]">
              {selectedOrders.size} order{selectedOrders.size > 1 ? "s" : ""}{" "}
              selected
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleBulkComplete} className="rounded-2xl border-[#22C7A1]/25 bg-white font-extrabold text-[#047857]">
                Mark as Completed
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-2xl border-[#FB6B7A]/25 bg-white font-extrabold text-[#BE123C]"
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
            <p className="text-sm font-bold text-[#94A3B8]">Loading orders...</p>
          </div>
        )}

        {/* Empty state */}
        {!loading && filteredOrders.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-[28px] border border-[#E2E8F0] bg-white py-16 shadow-[0_14px_34px_rgba(2,6,23,0.05)]">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[#F6F8FB]">
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
                onCancel={() => {
                  if (confirm("Are you sure you want to cancel this order?")) {
                    cancelOrder(order.id);
                  }
                }}
              />
            ))}
          </div>
        )}

        {/* List (table) view */}
        {!loading && filteredOrders.length > 0 && viewMode === "list" && (
          <Card className="overflow-hidden rounded-[28px] border-[#E2E8F0] bg-white shadow-[0_14px_34px_rgba(2,6,23,0.05)]">
            <CardHeader className="border-b border-[#E2E8F0] pb-4">
              <CardTitle className="text-lg font-black text-[#020617]">Orders</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#F6F8FB] hover:bg-[#F6F8FB]">
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
                        className="flex items-center gap-1 font-extrabold text-[#94A3B8] transition-colors hover:text-[#020617]"
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
                    <TableHead>Restaurant</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Meal Type</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>
                      <button
                        onClick={() => handleSort("scheduled_date")}
                        className="flex items-center gap-1 font-extrabold text-[#94A3B8] transition-colors hover:text-[#020617]"
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
                    <TableHead>Status</TableHead>
                    <TableHead className="w-20">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => (
                    <TableRow
                      key={order.id}
                      className="border-[#E2E8F0] transition-colors hover:bg-[#F6F8FB]/70"
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
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Utensils className="h-5 w-5 text-[#047857]" />
                          </div>
                          <p className="font-black text-[#020617]">{order.meal.name}</p>
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
                        <Badge variant="secondary" className="rounded-full bg-[#F6F8FB] font-extrabold text-[#020617]">{order.meal_type}</Badge>
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
                            "MMM d, yyyy"
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
                              className="h-10 w-10 rounded-2xl text-[#94A3B8] hover:bg-[#F6F8FB] hover:text-[#020617]"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openDetail(order)}>
                              <Eye className="w-4 h-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {order.order_status !== "completed" &&
                              order.order_status !== "cancelled" && (
                                <DropdownMenuItem
                                  className="text-red-600 focus:text-red-600 focus:bg-red-500/10"
                                  onClick={() => {
                                    if (
                                      confirm(
                                        "Are you sure you want to cancel this order?"
                                      )
                                    ) {
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
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Order Detail Sheet */}
        <Sheet open={isDetailOpen} onOpenChange={setIsDetailOpen}>
          <SheetContent className="w-full bg-[#F6F8FB] sm:max-w-xl">
            {selectedOrder && (
              <>
                <SheetHeader className="border-b border-[#E2E8F0] pb-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[#22C7A1]/12">
                      <Utensils className="h-8 w-8 text-[#047857]" />
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

                <div className="mt-6 space-y-6">
                  {/* Order Info */}
                  <Card className="rounded-[24px] border-[#E2E8F0] bg-white shadow-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-extrabold uppercase tracking-wider text-[#94A3B8]">
                        Order Details
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-4">
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
                          <Badge variant="secondary" className="rounded-full bg-[#F6F8FB] font-extrabold text-[#020617]">
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
                              "MMM d, yyyy"
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
                              "MMM d, yyyy"
                            )}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Pricing Breakdown */}
                  <Card className="rounded-[24px] border-[#E2E8F0] bg-white shadow-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-extrabold uppercase tracking-wider text-[#94A3B8]">
                        Pricing Breakdown
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between text-sm font-semibold">
                        <span className="text-[#94A3B8]">
                          Meal Price (set by restaurant)
                        </span>
                        <span className="font-black text-[#020617]">
                          {formatCurrency(selectedOrder.meal.price)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm font-bold text-[#FB6B7A]">
                        <span>Platform Fee (18%)</span>
                        <span>
                          - {formatCurrency(selectedOrder.meal.price * 0.18)}
                        </span>
                      </div>
                      <div className="mt-1 flex justify-between border-t border-[#E2E8F0] pt-2 text-sm font-black">
                        <span>Restaurant Payout</span>
                        <span className="text-[#22C7A1]">
                          {formatCurrency(selectedOrder.meal.price * 0.82)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Restaurant */}
                  <Card className="rounded-[24px] border-[#E2E8F0] bg-white shadow-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-extrabold uppercase tracking-wider text-[#94A3B8]">
                        Restaurant
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#38BDF8]/10">
                          <Store className="h-5 w-5 text-[#0369A1]" />
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
                    </CardContent>
                  </Card>

                  {/* Customer */}
                  <Card className="rounded-[24px] border-[#E2E8F0] bg-white shadow-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-extrabold uppercase tracking-wider text-[#94A3B8]">
                        Customer
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#7C83F6]/10">
                          <User className="h-5 w-5 text-[#5B5FE8]" />
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
                    </CardContent>
                  </Card>

                  {/* Actions */}
                  {selectedOrder.order_status !== "completed" &&
                    selectedOrder.order_status !== "cancelled" && (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          className="h-12 flex-1 rounded-2xl border-[#FB6B7A]/25 bg-white font-extrabold text-[#BE123C] hover:bg-[#FB6B7A]/10"
                          onClick={() => {
                            if (
                              confirm(
                                "Are you sure you want to cancel this order?"
                              )
                            ) {
                              cancelOrder(selectedOrder.id);
                            }
                          }}
                        >
                          Cancel Order
                        </Button>
                      </div>
                    )}

                  {selectedOrder.order_status === "cancelled" && (
                    <div className="rounded-[24px] border border-[#FB6B7A]/25 bg-[#FB6B7A]/10 p-4">
                      <p className="text-sm font-extrabold text-[#BE123C]">
                        This order has been cancelled
                      </p>
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
