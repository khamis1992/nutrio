// WhatsApp Notification Service using Ultramsg API
// https://ultramsg.com

const ULTRAMSG_INSTANCE_ID = import.meta.env.VITE_ULTRAMSG_INSTANCE_ID;
const ULTRAMSG_TOKEN = import.meta.env.VITE_ULTRAMSG_TOKEN;
const ULTRAMSG_API_URL = "https://api.ultramsg.com";

interface WhatsAppMessage {
  to: string; // Phone number with country code (e.g., +97412345678)
  body: string;
}

interface WhatsAppTemplate {
  to: string;
  template: string;
  language: string;
  components?: Array<{
    type: string;
    parameters: Array<{
      type: string;
      text?: string;
    }>;
  }>;
}

export const sendWhatsAppMessage = async (message: WhatsAppMessage): Promise<boolean> => {
  try {
    if (!ULTRAMSG_INSTANCE_ID || !ULTRAMSG_TOKEN) {
      console.error("Ultramsg credentials not configured");
      return false;
    }

    const url = `${ULTRAMSG_API_URL}/instance${ULTRAMSG_INSTANCE_ID}/messages/chat`;
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token: ULTRAMSG_TOKEN,
        to: message.to,
        body: message.body,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("WhatsApp API error:", error);
      return false;
    }

    const data = await response.json();
    console.log("WhatsApp message sent:", data);
    return true;
  } catch (error) {
    console.error("Failed to send WhatsApp message:", error);
    return false;
  }
};

// Customer Notifications
export const notifyCustomerOrderConfirmed = async (
  phone: string,
  customerName: string,
  orderId: string,
  mealName: string,
  restaurantName: string
) => {
  const message = {
    to: phone,
    body: `Hello ${customerName}! 👋\n\nYour order has been confirmed! ✅\n\nOrder #${orderId.slice(0, 8)}\nMeal: ${mealName}\nRestaurant: ${restaurantName}\n\nWe'll notify you when it's being prepared.`,
  };
  return sendWhatsAppMessage(message);
};

export const notifyCustomerDriverAssigned = async (
  phone: string,
  customerName: string,
  orderId: string,
  driverName: string,
  driverVehicle: string
) => {
  const message = {
    to: phone,
    body: `Great news ${customerName}! 🚗\n\nYour driver ${driverName} is on the way to pick up your order #${orderId.slice(0, 8)}.\n\nVehicle: ${driverVehicle}\n\nYou can track your order in the app.`,
  };
  return sendWhatsAppMessage(message);
};

export const notifyCustomerOrderPickedUp = async (
  phone: string,
  customerName: string,
  orderId: string,
  estimatedTime: string
) => {
  const message = {
    to: phone,
    body: `Hi ${customerName}! 📦\n\nYour order #${orderId.slice(0, 8)} has been picked up and is on its way to you!\n\nEstimated delivery: ${estimatedTime}\n\nGet ready to enjoy your meal!`,
  };
  return sendWhatsAppMessage(message);
};

export const notifyCustomerOrderDelivered = async (
  phone: string,
  customerName: string,
  orderId: string
) => {
  const message = {
    to: phone,
    body: `Hello ${customerName}! 🎉\n\nYour order #${orderId.slice(0, 8)} has been delivered!\n\nWe hope you enjoy your meal. Thanks for choosing Nutrio!\n\nRate your experience in the app.`,
  };
  return sendWhatsAppMessage(message);
};

// Partner Notifications
export const notifyPartnerNewOrder = async (
  phone: string,
  partnerName: string,
  orderId: string,
  customerName: string,
  mealName: string,
  deliveryTime: string
) => {
  const message = {
    to: phone,
    body: `Hello ${partnerName}! 🍽️\n\nNew order received!\n\nOrder #${orderId.slice(0, 8)}\nCustomer: ${customerName}\nMeal: ${mealName}\nDelivery: ${deliveryTime}\n\nPlease confirm and start preparing.`,
  };
  return sendWhatsAppMessage(message);
};

export const notifyPartnerDriverClaimed = async (
  phone: string,
  partnerName: string,
  orderId: string,
  driverName: string
) => {
  const message = {
    to: phone,
    body: `Hi ${partnerName}! 🚗\n\nGood news! Driver ${driverName} has claimed order #${orderId.slice(0, 8)}.\n\nPlease have the order ready for pickup.`,
  };
  return sendWhatsAppMessage(message);
};

// Driver Notifications
export const notifyDriverNewDelivery = async (
  phone: string,
  driverName: string,
  deliveryId: string,
  restaurantName: string,
  earnings: number
) => {
  const message = {
    to: phone,
    body: `Hello ${driverName}! 📦\n\nNew delivery available!\n\nDelivery #${deliveryId.slice(0, 8)}\nRestaurant: ${restaurantName}\nEarnings: QAR ${earnings.toFixed(2)}\n\nOpen the app to claim this delivery.`,
  };
  return sendWhatsAppMessage(message);
};

export const notifyDriverDeliveryCancelled = async (
  phone: string,
  driverName: string,
  deliveryId: string
) => {
  const message = {
    to: phone,
    body: `Hi ${driverName},\n\nDelivery #${deliveryId.slice(0, 8)} has been cancelled.\n\nPlease check the app for other available deliveries.`,
  };
  return sendWhatsAppMessage(message);
};

// Admin Notifications
export const notifyAdminNewDriverApplication = async (
  phone: string,
  driverName: string,
  driverId: string
) => {
  const message = {
    to: phone,
    body: `New driver application! 🚗\n\nName: ${driverName}\nID: ${driverId.slice(0, 8)}\n\nPlease review in the admin panel.`,
  };
  return sendWhatsAppMessage(message);
};

export const notifyAdminHighValueOrder = async (
  phone: string,
  orderId: string,
  orderValue: number,
  customerName: string
) => {
  const message = {
    to: phone,
    body: `High-value order alert! 💰\n\nOrder #${orderId.slice(0, 8)}\nValue: QAR ${orderValue.toFixed(2)}\nCustomer: ${customerName}\n\nPlease monitor for any issues.`,
  };
  return sendWhatsAppMessage(message);
};
