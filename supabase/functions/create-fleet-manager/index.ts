import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import {
  assertSignupProvisioningGrantConsumed,
  clearSignupProvisioningMetadata,
  issueSignupProvisioningGrant,
} from "../_shared/signupProvisioning.ts";
import {
  enforceRateLimit,
  errorResponse,
  getClientIp,
  getRequestId,
  getSessionFingerprint,
  getServiceClient,
  handlePreflight,
  HttpError,
  jsonResponse,
  readJsonBody,
  recordSecurityEvent,
  requireAdmin,
  requirePost,
  type SecurityPrincipal,
} from "../_shared/security.ts";

const EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const PHONE_PATTERN = /^\+?[0-9][0-9\s-]{6,19}$/;
const FLEET_ROLES = new Set(["fleet_manager", "super_admin"]);
const COUNTRY_CODES = new Set(["QA", "SA", "AE", "KW", "BH", "OM"]);

function hasControlCharacters(value: string): boolean {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });
}

serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  let principal: SecurityPrincipal | null = null;
  let invitedUserId: string | null = null;
  let cleanupFailed = false;

  try {
    requirePost(req);
    principal = await requireAdmin(req);
    await enforceRateLimit(req, "create-fleet-manager", principal.user.id, 5, 3600);

    const body = await readJsonBody<Record<string, unknown>>(req, 8 * 1024);
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const fullName = typeof body.full_name === "string" ? body.full_name.trim() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    const fleetRole = typeof body.role === "string" ? body.role.trim() : "";
    const country = typeof body.country === "string" ? body.country.trim().toUpperCase() : "";

    if (
      !EMAIL_PATTERN.test(email) ||
      email.length > 254 ||
      fullName.length < 2 ||
      fullName.length > 100 ||
      hasControlCharacters(fullName) ||
      (phone && (!PHONE_PATTERN.test(phone) || hasControlCharacters(phone))) ||
      !FLEET_ROLES.has(fleetRole) ||
      (fleetRole === "fleet_manager" && !COUNTRY_CODES.has(country))
    ) {
      throw new HttpError(400, "invalid_fleet_manager_invitation");
    }

    const service = getServiceClient();
    const provisioningGrant = await issueSignupProvisioningGrant(service, {
      email,
      kind: "fleet_manager_invitation",
      createdBy: principal.user.id,
    });
    const appBaseUrl = (
      Deno.env.get("NUTRIO_APP_URL") || "https://nutrio.me/nutrio"
    ).replace(/\/$/, "");
    const { data: authData, error: authError } =
      await service.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${appBaseUrl}/fleet/login?invited=1`,
        data: {
          full_name: fullName,
          nutrio_provisioning_token: provisioningGrant.token,
          nutrio_provisioning_kind: provisioningGrant.kind,
        },
      });
    if (authError || !authData.user) {
      console.error("Fleet manager invitation failed", { status: authError?.status });
      throw new HttpError(409, "fleet_manager_invitation_failed");
    }

    const userId = authData.user.id;
    invitedUserId = userId;
    try {
      await assertSignupProvisioningGrantConsumed(service, provisioningGrant.tokenHash);
      await clearSignupProvisioningMetadata(
        service,
        userId,
        authData.user.user_metadata,
      );
      const countryCode = req.headers.get("cf-ipcountry")?.trim().toUpperCase();
      const correlationId = req.headers.get("x-correlation-id")?.trim();
      const userAgent = req.headers.get("user-agent")?.trim();
      const { error: finalizeError } = await service.rpc(
        "admin_finalize_fleet_manager_invitation",
        {
          p_actor_user_id: principal.user.id,
          p_invited_user_id: userId,
          p_email: email,
          p_full_name: fullName,
          p_phone: phone || null,
          p_fleet_role: fleetRole,
          p_country: fleetRole === "super_admin" ? null : country,
          p_request_id: getRequestId(req),
          p_correlation_id: correlationId?.slice(0, 160) || null,
          p_session_fingerprint: await getSessionFingerprint(req),
          p_ip_address: getClientIp(req),
          p_country_code: countryCode && /^[A-Z]{2}$/.test(countryCode)
            ? countryCode
            : null,
          p_user_agent: userAgent && !hasControlCharacters(userAgent)
            ? userAgent.slice(0, 1000)
            : null,
        },
      );
      if (finalizeError) throw finalizeError;
    } catch (error) {
      const { error: cleanupError } = await service.auth.admin.deleteUser(userId);
      if (cleanupError) {
        cleanupFailed = true;
        console.error("Fleet manager invitation cleanup failed", {
          invited_user_id: invitedUserId,
          status: cleanupError.status,
        });
      }
      throw error;
    }

    return jsonResponse(req, {
      success: true,
      user_id: invitedUserId,
      invited: true,
    });
  } catch (error) {
    await recordSecurityEvent(req, {
      eventType: "admin.fleet_manager_invitation_failed",
      category: "admin",
      severity: cleanupFailed ? "critical" : "high",
      outcome: "failure",
      principal,
      action: "invite_fleet_manager",
      metadata: {
        code: error instanceof HttpError ? error.code : "internal_error",
        invited_user_id: invitedUserId,
        cleanup_failed: cleanupFailed,
      },
    });
    return errorResponse(req, error);
  }
});
