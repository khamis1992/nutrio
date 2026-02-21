import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Calendar,
  CheckCircle2,
  Clock,
  Flame,
  Beef,
  Store,
  Filter,
  X,
  ChevronDown,
  ChevronUp,
  Download,
  Loader2,
  UtensilsCrossed
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { UserOrder, OrderStats, OrderFilters } from "@/hooks/useUserOrders";

interface OrderHistoryCardProps {
  orders: UserOrder[];
  stats: OrderStats | null;
  loading: boolean;
  filters: OrderFilters;
  onFilterChange: (filters: Partial<OrderFilters>) => void;
  onClearFilters: () => void;
}

const MEAL_TYPES = [
  { value: "breakfast", label: "Breakfast", icon: "☕" },
  { value: "lunch", label: "Lunch", icon: "☀️" },
  { value: "dinner", label: "Dinner", icon: "🌙" },
  { value: "snack", label: "Snack", icon: "🍎" },
];

export const OrderHistoryCard = ({
  orders,
  stats,
  loading,
  filters,
  onFilterChange,
  onClearFilters,
}: OrderHistoryCardProps) => {
  const [showFilters, setShowFilters] = useState(false);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  const exportToCSV = () => {
    if (orders.length === 0) return;

    const headers = [
      "Date",
      "Meal Type",
      "Meal Name",
      "Restaurant",
      "Calories",
      "Protein (g)",
      "Status",
    ];

    const rows = orders.map((order) => [
      format(parseISO(order.scheduled_date), "yyyy-MM-dd"),
      order.meal_type,
      order.meal_name,
      order.restaurant_name,
      order.calories,
      order.protein_g,
      order.is_completed ? "Completed" : "Pending",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `user-orders-${format(new Date(), "yyyy-MM-dd")}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const hasActiveFilters =
    filters.mealType || filters.status || filters.dateFrom || filters.dateTo;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Order History</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {stats?.total_orders || 0} total orders
              {stats && stats.total_orders > 0 && (
                <>
                  {" "}
                  · {stats.completed_orders} completed · {stats.pending_orders}{" "}
                  pending
                </>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {orders.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={exportToCSV}
                className="hidden sm:flex"
              >
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className={hasActiveFilters ? "border-primary text-primary" : ""}
            >
              <Filter className="w-4 h-4 mr-2" />
              Filters
              {hasActiveFilters && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  Active
                </Badge>
              )}
            </Button>
          </div>
        </div>

        {/* Filters */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-4 space-y-3 border-t mt-4">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  {/* Meal Type Filter */}
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                      Meal Type
                    </label>
                    <Select
                      value={filters.mealType || "all"}
                      onValueChange={(value) =>
                        onFilterChange({
                          mealType: value === "all" ? null : value,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All types" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All types</SelectItem>
                        {MEAL_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.icon} {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Status Filter */}
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                      Status
                    </label>
                    <Select
                      value={filters.status || "all"}
                      onValueChange={(value) =>
                        onFilterChange({
                          status:
                            value === "all"
                              ? null
                              : (value as "completed" | "pending"),
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Date From */}
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                      From Date
                    </label>
                    <Input
                      type="date"
                      value={
                        filters.dateFrom
                          ? filters.dateFrom.toISOString().split("T")[0]
                          : ""
                      }
                      onChange={(e) =>
                        onFilterChange({
                          dateFrom: e.target.value
                            ? new Date(e.target.value)
                            : null,
                        })
                      }
                    />
                  </div>

                  {/* Date To */}
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                      To Date
                    </label>
                    <Input
                      type="date"
                      value={
                        filters.dateTo
                          ? filters.dateTo.toISOString().split("T")[0]
                          : ""
                      }
                      onChange={(e) =>
                        onFilterChange({
                          dateTo: e.target.value
                            ? new Date(e.target.value)
                            : null,
                        })
                      }
                    />
                  </div>
                </div>

                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClearFilters}
                    className="text-muted-foreground"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Clear all filters
                  </Button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardHeader>

      <CardContent className="p-0">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12 px-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <Calendar className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">
              {hasActiveFilters
                ? "No orders match your filters"
                : "No orders found for this user"}
            </p>
            {hasActiveFilters && (
              <Button
                variant="link"
                onClick={onClearFilters}
                className="mt-2"
              >
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y">
            {orders.map((order, index) => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="p-4 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start gap-4">
                  {/* Date Column */}
                  <div className="text-center min-w-[60px]">
                    <p className="text-2xl font-bold text-primary">
                      {format(parseISO(order.scheduled_date), "d")}
                    </p>
                    <p className="text-xs text-muted-foreground uppercase">
                      {format(parseISO(order.scheduled_date), "MMM")}
                    </p>
                  </div>

                  {/* Meal Image */}
                  <div className="w-16 h-16 rounded-xl bg-muted overflow-hidden shrink-0">
                    {order.meal_image_url ? (
                      <img
                        src={order.meal_image_url}
                        alt={order.meal_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl">
                        🍽️
                      </div>
                    )}
                  </div>

                  {/* Order Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-semibold truncate">
                          {order.meal_name}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs capitalize">
                            {MEAL_TYPES.find((t) => t.value === order.meal_type)
                              ?.icon || "🍽️"}{" "}
                            {order.meal_type}
                          </Badge>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Store className="w-3 h-3" />
                            {order.restaurant_name}
                          </span>
                        </div>
                      </div>
                      <Badge
                        variant={order.is_completed ? "default" : "secondary"}
                        className={`text-xs ${
                          order.is_completed
                            ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
                            : ""
                        }`}
                      >
                        {order.is_completed ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Completed
                          </>
                        ) : (
                          <>
                            <Clock className="w-3 h-3 mr-1" />
                            Pending
                          </>
                        )}
                      </Badge>
                    </div>

                    {/* Nutrition Info */}
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Flame className="w-3 h-3 text-orange-500" />
                        {order.calories} cal
                      </span>
                      <span className="flex items-center gap-1">
                        <Beef className="w-3 h-3 text-red-500" />
                        {order.protein_g}g protein
                      </span>
                      {order.delivery_fee !== null && (
                        <span className="flex items-center gap-1">
                          <UtensilsCrossed className="w-3 h-3" />
                          Delivery: {order.delivery_type}
                        </span>
                      )}
                    </div>

                    {/* Expand/Collapse */}
                    {order.meal_description && (
                      <div className="mt-2">
                        <button
                          onClick={() =>
                            setExpandedOrder(
                              expandedOrder === order.id ? null : order.id
                            )
                          }
                          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                        >
                          {expandedOrder === order.id ? (
                            <>
                              <ChevronUp className="w-3 h-3" /> Less
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-3 h-3" /> More details
                            </>
                          )}
                        </button>
                        <AnimatePresence>
                          {expandedOrder === order.id && (
                            <motion.p
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="text-xs text-muted-foreground mt-2 overflow-hidden"
                            >
                              {order.meal_description}
                            </motion.p>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default OrderHistoryCard;
