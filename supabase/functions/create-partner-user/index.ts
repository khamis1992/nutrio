import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
import {
  assertSignupProvisioningGrantConsumed,
  clearSignupProvisioningMetadata,
  issueSignupProvisioningGrant,
} from "../_shared/signupProvisioning.ts";

const EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  let targetRestaurantId: string | null = null;
  let invitationCleanupFailed = false;

  try {
    requirePost(req);
    principal = await requireAdmin(req);
    await enforceRateLimit(req, "create-partner-user", principal.user.id, 5, 3600);

    const body = await readJsonBody<Record<string, unknown>>(req, 8 * 1024);
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const fullName =
      typeof body.full_name === "string" ? body.full_name.trim() : "";
    const restaurantId =
      typeof body.restaurant_id === "string" ? body.restaurant_id.trim() : "";

    if (
      !EMAIL_PATTERN.test(email) ||
      email.length > 254 ||
      !UUID_PATTERN.test(restaurantId) ||
      fullName.length > 100 ||
      hasControlCharacters(fullName)
    ) {
      throw new HttpError(400, "invalid_partner_invitation");
    }
    targetRestaurantId = restaurantId;

    const supabaseAdmin = getServiceClient();

    const { data: restaurant, error: restaurantLookupError } =
      await supabaseAdmin
        .from("restaurants")
        .select("id, owner_id")
        .eq("id", restaurantId)
        .maybeSingle();
    if (restaurantLookupError) throw restaurantLookupError;
    if (!restaurant) throw new HttpError(404, "restaurant_not_found");
    if (restaurant.owner_id) {
      throw new HttpError(409, "restaurant_already_has_owner");
    }

    const appBaseUrl = (
      Deno.env.get("NUTRIO_APP_URL") || "https://nutrio.me/nutrio"
    ).replace(/\/$/, "");
    const provisioningGrant = await issueSignupProvisioningGrant(
      supabaseAdmin,
      {
        email: email.toLowerCase(),
        kind: "partner_invitation",
        createdBy: principal.user.id,
      },
    );
    const { data: authData, error: authCreateError } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(email.toLowerCase(), {
        redirectTo: `${appBaseUrl}/partner/auth?invited=1`,
        data: {
          full_name: fullName || email.split("@")[0],
          nutrio_provisioning_token: provisioningGrant.token,
          nutrio_provisioning_kind: provisioningGrant.kind,
        },
      });
    if (authCreateError || !authData.user) {
      console.error("Partner invitation creation failed", {
        status: authCreateError?.status,
      });
      throw new HttpError(409, "partner_invitation_failed");
    }

    const userId = authData.user.id;
    invitedUserId = userId;
    try {
      await assertSignupProvisioningGrantConsumed(
        supabaseAdmin,
        provisioningGrant.tokenHash,
      );
      await clearSignupProvisioningMetadata(
        supabaseAdmin,
        userId,
        authData.user.user_metadata,
      );
      const countryCode = req.headers.get("cf-ipcountry")?.trim().toUpperCase();
      const correlationId = req.headers.get("x-correlation-id")?.trim();
      const userAgent = req.headers.get("user-agent")?.trim();
      const { error: finalizeError } = await supabaseAdmin.rpc(
        "admin_finalize_partner_invitation",
        {
          p_actor_user_id: principal.user.id,
          p_invited_user_id: userId,
          p_restaurant_id: restaurantId,
          p_full_name: fullName || email.split("@")[0],
          p_request_id: getRequestId(req),
          p_correlation_id: correlationId?.slice(0, 160) || null,
          p_session_fingerprint: await getSessionFingerprint(req),
          p_ip_address: getClientIp(req),
          p_country_code: countryCode && /^[A-Z]{2}$/.test(countryCode)
            ? countryCode
            : null,
          p_user_agent: userAgent && !/[\r\n\0]/.test(userAgent)
            ? userAgent.slice(0, 1000)
            : null,
        },
      );
      if (finalizeError) throw finalizeError;
    } catch (error) {
      const { error: cleanupError } =
        await supabaseAdmin.auth.admin.deleteUser(userId);
      if (cleanupError) {
        invitationCleanupFailed = true;
        console.error("Partner invitation cleanup failed", {
          status: cleanupError.status,
          invited_user_id: userId,
          restaurant_id: restaurantId,
        });
      }
      throw error;
    }

    return jsonResponse(req, { success: true, user_id: userId, invited: true });
  } catch (error) {
    await recordSecurityEvent(req, {
      eventType: "admin.partner_invitation_failed",
      category: "admin",
      severity: invitationCleanupFailed ? "critical" : "high",
      outcome: "failure",
      principal,
      action: "invite_partner_owner",
      metadata: {
        code: error instanceof HttpError ? error.code : "internal_error",
        invited_user_id: invitedUserId,
        restaurant_id: targetRestaurantId,
        cleanup_failed: invitationCleanupFailed,
      },
    });
    return errorResponse(req, error);
  }
});
