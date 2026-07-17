import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

import { getAdminClient } from "../_shared/sporthub.ts";
import {
  authenticateRequest,
  enforceRateLimit,
  errorResponse,
  handlePreflight,
  jsonResponse,
  readJsonBody,
  recordSecurityEvent,
  requirePost,
} from "../_shared/security.ts";

serve(async (req: Request): Promise<Response> => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  try {
    requirePost(req);
    const principal = await authenticateRequest(req);
    await enforceRateLimit(req, "sporthub-unlink", principal.user.id, 5, 60 * 60);
    await readJsonBody<Record<string, never>>(req, 1024);

    const admin = getAdminClient();
    const { data, error } = await admin.rpc("unlink_sporthub_integration", {
      p_user_id: principal.user.id,
    });
    if (error) throw error;

    await recordSecurityEvent(req, {
      eventType: "integration.sporthub.unlinked",
      category: "authorization",
      severity: "medium",
      outcome: "success",
      principal,
      action: "revoke_partner_consent",
      resourceType: "public.partner_integrations",
      resourceId: "sporthub",
      metadata: { integration_existed: data === true },
    });

    return jsonResponse(req, { ok: true });
  } catch (error) {
    console.error("SportHub unlink failed", {
      code: error instanceof Error ? error.name : "unknown",
    });
    return errorResponse(req, error);
  }
});
