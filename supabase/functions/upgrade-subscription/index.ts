import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

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
  type SecurityPrincipal,
} from "../_shared/security.ts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface UpgradeRequest {
  subscription_id?: string;
  new_plan_id?: string;
  payment_method?: "wallet" | "card";
  promo_code?: string;
}

const KNOWN_ERRORS = new Set([
  "SUBSCRIPTION_NOT_FOUND",
  "PAYMENT_PLAN_NOT_FOUND",
  "SUBSCRIPTION_PLAN_UNCHANGED",
  "PROMOTION_INVALID",
  "PROMOTION_LIMIT_REACHED",
  "PROMOTION_MINIMUM_NOT_MET",
  "PROMOTION_USER_LIMIT_REACHED",
  "WALLET_NOT_FOUND",
  "INSUFFICIENT_WALLET_BALANCE",
]);

function knownError(message: string): string {
  return [...KNOWN_ERRORS].find((code) => message.includes(code)) || "UPGRADE_FAILED";
}

serve(async (req: Request): Promise<Response> => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  let principal: SecurityPrincipal | null = null;
  let subscriptionId: string | null = null;

  try {
    requirePost(req);
    principal = await authenticateRequest(req);
    await enforceRateLimit(
      req,
      "subscription-upgrade",
      principal.user.id,
      10,
      60 * 60,
    );

    const body = await readJsonBody<UpgradeRequest>(req, 8 * 1024);
    subscriptionId = String(body.subscription_id || "").trim();
    const planId = String(body.new_plan_id || "").trim();
    if (!UUID_PATTERN.test(subscriptionId) || !UUID_PATTERN.test(planId)) {
      throw new HttpError(400, "invalid_upgrade_reference");
    }

    if (body.payment_method !== "wallet") {
      return jsonResponse(req, {
        success: false,
        error: "card_payment_requires_checkout",
        code: "PAYMENT_REQUIRED",
      }, 402);
    }

    const promoCode = body.promo_code?.trim();
    if (promoCode && (promoCode.length > 64 || !/^[A-Z0-9_-]+$/i.test(promoCode))) {
      throw new HttpError(400, "promotion_invalid");
    }

    const service = getServiceClient();
    const { data, error } = await service.rpc("upgrade_subscription_with_wallet", {
      p_user_id: principal.user.id,
      p_subscription_id: subscriptionId,
      p_plan_id: planId,
      p_promo_code: promoCode || null,
    });

    if (error) {
      const code = knownError(error.message);
      console.error("Atomic subscription upgrade rejected", { code, dbCode: error.code });
      const status = code === "INSUFFICIENT_WALLET_BALANCE" ? 402 : 409;
      return jsonResponse(req, { success: false, error: code, code }, status);
    }

    await recordSecurityEvent(req, {
      eventType: "subscription.wallet_upgrade.completed",
      category: "payment",
      severity: "medium",
      outcome: "success",
      principal,
      action: "upgrade_subscription_with_wallet",
      resourceType: "public.subscriptions",
      resourceId: subscriptionId,
      metadata: { new_plan_id: planId, promotion_applied: Boolean(promoCode) },
    });

    return jsonResponse(req, data);
  } catch (error) {
    if (principal) {
      await recordSecurityEvent(req, {
        eventType: "subscription.wallet_upgrade.failed",
        category: "payment",
        severity: "medium",
        outcome: error instanceof HttpError && [401, 403, 429].includes(error.status)
          ? "denied"
          : "failure",
        principal,
        action: "upgrade_subscription_with_wallet",
        resourceType: "public.subscriptions",
        resourceId: subscriptionId || undefined,
        metadata: { error_code: error instanceof HttpError ? error.code : "internal_error" },
      });
    }
    return errorResponse(req, error);
  }
});
