import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type User } from "https://esm.sh/@supabase/supabase-js@2";

import {
  enforceRateLimit,
  getClientIp,
  getCorsHeaders,
  getServiceClient,
  getSupabasePublishableKey,
  HttpError,
  readJsonBody,
  readTextBody,
  recordSecurityEvent,
} from "../_shared/security.ts";

const SADAD_CHECKOUT_URL = "https://sadadqa.com/webpurchase";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Scalar = string | number | boolean;
type ScalarRecord = Record<string, Scalar>;

interface CreatePaymentPayload {
  paymentType: "wallet_topup" | "subscription" | "coach_subscription";
  referenceId: string;
  subscriptionId?: string;
  coachPlan?: "weekly" | "monthly";
  mobileNumber: string;
  language?: "ar" | "en";
}

interface AuthenticatedOperation {
  op: "create" | "status" | "refund";
  payload: Record<string, unknown>;
}

interface PreparedPayment {
  payment_id: string;
  amount: number;
  currency: string;
  payment_type: string;
  description: string;
  metadata: Record<string, unknown>;
}

interface PaymentRecord {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  payment_type: string;
  status: string;
  fulfillment_status: string;
  fulfillment_error: string | null;
  provider_transaction_id: string | null;
  description: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  completed_at: string | null;
}

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";

function corsHeaders(req: Request): Record<string, string> {
  return getCorsHeaders(req);
}

function jsonResponse(
  req: Request,
  body: Record<string, unknown>,
  status = 200,
): Response {
  return Response.json(body, {
    status,
    headers: corsHeaders(req),
  });
}

function serverConfig() {
  const merchantId = Deno.env.get("SADAD_MERCHANT_ID")?.trim();
  const secretKey = Deno.env.get("SADAD_SECRET_KEY")?.trim();
  const website = Deno.env.get("SADAD_WEBSITE")?.trim();

  if (!supabaseUrl) {
    throw new Error("SUPABASE_SERVER_CONFIGURATION_MISSING");
  }
  try {
    getSupabasePublishableKey();
    getServiceClient();
  } catch {
    throw new Error("SUPABASE_SERVER_CONFIGURATION_MISSING");
  }
  if (!merchantId || !secretKey || !website) {
    throw new Error("SADAD_SERVER_CONFIGURATION_MISSING");
  }

  return { merchantId, secretKey, website };
}

function adminClient() {
  return getServiceClient();
}

async function authenticate(req: Request): Promise<User | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !supabaseUrl) return null;

  let publishableKey: string;
  try {
    publishableKey = getSupabasePublishableKey();
  } catch {
    return null;
  }

  const client = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.getUser();

  return error ? null : data.user;
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

async function generateChecksum(
  secretKey: string,
  params: ScalarRecord,
): Promise<string> {
  const values = Object.keys(params)
    .filter((key) => key !== "signature" && key !== "checksumhash")
    .sort()
    .map((key) => String(params[key]));

  return sha256(secretKey + values.join(""));
}

function constantTimeEqual(left: string, right: string): boolean {
  const a = left.toLowerCase();
  const b = right.toLowerCase();
  if (a.length !== b.length) return false;

  let difference = 0;
  for (let index = 0; index < a.length; index += 1) {
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return difference === 0;
}

async function verifyChecksum(
  secretKey: string,
  payload: ScalarRecord,
): Promise<boolean> {
  const received = String(payload.checksumhash ?? "");
  if (!received) return false;

  const calculated = await generateChecksum(secretKey, payload);
  return constantTimeEqual(calculated, received);
}

function normalizeMobileNumber(value: unknown): string | null {
  if (typeof value !== "string") return null;

  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 8) digits = `974${digits}`;

  return /^974\d{8}$/.test(digits) ? digits : null;
}

function formatTransactionDate(date = new Date()): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function scalarRecord(value: Record<string, unknown>): ScalarRecord {
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entry]) => ["string", "number", "boolean"].includes(typeof entry))
      .map(([key, entry]) => [key, entry as Scalar]),
  );
}

async function readCallbackPayload(req: Request): Promise<ScalarRecord> {
  const raw = await readTextBody(
    req,
    32 * 1024,
    ["application/x-www-form-urlencoded"],
  );

  const payload: ScalarRecord = {};
  for (const [key, value] of new URLSearchParams(raw)) {
    if (key.length <= 100 && value.length <= 4096) payload[key] = value;
  }
  return payload;
}

