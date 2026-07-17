// Layer 2: Smart Meal Allocation Engine
// Generates meal plans based on nutrition targets, preferences, and restaurant capacity
// Uses optimization algorithm with variety constraints

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  assertSelfOrAdmin,
  authenticateRequest,
  enforceRateLimit,
  errorResponse,
  getCorsHeaders,
  getServiceClient,
  handlePreflight,
  HttpError,
  readJsonBody,
  requirePost,
} from "../_shared/security.ts";
import {
  createAllocationExecutionBudget as createExecutionBudget,
  type AllocationExecutionBudget,
  type AllocationNow,
} from "./execution-budget.ts";

const MAX_VARIATIONS = 3;
const MAX_CATALOG_ROWS = 1_000;
const MAX_ALLOCATION_RUNTIME_MS = 20_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ALLOWED_MEAL_TYPES = new Set(["breakfast", "lunch", "dinner", "snack"]);
const BUDGET_CHECK_INTERVAL = 64;

function allocationBudgetExceeded(stage: string): HttpError {
  const error = new HttpError(
    503,
    "allocation_budget_exceeded",
    "Meal allocation exceeded its execution budget",
  ) as HttpError & { stage: string };
  error.stage = stage;
  return error;
}

function createAllocationExecutionBudget(
  maxRuntimeMs = MAX_ALLOCATION_RUNTIME_MS,
  now: AllocationNow = Date.now,
  parentSignal?: AbortSignal,
): AllocationExecutionBudget {
  return createExecutionBudget(
    maxRuntimeMs,
    now,
    parentSignal,
    allocationBudgetExceeded,
  );
}

interface Meal {
  id: string;
  restaurant_id: string;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  meal_type?: string;
  is_available: boolean;
}

interface NutritionTargets {
  daily_calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

interface UserPreferences {
  cuisine_preferences: string[];
  dietary_restrictions: string[];
  allergies: string[];
  disliked_ingredients: string[];
  preferred_meal_times: Record<string, string>;
  variety_preference: number;
}

interface PlanItem {
  day: number; // 0-6 (Sunday-Saturday)
  meal_type: "breakfast" | "lunch" | "dinner" | "snack";
  meal_id: string;
  restaurant_id: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

interface WeeklyPlan {
  plan_items: PlanItem[];
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fats: number;
  macro_compliance_score: number;
  variety_score: number;
}

// Score a meal based on macro match
function scoreMealMacroMatch(meal: Meal, targetCalories: number, targetProtein: number): number {
  // Calorie match (0-40 points)
  const calorieDiff = Math.abs(meal.calories - targetCalories);
  const calorieScore = Math.max(0, 40 - (calorieDiff / Math.max(targetCalories, 1) * 40));
  
  // Protein match (0-40 points) - prioritize protein
  const proteinDiff = Math.abs(meal.protein_g - targetProtein);
  const proteinScore = Math.max(0, 40 - (proteinDiff / Math.max(targetProtein, 1) * 40));
  
  // Macro balance (0-20 points)
  const totalMacros = meal.protein_g + meal.carbs_g + meal.fat_g;
  if (totalMacros === 0) return 0;
  
  const proteinPct = meal.protein_g / totalMacros;
  const idealProteinPct = 0.30; // 30% protein target
  const balanceScore = Math.max(0, 20 - Math.abs(proteinPct - idealProteinPct) * 100);
  
  return calorieScore + proteinScore + balanceScore;
}

// Filter meals based on dietary restrictions and allergies
function filterValidMeals(
  meals: Meal[],
  preferences: UserPreferences,
  budget: AllocationExecutionBudget,
  stage: string,
): Meal[] {
  return meals.filter((meal, index) => {
    if (index % BUDGET_CHECK_INTERVAL === 0) budget.check(stage);

    // Check availability
    if (!meal.is_available) return false;
    
    // Note: Dietary restrictions, allergies and ingredients would need more sophisticated checking
    // This is simplified - in production, you'd check meal ingredients against user preferences
    
    return true;
  });
}

function selectBestMeal(
  validMeals: Meal[],
  planItems: PlanItem[],
  targets: { calories: number; protein: number },
  budget: AllocationExecutionBudget,
  stage: string,
): Meal | null {
  let selectedMeal: Meal | null = null;
  let selectedScore = Number.NEGATIVE_INFINITY;

  for (let index = 0; index < validMeals.length; index += 1) {
    if (index % BUDGET_CHECK_INTERVAL === 0) budget.check(stage);
    const meal = validMeals[index];
    const macroScore = scoreMealMacroMatch(meal, targets.calories, targets.protein);
    const varietyScore = calculateVarietyScore(planItems, meal);
    const totalScore = macroScore * 0.7 + varietyScore * 0.3;

    if (totalScore > selectedScore) {
      selectedMeal = meal;
      selectedScore = totalScore;
    }
  }

  budget.check(stage);
  return selectedMeal;
}

function shuffleMeals(
  meals: Meal[],
  budget: AllocationExecutionBudget,
): Meal[] {
  const shuffled = [...meals];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    if (index % BUDGET_CHECK_INTERVAL === 0) budget.check("weekly.shuffle");
    const replacementIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[replacementIndex]] = [shuffled[replacementIndex], shuffled[index]];
  }
  budget.check("weekly.shuffle");
  return shuffled;
}

