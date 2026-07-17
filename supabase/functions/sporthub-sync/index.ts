import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

import {
  decryptSecret,
  getAdminClient,
  readLimitedJson,
  requireSportHubUrl,
} from "../_shared/sporthub.ts";
import {
  authenticateRequest,
  enforceRateLimit,
  errorResponse,
  handlePreflight,
  HttpError,
  jsonResponse,
  readJsonBody,
  recordSecurityEvent,
  requirePost,
} from "../_shared/security.ts";

type SportHubSession = {
  id?: unknown;
  user_id?: unknown;
  activity_type?: unknown;
  venue_name?: unknown;
  starts_at?: unknown;
  ends_at?: unknown;
  duration_minutes?: unknown;
  calories_burned?: unknown;
  status?: unknown;
};

function optionalInteger(value: unknown, min: number, max: number): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

serve(async (req: Request): Promise<Response> => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  try {
    requirePost(req);
    const principal = await authenticateRequest(req);
    await enforceRateLimit(req, "sporthub-sync", principal.user.id, 6, 15 * 60);
    await readJsonBody<Record<string, never>>(req, 1024);

    const baseUrl = requireSportHubUrl(
      Deno.env.get("SPORTHUB_API_BASE_URL"),
      "SPORTHUB_API_BASE_URL",
    );
    const admin = getAdminClient();
    const { data: integration, error: integrationError } = await admin
      .from("partner_integrations")
      .select("id,external_user_id,consent_status")
      .eq("user_id", principal.user.id)
      .eq("partner", "sporthub")
      .maybeSingle();
    if (integrationError) throw integrationError;
    if (!integration || integration.consent_status !== "linked") {
      throw new HttpError(409, "sporthub_not_linked");
    }

    const { data: credentials, error: credentialError } = await admin
      .from("partner_credentials")
      .select("access_token_encrypted,token_type,expires_at")
      .eq("integration_id", integration.id)
      .maybeSingle();
    if (credentialError) throw credentialError;
    if (!credentials) throw new HttpError(409, "sporthub_credentials_missing");
    if (credentials.expires_at && new Date(credentials.expires_at) <= new Date()) {
      await admin.from("partner_integrations")
        .update({ consent_status: "reauth_required", updated_at: new Date().toISOString() })
        .eq("id", integration.id);
      throw new HttpError(401, "sporthub_reauthentication_required");
    }

    const accessToken = await decryptSecret(credentials.access_token_encrypted);
    const now = new Date();
    const from = new Date(now.getTime() - 30 * 86400000).toISOString();
    const to = new Date(now.getTime() + 90 * 86400000).toISOString();
    const url = new URL("v1/me/activities", baseUrl.toString().replace(/\/?$/, "/"));
    url.searchParams.set("from", from);
    url.searchParams.set("to", to);

    const upstream = await fetch(url, {
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
      headers: {
        Authorization: `${credentials.token_type || "Bearer"} ${accessToken}`,
        Accept: "application/json",
      },
    });
    if (upstream.status === 401 || upstream.status === 403) {
      await admin.from("partner_integrations")
        .update({ consent_status: "reauth_required", updated_at: new Date().toISOString() })
        .eq("id", integration.id);
      throw new HttpError(401, "sporthub_reauthentication_required");
    }
    if (!upstream.ok) {
      console.error("SportHub sync upstream rejected", { status: upstream.status });
      throw new HttpError(502, "sporthub_sync_upstream_failed");
    }

    const payload = await readLimitedJson<{
      data?: SportHubSession[];
      activities?: SportHubSession[];
    }>(upstream, 1024 * 1024);
    const candidateSessions = Array.isArray(payload.data)
      ? payload.data
      : Array.isArray(payload.activities)
        ? payload.activities
        : [];
    if (candidateSessions.length > 250) {
      throw new HttpError(502, "sporthub_activity_batch_too_large");
    }

    let synced = 0;
    let rejected = 0;
    for (const session of candidateSessions) {
      const id = typeof session.id === "string" ? session.id.trim() : "";
      const externalUserId = typeof session.user_id === "string"
        ? session.user_id.trim()
        : "";
      const activityType = typeof session.activity_type === "string"
        ? session.activity_type.trim()
        : "";
      const status = typeof session.status === "string" ? session.status : "";
      const startsAt = typeof session.starts_at === "string"
        ? new Date(session.starts_at)
        : new Date(Number.NaN);
      const endsAt = typeof session.ends_at === "string" && session.ends_at
        ? new Date(session.ends_at)
        : null;

      if (
        !id
        || id.length > 255
        || externalUserId !== integration.external_user_id
        || !activityType
        || activityType.length > 100
        || Number.isNaN(startsAt.getTime())
        || (endsAt && (Number.isNaN(endsAt.getTime()) || endsAt < startsAt))
        || !["booked", "confirmed", "completed", "cancelled", "no_show"].includes(status)
      ) {
        rejected += 1;
        continue;
      }

      const duration = optionalInteger(session.duration_minutes, 1, 1440);
      const calories = optionalInteger(session.calories_burned, 0, 20000);
      const { error: saveError } = await admin.rpc("ingest_sporthub_activity", {
        p_user_id: principal.user.id,
        p_external_user_id: externalUserId,
        p_external_session_id: id,
        p_activity_type: activityType,
        p_venue_name: typeof session.venue_name === "string"
          ? session.venue_name.slice(0, 200)
          : null,
        p_starts_at: startsAt.toISOString(),
        p_ends_at: endsAt?.toISOString() || null,
        p_duration_minutes: duration,
        p_calories_burned: calories,
        p_status: status,
        p_raw_payload: {
          id,
          user_id: externalUserId,
          activity_type: activityType,
          venue_name: typeof session.venue_name === "string"
            ? session.venue_name.slice(0, 200)
            : null,
          starts_at: startsAt.toISOString(),
          ends_at: endsAt?.toISOString() || null,
          duration_minutes: duration,
          calories_burned: calories,
          status,
        },
      });
      if (saveError) {
        rejected += 1;
        console.error("SportHub activity rejected", { code: saveError.code });
        continue;
      }
      synced += 1;
    }

    const syncedAt = new Date().toISOString();
    const { error: updateError } = await admin.from("partner_integrations")
      .update({ last_synced_at: syncedAt, updated_at: syncedAt })
      .eq("id", integration.id)
      .eq("user_id", principal.user.id);
    if (updateError) throw updateError;

    await admin.from("partner_events").insert({
      user_id: principal.user.id,
      partner: "sporthub",
      event_type: "sporthub.manual_sync.completed",
      payload: { synced_count: synced, rejected_count: rejected },
    });
    await recordSecurityEvent(req, {
      eventType: "integration.sporthub.sync_completed",
      category: "data_change",
      severity: rejected ? "low" : "info",
      outcome: "success",
      principal,
      action: "sync_partner_activity",
      resourceType: "public.partner_integrations",
      resourceId: integration.id,
      metadata: { synced_count: synced, rejected_count: rejected },
    });

    return jsonResponse(req, { ok: true, synced, rejected, last_synced_at: syncedAt });
  } catch (error) {
    console.error("SportHub sync failed", {
      code: error instanceof HttpError ? error.code : "internal_error",
    });
    return errorResponse(req, error);
  }
});
