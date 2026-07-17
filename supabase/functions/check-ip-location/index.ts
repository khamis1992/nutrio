import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import {
  enforceRateLimit,
  errorResponse,
  getClientIp,
  getServiceClient,
  handlePreflight,
  HttpError,
  jsonResponse,
  recordSecurityEvent,
  requirePost,
} from "../_shared/security.ts";
import { lookupIpGeo, normalizeIpAddress } from "../_shared/ipGeo.ts";

const ALLOWED_COUNTRY = "QA";

serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  try {
    requirePost(req);
    const clientIp = normalizeIpAddress(getClientIp(req));
    if (!clientIp) {
      return jsonResponse(req, {
        allowed: false,
        blocked: false,
        ip: "unknown",
        reason: "Unable to determine client IP",
      }, 422);
    }

    await enforceRateLimit(req, "ip-location", clientIp, 30, 3600);
    const supabase = getServiceClient();
    const { data: blocked, error: blockedError } = await supabase.rpc(
      "is_ip_blocked",
      { p_ip: clientIp },
    );
    if (blockedError) throw blockedError;
    if (blocked) {
      await recordSecurityEvent(req, {
        eventType: "network.blocked_ip_request",
        category: "detection",
        severity: "high",
        outcome: "blocked",
        actorType: "anonymous",
        action: "geo_access_check",
      });
      return jsonResponse(req, {
        allowed: false,
        blocked: true,
        ip: clientIp,
        reason: "IP is blocked",
      });
    }

    let countryCode =
      req.headers.get("cf-ipcountry")?.trim().toUpperCase() || null;
    let country: string | null = null;
    let city: string | null = null;

    if (!countryCode || countryCode === "XX") {
      const geoData = await lookupIpGeo(clientIp);
      countryCode = geoData.countryCode;
      country = geoData.country;
      city = geoData.city;
    }

    return jsonResponse(req, {
      allowed: countryCode === ALLOWED_COUNTRY,
      blocked: false,
      ip: clientIp,
      countryCode,
      country,
      city,
      ...(countryCode === ALLOWED_COUNTRY
        ? {}
        : { reason: "Nutrio is currently available in Qatar only" }),
    });
  } catch (error) {
    console.error("IP location check failed:", error);
    if (error instanceof HttpError) return errorResponse(req, error);
    return jsonResponse(req, {
      allowed: false,
      blocked: false,
      ip: "unknown",
      reason: "Location verification is temporarily unavailable",
    }, 503);
  }
});
