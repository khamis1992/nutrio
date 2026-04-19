import posthog from "posthog-js";

export function initPostHog() {
  if (import.meta.env.DEV) {
    console.log("PostHog disabled in development");
    return;
  }

  const apiKey = import.meta.env.VITE_POSTHOG_KEY;
  const apiHost = import.meta.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com";

  if (!apiKey) {
    console.warn("PostHog API key not configured");
    return;
  }

  posthog.init(apiKey, {
    api_host: apiHost,
    person_profiles: "identified_only", // Only track identified users
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: true,
    session_recording: {
      maskAllInputs: true,
      maskInputOptions: {
        password: true,
        email: true,
      },
    },
    // Disable in development
    loaded: (posthog) => {
      if (import.meta.env.DEV) posthog.opt_out_capturing();
    },
  });
}

// User identification
export function identifyUser(userId: string, traits?: Record<string, any>) {
  if (import.meta.env.DEV || !posthog.__loaded) return;

  posthog.identify(userId, {
    ...traits,
    // Don't send PII
    email: undefined,
    phone: undefined,
  });
}

export function resetUser() {
  if (import.meta.env.DEV || !posthog.__loaded) return;

  posthog.reset();
}

// Event tracking
export function trackEvent(
  eventName: string,
  properties?: Record<string, any>
) {
  if (import.meta.env.DEV) {
    console.log("[Analytics]", eventName, properties);
    return;
  }

  if (!posthog.__loaded) return;

  posthog.capture(eventName, sanitizeProperties(properties));
}

// Page views
export function trackPageView(pageName: string, properties?: Record<string, any>) {
  trackEvent("$pageview", {
    page_name: pageName,
    ...properties,
  });
}

// Predefined events for common actions
export const AnalyticsEvents = {
  // Authentication
  USER_SIGNED_UP: "user_signed_up",
  USER_LOGGED_IN: "user_logged_in",
  USER_LOGGED_OUT: "user_logged_out",

  // Orders
  ORDER_STARTED: "order_started",
  ORDER_COMPLETED: "order_completed",
  ORDER_CANCELLED: "order_cancelled",

  // Subscriptions
  SUBSCRIPTION_STARTED: "subscription_started",
  SUBSCRIPTION_CANCELLED: "subscription_cancelled",
  SUBSCRIPTION_UPGRADED: "subscription_upgraded",

  // Wallet
  WALLET_TOPUP_INITIATED: "wallet_topup_initiated",
  WALLET_TOPUP_COMPLETED: "wallet_topup_completed",

  // App
  APP_OPENED: "app_opened",
  APP_CLOSED: "app_closed",
  ERROR_OCCURRED: "error_occurred",
} as const;

// Helper to track common events
export function trackUserSignedUp(userId: string, method: string) {
  identifyUser(userId, { signup_method: method });
  trackEvent(AnalyticsEvents.USER_SIGNED_UP, { method });
}

export function trackUserLoggedIn(userId: string, method: string) {
  identifyUser(userId);
  trackEvent(AnalyticsEvents.USER_LOGGED_IN, { method });
}

export function trackOrderStarted(orderId: string, amount: number) {
  trackEvent(AnalyticsEvents.ORDER_STARTED, { order_id: orderId, amount });
}

export function trackOrderCompleted(orderId: string, amount: number, items: number) {
  trackEvent(AnalyticsEvents.ORDER_COMPLETED, { 
    order_id: orderId, 
    amount, 
    item_count: items 
  });
}

export function trackSubscriptionStarted(planId: string, amount: number) {
  trackEvent(AnalyticsEvents.SUBSCRIPTION_STARTED, { plan_id: planId, amount });
}

export function trackWalletTopupCompleted(amount: number, paymentMethod: string) {
  trackEvent(AnalyticsEvents.WALLET_TOPUP_COMPLETED, { 
    amount, 
    payment_method: paymentMethod 
  });
}

export function trackError(error: Error, context?: string) {
  trackEvent(AnalyticsEvents.ERROR_OCCURRED, {
    error_message: error.message,
    error_context: context,
  });
}

// Sanitize properties to remove PII
export function sanitizeProperties(props?: Record<string, any>): Record<string, any> {
  if (!props) return {};

  const sensitiveKeys = ["email", "phone", "password", "token", "secret", "credit_card"];
  const sanitized = { ...props };

  for (const key of Object.keys(sanitized)) {
    if (sensitiveKeys.some((sk) => key.toLowerCase().includes(sk))) {
      sanitized[key] = "[REDACTED]";
    }
  }

  return sanitized;
}

// Feature flags (for future use)
export function isFeatureEnabled(featureKey: string, defaultValue = false): boolean {
  if (import.meta.env.DEV || !posthog.__loaded) return defaultValue;

  return posthog.isFeatureEnabled(featureKey) ?? defaultValue;
}

export default posthog;
