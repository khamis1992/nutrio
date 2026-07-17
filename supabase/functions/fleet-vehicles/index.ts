import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

import {
  handlePreflight,
  jsonResponse,
} from "../_shared/security.ts";

// Retired. Vehicle writes now use RLS and the active fleet service paths.
serve((req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  return jsonResponse(req, { error: "legacy_fleet_vehicles_retired" }, 410);
});
