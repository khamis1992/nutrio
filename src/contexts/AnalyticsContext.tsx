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
} from "@/lib/analytics";

interface AnalyticsContextType {
  trackEvent: (eventName: string, properties?: Record<string, any>) => void;
  trackPageView: (pageName: string, properties?: Record<string, any>) => void;
  identifyUser: (userId: string, traits?: Record<string, any>) => void;
  resetUser: () => void;
}

const AnalyticsContext = createContext<AnalyticsContextType | undefined>(undefined);

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    initPostHog();
  }, []);

  const value: AnalyticsContextType = {
    trackEvent,
    trackPageView,
    identifyUser,
    resetUser,
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
export function usePageTracking(pageName: string, properties?: Record<string, any>) {
  useEffect(() => {
    trackPageView(pageName, properties);
  }, [pageName, properties]);
}

export {
  AnalyticsEvents,
  trackUserSignedUp,
  trackUserLoggedIn,
};
