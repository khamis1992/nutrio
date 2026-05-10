import { supabase } from "@/integrations/supabase/client";

export type NotificationType = 
  | "order_update"
  | "driver_assigned" 
  | "order_picked_up"
  | "order_delivered"
  | "delivery_claimed";

interface NotificationData {
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export const createNotification = async (data: NotificationData) => {
  try {
    const { error } = await supabase.from("notifications").insert({
      user_id: data.user_id,
      type: data.type,
      title: data.title,
      message: data.message,
      is_read: false,
      metadata: data.metadata || {},
    });

    if (error) {
      console.error("Error creating notification:", error);
    }
  } catch (error) {
    console.error("Failed to create notification:", error);
  }
};

// Notification helpers for common scenarios
export const notifyOrderStatusChange = async (
  userId: string,
  orderId: string,
  status: string,
  mealName?: string
) => {
  const messages: Record<string, { title: string; message: string }> = {
    confirmed: {
      title: "Order Confirmed! ✓",
      message: `Your order ${mealName ? `for ${mealName} ` : ""}has been confirmed and will be prepared soon.`,
    },
    preparing: {
      title: "Being Prepared 👨‍🍳",
      message: `Your ${mealName || "meal"} is now being prepared in the kitchen.`,
    },
    driver_assigned: {
      title: "Driver Assigned 🚗",
      message: "A driver has been assigned to your order and will pick it up soon.",
    },
    picked_up: {
      title: "Order Picked Up 📦",
      message: "Your order has been picked up and is on its way to you!",
    },
    out_for_delivery: {
      title: "Out for Delivery 🚚",
      message: "Your order is out for delivery and will arrive soon.",
    },
    delivered: {
      title: "Delivered! 🎉",
      message: `Your ${mealName || "order"} has been delivered. Enjoy your meal!`,
    },
  };

  const notification = messages[status];
  if (notification) {
    await createNotification({
      user_id: userId,
      type: "order_update",
      title: notification.title,
      message: notification.message,
      metadata: { order_id: orderId, status },
    });
  }
};

export const notifyDriverAssigned = async (
  userId: string,
  orderId: string,
  driverName?: string
) => {
  await createNotification({
    user_id: userId,
    type: "driver_assigned",
    title: "Driver Assigned 🚗",
    message: driverName 
      ? `${driverName} has been assigned to deliver your order.`
      : "A driver has been assigned to your order.",
    metadata: { order_id: orderId },
  });
};

export const notifyNewDelivery = async (
  driverUserId: string,
  deliveryId: string,
  restaurantName?: string
) => {
  await createNotification({
    user_id: driverUserId,
    type: "delivery_claimed",
    title: "New Delivery Available 📦",
    message: restaurantName 
      ? `New delivery order from ${restaurantName} is available for pickup.`
      : "A new delivery order is available near you.",
    metadata: { delivery_id: deliveryId },
  });
};
