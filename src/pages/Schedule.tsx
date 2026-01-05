import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowLeft, 
  ChevronLeft, 
  ChevronRight, 
  Calendar,
  Flame,
  Beef,
  Wheat,
  Droplets,
  Trash2,
  Home,
  UtensilsCrossed,
  CalendarDays,
  TrendingUp,
  User
} from "lucide-react";
import { format, startOfWeek, addDays, isSameDay, addWeeks, subWeeks } from "date-fns";

interface ScheduledMeal {
  id: string;
  scheduled_date: string;
  meal_type: string;
  is_completed: boolean;
  meal: {
    id: string;
    name: string;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    image_url: string | null;
    price: number;
  };
}

const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"];

const Schedule = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { toast } = useToast();
  const [currentWeekStart, setCurrentWeekStart] = useState(() => 
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [schedules, setSchedules] = useState<ScheduledMeal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.onboarding_completed) {
      navigate("/onboarding");
    }
  }, [profile, navigate]);

  useEffect(() => {
    fetchSchedules();
  }, [user, currentWeekStart]);

  const fetchSchedules = async () => {
    if (!user) return;
    
    setLoading(true);
    const weekEnd = addDays(currentWeekStart, 6);
    
    const { data, error } = await supabase
      .from("meal_schedules")
      .select(`
        id,
        scheduled_date,
        meal_type,
        is_completed,
        meal:meals (
          id,
          name,
          calories,
          protein_g,
          carbs_g,
          fat_g,
          image_url,
          price
        )
      `)
      .eq("user_id", user.id)
      .gte("scheduled_date", format(currentWeekStart, "yyyy-MM-dd"))
      .lte("scheduled_date", format(weekEnd, "yyyy-MM-dd"))
      .order("scheduled_date", { ascending: true });

    if (error) {
      console.error("Error fetching schedules:", error);
    } else {
      setSchedules(data as unknown as ScheduledMeal[]);
    }
    setLoading(false);
  };

  const toggleMealCompletion = async (scheduleId: string, isCompleted: boolean) => {
    const schedule = schedules.find(s => s.id === scheduleId);
    if (!schedule || !user) return;

    const { error } = await supabase
      .from("meal_schedules")
      .update({ is_completed: !isCompleted })
      .eq("id", scheduleId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update meal status",
        variant: "destructive",
      });
      return;
    }

    // Update progress log with nutrition data
    const logDate = schedule.scheduled_date;
    const meal = schedule.meal;
    const multiplier = isCompleted ? -1 : 1; // Subtract if uncompleting, add if completing

    // Get existing progress log for this date
    const { data: existingLog } = await supabase
      .from("progress_logs")
      .select("*")
      .eq("user_id", user.id)
      .eq("log_date", logDate)
      .maybeSingle();

    if (existingLog) {
      // Update existing log
      await supabase
        .from("progress_logs")
        .update({
          calories_consumed: Math.max(0, (existingLog.calories_consumed || 0) + (meal.calories * multiplier)),
          protein_consumed_g: Math.max(0, (existingLog.protein_consumed_g || 0) + (meal.protein_g * multiplier)),
          carbs_consumed_g: Math.max(0, (existingLog.carbs_consumed_g || 0) + (meal.carbs_g * multiplier)),
          fat_consumed_g: Math.max(0, (existingLog.fat_consumed_g || 0) + (meal.fat_g * multiplier)),
        })
        .eq("id", existingLog.id);
    } else if (!isCompleted) {
      // Create new log only when completing a meal
      await supabase
        .from("progress_logs")
        .insert({
          user_id: user.id,
          log_date: logDate,
          calories_consumed: meal.calories,
          protein_consumed_g: meal.protein_g,
          carbs_consumed_g: meal.carbs_g,
          fat_consumed_g: meal.fat_g,
        });
    }

    setSchedules(prev => 
      prev.map(s => s.id === scheduleId ? { ...s, is_completed: !isCompleted } : s)
    );

    toast({
      title: isCompleted ? "Meal uncompleted" : "Meal completed",
      description: isCompleted ? "Nutrition removed from progress" : "Nutrition logged to progress",
    });
  };

  const deleteMeal = async (scheduleId: string) => {
    const { error } = await supabase
      .from("meal_schedules")
      .delete()
      .eq("id", scheduleId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to remove meal",
        variant: "destructive",
      });
    } else {
      setSchedules(prev => prev.filter(s => s.id !== scheduleId));
      toast({
        title: "Removed",
        description: "Meal removed from schedule",
      });
    }
  };

  const getWeekDays = () => {
    return Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
  };

  const getMealsForDay = (date: Date) => {
    return schedules.filter(s => 
      isSameDay(new Date(s.scheduled_date), date)
    );
  };

  const getDayTotals = (date: Date) => {
    const dayMeals = getMealsForDay(date);
    return {
      calories: dayMeals.reduce((sum, s) => sum + (s.meal?.calories || 0), 0),
      protein: dayMeals.reduce((sum, s) => sum + (s.meal?.protein_g || 0), 0),
      carbs: dayMeals.reduce((sum, s) => sum + (s.meal?.carbs_g || 0), 0),
      fat: dayMeals.reduce((sum, s) => sum + (s.meal?.fat_g || 0), 0),
    };
  };

  const weekDays = getWeekDays();
  const today = new Date();

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center justify-between p-4">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate("/dashboard")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">Meal Schedule</h1>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate("/meals")}
          >
            <UtensilsCrossed className="h-5 w-5" />
          </Button>
        </div>

        {/* Week Navigation */}
        <div className="flex items-center justify-between px-4 pb-4">
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => setCurrentWeekStart(prev => subWeeks(prev, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-center">
            <p className="font-medium">
              {format(currentWeekStart, "MMM d")} - {format(addDays(currentWeekStart, 6), "MMM d, yyyy")}
            </p>
            <Button 
              variant="link" 
              className="text-xs text-muted-foreground p-0 h-auto"
              onClick={() => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
            >
              Go to today
            </Button>
          </div>
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => setCurrentWeekStart(prev => addWeeks(prev, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Week View */}
      <div className="p-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          weekDays.map(day => {
            const dayMeals = getMealsForDay(day);
            const totals = getDayTotals(day);
            const isToday = isSameDay(day, today);

            return (
              <Card 
                key={day.toISOString()} 
                className={`p-4 ${isToday ? 'ring-2 ring-primary' : ''}`}
              >
                {/* Day Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      isToday ? 'bg-primary text-primary-foreground' : 'bg-muted'
                    }`}>
                      <span className="text-sm font-semibold">{format(day, "d")}</span>
                    </div>
                    <div>
                      <p className="font-medium">{format(day, "EEEE")}</p>
                      <p className="text-xs text-muted-foreground">{format(day, "MMMM d")}</p>
                    </div>
                  </div>
                  {dayMeals.length > 0 && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Flame className="h-3 w-3 text-orange-500" />
                      <span>{totals.calories} kcal</span>
                    </div>
                  )}
                </div>

                {/* Meals */}
                {dayMeals.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No meals scheduled</p>
                    <Button 
                      variant="link" 
                      className="text-sm mt-1"
                      onClick={() => navigate("/meals")}
                    >
                      Add meals
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {MEAL_TYPES.map(mealType => {
                      const typeMeals = dayMeals.filter(m => m.meal_type === mealType);
                      if (typeMeals.length === 0) return null;

                      return (
                        <div key={mealType}>
                          <p className="text-xs font-medium text-muted-foreground uppercase mb-2">
                            {mealType}
                          </p>
                          {typeMeals.map(schedule => (
                            <div 
                              key={schedule.id}
                              className={`flex items-center gap-3 p-2 rounded-lg bg-muted/50 ${
                                schedule.is_completed ? 'opacity-60' : ''
                              }`}
                            >
                              <Checkbox
                                checked={schedule.is_completed}
                                onCheckedChange={() => toggleMealCompletion(schedule.id, schedule.is_completed)}
                              />
                              {schedule.meal?.image_url && (
                                <img 
                                  src={schedule.meal.image_url} 
                                  alt={schedule.meal.name}
                                  className="w-12 h-12 rounded-lg object-cover"
                                />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className={`font-medium text-sm truncate ${
                                  schedule.is_completed ? 'line-through' : ''
                                }`}>
                                  {schedule.meal?.name}
                                </p>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <span className="flex items-center gap-0.5">
                                    <Flame className="h-3 w-3" />
                                    {schedule.meal?.calories}
                                  </span>
                                  <span className="flex items-center gap-0.5">
                                    <Beef className="h-3 w-3" />
                                    {schedule.meal?.protein_g}g
                                  </span>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={() => deleteMeal(schedule.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Day Summary */}
                {dayMeals.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-border">
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div>
                        <p className="text-xs text-muted-foreground">Calories</p>
                        <p className="text-sm font-semibold text-orange-500">{totals.calories}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Protein</p>
                        <p className="text-sm font-semibold text-red-500">{totals.protein}g</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Carbs</p>
                        <p className="text-sm font-semibold text-amber-500">{totals.carbs}g</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Fat</p>
                        <p className="text-sm font-semibold text-blue-500">{totals.fat}g</p>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border">
        <div className="flex items-center justify-around py-2">
          <Button 
            variant="ghost" 
            className="flex flex-col items-center gap-1 h-auto py-2"
            onClick={() => navigate("/dashboard")}
          >
            <Home className="h-5 w-5" />
            <span className="text-xs">Home</span>
          </Button>
          <Button 
            variant="ghost" 
            className="flex flex-col items-center gap-1 h-auto py-2"
            onClick={() => navigate("/meals")}
          >
            <UtensilsCrossed className="h-5 w-5" />
            <span className="text-xs">Meals</span>
          </Button>
          <Button 
            variant="ghost" 
            className="flex flex-col items-center gap-1 h-auto py-2 text-primary"
          >
            <CalendarDays className="h-5 w-5" />
            <span className="text-xs">Schedule</span>
          </Button>
          <Button 
            variant="ghost" 
            className="flex flex-col items-center gap-1 h-auto py-2"
            onClick={() => navigate("/progress")}
          >
            <TrendingUp className="h-5 w-5" />
            <span className="text-xs">Progress</span>
          </Button>
          <Button 
            variant="ghost" 
            className="flex flex-col items-center gap-1 h-auto py-2"
            onClick={() => navigate("/profile")}
          >
            <User className="h-5 w-5" />
            <span className="text-xs">Profile</span>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Schedule;
