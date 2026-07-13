import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

import {
  corsHeaders,
  getAdminClient,
  getAuthenticatedUser,
  jsonResponse,
} from "../_shared/sporthub.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return jsonResponse({ error: "unauthorized" }, 401);
    const admin = getAdminClient();
    const { data: integration, error } = await admin.from("partner_integrations")
      .select("id,external_user_id")
      .eq("user_id", user.id)
      .eq("partner", "sporthub")
      .maybeSingle();
    if (error) throw error;

    if (integration) {
      await admin.from("partner_credentials").delete().eq("integration_id", integration.id);
      const now = new Date().toISOString();
      const { error: updateError } = await admin.from("partner_integrations").update({
        consent_status: "revoked",
        unlinked_at: now,
        updated_at: now,
        metadata: { revoked_by: "user", revoked_at: now },
      }).eq("id", integration.id);
      if (updateError) throw updateError;

      await admin.from("partner_events").insert({
        user_id: user.id,
        partner: "sporthub",
        event_type: "sporthub.account.unlinked",
        payload: { external_user_id: integration.external_user_id },
      });
    }

    return jsonResponse({ ok: true });
  } catch (error) {
    console.error("SportHub unlink failed", error);
    return jsonResponse({ error: "unlink_failed" }, 500);
  }
});
