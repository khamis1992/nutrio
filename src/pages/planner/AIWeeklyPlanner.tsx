import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  ChevronLeft, 
  ChevronRight, 
  RotateCcw,
  Check,
  Info,
  UtensilsCrossed,
  Flame,
  Dumbbell,
  Wheat,
  Droplets,
  AlertCircle,
  ArrowRightLeft
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Meal {
  id: string;
  name: string;
  restaurant_name: string;
  restaurant_id: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  image_url?: string;
}

interface PlanItem {
  id: string;
  meal_id: string;
  meal: Meal;
  scheduled_date: string;
  meal_type: "breakfast" | "lunch" | "dinner" | "snack";
  is_ai_suggested: boolean;
  user_swapped: boolean;
  order_id?: string;
}

interface WeeklyPlan {
  id: string;
  week_start_date: string;
  week_end_date: string;
  plan_status: string;
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fats: number;
  ai_confidence_score: number;
  user_accepted: boolean;
  items: PlanItem[];
}

interface NutritionTargets {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

export default function AIWeeklyPlanner() {
  const [currentWeek, setCurrentWeek] = useState<Date>(new Date());
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [nutritionTargets, setNutritionTargets] = useState<NutritionTargets | null>(null);

  // Get week start (Sunday)
  const getWeekStart = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff));
  };

  // Format date for display
  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  // Fetch weekly plan
  const fetchWeeklyPlan = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const weekStart = getWeekStart(currentWeek);
      const weekStartStr = weekStart.toISOString().split("T")[0];

      const { data: plan, error } = await supabase
        .from("weekly_meal_plans")
        .select(`
          *,
          items:weekly_meal_plan_items(
            id,
            meal_id,
            scheduled_date,
            meal_type,
            is_ai_suggested,
            user_swapped,
            order_id,
            meal:meals(
              id,
              name,
              restaurant_id,
              calories,
              protein_g,
              carbs_g,
              fat_g,
              image_url
            )
          )
        `)
        .eq("user_id", user.id)
        .eq("week_start_date", weekStartStr)
        .single();

      if (error) {
        console.log("No plan found for this week");
        setWeeklyPlan(null);
      } else {
        // Transform data to match our interface
        const transformedPlan: WeeklyPlan = {
          ...plan,
          items: plan.items?.map((item: Record<string, unknown>) => ({
            ...item,
            meal: {
              ...item.meal,
              protein: item.meal.protein_g,
              carbs: item.meal.carbs_g,
              fats: item.meal.fat_g,
            },
          })) || [],
        };
        setWeeklyPlan(transformedPlan);
      }

      // Fetch nutrition targets
      const { data: profile } = await supabase
        .from("profiles")
        .select("target_calories, target_protein, target_carbs, target_fats")
        .eq("id", user.id)
        .single();

      if (profile) {
        setNutritionTargets({
          calories: profile.target_calories || 2000,
          protein: profile.target_protein || 150,
          carbs: profile.target_carbs || 200,
          fats: profile.target_fats || 65,
        });
      }
    } catch (error) {
      console.error("Error fetching weekly plan:", error);
    } finally {
      setIsLoading(false);
    }
  }, [currentWeek]);

  // Generate new plan
  const generatePlan = async () => {
    setIsGenerating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please sign in");
        return;
      }

      const weekStart = getWeekStart(currentWeek);
      
      // Call AI meal allocator edge function
      const { data, error } = await supabase.functions.invoke("smart-meal-allocator", {
        body: {
          user_id: user.id,
          week_start_date: weekStart.toISOString().split("T")[0],
          generate_variations: 3,
          save_to_database: true,
        },
      });

      if (error) throw error;

      toast.success(data.message || "Weekly plan generated!");
      await fetchWeeklyPlan();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to generate plan");
    } finally {
      setIsGenerating(false);
    }
  };

  // Accept plan
  const acceptPlan = async () => {
    if (!weeklyPlan) return;

    try {
      const { error } = await supabase
        .from("weekly_meal_plans")
        .update({
          user_accepted: true,
          accepted_at: new Date().toISOString(),
          plan_status: "active",
        })
        .eq("id", weeklyPlan.id);

      if (error) throw error;

      toast.success("Plan accepted! You can now order meals.");
      await fetchWeeklyPlan();
    } catch (error) {
      toast.error("Failed to accept plan");
    }
  };

  // Group items by day
  const getItemsByDay = () => {
    if (!weeklyPlan?.items) return {};

    const grouped: Record<string, PlanItem[]> = {};
    weeklyPlan.items.forEach((item) => {
      const date = item.scheduled_date;
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(item);
    });

    return grouped;
  };

  // Calculate compliance percentage
  const getCompliancePercentage = () => {
    if (!weeklyPlan || !nutritionTargets) return 0;

    const calorieDiff = Math.abs(weeklyPlan.total_calories - nutritionTargets.calories * 7);
    const compliance = 100 - (calorieDiff / (nutritionTargets.calories * 7)) * 100;
    return Math.max(0, Math.round(compliance));
  };

  useEffect(() => {
    fetchWeeklyPlan();
  }, [fetchWeeklyPlan]);

  const itemsByDay = getItemsByDay();
  const complianceScore = getCompliancePercentage();
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(getWeekStart(currentWeek));
    date.setDate(date.getDate() + i);
    return date.toISOString().split("T")[0];
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
              AI Weekly Meal Planner
            </h1>
            <p className="text-slate-600 mt-1">
              Let our AI create personalized meal plans based on your nutrition goals
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => {
                const prev = new Date(currentWeek);
                prev.setDate(prev.getDate() - 7);
                setCurrentWeek(prev);
              }}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="font-medium text-slate-900 min-w-[200px] text-center">
              {formatDate(getWeekStart(currentWeek))} - {formatDate(weekDays[6])}
            </span>
            <Button
              variant="outline"
              onClick={() => {
                const next = new Date(currentWeek);
                next.setDate(next.getDate() + 7);
                setCurrentWeek(next);
              }}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {!weeklyPlan ? (
        // No plan state
        <Card className="p-12 text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            No Meal Plan Yet
          </h2>
          <p className="text-slate-600 mb-6 max-w-md mx-auto">
            Let our AI generate a personalized weekly meal plan tailored to your nutrition goals, 
            dietary preferences, and favorite cuisines.
          </p>
          <Button
            size="lg"
            onClick={generatePlan}
            disabled={isGenerating}
            className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
          >
            {isGenerating ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Generating Plan...
              </>
            ) : (
              <>
                Generate AI Meal Plan
              </>
            )}
          </Button>
        </Card>
      ) : (
        // Plan exists
        <>
          {/* Plan Stats */}
          <div className="grid md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-600">AI Confidence</span>
                  <Info className="w-4 h-4 text-slate-400" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-emerald-600">
                    {Math.round((weeklyPlan.ai_confidence_score || 0) * 100)}%
                  </span>
                  <span className="text-sm text-slate-500">match</span>
                </div>
                <Progress 
                  value={complianceScore} 
                  className="mt-2 h-2"
                />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Flame className="w-4 h-4 text-orange-500" />
                  <span className="text-sm text-slate-600">Calories</span>
                </div>
                <div className="text-2xl font-bold text-slate-900">
                  {weeklyPlan.total_calories.toLocaleString()}
                </div>
                <p className="text-xs text-slate-500">
                  Target: {(nutritionTargets?.calories || 0) * 7}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Dumbbell className="w-4 h-4 text-blue-500" />
                  <span className="text-sm text-slate-600">Protein</span>
                </div>
                <div className="text-2xl font-bold text-slate-900">
                  {weeklyPlan.total_protein}g
                </div>
                <p className="text-xs text-slate-500">
                  Target: {(nutritionTargets?.protein || 0) * 7}g
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <UtensilsCrossed className="w-4 h-4 text-slate-500" />
                  <span className="text-sm text-slate-600">Meals</span>
                </div>
                <div className="text-2xl font-bold text-slate-900">
                  {weeklyPlan.items?.length || 0}
                </div>
                <p className="text-xs text-slate-500">
                  Planned for the week
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Weekly Grid */}
          <div className="grid md:grid-cols-7 gap-4 mb-8">
            {weekDays.map((date, index) => {
              const dayItems = itemsByDay[date] || [];
              const dayName = new Date(date).toLocaleDateString("en-US", { weekday: "short" });
              const dayNum = new Date(date).getDate();
              const isToday = date === new Date().toISOString().split("T")[0];

              return (
                <div key={date} className="space-y-2">
                  <div className={cn(
                    "text-center py-2 rounded-lg",
                    isToday ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                  )}>
                    <div className="text-xs font-medium uppercase">{dayName}</div>
                    <div className="text-lg font-bold">{dayNum}</div>
                  </div>

                  {dayItems.length > 0 ? (
                    dayItems.map((item) => (
                      <Card 
                        key={item.id} 
                        className={cn(
                          "overflow-hidden transition-all hover:shadow-md",
                          item.user_swapped && "border-amber-300",
                          item.order_id && "border-emerald-300 bg-emerald-50/30"
                        )}
                      >
                        <CardContent className="p-3">
                          <Badge 
                            variant="secondary" 
                            className="text-xs mb-2 capitalize"
                          >
                            {item.meal_type}
                          </Badge>
                          
                          <p className="font-medium text-sm text-slate-900 line-clamp-2 mb-1">
                            {item.meal?.name}
                          </p>
                          
                          <p className="text-xs text-slate-500 mb-2">
                            {item.meal?.restaurant_name}
                          </p>

                          <div className="flex items-center gap-3 text-xs text-slate-600">
                            <span className="flex items-center gap-1">
                              <Flame className="w-3 h-3" />
                              {item.meal?.calories}
                            </span>
                            <span className="flex items-center gap-1">
                              <Dumbbell className="w-3 h-3" />
                              {item.meal?.protein}g
                            </span>
                          </div>

                          {item.is_ai_suggested && !item.user_swapped && (
                            <Badge className="mt-2 text-xs bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                              AI Pick
                            </Badge>
                          )}

                          {item.order_id && (
                            <Badge className="mt-2 text-xs bg-emerald-500 text-white">
                              <Check className="w-3 h-3 mr-1" />
                              Ordered
                            </Badge>
                          )}
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <div className="h-24 flex items-center justify-center text-slate-300 text-sm">
                      No meals
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {!weeklyPlan.user_accepted ? (
                <>
                  <Button
                    size="lg"
                    onClick={acceptPlan}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Accept Plan
                  </Button>
                  <Button
                    variant="outline"
                    onClick={generatePlan}
                    disabled={isGenerating}
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Regenerate
                  </Button>
                </>
              ) : (
                <Badge className="text-sm py-2 px-4 bg-emerald-100 text-emerald-800">
                  <Check className="w-4 h-4 mr-2" />
                  Plan Active
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2 text-sm text-slate-600">
              <ArrowRightLeft className="w-4 h-4" />
              <span>Click any meal to swap or order</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
