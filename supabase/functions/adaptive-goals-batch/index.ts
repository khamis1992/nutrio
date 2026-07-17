import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import {
  enforceRateLimit,
  errorResponse,
  getClientIp,
  getSupabasePublishableKey,
  getServiceClient,
  handlePreflight,
  HttpError,
  jsonResponse,
  recordSecurityEvent,
  requireAdminOrInternal,
  requirePost,
} from "../_shared/security.ts";

const MAX_ADAPTIVE_RESPONSE_BYTES = 64 * 1024;

async function readAdaptiveResult(response: Response): Promise<{
  adjustment_id?: string;
  duplicate?: boolean;
  recommendation?: { plateau_detected?: boolean };
}> {
  if (!response.body) throw new HttpError(502, "adaptive_goal_response_missing");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > MAX_ADAPTIVE_RESPONSE_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new HttpError(502, "adaptive_goal_response_too_large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("invalid_shape");
    }
    return parsed as {
      adjustment_id?: string;
      duplicate?: boolean;
      recommendation?: { plateau_detected?: boolean };
    };
  } catch {
    throw new HttpError(502, "adaptive_goal_response_invalid");
  }
}

serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  try {
    requirePost(req);
    const principal = await requireAdminOrInternal(
      req,
      "ADAPTIVE_GOALS_CRON_SECRET",
    );
    await enforceRateLimit(
      req,
      "adaptive-goals-batch",
      principal?.user.id || getClientIp(req) || "internal",
      2,
      3600,
    );

    const internalSecret = Deno.env.get("ADAPTIVE_GOALS_CRON_SECRET") || "";
    let publishableKey: string;
    try {
      publishableKey = getSupabasePublishableKey();
    } catch {
      throw new HttpError(503, "batch_credentials_not_configured");
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    if (!internalSecret || !supabaseUrl) {
      throw new HttpError(503, "batch_credentials_not_configured");
    }

    const supabase = getServiceClient();
    const { data: activeUsers, error: fetchError } = await supabase
      .from("profiles")
      .select("user_id, last_goal_adjustment_date")
      .eq("onboarding_completed", true)
      .order("user_id");

    if (fetchError) throw fetchError;

    const results = {
      total: activeUsers?.length || 0,
      processed: 0,
      skipped: 0,
      errors: 0,
      adjustments_created: 0,
      duplicates: 0,
      plateaus_detected: 0,
    };

    for (const user of activeUsers || []) {
      try {
        const { data: settings, error: settingsError } = await supabase
          .from("adaptive_goal_settings")
          .select("adjustment_frequency, auto_adjust_enabled")
          .eq("user_id", user.user_id)
          .maybeSingle();

        if (settingsError) throw settingsError;
        if (!settings?.auto_adjust_enabled) {
          results.skipped += 1;
          continue;
        }

        const lastAdjustment = user.last_goal_adjustment_date
          ? new Date(user.last_goal_adjustment_date)
          : null;
        const daysSinceAdjustment = lastAdjustment
          ? Math.floor((Date.now() - lastAdjustment.getTime()) / 86_400_000)
          : Number.POSITIVE_INFINITY;
        const dueAfterDays: Record<string, number> = {
          weekly: 7,
          biweekly: 14,
          monthly: 30,
        };
        const dueAfter = dueAfterDays[String(settings.adjustment_frequency)] || 30;

        if (daysSinceAdjustment < dueAfter) {
          results.skipped += 1;
          continue;
        }

        const response = await fetch(`${supabaseUrl}/functions/v1/adaptive-goals`, {
          method: "POST",
          headers: {
            apikey: publishableKey,
            "Content-Type": "application/json",
            "x-internal-secret": internalSecret,
          },
          body: JSON.stringify({ user_id: user.user_id }),
          signal: AbortSignal.timeout(30_000),
        });

        if (!response.ok) {
          throw new Error(`Adaptive goal request failed with ${response.status}`);
        }

        const result = await readAdaptiveResult(response);
        if (result.duplicate) {
          results.duplicates += 1;
          results.skipped += 1;
          continue;
        }
        results.processed += 1;
        if (result.adjustment_id) results.adjustments_created += 1;
        if (result.recommendation?.plateau_detected) {
          results.plateaus_detected += 1;
        }

        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (userError) {
        console.error("Adaptive goal user processing failed", {
          code: userError instanceof Error ? userError.name : "internal_error",
        });
        results.errors += 1;
      }
    }

    await recordSecurityEvent(req, {
      eventType: "system.adaptive_goals.batch_completed",
      category: "data_change",
      severity: results.errors ? "medium" : "info",
      outcome: results.errors ? "failure" : "success",
      principal,
      actorType: principal ? undefined : "system",
      action: "run_adaptive_goals_batch",
      resourceType: "system.batch",
      resourceId: "adaptive-goals",
      metadata: results,
    });

    return jsonResponse(req, {
      success: results.errors === 0,
      results,
      message: `Processed ${results.processed} users and created ${results.adjustments_created} adjustments`,
    });
  } catch (error) {
    console.error("Adaptive goals batch failed", {
      code: error instanceof HttpError ? error.code : "internal_error",
    });
    return errorResponse(req, error);
  }
});
