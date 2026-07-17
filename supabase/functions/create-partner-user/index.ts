import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
  type SecurityPrincipal,
} from "../_shared/security.ts";

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
    const { data: authData, error: authCreateError } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(email.toLowerCase(), {
        redirectTo: `${appBaseUrl}/partner/auth?invited=1`,
        data: {
          full_name: fullName || email.split("@")[0],
          account_type: "partner",
        },
      });
    if (authCreateError || !authData.user) {
      console.error("Partner invitation creation failed", {
        status: authCreateError?.status,
      });
      throw new HttpError(409, "partner_invitation_failed");
    }

    const userId = authData.user.id;
    try {
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .upsert({
          user_id: userId,
          full_name: fullName || email.split("@")[0],
        });
      if (profileError) throw profileError;

      const { error: partnerRoleError } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: userId, role: "partner" });
      if (partnerRoleError) throw partnerRoleError;

      const { data: linkedRestaurant, error: restaurantUpdateError } =
        await supabaseAdmin
          .from("restaurants")
          .update({ owner_id: userId })
          .eq("id", restaurantId)
          .is("owner_id", null)
          .select("id")
          .maybeSingle();
      if (restaurantUpdateError) throw restaurantUpdateError;
      if (!linkedRestaurant) {
        throw new Error("restaurant_owner_conflict");
      }
    } catch (error) {
      const { error: cleanupError } =
        await supabaseAdmin.auth.admin.deleteUser(userId);
      if (cleanupError) {
        console.error("Partner invitation cleanup failed", {
          status: cleanupError.status,
        });
      }
      throw error;
    }

    await recordSecurityEvent(req, {
      eventType: "admin.partner_invitation_created",
      category: "admin",
      severity: "medium",
      outcome: "success",
      principal,
      action: "invite_partner_owner",
      resourceType: "restaurant",
      resourceId: restaurantId,
      metadata: { invited_user_id: userId },
    });

    return jsonResponse(req, { success: true, user_id: userId, invited: true });
  } catch (error) {
    await recordSecurityEvent(req, {
      eventType: "admin.partner_invitation_failed",
      category: "admin",
      severity: "high",
      outcome: "failure",
      principal,
      action: "invite_partner_owner",
      metadata: {
        code: error instanceof HttpError ? error.code : "internal_error",
      },
    });
    return errorResponse(req, error);
  }
});
