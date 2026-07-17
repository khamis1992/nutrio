import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { checkIPLocation } from "@/lib/ipCheck";
import { recordPartnerEvent, recordPartnerReferralStatus } from "@/lib/partnerTracking";
import { useLanguage } from "@/contexts/LanguageContext";
import { SignInFormValues, SignUpFormValues } from "./validation";

export type AuthView = "welcome" | "signin" | "signup" | "forgot";

type StoredPartnerReferral = {
  source?: string;
  campaign?: string;
  code?: string;
  visited_at?: string;
  sporthub_user?: string | null;
};

export const useAuthPage = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signIn, signUp, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [view, setView] = useState<AuthView>("welcome");
  const [email, setEmail] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingRole, setCheckingRole] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotError, setForgotError] = useState("");
  const postSignupOnboardingKey = "nutrio_post_signup_onboarding";

  const switchView = (newView: AuthView) => {
    const rememberedEmail = localStorage.getItem("remembered_email");
    setEmail(rememberedEmail || "");
    setView(newView);
  };

  const recordPendingPartnerReferral = useCallback(async (userId: string) => {
    const rawReferral = localStorage.getItem("nutrio:partner-referral");
    if (!rawReferral) return;

    try {
      const referral = JSON.parse(rawReferral) as StoredPartnerReferral;
      if (referral.source !== "sporthub") return;

      const processedKey = `nutrio:partner-referral-processed:${userId}:${referral.source}`;
      if (localStorage.getItem(processedKey) === "true") return;

      const referralRecorded = await recordPartnerReferralStatus({
        userId,
        sourceApp: "sporthub",
        targetApp: "nutrio",
        campaign: referral.campaign || "sporthub_partner",
        referralCode: referral.code || "SPORTHUB15",
        status: "signed_up",
        metadata: {
          visited_at: referral.visited_at,
          sporthub_user: referral.sporthub_user,
        },
      });
      const eventRecorded = await recordPartnerEvent({
        userId,
        partner: "sporthub",
        campaign: referral.campaign || "sporthub_partner",
        eventType: "sporthub_referral_signed_up",
        referralCode: referral.code || "SPORTHUB15",
        metadata: {
          direction: "sporthub_to_nutrio",
          visited_at: referral.visited_at,
          sporthub_user: referral.sporthub_user,
        },
      });

      if (referralRecorded && eventRecorded) {
        localStorage.setItem(processedKey, "true");
        localStorage.removeItem("nutrio:partner-referral");
      }
    } catch (error) {
      console.error("Failed to process stored partner referral:", error);
    }
  }, []);

  useEffect(() => {
    const savedEmail = localStorage.getItem("remembered_email");
    if (savedEmail) { setEmail(savedEmail); setRememberMe(true); }
  }, []);

  useEffect(() => {
    const checkUserRole = async () => {
      if (!user) return;
      setCheckingRole(true);
      const raceWithTimeout = <T,>(
        query: () => PromiseLike<{ data: T | null; error: unknown }>,
      ): Promise<{ data: T | null }> => {
        return Promise.race([
          Promise.resolve(query()).then(r => {
            if (r.error) return { data: null };
            return r;
          }).catch(() => ({ data: null })),
          new Promise<{ data: null }>((resolve) => setTimeout(() => resolve({ data: null }), 5000)),
        ]);
      };
      try {
        await recordPendingPartnerReferral(user.id);

        if (sessionStorage.getItem(postSignupOnboardingKey) === "true") {
          sessionStorage.removeItem(postSignupOnboardingKey);
          navigate("/onboarding", { replace: true });
          setCheckingRole(false);
          return;
        }

        const adminRole = await raceWithTimeout(() =>
          supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle()
        );
        if (adminRole?.data) {
          navigate("/admin", { replace: true }); setCheckingRole(false); return;
        }
        const staffRole = await raceWithTimeout(() =>
          supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "staff").maybeSingle()
        );
        if (staffRole?.data) {
          navigate("/admin", { replace: true }); setCheckingRole(false); return;
        }
        const fleetManager = await raceWithTimeout(() =>
          supabase.from("fleet_managers").select("id, role").eq("auth_user_id", user.id).eq("is_active", true).maybeSingle()
        );
        if (fleetManager?.data) {
          navigate("/fleet", { replace: true }); setCheckingRole(false); return;
        }
        const { data: driver } = await supabase.from("drivers").select("id, approval_status").eq("user_id", user.id).maybeSingle();
        if (driver) {
          navigate(driver.approval_status === "approved" ? "/driver" : "/driver/onboarding", { replace: true });
          setCheckingRole(false); return;
        }
        const { data: restaurant } = await supabase.from("restaurants").select("id, approval_status").eq("owner_id", user.id).maybeSingle();
        if (restaurant) {
          navigate(restaurant.approval_status === "approved" ? "/partner" : "/partner/pending-approval", { replace: true });
          setCheckingRole(false); return;
        }
        const coachRole = await raceWithTimeout(() =>
          supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "coach").maybeSingle()
        );
        if (coachRole?.data) {
          navigate("/coach", { replace: true }); setCheckingRole(false); return;
        }
        const from = (location.state as { from?: Location })?.from?.pathname || "/dashboard";
        navigate(from, { replace: true });
      } catch {
        navigate("/dashboard", { replace: true });
      } finally {
        setCheckingRole(false);
      }
    };
    checkUserRole();
  }, [user, navigate, location, recordPendingPartnerReferral]);

  const handleSignIn = async (values: SignInFormValues) => {
    setLoading(true);
    try {
      // Set the remember-me flag BEFORE calling signIn() so the Supabase
      // webSmartStorage adapter routes the session token to localStorage
      // (persistent across browser restarts) instead of sessionStorage
      // (cleared when the browser closes). Without this, the session is
      // always written to sessionStorage regardless of the checkbox state.
      if (rememberMe) {
        localStorage.setItem("nutrio_remember_me", "true");
      } else {
        localStorage.removeItem("nutrio_remember_me");
      }

      const { error } = await signIn(values.email, values.password);
      if (error) {
        if (!rememberMe) localStorage.removeItem("nutrio_remember_me");
        toast({ title: t("signin_failed"), description: error.message.includes("Invalid login credentials") ? t("invalid_credentials") : error.message, variant: "destructive" });
      } else {
        if (rememberMe) {
          localStorage.setItem("remembered_email", values.email);
        } else {
          localStorage.removeItem("remembered_email");
        }
        toast({ title: t("welcome_back"), description: t("sign_in_success") });
      }
    } catch {
      if (!rememberMe) localStorage.removeItem("nutrio_remember_me");
      toast({ title: t("error"), description: t("unexpected_error"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (values: SignUpFormValues) => {
    setLoading(true);
    try {
      const ipCheck = await checkIPLocation();
      if (!ipCheck.allowed) {
        toast({ title: t("signup_blocked"), description: ipCheck.blocked ? t("ip_blocked") : (ipCheck.reason || t("signup_qatar_only")), variant: "destructive" });
        return;
      }
      sessionStorage.setItem(postSignupOnboardingKey, "true");
      const { error, session } = await signUp(values.email, values.password, values.name);
      if (error) {
        sessionStorage.removeItem(postSignupOnboardingKey);
        toast({ title: t("signup_failed"), description: error.message.includes("User already registered") ? t("email_exists") : error.message, variant: "destructive" });
      } else if (!session) {
        sessionStorage.removeItem(postSignupOnboardingKey);
        toast({ title: t("account_created"), description: t("check_email_confirm_account") });
        setView("signin");
      } else {
        toast({ title: t("account_created"), description: t("welcome_setup_profile") });
        navigate("/onboarding", { replace: true });
      }
    } catch {
      toast({ title: t("error"), description: t("unexpected_error"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError("");
    try {
      const emailSchema = z.string().email();
      emailSchema.parse(forgotEmail);
    } catch (err) {
      if (err instanceof z.ZodError) { setForgotError(err.errors[0].message); return; }
    }
    setForgotLoading(true);
    try {
      const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${appUrl}/reset-password`,
      });
      if (error) throw error;
      setForgotSent(true);
    } catch (err) {
      toast({ title: t("error"), description: err instanceof Error ? err.message : t("failed_send_reset"), variant: "destructive" });
    } finally {
      setForgotLoading(false);
    }
  };

  return {
    t,
    view,
    setView: switchView,
    email,
    setEmail,
    agreedToTerms,
    setAgreedToTerms,
    loading,
    setLoading,
    checkingRole,
    rememberMe,
    setRememberMe,
    forgotEmail,
    setForgotEmail,
    forgotLoading,
    forgotSent,
    setForgotSent,
    forgotError,
    setForgotError,
    authLoading,
    handleSignIn,
    handleSignUp,
    handleForgotSubmit,
  };
};
