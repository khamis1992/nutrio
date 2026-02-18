// Resend Email Service
// https://resend.com

const RESEND_API_KEY = import.meta.env.VITE_RESEND_API_KEY;
const RESEND_API_URL = 'https://api.resend.com/v1';
const FROM_EMAIL = 'Nutrio <invoices@nutrio.app>';

export interface EmailAttachment {
  filename: string;
  content: string; // base64 encoded
}

export interface EmailParams {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  attachments?: EmailAttachment[];
}

class ResendService {
  private apiKey: string | undefined;
  private apiUrl: string;

  constructor() {
    this.apiKey = RESEND_API_KEY;
    this.apiUrl = RESEND_API_URL;
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async sendEmail(params: EmailParams): Promise<{ id: string }> {
    if (!this.isConfigured()) {
      throw new Error('Resend API key not configured');
    }

    try {
      const response = await fetch(`${this.apiUrl}/emails`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: Array.isArray(params.to) ? params.to : [params.to],
          subject: params.subject,
          html: params.html,
          text: params.text,
          attachments: params.attachments,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Resend API error: ${error}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to send email:', error);
      throw error;
    }
  }

  async sendInvoiceEmail(params: {
    to: string;
    recipientName: string;
    invoiceNumber: string;
    amount: number;
    pdfBase64: string;
    invoiceType: string;
  }): Promise<{ id: string }> {
    const typeLabels: Record<string, string> = {
      'wallet_topup': 'Wallet Top-up',
      'subscription': 'Subscription',
      'order': 'Order',
      'partner_payout': 'Partner Payout',
      'driver_payout': 'Driver Payout'
    };

    const subject = `Your Nutrio Invoice - ${params.invoiceNumber}`;
    
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
          .footer a { color: #22c55e; text-decoration: none; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Nutrio</h1>
          <p>Healthy Meal Delivery & Nutrition</p>
        </div>
        
        <div class="content">
          <p>Hello ${params.recipientName},</p>
          
          <p>Thank you for choosing Nutrio! Please find your invoice attached.</p>
          
          <div class="invoice-details">
            <div class="invoice-number">Invoice #${params.invoiceNumber}</div>
            <div class="amount">QAR ${params.amount.toFixed(2)}</div>
            <p><strong>Type:</strong> ${typeLabels[params.invoiceType] || params.invoiceType}</p>
          </div>
          
          <p>If you have any questions about this invoice, please don't hesitate to contact our support team.</p>
          
          <center>
            <a href="mailto:support@nutrio.app" class="button">Contact Support</a>
          </center>
        </div>
        
        <div class="footer">
          <p>Nutrio - Healthy Meal Delivery</p>
          <p>Doha, Qatar | support@nutrio.app | www.nutrio.app</p>
          <p style="margin-top: 15px; font-size: 12px;">
            This email was sent to ${params.to}. If you didn't request this invoice, please ignore this email.
          </p>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: params.to,
      subject,
      html,
      attachments: [
        {
          filename: `invoice-${params.invoiceNumber}.pdf`,
          content: params.pdfBase64,
        },
      ],
    });
  }

  async sendWelcomeEmail(params: {
    to: string;
    name: string;
  }): Promise<{ id: string }> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Nutrio</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { text-align: center; padding: 40px 20px; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); border-radius: 12px; margin-bottom: 30px; }
          .header h1 { color: white; margin: 0; font-size: 32px; }
          .header p { color: rgba(255,255,255,0.9); margin: 10px 0 0; font-size: 18px; }
          .content { background: #f9fafb; padding: 30px; border-radius: 12px; }
          .features { display: grid; gap: 15px; margin: 25px 0; }
          .feature { background: white; padding: 15px; border-radius: 8px; display: flex; align-items: center; gap: 15px; }
          .feature-icon { width: 40px; height: 40px; background: #dcfce7; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
          .button { display: inline-block; background: #22c55e; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Welcome to Nutrio!</h1>
          <p>Your journey to healthier eating starts here</p>
        </div>
        
        <div class="content">
          <p>Hello ${params.name},</p>
          
          <p>We're thrilled to have you join the Nutrio family! Get ready to discover a world of delicious, healthy meals delivered right to your doorstep.</p>
          
          <div class="features">
            <div class="feature">
              <div class="feature-icon">🥗</div>
              <div>
                <strong>Healthy Meals</strong>
                <p style="margin: 5px 0 0; color: #6b7280;">Nutritious meals from top restaurants</p>
              </div>
            </div>
            <div class="feature">
              <div class="feature-icon">📊</div>
              <div>
                <strong>Track Nutrition</strong>
                <p style="margin: 5px 0 0; color: #6b7280;">Monitor your daily intake & goals</p>
              </div>
            </div>
            <div class="feature">
              <div class="feature-icon">🚚</div>
              <div>
                <strong>Fast Delivery</strong>
                <p style="margin: 5px 0 0; color: #6b7280;">Hot & fresh meals delivered to you</p>
              </div>
            </div>
          </div>
          
          <center>
            <a href="${window.location.origin}/dashboard" class="button">Start Ordering</a>
          </center>
          
          <p style="margin-top: 25px;">If you have any questions, our support team is here to help at <a href="mailto:support@nutrio.app" style="color: #22c55e;">support@nutrio.app</a></p>
        </div>
        
        <div class="footer">
          <p>Nutrio - Healthy Meal Delivery</p>
          <p>Doha, Qatar | support@nutrio.app | www.nutrio.app</p>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: params.to,
      subject: 'Welcome to Nutrio! 🎉',
      html,
    });
  }
}

export const resendService = new ResendService();
export default resendService;
