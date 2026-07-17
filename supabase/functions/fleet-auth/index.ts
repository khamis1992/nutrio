import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

import {
  handlePreflight,
  jsonResponse,
} from "../_shared/security.ts";

// Retired in favor of Supabase Auth sessions used by FleetAuthContext.
// Keeping a closed endpoint lets deployed environments fail safely while old
// clients are upgraded, instead of preserving a second custom JWT system.
serve((req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  return jsonResponse(req, { error: "legacy_fleet_auth_retired" }, 410);
});
