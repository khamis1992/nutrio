import { getNavArrows } from "@/lib/rtl";
import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { useFavoriteRestaurants } from "@/hooks/useFavoriteRestaurants";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import { ArrowLeft,
  Coffee,
  Sun,
  Moon,
  Apple,
  ChevronLeft,
  Check,
  X,
  Flame,
  Beef,
  Leaf,
  Clock,
  Sparkles,
  Loader2,
  Shuffle,
  ArrowRight,
  Utensils,
  RotateCw,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  Target,
  Store,
  Search,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { format, addDays } from "date-fns";
import { cn } from "@/lib/utils";

interface Meal {
  id: string;
  name: string;
  description: string | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  image_url: string | null;
  is_available: boolean | null;
  restaurant_id: string | null;
  meal_type: string | null;
  prep_time_minutes: number | null;
  meal_diet_tags?: { diet_tag_id: string }[];
  restaurants?: { name: string } | null;
}

interface NutritionGoal {
  daily_calorie_target: number;
  protein_target_g: number;
  carbs_target_g: number;
  fat_target_g: number;
  fiber_target_g: number;
}

type MealType = "breakfast" | "lunch" | "dinner" | "snack";

const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

const CALORIE_TARGETS: Record<MealType, { percent: number; tolerance: number }> = {
  breakfast: { percent: 0.25, tolerance: 0.3 },
  lunch: { percent: 0.35, tolerance: 0.3 },
  dinner: { percent: 0.30, tolerance: 0.3 },
  snack: { percent: 0.10, tolerance: 0.5 },
};

const MEAL_TYPE_TIMES: Record<MealType, string> = {
  breakfast: "8:00 AM",
  lunch: "1:00 PM",
  dinner: "7:00 PM",
  snack: "3:00 PM",
};

interface MealPlanGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  onScheduled: () => void;
  isScheduleEmpty: boolean;
}

type PlanSlot = {
  date: Date;
  mealType: MealType;
  meal: Meal | null;
};

