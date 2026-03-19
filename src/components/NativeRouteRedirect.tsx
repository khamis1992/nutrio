import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Capacitor } from "@capacitor/core";
import { Loader2 } from "lucide-react";

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
 *
 * FIX: Instead of returning null (which causes a blank white screen), we now
 * render a full-screen loading indicator while auth state is being resolved.
 * This prevents the blank page that users see when the app first launches.
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

  // On native platform: show a loading spinner while auth state resolves,
  // then the useEffect above will navigate away. This prevents the blank screen.
  if (isNativePlatform) {
    if (loading) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-white gap-3">
          <img
            src="/logo.png"
            alt="Nutrio"
            className="h-14 w-auto object-contain opacity-90"
          />
          <Loader2 className="w-7 h-7 animate-spin text-primary" />
        </div>
      );
    }
    // Auth resolved — redirect is in-flight via useEffect, show nothing briefly
    return null;
  }

  return <>{children}</>;
};
