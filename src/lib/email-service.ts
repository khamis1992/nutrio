import { getEmailTemplate } from "./email-templates";
import { captureError } from "./sentry";

interface SendEmailOptions {
  to: string;
  template: keyof typeof import("./email-templates").emailTemplates;
  data: Record<string, any>;
  from?: string;
  replyTo?: string;
}

interface SendRawEmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
}

/**
 * Send an email using a predefined template
 */
export async function sendTemplatedEmail(
  options: SendEmailOptions
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const { subject, html } = getEmailTemplate(options.template, options.data);

    return await sendRawEmail({
      to: options.to,
      subject,
      html,
      from: options.from,
      replyTo: options.replyTo,
    });
  } catch (error) {
    console.error("Error sending templated email:", error);
    captureError(error as Error, { 
      context: "sendTemplatedEmail", 
      template: options.template,
      to: options.to 
    });
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Send a raw email via the Supabase Edge Function
 */
export async function sendRawEmail(
  options: SendRawEmailOptions
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          to: options.to,
          subject: options.subject,
          html: options.html,
          from: options.from,
          replyTo: options.replyTo,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to send email");
    }

    return { success: true, messageId: data.messageId };
  } catch (error) {
    console.error("Error sending email:", error);
    captureError(error as Error, { context: "sendRawEmail", to: options.to });
    return { success: false, error: (error as Error).message };
  }
}

// Convenience functions for common emails

export async function sendWelcomeEmail(to: string, firstName: string, appUrl?: string) {
  return sendTemplatedEmail({
    to,
    template: "welcome",
    data: { firstName, appUrl },
  });
}

export async function sendOrderConfirmation(
  to: string,
  orderData: {
    orderId: string;
    total: number;
    currency?: string;
    deliveryTime: string;
    trackingUrl?: string;
  }
) {
  return sendTemplatedEmail({
    to,
    template: "orderConfirmation",
    data: orderData,
  });
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  return sendTemplatedEmail({
    to,
    template: "passwordReset",
    data: { resetUrl },
  });
}

export async function sendSubscriptionStarted(
  to: string,
  subscriptionData: {
    planName: string;
    amount: number;
    currency?: string;
    billingCycle: string;
    startDate: string;
    mealsPerWeek: number;
    dashboardUrl?: string;
  }
) {
  return sendTemplatedEmail({
    to,
    template: "subscriptionStarted",
    data: subscriptionData,
  });
}

export async function sendWalletTopupConfirmation(
  to: string,
  walletData: {
    amount: number;
    currency?: string;
    transactionId: string;
    newBalance: number;
    walletUrl?: string;
  }
) {
  return sendTemplatedEmail({
    to,
    template: "walletTopup",
    data: walletData,
  });
}

export async function sendInvoiceNotification(
  to: string,
  invoiceData: {
    invoiceNumber: string;
    amount: number;
    currency?: string;
    date: string;
    invoiceUrl: string;
  }
) {
  return sendTemplatedEmail({
    to,
    template: "invoiceReady",
    data: invoiceData,
  });
}
