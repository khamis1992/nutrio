/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, ReactNode } from "react";
import {
  initPostHog,
  identifyUser,
  resetUser,
  trackEvent,
  trackPageView,
  AnalyticsEvents,
  trackUserSignedUp,
  trackUserLoggedIn,
  trackScrollDepthStart,
  installRageClickDetector,
  trackWidgetView,
  trackWidgetInteract,
  trackWidgetDismiss,
  trackFunnelStep,
  isFeatureEnabled,
  getFeatureFlagPayload,
  getExperimentVariant,
} from "@/lib/analytics";

interface AnalyticsContextType {
  trackEvent: (eventName: string, properties?: Record<string, unknown>) => void;
  trackPageView: (pageName: string, properties?: Record<string, unknown>) => void;
  identifyUser: (userId: string, traits?: Record<string, unknown>) => void;
  resetUser: () => void;
  trackWidgetView: (widgetName: string, properties?: Record<string, unknown>) => void;
  trackWidgetInteract: (widgetName: string, action: string, properties?: Record<string, unknown>) => void;
  trackWidgetDismiss: (widgetName: string, properties?: Record<string, unknown>) => void;
  trackFunnelStep: (funnelName: string, step: number, stepName: string, properties?: Record<string, unknown>) => void;
  isFeatureEnabled: (featureKey: string, defaultValue?: boolean) => boolean;
  getFeatureFlagPayload: <T = Record<string, unknown>>(featureKey: string, defaultValue?: T) => T | undefined;
  getExperimentVariant: (experimentKey: string) => string | null;
}

const AnalyticsContext = createContext<AnalyticsContextType | undefined>(undefined);

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    initPostHog();
    const cleanupRage = installRageClickDetector();
    return () => cleanupRage();
  }, []);

  const value: AnalyticsContextType = {
    trackEvent,
    trackPageView,
    identifyUser,
    resetUser,
    trackWidgetView,
    trackWidgetInteract,
    trackWidgetDismiss,
    trackFunnelStep,
    isFeatureEnabled,
    getFeatureFlagPayload,
    getExperimentVariant,
  };

  return (
    <AnalyticsContext.Provider value={value}>
      {children}
    </AnalyticsContext.Provider>
  );
}

export function useAnalytics() {
  const context = useContext(AnalyticsContext);
  if (context === undefined) {
    throw new Error("useAnalytics must be used within an AnalyticsProvider");
  }
  return context;
}

// Hook for tracking page views
export function usePageTracking(pageName: string, properties?: Record<string, unknown>) {
  useEffect(() => {
    trackPageView(pageName, properties);
  }, [pageName, properties]);
}

export {
  AnalyticsEvents,
  trackUserSignedUp,
  trackUserLoggedIn,
};
