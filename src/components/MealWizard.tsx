import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Coffee,
  Sun,
  Moon,
  Apple,
  ChevronLeft,
  Check,
  X,
  Flame,
  Beef,
  ChefHat,
  ArrowRight,
  Store,
  MapPin,
  Star,
  ChevronRight,
  Target,
  Loader2,
  Sparkles,
  Calendar,
  RefreshCw,
  Home,
  Briefcase,
  ChevronDown,
} from "lucide-react";
import { format } from "date-fns";
import { getMealImage } from "@/lib/meal-images";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DeliveryScheduler } from "@/components/ui/delivery-scheduler";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSubscription } from "@/hooks/useSubscription";
import { useWallet } from "@/hooks/useWallet";
import { useNavigate, useBlocker } from "react-router-dom";
import { formatCurrency } from "@/lib/currency";
import { ShoppingCart, Wallet } from "lucide-react";

interface Meal {
  id: string;
  name: string;
  description: string | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  image_url: string | null;
  is_available: boolean | null;
  restaurant_id: string | null;
  restaurant?: {
    id: string;
    name: string;
    logo_url: string | null;
  };
}

interface Restaurant {
  id: string;
  name: string;
  description: string | null;
  address: string | null;
  logo_url: string | null;
  rating: number | null;
  cuisine_type: string | null;
}

interface MealWizardProps {
  userId: string;
  selectedDate: Date;
  onComplete: () => void;
  onCancel: () => void;
  initialStep?: number;
  singleMode?: boolean;
  autoFill?: boolean;
}

const STEPS = [
  { id: "breakfast", labelKey: "breakfast", icon: Coffee, color: "bg-amber-500", lightColor: "bg-amber-50", descKey: "breakfast_desc" },
  { id: "lunch", labelKey: "lunch", icon: Sun, color: "bg-orange-500", lightColor: "bg-orange-50", descKey: "lunch_desc" },
  { id: "dinner", labelKey: "dinner", icon: Moon, color: "bg-indigo-500", lightColor: "bg-indigo-50", descKey: "dinner_desc" },
  { id: "snack", labelKey: "snacks_salad", icon: Apple, color: "bg-emerald-500", lightColor: "bg-emerald-50", descKey: "snacks_desc" },
];

