import { useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { useToast } from "@/hooks/use-toast";

export const DEEP_LINK_ROUTES = {
  order_detail: "/orders",
  order_history: "/orders",
  delivery_tracking: "/live/:id",
  subscription: "/subscription",
  subscription_manage: "/subscription",
  wallet: "/wallet",
  checkout: "/checkout",
  meals: "/meals",
  restaurant: "/restaurant/:id",
  meal_detail: "/meals/:id",
  schedule: "/schedule",
  progress: "/progress",
  weight_tracking: "/weight-tracking",
  support: "/support",
  referral: "/affiliate",
  affiliate: "/affiliate",
  profile: "/profile",
  settings: "/settings",
  notifications: "/notifications",
  meal_response: "/health/meal-response",
} as const;

export type DeepLinkRoute = keyof typeof DEEP_LINK_ROUTES;

export interface PushNotificationData {
  type: DeepLinkRoute;
  id?: string;
  params?: Record<string, string>;
  title?: string;
  body?: string;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PENDING_DEEP_LINK_KEY = "pending_deep_link";
const PENDING_DEEP_LINK_TTL_MS = 15 * 60 * 1_000;
const ROUTES_REQUIRING_ID = new Set<DeepLinkRoute>([
  "order_detail",
  "delivery_tracking",
  "restaurant",
  "meal_detail",
]);
const ALLOWED_QUERY_PARAMS: Partial<Record<DeepLinkRoute, ReadonlySet<string>>> = {
  order_history: new Set(["tab"]),
  subscription: new Set(["source"]),
  subscription_manage: new Set(["source"]),
  meals: new Set(["category"]),
  schedule: new Set(["date"]),
  progress: new Set(["tab"]),
};

type PendingDeepLink = PushNotificationData & { expiresAt: number };

function isDeepLinkRoute(value: unknown): value is DeepLinkRoute {
  return typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(DEEP_LINK_ROUTES, value);
}

function boundedText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, maxLength) : undefined;
}

export function buildSafeDeepLink(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  if (!isDeepLinkRoute(data.type)) return null;

  const type = data.type;
  const id = typeof data.id === "string" ? data.id.trim() : "";
  if (ROUTES_REQUIRING_ID.has(type) && !UUID_PATTERN.test(id)) return null;
  if (id && !UUID_PATTERN.test(id)) return null;

  let route: string = DEEP_LINK_ROUTES[type];
  if (route.includes(":id")) route = route.replace(":id", id);

  const query = new URLSearchParams();
  if (type === "order_detail") query.set("order_id", id);

  if (data.params !== undefined) {
    if (!data.params || typeof data.params !== "object" || Array.isArray(data.params)) {
      return null;
    }
    const allowed = ALLOWED_QUERY_PARAMS[type] ?? new Set<string>();
    const entries = Object.entries(data.params as Record<string, unknown>);
    if (entries.length > 4) return null;
    for (const [key, rawValue] of entries) {
      if (!allowed.has(key) || typeof rawValue !== "string") return null;
      const normalized = rawValue.trim();
      if (!/^[A-Za-z0-9_.:-]{1,80}$/.test(normalized)) return null;
      query.set(key, normalized);
    }
  }

  const suffix = query.toString();
  return suffix ? `${route}?${suffix}` : route;
}

