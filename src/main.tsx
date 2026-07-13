/* eslint-disable react-refresh/only-export-components */
import { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initializeNativeApp } from "./lib/capacitor";
import { initSentry } from "./lib/sentry";
import { initPostHog } from "./lib/analytics";
import { SentryErrorBoundary } from "./components/SentryErrorBoundary";
import DevelopmentErrorBoundary from "./components/DevelopmentErrorBoundary";
import { SplashVideo } from "./components/SplashVideo";
import { LanguageProvider } from "./contexts/LanguageContext";
import { ThemeProvider } from "./contexts/ThemeContext";

// Initialize monitoring and analytics after first paint
// Deferred from module level to avoid blocking TTFB/TTI
let monitoringInitialized = false;
function initMonitoring() {
  if (monitoringInitialized) return;
  monitoringInitialized = true;
  initSentry();
  initPostHog();
}

// NOTE: initializeNativeApp() is now called inside the Root component
// via useEffect to ensure it runs AFTER React has rendered, not before.
// This prevents the blank screen caused by the splash hiding before the
// WebView has painted its first frame.

const Root = () => {
  const isDevelopment = import.meta.env.DEV;
  // Always show app immediately - splash video can cause blank screen issues on some devices
  // The video will still play but won't block app rendering
  const [splashDone, setSplashDone] = useState(true);

  // Initialize Capacitor native features AFTER React has rendered its first frame.
  // This ensures the WebView has painted before the native splash screen hides,
  // preventing the blank white screen on app launch.
  useEffect(() => {
    initializeNativeApp();
    // Defer monitoring init until after first paint for faster TTFB
    requestAnimationFrame(() => initMonitoring());
  }, []);

  const AppWrapper = (
    <LanguageProvider>
      <ThemeProvider>
        <SentryErrorBoundary>
          {isDevelopment ? (
            <DevelopmentErrorBoundary>
              <App />
            </DevelopmentErrorBoundary>
          ) : (
            <App />
          )}
        </SentryErrorBoundary>
      </ThemeProvider>
    </LanguageProvider>
  );

  return (
    <>
      {!splashDone && <SplashVideo onComplete={() => setSplashDone(true)} />}
      {splashDone && AppWrapper}
    </>
  );
};

createRoot(document.getElementById("root")!).render(<Root />);
