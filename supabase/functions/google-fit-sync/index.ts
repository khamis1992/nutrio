import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import {
  fetchGoogleFitWorkouts,
  getGoogleFitCredentials,
  getValidGoogleFitCredentials,
} from "../_shared/googleFit.ts";
import {
  authenticateRequest,
  enforceRateLimit,
  errorResponse,
  getServiceClient,
  handlePreflight,
  HttpError,
  jsonResponse,
  readJsonBody,
  recordSecurityEvent,
  requirePost,
} from "../_shared/security.ts";

type SyncAction = "status" | "sync" | "disconnect";

function parseDate(value: unknown, field: string): Date {
  if (typeof value !== "string" || value.length > 40) {
    throw new HttpError(400, `invalid_${field}`);
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new HttpError(400, `invalid_${field}`);
  return date;
}

serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  let authenticatedUserId: string | null = null;
  let requestedAction: SyncAction | null = null;
  const correlationId = crypto.randomUUID();

  try {
    requirePost(req);
    const principal = await authenticateRequest(req);
    authenticatedUserId = principal.user.id;
    const body = await readJsonBody<{
      action?: unknown;
      startTime?: unknown;
      endTime?: unknown;
    }>(req, 4 * 1024);
    const action = String(body.action || "status") as SyncAction;
    if (!(["status", "sync", "disconnect"] as string[]).includes(action)) {
      throw new HttpError(400, "invalid_action");
    }
    requestedAction = action;

    await enforceRateLimit(
      req,
      `google-fit-${action}`,
      principal.user.id,
      action === "sync" ? 30 : 60,
      60 * 60,
    );
    const service = getServiceClient();

    if (action === "status") {
      const credentials = await getGoogleFitCredentials(service, principal.user.id);
      return jsonResponse(req, {
        connected: Boolean(credentials),
        expires_at: credentials?.expiresAt ?? null,
      });
    }

    if (action === "disconnect") {
      const { data, error } = await service.rpc("delete_google_fit_server_credentials", {
        p_user_id: principal.user.id,
      });
      if (error) throw new HttpError(503, "integration_storage_unavailable");
      await recordSecurityEvent(req, {
        eventType: "integration.google_fit_disconnected",
        category: "authorization",
        severity: "info",
        outcome: "success",
        principal,
        action: "disconnect_google_fit",
        resourceType: "integration",
        resourceId: "google_fit",
        metadata: { existed: Boolean(data) },
      });
      return jsonResponse(req, { success: true });
    }

    const startTime = parseDate(body.startTime, "start_time");
    const endTime = parseDate(body.endTime, "end_time");
    const rangeMs = endTime.getTime() - startTime.getTime();
    if (rangeMs <= 0 || rangeMs > 31 * 24 * 60 * 60 * 1000) {
      throw new HttpError(400, "invalid_date_range");
    }
    if (endTime.getTime() > Date.now() + 5 * 60 * 1000) {
      throw new HttpError(400, "future_date_range");
    }

    const credentials = await getValidGoogleFitCredentials(service, principal.user.id);
    const workouts = await fetchGoogleFitWorkouts(
      credentials.accessToken,
      startTime,
      endTime,
    );

    if (workouts.length > 0) {
      const rows = workouts.map((workout) => ({
        user_id: principal.user.id,
        session_date: workout.startTime.slice(0, 10),
        workout_type: workout.type,
        duration_minutes: workout.duration,
        calories_burned: workout.calories,
        source: "google_fit",
        source_external_id: `${principal.user.id}:${workout.id}`,
        created_at: workout.startTime,
        external_metadata: {
          ended_at: workout.endTime,
          calorie_source: "device_sync",
        },
      }));
      const { error } = await service.from("workout_sessions").upsert(rows, {
        onConflict: "source,source_external_id",
      });
      if (error) throw new HttpError(503, "workout_storage_unavailable");
    }

    await recordSecurityEvent(req, {
      eventType: "integration.google_fit_synced",
      category: "api",
      severity: "info",
      outcome: "success",
      principal,
      action: "sync_google_fit",
      resourceType: "integration",
      resourceId: "google_fit",
      metadata: {
        workout_count: workouts.length,
        range_days: Math.ceil(rangeMs / (24 * 60 * 60 * 1000)),
      },
    });

    return jsonResponse(req, { success: true, workouts });
  } catch (error) {
    const shouldEmitSyncFailure =
      authenticatedUserId !== null &&
      requestedAction === "sync" &&
      (!(error instanceof HttpError) || error.status >= 500);

    if (shouldEmitSyncFailure) {
      try {
        const service = getServiceClient();
        const errorCode = error instanceof HttpError ? error.code : "health_sync_failed";
        const fiveMinuteBucket = Math.floor(Date.now() / (5 * 60 * 1000));
        const { error: eventError } = await service.rpc("emit_domain_event", {
          p_event_type: "health.sync_failed.v1",
          p_aggregate_type: "health_sync",
          p_aggregate_id: null,
          p_audience_user_id: authenticatedUserId,
          p_idempotency_key:
            `google-fit-sync:${authenticatedUserId}:${fiveMinuteBucket}`,
          p_payload: {
            provider: "google_fit",
            error_code: errorCode,
          },
          p_actor_id: authenticatedUserId,
          p_correlation_id: correlationId,
          p_causation_id: null,
          p_privacy_classification: "restricted",
          p_occurred_at: new Date().toISOString(),
        });

        if (eventError) {
          console.error("Failed to enqueue Google Fit sync failure notification", {
            code: eventError.code,
          });
        }
      } catch (eventError) {
        console.error("Failed to record Google Fit sync failure event", {
          error: eventError instanceof Error ? eventError.name : "unknown_error",
        });
      }
    }

    return errorResponse(req, error);
  }
});
