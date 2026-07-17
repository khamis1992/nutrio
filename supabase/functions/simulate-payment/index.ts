import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

import {
  enforceRateLimit,
  errorResponse,
  getServiceClient,
  handlePreflight,
  HttpError,
  jsonResponse,
  readJsonBody,
  recordSecurityEvent,
  requireAdmin,
  requirePost,
} from "../_shared/security.ts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NON_PRODUCTION_ENVIRONMENTS = new Set([
  "development",
  "local",
  "test",
  "staging",
]);

interface SimulationRequest {
  user_id?: string;
  amount?: number;
  payment_method?: "card" | "wallet" | "sadad";
  simulation_mode?: boolean;
  idempotency_key?: string;
}

serve(async (req: Request): Promise<Response> => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  let principal: Awaited<ReturnType<typeof requireAdmin>> | null = null;
  try {
    requirePost(req);

    const environment = (Deno.env.get("APP_ENV") || "").trim().toLowerCase();
    if (
      Deno.env.get("ALLOW_PAYMENT_SIMULATION") !== "true"
      || !NON_PRODUCTION_ENVIRONMENTS.has(environment)
    ) {
      throw new HttpError(404, "not_found");
    }

    principal = await requireAdmin(req);
    await enforceRateLimit(
      req,
      "payment-simulation",
      principal.user.id,
      10,
      60 * 60,
    );

    const body = await readJsonBody<SimulationRequest>(req, 8 * 1024);
    const userId = String(body.user_id || "").trim();
    const amount = Number(body.amount);
    const paymentMethod = body.payment_method || "card";
    const idempotencyKey = body.idempotency_key || crypto.randomUUID();

    if (
      !UUID_PATTERN.test(userId)
      || !UUID_PATTERN.test(idempotencyKey)
      || !Number.isFinite(amount)
      || amount <= 0
      || amount > 10000
      || body.simulation_mode === false
      || !["card", "wallet", "sadad"].includes(paymentMethod)
    ) {
      throw new HttpError(400, "invalid_simulation_request");
    }

    const service = getServiceClient();
    const { data, error } = await service.rpc("admin_simulate_wallet_payment", {
      p_actor_id: principal.user.id,
      p_user_id: userId,
      p_amount: Math.round(amount * 100) / 100,
      p_requested_method: paymentMethod,
      p_idempotency_key: idempotencyKey,
    });

    if (error) {
      console.error("Atomic payment simulation failed", { code: error.code });
      throw new HttpError(409, "payment_simulation_failed");
    }

    await recordSecurityEvent(req, {
      eventType: "admin.payment_simulation.completed",
      category: "payment",
      severity: "high",
      outcome: "success",
      principal,
      action: "simulate_wallet_payment",
      resourceType: "auth.user",
      resourceId: userId,
      metadata: {
        amount: Math.round(amount * 100) / 100,
        currency: "QAR",
        idempotency_key: idempotencyKey,
      },
    });

    return jsonResponse(req, data);
  } catch (error) {
    if (principal) {
      await recordSecurityEvent(req, {
        eventType: "admin.payment_simulation.failed",
        category: "payment",
        severity: "high",
        outcome: "failure",
        principal,
        action: "simulate_wallet_payment",
        metadata: {
          error_code: error instanceof HttpError ? error.code : "internal_error",
        },
      });
    }
    return errorResponse(req, error);
  }
});