// Score meals for variety
function calculateVarietyScore(
  selectedMeals: PlanItem[],
  newMeal: Meal
): number {
  let score = 100;
  
  // Penalize same restaurant
  const sameRestaurantCount = selectedMeals.filter(
    item => item.restaurant_id === newMeal.restaurant_id
  ).length;
  score -= sameRestaurantCount * 20;
  
  // Penalize same meal
  const sameMealCount = selectedMeals.filter(
    item => item.meal_id === newMeal.id
  ).length;
  score -= sameMealCount * 50;
  
  return Math.max(0, score);
}

// Calculate target macros per meal type based on remaining nutrition
function calculateMealTargets(
  remainingCalories: number,
  remainingProtein: number,
  remainingCarbs: number,
  remainingFats: number,
  mealTypesNeeded: string[]
): Record<string, { calories: number; protein: number; carbs: number; fats: number }> {
  const numMeals = mealTypesNeeded.length;
  if (numMeals === 0) return {};
  
  // Distribution ratios for different meal types
  const ratios: Record<string, number> = {
    breakfast: 0.25,
    lunch: 0.35,
    dinner: 0.30,
    snack: 0.10,
  };
  
  // Normalize ratios for only the meal types we need
  const neededRatio = mealTypesNeeded.reduce((sum, type) => sum + (ratios[type] || 0.25), 0);
  const normalizedRatios: Record<string, number> = {};
  mealTypesNeeded.forEach(type => {
    normalizedRatios[type] = (ratios[type] || 0.25) / neededRatio;
  });
  
  const targets: Record<string, { calories: number; protein: number; carbs: number; fats: number }> = {};
  
  mealTypesNeeded.forEach(type => {
    const ratio = normalizedRatios[type];
    targets[type] = {
      calories: Math.round(remainingCalories * ratio),
      protein: Math.round(remainingProtein * ratio),
      carbs: Math.round(remainingCarbs * ratio),
      fats: Math.round(remainingFats * ratio),
    };
  });
  
  return targets;
}

