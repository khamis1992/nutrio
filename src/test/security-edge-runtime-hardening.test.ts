import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  readBoundedResponseJson,
  readBoundedResponseText,
} from "../../supabase/functions/_shared/boundedResponse";

const readRepoFile = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

const migration = readRepoFile(
  "supabase/migrations/20260717134000_harden_edge_quotas_and_delivery.sql",
);
const mealImage = readRepoFile(
  "supabase/functions/analyze-meal-image/index.ts",
);
const aiInsight = readRepoFile(
  "supabase/functions/generate-ai-insight/index.ts",
);
const mealReminders = readRepoFile(
  "supabase/functions/send-meal-reminders/index.ts",
);
const adaptiveGoals = readRepoFile(
  "supabase/functions/adaptive-goals/index.ts",
);
const adaptiveGoalsBatch = readRepoFile(
  "supabase/functions/adaptive-goals-batch/index.ts",
);
const smartAllocator = readRepoFile(
  "supabase/functions/smart-meal-allocator/index.ts",
);
const sharedSecurity = readRepoFile(
  "supabase/functions/_shared/security.ts",
);
const boundedResponse = readRepoFile(
  "supabase/functions/_shared/boundedResponse.ts",
);

const boundedProviderResponsePaths = [
  "ai-router",
  "analyze-blood-work",
  "nutrio-mcp",
  "google-fit-token",
  "process-whatsapp-notifications",
  "send-email",
  "qnas-proxy",
  "send-push-notification",
  "send-invoice-email",
  "send-whatsapp-proxy",
  "secure-sensitive-upload",
] as const;

const boundedProviderResponses = [
  ...boundedProviderResponsePaths.map((name) => ({
    name,
    source: readRepoFile(`supabase/functions/${name}/index.ts`),
  })),
  {
    name: "_shared/googleFit.ts",
    source: readRepoFile("supabase/functions/_shared/googleFit.ts"),
  },
  {
    name: "_shared/ipGeo.ts",
    source: readRepoFile("supabase/functions/_shared/ipGeo.ts"),
  },
];

const emailFunctionPaths = [
  "send-affiliate-welcome",
  "send-commission-notification",
  "send-milestone-notification",
  "send-tier-upgrade-notification",
  "send-affiliate-status-notification",
  "send-monthly-affiliate-report",
  "send-payout-notification",
] as const;

const emailFunctions = emailFunctionPaths.map((name) => ({
  name,
  source: readRepoFile(`supabase/functions/${name}/index.ts`),
}));

