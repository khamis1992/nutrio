import { useState, useEffect, useCallback, useRef } from "react";
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
import { GuestLoginPrompt, useGuestLoginPrompt } from "@/components/GuestLoginPrompt";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DeliveryScheduler } from "@/components/ui/delivery-scheduler";
import { trackEvent } from "@/lib/analytics";
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
  UtensilsCrossed,
  Calendar as CalendarIcon,
  Clock,
  Wallet,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Leaf,
  Zap,
} from "lucide-react";
import { format, startOfWeek, addDays, isSameDay, addWeeks, subWeeks, parseISO, isToday } from "date-fns";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import MealWizard from "@/components/MealWizard";
import { ModifyOrderModal } from "@/components/ModifyOrderModal";
import { useLanguage } from "@/contexts/LanguageContext";

interface ScheduledMeal {
  id: string;
  scheduled_date: string;
  meal_type: string;
  is_completed: boolean;
  delivery_time_slot: string | null;
  order_status: string;
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
    gradient: "from-amber-400 to-orange-500",
    bgGradient: "bg-gradient-to-br from-amber-50 to-orange-50",
    textColor: "text-amber-600",
    bgColor: "bg-amber-100",
    borderColor: "border-amber-200",
    ringColor: "ring-amber-400",
    shadowColor: "shadow-amber-500/20",
    nutritionBg: "bg-gradient-to-br from-amber-50 to-orange-50",
    nutritionBorder: "border-amber-100",
  },
  lunch: {
    icon: Sun,
    label: "lunch",
    gradient: "from-emerald-400 to-teal-500",
    bgGradient: "bg-gradient-to-br from-emerald-50 to-teal-50",
    textColor: "text-emerald-600",
    bgColor: "bg-emerald-100",
    borderColor: "border-emerald-200",
    ringColor: "ring-emerald-400",
    shadowColor: "shadow-emerald-500/20",
    nutritionBg: "bg-gradient-to-br from-emerald-50 to-teal-50",
    nutritionBorder: "border-emerald-100",
  },
  dinner: {
    icon: Moon,
    label: "dinner",
    gradient: "from-indigo-400 to-purple-500",
    bgGradient: "bg-gradient-to-br from-indigo-50 to-purple-50",
    textColor: "text-indigo-600",
    bgColor: "bg-indigo-100",
    borderColor: "border-indigo-200",
    ringColor: "ring-indigo-400",
    shadowColor: "shadow-indigo-500/20",
    nutritionBg: "bg-gradient-to-br from-indigo-50 to-purple-50",
    nutritionBorder: "border-indigo-100",
  },
  snack: {
    icon: Apple,
    label: "snack",
    gradient: "from-pink-400 to-rose-500",
    bgGradient: "bg-gradient-to-br from-pink-50 to-rose-50",
    textColor: "text-pink-600",
    bgColor: "bg-pink-100",
    borderColor: "border-pink-200",
    ringColor: "ring-pink-400",
    shadowColor: "shadow-pink-500/20",
    nutritionBg: "bg-gradient-to-br from-pink-50 to-rose-50",
    nutritionBorder: "border-pink-100",
  },
};

const DAYS_EN = ["S", "M", "T", "W", "T", "F", "S"];
const DAYS_AR = ["أ", "إ", "ث", "أ", "خ", "ج", "س"];

const MEAL_TYPE_TIMES: Record<string, string> = {
  breakfast: "8:00 AM",
  lunch: "1:00 PM",
  snack: "3:00 PM",
  dinner: "7:00 PM",
};

