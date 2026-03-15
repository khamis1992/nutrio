import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { email, password, full_name, restaurant_id } = await req.json();

    if (!email || !password || !restaurant_id) {
      return new Response(
        JSON.stringify({ error: "email, password, and restaurant_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role key for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 1. Create auth user (no email confirmation required)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // skip email verification
      user_metadata: { full_name: full_name ?? "" },
    });

    if (authError) throw authError;
    const userId = authData.user.id;

    // 2. Create profile
    await supabaseAdmin.from("profiles").upsert({
      user_id: userId,
      full_name: full_name ?? "",
    });

    // 3. Assign partner role
    await supabaseAdmin.from("user_roles").upsert({
      user_id: userId,
      role: "partner",
    });

    // 4. Link restaurant owner
    const { error: restaurantError } = await supabaseAdmin
      .from("restaurants")
      .update({ owner_id: userId })
      .eq("id", restaurant_id);

    if (restaurantError) throw restaurantError;

    return new Response(
      JSON.stringify({ success: true, user_id: userId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message ?? "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