export const MealPlanGenerator = ({
  isOpen,
  onClose,
  onScheduled,
  isScheduleEmpty,
}: MealPlanGeneratorProps) => {
  const { user } = useAuth();
  const { t, isRTL } = useLanguage();
  const { toast: uiToast } = useToast();
  const { remainingMeals, isUnlimited, hasActiveSubscription } = useSubscription();
  const { favoriteIds } = useFavoriteRestaurants();

  const [phase, setPhase] = useState<"loading" | "preview" | "generating" | "applying" | "success">("loading");
  const [meals, setMeals] = useState<Meal[]>([]);
  const [dietTagIds, setDietTagIds] = useState<string[]>([]);
  const [nutritionGoal, setNutritionGoal] = useState<NutritionGoal | null>(null);
  const [plan, setPlan] = useState<PlanSlot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [swappingSlot, setSwappingSlot] = useState<string | null>(null);
  const [swapSheetOpen, setSwapSheetOpen] = useState(false);
  const [swapTarget, setSwapTarget] = useState<{ date: Date; mealType: MealType } | null>(null);
  const [swapSearch, setSwapSearch] = useState("");
  const [orderedMealIds, setOrderedMealIds] = useState<Set<string>>(new Set());
  const [orderedRestaurantIds, setOrderedRestaurantIds] = useState<Set<string>>(new Set());

  const weekDays = useMemo(() => {
    const days: Date[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < 7; i++) {
      days.push(addDays(today, i));
    }
    return days;
  }, []);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setPhase("loading");
    setError(null);

    try {
      const [mealsResult, prefsResult, goalsResult, ordersResult] = await Promise.all([
        supabase
          .from("meals")
          .select(`
            id, name, description, calories, protein_g, carbs_g, fat_g,
            fiber_g, image_url, is_available, restaurant_id, meal_type,
            prep_time_minutes,
            meal_diet_tags (diet_tag_id),
            restaurants (name)
          `)
          .eq("is_available", true)
          .order("name"),
        supabase
          .from("user_dietary_preferences")
          .select("diet_tag_id")
          .eq("user_id", user.id),
        supabase
          .from("nutrition_goals")
          .select("daily_calorie_target, protein_target_g, carbs_target_g, fat_target_g, fiber_target_g")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .maybeSingle(),
        supabase
          .from("user_orders_view")
          .select("meal_id, restaurant_id")
          .eq("user_id", user.id)
          .order("order_created_at", { ascending: false })
          .limit(50),
      ]);

      if (mealsResult.error) throw mealsResult.error;
      if (!mealsResult.data || mealsResult.data.length === 0) {
        setError("No meals available to generate a plan.");
        return;
      }

      setMeals(mealsResult.data as Meal[]);
      setDietTagIds((prefsResult.data || []).map((p) => p.diet_tag_id));
      setNutritionGoal(
        (goalsResult.data as NutritionGoal | null) || {
          daily_calorie_target: 2000,
          protein_target_g: 150,
          carbs_target_g: 200,
          fat_target_g: 67,
          fiber_target_g: 30,
        }
      );

      const orders = (ordersResult.data || []) as Array<{ meal_id: string; restaurant_id: string }>;
      setOrderedMealIds(new Set(orders.map(o => o.meal_id)));
      setOrderedRestaurantIds(new Set(orders.map(o => o.restaurant_id)));
    } catch (err) {
      console.error("Error fetching data for meal plan:", err);
      setError("Failed to load data. Please try again.");
    }
  }, [user]);

  useEffect(() => {
    if (!isOpen || !user) return;
    fetchData();
  }, [isOpen, user, fetchData]);

  const filterMealsForType = useCallback((allMeals: Meal[], mealType: MealType): Meal[] => {
    return allMeals.filter((m) => {
      const mealMealType = (m.meal_type || "").toLowerCase();
      if (mealMealType && mealMealType !== mealType) return false;

      if (dietTagIds.length > 0) {
        const mealTagIds = (m.meal_diet_tags || []).map((t) => t.diet_tag_id);
        if (mealTagIds.length > 0) {
          const hasMatchingTag = dietTagIds.some((dt) => mealTagIds.includes(dt));
          if (!hasMatchingTag) return false;
        }
      }

      return true;
    });
  }, [dietTagIds]);

  const scoreMeal = useCallback((meal: Meal, targetCal: number): number => {
    const cal = meal.calories || 0;
    const protein = meal.protein_g || 0;
    const calDelta = targetCal > 0 ? Math.abs(cal - targetCal) / targetCal : 1;
    let score = Math.max(0, 1 - calDelta);

    if (nutritionGoal && nutritionGoal.protein_target_g > 0) {
      const dailyProtein = nutritionGoal.protein_target_g;
      const mealProteinRatio = dailyProtein > 0 ? protein / (dailyProtein * 0.25) : 0;
      score += Math.min(mealProteinRatio, 1) * 0.3;
    }

    if (orderedMealIds.has(meal.id)) {
      score += 0.20;
    }

    if (meal.restaurant_id && favoriteIds.has(meal.restaurant_id)) {
      score += 0.15;
    }

    if (meal.restaurant_id && orderedRestaurantIds.has(meal.restaurant_id) && !orderedMealIds.has(meal.id)) {
      score += 0.08;
    }

    return score;
  }, [nutritionGoal, orderedMealIds, favoriteIds, orderedRestaurantIds]);

  const generatePlan = useCallback(() => {
    if (meals.length === 0 || !nutritionGoal) return;

    setPhase("generating");
    const newPlan: PlanSlot[] = [];
    const usedMealIds = new Set<string>();

    const dailyCalTarget = nutritionGoal.daily_calorie_target;

    for (const date of weekDays) {
      for (const mealType of MEAL_TYPES) {
        const targets = CALORIE_TARGETS[mealType];
        const targetCal = dailyCalTarget * targets.percent;

        let candidates = filterMealsForType(meals, mealType);
        if (candidates.length === 0) {
          candidates = meals.filter((m) => {
            const mealMealType = (m.meal_type || "").toLowerCase();
            return !mealMealType || mealMealType === mealType;
          });
        }

        const availableCandidates = candidates.filter((m) => !usedMealIds.has(m.id));

        let chosen: Meal | null = null;
        if (availableCandidates.length > 0) {
          const scored = availableCandidates.map((m) => ({
            meal: m,
            score: scoreMeal(m, targetCal),
          }));
          scored.sort((a, b) => b.score - a.score);
          chosen = scored[0].meal;
          usedMealIds.add(chosen.id);
        } else if (candidates.length > 0) {
          usedMealIds.clear();
          const scored = candidates.map((m) => ({
            meal: m,
            score: scoreMeal(m, targetCal),
          }));
          scored.sort((a, b) => b.score - a.score);
          chosen = scored[0].meal;
          usedMealIds.add(chosen.id);
        }

        newPlan.push({ date, mealType, meal: chosen });
      }
    }

    setPlan(newPlan);
    setPhase("preview");
  }, [meals, nutritionGoal, weekDays, filterMealsForType, scoreMeal]);

  useEffect(() => {
    if (meals.length > 0) {
      generatePlan();
    }
  }, [generatePlan, meals]);

  const getSwapAlternatives = useCallback(
    (date: Date, mealType: MealType) => {
      const currentMealId = plan.find(
        (s) =>
          format(s.date, "yyyy-MM-dd") === format(date, "yyyy-MM-dd") &&
          s.mealType === mealType
      )?.meal?.id;

      const usedMealIds = new Set(
        plan
          .filter(
            (s) =>
              !(
                format(s.date, "yyyy-MM-dd") === format(date, "yyyy-MM-dd") &&
                s.mealType === mealType
              )
          )
          .map((s) => s.meal?.id)
          .filter(Boolean) as string[]
      );

      const targets = CALORIE_TARGETS[mealType];
      const targetCal = (nutritionGoal?.daily_calorie_target || 2000) * targets.percent;

      let candidates = filterMealsForType(meals, mealType);
      if (candidates.length <= 1) {
        candidates = meals.filter((m) => {
          const mealMealType = (m.meal_type || "").toLowerCase();
          return !mealMealType || mealMealType === mealType;
        });
      }

      const availableCandidates = candidates.filter(
        (m) => m.id !== currentMealId && !usedMealIds.has(m.id)
      );

      const pool = availableCandidates.length > 0 ? availableCandidates : candidates.filter((m) => m.id !== currentMealId);

      return pool
        .map((m) => ({
          meal: m,
          score: scoreMeal(m, targetCal),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 8);
    },
    [plan, meals, nutritionGoal, filterMealsForType, scoreMeal]
  );

  const openSwapSheet = (date: Date, mealType: MealType) => {
    const alternatives = getSwapAlternatives(date, mealType);
    if (alternatives.length === 0) return;
    setSwapTarget({ date, mealType });
    setSwapSheetOpen(true);
  };

  const selectSwapMeal = (meal: Meal) => {
    if (!swapTarget) return;
    const { date, mealType } = swapTarget;
    const slotKey = `${format(date, "yyyy-MM-dd")}-${mealType}`;

    setSwappingSlot(slotKey);
    setSwapSheetOpen(false);

    setPlan((prev) =>
      prev.map((s) =>
        format(s.date, "yyyy-MM-dd") === format(date, "yyyy-MM-dd") && s.mealType === mealType
          ? { ...s, meal }
          : s
      )
    );

    setTimeout(() => setSwappingSlot(null), 400);
  };

  const swapAlternatives = swapTarget ? getSwapAlternatives(swapTarget.date, swapTarget.mealType) : [];

  const getDailyTotals = (date: Date) => {
    const slots = plan.filter((s) => format(s.date, "yyyy-MM-dd") === format(date, "yyyy-MM-dd"));
    return {
      calories: slots.reduce((sum, s) => sum + (s.meal?.calories || 0), 0),
      protein: slots.reduce((sum, s) => sum + (s.meal?.protein_g || 0), 0),
      carbs: slots.reduce((sum, s) => sum + (s.meal?.carbs_g || 0), 0),
      fat: slots.reduce((sum, s) => sum + (s.meal?.fat_g || 0), 0),
      filled: slots.filter((s) => s.meal !== null).length,
      total: slots.length,
    };
  };

  const handleApplyToSchedule = async () => {
    if (!user) return;
    setPhase("applying");

    const slotsToApply = plan.filter((s) => s.meal !== null);

    if (!hasActiveSubscription) {
      uiToast({
        title: "No active subscription",
        description: "You need an active meal plan to schedule meals.",
        variant: "destructive",
      });
      setPhase("preview");
      return;
    }

    if (!isUnlimited && slotsToApply.length > remainingMeals) {
      uiToast({
        title: "Not enough meal credits",
        description: `You have ${remainingMeals} meals left but need ${slotsToApply.length}.`,
        variant: "destructive",
      });
      setPhase("preview");
      return;
    }

    try {
      const inserts = slotsToApply.map((s) => ({
        user_id: user.id,
        meal_id: s.meal!.id,
        scheduled_date: format(s.date, "yyyy-MM-dd"),
        meal_type: s.mealType,
        delivery_time_slot: MEAL_TYPE_TIMES[s.mealType],
        order_status: "pending",
      }));

      const { error: insertError } = await supabase.from("meal_schedules").insert(inserts);
      if (insertError) throw insertError;

      setPhase("success");
      sonnerToast.success(`${inserts.length} meals scheduled for the week!`, {
        description: "Your week is now filled with healthy meals.",
        duration: 5000,
      });

      setTimeout(() => {
        onScheduled();
        setPhase("loading");
      }, 1500);
    } catch (err) {
      console.error("Error applying meal plan:", err);
      uiToast({
        title: "Failed to schedule meals",
        description: err instanceof Error ? err.message : "An error occurred",
        variant: "destructive",
      });
      setPhase("preview");
    }
  };

  const totalPlanCalories = plan.reduce((sum, s) => sum + (s.meal?.calories || 0), 0);
  const totalPlanProtein = plan.reduce((sum, s) => sum + (s.meal?.protein_g || 0), 0);
  const filledSlots = plan.filter((s) => s.meal !== null).length;

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-black overflow-y-auto"
    >
      <div className="sticky top-0 z-10 bg-white/90 dark:bg-gray-900/90 backdrop-blur-2xl border-b border-gray-100 dark:border-gray-800 safe-top">
        <div className="flex items-center justify-between px-4 h-16">
          <button
            onClick={onClose}
            className="w-11 h-11 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center cursor-pointer active:scale-95 transition-all"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600 dark:text-gray-300" />
          </button>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">Fill My Week</h1>
          </div>
          <div className="w-11" />
        </div>
      </div>

      <AnimatePresence mode="wait">
        {phase === "loading" && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center min-h-[70vh] p-6"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 flex items-center justify-center mb-6"
            >
              <Sparkles className="h-10 w-10 text-amber-500" />
            </motion.div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Crafting your week</h2>
            <p className="text-sm text-gray-400">Finding the best meals for your goals...</p>
          </motion.div>
        )}

        {phase === "preview" && (
          <motion.div
            key="preview"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="max-w-lg mx-auto px-4 pb-32"
          >
            {/* Summary header */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 dark:from-gray-800 dark:via-gray-900 dark:to-black rounded-3xl p-5 mb-4 shadow-xl"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-bold text-base">Weekly Plan Summary</h3>
                <button
                  onClick={() => { dietTagIds.forEach(() => {}); generatePlan(); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 rounded-xl text-white text-xs font-semibold active:scale-95 transition-all cursor-pointer"
                >
                  <RotateCw className="h-3.5 w-3.5" />
                  Regenerate
                </button>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div className="text-center">
                  <p className="text-2xl font-black text-white">{totalPlanCalories.toLocaleString()}</p>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">Cals/Day</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-black text-white">{Math.round(totalPlanProtein / 7)}g</p>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">Protein</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-black text-white">
                    {plan.length}
                  </p>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">Slots</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-black text-white">
                    {filledSlots}/{plan.length}
                  </p>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">Filled</p>
                </div>
              </div>
            </motion.div>

            {/* Daily plans */}
            {weekDays.map((day, dayIndex) => {
              const daily = getDailyTotals(day);
              const daySlots = plan.filter(
                (s) => format(s.date, "yyyy-MM-dd") === format(day, "yyyy-MM-dd")
              );
              const isToday = format(day, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");

              return (
                <motion.div
                  key={format(day, "yyyy-MM-dd")}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: dayIndex * 0.05 }}
                  className="mb-3"
                >
                  <div className="flex items-center justify-between px-1 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-900 dark:text-white">
                        {format(day, "EEEE")}
                      </span>
                      {isToday && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                          Today
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400">
                      {daily.calories.toLocaleString()} kcal · {daily.protein}g protein
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {MEAL_TYPES.map((mealType) => {
                      const slot = daySlots.find((s) => s.mealType === mealType);
                      const cfg = MEAL_TYPE_CONFIG[mealType];
                      const Icon = cfg.icon;
                      const slotKey = `${format(day, "yyyy-MM-dd")}-${mealType}`;
                      const isSwapping = swappingSlot === slotKey;

                      return (
                        <div
                          key={mealType}
                          className={cn(
                            "relative bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-800 transition-all",
                            isSwapping && "opacity-60"
                          )}
                        >
                          <div className={cn("absolute left-0 top-0 bottom-0 w-1", `bg-gradient-to-b ${cfg.gradient}`)} />

                          {slot?.meal ? (
                            <div className="flex items-center gap-3 p-3 pl-4">
                              {slot.meal.image_url ? (
                                <img
                                  src={slot.meal.image_url}
                                  alt={slot.meal.name}
                                  className="w-14 h-14 rounded-xl object-cover shadow-sm"
                                />
                              ) : (
                                <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${cfg.bgGradient}`}>
                                  <Icon className={`h-6 w-6 ${cfg.textColor}`} />
                                </div>
                              )}

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className={`text-[10px] font-bold uppercase tracking-wider ${cfg.textColor}`}>
                                    {cfg.label}
                                  </span>
                                  <span className="text-[10px] text-gray-300">·</span>
                                  <span className="text-[10px] text-gray-400 flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {cfg.time}
                                  </span>
                                </div>
                                <h4 className="text-sm font-bold text-gray-900 dark:text-white truncate">
                                  {slot.meal.name}
                                </h4>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${cfg.bgGradient} ${cfg.textColor}`}>
                                    {slot.meal.calories} kcal
                                  </span>
                                  <span className="text-[10px] text-gray-400">{slot.meal.protein_g}g protein</span>
                                </div>
                              </div>

                              <button
                                onClick={() => openSwapSheet(day, mealType)}
                                className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0 cursor-pointer active:scale-95 transition-all"
                              >
                                <Shuffle className="h-4 w-4 text-gray-400" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3 p-3 pl-4">
                              <div className="w-14 h-14 rounded-xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center">
                                <Icon className="h-6 w-6 text-gray-300" />
                              </div>
                              <div className="flex-1">
                                <span className={`text-[10px] font-bold uppercase tracking-wider ${cfg.textColor}`}>
                                  {cfg.label}
                                </span>
                                <p className="text-xs text-gray-400">No suitable meal found</p>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              );
            })}


          </motion.div>
        )}

        {/* ── Apply to Schedule Footer ── */}
        {phase === "preview" && (
          <div
            className="sticky bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-gray-100 px-4 pt-3"
            style={{ paddingBottom: 'max(5.5rem, calc(env(safe-area-inset-bottom) + 5rem))' }}
          >
            <motion.button
              onClick={handleApplyToSchedule}
              whileTap={{ scale: 0.98 }}
              disabled={filledSlots === 0}
              className="flex h-[58px] w-full items-center justify-center gap-3 rounded-[22px] bg-gradient-to-r from-emerald-400 to-teal-500 text-[17px] font-extrabold tracking-[-0.02em] text-white shadow-[0_10px_24px_rgba(16,185,129,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle2 className="h-6 w-6" strokeWidth={2.25} />
              Apply {filledSlots} Meals to Schedule
            </motion.button>
          </div>
        )}

        {phase === "applying" && (
          <motion.div
            key="applying"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center min-h-[70vh] p-6"
          >
            <Loader2 className="h-16 w-16 text-emerald-500 animate-spin mb-6" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Scheduling meals...</h2>
            <p className="text-sm text-gray-400">Adding {filledSlots} meals to your week</p>
          </motion.div>
        )}

        {phase === "success" && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center min-h-[70vh] p-6"
          >
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
              className="w-32 h-32 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center mb-6 shadow-2xl shadow-emerald-500/50"
            >
              <Check className="h-16 w-16 text-white" strokeWidth={3} />
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-3xl font-black text-gray-900 dark:text-white mb-2"
            >
              Week Filled!
            </motion.h2>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-gray-500 text-center"
            >
              {filledSlots} meals have been added to your schedule
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      <Sheet open={swapSheetOpen} onOpenChange={(open) => { setSwapSheetOpen(open); if (!open) setSwapSearch(""); }}>
        <SheetContent
          side="bottom"
          className="h-[65vh] rounded-t-[24px] p-0 overflow-hidden"
          closeButtonClassName="top-3 right-3 h-9 w-9 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
        >
          <SheetHeader className="p-4 pb-1 text-left">
            <SheetTitle className="text-base font-bold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              {swapTarget ? `Choose ${MEAL_TYPE_CONFIG[swapTarget.mealType].label}` : "Choose a meal"}
            </SheetTitle>
          </SheetHeader>

          <div className="px-4 pb-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search restaurant..."
                value={swapSearch}
                onChange={(e) => setSwapSearch(e.target.value)}
                className="w-full h-10 pl-9 pr-4 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 border-0 outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all"
              />
            </div>
          </div>

          <div className="overflow-y-auto px-4 pb-6 max-h-[calc(65vh-145px)]">
            {swapAlternatives.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <AlertTriangle className="h-10 w-10 mb-3 opacity-40" />
                <p className="text-sm">No alternative meals available</p>
              </div>
            ) : (
              <div className="space-y-4">
                {(() => {
                  const grouped = swapAlternatives.reduce<Record<string, { meal: Meal; score: number }[]>>((acc, item) => {
                    const restName = item.meal.restaurants?.name || "Other";
                    if (!acc[restName]) acc[restName] = [];
                    acc[restName].push(item);
                    return acc;
                  }, {});

                  const query = swapSearch.toLowerCase().trim();
                  const filtered = query
                    ? Object.entries(grouped).filter(([restName]) =>
                        restName.toLowerCase().includes(query)
                      )
                    : Object.entries(grouped);

                  return filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                      <Search className="h-8 w-8 mb-2 opacity-40" />
                      <p className="text-sm">No restaurants match &quot;{swapSearch}&quot;</p>
                    </div>
                  ) : filtered.map(([restaurantName, items], gIdx) => (
                    <div key={restaurantName}>
                      <motion.div
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: gIdx * 0.08 }}
                        className="flex items-center gap-2 px-1 mb-2"
                      >
                        <Store className="h-3.5 w-3.5 text-gray-400" />
                        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                          {restaurantName}
                        </span>
                        <span className="text-[10px] text-gray-300 ml-auto">{items.length} meals</span>
                      </motion.div>

                      <div className="space-y-1.5">
                        {items.map(({ meal, score }, idx) => {
                          const mealTypeKey = (meal.meal_type?.toLowerCase() || "") as MealType;
                          const cfg = MEAL_TYPE_CONFIG[mealTypeKey] || MEAL_TYPE_CONFIG.snack;
                          const Icon = cfg.icon;
                          const fitPct = Math.round(score * 100);
                          const fitColor =
                            fitPct >= 90 ? "text-emerald-500" :
                            fitPct >= 70 ? "text-amber-500" :
                            "text-gray-400";

                          return (
                            <motion.button
                              key={meal.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: (gIdx * 0.08) + (idx * 0.03) }}
                              onClick={() => selectSwapMeal(meal)}
                              className="w-full flex items-center gap-3 p-3 bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 active:scale-[0.98] transition-all text-left cursor-pointer"
                            >
                              {meal.image_url ? (
                                <img
                                  src={meal.image_url}
                                  alt={meal.name}
                                  className="w-14 h-14 rounded-xl object-cover shrink-0 shadow-sm"
                                />
                              ) : (
                                <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${cfg.bgGradient}`}>
                                  <Icon className={`h-6 w-6 ${cfg.textColor}`} />
                                </div>
                              )}

                              <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-bold text-gray-900 dark:text-white truncate">
                                  {meal.name}
                                </h4>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                  <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-300">
                                    {meal.calories} kcal
                                  </span>
                                  <span className="text-gray-200">·</span>
                                  <span className="text-[11px] text-gray-500">
                                    {meal.protein_g}g protein
                                  </span>
                                  {meal.carbs_g != null && (
                                    <>
                                      <span className="text-gray-200">·</span>
                                      <span className="text-[11px] text-gray-500">
                                        {meal.carbs_g}g carbs
                                      </span>
                                    </>
                                  )}
                                </div>
                                <div className={`flex items-center gap-1 mt-1 ${fitColor}`}>
                                  <Target className="h-3 w-3" />
                                  <span className="text-[10px] font-bold">{fitPct}% fit</span>
                                </div>
                              </div>
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <style>{`
        .safe-top {
          padding-top: env(safe-area-inset-top, 0px);
        }
        .safe-bottom {
          padding-bottom: env(safe-area-inset-bottom, 0px);
        }
      `}</style>
    </motion.div>
  );
};

export type { MealType };
