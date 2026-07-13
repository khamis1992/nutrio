import { getNavArrows } from "@/lib/rtl";
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";
import { useSubscription } from "@/hooks/useSubscription";
import { useWallet } from "@/hooks/useWallet";
import { formatCurrency } from "@/lib/currency";
import { findCoachMealSuggestion, getCoachMealScheduleFields } from "@/lib/coach-meal-schedule";
import { syncCommunityChallengeProgressQuietly } from "@/lib/community-challenge-service";
import { scheduleMealsAtomic, type ScheduleMealInput } from "@/lib/schedule-meals";
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
  ArrowLeft,
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
import MealDetailSheet from "@/components/schedule/MealDetailSheet";
import LogMealModal from "@/components/LogMealModal";
import { MealPlanGenerator } from "@/components/meal/MealPlanGenerator";
import { SmartSubstitutionBanner } from "@/components/meal/SmartSubstitutionBanner";
import { useSmartSubstitutions } from "@/hooks/useSmartSubstitutions";

interface ScheduledMeal {
  id: string;
  scheduled_date: string;
  meal_type: string;
  meal_id: string;
  created_at: string;
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
  const { settings, loading: settingsLoading } = usePlatformSettings();
  const { toast } = useToast();
  const { showLoginPrompt, setShowLoginPrompt, promptLogin, loginPromptConfig } = useGuestLoginPrompt();
  const { remainingMeals, isUnlimited, hasActiveSubscription, subscription, remainingSnacks, snacksPerMonth, refetch: refetchSubscription } = useSubscription();
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
      const { data, error } = await supabase.rpc(
        "purchase_extra_meal_credit" as never,
        { p_subscription_id: subscription.id } as never,
      );
      if (error) throw error;
      const result = data as unknown as { success?: boolean; amount?: number } | null;
      if (!result?.success) throw new Error("Meal credit purchase was not completed");

      refetchWallet();
      await refetchSubscription();
      setShowBuyCredit(false);
      toast({
        title: "Meal credit added!",
        description: `1 meal added to your plan — QAR ${result.amount ?? pricePerMeal} deducted.`,
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

  const { unavailableMeals, dismissMeal, performSubstitution } = useSmartSubstitutions({
    userId: user?.id,
    schedules,
    enabled: settings.features.meal_scheduling && !settingsLoading,
  });
  const [showWizard, setShowWizard] = useState(false);
  const [wizardInitialStep, setWizardInitialStep] = useState(0);
  const [wizardAutoFill, setWizardAutoFill] = useState(false);
  const [, setIsRefreshing] = useState(false);

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
    if (profile && !profile.onboarding_completed && !profile.health_goal) {
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
        created_at,
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

    const schedulesWithMeals = (schedulesData || []).filter(
      (schedule): schedule is typeof schedule & { meal_id: string } => typeof schedule.meal_id === "string"
    );
    const mealIds = schedulesWithMeals.map((schedule) => schedule.meal_id);
    let mealsMap: Record<string, { id: string; name: string; calories: number; protein_g: number; carbs_g: number; fat_g: number; image_url: string | null }> = {};

    if (mealIds.length > 0) {
      const { data: mealsData, error: mealsError } = await supabase
        .from("meals")
        .select("id, name, calories, protein_g, carbs_g, fat_g, image_url")
        .in("id", mealIds);

      if (mealsError) {
        console.error("Error fetching meals for schedule:", mealsError);
        toast({ title: t("error"), description: mealsError.message, variant: "destructive" });
        setLoading(false);
        return;
      }

      mealsMap = (mealsData || []).reduce((acc: Record<string, { id: string; name: string; calories: number; protein_g: number; carbs_g: number; fat_g: number; image_url: string | null }>, meal) => {
        acc[meal.id] = {
          id: meal.id,
          name: meal.name,
          calories: meal.calories ?? 0,
          protein_g: meal.protein_g ?? 0,
          carbs_g: meal.carbs_g ?? 0,
          fat_g: meal.fat_g ?? 0,
          image_url: meal.image_url,
        };
        return acc;
      }, {});
    }

    const mergedSchedules: ScheduledMeal[] = schedulesWithMeals.map((schedule) => ({
      id: schedule.id,
      scheduled_date: schedule.scheduled_date,
      meal_type: schedule.meal_type,
      meal_id: schedule.meal_id,
      created_at: schedule.created_at ?? `${schedule.scheduled_date}T00:00:00.000Z`,
      is_completed: schedule.is_completed ?? false,
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

    void (async () => {
      try {
        const { data, error } = await supabase
          .from("meals")
          .select("id,name,calories,protein_g,carbs_g,fat_g,image_url,meal_type,restaurant_id")
          .in("id", mealIds);
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
      } finally {
        if (!cancelled) setComboLoading(false);
      }
    })();

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
      if (!subscription?.id) throw new Error("SUBSCRIPTION_NOT_FOUND");

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

      const items: ScheduleMealInput[] = rowsWithCoachContext.map((row) => ({
        meal_id: row.meal_id,
        scheduled_date: row.scheduled_date,
        meal_type: row.meal_type,
        delivery_time_slot: row.delivery_time_slot,
        ...getCoachMealScheduleFields(
          row.coach_program_id && row.program_meal_id && row.coach_suggested_meal_id
            ? {
                programMealId: row.program_meal_id,
                coachProgramId: row.coach_program_id,
                suggestedMealId: row.coach_suggested_meal_id,
                suggestedMealName: "Coach meal",
                status: row.coach_replacement_status as "followed" | "replaced",
                macroDelta: row.coach_replacement_delta as {
                  calories: number;
                  protein_g: number;
                  carbs_g: number;
                  fat_g: number;
                },
              }
            : null,
        ),
      }));

      await scheduleMealsAtomic(subscription.id, items);

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
  }, [clearSelectedCombo, comboMeals, fetchSchedules, hasActiveSubscription, refetchSubscription, schedules, selectedDate, subscription?.id, toast, user]);

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
        description: err instanceof Error ? err.message : t("failed_update_status"),
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
        description: err instanceof Error ? err.message : t("failed_to_remove_meal"),
        variant: "destructive"
      });
    }
  };

