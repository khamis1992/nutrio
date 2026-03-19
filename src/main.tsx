import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initializeNativeApp, isNative } from "./lib/capacitor";
import { initSentry } from "./lib/sentry";
import { initPostHog } from "./lib/analytics";
import { SentryErrorBoundary } from "./components/SentryErrorBoundary";
import DevelopmentErrorBoundary from "./components/DevelopmentErrorBoundary";
import { SplashVideo } from "./components/SplashVideo";
import { LanguageProvider } from "./contexts/LanguageContext";

// Initialize monitoring and analytics
initSentry();
initPostHog();

// Initialize Capacitor native features
initializeNativeApp();

const Root = () => {
  const isDevelopment = import.meta.env.DEV;
  // Always show app immediately - splash video can cause blank screen issues on some devices
  // The video will still play but won't block app rendering
  const [splashDone, setSplashDone] = useState(true);

  const AppWrapper = (
    <LanguageProvider>
      <SentryErrorBoundary>
        {isDevelopment ? (
          <DevelopmentErrorBoundary>
            <App />
          </DevelopmentErrorBoundary>
        ) : (
          <App />
        )}
      </SentryErrorBoundary>
    </LanguageProvider>
  );

  return (
    <>
      {!splashDone && (
        <SplashVideo onComplete={() => setSplashDone(true)} />
      )}
      {splashDone && AppWrapper}
    </>
  );
};

createRoot(document.getElementById("root")!).render(<Root />);
