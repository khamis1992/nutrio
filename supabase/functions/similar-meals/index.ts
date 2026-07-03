import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { meal_id, limit: reqLimit } = await req.json().catch(() => ({}));
    if (!meal_id) {
      return new Response(JSON.stringify({ error: "meal_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: meal } = await supabaseClient
      .from("meals")
      .select("id, name, meal_type, restaurant_id, calories, protein_g, carbs_g, fat_g, fiber_g")
      .eq("id", meal_id)
      .single();

    if (!meal) {
      return new Response(JSON.stringify({ error: "Meal not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: mealDietTags } = await supabaseClient
      .from("meal_diet_tags")
      .select("diet_tag_id")
      .eq("meal_id", meal_id);

    const tagIds = (mealDietTags || []).map((t) => t.diet_tag_id);

    const { data: similarTagMeals } = await supabaseClient
      .from("meal_diet_tags")
      .select("meal_id")
      .in("diet_tag_id", tagIds);

    const similarMealIds = [...new Set((similarTagMeals || []).map((m) => m.meal_id).filter((id) => id !== meal_id))];

    const maxCalDiff = meal.calories * 0.3;
    const { data: similarMeals } = await supabaseClient
      .from("meals")
      .select("id, name, description, calories, protein_g, carbs_g, fat_g, fiber_g, image_url, meal_type, restaurants:restaurant_id(name)")
      .eq("is_available", true)
      .neq("id", meal_id)
      .gte("calories", Math.max(0, meal.calories - maxCalDiff))
      .lte("calories", meal.calories + maxCalDiff)
      .in("id", similarMealIds.length > 0 ? similarMealIds : [])
      .order("created_at", { ascending: false })
      .limit(reqLimit || 6);

    const fetchedIds = new Set((similarMeals || []).map((m: any) => m.id));

    const { data: extraMeals } = await supabaseClient
      .from("meals")
      .select("id, name, description, calories, protein_g, carbs_g, fat_g, fiber_g, image_url, meal_type, restaurants:restaurant_id(name)")
      .eq("is_available", true)
      .neq("id", meal_id)
      .not("id", "in", `(${[...fetchedIds].join(",")})`)
      .order("created_at", { ascending: false })
      .limit(Math.max(0, (reqLimit || 6) - (similarMeals || []).length));

    const all = [...(similarMeals || []), ...(extraMeals || [])].map((m: any) => ({
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

    return new Response(JSON.stringify({ meals: all, total: all.length }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
