import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";
import { useSubscription } from "@/hooks/useSubscription";
import { useWallet } from "@/hooks/useWallet";
import { formatCurrency } from "@/lib/currency";
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
  Clock,
  Wallet,
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
  const { remainingMeals, isUnlimited, hasActiveSubscription, subscription, refetch: refetchSubscription } = useSubscription();
  const { wallet, refresh: refetchWallet } = useWallet();

  const pricePerMeal = 50; // Fixed extra meal credit price in QAR

  // ── Buy 1 meal credit with wallet ─────────────────────────────────────
  const [showBuyCredit, setShowBuyCredit] = useState(false);
  const [buyLoading, setBuyLoading] = useState(false);

  const handleBuyMealCredit = async () => {
    if (!user || !subscription) return;
    const balance = wallet?.balance || 0;
    if (balance < pricePerMeal) { navigate("/wallet"); return; }
    setBuyLoading(true);
    try {
      // Debit wallet
      const { error: debitErr } = await (supabase.rpc as any)("debit_wallet", {
        p_user_id: user.id,
        p_amount: pricePerMeal,
        p_reference_type: "order",
        p_description: "Extra meal credit purchase",
        p_metadata: { subscription_id: subscription.id },
      });
      if (debitErr) throw debitErr;

      // Add 1 meal to the subscription's monthly allowance
      const { error: subErr } = await supabase
        .from("subscriptions")
        .update({ meals_per_month: subscription.meals_per_month + 1 })
        .eq("id", subscription.id);
      if (subErr) throw subErr;

      refetchWallet();
      await refetchSubscription();
      setShowBuyCredit(false);
      toast({
        title: "Meal credit added! ✅",
        description: `1 meal added to your plan — QAR ${pricePerMeal} deducted. You can now schedule your meal.`,
      });
    } catch (err: any) {
      toast({ title: "Purchase failed", description: err.message, variant: "destructive" });
    } finally {
      setBuyLoading(false);
    }
  };

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

  const openWizard = (mealType: string) => {
    setWizardInitialStep(MEAL_TYPE_STEP[mealType] ?? 0);
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
        <div className="sticky top-0 z-10 bg-background/90 backdrop-blur-xl border-b border-border/40">
          <div className="flex items-center justify-between px-4 h-14">
            <button onClick={() => navigate("/dashboard")} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
              <NavChevronLeft className="h-5 w-5" />
            </button>
            <h1 className="text-base font-semibold">{t("schedule")}</h1>
            <div className="w-8" />
          </div>
        </div>
        <div className="flex flex-col items-center justify-center h-[70vh] px-6">
          <div className="w-20 h-20 rounded-3xl bg-amber-100 flex items-center justify-center mb-4">
            <AlertTriangle className="h-10 w-10 text-amber-500" />
          </div>
          <h2 className="text-xl font-bold mb-2">{t("scheduling_unavailable")}</h2>
          <p className="text-gray-500 text-center text-sm mb-6">{t("scheduling_disabled_desc")}</p>
          <Button onClick={() => navigate("/dashboard")} className="rounded-full px-8">{t("go_back")}</Button>
        </div>
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

  const weekProgressPct = weekProgress.total > 0 ? Math.round((weekProgress.completed / weekProgress.total) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-24">

      {/* ── Sticky Header ─────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
        {/* Title row */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">{t("my_schedule")}</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              {format(currentWeekStart, "MMM d")} – {format(addDays(currentWeekStart, 6), "MMM d, yyyy")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Remaining meals badge */}
            {hasActiveSubscription && !isUnlimited && (
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
                remainingMeals <= 0
                  ? "bg-red-100 text-red-600"
                  : remainingMeals <= 3
                  ? "bg-amber-100 text-amber-700"
                  : "bg-primary/10 text-primary"
              }`}>
                <Utensils className="h-3.5 w-3.5" />
                {remainingMeals <= 0 ? "0 left" : `${remainingMeals} left`}
              </div>
            )}
            {isUnlimited && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-primary/10 text-primary">
                <CalendarCheck className="h-3.5 w-3.5" />
                {t("unlimited")}
              </div>
            )}
          </div>
        </div>

        {/* Week navigation row */}
        <div className="flex items-center gap-2 px-4 pb-3">
          <button
            onClick={() => setCurrentWeekStart(prev => subWeeks(prev, 1))}
            className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center active:bg-gray-200 transition-colors shrink-0"
          >
            <NavChevronLeft className="h-4 w-4 text-gray-500" />
          </button>

          {/* Day strip */}
          <div className="flex-1 flex gap-1">
            {weekDays.map((day, index) => {
              const isSelected = isSameDay(day, selectedDate);
              const isTodayDate = isToday(day);
              const dayStatus = getDayStatus(day);
              return (
                <motion.button
                  key={day.toISOString()}
                  initial={{ y: 6, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: index * 0.03 }}
                  onClick={() => setSelectedDate(day)}
                  className={`flex-1 flex flex-col items-center py-2 rounded-xl transition-all duration-200 ${
                    isSelected
                      ? "bg-primary shadow-md shadow-primary/25"
                      : isTodayDate
                      ? "bg-primary/10"
                      : "bg-transparent"
                  }`}
                >
                  <span className={`text-[10px] font-semibold leading-none mb-1 ${
                    isSelected ? "text-white/80" : "text-gray-400"
                  }`}>
                    {DAYS[day.getDay()]}
                  </span>
                  <span className={`text-sm font-bold leading-none ${
                    isSelected ? "text-white" : isTodayDate ? "text-primary" : "text-gray-800 dark:text-gray-100"
                  }`}>
                    {format(day, "d")}
                  </span>
                  {/* Meal dot indicators */}
                  <div className="h-2 mt-1 flex items-center justify-center gap-0.5">
                    {dayStatus === "completed" && (
                      <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-white/60" : "bg-emerald-500"}`} />
                    )}
                    {dayStatus === "partial" && (
                      <>
                        <div className={`w-1 h-1 rounded-full ${isSelected ? "bg-white/70" : "bg-primary"}`} />
                        <div className={`w-1 h-1 rounded-full ${isSelected ? "bg-white/30" : "bg-gray-300"}`} />
                      </>
                    )}
                    {dayStatus === "scheduled" && (
                      <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-white/60" : "bg-primary"}`} />
                    )}
                  </div>
                </motion.button>
              );
            })}
          </div>

          <button
            onClick={() => setCurrentWeekStart(prev => addWeeks(prev, 1))}
            className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center active:bg-gray-200 transition-colors shrink-0"
          >
            <NavChevronRight className="h-4 w-4 text-gray-500" />
          </button>
        </div>
      </div>

      {/* ── Weekly Stats Banner ────────────────────────────── */}
      <div className="px-4 mt-3">
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-800">
          {/* Stats row */}
          <div className="flex items-center gap-4 mb-3">
            <div className="flex-1 flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Utensils className="h-4.5 w-4.5 text-primary" />
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900 dark:text-white leading-none">
                  {weekProgress.completed}
                  <span className="text-sm font-medium text-gray-400">/{weekProgress.total}</span>
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{t("meals_completed")}</p>
              </div>
            </div>
            <div className="w-px h-8 bg-gray-100 dark:bg-gray-800" />
            <div className="flex-1 flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
                <Flame className="h-4.5 w-4.5 text-orange-500" />
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900 dark:text-white leading-none">
                  {weekProgress.calories.toLocaleString()}
                  <span className="text-xs font-medium text-gray-400 ml-0.5">kcal</span>
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{t("calories_statistics")}</p>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-2xl font-black text-primary leading-none">{weekProgressPct}%</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{t("weekly_progress")}</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${weekProgressPct}%` }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full"
            />
          </div>
        </div>
      </div>

      {/* ── Day Meals ─────────────────────────────────────── */}
      <motion.div
        key={selectedDate.toISOString()}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="px-4 mt-4"
      >
        {/* Day header */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">
            {isToday(selectedDate)
              ? t("today_meals")
              : `${format(selectedDate, "EEEE, MMM d")}`}
          </h2>
          {dailyNutrition.total > 0 && (
            <div className="flex items-center gap-1 text-xs text-gray-400 font-medium">
              <Flame className="h-3.5 w-3.5 text-orange-400" />
              {dailyNutrition.calories} kcal
              <span className="mx-1 text-gray-300">·</span>
              <span className="text-emerald-500">{dailyNutrition.completed}/{dailyNutrition.total} done</span>
            </div>
          )}
        </div>

        {/* Refresh indicator */}
        <AnimatePresence>
          {isRefreshing && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex items-center justify-center py-2 gap-2"
            >
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-xs text-gray-400">{t("refreshing")}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {loading ? (
          <div className="flex items-center justify-center py-14">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <div className="space-y-2.5 pb-4">
            {MEAL_TYPES.map((mealType, typeIndex) => {
              const config = MEAL_TYPE_CONFIG[mealType];
              const MealIcon = config.icon;
              const typeMeals = displayMeals.filter(m => m.meal_type === mealType);
              const timeLabel = MEAL_TYPE_TIMES[mealType];
              const mealTypeName = t(mealType as any);
              const noMealsLeft = hasActiveSubscription && !isUnlimited && remainingMeals <= 0;

              if (typeMeals.length > 0) {
                return typeMeals.map((schedule, mealIndex) => (
                  <motion.button
                    key={schedule.id}
                    initial={{ x: -12, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: typeIndex * 0.07 + mealIndex * 0.03 }}
                    onClick={() => { setSelectedMeal(schedule); setShowMealSheet(true); }}
                    className="w-full active:scale-[0.98] transition-transform"
                  >
                    <div className={`bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-800 flex ${
                      schedule.is_completed ? "opacity-75" : ""
                    }`}>
                      {/* Colored left accent */}
                      <div className={`w-1 shrink-0 bg-gradient-to-b ${config.color}`} />

                      <div className="flex-1 flex items-center gap-3 p-3">
                        {/* Meal image */}
                        {schedule.meal?.image_url ? (
                          <img
                            src={schedule.meal.image_url}
                            alt={schedule.meal.name}
                            className="w-14 h-14 rounded-xl object-cover shrink-0"
                          />
                        ) : (
                          <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${config.bgColor}`}>
                            <MealIcon className={`h-6 w-6 ${config.textColor}`} />
                          </div>
                        )}

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-0.5">
                            <span className={`text-[11px] font-semibold uppercase tracking-wide ${config.textColor}`}>
                              {mealTypeName}
                            </span>
                            <span className="text-[10px] font-medium text-gray-400">
                              {schedule.delivery_time_slot || timeLabel}
                            </span>
                          </div>
                          <h3 className={`font-bold text-sm text-gray-900 dark:text-white truncate leading-tight ${
                            schedule.is_completed ? "line-through text-gray-400 dark:text-gray-600" : ""
                          }`}>
                            {schedule.meal?.name}
                          </h3>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-gray-400 flex items-center gap-1">
                              <Flame className="h-3 w-3 text-orange-400" />
                              {schedule.meal?.calories} {t("cal_unit")}
                            </span>
                            {schedule.is_completed ? (
                              <span className="flex items-center gap-0.5 text-emerald-600 text-xs font-semibold">
                                <Check className="h-3 w-3" />
                                {t("status_delivered")}
                              </span>
                            ) : (
                              <span className="flex items-center gap-0.5 text-orange-500 text-xs font-medium">
                                <Clock className="h-3 w-3" />
                                {t("status_scheduled")}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Completion toggle */}
                        <button
                          onClick={(e) => toggleMealCompletion(schedule.id, schedule.is_completed, e)}
                          className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all active:scale-90 ${
                            schedule.is_completed
                              ? "bg-emerald-500 shadow-md shadow-emerald-300/40"
                              : "border-2 border-gray-200 dark:border-gray-700"
                          }`}
                        >
                          {schedule.is_completed
                            ? <Check className="h-4.5 w-4.5 text-white" />
                            : <Circle className="h-4 w-4 text-gray-300" />
                          }
                        </button>
                      </div>
                    </div>
                  </motion.button>
                ));
              }

              /* ── Empty slot ────────────────────────────── */
              return (
                <motion.div
                  key={`empty-${mealType}`}
                  initial={{ x: -12, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: typeIndex * 0.07 }}
                >
                  <div className={`bg-white dark:bg-gray-900 rounded-2xl overflow-hidden border ${
                    noMealsLeft ? "border-amber-200 dark:border-amber-800" : "border-dashed border-gray-200 dark:border-gray-700"
                  } flex`}>
                    {/* Muted left accent */}
                    <div className={`w-1 shrink-0 bg-gradient-to-b ${config.color} opacity-25`} />

                    <div className="flex-1 flex items-center gap-3 px-3 py-3">
                      {/* Icon placeholder */}
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${config.bgColor} opacity-60`}>
                        <MealIcon className={`h-5 w-5 ${config.textColor}`} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <span className={`text-[11px] font-semibold uppercase tracking-wide ${config.textColor} opacity-70`}>
                          {mealTypeName}
                        </span>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {timeLabel} · {noMealsLeft ? "No meals left" : t("no_meal_scheduled")}
                        </p>
                      </div>

                      {/* CTA */}
                      {noMealsLeft ? (
                        <button
                          onClick={() => setShowBuyCredit(true)}
                          className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-amber-500 text-white text-xs font-bold rounded-xl active:scale-95 transition-transform"
                        >
                          <Wallet className="h-3.5 w-3.5" />
                          Buy
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            if (!user) {
                              promptLogin({
                                title: t("sign_in_to_schedule"),
                                description: t("sign_in_to_schedule_desc"),
                                actionLabel: t("sign_in"),
                                signUpLabel: t("create_free_account"),
                              });
                            } else {
                              openWizard(mealType);
                            }
                          }}
                          className="shrink-0 w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center active:scale-95 transition-transform"
                        >
                          <Plus className="h-5 w-5 text-primary" />
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* ── Meal Wizard ─────────────────────────────────── */}
      <AnimatePresence>
        {showWizard && user && (
          <MealWizard
            userId={user.id}
            selectedDate={selectedDate}
            initialStep={wizardInitialStep}
            onComplete={() => { setShowWizard(false); fetchSchedules(); }}
            onCancel={() => setShowWizard(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Meal Detail Bottom Sheet ──────────────────────── */}
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
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 bg-gray-200 dark:bg-gray-700 rounded-full" />
              </div>

              <div className="p-5" style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}>
                {/* Sheet header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 min-w-0">
                    {(() => {
                      const cfg = MEAL_TYPE_CONFIG[selectedMeal.meal_type as keyof typeof MEAL_TYPE_CONFIG];
                      const Icon = cfg.icon;
                      return (
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bgColor} ${cfg.textColor} mb-2`}>
                          <Icon className="h-3 w-3" />
                          {t(cfg.label as any)}
                        </span>
                      );
                    })()}
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white leading-tight truncate">{selectedMeal.meal.name}</h2>
                  </div>
                  <button
                    onClick={() => setShowMealSheet(false)}
                    className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0 ml-3"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Meal image */}
                {selectedMeal.meal.image_url ? (
                  <img src={selectedMeal.meal.image_url} alt={selectedMeal.meal.name} className="w-full h-44 object-cover rounded-2xl mb-4" />
                ) : (
                  <div className="w-full h-44 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center text-5xl mb-4">🍽️</div>
                )}

                {/* Nutrition row */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-3 flex items-center gap-2">
                    <Flame className="h-4 w-4 text-orange-500 shrink-0" />
                    <div>
                      <p className="text-lg font-bold text-gray-900 dark:text-white leading-none">{selectedMeal.meal.calories}</p>
                      <p className="text-xs text-orange-500 font-medium">{t("calories")}</p>
                    </div>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-3 flex items-center gap-2">
                    <Beef className="h-4 w-4 text-red-500 shrink-0" />
                    <div>
                      <p className="text-lg font-bold text-gray-900 dark:text-white leading-none">{selectedMeal.meal.protein_g}g</p>
                      <p className="text-xs text-red-500 font-medium">{t("protein")}</p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-2">
                  <button
                    onClick={() => { toggleMealCompletion(selectedMeal.id, selectedMeal.is_completed); setShowMealSheet(false); }}
                    className={`w-full py-3.5 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors ${
                      selectedMeal.is_completed
                        ? "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                        : "bg-emerald-500 text-white shadow-md shadow-emerald-300/30"
                    }`}
                  >
                    {selectedMeal.is_completed
                      ? <><Circle className="h-4.5 w-4.5" />{t("mark_not_done")}</>
                      : <><CheckCircle2 className="h-4.5 w-4.5" />{t("mark_completed")}</>}
                  </button>
                  <button
                    onClick={() => navigate(`/meals/${selectedMeal.meal.id}`)}
                    className="w-full py-3.5 rounded-2xl font-semibold text-sm bg-primary text-white flex items-center justify-center gap-2"
                  >
                    <Utensils className="h-4.5 w-4.5" />
                    {t("view_meal_details")}
                  </button>
                  <button
                    onClick={() => deleteMeal(selectedMeal.id)}
                    className="w-full py-3.5 rounded-2xl font-semibold text-sm bg-red-50 dark:bg-red-900/20 text-red-500 flex items-center justify-center gap-2"
                  >
                    <Trash2 className="h-4.5 w-4.5" />
                    {t("remove_from_schedule")}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Delivery Scheduler Dialog ─────────────────────── */}
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
            timeSlots={["7:00 AM","8:00 AM","9:00 AM","11:00 AM","12:00 PM","1:00 PM","5:00 PM","6:00 PM","7:00 PM"]}
            timeZone="Qatar (GMT +3)"
            onSchedule={handleTimeSlotSelect}
            onCancel={() => setShowTimeSlotDialog(false)}
          />
        </DialogContent>
      </Dialog>

      {/* ── Buy Meal Credit Dialog ────────────────────────── */}
      <Dialog open={showBuyCredit} onOpenChange={setShowBuyCredit}>
        <DialogContent className="max-w-sm rounded-2xl p-0 overflow-hidden mx-4">
          <div className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                <Wallet className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white">Buy Extra Meal Credit</h3>
                <p className="text-xs text-gray-400">Add 1 meal to your plan</p>
              </div>
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4 space-y-3 mb-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Meal credit price</span>
                <span className="font-bold text-amber-600">{formatCurrency(pricePerMeal)}</span>
              </div>
              <div className="h-px bg-amber-200/50" />
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Your wallet</span>
                <span className={`font-bold ${(wallet?.balance || 0) >= pricePerMeal ? "text-emerald-600" : "text-red-500"}`}>
                  {formatCurrency(wallet?.balance || 0)}
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowBuyCredit(false)} className="flex-1 rounded-xl">
                Cancel
              </Button>
              {(wallet?.balance || 0) < pricePerMeal ? (
                <Button onClick={() => navigate("/wallet")} className="flex-1 bg-amber-500 hover:bg-amber-600 text-white rounded-xl">
                  Top Up Wallet
                </Button>
              ) : (
                <Button
                  onClick={handleBuyMealCredit}
                  disabled={buyLoading}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-white rounded-xl"
                >
                  {buyLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : `Pay ${formatCurrency(pricePerMeal)}`}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Guest Login Prompt ────────────────────────────── */}
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
};

export default Schedule;