const MealWizard = ({ userId, selectedDate, onComplete, onCancel, initialStep = 0, singleMode = false, autoFill = false }: MealWizardProps) => {
  const { toast } = useToast();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { remainingMeals, isUnlimited, incrementMealUsage, subscription } = useSubscription();

  // Phase: "mode" = first screen asking single vs full-day, "scheduling" = normal wizard flow
  const [phase, setPhase] = useState<"mode" | "scheduling">("mode");
  const [localSingleMode, setLocalSingleMode] = useState(singleMode);

  const handlePickSingleMeal = () => {
    setLocalSingleMode(true);
    setPhase("scheduling");
  };

  const handlePickFullDay = () => {
    setLocalSingleMode(false);
    setCurrentStep(0);
    setPhase("scheduling");
  };

  const [currentStep, setCurrentStep] = useState(initialStep);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMeals, setSelectedMeals] = useState<Record<string, Meal & { restaurant: Restaurant }>>({
    breakfast: null as any,
    lunch: null as any,
    dinner: null as any,
    snack: null as any,
  });
  const [scheduling, setScheduling] = useState(false);

  // Smart recommendation state
  const [remainingNutrition, setRemainingNutrition] = useState({
    calories: 2000,
    protein: 120,
    carbs: 250,
    fat: 65,
  });
  const [recommendedMeals, setRecommendedMeals] = useState<Meal[]>([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [showRecommendations, setShowRecommendations] = useState(true);

  // Delivery address state
  const [addresses, setAddresses] = useState<{ id: string; label: string; address_line1: string; city: string; is_default: boolean }[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [showAddressPicker, setShowAddressPicker] = useState(false);

  // Auto-fill day state
  const [autoFillLoading, setAutoFillLoading] = useState(false);
  const [showAutoFillDialog, setShowAutoFillDialog] = useState(false);
  const [showAutoFillPreferences, setShowAutoFillPreferences] = useState(true);
  const [generatedDayPlan, setGeneratedDayPlan] = useState<any>(null);
  const [selectedSuggestedMeals, setSelectedSuggestedMeals] = useState<Set<number>>(new Set());
  const [lockedMeals, setLockedMeals] = useState<any[]>([]);
  const [showPlanSummary, setShowPlanSummary] = useState(false);
  const [showDeliveryScheduler, setShowDeliveryScheduler] = useState(false);
  const [success, setSuccess] = useState(false);
  const autoFillTriggered = useRef(false);
  
  // Quick preference state for auto-fill
  const [autoFillPreferences, setAutoFillPreferences] = useState({
    maxCalories: 2000,
    proteinFocus: false,
    vegetarian: false,
    quickPrep: false,
  });

  // ── Add-ons ───────────────────────────────────────────────────────────
  const { wallet, refresh: refetchWallet } = useWallet();
  interface AddonItem { id: string; name: string; description: string | null; price: number; category: string; }
  const [showAddonSheet, setShowAddonSheet] = useState(false);
  const [addonStepKey, setAddonStepKey] = useState("");
  const [loadedAddons, setLoadedAddons] = useState<AddonItem[]>([]);
  const [addonLoading, setAddonLoading] = useState(false);
  const [selectedAddonIds, setSelectedAddonIds] = useState<Set<string>>(new Set());
  // Stores confirmed add-ons per meal type key
  const [addonsPerStep, setAddonsPerStep] = useState<Record<string, AddonItem[]>>({});
  // What to do after the add-on sheet closes
  const [pendingNav, setPendingNav] = useState<"delivery" | "next_step" | null>(null);

  const currentStepData = STEPS[currentStep];
  const CurrentIcon = currentStepData.icon;

  useEffect(() => {
    fetchRestaurants();
    // Fetch user's saved delivery addresses
    supabase
      .from("user_addresses")
      .select("id, label, address_line1, city, is_default")
      .eq("user_id", userId)
      .order("is_default", { ascending: false })
      .then(({ data }) => {
        if (data && data.length > 0) {
          setAddresses(data);
          const def = data.find(a => a.is_default) || data[0];
          setSelectedAddressId(def.id);
        }
      });
  }, []);

  // When opened via the Schedule page auto-fill button, skip mode screen and trigger auto-fill immediately
  useEffect(() => {
    if (autoFill && !autoFillTriggered.current) {
      autoFillTriggered.current = true;
      setLocalSingleMode(false);
      setPhase("scheduling");
      handleAutoFillDay(false);
    }
  }, [autoFill]);

  useEffect(() => {
    if (selectedRestaurant) {
      fetchRestaurantMeals(selectedRestaurant.id);
    }
  }, [selectedRestaurant]);

  const fetchRestaurants = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("restaurants")
        .select(`
          id,
          name,
          description,
          address,
          logo_url,
          rating,
          cuisine_type
        `)
        .eq("approval_status", "approved")
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (error) throw error;
      setRestaurants(data || []);
    } catch (err) {
      console.error("Error fetching restaurants:", err);
      toast({
        title: "Error",
        description: "Failed to load restaurants",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchRestaurantMeals = async (restaurantId: string) => {
    console.log("Fetching meals for restaurant:", restaurantId);
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("meals")
        .select(`
          id,
          name,
          description,
          calories,
          protein_g,
          carbs_g,
          fat_g,
          image_url,
          is_available,
          restaurant_id
        `)
        .eq("restaurant_id", restaurantId)
        .eq("is_available", true)
        .order("name", { ascending: true });

      console.log("Meals query result:", { data, error });

      if (error) {
        console.error("Supabase error:", error);
        throw error;
      }
      
      console.log(`Found ${data?.length || 0} meals`);
      setMeals(data || []);
    } catch (err) {
      console.error("Error fetching meals:", err);
      toast({
        title: "Error",
        description: "Failed to load meals",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Calculate remaining nutrition for the selected date
  const calculateRemainingNutrition = async () => {
    if (!userId) return;

    try {
      // Fetch user's daily targets from profile
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("daily_calorie_target, protein_target_g, carbs_target_g, fat_target_g")
        .eq("id", userId)
        .limit(1);

      if (error) {
        console.error("Error fetching profile:", error);
        return;
      }

      const profile = profiles?.[0];

      if (profile) {
        const targets = {
          calories: profile.daily_calorie_target || 2000,
          protein: profile.protein_target_g || 120,
          carbs: profile.carbs_target_g || 250,
          fat: profile.fat_target_g || 65,
        };

        // Fetch already scheduled meals for this date
        const dateStr = format(selectedDate, "yyyy-MM-dd");
        const { data: scheduledMeals } = await supabase
          .from("meal_schedules")
          .select(`
            meal:meals(
              calories,
              protein_g,
              carbs_g,
              fat_g
            )
          `)
          .eq("user_id", userId)
          .eq("scheduled_date", dateStr);

        // Calculate consumed nutrition
        const consumed = (scheduledMeals || []).reduce(
          (acc, schedule: any) => ({
            calories: acc.calories + (schedule.meal?.calories || 0),
            protein: acc.protein + (schedule.meal?.protein_g || 0),
            carbs: acc.carbs + (schedule.meal?.carbs_g || 0),
            fat: acc.fat + (schedule.meal?.fat_g || 0),
          }),
          { calories: 0, protein: 0, carbs: 0, fat: 0 }
        );

        // Also subtract meals already selected in this wizard session
        const selectedConsumed = Object.values(selectedMeals).reduce(
          (acc, meal) => ({
            calories: acc.calories + (meal?.calories || 0),
            protein: acc.protein + (meal?.protein_g || 0),
            carbs: acc.carbs + (meal?.carbs_g || 0),
            fat: acc.fat + (meal?.fat_g || 0),
          }),
          { calories: 0, protein: 0, carbs: 0, fat: 0 }
        );

        setRemainingNutrition({
          calories: Math.max(0, targets.calories - consumed.calories - selectedConsumed.calories),
          protein: Math.max(0, targets.protein - consumed.protein - selectedConsumed.protein),
          carbs: Math.max(0, targets.carbs - consumed.carbs - selectedConsumed.carbs),
          fat: Math.max(0, targets.fat - consumed.fat - selectedConsumed.fat),
        });
      }
    } catch (err) {
      console.error("Error calculating remaining nutrition:", err);
    }
  };

  // Fetch recommended meals based on remaining nutrition
  const fetchRecommendedMeals = async () => {
    if (!userId || !showRecommendations) return;

    setLoadingRecommendations(true);
    try {
      // Get all available meals
      const { data: allMeals, error: mealsError } = await supabase
        .from("meals")
        .select(`
          id,
          name,
          description,
          calories,
          protein_g,
          carbs_g,
          fat_g,
          image_url,
          is_available,
          restaurant_id
        `)
        .eq("is_available", true)
        .limit(100);

      if (mealsError) throw mealsError;

      // Get all restaurants for lookup
      const { data: restaurantsData, error: restaurantsError } = await supabase
        .from("restaurants")
        .select("id, name, logo_url");

      if (restaurantsError) throw restaurantsError;

      // Create restaurant lookup map
      const restaurantMap = (restaurantsData || []).reduce((acc: Record<string, any>, r: any) => {
        acc[r.id] = r;
        return acc;
      }, {});

      // Filter and score meals based on remaining nutrition
      const scoredMeals = (allMeals || [])
        .map((meal: any) => {
          const calories = meal.calories || 0;
          const protein = meal.protein_g || 0;

          // Calculate score based on how well meal fits remaining targets
          let score = 0;

          // Prefer meals that don't exceed remaining calories
          if (calories <= remainingNutrition.calories * 1.2) {
            score += 50;
          }

          // Bonus for protein content
          if (remainingNutrition.protein > 0 && protein > 0) {
            const proteinRatio = protein / remainingNutrition.protein;
            if (proteinRatio >= 0.15 && proteinRatio <= 0.4) {
              score += 30; // Good protein portion for this meal
            }
          }

          // Prefer meals with reasonable calorie density
          if (calories >= 200 && calories <= 800) {
            score += 20;
          }

          // Attach restaurant data
          const restaurant = restaurantMap[meal.restaurant_id];

          return { ...meal, score, restaurant };
        })
        .filter((meal: any) => meal.score > 30)
        .sort((a: any, b: any) => b.score - a.score)
        .slice(0, 8);

      setRecommendedMeals(scoredMeals);
    } catch (err) {
      console.error("Error fetching recommendations:", err);
    } finally {
      setLoadingRecommendations(false);
    }
  };

  // Update remaining nutrition when step changes or meals are selected
  useEffect(() => {
    calculateRemainingNutrition();
  }, [currentStep, selectedMeals, selectedDate]);

  // Fetch recommendations when nutrition changes
  useEffect(() => {
    fetchRecommendedMeals();
  }, [remainingNutrition, showRecommendations]);

  const [justSelectedId, setJustSelectedId] = useState<string | null>(null);

  const executeNavigation = (nav: "delivery" | "next_step" | null) => {
    if (nav === "delivery") {
      // Close add-ons sheet first, then open delivery picker to avoid stacked overlays
      setShowAddonSheet(false);
      setTimeout(() => setShowDeliveryScheduler(true), 300);
    } else if (nav === "next_step") {
      setSelectedRestaurant(null);
      setMeals([]);
      setCurrentStep(prev => prev + 1);
    }
    setPendingNav(null);
  };

  const openAddonSheet = async (mealId: string, stepKey: string, nav: "delivery" | "next_step" | null) => {
    setAddonStepKey(stepKey);
    setSelectedAddonIds(new Set());
    setPendingNav(nav);
    setAddonLoading(true);
    const { data } = await supabase
      .from("meal_addons")
      .select("id, name, description, price, category")
      .eq("meal_id", mealId)
      .eq("is_available", true)
      .order("category")
      .order("name");
    setAddonLoading(false);
    const addons = (data || []) as AddonItem[];
    setLoadedAddons(addons);
    if (addons.length > 0) {
      setShowAddonSheet(true);
    } else {
      executeNavigation(nav);
    }
  };

  const confirmAddons = () => {
    const chosen = loadedAddons.filter(a => selectedAddonIds.has(a.id));
    setAddonsPerStep(prev => ({ ...prev, [addonStepKey]: chosen }));
    setShowAddonSheet(false);
    executeNavigation(pendingNav);
  };

  const skipAddons = () => {
    setAddonsPerStep(prev => ({ ...prev, [addonStepKey]: [] }));
    setShowAddonSheet(false);
    executeNavigation(pendingNav);
  };

  const closeAddonSheet = () => {
    setSelectedAddonIds(new Set());
    setShowAddonSheet(false);
    setPendingNav(null);
  };

  const toggleAddon = (id: string) => {
    setSelectedAddonIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const addonTotal = loadedAddons
    .filter(a => selectedAddonIds.has(a.id))
    .reduce((sum, a) => sum + a.price, 0);

  const groupedLoadedAddons = loadedAddons.reduce((acc, addon) => {
    if (!acc[addon.category]) acc[addon.category] = [];
    acc[addon.category].push(addon);
    return acc;
  }, {} as Record<string, AddonItem[]>);

  const selectMeal = (meal: Meal) => {
    const stepKey = STEPS[currentStep].id;
    setSelectedMeals(prev => ({
      ...prev,
      [stepKey]: { ...meal, restaurant: selectedRestaurant! }
    }));
    setJustSelectedId(meal.id);

    if (navigator.vibrate) navigator.vibrate([10, 50, 10]);

    const isLastStep = currentStep === STEPS.length - 1;
    const isSingleTarget = localSingleMode && currentStep === initialStep;

    setTimeout(() => {
      setJustSelectedId(null);
      const nav: "delivery" | "next_step" | null =
        isSingleTarget ? "delivery" : !isLastStep ? "next_step" : null;
      openAddonSheet(meal.id, stepKey, nav);
    }, 900);
  };

  const isMealSelected = (mealId: string) => {
    const stepKey = STEPS[currentStep].id;
    return selectedMeals[stepKey]?.id === mealId;
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setSelectedRestaurant(null);
      setMeals([]);
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (selectedRestaurant) {
      setSelectedRestaurant(null);
      setMeals([]);
    } else if (currentStep > (localSingleMode ? initialStep : 0)) {
      setCurrentStep(prev => prev - 1);
    } else {
      // Go back to mode selection
      setPhase("mode");
    }
  };

  const handleComplete = async (deliveryTimeSlot?: string) => {
    setScheduling(true);
    
    try {
      const selectedAddr = addresses.find(a => a.id === selectedAddressId);
      const allSelectedMeals = Object.entries(selectedMeals)
        .filter(([_, meal]) => meal !== null)
        .map(([mealType, meal]) => ({
          user_id: userId,
          meal_id: meal.id,
          restaurant_id: meal.restaurant_id ?? null,
          scheduled_date: format(selectedDate, "yyyy-MM-dd"),
          meal_type: mealType,
          is_completed: false,
          order_status: "pending",
          delivery_type: selectedAddr ? `delivery:${selectedAddressId}` : "delivery",
          ...(selectedAddressId ? { delivery_address_id: selectedAddressId } : {}),
          ...(deliveryTimeSlot ? { delivery_time_slot: deliveryTimeSlot } : {}),
        }));

      if (allSelectedMeals.length === 0) {
        toast({
          title: "No meals selected",
          description: "Please select at least one meal to schedule.",
          variant: "destructive",
        });
        setScheduling(false);
        return;
      }

      // CRITICAL: Check for existing pending schedules on this date
      // This prevents duplicate scheduling when auto-fill runs multiple times
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const { data: existingSchedules, error: existingError } = await supabase
        .from("meal_schedules")
        .select("id, meal_type")
        .eq("user_id", userId)
        .eq("scheduled_date", dateStr)
        .eq("order_status", "pending")
        .neq("order_status", "cancelled");

      if (!existingError && existingSchedules && existingSchedules.length > 0) {
        const existingTypes = existingSchedules.map((s: any) => s.meal_type).join(", ");
        toast({
          title: "Meals already scheduled",
          description: `You already have ${existingSchedules.length} meal(s) scheduled for this day (${existingTypes}). Please cancel existing meals first or choose a different date.`,
          variant: "destructive",
        });
        setScheduling(false);
        return;
      }

      // Check quota before scheduling
      if (!isUnlimited && remainingMeals < allSelectedMeals.length) {
        toast({
          title: "No meals remaining",
          description: `You have ${remainingMeals} meal${remainingMeals === 1 ? "" : "s"} left. You can buy extra meals using your wallet.`,
          variant: "destructive",
        });
        setScheduling(false);
        onCancel();
        navigate("/meals");
        return;
      }

      let quotaIncremented = 0;
      if (!isUnlimited) {
        for (let i = 0; i < allSelectedMeals.length; i++) {
          const ok = await incrementMealUsage();
          if (!ok) {
            if (quotaIncremented > 0) {
              await (supabase.rpc as any)("decrement_monthly_meal_usage", {
                p_subscription_id: subscription!.id,
                p_count: quotaIncremented,
              });
            }
            toast({
              title: "No meals remaining",
              description: "Your quota ran out. You can buy extra meals using your wallet balance.",
              variant: "destructive",
            });
            setScheduling(false);
            onCancel();
            navigate("/meals");
            return;
          }
          quotaIncremented++;
        }
      }

      const { data: insertedSchedules, error } = await supabase
        .from("meal_schedules")
        .insert(allSelectedMeals)
        .select("id, meal_type");

      if (error) {
        if (!isUnlimited && quotaIncremented > 0 && subscription) {
          await (supabase.rpc as any)("decrement_monthly_meal_usage", {
            p_subscription_id: subscription.id,
            p_count: quotaIncremented,
          });
        }
        throw error;
      }

      let addonDebitFailed = false;
      const failedScheduleIds: string[] = [];
      for (const schedule of (insertedSchedules || [])) {
        const addons = addonsPerStep[schedule.meal_type] || [];
        if (addons.length === 0) continue;

        const total = addons.reduce((sum, a) => sum + a.price, 0);

        const { error: debitErr } = await (supabase.rpc as any)("debit_wallet", {
          p_user_id: userId,
          p_amount: total,
          p_reference_type: "order",
          p_description: `Add-ons for ${schedule.meal_type}`,
        });
        if (debitErr) {
          console.error("Wallet debit failed for add-ons:", debitErr);
          addonDebitFailed = true;
          failedScheduleIds.push(schedule.id);
          continue;
        }

        await supabase.from("schedule_addons").insert(
          addons.map(a => ({
            schedule_id: schedule.id,
            addon_id: a.id,
            quantity: 1,
            unit_price: a.price,
          }))
        );
      }

      if (addonDebitFailed && failedScheduleIds.length > 0) {
        const { error: rollbackErr } = await supabase
          .from("meal_schedules")
          .delete()
          .in("id", failedScheduleIds);
        if (rollbackErr) {
          console.error("Failed to rollback schedules after add-on debit failure:", rollbackErr);
        } else if (!isUnlimited && quotaIncremented > 0 && subscription) {
          await (supabase.rpc as any)("decrement_monthly_meal_usage", {
            p_subscription_id: subscription.id,
            p_count: failedScheduleIds.length,
          });
        }
        toast({
          title: "Wallet payment failed",
          description: "Could not charge your wallet for add-ons. Please add wallet balance and try again.",
          variant: "destructive",
        });
        setScheduling(false);
        return;
      }

      if (Object.values(addonsPerStep).some(a => a.length > 0)) {
        refetchWallet();
      }

      setSuccess(true);
      setTimeout(() => {
        onComplete();
      }, 1500);
    } catch (err) {
      console.error("Error scheduling meals:", err);
      toast({
        title: "Error",
        description: "Failed to schedule meals. Please try again.",
        variant: "destructive",
      });
    } finally {
      setScheduling(false);
    }
  };

  const getTotalSelectedMeals = () => {
    return Object.values(selectedMeals).filter(meal => meal !== null).length;
  };

  const hasUnsavedSelections = getTotalSelectedMeals() > 0 || scheduling;

  const blocker = useBlocker(hasUnsavedSelections);

  useEffect(() => {
    if (blocker.state === "blocked") {
      const ok = window.confirm("You have unsaved meal selections. Are you sure you want to leave?");
      if (ok) {
        onCancel();
        blocker.proceed?.();
      } else {
        blocker.reset?.();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocker]);

  useEffect(() => {
    if (!hasUnsavedSelections) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsavedSelections]);

  // Calculate remaining nutrition based on locked meals for suggestions
  const calculateRemainingForSuggestions = (lockedMealsList: any[]) => {
    const totalLockedCalories = lockedMealsList.reduce((sum, meal) => sum + (meal.meal?.calories || 0), 0);
    const totalLockedProtein = lockedMealsList.reduce((sum, meal) => sum + (meal.meal?.protein_g || 0), 0);
    
    return {
      remainingCalories: Math.max(0, 2000 - totalLockedCalories), // Default 2000 if no profile
      remainingProtein: Math.max(0, 120 - totalLockedProtein), // Default 120g if no profile
    };
  };

  // Auto-fill day with Nutrio suggestions
  const handleAutoFillDay = async (isRefresh = false, preferences?: typeof autoFillPreferences) => {
    setAutoFillLoading(true);
    setShowAutoFillPreferences(false);
    if (!isRefresh) {
      setShowAutoFillDialog(true);
      setSelectedSuggestedMeals(new Set());
      setLockedMeals([]);
    }

    try {
      // Calculate remaining nutrition if refreshing with locked meals
      const { remainingCalories, remainingProtein } = calculateRemainingForSuggestions(lockedMeals);
      
      const requestBody: any = {
        user_id: userId,
        week_start_date: format(selectedDate, "yyyy-MM-dd"),
        generate_variations: 1,
      };
      
      // Include user preferences in request
      const prefs = preferences || autoFillPreferences;
      if (prefs.maxCalories && prefs.maxCalories !== 2000) {
        requestBody.max_calories = prefs.maxCalories;
      }
      if (prefs.proteinFocus) {
        requestBody.protein_focus = true;
      }
      if (prefs.vegetarian) {
        requestBody.dietary_restrictions = ['vegetarian'];
      }
      if (prefs.quickPrep) {
        requestBody.quick_prep = true;
      }
      
      // If refreshing with locked meals, send remaining nutrition
      if (isRefresh && lockedMeals.length > 0) {
        requestBody.remaining_calories = remainingCalories;
        requestBody.remaining_protein = remainingProtein;
        requestBody.locked_meal_types = lockedMeals.map(m => m.meal_type);
      }
      
      console.log("Sending request to smart-meal-allocator:", JSON.stringify(requestBody));

      const { data, error } = await supabase.functions.invoke("smart-meal-allocator", {
        body: requestBody,
      });

      console.log("Edge function response:", { data, error });

      // If error is an HTTP error, try to parse the response
      if (error && error.context) {
        try {
          const errorText = await error.context.text();
          console.error("Error response body:", errorText);
          const errorJson = JSON.parse(errorText);
          toast({
            title: "Server Error",
            description: errorJson.error || "Unknown server error",
            variant: "destructive"
          });
          setShowAutoFillDialog(false);
          setAutoFillLoading(false);
          return;
        } catch (parseErr) {
          console.error("Could not parse error response:", parseErr);
        }
      }

      if (error) {
        if (error.message?.includes('CORS') || error.message?.includes('Failed to send') || error.message?.includes('net::ERR')) {
          toast({
            title: "AI Suggestions Unavailable",
            description: "We're having trouble generating suggestions. You can still select meals manually or try again.",
            variant: "destructive",
            action: {
              label: "Try Again",
              onClick: () => handleAutoFillDay(false)
            }
          });
          setShowAutoFillDialog(false);
          setAutoFillLoading(false);
          return;
        }
        throw error;
      }

      if (data?.weekly_plan?.items) {
        // Filter meals for the selected date only
        const dateStr = format(selectedDate, "yyyy-MM-dd");
        let dayMeals = data.weekly_plan.items.filter((item: any) =>
          item.scheduled_date === dateStr
        );

        // If refreshing, merge locked meals with new suggestions
        if (isRefresh && lockedMeals.length > 0) {
          const lockedMealTypes = new Set(lockedMeals.map(m => m.meal_type));
          dayMeals = [
            ...lockedMeals,
            ...dayMeals.filter((item: any) => !lockedMealTypes.has(item.meal_type))
          ];
        }

        if (dayMeals.length > 0) {
          setGeneratedDayPlan(dayMeals);
          // Auto-select all meals initially
          setSelectedSuggestedMeals(new Set(dayMeals.map((_meal: any, index: number) => index)));
        } else {
          toast({
            title: "No suggestions",
            description: "Could not generate suggestions for this day. Please select manually.",
            variant: "destructive"
          });
          setShowAutoFillDialog(false);
        }
      } else {
        toast({
          title: "No meals available",
          description: "Could not generate a meal plan. Try selecting manually.",
          variant: "destructive"
        });
        setShowAutoFillDialog(false);
      }
    } catch (err: any) {
      console.error("Error generating day plan:", err);
      console.error("Error details:", JSON.stringify(err, null, 2));
      if (err.context) {
        console.error("Error context:", err.context);
      }
      toast({
        title: "Error",
        description: err.message || err.error?.message || "Failed to generate meal plan - please try again",
        variant: "destructive",
        action: {
          label: "Try Again",
          onClick: () => handleAutoFillDay(false)
        }
      });
      setShowAutoFillDialog(false);
    } finally {
      setAutoFillLoading(false);
    }
  };

  // Toggle meal selection
  const toggleMealSelection = (index: number) => {
    setSelectedSuggestedMeals(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  // Lock selected meals and refresh others
  const handleRefreshWithLocked = () => {
    // Get selected meals and mark them as locked
    const newlyLocked = generatedDayPlan.filter((_meal: any, index: number) => 
      selectedSuggestedMeals.has(index)
    );
    setLockedMeals(newlyLocked);
    
    // Refresh with remaining nutrition
    handleAutoFillDay(true);
  };

  const applyAutoFillPlan = () => {
    if (!generatedDayPlan || generatedDayPlan.length === 0) return;

    // Only apply selected meals from the generated plan
    const newSelectedMeals = { ...selectedMeals };
    let appliedCount = 0;

    generatedDayPlan.forEach((item: any, index: number) => {
      // Only apply if this meal is selected
      if (selectedSuggestedMeals.has(index)) {
        const mealType = item.meal_type;
        if (STEPS.find(s => s.id === mealType) && item.meal) {
          newSelectedMeals[mealType] = {
            ...item.meal,
            restaurant: item.restaurant || { id: item.meal.restaurant_id, name: "Restaurant", logo_url: null }
          };
          appliedCount++;
        }
      }
    });

    setSelectedMeals(newSelectedMeals);
    setShowAutoFillDialog(false);
    setGeneratedDayPlan(null);
    setSelectedSuggestedMeals(new Set());
    setLockedMeals([]);
    setSelectedRestaurant(null);
    
    // Reset auto-fill state to prevent re-triggering
    if (autoFill) {
      // Get the props and reset them
      setPhase("scheduling");
    }

    if (appliedCount === STEPS.length) {
      // Show plan summary after a small delay to ensure state updates
      setTimeout(() => {
        setCurrentStep(STEPS.length - 1);
        setShowPlanSummary(true);
      }, 50);
    } else {
      toast({
        title: "Meals Added!",
        description: `Added ${appliedCount} meal${appliedCount !== 1 ? 's' : ''} to your schedule.`,
      });
    }
  };

  const getStepSelected = (stepIndex: number) => {
    const stepKey = STEPS[stepIndex].id;
    return selectedMeals[stepKey];
  };

  // ── Mode-selection first screen ─────────────────────────────────────────
  if (phase === "mode") {
    const stepData = STEPS[initialStep];
    const StepIcon = stepData.icon;
    return (
      <div className="fixed inset-0 z-[100] bg-background flex flex-col">

        {/* Top nav bar */}
        <div className="flex items-center justify-between px-4 pt-12 pb-3">
          <button
            onClick={onCancel}
            className="w-10 h-10 rounded-full bg-muted flex items-center justify-center active:scale-90 transition-transform"
          >
            <X className="h-5 w-5 text-foreground" />
          </button>
          <div className="text-center">
            <p className="text-[13px] font-semibold text-foreground">{t("schedule_meal")}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{format(selectedDate, "EEEE, MMMM d")}</p>
          </div>
          <div className="w-10" />
        </div>

        {/* Hero icon + title */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col items-center pt-8 pb-6 px-5"
        >
          <div className={`w-24 h-24 rounded-3xl ${stepData.color} flex items-center justify-center shadow-xl mb-5`}>
            <StepIcon className="h-12 w-12 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground text-center leading-tight">
            {t("how_would_you_schedule")}
          </h1>
          <p className="text-sm text-muted-foreground text-center mt-2 max-w-xs">
            {t("plan_one_or_full_day")}
          </p>
        </motion.div>

        {/* Option cards */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3 }}
          className="flex-1 px-5 flex flex-col gap-3"
        >
          {/* Option 1 — single meal */}
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={handlePickSingleMeal}
            className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl bg-primary text-left active:opacity-90 transition-opacity shadow-lg shadow-primary/25"
          >
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <StepIcon className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-base text-white">{t(stepData.labelKey)} only</p>
              <p className="text-sm text-white/70 mt-0.5">{t("schedule_single_meal_desc")}</p>
            </div>
            <ChevronRight className="h-5 w-5 text-white/80 shrink-0" />
          </motion.button>

          {/* Option 2 — full day */}
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={handlePickFullDay}
            className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl bg-card border border-border text-left active:opacity-90 transition-opacity shadow-sm"
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shrink-0">
              <Calendar className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-base text-foreground">{t("schedule_full_day")}</p>
              <p className="text-sm text-muted-foreground mt-0.5">{t("schedule_full_day_desc")}</p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
          </motion.button>
        </motion.div>

        {/* Bottom spacer */}
        <div className="h-12" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] bg-background">
      {/* Header */}
      <motion.div 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="sticky top-0 z-10 bg-gradient-to-r from-background via-background to-muted/30 border-b border-border/50"
      >
        <div className="flex items-center justify-between p-4">
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="h-5 w-5" />
          </Button>
          <div className="text-center">
            <h1 className="text-lg font-semibold">Schedule Your Day</h1>
            <p className="text-xs text-muted-foreground">{format(selectedDate, "EEEE, MMMM d")}</p>
          </div>
          <div className="w-10" />
        </div>

        {/* Progress Steps — native pill tabs */}
        <div className="px-4 pb-3">
          {/* Thin overall progress bar */}
          <div className="h-0.5 bg-muted rounded-full mb-3 overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              initial={{ width: "0%" }}
              animate={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
              transition={{ duration: 0.45, ease: "easeInOut" }}
            />
          </div>

          {/* Step pills */}
          <div className="flex gap-2">
            {STEPS.map((step, index) => {
              const StepIcon = step.icon;
              const isActive = index === currentStep;
              const hasSelection = getStepSelected(index) !== null;
              const isDone = hasSelection; // only green when a meal is actually selected
              const isLocked = index > currentStep;

              return (
                <motion.button
                  key={step.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.06 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setSelectedRestaurant(null);
                    setMeals([]);
                    setCurrentStep(index);
                  }}
                  className={`relative flex items-center gap-2 px-3 py-2 rounded-2xl transition-all duration-300 overflow-hidden ${
                    isActive
                      ? "flex-1 gradient-primary text-primary-foreground shadow-md shadow-primary/25"
                      : isDone
                      ? "flex-none bg-primary/10 text-primary"
                      : "flex-none bg-muted text-muted-foreground"
                  }`}
                >
                  {/* Icon */}
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                    isActive ? "bg-white/20" : isDone ? "bg-primary/20" : "bg-muted-foreground/10"
                  }`}>
                    {isDone ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <StepIcon className="h-3.5 w-3.5" />
                    )}
                  </div>

                  {/* Label — only visible on active step */}
                  {isActive && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: "auto" }}
                      className="text-sm font-bold whitespace-nowrap pr-1"
                    >
                      {t(step.labelKey)}
                    </motion.span>
                  )}

                  {/* Meal selected dot */}
                  {hasSelection && !isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                  )}
                </motion.button>
              );
            })}

            {/* Step counter badge */}
            <div className="ml-auto flex items-center shrink-0">
              <span className="text-xs font-bold text-muted-foreground bg-muted px-2.5 py-1.5 rounded-full">
                {currentStep + 1}/{STEPS.length}
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Content */}
      <div className="h-[calc(100vh-200px)] overflow-y-auto p-4 pb-28">
        {/* Step Header */}
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className={`rounded-2xl p-4 mb-4 ${currentStepData.lightColor}`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl ${currentStepData.color} flex items-center justify-center text-white`}>
              <CurrentIcon className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold">{t(currentStepData.labelKey)}</h2>
              <p className="text-sm text-muted-foreground">{t(currentStepData.descKey)}</p>
            </div>
           </div>
        </motion.div>

        {/* Selected Meals Summary — shows all selected meals across all steps */}
        {getTotalSelectedMeals() > 0 && !showPlanSummary && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 space-y-2"
          >
            <p className="text-sm font-medium text-muted-foreground">
              {getTotalSelectedMeals()} of {STEPS.length} meals selected
            </p>
            {STEPS.map((step) => {
              const meal = selectedMeals[step.id];
              if (!meal) return null;
              const StepIcon = step.icon;
              return (
                <div key={step.id} className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-2 rounded-xl">
                  <StepIcon className="h-4 w-4 shrink-0 opacity-60" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{meal.name}</p>
                    <p className="text-xs opacity-70">{t(step.labelKey)} · {meal.restaurant?.name}</p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedMeals(prev => ({ ...prev, [step.id]: null as any }));
                      setAddonsPerStep(prev => ({ ...prev, [step.id]: [] }));
                      setSelectedRestaurant(null);
                    }}
                    className="hover:text-destructive shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </motion.div>
        )}

        {/* ── Plan Summary Screen (shown after Auto-fill applies all meals) ── */}
        {showPlanSummary && getTotalSelectedMeals() === STEPS.length ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-4"
          >
            {/* Success header */}
            <div className="flex flex-col items-center text-center py-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-primary flex items-center justify-center mb-3 shadow-lg">
                <Check className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Your Day is Planned!</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {format(selectedDate, "EEEE, MMM d")} · 4 meals ready to schedule
              </p>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => setShowDeliveryScheduler(true)}
                disabled={scheduling}
                className="mt-3 w-full rounded-2xl text-white font-bold text-base flex items-center justify-center gap-2 disabled:opacity-50"
                style={{
                  height: 52,
                  background: "linear-gradient(135deg, #22c55e, #16a34a)",
                  boxShadow: "0 4px 16px rgba(34,197,94,0.35)",
                }}
              >
                {scheduling ? (
                  <><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />Scheduling…</>
                ) : (
                  <><ChefHat className="h-5 w-5" />Schedule All 4 Meals</>
                )}
              </motion.button>
              <button
                onClick={() => setShowPlanSummary(false)}
                className="mt-2 text-xs text-muted-foreground underline-offset-2 hover:underline"
              >
                Edit or add meals manually
              </button>
            </div>

            {/* Meal cards */}
            <div className="space-y-3">
              {STEPS.map((step) => {
                const meal = selectedMeals[step.id];
                if (!meal) return null;
                const StepIcon = step.icon;
                const totalCals = meal.calories ?? 0;
                const totalProt = meal.protein_g ?? 0;
                return (
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-3 bg-white border border-border/50 rounded-2xl p-3 shadow-sm"
                  >
                    <div className={`w-10 h-10 rounded-xl ${step.color} flex items-center justify-center shrink-0`}>
                      <StepIcon className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t(step.labelKey)}</p>
                      <p className="font-semibold text-sm text-slate-900 truncate">{meal.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{meal.restaurant?.name}</p>
                    </div>
                    <div className="text-right shrink-0">
                      {totalCals > 0 && <p className="text-sm font-bold text-primary">{totalCals} kcal</p>}
                      {totalProt > 0 && <p className="text-xs text-muted-foreground">{totalProt}g protein</p>}
                    </div>
                    <button
                      onClick={() => {
                        setSelectedMeals(prev => ({ ...prev, [step.id]: null as any }));
                        setAddonsPerStep(prev => ({ ...prev, [step.id]: [] }));
                        setShowPlanSummary(false);
                      }}
                      className="text-muted-foreground hover:text-destructive shrink-0 ml-1"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </motion.div>
                );
              })}
            </div>

            {/* Nutrition totals */}
            {(() => {
              const allMeals = Object.values(selectedMeals).filter(Boolean);
              const totalCal = allMeals.reduce((s, m) => s + (m?.calories ?? 0), 0);
              const totalProt = allMeals.reduce((s, m) => s + (m?.protein_g ?? 0), 0);
              const totalCarb = allMeals.reduce((s, m) => s + (m?.carbs_g ?? 0), 0);
              const totalFat  = allMeals.reduce((s, m) => s + (m?.fat_g ?? 0), 0);
              return (
                <div className="bg-slate-50 rounded-2xl p-4 grid grid-cols-4 gap-2 text-center">
                  {[
                    { label: "Calories", value: totalCal, unit: "kcal", color: "text-orange-500" },
                    { label: "Protein",  value: totalProt, unit: "g", color: "text-blue-500" },
                    { label: "Carbs",    value: totalCarb, unit: "g", color: "text-amber-500" },
                    { label: "Fat",      value: totalFat,  unit: "g", color: "text-pink-500" },
                  ].map(({ label, value, unit, color }) => (
                    <div key={label}>
                      <p className={`text-lg font-bold ${color}`}>{value}<span className="text-xs font-normal ml-0.5">{unit}</span></p>
                      <p className="text-xs text-muted-foreground">{label}</p>
                    </div>
                  ))}
                </div>
              );
            })()}

          </motion.div>

        ) : (
          <>
          {/* Loading State */}
          {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : selectedRestaurant ? (
          /* Restaurant Meals View */
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            {/* Back to Restaurants Button - Native Mobile Style */}
            <button
              onClick={() => {
                setSelectedRestaurant(null);
                setMeals([]);
              }}
              className="flex items-center gap-1 mb-4 px-3 py-2 -ml-2 text-primary font-medium text-sm active:opacity-60 transition-opacity"
            >
              <ChevronLeft className="h-5 w-5" />
              <span>{t("back_to_restaurants")}</span>
            </button>

            {/* Restaurant Header */}
            <div className="flex items-center gap-3 mb-4 p-3 bg-muted rounded-xl">
              {selectedRestaurant.logo_url ? (
                <img
                  src={selectedRestaurant.logo_url}
                  alt={selectedRestaurant.name}
                  className="w-12 h-12 rounded-xl object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Store className="h-6 w-6 text-primary" />
                </div>
              )}
              <div>
                <h3 className="font-semibold">{selectedRestaurant.name}</h3>
                <p className="text-xs text-muted-foreground">{selectedRestaurant.cuisine_type || 'Various cuisine'}</p>
              </div>
            </div>

            {/* Meals List */}
            {meals.length === 0 ? (
              <div className="text-center py-12">
                <ChefHat className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-muted-foreground">No meals available from this restaurant</p>
              </div>
            ) : (
              <div className="space-y-3">
                <AnimatePresence>
                  {meals.map((meal, index) => (
                    <motion.div
                      key={meal.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => selectMeal(meal)}
                      className={`group cursor-pointer relative overflow-hidden rounded-2xl border-2 transition-all duration-300 ${
                        isMealSelected(meal.id)
                          ? 'border-primary bg-primary/5 shadow-lg shadow-primary/15 scale-[1.01]'
                          : 'border-border bg-card hover:border-primary/30'
                      }`}
                    >
                      {/* Full-card celebration overlay — shows for 900ms on selection */}
                      <AnimatePresence>
                        {justSelectedId === meal.id && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className="absolute inset-0 z-20 rounded-2xl flex flex-col items-center justify-center gap-2"
                            style={{ background: "linear-gradient(135deg, #22c55e 0%, #14b8a6 100%)" }}
                          >
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ type: "spring", stiffness: 500, damping: 22 }}
                              className="w-14 h-14 rounded-full flex items-center justify-center"
                              style={{ background: "rgba(255,255,255,0.25)" }}
                            >
                              <Check className="h-8 w-8 text-white" strokeWidth={3} />
                            </motion.div>
                            <p className="text-white font-bold text-base">{meal.name}</p>
                            {meal.calories && (
                              <p className="text-white/80 text-sm">{meal.calories} cal · {t(currentStepData.labelKey)}</p>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <div className="flex gap-3 p-3">
                        {/* Image */}
                        <div className="relative w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-muted">
                          <img
                            src={getMealImage(meal.image_url, meal.id)}
                            alt={meal.name}
                            className="w-full h-full object-cover"
                          />

                          {/* checkmark on image when already selected */}
                          {isMealSelected(meal.id) && justSelectedId !== meal.id && (
                            <div className="absolute inset-0 bg-primary/70 flex items-center justify-center rounded-xl">
                              <Check className="h-7 w-7 text-white" strokeWidth={3} />
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm truncate">{meal.name}</h3>
                          
                          {meal.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                              {meal.description}
                            </p>
                          )}

                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-0.5">
                              <Flame className="h-3 w-3 text-orange-500" />
                              {meal.calories} cal
                            </span>
                            <span className="flex items-center gap-0.5">
                              <Beef className="h-3 w-3 text-red-500" />
                              {meal.protein_g}g protein
                            </span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        ) : (
          /* Restaurants List View */
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Choose a Restaurant</h3>
            </div>

            {/* Delivery Address banner */}
            {addresses.length > 0 && (() => {
              const addr = addresses.find(a => a.id === selectedAddressId);
              const lbl = addr?.label?.toLowerCase() || "";
              const AddrIcon = lbl === "home" ? Home : (lbl === "work" || lbl === "office") ? Briefcase : MapPin;
              return (
                <button
                  onClick={() => setShowAddressPicker(true)}
                  className="w-full flex items-center gap-3 mb-4 p-3.5 rounded-2xl bg-primary/5 border border-primary/20 active:scale-[0.98] transition-all text-left"
                >
                  <div className="w-10 h-10 rounded-2xl gradient-primary flex items-center justify-center shrink-0 shadow-sm shadow-primary/20">
                    <AddrIcon className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-primary uppercase tracking-wide leading-none mb-0.5">
                      Delivering to
                    </p>
                    {addr ? (
                      <>
                        <p className="font-bold text-sm text-foreground leading-tight">{addr.label}</p>
                        <p className="text-xs text-muted-foreground truncate">{addr.address_line1}, {addr.city}</p>
                      </>
                    ) : (
                      <p className="font-semibold text-sm text-primary">Tap to select address</p>
                    )}
                  </div>
                  <span className="shrink-0 text-xs font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-full">
                    Change
                  </span>
                </button>
              );
            })()}


            {/* Recommended for You Section */}
            {showRecommendations && recommendedMeals.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm">Recommended for You</h3>
                  </div>
                  <button
                    onClick={() => setShowRecommendations(false)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Hide
                  </button>
                </div>

                {/* Remaining Nutrition Badge */}
                <div className="flex flex-wrap gap-2 mb-3">
                  <Badge variant="secondary" className="text-xs">
                    <Target className="h-3 w-3 mr-1" />
                    {remainingNutrition.calories} cal remaining
                  </Badge>
                  <Badge variant="secondary" className="text-xs bg-red-50 text-red-600">
                    <Beef className="h-3 w-3 mr-1" />
                    {remainingNutrition.protein}g protein
                  </Badge>
                </div>

                {/* Recommended Meals Horizontal Scroll */}
                {loadingRecommendations ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
                    {recommendedMeals.map((meal) => (
                      <motion.div
                        key={meal.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        onClick={() => {
                          if (justSelectedId === meal.id) return; // prevent double-tap
                          setJustSelectedId(meal.id);
                          if (navigator.vibrate) navigator.vibrate([10, 50, 10]);
                          const restaurant = restaurants.find(r => r.id === meal.restaurant_id);
                          setTimeout(() => {
                            setJustSelectedId(null);
                            if (restaurant) {
                              setSelectedRestaurant(restaurant);
                              fetchRestaurantMeals(restaurant.id);
                              setTimeout(() => selectMeal(meal), 200);
                            }
                          }, 900);
                        }}
                        className="flex-shrink-0 w-48 cursor-pointer group"
                      >
                        <div className="relative w-full h-32 rounded-xl overflow-hidden bg-muted mb-2">
                          <img
                            src={getMealImage(meal.image_url, meal.id)}
                            alt={meal.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                          {/* Calorie label */}
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                            <p className="text-white text-xs font-medium truncate">
                              {meal.calories} cal
                            </p>
                          </div>
                          {/* Celebration overlay */}
                          <AnimatePresence>
                            {justSelectedId === meal.id && (
                              <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.15 }}
                                className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-xl"
                                style={{ background: "linear-gradient(135deg,#22c55e 0%,#14b8a6 100%)" }}
                              >
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  transition={{ type: "spring", stiffness: 500, damping: 22 }}
                                  className="w-10 h-10 rounded-full flex items-center justify-center"
                                  style={{ background: "rgba(255,255,255,0.25)" }}
                                >
                                  <Check className="h-6 w-6 text-white" strokeWidth={3} />
                                </motion.div>
                                <span className="text-white text-[10px] font-bold">Added!</span>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                        <p className={`text-sm font-medium truncate transition-colors ${justSelectedId === meal.id ? "text-primary" : "group-hover:text-primary"}`}>
                          {meal.name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {meal.restaurant?.name || 'Restaurant'}
                        </p>
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-xs text-red-500 font-medium">
                            {meal.protein_g}g protein
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {restaurants.length === 0 ? (
              <div className="text-center py-12">
                <Store className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-muted-foreground">No restaurants available</p>
              </div>
            ) : (
              <div className="space-y-3">
                <AnimatePresence>
                  {restaurants.map((restaurant, index) => (
                    <motion.div
                      key={restaurant.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => setSelectedRestaurant(restaurant)}
                      className="group cursor-pointer relative overflow-hidden rounded-2xl border-2 border-border bg-card hover:border-primary/50 transition-all duration-300"
                    >
                      <div className="flex items-center gap-4 p-4">
                        {/* Logo */}
                        {restaurant.logo_url ? (
                          <img
                            src={restaurant.logo_url}
                            alt={restaurant.name}
                            className="w-16 h-16 rounded-xl object-cover"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                            <Store className="h-8 w-8 text-primary" />
                          </div>
                        )}

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-lg">{restaurant.name}</h3>
                            {restaurant.rating && restaurant.rating > 0 && (
                              <div className="flex items-center gap-0.5 text-amber-500">
                                <Star className="h-3 w-3 fill-current" />
                                <span className="text-xs font-medium">{restaurant.rating.toFixed(1)}</span>
                              </div>
                            )}
                          </div>
                          
                          {restaurant.cuisine_type && (
                            <Badge variant="secondary" className="mt-1 text-xs">
                              {restaurant.cuisine_type}
                            </Badge>
                          )}

                          {restaurant.address && (
                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {restaurant.address}
                            </p>
                          )}
                        </div>

                        {/* Arrow */}
                        <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        )}
          </>
        )}
      </div>

      {/* Bottom Actions */}
      <motion.div 
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-lg border-t border-border z-40"
        style={{ padding: '16px 16px max(16px, env(safe-area-inset-bottom))' }}
      >

        <div className="flex items-center gap-3">
          {!showPlanSummary && (currentStep > (localSingleMode ? initialStep : 0) || selectedRestaurant || phase === "scheduling") && (
            <Button
              variant="outline"
              className="rounded-xl px-6"
              onClick={handleBack}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              {selectedRestaurant ? 'Restaurants' : 'Back'}
            </Button>
          )}
          
          <div className="flex-1">
            
            {showPlanSummary ? (
              <Button
                className="w-full rounded-xl h-12 text-base font-semibold bg-gradient-to-r from-primary to-emerald-500 hover:opacity-90 shadow-lg"
                onClick={() => setShowDeliveryScheduler(true)}
                disabled={scheduling}
              >
                {scheduling ? (
                  <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />Scheduling…</>
                ) : (
                  <><ChefHat className="h-5 w-5 mr-2" />Schedule All 4 Meals</>
                )}
              </Button>
            ) : currentStep < STEPS.length - 1 ? (
              <Button 
                className="w-full rounded-xl h-12 text-base font-semibold"
                onClick={handleNext}
                disabled={!getStepSelected(currentStep)}
              >
                Continue
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : getTotalSelectedMeals() > 0 ? (
              <Button 
                className="w-full rounded-xl h-12 text-base font-semibold bg-gradient-to-r from-primary to-emerald-500 hover:opacity-90 shadow-lg"
                onClick={() => setShowDeliveryScheduler(true)}
                disabled={scheduling}
              >
                {scheduling ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Scheduling...
                  </>
                ) : (
                  <>
                    <ChefHat className="h-4 w-4 mr-2" />
                    Schedule {getTotalSelectedMeals()} Meal{getTotalSelectedMeals() > 1 ? 's' : ''}
                  </>
                )}
              </Button>
            ) : (
              <Button
                variant="ghost"
                className="w-full rounded-xl h-12 text-base text-muted-foreground"
                onClick={onCancel}
              >
                Select a meal to continue
              </Button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Address Picker Bottom Sheet */}
      <AnimatePresence>
        {showAddressPicker && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddressPicker(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]"
            />

            {/* Sheet */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 350 }}
              className="fixed bottom-0 left-0 right-0 bg-background rounded-t-3xl z-[61] overflow-hidden"
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-10 h-1 rounded-full bg-muted-foreground/25" />
              </div>

              {/* Header */}
              <div className="px-5 pb-4 flex items-center justify-between border-b border-border/60">
                <div>
                  <h3 className="text-lg font-bold text-foreground">Delivery Address</h3>
                  <p className="text-sm text-muted-foreground">Where should we deliver your meals?</p>
                </div>
                <button
                  onClick={() => setShowAddressPicker(false)}
                  className="w-9 h-9 rounded-full bg-muted flex items-center justify-center active:scale-90 transition-transform"
                >
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>

              {/* Address list */}
              <div className="px-4 py-4 space-y-2 max-h-[60vh] overflow-y-auto pb-[env(safe-area-inset-bottom)]">
                {addresses.map((addr) => {
                  const isSelected = selectedAddressId === addr.id;
                  const lbl = addr.label.toLowerCase();
                  const AddrIcon = lbl === "home" ? Home : (lbl === "work" || lbl === "office") ? Briefcase : MapPin;
                  return (
                    <motion.button
                      key={addr.id}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => { setSelectedAddressId(addr.id); setShowAddressPicker(false); }}
                      className={`w-full flex items-center gap-4 p-4 rounded-3xl border-2 text-left transition-all ${
                        isSelected
                          ? "border-primary bg-primary/5 shadow-md shadow-primary/10"
                          : "border-border/70 bg-card/95 hover:border-primary/30"
                      }`}
                    >
                      {/* Icon */}
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                        isSelected ? "gradient-primary shadow-sm shadow-primary/20" : "bg-muted"
                      }`}>
                        <AddrIcon className={`h-6 w-6 ${isSelected ? "text-white" : "text-muted-foreground"}`} />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="font-bold text-foreground">{addr.label}</p>
                          {addr.is_default && (
                            <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                              Default
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">{addr.address_line1}, {addr.city}</p>
                      </div>

                      {/* Selected indicator */}
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border-2 transition-all ${
                        isSelected ? "bg-primary border-primary" : "border-muted-foreground/30"
                      }`}>
                        {isSelected && <Check className="h-3.5 w-3.5 text-white" />}
                      </div>
                    </motion.button>
                  );
                })}

                {/* Add new address link */}
                <button
                  onClick={() => window.open("/addresses", "_blank")}
                  className="w-full flex items-center gap-3 p-4 rounded-3xl border-2 border-dashed border-primary/30 text-primary hover:bg-primary/5 transition-colors"
                >
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                    <MapPin className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-bold text-sm">Add new address</p>
                    <p className="text-xs text-muted-foreground">Opens address manager</p>
                  </div>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Auto-fill Day Dialog - Native Mobile Design */}
      <AnimatePresence>
        {showAutoFillDialog && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAutoFillDialog(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 350 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={0.2}
              onDragEnd={(_, info) => {
                if (info.offset.y > 100) {
                  setShowAutoFillDialog(false);
                }
              }}
              className="fixed bottom-0 left-0 right-0 bg-[#F2F2F7] dark:bg-zinc-950 rounded-t-[32px] z-50 max-h-[85vh] overflow-hidden flex flex-col"
            >
              {/* Native Handle Bar */}
              <div className="flex justify-center pt-2 pb-1">
                <div className="w-9 h-1 bg-zinc-300 dark:bg-zinc-700 rounded-full" />
              </div>

              {/* Header Section */}
              <div className="px-5 pt-2 pb-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary to-emerald-500 flex items-center justify-center shadow-lg shadow-primary/25">
                      <Sparkles className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-[22px] font-bold text-zinc-900 dark:text-white">Nutrio Suggestions</h2>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">Personalized for your goals</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowAutoFillDialog(false)}
                    className="w-9 h-9 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center active:scale-90 transition-transform"
                  >
                    <X className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
                  </button>
                </div>

                {/* Date Pill */}
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-900 rounded-full shadow-sm">
                  <Calendar className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    {format(selectedDate, "EEEE, MMMM d")}
                  </span>
                </div>
              </div>

              {/* Content Area - Scrollable */}
              <div 
                className="flex-1 min-h-0 overflow-y-auto px-5 pb-4 scrollbar-hide relative"
                style={{ maxHeight: 'calc(85vh - 200px)' }}
              >
                {/* Preference Selection - Show before generation */}
                {showAutoFillPreferences && !autoFillLoading && !generatedDayPlan && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <Sparkles className="w-5 h-5 text-primary" />
                      <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
                        Customize Your Day
                      </h3>
                    </div>
                    
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                      Set your preferences (optional) or skip to get AI recommendations based on your profile.
                    </p>

                    {/* Calorie Target */}
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Daily Calorie Target</span>
                        <span className="text-sm font-bold text-primary">{autoFillPreferences.maxCalories} kcal</span>
                      </div>
                      <input 
                        type="range" 
                        min={1200} 
                        max={3000} 
                        step={100}
                        value={autoFillPreferences.maxCalories}
                        onChange={(e) => setAutoFillPreferences(prev => ({ ...prev, maxCalories: parseInt(e.target.value) }))}
                        className="w-full h-2 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-primary"
                      />
                      <div className="flex justify-between text-xs text-zinc-400 mt-1">
                        <span>1200</span>
                        <span>3000</span>
                      </div>
                    </div>

                    {/* Quick Preference Chips */}
                    <div className="space-y-2">
                      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Quick Preferences</span>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => setAutoFillPreferences(prev => ({ ...prev, proteinFocus: !prev.proteinFocus }))}
                          className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                            autoFillPreferences.proteinFocus 
                              ? 'bg-primary text-white' 
                              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                          }`}
                        >
                          <Beef className="w-4 h-4 inline mr-1.5" />
                          High Protein
                        </button>
                        <button
                          onClick={() => setAutoFillPreferences(prev => ({ ...prev, vegetarian: !prev.vegetarian }))}
                          className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                            autoFillPreferences.vegetarian 
                              ? 'bg-emerald-500 text-white' 
                              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                          }`}
                        >
                          <Apple className="w-4 h-4 inline mr-1.5" />
                          Vegetarian
                        </button>
                        <button
                          onClick={() => setAutoFillPreferences(prev => ({ ...prev, quickPrep: !prev.quickPrep }))}
                          className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                            autoFillPreferences.quickPrep 
                              ? 'bg-orange-500 text-white' 
                              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                          }`}
                        >
                          <Flame className="w-4 h-4 inline mr-1.5" />
                          Quick Prep
                        </button>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-2">
                      <Button 
                        variant="outline" 
                        onClick={() => handleAutoFillDay(false, { maxCalories: 2000, proteinFocus: false, vegetarian: false, quickPrep: false })}
                        className="flex-1"
                      >
                        Skip - Use My Profile
                      </Button>
                      <Button 
                        onClick={() => handleAutoFillDay(false, autoFillPreferences)}
                        className="flex-1 bg-gradient-to-r from-primary to-emerald-500 hover:from-primary/90 hover:to-emerald-500/90"
                      >
                        Generate My Day
                        <Sparkles className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </motion.div>
                )}

                {autoFillLoading ? (
                  <div className="space-y-3">
                    {/* Animated header with sparkles */}
                    <div className="flex items-center justify-center gap-2 py-2">
                      <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                      <p className="text-sm font-medium text-zinc-500">Generating your personalized meal plan...</p>
                    </div>

                    {/* Skeleton cards matching expected meal types */}
                    {["breakfast", "lunch", "dinner", "snack"].map((mealType, index) => {
                      const config = STEPS.find(s => s.id === mealType);
                      const MealIcon = config?.icon || ChefHat;
                      const colorClass = config?.color || "bg-primary";
                      
                      return (
                        <motion.div
                          key={mealType}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm border border-zinc-100 dark:border-zinc-800"
                        >
                          <div className="flex gap-4">
                            {/* Image skeleton */}
                            <div className="relative shrink-0">
                              <div className="w-20 h-20 rounded-xl bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
                              {/* Meal type badge skeleton */}
                              <div className={`absolute -top-2 -right-2 w-8 h-8 rounded-full ${colorClass} flex items-center justify-center`}>
                                <MealIcon className="h-4 w-4 text-white opacity-50" />
                              </div>
                            </div>

                            {/* Content skeleton */}
                            <div className="flex-1 space-y-2">
                              <div className="h-5 w-32 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                              <div className="flex items-center gap-1.5">
                                <div className="h-3.5 w-3.5 rounded-full bg-primary/20" />
                                <div className="h-3.5 w-24 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                              </div>
                              <div className="flex gap-2 mt-2">
                                <div className="h-5 w-16 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse" />
                                <div className="h-5 w-14 bg-orange-50 dark:bg-orange-900/20 rounded animate-pulse" />
                                <div className="h-5 w-14 bg-red-50 dark:bg-red-900/20 rounded animate-pulse" />
                              </div>
                            </div>

                            {/* Checkbox skeleton */}
                            <div className="w-7 h-7 rounded-full border-2 border-zinc-200 dark:border-zinc-700" />
                          </div>
                        </motion.div>
                      );
                    })}

                    {/* Loading progress indicator */}
                    <div className="mt-4 px-4">
                      <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-gradient-to-r from-primary to-emerald-500"
                          initial={{ width: "0%" }}
                          animate={{ width: "100%" }}
                          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                        />
                      </div>
                      <p className="text-xs text-zinc-400 text-center mt-2">
                        Analyzing your preferences and nutrition goals
                      </p>
                    </div>
                  </div>
                ) : generatedDayPlan ? (
                  <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 gap-3 mb-5">
                      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-7 h-7 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                            <Flame className="h-4 w-4 text-orange-500" />
                          </div>
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">Calories</span>
                        </div>
                        <p className="text-2xl font-bold text-zinc-900 dark:text-white">
                          {generatedDayPlan.reduce((sum: number, item: any) => sum + (item.meal?.calories || 0), 0)}
                        </p>
                        <p className="text-xs text-zinc-400 dark:text-zinc-500">total today</p>
                      </div>
                      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-7 h-7 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                            <Beef className="h-4 w-4 text-red-500" />
                          </div>
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">Protein</span>
                        </div>
                        <p className="text-2xl font-bold text-zinc-900 dark:text-white">
                          {generatedDayPlan.reduce((sum: number, item: any) => sum + (item.meal?.protein_g || 0), 0)}g
                        </p>
                        <p className="text-xs text-zinc-400 dark:text-zinc-500">total today</p>
                      </div>
                    </div>

                    {/* Meals Header with Refresh */}
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                        {generatedDayPlan.length} Meals
                      </h3>
                      <motion.button
                        onClick={handleRefreshWithLocked}
                        disabled={autoFillLoading}
                        whileTap={{ scale: 0.95 }}
                        className="flex items-center gap-1.5 text-xs text-primary font-medium bg-primary/10 px-3 py-1.5 rounded-full disabled:opacity-50"
                      >
                        {autoFillLoading ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3.5 w-3.5" />
                        )}
                        Refresh
                      </motion.button>
                    </div>

                    <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-3">
                      Tap to select/deselect • Swipe left to get new suggestions
                    </p>
                    
                    {/* Selected/Locked Meals Info */}
                    {lockedMeals.length > 0 && (
                      <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-200 dark:border-amber-800/50 rounded-2xl p-4 mb-4">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                            <Check className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                          </div>
                          <p className="text-sm font-semibold text-amber-900 dark:text-amber-300">
                            {lockedMeals.length} Meal{lockedMeals.length !== 1 ? 's' : ''} Kept
                          </p>
                        </div>
                        <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                          These meals will stay when you refresh. We'll suggest {4 - lockedMeals.length} new 
                          option{(lockedMeals.length !== 3) ? 's' : ''} to fill the remaining spots.
                        </p>
                        <div className="flex gap-2 mt-3">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={handleRefreshWithLocked}
                            disabled={autoFillLoading}
                            className="text-xs border-amber-300 text-amber-700 hover:bg-amber-100"
                          >
                            <RefreshCw className="h-3 w-3 mr-1.5" />
                            Get New Suggestions
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Meal List - Native iOS Cards with Selection */}
                    <div className="space-y-3">
                      {generatedDayPlan.map((item: any, index: number) => {
                        const config = STEPS.find(s => s.id === item.meal_type);
                        const MealTypeIcon = config?.icon || ChefHat;
                        const isSelected = selectedSuggestedMeals.has(index);

                        const handleDragEnd = (_e: any, info: { offset: { x: number } }) => {
                          if (info.offset.x < -80) {
                            handleRefreshWithLocked();
                          }
                        };

                        return (
                          <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ delay: index * 0.08, type: "spring", stiffness: 400 }}
                            whileTap={{ scale: 0.98 }}
                            drag="x"
                            dragConstraints={{ left: 0, right: 0 }}
                            dragElastic={0.3}
                            onDragEnd={handleDragEnd}
                            onClick={() => toggleMealSelection(index)}
                            className={`bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm active:shadow-md transition-all cursor-pointer border-2 ${
                              isSelected ? 'border-primary' : 'border-transparent'
                            }`}
                          >
                            <div className="flex gap-4">
                              {/* Meal Image */}
                              <div className="relative shrink-0">
                                <img
                                  src={getMealImage(item.meal?.image_url, item.meal?.id)}
                                  alt={item.meal?.name || 'Meal'}
                                  className="w-20 h-20 rounded-xl object-cover"
                                />
                                {/* Meal Type Badge */}
                                <div className={`absolute -top-2 -right-2 w-8 h-8 rounded-full ${config?.color || 'bg-primary'} flex items-center justify-center shadow-md`}>
                                  <MealTypeIcon className="h-4 w-4 text-white" />
                                </div>
                              </div>

                              {/* Meal Info */}
                              <div className="flex-1 min-w-0">
                                {/* Meal Name */}
                                <p className="font-semibold text-[17px] text-zinc-900 dark:text-white truncate leading-tight">
                                  {item.meal?.name}
                                </p>
                                
                                {/* Restaurant Name */}
                                <div className="flex items-center gap-1.5 mt-1">
                                  <Store className="h-3.5 w-3.5 text-primary" />
                                  <p className="text-sm text-primary font-medium truncate">
                                    {item.restaurant?.name || t("partner_restaurant")}
                                  </p>
                                </div>
                                
                                {/* Meal Type & Nutrition */}
                                <div className="flex items-center gap-2 mt-2">
                                  <span className="text-xs text-zinc-500 dark:text-zinc-400 capitalize bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                                    {item.meal_type}
                                  </span>
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 text-xs font-medium rounded">
                                    <Flame className="h-3 w-3" />
                                    {item.meal?.calories || 0}
                                  </span>
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs font-medium rounded">
                                    <Beef className="h-3 w-3" />
                                    {item.meal?.protein_g || 0}g
                                  </span>
                                </div>
                              </div>

                              {/* Selection Checkbox */}
                              <div className="flex items-center justify-center">
                                <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-colors ${
                                  isSelected 
                                    ? 'bg-primary border-primary' 
                                    : 'border-zinc-300 dark:border-zinc-600'
                                }`}>
                                  {isSelected && <Check className="h-4 w-4 text-white" />}
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>

                    {/* Bottom Spacer */}
                    <div className="h-2" />
                  </>
                ) : null}
              </div>

              {/* Sticky Action Buttons - iOS Native Style */}
              <div className="shrink-0 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-t border-zinc-200/50 dark:border-zinc-800/50 px-5 pt-3 pb-4">
                {/* Primary Action - Apply Selected */}
                <motion.button
                  onClick={applyAutoFillPlan}
                  disabled={selectedSuggestedMeals.size === 0}
                  whileTap={{ scale: 0.97 }}
                  className="w-full h-[52px] rounded-[14px] bg-primary text-white font-semibold text-[17px] shadow-[0_4px_14px_rgba(34,197,94,0.35)] active:shadow-[0_2px_8px_rgba(34,197,94,0.25)] transition-shadow flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Check className="h-5 w-5" strokeWidth={2.5} />
                  Apply {selectedSuggestedMeals.size} Meal{selectedSuggestedMeals.size !== 1 ? 's' : ''}
                </motion.button>
                
                {/* Secondary Action - Cancel */}
                <motion.button
                  onClick={() => setShowAutoFillDialog(false)}
                  whileTap={{ scale: 0.97 }}
                  className="w-full h-[48px] mt-3 rounded-[14px] text-zinc-500 dark:text-zinc-400 font-medium text-[17px] active:bg-zinc-100 dark:active:bg-zinc-800/50 transition-colors"
                >
                  Cancel
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Add-ons Bottom Sheet */}
      <AnimatePresence>
        {showAddonSheet && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeAddonSheet}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200]"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 350 }}
              className="fixed bottom-0 left-0 right-0 bg-background rounded-t-3xl z-[201] flex flex-col"
              style={{ height: '80vh' }}
            >
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-10 h-1 rounded-full bg-muted-foreground/25" />
              </div>

              <div className="px-5 pb-4 border-b border-border/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5 text-primary" />
                    <h3 className="text-lg font-bold">Add-ons</h3>
                    <span className="text-xs text-muted-foreground">(optional)</span>
                    {/* Count badge — shows how many are selected */}
                    {selectedAddonIds.size > 0 && (
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                        {selectedAddonIds.size}
                      </span>
                    )}
                  </div>
                   <button
                     onClick={closeAddonSheet}
                     className="w-8 h-8 rounded-full bg-muted flex items-center justify-center active:scale-90 transition-transform"
                  >
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
                {addonTotal > 0 && (
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <Wallet className="w-3.5 h-3.5" />
                    <span>
                      Wallet: <span className={`font-semibold ${(wallet?.balance || 0) >= addonTotal ? "text-green-600" : "text-destructive"}`}>{formatCurrency(wallet?.balance || 0)}</span>
                      {" · "}Selected: <span className="font-semibold text-primary">{formatCurrency(addonTotal)}</span>
                    </span>
                  </div>
                )}
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
                {addonLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  Object.entries(groupedLoadedAddons).map(([category, items]) => (
                    <div key={category}>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{category.replace(/_/g, " ")}</p>
                      <div className="space-y-2">
                        {items.map(addon => {
                          const isSelected = selectedAddonIds.has(addon.id);
                          return (
                            <button
                              key={addon.id}
                              type="button"
                              onClick={() => toggleAddon(addon.id)}
                              className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all text-left ${
                                isSelected
                                  ? "border-primary bg-primary/5"
                                  : "border-border bg-card"
                              }`}
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium">{addon.name}</p>
                                {addon.description && (
                                  <p className="text-xs text-muted-foreground">{addon.description}</p>
                                )}
                              </div>
                              <div className="flex items-center gap-2 shrink-0 ml-3">
                                <span className="text-sm font-semibold text-primary">+{formatCurrency(addon.price)}</span>
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                  isSelected ? "bg-primary border-primary" : "border-muted-foreground/40"
                                }`}>
                                  {isSelected && <Check className="w-3 h-3 text-white" />}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="px-5 pt-4 border-t border-border/50 flex gap-3 shrink-0" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
                <Button variant="outline" onClick={skipAddons} className="flex-1 rounded-xl h-12">
                  Skip
                </Button>
                <Button
                  onClick={confirmAddons}
                  className="flex-1 rounded-xl h-12 font-semibold"
                  disabled={addonTotal > 0 && (wallet?.balance || 0) < addonTotal}
                >
                  {addonTotal > 0
                    ? (wallet?.balance || 0) < addonTotal
                      ? "Insufficient balance"
                      : `Confirm · ${formatCurrency(addonTotal)}`
                    : "Confirm"}
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Delivery Time Scheduler */}
      <Dialog open={showDeliveryScheduler} onOpenChange={setShowDeliveryScheduler}>
        <DialogContent className="sm:max-w-md rounded-3xl p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Choose Delivery Time
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
            onSchedule={({ time }) => {
              setShowDeliveryScheduler(false);
              handleComplete(time);
            }}
            onCancel={() => setShowDeliveryScheduler(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Success Overlay */}
      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-background/95 backdrop-blur-xl flex flex-col items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
              className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-400 to-primary flex items-center justify-center mb-6 shadow-2xl"
            >
              <Check className="w-12 h-12 text-white" strokeWidth={3} />
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-2xl font-bold mb-1"
            >
              Your Day is Set! 🎉
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-muted-foreground mb-6"
            >
              {format(selectedDate, "EEEE, MMMM d")} • {getTotalSelectedMeals()} meals scheduled
            </motion.p>
            
            {/* Nutrition Summary */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-gradient-to-r from-primary/5 to-emerald-500/5 rounded-2xl p-4 mb-6 w-full max-w-xs"
            >
              <p className="text-xs font-medium text-muted-foreground mb-3 text-center">Today's Nutrition</p>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div>
                  <p className="text-xl font-bold text-orange-500">
                    {Object.values(selectedMeals).reduce((sum, m) => sum + (m?.calories || 0), 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">kcal</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-red-500">
                    {Object.values(selectedMeals).reduce((sum, m) => sum + (m?.protein_g || 0), 0)}g
                  </p>
                  <p className="text-xs text-muted-foreground">protein</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-amber-500">
                    {Object.values(selectedMeals).reduce((sum, m) => sum + (m?.carbs_g || 0), 0)}g
                  </p>
                  <p className="text-xs text-muted-foreground">carbs</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-pink-500">
                    {Object.values(selectedMeals).reduce((sum, m) => sum + (m?.fat_g || 0), 0)}g
                  </p>
                  <p className="text-xs text-muted-foreground">fat</p>
                </div>
              </div>
            </motion.div>

            {/* Action Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="flex gap-3 w-full max-w-xs"
            >
              <Button 
                variant="outline" 
                onClick={() => navigate("/progress")}
                className="flex-1"
              >
                View Progress
              </Button>
              <Button 
                onClick={() => onComplete()}
                className="flex-1"
              >
                Done
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MealWizard;
