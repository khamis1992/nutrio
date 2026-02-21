import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OrderStats } from "@/hooks/useUserOrders";
import { 
  UtensilsCrossed, 
  CheckCircle2, 
  Clock, 
  Flame, 
  Beef,
  Store,
  Calendar
} from "lucide-react";

interface OrderStatisticsProps {
  stats: OrderStats | null;
}

export const OrderStatistics = ({ stats }: OrderStatisticsProps) => {
  if (!stats || stats.total_orders === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Order Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            No order data available for this user.
          </p>
        </CardContent>
      </Card>
    );
  }

  const completionRate = stats.total_orders > 0
    ? Math.round((stats.completed_orders / stats.total_orders) * 100)
    : 0;

  const statCards = [
    {
      label: "Total Orders",
      value: stats.total_orders,
      icon: UtensilsCrossed,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      label: "Completed",
      value: stats.completed_orders,
      subValue: `${completionRate}%`,
      icon: CheckCircle2,
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
    },
    {
      label: "Pending",
      value: stats.pending_orders,
      icon: Clock,
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
    },
    {
      label: "Total Calories",
      value: stats.total_calories.toLocaleString(),
      icon: Flame,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
    },
    {
      label: "Total Protein",
      value: `${stats.total_protein}g`,
      icon: Beef,
      color: "text-red-500",
      bgColor: "bg-red-500/10",
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Order Statistics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {statCards.map((stat, index) => (
            <div
              key={index}
              className="p-3 rounded-xl bg-muted/50 border border-border/50"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-8 h-8 rounded-lg ${stat.bgColor} flex items-center justify-center`}>
                  <stat.icon className={`w-4 h-4 ${stat.color}`} />
                </div>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
              <div className="flex items-baseline gap-1">
                <p className="text-xl font-bold">{stat.value}</p>
                {stat.subValue && (
                  <span className="text-xs text-muted-foreground">
                    ({stat.subValue})
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Completion Rate Bar */}
        <div className="pt-2">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-muted-foreground">Completion Rate</span>
            <span className="font-medium">{completionRate}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
              style={{ width: `${completionRate}%` }}
            />
          </div>
        </div>

        {/* Favorites */}
        <div className="pt-2 border-t space-y-2">
          {stats.favorite_restaurant && (
            <div className="flex items-center gap-2">
              <Store className="w-4 h-4 text-primary" />
              <span className="text-sm text-muted-foreground">Favorite Restaurant:</span>
              <Badge variant="secondary" className="text-xs">
                {stats.favorite_restaurant}
              </Badge>
            </div>
          )}
          {stats.favorite_meal_type && (
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              <span className="text-sm text-muted-foreground">Favorite Meal:</span>
              <Badge variant="secondary" className="text-xs capitalize">
                {stats.favorite_meal_type}
              </Badge>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default OrderStatistics;
