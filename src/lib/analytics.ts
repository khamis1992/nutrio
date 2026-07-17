type PostHogClient = typeof import("posthog-js").default;

let posthogClient: PostHogClient | null = null;
let posthogLoader: Promise<PostHogClient> | null = null;
let posthogInitialization: Promise<void> | null = null;

const ANALYTICS_CONSENT_KEY = "nutrio.analytics.consent.v1";

export function hasAnalyticsConsent(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(ANALYTICS_CONSENT_KEY) === "granted";
  } catch {
    return false;
  }
}

function loadPostHog() {
  posthogLoader ??= import("posthog-js").then((module) => module.default);
  return posthogLoader;
}

export async function initPostHog() {
  if (import.meta.env.DEV || !hasAnalyticsConsent()) return;
  if (posthogClient?.__loaded) return;
  if (posthogInitialization) return posthogInitialization;

  const apiKey = import.meta.env.VITE_POSTHOG_KEY;
  const apiHost =
    import.meta.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com";

  if (!apiKey) {
    if (import.meta.env.DEV) {
      console.warn("PostHog API key not configured");
    }
    return;
  }

  posthogInitialization = (async () => {
    const posthog = await loadPostHog();
    posthogClient = posthog;

    if (!posthog.__loaded) {
      posthog.init(apiKey, {
        api_host: apiHost,
        person_profiles: "identified_only",
        capture_pageview: false,
        capture_pageleave: false,
        autocapture: false,
        disable_session_recording: true,
        opt_out_capturing_by_default: true,
        respect_dnt: true,
        loaded: (client) => {
          if (hasAnalyticsConsent()) client.opt_in_capturing();
          else client.opt_out_capturing();
        },
      });
    } else if (hasAnalyticsConsent()) {
      posthog.opt_in_capturing();
    }
  })().finally(() => {
    posthogInitialization = null;
  });

  return posthogInitialization;
}

export async function setAnalyticsConsent(allowed: boolean): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      ANALYTICS_CONSENT_KEY,
      allowed ? "granted" : "denied",
    );
  } catch {
    return;
  }

  if (allowed) {
    await initPostHog();
    posthogClient?.opt_in_capturing();
    return;
  }

  if (posthogClient?.__loaded) {
    posthogClient.opt_out_capturing();
    posthogClient.reset();
  }
}

// User identification
export function identifyUser(userId: string, traits?: Record<string, unknown>) {
  if (import.meta.env.DEV || !hasAnalyticsConsent()) return;

  void loadPostHog().then((posthog) => {
    posthogClient = posthog;
    if (!posthog.__loaded) return;

    posthog.identify(userId, {
      ...sanitizeProperties(traits),
    });
  });
}

export function resetUser() {
  if (import.meta.env.DEV || !posthogClient?.__loaded) return;

  posthogClient.reset();
}

// Event tracking
export function trackEvent(
  eventName: string,
  properties?: Record<string, unknown>,
) {
  if (import.meta.env.DEV || !hasAnalyticsConsent()) return;

  if (!posthogClient?.__loaded) return;

  posthogClient.capture(eventName, sanitizeProperties(properties));
}

// Page views
export function trackPageView(
  pageName: string,
  properties?: Record<string, unknown>,
) {
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

export function trackOrderCompleted(
  orderId: string,
  amount: number,
  items: number,
) {
  trackEvent(AnalyticsEvents.ORDER_COMPLETED, {
    order_id: orderId,
    amount,
    item_count: items,
  });
}

export function trackSubscriptionStarted(planId: string, amount: number) {
  trackEvent(AnalyticsEvents.SUBSCRIPTION_STARTED, { plan_id: planId, amount });
}

export function trackWalletTopupCompleted(
  amount: number,
  paymentMethod: string,
) {
  trackEvent(AnalyticsEvents.WALLET_TOPUP_COMPLETED, {
    amount,
    payment_method: paymentMethod,
  });
}

export function trackError(error: Error, context?: string) {
  trackEvent(AnalyticsEvents.ERROR_OCCURRED, {
    error_message: error.message,
    error_context: context,
  });
}

// Sanitize properties to remove PII
export function sanitizeProperties(
  props?: Record<string, unknown>,
): Record<string, unknown> {
  if (!props) return {};

  const sensitiveKey = /(email|phone|address|password|passcode|token|secret|authorization|cookie|api[_-]?key|card|cvv|cvc|iban|swift|account|latitude|longitude|location|blood|medical|health|diagnos|weight|height|bmi|calorie|protein|carb|fat|water|step|document|file|content|message|notes?|reason_details|(^|_)(full|first|last|customer|driver|recipient)_?name$|^name$|(user|order|subscription|schedule|payment|ticket|driver|restaurant)_?id$)/i;
  const sanitizeValue = (value: unknown, depth: number): unknown => {
    if (depth > 4) return "[TRUNCATED]";
    if (Array.isArray(value)) {
      return value.slice(0, 50).map((item) => sanitizeValue(item, depth + 1));
    }
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .slice(0, 100)
          .map(([key, nested]) => [
            key,
            sensitiveKey.test(key) ? "[REDACTED]" : sanitizeValue(nested, depth + 1),
          ]),
      );
    }
    if (typeof value === "string") return value.slice(0, 500);
    return value;
  };

  return sanitizeValue(props, 0) as Record<string, unknown>;
}

