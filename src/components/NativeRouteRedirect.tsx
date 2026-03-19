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
 * KEY FIX: On native, we ALWAYS render a full-screen loading indicator.
 * We never return null — returning null causes a blank white screen.
 * The useEffect navigates away once auth state resolves, at which point
 * this component is unmounted and the target route renders instead.
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

  // On native platform: ALWAYS render the loading screen.
  // - While loading=true: show spinner (auth resolving)
  // - After loading=false: keep showing logo (navigate() is in-flight,
  //   the component will unmount as soon as the new route renders)
  // This ensures there is NEVER a blank/white frame on the screen.
  if (isNativePlatform) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white gap-3">
        <img
          src="/logo.png"
          alt="Nutrio"
          className="h-14 w-auto object-contain opacity-90"
        />
        {loading && <Loader2 className="w-7 h-7 animate-spin text-primary" />}
      </div>
    );
  }

  return <>{children}</>;
};
