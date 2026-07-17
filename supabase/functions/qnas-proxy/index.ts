import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import {
  enforceRateLimit,
  errorResponse,
  getCorsHeaders,
  handlePreflight,
  HttpError,
  readJsonBody,
  requireAdmin,
  requirePost,
} from "../_shared/security.ts";

const QNAS_BASE = "https://qnas.qa";
const allowedPaths = [
  /^\/get_zones$/,
  /^\/get_streets\/\d{1,10}$/,
  /^\/get_buildings\/\d{1,10}\/\d{1,10}$/,
];

serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  try {
    requirePost(req);
    const principal = await requireAdmin(req);
    await enforceRateLimit(req, "qnas-proxy", principal.user.id, 120, 3600);

    const qnasToken = Deno.env.get("QNAS_TOKEN") || "";
    const qnasDomain = Deno.env.get("QNAS_DOMAIN") || "";
    if (!qnasToken || !qnasDomain) {
      throw new HttpError(503, "qnas_not_configured");
    }

    const { path } = await readJsonBody<{ path?: string }>(req, 4 * 1024);
    if (!path || !allowedPaths.some((pattern) => pattern.test(path))) {
      throw new HttpError(400, "unsupported_qnas_path");
    }

    const qnasUrl = new URL(path, QNAS_BASE);
    if (qnasUrl.origin !== QNAS_BASE) {
      throw new HttpError(400, "unsupported_qnas_host");
    }

    const response = await fetch(qnasUrl, {
      headers: {
        Accept: "application/json",
        "X-Token": qnasToken,
        "X-Domain": qnasDomain,
      },
      signal: AbortSignal.timeout(12_000),
    });
    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > 2 * 1024 * 1024) {
      throw new HttpError(502, "qnas_response_too_large");
    }

    const body = await response.text();
    if (new TextEncoder().encode(body).byteLength > 2 * 1024 * 1024) {
      throw new HttpError(502, "qnas_response_too_large");
    }
    if (!response.ok) {
      console.error("QNAS provider returned status", response.status);
      throw new HttpError(502, "qnas_provider_unavailable");
    }

    try {
      JSON.parse(body);
    } catch {
      throw new HttpError(502, "invalid_qnas_response");
    }

    return new Response(body, {
      status: 200,
      headers: {
        ...getCorsHeaders(req),
        "Content-Type": "application/json; charset=utf-8",
      },
    });
  } catch (error) {
    console.error("QNAS proxy failed:", error);
    return errorResponse(req, error);
  }
});