export function usePushNotificationDeepLink() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleDeepLink = useCallback((data: PushNotificationData) => {
    const route = buildSafeDeepLink(data);
    if (!route) {
      console.warn("Rejected invalid push deep link");
      navigate("/");
      return;
    }

    navigate(route);
    const title = boundedText(data.title, 120);
    if (title) {
      toast({
        title,
        description: boundedText(data.body, 300) || "",
      });
    }

    localStorage.removeItem(PENDING_DEEP_LINK_KEY);
  }, [navigate, toast]);

  const checkPendingDeepLink = useCallback(() => {
    const pendingDeepLink = localStorage.getItem(PENDING_DEEP_LINK_KEY);
    if (!pendingDeepLink) return;

    try {
      if (pendingDeepLink.length > 2_048) throw new Error("invalid_pending_link");
      const data = JSON.parse(pendingDeepLink) as PendingDeepLink;
      if (!Number.isFinite(data.expiresAt) || data.expiresAt <= Date.now()) {
        localStorage.removeItem(PENDING_DEEP_LINK_KEY);
        return;
      }
      handleDeepLink(data);
    } catch {
      console.warn("Discarded invalid pending push deep link");
      localStorage.removeItem(PENDING_DEEP_LINK_KEY);
    }
  }, [handleDeepLink]);

  useEffect(() => {
    const handlePushNotification = (event: MessageEvent) => {
      if (event.data?.type === "push-notification-click") {
        handleDeepLink(event.data.payload as PushNotificationData);
      }
    };

    navigator.serviceWorker?.addEventListener("message", handlePushNotification);
    checkPendingDeepLink();
    return () => {
      navigator.serviceWorker?.removeEventListener("message", handlePushNotification);
    };
  }, [checkPendingDeepLink, handleDeepLink]);

  const storePendingDeepLink = (data: PushNotificationData) => {
    if (!buildSafeDeepLink(data)) return;
    const title = boundedText(data.title, 120);
    const body = boundedText(data.body, 300);
    const pending: PendingDeepLink = {
      type: data.type,
      ...(data.id ? { id: data.id } : {}),
      ...(data.params ? { params: data.params } : {}),
      ...(title ? { title } : {}),
      ...(body ? { body } : {}),
      expiresAt: Date.now() + PENDING_DEEP_LINK_TTL_MS,
    };
    localStorage.setItem(PENDING_DEEP_LINK_KEY, JSON.stringify(pending));
  };

  return { handleDeepLink, storePendingDeepLink };
}

export function createNotificationPayload(
  type: DeepLinkRoute,
  options: Omit<PushNotificationData, "type"> = {},
): PushNotificationData {
  return { type, ...options };
}

export const NOTIFICATION_TEMPLATES = {
  orderReady: (orderId: string, restaurantName: string) =>
    createNotificationPayload("order_detail", {
      id: orderId,
      title: "Order Ready!",
      body: `Your order from ${restaurantName} is ready for pickup`,
    }),
  orderDelivered: (orderId: string) =>
    createNotificationPayload("order_detail", {
      id: orderId,
      title: "Order Delivered",
      body: "Your meal has been delivered. Enjoy!",
    }),
  lowCredits: (remainingMeals: number) =>
    createNotificationPayload("subscription", {
      title: "Low on Credits",
      body: `You have ${remainingMeals} meals remaining. Upgrade your plan?`,
    }),
  streakReminder: (streakDays: number) =>
    createNotificationPayload("progress", {
      title: "Keep Your Streak!",
      body: `You're on a ${streakDays} day streak. Log a meal today!`,
    }),
  newRestaurant: (restaurantId: string, restaurantName: string) =>
    createNotificationPayload("restaurant", {
      id: restaurantId,
      title: "New Restaurant",
      body: `${restaurantName} is now available. Check them out!`,
    }),
  referralBonus: (amount: number) =>
    createNotificationPayload("affiliate", {
      title: "Affiliate Commission!",
      body: `You earned ${amount} QAR from your affiliate network`,
    }),
  weeklyReport: () =>
    createNotificationPayload("progress", {
      title: "Weekly Report Ready",
      body: "Your nutrition report for this week is ready to view",
    }),
  mealResponseCheckInDue: () =>
    createNotificationPayload("meal_response", {
      title: "How did that meal feel?",
      body: "A quick check-in helps personalize future insights.",
    }),
  mealResponseInsightReady: () =>
    createNotificationPayload("meal_response", {
      title: "Your meal response insight is ready",
      body: "Open Meal Response to review the latest insight.",
    }),
};
