import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Capacitor } from "@capacitor/core";

interface NativeRouteRedirectProps {
  children: React.ReactNode;
}

/**
 * Detects whether the app is running inside a Capacitor native container.
 *
 * We evaluate this at call-time (not at module-load time) so we always get
 * the up-to-date value from the Capacitor bridge, even if the bridge is
 * initialised slightly after the first module evaluation.
 *
 * Fallback: On Android with androidScheme:'https' the origin is always
 * "https://localhost" (no port). That URL never appears in production web
 * deployments, so we use it as a secondary native indicator.
 */
function detectNative(): boolean {
  if (Capacitor.isNativePlatform()) return true;
  // Fallback for edge-cases where the bridge initialises slightly late
  if (
    typeof window !== "undefined" &&
    window.location.hostname === "localhost" &&
    window.location.protocol === "https:" &&
    !window.location.port
  ) {
    return true;
  }
  return false;
}

/**
 * Component that handles routing for native vs web platforms.
 * On native (APK), redirects to auth or dashboard instead of showing landing page.
 * On web, shows the landing page normally.
 */
export const NativeRouteRedirect = ({ children }: NativeRouteRedirectProps) => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  // Re-evaluate on every render so we don't get a stale value from module load
  const isNativePlatform = detectNative();

  useEffect(() => {
    if (!isNativePlatform) return;
    if (loading) return;

    if (user) {
      navigate("/dashboard", { replace: true });
    } else {
      navigate("/walkthrough", { replace: true });
    }
  }, [isNativePlatform, loading, user, navigate]);

  // On native, render nothing while the redirect is in-flight
  // (splash screen covers the blank frame)
  if (isNativePlatform) {
    return null;
  }

  return <>{children}</>;
};