  const updateDeliveryTimeSlot = async (scheduleId: string, timeSlot: string, deliveryAddressId?: string | null) => {
    try {
      const updates: Record<string, unknown> = { delivery_time_slot: timeSlot };
      if (deliveryAddressId) updates.delivery_address_id = deliveryAddressId;

      const { error } = await supabase
        .from("meal_schedules")
        .update(updates)
        .eq("id", scheduleId);

      if (error) throw error;

      setSchedules(prev => prev.map(s =>
        s.id === scheduleId ? { ...s, delivery_time_slot: timeSlot, ...(deliveryAddressId ? { delivery_address_id: deliveryAddressId } : {}) } : s
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

  const handleTimeSlotSelect = ({ time, deliveryAddressId }: { date: Date; time: string; deliveryAddressId: string | null }) => {
    if (selectedScheduleForTimeSlot) {
      updateDeliveryTimeSlot(selectedScheduleForTimeSlot, time, deliveryAddressId);
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

  const currentWeekEnd = addDays(currentWeekStart, 6);
  const thisWeekSchedules = schedules.filter((schedule) => {
    const scheduleDate = new Date(schedule.scheduled_date);
    scheduleDate.setHours(0, 0, 0, 0);
    return scheduleDate >= currentWeekStart && scheduleDate <= currentWeekEnd;
  });

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#F6F8FB]">
      {/* Scroll progress bar — native iOS style sub-bar */}
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
              className="mb-4 flex min-h-[68px] w-full items-center gap-3 rounded-[20px] bg-white p-3 text-left shadow-[0_8px_24px_rgba(2,6,23,0.05)] ring-1 ring-[#E5EAF1] transition active:bg-[#F6F8FB]"
              dir={isRTL ? "rtl" : "ltr"}
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] bg-[#E9FBF6] text-[#22C7A1] ring-1 ring-[#22C7A1]/15">
                <CalendarPlus className="h-5 w-5" strokeWidth={2.4} />
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-black text-[#020617]">{t("schedule_fill_week_title")}</p>
                <p className="mt-0.5 truncate text-[11px] font-semibold text-[#64748B]">
                  {isWeekEmpty ? "Build your week in one step" : `${openSlots} open slots this week`}
                </p>
              </div>

              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#020617] text-white">
                <Sparkles className="h-4 w-4" strokeWidth={2.4} />
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
                            className="relative cursor-pointer rounded-[20px] bg-white p-3 shadow-[0_8px_24px_rgba(2,6,23,0.05)] ring-1 ring-[#E5EAF1] transition active:bg-[#F6F8FB]"
                            dir={isRTL ? "rtl" : "ltr"}
                          >
                            <div className="flex items-center gap-3">
                              {schedule.meal?.image_url ? (
                                <div className="relative shrink-0">
                                  <img
                                    src={schedule.meal.image_url}
                                    alt={schedule.meal.name}
                                    className={`h-16 w-16 rounded-[16px] object-cover transition-all ${
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
                                <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-[16px] ${config.bgGradient} ${
                                  schedule.is_completed ? "opacity-50" : ""
                                }`}>
                                  <MealIcon className={`h-5 w-5 ${config.textColor}`} />
                                </div>
                              )}

                              <div className={`min-w-0 flex-1 ${isRTL ? "text-right" : "text-left"}`}>
                                <div className="mb-1 flex items-center gap-1.5">
                                  <span className={`text-[9px] font-black uppercase tracking-[0.1em] ${config.textColor}`}>{mealTypeName}</span>
                                  <span className="h-1 w-1 rounded-full bg-[#CBD5E1]" />
                                  <span className="text-[10px] font-bold text-[#94A3B8]">{schedule.delivery_time_slot || timeLabel}</span>
                                </div>
                                <h3 className={`truncate text-[15px] font-black text-[#020617] ${
                                  schedule.is_completed ? "text-[#94A3B8]" : ""
                                }`}>
                                  {schedule.meal?.name}
                                </h3>
                                <div className="mt-2 flex items-center gap-3 text-[11px] font-extrabold text-[#64748B]">
                                  <span className="inline-flex items-center gap-1">
                                    <Flame className="h-3.5 w-3.5 text-[#FB6B7A]" />
                                    {schedule.meal.calories} kcal
                                  </span>
                                  <span className="inline-flex items-center gap-1">
                                    <Beef className="h-3.5 w-3.5 text-[#7C83F6]" />
                                    {schedule.meal.protein_g}g protein
                                  </span>
                                </div>
                              </div>

                              <motion.button
                                onClick={(e) => toggleMealCompletion(schedule.id, schedule.is_completed, e)}
                                whileTap={{ scale: 0.85 }}
                                disabled={togglingMealId === schedule.id}
                                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-all ${
                                  schedule.is_completed
                                    ? "bg-[#EFFFFA] text-[#22C7A1] ring-1 ring-[#22C7A1]/20"
                                    : "bg-[#F6F8FB] text-[#94A3B8] ring-1 ring-[#E5EAF1]"
                                } disabled:opacity-60`}
                                aria-label={schedule.is_completed ? "Undo log" : "Log meal"}
                              >
                                {togglingMealId === schedule.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : schedule.is_completed ? (
                                  <Check className="h-4 w-4" strokeWidth={3} />
                                ) : (
                                  <Circle className="h-4 w-4" strokeWidth={2.4} />
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
