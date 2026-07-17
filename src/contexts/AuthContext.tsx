/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  ReactNode,
} from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { checkIPLocation, logUserIP } from "@/lib/ipCheck";
import { Capacitor } from "@capacitor/core";
import { pushNotificationService } from "@/lib/notifications/push";
import { clearRoleCache } from "@/components/ProtectedRoute";
import { clearOfflineMutationsForUser } from "@/lib/offline-mutation-queue";
import { clearStepData } from "@/lib/stepStore";
import { clearCachedHealthData } from "@/lib/healthKit";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (
    email: string,
    password: string,
    fullName?: string,
  ) => Promise<{
    error: Error | null;
    user?: User | null;
    session?: Session | null;
  }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const lastUserIdRef = useRef<string | null>(null);
  const lastAccessTokenRef = useRef<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    let authResolved = false;
    let safetyTimeout: ReturnType<typeof setTimeout> | null = null;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      authResolved = true;

      const newUserId = session?.user?.id ?? null;
      const newAccessToken = session?.access_token ?? null;

      // Prevent redundant state updates that trigger cascading re-renders.
      // Supabase can fire onAuthStateChange multiple times during init
      // (INITIAL_SESSION, SIGNED_IN, TOKEN_REFRESHED) with the same user.
      // Only update state when the user identity actually changes.
      if (
        newUserId === lastUserIdRef.current &&
        newAccessToken === lastAccessTokenRef.current &&
        lastUserIdRef.current !== null
      ) {
        // Same user — skip state updates to avoid re-render cascade
        if (loading) setLoading(false);
        return;
      }

      lastUserIdRef.current = newUserId;
      lastAccessTokenRef.current = newAccessToken;
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      if (session?.user && Capacitor.isNativePlatform()) {
        pushNotificationService
          .initialize()
          .catch((err) =>
            console.error("Failed to initialize push notifications:", err),
          );
      }
    });

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (!isMounted) return;
        authResolved = true;
        const newUserId = session?.user?.id ?? null;
        const newAccessToken = session?.access_token ?? null;
        if (
          newUserId === lastUserIdRef.current &&
          newAccessToken === lastAccessTokenRef.current &&
          lastUserIdRef.current !== null
        ) {
          if (loading) setLoading(false);
          return;
        }
        lastUserIdRef.current = newUserId;
        lastAccessTokenRef.current = newAccessToken;
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error("[AuthContext] getSession failed:", err);
        authResolved = true;
        setLoading(false);
      });

    safetyTimeout = setTimeout(() => {
      if (isMounted && !authResolved) {
        console.warn(
          "[AuthContext] Auth check timed out after 10s — clearing auth state",
        );
        setSession(null);
        setUser(null);
        setLoading(false);
      }
    }, 10000);

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      if (safetyTimeout) clearTimeout(safetyTimeout);
    };
  }, []);

  const signUp = async (email: string, password: string, fullName?: string) => {
    try {
      // Use VITE_APP_URL so native APK builds use the real web URL instead of capacitor://localhost
      const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;
      const redirectUrl = `${appUrl}/onboarding`;

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) throw error;
      if (data?.session) void logUserIP("signup", data.session.access_token);
      return {
        error: null,
        user: data?.user ?? null,
        session: data?.session ?? null,
      };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const ipCheck = await checkIPLocation();
      if (!ipCheck.allowed) {
        return {
          error: new Error(
            ipCheck.blocked
              ? "Your IP address has been blocked."
              : ipCheck.reason || "Unable to verify your location.",
          ),
        };
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      void logUserIP("login", data.session?.access_token);
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = useCallback(async () => {
    const signingOutUserId = user?.id ?? null;
    if (signingOutUserId) {
      await pushNotificationService.deactivateForUser(signingOutUserId);
    }
    try {
      // remembered_email intentionally survives sign-out so the sign-in form
      // stays pre-filled — clearing it here is what made Remember Me look broken.
      localStorage.removeItem("nutrio_remember_me");
      localStorage.removeItem("nutrio_onboarding_progress");
      localStorage.removeItem("nutrio_onboarding_draft");
      localStorage.removeItem("pending_deep_link");
      if (signingOutUserId) {
        localStorage.removeItem(`nutrio_onboarding_progress:${signingOutUserId}`);
        localStorage.removeItem(`nutrio_onboarding_draft:${signingOutUserId}`);
        clearOfflineMutationsForUser(signingOutUserId);
        clearStepData(signingOutUserId);
        clearCachedHealthData(signingOutUserId);
        for (let index = localStorage.length - 1; index >= 0; index -= 1) {
          const key = localStorage.key(index);
          if (
            key?.startsWith(`tracker_steps_${signingOutUserId}_`) ||
            key?.startsWith(`tracker_steps_session_id_${signingOutUserId}_`)
          ) {
            localStorage.removeItem(key);
          }
        }
      }
      sessionStorage.removeItem("nutrio_session_started_at");
      sessionStorage.removeItem("nutrio_last_activity_at");
    } catch {
      // Sign-out must continue even when browser storage is unavailable.
    }
    clearRoleCache();
    await supabase.auth.signOut();
  }, [user?.id]);

  useEffect(() => {
    if (!user || !session) return;

    const now = Date.now();
    const readTimestamp = (key: string, fallback: number) => {
      try {
        const value = Number(sessionStorage.getItem(key));
        return Number.isFinite(value) && value > 0 ? value : fallback;
      } catch {
        return fallback;
      }
    };
    const persistTimestamp = (key: string, value: number) => {
      try {
        sessionStorage.setItem(key, String(value));
      } catch {
        // In-memory enforcement remains active for this page lifetime.
      }
    };
    const sessionStartedAt = readTimestamp("nutrio_session_started_at", now);
    let lastActivityAt = readTimestamp("nutrio_last_activity_at", now);
    let lastPersistedAt = 0;
    persistTimestamp("nutrio_session_started_at", sessionStartedAt);
    persistTimestamp("nutrio_last_activity_at", lastActivityAt);

    const recordActivity = () => {
      lastActivityAt = Date.now();
      if (lastActivityAt - lastPersistedAt > 30_000) {
        lastPersistedAt = lastActivityAt;
        persistTimestamp("nutrio_last_activity_at", lastActivityAt);
      }
    };

    const isPrivilegedPortal = () =>
      /\/(admin|partner|fleet|coach|driver)(\/|$)/i.test(window.location.pathname);

    // "Remember Me" stores the Supabase session in localStorage (see
    // webSmartStorage in integrations/supabase/client.ts), which for the
    // customer app means "stay signed in until the refresh token expires".
    // The idle/absolute guard below must not silently kill those sessions.
    // Privileged back-office portals always enforce limits — AdminMfaGate
    // additionally strips the flag via restrictWebSessionToCurrentTab().
    const isRememberedSession = () => {
      try {
        return localStorage.getItem("nutrio_remember_me") === "true";
      } catch {
        return false;
      }
    };

    let signingOut = false;
    const enforceSessionLifetime = () => {
      if (signingOut) return;
      const current = Date.now();
      const privileged = isPrivilegedPortal();
      if (!privileged && isRememberedSession()) return;
      const idleLimit = privileged ? 15 * 60_000 : 60 * 60_000;
      const absoluteLimit = privileged ? 8 * 60 * 60_000 : 24 * 60 * 60_000;
      if (
        current - lastActivityAt > idleLimit ||
        current - sessionStartedAt > absoluteLimit
      ) {
        signingOut = true;
        void signOut().catch((error) => {
          signingOut = false;
          console.error("Automatic session sign-out failed:", error);
        });
      }
    };

    const activityEvents: Array<keyof WindowEventMap> = [
      "pointerdown",
      "keydown",
      "touchstart",
      "scroll",
    ];
    activityEvents.forEach((eventName) =>
      window.addEventListener(eventName, recordActivity, { passive: true }),
    );
    window.addEventListener("focus", enforceSessionLifetime);
    document.addEventListener("visibilitychange", enforceSessionLifetime);
    const interval = window.setInterval(enforceSessionLifetime, 30_000);

    return () => {
      activityEvents.forEach((eventName) =>
        window.removeEventListener(eventName, recordActivity),
      );
      window.removeEventListener("focus", enforceSessionLifetime);
      document.removeEventListener("visibilitychange", enforceSessionLifetime);
      window.clearInterval(interval);
    };
  }, [session, signOut, user]);

  const value = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
