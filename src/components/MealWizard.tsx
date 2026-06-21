import { getNavArrows } from "@/lib/rtl";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft,
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
  Trash2,
} from "lucide-react";
import { format } from "date-fns";
import { getMealImage } from "@/lib/meal-images";
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
  image_url: string | null;
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
  snack2: {
    icon: Apple,
    gradient: "from-pink-400 to-rose-500",
    bgGradient: "bg-gradient-to-br from-pink-50 to-rose-50",
    textColor: "text-pink-600",
    bgColor: "bg-pink-500",
    bgColorLight: "bg-pink-100",
    borderColor: "border-pink-200",
    shadowColor: "shadow-pink-500/20",
    label: "Snack 2",
    time: "5:00 PM",
  },
};

const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack", "snack2"] as const;

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
  const { t, isRTL } = useLanguage();
  const { PrevIcon, NextIcon } = getNavArrows(isRTL);
  const navigate = useNavigate();
  const { remainingMeals, isUnlimited, incrementMealUsage, incrementSnackUsage, subscription, refetch: refetchSubscription } = useSubscription();

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
        .select("id, name, description, address, image_url, logo_url, rating, cuisine_type")
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
          meal_type: mealType === "snack2" ? "snack" : mealType,
          delivery_time_slot: timeSlot,
          order_status: "pending",
        });

        if (error) throw error;
      }

      for (const mealType of Object.keys(selectedMeals)) {
        if (mealType === "snack" || mealType === "snack2") {
          await incrementSnackUsage();
        } else {
          await incrementMealUsage();
        }
      }

      await refetchSubscription();

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
      className="fixed inset-0 z-[80] bg-[#F8FAFC]"
    >
      <div className="sticky top-0 z-10 border-b border-slate-200/70 bg-[#F8FAFC]/92 backdrop-blur-2xl safe-top">
        <div className="mx-auto flex h-16 max-w-[430px] items-center justify-between px-4">
          <button
            onClick={() => {
              if (phase === "meal-selection" && Object.keys(selectedMeals).length > 0) {
                setPhase("summary");
              } else {
                onCancel();
              }
            }}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm ring-1 ring-slate-200 active:scale-95"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={2.5} />
          </button>

          <div className="min-w-0 text-center">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-700">
              {phase === "summary" ? "Review" : "Add to schedule"}
            </p>
            <h1 className="truncate text-[15px] font-black text-slate-950">
              {phase === "intro" && "Add Meal"}
              {phase === "meal-selection" && config.label}
              {phase === "summary" && "Review Order"}
            </h1>
          </div>

          <button
            onClick={onCancel}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm ring-1 ring-slate-200 active:scale-95"
            aria-label="Close"
          >
            <X className="h-5 w-5" strokeWidth={2.5} />
          </button>
        </div>

        {phase === "meal-selection" && showMealTypeTabs && (
          <div className="mx-auto max-w-[430px] px-4 pb-3">
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

      <div className="mx-auto flex w-full max-w-[430px] flex-col overflow-y-auto" style={{ height: 'calc(100vh - 64px)' }}>
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

              <div className="flex-1 overflow-y-auto px-4 pb-28">
                {!selectedRestaurant && meals.length === 0 && (
                  <div className="mb-4 pt-4">
                    <div className="mb-4 rounded-[28px] bg-white p-4 shadow-[0_14px_36px_rgba(15,23,42,0.07)] ring-1 ring-slate-200/80">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] ${config.bgGradient} ring-1 ring-white/70`}>
                          <CurrentIcon className={`h-6 w-6 ${config.textColor}`} strokeWidth={2.4} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-emerald-700">
                            {format(selectedDate, "EEE, MMM d")}
                          </p>
                          <h2 className="truncate text-[24px] font-black leading-tight text-slate-950">
                            Add {config.label}
                          </h2>
                        </div>
                        <span className="rounded-full bg-slate-50 px-3 py-2 text-[12px] font-black text-slate-600 ring-1 ring-slate-200">
                          {config.time}
                        </span>
                      </div>
                    </div>

                    <div className="mb-4 space-y-3">
                      <div>
                        <h3 className="text-[22px] font-black leading-tight tracking-normal text-slate-950">{t("mealwizard_select_restaurant")}</h3>
                        <p className="mt-1 text-[14px] font-semibold leading-relaxed text-slate-500">{t("mealwizard_choose_restaurant_desc")}</p>
                      </div>
                      <div className="relative">
                        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" strokeWidth={2.2} />
                        <input
                          value={restaurantSearch}
                          onChange={(event) => setRestaurantSearch(event.target.value)}
                          placeholder="Search restaurants..."
                          className="h-[52px] w-full rounded-[18px] border border-slate-200 bg-white pl-12 pr-4 text-[15px] font-bold text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      {filteredRestaurants.map((restaurant, index) => {
                        const isSelected = selectedRestaurant?.id === restaurant.id;
                        const meta = getRestaurantMeta(restaurant, index);
                        const RestaurantIcon = meta.icon;
                        const restaurantImage = restaurant.image_url || restaurant.logo_url;
                        return (
                          <motion.button
                            key={restaurant.id}
                            onClick={() => {
                              setSelectedRestaurant(restaurant);
                              fetchMeals(restaurant.id);
                            }}
                            whileTap={{ scale: 0.98 }}
                            className={`w-full rounded-[24px] border bg-white p-4 text-left shadow-[0_12px_32px_rgba(15,23,42,0.06)] transition-all ${
                              isSelected
                                ? "border-emerald-300 ring-2 ring-emerald-100"
                                : "border-slate-100 active:border-emerald-100"
                            }`}
                          >
                            <div className="flex min-w-0 items-start gap-3">
                              {restaurantImage ? (
                                <img
                                  src={restaurantImage}
                                  alt={restaurant.name}
                                  className="h-[72px] w-[72px] shrink-0 rounded-[20px] object-cover shadow-[0_8px_18px_rgba(15,23,42,0.08)]"
                                />
                              ) : (
                                <div className={`flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-[20px] ${meta.iconClass}`}>
                                  <RestaurantIcon className="h-7 w-7" strokeWidth={2.15} />
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="flex min-w-0 items-start gap-2">
                                  <p className="min-w-0 flex-1 truncate text-[17px] font-black leading-tight tracking-normal text-slate-950">{restaurant.name}</p>
                                  {meta.recommended && (
                                    <span className="shrink-0 rounded-full bg-[#E2F8EB] px-2.5 py-1 text-[10px] font-extrabold leading-none text-[#0B9B59]">Best</span>
                                  )}
                                </div>
                                <p className="mt-2 truncate text-[13px] font-medium leading-tight text-slate-500 sm:text-[15px]">{restaurant.cuisine_type || "Healthy"} <span className="px-1">•</span> {meta.category}</p>
                              </div>
                            </div>

                            <div className="mt-4 flex items-center justify-between gap-3">
                              <div className="grid min-w-0 flex-1 grid-cols-2 gap-1.5">
                                {meta.tags.slice(0, 2).map((tag) => (
                                  <span key={tag} className="truncate rounded-[14px] bg-slate-50/80 px-2.5 py-2 text-center text-[10px] font-black leading-none text-[#020617] ring-1 ring-slate-200/80 backdrop-blur">{tag}</span>
                                ))}
                              </div>

                              <span className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-slate-950 px-4 text-[13px] font-black text-white">
                                Select
                                <NextIcon className="h-4 w-4" strokeWidth={2.4} />
                              </span>
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

                {selectedRestaurant && (
                  <div className="mb-4 rounded-[24px] border border-slate-100 bg-white p-4 shadow-[0_12px_32px_rgba(15,23,42,0.06)]">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedRestaurant(null);
                          setMeals([]);
                        }}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-900"
                        aria-label="Back to restaurants"
                      >
                        <ChevronLeft className="h-5 w-5" strokeWidth={2.4} />
                      </button>
                      <div className="min-w-0">
                        <p className="text-[12px] font-extrabold uppercase tracking-[0.08em] text-emerald-600">Choose {config.label}</p>
                        <p className="truncate text-[18px] font-black leading-tight text-slate-950">{selectedRestaurant.name}</p>
                      </div>
                      {(selectedRestaurant.image_url || selectedRestaurant.logo_url) && (
                        <img
                          src={selectedRestaurant.image_url || selectedRestaurant.logo_url || ""}
                          alt={selectedRestaurant.name}
                          className="ml-auto h-12 w-12 shrink-0 rounded-[16px] object-cover"
                        />
                      )}
                    </div>
                  </div>
                )}

                {selectedMealEntries.length > 0 && (
                  <div className="mb-4 rounded-[24px] border border-emerald-100 bg-[#F0FCF7] p-3 shadow-[0_10px_28px_rgba(16,184,111,0.08)]">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-[12px] font-black uppercase tracking-[0.12em] text-emerald-700">Selected</p>
                      <p className="text-[12px] font-extrabold text-slate-500">
                        {selectedMealEntries.length} meal{selectedMealEntries.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {selectedMealEntries.map(({ type, meal, config }) => {
                        const isCurrent = type === currentMealType;
                        const SelectedIcon = config.icon;
                        return (
                          <div
                            key={type}
                            role="button"
                            tabIndex={0}
                            onClick={() => handleEditMeal(type)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                handleEditMeal(type);
                              }
                            }}
                            className={`flex min-w-[260px] items-center gap-2 rounded-[18px] border bg-white p-2 text-left transition active:scale-95 ${
                              isCurrent
                                ? "border-emerald-300 ring-2 ring-emerald-100"
                                : "border-white/70"
                            }`}
                          >
                            {meal.image_url ? (
                              <img
                                src={meal.image_url}
                                alt={meal.name}
                                className="h-12 w-12 shrink-0 rounded-[14px] object-cover"
                              />
                            ) : (
                              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] ${config.bgGradient}`}>
                                <SelectedIcon className={`h-5 w-5 ${config.textColor}`} />
                              </div>
                            )}
                            <div className="min-w-0 flex-1 pr-1">
                              <div className="flex items-center gap-1.5">
                                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-700">
                                  {config.label}
                                </span>
                                <Check className="h-3.5 w-3.5 text-emerald-600" strokeWidth={3} />
                              </div>
                              <p className="mt-1 truncate text-[13px] font-black leading-tight text-slate-950">{meal.name}</p>
                            </div>
                            <button
                              type="button"
                              aria-label={`Remove ${config.label}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                handleRemoveMeal(type);
                              }}
                              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-rose-500 transition active:bg-rose-50 active:scale-95"
                            >
                              <Trash2 className="h-[18px] w-[18px]" strokeWidth={2.2} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {loading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="animate-pulse rounded-[24px] border border-slate-100 bg-white p-3 shadow-[0_10px_26px_rgba(15,23,42,0.05)]">
                        <div className="flex gap-4">
                          <div className="h-24 w-24 rounded-[20px] bg-slate-100" />
                          <div className="flex-1 space-y-3 py-2">
                            <div className="h-5 w-36 rounded bg-slate-100" />
                            <div className="h-4 w-24 rounded bg-slate-100" />
                            <div className="h-8 w-28 rounded-full bg-slate-100" />
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
                          className={`w-full rounded-[24px] border p-3 text-left transition-all ${
                            isSelected
                              ? "border-emerald-400 bg-[#F0FCF7] shadow-[0_14px_34px_rgba(16,184,111,0.16)] ring-2 ring-emerald-100"
                              : "border-slate-100 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.06)] active:border-emerald-100"
                          }`}
                        >
                          <div className="flex gap-3">
                            <div className="relative shrink-0">
                              {meal.image_url ? (
                                <img
                                  src={meal.image_url}
                                  alt={meal.name}
                                  className="h-24 w-24 rounded-[20px] object-cover"
                                />
                              ) : (
                                <div className={`flex h-24 w-24 items-center justify-center rounded-[20px] ${config.bgGradient}`}>
                                  <CurrentIcon className={`h-10 w-10 ${config.textColor}`} />
                                </div>
                              )}
                              {isSelected && (
                                <div className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 shadow-lg ring-2 ring-white">
                                  <Check className="h-4 w-4 text-white" />
                                </div>
                              )}
                            </div>

                            <div className="flex min-w-0 flex-1 flex-col justify-between py-1">
                              <div className="min-w-0">
                                <h3 className="line-clamp-2 text-[16px] font-black leading-tight text-slate-950">
                                  {meal.name}
                                </h3>
                                {isSelected && (
                                  <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-black text-emerald-700">
                                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                                    Selected for {config.label}
                                  </div>
                                )}
                                {meal.description && (
                                  <p className="mt-1 line-clamp-2 text-[12px] font-semibold leading-snug text-slate-500">
                                    {meal.description}
                                  </p>
                                )}
                              </div>
                              <div className="mt-3 flex items-center gap-2">
                                <div className="min-w-0 rounded-[14px] bg-slate-50/80 px-2.5 py-2 ring-1 ring-slate-200/80 backdrop-blur">
                                  <p className="truncate text-[11px] font-black leading-none text-orange-700">{meal.calories}</p>
                                  <p className="mt-1 text-[8px] font-black uppercase tracking-[0.08em] text-slate-400">kcal</p>
                                </div>
                                <div className="min-w-0 rounded-[14px] bg-slate-50/80 px-2.5 py-2 ring-1 ring-slate-200/80 backdrop-blur">
                                  <p className="truncate text-[11px] font-black leading-none text-[#020617]">{meal.protein_g}g</p>
                                  <p className="mt-1 text-[8px] font-black uppercase tracking-[0.08em] text-slate-400">protein</p>
                                </div>
                                <span className={`ml-auto inline-flex h-8 items-center justify-center rounded-full px-3 text-[12px] font-black ${
                                  isSelected ? "bg-emerald-500 text-white" : "bg-slate-950 text-white"
                                }`}>
                                  {isSelected ? "Selected" : "Add"}
                                </span>
                              </div>
                            </div>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                ) : selectedRestaurant ? (
                  <div className="rounded-[24px] border border-dashed border-slate-200 bg-white px-5 py-10 text-center">
                    <ChefHat className="mx-auto mb-3 h-12 w-12 text-slate-300" />
                    <p className="text-[15px] font-semibold text-slate-500">{t("mealwizard_no_meals")}</p>
                  </div>
                ) : null}
              </div>

              {selectedMeals[currentMealType] && (
                <div
                  className="sticky bottom-0 left-0 right-0 -mx-4 border-t border-slate-100 bg-white/92 px-4 py-3 backdrop-blur-2xl"
                  style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
                >
                  <div className="flex gap-3">
                    <motion.button
                      onClick={() => setPhase("summary")}
                      whileTap={{ scale: 0.98 }}
                      className="flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-[18px] bg-slate-100 px-4 text-[14px] font-black text-slate-600"
                    >
                      Review
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
                      className="flex min-h-[52px] flex-[1.4] items-center justify-center gap-2 rounded-[18px] bg-slate-950 px-4 text-[14px] font-black text-white shadow-[0_12px_24px_rgba(15,23,42,0.18)]"
                    >
                      {MEAL_TYPES.indexOf(currentMealType as (typeof MEAL_TYPES)[number]) < MEAL_TYPES.length - 1 ? (
                        <>
                          Next {MEAL_TYPE_CONFIG[MEAL_TYPES[MEAL_TYPES.indexOf(currentMealType as (typeof MEAL_TYPES)[number]) + 1] as keyof typeof MEAL_TYPE_CONFIG].label}
                          <NextIcon className="h-5 w-5" />
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
                  className="fixed bottom-16 left-0 right-0 border-t border-slate-100 bg-white/92 p-4 backdrop-blur-2xl"
                  style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
                >
                  <motion.button
                    onClick={() => setPhase("summary")}
                    whileTap={{ scale: 0.98 }}
                    className="mx-auto flex min-h-[52px] w-full max-w-[398px] items-center justify-center gap-2 rounded-[18px] bg-slate-950 px-4 text-[14px] font-black text-white shadow-[0_12px_24px_rgba(15,23,42,0.18)]"
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
              className="flex flex-1 flex-col overflow-y-auto bg-[#F8FAFC] px-4 pt-4"
              style={{ paddingBottom: 'max(13rem, calc(9rem + env(safe-area-inset-bottom)))' }}
            >
              <div className="flex flex-1 flex-col">
                <section className="rounded-[28px] border border-white/70 bg-white/80 p-4 shadow-[0_14px_36px_rgba(15,23,42,0.07)] backdrop-blur-xl">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#020617]">
                        {format(selectedDate, "EEE, MMM d")}
                      </p>
                      <h2 className="mt-1 text-[24px] font-black leading-tight text-slate-950">Review order</h2>
                      <p className="mt-1 text-[13px] font-semibold leading-snug text-slate-500">{t("mealwizard_estimated_nutrition")}</p>
                    </div>
                    <span className="rounded-[18px] bg-slate-950 px-3 py-2 text-center text-[11px] font-black leading-tight text-white shadow-[0_10px_20px_rgba(2,6,23,0.14)]">
                      Fresh<br />daily
                    </span>
                  </div>

                  <div className="mt-5 grid grid-cols-3 gap-2">
                    <div className="min-w-0 rounded-[18px] bg-slate-50/80 px-2.5 py-3 ring-1 ring-slate-200/80 backdrop-blur">
                      <div className="flex items-center gap-1.5 text-orange-700">
                        <Flame className="h-4 w-4 shrink-0" strokeWidth={2.4} />
                        <p className="truncate text-[10px] font-black uppercase tracking-[0.08em]">Calories</p>
                      </div>
                      <p className="mt-2 truncate text-[22px] font-black leading-none text-[#020617]">{totalCalories}</p>
                      <p className="mt-1 text-[10px] font-extrabold uppercase tracking-[0.08em] text-slate-400">kcal</p>
                    </div>
                    <div className="min-w-0 rounded-[18px] bg-slate-50/80 px-2.5 py-3 ring-1 ring-slate-200/80 backdrop-blur">
                      <div className="flex items-center gap-1.5 text-rose-700">
                        <Beef className="h-4 w-4 shrink-0" strokeWidth={2.4} />
                        <p className="truncate text-[10px] font-black uppercase tracking-[0.08em]">Protein</p>
                      </div>
                      <p className="mt-2 truncate text-[22px] font-black leading-none text-[#020617]">{totalProtein}g</p>
                      <p className="mt-1 text-[10px] font-extrabold uppercase tracking-[0.08em] text-slate-400">total</p>
                    </div>
                    <div className="min-w-0 rounded-[18px] bg-slate-50/80 px-2.5 py-3 ring-1 ring-slate-200/80 backdrop-blur">
                      <div className="flex items-center gap-1.5 text-emerald-700">
                        <Leaf className="h-4 w-4 shrink-0" strokeWidth={2.4} />
                        <p className="truncate text-[10px] font-black uppercase tracking-[0.08em]">Carbs</p>
                      </div>
                      <p className="mt-2 truncate text-[22px] font-black leading-none text-[#020617]">{totalCarbs}g</p>
                      <p className="mt-1 text-[10px] font-extrabold uppercase tracking-[0.08em] text-slate-400">total</p>
                    </div>
                  </div>
                </section>

                <section className="mt-5">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <h2 className="text-[22px] font-black leading-tight text-slate-950">
                        {selectedMealEntries.length} meal{selectedMealEntries.length === 1 ? "" : "s"}
                      </h2>
                      <p className="mt-1 text-[14px] font-semibold leading-snug text-slate-500">{t("mealwizard_review_meal")}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPhase("meal-selection")}
                      className="h-10 rounded-full bg-slate-100 px-4 text-[13px] font-black text-slate-700 active:scale-95"
                    >
                      Add more
                    </button>
                  </div>

                  <div className="mt-4 space-y-3">
                    {selectedMealEntries.map(({ type, meal, config }, index) => {
                      const MealIcon = config.icon;
                      return (
                      <motion.div
                        key={type}
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.06 }}
                        className="rounded-[24px] border border-slate-100 bg-white p-3 shadow-[0_12px_32px_rgba(15,23,42,0.06)]"
                      >
                        <div className="flex gap-3">
                          {meal.image_url ? (
                            <img
                              src={meal.image_url}
                              alt={meal.name}
                              className="h-24 w-24 shrink-0 rounded-[20px] object-cover shadow-[0_8px_16px_rgba(15,23,42,0.08)]"
                            />
                          ) : (
                            <div className={`flex h-24 w-24 shrink-0 items-center justify-center rounded-[20px] ${config.bgGradient}`}>
                              <MealIcon className={`h-9 w-9 ${config.textColor}`} />
                            </div>
                          )}

                          <div className="min-w-0 flex-1 py-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase leading-none ${config.bgGradient} ${config.textColor}`}>{config.label}</span>
                                <h3 className="mt-2 line-clamp-2 text-[16px] font-black leading-tight text-slate-950">{meal.name}</h3>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleEditMeal(type)}
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-950 transition active:scale-95"
                                aria-label={`Edit ${config.label}`}
                              >
                                <NextIcon className="h-4.5 w-4.5" strokeWidth={2.5} />
                              </button>
                            </div>
                            <div className="mt-3 grid grid-cols-3 gap-1.5">
                              <span className="inline-flex min-w-0 flex-col rounded-[14px] bg-slate-50/80 px-2.5 py-2 text-[11px] font-extrabold text-slate-600 ring-1 ring-slate-200/80 backdrop-blur">
                                <span className="flex min-w-0 items-center gap-1 text-[#020617]">
                                <Clock className="h-3.5 w-3.5" />
                                {config.time}
                                </span>
                                <span className="mt-1 text-[8px] font-black uppercase tracking-[0.08em] text-slate-400">time</span>
                              </span>
                              <span className="rounded-[14px] bg-slate-50/80 px-2.5 py-2 text-[11px] font-black text-orange-700 ring-1 ring-slate-200/80 backdrop-blur">
                                {meal.calories || 0}
                                <span className="mt-1 block text-[8px] font-black uppercase tracking-[0.08em] text-slate-400">kcal</span>
                              </span>
                              <span className="rounded-[14px] bg-slate-50/80 px-2.5 py-2 text-[11px] font-black text-[#020617] ring-1 ring-slate-200/80 backdrop-blur">
                                {meal.protein_g || 0}g
                                <span className="mt-1 block text-[8px] font-black uppercase tracking-[0.08em] text-slate-400">protein</span>
                              </span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                      );
                    })}
                  </div>
                </section>

                <div
                  className="fixed left-1/2 z-[140] w-full max-w-[430px] -translate-x-1/2 border-t border-slate-100 bg-white/95 px-4 pb-3 pt-3 shadow-[0_-14px_32px_rgba(15,23,42,0.10)] backdrop-blur-2xl"
                  style={{ bottom: 'calc(64px + env(safe-area-inset-bottom, 0px))' }}
                >
                  <motion.button
                    onClick={() => setShowDeliveryScheduler(true)}
                    whileTap={{ scale: 0.98 }}
                    className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[18px] bg-slate-950 px-4 text-[15px] font-black text-white shadow-[0_12px_24px_rgba(15,23,42,0.18)]"
                  >
                    <Calendar className="h-5 w-5" strokeWidth={2.4} />
                    Schedule Delivery
                  </motion.button>

                  <div className="mt-2 flex items-center justify-center gap-2 text-[12px] font-bold text-slate-500">
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

      {showDeliveryScheduler && (
        <div className="fixed inset-0 z-[9999] bg-black/55 px-2 pt-2 backdrop-blur-sm safe-top">
          <div className="mx-auto flex h-full max-w-[430px] flex-col overflow-hidden rounded-t-[28px] bg-[#F8FAFC] shadow-[0_24px_70px_rgba(15,23,42,0.24)]">
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
          </div>
        </div>
      )}

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
