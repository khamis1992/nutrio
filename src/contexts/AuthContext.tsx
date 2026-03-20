import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { checkIPLocation } from "@/lib/ipCheck";
import { Capacitor } from "@capacitor/core";
import { pushNotificationService } from "@/lib/notifications/push";

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
// Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
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
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      })
      .catch((err) => {
        console.error('[AuthContext] getSession failed:', err);
        // Ensure loading is cleared even on failure so the app doesn't hang
        setLoading(false);
      });

    // Safety timeout: if neither getSession nor onAuthStateChange fires within
    // 8 seconds (e.g. network unreachable), force loading to false so the
    // app can still render the login screen instead of a blank page.
    const safetyTimeout = setTimeout(() => {
      console.warn('[AuthContext] Auth loading timeout — forcing loading=false');
      setLoading(false);
    }, 8000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(safetyTimeout);
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

  const signOut = async () => {
    // Clear remembered email on logout
    localStorage.removeItem("remembered_email");
    await supabase.auth.signOut();
  };

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
