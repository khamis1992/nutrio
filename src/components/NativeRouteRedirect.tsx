import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { isNative } from "@/lib/capacitor";

interface NativeRouteRedirectProps {
  children: React.ReactNode;
}

/**
 * Component that handles routing for native vs web platforms.
 * On native (APK), redirects to auth or dashboard instead of showing landing page.
 * On web, shows the landing page normally.
 */
export const NativeRouteRedirect = ({ children }: NativeRouteRedirectProps) => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    // Only redirect on native platforms
    if (isNative) {
      // Wait for auth state to load
      if (!loading) {
        // If user is logged in, go to dashboard
        if (user) {
          navigate("/dashboard", { replace: true });
        } else {
          // If not logged in, go to auth
          navigate("/auth", { replace: true });
        }
      }
    }
  }, [isNative, loading, user, navigate]);

  // On native, show nothing while redirecting (splash screen is still visible)
  if (isNative) {
    return null;
  }

  // On web, show the landing page
  return <>{children}</>;
};