// Feature flags (for future use)
export function isFeatureEnabled(
  featureKey: string,
  defaultValue = false,
): boolean {
  if (import.meta.env.DEV || !posthogClient?.__loaded) return defaultValue;

  return posthogClient.isFeatureEnabled(featureKey) ?? defaultValue;
}

// PostHog Experiments integration
export function getFeatureFlagPayload<T = Record<string, unknown>>(
  featureKey: string,
  defaultValue?: T,
): T | undefined {
  if (import.meta.env.DEV || !posthogClient?.__loaded) return defaultValue;
  return (posthogClient.getFeatureFlagPayload(featureKey) as T) ?? defaultValue;
}

export function getExperimentVariant(experimentKey: string): string | null {
  if (import.meta.env.DEV || !posthogClient?.__loaded) return null;
  const variant = posthogClient.getFeatureFlag(experimentKey);
  return typeof variant === "string" ? variant : null;
}

// Scroll depth tracking
const SCROLL_DEPTH_THRESHOLDS = [0.25, 0.5, 0.75, 1.0] as const;

let scrollDepthFired: Set<number> | null = null;
let scrollDepthTimer: ReturnType<typeof setTimeout> | null = null;

export function trackScrollDepthStart(container?: HTMLElement) {
  if (!hasAnalyticsConsent()) return () => undefined;
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
          trackEvent("$pageview", {
            scroll_depth: Math.round(threshold * 100),
          });
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
export function trackWidgetView(
  widgetName: string,
  properties?: Record<string, unknown>,
) {
  trackEvent("widget_viewed", { widget_name: widgetName, ...properties });
}

export function trackWidgetInteract(
  widgetName: string,
  action: string,
  properties?: Record<string, unknown>,
) {
  trackEvent("widget_interacted", {
    widget_name: widgetName,
    action,
    ...properties,
  });
}

export function trackWidgetDismiss(
  widgetName: string,
  properties?: Record<string, unknown>,
) {
  trackEvent("widget_dismissed", { widget_name: widgetName, ...properties });
}

// Funnel tracking
export function trackFunnelStep(
  funnelName: string,
  step: number,
  stepName: string,
  properties?: Record<string, unknown>,
) {
  trackEvent("funnel_step", {
    funnel_name: funnelName,
    step,
    step_name: stepName,
    ...properties,
  });
}

// Rage-click detection
let rageClickTracker: {
  element: string;
  count: number;
  timer: ReturnType<typeof setTimeout> | null;
  lastTime: number;
} | null = null;

export function installRageClickDetector() {
  if (!hasAnalyticsConsent()) return () => undefined;
  const handler = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const id =
      target.id || target.className?.toString()?.slice(0, 50) || target.tagName;

    if (rageClickTracker && rageClickTracker.element === id) {
      const now = Date.now();
      if (now - rageClickTracker.lastTime < 2000) {
        rageClickTracker.count++;
        if (rageClickTracker.timer) clearTimeout(rageClickTracker.timer);
        rageClickTracker.timer = setTimeout(() => {
          rageClickTracker = null;
        }, 2500);

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
        rageClickTracker = {
          element: id,
          count: 1,
          timer: null,
          lastTime: now,
        };
      }
    } else {
      rageClickTracker = {
        element: id,
        count: 1,
        timer: null,
        lastTime: Date.now(),
      };
    }
  };

  document.addEventListener("click", handler, { passive: true });
  return () => document.removeEventListener("click", handler);
}
