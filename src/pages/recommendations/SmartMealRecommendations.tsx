import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { 
  Sparkles, 
  Flame, 
  Dumbbell, 
  Wheat, 
  Droplets,
  ArrowRightLeft,
  Heart,
  Info,
  ChevronDown,
  ChevronUp,
  UtensilsCrossed,
  Target,
  Zap
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Meal {
  id: string;
  name: string;
  description: string | null;
  restaurant_id: string;
  restaurant_name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  image_url: string | null;
  cuisine_type: string | null;
  macro_category: string | null;
  match_score: number;
  match_reasons: string[];
}

interface NutritionTargets {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

export default function SmartMealRecommendations() {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMeal, setSelectedMeal] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [nutritionTargets, setNutritionTargets] = useState<NutritionTargets | null>(null);
  
  // Filter states
  const [calorieRange, setCalorieRange] = useState<[number, number]>([0, 1000]);
  const [proteinMin, setProteinMin] = useState(20);
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const cuisineOptions = ["Italian", "Asian", "Mediterranean", "Arabic", "Indian", "Mexican"];
  const categoryOptions = ["High Protein", "Low Carb", "Balanced", "Vegetarian", "Keto-Friendly"];

  // Calculate AI match score for a meal
  const calculateMatchScore = (meal: any, targets: NutritionTargets) => {
    let score = 0;
    const reasons: string[] = [];

    // Calorie match (40 points)
    const idealMealCalories = targets.calories / 3; // Assuming 3 main meals
    const calorieDiff = Math.abs(meal.calories - idealMealCalories);
    const calorieScore = Math.max(0, 40 - (calorieDiff / idealMealCalories * 40));
    score += calorieScore;
    if (calorieScore > 30) reasons.push("Perfect calorie match");
    else if (calorieScore > 20) reasons.push("Good calorie range");

    // Protein match (35 points)
    const idealProtein = targets.protein / 3;
    const proteinDiff = Math.abs(meal.protein_g - idealProtein);
    const proteinScore = Math.max(0, 35 - (proteinDiff / idealProtein * 35));
    score += proteinScore;
    if (proteinScore > 25) reasons.push("High protein");
    else if (proteinScore > 15) reasons.push("Good protein content");

    // Macro balance (25 points)
    const totalMacros = meal.protein_g + meal.carbs_g + meal.fat_g;
    if (totalMacros > 0) {
      const proteinPct = meal.protein_g / totalMacros;
      const balanceScore = 25 - Math.abs(proteinPct - 0.3) * 100;
      score += Math.max(0, balanceScore);
      if (balanceScore > 20) reasons.push("Balanced macros");
    }

    return { score: Math.round(score), reasons };
  };

  // Fetch and score meals
  const fetchRecommendations = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user nutrition targets
      const { data: profile } = await supabase
        .from("profiles")
        .select("target_calories, target_protein, target_carbs, target_fats")
        .eq("id", user.id)
        .single();

      const targets = profile ? {
        calories: profile.target_calories || 2000,
        protein: profile.target_protein || 150,
        carbs: profile.target_carbs || 200,
        fats: profile.target_fats || 65,
      } : { calories: 2000, protein: 150, carbs: 200, fats: 65 };

      setNutritionTargets(targets);

      // Fetch available meals with restaurant info
      const { data: mealsData, error } = await supabase
        .from("meals")
        .select(`
          id, name, description, calories, protein_g, carbs_g, fat_g,
          image_url, cuisine_type, macro_category,
          restaurant:restaurants(name)
        `)
        .eq("is_available", true)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      // Calculate match scores and sort
      const scoredMeals = (mealsData || []).map((meal: any) => {
        const { score, reasons } = calculateMatchScore(meal, targets);
        return {
          ...meal,
          restaurant_name: meal.restaurant?.name || "Unknown",
          match_score: score,
          match_reasons: reasons,
        };
      }).sort((a, b) => b.match_score - a.match_score);

      setMeals(scoredMeals);
    } catch (error) {
      toast.error("Failed to load recommendations");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter meals
  const filteredMeals = meals.filter(meal => {
    if (meal.calories < calorieRange[0] || meal.calories > calorieRange[1]) return false;
    if (meal.protein_g < proteinMin) return false;
    if (selectedCuisines.length > 0 && !selectedCuisines.includes(meal.cuisine_type || "")) return false;
    if (selectedCategories.length > 0 && !selectedCategories.includes(meal.macro_category || "")) return false;
    return true;
  });

  // Quick order meal
  const handleOrderMeal = async (mealId: string) => {
    toast.success("Added to cart!");
  };

  useEffect(() => {
    fetchRecommendations();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-violet-900 via-purple-900 to-indigo-900 text-white py-16 px-4">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-400 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-400 rounded-full blur-3xl" />
        </div>
        
        <div className="relative max-w-4xl mx-auto text-center">
          <Badge className="mb-4 bg-white/10 text-white border-white/20 backdrop-blur-sm">
            <Sparkles className="w-3 h-3 mr-1" />
            AI-Powered
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
            Smart Meal
            <span className="block text-violet-300">Recommendations</span>
          </h1>
          <p className="text-lg text-white/80 max-w-2xl mx-auto">
            Discover meals perfectly matched to your nutrition goals. Our AI analyzes thousands of options to find your ideal matches.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Target Summary */}
        {nutritionTargets && (
          <Card className="mb-8 bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-emerald-900 flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  Your Nutrition Targets
                </h3>
                <Badge variant="outline" className="border-emerald-300 text-emerald-700">
                  Daily Goals
                </Badge>
              </div>
              <div className="grid grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-emerald-700">{nutritionTargets.calories}</div>
                  <div className="text-sm text-emerald-600">calories</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-600">{nutritionTargets.protein}g</div>
                  <div className="text-sm text-blue-500">protein</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-amber-600">{nutritionTargets.carbs}g</div>
                  <div className="text-sm text-amber-500">carbs</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-rose-600">{nutritionTargets.fats}g</div>
                  <div className="text-sm text-rose-500">fats</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <Card className="mb-8">
          <CardContent className="p-4">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center justify-between w-full text-left"
            >
              <span className="font-semibold text-slate-900 flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4" />
                Filter & Sort
              </span>
              {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            
            {showFilters && (
              <div className="mt-4 pt-4 border-t border-slate-200 space-y-6">
                {/* Calorie Range */}
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">
                    Calorie Range: {calorieRange[0]} - {calorieRange[1]}
                  </label>
                  <Slider
                    value={calorieRange}
                    onValueChange={(value) => setCalorieRange(value as [number, number])}
                    max={1200}
                    step={50}
                    className="w-full"
                  />
                </div>

                {/* Protein Minimum */}
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">
                    Minimum Protein: {proteinMin}g
                  </label>
                  <Slider
                    value={[proteinMin]}
                    onValueChange={(value) => setProteinMin(value[0])}
                    max={100}
                    step={5}
                    className="w-full"
                  />
                </div>

                {/* Cuisine Types */}
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">Cuisine Types</label>
                  <div className="flex flex-wrap gap-2">
                    {cuisineOptions.map(cuisine => (
                      <Badge
                        key={cuisine}
                        variant={selectedCuisines.includes(cuisine) ? "default" : "outline"}
                        className={cn(
                          "cursor-pointer transition-colors",
                          selectedCuisines.includes(cuisine) ? "bg-violet-600 hover:bg-violet-700" : "hover:bg-slate-100"
                        )}
                        onClick={() => {
                          setSelectedCuisines(prev => 
                            prev.includes(cuisine) 
                              ? prev.filter(c => c !== cuisine)
                              : [...prev, cuisine]
                          );
                        }}
                      >
                        {cuisine}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Macro Categories */}
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">Categories</label>
                  <div className="flex flex-wrap gap-2">
                    {categoryOptions.map(category => (
                      <Badge
                        key={category}
                        variant={selectedCategories.includes(category) ? "default" : "outline"}
                        className={cn(
                          "cursor-pointer transition-colors",
                          selectedCategories.includes(category) ? "bg-emerald-600 hover:bg-emerald-700" : "hover:bg-slate-100"
                        )}
                        onClick={() => {
                          setSelectedCategories(prev => 
                            prev.includes(category) 
                              ? prev.filter(c => c !== category)
                              : [...prev, category]
                          );
                        }}
                      >
                        {category}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results Count */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-slate-600">
            Showing <span className="font-semibold text-slate-900">{filteredMeals.length}</span> meals
          </p>
          <Badge variant="outline" className="border-violet-200 text-violet-700">
            <Sparkles className="w-3 h-3 mr-1" />
            AI-Powered Ranking
          </Badge>
        </div>

        {/* Meal Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMeals.map((meal) => (
            <Card
              key={meal.id}
              className={cn(
                "overflow-hidden transition-all duration-300 group cursor-pointer",
                "hover:shadow-xl hover:-translate-y-1",
                selectedMeal === meal.id ? "ring-2 ring-violet-500" : ""
              )}
              onClick={() => setSelectedMeal(meal.id)}
            >
              {/* Image */}
              <div className="relative h-48 bg-gradient-to-br from-violet-100 to-indigo-100 overflow-hidden">
                {meal.image_url ? (
                  <img
                    src={meal.image_url}
                    alt={meal.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <UtensilsCrossed className="w-16 h-16 text-violet-300" />
                  </div>
                )}
                
                {/* Match Score Badge */}
                <div className="absolute top-3 left-3">
                  <Badge className={cn(
                    "text-white font-bold",
                    meal.match_score >= 80 ? "bg-emerald-500" :
                    meal.match_score >= 60 ? "bg-violet-500" :
                    "bg-slate-500"
                  )}>
                    <Zap className="w-3 h-3 mr-1" />
                    {meal.match_score}% Match
                  </Badge>
                </div>

                {/* Favorite Button */}
                <button
                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 hover:bg-white flex items-center justify-center transition-colors shadow-lg"
                  onClick={(e) => {
                    e.stopPropagation();
                    toast.success("Added to favorites!");
                  }}
                >
                  <Heart className="w-4 h-4 text-rose-500" />
                </button>

                {/* Cuisine Badge */}
                {meal.cuisine_type && (
                  <div className="absolute bottom-3 left-3">
                    <Badge className="bg-black/50 text-white backdrop-blur-sm">
                      {meal.cuisine_type}
                    </Badge>
                  </div>
                )}
              </div>

              <CardContent className="p-4">
                {/* Restaurant */}
                <p className="text-sm text-violet-600 font-medium mb-1">
                  {meal.restaurant_name}
                </p>

                {/* Name */}
                <h3 className="font-bold text-slate-900 text-lg mb-2 line-clamp-2">
                  {meal.name}
                </h3>

                {/* Description */}
                {meal.description && (
                  <p className="text-sm text-slate-600 mb-3 line-clamp-2">
                    {meal.description}
                  </p>
                )}

                {/* Macros */}
                <div className="flex items-center gap-4 text-sm text-slate-600 mb-3">
                  <span className="flex items-center gap-1">
                    <Flame className="w-4 h-4 text-orange-500" />
                    {meal.calories}
                  </span>
                  <span className="flex items-center gap-1">
                    <Dumbbell className="w-4 h-4 text-blue-500" />
                    {meal.protein_g}g
                  </span>
                  <span className="flex items-center gap-1">
                    <Wheat className="w-4 h-4 text-amber-500" />
                    {meal.carbs_g}g
                  </span>
                  <span className="flex items-center gap-1">
                    <Droplets className="w-4 h-4 text-rose-500" />
                    {meal.fat_g}g
                  </span>
                </div>

                {/* Match Reasons */}
                {meal.match_reasons.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {meal.match_reasons.slice(0, 2).map((reason, idx) => (
                      <Badge
                        key={idx}
                        variant="secondary"
                        className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200"
                      >
                        {reason}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <Button
                    className="flex-1 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOrderMeal(meal.id);
                    }}
                  >
                    Order Now
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      toast.success("Added to weekly plan!");
                    }}
                  >
                    <ArrowRightLeft className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Empty State */}
        {filteredMeals.length === 0 && (
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
              <UtensilsCrossed className="w-10 h-10 text-slate-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">No meals match your filters</h3>
            <p className="text-slate-600">Try adjusting your filter criteria to see more options</p>
          </div>
        )}
      </div>
    </div>
  );
}