// Generate daily plan using remaining nutrition targets
async function generateDailyPlan(
  userId: string,
  dateStr: string,
  availableMeals: Meal[],
  nutritionTargets: NutritionTargets,
  preferences: UserPreferences,
  supabaseClient: any,
  budget: AllocationExecutionBudget,
  options: {
    remaining_calories?: number;
    remaining_protein?: number;
    locked_meal_types?: string[];
  } = {}
): Promise<{ plan_items: PlanItem[]; total_calories: number; total_protein: number }> {
  budget.check("daily.start");
  const planItems: PlanItem[] = [];
  const usedRestaurants = new Map<string, number>();
  
  // Determine which meal types to generate
  const allMealTypes = ["breakfast", "lunch", "dinner", "snack"];
  const lockedTypes = new Set(options.locked_meal_types || []);
  const mealTypesToGenerate = allMealTypes.filter(type => !lockedTypes.has(type));
  
  console.log("Meal allocation slots prepared", {
    generated_count: mealTypesToGenerate.length,
    locked_count: lockedTypes.size,
  });
  
  // Use remaining nutrition if provided, otherwise use full targets
  const remainingCalories = options.remaining_calories ?? nutritionTargets.daily_calories;
  const remainingProtein = options.remaining_protein ?? nutritionTargets.protein;
  const remainingCarbs = nutritionTargets.carbs * (remainingCalories / nutritionTargets.daily_calories);
  const remainingFats = nutritionTargets.fats * (remainingCalories / nutritionTargets.daily_calories);
  
  console.log("Remaining nutrition budget prepared");
  
  // Calculate targets per meal type
  const mealTargets = calculateMealTargets(
    remainingCalories,
    remainingProtein,
    remainingCarbs,
    remainingFats,
    mealTypesToGenerate
  );
  
  // Generate for each meal type
  for (const mealType of mealTypesToGenerate) {
    budget.check("daily.meal_slot");

    // Skip snacks if calories are tight
    if (mealType === "snack" && remainingCalories < 1800) {
      continue;
    }
    
    const targets = mealTargets[mealType];
    if (!targets) continue;
    
    // Filter valid meals
    const validMeals = filterValidMeals(
      availableMeals,
      preferences,
      budget,
      "daily.filter_available",
    ).filter((meal, index) => {
        if (index % BUDGET_CHECK_INTERVAL === 0) budget.check("daily.filter_variety");
        // Enforce variety: max 2 meals from same restaurant
        const restaurantCount = usedRestaurants.get(meal.restaurant_id) || 0;
        return restaurantCount < 2;
      });
    
    if (validMeals.length === 0) {
      console.warn(`No valid meals for ${mealType}`);
      continue;
    }
    
    const selectedMeal = selectBestMeal(
      validMeals,
      planItems,
      targets,
      budget,
      "daily.score_meals",
    );
    if (!selectedMeal) continue;
    
    planItems.push({
      day: 0, // Single day
      meal_type: mealType as "breakfast" | "lunch" | "dinner" | "snack",
      meal_id: selectedMeal.id,
      restaurant_id: selectedMeal.restaurant_id,
      calories: selectedMeal.calories,
      protein: selectedMeal.protein_g,
      carbs: selectedMeal.carbs_g,
      fats: selectedMeal.fat_g,
    });
    
    // Track restaurant usage
    usedRestaurants.set(
      selectedMeal.restaurant_id,
      (usedRestaurants.get(selectedMeal.restaurant_id) || 0) + 1
    );
  }

  // Calculate totals
  const totals = { calories: 0, protein: 0 };
  for (const item of planItems) {
    budget.check("daily.calculate_totals");
    totals.calories += item.calories;
    totals.protein += item.protein;
  }
  
  return {
    plan_items: planItems,
    total_calories: totals.calories,
    total_protein: totals.protein,
  };
}

