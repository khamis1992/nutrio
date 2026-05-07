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
  Clock,
  Minus,
  Plus,
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
}: MealWizardProps) => {
  const { toast } = useToast();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { remainingMeals, isUnlimited, incrementMealUsage, subscription } = useSubscription();

  const [phase, setPhase] = useState<"intro" | "meal-selection" | "summary" | "success">("intro");
  const [currentMealType, setCurrentMealType] = useState<string>(MEAL_TYPES[initialStep] || "breakfast");
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
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

    const currentIndex = MEAL_TYPES.indexOf(currentMealType as any);
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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-black"
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

        {phase === "meal-selection" && (
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

      <div className="pb-32">
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
              style={{ height: 'calc(100vh - 140px)' }}
            >
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

              <div className="flex-1 overflow-y-auto px-4 pb-24">
                {meals.length === 0 && (
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3">Select Restaurant</h3>
                    <div className="space-y-2">
                      {restaurants.map((restaurant) => {
                        const isSelected = selectedRestaurant?.id === restaurant.id;
                        return (
                          <motion.button
                            key={restaurant.id}
                            onClick={() => {
                              setSelectedRestaurant(restaurant);
                              fetchMeals(restaurant.id);
                            }}
                            whileTap={{ scale: 0.98 }}
                            className={`w-full flex items-center gap-3 p-4 rounded-2xl transition-all ${
                              isSelected
                                ? "bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/30 dark:to-teal-900/30 border-2 border-emerald-400"
                                : "bg-white dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-800"
                            }`}
                          >
                            {restaurant.logo_url ? (
                              <img
                                src={restaurant.logo_url}
                                alt={restaurant.name}
                                className="w-12 h-12 rounded-xl object-cover"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
                                <Store className="h-6 w-6 text-white" />
                              </div>
                            )}
                            <div className="flex-1 text-left">
                              <p className="font-bold text-gray-900 dark:text-white">{restaurant.name}</p>
                              <p className="text-xs text-gray-500">{restaurant.cuisine_type}</p>
                            </div>
                            {restaurant.rating && (
                              <div className="flex items-center gap-1">
                                <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                  {restaurant.rating.toFixed(1)}
                                </span>
                              </div>
                            )}
                            {isSelected && <Check className="h-5 w-5 text-emerald-500" />}
                          </motion.button>
                        );
                      })}
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
                        const currentIndex = MEAL_TYPES.indexOf(currentMealType as any);
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
                      {MEAL_TYPES.indexOf(currentMealType as any) < MEAL_TYPES.length - 1 ? (
                        <>
                          Next: {MEAL_TYPE_CONFIG[MEAL_TYPES[MEAL_TYPES.indexOf(currentMealType as any) + 1] as keyof typeof MEAL_TYPE_CONFIG].label}
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
              className="p-4"
            >
              <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 dark:from-gray-800 dark:via-gray-900 dark:to-black rounded-3xl p-6 mb-6 shadow-xl">
                <h3 className="text-white font-bold text-lg mb-4">Daily Nutrition</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="w-12 h-12 rounded-2xl bg-white/10 mx-auto mb-2 flex items-center justify-center">
                      <Flame className="h-6 w-6 text-orange-400" />
                    </div>
                    <p className="text-2xl font-black text-white">{totalCalories}</p>
                    <p className="text-xs text-gray-400">Calories</p>
                  </div>
                  <div className="text-center">
                    <div className="w-12 h-12 rounded-2xl bg-white/10 mx-auto mb-2 flex items-center justify-center">
                      <Beef className="h-6 w-6 text-rose-400" />
                    </div>
                    <p className="text-2xl font-black text-white">{totalProtein}g</p>
                    <p className="text-xs text-gray-400">Protein</p>
                  </div>
                  <div className="text-center">
                    <div className="w-12 h-12 rounded-2xl bg-white/10 mx-auto mb-2 flex items-center justify-center">
                      <Leaf className="h-6 w-6 text-emerald-400" />
                    </div>
                    <p className="text-2xl font-black text-white">{totalCarbs}g</p>
                    <p className="text-xs text-gray-400">Carbs</p>
                  </div>
                </div>
              </div>

              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">
                {Object.keys(selectedMeals).length} Meals Selected
              </h3>
              <div className="space-y-3">
                {MEAL_TYPES.filter((type) => selectedMeals[type]).map((type, index) => {
                  const meal = selectedMeals[type];
                  const typeConfig = MEAL_TYPE_CONFIG[type];
                  const Icon = typeConfig.icon;
                  return (
                    <motion.div
                      key={type}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-800"
                    >
                      <div className="flex items-center gap-3 p-4">
                        <div className={`w-14 h-14 rounded-2xl ${typeConfig.gradient} flex items-center justify-center shadow-lg`}>
                          <Icon className="h-7 w-7 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${typeConfig.textColor}`}>
                              {typeConfig.label}
                            </span>
                            <span className="text-[10px] text-gray-300">·</span>
                            <span className="text-[10px] text-gray-400 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {typeConfig.time}
                            </span>
                          </div>
                          <h4 className="font-bold text-gray-900 dark:text-white truncate">{meal?.name}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-lg ${typeConfig.bgGradient} ${typeConfig.textColor}`}>
                              {meal?.calories} kcal
                            </span>
                            <span className="text-xs text-gray-400">{meal?.protein_g}g protein</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleEditMeal(type)}
                          className="w-10 h-10 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center cursor-pointer active:scale-95 transition-all"
                        >
                          <ChevronRight className="h-5 w-5 text-gray-400" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              <motion.button
                onClick={() => setShowDeliveryScheduler(true)}
                whileTap={{ scale: 0.98 }}
                className="w-full py-5 mt-6 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-500 text-white font-bold text-lg shadow-xl shadow-emerald-500/25 flex items-center justify-center gap-3"
              >
                <Calendar className="h-6 w-6" />
                Schedule Delivery
              </motion.button>
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