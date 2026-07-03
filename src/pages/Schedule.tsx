import { getNavArrows } from "@/lib/rtl";
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";
import { useSubscription } from "@/hooks/useSubscription";
import { useNutritionGoals } from "@/hooks/useNutritionGoals";
import { useWallet } from "@/hooks/useWallet";
import { formatCurrency } from "@/lib/currency";
import { findCoachMealSuggestion, getCoachMealScheduleFields } from "@/lib/coach-meal-schedule";
import { syncCommunityChallengeProgressQuietly } from "@/lib/community-challenge-service";
import { calculateGoalAlignmentScore } from "@/lib/goal-engine";
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
  AlertTriangle,
  Circle,
  Coffee,
  Sun,
  Moon,
  Apple,
  Loader2,
  Check,
  CalendarPlus,
  Clock,
  Flame,
  Beef,
  Sparkles,
  Wallet,
  ArrowLeft, ChevronLeft,
  ArrowRight,
  X,
  Utensils,
} from "lucide-react";
import { format, startOfWeek, addDays, isSameDay, parseISO } from "date-fns";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import MealWizard from "@/components/MealWizard";
import { ModifyOrderModal } from "@/components/ModifyOrderModal";
import { useLanguage } from "@/contexts/LanguageContext";
import EmptyMealSlot from "@/components/schedule/EmptyMealSlot";
import ScheduleHeader from "@/components/schedule/ScheduleHeader";
import WeeklyProgressBar from "@/components/schedule/WeeklyProgressBar";
import MealDetailSheet from "@/components/schedule/MealDetailSheet";
import LogMealModal from "@/components/LogMealModal";
import { MealPlanGenerator } from "@/components/meal/MealPlanGenerator";
import { SmartSubstitutionBanner } from "@/components/meal/SmartSubstitutionBanner";
import { useSmartSubstitutions } from "@/hooks/useSmartSubstitutions";

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

interface ComboMeal {
  id: string;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  image_url: string | null;
  meal_type: string | null;
  restaurant_id: string | null;
}

const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;