// Generate weekly plan using greedy algorithm with backtracking
async function generateWeeklyPlan(
  userId: string,
  weekStartDate: string,
  availableMeals: Meal[],
  dailyTargets: NutritionTargets,
  preferences: UserPreferences,
  supabaseClient: any,
  budget: AllocationExecutionBudget,
): Promise<WeeklyPlan> {
  budget.check("weekly.start");
  const planItems: PlanItem[] = [];
  const usedRestaurants = new Map<string, number>(); // Track restaurant usage
  
  // Define meal structure for each day
  const mealStructure = [
    { type: "breakfast", required: true },
    { type: "lunch", required: true },
    { type: "dinner", required: true },
    { type: "snack", required: false }, // Optional
  ];
  
  // Generate for 7 days
  for (let day = 0; day < 7; day++) {
    budget.check("weekly.day");

    // Calculate targets per meal based on daily targets
    const mealTargets = calculateMealTargets(
      dailyTargets.daily_calories,
      dailyTargets.protein,
      dailyTargets.carbs,
      dailyTargets.fats,
      mealStructure.map(m => m.type)
    );
    
    for (const mealSlot of mealStructure) {
      budget.check("weekly.meal_slot");

      // Skip snacks on days where calories are tight
      if (mealSlot.type === "snack" && dailyTargets.daily_calories < 1800) {
        continue;
      }
      
      const targets = mealTargets[mealSlot.type];
      if (!targets) continue;
      
      // Filter and score meals for this slot
      const validMeals = filterValidMeals(
        availableMeals,
        preferences,
        budget,
        "weekly.filter_available",
      ).filter((meal, index) => {
          if (index % BUDGET_CHECK_INTERVAL === 0) budget.check("weekly.filter_variety");
          // Enforce variety: max 2 meals from same restaurant per week
          const restaurantCount = usedRestaurants.get(meal.restaurant_id) || 0;
          return restaurantCount < 2;
        });
      
      if (validMeals.length === 0) {
        if (mealSlot.required) {
          console.warn(`No valid meals for day ${day}, ${mealSlot.type}`);
        }
        continue;
      }
      
      const selectedMeal = selectBestMeal(
        validMeals,
        planItems,
        targets,
        budget,
        "weekly.score_meals",
      );
      if (!selectedMeal) continue;
      
      planItems.push({
        day,
        meal_type: mealSlot.type as "breakfast" | "lunch" | "dinner" | "snack",
        meal_id: selectedMeal.id,
        restaurant_id: selectedMeal.restaurant_id,
        calories: selectedMeal.calories,
        protein: selectedMeal.protein_g,
        carbs: selectedMeal.carbs_g,
        fats: selectedMeal.fat_g,
      });
      
      // Track restaurant usage
      usedRestaurants.set(
        selectedMeal.restaurant_id,
        (usedRestaurants.get(selectedMeal.restaurant_id) || 0) + 1
      );
    }
  }
  
  // Calculate totals
  const totals = { calories: 0, protein: 0, carbs: 0, fats: 0 };
  for (const item of planItems) {
    budget.check("weekly.calculate_totals");
    totals.calories += item.calories;
    totals.protein += item.protein;
    totals.carbs += item.carbs;
    totals.fats += item.fats;
  }
  
  // Calculate compliance score
  const targetCalories = dailyTargets.daily_calories * 7;
  const targetProtein = dailyTargets.protein * 7;
  
  const calorieCompliance = 100 - Math.min(100, Math.abs(totals.calories - targetCalories) / targetCalories * 100);
  const proteinCompliance = 100 - Math.min(100, Math.abs(totals.protein - targetProtein) / targetProtein * 100);
  const macroComplianceScore = Math.round((calorieCompliance + proteinCompliance) / 2);
  
  // Calculate variety score
  const uniqueRestaurants = new Set<string>();
  const uniqueMeals = new Set<string>();
  for (const item of planItems) {
    budget.check("weekly.calculate_variety");
    uniqueRestaurants.add(item.restaurant_id);
    uniqueMeals.add(item.meal_id);
  }
  const varietyScore = Math.round(
    (uniqueRestaurants.size / Math.max(1, planItems.length * 0.4)) * 50 +
    (uniqueMeals.size / planItems.length) * 50
  );
  
  return {
    plan_items: planItems,
    total_calories: totals.calories,
    total_protein: totals.protein,
    total_carbs: totals.carbs,
    total_fats: totals.fats,
    macro_compliance_score: macroComplianceScore,
    variety_score: Math.min(100, varietyScore),
  };
}

