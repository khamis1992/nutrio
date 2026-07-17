import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import { refreshGoogleFitCredentials } from "../_shared/googleFit.ts";
import {
  authenticateRequest,
  enforceRateLimit,
  errorResponse,
  getServiceClient,
  handlePreflight,
  jsonResponse,
  readJsonBody,
  requirePost,
} from "../_shared/security.ts";

serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  try {
    requirePost(req);
    const principal = await authenticateRequest(req);
    await enforceRateLimit(req, "google-fit-refresh", principal.user.id, 20, 60 * 60);
    await readJsonBody<Record<string, never>>(req, 1024);

    const credentials = await refreshGoogleFitCredentials(
      getServiceClient(),
      principal.user.id,
    );

    // Never return provider tokens to the browser.
    return jsonResponse(req, {
      success: true,
      expires_at: credentials.expiresAt,
    });
  } catch (error) {
    return errorResponse(req, error);
  }
});