const MEAL_TYPE_STEP: Record<string, number> = {
  breakfast: 0,
  lunch: 1,
  dinner: 2,
  snack: 3,
};

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

  const pricePerMeal = subscription?.price_per_meal ?? 50;

  const [showBuyCredit, setShowBuyCredit] = useState(false);
  const [buyLoading, setBuyLoading] = useState(false);

  const handleBuyMealCredit = async () => {
    if (!user || !subscription) return;
    const balance = wallet?.balance || 0;
    if (balance < pricePerMeal) { navigate("/wallet"); return; }
    setBuyLoading(true);
    try {
      const { error: debitErr } = await supabase.rpc("debit_wallet", {
        p_user_id: user.id,
        p_amount: pricePerMeal,
        p_reference_type: "order",
        p_description: "Extra meal credit purchase",
        p_metadata: { subscription_id: subscription.id },
      });
      if (debitErr) throw debitErr;

      const { error: subErr } = await supabase
        .from("subscriptions")
        .update({ meals_per_month: subscription.meals_per_month + 1 })
        .eq("id", subscription.id);
      if (subErr) throw subErr;

      refetchWallet();
      await refetchSubscription();
      setShowBuyCredit(false);
      toast({
        title: "Meal credit added!",
        description: `1 meal added to your plan — QAR ${pricePerMeal} deducted.`,
      });
    } catch (err) {
      toast({ title: "Purchase failed", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
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
  const [wizardAutoFill, setWizardAutoFill] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [showInlinePreview, setShowInlinePreview] = useState(false);
  const [inlinePreviewLoading, setInlinePreviewLoading] = useState(false);
  const [inlinePreviewMeals, setInlinePreviewMeals] = useState<ScheduledMeal[]>([]);

  const [selectedMeal, setSelectedMeal] = useState<ScheduledMeal | null>(null);
  const [showMealSheet, setShowMealSheet] = useState(false);

  const [showTimeSlotDialog, setShowTimeSlotDialog] = useState(false);
  const [showModifyModal, setShowModifyModal] = useState(false);
  const [selectedScheduleForTimeSlot, setSelectedScheduleForTimeSlot] = useState<string | null>(null);
  const [togglingMealId, setTogglingMealId] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  useEffect(() => {
    if (profile && !profile.onboarding_completed) {
      navigate("/onboarding");
    }
  }, [profile, navigate]);

  const fetchSchedules = useCallback(async () => {
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
        delivery_time_slot,
        order_status
      `)
      .eq("user_id", user.id)
      .gte("scheduled_date", format(currentWeekStart, "yyyy-MM-dd"))
      .lte("scheduled_date", format(weekEnd, "yyyy-MM-dd"))
      .neq("order_status", "cancelled")
      .order("scheduled_date", { ascending: true });

    if (schedulesError) {
      console.error("Error fetching schedules:", schedulesError);
      setLoading(false);
      return;
    }

    const mealIds = (schedulesData || []).map((s: { meal_id: string | null }) => s.meal_id).filter(Boolean);
    let mealsMap: Record<string, { id: string; name: string; calories: number; protein_g: number; carbs_g: number; fat_g: number; image_url: string | null }> = {};

    if (mealIds.length > 0) {
      const { data: mealsData } = await supabase
        .from("meals")
        .select("id, name, calories, protein_g, carbs_g, fat_g, image_url")
        .in("id", mealIds);

      mealsMap = (mealsData || []).reduce((acc: Record<string, { id: string; name: string; calories: number; protein_g: number; carbs_g: number; fat_g: number; image_url: string | null }>, meal) => {
        acc[meal.id] = meal;
        return acc;
      }, {});
    }

    const mergedSchedules: ScheduledMeal[] = (schedulesData || []).map((schedule) => ({
      id: schedule.id,
      scheduled_date: schedule.scheduled_date,
      meal_type: schedule.meal_type,
      is_completed: schedule.is_completed,
      delivery_time_slot: schedule.delivery_time_slot || null,
      order_status: schedule.order_status || "pending",
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
  }, [user, currentWeekStart, t]);

  useEffect(() => {
    if (settings.features.meal_scheduling) {
      fetchSchedules();
    } else if (!settingsLoading) {
      setLoading(false);
    }
  }, [fetchSchedules, settings.features.meal_scheduling, settingsLoading]);

  const prevShowWizard = useRef(false);
  useEffect(() => {
    if (!showWizard && prevShowWizard.current && settings.features.meal_scheduling) {
      fetchSchedules();
    }
    prevShowWizard.current = showWizard;
  }, [showWizard, fetchSchedules, settings.features.meal_scheduling]);

  const toggleMealCompletion = async (scheduleId: string, isCompleted: boolean, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const schedule = schedules.find(s => s.id === scheduleId);
    if (!schedule || !user) return;

    setTogglingMealId(scheduleId);

    try {
      const { data, error } = isCompleted
        ? await supabase.rpc('uncomplete_meal_atomic', {
            p_schedule_id: scheduleId,
            p_user_id: user.id,
            p_log_date: schedule.scheduled_date,
          })
        : await supabase.rpc('complete_meal_atomic', {
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

      window.dispatchEvent(new CustomEvent("nutrio:meal-progress-changed"));

      if (!isCompleted && !result.was_already_completed) {
        if (navigator.vibrate) navigator.vibrate(10);
      }
    } catch (err) {
      console.error('Error toggling meal completion:', err);
      toast({
        title: t("error"),
        description: err.message || t("failed_update_status"),
        variant: "destructive"
      });
    } finally {
      setTogglingMealId(null);
    }
  };

  const deleteMeal = async (scheduleId: string) => {
    const scheduleToDelete = schedules.find(s => s.id === scheduleId);

    try {
      const { data, error } = await supabase.rpc("cancel_meal_schedule", {
        p_schedule_id: scheduleId,
      });

      if (error) {
        console.error("Cancel error:", error);
        toast({
          title: t("error"),
          description: error.message || t("failed_to_remove_meal"),
          variant: "destructive"
        });
        return;
      }

      const result = data as { success?: boolean; error?: string; refunded_addons?: number };
      if (!result?.success) {
        toast({
          title: t("error"),
          description: result?.error || t("failed_to_remove_meal"),
          variant: "destructive"
        });
        return;
      }

      trackEvent("meal_schedule_cancelled", {
        meal_id: scheduleToDelete?.meal?.id,
        meal_name: scheduleToDelete?.meal?.name,
        meal_type: scheduleToDelete?.meal_type,
        scheduled_date: scheduleToDelete?.scheduled_date,
        had_addons: (result.refunded_addons || 0) > 0,
        addon_amount: result.refunded_addons || 0,
      });

      setSchedules(prev => prev.filter(s => s.id !== scheduleId));
      setShowMealSheet(false);
      refetchSubscription();
      toast({
        title: t("meal_removed"),
        description: t("meal_removed_desc") || "Meal removed and credit refunded."
      });
    } catch (err) {
      console.error("Delete meal error:", err);
      toast({
        title: t("error"),
        description: err.message || t("failed_to_remove_meal"),
        variant: "destructive"
      });
    }
  };

  const updateDeliveryTimeSlot = async (scheduleId: string, timeSlot: string) => {
    try {
      const { error } = await supabase
        .from("meal_schedules")
        .update({ delivery_time_slot: timeSlot } as Record<string, unknown>)
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
    setWizardAutoFill(false);
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
      <div className="min-h-screen pb-24 bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-black">
        <div className="sticky top-0 z-10 bg-white/80 dark:bg-gray-900/80 backdrop-blur-2xl border-b border-gray-100 dark:border-gray-800 safe-top">
          <div className="flex items-center justify-between px-5 h-16 max-w-lg mx-auto">
            <button
              onClick={() => navigate("/dashboard")}
              className="w-11 h-11 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center active:scale-95 transition-all cursor-pointer"
            >
              <ChevronLeft className="h-5 w-5 text-gray-600 dark:text-gray-300" />
            </button>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">{t("schedule")}</h1>
            <div className="w-11" />
          </div>
        </div>
        <div className="flex flex-col items-center justify-center min-h-[70vh] px-6">
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 flex items-center justify-center mb-6 shadow-xl shadow-amber-500/10">
            <AlertTriangle className="h-12 w-12 text-amber-500" />
          </div>
          <h2 className="text-2xl font-bold mb-3 text-gray-900 dark:text-white">{t("scheduling_unavailable")}</h2>
          <p className="text-muted-foreground text-center text-sm mb-8 max-w-xs leading-relaxed">{t("scheduling_disabled_desc")}</p>
          <Button
            onClick={() => navigate("/dashboard")}
            className="rounded-2xl px-8 h-14 text-base font-semibold bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-lg shadow-emerald-500/25 cursor-pointer"
          >
            {t("go_back")}
          </Button>
        </div>
        <GuestLoginPrompt
          open={showLoginPrompt}
          onOpenChange={setShowLoginPrompt}
          title={loginPromptConfig.title}
          description={loginPromptConfig.description}
          actionLabel={loginPromptConfig.actionLabel}
          signUpLabel={loginPromptConfig.signUpLabel}
        />
      </div>
    );
  }

  const weekProgressPct = weekProgress.total > 0 ? Math.round((weekProgress.completed / weekProgress.total) * 100) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-black dark:to-gray-900">
      {/* ── Native iOS/Android Header ───────────────────────────── */}
      <div className="sticky top-0 z-20 bg-white/90 dark:bg-gray-900/90 backdrop-blur-2xl border-b border-gray-100/80 dark:border-gray-800/80 safe-top">
        <div className="max-w-lg mx-auto px-4 pt-2 pb-3">
          {/* Header Row */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => navigate("/dashboard")}
              className="w-11 h-11 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center active:scale-95 transition-all cursor-pointer"
            >
              <ChevronLeft className="h-5 w-5 text-gray-600 dark:text-gray-300" />
            </button>

            <div className="text-center">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">{t("my_schedule")}</h1>
              <p className="text-xs text-gray-400 font-medium">
                {format(currentWeekStart, "MMM d")} — {format(addDays(currentWeekStart, 6), "MMM d, yyyy")}
              </p>
            </div>

            {/* Meal Credits Badge */}
            {hasActiveSubscription && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-bold ${
                  isUnlimited
                    ? "bg-gradient-to-r from-emerald-400 to-teal-500 text-white shadow-lg shadow-emerald-500/30"
                    : remainingMeals <= 0
                    ? "bg-gradient-to-r from-red-400 to-rose-500 text-white shadow-lg shadow-red-500/30"
                    : remainingMeals <= 3
                    ? "bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-500/30"
                    : "bg-gradient-to-r from-emerald-400 to-teal-500 text-white shadow-lg shadow-emerald-500/30"
                }`}
              >
                {isUnlimited ? (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Unlimited</span>
                  </>
                ) : (
                  <>
                    <Utensils className="h-3.5 w-3.5" />
                    <span>{remainingMeals}</span>
                  </>
                )}
              </motion.div>
            )}
          </div>

          {/* Week Navigator - iOS Style */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentWeekStart(prev => subWeeks(prev, 1))}
              className="w-10 h-10 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center active:scale-95 transition-all cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4 text-gray-500" />
            </button>

            <div className="flex-1 flex justify-between px-1">
              {weekDays.map((day, index) => {
                const isSelected = isSameDay(day, selectedDate);
                const isTodayDate = isToday(day);
                const dayStatus = getDayStatus(day);
                return (
                  <motion.button
                    key={day.toISOString()}
                    onClick={() => setSelectedDate(day)}
                    whileTap={{ scale: 0.85 }}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className={`flex flex-col items-center justify-center w-10 h-[68px] rounded-2xl transition-all cursor-pointer relative overflow-hidden ${
                      isSelected
                        ? "bg-gradient-to-b from-emerald-400 to-teal-500 shadow-lg shadow-emerald-500/30"
                        : isTodayDate
                        ? "bg-gray-100 dark:bg-gray-800 ring-2 ring-emerald-400/50"
                        : "bg-transparent active:bg-gray-50 dark:active:bg-gray-800/50"
                    }`}
                  >
                    {isSelected && (
                      <motion.div
                        layoutId="selectedDayBg"
                        className="absolute inset-0 bg-gradient-to-b from-emerald-400 to-teal-500"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                      />
                    )}
                    <span className={`text-[10px] font-semibold mb-1 relative z-10 ${
                      isSelected ? "text-white/80" : "text-gray-400"
                    }`}>
                      {DAYS[day.getDay()]}
                    </span>
                    <span className={`text-base font-bold relative z-10 ${
                      isSelected ? "text-white" : isTodayDate ? "text-emerald-500" : "text-gray-700 dark:text-gray-200"
                    }`}>
                      {format(day, "d")}
                    </span>
                    {dayStatus === "completed" && !isSelected && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="flex items-center gap-0.5 mt-1 relative z-10"
                      >
                        <Check className="w-2 h-2 text-emerald-500" />
                      </motion.div>
                    )}
                    {dayStatus === "partial" && !isSelected && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="flex items-center gap-0.5 mt-1 relative z-10"
                      >
                        <span className="w-2 h-0.5 rounded-full bg-amber-400" />
                      </motion.div>
                    )}
                  </motion.button>
                );
              })}
            </div>

            <button
              onClick={() => setCurrentWeekStart(prev => addWeeks(prev, 1))}
              className="w-10 h-10 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center active:scale-95 transition-all cursor-pointer"
            >
              <ChevronRight className="h-4 w-4 text-gray-500" />
            </button>
          </div>

          {/* Jump to Today */}
          {!isToday(selectedDate) && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={() => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                setSelectedDate(today);
                setCurrentWeekStart(startOfWeek(today, { weekStartsOn: 1 }));
              }}
              className="mt-2 w-full flex items-center justify-center gap-1.5 py-2 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-xs font-bold active:scale-95 transition-all cursor-pointer border border-emerald-200 dark:border-emerald-800"
            >
              <CalendarIcon className="h-3.5 w-3.5" />
              Jump to Today
            </motion.button>
          )}
        </div>
      </div>

      {/* ── Content Area ─────────────────────────────── */}
      <div className="max-w-lg mx-auto px-4 pb-32">

        {/* ── Date Hero Card ─────────────────────────────── */}
        <motion.div
          key={selectedDate.toISOString()}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 mb-5"
        >
          <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 dark:from-gray-800 dark:via-gray-900 dark:to-black rounded-3xl p-5 shadow-xl">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-1">
                  {isToday(selectedDate) ? "Today" : format(selectedDate, "EEEE")}
                </p>
                <h2 className="text-2xl font-black text-white">
                  {isToday(selectedDate) ? t("today_meals") : format(selectedDate, "EEEE, MMMM d")}
                </h2>
              </div>
              {dailyNutrition.total > 0 && (
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-3 py-2">
                  <p className="text-white text-xs font-medium opacity-70">Total</p>
                  <p className="text-white text-lg font-black">{dailyNutrition.calories.toLocaleString()}</p>
                </div>
              )}
            </div>

            {/* Nutrition Pills */}
            {dailyNutrition.total > 0 ? (
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm rounded-xl px-3 py-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span className="text-white text-sm font-semibold">{dailyNutrition.completed}/{dailyNutrition.total} meals</span>
                </div>
                <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm rounded-xl px-3 py-2">
                  <Flame className="h-4 w-4 text-amber-400" />
                  <span className="text-white text-sm font-semibold">{dailyNutrition.calories.toLocaleString()} kcal</span>
                </div>
                <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm rounded-xl px-3 py-2">
                  <Beef className="h-4 w-4 text-rose-400" />
                  <span className="text-white text-sm font-semibold">{dailyNutrition.protein.toFixed(0)}g protein</span>
                </div>
              </div>
            ) : (
              <p className="text-white/60 text-sm font-medium">No meals scheduled</p>
            )}
          </div>
        </motion.div>

        {/* ── Weekly Stats ─────────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">Weekly Progress</span>
            <span className="text-lg font-black text-gradient bg-gradient-to-r from-emerald-400 to-teal-500">{weekProgressPct}%</span>
          </div>

          <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden shadow-inner">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${weekProgressPct}%` }}
              transition={{ duration: 0.8, type: "spring", bounce: 0.3 }}
              className="h-full bg-gradient-to-r from-emerald-400 via-teal-500 to-emerald-400 rounded-full relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
            </motion.div>
          </div>

          <div className="flex items-center justify-between mt-3 px-1">
            <div className="flex items-center gap-1.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              </div>
              <p className="text-sm font-bold text-gray-700 dark:text-gray-200">{weekProgress.completed}</p>
              <p className="text-xs text-gray-400">completed</p>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center">
                <Flame className="h-3.5 w-3.5 text-amber-500" />
              </div>
              <p className="text-sm font-bold text-gray-700 dark:text-gray-200">{weekProgress.calories.toLocaleString()}</p>
              <p className="text-xs text-gray-400">kcal</p>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                <Utensils className="h-3.5 w-3.5 text-blue-500" />
              </div>
              <p className="text-sm font-bold text-gray-700 dark:text-gray-200">{weekProgress.total}</p>
              <p className="text-xs text-gray-400">meals</p>
            </div>
          </div>
        </div>

        {/* ── Quick Add Banner ─────────────────────────── */}
        {displayMeals.length === 0 && hasActiveSubscription && !isUnlimited && remainingMeals <= 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4"
          >
            <button
              onClick={() => setShowBuyCredit(true)}
              className="w-full flex items-center gap-3 p-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/50 dark:to-orange-950/50 border border-amber-200 dark:border-amber-800 rounded-2xl active:scale-[0.98] transition-all cursor-pointer"
            >
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
                <Wallet className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-bold text-gray-900 dark:text-white">Out of meal credits</p>
                <p className="text-xs text-gray-500">Tap to buy extra credits</p>
              </div>
              <ChevronRight className="h-5 w-5 text-gray-400" />
            </button>
          </motion.div>
        )}

        {/* ── Meals List ──────────────────────────────── */}
        {loading ? (
          <div className="space-y-3 pt-2">
            {/* Skeleton cards for each meal type */}
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white dark:bg-gray-900 rounded-3xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-800"
              >
                <div className="flex items-center gap-3 p-4 pl-5 animate-pulse">
                  <div className="w-[72px] h-[72px] rounded-2xl bg-gray-200 dark:bg-gray-700" />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded-full" />
                      <div className="h-3 w-3 bg-gray-200 dark:bg-gray-700 rounded-full" />
                      <div className="h-3 w-14 bg-gray-200 dark:bg-gray-700 rounded-full" />
                    </div>
                    <div className="h-4 w-40 bg-gray-200 dark:bg-gray-700 rounded-full" />
                    <div className="flex items-center gap-2">
                      <div className="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded-lg" />
                      <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded-full" />
                    </div>
                  </div>
                  <div className="w-14 h-14 rounded-2xl bg-gray-200 dark:bg-gray-700" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {MEAL_TYPES.map((mealType, typeIndex) => {
              const config = MEAL_TYPE_CONFIG[mealType];
              const MealIcon = config.icon;
              const typeMeals = displayMeals.filter(m => m.meal_type === mealType);
              const timeLabel = MEAL_TYPE_TIMES[mealType];
               const mealTypeName = t(mealType);
              const noMealsLeft = hasActiveSubscription && !isUnlimited && remainingMeals <= 0;

              if (typeMeals.length > 0) {
                return typeMeals.map((schedule, mealIndex) => (
                  <motion.div
                    key={schedule.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: typeIndex * 0.05 + mealIndex * 0.05 }}
                    onClick={() => { setSelectedMeal(schedule); setShowMealSheet(true); }}
                    className={`group relative bg-white dark:bg-gray-900 rounded-3xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-800 active:scale-[0.98] transition-all cursor-pointer ${
                      schedule.is_completed ? "ring-2 ring-emerald-400/30" : ""
                    }`}
                  >
                    {/* Colored accent bar */}
                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b ${config.gradient}`} />

                    <div className="flex items-center gap-3 p-4 pl-5">
                      {/* Meal Image */}
                      {schedule.meal?.image_url ? (
                        <div className="relative">
                          <img
                            src={schedule.meal.image_url}
                            alt={schedule.meal.name}
                            className={`w-18 h-18 rounded-2xl object-cover shadow-md transition-all ${
                              schedule.is_completed ? "opacity-60 grayscale" : ""
                            }`}
                            style={{ width: 72, height: 72 }}
                          />
                          {schedule.is_completed && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg">
                                <Check className="h-4 w-4 text-white" />
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className={`w-18 h-18 rounded-2xl flex items-center justify-center shadow-md ${config.bgGradient} ${
                          schedule.is_completed ? "opacity-60" : ""
                        }`}>
                          <MealIcon className={`h-8 w-8 ${config.textColor}`} />
                          {schedule.is_completed && (
                            <div className="absolute">
                              <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg">
                                <Check className="h-4 w-4 text-white" />
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-bold uppercase tracking-wider ${config.textColor}`}>
                            {mealTypeName}
                          </span>
                          <span className="text-[10px] text-gray-300">·</span>
                          <span className="text-[10px] text-gray-400 font-medium flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {schedule.delivery_time_slot || timeLabel}
                          </span>
                        </div>
                        <h3 className={`text-base font-bold text-gray-900 dark:text-white truncate mb-1 ${
                          schedule.is_completed ? "line-through text-gray-400" : ""
                        }`}>
                          {schedule.meal?.name}
                        </h3>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-lg ${config.bgGradient} ${config.textColor}`}>
                            {schedule.meal.calories} kcal
                          </span>
                          <span className="text-xs text-gray-400 font-medium">{schedule.meal.protein_g}g protein</span>
                        </div>
                      </div>

                      {/* Completion Toggle */}
                      <motion.button
                        onClick={(e) => toggleMealCompletion(schedule.id, schedule.is_completed, e)}
                        whileTap={{ scale: 0.9 }}
                        disabled={togglingMealId === schedule.id}
                        className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-all ${
                          schedule.is_completed
                            ? "bg-gradient-to-br from-emerald-400 to-teal-500 shadow-lg shadow-emerald-500/30"
                            : "bg-gray-50 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 active:bg-emerald-50"
                        } disabled:opacity-60`}
                      >
                        {togglingMealId === schedule.id ? (
                          <Loader2 className="h-5 w-5 text-white animate-spin" />
                        ) : schedule.is_completed ? (
                          <Check className="h-6 w-6 text-white" />
                        ) : (
                          <Circle className="h-6 w-6 text-gray-300" />
                        )}
                      </motion.button>
                    </div>
                  </motion.div>
                ));
              }

              /* ── Empty Slot Card ─── */
              const EmptySlotCard = () => {
                const [swipeX, setSwipeX] = useState(0);
                const hasTriggered = useRef(false);

                const handleDrag = (_: DragEvent, info: PanInfo) => {
                  if (!info.offset) return;
                  if (info.offset.x < 0) {
                    setSwipeX(Math.max(info.offset.x, -80));
                  } else {
                    setSwipeX(Math.min(Math.max(info.offset.x, 0), 80));
                  }
                };

                const handleDragEnd = (_: DragEvent, info: PanInfo) => {
                  if (!info.offset) {
                    setSwipeX(0);
                    return;
                  }
                  if (info.offset.x > 60 && !hasTriggered.current) {
                    hasTriggered.current = true;
                    setSwipeX(0);
                    if (!user) {
                      promptLogin({
                        title: t("sign_in_to_schedule"),
                        description: t("sign_in_to_schedule_desc"),
                        actionLabel: t("sign_in"),
                        signUpLabel: t("create_free_account"),
                      });
                    } else if (!noMealsLeft) {
                      openWizard(mealType);
                    }
                  } else if (info.offset.x < -60 && !hasTriggered.current) {
                    hasTriggered.current = true;
                    setSwipeX(0);
                    if (!user) {
                      promptLogin({
                        title: t("sign_in_to_schedule"),
                        description: t("sign_in_to_schedule_desc"),
                        actionLabel: t("sign_in"),
                        signUpLabel: t("create_free_account"),
                      });
                    } else if (!noMealsLeft) {
                      setWizardAutoFill(true);
                      setShowWizard(true);
                    }
                  } else {
                    setSwipeX(0);
                  }
                  setTimeout(() => { hasTriggered.current = false; }, 300);
                };

                return (
                  <div className="relative overflow-hidden rounded-2xl">
                    {/* Swipe hint - only visible when idle, hidden after first full swipe */}
                    {!hasTriggered.current && swipeX === 0 && typeIndex === 0 && (
                      <div className="absolute inset-0 flex items-center justify-end pr-4 pointer-events-none">
                        <motion.div
                          initial={{ opacity: 0.3 }}
                          animate={{ opacity: [0.3, 0.6, 0.3] }}
                          transition={{ repeat: Infinity, duration: 2 }}
                          className="flex items-center gap-0.5"
                        >
                          <ChevronRight className="h-4 w-4 text-gray-300" />
                          <ChevronRight className="h-4 w-4 text-gray-200 -ml-2" />
                        </motion.div>
                      </div>
                    )}
                    {/* Left swipe hint (AI Fill) */}
                    {!hasTriggered.current && swipeX === 0 && typeIndex === 0 && (
                      <div className="absolute inset-0 flex items-center justify-start pl-4 pointer-events-none">
                        <motion.div
                          initial={{ opacity: 0.3 }}
                          animate={{ opacity: [0.3, 0.6, 0.3] }}
                          transition={{ repeat: Infinity, duration: 2, delay: 1 }}
                          className="flex items-center gap-0.5"
                        >
                          <ChevronLeft className="h-4 w-4 text-gray-300 -mr-2" />
                          <ChevronLeft className="h-4 w-4 text-gray-200" />
                        </motion.div>
                      </div>
                    )}

                    {/* Swipe Actions Background */}
                    <div className="absolute inset-0 flex items-center justify-between px-4">
                      <motion.div
                        animate={{ x: swipeX > 20 ? 0 : -80 }}
                        className="w-16 h-full flex items-center justify-center rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-500"
                      >
                        <div className="flex flex-col items-center">
                          <Plus className="h-5 w-5 text-white" />
                          <span className="text-[10px] text-white font-bold mt-0.5">Add</span>
                        </div>
                      </motion.div>

                      <motion.div
                        animate={{ x: swipeX < -20 ? 0 : 80 }}
                        className="w-16 h-full flex items-center justify-center rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500"
                      >
                        <div className="flex flex-col items-center">
                          <Zap className="h-5 w-5 text-white" />
                          <span className="text-[10px] text-white font-bold mt-0.5">AI Fill</span>
                        </div>
                      </motion.div>
                    </div>

                    {/* Main Card */}
                    <motion.div
                      drag="x"
                      dragConstraints={{ left: -100, right: 100 }}
                      dragElastic={0.15}
                      onDrag={handleDrag}
                      onDragEnd={handleDragEnd}
                      animate={{ x: swipeX }}
                      transition={{ type: "spring", stiffness: 400, damping: 35 }}
                      className={`relative bg-white dark:bg-gray-900 border-2 ${
                        noMealsLeft
                          ? "border-amber-200 dark:border-amber-800"
                          : "border-dashed border-gray-200 dark:border-gray-700"
                      }`}
                    >
                      <div className="flex items-center gap-3 p-4">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${config.bgGradient}`}>
                          <MealIcon className={`h-6 w-6 ${config.textColor}`} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <span className={`text-[11px] font-bold uppercase tracking-wider ${config.textColor} opacity-70`}>
                            {mealTypeName}
                          </span>
                          <p className="text-sm text-gray-400 font-medium flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {timeLabel}
                          </p>
                        </div>

                        {noMealsLeft ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowBuyCredit(true);
                            }}
                            className="flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-xs font-bold rounded-2xl active:scale-95 transition-all shadow-lg shadow-amber-500/25 cursor-pointer"
                          >
                            <Wallet className="h-4 w-4" />
                            Buy Credits
                          </button>
                        ) : (
                          <div className="w-10 h-10 rounded-2xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center">
                            <UtensilsCrossed className="h-4 w-4 text-gray-300" />
                          </div>
                        )}
                      </div>
                    </motion.div>
                  </div>
                );
              };

              return (
                <motion.div
                  key={`empty-${mealType}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: typeIndex * 0.05 }}
                >
                  <EmptySlotCard />
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Meal Wizard ─────────────────────────────── */}
      <AnimatePresence>
        {showWizard && user && (
          <MealWizard
            userId={user.id}
            selectedDate={selectedDate}
            initialStep={wizardInitialStep}
            autoFill={wizardAutoFill}
            onComplete={() => { setShowWizard(false); setWizardAutoFill(false); fetchSchedules(); }}
            onCancel={() => { setShowWizard(false); setWizardAutoFill(false); }}
          />
        )}
      </AnimatePresence>

      {/* ── Meal Detail Bottom Sheet ──────────────────── */}
      <AnimatePresence>
        {showMealSheet && selectedMeal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMealSheet(false)}
              className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed left-0 right-0 bg-white dark:bg-gray-900 rounded-t-3xl z-50 max-h-[90vh] overflow-y-auto safe-bottom"
              style={{ bottom: "max(24px, env(safe-area-inset-bottom))" }}
            >
              {/* Drag Handle */}
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
              </div>

              <div className="p-6" style={{ paddingBottom: "max(112px, calc(env(safe-area-inset-bottom) + 24px))" }}>
                {/* Header */}
                <div className="flex items-start justify-between mb-5">
                  <div className="flex-1 min-w-0">
                    {(() => {
                      const cfg = MEAL_TYPE_CONFIG[selectedMeal.meal_type as keyof typeof MEAL_TYPE_CONFIG];
                      const Icon = cfg.icon;
                      return (
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold mb-3 ${cfg.bgGradient} ${cfg.textColor}`}>
                          <Icon className="h-3.5 w-3.5" />
                          {t(cfg.label)}
                        </span>
                      );
                    })()}
                    <h2 className="text-2xl font-black text-gray-900 dark:text-white leading-tight">{selectedMeal.meal.name}</h2>
                  </div>
                  <button
                    onClick={() => setShowMealSheet(false)}
                    className="w-11 h-11 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0 ml-3 cursor-pointer active:scale-95 transition-all"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Hero Image */}
                {selectedMeal.meal.image_url ? (
                  <motion.img
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    src={selectedMeal.meal.image_url}
                    alt={selectedMeal.meal.name}
                    className="w-full h-52 object-cover rounded-3xl mb-6 shadow-xl"
                  />
                ) : (
                  <div className="w-full h-52 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 rounded-3xl flex items-center justify-center mb-6">
                    {(() => {
                      const cfg = MEAL_TYPE_CONFIG[selectedMeal.meal_type as keyof typeof MEAL_TYPE_CONFIG];
                      const Icon = cfg.icon;
                      return <Icon className="h-16 w-16 text-gray-400" />;
                    })()}
                  </div>
                )}

                {/* Nutrition Grid */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/30 dark:to-orange-900/30 rounded-2xl p-4 text-center border border-amber-100 dark:border-amber-800/50"
                  >
                    <Flame className="h-5 w-5 text-amber-500 mx-auto mb-1" />
                    <p className="text-xl font-black text-gray-900 dark:text-white">{selectedMeal.meal.calories}</p>
                    <p className="text-[10px] text-amber-500 font-semibold uppercase tracking-wide">Calories</p>
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-900/30 dark:to-pink-900/30 rounded-2xl p-4 text-center border border-rose-100 dark:border-rose-800/50"
                  >
                    <Beef className="h-5 w-5 text-rose-500 mx-auto mb-1" />
                    <p className="text-xl font-black text-gray-900 dark:text-white">{selectedMeal.meal.protein_g}g</p>
                    <p className="text-[10px] text-rose-500 font-semibold uppercase tracking-wide">Protein</p>
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/30 dark:to-cyan-900/30 rounded-2xl p-4 text-center border border-blue-100 dark:border-blue-800/50"
                  >
                    <Leaf className="h-5 w-5 text-blue-500 mx-auto mb-1" />
                    <p className="text-xl font-black text-gray-900 dark:text-white">{selectedMeal.meal.carbs_g}g</p>
                    <p className="text-[10px] text-blue-500 font-semibold uppercase tracking-wide">Carbs</p>
                  </motion.div>
                </div>

                {/* Delivery Time */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-4 mb-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
                        <Clock className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Delivery Time</p>
                        <p className="text-sm font-bold text-gray-900 dark:text-white">
                          {selectedMeal.delivery_time_slot || "Not scheduled"}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleOpenTimeSlotSelector(selectedMeal.id)}
                      className="px-4 py-2.5 rounded-xl bg-white dark:bg-gray-900 text-emerald-600 text-xs font-bold active:scale-95 transition-all shadow-sm cursor-pointer border border-emerald-100 dark:border-emerald-800"
                    >
                      Change
                    </button>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-3">
                  {/* Primary: Mark Complete */}
                  <motion.button
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                    disabled={togglingMealId === selectedMeal.id}
                    onClick={() => { toggleMealCompletion(selectedMeal.id, selectedMeal.is_completed); setShowMealSheet(false); }}
                    className={`w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60 ${
                      selectedMeal.is_completed
                        ? "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                        : "bg-gradient-to-r from-emerald-400 to-teal-500 text-white shadow-xl shadow-emerald-500/25"
                    }`}
                  >
                    {togglingMealId === selectedMeal.id ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : selectedMeal.is_completed ? (
                      <>
                        <Circle className="h-5 w-5" />
                        Mark as Incomplete
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-5 w-5" />
                        Mark as Completed
                      </>
                    )}
                  </motion.button>

                  {/* Secondary: View Details + Reschedule */}
                  <div className="flex gap-3">
                    <motion.button
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      onClick={() => navigate(`/meals/${selectedMeal.meal.id}`)}
                      className="flex-1 py-4 rounded-2xl font-bold text-sm bg-gradient-to-r from-gray-900 to-gray-800 dark:from-gray-800 dark:to-gray-700 text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-xl"
                    >
                      <Utensils className="h-4 w-4" />
                      Details
                    </motion.button>
                    <motion.button
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.35 }}
                      onClick={() => { setShowMealSheet(false); setShowModifyModal(true); }}
                      className="flex-1 py-4 rounded-2xl font-bold text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                    >
                      <CalendarIcon className="h-4 w-4" />
                      Reschedule
                    </motion.button>
                  </div>

                  {/* Tertiary: Remove */}
                  <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    onClick={() => { setDeleteTargetId(selectedMeal.id); setDeleteConfirmOpen(true); }}
                    className="w-full py-3 rounded-2xl text-sm font-semibold text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                  >
                    <Trash2 className="h-4 w-4" />
                    Remove from Schedule
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Delivery Scheduler Dialog ─────────────────── */}
      <Dialog open={showTimeSlotDialog} onOpenChange={setShowTimeSlotDialog}>
        <DialogContent className="sm:max-w-md rounded-3xl p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Clock className="h-5 w-5 text-emerald-500" />
              {t("schedule_delivery")}
            </DialogTitle>
          </DialogHeader>
          <DeliveryScheduler
            initialDate={selectedDate}
            timeSlots={["7:00 AM", "8:00 AM", "9:00 AM", "11:00 AM", "12:00 PM", "1:00 PM", "5:00 PM", "6:00 PM", "7:00 PM"]}
            timeZone="Qatar (GMT +3)"
            onSchedule={handleTimeSlotSelect}
            onCancel={() => setShowTimeSlotDialog(false)}
          />
        </DialogContent>
      </Dialog>

      {/* ── Buy Meal Credit Dialog ────────────────────── */}
      <Dialog open={showBuyCredit} onOpenChange={setShowBuyCredit}>
        <DialogContent className="max-w-sm rounded-3xl p-0 overflow-hidden mx-4">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 flex items-center justify-center shrink-0">
                <Wallet className="w-7 h-7 text-amber-600" />
              </div>
              <div>
                <h3 className="text-lg font-black text-gray-900 dark:text-white">Buy Extra Meal</h3>
                <p className="text-xs text-gray-400 font-medium">Add 1 credit to your plan</p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 space-y-3 mb-5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Price per credit</span>
                <span className="font-bold text-amber-600 text-lg">{formatCurrency(pricePerMeal)}</span>
              </div>
              <div className="h-px bg-amber-200/50" />
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Your wallet balance</span>
                <span className={`font-bold ${(wallet?.balance || 0) >= pricePerMeal ? "text-emerald-600" : "text-red-500"}`}>
                  {formatCurrency(wallet?.balance || 0)}
                </span>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowBuyCredit(false)}
                className="flex-1 h-12 rounded-2xl font-semibold cursor-pointer"
              >
                Cancel
              </Button>
              {(wallet?.balance || 0) < pricePerMeal ? (
                <Button
                  onClick={() => navigate("/wallet")}
                  className="flex-1 h-12 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white rounded-2xl font-semibold shadow-lg shadow-amber-500/25 cursor-pointer"
                >
                  Top Up Wallet
                </Button>
              ) : (
                <Button
                  onClick={handleBuyMealCredit}
                  disabled={buyLoading}
                  className="flex-1 h-12 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white rounded-2xl font-semibold shadow-lg shadow-amber-500/25 cursor-pointer"
                >
                  {buyLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : `Pay ${formatCurrency(pricePerMeal)}`}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Guest Login Prompt ─────────────────────── */}
      <GuestLoginPrompt
        open={showLoginPrompt}
        onOpenChange={setShowLoginPrompt}
        title={loginPromptConfig.title}
        description={loginPromptConfig.description}
        actionLabel={loginPromptConfig.actionLabel}
        signUpLabel={loginPromptConfig.signUpLabel}
      />

      {/* ── Delete Confirmation Dialog ──────────────── */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-100 to-rose-100 dark:from-red-900/30 dark:to-rose-900/30 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <AlertDialogTitle className="text-lg font-black">{t("cancel_meal") || "Remove Meal"}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t("cancel_meal_confirm") || "Are you sure you want to remove this meal from your schedule? Your meal credit will be refunded."}
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 sm:gap-2">
            <AlertDialogCancel className="flex-1 h-12 rounded-2xl font-semibold cursor-pointer">
              {t("keep_meal") || "Keep Meal"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (deleteTargetId) deleteMeal(deleteTargetId); setDeleteTargetId(null); }}
              className="flex-1 h-12 bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white rounded-2xl font-semibold cursor-pointer"
            >
              {t("remove") || "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Reschedule Meal Modal ────────────────────── */}
      <ModifyOrderModal
        isOpen={showModifyModal}
        onClose={() => setShowModifyModal(false)}
        schedule={selectedMeal}
        onModified={() => { fetchSchedules(); setShowModifyModal(false); }}
      />

      {/* ── Styles ─────────────────────────────────── */}
      <style>{`
        .safe-top {
          padding-top: env(safe-area-inset-top, 0px);
        }
        .safe-bottom {
          padding-bottom: env(safe-area-inset-bottom, 0px);
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
        .text-gradient {
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
      `}</style>
    </div>
  );
};

export default Schedule;