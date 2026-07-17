import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import {
  authenticateRequest,
  enforceRateLimit,
  errorResponse,
  getAuthenticatedClient,
  handlePreflight,
  HttpError,
  jsonResponse,
  readJsonBody,
  recordSecurityEvent,
  requirePost,
  type SecurityPrincipal,
} from "../_shared/security.ts";

const EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const PHONE_PATTERN = /^\+?[0-9][0-9\s-]{6,19}$/;
const ALLOWED_KEYS = new Set(["full_name", "phone"]);

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
    principal = await authenticateRequest(req);
    await enforceRateLimit(req, "register-driver", principal.user.id, 3, 3600);

    if (
      !principal.user.email ||
      !EMAIL_PATTERN.test(principal.user.email) ||
      !principal.user.email_confirmed_at
    ) {
      throw new HttpError(403, "verified_email_required");
    }

    const metadata = principal.user.user_metadata || {};
    if (metadata.account_type !== "driver") {
      throw new HttpError(403, "driver_registration_intent_required");
    }

    const body = await readJsonBody<Record<string, unknown>>(req, 8 * 1024);
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      Object.keys(body).some((key) => !ALLOWED_KEYS.has(key))
    ) {
      throw new HttpError(400, "invalid_driver_application");
    }

    const fullName = typeof body.full_name === "string"
      ? body.full_name.trim()
      : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    if (
      fullName.length < 2 ||
      fullName.length > 100 ||
      hasControlCharacters(fullName) ||
      !PHONE_PATTERN.test(phone) ||
      hasControlCharacters(phone)
    ) {
      throw new HttpError(400, "invalid_driver_application");
    }

    const authenticated = getAuthenticatedClient(req);
    const { data: existing, error: existingError } = await authenticated
      .from("drivers")
      .select("id, approval_status")
      .eq("user_id", principal.user.id)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) {
      return jsonResponse(req, { success: true, driver: existing, created: false });
    }

    const { error: profileError } = await authenticated
      .from("profiles")
      .upsert(
        {
          user_id: principal.user.id,
          full_name: fullName,
          email: principal.user.email.toLowerCase(),
        },
        { onConflict: "user_id" },
      );
    if (profileError) throw profileError;

    const { data: driver, error: driverError } = await authenticated
      .from("drivers")
      .insert({
        user_id: principal.user.id,
        email: principal.user.email.toLowerCase(),
        full_name: fullName,
        phone_number: phone,
        vehicle_type: "bike",
        approval_status: "pending",
        is_active: false,
        is_online: false,
        status: "pending_verification",
        current_job_id: null,
        assigned_zone_ids: [],
        wallet_balance: 0,
        total_earnings: 0,
        total_deliveries: 0,
        rating: 0,
        cancellation_rate: 0,
        payout_details: null,
      })
      .select("id, approval_status")
      .single();
    if (driverError || !driver) {
      if (driverError?.code === "23505") {
        const { data: concurrent, error: concurrentError } = await authenticated
          .from("drivers")
          .select("id, approval_status")
          .eq("user_id", principal.user.id)
          .maybeSingle();
        if (concurrentError || !concurrent) throw concurrentError || driverError;
        return jsonResponse(req, {
          success: true,
          driver: concurrent,
          created: false,
        });
      }
      throw driverError || new Error("driver_application_not_created");
    }

    await recordSecurityEvent(req, {
      eventType: "driver.application_registered",
      category: "authorization",
      severity: "medium",
      outcome: "success",
      principal,
      actorType: "driver",
      action: "register_driver_application",
      resourceType: "driver",
      resourceId: driver.id,
      metadata: { approval_status: driver.approval_status },
    });

    return jsonResponse(req, { success: true, driver, created: true }, 201);
  } catch (error) {
    await recordSecurityEvent(req, {
      eventType: "driver.application_registration_failed",
      category: "authorization",
      severity: "medium",
      outcome: "failure",
      principal,
      actorType: principal ? "user" : "anonymous",
      action: "register_driver_application",
      metadata: {
        code: error instanceof HttpError ? error.code : "internal_error",
      },
    });
    return errorResponse(req, error);
  }
});
