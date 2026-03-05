import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { CustomerNavigation } from "@/components/CustomerNavigation";
import { GuestLoginPrompt, useGuestLoginPrompt } from "@/components/GuestLoginPrompt";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DeliveryScheduler } from "@/components/ui/delivery-scheduler";
import {
  ChevronLeft,
  ChevronRight,
  Flame,
  Beef,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Coffee,
  Sun,
  Moon,
  Apple,
  Plus,
  Loader2,
  X,
  Check,
  Utensils,
  Calendar as CalendarIcon,
  Clock
} from "lucide-react";
import { format, startOfWeek, addDays, isSameDay, addWeeks, subWeeks, parseISO, isToday } from "date-fns";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import MealWizard from "@/components/MealWizard";

interface ScheduledMeal {
  id: string;
  scheduled_date: string;
  meal_type: string;
  is_completed: boolean;
  delivery_time_slot: string | null;
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
  breakfast: { 
    icon: Coffee, 
    label: "Breakfast", 
    color: "from-amber-400 to-orange-400",
    bgColor: "bg-amber-50",
    textColor: "text-amber-700",
    borderColor: "border-amber-200"
  },
  lunch: { 
    icon: Sun, 
    label: "Lunch", 
    color: "from-orange-400 to-red-400",
    bgColor: "bg-orange-50",
    textColor: "text-orange-700",
    borderColor: "border-orange-200"
  },
  dinner: { 
    icon: Moon, 
    label: "Dinner", 
    color: "from-indigo-400 to-purple-400",
    bgColor: "bg-indigo-50",
    textColor: "text-indigo-700",
    borderColor: "border-indigo-200"
  },
  snack: { 
    icon: Apple, 
    label: "Snack", 
    color: "from-emerald-400 to-teal-400",
    bgColor: "bg-emerald-50",
    textColor: "text-emerald-700",
    borderColor: "border-emerald-200"
  },
};

const DAYS = ["S", "M", "T", "W", "T", "F", "S"];

