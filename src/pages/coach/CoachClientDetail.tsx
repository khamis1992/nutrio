import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft, CalendarCheck, Target, TrendingDown, TrendingUp, Minus,
  Flame, Loader2, UtensilsCrossed, Clock, ChefHat, AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ClientProfile {
  full_name: string | null;
  avatar_url: string | null;
  health_goal: string | null;
  daily_calorie_target: number | null;
  protein_target_g: number | null;
  carbs_target_g: number | null;
  fat_target_g: number | null;
}

interface MealSchedule {
  id: string;
  scheduled_date: string;
  order_status: string;
  meal_name: string;
  restaurant_name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

interface WeightEntry {
  log_date: string;
  weight_kg: number;
}

interface DayAdherence {
  date: string;
  label: string;
  adherence: number;
  mealsTotal: number;
  mealsDelivered: number;
}

const fadeInUp = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 260, damping: 24 } },
};

const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CoachClientDetail() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [meals, setMeals] = useState<MealSchedule[]>([]);
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [streak, setStreak] = useState(0);
  const [adherenceDays, setAdherenceDays] = useState<DayAdherence[]>([]);
  const [overallAdherence, setOverallAdherence] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clientId) return;
    fetchClientData();
  }, [clientId]);

  const fetchClientData = async () => {
    if (!clientId) return;
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().split("T")[0];
    const todayStr = today.toISOString().split("T")[0];

    try {
      const [
        { data: prof },
        { data: mealData },
        { data: weightData },
        { data: streakData },
      ] = await Promise.all([
        supabase.from("profiles").select("full_name, avatar_url, health_goal, daily_calorie_target, protein_target_g, carbs_target_g, fat_target_g").eq("user_id", clientId).single(),
        supabase.from("meal_schedules").select("id, scheduled_date, order_status, meals:meal_id(name, calories, protein_g, carbs_g, fat_g), restaurants:restaurant_id(name)").eq("user_id", clientId).gte("scheduled_date", weekAgoStr).lte("scheduled_date", todayStr).order("scheduled_date", { ascending: true }),
        supabase.from("body_measurements").select("log_date, weight_kg").eq("user_id", clientId).gte("log_date", weekAgoStr).order("log_date", { ascending: true }),
        supabase.from("user_streaks").select("current_streak").eq("user_id", clientId).eq("streak_type", "logging").maybeSingle(),
      ]);

      setProfile(prof || null);
      setStreak(streakData?.current_streak || 0);

      if (weightData) {
        setWeights(weightData.map(w => ({ log_date: w.log_date, weight_kg: w.weight_kg })));
      }

      if (mealData) {
        const formattedMeals: MealSchedule[] = (mealData as any[]).map((m: any) => ({
          id: m.id,
          scheduled_date: m.scheduled_date,
          order_status: m.order_status,
          meal_name: m.meals?.name || "Meal",
          restaurant_name: m.restaurants?.name || "Restaurant",
          calories: m.meals?.calories || 0,
          protein_g: m.meals?.protein_g || 0,
          carbs_g: m.meals?.carbs_g || 0,
          fat_g: m.meals?.fat_g || 0,
        }));
        setMeals(formattedMeals);

        // Calculate daily adherence
        const dayMap = new Map<string, { total: number; delivered: number }>();
        for (const meal of formattedMeals) {
          const d = meal.scheduled_date;
          if (!dayMap.has(d)) dayMap.set(d, { total: 0, delivered: 0 });
          const entry = dayMap.get(d)!;
          entry.total++;
          if (meal.order_status === "delivered" || meal.order_status === "completed") {
            entry.delivered++;
          }
        }

        const adherenceArr: DayAdherence[] = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date(today);
          d.setDate(d.getDate() - i);
          const ds = d.toISOString().split("T")[0];
          const entry = dayMap.get(ds);
          const total = entry?.total || 0;
          const delivered = entry?.delivered || 0;
          adherenceArr.push({
            date: ds,
            label: days[d.getDay()],
            adherence: total > 0 ? Math.round((delivered / total) * 100) : 0,
            mealsTotal: total,
            mealsDelivered: delivered,
          });
        }
        setAdherenceDays(adherenceArr);

        const totalAll = adherenceArr.reduce((s, d) => s + d.mealsTotal, 0);
        const deliveredAll = adherenceArr.reduce((s, d) => s + d.mealsDelivered, 0);
        setOverallAdherence(totalAll > 0 ? Math.round((deliveredAll / totalAll) * 100) : 0);
      }
    } catch (err) {
      console.error("Error fetching client data:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="w-12 h-12 text-slate-300 mb-3" />
        <p className="text-slate-500 font-semibold">Client not found</p>
      </div>
    );
  }

  const weightTrend = weights.length >= 2
    ? Math.round((weights[weights.length - 1].weight_kg - weights[0].weight_kg) * 100) / 100
    : null;

  const lastWeight = weights.length > 0 ? weights[weights.length - 1].weight_kg : null;
  const weightIcon = weightTrend === null ? null : weightTrend < 0 ? TrendingDown : weightTrend > 0 ? TrendingUp : Minus;
  const weightColor = weightTrend === null ? "text-slate-400" : weightTrend < 0 ? "text-emerald-500" : weightTrend > 0 ? "text-red-500" : "text-slate-400";

  const adherenceColor = overallAdherence >= 80 ? "text-emerald-600" : overallAdherence >= 50 ? "text-amber-600" : "text-red-500";

  return (
    <div className="space-y-5">
      {/* Back button + Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-white border border-slate-100 flex items-center justify-center shrink-0 shadow-sm"
        >
          <ArrowLeft className="w-5 h-5 text-slate-700" />
        </button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center shrink-0">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
            ) : (
              <span className="text-base font-bold text-emerald-700">
                {(profile.full_name || "C")[0].toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <h1 className="text-[16px] font-extrabold tracking-[-0.02em] text-slate-950 truncate">
              {profile.full_name || "Client"}
            </h1>
            <p className="text-[11px] font-medium text-slate-500">
              {profile.health_goal ? profile.health_goal.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase()) : "General Health"}
              {streak > 0 && ` · 🔥 ${streak}-day streak`}
            </p>
          </div>
        </div>
      </div>

      {/* Macro Compliance Ring */}
      {profile.daily_calorie_target && (
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          className="bg-white rounded-[24px] p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/80"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-[15px] font-extrabold tracking-[-0.02em] text-slate-950">Daily Targets</h2>
              <p className="text-[11px] font-medium text-slate-500">Macro goals for this client</p>
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5">
              <CalendarCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-[12px] font-bold text-emerald-700">{overallAdherence}% adherence</span>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Calories", value: profile.daily_calorie_target, unit: "kcal", color: "text-slate-900", bg: "bg-slate-50" },
              { label: "Protein", value: profile.protein_target_g, unit: "g", color: "text-blue-600", bg: "bg-blue-50" },
              { label: "Carbs", value: profile.carbs_target_g, unit: "g", color: "text-amber-600", bg: "bg-amber-50" },
              { label: "Fat", value: profile.fat_target_g, unit: "g", color: "text-purple-600", bg: "bg-purple-50" },
            ].map((macro) => (
              <div key={macro.label} className="text-center">
                <div className={cn("rounded-xl px-2 py-3", macro.bg)}>
                  <p className={cn("text-lg font-extrabold", macro.color)}>{macro.value}</p>
                  <p className="text-[10px] font-medium text-slate-400">{macro.unit}</p>
                </div>
                <p className="mt-1.5 text-[10px] font-semibold text-slate-500">{macro.label}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* 7-Day Meal Adherence */}
      {adherenceDays.length > 0 && (
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          className="bg-white rounded-[24px] p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/80"
        >
          <h2 className="text-[15px] font-extrabold tracking-[-0.02em] text-slate-950 mb-3">Meal Adherence</h2>
          <div className="flex justify-between gap-1">
            {adherenceDays.map((day) => {
              const isToday = day.date === new Date().toISOString().split("T")[0];
              const dotColor = day.adherence >= 80 ? "bg-emerald-500" : day.adherence >= 50 ? "bg-amber-500" : day.adherence > 0 ? "bg-red-500" : "bg-slate-200";
              return (
                <div key={day.date} className={cn("flex flex-col items-center gap-1.5 px-1", isToday && "relative")}>
                  {isToday && <div className="absolute -top-1 -bottom-1 -left-0.5 -right-0.5 rounded-xl bg-emerald-50/50" />}
                  <span className="relative text-[10px] font-semibold text-slate-400">{day.label}</span>
                  <div className={cn("relative w-8 h-8 rounded-full flex items-center justify-center", dotColor, day.adherence > 0 ? "text-white" : "text-slate-400")}>
                    <span className="text-[10px] font-extrabold">{day.adherence}%</span>
                  </div>
                  <span className="text-[9px] text-slate-400">{day.mealsDelivered}/{day.mealsTotal}</span>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Weight Trend */}
      {weights.length > 0 && (
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          className="bg-white rounded-[24px] p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/80"
        >
          <h2 className="text-[15px] font-extrabold tracking-[-0.02em] text-slate-950 mb-3">Weight Trend</h2>
          <div className="flex items-end gap-2 h-16">
            {weights.map((w, i) => {
              const maxWeight = Math.max(...weights.map(x => x.weight_kg));
              const minWeight = Math.min(...weights.map(x => x.weight_kg));
              const range = maxWeight - minWeight || 1;
              const height = ((w.weight_kg - minWeight) / range) * 48 + 8;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] font-bold text-slate-700">{w.weight_kg.toFixed(1)}</span>
                  <div
                    className="w-full rounded-t-md bg-gradient-to-t from-emerald-400 to-emerald-300 min-h-[4px] transition-all"
                    style={{ height: `${height}px` }}
                  />
                  <span className="text-[9px] text-slate-400">{new Date(w.log_date).getDate()}/{new Date(w.log_date).getMonth() + 1}</span>
                </div>
              );
            })}
          </div>
          {weightTrend !== null && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
              {weightIcon && <weightIcon className={cn("w-4 h-4", weightColor)} />}
              <span className={cn("text-[12px] font-semibold", weightColor)}>
                7-day change: {weightTrend > 0 ? "+" : ""}{weightTrend} kg
              </span>
            </div>
          )}
        </motion.div>
      )}

      {/* Upcoming Meals */}
      {meals.length > 0 && (
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          className="bg-white rounded-[24px] p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/80"
        >
          <h2 className="text-[15px] font-extrabold tracking-[-0.02em] text-slate-950 mb-3">Scheduled Meals</h2>
          <div className="space-y-2">
            {meals.slice(0, 5).map((meal) => {
              const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
                delivered: { label: "Delivered", color: "text-emerald-600", bg: "bg-emerald-50" },
                completed: { label: "Completed", color: "text-emerald-600", bg: "bg-emerald-50" },
                preparing: { label: "Preparing", color: "text-amber-600", bg: "bg-amber-50" },
                confirmed: { label: "Confirmed", color: "text-blue-600", bg: "bg-blue-50" },
                pending: { label: "Pending", color: "text-slate-500", bg: "bg-slate-50" },
              };
              const status = statusConfig[meal.order_status] || statusConfig.pending;
              return (
                <div key={meal.id} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center shrink-0">
                    <UtensilsCrossed className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-slate-900 truncate">{meal.meal_name}</p>
                    <p className="text-[10px] text-slate-500">{meal.restaurant_name} · {meal.calories} kcal</p>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", status.bg, status.color)}>
                      {status.label}
                    </span>
                    <span className="text-[9px] text-slate-400">
                      {new Date(meal.scheduled_date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Empty state */}
      {meals.length === 0 && (
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          className="bg-white rounded-[24px] p-10 text-center shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/80"
        >
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
            <ChefHat className="w-8 h-8 text-emerald-500" />
          </div>
          <h3 className="text-[15px] font-bold text-slate-900 mb-1">No meals scheduled</h3>
          <p className="text-[12px] text-slate-500">This client hasn't scheduled any meals this week.</p>
        </motion.div>
      )}
    </div>
  );
}