async function sanitizeProviderPayload(payload: ScalarRecord): Promise<ScalarRecord> {
  const canonical = JSON.stringify(
    Object.fromEntries(Object.entries(payload).sort(([left], [right]) => left.localeCompare(right))),
  );
  const allowedKeys = new Set([
    "ORDERID",
    "websiteRefNo",
    "transaction_number",
    "transactionNumber",
    "transaction_status",
    "transactionStatus",
    "TXNAMOUNT",
    "txnAmount",
    "MID",
    "merchantId",
    "RESPCODE",
    "RESPMSG",
  ]);
  const sanitized: ScalarRecord = {
    evidence_sha256: (await sha256(canonical)).toLowerCase(),
  };
  for (const [key, value] of Object.entries(payload)) {
    if (allowedKeys.has(key)) sanitized[key] = value;
  }
  return sanitized;
}

function callbackUrl(): string {
  const configured = Deno.env.get("SADAD_CALLBACK_URL")?.trim();
  if (configured) {
    const url = new URL(configured);
    if (url.protocol !== "https:" || url.username || url.password) {
      throw new Error("SADAD_CALLBACK_URL_INVALID");
    }
    return url.toString();
  }
  if (!supabaseUrl) throw new Error("SUPABASE_SERVER_CONFIGURATION_MISSING");
  return `${supabaseUrl}/functions/v1/sadad-payment?source=callback`;
}

function resultRedirect(paymentId: string): string | null {
  const appUrl = Deno.env.get("APP_URL")?.trim();
  if (!appUrl) return null;

  try {
    const url = new URL(appUrl);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    const basePath = url.pathname.replace(/\/$/, "");
    url.pathname = `${basePath}/payment/result`;
    url.searchParams.set("paymentId", paymentId);
    return url.toString();
  } catch {
    return null;
  }
}