describe("Edge runtime security hardening", () => {
  it("cancels oversized provider streams and fails closed on invalid UTF-8 or JSON", async () => {
    let headerCancellation: unknown;
    const declaredOversize = new Response(new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("ignored"));
      },
      cancel(reason) {
        headerCancellation = reason;
      },
    }), { headers: { "Content-Length": "9" } });

    await expect(readBoundedResponseText(declaredOversize, 8, {
      tooLargeCode: "test_response_too_large",
    })).rejects.toMatchObject({
      status: 502,
      code: "test_response_too_large",
    });
    expect(headerCancellation).toBe("test_response_too_large");

    let streamCancellation: unknown;
    const streamedOversize = new Response(new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3]));
        controller.enqueue(new Uint8Array([4, 5, 6]));
      },
      cancel(reason) {
        streamCancellation = reason;
      },
    }));

    await expect(readBoundedResponseText(streamedOversize, 5)).rejects.toMatchObject({
      code: "provider_response_too_large",
    });
    expect(streamCancellation).toBe("provider_response_too_large");

    await expect(readBoundedResponseText(
      new Response(new Uint8Array([0xc3, 0x28])),
      16,
    )).rejects.toMatchObject({ code: "invalid_provider_response" });
    await expect(readBoundedResponseJson(
      new Response("{not-json}"),
      32,
    )).rejects.toMatchObject({ code: "invalid_provider_response" });
  });

  it("routes every audited provider response through the bounded reader", () => {
    expect(sharedSecurity).toContain("export async function readBoundedResponseText");
    expect(sharedSecurity).toContain("export async function readBoundedResponseJson");
    expect(boundedResponse).toContain('response.headers.get("content-length")');
    expect(boundedResponse).toContain("response.body?.getReader()");
    expect(boundedResponse).toContain("reader.cancel(tooLargeCode)");
    expect(boundedResponse).toContain('new TextDecoder("utf-8", { fatal: true })');
    expect(boundedResponse).toContain("JSON.parse(raw)");

    for (const { name, source } of boundedProviderResponses) {
      expect(source, name).toContain("readBoundedResponse");
      expect(source, name).not.toMatch(/\.(?:json|text)\s*\(/);
      if (name !== "secure-sensitive-upload") {
        expect(source, name).not.toMatch(/\.arrayBuffer\s*\(/);
      }
    }

    const sensitiveUpload = boundedProviderResponses.find(
      ({ name }) => name === "secure-sensitive-upload",
    )?.source ?? "";
    expect(sensitiveUpload).toContain("upload.file.arrayBuffer()");
  });

  it("uses a provider-scoped Manus credential and rejects free-form diet tags", () => {
    expect(mealImage).toContain('Deno.env.get("MANUS_API_KEY")');
    expect(mealImage).not.toContain("OPENAI_API_KEY");
    expect(mealImage).toContain("https://api.manus.im/api/llm-proxy/v1/chat/completions");
    expect(mealImage).toContain("const ALLOWED_DIET_TAGS = new Set([");
    expect(mealImage).toContain("ALLOWED_DIET_TAGS.has(normalized)");
    expect(mealImage).toContain("normalizeQuickScanOutput(parsed)");
    expect(mealImage).toContain("normalizeMealOutput(parsed, availableTags)");
  });

  it("checks user and IP quotas before reading the image request body", () => {
    const userQuota = mealImage.indexOf('"analyze-meal-image:user"');
    const ipQuota = mealImage.indexOf('"analyze-meal-image:ip"');
    const bodyRead = mealImage.indexOf("const body = await readAnalyzeRequest(req)");

    expect(userQuota).toBeGreaterThan(-1);
    expect(ipQuota).toBeGreaterThan(-1);
    expect(userQuota).toBeLessThan(bodyRead);
    expect(ipQuota).toBeLessThan(bodyRead);
  });

  it("reserves atomic daily AI budgets for both legacy paid endpoints", () => {
    expect(migration).toContain("'meal_image', 'daily_insight'");
    expect(migration).toContain("DROP CONSTRAINT IF EXISTS ai_usage_daily_task_allowed");
    expect(migration).toContain("DROP CONSTRAINT IF EXISTS ai_request_ledger_task_allowed");
    expect(mealImage).toContain('service.rpc(\n      "reserve_ai_request"');
    expect(mealImage).toContain('p_task: "meal_image"');
    expect(mealImage).toContain('service.rpc("complete_ai_request"');
    expect(aiInsight).toContain('p_task: "daily_insight"');
    expect(aiInsight).toContain('service.rpc("complete_ai_request"');
    expect(aiInsight).toContain('"ai-insight:ip"');
    expect(aiInsight.indexOf('"ai-insight:ip"')).toBeLessThan(
      aiInsight.indexOf("const body = await readJsonBody"),
    );
    expect(aiInsight).toContain("buildMinimizedPrompt(context)");
    expect(aiInsight).not.toContain("`- Average daily:");
    expect(aiInsight).not.toContain("`- Goals: ${context.goals.calorieTarget}");
  });

  it("routes legacy email producers through the atomic send-email boundary", () => {
    for (const { name, source } of emailFunctions) {
      expect(source, name).toContain('functions.invoke(\n    "send-email"');
      expect(source, name).toContain("idempotency_key:");
      expect(source, name).not.toContain("RESEND_API_KEY");
      expect(source, name).not.toContain("resend.emails.send");
      expect(source, name).not.toContain("emailResponse");
    }

    expect(migration).toContain("'commission_id', NEW.id");
    expect(migration).toContain("'achievement_id', NEW.id");
    expect(migration).not.toContain("'commission_amount', NEW.commission_amount");
    expect(migration).not.toContain("'bonus_amount', v_milestone.bonus_amount");
    expect(emailFunctions.find(({ name }) => name === "send-monthly-affiliate-report")?.source)
      .toContain("`affiliate-monthly:${monthKey}:${report.user_id}`");
    expect(migration).toContain("security.monthly_affiliate_report_snapshots");
    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION public.get_or_create_monthly_affiliate_report_snapshot",
    );
    expect(emailFunctions.find(({ name }) => name === "send-monthly-affiliate-report")?.source)
      .toContain('"get_or_create_monthly_affiliate_report_snapshot"');
    expect(emailFunctions.find(({ name }) => name === "send-payout-notification")?.source)
      .toContain("`affiliate-payout:${payout.id}:${payout.status}`");

    const welcome = emailFunctions.find(({ name }) => name === "send-affiliate-welcome")
      ?.source ?? "";
    expect(welcome).toContain('.select("full_name,referral_code")');
    expect(welcome).not.toContain("escapeHtml(body.referral_code)");

    const status = emailFunctions.find(
      ({ name }) => name === "send-affiliate-status-notification",
    )?.source ?? "";
    expect(status).toContain('.select("id,user_id,status,rejection_reason")');
    expect(status).not.toContain("escapeHtml(rejection_reason)");
  });

  it("deduplicates in-app notifications with a database-enforced key", () => {
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS dedupe_key TEXT");
    expect(migration).toContain("notifications_delivery_dedupe_unique");
    expect(migration).toContain("protect_notification_delivery_identity");
    expect(migration).toContain("NOTIFICATION_DELIVERY_IDENTITY_IS_SERVER_MANAGED");
    expect(mealReminders).toContain('onConflict: "user_id,type,dedupe_key"');
    expect(mealReminders).toContain("ignoreDuplicates: true");
    expect(mealReminders).not.toContain("existingReminders");
    expect(mealReminders).toContain('"meal-reminder-dispatch"');

    const tierUpgrade = emailFunctions.find(
      ({ name }) => name === "send-tier-upgrade-notification",
    )?.source ?? "";
    expect(tierUpgrade).toContain("notificationDedupeKey");
    expect(tierUpgrade).toContain('onConflict: "user_id,type,dedupe_key"');
  });

  it("persists at most one adaptive recommendation per user and day atomically", () => {
    expect(migration).toContain("goal_adjustment_history_user_day_unique");
    expect(migration).toContain("plateau_events_user_day_unique");
    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION public.persist_adaptive_goal_recommendation",
    );
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(adaptiveGoals).toContain('supabase.rpc(\n        "persist_adaptive_goal_recommendation"');
    expect(adaptiveGoals).not.toContain('.from("goal_adjustment_history")\n        .insert');
    expect(adaptiveGoalsBatch).toContain("if (result.duplicate)");
    expect(adaptiveGoalsBatch).toContain("MAX_ADAPTIVE_RESPONSE_BYTES");
    expect(adaptiveGoalsBatch).toContain("AbortSignal.timeout(30_000)");
    expect(adaptiveGoalsBatch).not.toContain("await response.json()");

    const auth = adaptiveGoals.indexOf("principal = await authenticateRequest(req)");
    const body = adaptiveGoals.indexOf("const { user_id, dry_run = false } = await readJsonBody");
    expect(auth).toBeGreaterThan(-1);
    expect(auth).toBeLessThan(body);
  });

  it("authenticates and rate-limits smart allocation before reading its body", () => {
    const auth = smartAllocator.indexOf("() => authenticateRequest(req)");
    const quota = smartAllocator.indexOf('"smart-meal-allocator"');
    const body = smartAllocator.indexOf('"request.read_body"');

    expect(auth).toBeGreaterThan(-1);
    expect(quota).toBeGreaterThan(-1);
    expect(auth).toBeLessThan(body);
    expect(quota).toBeLessThan(body);
    expect(smartAllocator).toContain("() => assertSelfOrAdmin(req, principal, user_id)");
  });

  it("does not log or return audited PII, financial, health, or provider payloads", () => {
    const combinedEmailSources = emailFunctions.map(({ source }) => source).join("\n");
    expect(combinedEmailSources).not.toContain("report.email");
    expect(combinedEmailSources).not.toMatch(/console\.(?:log|error).*\$\{user_id\}/);
    expect(combinedEmailSources).not.toMatch(/console\.(?:log|error).*commission_amount/);
    expect(smartAllocator).not.toContain("Remaining nutrition: ${remainingCalories}");
    expect(smartAllocator).not.toContain("JSON.stringify(mealsError");
    expect(aiInsight).not.toContain('console.error("AI insight generation failed:", error)');
    expect(mealImage).not.toContain("partner_id: userId");
    expect(mealImage).not.toContain("ip_address: ipAddress");
  });
});
