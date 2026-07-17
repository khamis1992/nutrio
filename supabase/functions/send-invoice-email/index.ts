import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  authenticateRequest,
  enforceRateLimit,
  errorResponse,
  escapeHtml,
  getServiceClient,
  hasAdminAssurance,
  handlePreflight,
  HttpError,
  jsonResponse,
  readJsonBody,
  recordSecurityEvent,
  requireInternalSecret,
  requirePost,
  type SecurityPrincipal,
} from "../_shared/security.ts";
import { getNotificationRecipient } from "../_shared/notificationRecipient.ts";

const FROM_EMAIL = "Nutrio <billing@nutrio.app>";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface InvoiceRequest {
  paymentId: string;
  userId?: string;
}

interface PaymentData {
  id: string;
  user_id: string;
  amount: number;
  payment_method: string | null;
  payment_type: string;
  status: string | null;
  created_at: string;
  gateway_reference?: string;
  invoice_id?: string;
  profiles: {
    full_name: string;
    email: string;
  } | null;
}

// Generate invoice number
const generateInvoiceNumber = (
  paymentId: string,
  createdAt: string,
): string => {
  const year = new Date(createdAt).getUTCFullYear();
  // A payment UUID is unique at the database boundary. Keeping all 128 bits
  // makes the externally visible number deterministic and collision-resistant
  // across retries without relying on a racy MAX(invoice_number) lookup.
  const idPart = paymentId.replace(/-/g, "").toUpperCase();
  return `INV-${year}-${idPart}`;
};

