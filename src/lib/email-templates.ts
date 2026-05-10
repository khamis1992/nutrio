// Email templates for Nutrio

interface EmailTemplate {
  subject: string | ((data: Record<string, unknown>) => string);
  html: (data: Record<string, unknown>) => string;
}

const baseTemplate = (content: string, title: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .header h1 { color: white; margin: 0; font-size: 24px; }
    .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; padding: 12px 24px; background: #22c55e; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
    .highlight { background: #f0fdf4; padding: 15px; border-radius: 6px; margin: 15px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Nutrio</h1>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} Nutrio. All rights reserved.</p>
      <p>Healthy meal delivery, personalized for you.</p>
    </div>
  </div>
</body>
</html>
`;

export const emailTemplates: Record<string, EmailTemplate> = {
  welcome: {
    subject: "Welcome to Nutrio! 🎉",
    html: (data) => baseTemplate(`
      <h2>Welcome to Nutrio, ${data.firstName || "there"}!</h2>
      <p>We're excited to have you on board. Get ready to enjoy healthy, delicious meals delivered right to your door.</p>
      
      <div class="highlight">
        <strong>What's next?</strong>
        <ul>
          <li>Browse our menu of nutritious meals</li>
          <li>Set your dietary preferences</li>
          <li>Schedule your first delivery</li>
        </ul>
      </div>
      
      <a href="${data.appUrl || "#"}" class="button">Start Exploring</a>
      
      <p>If you have any questions, our support team is here to help.</p>
      <p>Happy eating!<br>The Nutrio Team</p>
    `, "Welcome to Nutrio"),
  },

  orderConfirmation: {
    subject: "Order Confirmed! 🍽️",
    html: (data) => baseTemplate(`
      <h2>Your order is confirmed!</h2>
      <p>Thank you for your order. We've received it and are preparing your delicious meal.</p>
      
      <div class="highlight">
        <strong>Order #${data.orderId}</strong><br>
        <strong>Total:</strong> ${data.currency || "QAR"} ${data.total}<br>
        <strong>Estimated delivery:</strong> ${data.deliveryTime}
      </div>
      
      <p>You can track your order status in real-time through the app.</p>
      
      <a href="${data.trackingUrl || "#"}" class="button">Track Order</a>
      
      <p>We'll notify you when your meal is on its way!</p>
    `, "Order Confirmed"),
  },

  orderDelivered: {
    subject: "Your order has been delivered! 🎉",
    html: (data) => baseTemplate(`
      <h2>Enjoy your meal!</h2>
      <p>Your order has been delivered. We hope you enjoy your nutritious meal.</p>
      
      <div class="highlight">
        <strong>Order #${data.orderId}</strong><br>
        <strong>Delivered at:</strong> ${data.deliveredAt}
      </div>
      
      <p>How was your experience? We'd love to hear your feedback.</p>
      
      <a href="${data.reviewUrl || "#"}" class="button">Leave a Review</a>
      
      <p>Thank you for choosing Nutrio!</p>
    `, "Order Delivered"),
  },

  passwordReset: {
    subject: "Reset your Nutrio password",
    html: (data) => baseTemplate(`
      <h2>Password Reset Request</h2>
      <p>We received a request to reset your password. Click the button below to create a new password.</p>
      
      <a href="${data.resetUrl}" class="button">Reset Password</a>
      
      <p>Or copy and paste this link into your browser:</p>
      <p style="word-break: break-all; font-size: 12px; color: #6b7280;">${data.resetUrl}</p>
      
      <p><strong>This link expires in 1 hour.</strong></p>
      
      <p>If you didn't request this, you can safely ignore this email.</p>
    `, "Reset Password"),
  },

  subscriptionStarted: {
    subject: "Your Nutrio subscription is active! ✨",
    html: (data) => baseTemplate(`
      <h2>Welcome to Nutrio ${data.planName}!</h2>
      <p>Your subscription is now active. Enjoy exclusive benefits and save on every meal.</p>
      
      <div class="highlight">
        <strong>Plan:</strong> ${data.planName}<br>
        <strong>Amount:</strong> ${data.currency || "QAR"} ${data.amount}/${data.billingCycle}<br>
        <strong>Start date:</strong> ${data.startDate}
      </div>
      
      <p>What's included:</p>
      <ul>
        <li>${data.mealsPerWeek} meals per week</li>
        <li>Free delivery</li>
        <li>Priority scheduling</li>
        <li>Exclusive menu items</li>
      </ul>
      
      <a href="${data.dashboardUrl || "#"}" class="button">View Dashboard</a>
    `, "Subscription Active"),
  },

  walletTopup: {
    subject: "Wallet topped up successfully! 💰",
    html: (data) => baseTemplate(`
      <h2>Wallet Top-up Complete</h2>
      <p>Your wallet has been successfully topped up. The credits are now available for use.</p>
      
      <div class="highlight">
        <strong>Amount added:</strong> ${data.currency || "QAR"} ${data.amount}<br>
        <strong>Transaction ID:</strong> ${data.transactionId}<br>
        <strong>New balance:</strong> ${data.currency || "QAR"} ${data.newBalance}
      </div>
      
      <a href="${data.walletUrl || "#"}" class="button">View Wallet</a>
    `, "Wallet Top-up"),
  },

  invoiceReady: {
    subject: "Your invoice is ready 📄",
    html: (data) => baseTemplate(`
      <h2>Invoice Available</h2>
      <p>Your invoice for recent transactions is now ready for download.</p>
      
      <div class="highlight">
        <strong>Invoice #:</strong> ${data.invoiceNumber}<br>
        <strong>Amount:</strong> ${data.currency || "QAR"} ${data.amount}<br>
        <strong>Date:</strong> ${data.date}
      </div>
      
      <a href="${data.invoiceUrl}" class="button">Download Invoice</a>
      
      <p>Keep this for your records.</p>
    `, "Invoice Ready"),
  },

  marketing: {
    subject: (data) => data.subject || "News from Nutrio",
    html: (data) => baseTemplate(`
      <h2>${data.title || "News from Nutrio"}</h2>
      ${data.content}
      ${data.ctaUrl ? `<a href="${data.ctaUrl}" class="button">${data.ctaText || "Learn More"}</a>` : ""}
    `, data.title || "Nutrio Update"),
  },
};

// Helper function to get template
export function getEmailTemplate(
  templateName: keyof typeof emailTemplates,
  data: Record<string, unknown>
): { subject: string; html: string } {
  const template = emailTemplates[templateName];
  if (!template) {
    throw new Error(`Email template "${templateName}" not found`);
  }

  const subject = typeof template.subject === "function" 
    ? template.subject(data) 
    : template.subject;

  return {
    subject,
    html: template.html(data),
  };
}
