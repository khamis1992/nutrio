import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { CustomerNavigation } from "@/components/CustomerNavigation";
import { DailyNutritionCard } from "@/components/DailyNutritionCard";
import { 
  ArrowLeft, 
  ChevronLeft, 
  ChevronRight, 
  Calendar,
  Flame,
  Beef,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Clock,
  ChefHat,
  Coffee,
  Sun,
  Moon,
  Apple,
  Plus
} from "lucide-react";
import { format, startOfWeek, addDays, isSameDay, addWeeks, subWeeks, parseISO } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import MealWizard from "@/components/MealWizard";

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
  };
}

const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;

const MEAL_TYPE_CONFIG = {
  breakfast: { icon: Coffee, label: "Breakfast", color: "bg-amber-500", lightColor: "bg-amber-100 text-amber-700" },
  lunch: { icon: Sun, label: "Lunch", color: "bg-orange-500", lightColor: "bg-orange-100 text-orange-700" },
  dinner: { icon: Moon, label: "Dinner", color: "bg-indigo-500", lightColor: "bg-indigo-100 text-indigo-700" },
  snack: { icon: Apple, label: "Snack", color: "bg-emerald-500", lightColor: "bg-emerald-100 text-emerald-700" },
};

const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

const Schedule = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { settings, loading: settingsLoading } = usePlatformSettings();
  const { toast } = useToast();
  
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return startOfWeek(now, { weekStartsOn: 1 });
  });
  
  
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [schedules, setSchedules] = useState<ScheduledMeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);

  useEffect(() => {
    if (profile && !profile.onboarding_completed) {
      navigate("/onboarding");
    }
  }, [profile, navigate]);

  useEffect(() => {
    if (settings.features.meal_scheduling) {
      fetchSchedules();
    } else if (!settingsLoading) {
      setLoading(false);
    }
  }, [user, currentWeekStart, settings.features.meal_scheduling, settingsLoading]);

  const fetchSchedules = async () => {
    if (!user) return;
    
    setLoading(true);
    const weekEnd = addDays(currentWeekStart, 6);
    
    const { data: schedulesData, error: schedulesError } = await supabase
      .from("meal_schedules")
      .select(`
        id,
        scheduled_date,
        meal_type,
        is_completed,
        meal_id
      `)
      .eq("user_id", user.id)
      .gte("scheduled_date", format(currentWeekStart, "yyyy-MM-dd"))
      .lte("scheduled_date", format(weekEnd, "yyyy-MM-dd"))
      .order("scheduled_date", { ascending: true });

    if (schedulesError) {
      console.error("Error fetching schedules:", schedulesError);
      setLoading(false);
      return;
    }

    const mealIds = (schedulesData || []).map((s: any) => s.meal_id).filter(Boolean);
    let mealsMap: Record<string, any> = {};
    
    if (mealIds.length > 0) {
      const { data: mealsData } = await supabase
        .from("meals")
        .select("id, name, calories, protein_g, carbs_g, fat_g, image_url")
        .in("id", mealIds);
      
      mealsMap = (mealsData || []).reduce((acc: Record<string, any>, meal: any) => {
        acc[meal.id] = meal;
        return acc;
      }, {});
    }

    const mergedSchedules: ScheduledMeal[] = (schedulesData || []).map((schedule: any) => ({
      id: schedule.id,
      scheduled_date: schedule.scheduled_date,
      meal_type: schedule.meal_type,
      is_completed: schedule.is_completed,
      meal: mealsMap[schedule.meal_id] || {
        id: schedule.meal_id,
        name: "Unknown Meal",
        calories: 0,
        protein_g: 0,
        carbs_g: 0,
        fat_g: 0,
        image_url: null
      }
    }));

    setSchedules(mergedSchedules);
    setLoading(false);
  };

  const toggleMealCompletion = async (scheduleId: string, isCompleted: boolean) => {
    const schedule = schedules.find(s => s.id === scheduleId);
    if (!schedule || !user) return;

    try {
      // Use atomic RPC function to prevent race conditions
      const { data, error } = isCompleted
        ? await (supabase.rpc as any)('uncomplete_meal_atomic', {
            p_schedule_id: scheduleId,
            p_user_id: user.id,
            p_log_date: schedule.scheduled_date,
          })
        : await (supabase.rpc as any)('complete_meal_atomic', {
            p_schedule_id: scheduleId,
            p_user_id: user.id,
            p_log_date: schedule.scheduled_date,
            p_calories: schedule.meal.calories || 0,
            p_protein_g: schedule.meal.protein_g || 0,
            p_carbs_g: schedule.meal.carbs_g || 0,
            p_fat_g: schedule.meal.fat_g || 0,
            p_fiber_g: 0,
          });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; was_already_completed?: boolean; nothing_to_undo?: boolean };

      if (!result.success) {
        throw new Error(result.error || 'Failed to update meal');
      }

      // Update local state
      setSchedules(prev => prev.map(s => s.id === scheduleId ? { ...s, is_completed: !isCompleted } : s));
      
      if (isCompleted) {
        if (result.nothing_to_undo) {
          toast({ title: "Nothing to undo", description: "This meal was not marked as complete." });
        } else {
          toast({ title: "Meal uncompleted", description: "Nutrition removed from progress" });
        }
      } else {
        if (result.was_already_completed) {
          toast({ title: "Already completed", description: "This meal was already marked as complete." });
        } else {
          toast({ title: "Meal completed! 🎉", description: "Nutrition logged to progress" });
        }
      }
    } catch (err: any) {
      console.error('Error toggling meal completion:', err);
      toast({ 
        title: "Error", 
        description: err.message || "Failed to update meal status", 
        variant: "destructive" 
      });
    }
  };

  const deleteMeal = async (scheduleId: string) => {
    const { error } = await supabase.from("meal_schedules").delete().eq("id", scheduleId);
    if (error) {
      toast({ title: "Error", description: "Failed to remove meal", variant: "destructive" });
    } else {
      setSchedules(prev => prev.filter(s => s.id !== scheduleId));
      toast({ title: "Removed", description: "Meal removed from schedule" });
    }
  };

  const getMealsForDay = (date: Date) => {
    return schedules.filter(s => {
      const scheduleDate = parseISO(s.scheduled_date);
      return isSameDay(scheduleDate, date);
    });
  };

