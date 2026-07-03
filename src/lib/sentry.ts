type SentryModule = typeof import("@sentry/react");

let sentryLoader: Promise<SentryModule> | null = null;

function loadSentry() {
  sentryLoader ??= import("@sentry/react");
  return sentryLoader;
}

export async function initSentry() {
  if (import.meta.env.DEV) {
    return;
  }

  const Sentry = await loadSentry();

  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],
    // Performance Monitoring
    tracesSampleRate: 1.0,
    // Session Replay
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
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
      return event;
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
      extra: context,
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

export function setUserContext(userId: string, email?: string) {
  if (import.meta.env.DEV) return;

  void loadSentry().then((Sentry) => {
    Sentry.setUser({
      id: userId,
      email: email ? `${userId}@user.local` : undefined,
    });
  });
}

export function clearUserContext() {
  if (import.meta.env.DEV) return;

  void loadSentry().then((Sentry) => {
    Sentry.setUser(null);
  });
}
