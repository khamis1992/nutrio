import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { trackEvent } from "@/lib/analytics";
import { getQatarDay } from "@/lib/dateUtils";
import {
  getHealthContextRecommendationInput,
  type HealthContextRecommendationInput,
} from "@/lib/health-context";
import {
  deriveMealDeliveryAvailability,
  recommendationSlot,
  type MealDeliveryAvailability,
} from "@/lib/meal-delivery-availability";
import { loadMealRankingCache, saveMealRankingCache } from "@/lib/meal-ranking-cache";
import { recordMealRankingAudit } from "@/lib/meal-ranking-audit";
import { isPhaseOneFeatureEnabled } from "@/lib/phase-one-feature-flags";
import {
  rankMealsV2,
  normalizeMealResponseRankingInput,
  selectMealRecommendationEngine,
  type MealResponseRankingInput,
  type MealRankingCandidate,
  type MealRankingRun,
  type RankedMeal,
} from "@/lib/mealRanking";
import {
  generateAllRecommendations,
  type HealthGoals,
  type MealCandidate,
  type OrderHistoryItem,
  type RecommendationSections,
  type ScoredMeal,
} from "@/lib/recommendation-engine";
interface ProgressRow {
  calories_consumed: number | null;
  protein_consumed_g: number | null;
  carbs_consumed_g: number | null;
  fat_consumed_g: number | null;
  fiber_consumed_g?: number | null;
  updated_at?: string | null;
}

interface MealAllergenRow {
  meal_id: string;
  allergen_id: string;
}

interface ExerciseRow {
  calories_burned: number | null;
  created_at: string | null;
}

interface ProfileSafetyFields {
  allergies?: string[] | null;
}

interface FoodMedicineInteractionRow {
  id: string;
  active_ingredient: string;
  food_ingredient: string;
}

interface FoodMedicineInteractionClient {
  from(table: "food_medicine_interactions"): {
    select(columns: string): {
      in(
        column: "active_ingredient",
        values: string[],
      ): Promise<{ data: FoodMedicineInteractionRow[] | null; error: Error | null }>;
    };
  };
}

const foodMedicineClient = supabase as unknown as FoodMedicineInteractionClient;

interface MealResponseRankingClient {
  rpc(name: "get_my_meal_response_ranking_input"): Promise<{
    data: unknown;
    error: { message?: string } | null;
  }>;
}

const mealResponseRankingClient = supabase as unknown as MealResponseRankingClient;

const currentMealType = (generatedAt: string) =>
  recommendationSlot(generatedAt).mealType;

const latestTimestamp = (values: Array<string | null | undefined>) => {
  const timestamps = values
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  return timestamps[0] ?? null;
};

const normalizeKey = (value: string) => value.trim().toLocaleLowerCase();

function toScoredMeal(meal: RankedMeal): ScoredMeal {
  return {
    id: meal.id,
    name: meal.name,
    image_url: meal.image_url,
    calories: meal.calories,
    protein_g: meal.protein_g,
    carbs_g: meal.carbs_g,
    fat_g: meal.fat_g,
    price: meal.price,
    meal_type: meal.meal_type,
    restaurant_id: meal.restaurant_id,
    restaurant_name: meal.restaurant_name,
    restaurant_logo_url: meal.restaurant_logo_url,
    rating: meal.restaurant_rating,
    total_orders: meal.restaurant_total_orders,
    is_available: meal.is_available,
    ingredients: null,
    score: meal.finalScore,
    reason: meal.explanationCodes[0] ?? "macro_balance",
    finalScore: meal.finalScore,
    componentScores: meal.componentScores,
    explanationCodes: meal.explanationCodes,
    inputFreshness: meal.inputFreshness,
  };
}

function toSections(run: MealRankingRun): RecommendationSections {
  const scored = run.ranked.map(toScoredMeal);
  const mealType = currentMealType(run.generatedAt);
  const matchingTime = scored.filter((meal) => meal.meal_type === mealType);
  return {
    forYou: scored.slice(0, 8),
    byTime: (matchingTime.length > 0 ? matchingTime : scored).slice(0, 6),
    forProtein: scored
      .filter((meal) => (meal.protein_g ?? 0) > 0)
      .sort((a, b) => (b.protein_g ?? 0) - (a.protein_g ?? 0) || b.score - a.score || a.id.localeCompare(b.id))
      .slice(0, 6),
    currentMealType: mealType,
    proteinRemaining: run.remainingNutrition.protein,
  };
}