const getDayStatus = (date: Date) => {
    const dayMeals = getMealsForDay(date);
    if (dayMeals.length === 0) return "empty";
    if (dayMeals.every(m => m.is_completed)) return "completed";
    if (dayMeals.some(m => m.is_completed)) return "partial";
    return "scheduled";
  };

  const getDailyNutritionStats = () => {
    const meals = getMealsForDay(displayDate);
    const totalCalories = meals.reduce((sum, s) => sum + (s.meal?.calories || 0), 0);
    const totalProtein = meals.reduce((sum, s) => sum + (s.meal?.protein_g || 0), 0);
    const totalCarbs = meals.reduce((sum, s) => sum + (s.meal?.carbs_g || 0), 0);
    const totalFat = meals.reduce((sum, s) => sum + (s.meal?.fat_g || 0), 0);
    return { totalCalories, totalProtein, totalCarbs, totalFat };
  };

  const getWeekStats = () => {
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
    const totalMeals = schedules.length;
    const completedMeals = schedules.filter(s => s.is_completed).length;
    const totalCalories = schedules.reduce((sum, s) => sum + (s.is_completed ? s.meal.calories : 0), 0);
    
    return { totalMeals, completedMeals, totalCalories, weekDays };
  };

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const stats = getWeekStats();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed": return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      case "partial": return <Clock className="w-5 h-5 text-amber-500" />;
      case "scheduled": return <Circle className="w-5 h-5 text-primary" />;
      default: return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-emerald-100 border-emerald-300";
      case "partial": return "bg-amber-100 border-amber-300";
      case "scheduled": return "bg-primary/10 border-primary/30";
      default: return "bg-muted border-transparent";
    }
  };

  if (!settingsLoading && !settings.features.meal_scheduling) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 pb-20">
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
          <div className="flex items-center justify-between p-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold">Meal Schedule</h1>
            <div className="w-10" />
          </div>
        </div>
        <div className="container max-w-2xl mx-auto px-4 py-12">
          <Card className="border-amber-500/30 bg-amber-500/5">
            <div className="p-6 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-500/20 flex items-center justify-center">
                <AlertTriangle className="h-8 w-8 text-amber-500" />
              </div>
              <h2 className="text-xl font-bold mb-2">Meal Scheduling Unavailable</h2>
              <p className="text-muted-foreground mb-6">Meal scheduling is currently disabled. Please check back later.</p>
              <Button onClick={() => navigate("/dashboard")}>Return to Dashboard</Button>
            </div>
          </Card>
        </div>
        <CustomerNavigation />
      </div>
    );
  }

  const displayDate = selectedDate || today;
  const displayMeals = getMealsForDay(displayDate);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 pb-24">
      {/* Header */}
      <motion.div 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b border-border/50"
      >
        <div className="flex items-center justify-between p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <ChefHat className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">Meal Schedule</h1>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => {
              // If no date selected, default to today
              if (!selectedDate) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                setSelectedDate(today);
              }
              
              // Show wizard (will use selectedDate state)
              setShowWizard(true);
            }}
          >
            <Plus className="h-5 w-5" />
          </Button>
        </div>

        {/* Week Progress Stats */}
        <div className="px-4 pb-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-r from-primary/10 via-primary/5 to-emerald-500/10 rounded-2xl p-4 border border-primary/20"
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Week Progress</p>
                <p className="text-2xl font-bold">
                  {stats.completedMeals}/{stats.totalMeals} <span className="text-sm font-normal text-muted-foreground">meals</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-muted-foreground">Calories</p>
                <p className="text-2xl font-bold text-orange-500">{stats.totalCalories.toLocaleString()}</p>
              </div>
            </div>
            {/* Progress Bar */}
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${stats.totalMeals > 0 ? (stats.completedMeals / stats.totalMeals) * 100 : 0}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="h-full bg-gradient-to-r from-primary to-emerald-500 rounded-full"
              />
            </div>
          </motion.div>
        </div>

        {/* Week Navigation */}
        <div className="flex items-center justify-between px-4 pb-3">
          <Button variant="outline" size="icon" className="rounded-xl" onClick={() => setCurrentWeekStart(prev => subWeeks(prev, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-center">
            <p className="font-semibold text-sm">{format(currentWeekStart, "MMMM yyyy")}</p>
            <p className="text-xs text-muted-foreground">
              {format(currentWeekStart, "d")} - {format(addDays(currentWeekStart, 6), "d")}
            </p>
          </div>
          <Button variant="outline" size="icon" className="rounded-xl" onClick={() => setCurrentWeekStart(prev => addWeeks(prev, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Calendar Strip */}
        <div className="px-4 pb-4">
          <div className="flex gap-2">
            {weekDays.map((day, index) => {
              const isToday = isSameDay(day, today);
              const isSelected = selectedDate ? isSameDay(day, selectedDate) : isToday;
              const status = getDayStatus(day);
              
              return (
                <motion.button
                  key={day.toISOString()}
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => setSelectedDate(day)}
                  className={`flex-1 relative rounded-2xl p-3 transition-all duration-300 ${
                    isSelected 
                      ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25 scale-105' 
                      : getStatusColor(status)
                  }`}
                >
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[10px] font-medium opacity-80">{DAYS[day.getDay()]}</span>
                    <span className="text-lg font-bold">{format(day, "d")}</span>
                    <div className="h-5 flex items-center">
                      {status !== "empty" && (
                        <span className={isSelected ? "text-primary-foreground" : ""}>
                          {getStatusIcon(status)}
                        </span>
                      )}
                    </div>
                  </div>
                  {isToday && !isSelected && (
                    <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full" />
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* Daily Nutrition Card */}
      <div className="px-4 -mt-2 mb-4">
        <DailyNutritionCard 
          totalCalories={getDailyNutritionStats().totalCalories}
          totalProtein={getDailyNutritionStats().totalProtein}
          totalCarbs={getDailyNutritionStats().totalCarbs}
          totalFat={getDailyNutritionStats().totalFat}
          focusCalories={2500}
          dayLabel={isSameDay(displayDate, today) ? "Today's Focus" : `${format(displayDate, "EEEE")}'s Nutrition`}
        />
      </div>

      {/* Selected Day Meals */}
      <div className="p-4 pt-0">
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div 
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center py-12"
            >
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </motion.div>
          ) : (
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              {/* Day Header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold">{format(displayDate, "EEEE")}</h2>
                  <p className="text-sm text-muted-foreground">{format(displayDate, "MMMM d, yyyy")}</p>
                </div>
                {isSameDay(displayDate, today) && (
                  <Badge className="bg-primary/20 text-primary border-0">Today</Badge>
                )}
              </div>

              {/* Meals List */}
              {displayMeals.length === 0 ? (
                <motion.div 
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-center py-12"
                >
                  <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                    <Calendar className="h-10 w-10 text-muted-foreground/50" />
                  </div>
                  <p className="text-muted-foreground mb-4">No meals scheduled for this day</p>
                  <Button 
                    onClick={() => setShowWizard(true)}
                    className="rounded-full px-6"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Schedule a Meal
                  </Button>
                </motion.div>
              ) : (
                <div className="space-y-4">
                  {MEAL_TYPES.map((mealType, typeIndex) => {
                    const typeMeals = displayMeals.filter(m => m.meal_type === mealType);
                    if (typeMeals.length === 0) return null;
                    const config = MEAL_TYPE_CONFIG[mealType];
                    const Icon = config.icon;

                    return (
                      <motion.div
                        key={mealType}
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: typeIndex * 0.1 }}
                      >
                        {/* Meal Type Header */}
                        <div className={`flex items-center gap-2 mb-3 px-3 py-2 rounded-xl ${config.lightColor}`}>
                          <Icon className="h-4 w-4" />
                          <span className="text-sm font-semibold">{config.label}</span>
                        </div>

                        {/* Meals */}
                        <div className="space-y-3">
                          {typeMeals.map((schedule, mealIndex) => (
                            <motion.div
                              key={schedule.id}
                              initial={{ y: 10, opacity: 0 }}
                              animate={{ y: 0, opacity: 1 }}
                              transition={{ delay: typeIndex * 0.1 + mealIndex * 0.05 }}
                              whileHover={{ scale: 1.01 }}
                              whileTap={{ scale: 0.99 }}
                              onClick={() => navigate(`/meals/${schedule.meal.id}`)}
                              className={`group relative overflow-hidden rounded-2xl border-2 transition-all duration-300 cursor-pointer ${
                                schedule.is_completed 
                                  ? 'border-emerald-500/50 bg-emerald-50/50' 
                                  : 'border-border hover:border-primary/50 bg-card'
                              }`}
                            >
                              {/* Status Indicator Strip */}
                              <div className={`absolute left-0 top-0 bottom-0 w-1 ${config.color}`} />
                              
                              <div className="p-4 pl-5 flex items-center gap-3">
                                {/* Checkbox */}
                                <Checkbox
                                  checked={schedule.is_completed}
                                  onCheckedChange={() => toggleMealCompletion(schedule.id, schedule.is_completed)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="h-5 w-5 border-2 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                                />

                                {/* Meal Image */}
                                {schedule.meal?.image_url ? (
                                  <img
                                    src={schedule.meal.image_url}
                                    alt={schedule.meal.name}
                                    className="w-14 h-14 rounded-xl object-cover shadow-sm"
                                  />
                                ) : (
                                  <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center text-2xl">
                                    🍽️
                                  </div>
                                )}

                                {/* Meal Info */}
                                <div className="flex-1 min-w-0">
                                  <h3 className={`font-semibold truncate ${schedule.is_completed ? 'line-through text-muted-foreground' : ''}`}>
                                    {schedule.meal?.name}
                                  </h3>
                                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                      <Flame className="h-3 w-3 text-orange-500" />
                                      {schedule.meal?.calories} cal
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Beef className="h-3 w-3 text-red-500" />
                                      {schedule.meal?.protein_g}g
                                    </span>
                                  </div>
                                </div>

                                {/* Delete Button */}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteMeal(schedule.id);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </motion.div>
                    );
                  })}

                  {/* Completion Progress */}
                  {displayMeals.length > 0 && (
                    <motion.div
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.3 }}
                      className="mt-6 p-4 rounded-2xl bg-muted/50 border border-border"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-muted-foreground">Meals Completed</span>
                        <Badge variant="secondary" className="bg-primary/10 text-primary">
                          {displayMeals.filter(m => m.is_completed).length}/{displayMeals.length} completed
                        </Badge>
                      </div>
                    </motion.div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Meal Wizard */}
      <AnimatePresence>
        {showWizard && user && (
          <MealWizard
            userId={user.id}
            selectedDate={selectedDate || new Date()}
            onComplete={() => {
              setShowWizard(false);
              fetchSchedules();
              toast({
                title: "Success",
                description: "Your meals have been scheduled!",
              });
            }}
            onCancel={() => setShowWizard(false)}
          />
        )}
      </AnimatePresence>

      <CustomerNavigation />
    </div>
  );
};

export default Schedule;
