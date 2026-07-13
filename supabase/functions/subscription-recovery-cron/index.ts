import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NOTIF_TIMINGS = {
  t_minus_7: { col: "notif_t_minus_7_sent", label: "t-7d", delay_days: -7 },
  t_minus_3: { col: "notif_t_minus_3_sent", label: "t-3d", delay_days: -3 },
  t_minus_1: { col: "notif_t_minus_1_sent", label: "t-1d", delay_days: -1 },
  t_plus_1: { col: "notif_t_plus_1_sent", label: "t+1d", delay_days: 1 },
  t_plus_3: { col: "notif_t_plus_3_sent", label: "t+3d", delay_days: 3 },
  t_plus_7: { col: "notif_t_plus_7_sent", label: "t+7d", delay_days: 7 },
};

function buildNotifPayload(timing: typeof NOTIF_TIMINGS[keyof typeof NOTIF_TIMINGS], userName: string) {
  const isPre = timing.delay_days < 0;
  const absDays = Math.abs(timing.delay_days);

  if (isPre) {
    return {
      title: `Your subscription ends in ${absDays} day${absDays > 1 ? "s" : ""}`,
      message: `Hey ${userName}, your Nutrio plan expires soon. Renew now to keep your meals coming!`,
      type: "subscription_expiry_warning",
    };
  }
  return {
    title: "We miss you! Come back to Nutrio",
    message: `Hey ${userName}, it's been ${absDays} day${absDays > 1 ? "s" : ""} since your subscription ended. Get an exclusive offer to reactivate!`,
    type: "subscription_recovery",
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run === true;

    const results: Record<string, unknown>[] = [];

    // Step 1: Expire overdue cancelled subscriptions
    const { data: expireResult, error: expireError } = await supabase.rpc("check_and_expire_subscriptions");
    if (expireError) throw expireError;
    results.push({ step: "expire_cancelled", result: expireResult });

    // Step 2: Fetch pending recoveries due for notification
    const { data: recoveries, error: recoveryError } = await supabase
      .from("subscription_recovery")
      .select("id, user_id, expired_at, recovery_status, last_notif_sent_at, next_notif_due_at, notif_t_minus_7_sent, notif_t_minus_3_sent, notif_t_minus_1_sent, notif_t_plus_1_sent, notif_t_plus_3_sent, notif_t_plus_7_sent")
      .in("recovery_status", ["pending", "offer_viewed"])
      .lte("next_notif_due_at", new Date().toISOString())
      .limit(50);

    if (recoveryError) throw recoveryError;

    if (!recoveries || recoveries.length === 0) {
      return new Response(
        JSON.stringify({ message: "No notifications due", processed: 0, results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const now = new Date();
    const notifResults: Record<string, unknown>[] = [];

    for (const rec of recoveries) {
      const daysSinceExpiry = Math.floor(
        (now.getTime() - new Date(rec.expired_at).getTime()) / (1000 * 60 * 60 * 24)
      );

      let timingFound: (typeof NOTIF_TIMINGS)[keyof typeof NOTIF_TIMINGS] | null = null;
      let colName: string | null = null;

      for (const [, timing] of Object.entries(NOTIF_TIMINGS)) {
        const daysOffset = daysSinceExpiry - timing.delay_days;
        if (daysOffset >= 0 && !rec[timing.col as keyof typeof rec]) {
          timingFound = timing;
          colName = timing.col;
          break;
        }
      }

      if (!timingFound) {
        const maxTiming = Object.values(NOTIF_TIMINGS).reduce((a, b) =>
          a.delay_days > b.delay_days ? a : b
        );
        if (daysSinceExpiry > maxTiming.delay_days + 3) {
          await supabase
            .from("subscription_recovery")
            .update({ recovery_status: "expired", updated_at: now.toISOString() })
            .eq("id", rec.id);
          notifResults.push({ recovery_id: rec.id, action: "expired_no_timings_left" });
        } else {
          const nextDate = new Date(rec.expired_at);
          nextDate.setDate(nextDate.getDate() + 1);
          await supabase
            .from("subscription_recovery")
            .update({ next_notif_due_at: nextDate.toISOString(), updated_at: now.toISOString() })
            .eq("id", rec.id);
          notifResults.push({ recovery_id: rec.id, action: "rescheduled" });
        }
        continue;
      }

      // Fetch user profile for notification
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("user_id", rec.user_id)
        .single();

      const userName = profile?.full_name || "there";
      const payload = buildNotifPayload(timingFound, userName);

      if (dryRun) {
        notifResults.push({
          recovery_id: rec.id,
          action: "dry_run_notification",
          timing: timingFound.label,
          days_since_expiry: daysSinceExpiry,
          payload,
        });
        continue;
      }

      // Send push notification
      await supabase.functions.invoke("send-push-notification", {
        body: {
          user_id: rec.user_id,
          title: payload.title,
          message: payload.message,
          type: payload.type,
          data: { recovery_id: rec.id },
        },
      }).catch((e) => console.error(`Push notif failed for ${rec.user_id}:`, e));

      // Send email if available
      if (profile?.email) {
        await supabase.functions.invoke("send-email", {
          body: {
            to: profile.email,
            subject: payload.title,
            text: payload.message,
            html: `<p>${payload.message}</p>`,
          },
        }).catch((e) => console.error(`Email notif failed for ${rec.user_id}:`, e));
      }

      // Update notification tracking
      const updateData: Record<string, unknown> = {
        last_notif_sent_at: now.toISOString(),
        updated_at: now.toISOString(),
      };
      updateData[colName] = true;

      const nextDate = new Date(rec.expired_at);
      const nextTiming = Object.values(NOTIF_TIMINGS).find(t => t.delay_days > timingFound!.delay_days);
      if (nextTiming) {
        nextDate.setDate(nextDate.getDate() + nextTiming.delay_days);
        updateData.next_notif_due_at = nextDate.toISOString();
      } else {
        updateData.next_notif_due_at = null;
      }

      await supabase.from("subscription_recovery").update(updateData).eq("id", rec.id);

      notifResults.push({
        recovery_id: rec.id,
        action: "notification_sent",
        timing: timingFound.label,
        days_since_expiry: daysSinceExpiry,
      });
    }

    return new Response(
      JSON.stringify({
        message: dryRun ? "Dry run completed" : "Recovery notifications processed",
        expired_subscriptions: expireResult,
        notifications_processed: notifResults.length,
        results: notifResults,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in subscription-recovery-cron:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
