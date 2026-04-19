import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { checkIPLocation } from "@/lib/ipCheck";
import { Capacitor } from "@capacitor/core";
import { pushNotificationService } from "@/lib/notifications/push";
import { clearRoleCache } from "@/components/ProtectedRoute";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: Error | null }>;
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

  useEffect(() => {
    let isMounted = true;
    let authResolved = false;
    let safetyTimeout: ReturnType<typeof setTimeout> | null = null;

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!isMounted) return;
        authResolved = true;
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Initialize push notifications when user signs in on native platform
        if (session?.user && Capacitor.isNativePlatform()) {
          pushNotificationService.initialize().catch((err) =>
            console.error("Failed to initialize push notifications:", err)
          );
        }
      }
    );

    // THEN check for existing session — with error handling so loading is
    // always resolved even if Supabase is unreachable or keys are missing.
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (!isMounted) return;
        authResolved = true;
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('[AuthContext] getSession failed:', err);
        authResolved = true;
        setLoading(false);
      });

    // Safety timeout: force-clear loading if auth check takes too long
    // Only nullify user/session if auth never resolved (Supabase unreachable)
    // Uses authResolved ref instead of stale `loading` closure to avoid
    // clearing a valid session that was set by onAuthStateChange
    safetyTimeout = setTimeout(() => {
      if (isMounted && !authResolved) {
        console.warn('[AuthContext] Auth check timed out after 30s — clearing auth state');
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
      const redirectUrl = `${appUrl}/dashboard`;
      
      const { error } = await supabase.auth.signUp({
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
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

const signIn = async (email: string, password: string) => {
    try {
      // Check IP location before login (optional, don't block if check fails)
      try {
        const ipCheck = await checkIPLocation();
        
        if (!ipCheck.allowed && ipCheck.blocked) {
          // Only block if explicitly blocked
          return { error: new Error("Your IP address has been blocked.") };
        }
      } catch (ipError) {
        // If IP check fails, log but don't block login
        console.warn("IP location check failed, allowing login:", ipError);
      }

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = useCallback(async () => {
    localStorage.removeItem("remembered_email");
    clearRoleCache();
    await supabase.auth.signOut();
  }, []);

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