const MEAL_TYPE_CONFIG = {
  breakfast: {
    icon: Coffee,
    label: "breakfast",
    gradient: "from-[#F97316] to-[#FB6B7A]",
    bgGradient: "bg-[#FFF7ED]",
    textColor: "text-[#F97316]",
    bgColor: "bg-[#FFF7ED]",
    borderColor: "border-[#F97316]/20",
    ringColor: "ring-[#F97316]",
    shadowColor: "shadow-[#F97316]/20",
    nutritionBg: "bg-[#FFF7ED]",
    nutritionBorder: "border-[#F97316]/20",
  },
  lunch: {
    icon: Sun,
    label: "lunch",
    gradient: "from-[#22C7A1] to-[#38BDF8]",
    bgGradient: "bg-[#EFFFFA]",
    textColor: "text-[#22C7A1]",
    bgColor: "bg-[#EFFFFA]",
    borderColor: "border-[#22C7A1]/20",
    ringColor: "ring-[#22C7A1]",
    shadowColor: "shadow-[#22C7A1]/20",
    nutritionBg: "bg-[#EFFFFA]",
    nutritionBorder: "border-[#22C7A1]/20",
  },
  dinner: {
    icon: Moon,
    label: "dinner",
    gradient: "from-[#7C83F6] to-[#38BDF8]",
    bgGradient: "bg-[#F3F4FF]",
    textColor: "text-[#7C83F6]",
    bgColor: "bg-[#F3F4FF]",
    borderColor: "border-[#7C83F6]/20",
    ringColor: "ring-[#7C83F6]",
    shadowColor: "shadow-[#7C83F6]/20",
    nutritionBg: "bg-[#F3F4FF]",
    nutritionBorder: "border-[#7C83F6]/20",
  },
  snack: {
    icon: Apple,
    label: "snack",
    gradient: "from-[#FB6B7A] to-[#F97316]",
    bgGradient: "bg-[#FFF0F2]",
    textColor: "text-[#FB6B7A]",
    bgColor: "bg-[#FFF0F2]",
    borderColor: "border-[#FB6B7A]/20",
    ringColor: "ring-[#FB6B7A]",
    shadowColor: "shadow-[#FB6B7A]/20",
    nutritionBg: "bg-[#FFF0F2]",
    nutritionBorder: "border-[#FB6B7A]/20",
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
  snack2: 4,
};

const Schedule = () => {
  const { t, isRTL } = useLanguage();
  const reduceMotion = useReducedMotion();
  useEffect(() => { document.title = `${t("nav_schedule")} — Nutrio`; }, [t]);
  const { NextIcon } = getNavArrows(isRTL);
  const DAYS = isRTL ? DAYS_AR : DAYS_EN;
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedComboParam = searchParams.get("combo") || "";
  const { user } = useAuth();
  const { profile } = useProfile();
  const { activeGoal } = useNutritionGoals(user?.id);
  const { settings, loading: settingsLoading } = usePlatformSettings();
  const { toast } = useToast();
  const { showLoginPrompt, setShowLoginPrompt, promptLogin, loginPromptConfig } = useGuestLoginPrompt();
  const { remainingMeals, isUnlimited, hasActiveSubscription, subscription, remainingSnacks, snacksPerMonth, incrementMealUsage, incrementSnackUsage, refetch: refetchSubscription } = useSubscription();
  const { wallet, refresh: refetchWallet } = useWallet();

  const pricePerMeal = subscription?.price_per_meal ?? 50;

  const [showMealPlanGenerator, setShowMealPlanGenerator] = useState(false);
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
  const [comboMeals, setComboMeals] = useState<ComboMeal[]>([]);
  const [comboLoading, setComboLoading] = useState(false);
  const [comboApplying, setComboApplying] = useState(false);

  const { unavailableMeals, dismissMeal, performSubstitution, hasUnavailable } = useSmartSubstitutions({
    userId: user?.id,
    schedules,
    enabled: settings.features.meal_scheduling && !settingsLoading,
  });
  const [showWizard, setShowWizard] = useState(false);
  const [wizardInitialStep, setWizardInitialStep] = useState(0);
  const [wizardAutoFill, setWizardAutoFill] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [showInlinePreview, setShowInlinePreview] = useState(false);
  const [inlinePreviewLoading, setInlinePreviewLoading] = useState(false);
  const [inlinePreviewMeals, setInlinePreviewMeals] = useState<ScheduledMeal[]>([]);

  const [selectedMeal, setSelectedMeal] = useState<ScheduledMeal | null>(null);
  const [showMealSheet, setShowMealSheet] = useState(false);
  const [logMealOpen, setLogMealOpen] = useState(false);

  const [showTimeSlotDialog, setShowTimeSlotDialog] = useState(false);
  const [showModifyModal, setShowModifyModal] = useState(false);
  const [selectedScheduleForTimeSlot, setSelectedScheduleForTimeSlot] = useState<string | null>(null);
  const [togglingMealId, setTogglingMealId] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  useEffect(() => {
    if (sessionStorage.getItem("nutrio_onboarding_done") === "true") return;
    if (profile && !profile.onboarding_completed && !profile.goal) {
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
      const { data: mealsData, error: mealsError } = await supabase
        .from("meals")
        .select("id, name, calories, protein_g, carbs_g, fat_g, image_url")
        .in("id", mealIds);

      if (mealsError) {
        console.error("Error fetching meals for schedule:", mealsError);
        setError(mealsError.message);
        setLoading(false);
        return;
      }

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

  useEffect(() => {
    if (!selectedComboParam) {
      setComboMeals([]);
      return;
    }

    const mealIds = Array.from(new Set(selectedComboParam.split(",").map((id) => id.trim()).filter(Boolean))).slice(0, 4);
    if (!mealIds.length) {
      setComboMeals([]);
      return;
    }

    let cancelled = false;
    setComboLoading(true);

    supabase
      .from("meals")
      .select("id,name,calories,protein_g,carbs_g,fat_g,image_url,meal_type,restaurant_id")
      .in("id", mealIds)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("Error loading selected combo:", error);
          setComboMeals([]);
          return;
        }

        const mealMap = (data || []).reduce<Record<string, ComboMeal>>((acc, meal) => {
          acc[meal.id] = {
            id: meal.id,
            name: meal.name,
            calories: meal.calories || 0,
            protein_g: meal.protein_g || 0,
            carbs_g: meal.carbs_g || 0,
            fat_g: meal.fat_g || 0,
            image_url: meal.image_url,
            meal_type: meal.meal_type,
            restaurant_id: meal.restaurant_id,
          };
          return acc;
        }, {});

        setComboMeals(mealIds.map((id) => mealMap[id]).filter(Boolean));
      })
      .finally(() => {
        if (!cancelled) setComboLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedComboParam]);

  const clearSelectedCombo = useCallback(() => {
    setComboMeals([]);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("combo");
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const applySelectedCombo = useCallback(async () => {
    if (!user || comboMeals.length === 0) return;
    if (!hasActiveSubscription) {
      toast({
        title: "Subscription required",
        description: "Activate your plan before scheduling this combo.",
        variant: "destructive",
      });
      return;
    }

    const dateKey = format(selectedDate, "yyyy-MM-dd");
    const usedTypes = new Set(
      schedules
        .filter((schedule) => schedule.scheduled_date === dateKey)
        .map((schedule) => schedule.meal_type)
    );
    const fallbackTypes = [...MEAL_TYPES];
    const rows = comboMeals
      .map((meal) => {
        const preferredType = MEAL_TYPES.includes(meal.meal_type as (typeof MEAL_TYPES)[number])
          ? (meal.meal_type as (typeof MEAL_TYPES)[number])
          : undefined;
        const mealType = preferredType && !usedTypes.has(preferredType)
          ? preferredType
          : fallbackTypes.find((type) => !usedTypes.has(type));

        if (mealType) usedTypes.add(mealType);

        return mealType ? {
          user_id: user.id,
          meal_id: meal.id,
          restaurant_id: meal.restaurant_id,
          scheduled_date: dateKey,
          meal_type: mealType,
          delivery_time_slot: MEAL_TYPE_TIMES[mealType],
          order_status: "pending",
        } : null;
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));

    if (!rows.length) {
      toast({
        title: "No open slots",
        description: "Choose another day or remove a meal before adding this combo.",
        variant: "destructive",
      });
      return;
    }

    setComboApplying(true);
    try {
      const rowsWithCoachContext = await Promise.all(
        rows.map(async (row) => {
          const coachSuggestion = await findCoachMealSuggestion({
            userId: user.id,
            scheduledDate: row.scheduled_date,
            mealType: row.meal_type,
            selectedMealId: row.meal_id,
          });

          return {
            ...row,
            ...getCoachMealScheduleFields(coachSuggestion),
          };
        })
      );

      const { error } = await supabase.from("meal_schedules").insert(rowsWithCoachContext);
      if (error) throw error;

      for (const row of rows) {
        if (row?.meal_type === "snack") {
          await incrementSnackUsage();
        } else {
          await incrementMealUsage();
        }
      }

      await refetchSubscription();
      await fetchSchedules();
      clearSelectedCombo();
      toast({
        title: "Combo added",
        description: `${rows.length} meal${rows.length === 1 ? "" : "s"} scheduled for ${format(selectedDate, "MMM d")}.`,
      });
    } catch (err) {
      console.error("Error applying combo:", err);
      toast({
        title: "Could not schedule combo",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setComboApplying(false);
    }
  }, [clearSelectedCombo, comboMeals, fetchSchedules, hasActiveSubscription, incrementMealUsage, incrementSnackUsage, refetchSubscription, schedules, selectedDate, toast, user]);

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

      // Normalize RPC response — DB may return short keys (s/e/a) or long keys (success/error/was_already_completed)
      const raw = data as Record<string, unknown>;
      const success = raw.success ?? raw.s ?? false;
      const errMsg = (raw.error ?? raw.e ?? 'Failed to update meal') as string;
      const wasAlreadyCompleted = (raw.was_already_completed ?? raw.a ?? false) as boolean;
      const nothingToUndo = (raw.nothing_to_undo ?? raw.u ?? false) as boolean;

      if (!success) {
        throw new Error(errMsg);
      }

      setSchedules(prev => prev.map(s => s.id === scheduleId ? { ...s, is_completed: !isCompleted } : s));
      await syncCommunityChallengeProgressQuietly(user.id);

      window.dispatchEvent(new CustomEvent("nutrio:meal-progress-changed"));

      if (!isCompleted && !wasAlreadyCompleted) {
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
        p_reason: null,
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

      // Normalize RPC response — DB may return short keys (s/e) or long keys (success/error)
      const raw = data as Record<string, unknown>;
      const cancelSuccess = raw.success ?? raw.s ?? false;
      const cancelErrMsg = (raw.error ?? raw.e) as string | undefined;
      const cancelRefunded = (raw.refunded_addons ?? 0) as number;

      if (!cancelSuccess) {
        toast({
          title: t("error"),
          description: cancelErrMsg || t("failed_to_remove_meal"),
          variant: "destructive"
        });
        return;
      }

      trackEvent("meal_schedule_cancelled", {
        meal_id: scheduleToDelete?.meal?.id,
        meal_name: scheduleToDelete?.meal?.name,
        meal_type: scheduleToDelete?.meal_type,
        scheduled_date: scheduleToDelete?.scheduled_date,
        had_addons: cancelRefunded > 0,
        addon_amount: cancelRefunded,
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
  const scheduleCaloriePct = activeGoal?.daily_calorie_target
    ? Math.round((dailyNutrition.calories / Math.max(activeGoal.daily_calorie_target, 1)) * 100)
    : 0;
  const scheduleProteinPct = activeGoal?.protein_target_g
    ? Math.round((dailyNutrition.protein / Math.max(activeGoal.protein_target_g, 1)) * 100)
    : 0;
  const scheduleGoalScore = activeGoal
    ? calculateGoalAlignmentScore({
      caloriePct: scheduleCaloriePct,
      proteinPct: scheduleProteinPct,
      consistencyPct: dailyNutrition.total > 0 ? 100 : 0,
    })
    : 0;

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
      <div className="relative min-h-screen overflow-hidden bg-[#F6F8FB] pb-20">
        <div className="sticky top-0 z-10 border-b border-[#E5EAF1]" style={{ paddingTop: "env(safe-area-inset-top, 0px)", backgroundColor: "rgba(255,255,255,0.85)", backdropFilter: "blur(20px)" }}>
          <div className="flex items-center justify-between h-[44px] px-2 max-w-lg mx-auto">
            <button
              data-testid="schedule-back-btn"
              onClick={() => navigate("/dashboard")}
              className="flex items-center gap-0.5 active:opacity-60 transition-opacity cursor-pointer"
            >
              <ArrowLeft className="h-[24px] w-[24px] text-[#020617]" />
              <span className="text-[17px] font-medium text-[#020617]">Back</span>
            </button>
            <h1 className="text-[17px] font-semibold text-[#020617]">{t("schedule")}</h1>
            <div className="w-11" />
          </div>
        </div>
        <div className="flex flex-col items-center justify-center min-h-[70vh] px-6">
          <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-[#FFF7ED] shadow-xl shadow-[#F97316]/10">
            <AlertTriangle className="h-12 w-12 text-[#F97316]" />
          </div>
          <h2 className="mb-3 text-2xl font-bold text-[#020617]">{t("scheduling_unavailable")}</h2>
          <p className="mb-8 max-w-xs text-center text-sm leading-relaxed text-[#64748B]">{t("scheduling_disabled_desc")}</p>
          <Button
            onClick={() => navigate("/dashboard")}
            className="h-14 cursor-pointer rounded-2xl bg-[#020617] px-8 text-base font-semibold text-white shadow-lg shadow-[rgba(2,6,23,0.20)] hover:bg-[#020617]/90"
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
    <div className="relative min-h-screen overflow-hidden bg-[#F8FAFC]">
      {/* Scroll progress bar — native iOS style sub-bar */}
      <motion.div
        className="fixed left-0 right-0 top-0 z-50 h-0.5 origin-left bg-[#22C7A1]"
        style={{ scaleX: weekProgressPct / 100 }}
        aria-hidden
      />
      {/* ── Unified Header (date info + calendar) ─────────────── */}
      <ScheduleHeader
        currentWeekStart={currentWeekStart}
        selectedDate={selectedDate}
        weekDays={weekDays}
        isUnlimited={isUnlimited}
        remainingMeals={remainingMeals}
        hasActiveSubscription={hasActiveSubscription}
        DAYS={DAYS}
        t={t}
        getDayStatus={getDayStatus}
        onWeekChange={setCurrentWeekStart}
        onDateSelect={setSelectedDate}
        onBack={() => navigate("/dashboard")}
        dailyNutrition={dailyNutrition}
      />

      {/* ── Content Area ─────────────────────────────── */}
      <div className="relative z-10 mx-auto max-w-[430px] px-3 pb-[88px] pt-4">

        {/* ── Weekly Stats ─────────────────────────────── */}
        <WeeklyProgressBar
          weekProgressPct={weekProgressPct}
          weekProgress={weekProgress}
          remainingMeals={remainingMeals}
          isUnlimited={isUnlimited}
          hasActiveSubscription={hasActiveSubscription}
        />

        {activeGoal && (
          <section className="mb-4 rounded-[26px] bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.06)] ring-1 ring-[#E5EAF1]">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#7C83F6]">{t("schedule_goal_fit")}</p>
                <h2 className="mt-1 text-[18px] font-black leading-tight text-[#020617]">{t("schedule_goal_fit_desc")}</h2>
              </div>
              <div className="grid h-[64px] w-[64px] shrink-0 place-items-center rounded-full bg-[#F6F8FB] ring-1 ring-[#E5EAF1]">
                <div className="text-center">
                  <p className="text-[22px] font-black leading-none text-[#020617]">{scheduleGoalScore}</p>
                  <p className="mt-1 text-[8px] font-black uppercase tracking-wide text-[#94A3B8]">{t("score")}</p>
                </div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-2xl bg-[#EFFFFA] p-3 ring-1 ring-[#22C7A1]/20">
                <p className="text-[10px] font-black uppercase tracking-wide text-[#22C7A1]">{t("schedule_goal_calories")}</p>
                <p className="mt-1 text-lg font-black text-[#020617]">{dailyNutrition.calories} / {activeGoal.daily_calorie_target}</p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
                  <div className="h-full rounded-full bg-[#22C7A1]" style={{ width: `${Math.min(scheduleCaloriePct, 100)}%` }} />
                </div>
              </div>
              <div className="rounded-2xl bg-[#F3F4FF] p-3 ring-1 ring-[#7C83F6]/20">
                <p className="text-[10px] font-black uppercase tracking-wide text-[#7C83F6]">{t("schedule_goal_protein")}</p>
                <p className="mt-1 text-lg font-black text-[#020617]">{dailyNutrition.protein}g / {activeGoal.protein_target_g}g</p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
                  <div className="h-full rounded-full bg-[#7C83F6]" style={{ width: `${Math.min(scheduleProteinPct, 100)}%` }} />
                </div>
              </div>
            </div>
          </section>
        )}

        {!loading && hasActiveSubscription && (() => {
          const totalSlots = 7 * 4;
          const hasUnusedSlots = thisWeekSchedules.length < totalSlots;
          const isWeekEmpty = thisWeekSchedules.length === 0;
          const openSlots = Math.max(totalSlots - thisWeekSchedules.length, 0);

          if (!isWeekEmpty && !hasUnusedSlots) return null;

          return (
            <motion.button
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => setShowMealPlanGenerator(true)}
              whileTap={{ scale: 0.98 }}
              className="mb-4 mt-2 flex w-full items-center gap-3 rounded-[24px] bg-white p-4 text-left shadow-[0_12px_32px_rgba(2,6,23,0.06)] ring-1 ring-[#E5EAF1] transition active:bg-[#F6F8FB]"
              dir={isRTL ? "rtl" : "ltr"}
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-[#EFFFFA] text-[#22C7A1] ring-1 ring-[#22C7A1]/20">
                <CalendarPlus className="h-6 w-6" strokeWidth={2.4} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="mb-0.5 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-[#F97316]" strokeWidth={2.5} />
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#7C83F6]">
                    {isWeekEmpty ? "Smart planner" : `${openSlots} open slots`}
                  </span>
                </div>
                <p className="truncate text-[15px] font-black text-[#020617]">{t("schedule_fill_week_title")}</p>
                <p className="truncate text-[12px] font-semibold text-[#64748B]">{t("schedule_fill_week_desc")}</p>
              </div>

              <span className="flex h-10 shrink-0 items-center rounded-full bg-[#020617] px-4 text-[13px] font-black text-white">
                {t("schedule_fill_my_week")}
              </span>
            </motion.button>
          );
        })()}

        {/* ── Smart Substitution Banner ─────────────────── */}
        <SmartSubstitutionBanner
          unavailableMeals={unavailableMeals}
          onDismiss={dismissMeal}
          onSubstitute={performSubstitution}
        />

        {(comboLoading || comboMeals.length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 rounded-[28px] bg-white p-4 shadow-[0_16px_40px_rgba(2,6,23,0.08)] ring-1 ring-[#E5EAF1]"
            dir={isRTL ? "rtl" : "ltr"}
          >
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-[#020617] text-white">
                <Utensils className="h-5 w-5" strokeWidth={2.4} />
              </div>
              <div className={`min-w-0 flex-1 ${isRTL ? "text-right" : "text-left"}`}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#7C83F6]">Selected combo</p>
                    <h3 className="mt-0.5 text-[17px] font-black text-[#020617]">Add to {format(selectedDate, "EEE, MMM d")}</h3>
                  </div>
                  <button
                    data-testid="schedule-clear-combo-btn"
                    onClick={clearSelectedCombo}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F6F8FB] text-[#020617] ring-1 ring-[#E5EAF1] active:scale-95"
                    aria-label="Remove selected combo"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {comboLoading ? (
                  <div className="mt-4 space-y-2">
                    {[0, 1, 2].map((item) => (
                      <div key={item} className="h-12 animate-pulse rounded-[16px] bg-[#F6F8FB]" />
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="mt-4 space-y-2">
                      {comboMeals.map((meal) => (
                        <div key={meal.id} className="flex items-center gap-3 rounded-[18px] bg-[#F6F8FB] p-2 ring-1 ring-[#E5EAF1]">
                          {meal.image_url ? (
                            <img src={meal.image_url} alt={meal.name} className="h-12 w-12 rounded-[16px] object-cover" />
                          ) : (
                            <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-white text-[#64748B]">
                              <Utensils className="h-5 w-5" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-black text-[#020617]">{meal.name}</p>
                            <p className="mt-0.5 truncate text-[11px] font-bold text-[#64748B]">
                              {meal.calories} kcal - {meal.protein_g}g protein
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2">
                      {[
                        { label: "kcal", value: comboMeals.reduce((sum, meal) => sum + meal.calories, 0), tone: "text-[#F97316] bg-[#FFF7ED]" },
                        { label: "protein", value: `${comboMeals.reduce((sum, meal) => sum + meal.protein_g, 0)}g`, tone: "text-[#7C83F6] bg-[#F3F4FF]" },
                        { label: "carbs", value: `${comboMeals.reduce((sum, meal) => sum + meal.carbs_g, 0)}g`, tone: "text-[#22C7A1] bg-[#EFFFFA]" },
                      ].map((stat) => (
                        <div key={stat.label} className={`rounded-[18px] p-3 ${stat.tone}`}>
                          <p className="text-[18px] font-black leading-none">{stat.value}</p>
                          <p className="mt-1 text-[9px] font-black uppercase tracking-[0.1em] opacity-70">{stat.label}</p>
                        </div>
                      ))}
                    </div>

                    <button
                      data-testid="schedule-add-combo-btn"
                      onClick={applySelectedCombo}
                      disabled={comboApplying}
                      className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#020617] text-[14px] font-black text-white shadow-[0_10px_24px_rgba(2,6,23,0.18)] disabled:opacity-60"
                    >
                      {comboApplying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}
                      Add combo to schedule
                    </button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Quick Add Banner ─────────────────────────── */}
        {displayMeals.length === 0 && hasActiveSubscription && !isUnlimited && remainingMeals <= 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4"
          >
            <button
              data-testid="schedule-buy-credits-btn"
              onClick={() => setShowBuyCredit(true)}
              className="flex w-full cursor-pointer items-center gap-3 rounded-2xl border border-[#F97316]/20 bg-[#FFF7ED] p-4 transition-all active:scale-[0.98]"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F97316] shadow-lg shadow-[#F97316]/25">
                <Wallet className="h-5 w-5 text-white" />
              </div>
              <div className={`flex-1 ${isRTL ? "text-right" : "text-left"}`}>
                <p className="text-sm font-bold text-[#020617]">{t("schedule_out_of_credits")}</p>
                <p className="text-xs text-[#64748B]">{t("schedule_buy_extra")}</p>
              </div>
              <NextIcon className="h-5 w-5 text-[#94A3B8]" />
            </button>
          </motion.div>
        )}

        {loading ? (
          <div className="space-y-3 pt-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i}>
                <div className="mb-2 h-4 w-24 animate-pulse rounded-full bg-[#E5EAF1]" />
                <div className="mb-2 overflow-hidden rounded-[24px] border border-[#E5EAF1] bg-white/90 backdrop-blur-xl">
                  <div className="flex items-center gap-3 p-4 animate-pulse">
                    <div className="h-12 w-12 rounded-[16px] bg-[#E5EAF1]" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-32 rounded bg-[#E5EAF1]" />
                      <div className="h-3 w-20 rounded bg-[#E5EAF1]" />
                    </div>
                    <div className="h-8 w-8 rounded-full bg-[#E5EAF1]" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4">
            {MEAL_TYPES.map((mealType, typeIndex) => {
              const config = MEAL_TYPE_CONFIG[mealType];
              const MealIcon = config.icon;
              const typeMeals = displayMeals.filter(m => m.meal_type === mealType);
              const timeLabel = MEAL_TYPE_TIMES[mealType];
              const mealTypeName = t(mealType);
              const noMealsLeft = hasActiveSubscription && !isUnlimited && remainingMeals <= 0;

              const sectionLabelEN = `${mealTypeName.toUpperCase()} - ${timeLabel}`;
              const sectionLabelAR = `${mealTypeName} - ${timeLabel}`;
              const sectionLabel = isRTL ? sectionLabelAR : sectionLabelEN;

              if (typeMeals.length > 0) {
                return (
                  <section key={mealType} className="mb-3">
                    <p className="mb-3 px-1 text-[13px] font-extrabold uppercase tracking-[0.08em] text-[#64748B]" dir={isRTL ? "rtl" : "ltr"}>
                      {sectionLabel}
                    </p>
                    <div className="space-y-2">
                      {typeMeals.map((schedule, mealIndex) => {
                        return (
                          <motion.div
                            key={schedule.id}
                            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: typeIndex * 0.04 + mealIndex * 0.04, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => {
                              setSelectedMeal(schedule);
                              setShowMealSheet(true);
                            }}
                            className="relative cursor-pointer rounded-[24px] bg-white p-3.5 shadow-[0_12px_32px_rgba(2,6,23,0.06)] ring-1 ring-[#E5EAF1] transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(2,6,23,0.09)] active:bg-[#F6F8FB]"
                            dir={isRTL ? "rtl" : "ltr"}
                          >
                            <div className="flex items-center gap-3">
                              {schedule.meal?.image_url ? (
                                <div className="relative shrink-0">
                                  <img
                                    src={schedule.meal.image_url}
                                    alt={schedule.meal.name}
                                    className={`h-12 w-12 rounded-[14px] object-cover transition-all ${
                                      schedule.is_completed ? "opacity-50 saturate-0" : ""
                                    }`}
                                  />
                                  {schedule.is_completed && (
                                    <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#22C7A1] shadow-lg shadow-[#22C7A1]/30">
                                      <Check className="h-3 w-3 text-white" strokeWidth={3} />
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] ${config.bgGradient} ${
                                  schedule.is_completed ? "opacity-50" : ""
                                }`}>
                                  <MealIcon className={`h-5 w-5 ${config.textColor}`} />
                                </div>
                              )}

                              <div className={`min-w-0 flex-1 ${isRTL ? "text-right" : "text-left"}`}>
                                <h3 className={`truncate text-[16px] font-bold text-[#020617] ${
                                  schedule.is_completed ? "text-[#94A3B8]" : ""
                                }`}>
                                  {schedule.meal?.name}
                                </h3>
                                <div className="mt-2 grid grid-cols-3 gap-1.5">
                                  {[
                                    { Icon: Clock, value: schedule.delivery_time_slot || timeLabel, label: "time", tone: "text-sky-700" },
                                    { Icon: Flame, value: schedule.meal.calories, label: "kcal", tone: "text-[#F97316]" },
                                    { Icon: Beef, value: `${schedule.meal.protein_g}g`, label: t("protein_label"), tone: "text-[#020617]" },
                                  ].map(({ Icon, value, label, tone }) => (
                                    <div key={`${label}-${value}`} className="min-w-0 rounded-[14px] bg-[#F6F8FB] px-2 py-2 ring-1 ring-[#E5EAF1] backdrop-blur">
                                      <div className={`flex min-w-0 items-center gap-1 ${tone}`}>
                                        <Icon className="h-3 w-3 shrink-0" strokeWidth={2.4} />
                                        <span className="truncate text-[11px] font-black leading-none">{value}</span>
                                      </div>
                                      <p className="mt-1 truncate text-[8px] font-black uppercase tracking-[0.08em] text-[#94A3B8]">{label}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <motion.button
                                onClick={(e) => toggleMealCompletion(schedule.id, schedule.is_completed, e)}
                                whileTap={{ scale: 0.85 }}
                                disabled={togglingMealId === schedule.id}
                                className={`flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full px-3 text-[12px] font-black transition-all ${
                                  schedule.is_completed
                                    ? "bg-[#EFFFFA] text-[#22C7A1] ring-1 ring-[#22C7A1]/20"
                                    : "bg-[#020617] text-white shadow-lg shadow-[rgba(2,6,23,0.15)]"
                                } disabled:opacity-60`}
                                aria-label={schedule.is_completed ? "Undo log" : "Log meal"}
                              >
                                {togglingMealId === schedule.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : schedule.is_completed ? (
                                  <>
                                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                                    Logged
                                  </>
                                ) : (
                                  "Log"
                                )}
                              </motion.button>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </section>
                );
              }

              const maxEmptySlots = mealType === "snack"
                ? Math.max(2, Math.ceil((snacksPerMonth || 0) / 30) - typeMeals.length)
                : 1;

              return (
                <section key={mealType} className="mb-3">
                  <p className="mb-3 px-1 text-[13px] font-extrabold uppercase tracking-[0.08em] text-[#64748B]" dir={isRTL ? "rtl" : "ltr"}>
                    {sectionLabel}
                  </p>
                  <div className="space-y-2">
                    {Array.from({ length: maxEmptySlots }).map((_, emptyIdx) => {
                      const slotMealType = mealType === "snack" && emptyIdx > 0 ? "snack2" : mealType;
                      return (
                        <div key={`empty-${mealType}-${emptyIdx}`}>
                          <EmptyMealSlot
                            config={config}
                            mealTypeName={emptyIdx > 0 ? `${mealTypeName} ${emptyIdx + 1}` : mealTypeName}
                            timeLabel={timeLabel}
                            noMealsLeft={noMealsLeft || (mealType === "snack" && remainingSnacks <= 0)}
                            isFirstSlot={typeIndex === 0 && emptyIdx === 0}
                            onSwipeRight={() => {
                              if (!user) {
                                promptLogin({
                                  title: t("sign_in_to_schedule"),
                                  description: t("sign_in_to_schedule_desc"),
                                  actionLabel: t("sign_in"),
                                  signUpLabel: t("create_free_account"),
                                });
                              } else if (!noMealsLeft) {
                                openWizard(slotMealType);
                              }
                            }}
                            onSwipeLeft={() => {
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
                            }}
                            onBuyCredits={() => setShowBuyCredit(true)}
                          />
                        </div>
                      );
                    })}
                  </div>
                </section>
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
            initialPhase="meal-selection"
            showMealTypeTabs={false}
            autoFill={wizardAutoFill}
            onComplete={() => { setShowWizard(false); setWizardAutoFill(false); fetchSchedules(); }}
            onCancel={() => { setShowWizard(false); setWizardAutoFill(false); }}
          />
        )}
      </AnimatePresence>

      {/* ── Meal Detail Bottom Sheet ──────────────────── */}
      <MealDetailSheet
        showMealSheet={showMealSheet}
        onClose={() => setShowMealSheet(false)}
        selectedMeal={selectedMeal}
        togglingMealId={togglingMealId}
        mealTypeConfig={MEAL_TYPE_CONFIG}
        t={t}
        onTimeSlotOpen={handleOpenTimeSlotSelector}
        onToggleCompletion={(id, isCompleted) => {
          toggleMealCompletion(id, isCompleted);
          setShowMealSheet(false);
        }}
        onReschedule={() => setShowModifyModal(true)}
        onOpenManualLog={() => {
          setShowMealSheet(false);
          setLogMealOpen(true);
        }}
        onDelete={(id) => {
          setDeleteTargetId(id);
          setDeleteConfirmOpen(true);
        }}
      />

      <LogMealModal
        open={logMealOpen}
        onOpenChange={setLogMealOpen}
        onMealLogged={() => {
          window.dispatchEvent(new CustomEvent("nutrio:meal-progress-changed"));
        }}
      />

      {/* ── Delivery Scheduler Dialog ─────────────────── */}
      <Dialog open={showTimeSlotDialog} onOpenChange={setShowTimeSlotDialog}>
        <DialogContent className="sm:max-w-md rounded-3xl p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Clock className="h-5 w-5 text-[#38BDF8]" />
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
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#FFF7ED]">
                <Wallet className="h-7 w-7 text-[#F97316]" />
              </div>
              <div>
                <h3 className="text-lg font-black text-[#020617]">{t("schedule_buy_extra_title")}</h3>
                <p className="text-xs font-medium text-[#94A3B8]">Add 1 credit to your plan</p>
              </div>
            </div>

            <div className="mb-5 space-y-3 rounded-2xl border border-[#E5EAF1] bg-[#F6F8FB] p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#64748B]">{t("schedule_price_per_credit")}</span>
                <span className="text-lg font-bold text-[#F97316]">{formatCurrency(pricePerMeal)}</span>
              </div>
              <div className="h-px bg-[#E5EAF1]" />
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#64748B]">{t("schedule_wallet_balance")}</span>
                <span className={`font-bold ${(wallet?.balance || 0) >= pricePerMeal ? "text-[#22C7A1]" : "text-[#FB6B7A]"}`}>
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
                  className="h-12 flex-1 cursor-pointer rounded-2xl bg-[#020617] font-semibold text-white shadow-lg shadow-[rgba(2,6,23,0.20)] hover:bg-[#020617]/90"
                >
                  Top Up Wallet
                </Button>
              ) : (
                <Button
                  onClick={handleBuyMealCredit}
                  disabled={buyLoading}
                  className="h-12 flex-1 cursor-pointer rounded-2xl bg-[#020617] font-semibold text-white shadow-lg shadow-[rgba(2,6,23,0.20)] hover:bg-[#020617]/90"
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
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFF0F2]">
                <AlertTriangle className="h-6 w-6 text-[#FB6B7A]" />
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
              className="h-12 flex-1 cursor-pointer rounded-2xl bg-[#FB6B7A] font-semibold text-white hover:bg-[#FB6B7A]/90"
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

      {/* ── Meal Plan Generator ──────────────────────── */}
      <AnimatePresence>
        {showMealPlanGenerator && user && (
          <MealPlanGenerator
            isOpen={showMealPlanGenerator}
            onClose={() => setShowMealPlanGenerator(false)}
            onScheduled={() => {
              setShowMealPlanGenerator(false);
              fetchSchedules();
            }}
            isScheduleEmpty={thisWeekSchedules.length === 0}
          />
        )}
      </AnimatePresence>

      {/* ── Fill My Week FAB ─────────────────────────── */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
      `}</style>
    </div>
  );
};

export default Schedule;
