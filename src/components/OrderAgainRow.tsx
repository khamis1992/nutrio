import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Utensils, ChevronRight, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";

interface PastOrder {
  id: string;
  meal_name: string;
  restaurant_name: string;
  restaurant_id: string;
  scheduled_date: string;
}

export function OrderAgainRow() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [orders, setOrders] = useState<PastOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchPastOrders = async () => {
      try {
        const { data: schedules } = await supabase
          .from("meal_schedules")
          .select("id, meal_id, scheduled_date")
          .eq("user_id", user.id)
          .in("order_status", ["delivered", "completed"])
          .order("scheduled_date", { ascending: false })
          .limit(10);

        if (!schedules || schedules.length === 0) {
          setOrders([]);
          setLoading(false);
          return;
        }

        const mealIds = [...new Set(schedules.map((s) => s.meal_id).filter(Boolean))];
        const seen = new Set<string>();
        const result: PastOrder[] = [];

        const { data: meals } = await supabase
          .from("meals")
          .select("id, name, restaurant_id")
          .in("id", mealIds);

        if (!meals) {
          setLoading(false);
          return;
        }

        const restIds = [...new Set(meals.map((m) => m.restaurant_id).filter(Boolean))];
        const { data: restaurants } = await supabase
          .from("restaurants")
          .select("id, name")
          .in("id", restIds);

        for (const schedule of schedules) {
          const meal = meals.find((m) => m.id === schedule.meal_id);
          if (!meal || seen.has(meal.id)) continue;
          seen.add(meal.id);
          const restaurant = restaurants?.find((r) => r.id === meal.restaurant_id);
          result.push({
            id: schedule.id,
            meal_name: meal.name,
            restaurant_name: restaurant?.name || t("order_restaurant_default"),
            restaurant_id: meal.restaurant_id || "",
            scheduled_date: schedule.scheduled_date,
          });
          if (result.length >= 5) break;
        }

        setOrders(result);
      } catch (err) {
        console.error("Error fetching past orders:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchPastOrders();
  }, [user, t]);

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-4 w-24 rounded bg-muted animate-pulse" />
        <div className="flex gap-3 overflow-hidden">
          {[1, 2, 3].map((i) => (
            <div key={i} className="w-36 h-20 rounded-2xl bg-muted animate-pulse shrink-0" />
          ))}
        </div>
      </div>
    );
  }

  if (orders.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm flex items-center gap-2 text-foreground">
          <RotateCcw className="w-4 h-4 text-primary" />
          {t("order_again") || "Order Again"}
        </h3>
        <Link to="/orders">
          <span className="text-xs font-medium text-primary">{t("view_all") || "View all"}</span>
        </Link>
      </div>

      <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-5 px-5 pb-1">
        {orders.map((order) => (
          <Link
            key={order.id}
            to={`/restaurant/${order.restaurant_id}`}
            className="shrink-0"
          >
            <motion.div
              whileTap={{ scale: 0.97 }}
              className="w-40 rounded-2xl border border-border bg-card p-3 hover:shadow-md transition-shadow"
            >
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center mb-2">
                <Utensils className="w-4 h-4 text-primary" />
              </div>
              <p className="text-xs font-semibold text-foreground line-clamp-1 leading-tight">
                {order.meal_name}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">
                {order.restaurant_name}
              </p>
              <div className="flex items-center gap-1 mt-1.5 text-primary">
                <span className="text-[10px] font-semibold">{t("order_again") || "Order Again"}</span>
                <ChevronRight className="w-3 h-3" />
              </div>
            </motion.div>
          </Link>
        ))}
      </div>
    </motion.div>
  );
}