const emptySections: RecommendationSections = {
  forYou: [],
  byTime: [],
  forProtein: [],
  currentMealType: "dinner",
  proteinRemaining: 0,
};

// The flag switches the complete data path, including V2-only queries and cache.
async function loadLegacyRecommendations(
  userId: string,
  healthGoals: HealthGoals,
  today: string,
) {
  const { data: meals, error: mealsError } = await supabase
    .from("public_meal_catalog" as "meals")
    .select("id, name, image_url, calories, protein_g, carbs_g, fat_g, price, meal_type, restaurant_id, ingredients, is_available, rating")
    .eq("is_available", true)
    .eq("approval_status", "approved")
    .order("rating", { ascending: false })
    .limit(100);
  if (mealsError) throw mealsError;

  const restaurantIds = [...new Set((meals ?? []).map((meal) => meal.restaurant_id).filter(Boolean))] as string[];
  const [restaurantsResult, ordersResult, progressResult] = await Promise.all([
    restaurantIds.length > 0
      ? supabase.from("public_restaurant_catalog" as "restaurants").select("id, name, logo_url, rating, total_orders").in("id", restaurantIds).eq("approval_status", "approved").eq("is_active", true)
      : Promise.resolve({ data: [], error: null }),
    supabase.from("user_orders_view").select("meal_id, meal_name, restaurant_id, meal_type, calories, protein_g, carbs_g, fat_g, order_created_at").eq("user_id", userId).order("order_created_at", { ascending: false }).limit(30),
    supabase.from("progress_logs").select("calories_consumed, protein_consumed_g, carbs_consumed_g, fat_consumed_g").eq("user_id", userId).eq("log_date", today),
  ]);
  const firstError = [restaurantsResult, ordersResult, progressResult].find((result) => result.error)?.error;
  if (firstError) throw firstError;

  const restaurantMap = new Map((restaurantsResult.data ?? []).map((restaurant) => [restaurant.id, restaurant]));
  const candidates: MealCandidate[] = (meals ?? []).flatMap((meal) => {
    const restaurant = meal.restaurant_id ? restaurantMap.get(meal.restaurant_id) : null;
    if (!meal.id || !meal.name || !restaurant) return [];
    return [{
      id: meal.id,
      name: meal.name,
      image_url: meal.image_url,
      calories: meal.calories,
      protein_g: meal.protein_g,
      carbs_g: meal.carbs_g,
      fat_g: meal.fat_g,
      price: meal.price,
      meal_type: meal.meal_type,
      restaurant_id: meal.restaurant_id,
      restaurant_name: restaurant.name || "Restaurant",
      restaurant_logo_url: restaurant.logo_url,
      rating: Number(restaurant.rating || meal.rating || 0),
      total_orders: Number(restaurant.total_orders || 0),
      is_available: meal.is_available,
      ingredients: meal.ingredients,
    }];
  });
  const orders: OrderHistoryItem[] = (ordersResult.data ?? []).flatMap((order) => (
    order.meal_id && order.meal_name && order.restaurant_id && order.meal_type && order.order_created_at
      ? [{
          meal_id: order.meal_id,
          meal_name: order.meal_name,
          restaurant_id: order.restaurant_id,
          meal_type: order.meal_type,
          calories: Number(order.calories ?? 0),
          protein_g: Number(order.protein_g ?? 0),
          carbs_g: Number(order.carbs_g ?? 0),
          fat_g: Number(order.fat_g ?? 0),
          order_created_at: order.order_created_at,
        }]
      : []
  ));
  const logs = (progressResult.data ?? []).map((log) => ({
    meal_type: "logged",
    calories: Number(log.calories_consumed ?? 0),
    protein_g: Number(log.protein_consumed_g ?? 0),
    carbs_g: Number(log.carbs_consumed_g ?? 0),
    fat_g: Number(log.fat_consumed_g ?? 0),
  }));
  return {
    candidates,
    recommendations: generateAllRecommendations(candidates, orders, healthGoals, logs),
  };
}

