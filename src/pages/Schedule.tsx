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
import { NavChevronLeft, NavChevronRight } from "@/components/ui/nav-chevron";
import {
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
  CalendarCheck,
  Clock
} from "lucide-react";
import { format, startOfWeek, addDays, isSameDay, addWeeks, subWeeks, parseISO, isToday } from "date-fns";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import MealWizard from "@/components/MealWizard";
import { useLanguage } from "@/contexts/LanguageContext";

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
    label: "breakfast", 
    color: "from-amber-400 to-orange-400",
    bgColor: "bg-amber-50",
    textColor: "text-amber-700",
    borderColor: "border-amber-200"
  },
  lunch: { 
    icon: Sun, 
    label: "lunch", 
    color: "from-orange-400 to-red-400",
    bgColor: "bg-orange-50",
    textColor: "text-orange-700",
    borderColor: "border-orange-200"
  },
  dinner: { 
    icon: Moon, 
    label: "dinner", 
    color: "from-indigo-400 to-purple-400",
    bgColor: "bg-indigo-50",
    textColor: "text-indigo-700",
    borderColor: "border-indigo-200"
  },
  snack: { 
    icon: Apple, 
    label: "snack", 
    color: "from-emerald-400 to-teal-400",
    bgColor: "bg-emerald-50",
    textColor: "text-emerald-700",
    borderColor: "border-emerald-200"
  },
};

const DAYS_EN = ["S", "M", "T", "W", "T", "F", "S"];
const DAYS_AR = ["أ", "إ", "ث", "أ", "خ", "ج", "س"];

const MEAL_TYPE_TIMES: Record<string, string> = {
  breakfast: "8AM",
  lunch: "1PM",
  snack: "3PM",
  dinner: "7PM",
};

const MEAL_TYPE_STEP: Record<string, number> = {
  breakfast: 0,
  lunch: 1,
  dinner: 2,
  snack: 3,
};

