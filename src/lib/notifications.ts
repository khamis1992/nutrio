import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";

export type NotificationType = Database["public"]["Enums"]["notification_type"];

interface NotificationData {
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export const createNotification = async (data: NotificationData) => {
  try {
    const dedupeKey = typeof data.metadata?.dedupe_key === "string"
      ? data.metadata.dedupe_key.slice(0, 200)
      : undefined;
    const { error } = await supabase.from("notifications").insert({
      user_id: data.user_id,
      type: data.type,
      title: data.title,
      message: data.message,
      status: "unread",
      data: (data.metadata || {}) as Json,
      ...(dedupeKey ? { dedupe_key: dedupeKey } : {}),
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
  mealName?: string,
) => {
  const messages: Record<string, { title: string; message: string }> = {
    confirmed: {
      title: "Order confirmed",
      message: `Your order ${mealName ? `for ${mealName} ` : ""}has been confirmed and will be prepared soon.`,
    },
    preparing: {
      title: "Being prepared",
      message: `Your ${mealName || "meal"} is now being prepared in the kitchen.`,
    },
    driver_assigned: {
      title: "Driver assigned",
      message: "A driver has been assigned to your order and will pick it up soon.",
    },
    picked_up: {
      title: "Order picked up",
      message: "Your order has been picked up and is on its way to you.",
    },
    out_for_delivery: {
      title: "Out for delivery",
      message: "Your order is out for delivery and will arrive soon.",
    },
    delivered: {
      title: "Delivered",
      message: `Your ${mealName || "order"} has been delivered. Enjoy your meal.`,
    },
  };

  const notification = messages[status];
  if (notification) {
    await createNotification({
      user_id: userId,
      type: "order_update",
      title: notification.title,
      message: notification.message,
      metadata: { order_id: orderId, status, dedupe_key: `order:${orderId}:${status}` },
    });
  }
};

export const notifyDriverAssigned = async (
  userId: string,
  orderId: string,
  driverName?: string,
) => {
  await createNotification({
    user_id: userId,
    type: "delivery_update",
    title: "Driver assigned",
    message: driverName
      ? `${driverName} has been assigned to deliver your order.`
      : "A driver has been assigned to your order.",
    metadata: { order_id: orderId, dedupe_key: `order:${orderId}:driver_assigned` },
  });
};

export const notifyNewDelivery = async (
  driverUserId: string,
  deliveryId: string,
  restaurantName?: string,
) => {
  await createNotification({
    user_id: driverUserId,
    type: "delivery_update",
    title: "New delivery available",
    message: restaurantName
      ? `New delivery order from ${restaurantName} is available for pickup.`
      : "A new delivery order is available near you.",
    metadata: { delivery_id: deliveryId, dedupe_key: `delivery:${deliveryId}:available` },
  });
};
