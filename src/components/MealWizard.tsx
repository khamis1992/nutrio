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
  ChevronRight
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
            <h3 className="text-lg font-semibold mb-3">Choose a Restaurant</h3>
            
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
    </div>
  );
};

export default MealWizard;
