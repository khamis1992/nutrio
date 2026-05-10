import * as Sentry from "@sentry/react";

export function initSentry() {
  if (import.meta.env.DEV) {
    console.log("Sentry disabled in development");
    return;
  }

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
      // Filter out sensitive user data
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
  
  Sentry.captureException(error, {
    extra: context,
  });
}

export function captureMessage(message: string, level: Sentry.SeverityLevel = "info") {
  if (import.meta.env.DEV) {
    console.log(`[${level}]`, message);
    return;
  }
  
  Sentry.captureMessage(message, level);
}

export function setUserContext(userId: string, email?: string) {
  if (import.meta.env.DEV) return;
  
  Sentry.setUser({
    id: userId,
    email: email ? `${userId}@user.local` : undefined, // Hash email for privacy
  });
}

export function clearUserContext() {
  if (import.meta.env.DEV) return;
  
  Sentry.setUser(null);
}
