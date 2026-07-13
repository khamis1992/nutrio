import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

import {
  corsHeaders,
  decryptSecret,
  getAdminClient,
  getAuthenticatedUser,
  jsonResponse,
} from "../_shared/sporthub.ts";

type SportHubSession = {
  id: string;
  user_id: string;
  activity_type: string;
  venue_name?: string | null;
  starts_at: string;
  ends_at?: string | null;
  duration_minutes?: number | null;
  calories_burned?: number | null;
  status: "booked" | "confirmed" | "completed" | "cancelled" | "no_show";
};

function qatarDate(timestamp: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Qatar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(timestamp));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return jsonResponse({ error: "unauthorized" }, 401);

    const apiBaseUrl = Deno.env.get("SPORTHUB_API_BASE_URL");
    if (!apiBaseUrl) return jsonResponse({ error: "sporthub_api_not_configured" }, 503);
    const admin = getAdminClient();
    const { data: integration, error: integrationError } = await admin.from("partner_integrations")
      .select("id,external_user_id,consent_status")
      .eq("user_id", user.id)
      .eq("partner", "sporthub")
      .maybeSingle();
    if (integrationError) throw integrationError;
    if (!integration || integration.consent_status !== "linked") return jsonResponse({ error: "not_linked" }, 409);

    const { data: credentials, error: credentialError } = await admin.from("partner_credentials")
      .select("access_token_encrypted,token_type,expires_at")
      .eq("integration_id", integration.id)
      .maybeSingle();
    if (credentialError || !credentials) return jsonResponse({ error: "credentials_missing" }, 409);
    if (credentials.expires_at && new Date(credentials.expires_at) <= new Date()) {
      await admin.from("partner_integrations").update({ consent_status: "reauth_required" }).eq("id", integration.id);
      return jsonResponse({ error: "reauth_required" }, 401);
    }

    const accessToken = await decryptSecret(credentials.access_token_encrypted);
    const now = new Date();
    const from = new Date(now.getTime() - 30 * 86400000).toISOString();
    const to = new Date(now.getTime() + 90 * 86400000).toISOString();
    const url = new URL("/v1/me/activities", apiBaseUrl.endsWith("/") ? apiBaseUrl : `${apiBaseUrl}/`);
    url.searchParams.set("from", from);
    url.searchParams.set("to", to);

    const upstream = await fetch(url, {
      headers: {
        Authorization: `${credentials.token_type || "Bearer"} ${accessToken}`,
        Accept: "application/json",
      },
    });
    if (upstream.status === 401 || upstream.status === 403) {
      await admin.from("partner_integrations").update({ consent_status: "reauth_required" }).eq("id", integration.id);
      return jsonResponse({ error: "reauth_required" }, 401);
    }
    if (!upstream.ok) return jsonResponse({ error: "sporthub_sync_failed", upstream_status: upstream.status }, 502);

    const payload = await upstream.json() as { data?: SportHubSession[]; activities?: SportHubSession[] };
    const sessions = payload.data || payload.activities || [];
    let synced = 0;

    for (const session of sessions) {
      if (!session.id || !session.user_id || !session.activity_type || !session.starts_at) continue;
      if (session.user_id !== integration.external_user_id) continue;
      const startsAt = new Date(session.starts_at);
      if (Number.isNaN(startsAt.getTime())) continue;

      const { data: saved, error: saveError } = await admin.from("partner_activity_sessions").upsert({
        user_id: user.id,
        partner: "sporthub",
        external_session_id: session.id,
        external_user_id: session.user_id,
        activity_type: session.activity_type,
        venue_name: session.venue_name || null,
        starts_at: startsAt.toISOString(),
        ends_at: session.ends_at || null,
        duration_minutes: session.duration_minutes || null,
        calories_burned: session.calories_burned ?? null,
        status: session.status,
        raw_payload: session,
        updated_at: new Date().toISOString(),
      }, { onConflict: "partner,external_session_id" }).select("id").single();
      if (saveError || !saved) continue;

      if (session.status === "completed") {
        const { data: workout } = await admin.from("workout_sessions").upsert({
          user_id: user.id,
          session_date: qatarDate(startsAt.toISOString()),
          workout_type: session.activity_type,
          duration_minutes: session.duration_minutes || 1,
          calories_burned: session.calories_burned ?? 0,
          source: "sporthub",
          source_external_id: session.id,
          confirmed: true,
          created_at: startsAt.toISOString(),
          external_metadata: { venue_name: session.venue_name || null, sync_source: "pull" },
        }, { onConflict: "source,source_external_id" }).select("id").single();
        if (workout) await admin.from("partner_activity_sessions").update({ workout_session_id: workout.id }).eq("id", saved.id);
      } else if (session.status === "cancelled" || session.status === "no_show") {
        await admin.from("workout_sessions").delete().eq("source", "sporthub").eq("source_external_id", session.id);
        await admin.from("partner_activity_sessions").update({ workout_session_id: null }).eq("id", saved.id);
      }
      synced += 1;
    }

    const syncedAt = new Date().toISOString();
    await admin.from("partner_integrations").update({ last_synced_at: syncedAt, updated_at: syncedAt }).eq("id", integration.id);
    await admin.from("partner_events").insert({
      user_id: user.id,
      partner: "sporthub",
      event_type: "sporthub.manual_sync.completed",
      payload: { synced_count: synced },
    });
    return jsonResponse({ ok: true, synced, last_synced_at: syncedAt });
  } catch (error) {
    console.error("SportHub sync failed", error);
    return jsonResponse({ error: "sync_failed" }, 500);
  }
});
