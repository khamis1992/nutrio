import { Badge } from "@/components/ui/badge";
import {
  AdminEmptyState,
  AdminMetricTile,
  AdminPanel,
  AdminPanelHeader,
} from "@/components/admin/AdminPrimitives";
import { OrderStats } from "@/hooks/useUserOrders";
import {
  UtensilsCrossed,
  CheckCircle2,
  Clock,
  Flame,
  Beef,
  Store,
  Calendar,
} from "lucide-react";

interface OrderStatisticsProps {
  stats: OrderStats | null;
}

export const OrderStatistics = ({ stats }: OrderStatisticsProps) => {
  if (!stats || stats.total_orders === 0) {
    return (
      <AdminPanel>
        <AdminPanelHeader
          eyebrow="Customer orders"
          title="Order Statistics"
          description="Performance and nutrition totals for this customer."
        />
        <AdminEmptyState
          icon={UtensilsCrossed}
          title="No order data yet"
          description="Once the customer starts scheduling meals, their order totals and nutrition profile will appear here."
        />
      </AdminPanel>
    );
  }

  const completionRate =
    stats.total_orders > 0
      ? Math.round((stats.completed_orders / stats.total_orders) * 100)
      : 0;

  const statCards = [
    {
      label: "Total Orders",
      value: stats.total_orders,
      icon: UtensilsCrossed,
      accent: "#38BDF8" as const,
    },
    {
      label: "Completed",
      value: stats.completed_orders,
      subValue: `${completionRate}%`,
      icon: CheckCircle2,
      accent: "#22C7A1" as const,
    },
    {
      label: "Pending",
      value: stats.pending_orders,
      icon: Clock,
      accent: "#F97316" as const,
    },
    {
      label: "Total Calories",
      value: stats.total_calories.toLocaleString(),
      icon: Flame,
      accent: "#22C7A1" as const,
    },
    {
      label: "Total Protein",
      value: `${stats.total_protein}g`,
      icon: Beef,
      accent: "#7C83F6" as const,
    },
  ];

  return (
    <AdminPanel>
      <AdminPanelHeader
        eyebrow="Customer orders"
        title="Order Statistics"
        description={`${stats.completed_orders} completed / ${stats.pending_orders} pending`}
      />
      <div className="space-y-4 px-5 py-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {statCards.map((stat, index) => (
            <AdminMetricTile
              key={index}
              label={stat.label}
              value={stat.value}
              subValue={stat.subValue ? `(${stat.subValue})` : undefined}
              icon={stat.icon}
              accent={stat.accent}
            />
          ))}
        </div>

        <div className="pt-2">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="font-semibold text-[#94A3B8]">
              Completion Rate
            </span>
            <span className="font-black text-[#020617]">{completionRate}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[#E5EAF1]">
            <div
              className="h-full rounded-full bg-[#22C7A1] transition-all duration-500"
              style={{ width: `${completionRate}%` }}
            />
          </div>
        </div>

        <div className="space-y-2 border-t border-[#E5EAF1] pt-2">
          {stats.favorite_restaurant && (
            <div className="flex items-center gap-2">
              <Store className="h-4 w-4 text-[#7C83F6]" />
              <span className="text-sm font-semibold text-[#94A3B8]">
                Favorite Restaurant:
              </span>
              <Badge
                variant="secondary"
                className="bg-[#F6F8FB] text-xs text-[#020617]"
              >
                {stats.favorite_restaurant}
              </Badge>
            </div>
          )}
          {stats.favorite_meal_type && (
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-[#38BDF8]" />
              <span className="text-sm font-semibold text-[#94A3B8]">
                Favorite Meal:
              </span>
              <Badge
                variant="secondary"
                className="bg-[#F6F8FB] text-xs capitalize text-[#020617]"
              >
                {stats.favorite_meal_type}
              </Badge>
            </div>
          )}
        </div>
      </div>
    </AdminPanel>
  );
};

export default OrderStatistics;
