import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { useNutritionGoals } from "@/hooks/useNutritionGoals";
import { useWallet } from "@/hooks/useWallet";
import { useMealAddons } from "@/hooks/useMealAddons";
import { useMealCustomization } from "@/hooks/useMealCustomization";
import { useMealAllergens } from "@/hooks/useDietTags";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { IngredientList } from "@/components/meal/IngredientList";
import { MealInteractionBanner } from "@/components/meal/MealInteractionBanner";
import { PortionSelector } from "@/components/meal/PortionSelector";
import { HPVariantToggle } from "@/components/meal/HPVariantToggle";
import { MealDetailSkeleton } from "@/components/meal/MealDetailSkeleton";
import { ScheduleSheet } from "@/components/meal/ScheduleSheet";
import { ScheduleSuccessOverlay } from "@/components/meal/ScheduleSuccessOverlay";
import { BuyMealCreditDialog } from "@/components/meal/BuyMealCreditDialog";
import { InsufficientBalanceDialog } from "@/components/meal/InsufficientBalanceDialog";
import { getSmartDefaultMealType } from "@/components/meal/scheduleUtils";
import { formatCurrency } from "@/lib/currency";
import { findCoachMealSuggestion, getCoachMealScheduleFields } from "@/lib/coach-meal-schedule";
import { scoreMealForGoal } from "@/lib/goal-engine";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

import { Share2, Flame, Clock, Star, MapPin, Beef, Wheat, Droplets, Leaf, CalendarPlus, ArrowUpRight, ShieldCheck, Loader2, MessageSquareText, ChevronRight } from "lucide-react";
import { ChevronLeft } from "lucide-react";

import { format } from "date-fns";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import { hapticFeedback } from "@/lib/capacitor";
import { getMealImage } from "@/lib/meal-images";
import { toast as sonnerToast } from "sonner";

interface MealDetail {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
  rating: number;
  prep_time_minutes: number;
  is_vip_exclusive: boolean;
  price: number | null;
  supports_large: boolean | null;
  large_calories_increase: number | null;
  large_protein_increase: number | null;
  large_price_adjustment: number | null;
  supports_high_protein: boolean | null;
  high_protein_calories_increase: number | null;
  high_protein_protein_increase: number | null;
  high_protein_price_adjustment: number | null;
  restaurant: {
    id: string;
    name: string;
    address: string | null;
    logo_url: string | null;
  };
  diet_tags?: string[];
  ingredients?: string[] | string | null;
}

const MealDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { activeGoal } = useNutritionGoals(user?.id);
  const { toast } = useToast();
  const { t } = useLanguage();
  const {
    hasActiveSubscription,
    remainingMeals,
    isUnlimited,
    canOrderMeal,
    incrementMealUsage,
    incrementSnackUsage,
    subscription,
    refetch: refetchSubscription,
  } = useSubscription();

  const { wallet, refresh: refetchWallet } = useWallet();

  const pricePerMeal = subscription?.price_per_meal ?? 50;
  const [buyMealDialogOpen, setBuyMealDialogOpen] = useState(false);
  const [topupDialogOpen, setTopupDialogOpen] = useState(false);
  const [buyMealLoading, setBuyMealLoading] = useState(false);

  const [meal, setMeal] = useState<MealDetail | null>(null);
  const [similarMeals, setSimilarMeals] = useState<any[]>([]);
  const [similarMealsLoading, setSimilarMealsLoading] = useState(false);
  // Add-ons (resolved once meal id is known)
  const {
    groupedAddons,
    selectedAddons,
    toggleAddon,
    getSelectedAddonsTotal,
    getSelectedAddonsList,
    clearSelectedAddons,
    hasAddons,
  } = useMealAddons(id);

  const {
    removedIngredientIds,
    toggleIngredient,
    setPortionSize,
    setHPVariant,
    getSummary,
    getCustomizationData,
    hasCustomizations,
    reset: resetCustomization,
    customization,
  } = useMealCustomization();

  const { mealAllergens, loading: allergensLoading } = useMealAllergens(id);

  const [loading, setLoading] = useState(true);
  const [scheduling, setScheduling] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [success, setSuccess] = useState(false);
  const [restaurantNote, setRestaurantNote] = useState("");

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(() => {
    const navigationState = location.state as { scheduledDate?: Date; mealType?: string } | null;
    return navigationState?.scheduledDate;
  });
  const [selectedMealType, setSelectedMealType] = useState<string>(() => {
    const navigationState = location.state as { scheduledDate?: Date; mealType?: string } | null;
    return navigationState?.mealType || getSmartDefaultMealType();
  });
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [selectedAddressLabel, setSelectedAddressLabel] = useState<string>("");
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll({ container: scrollRef });
  
  const headerOpacity = useTransform(scrollY, [0, 200], [0, 1]);
  const imageScale = useTransform(scrollY, [0, 300], [1, 1.1]);
  const imageOpacity = useTransform(scrollY, [0, 300], [1, 0.5]);
  
  const springConfig = { stiffness: 100, damping: 30, restDelta: 0.001 };
  const headerOpacitySpring = useSpring(headerOpacity, springConfig);

  const fetchMeal = async () => {
    try {
      // Fetch meal first
      const { data: mealData, error: mealError } = await supabase
        .from("meals")
        .select("*")
        .eq("id", id!)
        .eq("approval_status", "approved")
        .eq("is_available", true)
        .single();

      if (mealError) throw mealError;

      if (mealData) {
        // Fetch restaurant separately
        let restaurantData = null;
        if (mealData.restaurant_id) {
          const { data: restData } = await supabase
            .from("restaurants")
            .select("id, name, address, logo_url")
            .eq("id", mealData.restaurant_id)
            .single();
          restaurantData = restData;
        }

        setMeal({
          ...mealData,
          calories: Number(mealData.calories),
          protein_g: Number(mealData.protein_g),
          carbs_g: Number(mealData.carbs_g),
          fat_g: Number(mealData.fat_g),
          fiber_g: mealData.fiber_g ? Number(mealData.fiber_g) : null,
          rating: Number(mealData.rating),
          prep_time_minutes: Number(mealData.prep_time_minutes),
          price: mealData.price ? Number(mealData.price) : null,
          restaurant: restaurantData || {
            id: "",
            name: t("unknown_restaurant"),
            address: null,
            logo_url: null
          }
        } as MealDetail);

        setSimilarMealsLoading(true);
        try {
          const { data: simData, error: simError } = await supabase.functions.invoke("similar-meals", {
            body: { meal_id: id!, limit: 6 },
          });
          if (!simError && simData?.meals) {
            setSimilarMeals(simData.meals);
          }
        } catch (e) {
          console.error("Similar meals fetch error:", e);
        } finally {
          setSimilarMealsLoading(false);
        }
      }
    } catch (error) {
      console.error("Error fetching meal:", error);
      toast({
        title: t("error"),
        description: t("failed_load_meal"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchMealCb = useCallback(fetchMeal, [id, toast, t]);
  useEffect(() => {
    if (id) {
      fetchMealCb();
    }
  }, [id, fetchMealCb]);

  useEffect(() => {
    if (!meal) return;
    if (!meal.supports_large && customization.portionSize === "large") {
      setPortionSize("standard");
    }
    if (!meal.supports_high_protein && customization.hpVariant) {
      setHPVariant(false);
    }
  }, [meal, customization.portionSize, customization.hpVariant, setPortionSize, setHPVariant]);

  const handleAddToSchedule = async () => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to schedule meals",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }

    if (!hasActiveSubscription) {
      toast({
        title: "Subscription required",
        description: "Please subscribe to schedule meals",
        variant: "destructive",
      });
      navigate("/subscription");
      return;
    }

    // ── Allergy check ──────────────────────────────────────────────────
    // Fetch the user's allergy tag IDs from their saved preferences
    if (meal) {
      try {
        const { data: userPrefs } = await supabase
          .from("user_dietary_preferences")
          .select("diet_tag_id, diet_tags(id, name)")
          .eq("user_id", user.id);

        if (userPrefs && userPrefs.length > 0) {
          // Determine which of their saved tags are allergen tags
          const allergenKeywords = ["nut", "dairy", "shellfish", "egg", "wheat", "soy", "fish", "gluten", "lactose"];
          const userAllergyNames = userPrefs
            .map((p: { diet_tags?: { name: string } | null }) => p.diet_tags?.name as string | undefined)
            .filter((name): name is string =>
              !!name && allergenKeywords.some(k => name.toLowerCase().includes(k))
            );

          if (userAllergyNames.length > 0) {
            // Fetch the meal's diet tags from the join table
            const { data: mealTagRows } = await supabase
              .from("meal_diet_tags")
              .select("diet_tags(name)")
              .eq("meal_id", meal.id);

            const mealTagNames = (mealTagRows || [])
              .map((r: { diet_tags?: { name: string } | null }) => r.diet_tags?.name as string | undefined)
              .filter((n): n is string => !!n);

            const conflicts = mealTagNames.filter(tagName =>
              userAllergyNames.some(allergen =>
                tagName.toLowerCase().includes(allergen.toLowerCase()) ||
                allergen.toLowerCase().includes(tagName.toLowerCase())
              )
            );

            if (conflicts.length > 0) {
              sonnerToast.warning(
                `Allergen alert: ${conflicts.join(", ")}`,
                {
                  description: "This meal contains ingredients that match your allergy settings. You can still proceed.",
                  icon: "⚠️",
                  duration: 6000,
                  action: {
                    label: "Proceed anyway",
                    onClick: () => setSheetOpen(true),
                  },
                }
              );
              return; // let the user decide via the toast action
            }
          }
        }
      } catch {
        // allergy check is best-effort — never block scheduling on a lookup failure
      }
    }
    // ──────────────────────────────────────────────────────────────────

    if (!isUnlimited && remainingMeals <= 0) {
      setBuyMealDialogOpen(true);
      return;
    }

    setSheetOpen(true);
  };

  // ── Buy 1 meal credit with wallet ──────────────────────────────────────
  const handleWalletMealPurchase = async () => {
    if (!user || !subscription) return;
    const balance = wallet?.balance || 0;
    if (balance < pricePerMeal) {
      setBuyMealDialogOpen(false);
      navigate("/wallet");
      return;
    }
    setBuyMealLoading(true);
    try {
      // Debit wallet
      const { error: debitErr } = await supabase.rpc("debit_wallet", {
        p_user_id: user.id,
        p_amount: pricePerMeal,
        p_reference_type: "order",
        p_description: "Extra meal credit purchase",
        p_metadata: { subscription_id: subscription.id },
      });
      if (debitErr) throw debitErr;

      // Add 1 meal to the subscription allowance
      const { error: subErr } = await supabase
        .from("subscriptions")
        .update({ meals_per_month: subscription.meals_per_month + 1 })
        .eq("id", subscription.id);
      if (subErr) throw subErr;

      refetchWallet();
      await refetchSubscription();
      setBuyMealDialogOpen(false);
      hapticFeedback.success();
      toast({
        title: "Meal credit added! ✅",
        description: `1 meal added to your plan — ${formatCurrency(pricePerMeal)} deducted.`,
      });
      setSheetOpen(true);
    } catch (err) {
      toast({ title: "Purchase failed", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    } finally {
      setBuyMealLoading(false);
    }
  };

  const handleSchedule = async () => {
    if (!selectedDate || !meal) return;

    setScheduling(true);
    hapticFeedback.buttonPress();

    try {
      const quotaUpdated = await incrementMealUsage();
      if (!quotaUpdated) {
        // No quota left — offer wallet purchase instead
        setScheduling(false);
        setSheetOpen(false);
        setBuyMealDialogOpen(true);
        return;
      }

      // If this order is a snack, also increment the snack counter
      if (selectedMealType === "snack") {
        await incrementSnackUsage();
      }

      // CRITICAL: Check meal availability before scheduling
      // This prevents scheduling unavailable meals which causes cancellations
      const { data: mealCheck, error: mealCheckError } = await supabase
        .from("meals")
        .select("id, is_available, restaurant_id")
        .eq("id", meal.id)
        .single();

      if (mealCheckError || !mealCheck) {
        toast({
          title: "Meal not found",
          description: "This meal is no longer available. Please select another meal.",
          variant: "destructive",
        });
        setScheduling(false);
        return;
      }

      if (mealCheck.is_available === false) {
        toast({
          title: "Meal unavailable",
          description: "This meal is currently unavailable. Please select another meal or check back later.",
          variant: "destructive",
        });
        setScheduling(false);
        return;
      }

      // Check if wallet has enough for add-ons before scheduling
      const addonsTotal = getSelectedAddonsTotal();
      if (addonsTotal > 0 && (wallet?.balance || 0) < addonsTotal) {
        setScheduling(false);
        setTopupDialogOpen(true);
        return;
      }

      const scheduledDate = format(selectedDate, "yyyy-MM-dd");
      const coachSuggestion = await findCoachMealSuggestion({
        userId: user!.id,
        scheduledDate,
        mealType: selectedMealType,
        selectedMealId: meal.id,
      });

      const schedulePayload = {
        user_id: user!.id,
        meal_id: meal.id,
        scheduled_date: scheduledDate,
        meal_type: selectedMealType,
        is_completed: false,
        order_status: "pending",
        delivery_address_id: selectedAddressId,
        customization_data: getCustomizationData(customizationSummary),
        restaurant_note: restaurantNote.trim() || null,
        ...(selectedTimeSlot ? { delivery_time_slot: selectedTimeSlot } : {}),
        ...getCoachMealScheduleFields(coachSuggestion),
      };

      const { data: scheduleRow, error } = await supabase
        .from("meal_schedules")
        .insert(schedulePayload as never)
        .select("id")
        .single();

      if (error) throw error;

      const selectedAddonRows = getSelectedAddonsList();

      // Debit wallet for add-ons if any selected
      if (addonsTotal > 0) {
        const addonNames = selectedAddonRows.map(({ addon, quantity }) =>
          quantity > 1 ? `${addon.name} x${quantity}` : addon.name
        ).join(", ");
        await supabase.rpc("debit_wallet", {
          p_user_id: user!.id,
          p_amount: addonsTotal,
          p_reference_type: "order",
          p_description: `Add-ons for ${meal.name}: ${addonNames}`,
          p_metadata: { meal_id: meal.id, addons: addonNames },
        });
        refetchWallet();
        clearSelectedAddons();
      }

      if (scheduleRow?.id && selectedAddonRows.length > 0) {
        const { error: addonInsertError } = await supabase.from("schedule_addons").insert(
          selectedAddonRows.map(({ addon, quantity }) => ({
            schedule_id: scheduleRow.id,
            addon_id: addon.id,
            quantity,
            unit_price: addon.price,
          }))
        );
        if (addonInsertError) throw addonInsertError;
      }

      setSuccess(true);
      setSheetOpen(false);
      hapticFeedback.success();

      // Show success toast notification
      toast({
        title: "Meal Scheduled! 🎉",
        description: coachSuggestion?.status === "replaced"
          ? `${meal.name} replaces your coach's ${coachSuggestion.suggestedMealName} suggestion.`
          : `${meal.name} has been added to your schedule for ${format(selectedDate, "MMM d, yyyy")}.`,
      });

      // Create in-app notification
      try {
        await supabase.from("notifications").insert({
          user_id: user!.id,
          type: "meal_scheduled",
          title: "Meal Scheduled",
          message: `${meal.name} has been scheduled for ${format(selectedDate, "MMM d, yyyy")}`,
          data: {
            meal_id: meal.id,
            meal_name: meal.name,
            scheduled_date: scheduledDate,
            meal_type: selectedMealType,
            coach_program_id: coachSuggestion?.coachProgramId,
            program_meal_id: coachSuggestion?.programMealId,
            coach_replacement_status: coachSuggestion?.status,
            calories: displayCalories,
            customization: getCustomizationData(customizationSummary),
            restaurant_note: restaurantNote.trim() || null,
            action: "view_schedule",
            delivery_address_id: selectedAddressId,
            delivery_address_label: selectedAddressLabel,
          },
          status: "unread"
        });
      } catch (notifError) {
        console.error("Error creating notification:", notifError);
      }

      setTimeout(() => {
        navigate("/schedule");
      }, 1500);
    } catch (error) {
      console.error("Error scheduling meal:", error);
      toast({
        title: "Error",
        description: "Failed to schedule meal. Please try again.",
        variant: "destructive",
      });
    } finally {
      setScheduling(false);
    }
  };

  const shareMeal = async () => {
    if (!meal) return;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: meal.name,
          text: `Check out ${meal.name} from ${meal.restaurant.name}!`,
          url: window.location.href,
        });
      } catch (error) {
        console.error("Error sharing:", error);
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast({ title: "Link copied to clipboard" });
    }
  };

  if (loading) {
    return <MealDetailSkeleton />;
  }

  if (!meal) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center mb-4">
          <span className="text-4xl">🍽️</span>
        </div>
        <h2 className="text-xl font-bold mb-2">Meal not found</h2>
        <p className="text-muted-foreground text-center mb-6">
          The meal you're looking for doesn't exist or has been removed.
        </p>
        <Button onClick={() => navigate("/meals")} className="rounded-full px-8">
          Browse Meals
        </Button>
      </div>
    );
  }

  const noMealsLeft = hasActiveSubscription && !isUnlimited && remainingMeals <= 0;
  const actionLabel = !hasActiveSubscription ? "View plans" : noMealsLeft ? "Buy meal credit" : "Add to schedule";
  const customizationConfig = {
    largePriceAdjustment: meal.large_price_adjustment,
    largeCaloriesIncrease: meal.large_calories_increase,
    largeProteinIncrease: meal.large_protein_increase,
    hpPriceAdjustment: meal.high_protein_price_adjustment,
    hpCaloriesIncrease: meal.high_protein_calories_increase,
    hpProteinIncrease: meal.high_protein_protein_increase,
  };
  const customizationSummary = hasCustomizations
    ? getSummary(customizationConfig)
    : null;
  const hasPartnerCustomizationOptions = Boolean(meal.supports_large || meal.supports_high_protein);
  const displayCalories = meal.calories + (customizationSummary?.calorieAdjustment || 0);
  const displayProtein = meal.protein_g + (customizationSummary?.proteinAdjustment || 0);
  const displayCarbs = meal.carbs_g + (customizationSummary?.carbsAdjustment || 0);
  const displayFat = meal.fat_g + (customizationSummary?.fatAdjustment || 0);
  const displayMacroTotal = Math.max(displayProtein + displayCarbs + displayFat, 1);
  const displayProteinPct = Math.round((displayProtein / displayMacroTotal) * 100);
  const displayCarbsPct = Math.round((displayCarbs / displayMacroTotal) * 100);
  const displayFatPct = Math.max(0, 100 - displayProteinPct - displayCarbsPct);
  const mealGoalFit = scoreMealForGoal({
    goalType: activeGoal?.goal_type,
    mealCalories: displayCalories,
    mealProteinG: displayProtein,
    dailyCalories: activeGoal?.daily_calorie_target,
    dailyProteinG: activeGoal?.protein_target_g,
  });

  return (
    <div ref={scrollRef} className="min-h-screen overflow-y-auto bg-[#F6F7F5] pb-52">
      <motion.header
        style={{ opacity: headerOpacitySpring }}
        className="fixed left-0 right-0 top-0 z-40 border-b border-slate-200/70 bg-white/85 backdrop-blur-xl"
      >
        <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-4">
          <button
            data-testid="meal-detail-back-btn"
            onClick={() => navigate(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-950"
            aria-label="Back"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="max-w-[220px] truncate text-[14px] font-black text-slate-950">{meal.name}</span>
          <button
            data-testid="meal-detail-share-btn"
            onClick={shareMeal}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-950"
            aria-label="Share meal"
          >
            <Share2 className="h-4 w-4" />
          </button>
        </div>
      </motion.header>

      <div className="mx-auto max-w-lg">
        <section className="relative h-[360px] overflow-hidden bg-slate-200">
          <motion.img
            style={{ scale: imageScale, opacity: imageOpacity }}
            src={getMealImage(meal.image_url, meal.id)}
            alt={meal.name}
            loading="eager"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/5 to-[#F6F7F5]" />
          <div className="absolute left-4 right-4 top-[calc(env(safe-area-inset-top)+14px)] flex items-center justify-between">
            <button
              data-testid="meal-detail-back-float-btn"
              onClick={() => navigate(-1)}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-slate-950 shadow-[0_10px_24px_rgba(15,23,42,0.16)] backdrop-blur"
              aria-label="Back"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              data-testid="meal-detail-share-float-btn"
              onClick={shareMeal}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-slate-950 shadow-[0_10px_24px_rgba(15,23,42,0.16)] backdrop-blur"
              aria-label="Share meal"
            >
              <Share2 className="h-4 w-4" />
            </button>
          </div>
          <div className="absolute bottom-8 left-4 right-4">
            <div className="flex flex-wrap items-center gap-2">
              {meal.is_vip_exclusive && (
                <Badge className="rounded-full border-0 bg-amber-400 px-3 py-1 text-[11px] font-black text-slate-950">
                  VIP Exclusive
                </Badge>
              )}
              <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-3 py-1 text-[11px] font-black text-slate-950 backdrop-blur">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                {meal.rating === 0 || meal.rating === 0.0 ? "New" : meal.rating.toFixed(1)}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-3 py-1 text-[11px] font-black text-slate-950 backdrop-blur">
                <Clock className="h-3 w-3" />
                {meal.prep_time_minutes} min
              </span>
            </div>
          </div>
        </section>

        <main className="relative -mt-8 space-y-4 px-4">
          <motion.section
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[32px] bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.1)] ring-1 ring-slate-200/80"
          >
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[18px] bg-slate-100 ring-1 ring-slate-200">
                {meal.restaurant.logo_url ? (
                  <img src={meal.restaurant.logo_url} alt="" loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <ShieldCheck className="h-5 w-5 text-slate-500" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-black text-slate-950">{meal.restaurant.name}</p>
                {meal.restaurant.address && (
                  <p className="mt-0.5 flex min-w-0 items-center gap-1 truncate text-[11px] font-semibold text-slate-500">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {meal.restaurant.address}
                  </p>
                )}
              </div>
              <button
                data-testid="meal-detail-restaurant-link"
                onClick={() => navigate(`/restaurant/${meal.restaurant.id}`)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#020617] text-white"
                aria-label="Open restaurant"
              >
                <ArrowUpRight className="h-4 w-4" />
              </button>
            </div>

            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-orange-600">Meal details</p>
            <h1 className="mt-1 text-[28px] font-black leading-[1.05] tracking-[-0.03em] text-slate-950">{meal.name}</h1>
            {meal.description && (
              <p className="mt-3 text-[14px] font-semibold leading-6 text-slate-600">{meal.description}</p>
            )}

          </motion.section>

          {meal.diet_tags && meal.diet_tags.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {meal.diet_tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="shrink-0 rounded-full bg-white px-3 py-1.5 text-[11px] font-black text-slate-700 ring-1 ring-slate-200">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {hasPartnerCustomizationOptions && (
            <motion.section
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="space-y-5 rounded-[28px] bg-white p-5 shadow-[0_14px_36px_rgba(15,23,42,0.07)] ring-1 ring-slate-200/80"
            >
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Customize</p>
                <h2 className="text-[20px] font-black text-slate-950">Make it yours</h2>
              </div>
              {meal.supports_large && (
                <PortionSelector
                  value={customization.portionSize}
                  onChange={setPortionSize}
                  baseCalories={meal.calories || 0}
                  largeCaloriesIncrease={Number(meal.large_calories_increase || 0)}
                  largeProteinIncrease={Number(meal.large_protein_increase || 0)}
                  largePriceAdjustment={Number(meal.large_price_adjustment || 0)}
                />
              )}
              {meal.supports_high_protein && (
                <HPVariantToggle
                  enabled={customization.hpVariant}
                  onChange={setHPVariant}
                  proteinIncrease={Number(meal.high_protein_protein_increase || 0)}
                  caloriesIncrease={Number(meal.high_protein_calories_increase || 0)}
                  priceAdjustment={Number(meal.high_protein_price_adjustment || 0)}
                />
              )}
            </motion.section>
          )}

          {!allergensLoading && mealAllergens.length > 0 && (
            <motion.section
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.07 }}
              className="rounded-[28px] bg-white p-5 shadow-[0_14px_36px_rgba(15,23,42,0.07)] ring-1 ring-slate-200/80"
            >
              <div className="mb-3">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-rose-600">Allergens</p>
                <h2 className="text-[20px] font-black text-slate-950">Allergen information</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {mealAllergens.map((ma) => (
                  <span
                    key={ma.id}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-black ring-1",
                      ma.severity === "severe"
                        ? "bg-red-50 text-red-700 ring-red-200"
                        : ma.severity === "moderate"
                          ? "bg-amber-50 text-amber-800 ring-amber-200"
                          : "bg-slate-50 text-slate-700 ring-slate-200",
                    )}
                  >
                    {ma.allergen.icon && <span className="text-[13px]">{ma.allergen.icon}</span>}
                    {ma.allergen.name}
                    {ma.severity === "severe" && (
                      <span className="ml-0.5 rounded-full bg-red-200 px-1.5 py-0.5 text-[9px] font-black uppercase text-red-800">
                        High
                      </span>
                    )}
                  </span>
                ))}
              </div>
              {mealAllergens.some((ma) => ma.notes) && (
                <p className="mt-3 text-[12px] font-semibold text-slate-500">
                  {mealAllergens.filter((ma) => ma.notes).map((ma) => ma.notes).join(". ")}
                </p>
              )}
            </motion.section>
          )}

          <motion.section
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="rounded-[28px] bg-white p-5 shadow-[0_18px_44px_rgba(15,23,42,0.08)] ring-1 ring-slate-200/80"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Nutrition</p>
                <h2 className="mt-1 text-[22px] font-black leading-tight tracking-normal text-slate-950">Nutrition profile</h2>
                <p className="mt-1 text-[12px] font-semibold text-slate-500">Calories, macros and fiber</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-black text-slate-500">per meal</span>
            </div>

            <div className="mt-5 grid grid-cols-[118px_minmax(0,1fr)] gap-5">
              <div className="relative flex h-[118px] w-[118px] shrink-0 items-center justify-center rounded-full bg-slate-100">
                <div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: `conic-gradient(#020617 0 ${displayProteinPct}%, #94A3B8 ${displayProteinPct}% ${displayProteinPct + displayCarbsPct}%, #0EA5E9 ${displayProteinPct + displayCarbsPct}% 100%)`,
                  }}
                />
                <div className="absolute inset-[10px] rounded-full bg-white" />
                <div className="relative text-center">
                  <Flame className="mx-auto mb-1 h-4 w-4 text-orange-500" strokeWidth={2.4} />
                  <p className="text-[25px] font-black leading-none text-slate-950 tabular-nums">{displayCalories}</p>
                  <p className="mt-1 text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">kcal</p>
                </div>
              </div>

              <div className="grid content-center gap-2.5">
                {[
                  { label: "Protein", value: displayProtein, Icon: Beef, dot: "#020617", pct: displayProteinPct },
                  { label: "Carbs", value: displayCarbs, Icon: Wheat, dot: "#94A3B8", pct: displayCarbsPct },
                  { label: "Fat", value: displayFat, Icon: Droplets, dot: "#0EA5E9", pct: displayFatPct },
                ].map(({ label, value, Icon, dot, pct }) => (
                  <div key={label} className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-50 ring-1 ring-slate-200">
                      <Icon className="h-4 w-4" style={{ color: dot }} strokeWidth={2.4} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate text-[13px] font-black text-slate-950">{label}</p>
                        <p className="text-[12px] font-black text-slate-500">{pct}%</p>
                      </div>
                      <p className="mt-0.5 text-[12px] font-bold text-slate-400">
                        {value}g of {displayMacroTotal}g
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-full bg-slate-100">
              <div className="flex h-2.5 w-full">
                <div className="bg-[#020617]" style={{ width: `${displayProteinPct}%` }} />
                <div className="bg-slate-400" style={{ width: `${displayCarbsPct}%` }} />
                <div className="bg-sky-500" style={{ width: `${displayFatPct}%` }} />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="flex items-center gap-3 rounded-[18px] bg-slate-50 p-3 ring-1 ring-slate-200/70">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#020617] ring-1 ring-slate-200">
                  <Beef className="h-4 w-4" strokeWidth={2.4} />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-[0.1em] text-slate-400">Macros</p>
                  <p className="mt-0.5 text-[16px] font-black leading-none text-slate-950">{displayMacroTotal}g total</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-[18px] bg-slate-50 p-3 ring-1 ring-slate-200/70">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-emerald-600 ring-1 ring-slate-200">
                  <Leaf className="h-4 w-4" strokeWidth={2.4} />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-[0.1em] text-slate-400">Fiber</p>
                  <p className="mt-0.5 text-[16px] font-black leading-none text-slate-950">{meal.fiber_g ? `${meal.fiber_g}g` : "-"}</p>
                </div>
              </div>
            </div>
          </motion.section>

          {activeGoal && (
            <motion.section
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="rounded-[28px] bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.06)] ring-1 ring-[#E5EAF1]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#7C83F6]">{t("meal_goal_fit")}</p>
                  <h2 className="mt-1 text-[20px] font-black leading-tight text-[#020617]">{t(mealGoalFit.labelKey)}</h2>
                  <p className="mt-2 text-sm font-semibold leading-6 text-[#64748B]">
                    {t("meal_goal_fit_desc", {
                      calories: Math.round(mealGoalFit.calorieShare * 100),
                      protein: Math.round(mealGoalFit.proteinShare * 100),
                    })}
                  </p>
                </div>
                <div className="grid h-[72px] w-[72px] shrink-0 place-items-center rounded-full bg-[#F6F8FB] ring-1 ring-[#E5EAF1]">
                  <div className="text-center">
                    <p className="text-[24px] font-black leading-none text-[#020617]">{mealGoalFit.score}</p>
                    <p className="mt-1 text-[9px] font-black uppercase tracking-wide text-[#94A3B8]">{t("score")}</p>
                  </div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-2xl bg-[#EFFFFA] p-3 ring-1 ring-[#22C7A1]/20">
                  <p className="text-[10px] font-black uppercase tracking-wide text-[#22C7A1]">{t("calories")}</p>
                  <p className="mt-1 text-lg font-black text-[#020617]">{displayCalories} / {activeGoal.daily_calorie_target}</p>
                </div>
                <div className="rounded-2xl bg-[#F3F4FF] p-3 ring-1 ring-[#7C83F6]/20">
                  <p className="text-[10px] font-black uppercase tracking-wide text-[#7C83F6]">{t("protein_label")}</p>
                  <p className="mt-1 text-lg font-black text-[#020617]">{displayProtein}g / {activeGoal.protein_target_g}g</p>
                </div>
              </div>
            </motion.section>
          )}

          {customizationSummary && (
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-[24px] bg-[#020617] p-4 text-white shadow-[0_14px_36px_rgba(2,6,23,0.18)]"
            >
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/50">Customization summary</p>
              <div className="mt-3 space-y-2 text-[12px] font-bold text-white/80">
                {customizationSummary.portionSize === "large" && <p>Large portion +{customizationSummary.calorieAdjustment} cal</p>}
                {customizationSummary.hpVariant && <p>High protein +{customizationSummary.proteinAdjustment}g protein</p>}
                {customizationSummary.removedIngredientNames.length > 0 && <p>Removed: {customizationSummary.removedIngredientNames.join(", ")}</p>}
              </div>
              <p className="mt-3 text-[13px] font-black">Adjustment +{formatCurrency(customizationSummary.priceAdjustment)}</p>
            </motion.section>
          )}

          <motion.section
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
            className="space-y-4 rounded-[28px] bg-white p-5 shadow-[0_14px_36px_rgba(15,23,42,0.07)] ring-1 ring-slate-200/80"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#020617] text-white">
                <MessageSquareText className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Restaurant note</p>
                <h2 className="text-[20px] font-black text-slate-950">Anything to tell the kitchen?</h2>
                <p className="mt-1 text-[12px] font-semibold leading-relaxed text-slate-500">
                  Add preparation notes like sauce on the side, no onions, or allergy reminders.
                </p>
              </div>
            </div>
            <Textarea
              value={restaurantNote}
              onChange={(event) => setRestaurantNote(event.target.value.slice(0, 240))}
              placeholder="Example: sauce on the side, please."
              className="min-h-[92px] resize-none rounded-[22px] border-slate-200 bg-slate-50 px-4 py-3 text-[14px] font-semibold text-slate-950 placeholder:text-slate-400 focus-visible:ring-[#020617]/20"
              maxLength={240}
            />
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
              <span>Optional</span>
              <span>{restaurantNote.length}/240</span>
            </div>
          </motion.section>

          <MealInteractionBanner mealId={meal.id} />

          {meal.ingredients && (
            <motion.section
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="rounded-[28px] bg-white p-5 shadow-[0_14px_36px_rgba(15,23,42,0.07)] ring-1 ring-slate-200/80"
            >
              <div className="mb-4">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Ingredients</p>
                <h2 className="text-[20px] font-black text-slate-950">Remove what you need</h2>
              </div>
              <IngredientList
                mealId={meal.id}
                removedIngredients={removedIngredientIds}
                onToggle={toggleIngredient}
              />
            </motion.section>
          )}

          {similarMeals.length > 0 && (
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-[24px] bg-white p-4 ring-1 ring-slate-100"
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-[15px] font-black text-slate-900">You May Also Like</h3>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-600">AI Picks</span>
              </div>
              <div className="flex snap-x gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {similarMeals.slice(0, 8).map((sm: any) => (
                  <button
                    key={sm.meal_id}
                    onClick={() => {
                      setMeal(null);
                      setSimilarMeals([]);
                      navigate(`/meal/${sm.meal_id}`, { replace: true });
                    }}
                    className="w-[160px] snap-start shrink-0 rounded-2xl bg-slate-50 p-3 text-left transition-all hover:bg-slate-100 active:scale-[0.97]"
                  >
                    <div className="mb-2 h-20 w-full overflow-hidden rounded-xl bg-slate-200">
                      {sm.image_url ? (
                        <img src={sm.image_url} alt={sm.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-slate-400">
                          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                        </div>
                      )}
                    </div>
                    <p className="line-clamp-1 text-[12px] font-extrabold text-slate-900">{sm.name}</p>
                    <p className="line-clamp-1 text-[10px] font-semibold text-emerald-600">{sm.restaurant_name}</p>
                    <div className="mt-1.5 flex items-center gap-2 text-[10px] font-bold text-slate-500">
                      <span className="flex items-center gap-0.5"><Flame className="h-3 w-3 text-orange-400" />{sm.calories}</span>
                      <span className="flex items-center gap-0.5"><Beef className="h-3 w-3 text-blue-400" />{sm.protein_g}g</span>
                    </div>
                  </button>
                ))}
                <button
                  data-testid="meal-detail-view-all-rec"
                  onClick={() => navigate("/recommendations")}
                  className="flex w-[72px] shrink-0 snap-start flex-col items-center justify-center gap-1.5 rounded-2xl bg-emerald-50 p-3 text-center transition-all hover:bg-emerald-100 active:scale-[0.97]"
                >
                  <ChevronRight className="h-5 w-5 text-emerald-600" />
                  <span className="text-[10px] font-extrabold text-emerald-600 leading-tight">View All</span>
                </button>
              </div>
            </motion.section>
          )}
        </main>
      </div>

      <div className="fixed bottom-14 left-0 right-0 z-40 border-t border-slate-200/80 bg-white/90 px-4 pb-3 pt-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-black text-slate-950">{meal.name}</p>
            <p className="mt-0.5 text-[11px] font-bold text-slate-500">
              {displayCalories} kcal - {displayProtein}g protein
            </p>
          </div>
          <button
            data-testid="meal-detail-add-schedule"
            onClick={handleAddToSchedule}
            disabled={scheduling || success}
            className="flex min-h-[52px] shrink-0 items-center justify-center gap-2 rounded-full bg-[#020617] px-5 text-[14px] font-black text-white shadow-[0_12px_28px_rgba(2,6,23,0.22)] disabled:opacity-60"
          >
            {scheduling ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}
            {success ? "Scheduled" : actionLabel}
          </button>
        </div>
      </div>
      {/* Schedule Bottom Sheet */}
      <ScheduleSheet
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        selectedMealType={selectedMealType}
        setSelectedMealType={setSelectedMealType}
        selectedTimeSlot={selectedTimeSlot}
        setSelectedTimeSlot={setSelectedTimeSlot}
        onSchedule={handleSchedule}
        loading={scheduling}
        hasActiveSubscription={hasActiveSubscription}
        remainingMeals={remainingMeals}
        isUnlimited={isUnlimited}
        meal={meal}
        selectedAddressId={selectedAddressId}
        setSelectedAddressId={setSelectedAddressId}
        setSelectedAddressLabel={setSelectedAddressLabel}
        userId={user?.id}
        groupedAddons={groupedAddons}
        selectedAddons={selectedAddons}
        toggleAddon={toggleAddon}
        addonsTotal={getSelectedAddonsTotal()}
        walletBalance={wallet?.balance || 0}
        hasAddons={hasAddons}
      />

      <BuyMealCreditDialog
        open={buyMealDialogOpen}
        onOpenChange={setBuyMealDialogOpen}
        pricePerMeal={pricePerMeal}
        walletBalance={wallet?.balance || 0}
        loading={buyMealLoading}
        onPurchase={handleWalletMealPurchase}
        onTopUp={() => { setBuyMealDialogOpen(false); navigate("/wallet"); }}
      />

      <InsufficientBalanceDialog
        open={topupDialogOpen}
        onOpenChange={setTopupDialogOpen}
        addonsTotal={getSelectedAddonsTotal()}
        walletBalance={wallet?.balance || 0}
        onTopUp={() => { setTopupDialogOpen(false); navigate("/wallet"); }}
      />

      <ScheduleSuccessOverlay visible={success} />
    </div>
  );
};

export default MealDetail;

