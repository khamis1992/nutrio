import posthog from "posthog-js";

export function initPostHog() {
  if (import.meta.env.DEV) {
    console.log("PostHog disabled in development");
    return;
  }

  const apiKey = import.meta.env.VITE_POSTHOG_KEY;
  const apiHost = import.meta.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com";

  if (!apiKey) {
    if (import.meta.env.DEV) {
      console.warn("PostHog API key not configured");
    }
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
export function identifyUser(userId: string, traits?: Record<string, unknown>) {
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
  properties?: Record<string, unknown>
) {
  if (import.meta.env.DEV) {
    console.log("[Analytics]", eventName, properties);
    return;
  }

  if (!posthog.__loaded) return;

  posthog.capture(eventName, sanitizeProperties(properties));
}

// Page views
export function trackPageView(pageName: string, properties?: Record<string, unknown>) {
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
export function sanitizeProperties(props?: Record<string, unknown>): Record<string, unknown> {
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

// PostHog Experiments integration
export function getFeatureFlagPayload<T = Record<string, unknown>>(
  featureKey: string,
  defaultValue?: T
): T | undefined {
  if (import.meta.env.DEV || !posthog.__loaded) return defaultValue;
  return (posthog.getFeatureFlagPayload(featureKey) as T) ?? defaultValue;
}

export function getExperimentVariant(experimentKey: string): string | null {
  if (import.meta.env.DEV || !posthog.__loaded) return null;
  return posthog.getFeatureFlag(experimentKey);
}

// Scroll depth tracking
const SCROLL_DEPTH_THRESHOLDS = [0.25, 0.5, 0.75, 1.0] as const;

let scrollDepthFired: Set<number> | null = null;
let scrollDepthTimer: ReturnType<typeof setTimeout> | null = null;

export function trackScrollDepthStart(container?: HTMLElement) {
  scrollDepthFired = new Set();

  const target = container || document.documentElement;
  const handler = () => {
    if (!scrollDepthFired) return;
    if (scrollDepthTimer) clearTimeout(scrollDepthTimer);
    scrollDepthTimer = setTimeout(() => {
      const scrollHeight = target.scrollHeight - target.clientHeight;
      if (scrollHeight <= 0) return;
      const scrollPercent = target.scrollTop / scrollHeight;

      for (const threshold of SCROLL_DEPTH_THRESHOLDS) {
        if (scrollPercent >= threshold && !scrollDepthFired!.has(threshold)) {
          scrollDepthFired!.add(threshold);
          trackEvent("$pageview", { scroll_depth: Math.round(threshold * 100) });
        }
      }
    }, 150);
  };

  target.addEventListener("scroll", handler, { passive: true });
  return () => {
    target.removeEventListener("scroll", handler);
    scrollDepthFired = null;
  };
}

// Widget interaction events
export function trackWidgetView(widgetName: string, properties?: Record<string, unknown>) {
  trackEvent("widget_viewed", { widget_name: widgetName, ...properties });
}

export function trackWidgetInteract(widgetName: string, action: string, properties?: Record<string, unknown>) {
  trackEvent("widget_interacted", { widget_name: widgetName, action, ...properties });
}

export function trackWidgetDismiss(widgetName: string, properties?: Record<string, unknown>) {
  trackEvent("widget_dismissed", { widget_name: widgetName, ...properties });
}

// Funnel tracking
export function trackFunnelStep(funnelName: string, step: number, stepName: string, properties?: Record<string, unknown>) {
  trackEvent("funnel_step", { funnel_name: funnelName, step, step_name: stepName, ...properties });
}

// Rage-click detection
let rageClickTracker: { element: string; count: number; timer: ReturnType<typeof setTimeout> | null; lastTime: number } | null = null;

export function installRageClickDetector() {
  const handler = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const id = target.id || target.className?.toString()?.slice(0, 50) || target.tagName;

    if (rageClickTracker && rageClickTracker.element === id) {
      const now = Date.now();
      if (now - rageClickTracker.lastTime < 2000) {
        rageClickTracker.count++;
        if (rageClickTracker.timer) clearTimeout(rageClickTracker.timer);
        rageClickTracker.timer = setTimeout(() => { rageClickTracker = null; }, 2500);

        if (rageClickTracker.count >= 3) {
          trackEvent("dead_click", {
            element: id,
            click_count: rageClickTracker.count,
            page_url: window.location.pathname,
          });
          rageClickTracker = null;
          return;
        }
      } else {
        rageClickTracker = { element: id, count: 1, timer: null, lastTime: now };
      }
    } else {
      rageClickTracker = { element: id, count: 1, timer: null, lastTime: Date.now() };
    }
  };

  document.addEventListener("click", handler, { passive: true });
  return () => document.removeEventListener("click", handler);
}

export default posthog;