// Format date for Qatar locale
const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString("en-QA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

// Format currency
const formatCurrency = (amount: number): string => {
  return `QAR ${amount.toFixed(2)}`;
};

// Get payment type label
const getPaymentTypeLabel = (value: unknown): string => {
  const type = String(value ?? "payment");
  const labels: Record<string, string> = {
    wallet_topup: "Wallet Top-up",
    subscription: "Subscription Payment",
    order: "Order Payment",
  };
  return labels[type] ||
    type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
};

// Get payment method label
const getPaymentMethodLabel = (value: unknown): string => {
  const method = String(value ?? "unknown");
  const labels: Record<string, string> = {
    sadad: "SADAD",
    wallet: "Wallet Balance",
    card: "Credit/Debit Card",
  };
  return labels[method] || method.toUpperCase();
};

// Generate HTML email template
const generateInvoiceEmail = (
  payment: PaymentData,
  invoiceNumber: string,
): string => {
  const safeInvoiceNumber = escapeHtml(invoiceNumber);
  const typeLabel = escapeHtml(getPaymentTypeLabel(payment.payment_type));
  const methodLabel = escapeHtml(getPaymentMethodLabel(payment.payment_method));
  const date = escapeHtml(formatDate(payment.created_at));
  const amount = escapeHtml(formatCurrency(payment.amount));
  const status = escapeHtml(
    String(payment.status ?? "completed").toUpperCase(),
  );
  const transactionId = escapeHtml(payment.gateway_reference || payment.id);
  const customerName = escapeHtml(payment.profiles?.full_name || "Customer");
  const customerEmail = escapeHtml(payment.profiles?.email || "");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice ${safeInvoiceNumber} - Nutrio</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6; 
      color: #1f2937;
      background-color: #f3f4f6;
    }
    .container { 
      max-width: 600px; 
      margin: 0 auto; 
      background-color: #ffffff;
    }
    .header { 
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      padding: 40px 30px;
      text-align: center;
      color: white;
    }
    .header h1 { 
      font-size: 28px; 
      font-weight: 700;
      margin-bottom: 8px;
    }
    .header p {
      font-size: 16px;
      opacity: 0.9;
    }
    .content {
      padding: 40px 30px;
    }
    .invoice-title {
      font-size: 24px;
      font-weight: 700;
      margin-bottom: 24px;
      color: #111827;
    }
    .invoice-details {
      background: #f9fafb;
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
    }
    .detail-row {
      display: flex;
      justify-content: space-between;
      padding: 12px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    .detail-row:last-child {
      border-bottom: none;
    }
    .detail-label {
      color: #6b7280;
      font-size: 14px;
    }
    .detail-value {
      font-weight: 600;
      color: #111827;
      font-size: 14px;
    }
    .amount-box {
      background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
      border-radius: 12px;
      padding: 24px;
      text-align: center;
      margin: 24px 0;
      border: 2px solid #10b981;
    }
    .amount-label {
      font-size: 14px;
      color: #059669;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 8px;
    }
    .amount-value {
      font-size: 36px;
      font-weight: 700;
      color: #047857;
    }
    .customer-info {
      background: #f9fafb;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 24px;
    }
    .customer-info h3 {
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #6b7280;
      margin-bottom: 12px;
    }
    .customer-info p {
      font-size: 16px;
      color: #111827;
    }
    .status-badge {
      display: inline-block;
      padding: 6px 16px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .status-completed {
      background: #d1fae5;
      color: #065f46;
    }
    .message {
      text-align: center;
      color: #6b7280;
      margin: 24px 0;
      font-size: 15px;
      line-height: 1.6;
    }
    .footer {
      background: #f9fafb;
      padding: 30px;
      text-align: center;
      border-top: 1px solid #e5e7eb;
    }
    .footer p {
      font-size: 14px;
      color: #6b7280;
      margin-bottom: 8px;
    }
    .footer-links {
      margin-top: 16px;
    }
    .footer-links a {
      color: #10b981;
      text-decoration: none;
      margin: 0 12px;
      font-size: 14px;
    }
    .footer-links a:hover {
      text-decoration: underline;
    }
    @media (max-width: 600px) {
      .header { padding: 30px 20px; }
      .header h1 { font-size: 24px; }
      .content { padding: 30px 20px; }
      .amount-value { font-size: 28px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Nutrio</h1>
      <p>Healthy Meal Delivery & Nutrition</p>
    </div>
    
    <div class="content">
      <h2 class="invoice-title">Invoice</h2>
      
      <div class="invoice-details">
        <div class="detail-row">
          <span class="detail-label">Invoice Number</span>
          <span class="detail-value">${safeInvoiceNumber}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Date</span>
          <span class="detail-value">${date}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Payment Type</span>
          <span class="detail-value">${typeLabel}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Payment Method</span>
          <span class="detail-value">${methodLabel}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Status</span>
          <span class="detail-value">
            <span class="status-badge status-completed">${status}</span>
          </span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Transaction ID</span>
          <span class="detail-value" style="font-family: monospace; font-size: 12px;">${transactionId}</span>
        </div>
      </div>
      
      <div class="customer-info">
        <h3>Billed To</h3>
        <p><strong>${customerName}</strong></p>
        <p style="color: #6b7280; margin-top: 4px;">${customerEmail}</p>
      </div>
      
      <div class="amount-box">
        <div class="amount-label">Total Amount Paid</div>
        <div class="amount-value">${amount}</div>
      </div>
      
      <p class="message">
        Thank you for your payment! Your transaction has been completed successfully.<br>
        You can view your payment history and download invoices anytime from your account.
      </p>
    </div>
    
    <div class="footer">
      <p><strong>Nutrio Qatar</strong></p>
      <p>Healthy Meal Delivery & Nutrition Tracking</p>
      <p>Doha, Qatar</p>
      
      <div class="footer-links">
        <a href="mailto:support@nutrio.app">Contact Support</a>
        <a href="https://nutrio.app/dashboard">My Account</a>
        <a href="https://nutrio.app/orders">Order History</a>
      </div>
      
      <p style="margin-top: 20px; font-size: 12px; color: #9ca3af;">
        This is an automated invoice. Please keep it for your records.
      </p>
    </div>
  </div>
</body>
</html>`;
};

interface DeliveryClaim {
  claimed: boolean;
  state: string;
  claim_token?: string;
  provider_message_id?: string;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function claimDelivery(
  idempotencyKey: string,
  payloadHash: string,
): Promise<DeliveryClaim> {
  const service = getServiceClient();
  const { data, error } = await service.rpc("claim_notification_delivery", {
    p_channel: "invoice_email",
    p_idempotency_key: idempotencyKey,
    p_payload_hash: payloadHash,
    p_lease_seconds: 90,
  });
  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    console.error("Invoice delivery claim unavailable", { code: error?.code });
    throw new HttpError(503, "delivery_claim_unavailable");
  }
  return data as DeliveryClaim;
}

async function completeDelivery(
  idempotencyKey: string,
  claimToken: string,
  succeeded: boolean,
  providerMessageId: string | null,
  errorCode: string | null,
): Promise<void> {
  const service = getServiceClient();
  const { data, error } = await service.rpc("complete_notification_delivery", {
    p_channel: "invoice_email",
    p_idempotency_key: idempotencyKey,
    p_claim_token: claimToken,
    p_succeeded: succeeded,
    p_provider_message_id: providerMessageId,
    p_error_code: errorCode,
  });
  if (error || data !== true) {
    console.error("Invoice delivery claim completion failed", {
      code: error?.code,
    });
  }
}

function normalizePayment(raw: Record<string, unknown>): PaymentData {
  const amount = Number(raw.amount);
  const userId = String(raw.user_id ?? "");
  const createdAt = String(raw.created_at ?? "");

  if (
    !UUID_PATTERN.test(String(raw.id ?? "")) ||
    !UUID_PATTERN.test(userId) ||
    !Number.isFinite(amount) ||
    amount < 0 ||
    Number.isNaN(new Date(createdAt).getTime())
  ) {
    throw new HttpError(422, "invalid_payment_record");
  }

  return {
    id: String(raw.id),
    user_id: userId,
    amount,
    payment_method: raw.payment_method === null
      ? null
      : String(raw.payment_method ?? ""),
    payment_type: String(raw.payment_type ?? ""),
    status: raw.status === null ? null : String(raw.status ?? ""),
    created_at: createdAt,
    gateway_reference: raw.gateway_reference
      ? String(raw.gateway_reference)
      : undefined,
    invoice_id: raw.invoice_id ? String(raw.invoice_id) : undefined,
    profiles: null,
  };
}

serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  let principal: SecurityPrincipal | null = null;
  let internalRequest = false;
  let idempotencyKey: string | null = null;
  let claimToken: string | null = null;
  let paymentResourceId: string | undefined;

  try {
    requirePost(req);
    if (req.headers.has("x-internal-secret")) {
      await requireInternalSecret(req);
      internalRequest = true;
    } else {
      principal = await authenticateRequest(req);
    }
    const hasAdminAccess = hasAdminAssurance(principal);

    const body = await readJsonBody<InvoiceRequest>(req, 4 * 1024);
    const paymentId = String(body.paymentId ?? "").trim();
    if (!UUID_PATTERN.test(paymentId)) {
      throw new HttpError(400, "valid_payment_id_required");
    }
    paymentResourceId = paymentId;

    const service = getServiceClient();
    let paymentQuery = service
      .from("payments")
      .select(`
        id,
        user_id,
        amount,
        payment_method,
        payment_type,
        status,
        created_at,
        gateway_reference,
        invoice_id
      `)
      .eq("id", paymentId);
    if (principal && !hasAdminAccess) {
      paymentQuery = paymentQuery.eq("user_id", principal.user.id);
    }

    const { data: rawPayment, error: paymentError } = await paymentQuery
      .maybeSingle();
    if (paymentError) {
      console.error("Invoice payment lookup failed", {
        code: paymentError.code,
      });
      throw new HttpError(503, "payment_store_unavailable");
    }
    if (!rawPayment) throw new HttpError(404, "payment_not_found");

    const payment = normalizePayment(rawPayment as Record<string, unknown>);
    const recipient = await getNotificationRecipient(payment.user_id);
    payment.profiles = recipient.email
      ? { full_name: recipient.fullName, email: recipient.email }
      : null;
    if (body.userId !== undefined && String(body.userId) !== payment.user_id) {
      throw new HttpError(400, "payment_user_mismatch");
    }

    await enforceRateLimit(
      req,
      "send-invoice-email",
      principal?.user.id || payment.user_id,
      hasAdminAccess ? 120 : internalRequest ? 60 : 10,
      60 * 60,
    );

    if (payment.status !== "completed") {
      return jsonResponse(
        req,
        {
          success: false,
          message: "Payment is not eligible for an invoice email",
        },
        400,
      );
    }

    if (
      !payment.profiles?.email ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payment.profiles.email)
    ) {
      throw new HttpError(422, "invoice_recipient_unavailable");
    }

    const invoiceNumber = generateInvoiceNumber(payment.id, payment.created_at);
    if (!recipient.emailEnabled) {
      await recordSecurityEvent(req, {
        eventType: "notification.invoice_email_suppressed",
        category: "edge_function",
        outcome: "success",
        principal,
        actorType: internalRequest ? "service" : undefined,
        action: "suppress_invoice_email",
        resourceType: "payment",
        resourceId: payment.id,
        metadata: { reason: "email_channel_disabled" },
      });
      return jsonResponse(req, {
        success: true,
        suppressed: true,
        reason: "email_channel_disabled",
        invoiceNumber,
      });
    }
    if (payment.invoice_id) {
      const { data: existingInvoice, error } = await service
        .from("invoices")
        .select("status, sent_at, invoice_number")
        .eq("id", payment.invoice_id)
        .eq("user_id", payment.user_id)
        .maybeSingle();
      if (error) {
        console.error("Existing invoice lookup failed", { code: error.code });
        throw new HttpError(503, "invoice_store_unavailable");
      }
      if (!existingInvoice) {
        throw new HttpError(422, "invalid_payment_record");
      }
      if (existingInvoice?.status === "sent" && existingInvoice.sent_at) {
        return jsonResponse(req, {
          success: true,
          message: "Invoice already sent",
          invoiceNumber: existingInvoice.invoice_number || invoiceNumber,
        });
      }
    }

    idempotencyKey = `invoice:${payment.id}`;
    const payloadHash = await sha256Hex(JSON.stringify({
      paymentId: payment.id,
      userId: payment.user_id,
      amount: payment.amount,
      recipient: payment.profiles.email,
      invoiceNumber,
    }));
    const claim = await claimDelivery(idempotencyKey, payloadHash);
    if (claim.state === "completed") {
      return jsonResponse(req, {
        success: true,
        message: "Invoice already sent",
        emailId: claim.provider_message_id,
        invoiceNumber,
        duplicate: true,
      });
    }
    if (!claim.claimed || !claim.claim_token) {
      let code = "delivery_in_progress";
      if (claim.state === "conflict") code = "idempotency_conflict";
      if (claim.state === "exhausted") code = "delivery_retry_exhausted";
      throw new HttpError(409, code);
    }
    claimToken = claim.claim_token;

    let invoiceId = payment.invoice_id;
    if (!invoiceId) {
      const { data: createdInvoice, error } = await service
        .from("invoices")
        .insert({
          invoice_number: invoiceNumber,
          user_id: payment.user_id,
          invoice_type: payment.payment_type,
          amount: payment.amount,
          total_amount: payment.amount,
          status: "draft",
        })
        .select("id")
        .single();
      if (error?.code === "23505") {
        // A prior attempt may have created the deterministic invoice before
        // failing to link it to the payment. Recover that row on retry.
        const { data: recoveredInvoice, error: recoveryError } = await service
          .from("invoices")
          .select("id")
          .eq("invoice_number", invoiceNumber)
          .eq("user_id", payment.user_id)
          .maybeSingle();
        if (recoveryError || !recoveredInvoice) {
          console.error("Invoice collision recovery failed", {
            code: recoveryError?.code,
          });
          throw new HttpError(503, "invoice_store_unavailable");
        }
        invoiceId = String(recoveredInvoice.id);
      } else if (error || !createdInvoice) {
        console.error("Invoice creation failed", { code: error?.code });
        throw new HttpError(503, "invoice_store_unavailable");
      } else {
        invoiceId = String(createdInvoice.id);
      }

      const { error: linkError } = await service
        .from("payments")
        .update({ invoice_id: invoiceId })
        .eq("id", payment.id)
        .eq("user_id", payment.user_id);
      if (linkError) {
        console.error("Invoice payment link failed", { code: linkError.code });
        throw new HttpError(503, "invoice_store_unavailable");
      }
    } else {
      const { error } = await service
        .from("invoices")
        .update({
          invoice_number: invoiceNumber,
          amount: payment.amount,
          total_amount: payment.amount,
        })
        .eq("id", invoiceId)
        .eq("user_id", payment.user_id);
      if (error) {
        console.error("Invoice update failed", { code: error.code });
        throw new HttpError(503, "invoice_store_unavailable");
      }
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) throw new HttpError(503, "email_service_unavailable");

    const subject = `Your Nutrio Invoice - ${invoiceNumber}`;
    let resendResponse: Response;
    try {
      resendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendApiKey}`,
          "Idempotency-Key": `invoice/${payment.id}`,
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: [payment.profiles.email],
          subject,
          html: generateInvoiceEmail(payment, invoiceNumber),
        }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error) {
      console.error("Invoice email provider request failed", {
        name: error instanceof Error ? error.name : "unknown",
      });
      throw new HttpError(502, "invoice_email_delivery_failed");
    }

    if (!resendResponse.ok) {
      console.error("Invoice email provider rejected request", {
        status: resendResponse.status,
      });
      throw new HttpError(502, "invoice_email_delivery_failed");
    }

    const resendData = await resendResponse.json().catch(() => ({})) as Record<
      string,
      unknown
    >;
    const rawEmailId = typeof resendData.id === "string"
      ? resendData.id.trim()
      : "";
    const emailId = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,249}$/.test(rawEmailId)
      ? rawEmailId
      : null;
    if (!emailId) {
      throw new HttpError(502, "invoice_email_delivery_failed");
    }
    const sentAt = new Date().toISOString();

    const { error: invoiceStatusError } = await service
      .from("invoices")
      .update({ status: "sent", sent_at: sentAt })
      .eq("id", invoiceId)
      .eq("user_id", payment.user_id);
    if (invoiceStatusError) {
      console.error("Invoice sent status update failed", {
        code: invoiceStatusError.code,
      });
      throw new HttpError(503, "invoice_store_unavailable");
    }

    const { data: existingLog, error: logLookupError } = emailId
      ? await service.from("email_logs").select("id").eq("resend_id", emailId)
        .maybeSingle()
      : { data: null, error: null };
    if (logLookupError) {
      console.error("Invoice email log lookup failed", {
        code: logLookupError.code,
      });
      throw new HttpError(503, "invoice_store_unavailable");
    }
    if (!existingLog) {
      const { error: logError } = await service.from("email_logs").insert({
        invoice_id: invoiceId,
        recipient_email: payment.profiles.email,
        recipient_name: payment.profiles.full_name,
        email_type: "invoice",
        status: "sent",
        subject,
        resend_id: emailId,
        sent_at: sentAt,
      });
      if (logError) {
        console.error("Invoice email log write failed", {
          code: logError.code,
        });
        throw new HttpError(503, "invoice_store_unavailable");
      }
    }

    await completeDelivery(idempotencyKey, claimToken, true, emailId, null);
    claimToken = null;

    await recordSecurityEvent(req, {
      eventType: "notification.invoice_email_sent",
      category: "edge_function",
      outcome: "success",
      principal,
      actorType: internalRequest ? "service" : undefined,
      action: "send_invoice_email",
      resourceType: "payment",
      resourceId: payment.id,
    });

    return jsonResponse(req, {
      success: true,
      message: "Invoice email sent successfully",
      emailId,
      invoiceNumber,
    });
  } catch (error) {
    if (idempotencyKey && claimToken) {
      await completeDelivery(
        idempotencyKey,
        claimToken,
        false,
        null,
        error instanceof HttpError ? error.code : "internal_error",
      );
    }
    await recordSecurityEvent(req, {
      eventType: "notification.invoice_email_failed",
      category: "edge_function",
      severity: error instanceof HttpError && error.status < 500
        ? "medium"
        : "high",
      outcome: error instanceof HttpError && error.status === 403
        ? "denied"
        : "failure",
      principal,
      actorType: internalRequest ? "service" : undefined,
      action: "send_invoice_email",
      resourceType: "payment",
      resourceId: paymentResourceId,
      metadata: {
        code: error instanceof HttpError ? error.code : "internal_error",
      },
    });
    return errorResponse(req, error);
  }
});