// Native Mobile Schedule Component
const Schedule = () => {
  const { t, isRTL } = useLanguage();
  const DAYS = isRTL ? DAYS_AR : DAYS_EN;
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
  const [wizardInitialStep, setWizardInitialStep] = useState(0);
  const [wizardSingleMode, setWizardSingleMode] = useState(false);
  const [showModeDialog, setShowModeDialog] = useState(false);
  const [pendingMealType, setPendingMealType] = useState<string>("");
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
        name: t("unknown_meal"),
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
        title: t("error"), 
        description: err.message || t("failed_update_status"), 
        variant: "destructive" 
      });
    }
  };

  const deleteMeal = async (scheduleId: string) => {
    const { error } = await supabase.from("meal_schedules").delete().eq("id", scheduleId);
    if (error) {
      toast({ title: t("error"), description: t("failed_to_remove_meal"), variant: "destructive" });
    } else {
      setSchedules(prev => prev.filter(s => s.id !== scheduleId));
      setShowMealSheet(false);
      toast({ title: t("meal_removed"), description: t("meal_removed") });
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
        title: t("delivery_time_set"), 
        description: t("delivery_time_set_desc") 
      });
    } catch (err) {
      console.error("Error updating time slot:", err);
      toast({ 
        title: t("error"), 
        description: t("failed_set_delivery"), 
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

  const openModeDialog = (mealType: string) => {
    setPendingMealType(mealType);
    setShowModeDialog(true);
  };

  const handleScheduleSingleMeal = () => {
    setWizardInitialStep(MEAL_TYPE_STEP[pendingMealType] ?? 0);
    setWizardSingleMode(true);
    setShowModeDialog(false);
    setShowWizard(true);
  };

  const handleScheduleFullDay = () => {
    setWizardInitialStep(0);
    setWizardSingleMode(false);
    setShowModeDialog(false);
    setShowWizard(true);
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
              <NavChevronLeft className="h-6 w-6 text-primary" />
            </button>
            <h1 className="text-lg font-semibold">{t("schedule")}</h1>
            <div className="w-10" />
          </div>
        </div>
        <div className="flex flex-col items-center justify-center h-[70vh] px-6">
          <div className="w-20 h-20 rounded-3xl bg-amber-100 flex items-center justify-center mb-4">
            <AlertTriangle className="h-10 w-10 text-amber-500" />
          </div>
          <h2 className="text-xl font-bold mb-2">{t("scheduling_unavailable")}</h2>
          <p className="text-gray-500 text-center mb-6">{t("scheduling_disabled_desc")}</p>
          <Button onClick={() => navigate("/dashboard")} className="rounded-full px-8">{t("go_back")}</Button>
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-28">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 px-5 pt-12 pb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t("my_schedule")}</h1>
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <CalendarCheck className="h-5 w-5 text-primary" />
          </div>
        </div>

        {/* Week Navigation */}
        <div className="flex items-center justify-between mt-4">
          <button
            onClick={() => setCurrentWeekStart(prev => subWeeks(prev, 1))}
            className="p-1.5 rounded-full active:bg-gray-100 dark:active:bg-gray-800 transition-colors"
          >
            <NavChevronLeft className="h-5 w-5 text-gray-400" />
          </button>
          <p className="text-sm font-semibold text-primary">
            {t("this_week")} {format(currentWeekStart, "MMM d")}-{format(addDays(currentWeekStart, 6), "d")}
          </p>
          <button
            onClick={() => setCurrentWeekStart(prev => addWeeks(prev, 1))}
            className="p-1.5 rounded-full active:bg-gray-100 dark:active:bg-gray-800 transition-colors"
          >
            <NavChevronRight className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        {/* Day Strip */}
        <div className="flex gap-1.5 mt-4">
          {weekDays.map((day, index) => {
            const isSelected = isSameDay(day, selectedDate);
            const isTodayDate = isToday(day);
            const dayMealCount = getMealsForDay(day).length;
            return (
              <motion.button
                key={day.toISOString()}
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: index * 0.03 }}
                onClick={() => setSelectedDate(day)}
                className={`flex-1 flex flex-col items-center py-2 rounded-full transition-all duration-200 border ${
                  isSelected
                    ? 'bg-primary border-primary'
                    : 'bg-transparent border-gray-200 dark:border-gray-700'
                }`}
              >
                <span className={`text-xs font-medium leading-none mb-1 ${
                  isSelected ? 'text-white' : 'text-gray-400'
                }`}>
                  {DAYS[day.getDay()]}
                </span>
                <span className={`text-sm font-bold leading-none ${
                  isSelected ? 'text-white' : isTodayDate ? 'text-primary' : 'text-gray-800 dark:text-gray-200'
                }`}>
                  {format(day, "d")}
                </span>
                <div className="h-1.5 mt-1 flex items-center justify-center">
                  {dayMealCount > 0 && (
                    <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white/70' : 'bg-primary'}`} />
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Stats Cards */}
        <div className="flex gap-3 mt-4">
          <div className="flex-1 bg-gray-50 dark:bg-gray-800 rounded-2xl p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
              <Utensils className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xl font-bold text-gray-900 dark:text-white leading-none">
                {weekProgress.completed}/{weekProgress.total}
              </p>
              <p className="text-xs text-gray-500 mt-0.5 leading-tight">{t("meals_completed")}</p>
            </div>
          </div>
          <div className="flex-1 bg-gray-50 dark:bg-gray-800 rounded-2xl p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
              <Flame className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xl font-bold text-gray-900 dark:text-white leading-none">
                {weekProgress.calories.toLocaleString()}
                <span className="text-xs font-medium text-gray-400 ml-0.5">kcal</span>
              </p>
              <p className="text-xs text-gray-500 mt-0.5 leading-tight">{t("calories_statistics")}</p>
            </div>
          </div>
        </div>

        {/* Weekly Progress Bar */}
        <div className="mt-4">
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">
            {t("weekly_progress")} {weekProgress.total > 0 ? Math.round((weekProgress.completed / weekProgress.total) * 100) : 0}%
          </p>
          <div className="h-2.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${weekProgress.total > 0 ? (weekProgress.completed / weekProgress.total) * 100 : 0}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="h-full bg-primary rounded-full"
            />
          </div>
        </div>
      </div>

      {/* Today Meals Section */}
      <motion.div
        key={selectedDate.toISOString()}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-5 mt-5"
      >
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          {isToday(selectedDate) ? t("today_meals") : `${t(format(selectedDate, "EEEE").toLowerCase() as any)} ${t("day_meals")}`}
        </h2>

        {/* Pull to Refresh Indicator */}
        <AnimatePresence>
          {isRefreshing && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center justify-center py-3 gap-2"
            >
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-sm text-gray-500">{t("refreshing")}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <div className="space-y-3">
            {MEAL_TYPES.map((mealType, typeIndex) => {
              const typeMeals = displayMeals.filter(m => m.meal_type === mealType);
              const timeLabel = MEAL_TYPE_TIMES[mealType];
              const mealTypeName = t(mealType as any);

              if (typeMeals.length > 0) {
                return typeMeals.map((schedule, mealIndex) => (
                  <motion.div
                    key={schedule.id}
                    initial={{ x: -15, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: typeIndex * 0.08 + mealIndex * 0.04 }}
                    onClick={() => {
                      setSelectedMeal(schedule);
                      setShowMealSheet(true);
                    }}
                    className="flex items-center gap-3 active:scale-[0.98] transition-transform cursor-pointer"
                  >
                    {/* Time Label */}
                    <div className="w-10 shrink-0 text-right">
                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                        {schedule.delivery_time_slot || timeLabel}
                      </span>
                    </div>

                    {/* Meal Card */}
                    <div className={`flex-1 bg-white dark:bg-gray-900 rounded-2xl p-3 shadow-sm flex items-center gap-3 ${
                      schedule.is_completed ? 'opacity-70' : ''
                    }`}>
                      {/* Meal Image */}
                      {schedule.meal?.image_url ? (
                        <img
                          src={schedule.meal.image_url}
                          alt={schedule.meal.name}
                          className="w-16 h-16 rounded-xl object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-2xl shrink-0">
                          🍽️
                        </div>
                      )}

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-0.5">
                          <span className="text-xs text-gray-500">{mealTypeName}</span>
                          {/* Status Badge */}
                          {schedule.is_completed ? (
                            <span className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-600 text-xs font-semibold">
                              <Check className="h-3 w-3" />
                              {t("status_delivered")}
                            </span>
                          ) : (
                            <span className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-100 text-orange-500 text-xs font-semibold">
                              <Clock className="h-3 w-3" />
                              {t("status_scheduled")}
                            </span>
                          )}
                        </div>
                        <h3 className={`font-bold text-sm text-gray-900 dark:text-white leading-tight truncate ${
                          schedule.is_completed ? 'line-through text-gray-400' : ''
                        }`}>
                          {schedule.meal?.name}
                        </h3>
                        <p className="text-xs text-gray-400 mt-0.5">{schedule.meal?.calories}{t("cal_unit")}</p>
                      </div>
                    </div>
                  </motion.div>
                ));
              }

              /* Empty slot */
              return (
                <motion.div
                  key={`empty-${mealType}`}
                  initial={{ x: -15, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: typeIndex * 0.08 }}
                  className="flex items-center gap-3"
                >
                  {/* Time Label */}
                  <div className="w-10 shrink-0 text-right">
                    <span className="text-xs font-semibold text-gray-400">{timeLabel}</span>
                  </div>

                  {/* Empty Meal Card */}
                  <div className="flex-1 bg-white dark:bg-gray-900 rounded-2xl p-3 border-2 border-dashed border-gray-200 dark:border-gray-700 flex items-center gap-3">
                    <button
                      onClick={() => {
                        if (user) {
                          openModeDialog(mealType);
                        } else {
                          promptLogin({
                            title: t("sign_in_to_schedule"),
                            description: t("sign_in_to_schedule_desc"),
                            actionLabel: t("sign_in"),
                            signUpLabel: t("create_free_account")
                          });
                        }
                      }}
                      className="w-14 h-14 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0 active:scale-95 transition-transform"
                    >
                      <Plus className="h-6 w-6 text-gray-400" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-400 mb-2">{mealTypeName}</p>
                      <button
                        onClick={() => {
                          if (user) {
                            openModeDialog(mealType);
                          } else {
                            promptLogin({
                              title: t("sign_in_to_schedule"),
                              description: t("sign_in_to_schedule_desc"),
                              actionLabel: t("sign_in"),
                              signUpLabel: t("create_free_account")
                            });
                          }
                        }}
                        className="px-4 py-2 bg-primary text-white text-xs font-semibold rounded-full active:scale-95 transition-transform"
                      >
                        {t("choose_meal")}
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* Meal Wizard */}
      <AnimatePresence>
        {showWizard && user && (
          <MealWizard
            userId={user.id}
            selectedDate={selectedDate}
            initialStep={wizardInitialStep}
            singleMode={wizardSingleMode}
            onComplete={() => {
              setShowWizard(false);
              fetchSchedules();
            }}
            onCancel={() => setShowWizard(false)}
          />
        )}
      </AnimatePresence>

      {/* Mode Selection Dialog */}
      <AnimatePresence>
        {showModeDialog && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowModeDialog(false)}
              className="fixed inset-0 bg-black/50 z-40"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 rounded-t-3xl z-50"
            >
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-10 h-1 bg-gray-300 dark:bg-gray-700 rounded-full" />
              </div>
              <div className="px-5" style={{ paddingBottom: 'calc(80px + max(16px, env(safe-area-inset-bottom)))' }}>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                  How would you like to schedule?
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
                  Plan just this meal or your entire day
                </p>

                {/* Option 1 — single meal */}
                <button
                  onClick={handleScheduleSingleMeal}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-primary/25 bg-primary/5 mb-3 active:scale-[0.98] transition-transform text-left"
                >
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    {(() => {
                      const config = MEAL_TYPE_CONFIG[pendingMealType as keyof typeof MEAL_TYPE_CONFIG];
                      if (!config) return null;
                      const Icon = config.icon;
                      return <Icon className="h-6 w-6 text-primary" />;
                    })()}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {t("schedule_single_meal")} {t(pendingMealType as any)}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{t("schedule_single_meal_desc")}</p>
                  </div>
                  <NavChevronRight className="h-5 w-5 text-gray-400 shrink-0" />
                </button>

                {/* Option 2 — full day */}
                <button
                  onClick={handleScheduleFullDay}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-gray-200 dark:border-gray-700 active:scale-[0.98] transition-transform text-left"
                >
                  <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
                    <CalendarIcon className="h-6 w-6 text-gray-600 dark:text-gray-400" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 dark:text-white">{t("schedule_full_day")}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{t("schedule_full_day_desc")}</p>
                  </div>
                  <NavChevronRight className="h-5 w-5 text-gray-400 shrink-0" />
                </button>
              </div>
            </motion.div>
          </>
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
                      {t(MEAL_TYPE_CONFIG[selectedMeal.meal_type as keyof typeof MEAL_TYPE_CONFIG].label as any)}
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
                        {t("mark_not_done")}
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-5 w-5" />
                        {t("mark_completed")}
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => navigate(`/meals/${selectedMeal.meal.id}`)}
                    className="w-full py-4 rounded-2xl font-semibold bg-primary text-primary-foreground flex items-center justify-center gap-2"
                  >
                    <Utensils className="h-5 w-5" />
                    {t("view_meal_details")}
                  </button>

                  <button
                    onClick={() => deleteMeal(selectedMeal.id)}
                    className="w-full py-4 rounded-2xl font-semibold bg-red-50 dark:bg-red-900/20 text-red-500 flex items-center justify-center gap-2"
                  >
                    <Trash2 className="h-5 w-5" />
                    {t("remove_from_schedule")}
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
                      <span className="text-sm text-orange-600 dark:text-orange-400">{t("calories")}</span>
                    </div>
                    <p className="text-2xl font-bold">{selectedMeal.meal.calories}</p>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/20 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Beef className="h-5 w-5 text-red-500" />
                      <span className="text-sm text-red-600 dark:text-red-400">{t("protein")}</span>
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
              {t("schedule_delivery")}
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