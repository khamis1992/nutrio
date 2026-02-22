import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initializeNativeApp } from "./lib/capacitor";
import { initSentry } from "./lib/sentry";
import { initPostHog } from "./lib/analytics";
import { SentryErrorBoundary } from "./components/SentryErrorBoundary";
import DevelopmentErrorBoundary from "./components/DevelopmentErrorBoundary";

// Initialize monitoring and analytics
initSentry();
initPostHog();

// Initialize Capacitor native features
initializeNativeApp();

const Root = () => {
  // In development, use DevelopmentErrorBoundary to catch HMR errors
  // In production, just use SentryErrorBoundary
  const isDevelopment = import.meta.env.DEV;
  
  return (
    <React.StrictMode>
      <SentryErrorBoundary>
        {isDevelopment ? (
          <DevelopmentErrorBoundary>
            <App />
          </DevelopmentErrorBoundary>
        ) : (
          <App />
        )}
      </SentryErrorBoundary>
    </React.StrictMode>
  );
};

createRoot(document.getElementById("root")!).render(<Root />);