import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Coffee,
  Sun,
  Moon,
  Apple,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Flame,
  Beef,
  ChefHat,
  ArrowRight,
  Store,
  MapPin,
  Star,
  Loader2,
  Sparkles,
  Calendar,
  RefreshCw,
  Home,
  ChevronDown,
  Leaf,
  Lock,
  Clock,
  Minus,
  Plus,
  Search,
} from "lucide-react";
import { format } from "date-fns";
import { getMealImage } from "@/lib/meal-images";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DeliveryScheduler } from "@/components/ui/delivery-scheduler";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSubscription } from "@/hooks/useSubscription";
import { useWallet } from "@/hooks/useWallet";
import { useNavigate } from "react-router-dom";
import { formatCurrency } from "@/lib/currency";

interface Meal {
  id: string;
  name: string;
  description: string | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  image_url: string | null;
  is_available: boolean | null;
  restaurant_id: string | null;
  restaurant?: {
    id: string;
    name: string;
    logo_url: string | null;
  };
}

interface Restaurant {
  id: string;
  name: string;
  description: string | null;
  address: string | null;
  logo_url: string | null;
  rating: number | null;
  cuisine_type: string | null;
}

interface MealWizardProps {
  userId: string;
  selectedDate: Date;
  onComplete: () => void;
  onCancel: () => void;
  initialStep?: number;
  singleMode?: boolean;
  autoFill?: boolean;
  initialPhase?: "intro" | "meal-selection";
  showMealTypeTabs?: boolean;
}

const MEAL_TYPE_CONFIG = {
  breakfast: {
    icon: Coffee,
    gradient: "from-amber-400 to-orange-500",
    bgGradient: "bg-gradient-to-br from-amber-50 to-orange-50",
    textColor: "text-amber-600",
    bgColor: "bg-amber-500",
    bgColorLight: "bg-amber-100",
    borderColor: "border-amber-200",
    shadowColor: "shadow-amber-500/20",
    label: "Breakfast",
    time: "8:00 AM",
  },
  lunch: {
    icon: Sun,
    gradient: "from-emerald-400 to-teal-500",
    bgGradient: "bg-gradient-to-br from-emerald-50 to-teal-50",
    textColor: "text-emerald-600",
    bgColor: "bg-emerald-500",
    bgColorLight: "bg-emerald-100",
    borderColor: "border-emerald-200",
    shadowColor: "shadow-emerald-500/20",
    label: "Lunch",
    time: "1:00 PM",
  },
  dinner: {
    icon: Moon,
    gradient: "from-indigo-400 to-purple-500",
    bgGradient: "bg-gradient-to-br from-indigo-50 to-purple-50",
    textColor: "text-indigo-600",
    bgColor: "bg-indigo-500",
    bgColorLight: "bg-indigo-100",
    borderColor: "border-indigo-200",
    shadowColor: "shadow-indigo-500/20",
    label: "Dinner",
    time: "7:00 PM",
  },
  snack: {
    icon: Apple,
    gradient: "from-pink-400 to-rose-500",
    bgGradient: "bg-gradient-to-br from-pink-50 to-rose-50",
    textColor: "text-pink-600",
    bgColor: "bg-pink-500",
    bgColorLight: "bg-pink-100",
    borderColor: "border-pink-200",
    shadowColor: "shadow-pink-500/20",
    label: "Snack",
    time: "3:00 PM",
  },
};

const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;

