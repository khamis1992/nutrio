import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import {
  errorResponse,
  getServiceClient,
  handlePreflight,
  HttpError,
  jsonResponse,
  readJsonBody,
  requirePost,
} from "../_shared/security.ts";

interface DeliveryClaim {
  delivery_id: string;
  notification_id: string;
  user_id: string;
  dedupe_key: string;
  attempt_count: number;
  max_attempts: number;
  lease_token: string;
}

interface WorkerBody {
  limit?: unknown;
}

const SECRET_PATTERN = /^[a-f0-9]{64}$/i;

function boundedLimit(value: unknown): number {
  const parsed = Number(value ?? 50);
  if (!Number.isFinite(parsed)) return 50;
  return Math.max(1, Math.min(100, Math.floor(parsed)));
}

function safeProviderError(status: number, value: unknown): string {
  const raw = value && typeof value === "object" && !Array.isArray(value)
    ? String(
      (value as Record<string, unknown>).error ??
        (value as Record<string, unknown>).code ??
        `http_${status}`,
    )
    : `http_${status}`;
  const normalized = raw.toLowerCase().replace(/[^a-z0-9_.-]/g, "").slice(0, 100);
  return normalized || `http_${status}`;
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

async function readSmallJson(response: Response): Promise<unknown> {
  const text = (await response.text()).slice(0, 16 * 1024);
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  try {
    requirePost(req);
    const workerSecret = req.headers.get("x-notification-worker-secret")?.trim() || "";
    if (!SECRET_PATTERN.test(workerSecret)) {
      throw new HttpError(401, "invalid_notification_worker_credentials");
    }

    const service = getServiceClient();
    const { data: verified, error: verificationError } = await service.rpc(
      "verify_notification_worker_secret",
      { p_candidate: workerSecret },
    );
    if (verificationError || verified !== true) {
      throw new HttpError(401, "invalid_notification_worker_credentials");
    }

    const body = await readJsonBody<WorkerBody>(req, 2 * 1024);
    const limit = boundedLimit(body.limit);

    const { data: eventResult, error: eventError } = await service.rpc(
      "process_notification_domain_events",
      { p_limit: limit, p_lease_seconds: 120 },
    );
    if (eventError) {
      console.error("Domain event expansion failed", { code: eventError.code });
      throw new HttpError(503, "domain_event_pipeline_unavailable");
    }

    const { data: claimed, error: claimError } = await service.rpc(
      "claim_notification_event_deliveries",
      { p_limit: limit, p_lease_seconds: 120 },
    );
    if (claimError) {
      console.error("Notification delivery claim failed", { code: claimError.code });
      throw new HttpError(503, "notification_delivery_queue_unavailable");
    }

    const deliveries = Array.isArray(claimed) ? claimed as DeliveryClaim[] : [];
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    if (!supabaseUrl) throw new HttpError(503, "notification_transport_unavailable");

    let delivered = 0;
    let retrying = 0;
    let deadLettered = 0;

    for (const delivery of deliveries) {
      let success = false;
      let retryable = true;
      let errorCode: string | null = null;

      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-notification-worker-secret": workerSecret,
          },
          body: JSON.stringify({
            notification_id: delivery.notification_id,
            user_id: delivery.user_id,
            idempotency_key: delivery.dedupe_key,
          }),
          signal: AbortSignal.timeout(20_000),
        });
        const responseBody = await readSmallJson(response);
        success = response.ok;
        retryable = isRetryableStatus(response.status);
        if (!success) errorCode = safeProviderError(response.status, responseBody);
      } catch (error) {
        errorCode = error instanceof DOMException && error.name === "TimeoutError"
          ? "push_transport_timeout"
          : "push_transport_unavailable";
        retryable = true;
      }

      const { data: completion, error: completionError } = await service.rpc(
        "complete_notification_event_delivery",
        {
          p_delivery_id: delivery.delivery_id,
          p_lease_token: delivery.lease_token,
          p_success: success,
          p_retryable: retryable,
          p_error_code: errorCode,
          p_provider_message_id: success ? delivery.notification_id : null,
        },
      );
      if (completionError) {
        console.error("Notification delivery completion failed", {
          code: completionError.code,
          deliveryId: delivery.delivery_id,
        });
        continue;
      }

      const status = completion && typeof completion === "object" && !Array.isArray(completion)
        ? String((completion as Record<string, unknown>).status ?? "")
        : "";
      if (status === "delivered") delivered += 1;
      else if (status === "dead_letter") deadLettered += 1;
      else retrying += 1;
    }

    return jsonResponse(req, {
      success: true,
      events: eventResult,
      deliveries_claimed: deliveries.length,
      delivered,
      retrying,
      dead_lettered: deadLettered,
    });
  } catch (error) {
    return errorResponse(req, error);
  }
});
