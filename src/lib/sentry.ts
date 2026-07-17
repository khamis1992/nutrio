type SentryModule = typeof import("@sentry/react");

let sentryLoader: Promise<SentryModule> | null = null;

const sensitiveTelemetryKey = /(authorization|cookie|password|passcode|token|secret|api.?key|card|cvv|cvc|iban|swift|account|email|phone|address|latitude|longitude|blood|medical|diagnos|health.?report|document.?content|file.?content|weight|height|bmi)/i;

function sanitizeTelemetryString(value: string): string {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]")
    .replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, "[REDACTED_JWT]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[REDACTED_EMAIL]")
    .slice(0, 2_000);
}

function sanitizeTelemetryValue(value: unknown, key = "", depth = 0): unknown {
  if (sensitiveTelemetryKey.test(key)) return "[REDACTED]";
  if (depth > 6) return "[TRUNCATED]";
  if (typeof value === "string") return sanitizeTelemetryString(value);
  if (Array.isArray(value)) {
    return value.slice(0, 100).map((item) => sanitizeTelemetryValue(item, key, depth + 1));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 200)
        .map(([nestedKey, nestedValue]) => [
          nestedKey,
          sanitizeTelemetryValue(nestedValue, nestedKey, depth + 1),
        ]),
    );
  }
  return value;
}

function sanitizeTelemetryUrl(value: string | undefined): string | undefined {
  if (!value) return value;
  try {
    const url = new URL(value, window.location.origin);
    const pathname = url.pathname.replace(
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi,
      "[id]",
    );
    return `${url.origin}${pathname}`;
  } catch {
    return sanitizeTelemetryString(value.split(/[?#]/, 1)[0]);
  }
}

function loadSentry() {
  sentryLoader ??= import("@sentry/react");
  return sentryLoader;
}

export async function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN?.trim();
  if (import.meta.env.DEV || !dsn) {
    return;
  }

  const Sentry = await loadSentry();

  Sentry.init({
    dsn,
    sendDefaultPii: false,
    integrations: [
      Sentry.browserTracingIntegration(),
    ],
    // Performance Monitoring
    tracesSampleRate: 0.1,
    // Session replay is intentionally disabled because Nutrio displays health,
    // blood-work, location, and payment information.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    // Environment
    environment: import.meta.env.MODE,
    // Release version
    release: import.meta.env.VITE_APP_VERSION || "1.0.0",
    // Before sending, filter out PII
    beforeSend(event) {
      if (event.user) {
        delete event.user.email;
        delete event.user.ip_address;
      }
      if (event.request) {
        delete event.request.cookies;
        delete event.request.data;
        delete event.request.query_string;
        event.request.url = sanitizeTelemetryUrl(event.request.url);
        if (event.request.headers) {
          delete event.request.headers.Authorization;
          delete event.request.headers.authorization;
          delete event.request.headers.Cookie;
          delete event.request.headers.cookie;
        }
      }
      return sanitizeTelemetryValue(event) as typeof event;
    },
    beforeSendTransaction(event) {
      if (event.request) {
        delete event.request.data;
        delete event.request.query_string;
        event.request.url = sanitizeTelemetryUrl(event.request.url);
      }
      return sanitizeTelemetryValue(event) as typeof event;
    },
  });
}

export function captureError(error: Error, context?: Record<string, unknown>) {
  if (import.meta.env.DEV) {
    console.error("Error captured:", error, context);
    return;
  }

  void loadSentry().then((Sentry) => {
    Sentry.captureException(error, {
      extra: sanitizeTelemetryValue(context) as Record<string, unknown>,
    });
  });
}

export function captureMessage(
  message: string,
  level: import("@sentry/react").SeverityLevel = "info",
) {
  if (import.meta.env.DEV) {
    return;
  }

  void loadSentry().then((Sentry) => {
    Sentry.captureMessage(message, level);
  });
}

export function setUserContext(userId: string, _email?: string) {
  if (import.meta.env.DEV) return;

  void loadSentry().then((Sentry) => {
    Sentry.setUser({
      id: userId,
    });
  });
}

export function clearUserContext() {
  if (import.meta.env.DEV) return;

  void loadSentry().then((Sentry) => {
    Sentry.setUser(null);
  });
}
