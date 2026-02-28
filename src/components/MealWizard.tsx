import { useState, useEffect } from "react";
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
  Check,
  X,
  Flame,
  Beef,
  ChefHat,
  ArrowRight,
  Store,
  MapPin,
  Star,
  ChevronRight,
  Sparkles,
  Target,
  Loader2
} from "lucide-react";
import { format } from "date-fns";

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
}

const STEPS = [
  { id: "breakfast", label: "Breakfast", icon: Coffee, color: "bg-amber-500", lightColor: "bg-amber-50", description: "Start your day with energy" },
  { id: "lunch", label: "Lunch", icon: Sun, color: "bg-orange-500", lightColor: "bg-orange-50", description: "Fuel your afternoon" },
  { id: "dinner", label: "Dinner", icon: Moon, color: "bg-indigo-500", lightColor: "bg-indigo-50", description: "End your day right" },
  { id: "snack", label: "Snacks & Salad", icon: Apple, color: "bg-emerald-500", lightColor: "bg-emerald-50", description: "Healthy extras" },
];

const MealWizard = ({ userId, selectedDate, onComplete, onCancel }: MealWizardProps) => {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMeals, setSelectedMeals] = useState<Record<string, Meal & { restaurant: Restaurant }>>({
    breakfast: null as any,
    lunch: null as any,
    dinner: null as any,
    snack: null as any,
  });
  const [scheduling, setScheduling] = useState(false);

  // Smart recommendation state
  const [remainingNutrition, setRemainingNutrition] = useState({
    calories: 2000,
    protein: 120,
    carbs: 250,
    fat: 65,
  });
  const [recommendedMeals, setRecommendedMeals] = useState<Meal[]>([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [showRecommendations, setShowRecommendations] = useState(true);

  // Auto-fill day state
  const [autoFillLoading, setAutoFillLoading] = useState(false);
  const [showAutoFillDialog, setShowAutoFillDialog] = useState(false);
  const [generatedDayPlan, setGeneratedDayPlan] = useState<any>(null);

  const currentStepData = STEPS[currentStep];
  const CurrentIcon = currentStepData.icon;

  useEffect(() => {
    fetchRestaurants();
  }, []);

  useEffect(() => {
    if (selectedRestaurant) {
      fetchRestaurantMeals(selectedRestaurant.id);
    }
  }, [selectedRestaurant]);

  const fetchRestaurants = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("restaurants")
        .select(`
          id,
          name,
          description,
          address,
          logo_url,
          rating,
          cuisine_type
        `)
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

  const fetchRestaurantMeals = async (restaurantId: string) => {
    console.log("Fetching meals for restaurant:", restaurantId);
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("meals")
        .select(`
          id,
          name,
          description,
          calories,
          protein_g,
          carbs_g,
          fat_g,
          image_url,
          is_available,
          restaurant_id
        `)
        .eq("restaurant_id", restaurantId)
        .eq("is_available", true)
        .order("name", { ascending: true });

      console.log("Meals query result:", { data, error });

      if (error) {
        console.error("Supabase error:", error);
        throw error;
      }
      
      console.log(`Found ${data?.length || 0} meals`);
      setMeals(data || []);
    } catch (err) {
      console.error("Error fetching meals:", err);
      toast({
        title: "Error",
        description: "Failed to load meals",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Calculate remaining nutrition for the selected date
  const calculateRemainingNutrition = async () => {
    if (!userId) return;

    try {
      // Fetch user's daily targets from profile
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("daily_calorie_target, protein_target_g, carbs_target_g, fat_target_g")
        .eq("id", userId)
        .limit(1);

      if (error) {
        console.error("Error fetching profile:", error);
        return;
      }

      const profile = profiles?.[0];

      if (profile) {
        const targets = {
          calories: profile.daily_calorie_target || 2000,
          protein: profile.protein_target_g || 120,
          carbs: profile.carbs_target_g || 250,
          fat: profile.fat_target_g || 65,
        };

        // Fetch already scheduled meals for this date
        const dateStr = format(selectedDate, "yyyy-MM-dd");
        const { data: scheduledMeals } = await supabase
          .from("meal_schedules")
          .select(`
            meal:meals(
              calories,
              protein_g,
              carbs_g,
              fat_g
            )
          `)
          .eq("user_id", userId)
          .eq("scheduled_date", dateStr);

        // Calculate consumed nutrition
        const consumed = (scheduledMeals || []).reduce(
          (acc, schedule: any) => ({
            calories: acc.calories + (schedule.meal?.calories || 0),
            protein: acc.protein + (schedule.meal?.protein_g || 0),
            carbs: acc.carbs + (schedule.meal?.carbs_g || 0),
            fat: acc.fat + (schedule.meal?.fat_g || 0),
          }),
          { calories: 0, protein: 0, carbs: 0, fat: 0 }
        );

        // Also subtract meals already selected in this wizard session
        const selectedConsumed = Object.values(selectedMeals).reduce(
          (acc, meal) => ({
            calories: acc.calories + (meal?.calories || 0),
            protein: acc.protein + (meal?.protein_g || 0),
            carbs: acc.carbs + (meal?.carbs_g || 0),
            fat: acc.fat + (meal?.fat_g || 0),
          }),
          { calories: 0, protein: 0, carbs: 0, fat: 0 }
        );

        setRemainingNutrition({
          calories: Math.max(0, targets.calories - consumed.calories - selectedConsumed.calories),
          protein: Math.max(0, targets.protein - consumed.protein - selectedConsumed.protein),
          carbs: Math.max(0, targets.carbs - consumed.carbs - selectedConsumed.carbs),
          fat: Math.max(0, targets.fat - consumed.fat - selectedConsumed.fat),
        });
      }
    } catch (err) {
      console.error("Error calculating remaining nutrition:", err);
    }
  };

  // Fetch recommended meals based on remaining nutrition
  const fetchRecommendedMeals = async () => {
    if (!userId || !showRecommendations) return;

    setLoadingRecommendations(true);
    try {
      // Get all available meals
      const { data: allMeals, error: mealsError } = await supabase
        .from("meals")
        .select(`
          id,
          name,
          description,
          calories,
          protein_g,
          carbs_g,
          fat_g,
          image_url,
          is_available,
          restaurant_id
        `)
        .eq("is_available", true)
        .limit(100);

      if (mealsError) throw mealsError;

      // Get all restaurants for lookup
      const { data: restaurantsData, error: restaurantsError } = await supabase
        .from("restaurants")
        .select("id, name, logo_url");

      if (restaurantsError) throw restaurantsError;

      // Create restaurant lookup map
      const restaurantMap = (restaurantsData || []).reduce((acc: Record<string, any>, r: any) => {
        acc[r.id] = r;
        return acc;
      }, {});

      // Filter and score meals based on remaining nutrition
      const scoredMeals = (allMeals || [])
        .map((meal: any) => {
          const calories = meal.calories || 0;
          const protein = meal.protein_g || 0;

          // Calculate score based on how well meal fits remaining targets
          let score = 0;

          // Prefer meals that don't exceed remaining calories
          if (calories <= remainingNutrition.calories * 1.2) {
            score += 50;
          }

          // Bonus for protein content
          if (remainingNutrition.protein > 0 && protein > 0) {
            const proteinRatio = protein / remainingNutrition.protein;
            if (proteinRatio >= 0.15 && proteinRatio <= 0.4) {
              score += 30; // Good protein portion for this meal
            }
          }

          // Prefer meals with reasonable calorie density
          if (calories >= 200 && calories <= 800) {
            score += 20;
          }

          // Attach restaurant data
          const restaurant = restaurantMap[meal.restaurant_id];

          return { ...meal, score, restaurant };
        })
        .filter((meal: any) => meal.score > 30)
        .sort((a: any, b: any) => b.score - a.score)
        .slice(0, 8);

      setRecommendedMeals(scoredMeals);
    } catch (err) {
      console.error("Error fetching recommendations:", err);
    } finally {
      setLoadingRecommendations(false);
    }
  };

  // Update remaining nutrition when step changes or meals are selected
  useEffect(() => {
    calculateRemainingNutrition();
  }, [currentStep, selectedMeals, selectedDate]);

  // Fetch recommendations when nutrition changes
  useEffect(() => {
    fetchRecommendedMeals();
  }, [remainingNutrition, showRecommendations]);

  const selectMeal = (meal: Meal) => {
    const stepKey = STEPS[currentStep].id;
    setSelectedMeals(prev => ({
      ...prev,
      [stepKey]: { ...meal, restaurant: selectedRestaurant! }
    }));
    
    toast({
      title: `${currentStepData.label} selected`,
      description: `${meal.name} from ${selectedRestaurant?.name}`,
    });
  };

  const isMealSelected = (mealId: string) => {
    const stepKey = STEPS[currentStep].id;
    return selectedMeals[stepKey]?.id === mealId;
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setSelectedRestaurant(null);
      setMeals([]);
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (selectedRestaurant) {
      setSelectedRestaurant(null);
      setMeals([]);
    } else if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleComplete = async () => {
    setScheduling(true);
    
    try {
      const allSelectedMeals = Object.entries(selectedMeals)
        .filter(([_, meal]) => meal !== null)
        .map(([mealType, meal]) => ({
          user_id: userId,
          meal_id: meal.id,
          scheduled_date: format(selectedDate, "yyyy-MM-dd"),
          meal_type: mealType,
          is_completed: false,
        }));

      if (allSelectedMeals.length === 0) {
        toast({
          title: "No meals selected",
          description: "Please select at least one meal to schedule.",
          variant: "destructive",
        });
        setScheduling(false);
        return;
      }

      const { error } = await supabase
        .from("meal_schedules")
        .insert(allSelectedMeals);

      if (error) throw error;

      toast({
        title: "Success!",
        description: `${allSelectedMeals.length} meal${allSelectedMeals.length > 1 ? 's' : ''} scheduled for ${format(selectedDate, "EEEE, MMM d")}`,
      });

      onComplete();
    } catch (err) {
      console.error("Error scheduling meals:", err);
      toast({
        title: "Error",
        description: "Failed to schedule meals. Please try again.",
        variant: "destructive",
      });
    } finally {
      setScheduling(false);
    }
  };

  const getTotalSelectedMeals = () => {
    return Object.values(selectedMeals).filter(meal => meal !== null).length;
  };

  // Auto-fill day with AI suggestions
  const handleAutoFillDay = async () => {
    setAutoFillLoading(true);
    setShowAutoFillDialog(true);

    try {
      const { data, error } = await supabase.functions.invoke("smart-meal-allocator", {
        body: {
          user_id: userId,
          week_start_date: format(selectedDate, "yyyy-MM-dd"),
          generate_variations: 1,
          save_to_database: false,
        },
      });

      if (error) {
        if (error.message?.includes('CORS') || error.message?.includes('Failed to send') || error.message?.includes('net::ERR')) {
          toast({
            title: "Feature not available",
            description: "Auto-fill is coming soon! Please select meals manually.",
            variant: "destructive"
          });
          setShowAutoFillDialog(false);
          return;
        }
        throw error;
      }

      if (data?.weekly_plan?.items) {
        // Filter meals for the selected date only
        const dateStr = format(selectedDate, "yyyy-MM-dd");
        const dayMeals = data.weekly_plan.items.filter((item: any) =>
          item.scheduled_date === dateStr
        );

        if (dayMeals.length > 0) {
          setGeneratedDayPlan(dayMeals);
        } else {
          toast({
            title: "No suggestions",
            description: "Could not generate suggestions for this day. Please select manually.",
            variant: "destructive"
          });
          setShowAutoFillDialog(false);
        }
      } else {
        toast({
          title: "No meals available",
          description: "Could not generate a meal plan. Try selecting manually.",
          variant: "destructive"
        });
        setShowAutoFillDialog(false);
      }
    } catch (err: any) {
      console.error("Error generating day plan:", err);
      toast({
        title: "Error",
        description: err.message || "Failed to generate meal plan",
        variant: "destructive"
      });
      setShowAutoFillDialog(false);
    } finally {
      setAutoFillLoading(false);
    }
  };

  const applyAutoFillPlan = () => {
    if (!generatedDayPlan || generatedDayPlan.length === 0) return;

    // Auto-select all meals from the generated plan
    const newSelectedMeals = { ...selectedMeals };

    generatedDayPlan.forEach((item: any) => {
      const mealType = item.meal_type;
      if (STEPS.find(s => s.id === mealType) && item.meal) {
        newSelectedMeals[mealType] = {
          ...item.meal,
          restaurant: item.restaurant || { id: item.meal.restaurant_id, name: "Restaurant", logo_url: null }
        };
      }
    });

    setSelectedMeals(newSelectedMeals);
    setShowAutoFillDialog(false);
    setGeneratedDayPlan(null);

    toast({
      title: "Day Auto-Filled!",
      description: `Added ${generatedDayPlan.length} meals to your schedule.`,
    });
  };

  const getStepSelected = (stepIndex: number) => {
    const stepKey = STEPS[stepIndex].id;
    return selectedMeals[stepKey];
  };

  return (
    <div className="fixed inset-0 z-50 bg-background">
      {/* Header */}
      <motion.div 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="sticky top-0 z-10 bg-gradient-to-r from-background via-background to-muted/30 border-b border-border/50"
      >
        <div className="flex items-center justify-between p-4">
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="h-5 w-5" />
          </Button>
          <div className="text-center">
            <h1 className="text-lg font-semibold">Schedule Your Day</h1>
            <p className="text-xs text-muted-foreground">{format(selectedDate, "EEEE, MMMM d")}</p>
          </div>
          <div className="w-10" />
        </div>

        {/* Progress Steps */}
        <div className="px-4 pb-4">
          <div className="flex items-center justify-between relative">
            {/* Progress Line */}
            <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 bg-muted rounded-full">
              <motion.div 
                className="h-full bg-gradient-to-r from-amber-500 via-orange-500 via-indigo-500 to-emerald-500 rounded-full"
                initial={{ width: "0%" }}
                animate={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
              />
            </div>
            
            {STEPS.map((step, index) => {
              const StepIcon = step.icon;
              const isActive = index === currentStep;
              const hasSelection = getStepSelected(index) !== null;
              const isDone = index < currentStep || hasSelection;
              
              return (
                <motion.button
                  key={step.id}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: index * 0.1 }}
                  onClick={() => {
                    if (index <= currentStep) {
                      setSelectedRestaurant(null);
                      setMeals([]);
                      setCurrentStep(index);
                    }
                  }}
                  className={`relative z-10 w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                    isActive 
                      ? `${step.color} text-white shadow-lg shadow-${step.color}/30 scale-110` 
                      : isDone
                      ? `${step.color} text-white`
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {isDone ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <StepIcon className="h-5 w-5" />
                  )}
                </motion.button>
              );
            })}
          </div>
          
          {/* Step Labels */}
          <div className="flex justify-between mt-2 px-1">
            {STEPS.map((step, index) => (
              <span 
                key={step.id} 
                className={`text-[10px] font-medium transition-colors ${
                  index === currentStep ? 'text-foreground' : 'text-muted-foreground'
                }`}
              >
                {step.label}
              </span>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Content */}
      <div className="h-[calc(100vh-200px)] overflow-y-auto p-4 pb-32">
        {/* Step Header */}
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className={`rounded-2xl p-4 mb-4 ${currentStepData.lightColor}`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl ${currentStepData.color} flex items-center justify-center text-white`}>
              <CurrentIcon className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold">{currentStepData.label}</h2>
              <p className="text-sm text-muted-foreground">{currentStepData.description}</p>
            </div>
          </div>
        </motion.div>

        {/* Selected Meal for This Step */}
        {getStepSelected(currentStep) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4"
          >
            <p className="text-sm font-medium text-muted-foreground mb-2">Selected for {currentStepData.label}</p>
            <div className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-2 rounded-xl">
              <Check className="h-4 w-4" />
              <div className="flex-1">
                <p className="font-medium text-sm">{getStepSelected(currentStep)?.name}</p>
                <p className="text-xs opacity-80">from {getStepSelected(currentStep)?.restaurant.name}</p>
              </div>
              <button
                onClick={() => {
                  const stepKey = STEPS[currentStep].id;
                  setSelectedMeals(prev => ({ ...prev, [stepKey]: null as any }));
                }}
                className="hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : selectedRestaurant ? (
          /* Restaurant Meals View */
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            {/* Back to Restaurants Button */}
            <Button
              variant="ghost"
              className="mb-4"
              onClick={() => {
                setSelectedRestaurant(null);
                setMeals([]);
              }}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back to Restaurants
            </Button>

            {/* Restaurant Header */}
            <div className="flex items-center gap-3 mb-4 p-3 bg-muted rounded-xl">
              {selectedRestaurant.logo_url ? (
                <img
                  src={selectedRestaurant.logo_url}
                  alt={selectedRestaurant.name}
                  className="w-12 h-12 rounded-xl object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Store className="h-6 w-6 text-primary" />
                </div>
              )}
              <div>
                <h3 className="font-semibold">{selectedRestaurant.name}</h3>
                <p className="text-xs text-muted-foreground">{selectedRestaurant.cuisine_type || 'Various cuisine'}</p>
              </div>
            </div>

            {/* Meals List */}
            {meals.length === 0 ? (
              <div className="text-center py-12">
                <ChefHat className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-muted-foreground">No meals available from this restaurant</p>
              </div>
            ) : (
              <div className="space-y-3">
                <AnimatePresence>
                  {meals.map((meal, index) => (
                    <motion.div
                      key={meal.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => selectMeal(meal)}
                      className={`group cursor-pointer relative overflow-hidden rounded-2xl border-2 transition-all duration-300 ${
                        isMealSelected(meal.id)
                          ? 'border-primary bg-primary/5 shadow-lg'
                          : 'border-border bg-card hover:border-primary/30'
                      }`}
                    >
                      <div className="flex gap-3 p-3">
                        {/* Image */}
                        <div className="relative w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-muted">
                          {meal.image_url ? (
                            <img
                              src={meal.image_url}
                              alt={meal.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-2xl">
                              🍽️
                            </div>
                          )}
                          
                          {isMealSelected(meal.id) && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="absolute inset-0 bg-primary/60 flex items-center justify-center"
                            >
                              <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
                                <Check className="h-5 w-5 text-primary" />
                              </div>
                            </motion.div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm truncate">{meal.name}</h3>
                          
                          {meal.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                              {meal.description}
                            </p>
                          )}

                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-0.5">
                              <Flame className="h-3 w-3 text-orange-500" />
                              {meal.calories} cal
                            </span>
                            <span className="flex items-center gap-0.5">
                              <Beef className="h-3 w-3 text-red-500" />
                              {meal.protein_g}g protein
                            </span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        ) : (
          /* Restaurants List View */
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Choose a Restaurant</h3>
            </div>

            {/* Auto-fill Day Button */}
            {getTotalSelectedMeals() === 0 && (
              <motion.button
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={handleAutoFillDay}
                disabled={autoFillLoading}
                className="w-full mb-4 py-3 px-4 bg-gradient-to-r from-primary/10 to-emerald-500/10 border border-primary/20 rounded-xl flex items-center justify-center gap-2 text-primary font-medium hover:bg-primary/5 transition-colors disabled:opacity-50"
              >
                {autoFillLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <Sparkles className="h-5 w-5" />
                    <span>Auto-fill My Day with AI</span>
                  </>
                )}
              </motion.button>
            )}

            {/* Recommended for You Section */}
            {showRecommendations && recommendedMeals.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold text-sm">Recommended for You</h3>
                  </div>
                  <button
                    onClick={() => setShowRecommendations(false)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Hide
                  </button>
                </div>

                {/* Remaining Nutrition Badge */}
                <div className="flex flex-wrap gap-2 mb-3">
                  <Badge variant="secondary" className="text-xs">
                    <Target className="h-3 w-3 mr-1" />
                    {remainingNutrition.calories} cal remaining
                  </Badge>
                  <Badge variant="secondary" className="text-xs bg-red-50 text-red-600">
                    <Beef className="h-3 w-3 mr-1" />
                    {remainingNutrition.protein}g protein
                  </Badge>
                </div>

                {/* Recommended Meals Horizontal Scroll */}
                {loadingRecommendations ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
                    {recommendedMeals.map((meal) => (
                      <motion.div
                        key={meal.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        onClick={() => {
                          // Find restaurant and select meal
                          const restaurant = restaurants.find(r => r.id === meal.restaurant_id);
                          if (restaurant) {
                            setSelectedRestaurant(restaurant);
                            fetchRestaurantMeals(restaurant.id);
                            setTimeout(() => selectMeal(meal), 300);
                          }
                        }}
                        className="flex-shrink-0 w-40 cursor-pointer group"
                      >
                        <div className="relative w-full h-24 rounded-xl overflow-hidden bg-muted mb-2">
                          {meal.image_url ? (
                            <img
                              src={meal.image_url}
                              alt={meal.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-2xl">
                              🍽️
                            </div>
                          )}
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                            <p className="text-white text-xs font-medium truncate">
                              {meal.calories} cal
                            </p>
                          </div>
                        </div>
                        <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                          {meal.name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {meal.restaurant?.name || 'Restaurant'}
                        </p>
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-xs text-red-500 font-medium">
                            {meal.protein_g}g protein
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {restaurants.length === 0 ? (
              <div className="text-center py-12">
                <Store className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-muted-foreground">No restaurants available</p>
              </div>
            ) : (
              <div className="space-y-3">
                <AnimatePresence>
                  {restaurants.map((restaurant, index) => (
                    <motion.div
                      key={restaurant.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => setSelectedRestaurant(restaurant)}
                      className="group cursor-pointer relative overflow-hidden rounded-2xl border-2 border-border bg-card hover:border-primary/50 transition-all duration-300"
                    >
                      <div className="flex items-center gap-4 p-4">
                        {/* Logo */}
                        {restaurant.logo_url ? (
                          <img
                            src={restaurant.logo_url}
                            alt={restaurant.name}
                            className="w-16 h-16 rounded-xl object-cover"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                            <Store className="h-8 w-8 text-primary" />
                          </div>
                        )}

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-lg">{restaurant.name}</h3>
                            {restaurant.rating && restaurant.rating > 0 && (
                              <div className="flex items-center gap-0.5 text-amber-500">
                                <Star className="h-3 w-3 fill-current" />
                                <span className="text-xs font-medium">{restaurant.rating.toFixed(1)}</span>
                              </div>
                            )}
                          </div>
                          
                          {restaurant.cuisine_type && (
                            <Badge variant="secondary" className="mt-1 text-xs">
                              {restaurant.cuisine_type}
                            </Badge>
                          )}

                          {restaurant.address && (
                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {restaurant.address}
                            </p>
                          )}
                        </div>

                        {/* Arrow */}
                        <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* Bottom Actions */}
      <motion.div 
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur-lg border-t border-border"
      >
        <div className="flex items-center gap-3">
          {(currentStep > 0 || selectedRestaurant) && (
            <Button
              variant="outline"
              className="rounded-xl px-6"
              onClick={handleBack}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              {selectedRestaurant ? 'Restaurants' : 'Back'}
            </Button>
          )}
          
          <div className="flex-1">
            {getTotalSelectedMeals() > 0 && (
              <div className="text-center mb-2">
                <span className="text-sm text-muted-foreground">
                  {getTotalSelectedMeals()} of 4 meals selected
                </span>
              </div>
            )}
            
            {currentStep < STEPS.length - 1 ? (
              <Button 
                className="w-full rounded-xl h-12 text-base font-semibold"
                onClick={handleNext}
                disabled={!getStepSelected(currentStep)}
              >
                Continue
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button 
                className="w-full rounded-xl h-12 text-base font-semibold bg-gradient-to-r from-primary to-emerald-500 hover:opacity-90"
                onClick={handleComplete}
                disabled={scheduling || getTotalSelectedMeals() === 0}
              >
                {scheduling ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Scheduling...
                  </>
                ) : (
                  <>
                    <ChefHat className="h-4 w-4 mr-2" />
                    Schedule {getTotalSelectedMeals()} Meal{getTotalSelectedMeals() > 1 ? 's' : ''}
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Auto-fill Day Dialog */}
      <AnimatePresence>
        {showAutoFillDialog && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAutoFillDialog(false)}
              className="fixed inset-0 bg-black/50 z-50"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 bg-background rounded-t-3xl z-50 max-h-[85vh] overflow-y-auto"
            >
              {/* Handle Bar */}
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-10 h-1 bg-muted rounded-full" />
              </div>

              <div className="p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-emerald-500 flex items-center justify-center">
                      <Sparkles className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">AI Suggestions</h2>
                      <p className="text-sm text-muted-foreground">Personalized for your goals</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowAutoFillDialog(false)}
                    className="p-2 rounded-full bg-muted"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {autoFillLoading ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                    <p className="text-muted-foreground">Creating your perfect day...</p>
                  </div>
                ) : generatedDayPlan ? (
                  <>
                    {/* Summary */}
                    <div className="bg-gradient-to-r from-primary/10 to-emerald-50 dark:from-primary/20 dark:to-emerald-900/20 rounded-2xl p-4 mb-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Meals</p>
                          <p className="text-2xl font-bold">{generatedDayPlan.length}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Total Calories</p>
                          <p className="text-2xl font-bold">
                            {generatedDayPlan.reduce((sum: number, item: any) => sum + (item.meal?.calories || 0), 0)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Meal List */}
                    <div className="space-y-3 mb-6 max-h-[40vh] overflow-y-auto">
                      {generatedDayPlan.map((item: any, index: number) => {
                        const config = STEPS.find(s => s.id === item.meal_type);
                        const MealTypeIcon = config?.icon || ChefHat;

                        return (
                          <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="flex items-center gap-3 p-3 bg-muted/50 rounded-2xl"
                          >
                            <div className={`w-10 h-10 rounded-xl ${config?.color || 'bg-primary'} flex items-center justify-center`}>
                              <MealTypeIcon className="h-5 w-5 text-white" />
                            </div>

                            {item.meal?.image_url ? (
                              <img
                                src={item.meal.image_url}
                                alt={item.meal.name}
                                className="w-14 h-14 rounded-xl object-cover"
                              />
                            ) : (
                              <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center">
                                <ChefHat className="h-6 w-6 text-muted-foreground" />
                              </div>
                            )}

                            <div className="flex-1 min-w-0">
                              <p className="font-semibold truncate">{item.meal?.name}</p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                <span className="capitalize">{item.meal_type}</span>
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-xs">
                                <span className="text-orange-500 font-medium">{item.meal?.calories || 0} cal</span>
                                <span className="text-red-500 font-medium">{item.meal?.protein_g || 0}g protein</span>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        className="flex-1 rounded-xl h-12"
                        onClick={() => setShowAutoFillDialog(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        className="flex-1 rounded-xl h-12 bg-gradient-to-r from-primary to-emerald-500"
                        onClick={applyAutoFillPlan}
                      >
                        <Check className="h-5 w-5 mr-2" />
                        Apply All Meals
                      </Button>
                    </div>
                  </>
                ) : null}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MealWizard;
