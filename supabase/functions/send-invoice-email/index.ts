// Supabase Edge Function: Send Invoice Email
// Automatically sends invoice PDF via Resend when payment is completed

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM_EMAIL = 'Nutrio <invoices@nutrio.app>';

interface InvoiceRequest {
  invoice_id: string;
  user_id: string;
  email: string;
  recipient_name: string;
  invoice_number: string;
  invoice_type: string;
  amount: number;
  pdf_base64: string;
}

serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Email service not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body: InvoiceRequest = await req.json();
    const { invoice_id, email, recipient_name, invoice_number, invoice_type, amount, pdf_base64 } = body;

    if (!email || !pdf_base64) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const typeLabels: Record<string, string> = {
      'wallet_topup': 'Wallet Top-up',
      'subscription': 'Subscription',
      'order': 'Order',
      'partner_payout': 'Partner Payout',
      'driver_payout': 'Driver Payout'
    };

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Invoice from Nutrio</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { text-align: center; padding: 20px; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); border-radius: 12px; margin-bottom: 30px; }
          .header h1 { color: white; margin: 0; font-size: 28px; }
          .header p { color: rgba(255,255,255,0.9); margin: 10px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 12px; }
          .invoice-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
          .invoice-number { font-size: 18px; font-weight: bold; color: #22c55e; }
          .amount { font-size: 32px; font-weight: bold; color: #16a34a; margin: 10px 0; }
          .button { display: inline-block; background: #22c55e; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Nutrio</h1>
          <p>Healthy Meal Delivery & Nutrition</p>
        </div>
        <div class="content">
          <p>Hello ${recipient_name},</p>
          <p>Thank you for choosing Nutrio! Please find your invoice attached.</p>
          <div class="invoice-details">
            <div class="invoice-number">Invoice #${invoice_number}</div>
            <div class="amount">QAR ${amount.toFixed(2)}</div>
            <p><strong>Type:</strong> ${typeLabels[invoice_type] || invoice_type}</p>
          </div>
          <p>If you have any questions about this invoice, please don't hesitate to contact our support team.</p>
          <center>
            <a href="mailto:support@nutrio.app" class="button">Contact Support</a>
          </center>
        </div>
        <div class="footer">
          <p>Nutrio - Healthy Meal Delivery</p>
          <p>Doha, Qatar | support@nutrio.app | www.nutrio.app</p>
        </div>
      </body>
      </html>
    `;

    const resendResponse = await fetch('https://api.resend.com/v1/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [email],
        subject: `Your Nutrio Invoice - ${invoice_number}`,
        html,
        attachments: [{
          filename: `invoice-${invoice_number}.pdf`,
          content: pdf_base64,
        }],
      }),
    });

    if (!resendResponse.ok) {
      const error = await resendResponse.text();
      console.error('Resend API error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to send email', details: error }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const result = await resendResponse.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    await supabase.from('email_logs').insert({
      invoice_id,
      recipient_email: email,
      recipient_name,
      email_type: 'invoice',
      status: 'sent',
      resend_id: result.id,
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        email_id: result.id,
        message: 'Invoice email sent successfully' 
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error sending invoice email:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