// Save plan to database
async function saveWeeklyPlan(
  userId: string,
  weekStartDate: string,
  plan: WeeklyPlan,
  supabaseClient: any,
  budget: AllocationExecutionBudget,
): Promise<string> {
  budget.check("weekly.save.start");
  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setDate(weekEndDate.getDate() + 6);
  
  // Create weekly plan record
  const { data: planData, error: planError } = await budget.run(
    "weekly.save.plan",
    (signal) => supabaseClient
      .from("weekly_meal_plans")
      .insert({
        user_id: userId,
        week_start_date: weekStartDate,
        week_end_date: weekEndDate.toISOString().split("T")[0],
        plan_status: "draft",
        total_calories: plan.total_calories,
        total_protein: plan.total_protein,
        total_carbs: plan.total_carbs,
        total_fats: plan.total_fats,
        ai_confidence_score: plan.macro_compliance_score / 100,
        user_accepted: false,
        user_modified: false,
      })
      .select()
      .single()
      .abortSignal(signal),
  );
  
  if (planError || !planData) {
    throw new Error(`Failed to create weekly plan: ${planError?.message}`);
  }
  
  // Create plan items
  const planItems = plan.plan_items.map((item) => {
    budget.check("weekly.save.prepare_items");
    return {
      plan_id: planData.id,
      meal_id: item.meal_id,
      restaurant_id: item.restaurant_id,
      scheduled_date: new Date(new Date(weekStartDate).getTime() + item.day * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      meal_type: item.meal_type,
      calories: item.calories,
      protein: item.protein,
      carbs: item.carbs,
      fats: item.fats,
      is_ai_suggested: true,
      user_swapped: false,
    };
  });

  const { error: itemsError } = await budget.run(
    "weekly.save.items",
    (signal) => supabaseClient
      .from("weekly_meal_plan_items")
      .insert(planItems)
      .abortSignal(signal),
  );
  
  if (itemsError) {
    throw new Error(`Failed to create plan items: ${itemsError.message}`);
  }
  
  return planData.id;
}

serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  const corsHeaders = getCorsHeaders(req);
  const budget = createAllocationExecutionBudget(
    MAX_ALLOCATION_RUNTIME_MS,
    Date.now,
    req.signal,
  );

  try {
    budget.check("request.start");
    requirePost(req);
    const supabaseClient = getServiceClient();
    const principal = await budget.run(
      "authentication.verify",
      () => authenticateRequest(req),
    );
    await budget.run(
      "authorization.rate_limit",
      () => enforceRateLimit(req, "smart-meal-allocator", principal.user.id, 20, 60 * 60),
    );

    const { 
      user_id, 
      week_start_date,
      generate_variations = 1,
      // New parameters for smart refresh
      remaining_calories,
      remaining_protein,
      locked_meal_types = [],
      mode = "weekly", // "weekly" or "daily"
    } = await budget.run(
      "request.read_body",
      () => readJsonBody<{
        user_id: string;
        week_start_date: string;
        generate_variations?: number;
        remaining_calories?: number;
        remaining_protein?: number;
        locked_meal_types?: string[];
        mode?: string;
      }>(req, 32 * 1024),
    );

    // Validation
    if (typeof user_id !== "string" || !UUID_PATTERN.test(user_id)) {
      throw new HttpError(400, "invalid_user_id", "user_id must be a valid UUID");
    }

    if (
      typeof week_start_date !== "string" ||
      !ISO_DATE_PATTERN.test(week_start_date) ||
      Number.isNaN(Date.parse(`${week_start_date}T00:00:00.000Z`)) ||
      new Date(`${week_start_date}T00:00:00.000Z`).toISOString().slice(0, 10) !== week_start_date
    ) {
      throw new HttpError(400, "invalid_week_start_date", "week_start_date must be a valid YYYY-MM-DD date");
    }

    if (!Number.isInteger(generate_variations) || generate_variations < 1 || generate_variations > MAX_VARIATIONS) {
      throw new HttpError(
        400,
        "invalid_generate_variations",
        `generate_variations must be an integer between 1 and ${MAX_VARIATIONS}`,
      );
    }

    if (mode !== "weekly" && mode !== "daily") {
      throw new HttpError(400, "invalid_mode", "mode must be weekly or daily");
    }

    if (
      !Array.isArray(locked_meal_types) ||
      locked_meal_types.length > ALLOWED_MEAL_TYPES.size ||
      locked_meal_types.some((mealType) => typeof mealType !== "string" || !ALLOWED_MEAL_TYPES.has(mealType)) ||
      new Set(locked_meal_types).size !== locked_meal_types.length
    ) {
      throw new HttpError(400, "invalid_locked_meal_types");
    }

    if (
      remaining_calories !== undefined &&
      (typeof remaining_calories !== "number" || !Number.isFinite(remaining_calories) || remaining_calories < 0 || remaining_calories > 10_000)
    ) {
      throw new HttpError(400, "invalid_remaining_calories");
    }

    if (
      remaining_protein !== undefined &&
      (typeof remaining_protein !== "number" || !Number.isFinite(remaining_protein) || remaining_protein < 0 || remaining_protein > 1_000)
    ) {
      throw new HttpError(400, "invalid_remaining_protein");
    }

    await budget.run(
      "authorization.require_self_or_admin",
      () => assertSelfOrAdmin(req, principal, user_id),
    );

    // Fetch user's nutrition profile
    const { data: profile, error: profileError } = await budget.run(
      "database.profile",
      (signal) => supabaseClient
        .from("profiles")
        .select("daily_calorie_target, protein_target_g, carbs_target_g, fat_target_g")
        .eq("user_id", user_id)
        .single()
        .abortSignal(signal),
    );

    if (profileError || !profile || !profile.daily_calorie_target) {
      return new Response(
        JSON.stringify({ error: "User nutrition profile not found. Please complete onboarding first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch user preferences
    const { data: preferences, error: prefError } = await budget.run(
      "database.preferences",
      (signal) => supabaseClient
        .from("user_preferences")
        .select("*")
        .eq("user_id", user_id)
        .single()
        .abortSignal(signal),
    );

    if (prefError) {
      console.warn("Could not load user preferences; using defaults:", prefError.code);
    }

    const userPrefs: UserPreferences = preferences || {
      cuisine_preferences: [],
      dietary_restrictions: [],
      allergies: [],
      disliked_ingredients: [],
      preferred_meal_times: {},
      variety_preference: 3,
    };

    // Fetch available meals with macros
    console.log("Fetching meals from database...");
    const { data: meals, error: mealsError } = await budget.run(
      "database.meals",
      (signal) => supabaseClient
        .from("meals")
        .select("id, restaurant_id, name, calories, protein_g, carbs_g, fat_g, is_available, meal_type")
        .eq("is_available", true)
        .limit(MAX_CATALOG_ROWS)
        .abortSignal(signal),
    );

    if (mealsError) {
      console.error("Meal catalog lookup failed", { code: mealsError.code });
      return new Response(
        JSON.stringify({ 
          error: "Failed to fetch available meals", 
          details: mealsError.message,
          code: mealsError.code 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Fetched ${meals?.length || 0} meals`);

    if (!meals || meals.length === 0) {
      return new Response(
        JSON.stringify({ error: "No available meals found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch restaurants for response enrichment
    const { data: restaurants, error: restaurantsError } = await budget.run(
      "database.restaurants",
      (signal) => supabaseClient
        .from("restaurants")
        .select("id, name, logo_url")
        .limit(MAX_CATALOG_ROWS)
        .abortSignal(signal),
    );

    if (restaurantsError) {
      console.error("Restaurant lookup failed", { code: restaurantsError.code });
    }

    const restaurantMap = new Map<string, any>();
    for (let index = 0; index < (restaurants || []).length; index += 1) {
      if (index % BUDGET_CHECK_INTERVAL === 0) budget.check("response.map_restaurants");
      const restaurant = restaurants[index];
      restaurantMap.set(restaurant.id, restaurant);
    }

    // Check if this is a daily refresh with locked meals
    const isDailyRefresh = remaining_calories !== undefined && locked_meal_types.length > 0;
    
    if (isDailyRefresh || mode === "daily") {
      // Generate daily plan with remaining nutrition
      console.log("Generating daily plan with remaining nutrition...");
      
      const dailyPlan = await generateDailyPlan(
        user_id,
        week_start_date,
        meals,
        {
          daily_calories: profile.daily_calorie_target,
          protein: profile.protein_target_g,
          carbs: profile.carbs_target_g,
          fats: profile.fat_target_g,
        },
        userPrefs,
        supabaseClient,
        budget,
        {
          remaining_calories,
          remaining_protein,
          locked_meal_types,
        }
      );
      
      // Create a meals map for quick lookup
      const mealsMap = new Map<string, Meal>();
      for (let index = 0; index < meals.length; index += 1) {
        if (index % BUDGET_CHECK_INTERVAL === 0) budget.check("daily.map_meals");
        const meal = meals[index] as Meal;
        mealsMap.set(meal.id, meal);
      }
      
      // Enrich with restaurant data and nest meal info properly
      const enrichedItems = dailyPlan.plan_items.map((item) => {
        budget.check("daily.enrich_response");
        const mealData = mealsMap.get(item.meal_id) as Meal | undefined;
        return {
          ...item,
          scheduled_date: week_start_date,
          restaurant: restaurantMap.get(item.restaurant_id) || null,
          // Nest meal data as expected by MealWizard
          meal: {
            id: item.meal_id,
            name: mealData?.name || "Unknown Meal",
            calories: item.calories,
            protein_g: item.protein,
            carbs_g: item.carbs,
            fat_g: item.fats,
            image_url: (mealData as any)?.image_url || null,
          }
        };
      });
      
      // Log behavior event
      const { error: behaviorError } = await budget.run(
        "database.behavior_event",
        (signal) => supabaseClient
          .from("behavior_events")
          .insert({
            user_id: user_id,
            event_type: "daily_plan_generated",
            metadata: {
              date: week_start_date,
              remaining_calories,
              remaining_protein,
              locked_meal_types,
              items_generated: enrichedItems.length,
            },
          })
          .abortSignal(signal),
      );

      if (behaviorError) {
        console.warn("Could not record daily plan behavior event:", behaviorError.code);
      }

      budget.check("daily.serialize_response");
      
      return new Response(
        JSON.stringify({
          success: true,
          mode: "daily",
          weekly_plan: {
            items: enrichedItems,
          },
          total_calories: dailyPlan.total_calories,
          total_protein: dailyPlan.total_protein,
          message: `Generated ${enrichedItems.length} meals matching your remaining nutrition targets`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate weekly plan(s)
    const variations: WeeklyPlan[] = [];
    
    for (let i = 0; i < generate_variations; i++) {
      budget.check("weekly.variation");

      // Shuffle meals slightly for variation without an uninterruptible native sort.
      const shuffledMeals = shuffleMeals(meals, budget);
      
      const plan = await generateWeeklyPlan(
        user_id,
        week_start_date,
        shuffledMeals,
        {
          daily_calories: profile.daily_calorie_target,
          protein: profile.protein_target_g,
          carbs: profile.carbs_target_g,
          fats: profile.fat_target_g,
        },
        userPrefs,
        supabaseClient,
        budget,
      );
      
      variations.push(plan);
    }

    // Select best plan (highest compliance score)
    const bestPlan = variations.reduce((best, current) => 
      current.macro_compliance_score > best.macro_compliance_score ? current : best
    );
    
    // Create a meals map for quick lookup
    const weeklyMealsMap = new Map<string, Meal>();
    for (let index = 0; index < meals.length; index += 1) {
      if (index % BUDGET_CHECK_INTERVAL === 0) budget.check("weekly.map_meals");
      const meal = meals[index] as Meal;
      weeklyMealsMap.set(meal.id, meal);
    }
    
    // Enrich plan items with restaurant and meal data
    const enrichedItems = bestPlan.plan_items.map((item) => {
      budget.check("weekly.enrich_response");
      const scheduledDate = new Date(new Date(week_start_date).getTime() + item.day * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      const mealData = weeklyMealsMap.get(item.meal_id) as Meal | undefined;
      return {
        ...item,
        scheduled_date: scheduledDate,
        restaurant: restaurantMap.get(item.restaurant_id) || null,
        // Nest meal data as expected by MealWizard
        meal: {
          id: item.meal_id,
          name: mealData?.name || "Unknown Meal",
          calories: item.calories,
          protein_g: item.protein,
          carbs_g: item.carbs,
          fat_g: item.fats,
          image_url: (mealData as any)?.image_url || null,
        }
      };
    });

    // Save to database if requested (disabled - table doesn't exist yet)
    let planId: string | null = null;
    // Note: weekly_meal_plans table doesn't exist, skipping database save
    // if (save_to_database) {
    //   planId = await saveWeeklyPlan(user_id, week_start_date, bestPlan, supabaseClient, budget);
    // }

    budget.check("weekly.serialize_response");

    return new Response(
      JSON.stringify({
        success: true,
        plan_id: planId,
        plan: {
          ...bestPlan,
          items: enrichedItems,
        },
        weekly_plan: {
          items: enrichedItems,
        },
        variations: generate_variations > 1 ? variations : undefined,
        message: `Weekly plan generated with ${bestPlan.macro_compliance_score}% macro compliance`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Smart meal allocation failed", {
      code: error instanceof HttpError ? error.code : "internal_error",
    });
    return errorResponse(req, error);
  }
});
