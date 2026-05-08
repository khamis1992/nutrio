import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Mail, Lock, ArrowLeft, Eye, EyeOff, Loader2, Fingerprint,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { biometricAuth, isNative } from "@/lib/capacitor";
import { z } from "zod";
import { checkIPLocation } from "@/lib/ipCheck";
import { useLanguage } from "@/contexts/LanguageContext";
import { motion } from "framer-motion";

type AuthView = "welcome" | "signin" | "signup" | "forgot" | "otp";

// Module-level schemas (reused across handlers)
const emailSchema = z.string().email();

const Auth = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signIn, signUp, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [view, setView] = useState<AuthView>("welcome");
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingRole, setCheckingRole] = useState(false);

  const switchView = (newView: AuthView) => {
    const rememberedEmail = localStorage.getItem("remembered_email");
    setEmail(rememberedEmail || "");
    setPassword("");
    setErrors({});
    setShowPassword(false);
    setView(newView);
  };
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState("");
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [enableBiometric, setEnableBiometric] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotError, setForgotError] = useState("");
  const [otpDigits, setOtpDigits] = useState(["", "", "", ""]);
  const [otpCountdown, setOtpCountdown] = useState(60);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState("");
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoTriggered = useRef(false);

  useEffect(() => {
    const savedEmail = localStorage.getItem("remembered_email");
    if (savedEmail) { setEmail(savedEmail); setRememberMe(true); }
  }, []);

  useEffect(() => {
    const checkBiometric = async () => {
      if (!isNative) return;
      const available = await biometricAuth.isAvailable();
      if (!available) return;

      setBiometricAvailable(true);
      setBiometricType(await biometricAuth.getBiometricType());
      const hasCredentials = await biometricAuth.hasCredentials();
      setEnableBiometric(hasCredentials);

      // Auto-trigger biometric login if credentials are saved and we haven't done it yet
      if (hasCredentials && !autoTriggered.current) {
        autoTriggered.current = true;
        switchView("signin");
        // Small delay so the signin view renders before the native prompt appears
        setTimeout(() => {
          handleBiometricLogin();
        }, 600);
      }
    };
    checkBiometric();
  }, []);

  useEffect(() => {
    const checkUserRole = async () => {
      if (!user) return;
      setCheckingRole(true);

      // Race a query against a 5s timeout — prevents hanging when tables don't exist
      const raceWithTimeout = (query: () => Promise<any>): Promise<any> => {
        return Promise.race([
          query().then(r => {
            if (r.error) return { data: null };
            return r;
          }).catch(() => ({ data: null })),
          new Promise<any>((resolve) => setTimeout(() => resolve({ data: null }), 5000)),
        ]);
      };

      try {
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

        // Driver (drivers table should exist — no timeout needed)
        const { data: driver } = await supabase.from("drivers").select("id, approval_status").eq("user_id", user.id).maybeSingle();
        if (driver) {
          navigate(driver.approval_status === "approved" ? "/driver" : "/driver/onboarding", { replace: true });
          setCheckingRole(false); return;
        }

        // Restaurant partner (restaurants table should exist — no timeout needed)
        const { data: restaurant } = await supabase.from("restaurants").select("id, approval_status").eq("owner_id", user.id).maybeSingle();
        if (restaurant) {
          navigate(restaurant.approval_status === "approved" ? "/partner" : "/partner/pending-approval", { replace: true });
          setCheckingRole(false); return;
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
  }, [user, navigate, location]);

  const validateForm = () => {
    const newErrors: { email?: string; password?: string } = {};
    const localEmailSchema = z.string().email(t("invalid_email"));
    const passwordSchema = z.string().min(8, t("password_min_chars"));
    
    try { localEmailSchema.parse(email); } catch (err) { if (err instanceof z.ZodError) newErrors.email = err.errors[0].message; }
    try { passwordSchema.parse(password); } catch (err) { if (err instanceof z.ZodError) newErrors.password = err.errors[0].message; }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };


  const handleBiometricLogin = async () => {
    setBiometricLoading(true);
    try {
      // Step 1: authenticate with biometrics first
      const authenticated = await biometricAuth.authenticate();
      if (!authenticated) {
        toast({ title: t("auth_failed"), description: t("biometric_canceled"), variant: "destructive" });
        return;
      }
      // Step 2: retrieve saved credentials after successful auth
      const credentials = await biometricAuth.getCredentials();
      if (!credentials) {
        toast({ title: t("no_saved_credentials"), description: t("signin_first_desc"), variant: "destructive" });
        setEnableBiometric(false);
        return;
      }
      // Step 3: sign in with stored credentials
      const { error } = await signIn(credentials.username, credentials.password);
      if (error) {
        toast({ title: t("signin_failed"), description: t("invalid_credentials_retry"), variant: "destructive" });
        await biometricAuth.deleteCredentials();
        setEnableBiometric(false);
      } else {
        toast({ title: t("welcome_back"), description: `${t("signed_in_with")} ${biometricType}.` });
      }
    } catch {
      toast({ title: t("biometric_error"), description: t("biometric_error_desc"), variant: "destructive" });
    } finally {
      setBiometricLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setLoading(true);
    try {
      if (view === "signin") {
        const { error } = await signIn(email, password);
        if (error) {
          toast({ title: t("signin_failed"), description: error.message.includes("Invalid login credentials") ? t("invalid_credentials") : error.message, variant: "destructive" });
        } else {
          if (enableBiometric) await biometricAuth.setCredentials(email, password);
          if (rememberMe) localStorage.setItem("remembered_email", email);
          else localStorage.removeItem("remembered_email");
          toast({ title: t("welcome_back"), description: t("sign_in_success") });
        }
      } else {
        const ipCheck = await checkIPLocation();
        if (!ipCheck.allowed) {
          toast({ title: t("signup_blocked"), description: ipCheck.blocked ? t("ip_blocked") : (ipCheck.reason || t("signup_qatar_only")), variant: "destructive" });
          return;
        }
        const { error } = await signUp(email, password, name);
        if (error) {
          toast({ title: t("signup_failed"), description: error.message.includes("User already registered") ? t("email_exists") : error.message, variant: "destructive" });
        } else {
          toast({ title: t("account_created"), description: t("welcome_setup_profile") });
          navigate("/onboarding");
        }
      }
    } catch {
      toast({ title: t("error"), description: t("unexpected_error"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const startOtpCountdown = useCallback(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setOtpCountdown(60);
    countdownRef.current = setInterval(() => {
      setOtpCountdown((prev) => {
        if (prev <= 1) { clearInterval(countdownRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError("");
    try {
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
      setOtpDigits(["", "", "", ""]);
      setOtpError("");
      startOtpCountdown();
      setView("otp");
    } catch (err: any) {
      toast({ title: t("error"), description: err.message || t("failed_send_reset"), variant: "destructive" });
    } finally {
      setForgotLoading(false);
    }
  };

  const handleOtpKey = (key: string) => {
    setOtpError("");
    setOtpDigits((prev) => {
      const next = [...prev];
      if (key === "back") {
        const idx = next.map((d) => d !== "").lastIndexOf(true);
        if (idx >= 0) next[idx] = "";
      } else {
        const idx = next.indexOf("");
        if (idx >= 0) next[idx] = key;
      }
      return next;
    });
  };

  const handleOtpVerify = async () => {
    const code = otpDigits.join("");
    if (code.length < 4) { setOtpError(t("enter_4_digits")); return; }
    setOtpLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: forgotEmail,
        token: code,
        type: "recovery",
      });
      if (error) throw error;
      toast({ title: t("verified"), description: t("can_reset_password") });
      navigate("/reset-password");
    } catch (err: any) {
      setOtpError(t("invalid_code"));
      setOtpDigits(["", "", "", ""]);
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (otpCountdown > 0) return;
    try {
      const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;
      await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${appUrl}/reset-password`,
      });
      setOtpDigits(["", "", "", ""]);
      setOtpError("");
      startOtpCountdown();
      toast({ title: t("code_resent"), description: t("check_inbox") });
    } catch (err: any) {
      toast({ title: t("error"), description: err.message || t("failed_resend"), variant: "destructive" });
    }
  };

  if (authLoading || checkingRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  /* ── Welcome screen ──────────────────────────────────────────── */
  if (view === "welcome") {
    return (
      <div
        className="fixed inset-0 flex flex-col overflow-hidden"
        style={{ maxWidth: 430, margin: "0 auto", background: "#fff" }}
      >
        {/* ── Hero section ── */}
        <div
          className="relative flex flex-col items-center justify-center overflow-hidden flex-1"
          style={{
            background: "linear-gradient(135deg, hsl(142, 71%, 45%) 0%, hsl(168, 76%, 42%) 100%)",
            paddingBottom: "2rem",
          }}
        >
          {/* Decorative circles */}
          <motion.div 
            animate={{ 
              scale: [1, 1.1, 1],
              x: [0, 10, 0],
              y: [0, 15, 0]
            }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            style={{ position: "absolute", top: -60, right: -60, width: 220, height: 220, borderRadius: "50%", background: "rgba(255,255,255,0.08)", pointerEvents: "none" }} 
          />
          <motion.div 
            animate={{ 
              scale: [1, 1.15, 1],
              x: [0, -15, 0],
              y: [0, -10, 0]
            }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            style={{ position: "absolute", bottom: -30, left: -40, width: 160, height: 160, borderRadius: "50%", background: "rgba(255,255,255,0.06)", pointerEvents: "none" }} 
          />
          <motion.div 
            animate={{ 
              scale: [1, 1.2, 1],
              x: [0, 20, 0],
              y: [0, 20, 0]
            }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 2 }}
            style={{ position: "absolute", top: 40, left: 20, width: 80, height: 80, borderRadius: "50%", background: "rgba(255,255,255,0.05)", pointerEvents: "none" }} 
          />

          {/* Logo */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="flex items-center justify-center mb-8"
            style={{
              width: 96, height: 96, borderRadius: 28,
              background: "#ffffff",
              boxShadow: "0 12px 40px rgba(0,0,0,0.15)",
            }}
          >
            <Logo size="md" />
          </motion.div>

          {/* Hero text */}
          <motion.h1 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
            style={{ fontSize: 36, fontWeight: 800, color: "#fff", textAlign: "center", lineHeight: 1.15, marginBottom: 12, letterSpacing: -0.5, padding: "0 24px" }}
          >
            {t("eat_smart")}<br />{t("live_better")}
          </motion.h1>
          <motion.p 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
            style={{ fontSize: 16, color: "rgba(255,255,255,0.85)", textAlign: "center", lineHeight: 1.5, padding: "0 32px" }}
          >
            {t("personalized_nutrition_tagline")}
          </motion.p>
        </div>

        {/* ── Bottom card ── */}
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 200, delay: 0.1 }}
          className="flex flex-col"
          style={{
            background: "#fff",
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
            marginTop: -32,
            zIndex: 10,
            paddingTop: 40,
            paddingLeft: 24,
            paddingRight: 24,
            paddingBottom: "max(32px, env(safe-area-inset-bottom, 32px))",
            boxShadow: "0 -4px 20px rgba(0,0,0,0.05)",
          }}
        >
          {/* Buttons */}
          <div className="flex flex-col gap-3.5">
            <Button
              variant="gradient"
              className="w-full rounded-2xl font-bold shadow-lg shadow-primary/25"
              style={{ height: 56, fontSize: 16 }}
              onClick={() => switchView("signup")}
            >
              {t("create_free_account")}
            </Button>
            <button
              type="button"
              onClick={() => switchView("signin")}
              className="w-full rounded-2xl font-semibold transition-all hover:bg-gray-100 active:scale-[0.98]"
              style={{ height: 56, fontSize: 16, background: "#f8f9fa", border: "1px solid #f1f3f5", cursor: "pointer", color: "#374151" }}
            >
              {t("sign_in")}
            </button>
          </div>

          {/* Footer */}
          <p className="mt-8 text-xs text-gray-400 text-center">
            <Link to="/privacy" className="hover:text-gray-900 transition-colors font-medium">{t("privacy_policy")}</Link>
            <span className="mx-2 text-gray-300">•</span>
            <Link to="/terms" className="hover:text-gray-900 transition-colors font-medium">{t("terms")}</Link>
          </p>
        </motion.div>
      </div>
    );
  }

  /* ── Sign Up (Figma design) ──────────────────────────────────── */
  if (view === "signup") {
    return (
      <div
        className="fixed inset-0 flex flex-col bg-white"
        style={{ maxWidth: 430, margin: "0 auto" }}
      >
        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 pt-6 pb-6">
          {/* Back arrow */}
          <button
            type="button"
            onClick={() => switchView("welcome")}
            className="mb-4 flex items-center justify-center hover:opacity-70 transition-opacity"
          >
            <ArrowLeft className="w-6 h-6 text-gray-800" />
          </button>

          {/* Logo */}
          <div className="flex justify-center mb-4">
            <Logo size="lg" />
          </div>

          {/* Title */}
          <h1 className="text-[22px] font-extrabold text-gray-900 leading-tight mb-1">
            {t("join_nutrio_today")}
          </h1>
          <p className="text-sm text-gray-400 leading-relaxed mb-5">
            {t("create_account_desc")}
          </p>

          {/* Form */}
          <form id="signup-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Email */}
            <div className="space-y-1">
              <Label htmlFor="su-email" className="text-sm font-semibold text-gray-800">{t("email")}</Label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="su-email" type="email" placeholder={t("email")} value={email}
                  onChange={(e) => { setEmail(e.target.value); if (errors.email) setErrors({ ...errors, email: undefined }); }}
                  className={`h-12 pl-11 rounded-2xl border-0 bg-gray-100 text-gray-800 placeholder:text-gray-400 focus-visible:ring-1 focus-visible:ring-primary ${errors.email ? "ring-1 ring-destructive" : ""}`}
                  required disabled={loading}
                />
              </div>
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>

            {/* Password */}
            <div className="space-y-1">
              <Label htmlFor="su-password" className="text-sm font-semibold text-gray-800">{t("password")}</Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="su-password" type={showPassword ? "text" : "password"} placeholder={t("password")} value={password}
                  onChange={(e) => { setPassword(e.target.value); if (errors.password) setErrors({ ...errors, password: undefined }); }}
                  className={`h-12 pl-11 pr-12 rounded-2xl border-0 bg-gray-100 text-gray-800 placeholder:text-gray-400 focus-visible:ring-1 focus-visible:ring-primary ${errors.password ? "ring-1 ring-destructive" : ""}`}
                  required disabled={loading}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors" disabled={loading}>
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
            </div>

            {/* Terms checkbox */}
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <div
                className="mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors"
                style={{ borderColor: agreedToTerms ? "#7DC200" : "#7DC200", background: agreedToTerms ? "#7DC200" : "transparent" }}
                onClick={() => setAgreedToTerms(!agreedToTerms)}
              >
                {agreedToTerms && (
                  <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                    <path d="M1 4L4 7L10 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <span className="text-sm text-gray-600 leading-relaxed">
                {t("i_agree_to_nutrio")}{" "}
                <Link to="/terms" className="font-semibold" style={{ color: "#7DC200" }}>
                  {t("terms")}
                </Link>
                .
              </span>
            </label>

            {/* Already have account */}
            <p className="text-sm text-gray-500 text-center">
              {t("already_have_account")}{" "}
              <button type="button" onClick={() => setView("signin")} className="font-semibold hover:underline" style={{ color: "#7DC200" }} disabled={loading}>
                {t("sign_in")}
              </button>
            </p>
          </form>
        </div>

        {/* Fixed bottom Sign up button */}
        <div className="px-6 pt-3 bg-white border-t border-gray-100" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
          <Button
            type="submit"
            form="signup-form"
            variant="gradient"
            className="w-full rounded-2xl font-bold"
            style={{ height: 52, fontSize: 16 }}
            disabled={loading || !agreedToTerms}
          >
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" />{t("creating_account")}</> : t("sign_up")}
          </Button>
        </div>
      </div>
    );
  }

  /* ── OTP Entry (Figma: node 50429:118148) ───────────────────── */
  if (view === "otp") {
    const filledCount = otpDigits.filter((d) => d !== "").length;
    const keypadRows = [
      ["1", "2", "3"],
      ["4", "5", "6"],
      ["7", "8", "9"],
      ["*", "0", "back"],
    ];

    return (
      <div
        className="fixed inset-0 flex flex-col bg-white"
        style={{ maxWidth: 430, margin: "0 auto" }}
      >
        <div className="flex-1 px-6 pt-6 pb-4">
          {/* Back arrow */}
          <button
            type="button"
            onClick={() => { setView("forgot"); setForgotSent(false); if (countdownRef.current) clearInterval(countdownRef.current); }}
            className="mb-6 flex items-center justify-center hover:opacity-70 transition-opacity"
          >
            <ArrowLeft className="w-6 h-6 text-gray-800" />
          </button>

          {/* Title */}
          <h1 className="text-[26px] font-extrabold text-gray-900 leading-tight mb-2">
            {t("enter_otp_code")}
          </h1>
          <p className="text-sm text-gray-400 leading-relaxed mb-10">
            {t("otp_sent_desc")}
          </p>

          {/* OTP boxes */}
          <div className="flex justify-center gap-4 mb-6">
            {otpDigits.map((digit, i) => {
              const isActive = digit === "" && otpDigits.slice(0, i).every((d) => d !== "");
              return (
                <div
                  key={i}
                  className="flex items-center justify-center rounded-2xl bg-gray-100 transition-all"
                  style={{
                    width: 72, height: 72,
                    border: isActive ? "2px solid #7DC200" : "2px solid transparent",
                    fontSize: 28, fontWeight: 700, color: "#1a1a1a",
                  }}
                >
                  {digit}
                </div>
              );
            })}
          </div>

          {/* Error */}
          {otpError && (
            <p className="text-xs text-destructive text-center mb-4">{otpError}</p>
          )}

          {/* Countdown + resend */}
          <div className="text-center mb-8">
            {otpCountdown > 0 ? (
              <p className="text-sm text-gray-500">
                {t("resend_code_in")}{" "}
                <span className="font-semibold" style={{ color: "#7DC200" }}>{otpCountdown}</span>
                {" "}{t("seconds")}
              </p>
            ) : (
              <button
                type="button"
                onClick={handleResendOtp}
                className="text-sm font-semibold"
                style={{ color: "#7DC200" }}
              >
                {t("resend_code")}
              </button>
            )}
            {otpCountdown > 0 && (
              <button
                type="button"
                disabled
                className="block mx-auto mt-1 text-sm text-gray-300 cursor-not-allowed"
              >
                {t("resend_code")}
              </button>
            )}
          </div>
        </div>

        {/* Custom numeric keypad */}
        <div className="bg-gray-50 border-t border-gray-100">
          {keypadRows.map((row, ri) => (
            <div key={ri} className="flex">
              {row.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleOtpKey(key)}
                  className="flex-1 flex items-center justify-center transition-colors active:bg-gray-200"
                  style={{ height: 72, fontSize: key === "back" ? 14 : 26, fontWeight: 500, color: "#1a1a1a" }}
                >
                  {key === "back" ? (
                    <svg width="24" height="18" viewBox="0 0 24 18" fill="none">
                      <path d="M9 1L1 9L9 17M1 9H23" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M23 1H10L2 9L10 17H23V1Z" fill="#1a1a1a" fillOpacity="0.08" />
                    </svg>
                  ) : key === "*" ? (
                    <span style={{ fontSize: 32 }}>*</span>
                  ) : (
                    key
                  )}
                </button>
              ))}
            </div>
          ))}

          {/* Verify button */}
          <div className="px-6 pb-8 pt-2">
            <Button
              type="button"
              variant="gradient"
              className="w-full rounded-2xl font-bold"
              style={{ height: 56, fontSize: 16 }}
              disabled={otpLoading || filledCount < 4}
              onClick={handleOtpVerify}
            >
              {otpLoading ? <><Loader2 className="w-4 h-4 animate-spin" />{t("verifying")}</> : t("verify_otp")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Forgot Password (Figma: node 50429:118205) ─────────────── */
  if (view === "forgot") {
    return (
      <div
        className="fixed inset-0 flex flex-col bg-white"
        style={{ maxWidth: 430, margin: "0 auto" }}
      >
        <div className="flex-1 overflow-y-auto px-6 pt-6 pb-6">
          {/* Back arrow */}
          <button
            type="button"
            onClick={() => { setView("signin"); setForgotEmail(""); setForgotSent(false); setForgotError(""); }}
            className="mb-6 flex items-center justify-center hover:opacity-70 transition-opacity"
          >
            <ArrowLeft className="w-6 h-6 text-gray-800" />
          </button>

          {/* Title */}
          <h1 className="text-[22px] font-extrabold text-gray-900 leading-tight mb-1">
            {t("forgot_password")}
          </h1>
          <p className="text-sm text-gray-400 leading-relaxed mb-6">
            {t("forgot_password_desc")}
          </p>

          {/* Form */}
          <form id="forgot-form" onSubmit={handleForgotSubmit} className="flex flex-col gap-4">
            <div className="space-y-1">
              <Label htmlFor="forgot-email" className="text-sm font-semibold text-gray-800">
                {t("registered_email")}
              </Label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="forgot-email"
                  type="email"
                  placeholder="your@email.com"
                  value={forgotEmail}
                  onChange={(e) => { setForgotEmail(e.target.value); setForgotError(""); }}
                  className={`h-12 pl-11 rounded-2xl border-0 bg-gray-100 text-gray-800 placeholder:text-gray-400 focus-visible:ring-1 focus-visible:ring-primary ${forgotError ? "ring-1 ring-destructive" : ""}`}
                  required
                  disabled={forgotLoading}
                  autoComplete="email"
                />
              </div>
              {forgotError && <p className="text-xs text-destructive">{forgotError}</p>}
            </div>
          </form>
        </div>

        {/* Fixed bottom button */}
        <div className="px-6 pt-3 bg-white border-t border-gray-100" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
          <Button
            type="submit"
            form="forgot-form"
            variant="gradient"
            className="w-full rounded-2xl font-bold"
            style={{ height: 52, fontSize: 16 }}
            disabled={forgotLoading}
          >
            {forgotLoading ? <><Loader2 className="w-4 h-4 animate-spin" />{t("sending")}</> : t("send_otp_code")}
          </Button>
        </div>
      </div>
    );
  }

  /* ── Sign In form (Figma: node 50429:118336) ────────────────── */
  return (
    <div
      className="fixed inset-0 flex flex-col bg-white"
      style={{ maxWidth: 430, margin: "0 auto" }}
    >
      <div className="flex-1 overflow-y-auto px-6 pt-6 pb-6">

        {/* Back arrow */}
        <button
          type="button"
          onClick={() => setView("welcome")}
          className="mb-4 flex items-center justify-center hover:opacity-70 transition-opacity"
        >
          <ArrowLeft className="w-6 h-6 text-gray-800" />
        </button>

        {/* Logo */}
        <div className="flex justify-center mb-4">
          <Logo size="lg" />
        </div>

        {/* Title */}
        <h1 className="text-[22px] font-extrabold text-gray-900 leading-tight mb-1">
          {t("welcome_back")}
          </h1>
          <p className="text-sm text-gray-400 leading-relaxed mb-5">
            {t("signin_desc")}
          </p>

        {/* Biometric (native only — show only when credentials are saved) */}
        {biometricAvailable && enableBiometric && (
          <div className="mb-4">
            <Button type="button" variant="outline" className="w-full h-11 rounded-2xl gap-2" onClick={handleBiometricLogin} disabled={biometricLoading}>
              {biometricLoading
                ? <><Loader2 className="w-5 h-5 animate-spin" />{t("authenticating")}</>
                : <><Fingerprint className="w-5 h-5" />{t("sign_in_with_action")} {biometricType}</>}
            </Button>
            <div className="flex items-center mt-3 mb-1">
              <div className="h-px bg-gray-200 flex-1" />
              <span className="px-3 text-xs text-gray-400 uppercase">{t("or_divider")}</span>
              <div className="h-px bg-gray-200 flex-1" />
            </div>
          </div>
        )}

        {/* Form */}
        <form id="signin-form" onSubmit={handleSubmit} className="flex flex-col gap-4">

          {/* Email */}
          <div className="space-y-1">
              <Label htmlFor="si-email" className="text-sm font-semibold text-gray-800">{t("email")}</Label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="si-email" type="email" placeholder={t("email")} value={email}
                onChange={(e) => { setEmail(e.target.value); if (errors.email) setErrors({ ...errors, email: undefined }); }}
                className={`h-12 pl-11 rounded-2xl border-0 bg-gray-100 text-gray-800 placeholder:text-gray-400 focus-visible:ring-1 focus-visible:ring-primary ${errors.email ? "ring-1 ring-destructive" : ""}`}
                required disabled={loading}
              />
            </div>
            {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
          </div>

          {/* Password */}
          <div className="space-y-1">
              <Label htmlFor="si-password" className="text-sm font-semibold text-gray-800">{t("password")}</Label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="si-password" type={showPassword ? "text" : "password"} placeholder={t("password")} value={password}
                onChange={(e) => { setPassword(e.target.value); if (errors.password) setErrors({ ...errors, password: undefined }); }}
                className={`h-12 pl-11 pr-12 rounded-2xl border-0 bg-gray-100 text-gray-800 placeholder:text-gray-400 focus-visible:ring-1 focus-visible:ring-primary ${errors.password ? "ring-1 ring-destructive" : ""}`}
                required disabled={loading}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors" disabled={loading}>
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
          </div>

          {/* Remember me row */}
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer select-none group">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="sr-only"
                />
                <div
                  className={`w-10 h-6 rounded-full transition-colors duration-200 ${
                    rememberMe ? "bg-[#7DC200]" : "bg-gray-200"
                  }`}
                >
                  <div
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                      rememberMe ? "translate-x-4.5" : "translate-x-0.5"
                    }`}
                    style={{ left: rememberMe ? "auto" : "2px" }}
                  />
                </div>
              </div>
              <span className="text-sm text-gray-600 group-hover:text-gray-800 transition-colors">
                {t("remember_me")}
              </span>
            </label>
            <button
              type="button"
              onClick={() => setView("forgot")}
              className="text-sm font-semibold hover:underline"
              style={{ color: "#7DC200" }}
            >
              {t("forgot_password")}
            </button>
          </div>

          {/* Biometric enable (native only) */}
          {biometricAvailable && (
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={enableBiometric} onChange={(e) => setEnableBiometric(e.target.checked)} className="w-4 h-4 rounded accent-primary" disabled={loading} />
              <span className="text-sm text-gray-600">{t("enable_biometric_login")}</span>
            </label>
          )}

          {/* Don't have an account */}
          <p className="text-sm text-gray-500 text-center pt-1">
            {t("dont_have_account")}{" "}
              <button type="button" onClick={() => setView("signup")} className="font-semibold hover:underline" style={{ color: "#7DC200" }} disabled={loading}>
                {t("sign_up")}
              </button>
          </p>
        </form>
      </div>

      {/* Fixed bottom Sign in button */}
      <div className="px-6 pt-3 bg-white border-t border-gray-100" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
        <Button
          type="submit"
          form="signin-form"
          variant="gradient"
          className="w-full rounded-2xl font-bold"
          style={{ height: 52, fontSize: 16 }}
          disabled={loading}
        >
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" />{t("signing_in")}</> : t("sign_in")}
        </Button>
      </div>
    </div>
  );
};

export default Auth;
