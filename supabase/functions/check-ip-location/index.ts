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

const ALLOWED_COUNTRY = "QA";
const IP_LOOKUP_BASE = "https://ipwho.is";

function isValidIpAddress(value: string): boolean {
  if (value.length > 64) return false;
  const ipv4Parts = value.split(".");
  if (
    ipv4Parts.length === 4 &&
    ipv4Parts.every(
      (part) => /^\d{1,3}$/.test(part) && Number(part) >= 0 && Number(part) <= 255,
    )
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
    const clientIp = getClientIp(req) || "";
    if (!isValidIpAddress(clientIp)) {
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
      const geoResponse = await fetch(
        `${IP_LOOKUP_BASE}/${encodeURIComponent(clientIp)}?fields=success,country_code,country,city`,
        { signal: AbortSignal.timeout(5000) },
      );
      if (!geoResponse.ok) throw new Error("IP lookup failed");

      const geoData = (await geoResponse.json()) as {
        success?: boolean;
        country_code?: string;
        country?: string;
        city?: string;
      };
      if (geoData.success !== true || typeof geoData.country_code !== "string") {
        return jsonResponse(req, {
          allowed: false,
          blocked: false,
          ip: clientIp,
          reason: "Unable to verify location",
        }, 503);
      }

      countryCode = geoData.country_code.toUpperCase().slice(0, 2);
      country = typeof geoData.country === "string" ? geoData.country.slice(0, 120) : null;
      city = typeof geoData.city === "string" ? geoData.city.slice(0, 120) : null;
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
