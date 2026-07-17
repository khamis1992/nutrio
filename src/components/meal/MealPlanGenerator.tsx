import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { useFavoriteRestaurants } from "@/hooks/useFavoriteRestaurants";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import {
  Coffee,
  Sun,
  Moon,
  Apple,
  Check,
  X,
  Clock,
  Sparkles,
  Loader2,
  Shuffle,
  RotateCw,
  CheckCircle2,
  AlertTriangle,
  Target,
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
import { scheduleMealsAtomic, type ScheduleMealInput } from "@/lib/schedule-meals";
import ScheduleWeekTools from "@/components/schedule/ScheduleWeekTools";
import type { ScheduleTemplateSource } from "@/lib/schedule-templates";

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

type PublicMealCatalogRow = Omit<Meal, "meal_diet_tags" | "restaurants"> & {
  restaurant_name: string | null;
};

type LegacyMealCatalogRow = Omit<Meal, "meal_diet_tags"> & {
  restaurants?: { name: string } | { name: string }[] | null;
};

function isMissingPublicMealCatalog(error: { code?: string; message?: string }): boolean {
  const message = error.message?.toLowerCase() || "";
  return error.code === "PGRST205"
    || error.code === "42P01"
    || (message.includes("public_meal_catalog")
      && (message.includes("could not find") || message.includes("does not exist")));
}

function getLegacyRestaurantName(
  restaurant: LegacyMealCatalogRow["restaurants"],
): string | null {
  if (Array.isArray(restaurant)) return restaurant[0]?.name ?? null;
  return restaurant?.name ?? null;
}

interface NutritionGoal {
  daily_calorie_target: number;
  protein_target_g: number;
  carbs_target_g: number;
  fat_target_g: number;
  fiber_target_g: number;
}

type MealType = "breakfast" | "lunch" | "dinner" | "snack";
type SwapFilter = "best" | "protein" | "under_500";

const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

const MEAL_TYPE_CONFIG = {
  breakfast: {
    icon: Coffee,
    label: "breakfast",
    gradient: "from-amber-400 to-orange-500",
    bgGradient: "bg-gradient-to-br from-amber-50 to-orange-50",
    textColor: "text-amber-600",
    bgColor: "bg-amber-100",
    borderColor: "border-amber-200",
    ringColor: "ring-amber-400",
    shadowColor: "shadow-amber-500/20",
    nutritionBg: "bg-gradient-to-br from-amber-50 to-orange-50",
    nutritionBorder: "border-amber-100",
  },
  lunch: {
    icon: Sun,
    label: "lunch",
    gradient: "from-emerald-400 to-teal-500",
    bgGradient: "bg-gradient-to-br from-emerald-50 to-teal-50",
    textColor: "text-emerald-600",
    bgColor: "bg-emerald-100",
    borderColor: "border-emerald-200",
    ringColor: "ring-emerald-400",
    shadowColor: "shadow-emerald-500/20",
    nutritionBg: "bg-gradient-to-br from-emerald-50 to-teal-50",
    nutritionBorder: "border-emerald-100",
  },
  dinner: {
    icon: Moon,
    label: "dinner",
    gradient: "from-indigo-400 to-purple-500",
    bgGradient: "bg-gradient-to-br from-indigo-50 to-purple-50",
    textColor: "text-indigo-600",
    bgColor: "bg-indigo-100",
    borderColor: "border-indigo-200",
    ringColor: "ring-indigo-400",
    shadowColor: "shadow-indigo-500/20",
    nutritionBg: "bg-gradient-to-br from-indigo-50 to-purple-50",
    nutritionBorder: "border-indigo-100",
  },
  snack: {
    icon: Apple,
    label: "snack",
    gradient: "from-pink-400 to-rose-500",
    bgGradient: "bg-gradient-to-br from-pink-50 to-rose-50",
    textColor: "text-pink-600",
    bgColor: "bg-pink-100",
    borderColor: "border-pink-200",
    ringColor: "ring-pink-400",
    shadowColor: "shadow-pink-500/20",
    nutritionBg: "bg-gradient-to-br from-pink-50 to-rose-50",
    nutritionBorder: "border-pink-100",
  },
};

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
  userId: string;
  weekStart: Date;
  weekSchedules: ScheduleTemplateSource[];
  weekToolsApplying?: boolean;
  onApplyWeekTemplate: (items: ScheduleMealInput[]) => Promise<void>;
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
  userId,
  weekStart,
  weekSchedules,
  weekToolsApplying = false,
  onApplyWeekTemplate,
}: MealPlanGeneratorProps) => {
  const { user } = useAuth();
  const { isRTL } = useLanguage();
  const { toast: uiToast } = useToast();
  const { remainingMeals, isUnlimited, hasActiveSubscription, subscription, refetch: refetchSubscription } = useSubscription();
  const { favoriteIds } = useFavoriteRestaurants();

  const [phase, setPhase] = useState<"loading" | "preview" | "generating" | "applying" | "success">("loading");
  const [meals, setMeals] = useState<Meal[]>([]);
  const [dietTagIds, setDietTagIds] = useState<string[]>([]);
  const [nutritionGoal, setNutritionGoal] = useState<NutritionGoal | null>(null);
  const [plan, setPlan] = useState<PlanSlot[]>([]);
  const [swappingSlot, setSwappingSlot] = useState<string | null>(null);
  const [swapSheetOpen, setSwapSheetOpen] = useState(false);
  const [swapTarget, setSwapTarget] = useState<{ date: Date; mealType: MealType } | null>(null);
  const [swapSearch, setSwapSearch] = useState("");
  const [swapFilter, setSwapFilter] = useState<SwapFilter>("best");
  const [selectedPreviewDay, setSelectedPreviewDay] = useState(0);
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

    try {
      const publicCatalogResult = await supabase
        .from("public_meal_catalog" as "meals")
        .select(`
          id, name, description, calories, protein_g, carbs_g, fat_g,
          fiber_g, image_url, is_available, restaurant_id, restaurant_name,
          meal_type, prep_time_minutes
        `)
        .eq("is_available", true)
        .order("name");

      let catalogMeals: PublicMealCatalogRow[];
      if (publicCatalogResult.error) {
        if (!isMissingPublicMealCatalog(publicCatalogResult.error)) {
          throw publicCatalogResult.error;
        }

        // Compatibility for environments where the projection migration has
        // not been applied yet. RLS on meals remains the authorization layer.
        const legacyCatalogResult = await supabase
          .from("meals")
          .select(`
            id, name, description, calories, protein_g, carbs_g, fat_g,
            fiber_g, image_url, is_available, restaurant_id, meal_type,
            prep_time_minutes, restaurants (name)
          `)
          .eq("is_available", true)
          .order("name");

        if (legacyCatalogResult.error) throw legacyCatalogResult.error;

        const legacyMeals = (legacyCatalogResult.data || []) as LegacyMealCatalogRow[];
        catalogMeals = legacyMeals.map(({ restaurants, ...meal }) => ({
          ...meal,
          restaurant_name: getLegacyRestaurantName(restaurants),
        }));
      } else {
        catalogMeals = (publicCatalogResult.data || []) as unknown as PublicMealCatalogRow[];
      }

      if (catalogMeals.length === 0) {
        sonnerToast.error("No meals available to generate a plan.");
        return;
      }

      const mealIds = catalogMeals.map((meal) => meal.id);
      const [prefsResult, goalsResult, ordersResult, tagsResult] = await Promise.all([
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
        supabase
          .from("meal_diet_tags")
          .select("meal_id, diet_tag_id")
          .in("meal_id", mealIds),
      ]);

      if (prefsResult.error) {
        console.warn("Could not load dietary preferences for meal plan", prefsResult.error);
      }
      if (goalsResult.error) {
        console.warn("Could not load nutrition goal for meal plan", goalsResult.error);
      }
      if (ordersResult.error) {
        console.warn("Could not load order history for meal plan", ordersResult.error);
      }
      if (tagsResult.error) {
        console.warn("Could not load meal diet tags for meal plan", tagsResult.error);
      }

      const tagsByMeal = new Map<string, { diet_tag_id: string }[]>();
      for (const tag of tagsResult.data || []) {
        const currentTags = tagsByMeal.get(tag.meal_id) || [];
        currentTags.push({ diet_tag_id: tag.diet_tag_id });
        tagsByMeal.set(tag.meal_id, currentTags);
      }

      setMeals(catalogMeals.map(({ restaurant_name, ...meal }) => ({
        ...meal,
        meal_diet_tags: tagsByMeal.get(meal.id) || [],
        restaurants: restaurant_name ? { name: restaurant_name } : null,
      })));
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
      sonnerToast.error("Failed to load data. Please try again.");
    }
  }, [user]);

  useEffect(() => {
    if (!isOpen || !user) return;
    setSelectedPreviewDay(0);
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
    setSwapSearch("");
    setSwapFilter("best");
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
  const currentSwapMeal = swapTarget
    ? plan.find(
      (slot) =>
        format(slot.date, "yyyy-MM-dd") === format(swapTarget.date, "yyyy-MM-dd") &&
        slot.mealType === swapTarget.mealType,
    )?.meal
    : null;
  const swapQuery = swapSearch.trim().toLowerCase();
  const filteredSwapAlternatives = swapAlternatives
    .filter(({ meal }) => {
      const searchable = `${meal.name} ${meal.restaurants?.name || ""}`.toLowerCase();
      if (swapQuery && !searchable.includes(swapQuery)) return false;
      if (swapFilter === "protein") return Number(meal.protein_g || 0) >= 30;
      if (swapFilter === "under_500") return Number(meal.calories || 0) > 0 && Number(meal.calories) <= 500;
      return true;
    })
    .sort((a, b) => b.score - a.score);

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
      if (!subscription?.id) throw new Error("SUBSCRIPTION_NOT_FOUND");

      const items: ScheduleMealInput[] = slotsToApply.map((s) => ({
        meal_id: s.meal!.id,
        scheduled_date: format(s.date, "yyyy-MM-dd"),
        meal_type: s.mealType as ScheduleMealInput["meal_type"],
        delivery_time_slot: MEAL_TYPE_TIMES[s.mealType],
      }));

      await scheduleMealsAtomic(subscription.id, items);

      await refetchSubscription();

      setPhase("success");
      sonnerToast.success(`${items.length} meals scheduled for the week!`, {
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
  const averageDailyCalories = Math.round(totalPlanCalories / Math.max(weekDays.length, 1));
  const averageDailyProtein = Math.round(totalPlanProtein / Math.max(weekDays.length, 1));
  const previewTemplateSources = useMemo<ScheduleTemplateSource[]>(() => {
    const dayKeys = new Map(
      weekDays.map((day, index) => [format(day, "yyyy-MM-dd"), index]),
    );

    return plan
      .filter((slot): slot is PlanSlot & { meal: Meal } => Boolean(slot.meal))
      .map((slot) => {
        const dayIndex = dayKeys.get(format(slot.date, "yyyy-MM-dd")) ?? 0;
        return {
          scheduled_date: format(addDays(weekStart, dayIndex), "yyyy-MM-dd"),
          meal_type: slot.mealType,
          meal_id: slot.meal.id,
          delivery_time_slot: MEAL_TYPE_TIMES[slot.mealType],
          meal: {
            name: slot.meal.name,
            calories: slot.meal.calories ?? 0,
            protein_g: slot.meal.protein_g ?? 0,
          },
        };
      });
  }, [plan, weekDays, weekStart]);
  const weekToolSchedules =
    previewTemplateSources.length > 0 ? previewTemplateSources : weekSchedules;

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 overflow-y-auto bg-[#F6F8FB] text-[#020617]"
      dir={isRTL ? "rtl" : "ltr"}
    >
      <div className="sticky top-0 z-20 border-b border-[#E5EAF1] bg-white/95 backdrop-blur-xl safe-top">
        <div className="mx-auto flex h-16 max-w-[430px] items-center justify-between px-4">
          <button
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F6F8FB] text-[#020617] ring-1 ring-[#E5EAF1] active:scale-95"
            aria-label="Close weekly planner"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#7C83F6]">Smart planner</p>
            <h1 className="mt-0.5 text-[17px] font-black text-[#020617]">Fill my week</h1>
          </div>
          <ScheduleWeekTools
            userId={userId}
            weekStart={weekStart}
            schedules={weekToolSchedules}
            applying={weekToolsApplying}
            onApply={onApplyWeekTemplate}
            onCreateSchedule={() => setPhase("preview")}
            variant="compact"
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        {phase === "loading" && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex min-h-[70vh] flex-col items-center justify-center p-6"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="mb-6 flex h-20 w-20 items-center justify-center rounded-[24px] bg-[#E9FBF6] text-[#22C7A1] ring-1 ring-[#22C7A1]/15"
            >
              <Sparkles className="h-9 w-9" />
            </motion.div>
            <h2 className="mb-2 text-[21px] font-black text-[#020617]">Building your meal plan</h2>
            <p className="text-center text-[13px] font-medium text-[#64748B]">Matching available meals with your nutrition goals.</p>
          </motion.div>
        )}

        {phase === "preview" && (
          <motion.div
            key="preview"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mx-auto max-w-[430px] px-4 pb-32 pt-4"
          >
            {/* Summary header */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 rounded-[22px] bg-white p-4 shadow-[0_8px_24px_rgba(2,6,23,0.05)] ring-1 ring-[#E5EAF1]"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#22C7A1]">Your week is ready</p>
                  <h3 className="mt-1 text-[20px] font-black text-[#020617]">{filledSlots} meals selected</h3>
                  <p className="mt-1 text-[11px] font-semibold text-[#64748B]">Review each day and swap anything you want.</p>
                </div>
                <button
                  onClick={() => { dietTagIds.forEach(() => {}); generatePlan(); }}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F6F8FB] text-[#020617] ring-1 ring-[#E5EAF1] active:scale-95"
                  aria-label="Regenerate meal plan"
                >
                  <RotateCw className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-3 divide-x divide-[#E5EAF1] rounded-[16px] bg-[#F6F8FB] py-3 ring-1 ring-[#E5EAF1] rtl:divide-x-reverse">
                <div className="text-center">
                  <p className="text-[17px] font-black tabular-nums text-[#020617]">{averageDailyCalories.toLocaleString()}</p>
                  <p className="mt-0.5 text-[9px] font-black uppercase text-[#94A3B8]">kcal / day</p>
                </div>
                <div className="text-center">
                  <p className="text-[17px] font-black tabular-nums text-[#7C83F6]">{averageDailyProtein}g</p>
                  <p className="mt-0.5 text-[9px] font-black uppercase text-[#94A3B8]">protein / day</p>
                </div>
                <div className="text-center">
                  <p className="text-[17px] font-black tabular-nums text-[#22C7A1]">{isUnlimited ? "∞" : remainingMeals}</p>
                  <p className="mt-0.5 text-[9px] font-black uppercase text-[#94A3B8]">meals left</p>
                </div>
              </div>
            </motion.div>

            {/* Daily plans */}
            <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-2 scrollbar-hide">
              {weekDays.map((day, index) => {
                const active = selectedPreviewDay === index;
                const daily = getDailyTotals(day);
                return (
                  <button
                    key={`picker-${format(day, "yyyy-MM-dd")}`}
                    onClick={() => setSelectedPreviewDay(index)}
                    className={cn(
                      "flex h-[64px] min-w-[58px] shrink-0 flex-col items-center justify-center rounded-[16px] ring-1 transition active:scale-95",
                      active
                        ? "bg-[#020617] text-white ring-[#020617] shadow-[0_10px_22px_rgba(2,6,23,0.18)]"
                        : "bg-white text-[#020617] ring-[#E5EAF1]",
                    )}
                  >
                    <span className={cn("text-[9px] font-black uppercase", active ? "text-white/60" : "text-[#94A3B8]")}>{format(day, "EEE")}</span>
                    <span className="mt-1 text-[17px] font-black">{format(day, "d")}</span>
                    <span className={cn("mt-1 h-1 w-4 rounded-full", active ? "bg-[#22C7A1]" : daily.calories > 0 ? "bg-[#7C83F6]" : "bg-transparent")} />
                  </button>
                );
              })}
            </div>

            {weekDays.map((day, dayIndex) => {
              if (dayIndex !== selectedPreviewDay) return null;
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
                  <div className="mb-3 flex items-end justify-between gap-3 px-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[20px] font-black text-[#020617]">
                        {format(day, "EEEE")}
                      </span>
                      {isToday && (
                        <span className="rounded-full bg-[#E9FBF6] px-2 py-0.5 text-[9px] font-black text-[#22C7A1]">
                          Today
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-extrabold text-[#64748B]">
                      {daily.calories.toLocaleString()} kcal · {daily.protein}g protein
                    </span>
                  </div>

                  <div className="space-y-2.5">
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
                            "relative overflow-hidden rounded-[20px] bg-white shadow-[0_7px_20px_rgba(2,6,23,0.045)] ring-1 ring-[#E5EAF1] transition",
                            isSwapping && "opacity-60"
                          )}
                        >
                          {slot?.meal ? (
                            <div className="flex min-h-[82px] items-center gap-3 p-3">
                              {slot.meal.image_url ? (
                                <img
                                  src={slot.meal.image_url}
                                  alt={slot.meal.name}
                                  className="h-14 w-14 shrink-0 rounded-[15px] object-cover"
                                />
                              ) : (
                                <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-[15px] ${cfg.bgGradient}`}>
                                  <Icon className={`h-6 w-6 ${cfg.textColor}`} />
                                </div>
                              )}

                              <div className="min-w-0 flex-1">
                                <div className="mb-0.5 flex items-center gap-1.5">
                                  <span className={`text-[9px] font-black uppercase tracking-[0.1em] ${cfg.textColor}`}>
                                    {cfg.label}
                                  </span>
                                  <span className="text-[10px] text-gray-300">·</span>
                                  <span className="flex items-center gap-1 text-[10px] font-bold text-[#94A3B8]">
                                    <Clock className="h-3 w-3" />
                                    {MEAL_TYPE_TIMES[mealType]}
                                  </span>
                                </div>
                                <h4 className="truncate text-[14px] font-black text-[#020617]">
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
                                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F6F8FB] text-[#64748B] ring-1 ring-[#E5EAF1] active:scale-95"
                                aria-label={`Swap ${cfg.label}`}
                              >
                                <Shuffle className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex min-h-[82px] items-center gap-3 p-3">
                              <div className="flex h-14 w-14 items-center justify-center rounded-[15px] bg-[#F6F8FB]">
                                <Icon className="h-5 w-5 text-[#CBD5E1]" />
                              </div>
                              <div className="flex-1">
                                <span className={`text-[10px] font-bold uppercase tracking-wider ${cfg.textColor}`}>
                                  {cfg.label}
                                </span>
                                <p className="text-[11px] font-semibold text-[#94A3B8]">No suitable meal found</p>
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
            className="sticky bottom-0 left-0 right-0 z-20 border-t border-[#E5EAF1] bg-white/95 px-4 pt-3 backdrop-blur-xl"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
          >
            <motion.button
              onClick={handleApplyToSchedule}
              whileTap={{ scale: 0.98 }}
              disabled={filledSlots === 0}
              className="mx-auto flex h-14 w-full max-w-[398px] items-center justify-center gap-2.5 rounded-[20px] bg-[#22C7A1] text-[15px] font-black text-white shadow-[0_12px_26px_rgba(34,199,161,0.26)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CheckCircle2 className="h-5 w-5" strokeWidth={2.4} />
              Add {filledSlots} meals to my schedule
            </motion.button>
          </div>
        )}

        {phase === "applying" && (
          <motion.div
            key="applying"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex min-h-[70vh] flex-col items-center justify-center p-6"
          >
            <Loader2 className="mb-6 h-12 w-12 animate-spin text-[#22C7A1]" />
            <h2 className="mb-2 text-[21px] font-black text-[#020617]">Adding your meals</h2>
            <p className="text-[13px] font-medium text-[#64748B]">Scheduling {filledSlots} meals across the week.</p>
          </motion.div>
        )}

        {phase === "success" && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex min-h-[70vh] flex-col items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
              className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-[#E9FBF6] text-[#22C7A1] ring-1 ring-[#22C7A1]/20"
            >
              <Check className="h-11 w-11" strokeWidth={3} />
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mb-2 text-[28px] font-black text-[#020617]"
            >
              Week Filled!
            </motion.h2>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-center text-[13px] font-medium text-[#64748B]"
            >
              {filledSlots} meals have been added to your schedule
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      <Sheet open={swapSheetOpen} onOpenChange={(open) => { setSwapSheetOpen(open); if (!open) { setSwapSearch(""); setSwapFilter("best"); } }}>
        <SheetContent
          side="bottom"
          className="h-[72vh] overflow-hidden rounded-t-[28px] border-[#E5EAF1] bg-white p-0"
          closeButtonClassName="top-3 right-3 h-10 w-10 rounded-full bg-[#F6F8FB] text-[#020617] hover:bg-[#EDF1F5]"
        >
          <SheetHeader className="p-4 pb-2 text-left">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#7C83F6]">Replace meal</p>
            <SheetTitle className="mt-1 text-[20px] font-black text-[#020617]">
              {swapTarget ? `Choose a new ${MEAL_TYPE_CONFIG[swapTarget.mealType].label}` : "Choose a meal"}
            </SheetTitle>
            {swapTarget ? (
              <p className="mt-1 truncate pr-12 text-[11px] font-semibold text-[#64748B]">
                {format(swapTarget.date, "EEEE, MMM d")} · Replacing {currentSwapMeal?.name || "current meal"}
              </p>
            ) : null}
          </SheetHeader>

          <div className="px-4 pb-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
              <input
                type="text"
                placeholder="Search meals or restaurants"
                value={swapSearch}
                onChange={(e) => setSwapSearch(e.target.value)}
                className="h-11 w-full rounded-[15px] bg-[#F6F8FB] pl-9 pr-4 text-[13px] font-bold text-[#020617] outline-none ring-1 ring-[#E5EAF1] placeholder:text-[#94A3B8] focus:ring-[#22C7A1]/40"
              />
            </div>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {([
                { id: "best", label: "Best match" },
                { id: "protein", label: "High protein" },
                { id: "under_500", label: "Under 500 kcal" },
              ] as Array<{ id: SwapFilter; label: string }>).map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setSwapFilter(filter.id)}
                  className={cn(
                    "h-10 shrink-0 rounded-full px-4 text-[11px] font-extrabold ring-1 transition active:scale-95",
                    swapFilter === filter.id
                      ? "bg-[#020617] text-white ring-[#020617]"
                      : "bg-white text-[#64748B] ring-[#E5EAF1]",
                  )}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          <div className="max-h-[calc(72vh-220px)] overflow-y-auto px-4 pb-6">
            {filteredSwapAlternatives.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <AlertTriangle className="h-10 w-10 mb-3 opacity-40" />
                <p className="text-sm">No meals match these filters</p>
                <button
                  type="button"
                  onClick={() => { setSwapSearch(""); setSwapFilter("best"); }}
                  className="mt-4 h-10 rounded-full bg-[#020617] px-4 text-[12px] font-extrabold text-white"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {(() => {
                  const filtered: Array<[string, { meal: Meal; score: number }[]]> = [
                    ["Top matches", filteredSwapAlternatives],
                  ];

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
                        <Target className="h-3.5 w-3.5 text-[#22C7A1]" />
                        <span className="text-[11px] font-black uppercase tracking-wider text-[#64748B]">
                          {restaurantName}
                        </span>
                        <span className="ml-auto text-[10px] font-bold text-[#94A3B8]">{items.length} options</span>
                      </motion.div>

                      <div className="space-y-1.5">
                        {items.map(({ meal, score }, idx) => {
                          const mealTypeKey = (meal.meal_type?.toLowerCase() || "") as MealType;
                          const cfg = MEAL_TYPE_CONFIG[mealTypeKey] || MEAL_TYPE_CONFIG.snack;
                          const Icon = cfg.icon;
                          const fitPct = Math.min(100, Math.max(0, Math.round(score * 100)));
                          const fitColor =
                            fitPct >= 90 ? "text-[#22C7A1]" :
                            fitPct >= 70 ? "text-[#7C83F6]" :
                            "text-[#94A3B8]";

                          return (
                            <motion.button
                              key={meal.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: (gIdx * 0.08) + (idx * 0.03) }}
                              onClick={() => selectSwapMeal(meal)}
                              className="flex w-full cursor-pointer items-center gap-3 rounded-[18px] bg-white p-3 text-left shadow-[0_6px_18px_rgba(2,6,23,0.04)] ring-1 ring-[#E5EAF1] transition active:scale-[0.98]"
                            >
                              {meal.image_url ? (
                                <img
                                  src={meal.image_url}
                                  alt={meal.name}
                                  className="h-14 w-14 shrink-0 rounded-[15px] object-cover"
                                />
                              ) : (
                                <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${cfg.bgGradient}`}>
                                  <Icon className={`h-6 w-6 ${cfg.textColor}`} />
                                </div>
                              )}

                              <div className="flex-1 min-w-0">
                                <h4 className="truncate text-[14px] font-black text-[#020617]">
                                  {meal.name}
                                </h4>
                                <p className="mt-0.5 truncate text-[10px] font-bold text-[#94A3B8]">
                                  {meal.restaurants?.name || "Restaurant"}
                                </p>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                  <span className="text-[11px] font-semibold text-[#64748B]">
                                    {meal.calories} kcal
                                  </span>
                                  <span className="text-gray-200">·</span>
                                  <span className="text-[11px] text-[#64748B]">
                                    {meal.protein_g}g protein
                                  </span>
                                  {meal.carbs_g != null && (
                                    <>
                                      <span className="text-gray-200">·</span>
                                      <span className="text-[11px] text-[#64748B]">
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
