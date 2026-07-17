import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

import {
  handlePreflight,
  jsonResponse,
} from "../_shared/security.ts";

// Retired. The active fleet portal uses RLS-scoped queries and the hardened
// fleet Edge APIs with the caller's Supabase session.
serve((req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  return jsonResponse(req, { error: "legacy_fleet_dashboard_retired" }, 410);
});
