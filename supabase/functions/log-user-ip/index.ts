import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import {
  authenticateRequest,
  enforceRateLimit,
  errorResponse,
  getClientIp,
  getServiceClient,
  handlePreflight,
  HttpError,
  jsonResponse,
  readJsonBody,
  recordSecurityEvent,
  requirePost,
} from "../_shared/security.ts";

function isValidIpAddress(value: string): boolean {
  if (value.length > 64) return false;
  const ipv4Parts = value.split(".");
  if (
    ipv4Parts.length === 4 &&
    ipv4Parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)
  ) {
    return true;
  }
  return value.includes(":") && /^[0-9a-f:.]+$/i.test(value);
}

serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  try {
    requirePost(req);
    const principal = await authenticateRequest(req);
    await enforceRateLimit(req, "user-ip-log", principal.user.id, 30, 86400);
    const { action } = await readJsonBody<{ action?: string }>(req, 2 * 1024);
    if (action !== "signup" && action !== "login") {
      throw new HttpError(400, "invalid_auth_action");
    }

    const clientIp = getClientIp(req) || "";
    if (!isValidIpAddress(clientIp)) {
      throw new HttpError(422, "client_ip_unavailable");
    }
    const countryCode = req.headers.get("cf-ipcountry")?.trim().toUpperCase() || null;

    const supabase = getServiceClient();
    const { error } = await supabase.from("user_ip_logs").insert({
      user_id: principal.user.id,
      ip_address: clientIp,
      country_code: countryCode,
      country_name: null,
      city: null,
      action,
      user_agent: (req.headers.get("user-agent") || "unknown").slice(0, 1000),
    });
    if (error) throw error;

    await recordSecurityEvent(req, {
      eventType: `authentication.${action}.succeeded`,
      category: "authentication",
      severity: "info",
      outcome: "success",
      principal,
      action,
      resourceType: "auth.user",
      resourceId: principal.user.id,
    });

    return jsonResponse(req, { success: true });
  } catch (error) {
    console.error("User IP logging failed:", error);
    return errorResponse(req, error);
  }
});
