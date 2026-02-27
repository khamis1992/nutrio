// Supabase Edge Function: Send Invoice Email (Phase 2 Automation)
// Automatically sends invoice email when payment is completed

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

// Environment variables
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const FROM_EMAIL = "Nutrio Fuel <billing@nutrio.app>";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InvoiceRequest {
  paymentId: string;
  userId?: string;
}

interface PaymentData {
  id: string;
  user_id: string;
  amount: number;
  payment_method: string;
  payment_type: string;
  status: string;
  created_at: string;
  gateway_reference?: string;
  invoice_id?: string;
  profiles: {
    full_name: string;
    email: string;
  } | null;
}

// Create Supabase client with service role
const createSupabaseClient = () => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase credentials not configured");
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
};

// Generate invoice number
const generateInvoiceNumber = (paymentId: string): string => {
  const year = new Date().getFullYear();
  const idPart = paymentId.replace(/-/g, "").slice(-6).toUpperCase();
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
const getPaymentTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    wallet_topup: "Wallet Top-up",
    subscription: "Subscription Payment",
    order: "Order Payment",
  };
  return labels[type] || type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
};

// Get payment method label
const getPaymentMethodLabel = (method: string): string => {
  const labels: Record<string, string> = {
    sadad: "SADAD",
    wallet: "Wallet Balance",
    card: "Credit/Debit Card",
  };
  return labels[method] || method.toUpperCase();
};

// Generate HTML email template
const generateInvoiceEmail = (payment: PaymentData, invoiceNumber: string): string => {
  const typeLabel = getPaymentTypeLabel(payment.payment_type);
  const methodLabel = getPaymentMethodLabel(payment.payment_method);
  const date = formatDate(payment.created_at);
  const amount = formatCurrency(payment.amount);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice ${invoiceNumber} - Nutrio Fuel</title>
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
      <h1>Nutrio Fuel</h1>
      <p>Healthy Meal Delivery & Nutrition</p>
    </div>
    
    <div class="content">
      <h2 class="invoice-title">Invoice</h2>
      
      <div class="invoice-details">
        <div class="detail-row">
          <span class="detail-label">Invoice Number</span>
          <span class="detail-value">${invoiceNumber}</span>
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
            <span class="status-badge status-completed">${payment.status.toUpperCase()}</span>
          </span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Transaction ID</span>
          <span class="detail-value" style="font-family: monospace; font-size: 12px;">${payment.gateway_reference || payment.id}</span>
        </div>
      </div>
      
      <div class="customer-info">
        <h3>Billed To</h3>
        <p><strong>${payment.profiles?.full_name || "Customer"}</strong></p>
        <p style="color: #6b7280; margin-top: 4px;">${payment.profiles?.email || ""}</p>
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
      <p><strong>Nutrio Fuel Qatar</strong></p>
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

// Send invoice email
const sendInvoiceEmail = async (paymentId: string): Promise<{
  success: boolean;
  message?: string;
  emailId?: string;
  invoiceNumber?: string;
}> => {
  const supabase = createSupabaseClient();

  // Fetch payment with user details
  const { data: payment, error: paymentError } = await supabase
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
      invoice_id,
      profiles:user_id (full_name, email)
    `)
    .eq("id", paymentId)
    .single();

  if (paymentError || !payment) {
    throw new Error(`Payment not found: ${paymentError?.message || "Unknown error"}`);
  }

  // Check if already has a sent invoice
  if (payment.invoice_id) {
    const { data: existingInvoice } = await supabase
      .from("invoices")
      .select("status, sent_at")
      .eq("id", payment.invoice_id)
      .single();
    
    if (existingInvoice?.status === "sent" && existingInvoice?.sent_at) {
      return { success: true, message: "Invoice already sent" };
    }
  }

  // Check if payment is completed
  if (payment.status !== "completed") {
    return { success: false, message: `Payment status is ${payment.status}, invoice not sent` };
  }

  // Generate invoice number
  const invoiceNumber = generateInvoiceNumber(payment.id);

  let invoiceId = payment.invoice_id;

  // Create or update invoice record
  if (!invoiceId) {
    // Create new invoice
    const { data: newInvoice, error: invoiceError } = await supabase
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

    if (invoiceError) {
      console.error("Failed to create invoice record:", invoiceError);
    } else {
      invoiceId = newInvoice?.id;
      
      // Link invoice to payment
      await supabase
        .from("payments")
        .update({ invoice_id: invoiceId })
        .eq("id", paymentId);
    }
  } else {
    // Update existing invoice
    await supabase
      .from("invoices")
      .update({
        invoice_number: invoiceNumber,
        amount: payment.amount,
        total_amount: payment.amount,
      })
      .eq("id", invoiceId);
  }

  // Generate email HTML
  const html = generateInvoiceEmail(payment as PaymentData, invoiceNumber);

  // Send email via Resend
  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [payment.profiles?.email],
      subject: `Your Nutrio Fuel Invoice - ${invoiceNumber}`,
      html,
    }),
  });

  if (!resendResponse.ok) {
    const errorData = await resendResponse.text();
    throw new Error(`Resend API error: ${errorData}`);
  }

  const resendData = await resendResponse.json();

  // Log email in email_logs
  await supabase.from("email_logs").insert({
    invoice_id: invoiceId,
    recipient_email: payment.profiles?.email,
    recipient_name: payment.profiles?.full_name,
    email_type: "invoice",
    status: "sent",
    subject: `Your Nutrio Fuel Invoice - ${invoiceNumber}`,
    resend_id: resendData.id,
    sent_at: new Date().toISOString(),
  });

  // Update invoice status
  if (invoiceId) {
    await supabase
      .from("invoices")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
      })
      .eq("id", invoiceId);
  }

  return {
    success: true,
    message: "Invoice email sent successfully",
    emailId: resendData.id,
    invoiceNumber,
  };
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify credentials
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Supabase credentials not configured");
      return new Response(
        JSON.stringify({
          error: "Service not configured",
          details: "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Only accept POST requests
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body: InvoiceRequest = await req.json();
    const { paymentId } = body;

    if (!paymentId) {
      return new Response(
        JSON.stringify({ error: "Missing required field: paymentId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send invoice email
    const result = await sendInvoiceEmail(paymentId);

    return new Response(
      JSON.stringify(result),
      { status: result.success ? 200 : 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in send-invoice-email:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
