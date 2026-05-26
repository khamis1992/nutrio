import { NavigateFunction } from "react-router-dom";
import {
  Utensils,
  Bell,
  Calendar,
  Flame,
  Clock,
  Truck,
  Phone,
  Check,
  X,
  BarChart3,
  Share2,
  Trophy,
  MapPin,
} from "lucide-react";
import React from "react";

export interface NotificationAction {
  id: string;
  label: string;
  icon: React.ElementType;
  handler: (navigate: NavigateFunction, metadata?: Record<string, unknown>) => void;
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive";
}

export type NotificationActionCategory =
  | "meal_reminder"
  | "streak_risk"
  | "order_update"
  | "challenge_invite"
  | "weekly_report"
  | "delivery_update";

const ACTION_REGISTRY: Record<NotificationActionCategory, NotificationAction[]> = {
  meal_reminder: [
    {
      id: "log_meal",
      label: "Log Meal",
      icon: Utensils,
      handler: (navigate) => navigate("/dashboard"),
    },
    {
      id: "snooze_30",
      label: "Snooze 30min",
      icon: Clock,
      handler: () => {
        console.log("Meal reminder snoozed for 30 minutes");
      },
      variant: "outline",
    },
    {
      id: "view_schedule",
      label: "View Schedule",
      icon: Calendar,
      handler: (navigate) => navigate("/schedule"),
      variant: "outline",
    },
  ],
  streak_risk: [
    {
      id: "log_meal_now",
      label: "Log Meal Now",
      icon: Flame,
      handler: (navigate) => navigate("/dashboard"),
    },
    {
      id: "snooze_streak",
      label: "Snooze",
      icon: Clock,
      handler: () => {
        console.log("Streak risk snoozed");
      },
      variant: "outline",
    },
  ],
  order_update: [
    {
      id: "track_order",
      label: "Track Order",
      icon: MapPin,
      handler: (navigate, metadata) => {
        const orderId = metadata?.order_id as string;
        if (orderId) {
          navigate(`/live/${orderId}`);
        } else {
          navigate("/orders");
        }
      },
    },
    {
      id: "call_driver",
      label: "Call Driver",
      icon: Phone,
      handler: (_navigate, metadata) => {
        const phone = (metadata?.driver_phone as string) || "";
        if (phone) {
          window.open(`tel:${phone}`, "_self");
        }
      },
      variant: "outline",
    },
  ],
  challenge_invite: [
    {
      id: "accept_challenge",
      label: "Accept",
      icon: Check,
      handler: (navigate) => navigate("/community"),
    },
    {
      id: "maybe_later",
      label: "Maybe Later",
      icon: X,
      handler: () => {
        console.log("Challenge invitation dismissed");
      },
      variant: "ghost",
    },
  ],
  weekly_report: [
    {
      id: "view_report",
      label: "View Report",
      icon: BarChart3,
      handler: (navigate) => navigate("/progress"),
    },
    {
      id: "share_report",
      label: "Share",
      icon: Share2,
      handler: () => {
        if (navigator.share) {
          navigator.share({
            title: "My Nutrio Weekly Report",
            text: "Check out my nutrition progress this week!",
            url: window.location.origin,
          }).catch(() => {});
        }
      },
      variant: "outline",
    },
  ],
  delivery_update: [
    {
      id: "track_delivery",
      label: "Track Delivery",
      icon: Truck,
      handler: (navigate, metadata) => {
        const orderId = metadata?.order_id as string;
        if (orderId) {
          navigate(`/live/${orderId}`);
        } else {
          navigate("/orders");
        }
      },
    },
    {
      id: "call_driver_delivery",
      label: "Call Driver",
      icon: Phone,
      handler: (_navigate, metadata) => {
        const phone = (metadata?.driver_phone as string) || "";
        if (phone) {
          window.open(`tel:${phone}`, "_self");
        }
      },
      variant: "outline",
    },
  ],
};

export function getNotificationActions(
  category: NotificationActionCategory
): NotificationAction[] {
  return ACTION_REGISTRY[category] || [];
}

export function getActionsByNotificationType(
  type: string
): NotificationActionCategory | null {
  const mapping: Record<string, NotificationActionCategory> = {
    meal_reminder: "meal_reminder",
    streak_risk: "streak_risk",
    streak_alert: "streak_risk",
    order_update: "order_update",
    delivery_update: "delivery_update",
    challenge_invite: "challenge_invite",
    weekly_report: "weekly_report",
  };
  return mapping[type] || null;
}

export function getAllCategories(): NotificationActionCategory[] {
  return Object.keys(ACTION_REGISTRY) as NotificationActionCategory[];
}