export function useMealRecommendations() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const {
    subscription,
    loading: subscriptionLoading,
    hasActiveSubscription,
    remainingMeals,
    remainingSnacks,
    isUnlimited,
  } = useSubscription();
  const userId = user?.id;

  const [candidates, setCandidates] = useState<MealCandidate[]>([]);
  const [ranking, setRanking] = useState<MealRankingRun | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendationSections>(emptySections);
  const [engine, setEngine] = useState<"legacy" | "v2">("legacy");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const healthGoals: HealthGoals | null = useMemo(() => {
    if (!profile) return null;
    return {
      daily_calorie_target: profile.daily_calorie_target || 2000,
      protein_target_g: profile.protein_target_g || 150,
      carbs_target_g: profile.carbs_target_g || 200,
      fat_target_g: profile.fat_target_g || 65,
    };
  }, [profile]);

  const fetchData = useCallback(async () => {
    const engineSelection = selectMealRecommendationEngine(
      isPhaseOneFeatureEnabled("rankingV2"),
    );
    const rankingV2Enabled = engineSelection === "v2";
    if (!userId || !healthGoals || (rankingV2Enabled && subscriptionLoading)) {
      if (!userId) setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    const generatedAt = new Date().toISOString();
    const today = getQatarDay();

    try {
      if (!rankingV2Enabled) {
        const legacy = await loadLegacyRecommendations(userId, healthGoals, today);
        setCandidates(legacy.candidates);
        setRecommendations(legacy.recommendations);
        setRanking(null);
        setEngine(engineSelection);
        return;
      }

      const { data: mealsData, error: mealsError } = await supabase
        .from("public_meal_catalog" as "meals")
        .select("id, name, image_url, calories, protein_g, carbs_g, fat_g, fiber_g, price, meal_type, restaurant_id, ingredients, is_available, rating")
        .eq("is_available", true)
        .eq("approval_status", "approved")
        .order("rating", { ascending: false })
        .limit(150);
      if (mealsError) throw mealsError;

      const mealIds = (mealsData ?? []).map((meal) => meal.id);
      const restaurantIds = [...new Set((mealsData ?? []).map((meal) => meal.restaurant_id).filter(Boolean))] as string[];

      const healthContextPromise = getHealthContextRecommendationInput(today).catch(
        (healthContextError): HealthContextRecommendationInput => {
          console.warn(
            "Health context is unavailable for meal ranking",
            healthContextError,
          );
          return { available: false, reason: "request_failed" };
        },
      );
      const mealResponsePromise = mealResponseRankingClient
        .rpc("get_my_meal_response_ranking_input")
        .then(({ data, error }): MealResponseRankingInput => {
          if (error) throw new Error(error.message || "MEAL_RESPONSE_RANKING_INPUT_FAILED");
          return normalizeMealResponseRankingInput(data);
        })
        .catch((mealResponseError): MealResponseRankingInput => {
          console.warn("Meal response evidence is unavailable for meal ranking", mealResponseError);
          return { enabled: false, generatedAt: null, meals: [] };
        });
      const [restaurantsResult, ordersResult, progressResult, preferencesResult, tagsResult, allergensResult, allergenTagsResult, medicationsResult, exerciseResult, walletResult, addressResult, activeGoalResult, mealNutrientsResult, micronutrientsResult, healthContextInput, mealResponseInput] = await Promise.all([
        restaurantIds.length > 0
          ? supabase.from("public_restaurant_catalog" as "restaurants").select("id, name, logo_url, rating, total_orders, avg_prep_time_minutes, operating_hours, updated_at").in("id", restaurantIds).eq("approval_status", "approved").eq("is_active", true)
          : Promise.resolve({ data: [], error: null }),
        supabase.from("user_orders_view").select("meal_id, meal_name, restaurant_id, meal_type, calories, protein_g, carbs_g, fat_g, order_created_at").eq("user_id", userId).order("order_created_at", { ascending: false }).limit(30),
        supabase.from("progress_logs").select("calories_consumed, protein_consumed_g, carbs_consumed_g, fat_consumed_g, fiber_consumed_g, updated_at").eq("user_id", userId).eq("log_date", today),
        supabase.from("user_dietary_preferences").select("diet_tag_id, created_at").eq("user_id", userId),
        mealIds.length > 0
          ? supabase.from("meal_diet_tags").select("meal_id, diet_tag_id").in("meal_id", mealIds)
          : Promise.resolve({ data: [], error: null }),
        mealIds.length > 0
          ? supabase.from("meal_allergens" as "meal_diet_tags").select("*").in("meal_id", mealIds)
          : Promise.resolve({ data: [], error: null }),
        supabase.from("allergen_tags").select("id, name"),
        supabase.from("user_medications").select("active_ingredient, updated_at").eq("user_id", userId),
        supabase.from("exercise_logs").select("calories_burned, created_at").eq("user_id", userId).eq("date", today),
        supabase.from("customer_wallets").select("balance, is_active, updated_at").eq("user_id", userId).maybeSingle(),
        supabase.from("user_addresses").select("id, updated_at").eq("user_id", userId).order("is_default", { ascending: false }).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("nutrition_goals").select("goal_type, daily_calorie_target, protein_target_g, carbs_target_g, fat_target_g, fiber_target_g, updated_at").eq("user_id", userId).eq("is_active", true).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        mealIds.length > 0
          ? supabase.from("meals").select("id, fiber_g, sodium_mg, nutrient_missing_codes").in("id", mealIds)
          : Promise.resolve({ data: [], error: null }),
        supabase.rpc("get_user_micronutrient_adequacy", { p_start_date: today, p_end_date: today }),
        healthContextPromise,
        mealResponsePromise,
      ]);

      const requiredResults = [restaurantsResult, ordersResult, progressResult, preferencesResult, tagsResult, allergensResult, allergenTagsResult, medicationsResult, exerciseResult, walletResult, addressResult, activeGoalResult, mealNutrientsResult, micronutrientsResult];
      const firstError = requiredResults.find((result) => result.error)?.error;
      if (firstError) throw firstError;

      const medicationIngredients = new Set(
        (medicationsResult.data ?? []).map((item) => normalizeKey(item.active_ingredient)),
      );
      const { data: interactionRows, error: interactionError } = medicationIngredients.size > 0
        ? await foodMedicineClient
          .from("food_medicine_interactions")
          .select("id, active_ingredient, food_ingredient")
          .in("active_ingredient", [...medicationIngredients])
        : { data: [], error: null };
      if (interactionError) throw interactionError;

      const restaurantMap = new Map((restaurantsResult.data ?? []).map((restaurant) => [restaurant.id, restaurant]));
      const slot = recommendationSlot(generatedAt);
      const representativeMeals = new Map<string, string>();
      for (const meal of mealsData ?? []) {
        if (meal.restaurant_id && meal.id && !representativeMeals.has(meal.restaurant_id)) {
          representativeMeals.set(meal.restaurant_id, meal.id);
        }
      }
      const availabilityRows = await Promise.all(
        [...representativeMeals.entries()].map(async ([restaurantId, mealId]) => {
          const { data, error: routingError } = await supabase.rpc(
            "route_meal_schedule_branch",
            {
              p_restaurant_id: restaurantId,
              p_meal_id: mealId,
              p_delivery_address_id: addressResult.data?.id ?? null,
              p_scheduled_date: today,
              p_delivery_time_slot: slot.timeSlot,
              p_meal_type: slot.mealType,
            } as never,
          );
          if (routingError) throw routingError;
          const restaurant = restaurantMap.get(restaurantId);
          return [
            restaurantId,
            deriveMealDeliveryAvailability({
              generatedAt,
              operatingHours: restaurant?.operating_hours,
              restaurantPrepMinutes: restaurant?.avg_prep_time_minutes ?? null,
              routingResult: data,
            }),
          ] as const;
        }),
      );
      const deliveryByRestaurant = new Map<string, MealDeliveryAvailability>(availabilityRows);
      const nutrientByMeal = new Map((mealNutrientsResult.data ?? []).map((meal) => [meal.id, meal]));
      const mealTagMap = new Map<string, string[]>();
      for (const item of tagsResult.data ?? []) {
        mealTagMap.set(item.meal_id, [...(mealTagMap.get(item.meal_id) ?? []), item.diet_tag_id]);
      }
      const mealAllergenMap = new Map<string, string[]>();
      for (const item of (allergensResult.data ?? []) as unknown as MealAllergenRow[]) {
        mealAllergenMap.set(item.meal_id, [...(mealAllergenMap.get(item.meal_id) ?? []), item.allergen_id]);
      }

      const profileSafety = profile as typeof profile & ProfileSafetyFields;
      const hasAllergyData = Object.prototype.hasOwnProperty.call(profile ?? {}, "allergies");
      const profileAllergies = profileSafety?.allergies ?? [];
      const allergenNameMap = new Map((allergenTagsResult.data ?? []).map((item) => [normalizeKey(item.name), item.id]));
      const userAllergenIds = profileAllergies
        .map((name) => allergenNameMap.get(normalizeKey(name)))
        .filter((id): id is string => Boolean(id));

      const typedCandidates: MealCandidate[] = (mealsData ?? [])
        .filter((meal) => Boolean(meal.restaurant_id && restaurantMap.has(meal.restaurant_id)))
        .map((meal) => {
          const restaurant = restaurantMap.get(meal.restaurant_id!);
          return {
            id: meal.id,
            name: meal.name,
            image_url: meal.image_url,
            calories: meal.calories,
            protein_g: meal.protein_g,
            carbs_g: meal.carbs_g,
            fat_g: meal.fat_g,
            price: meal.price,
            meal_type: meal.meal_type,
            restaurant_id: meal.restaurant_id,
            restaurant_name: restaurant?.name || "Restaurant",
            restaurant_logo_url: restaurant?.logo_url || null,
            rating: Number(restaurant?.rating || meal.rating || 0),
            total_orders: Number(restaurant?.total_orders || 0),
            is_available: meal.is_available,
            ingredients: meal.ingredients,
          };
        });

      const typedOrders: OrderHistoryItem[] = (ordersResult.data ?? []).flatMap((order) => {
        if (!order.meal_id || !order.meal_name || !order.restaurant_id || !order.meal_type || !order.order_created_at) {
          return [];
        }

        return [{
          meal_id: order.meal_id,
          meal_name: order.meal_name,
          restaurant_id: order.restaurant_id,
          meal_type: order.meal_type,
          calories: Number(order.calories ?? 0),
          protein_g: Number(order.protein_g ?? 0),
          carbs_g: Number(order.carbs_g ?? 0),
          fat_g: Number(order.fat_g ?? 0),
          order_created_at: order.order_created_at,
        }];
      });
      const progressRows = (progressResult.data ?? []) as ProgressRow[];
      const consumed = progressRows.reduce((total, item) => ({
        calories: total.calories + Number(item.calories_consumed || 0),
        protein: total.protein + Number(item.protein_consumed_g || 0),
        carbs: total.carbs + Number(item.carbs_consumed_g || 0),
        fat: total.fat + Number(item.fat_consumed_g || 0),
        fiber: total.fiber + Number(item.fiber_consumed_g || 0),
      }), { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
      const favoriteRestaurantIds = [...new Set(typedOrders.slice(0, 12).map((order) => order.restaurant_id).filter(Boolean))];
      const favoriteMealTypes = [...new Set(typedOrders.slice(0, 12).map((order) => order.meal_type).filter(Boolean))];
      const frequency = new Map<string, number>();
      for (const order of typedOrders) frequency.set(order.meal_id, (frequency.get(order.meal_id) ?? 0) + 1);
      const favoriteMealIds = [...frequency.entries()].filter(([, count]) => count >= 2).map(([id]) => id);
      const activeInteractions = (interactionRows ?? []).filter((row) => medicationIngredients.has(normalizeKey(row.active_ingredient)));
      const mealCreditsAvailable = hasActiveSubscription && (isUnlimited || remainingMeals > 0);
      const snackCreditsAvailable = hasActiveSubscription && (isUnlimited || remainingSnacks > 0);
      const extraCreditPrice = Number(subscription?.price_per_meal ?? 50);
      const walletBalance = Number(walletResult.data?.balance ?? 0);
      const walletPurchaseAvailable = Boolean(
        hasActiveSubscription
        && walletResult.data?.is_active === true
        && Number.isFinite(extraCreditPrice)
        && extraCreditPrice > 0
        && walletBalance >= extraCreditPrice,
      );

      const rankingCandidates: MealRankingCandidate[] = typedCandidates.map((candidate) => {
        const searchable = normalizeKey(`${candidate.name} ${candidate.ingredients ?? ""}`);
        const delivery = candidate.restaurant_id
          ? deliveryByRestaurant.get(candidate.restaurant_id)
          : null;
        const isSnack = candidate.meal_type === "snack" || candidate.meal_type === "snacks";
        const nutrients = nutrientByMeal.get(candidate.id);
        return {
          id: candidate.id,
          name: candidate.name,
          calories: candidate.calories,
          image_url: candidate.image_url,
          restaurant_id: candidate.restaurant_id,
          is_available: candidate.is_available,
          restaurant_name: candidate.restaurant_name,
          restaurant_logo_url: candidate.restaurant_logo_url,
          restaurant_rating: candidate.rating,
          restaurant_total_orders: candidate.total_orders,
          price: candidate.price,
          protein_g: candidate.protein_g,
          carbs_g: candidate.carbs_g,
          fat_g: candidate.fat_g,
          fiber_g: nutrients?.fiber_g ?? null,
          sodium_mg: nutrients?.sodium_mg ?? null,
          nutrientMissingCodes: nutrients?.nutrient_missing_codes ?? [],
          meal_type: candidate.meal_type,
          restaurantValid: restaurantMap.has(candidate.restaurant_id ?? ""),
          allergenIds: mealAllergenMap.get(candidate.id) ?? [],
          dietTagIds: mealTagMap.get(candidate.id) ?? [],
          medicineConflictCodes: activeInteractions
            .filter((interaction) => searchable.includes(normalizeKey(interaction.food_ingredient)))
            .map((interaction) => interaction.id),
          creditEligible: mealCreditsAvailable && (!isSnack || snackCreditsAvailable),
          walletPurchaseEligible: !isSnack && walletPurchaseAvailable,
          deliveryAvailable: delivery?.deliveryAvailable ?? null,
          deliveryMinutes: delivery?.deliveryMinutes ?? null,
        };
      });

      const exerciseRows = (exerciseResult.data ?? []) as ExerciseRow[];
      const caloriesBurned = exerciseRows.reduce((sum, item) => sum + Number(item.calories_burned || 0), 0);
      const dietaryRestrictions = (preferencesResult.data ?? []).map((item) => item.diet_tag_id);
      const measuredNutrients = (micronutrientsResult.data ?? []).filter((item) => item.measured_entries > 0);
      const missingNutrientCodes = (micronutrientsResult.data ?? [])
        .filter((item) => item.measured_entries === 0 || item.missing_entries > 0)
        .map((item) => item.nutrient_code);
      const consumedSodium = measuredNutrients.find((item) => item.nutrient_code === "sodium_mg")?.consumed ?? null;
      const activeGoal = activeGoalResult.data;
      const run = rankMealsV2(rankingCandidates, {
        generatedAt,
        goalType: activeGoal?.goal_type ?? null,
        targets: {
          dailyCalories: activeGoal?.daily_calorie_target ?? healthGoals.daily_calorie_target,
          proteinTarget: activeGoal?.protein_target_g ?? healthGoals.protein_target_g,
          carbsTarget: activeGoal?.carbs_target_g ?? healthGoals.carbs_target_g,
          fatTarget: activeGoal?.fat_target_g ?? healthGoals.fat_target_g,
          fiberTarget: activeGoal?.fiber_target_g ?? null,
          sodiumLimitMg: 2300,
        },
        consumed: {
          ...consumed,
          sodiumMg: consumedSodium,
          measuredNutrientCodes: measuredNutrients.map((item) => item.nutrient_code),
          missingNutrientCodes,
        },
        preferences: {
          preferredRestaurants: favoriteRestaurantIds,
          favoriteMealTypes,
          favoriteMealIds,
          dietaryRestrictions,
        },
        userAllergenIds,
        recentMealIds: typedOrders.slice(0, 8).map((order) => order.meal_id),
        recentMealTypes: typedOrders.slice(0, 8).map((order) => order.meal_type),
        activity: caloriesBurned > 0
          ? { caloriesBurned, measuredAt: latestTimestamp(exerciseRows.map((item) => item.created_at)) }
          : null,
        healthContext: healthContextInput.available
          ? {
              available: true,
              sourceDate: healthContextInput.source_date ?? null,
              freshnessDays: healthContextInput.freshness_days ?? null,
              mood: healthContextInput.mood ?? null,
              stress: healthContextInput.stress ?? null,
              appetite: healthContextInput.appetite ?? null,
              energy: healthContextInput.energy ?? null,
              digestiveSymptoms: healthContextInput.digestive_symptoms ?? [],
              symptomSeverity: healthContextInput.symptom_severity ?? null,
              cyclePhase: healthContextInput.cycle_phase ?? null,
              explanationCodes: healthContextInput.explanation_codes ?? [],
            }
          : null,
        mealResponse: mealResponseInput,
        commercial: {
          mode: hasActiveSubscription ? "flexible" : "credits_only",
          remainingCredits: isUnlimited ? 999_999 : hasActiveSubscription ? remainingMeals : 0,
          maxPrice: null,
          walletOrCardAvailable: walletPurchaseAvailable,
        },
        delivery: { maxMinutes: null },
        inputUpdatedAt: {
          goals: activeGoal?.updated_at ?? profile?.updated_at,
          consumption: latestTimestamp(progressRows.map((item) => item.updated_at)) ?? generatedAt,
          preferences: latestTimestamp((preferencesResult.data ?? []).map((item) => item.created_at)) ?? generatedAt,
          safety: hasAllergyData ? generatedAt : null,
          availability: latestTimestamp([
            ...Array.from(deliveryByRestaurant.values(), (item) => item.routedAt),
            ...(restaurantsResult.data ?? []).map((restaurant) => restaurant.updated_at),
            addressResult.data?.updated_at,
          ]),
          commercial: latestTimestamp([
            subscription?.updated_at,
            walletResult.data?.updated_at,
          ]),
        },
      });

      setCandidates(typedCandidates);
      setRanking(run);
      setRecommendations(toSections(run));
      setEngine("v2");
      saveMealRankingCache(userId, run);
      if (isPhaseOneFeatureEnabled("rankingV2")) {
        void recordMealRankingAudit(run);
      }
      trackEvent("meal_ranking_generated", {
        engine_version: run.engineVersion,
        candidate_count: rankingCandidates.length,
        ranked_count: run.ranked.length,
        excluded_count: run.excluded.length,
        stale_input_count: Object.values(run.inputFreshness).filter((state) => state !== "fresh").length,
        health_context_applied: run.healthContextApplied,
        health_context_codes: run.healthContextCodes,
        meal_response_applied: run.mealResponseApplied,
        meal_response_meal_count: (run.mealResponseMealIds ?? []).length,
        offline: false,
      });
    } catch (fetchError) {
      console.error("Error fetching recommendation data:", fetchError);
      const cached = rankingV2Enabled ? loadMealRankingCache(userId) : null;
      if (cached && cached.ranked.every((meal) => meal.deliveryAvailable === true)) {
        setRanking(cached);
        trackEvent("meal_ranking_offline_fallback", {
          engine_version: cached.engineVersion,
          ranked_count: cached.ranked.length,
        });
      } else {
        setError(fetchError instanceof Error ? fetchError : new Error("MEAL_RANKING_FAILED"));
      }
    } finally {
      setLoading(false);
    }
  }, [hasActiveSubscription, healthGoals, isUnlimited, profile, remainingMeals, remainingSnacks, subscription, subscriptionLoading, userId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  return {
    recommendations,
    candidates,
    ranking,
    engine,
    loading,
    error,
    offline: ranking?.offline ?? false,
    refresh: fetchData,
  };
}
