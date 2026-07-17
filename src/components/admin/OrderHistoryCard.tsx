import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AdminEmptyState,
  AdminListSkeleton,
  AdminPanel,
  AdminPanelHeader,
} from "@/components/admin/AdminPrimitives";
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
  UtensilsCrossed,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { UserOrder, OrderStats, OrderFilters } from "@/hooks/useUserOrders";
import { downloadCsv } from "@/lib/csv";

interface OrderHistoryCardProps {
  orders: UserOrder[];
  stats: OrderStats | null;
  loading: boolean;
  filters: OrderFilters;
  onFilterChange: (filters: Partial<OrderFilters>) => void;
  onClearFilters: () => void;
}

const MEAL_TYPES = [
  { value: "breakfast", label: "Breakfast", icon: "B" },
  { value: "lunch", label: "Lunch", icon: "L" },
  { value: "dinner", label: "Dinner", icon: "D" },
  { value: "snack", label: "Snack", icon: "S" },
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

    downloadCsv(
      [headers, ...rows],
      `user-orders-${format(new Date(), "yyyy-MM-dd")}.csv`,
    );
  };

  const hasActiveFilters =
    filters.mealType || filters.status || filters.dateFrom || filters.dateTo;

  return (
    <AdminPanel>
      <AdminPanelHeader
        eyebrow="Customer timeline"
        title="Order History"
        description={
          <>
            {stats?.total_orders || 0} total orders
            {stats && stats.total_orders > 0 && (
              <>
                {" "}
                / {stats.completed_orders} completed / {stats.pending_orders}{" "}
                pending
              </>
            )}
          </>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {orders.length > 0 && (
              <Button
                variant="outline"
                onClick={exportToCSV}
                className="hidden h-11 rounded-2xl border-[#E5EAF1] bg-white font-bold text-[#020617] sm:flex"
              >
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className={`h-11 rounded-2xl bg-white font-bold ${hasActiveFilters ? "border-[#22C7A1] text-[#22C7A1]" : "border-[#E5EAF1] text-[#020617]"}`}
            >
              <Filter className="w-4 h-4 mr-2" />
              Filters
              {hasActiveFilters && (
                <Badge
                  variant="secondary"
                  className="ml-2 bg-[#22C7A1]/10 text-xs text-[#22C7A1]"
                >
                  Active
                </Badge>
              )}
            </Button>
          </div>
        }
      />

      <AnimatePresence>
        {showFilters && (
          <div className="border-b border-[#E5EAF1] px-5 py-4">
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {/* Meal Type Filter */}
                  <div>
                    <label className="mb-1.5 block text-xs font-black text-[#94A3B8]">
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
                      <SelectTrigger className="h-11 rounded-2xl border-[#E5EAF1] bg-[#F6F8FB] font-bold text-[#020617]">
                        <SelectValue placeholder="All types" />
                      </SelectTrigger>
                      <SelectContent className="rounded-[18px] border-[#E5EAF1] bg-white text-[#020617] shadow-[0_18px_42px_rgba(2,6,23,0.12)]">
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
                    <label className="mb-1.5 block text-xs font-black text-[#94A3B8]">
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
                      <SelectTrigger className="h-11 rounded-2xl border-[#E5EAF1] bg-[#F6F8FB] font-bold text-[#020617]">
                        <SelectValue placeholder="All statuses" />
                      </SelectTrigger>
                      <SelectContent className="rounded-[18px] border-[#E5EAF1] bg-white text-[#020617] shadow-[0_18px_42px_rgba(2,6,23,0.12)]">
                        <SelectItem value="all">All statuses</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Date From */}
                  <div>
                    <label className="mb-1.5 block text-xs font-black text-[#94A3B8]">
                      From Date
                    </label>
                    <Input
                      type="date"
                      className="h-11 rounded-2xl border-[#E5EAF1] bg-[#F6F8FB] font-bold text-[#020617]"
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
                    <label className="mb-1.5 block text-xs font-black text-[#94A3B8]">
                      To Date
                    </label>
                    <Input
                      type="date"
                      className="h-11 rounded-2xl border-[#E5EAF1] bg-[#F6F8FB] font-bold text-[#020617]"
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
                    className="min-h-11 rounded-2xl font-bold text-[#94A3B8] hover:text-[#020617]"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Clear all filters
                  </Button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="p-0">
        {loading ? (
          <AdminListSkeleton rows={5} />
        ) : orders.length === 0 ? (
          <AdminEmptyState
            icon={Calendar}
            title={
              hasActiveFilters
                ? "No orders match these filters"
                : "No orders found"
            }
            description={
              hasActiveFilters
                ? "Adjust the filters to review a wider customer order history."
                : "When this user schedules meals, their order history will appear here."
            }
            action={
              hasActiveFilters ? (
                <Button
                  variant="outline"
                  onClick={onClearFilters}
                  className="h-11 rounded-2xl border-[#E5EAF1] bg-white font-black text-[#020617]"
                >
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="divide-y divide-[#E5EAF1]">
            {orders.map((order, index) => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="p-4 transition-colors hover:bg-[#F6F8FB]"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                  {/* Date Column */}
                  <div className="flex min-w-[60px] items-center gap-3 text-left sm:block sm:text-center">
                    <p className="text-2xl font-black text-[#020617]">
                      {format(parseISO(order.scheduled_date), "d")}
                    </p>
                    <p className="text-xs font-black uppercase text-[#94A3B8]">
                      {format(parseISO(order.scheduled_date), "MMM")}
                    </p>
                  </div>

                  {/* Meal Image */}
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-[#F6F8FB] ring-1 ring-[#E5EAF1]">
                    {order.meal_image_url ? (
                      <img
                        src={order.meal_image_url}
                        alt={order.meal_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[#94A3B8]">
                        <UtensilsCrossed className="h-6 w-6" />
                      </div>
                    )}
                  </div>

                  {/* Order Details */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <h4 className="truncate font-black text-[#020617]">
                          {order.meal_name}
                        </h4>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <Badge
                            variant="outline"
                            className="rounded-full border-[#E5EAF1] bg-white text-xs capitalize text-[#94A3B8]"
                          >
                            <span className="mr-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#F6F8FB] text-[9px] font-black text-[#94A3B8]">
                              {MEAL_TYPES.find(
                                (t) => t.value === order.meal_type,
                              )?.icon || "M"}
                            </span>
                            {order.meal_type}
                          </Badge>
                          <span className="flex items-center gap-1 text-xs font-semibold text-[#94A3B8]">
                            <Store className="w-3 h-3" />
                            {order.restaurant_name}
                          </span>
                        </div>
                      </div>
                      <Badge
                        variant={order.is_completed ? "default" : "secondary"}
                        className={`text-xs ${
                          order.is_completed
                            ? "border-[#22C7A1]/25 bg-[#22C7A1]/10 text-[#22C7A1] hover:bg-[#22C7A1]/20"
                            : "border-[#E5EAF1] bg-[#F6F8FB] text-[#94A3B8]"
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
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs font-semibold text-[#94A3B8]">
                      <span className="flex items-center gap-1">
                        <Flame className="h-3 w-3 text-[#22C7A1]" />
                        {order.calories} cal
                      </span>
                      <span className="flex items-center gap-1">
                        <Beef className="h-3 w-3 text-[#7C83F6]" />
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
                              expandedOrder === order.id ? null : order.id,
                            )
                          }
                          className="flex min-h-11 items-center gap-1 rounded-2xl px-1 text-xs font-bold text-[#94A3B8] hover:text-[#020617]"
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
                              className="mt-2 overflow-hidden text-xs font-semibold text-[#94A3B8]"
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
      </div>
    </AdminPanel>
  );
};

export default OrderHistoryCard;