async function recordProviderEvent(args: {
  paymentId: string | null;
  source: "callback" | "webhook";
  transactionId: string | null;
  providerStatus: string | null;
  checksumValid: boolean;
  payload: ScalarRecord;
}): Promise<string | null> {
  const client = adminClient();
  const { data, error } = await client
    .from("payment_provider_events")
    .insert({
      payment_id: args.paymentId,
      source: args.source,
      provider_transaction_id: args.transactionId,
      provider_status: args.providerStatus,
      checksum_valid: args.checksumValid,
      payload: args.payload,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Unable to persist payment provider event", error.message);
    return null;
  }
  return data.id as string;
}

async function finishProviderEvent(
  eventId: string | null,
  processingError?: string,
): Promise<void> {
  if (!eventId) return;

  const { error } = await adminClient()
    .from("payment_provider_events")
    .update({
      processed_at: new Date().toISOString(),
      processing_error: processingError?.slice(0, 1000) ?? null,
    })
    .eq("id", eventId);

  if (error) console.error("Unable to update payment provider event", error.message);
}

async function loadPayment(paymentId: string): Promise<PaymentRecord | null> {
  const { data, error } = await adminClient()
    .from("payments")
    .select(
      "id,user_id,amount,currency,payment_type,status,fulfillment_status,fulfillment_error,provider_transaction_id,description,metadata,created_at,completed_at",
    )
    .eq("id", paymentId)
    .maybeSingle();

  if (error) throw error;
  return data as PaymentRecord | null;
}

function amountsMatch(received: unknown, expected: number): boolean {
  const amount = typeof received === "number" ? received : Number(received);
  return Number.isFinite(amount) && Math.abs(amount - Number(expected)) < 0.005;
}

async function applyProviderStatus(args: {
  payment: PaymentRecord;
  transactionId: string;
  status: number;
  payload: ScalarRecord;
}): Promise<{ success: boolean; error?: string }> {
  const client = adminClient();

  if (args.status === 3) {
    const { data, error } = await client.rpc("finalize_verified_sadad_payment", {
      p_payment_id: args.payment.id,
      p_provider_transaction_id: args.transactionId,
      p_gateway_response: args.payload,
    });

    if (error) return { success: false, error: error.message };
    const result = data as { success?: boolean; error?: string } | null;
    return result?.success
      ? { success: true }
      : { success: false, error: result?.error ?? "PAYMENT_FULFILLMENT_FAILED" };
  }

  const status = args.status === 2 ? "failed" : "processing";
  const { error } = await client.rpc("record_sadad_payment_status", {
    p_payment_id: args.payment.id,
    p_status: status,
    p_gateway_response: args.payload,
  });

  return error ? { success: false, error: error.message } : { success: true };
}

async function handleCreate(
  req: Request,
  user: User,
  payload: CreatePaymentPayload,
): Promise<Response> {
  const { merchantId, secretKey, website } = serverConfig();
  const mobileNumber = normalizeMobileNumber(payload.mobileNumber ?? user.phone);

  if (!payload || !["wallet_topup", "subscription", "coach_subscription"].includes(payload.paymentType)) {
    return jsonResponse(req, { error: "PAYMENT_TYPE_NOT_SUPPORTED" }, 400);
  }
  if (!UUID_PATTERN.test(payload.referenceId)) {
    return jsonResponse(req, { error: "PAYMENT_REFERENCE_INVALID" }, 400);
  }
  if (payload.subscriptionId && !UUID_PATTERN.test(payload.subscriptionId)) {
    return jsonResponse(req, { error: "SUBSCRIPTION_REFERENCE_INVALID" }, 400);
  }
  if (payload.paymentType === "coach_subscription" && !["weekly", "monthly"].includes(payload.coachPlan ?? "")) {
    return jsonResponse(req, { error: "COACH_PLAN_INVALID" }, 400);
  }
  if (!mobileNumber) {
    return jsonResponse(req, { error: "QATAR_MOBILE_NUMBER_REQUIRED" }, 400);
  }
  if (!user.email || !user.email_confirmed_at) {
    return jsonResponse(req, { error: "CUSTOMER_EMAIL_REQUIRED" }, 400);
  }

  const client = adminClient();
  const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
  const { count, error: countError } = await client
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .in("status", ["pending", "processing"])
    .gte("created_at", oneMinuteAgo);

  if (countError) throw countError;
  if ((count ?? 0) >= 5) {
    return jsonResponse(req, { error: "PAYMENT_RATE_LIMITED" }, 429);
  }

  const { data, error } = await client.rpc("prepare_sadad_payment", {
    p_user_id: user.id,
    p_payment_type: payload.paymentType,
    p_reference_id: payload.referenceId,
    p_subscription_id: payload.subscriptionId ?? null,
    p_coach_plan: payload.coachPlan ?? null,
  });

  if (error) {
    console.error("Unable to prepare payment", error.message);
    const knownCode = [
      "PAYMENT_PACKAGE_NOT_FOUND",
      "PAYMENT_PLAN_NOT_FOUND",
      "ACTIVE_SUBSCRIPTION_EXISTS",
      "SUBSCRIPTION_NOT_FOUND",
      "SUBSCRIPTION_PLAN_UNCHANGED",
      "SUBSCRIPTION_CYCLE_ALREADY_RENEWED",
      "SUBSCRIPTION_RENEWAL_TOO_EARLY",
      "PAYMENT_FULFILLMENT_RETRY_REQUIRED",
      "PAYMENT_NOT_REQUIRED",
      "COACH_PRICING_NOT_FOUND",
      "COACH_PLAN_INVALID",
      "COACH_SELF_SUBSCRIPTION_NOT_ALLOWED",
      "ACTIVE_COACH_SUBSCRIPTION_EXISTS",
    ].find((code) => error.message.includes(code));
    return jsonResponse(req, { error: knownCode ?? "PAYMENT_PREPARATION_FAILED" }, 400);
  }

  const payment = data as PreparedPayment;
  const fields: ScalarRecord = {
    merchant_id: merchantId,
    ORDER_ID: payment.payment_id,
    TXN_AMOUNT: Number(payment.amount).toFixed(2),
    CALLBACK_URL: callbackUrl(),
    WEBSITE: website,
    email: user.email,
    MOBILE_NO: mobileNumber,
    txnDate: formatTransactionDate(),
  };
  fields.signature = await generateChecksum(secretKey, fields);

  return jsonResponse(req, {
    payment_id: payment.payment_id,
    amount: Number(payment.amount),
    currency: payment.currency,
    payment_type: payment.payment_type,
    description: payment.description,
    metadata: payment.metadata ?? {},
    form_action: SADAD_CHECKOUT_URL,
    form_method: "POST",
    fields,
  });
}

async function handleStatus(
  req: Request,
  user: User,
  paymentId: unknown,
): Promise<Response> {
  if (typeof paymentId !== "string" || !UUID_PATTERN.test(paymentId)) {
    return jsonResponse(req, { error: "PAYMENT_REFERENCE_INVALID" }, 400);
  }

  const payment = await loadPayment(paymentId);
  if (!payment || payment.user_id !== user.id) {
    return jsonResponse(req, { error: "PAYMENT_NOT_FOUND" }, 404);
  }

  return jsonResponse(req, {
    payment_id: payment.id,
    amount: Number(payment.amount),
    currency: payment.currency,
    payment_type: payment.payment_type,
    status: payment.status,
    fulfillment_status: payment.fulfillment_status,
    description: payment.description,
    metadata: payment.metadata ?? {},
    transaction_id: payment.provider_transaction_id,
    created_at: payment.created_at,
    completed_at: payment.completed_at,
    error: payment.fulfillment_status === "failed"
      ? "PAYMENT_FULFILLMENT_FAILED"
      : null,
  });
}

async function handleCallback(req: Request): Promise<Response> {
  const { merchantId, secretKey } = serverConfig();
  await enforceRateLimit(
    req,
    "sadad-callback",
    getClientIp(req) || "unknown",
    60,
    10 * 60,
  );
  const payload = await readCallbackPayload(req);
  const evidencePayload = await sanitizeProviderPayload(payload);
  const paymentId = String(payload.ORDERID ?? "");
  const transactionId = String(payload.transaction_number ?? "");
  const providerStatus = String(payload.transaction_status ?? "");
  const checksumValid = await verifyChecksum(secretKey, payload);
  const eventId = await recordProviderEvent({
    paymentId: UUID_PATTERN.test(paymentId) ? paymentId : null,
    source: "callback",
    transactionId: transactionId || null,
    providerStatus: providerStatus || null,
    checksumValid,
    payload: evidencePayload,
  });

  if (!checksumValid) {
    await recordSecurityEvent(req, {
      eventType: "payment.sadad.invalid_callback_signature",
      category: "payment",
      severity: "critical",
      outcome: "blocked",
      actorType: "anonymous",
      action: "verify_provider_callback",
      resourceType: "public.payments",
      resourceId: UUID_PATTERN.test(paymentId) ? paymentId : undefined,
      metadata: { evidence_sha256: evidencePayload.evidence_sha256 },
    });
    await finishProviderEvent(eventId, "INVALID_CHECKSUM");
    return new Response("INVALID CHECKSUM", { status: 400 });
  }
  if (!UUID_PATTERN.test(paymentId) || String(payload.MID ?? "") !== merchantId) {
    await finishProviderEvent(eventId, "PAYMENT_REFERENCE_MISMATCH");
    return new Response("INVALID PAYMENT REFERENCE", { status: 400 });
  }

  const payment = await loadPayment(paymentId);
  if (!payment || !amountsMatch(payload.TXNAMOUNT, payment.amount)) {
    await finishProviderEvent(eventId, "PAYMENT_AMOUNT_MISMATCH");
    return new Response("INVALID PAYMENT AMOUNT", { status: 400 });
  }

  const status = Number(payload.transaction_status);
  if (![1, 2, 3].includes(status) || !transactionId) {
    await finishProviderEvent(eventId, "PAYMENT_STATUS_INVALID");
    return new Response("INVALID PAYMENT STATUS", { status: 400 });
  }

  const result = await applyProviderStatus({
    payment,
    transactionId,
    status,
    payload: evidencePayload,
  });
  await finishProviderEvent(eventId, result.error);

  await recordSecurityEvent(req, {
    eventType: "payment.sadad.callback_processed",
    category: "payment",
    severity: "medium",
    outcome: result.success ? "success" : "failure",
    actorType: "service",
    actorRole: "sadad",
    action: "apply_provider_status",
    resourceType: "public.payments",
    resourceId: payment.id,
    metadata: {
      provider_status: status,
      evidence_sha256: evidencePayload.evidence_sha256,
    },
  });

  const redirect = resultRedirect(payment.id);
  if (redirect) {
    return new Response(null, {
      status: 303,
      headers: { Location: redirect, "Cache-Control": "no-store" },
    });
  }

  return Response.json({
    status: result.success ? "success" : "processing_error",
    payment_id: payment.id,
  }, { status: result.success ? 200 : 202 });
}

async function handleWebhook(req: Request): Promise<Response> {
  let eventId: string | null = null;

  try {
    await enforceRateLimit(
      req,
      "sadad-webhook",
      getClientIp(req) || "unknown",
      300,
      10 * 60,
    );
    const { merchantId, secretKey } = serverConfig();
    const raw = await readJsonBody<Record<string, unknown>>(req, 32 * 1024);
    const payload = scalarRecord(raw);
    const evidencePayload = await sanitizeProviderPayload(payload);
    const paymentId = String(payload.websiteRefNo ?? "");
    const transactionId = String(payload.transactionNumber ?? "");
    const providerStatus = String(payload.transactionStatus ?? "");
    const checksumValid = await verifyChecksum(secretKey, payload);

    eventId = await recordProviderEvent({
      paymentId: UUID_PATTERN.test(paymentId) ? paymentId : null,
      source: "webhook",
      transactionId: transactionId || null,
      providerStatus: providerStatus || null,
      checksumValid,
      payload: evidencePayload,
    });

    if (!checksumValid) {
      await recordSecurityEvent(req, {
        eventType: "payment.sadad.invalid_webhook_signature",
        category: "payment",
        severity: "critical",
        outcome: "blocked",
        actorType: "anonymous",
        action: "verify_provider_webhook",
        resourceType: "public.payments",
        resourceId: UUID_PATTERN.test(paymentId) ? paymentId : undefined,
        metadata: { evidence_sha256: evidencePayload.evidence_sha256 },
      });
      throw new Error("INVALID_CHECKSUM");
    }
    if (!UUID_PATTERN.test(paymentId) || String(payload.merchantId ?? "") !== merchantId) {
      throw new Error("PAYMENT_REFERENCE_MISMATCH");
    }

    const payment = await loadPayment(paymentId);
    if (!payment || !amountsMatch(payload.txnAmount, payment.amount)) {
      throw new Error("PAYMENT_AMOUNT_MISMATCH");
    }

    const status = Number(payload.transactionStatus);
    if (![1, 2, 3].includes(status) || !transactionId) {
      throw new Error("PAYMENT_STATUS_INVALID");
    }

    const result = await applyProviderStatus({
      payment,
      transactionId,
      status,
      payload: evidencePayload,
    });
    await finishProviderEvent(eventId, result.error);
    await recordSecurityEvent(req, {
      eventType: "payment.sadad.webhook_processed",
      category: "payment",
      severity: "medium",
      outcome: result.success ? "success" : "failure",
      actorType: "service",
      actorRole: "sadad",
      action: "apply_provider_status",
      resourceType: "public.payments",
      resourceId: payment.id,
      metadata: {
        provider_status: status,
        evidence_sha256: evidencePayload.evidence_sha256,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "WEBHOOK_PROCESSING_FAILED";
    console.error("SADAD webhook rejected", message);
    await finishProviderEvent(eventId, message);
  }

  // SADAD requires a 200 acknowledgement even for invalid or duplicate events.
  return Response.json({ status: "success" }, { status: 200 });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }
  if (req.method !== "POST") {
    return jsonResponse(req, { error: "METHOD_NOT_ALLOWED" }, 405);
  }

  const source = new URL(req.url).searchParams.get("source");

  try {
    if (source === "callback") return await handleCallback(req);
    if (source === "webhook") return await handleWebhook(req);

    const user = await authenticate(req);
    if (!user) return jsonResponse(req, { error: "UNAUTHORIZED" }, 401);

    await enforceRateLimit(req, "sadad-customer", user.id, 120, 10 * 60);

    const body = await readJsonBody<AuthenticatedOperation>(req, 16 * 1024);
    if (!body || typeof body.op !== "string" || !body.payload) {
      return jsonResponse(req, { error: "INVALID_REQUEST" }, 400);
    }

    if (body.op === "create") {
      return await handleCreate(req, user, body.payload as unknown as CreatePaymentPayload);
    }
    if (body.op === "status") {
      return await handleStatus(req, user, body.payload.paymentId);
    }
    if (body.op === "refund") {
      return jsonResponse(req, { error: "REFUND_NOT_CONFIGURED" }, 501);
    }

    return jsonResponse(req, { error: "UNKNOWN_OPERATION" }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "INTERNAL_SERVER_ERROR";
    console.error("sadad-payment error", message);
    if (error instanceof HttpError) {
      return jsonResponse(req, { error: error.code }, error.status);
    }
    const isConfigError = message.endsWith("CONFIGURATION_MISSING");
    return jsonResponse(
      req,
      { error: isConfigError ? message : "INTERNAL_SERVER_ERROR" },
      isConfigError ? 503 : 500,
    );
  }
});
