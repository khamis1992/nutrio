import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  authenticateRequest,
  enforceRateLimit,
  errorResponse,
  getServiceClient,
  handlePreflight,
  HttpError,
  jsonResponse,
  readJsonBody,
  requirePost,
} from "../_shared/security.ts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  try {
    requirePost(req);
    const principal = await authenticateRequest(req);
    await enforceRateLimit(req, "similar-meals", principal.user.id, 90, 60 * 60);

    const body = await readJsonBody<{ meal_id?: unknown; limit?: unknown }>(req, 2 * 1024);
    const mealId = typeof body.meal_id === "string" ? body.meal_id.trim() : "";
    if (!UUID_PATTERN.test(mealId)) throw new HttpError(400, "invalid_meal_id");

    const requestedLimit = body.limit === undefined ? 6 : Number(body.limit);
    if (!Number.isInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > 20) {
      throw new HttpError(400, "invalid_limit");
    }

    const supabaseClient = getServiceClient();

    const { data: meal, error: mealError } = await supabaseClient
      .from("meals")
      .select("id, name, meal_type, restaurant_id, calories, protein_g, carbs_g, fat_g, fiber_g")
      .eq("id", mealId)
      .eq("is_available", true)
      .maybeSingle();
    if (mealError) throw mealError;

    if (!meal) {
      throw new HttpError(404, "meal_not_found");
    }

    const { data: mealDietTags, error: tagError } = await supabaseClient
      .from("meal_diet_tags")
      .select("diet_tag_id")
      .eq("meal_id", mealId);
    if (tagError) throw tagError;

    const tagIds = (mealDietTags || []).map((t) => t.diet_tag_id);

    let similarTagMeals: Array<{ meal_id: string }> = [];
    if (tagIds.length > 0) {
      const { data, error } = await supabaseClient
        .from("meal_diet_tags")
        .select("meal_id")
        .in("diet_tag_id", tagIds);
      if (error) throw error;
      similarTagMeals = data || [];
    }

    const similarMealIds = [...new Set(similarTagMeals.map((m) => m.meal_id).filter((id) => id !== mealId))];

    const maxCalDiff = meal.calories * 0.3;
    let similarMeals: any[] = [];
    if (similarMealIds.length > 0) {
      const { data, error } = await supabaseClient
        .from("meals")
        .select("id, name, description, calories, protein_g, carbs_g, fat_g, fiber_g, image_url, meal_type, restaurants:restaurant_id(name)")
        .eq("is_available", true)
        .neq("id", mealId)
        .gte("calories", Math.max(0, meal.calories - maxCalDiff))
        .lte("calories", meal.calories + maxCalDiff)
        .in("id", similarMealIds)
        .order("created_at", { ascending: false })
        .limit(requestedLimit);
      if (error) throw error;
      similarMeals = data || [];
    }

    const fetchedIds = new Set(similarMeals.map((m: any) => m.id));
    const remaining = requestedLimit - similarMeals.length;

    let extraMeals: any[] = [];
    if (remaining > 0) {
      let extraQuery = supabaseClient
        .from("meals")
        .select("id, name, description, calories, protein_g, carbs_g, fat_g, fiber_g, image_url, meal_type, restaurants:restaurant_id(name)")
        .eq("is_available", true)
        .neq("id", mealId);
      if (fetchedIds.size > 0) {
        extraQuery = extraQuery.not("id", "in", `(${[...fetchedIds].join(",")})`);
      }
      const { data, error } = await extraQuery
        .order("created_at", { ascending: false })
        .limit(remaining);
      if (error) throw error;
      extraMeals = data || [];
    }

    const all = [...similarMeals, ...extraMeals].map((m: any) => ({
      meal_id: m.id,
      name: m.name,
      description: m.description,
      restaurant_name: m.restaurants?.name || "Unknown",
      calories: m.calories,
      protein_g: m.protein_g,
      carbs_g: m.carbs_g,
      fat_g: m.fat_g,
      fiber_g: m.fiber_g,
      image_url: m.image_url,
      meal_type: m.meal_type,
    }));

    return jsonResponse(req, { meals: all, total: all.length });
  } catch (err) {
    return errorResponse(req, err);
  }
});
