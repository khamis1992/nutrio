import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { useWallet } from "@/hooks/useWallet";
import { useMealAddons } from "@/hooks/useMealAddons";
import { useMealCustomization } from "@/hooks/useMealCustomization";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { IngredientList } from "@/components/meal/IngredientList";
import { PortionSelector } from "@/components/meal/PortionSelector";
import { HPVariantToggle } from "@/components/meal/HPVariantToggle";
import { CircularMacroGauge } from "@/components/meal/CircularMacroGauge";
import { MealActionBar } from "@/components/meal/MealActionBar";
import { MealDetailSkeleton } from "@/components/meal/MealDetailSkeleton";
import { ScheduleSheet } from "@/components/meal/ScheduleSheet";
import { ScheduleSuccessOverlay } from "@/components/meal/ScheduleSuccessOverlay";
import { BuyMealCreditDialog } from "@/components/meal/BuyMealCreditDialog";
import { InsufficientBalanceDialog } from "@/components/meal/InsufficientBalanceDialog";
import { getSmartDefaultMealType } from "@/components/meal/scheduleUtils";
import { formatCurrency } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { Share2, Flame, Clock, Star, MapPin, Beef, Wheat, Droplets, Leaf } from "lucide-react";
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

  const pricePerMeal = subscription?.price_per_meal ?? 50; // TODO: fetch from subscription plan's price_per_meal
  const [buyMealDialogOpen, setBuyMealDialogOpen] = useState(false);
  const [topupDialogOpen, setTopupDialogOpen] = useState(false);
  const [buyMealLoading, setBuyMealLoading] = useState(false);

  const [meal, setMeal] = useState<MealDetail | null>(null);
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

  const [loading, setLoading] = useState(true);
  const [scheduling, setScheduling] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [success, setSuccess] = useState(false);

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

      const { error } = await supabase.from("meal_schedules").insert({
        user_id: user!.id,
        meal_id: meal.id,
        scheduled_date: format(selectedDate, "yyyy-MM-dd"),
        meal_type: selectedMealType,
        is_completed: false,
        order_status: "pending",
        delivery_address_id: selectedAddressId,
        ...(selectedTimeSlot ? { delivery_time_slot: selectedTimeSlot } : {}),
      });

      if (error) throw error;

      // Debit wallet for add-ons if any selected
      if (addonsTotal > 0) {
        const addonNames = getSelectedAddonsList().map(({ addon, quantity }) =>
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

      setSuccess(true);
      setSheetOpen(false);
      hapticFeedback.success();

      // Show success toast notification
      toast({
        title: "Meal Scheduled! 🎉",
        description: `${meal.name} has been added to your schedule for ${format(selectedDate, "MMM d, yyyy")}.`,
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
            scheduled_date: format(selectedDate, "yyyy-MM-dd"),
            meal_type: selectedMealType,
            calories: meal.calories,
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

  return (
    <div ref={scrollRef} className="min-h-screen bg-background overflow-y-auto pb-24">
      {/* Animated Header */}
      <motion.header
        style={{ opacity: headerOpacitySpring }}
        className="fixed top-0 left-0 right-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50"
      >
        <div className="flex items-center justify-between px-4 h-14">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="rounded-full bg-background/50 backdrop-blur"
          >
            <ChevronLeft className="w-6 h-6" />
          </Button>
          <span className="font-semibold truncate max-w-[200px]">{meal.name}</span>
          <div className="w-10" />
        </div>
      </motion.header>

      {/* Hero Image Section */}
      <div className="relative h-[55vh] overflow-hidden">
        <motion.div
          style={{ scale: imageScale, opacity: imageOpacity }}
          className="absolute inset-0"
        >
          <img
            src={getMealImage(meal.image_url, meal.id)}
            alt={meal.name}
            loading="eager"
            className="w-full h-full object-cover"
          />
        </motion.div>
        
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-background/20 via-transparent to-background" />
        
        {/* Floating Action Bar */}
        <div className="absolute top-12 left-4 right-4 flex items-center justify-end">
          <div className="flex items-center gap-2">
            {/* Favorite button - disabled until favorite_meals table is available */}
            {/* <Button
              variant="secondary"
              size="icon"
              onClick={toggleFavorite}
              className="rounded-full bg-background/80 backdrop-blur shadow-lg"
            >
              <Heart className="w-5 h-5" />
            </Button> */}
            <Button
              variant="secondary"
              size="icon"
              onClick={shareMeal}
              className="rounded-full bg-background/80 backdrop-blur shadow-lg"
            >
              <Share2 className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* VIP Badge */}
        {meal.is_vip_exclusive && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute bottom-24 right-4"
          >
            <Badge className="bg-gradient-to-r from-warning to-yellow-500 text-white border-0 px-3 py-1.5 text-sm font-bold shadow-lg">
              ⭐ VIP Exclusive
            </Badge>
          </motion.div>
        )}
      </div>

      {/* Content Container */}
      <div className="relative -mt-16 px-4 space-y-4">
        {/* Main Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-card rounded-3xl shadow-xl border border-border/50 p-6"
        >
          {/* Restaurant Info */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden">
              {meal.restaurant.logo_url ? (
                <img src={meal.restaurant.logo_url} alt="" loading="lazy" className="w-full h-full object-cover" />
              ) : (
                <span className="text-lg">🏪</span>
              )}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm">{meal.restaurant.name}</p>
              {meal.restaurant.address && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {meal.restaurant.address}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1 text-warning">
              <Star className="w-4 h-4 fill-current" />
              <span className="font-semibold text-sm">
                {meal.rating === 0 || meal.rating === 0.0 ? "New" : `${meal.rating.toFixed(1)}`}
              </span>
            </div>
          </div>

          {/* Meal Name */}
          <h1 className="text-2xl font-bold mb-2">{meal.name}</h1>
          
          {/* Description */}
          {meal.description && (
            <p className="text-muted-foreground text-sm leading-relaxed mb-4">
              {meal.description}
            </p>
          )}

          {/* Quick Stats */}
          <div className="flex items-center gap-6 py-4 border-y border-border/50">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Flame className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Calories</p>
                <p className="font-semibold">{meal.calories}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Clock className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Prep Time</p>
                <p className="font-semibold">{meal.prep_time_minutes}m</p>
              </div>
            </div>
            {meal.fiber_g && (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Leaf className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Fiber</p>
                  <p className="font-semibold">{meal.fiber_g}g</p>
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Nutrition Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="bg-card rounded-3xl shadow-lg border border-border/50 p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold">Nutrition Facts</h2>
            <span className="text-sm text-muted-foreground">Per serving</span>
          </div>

          {/* Circular Macros */}
          <div className="flex justify-around">
            <CircularMacroGauge
              value={meal.protein_g}
              max={50}
              color="#EF4444"
              icon={Beef}
              label="Protein"
              delay={0.2}
            />
            <CircularMacroGauge
              value={meal.carbs_g}
              max={80}
              color="#F59E0B"
              icon={Wheat}
              label="Carbs"
              delay={0.3}
            />
            <CircularMacroGauge
              value={meal.fat_g}
              max={40}
              color="#14B8A6"
              icon={Droplets}
              label="Fat"
              delay={0.4}
            />
          </div>
        </motion.div>

        {/* Action Bar - inline below Nutrition Facts */}
        <MealActionBar
          meal={meal}
          onClick={handleAddToSchedule}
          loading={scheduling}
          disabled={!hasActiveSubscription}
          isSuccess={success}
          hasActiveSubscription={hasActiveSubscription}
          isUnlimited={isUnlimited}
          remainingMeals={remainingMeals}
        />

        {/* Dietary Tags */}
        {meal.diet_tags && meal.diet_tags.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex flex-wrap gap-2"
          >
            {meal.diet_tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="rounded-full px-3 py-1">
                {tag}
              </Badge>
            ))}
          </motion.div>
        )}

        {/* Meal Customization */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
          className="bg-card rounded-3xl shadow-lg border border-border/50 p-6 space-y-5"
        >
          <PortionSelector
            value={customization.portionSize}
            onChange={setPortionSize}
            basePrice={meal.price}
            baseCalories={meal.calories || 0}
            baseProtein={meal.protein_g || 0}
            baseCarbs={meal.carbs_g || 0}
            baseFat={meal.fat_g || 0}
          />
          <HPVariantToggle
            enabled={customization.hpVariant}
            onChange={setHPVariant}
            baseProtein={meal.protein_g || 0}
            basePrice={meal.price}
          />
        </motion.div>

        {/* Ingredients (interactive) */}
        {meal.ingredients && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <IngredientList
              mealId={meal.id}
              removedIngredients={removedIngredientIds}
              onToggle={toggleIngredient}
            />
          </motion.div>
        )}

        {/* Customization Summary */}
        {hasCustomizations && (() => {
          const summary = getSummary(meal.price, meal.calories || 0, meal.protein_g || 0, meal.carbs_g || 0, meal.fat_g || 0);
          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-primary/5 border border-primary/20 rounded-2xl p-4 space-y-1"
            >
              <p className="text-sm font-semibold text-primary">Customization Summary</p>
              {summary.portionSize === 'large' && <p className="text-xs text-muted-foreground">🍽️ Large portion (+{summary.calorieAdjustment} cal, +{formatCurrency(summary.priceAdjustment)})</p>}
              {summary.hpVariant && <p className="text-xs text-muted-foreground">💪 High Protein (+{summary.proteinAdjustment}g protein, +{formatCurrency(15)})</p>}
              {summary.removedIngredientNames.length > 0 && <p className="text-xs text-muted-foreground">🚫 Removed: {summary.removedIngredientNames.join(', ')}</p>}
              <p className="text-xs font-medium text-primary mt-1">Total adjustment: +{formatCurrency(summary.priceAdjustment)}</p>
            </motion.div>
          );
        })()}


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
