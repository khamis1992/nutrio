// Edge Function: process-subscription-renewal
// Synchronizes freezes and expires subscriptions whose paid period ended.
// A verified SADAD payment is the only path that may extend entitlement.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

interface RenewalInput {
  subscription_id?: string;
  dry_run?: boolean;
}

interface RenewalLifecycleResult {
  subscription_id: string;
  user_id: string;
  action: "would_expire" | "expired" | "unchanged";
  success: boolean;
  error?: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function safeEqual(left: string, right: string): boolean {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  let difference = leftBytes.length ^ rightBytes.length;
  const length = Math.max(leftBytes.length, rightBytes.length);

  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }

  return difference === 0;
}

function getQatarDate(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Qatar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const cronSecret = Deno.env.get("SUBSCRIPTION_RENEWAL_CRON_SECRET") ?? "";

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Subscription renewal server configuration is incomplete");
    return json({ error: "SERVER_CONFIGURATION_MISSING" }, 500);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const body = (await req.json().catch(() => ({}))) as RenewalInput;
    const subscriptionId = body.subscription_id?.trim() || null;
    const dryRun = body.dry_run === true;
    const suppliedCronSecret = req.headers.get("x-cron-secret") ?? "";
    const isCron = Boolean(
      cronSecret
        && suppliedCronSecret
        && safeEqual(suppliedCronSecret, cronSecret),
    );

    let actorId: string | null = null;
    let isAdmin = false;

    if (!isCron) {
      const authorization = req.headers.get("authorization") ?? "";
      const token = authorization.startsWith("Bearer ")
        ? authorization.slice("Bearer ".length).trim()
        : "";

      if (!token) {
        return json({ error: "UNAUTHORIZED" }, 401);
      }

      const { data: authData, error: authError } = await adminClient.auth.getUser(token);
      if (authError || !authData.user) {
        return json({ error: "UNAUTHORIZED" }, 401);
      }

      actorId = authData.user.id;
      const { data: roles, error: rolesError } = await adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", actorId);

      if (rolesError) {
        throw rolesError;
      }

      isAdmin = (roles ?? []).some((entry) => entry.role === "admin");

      if (!isAdmin && (!dryRun || !subscriptionId)) {
        return json(
          { error: "FORBIDDEN", message: "Customers may only preview their own renewal status." },
          403,
        );
      }
    }

    if (!dryRun && !isCron && !isAdmin) {
      return json({ error: "FORBIDDEN" }, 403);
    }

    const syncTarget = isCron || isAdmin ? null : actorId;
    const { error: freezeError } = await adminClient.rpc("sync_subscription_freezes", {
      p_user_id: syncTarget,
    });

    if (freezeError) {
      throw freezeError;
    }

    if (!dryRun) {
      const { data: expired, error: expireError } = await adminClient.rpc(
        "expire_due_subscriptions",
        {
          p_subscription_id: subscriptionId,
          p_limit: subscriptionId ? 1 : 500,
        },
      );

      if (expireError) {
        throw expireError;
      }

      const results: RenewalLifecycleResult[] = (expired ?? []).map((subscription) => ({
        subscription_id: subscription.subscription_id,
        user_id: subscription.user_id,
        action: "expired",
        success: true,
      }));

      return json({
        message: "Renewal lifecycle processed",
        processed: results.length,
        successful: results.length,
        failed: 0,
        results,
      });
    }

    const today = getQatarDate();
    let query = adminClient
      .from("subscriptions")
      .select("id,user_id,end_date,status,active,auto_renew,freeze_active_id")
      .in("status", ["active", "cancelled"])
      .is("freeze_active_id", null)
      .not("end_date", "is", null)
      .lt("end_date", today)
      .order("end_date", { ascending: true })
      .limit(subscriptionId ? 1 : 500);

    if (subscriptionId) {
      query = query.eq("id", subscriptionId);
    }
    if (!isCron && !isAdmin && actorId) {
      query = query.eq("user_id", actorId);
    }

    const { data: subscriptions, error: fetchError } = await query;
    if (fetchError) {
      throw fetchError;
    }

    const results: RenewalLifecycleResult[] = (subscriptions ?? []).map((subscription) => ({
      subscription_id: subscription.id,
      user_id: subscription.user_id,
      action: "would_expire",
      success: true,
    }));

    return json({
      message: "Renewal lifecycle preview completed",
      processed: results.length,
      successful: results.filter((result) => result.success).length,
      failed: results.filter((result) => !result.success).length,
      results,
    });
  } catch (error) {
    console.error("Error processing subscription renewal lifecycle", error);
    return json(
      {
        error: "SUBSCRIPTION_RENEWAL_PROCESSING_FAILED",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});