// Native Mobile Schedule Component
const Schedule = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { settings, loading: settingsLoading } = usePlatformSettings();
  const { toast } = useToast();
  const { showLoginPrompt, setShowLoginPrompt, promptLogin, loginPromptConfig } = useGuestLoginPrompt();
  
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return startOfWeek(now, { weekStartsOn: 1 });
  });
  
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [schedules, setSchedules] = useState<ScheduledMeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Bottom sheet for meal details
  const [selectedMeal, setSelectedMeal] = useState<ScheduledMeal | null>(null);
  const [showMealSheet, setShowMealSheet] = useState(false);

  // Time slot selector
  const [showTimeSlotDialog, setShowTimeSlotDialog] = useState(false);
  const [selectedScheduleForTimeSlot, setSelectedScheduleForTimeSlot] = useState<string | null>(null);

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
        meal_id,
        delivery_time_slot
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
      delivery_time_slot: schedule.delivery_time_slot || null,
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
    setIsRefreshing(false);
  };

  // Swipe gesture handler
  const handleSwipe = (event: PanInfo) => {
    const threshold = 50;
    if (event.offset.x > threshold) {
      // Swipe right - previous week
      setCurrentWeekStart(prev => subWeeks(prev, 1));
    } else if (event.offset.x < -threshold) {
      // Swipe left - next week
      setCurrentWeekStart(prev => addWeeks(prev, 1));
    }
  };

  const toggleMealCompletion = async (scheduleId: string, isCompleted: boolean, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const schedule = schedules.find(s => s.id === scheduleId);
    if (!schedule || !user) return;

    try {
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

      setSchedules(prev => prev.map(s => s.id === scheduleId ? { ...s, is_completed: !isCompleted } : s));

      if (!isCompleted && !result.was_already_completed) {
        // Save to meal_history so it appears in Log a Meal → Recent tab
        supabase.from("meal_history").insert({
          user_id: user.id,
          name: schedule.meal.name,
          calories: schedule.meal.calories || 0,
          protein_g: schedule.meal.protein_g || 0,
          carbs_g: schedule.meal.carbs_g || 0,
          fat_g: schedule.meal.fat_g || 0,
        }).then(({ error }) => {
          if (error) console.error("Could not save to meal history:", error);
        });

        // Haptic feedback simulation
        if (navigator.vibrate) navigator.vibrate(10);
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
      setShowMealSheet(false);
      toast({ title: "Removed", description: "Meal removed from schedule" });
    }
  };

  // Update delivery time slot
  const updateDeliveryTimeSlot = async (scheduleId: string, timeSlot: string) => {
    try {
      const { error } = await (supabase as any)
        .from("meal_schedules")
        .update({ delivery_time_slot: timeSlot })
        .eq("id", scheduleId);

      if (error) throw error;

      setSchedules(prev => prev.map(s => 
        s.id === scheduleId ? { ...s, delivery_time_slot: timeSlot } : s
      ));

      toast({ 
        title: "Delivery Time Set", 
        description: `Your meal will be delivered during the selected time slot.` 
      });
    } catch (err) {
      console.error("Error updating time slot:", err);
      toast({ 
        title: "Error", 
        description: "Failed to set delivery time. Please try again.", 
        variant: "destructive" 
      });
    }
  };

  const handleOpenTimeSlotSelector = (scheduleId: string) => {
    setSelectedScheduleForTimeSlot(scheduleId);
    setShowTimeSlotDialog(true);
  };

  const handleTimeSlotSelect = ({ time }: { date: Date; time: string }) => {
    if (selectedScheduleForTimeSlot) {
      updateDeliveryTimeSlot(selectedScheduleForTimeSlot, time);
    }
    setShowTimeSlotDialog(false);
    setSelectedScheduleForTimeSlot(null);
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

  const getDailyNutrition = (date: Date) => {
    const meals = getMealsForDay(date);
    return {
      calories: meals.reduce((sum, s) => sum + (s.meal?.calories || 0), 0),
      protein: meals.reduce((sum, s) => sum + (s.meal?.protein_g || 0), 0),
      completed: meals.filter(m => m.is_completed).length,
      total: meals.length
    };
  };

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const displayMeals = getMealsForDay(selectedDate);
  const dailyNutrition = getDailyNutrition(selectedDate);

  // Calculate week progress — only count meals within the current displayed week
  const currentWeekEnd = addDays(currentWeekStart, 6);
  const thisWeekSchedules = schedules.filter(s => {
    const d = new Date(s.scheduled_date);
    d.setHours(0, 0, 0, 0);
    return d >= currentWeekStart && d <= currentWeekEnd;
  });
  const weekProgress = {
    total: thisWeekSchedules.length,
    completed: thisWeekSchedules.filter(s => s.is_completed).length,
    calories: thisWeekSchedules.reduce((sum, s) => sum + (s.is_completed ? s.meal?.calories ?? 0 : 0), 0),
  };

  if (!settingsLoading && !settings.features.meal_scheduling) {
    return (
      <div className="min-h-screen pb-24">
        <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between px-4 h-14">
            <button onClick={() => navigate("/dashboard")} className="p-2 -ml-2">
              <ChevronLeft className="h-6 w-6 text-primary" />
            </button>
            <h1 className="text-lg font-semibold">Schedule</h1>
            <div className="w-10" />
          </div>
        </div>
        <div className="flex flex-col items-center justify-center h-[70vh] px-6">
          <div className="w-20 h-20 rounded-3xl bg-amber-100 flex items-center justify-center mb-4">
            <AlertTriangle className="h-10 w-10 text-amber-500" />
          </div>
          <h2 className="text-xl font-bold mb-2">Scheduling Unavailable</h2>
          <p className="text-gray-500 text-center mb-6">Meal scheduling is currently disabled.</p>
          <Button onClick={() => navigate("/dashboard")} className="rounded-full px-8">Go Back</Button>
        </div>
      {/* Guest Login Prompt */}
      <GuestLoginPrompt
        open={showLoginPrompt}
        onOpenChange={setShowLoginPrompt}
        title={loginPromptConfig.title}
        description={loginPromptConfig.description}
        actionLabel={loginPromptConfig.actionLabel}
        signUpLabel={loginPromptConfig.signUpLabel}
      />

      <CustomerNavigation />
    </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      {/* Native iOS-style Header */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="sticky top-0 z-20 bg-background border-b border-gray-200 dark:border-gray-800"
      >
        {/* Navigation Bar */}
        <div className="flex items-center justify-between px-4 h-14">
          <button
            onClick={() => navigate("/dashboard")}
            className="p-2 -ml-2 rounded-full active:bg-gray-100 dark:active:bg-gray-800 transition-colors"
          >
            <ChevronLeft className="h-6 w-6 text-primary" />
          </button>
          <div className="flex flex-col items-center">
            <h1 className="text-lg font-semibold">Schedule</h1>
            <p className="text-xs text-gray-500">{format(currentWeekStart, "MMMM yyyy")}</p>
          </div>
          <div className="w-10" />
        </div>
      </motion.div>

      {/* Pull to Refresh Indicator */}
      <AnimatePresence>
        {isRefreshing && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-20 left-0 right-0 flex justify-center z-30"
          >
            <div className="bg-white dark:bg-gray-900 rounded-full px-4 py-2 shadow-lg flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-sm">Refreshing...</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content with Swipe */}
      <motion.div 
        className="overflow-hidden"
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.2}
        onDragEnd={(_, info) => handleSwipe(info)}
      >
        {/* Week Progress Card */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="mx-4 mt-4 bg-white dark:bg-gray-900 rounded-2xl shadow-sm overflow-hidden"
        >
          <div className="p-4 space-y-3">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">This Week</p>

            {/* Stats row */}
            <div className="flex items-center gap-3">
              {/* Meals completed */}
              <div className="flex-1 bg-primary/5 rounded-xl px-3 py-2.5">
                <p className="text-xs text-muted-foreground mb-0.5">Meals completed</p>
                <p className="text-xl font-bold text-foreground leading-none">
                  {weekProgress.completed}
                  <span className="text-sm font-medium text-muted-foreground ml-1">
                    of {weekProgress.total}
                  </span>
                </p>
              </div>

              {/* Calories burned */}
              <div className="flex-1 bg-orange-50 dark:bg-orange-900/20 rounded-xl px-3 py-2.5">
                <p className="text-xs text-muted-foreground mb-0.5">Calories consumed</p>
                <p className="text-xl font-bold text-orange-500 leading-none">
                  {weekProgress.calories.toLocaleString()}
                  <span className="text-xs font-medium text-muted-foreground ml-1">kcal</span>
                </p>
              </div>
            </div>

            {/* Progress Bar */}
            <div>
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>{weekProgress.total > 0 ? Math.round((weekProgress.completed / weekProgress.total) * 100) : 0}% done</span>
                <span>{weekProgress.total - weekProgress.completed} meals remaining</span>
              </div>
              <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${weekProgress.total > 0 ? (weekProgress.completed / weekProgress.total) * 100 : 0}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className="h-full bg-primary rounded-full"
                />
              </div>
            </div>
          </div>
        </motion.div>

        {/* Calendar Strip - iOS Style */}
        <div className="px-4 mt-4">
          <div className="flex items-center justify-between mb-2">
            <button 
              onClick={() => setCurrentWeekStart(prev => subWeeks(prev, 1))}
              className="p-2 -ml-2 rounded-full active:bg-gray-200 dark:active:bg-gray-800 transition-colors"
            >
              <ChevronLeft className="h-5 w-5 text-gray-400" />
            </button>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {format(currentWeekStart, "MMM d")} - {format(addDays(currentWeekStart, 6), "MMM d")}
            </p>
            <button 
              onClick={() => setCurrentWeekStart(prev => addWeeks(prev, 1))}
              className="p-2 -mr-2 rounded-full active:bg-gray-200 dark:active:bg-gray-800 transition-colors"
            >
              <ChevronRight className="h-5 w-5 text-gray-400" />
            </button>
          </div>
          
          <div className="flex gap-1">
            {weekDays.map((day, index) => {
              const isSelected = isSameDay(day, selectedDate);
              const isTodayDate = isToday(day);
              const status = getDayStatus(day);

              return (
                <motion.button
                  key={day.toISOString()}
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: index * 0.03 }}
                  onClick={() => setSelectedDate(day)}
                  className={`flex-1 relative rounded-2xl py-3 transition-all duration-200 ${
                    isSelected
                      ? 'bg-primary shadow-lg shadow-primary/25'
                      : 'bg-white dark:bg-gray-900 shadow-sm'
                  }`}
                >
                  <div className="flex flex-col items-center gap-1">
                    <span className={`text-xs font-medium ${
                      isSelected ? 'text-primary-foreground/70' : 'text-gray-400'
                    }`}>
                      {DAYS[day.getDay()]}
                    </span>
                    <span className={`text-lg font-semibold ${
                      isSelected ? 'text-primary-foreground' : isTodayDate ? 'text-primary' : 'text-gray-900 dark:text-white'
                    }`}>
                      {format(day, "d")}
                    </span>
                    
                    {/* Status Dot */}
                    <div className="h-1.5 flex items-center justify-center">
                      {status === "completed" && (
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      )}
                      {status === "partial" && (
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      )}
                      {status === "scheduled" && !isSelected && (
                        <div className="w-1.5 h-1.5 rounded-full bg-primary/50" />
                      )}
                    </div>
                  </div>
                  
                  {/* Today Indicator */}
                  {isTodayDate && !isSelected && (
                    <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full" />
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Selected Day Summary */}
        <motion.div 
          key={selectedDate.toISOString()}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-4 mt-4"
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-2xl font-bold">
                {isToday(selectedDate) ? 'Today' : format(selectedDate, "EEEE")}
              </h2>
              <p className="text-sm text-gray-500">{format(selectedDate, "MMMM d, yyyy")}</p>
            </div>
            {dailyNutrition.total > 0 && (
              <div className="text-right">
                <p className="text-2xl font-bold">{dailyNutrition.calories}</p>
                <p className="text-xs text-gray-500">calories</p>
              </div>
            )}
          </div>

          {/* Nutrition Rings */}
          {dailyNutrition.total > 0 && (
            <div className="flex gap-2 mb-4">
              <div className="flex-1 bg-white dark:bg-gray-900 rounded-xl p-3 flex items-center gap-3 shadow-sm">
                <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                  <Flame className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-lg font-bold">{dailyNutrition.calories}</p>
                  <p className="text-xs text-gray-500">calories</p>
                </div>
              </div>
              <div className="flex-1 bg-white dark:bg-gray-900 rounded-xl p-3 flex items-center gap-3 shadow-sm">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <Beef className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="text-lg font-bold">{dailyNutrition.protein}g</p>
                  <p className="text-xs text-gray-500">protein</p>
                </div>
              </div>
            </div>
          )}
        </motion.div>

        {/* Meals Timeline */}
        <div className="px-4 pb-32">
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
            ) : displayMeals.length === 0 ? (
              <motion.div 
                key="empty"
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex flex-col items-center justify-center py-16"
              >
                <div className="w-24 h-24 rounded-3xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                  <CalendarIcon className="h-12 w-12 text-gray-400" />
                </div>
                <p className="text-gray-500 text-center mb-2">No meals scheduled</p>
                <p className="text-sm text-gray-400 text-center mb-6">Tap + to add your first meal</p>
              </motion.div>
            ) : (
              <motion.div
                key="meals"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-3"
              >
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
                      <div className="flex items-center gap-2 mb-2 px-1">
                        <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${config.color} flex items-center justify-center`}>
                          <Icon className="h-4 w-4 text-white" />
                        </div>
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{config.label}</span>
                      </div>

                      {/* Meals */}
                      <div className="space-y-2">
                        {typeMeals.map((schedule, mealIndex) => (
                          <motion.div
                            key={schedule.id}
                            initial={{ y: 10, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: typeIndex * 0.1 + mealIndex * 0.05 }}
                            onClick={() => {
                              setSelectedMeal(schedule);
                              setShowMealSheet(true);
                            }}
                            className={`bg-white dark:bg-gray-900 rounded-2xl p-4 shadow-sm active:scale-[0.98] transition-transform ${
                              schedule.is_completed ? 'opacity-60' : ''
                            }`}
                          >
                            <div className="flex items-center gap-4">
                              {/* Checkbox */}
                              <button
                                onClick={(e) => toggleMealCompletion(schedule.id, schedule.is_completed, e)}
                                className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition-colors ${
                                  schedule.is_completed
                                    ? 'bg-emerald-500 border-emerald-500'
                                    : 'bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700'
                                }`}
                              >
                                {schedule.is_completed && <Check className="h-4 w-4 text-white" />}
                              </button>

                              {/* Meal Image */}
                              {schedule.meal?.image_url ? (
                                <img
                                  src={schedule.meal.image_url}
                                  alt={schedule.meal.name}
                                  className="w-16 h-16 rounded-xl object-cover"
                                />
                              ) : (
                                <div className="w-16 h-16 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-2xl">
                                  🍽️
                                </div>
                              )}

                              {/* Meal Info */}
                              <div className="flex-1 min-w-0">
                                <h3 className={`font-semibold truncate ${schedule.is_completed ? 'line-through text-gray-400' : ''}`}>
                                  {schedule.meal?.name}
                                </h3>
                                <div className="flex items-center gap-3 mt-1">
                                  <span className="flex items-center gap-1 text-sm text-orange-500">
                                    <Flame className="h-3.5 w-3.5" />
                                    {schedule.meal?.calories}
                                  </span>
                                  <span className="flex items-center gap-1 text-sm text-red-500">
                                    <Beef className="h-3.5 w-3.5" />
                                    {schedule.meal?.protein_g}g
                                  </span>
                                </div>
                                {/* Delivery Time Slot Button */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenTimeSlotSelector(schedule.id);
                                  }}
                                  className={`mt-2 flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg transition-colors ${
                                    schedule.delivery_time_slot 
                                      ? "bg-primary/10 text-primary" 
                                      : "bg-gray-100 text-gray-500 hover:bg-primary/5 hover:text-primary"
                                  }`}
                                >
                                  <Clock className="h-3 w-3" />
                                  {schedule.delivery_time_slot 
                                    ? schedule.delivery_time_slot.charAt(0).toUpperCase() + schedule.delivery_time_slot.slice(1)
                                    : "Set delivery time"
                                  }
                                </button>
                              </div>

                              {/* Arrow */}
                              <ChevronRight className="h-5 w-5 text-gray-300" />
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Floating Action Button */}
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => {
          if (user) {
            setShowWizard(true);
          } else {
            promptLogin({
              title: "Sign in to schedule meals",
              description: "Create an account to start planning your healthy meals and track your nutrition goals!",
              actionLabel: "Sign In",
              signUpLabel: "Create Free Account"
            });
          }
        }}
        className="fixed right-4 w-14 h-14 bg-primary rounded-full shadow-lg shadow-primary/30 flex items-center justify-center z-30"
        style={{ bottom: 'calc(6rem + env(safe-area-inset-bottom))' }}
      >
        <Plus className="h-7 w-7 text-primary-foreground" />
      </motion.button>

      {/* Swipe Hint */}
      <div className="fixed left-0 right-0 flex justify-center pointer-events-none" style={{ bottom: 'calc(6rem + env(safe-area-inset-bottom))' }}>
        <p className="text-xs text-gray-400">Swipe to change week</p>
      </div>

      {/* Meal Wizard */}
      <AnimatePresence>
        {showWizard && user && (
          <MealWizard
            userId={user.id}
            selectedDate={selectedDate}
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

      {/* Meal Detail Bottom Sheet */}
      <AnimatePresence>
        {showMealSheet && selectedMeal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMealSheet(false)}
              className="fixed inset-0 bg-black/50 z-40"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 rounded-t-3xl z-50 max-h-[85vh] overflow-y-auto"
            >
              {/* Handle Bar */}
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-10 h-1 bg-gray-300 dark:bg-gray-700 rounded-full" />
              </div>

              <div className="p-6" style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
                      MEAL_TYPE_CONFIG[selectedMeal.meal_type as keyof typeof MEAL_TYPE_CONFIG].bgColor
                    } ${
                      MEAL_TYPE_CONFIG[selectedMeal.meal_type as keyof typeof MEAL_TYPE_CONFIG].textColor
                    }`}>
                      {(() => {
                        const Icon = MEAL_TYPE_CONFIG[selectedMeal.meal_type as keyof typeof MEAL_TYPE_CONFIG].icon;
                        return <Icon className="h-3 w-3" />;
                      })()}
                      {MEAL_TYPE_CONFIG[selectedMeal.meal_type as keyof typeof MEAL_TYPE_CONFIG].label}
                    </span>
                    <h2 className="text-2xl font-bold mt-2">{selectedMeal.meal.name}</h2>
                  </div>
                  <button 
                    onClick={() => setShowMealSheet(false)}
                    className="p-2 rounded-full bg-gray-100 dark:bg-gray-800"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Actions - Moved to top */}
                <div className="space-y-3 mb-6">
                  <button
                    onClick={() => {
                      toggleMealCompletion(selectedMeal.id, selectedMeal.is_completed);
                      setShowMealSheet(false);
                    }}
                    className={`w-full py-4 rounded-2xl font-semibold flex items-center justify-center gap-2 transition-colors ${
                      selectedMeal.is_completed
                        ? 'bg-gray-100 dark:bg-gray-800 text-gray-700'
                        : 'bg-emerald-500 text-white'
                    }`}
                  >
                    {selectedMeal.is_completed ? (
                      <>
                        <Circle className="h-5 w-5" />
                        Mark as Not Done
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-5 w-5" />
                        Mark as Completed
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => navigate(`/meals/${selectedMeal.meal.id}`)}
                    className="w-full py-4 rounded-2xl font-semibold bg-primary text-primary-foreground flex items-center justify-center gap-2"
                  >
                    <Utensils className="h-5 w-5" />
                    View Meal Details
                  </button>

                  <button
                    onClick={() => deleteMeal(selectedMeal.id)}
                    className="w-full py-4 rounded-2xl font-semibold bg-red-50 dark:bg-red-900/20 text-red-500 flex items-center justify-center gap-2"
                  >
                    <Trash2 className="h-5 w-5" />
                    Remove from Schedule
                  </button>
                </div>

                {/* Meal Image */}
                {selectedMeal.meal.image_url ? (
                  <img
                    src={selectedMeal.meal.image_url}
                    alt={selectedMeal.meal.name}
                    className="w-full h-48 object-cover rounded-2xl mb-6"
                  />
                ) : (
                  <div className="w-full h-48 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center text-4xl mb-6">
                    🍽️
                  </div>
                )}

                {/* Nutrition Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-orange-50 dark:bg-orange-900/20 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Flame className="h-5 w-5 text-orange-500" />
                      <span className="text-sm text-orange-600 dark:text-orange-400">Calories</span>
                    </div>
                    <p className="text-2xl font-bold">{selectedMeal.meal.calories}</p>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/20 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Beef className="h-5 w-5 text-red-500" />
                      <span className="text-sm text-red-600 dark:text-red-400">Protein</span>
                    </div>
                    <p className="text-2xl font-bold">{selectedMeal.meal.protein_g}g</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Delivery Scheduler Dialog */}
      <Dialog open={showTimeSlotDialog} onOpenChange={setShowTimeSlotDialog}>
        <DialogContent className="sm:max-w-md rounded-3xl p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Schedule Delivery
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
            onSchedule={handleTimeSlotSelect}
            onCancel={() => setShowTimeSlotDialog(false)}
          />
        </DialogContent>
      </Dialog>

      <CustomerNavigation />
    </div>
  );
};

export default Schedule;