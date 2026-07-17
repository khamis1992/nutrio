import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

import {
  decryptSecret,
  encryptSecret,
  getAdminClient,
  sha256,
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
  type SecurityPrincipal,
} from "../_shared/security.ts";

type PendingLink = {
  pending_id: string;
  external_user_id: string;
  access_token_encrypted: string;
  refresh_token_encrypted: string | null;
  scope: string | null;
  token_expires_at: string | null;
  redirect_path: string;
};

serve(async (req: Request): Promise<Response> => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  let principal: SecurityPrincipal | null = null;
  let pendingId: string | null = null;
  try {
    requirePost(req);
    principal = await authenticateRequest(req);
    await enforceRateLimit(
      req,
      "sporthub-link-complete",
      principal.user.id,
      8,
      10 * 60,
    );

    const body = await readJsonBody<{ completion_token?: unknown }>(req, 2 * 1024);
    if (
      Object.keys(body).some((key) => key !== "completion_token")
      || typeof body.completion_token !== "string"
      || !/^[A-Za-z0-9_-]{43}$/.test(body.completion_token)
    ) {
      throw new HttpError(400, "sporthub_completion_token_invalid");
    }

    const handleHash = await sha256(body.completion_token);
    const admin = getAdminClient();
    const { data, error: claimError } = await admin.rpc(
      "consume_sporthub_pending_link",
      {
        p_handle_hash: handleHash,
        p_user_id: principal.user.id,
      },
    );
    const pending = (Array.isArray(data) ? data[0] : null) as PendingLink | null;
    if (claimError || !pending) {
      await recordSecurityEvent(req, {
        eventType: "integration.sporthub.link_completion_rejected",
        category: "authorization",
        severity: "high",
        outcome: "denied",
        principal,
        action: "claim_oauth_link",
        resourceType: "public.partner_oauth_pending_links",
        resourceId: "sporthub",
      });
      throw new HttpError(403, "sporthub_link_confirmation_invalid");
    }
    pendingId = pending.pending_id;

    const accessToken = await decryptSecret(
      pending.access_token_encrypted,
      `sporthub:${pending.pending_id}:access`,
    );
    const refreshToken = pending.refresh_token_encrypted
      ? await decryptSecret(
        pending.refresh_token_encrypted,
        `sporthub:${pending.pending_id}:refresh`,
      )
      : null;
    const [accessTokenEncrypted, refreshTokenEncrypted] = await Promise.all([
      encryptSecret(accessToken, `sporthub:${principal.user.id}:access`),
      refreshToken
        ? encryptSecret(refreshToken, `sporthub:${principal.user.id}:refresh`)
        : Promise.resolve(null),
    ]);

    const linkedAt = new Date().toISOString();
    const { data: integrationId, error: linkError } = await admin.rpc(
      "complete_sporthub_link",
      {
        p_user_id: principal.user.id,
        p_external_user_id: pending.external_user_id,
        p_access_token_encrypted: accessTokenEncrypted,
        p_refresh_token_encrypted: refreshTokenEncrypted,
        p_scope: pending.scope,
        p_expires_at: pending.token_expires_at,
        p_linked_at: linkedAt,
      },
    );
    if (linkError || typeof integrationId !== "string") {
      throw new HttpError(409, "sporthub_external_account_already_linked");
    }

    const { error: deleteError } = await admin
      .from("partner_oauth_pending_links")
      .delete()
      .eq("id", pending.pending_id)
      .eq("user_id", principal.user.id);
    if (deleteError) {
      console.warn("Completed SportHub pending link could not be deleted", {
        pendingId: pending.pending_id,
      });
    }

    await recordSecurityEvent(req, {
      eventType: "integration.sporthub.linked",
      category: "authorization",
      severity: "medium",
      outcome: "success",
      principal,
      action: "complete_authenticated_oauth_link",
      resourceType: "public.partner_integrations",
      resourceId: integrationId,
      metadata: {
        pending_link_id: pending.pending_id,
        token_expires_at: pending.token_expires_at,
        scope_present: Boolean(pending.scope),
      },
    });

    return jsonResponse(req, { ok: true, integration_id: integrationId });
  } catch (error) {
    if (principal && pendingId) {
      await recordSecurityEvent(req, {
        eventType: "integration.sporthub.link_failed",
        category: "authorization",
        severity: "medium",
        outcome: "failure",
        principal,
        action: "complete_authenticated_oauth_link",
        resourceType: "public.partner_oauth_pending_links",
        resourceId: pendingId,
        metadata: {
          error_code: error instanceof HttpError ? error.code : "completion_failed",
        },
      });
    }
    console.error("SportHub authenticated link completion failed", {
      code: error instanceof HttpError ? error.code : "completion_failed",
    });
    return errorResponse(req, error);
  }
});
