import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

import {
  authenticateRequest,
  enforceRateLimit,
  errorResponse,
  getClientIp,
  handlePreflight,
  HttpError,
  recordSecurityEvent,
  requirePost,
} from "../_shared/security.ts";

// This endpoint previously accepted arbitrary browser-supplied system prompts.
// Keep a fail-closed tombstone deployed so old clients cannot reach the provider.
serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  try {
    requirePost(req);
    const principal = await authenticateRequest(req);
    const clientIp = getClientIp(req) || "unknown";
    await Promise.all([
      enforceRateLimit(req, "retired-ai-proxy:user", principal.user.id, 5, 60 * 60),
      enforceRateLimit(req, "retired-ai-proxy:ip", clientIp, 10, 60 * 60),
    ]);

    await recordSecurityEvent(req, {
      eventType: "edge.retired_ai_proxy_attempt",
      category: "edge_function",
      severity: "medium",
      outcome: "denied",
      principal,
      action: "invoke_retired_endpoint",
      resourceType: "edge_function",
      resourceId: "proxy-openrouter",
      metadata: { replacement: "ai-router" },
    });

    throw new HttpError(410, "endpoint_retired_use_ai_router");
  } catch (error) {
    return errorResponse(req, error);
  }
});