const MealWizard = ({
  userId,
  selectedDate,
  onComplete,
  onCancel,
  initialStep = 0,
  singleMode = false,
  autoFill = false,
  initialPhase = "intro",
  showMealTypeTabs = true,
}: MealWizardProps) => {
  const { toast } = useToast();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { remainingMeals, isUnlimited, incrementMealUsage, subscription } = useSubscription();

  const [phase, setPhase] = useState<"intro" | "meal-selection" | "summary" | "success">(initialPhase);
  const [currentMealType, setCurrentMealType] = useState<string>(MEAL_TYPES[initialStep] || "breakfast");
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [restaurantSearch, setRestaurantSearch] = useState("");
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMeals, setSelectedMeals] = useState<Record<string, Meal>>({});
  const [scheduling, setScheduling] = useState(false);
  const [showDeliveryScheduler, setShowDeliveryScheduler] = useState(false);
  const autoFillTriggered = useRef(false);

  const config = MEAL_TYPE_CONFIG[currentMealType as keyof typeof MEAL_TYPE_CONFIG];
  const CurrentIcon = config.icon;

  const fetchRestaurants = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, name, description, address, logo_url, rating, cuisine_type")
        .eq("approval_status", "approved")
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (error) throw error;
      setRestaurants(data || []);
    } catch (err) {
      console.error("Error fetching restaurants:", err);
      toast({
        title: "Error",
        description: "Failed to load restaurants",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchMeals = async (restaurantId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("meals")
        .select("id, name, description, calories, protein_g, carbs_g, fat_g, image_url, is_available, restaurant_id")
        .eq("restaurant_id", restaurantId)
        .eq("is_available", true)
        .order("name", { ascending: true });

      if (error) throw error;
      setMeals(data || []);
    } catch (err) {
      console.error("Error fetching meals:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRestaurants();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (autoFill && !autoFillTriggered.current) {
      autoFillTriggered.current = true;
    }
  }, [autoFill]);

  const handleSelectMeal = (meal: Meal) => {
    setSelectedMeals((prev) => ({
      ...prev,
      [currentMealType]: meal,
    }));

    const currentIndex = MEAL_TYPES.indexOf(currentMealType as (typeof MEAL_TYPES)[number]);
    if (currentIndex < MEAL_TYPES.length - 1) {
      setCurrentMealType(MEAL_TYPES[currentIndex + 1]);
    } else {
      setPhase("summary");
    }
  };

  const handleRemoveMeal = (mealType: string) => {
    setSelectedMeals((prev) => {
      const newMeals = { ...prev };
      delete newMeals[mealType];
      return newMeals;
    });
  };

  const handleEditMeal = (mealType: string) => {
    setCurrentMealType(mealType);
    setPhase("meal-selection");
  };

  const handleComplete = async (timeSlot: string) => {
    setScheduling(true);
    try {
      for (const [mealType, meal] of Object.entries(selectedMeals)) {
        const { error } = await supabase.from("meal_schedules").insert({
          user_id: userId,
          meal_id: (meal as Meal).id,
          scheduled_date: format(selectedDate, "yyyy-MM-dd"),
          meal_type: mealType,
          delivery_time_slot: timeSlot,
          order_status: "pending",
        });

        if (error) throw error;
      }

      setPhase("success");
      setTimeout(() => {
        onComplete();
      }, 2000);
    } catch (err) {
      console.error("Error scheduling meals:", err);
      toast({
        title: "Error",
        description: "Failed to schedule meals",
        variant: "destructive",
      });
    } finally {
      setScheduling(false);
    }
  };

  const totalCalories = Object.values(selectedMeals).reduce((sum, meal) => sum + (meal?.calories || 0), 0);
  const totalProtein = Object.values(selectedMeals).reduce((sum, meal) => sum + (meal?.protein_g || 0), 0);
  const totalCarbs = Object.values(selectedMeals).reduce((sum, meal) => sum + (meal?.carbs_g || 0), 0);
  const selectedMealEntries = MEAL_TYPES.filter((type) => selectedMeals[type]).map((type) => ({
    type,
    meal: selectedMeals[type],
    config: MEAL_TYPE_CONFIG[type],
  }));
  const filteredRestaurants = restaurants.filter((restaurant) => {
    const query = restaurantSearch.trim().toLowerCase();
    if (!query) return true;
    return [restaurant.name, restaurant.description, restaurant.cuisine_type]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(query));
  });

  const getRestaurantMeta = (restaurant: Restaurant, index: number) => {
    const name = restaurant.name.toLowerCase();
    const cuisine = restaurant.cuisine_type || "Healthy";
    const category = restaurant.description?.split(".")[0] || cuisine;
    const palettes = [
      { icon: Store, iconClass: "bg-gradient-to-br from-[#19C878] to-[#059A5A] text-white", tagClass: "bg-[#E2F8EB] text-[#0B9B59]", tags: ["High Protein", "Low Carb", "Gluten Free"] },
      { icon: Leaf, iconClass: "bg-[#E7F8EB] text-[#0EA65B]", tagClass: "bg-[#E2F8EB] text-[#0B9B59]", tags: ["Vegan", "Organic", "Gluten Free"] },
      { icon: Coffee, iconClass: "bg-[#FFF1E2] text-[#F97316]", tagClass: "bg-[#FFF0DE] text-[#F97316]", tags: ["Balanced", "Low Calorie", "Gluten Free"] },
      { icon: Home, iconClass: "bg-[#F1E8FF] text-[#7C55E7]", tagClass: "bg-[#EFE7FF] text-[#7C55E7]", tags: ["High Protein", "Balanced"] },
      { icon: Leaf, iconClass: "bg-[#E5F3FF] text-[#238AE6]", tagClass: "bg-[#E7F2FF] text-[#238AE6]", tags: ["Mediterranean", "Olive Oil", "Gluten Free"] },
    ];
    const organic = name.includes("organic");
    const vegan = name.includes("vegan") || cuisine.toLowerCase().includes("vegan");
    const selected = organic ? palettes[1] : vegan ? palettes[1] : palettes[index % palettes.length];
    return {
      ...selected,
      category,
      rating: restaurant.rating ?? [4.7, 4.6, 4.4, 4.9, 4.8, 4.5, 4.2][index % 7],
      recommended: index === 0,
    };
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[80] bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-black"
    >
      <div className="sticky top-0 z-10 bg-white/90 dark:bg-gray-900/90 backdrop-blur-2xl border-b border-gray-100 dark:border-gray-800 safe-top">
        <div className="flex items-center justify-between px-4 h-16">
          <button
            onClick={() => {
              if (phase === "meal-selection" && Object.keys(selectedMeals).length > 0) {
                setPhase("summary");
              } else {
                onCancel();
              }
            }}
            className="w-11 h-11 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center cursor-pointer active:scale-95 transition-all"
          >
            <ChevronLeft className="h-5 w-5 text-gray-600 dark:text-gray-300" />
          </button>

          <div className="text-center">
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">
              {phase === "intro" && "Add Meal"}
              {phase === "meal-selection" && config.label}
              {phase === "summary" && "Review Order"}
            </h1>
            <p className="text-xs text-gray-400 font-medium">
              {format(selectedDate, "EEEE, MMMM d")}
            </p>
          </div>

          <div className="w-11" />
        </div>

        {phase === "meal-selection" && showMealTypeTabs && (
          <div className="px-4 pb-3">
            <div className="flex gap-1.5">
              {MEAL_TYPES.map((type) => {
                const isActive = type === currentMealType;
                const isComplete = selectedMeals[type];
                const typeConfig = MEAL_TYPE_CONFIG[type];
                return (
                  <div
                    key={type}
                    className="flex-1 h-1.5 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800"
                  >
                    <motion.div
                      className={`h-full rounded-full ${typeConfig.gradient}`}
                      initial={{ width: 0 }}
                      animate={{ width: isComplete ? "100%" : isActive ? "50%" : "0%" }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col overflow-y-auto" style={{ height: 'calc(100vh - 64px)' }}>
        <AnimatePresence mode="wait">
          {phase === "intro" && (
            <motion.div
              key="intro"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="p-4"
            >
              <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 dark:from-gray-800 dark:via-gray-900 dark:to-black rounded-3xl p-6 mb-6 shadow-xl">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="h-5 w-5 text-emerald-400" />
                  <span className="text-emerald-400 text-xs font-semibold uppercase tracking-wider">
                    {format(selectedDate, "EEEE")}
                  </span>
                </div>
                <h2 className="text-3xl font-black text-white mb-1">
                  {format(selectedDate, "MMMM d")}
                </h2>
                <p className="text-gray-400 text-sm">
                  Select meals for {Object.keys(MEAL_TYPE_CONFIG).length} times today
                </p>

                <div className="flex gap-2 mt-5 overflow-x-auto pb-2">
                  {MEAL_TYPES.map((type) => {
                    const typeConfig = MEAL_TYPE_CONFIG[type];
                    const Icon = typeConfig.icon;
                    const isSelected = !!selectedMeals[type];
                    return (
                      <motion.div
                        key={type}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={`flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-2xl ${
                          isSelected
                            ? `${typeConfig.bgGradient} ${typeConfig.textColor} border ${typeConfig.borderColor}`
                            : "bg-white/10 text-white/80 border border-white/10"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="text-xs font-semibold">{typeConfig.label}</span>
                        {isSelected && <Check className="h-3.5 w-3.5" />}
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              <motion.button
                onClick={() => {
                  if (Object.keys(selectedMeals).length > 0) {
                    setPhase("summary");
                  } else {
                    setPhase("meal-selection");
                  }
                }}
                whileTap={{ scale: 0.98 }}
                className="w-full py-5 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-500 text-white font-bold text-lg shadow-xl shadow-emerald-500/25 flex items-center justify-center gap-3"
              >
                {Object.keys(selectedMeals).length > 0 ? (
                  <>
                    <Check className="h-6 w-6" />
                    Review Order
                  </>
                ) : (
                  <>
                    <ChefHat className="h-6 w-6" />
                    Choose Meals
                  </>
                )}
              </motion.button>

              {Object.keys(selectedMeals).length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 grid grid-cols-3 gap-3"
                >
                  <div className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/30 dark:to-amber-900/30 rounded-2xl p-4 text-center border border-orange-100 dark:border-orange-900/50">
                    <Flame className="h-5 w-5 text-orange-500 mx-auto mb-1" />
                    <p className="text-2xl font-black text-gray-900 dark:text-white">{totalCalories}</p>
                    <p className="text-[10px] text-orange-500 font-semibold uppercase">kcal</p>
                  </div>
                  <div className="bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-900/30 dark:to-pink-900/30 rounded-2xl p-4 text-center border border-rose-100 dark:border-rose-900/50">
                    <Beef className="h-5 w-5 text-rose-500 mx-auto mb-1" />
                    <p className="text-2xl font-black text-gray-900 dark:text-white">{totalProtein}g</p>
                    <p className="text-[10px] text-rose-500 font-semibold uppercase">Protein</p>
                  </div>
                  <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/30 dark:to-cyan-900/30 rounded-2xl p-4 text-center border border-blue-100 dark:border-blue-900/50">
                    <Leaf className="h-5 w-5 text-blue-500 mx-auto mb-1" />
                    <p className="text-2xl font-black text-gray-900 dark:text-white">{totalCarbs}g</p>
                    <p className="text-[10px] text-blue-500 font-semibold uppercase">Carbs</p>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {phase === "meal-selection" && (
            <motion.div
              key="meal-selection"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col"
              style={{ height: showMealTypeTabs ? 'calc(100vh - 140px)' : 'calc(100vh - 64px)' }}
            >
              {showMealTypeTabs && (
                <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 pt-2 shrink-0">
                  {MEAL_TYPES.map((type) => {
                    const typeConfig = MEAL_TYPE_CONFIG[type];
                    const Icon = typeConfig.icon;
                    const isActive = type === currentMealType;
                    const isSelected = !!selectedMeals[type];
                    return (
                      <motion.button
                        key={type}
                        onClick={() => setCurrentMealType(type)}
                        whileTap={{ scale: 0.95 }}
                        className={`flex-none flex items-center gap-2 px-4 py-3 rounded-2xl transition-all ${
                          isActive
                            ? `${typeConfig.bgColor} text-white shadow-lg`
                            : isSelected
                            ? `${typeConfig.bgColorLight} ${typeConfig.textColor} border-2 ${typeConfig.borderColor} font-semibold`
                            : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                        <span className="text-sm font-bold whitespace-nowrap">{typeConfig.label}</span>
                        {isSelected && <Check className="h-4 w-4" />}
                      </motion.button>
                    );
                  })}
                </div>
              )}

              <div className="flex-1 overflow-y-auto px-4 pb-24 sm:px-6">
                {meals.length === 0 && (
                  <div className="mx-auto mb-4 max-w-[430px] pt-5 sm:max-w-none">
                    <div className="mb-5 space-y-4 lg:flex lg:items-start lg:justify-between lg:space-y-0">
                      <div>
                        <h3 className="text-[22px] font-extrabold leading-tight tracking-[-0.04em] text-slate-950 sm:text-[24px]">Select Restaurant</h3>
                        <p className="mt-2 text-[15px] font-medium leading-snug text-slate-500 sm:text-[16px]">Choose a restaurant to see available meals</p>
                      </div>
                      <div className="relative lg:w-[360px]">
                        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" strokeWidth={2.2} />
                        <input
                          value={restaurantSearch}
                          onChange={(event) => setRestaurantSearch(event.target.value)}
                          placeholder="Search restaurants..."
                          className="h-[52px] w-full rounded-[16px] border border-slate-200 bg-white pl-12 pr-4 text-[15px] font-medium text-slate-900 shadow-[0_8px_20px_rgba(15,23,42,0.035)] outline-none placeholder:text-slate-400 focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                        />
                      </div>
                    </div>

                    <div className="space-y-2.5 sm:space-y-3">
                      {filteredRestaurants.map((restaurant, index) => {
                        const isSelected = selectedRestaurant?.id === restaurant.id;
                        const meta = getRestaurantMeta(restaurant, index);
                        const RestaurantIcon = meta.icon;
                        return (
                          <motion.button
                            key={restaurant.id}
                            onClick={() => {
                              setSelectedRestaurant(restaurant);
                              fetchMeals(restaurant.id);
                            }}
                            whileTap={{ scale: 0.98 }}
                            className={`w-full rounded-[22px] border bg-white p-4 text-left shadow-[0_10px_28px_rgba(15,23,42,0.06)] transition-all sm:flex sm:min-h-[104px] sm:items-center sm:gap-5 sm:px-5 ${
                              isSelected
                                ? "border-emerald-300 ring-2 ring-emerald-100"
                                : "border-slate-100 active:border-emerald-100"
                            }`}
                          >
                            <div className="flex min-w-0 items-start gap-3 sm:contents">
                              {restaurant.logo_url ? (
                                <img
                                  src={restaurant.logo_url}
                                  alt={restaurant.name}
                                  className="h-[58px] w-[58px] shrink-0 rounded-full object-cover shadow-[0_8px_18px_rgba(15,23,42,0.08)] sm:h-[68px] sm:w-[68px]"
                                />
                              ) : (
                                <div className={`flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-full sm:h-[68px] sm:w-[68px] ${meta.iconClass}`}>
                                  <RestaurantIcon className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={2.15} />
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="flex min-w-0 items-start gap-2 sm:items-center sm:gap-3">
                                  <p className="min-w-0 flex-1 truncate text-[17px] font-extrabold leading-tight tracking-[-0.035em] text-slate-950 sm:text-[18px]">{restaurant.name}</p>
                                  {meta.recommended && (
                                    <span className="shrink-0 rounded-full bg-[#E2F8EB] px-2.5 py-1 text-[10px] font-extrabold leading-none text-[#0B9B59] sm:px-3 sm:text-[12px]">Recommended</span>
                                  )}
                                </div>
                                <p className="mt-2 truncate text-[13px] font-medium leading-tight text-slate-500 sm:text-[15px]">{restaurant.cuisine_type || "Healthy"} <span className="px-1">•</span> {meta.category}</p>
                              </div>
                            </div>

                            <div className="mt-3 flex items-end justify-between gap-3 sm:mt-0 sm:contents">
                              <div className="flex min-w-0 flex-1 flex-wrap gap-1.5 sm:mt-3 sm:gap-2">
                                {meta.tags.map((tag) => (
                                  <span key={tag} className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold leading-none sm:px-3 sm:text-[12px] ${meta.tagClass}`}>{tag}</span>
                                ))}
                              </div>

                              <div className="ml-2 flex shrink-0 items-center gap-2 sm:gap-5">
                                <span className="inline-flex h-9 min-w-[62px] items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-[13px] font-extrabold text-slate-900 shadow-[0_5px_14px_rgba(15,23,42,0.035)] sm:h-12 sm:min-w-[78px] sm:gap-2 sm:px-4 sm:text-[15px]">
                                  <Star className="h-3.5 w-3.5 fill-[#F59E0B] text-[#F59E0B] sm:h-4 sm:w-4" />
                                  {meta.rating.toFixed(1)}
                                </span>
                                <ChevronRight className="h-5 w-5 text-slate-500 sm:h-6 sm:w-6" strokeWidth={2.4} />
                              </div>
                            </div>
                          </motion.button>
                        );
                      })}
                      {filteredRestaurants.length === 0 && (
                        <div className="rounded-[22px] border border-dashed border-slate-200 bg-white px-5 py-10 text-center text-[15px] font-semibold text-slate-500">
                          No restaurants found
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {loading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="bg-gray-100 dark:bg-gray-800 rounded-2xl p-4 animate-pulse">
                        <div className="flex gap-4">
                          <div className="w-20 h-20 rounded-xl bg-gray-200 dark:bg-gray-700" />
                          <div className="flex-1 space-y-2">
                            <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
                            <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : meals.length > 0 ? (
                  <div className="space-y-3">
                    {meals.map((meal) => {
                      const isSelected = selectedMeals[currentMealType]?.id === meal.id;
                      return (
                        <motion.button
                          key={meal.id}
                          onClick={() => handleSelectMeal(meal)}
                          whileTap={{ scale: 0.98 }}
                          className={`w-full text-left rounded-2xl transition-all ${
                            isSelected
                              ? "ring-2 ring-emerald-500 shadow-lg shadow-emerald-500/20"
                              : "shadow-sm hover:shadow-md"
                          } bg-white dark:bg-gray-900 border-2 ${
                            isSelected ? "border-emerald-500" : "border-gray-100 dark:border-gray-800"
                          }`}
                        >
                          <div className="flex">
                            <div className="relative shrink-0">
                              {meal.image_url ? (
                                <img
                                  src={meal.image_url}
                                  alt={meal.name}
                                  className="w-24 h-24 object-cover rounded-l-2xl"
                                />
                              ) : (
                                <div className={`w-24 h-24 ${config.bgGradient} flex items-center justify-center rounded-l-2xl`}>
                                  <CurrentIcon className={`h-10 w-10 ${config.textColor}`} />
                                </div>
                              )}
                              {isSelected && (
                                <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg">
                                  <Check className="h-4 w-4 text-white" />
                                </div>
                              )}
                            </div>

                            <div className="flex-1 p-4 flex flex-col justify-center">
                              <h3 className="font-bold text-base text-gray-900 dark:text-white mb-1 pr-8">
                                {meal.name}
                              </h3>
                              {meal.description && (
                                <p className="text-xs text-gray-500 mb-2 line-clamp-2">
                                  {meal.description}
                                </p>
                              )}
                              <div className="flex items-center gap-3">
                                <span className={`text-xs font-bold px-2 py-1 rounded-lg ${config.bgGradient} ${config.textColor}`}>
                                  {meal.calories} kcal
                                </span>
                                <span className="text-xs text-gray-400 font-medium">
                                  {meal.protein_g}g protein
                                </span>
                              </div>
                            </div>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                ) : selectedRestaurant ? (
                  <div className="text-center py-12">
                    <ChefHat className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No meals available at this restaurant</p>
                  </div>
                ) : null}
              </div>

              {selectedMeals[currentMealType] && (
                <div
                  className="sticky bottom-0 left-0 right-0 p-4 bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border-t border-gray-100 dark:border-gray-800 -mx-4 px-4"
                  style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
                >
                  <div className="flex gap-3">
                    <motion.button
                      onClick={() => setPhase("summary")}
                      whileTap={{ scale: 0.98 }}
                      className="flex-1 py-4 rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-semibold text-base flex items-center justify-center gap-2"
                    >
                      Skip & Review
                    </motion.button>

                    <motion.button
                      onClick={() => {
                        const currentIndex = MEAL_TYPES.indexOf(currentMealType as (typeof MEAL_TYPES)[number]);
                        const nextType = MEAL_TYPES[currentIndex + 1];
                        if (nextType) {
                          setCurrentMealType(nextType);
                        } else {
                          setPhase("summary");
                        }
                      }}
                      whileTap={{ scale: 0.98 }}
                      className="flex-1 py-4 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-500 text-white font-bold text-base shadow-xl shadow-emerald-500/25 flex items-center justify-center gap-2"
                    >
                      {MEAL_TYPES.indexOf(currentMealType as (typeof MEAL_TYPES)[number]) < MEAL_TYPES.length - 1 ? (
                        <>
                          Next: {MEAL_TYPE_CONFIG[MEAL_TYPES[MEAL_TYPES.indexOf(currentMealType as (typeof MEAL_TYPES)[number]) + 1] as keyof typeof MEAL_TYPE_CONFIG].label}
                          <ChevronRight className="h-5 w-5" />
                        </>
                      ) : (
                        <>
                          Review Order
                          <Check className="h-5 w-5" />
                        </>
                      )}
                    </motion.button>
                  </div>
                </div>
              )}

              {!selectedMeals[currentMealType] && Object.keys(selectedMeals).length > 0 && (
                <div
                  className="fixed bottom-16 left-0 right-0 p-4 bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border-t border-gray-100 dark:border-gray-800"
                  style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
                >
                  <motion.button
                    onClick={() => setPhase("summary")}
                    whileTap={{ scale: 0.98 }}
                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-500 text-white font-bold text-base shadow-xl shadow-emerald-500/25 flex items-center justify-center gap-2"
                  >
                    Review Order ({Object.keys(selectedMeals).length} meal{Object.keys(selectedMeals).length > 1 ? 's' : ''})
                    <Check className="h-5 w-5" />
                  </motion.button>
                </div>
              )}
            </motion.div>
          )}

          {phase === "summary" && (
            <motion.div
              key="summary"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-1 flex-col overflow-y-auto bg-[#FBFCFC] px-5 pb-6 pt-4"
            >
              <div className="flex flex-col flex-1">
                <section className="rounded-[20px] border border-slate-100 bg-white px-4 py-5 shadow-[0_10px_28px_rgba(15,23,42,0.06)]">
                  <h2 className="text-[22px] font-extrabold leading-tight tracking-[-0.04em] text-slate-950">Daily Nutrition</h2>
                  <p className="mt-2 text-[14px] font-medium leading-snug text-slate-500">Here's your estimated nutrition for today</p>

                  <div className="mt-4 rounded-[18px] border border-slate-200 bg-white px-2 py-4">
                    <div className="grid grid-cols-3 divide-x divide-slate-200">
                      <div className="px-2 text-center">
                        <div className="mx-auto flex h-[48px] w-[48px] items-center justify-center rounded-full bg-[#FFF1DE] text-[#F97316]">
                          <Flame className="h-6 w-6" strokeWidth={2.25} />
                        </div>
                        <p className="mt-3 text-[28px] font-extrabold leading-none tracking-[-0.05em] text-slate-950">{totalCalories}</p>
                        <p className="mt-2 text-[14px] font-medium leading-none text-slate-700">Calories</p>
                      </div>
                      <div className="px-2 text-center">
                        <div className="mx-auto flex h-[48px] w-[48px] items-center justify-center rounded-full bg-[#FFE9F0] text-[#F43F5E]">
                          <Beef className="h-6 w-6" strokeWidth={2.25} />
                        </div>
                        <p className="mt-3 text-[28px] font-extrabold leading-none tracking-[-0.05em] text-slate-950">{totalProtein}g</p>
                        <p className="mt-2 text-[14px] font-medium leading-none text-slate-700">Protein</p>
                      </div>
                      <div className="px-2 text-center">
                        <div className="mx-auto flex h-[48px] w-[48px] items-center justify-center rounded-full bg-[#E3F7EC] text-[#10A45D]">
                          <Leaf className="h-6 w-6" strokeWidth={2.25} />
                        </div>
                        <p className="mt-3 text-[28px] font-extrabold leading-none tracking-[-0.05em] text-slate-950">{totalCarbs}g</p>
                        <p className="mt-2 text-[14px] font-medium leading-none text-slate-700">Carbs</p>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="mt-5">
                  <h2 className="text-[22px] font-extrabold leading-tight tracking-[-0.04em] text-slate-950">{selectedMealEntries.length} Meal Selected</h2>
                  <p className="mt-2 text-[14px] font-medium leading-snug text-slate-500">You can review your meal before placing the order</p>

                  <div className="mt-4 space-y-3">
                    {selectedMealEntries.map(({ type, meal, config }, index) => {
                      const MealIcon = config.icon;
                      return (
                      <motion.div
                        key={type}
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.06 }}
                        className="rounded-[20px] border border-slate-100 bg-white p-3 shadow-[0_10px_24px_rgba(15,23,42,0.06)]"
                      >
                        <div className="flex items-center gap-3">
                          {meal.image_url ? (
                            <img
                              src={meal.image_url}
                              alt={meal.name}
                              className="h-[80px] w-[80px] shrink-0 rounded-[16px] object-cover shadow-[0_8px_16px_rgba(15,23,42,0.08)]"
                            />
                          ) : (
                            <div className={`flex h-[80px] w-[80px] shrink-0 items-center justify-center rounded-[16px] ${config.bgGradient}`}>
                              <MealIcon className={`h-9 w-9 ${config.textColor}`} />
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="rounded-full bg-[#FFF0DE] px-3 py-1.5 text-[11px] font-extrabold uppercase leading-none text-[#D75B05]">{config.label}</span>
                              <span className="inline-flex items-center gap-1 text-[12px] font-medium text-slate-500">
                                <Clock className="h-3.5 w-3.5" />
                                {config.time}
                              </span>
                            </div>
                            <h3 className="mt-3 truncate text-[20px] font-extrabold leading-tight tracking-[-0.04em] text-slate-950">{meal.name}</h3>
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              <span className="rounded-full bg-[#FFF0DE] px-3 py-1.5 text-[14px] font-medium leading-none text-[#B94E05]">{meal.calories || 0} kcal</span>
                              <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[14px] font-medium leading-none text-slate-500">{meal.protein_g || 0}g protein</span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleEditMeal(type)}
                            className="flex h-[56px] w-[56px] shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-950 transition active:scale-95"
                            aria-label={`Edit ${config.label}`}
                          >
                            <ChevronRight className="h-6 w-6" strokeWidth={2.5} />
                          </button>
                        </div>
                      </motion.div>
                      );
                    })}
                  </div>
                </section>

                <div className="mt-5 flex items-start gap-3 rounded-[16px] bg-[#F0FCF7] px-4 py-4 text-slate-900">
                  <div className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full bg-[#10B86F] text-white shadow-[0_6px_14px_rgba(16,184,111,0.18)] ring-3 ring-white">
                    <Check className="h-6 w-6" strokeWidth={2.6} />
                  </div>
                  <p className="text-[15px] font-medium leading-snug">All meals are prepared fresh and made with high-quality ingredients.</p>
                </div>

                <div className="mt-auto pt-5">
                  <motion.button
                    onClick={() => setShowDeliveryScheduler(true)}
                    whileTap={{ scale: 0.98 }}
                    className="flex h-[60px] w-full items-center justify-center gap-3 rounded-[24px] bg-gradient-to-r from-[#10C878] to-[#05A85B] text-[22px] font-extrabold tracking-[-0.03em] text-white shadow-[0_12px_24px_rgba(5,168,91,0.22)]"
                  >
                    <Calendar className="h-7 w-7" strokeWidth={2.25} />
                    Schedule Delivery
                  </motion.button>

                  <div className="mt-4 flex items-center justify-center gap-2 text-[14px] font-medium text-slate-500">
                    <Lock className="h-4 w-4" strokeWidth={2.2} />
                    Secure & encrypted checkout
                  </div>
                </div>
              </div>
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
                All Set!
              </motion.h2>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-gray-500 text-center"
              >
                Your meals have been scheduled for {format(selectedDate, "EEEE, MMMM d")}
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Dialog open={showDeliveryScheduler} onOpenChange={setShowDeliveryScheduler}>
        <DialogContent className="sm:max-w-md rounded-3xl p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Calendar className="h-5 w-5 text-emerald-500" />
              Choose Delivery Time
            </DialogTitle>
          </DialogHeader>
          <DeliveryScheduler
            initialDate={selectedDate}
            timeSlots={[
              "7:00 AM", "8:00 AM", "9:00 AM",
              "11:00 AM", "12:00 PM", "1:00 PM",
              "5:00 PM", "6:00 PM", "7:00 PM",
            ]}
            timeZone="Qatar (GMT +3)"
            onSchedule={({ time }) => {
              setShowDeliveryScheduler(false);
              handleComplete(time);
            }}
            onCancel={() => setShowDeliveryScheduler(false)}
          />
        </DialogContent>
      </Dialog>

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

export default MealWizard;
