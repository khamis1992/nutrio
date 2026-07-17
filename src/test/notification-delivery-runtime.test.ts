import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const readRepoFile = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

function loadSourceFunction<T>(source: string, functionName: string): T {
  const start = source.indexOf(`function ${functionName}`);
  const openingBrace = source.indexOf("{", start);
  if (start < 0 || openingBrace < 0) {
    throw new Error(`Could not find ${functionName}`);
  }

  let depth = 0;
  let end = -1;
  for (let index = openingBrace; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) {
        end = index + 1;
        break;
      }
    }
  }
  if (end < 0) throw new Error(`Could not parse ${functionName}`);

  const transpiled = ts.transpileModule(source.slice(start, end), {
    compilerOptions: {
      module: ts.ModuleKind.None,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  return Function(`${transpiled}; return ${functionName};`)() as T;
}

const invoiceFunction = readRepoFile(
  "supabase/functions/send-invoice-email/index.ts",
);
const emailFunction = readRepoFile("supabase/functions/send-email/index.ts");
const whatsappProcessor = readRepoFile(
  "supabase/functions/process-whatsapp-notifications/index.ts",
);
const whatsappProxy = readRepoFile(
  "supabase/functions/send-whatsapp-proxy/index.ts",
);
const recoveryWorker = readRepoFile(
  "supabase/functions/subscription-recovery-cron/index.ts",
);
const rolloverWorker = readRepoFile(
  "supabase/functions/cleanup-expired-rollovers/index.ts",
);
const healthScoreWorker = readRepoFile(
  "supabase/functions/calculate-health-score/index.ts",
);
const runtimeMigration = readRepoFile(
  "supabase/migrations/20260717090000_harden_notification_delivery_runtime.sql",
);
const edgeWorkflow = readRepoFile(
  ".github/workflows/deploy-edge-functions.yml",
);
const databaseWorkflow = readRepoFile(
  ".github/workflows/database-migration.yml",
);

describe("notification delivery runtime hardening", () => {
  it("resolves invoice recipients from verified Auth identity", () => {
    expect(invoiceFunction).toContain(
      "getNotificationRecipient(payment.user_id)",
    );
    expect(invoiceFunction).not.toMatch(/profiles\s*\(/);
    expect(invoiceFunction).toContain("recipient.emailEnabled");
    expect(invoiceFunction).toContain(
      'paymentId.replace(/-/g, "").toUpperCase()',
    );
  });

  it("makes send-email own recipient verification and preference enforcement", () => {
    expect(emailFunction).toContain("recipient_user_id_required");
    expect(emailFunction).toContain("getNotificationRecipient(recipientUserId)");
    expect(emailFunction).toContain("verified_email_required");
    expect(emailFunction).toContain("isPreferenceEnabled(recipient, preference)");
    expect(emailFunction).toContain("provider_unverified_response");
    expect(invoiceFunction).toContain('error?.code === "23505"');
  });

  it("uses the send-email contract from every in-scope worker", () => {
    for (const source of [recoveryWorker, rolloverWorker, healthScoreWorker]) {
      expect(source).toMatch(/user_id:\s*[A-Za-z0-9_.]+/);
      expect(source).toMatch(/preference:\s*"(?:subscription_updates|health_insights)"/);
      expect(source).toMatch(
        /(?:data|notificationData)\?\.success\s*(?:===|!==)\s*true/,
      );
    }
  });

  it("accepts UltraMsg success only with an explicit sent flag and safe id", () => {
    for (const source of [whatsappProcessor, whatsappProxy]) {
      expect(source).toContain("parseUltraMsgMessageId");
      expect(source).toMatch(/data\.sent\s*(?:===|!==)\s*"true"/);
      expect(source).toContain("hasProviderError");
      expect(source).toContain("[A-Za-z0-9._:-]");
      expect(source).toContain("provider_unverified_response");
      expect(source).toContain('phone.length === 8');
      expect(source).toContain('`974${phone}`');
    }
    expect(whatsappProxy).toContain(
      "policyUserId = requestedUserId || principal.user.id",
    );
    expect(whatsappProxy).toContain("policyUserId,");
    expect(whatsappProxy).toContain("preference,");
  });

  it("rejects ambiguous UltraMsg 2xx payloads at runtime", () => {
    type Parser = (value: unknown) => string | null;
    for (const source of [whatsappProcessor, whatsappProxy]) {
      const parse = loadSourceFunction<Parser>(
        source,
        "parseUltraMsgMessageId",
      );
      expect(parse({ sent: "true", message: "ok", id: 12345 })).toBe("12345");
      expect(parse({ sent: true, id: "message-1" })).toBe("message-1");
      expect(parse({ id: "message-1" })).toBeNull();
      expect(parse({ sent: "false", id: "message-1" })).toBeNull();
      expect(parse({ sent: "true", error: "rejected", id: "message-1" }))
        .toBeNull();
      expect(parse({ sent: "true", id: "unsafe id" })).toBeNull();
    }
  });

  it("caps Edge worker batches and leases", () => {
    expect(whatsappProcessor).toContain("requestedLimit > 3");
    expect(whatsappProcessor).toContain("p_lease_seconds: 90");
    expect(recoveryWorker).toContain("limit > 2");
    expect(recoveryWorker).toContain("p_lease_seconds: 120");
    expect(rolloverWorker).toContain("limit > 5");
    expect(rolloverWorker).toContain("cleanup_expired_rollover_batch");
    expect(rolloverWorker.indexOf("notification_delivery_unavailable")).toBeLessThan(
      rolloverWorker.indexOf("cleanup_expired_rollover_batch"),
    );
    expect(healthScoreWorker).toContain("limit > 3");
    expect(healthScoreWorker).toContain('next_cursor: nextCursor');
    expect(rolloverWorker).toContain('"cleanup-expired-rollovers"');
  });

  it("installs atomic database contracts for invoices, recovery, and cleanup", () => {
    expect(runtimeMigration).toContain("CREATE SEQUENCE IF NOT EXISTS public.invoice_number_seq");
    expect(runtimeMigration).toContain("nextval('public.invoice_number_seq'::REGCLASS)");
    expect(runtimeMigration).not.toContain("MAX(CAST");
    expect(runtimeMigration).toContain("GREATEST(12, char_length(v_sequence::TEXT))");
    expect(runtimeMigration).toContain("e.expired_at + interval '1 day'");
    expect(runtimeMigration).toContain("RETURNS JSONB");
    expect(runtimeMigration).toContain("active = false");
    expect(runtimeMigration).not.toMatch(/WHEN\s+'t_minus_/);
    expect(runtimeMigration).toContain(
      "WHEN COALESCE(p_plus_7_sent, false) THEN NULL",
    );
    expect(runtimeMigration).toContain(
      "WHEN COALESCE(p_plus_3_sent, false)",
    );
    expect(runtimeMigration).toContain(
      "WHEN COALESCE(p_plus_1_sent, false)",
    );
    expect(runtimeMigration).toMatch(
      /WHEN COALESCE\(p_plus_3_sent, false\) THEN CASE\s+WHEN p_now >= p_expired_at \+ interval '7 days' THEN 't_plus_7'\s+ELSE NULL\s+END/,
    );
    expect(runtimeMigration).toMatch(
      /WHEN COALESCE\(p_plus_1_sent, false\) THEN CASE\s+WHEN p_now >= p_expired_at \+ interval '3 days' THEN 't_plus_3'\s+ELSE NULL\s+END/,
    );
    expect(runtimeMigration).toContain(
      "retention_audit_logs_action_type_format_check",
    );
    expect(runtimeMigration).toContain(
      "Skipped invalid WhatsApp notification payload",
    );
    expect(runtimeMigration).toContain("cleanup_expired_rollover_batch");
    expect(runtimeMigration).toContain("FOR UPDATE SKIP LOCKED");
    expect(runtimeMigration).toContain("FOR UPDATE OF sr, subscription_lock SKIP LOCKED");
    expect(runtimeMigration).toContain("v_terminal_ambiguous");
    expect(runtimeMigration).toContain("Verified provider message id required");
    expect(runtimeMigration).toContain("verified_auth_phones");
    expect(runtimeMigration).toContain("u.phone_confirmed_at IS NOT NULL");
    expect(runtimeMigration).toContain("verified_recipient_required");
    expect(runtimeMigration).toContain("WHERE q.user_id IS NOT NULL");
    expect(runtimeMigration).toContain("normalize_notification_phone");
    expect(runtimeMigration).toContain("'974' || value");
    expect(runtimeMigration).toContain("notification_delivery_runtime_version");
    expect(runtimeMigration).not.toMatch(/RESEND_API_KEY|ULTRAMSG_API_TOKEN/);
  });

  it("gates Edge deployment on SQL and uses scoped worker secrets", () => {
    const edgeProbe = edgeWorkflow.indexOf(
      "Verify Edge runtime database contracts",
    );
    const edgeDeploy = edgeWorkflow.indexOf("- name: Deploy Edge Functions");
    expect(edgeProbe).toBeGreaterThan(-1);
    expect(edgeDeploy).toBeGreaterThan(edgeProbe);
    expect(edgeWorkflow).toContain("WHATSAPP_PROCESSOR_CRON_SECRET");
    expect(edgeWorkflow).toContain("SUBSCRIPTION_RECOVERY_CRON_SECRET");
    expect(edgeWorkflow).toContain("ROLLOVER_CLEANUP_CRON_SECRET");
    expect(edgeWorkflow).toContain("calculate-health-score intentionally remains unscheduled");
    expect(edgeWorkflow).toContain('== eyJ*');
    expect(databaseWorkflow).toContain('== eyJ*');
    const scheduledWorkerJob = edgeWorkflow.slice(
      edgeWorkflow.indexOf("invoke-notification-workers:"),
    );
    expect(scheduledWorkerJob).not.toMatch(
      /SUPABASE_(?:SECRET_KEY|SERVICE_ROLE_KEY)|RESEND_API_KEY|ULTRAMSG_API_TOKEN/,
    );

    const migrationApply = databaseWorkflow.indexOf("- name: Apply Migration");
    const migrationProbe = databaseWorkflow.indexOf(
      "Verify notification runtime contract after migration",
    );
    const postMigrationDeploy = databaseWorkflow.indexOf(
      "Deploy Edge functions after database migration",
    );
    expect(migrationApply).toBeGreaterThan(-1);
    expect(migrationProbe).toBeGreaterThan(migrationApply);
    expect(postMigrationDeploy).toBeGreaterThan(migrationProbe);
  });
});
