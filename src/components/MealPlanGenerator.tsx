import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Flame, 
  Plus, 
  ShoppingCart,
  Utensils,
  Clock,
  Star,
  RefreshCw,
  Sparkles,
  Target
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, addDays, startOfWeek } from "date-fns";

interface Meal {
  id: string;
  name: string;
  description: string | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  price: number | null;
  image_url: string | null;
  prep_time_minutes: number | null;
  rating: number | null;
  review_count: number | null;
  restaurant_id: string | null;
  meal_type: string | null;
  vendor: string | null;
}

interface Restaurant {
  id: string;
  name: string;
  logo_url: string | null;
  rating: number | null;
}

interface MealPlanDay {
  date: Date;
  breakfast: Meal | null;
  lunch: Meal | null;
  dinner: Meal | null;
  snack: Meal | null;
}

interface NutritionTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export function MealPlanGenerator() {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [mealPlan, setMealPlan] = useState<MealPlanDay[]>([]);
  const targets: NutritionTargets = {
    calories: 2000,
    protein: 120,
    carbs: 250,
    fat: 65
  };
  const [selectedWeek, setSelectedWeek] = useState(new Date());
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedDay, setSelectedDay] = useState(0);
  const { toast } = useToast();

  // Fetch meals and restaurants
  useEffect(() => {
    fetchMealsAndRestaurants();
    initializeWeek();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchMealsAndRestaurants = async () => {
    try {
      // Fetch available meals with nutrition info
      const { data: mealsData, error: mealsError } = await supabase
        .from('meals')
        .select('*')
        .eq('is_available', true)
        .not('calories', 'is', null)
        .order('rating', { ascending: false })
        .limit(100);

      if (mealsError) throw mealsError;
      setMeals(mealsData || []);

      // Fetch restaurants
      const { data: restaurantsData, error: restaurantsError } = await supabase
        .from('restaurants')
        .select('id, name, logo_url, rating')
        .eq('is_active', true)
        .limit(50);

      if (restaurantsError) throw restaurantsError;
      setRestaurants(restaurantsData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Error loading meals",
        description: "Please try again later",
        variant: "destructive"
      });
    }
  };

  const initializeWeek = () => {
    const weekStart = startOfWeek(selectedWeek, { weekStartsOn: 0 });
    const days: MealPlanDay[] = [];
    
    for (let i = 0; i < 7; i++) {
      days.push({
        date: addDays(weekStart, i),
        breakfast: null,
        lunch: null,
        dinner: null,
        snack: null
      });
    }
    
    setMealPlan(days);
  };

  const generateSmartMealPlan = () => {
    setIsGenerating(true);
    
    setTimeout(() => {
      const weekStart = startOfWeek(selectedWeek, { weekStartsOn: 0 });
      const newPlan: MealPlanDay[] = [];
      
      // Categorize meals by type
      const breakfastMeals = meals.filter(m => 
        m.meal_type?.toLowerCase().includes('breakfast') || 
        m.name.toLowerCase().includes('breakfast') ||
        m.name.toLowerCase().includes('eggs') ||
        m.name.toLowerCase().includes('oatmeal') ||
        m.name.toLowerCase().includes('pancake')
      );
      
      const lunchMeals = meals.filter(m => 
        m.meal_type?.toLowerCase().includes('lunch') ||
        m.name.toLowerCase().includes('salad') ||
        m.name.toLowerCase().includes('sandwich') ||
        m.name.toLowerCase().includes('wrap') ||
        m.name.toLowerCase().includes('bowl')
      );
      
      const dinnerMeals = meals.filter(m => 
        m.meal_type?.toLowerCase().includes('dinner') ||
        m.name.toLowerCase().includes('chicken') ||
        m.name.toLowerCase().includes('steak') ||
        m.name.toLowerCase().includes('fish') ||
        m.name.toLowerCase().includes('pasta') ||
        m.name.toLowerCase().includes('rice')
      );
      
      const snackMeals = meals.filter(m => 
        m.meal_type?.toLowerCase().includes('snack') ||
        m.calories! < 300
      );

      for (let i = 0; i < 7; i++) {
        const day: MealPlanDay = {
          date: addDays(weekStart, i),
          breakfast: getRandomMeal(breakfastMeals),
          lunch: getRandomMeal(lunchMeals),
          dinner: getRandomMeal(dinnerMeals),
          snack: getRandomMeal(snackMeals)
        };
        newPlan.push(day);
      }
      
      setMealPlan(newPlan);
      setIsGenerating(false);
      
      toast({
        title: "Meal plan generated!",
        description: "Your 7-day restaurant meal plan is ready"
      });
    }, 1500);
  };

  const getRandomMeal = (mealList: Meal[]): Meal | null => {
    if (mealList.length === 0) return null;
    // Prioritize highly-rated meals
    const sortedMeals = [...mealList].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    const topMeals = sortedMeals.slice(0, Math.min(10, sortedMeals.length));
    return topMeals[Math.floor(Math.random() * topMeals.length)];
  };

  const calculateDayTotals = (day: MealPlanDay) => {
    const meals = [day.breakfast, day.lunch, day.dinner, day.snack].filter(Boolean);
    return {
      calories: meals.reduce((sum, m) => sum + (m?.calories || 0), 0),
      protein: meals.reduce((sum, m) => sum + (m?.protein_g || 0), 0),
      carbs: meals.reduce((sum, m) => sum + (m?.carbs_g || 0), 0),
      fat: meals.reduce((sum, m) => sum + (m?.fat_g || 0), 0),
      price: meals.reduce((sum, m) => sum + (m?.price || 0), 0)
    };
  };

  const calculateWeekTotals = () => {
    return mealPlan.reduce((totals, day) => {
      const dayTotals = calculateDayTotals(day);
      return {
        calories: totals.calories + dayTotals.calories,
        protein: totals.protein + dayTotals.protein,
        carbs: totals.carbs + dayTotals.carbs,
        fat: totals.fat + dayTotals.fat,
        price: totals.price + dayTotals.price
      };
    }, { calories: 0, protein: 0, carbs: 0, fat: 0, price: 0 });
  };

  const weekTotals = calculateWeekTotals();
  const currentDay = mealPlan[selectedDay];
  const dayTotals = currentDay ? calculateDayTotals(currentDay) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Calendar className="w-6 h-6 text-primary" />
            Weekly Restaurant Meal Plan
          </h2>
          <p className="text-muted-foreground mt-1">
            Smart meal planning from {restaurants.length} partner restaurants
          </p>
        </div>
        <Button 
          onClick={generateSmartMealPlan} 
          disabled={isGenerating || meals.length === 0}
          className="gap-2"
        >
          {isGenerating ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          {isGenerating ? "Generating..." : "Generate Smart Plan"}
        </Button>
      </div>

      {/* Week Selector */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setSelectedWeek(addDays(selectedWeek, -7))}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="font-medium">
              Week of {format(startOfWeek(selectedWeek, { weekStartsOn: 0 }), "MMM d, yyyy")}
            </span>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setSelectedWeek(addDays(selectedWeek, 7))}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Week Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Flame className="w-4 h-4 text-orange-600" />
              <span className="text-xs font-medium text-orange-600">Avg Calories</span>
            </div>
            <p className="text-2xl font-bold text-orange-900">
              {Math.round(weekTotals.calories / 7)}
            </p>
            <p className="text-xs text-orange-700">/ {targets.calories} target</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-medium text-blue-600">Avg Protein</span>
            </div>
            <p className="text-2xl font-bold text-blue-900">
              {Math.round(weekTotals.protein / 7)}g
            </p>
            <p className="text-xs text-blue-700">/ {targets.protein}g target</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <ShoppingCart className="w-4 h-4 text-green-600" />
              <span className="text-xs font-medium text-green-600">Est. Total Cost</span>
            </div>
            <p className="text-2xl font-bold text-green-900">
              QAR {weekTotals.price.toFixed(0)}
            </p>
            <p className="text-xs text-green-700">for 7 days</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Utensils className="w-4 h-4 text-purple-600" />
              <span className="text-xs font-medium text-purple-600">Meals</span>
            </div>
            <p className="text-2xl font-bold text-purple-900">
              {mealPlan.filter(d => d.breakfast || d.lunch || d.dinner).length * 3}
            </p>
            <p className="text-xs text-purple-700">planned meals</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Day Selector */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm">Select Day</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-2">
              {mealPlan.map((day, index) => {
                const totals = calculateDayTotals(day);
                const mealCount = [day.breakfast, day.lunch, day.dinner, day.snack].filter(Boolean).length;
                
                return (
                  <button
                    key={index}
                    onClick={() => setSelectedDay(index)}
                    className={cn(
                      "w-full p-3 rounded-xl text-left transition-all",
                      selectedDay === index 
                        ? "bg-primary text-white shadow-lg" 
                        : "bg-muted hover:bg-muted/80"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={cn(
                          "font-medium",
                          selectedDay === index ? "text-white" : "text-foreground"
                        )}>
                          {format(day.date, "EEEE")}
                        </p>
                        <p className={cn(
                          "text-xs",
                          selectedDay === index ? "text-white/70" : "text-muted-foreground"
                        )}>
                          {format(day.date, "MMM d")}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={cn(
                          "text-sm font-medium",
                          selectedDay === index ? "text-white" : "text-foreground"
                        )}>
                          {totals.calories > 0 ? `${totals.calories} kcal` : "--"}
                        </p>
                        <p className={cn(
                          "text-xs",
                          selectedDay === index ? "text-white/70" : "text-muted-foreground"
                        )}>
                          {mealCount} meals
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Day Detail */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{currentDay ? format(currentDay.date, "EEEE, MMMM d") : "Select a day"}</span>
              {dayTotals && dayTotals.calories > 0 && (
                <Badge variant="outline" className="font-mono">
                  {dayTotals.calories} kcal
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              <div className="space-y-4">
                {/* Breakfast */}
                <MealSlot 
                  title="Breakfast"
                  icon="🌅"
                  meal={currentDay?.breakfast}
                  targetCalories={500}
                />
                
                {/* Lunch */}
                <MealSlot 
                  title="Lunch"
                  icon="☀️"
                  meal={currentDay?.lunch}
                  targetCalories={600}
                />
                
                {/* Dinner */}
                <MealSlot 
                  title="Dinner"
                  icon="🌙"
                  meal={currentDay?.dinner}
                  targetCalories={700}
                />
                
                {/* Snack */}
                <MealSlot 
                  title="Snack"
                  icon="🥜"
                  meal={currentDay?.snack}
                  targetCalories={200}
                />
              </div>
            </ScrollArea>

            {/* Day Summary */}
            {dayTotals && dayTotals.calories > 0 && (
              <div className="mt-6 pt-6 border-t">
                <h4 className="text-sm font-medium mb-3">Daily Summary</h4>
                <div className="grid grid-cols-4 gap-4">
                  <MacroBadge 
                    label="Calories" 
                    value={dayTotals.calories} 
                    target={targets.calories}
                    unit=""
                    color="orange"
                  />
                  <MacroBadge 
                    label="Protein" 
                    value={dayTotals.protein} 
                    target={targets.protein}
                    unit="g"
                    color="blue"
                  />
                  <MacroBadge 
                    label="Carbs" 
                    value={dayTotals.carbs} 
                    target={targets.carbs}
                    unit="g"
                    color="green"
                  />
                  <MacroBadge 
                    label="Fat" 
                    value={dayTotals.fat} 
                    target={targets.fat}
                    unit="g"
                    color="yellow"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Meal Slot Component
function MealSlot({ 
  title, 
  icon, 
  meal, 
  targetCalories 
}: { 
  title: string; 
  icon: string; 
  meal: Meal | null;
  targetCalories: number;
}) {
  if (!meal) {
    return (
      <div className="p-4 border-2 border-dashed border-muted rounded-xl">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{icon}</span>
          <div className="flex-1">
            <p className="font-medium text-muted-foreground">{title}</p>
            <p className="text-sm text-muted-foreground">No meal planned</p>
          </div>
          <Button variant="ghost" size="sm">
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  }

  const alignment = meal.calories ? Math.round((meal.calories / targetCalories) * 100) : 0;

  return (
    <div className="p-4 border rounded-xl bg-card hover:shadow-md transition-shadow">
      <div className="flex gap-4">
        {/* Meal Image */}
        <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center overflow-hidden shrink-0">
          {meal.image_url ? (
            <img 
              src={meal.image_url} 
              alt={meal.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <Utensils className="w-8 h-8 text-muted-foreground" />
          )}
        </div>

        {/* Meal Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{icon}</span>
                <span className="text-xs text-muted-foreground uppercase tracking-wide">
                  {title}
                </span>
              </div>
              <h4 className="font-semibold truncate">{meal.name}</h4>
              <p className="text-sm text-muted-foreground truncate">
                {meal.vendor || "Partner Restaurant"}
              </p>
            </div>
            {meal.rating && (
              <div className="flex items-center gap-1 text-amber-500 shrink-0">
                <Star className="w-4 h-4 fill-current" />
                <span className="text-sm font-medium">{meal.rating.toFixed(1)}</span>
              </div>
            )}
          </div>

          {/* Macros */}
          <div className="flex flex-wrap gap-3 mt-3">
            <Badge variant="secondary" className="text-xs">
              <Flame className="w-3 h-3 mr-1" />
              {meal.calories} kcal
            </Badge>
            {meal.protein_g && (
              <Badge variant="outline" className="text-xs">
                {meal.protein_g}g protein
              </Badge>
            )}
            {meal.prep_time_minutes && (
              <Badge variant="outline" className="text-xs">
                <Clock className="w-3 h-3 mr-1" />
                {meal.prep_time_minutes} min
              </Badge>
            )}
            {meal.price && (
              <Badge variant="outline" className="text-xs text-green-600">
                QAR {meal.price}
              </Badge>
            )}
          </div>

          {/* Alignment Bar */}
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-muted-foreground">Target alignment</span>
              <span className={cn(
                "font-medium",
                alignment >= 90 && alignment <= 110 ? "text-green-600" : "text-amber-600"
              )}>
                {alignment}%
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className={cn(
                  "h-full rounded-full transition-all",
                  alignment >= 90 && alignment <= 110 ? "bg-green-500" : "bg-amber-500"
                )}
                style={{ width: `${Math.min(alignment, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Macro Badge Component
function MacroBadge({ 
  label, 
  value, 
  target, 
  unit,
  color 
}: { 
  label: string; 
  value: number; 
  target: number;
  unit: string;
  color: "orange" | "blue" | "green" | "yellow";
}) {
  const percentage = Math.round((value / target) * 100);
  const colorClasses = {
    orange: "bg-orange-100 text-orange-700 border-orange-200",
    blue: "bg-blue-100 text-blue-700 border-blue-200",
    green: "bg-green-100 text-green-700 border-green-200",
    yellow: "bg-yellow-100 text-yellow-700 border-yellow-200"
  };

  return (
    <div className={cn("p-3 rounded-lg border text-center", colorClasses[color])}>
      <p className="text-xs opacity-70 mb-1">{label}</p>
      <p className="text-lg font-bold">
        {value}{unit}
      </p>
      <p className="text-xs opacity-70">{percentage}%</p>
    </div>
  );
}

export default MealPlanGenerator;
