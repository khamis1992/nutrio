import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("create-partner-user: missing Supabase configuration");
    return jsonResponse({ error: "Service is not configured" }, 503);
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const token = req.headers
      .get("Authorization")
      ?.replace(/^Bearer\s+/i, "")
      .trim();
    if (!token) return jsonResponse({ error: "Unauthorized" }, 401);

    const {
      data: { user: caller },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);
    if (authError || !caller) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const { data: adminRole, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .maybeSingle();
    if (roleError) throw roleError;
    if (!adminRole) return jsonResponse({ error: "Forbidden" }, 403);

    const body = await req.json();
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const fullName =
      typeof body.full_name === "string" ? body.full_name.trim() : "";
    const restaurantId =
      typeof body.restaurant_id === "string" ? body.restaurant_id.trim() : "";

    if (!email || !password || !restaurantId) {
      return jsonResponse(
        { error: "email, password, and restaurant_id are required" },
        400,
      );
    }
    if (password.length < 8) {
      return jsonResponse(
        { error: "Password must contain at least 8 characters" },
        400,
      );
    }

    const { data: restaurant, error: restaurantLookupError } =
      await supabaseAdmin
        .from("restaurants")
        .select("id, owner_id")
        .eq("id", restaurantId)
        .maybeSingle();
    if (restaurantLookupError) throw restaurantLookupError;
    if (!restaurant) return jsonResponse({ error: "Restaurant not found" }, 404);
    if (restaurant.owner_id) {
      return jsonResponse(
        { error: "Restaurant already has an owner" },
        409,
      );
    }

    const { data: authData, error: authCreateError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });
    if (authCreateError) throw authCreateError;

    const userId = authData.user.id;
    try {
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .upsert({ user_id: userId, full_name: fullName });
      if (profileError) throw profileError;

      const { error: partnerRoleError } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: userId, role: "partner" });
      if (partnerRoleError) throw partnerRoleError;

      const { data: linkedRestaurant, error: restaurantUpdateError } =
        await supabaseAdmin
          .from("restaurants")
          .update({ owner_id: userId })
          .eq("id", restaurantId)
          .is("owner_id", null)
          .select("id")
          .maybeSingle();
      if (restaurantUpdateError) throw restaurantUpdateError;
      if (!linkedRestaurant) {
        throw new Error("Restaurant owner changed while creating partner");
      }
    } catch (error) {
      const { error: cleanupError } =
        await supabaseAdmin.auth.admin.deleteUser(userId);
      if (cleanupError) {
        console.error("create-partner-user cleanup failed", cleanupError);
      }
      throw error;
    }

    return jsonResponse({ success: true, user_id: userId }, 200);
  } catch (error) {
    console.error("create-partner-user failed", getErrorMessage(error));
    return jsonResponse({ error: "Unable to create partner account" }, 500);
  }
});
