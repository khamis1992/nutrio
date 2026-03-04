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

const emailSchema = z.string().email("Please enter a valid email address");
const passwordSchema = z.string().min(8, "Password must be at least 8 characters");

type AuthView = "welcome" | "signin" | "signup" | "forgot" | "otp";

/* ─── Brand icons ───────────────────────────────────────────────── */
const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 48 48" fill="none">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.35-8.16 2.35-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
);

const AppleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
  </svg>
);

const FacebookIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="#1877F2">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

const XIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

/* ─── Social button ─────────────────────────────────────────────── */
const SocialButton = ({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full flex items-center rounded-full border border-gray-200 bg-white hover:bg-gray-50 active:bg-gray-100 transition-colors"
    style={{ height: 52, padding: "0 20px", gap: 12 }}
  >
    <span className="flex-shrink-0">{icon}</span>
    <span className="flex-1 text-center text-sm font-semibold text-gray-800">
      {label}
    </span>
  </button>
);

/* ─── Main component ────────────────────────────────────────────── */
const Auth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signIn, signUp, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [view, setView] = useState<AuthView>("welcome");
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingRole, setCheckingRole] = useState(false);
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

  useEffect(() => {
    const savedEmail = localStorage.getItem("remembered_email");
    if (savedEmail) { setEmail(savedEmail); setRememberMe(true); }
  }, []);

  useEffect(() => {
    const checkBiometric = async () => {
      if (!isNative) return;
      const available = await biometricAuth.isAvailable();
      if (available) {
        setBiometricAvailable(true);
        setBiometricType(await biometricAuth.getBiometricType());
        setEnableBiometric(await biometricAuth.hasCredentials());
      }
    };
    checkBiometric();
  }, []);

  useEffect(() => {
    const checkUserRole = async () => {
      if (!user) return;
      setCheckingRole(true);
      try {
        const { data: adminRole } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
        if (adminRole) { navigate("/admin", { replace: true }); return; }

        const { data: staffRole } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "staff").maybeSingle();
        if (staffRole) { navigate("/admin", { replace: true }); return; }

        const { data: fleetManager } = await supabase.from("fleet_managers").select("id, role").eq("auth_user_id", user.id).eq("is_active", true).maybeSingle();
        if (fleetManager) { navigate("/fleet", { replace: true }); return; }

        const { data: driver } = await supabase.from("drivers").select("id, approval_status").eq("user_id", user.id).maybeSingle();
        if (driver) {
          navigate(driver.approval_status === "approved" ? "/driver" : "/driver/onboarding", { replace: true });
          return;
        }

        const { data: restaurant } = await supabase.from("restaurants").select("id, approval_status").eq("owner_id", user.id).maybeSingle();
        if (restaurant) {
          navigate(restaurant.approval_status === "approved" ? "/partner" : "/partner/pending-approval", { replace: true });
          return;
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
    try { emailSchema.parse(email); } catch (err) { if (err instanceof z.ZodError) newErrors.email = err.errors[0].message; }
    try { passwordSchema.parse(password); } catch (err) { if (err instanceof z.ZodError) newErrors.password = err.errors[0].message; }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSocialLogin = async (provider: "google" | "apple" | "facebook" | "twitter") => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: `${window.location.origin}/auth` } });
      if (error) throw error;
    } catch {
      toast({ title: "Coming soon", description: `${provider} login will be available shortly.`, variant: "destructive" });
    }
  };

  const handleBiometricLogin = async () => {
    setBiometricLoading(true);
    try {
      const credentials = await biometricAuth.getCredentials();
      if (!credentials) { toast({ title: "No saved credentials", description: "Please sign in with your email and password first.", variant: "destructive" }); return; }
      const authenticated = await biometricAuth.authenticate();
      if (!authenticated) { toast({ title: "Authentication failed", description: "Biometric authentication was canceled or failed.", variant: "destructive" }); return; }
      const { error } = await signIn(credentials.username, credentials.password);
      if (error) {
        toast({ title: "Sign in failed", description: "Invalid credentials. Please sign in again.", variant: "destructive" });
        await biometricAuth.deleteCredentials();
        setEnableBiometric(false);
      } else {
        toast({ title: "Welcome back!", description: `Signed in with ${biometricType}.` });
      }
    } catch {
      toast({ title: "Biometric login failed", description: "An error occurred. Please try again.", variant: "destructive" });
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
          toast({ title: "Sign in failed", description: error.message.includes("Invalid login credentials") ? "Invalid email or password." : error.message, variant: "destructive" });
        } else {
          if (enableBiometric) await biometricAuth.setCredentials(email, password);
          if (rememberMe) localStorage.setItem("remembered_email", email);
          else localStorage.removeItem("remembered_email");
          toast({ title: "Welcome back!", description: "You have successfully signed in." });
        }
      } else {
        const ipCheck = await checkIPLocation();
        if (!ipCheck.allowed) {
          toast({ title: "Signup blocked", description: ipCheck.blocked ? "Your IP has been blocked." : (ipCheck.reason || "Signups are only allowed from Qatar."), variant: "destructive" });
          return;
        }
        const { error } = await signUp(email, password, name);
        if (error) {
          toast({ title: "Sign up failed", description: error.message.includes("User already registered") ? "An account with this email already exists." : error.message, variant: "destructive" });
        } else {
          toast({ title: "Account created!", description: "Welcome to NUTRIO. Let's set up your profile." });
          navigate("/onboarding");
        }
      }
    } catch {
      toast({ title: "Error", description: "An unexpected error occurred.", variant: "destructive" });
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
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setOtpDigits(["", "", "", ""]);
      setOtpError("");
      startOtpCountdown();
      setView("otp");
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to send reset email.", variant: "destructive" });
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
    if (code.length < 4) { setOtpError("Please enter all 4 digits."); return; }
    setOtpLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: forgotEmail,
        token: code,
        type: "recovery",
      });
      if (error) throw error;
      toast({ title: "Verified!", description: "You can now reset your password." });
      navigate("/reset-password");
    } catch (err: any) {
      setOtpError("Invalid code. Please try again.");
      setOtpDigits(["", "", "", ""]);
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (otpCountdown > 0) return;
    try {
      await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      setOtpDigits(["", "", "", ""]);
      setOtpError("");
      startOtpCountdown();
      toast({ title: "Code resent!", description: "Check your inbox." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to resend.", variant: "destructive" });
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
          className="relative flex flex-col items-center justify-center flex-shrink-0 overflow-hidden"
          style={{
            height: "52%",
            background: "linear-gradient(135deg, hsl(142, 71%, 45%) 0%, hsl(168, 76%, 42%) 100%)",
          }}
        >
          {/* Decorative circles */}
          <div style={{ position: "absolute", top: -60, right: -60, width: 220, height: 220, borderRadius: "50%", background: "rgba(255,255,255,0.08)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", bottom: -30, left: -40, width: 160, height: 160, borderRadius: "50%", background: "rgba(255,255,255,0.06)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", top: 40, left: 20, width: 80, height: 80, borderRadius: "50%", background: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />

          {/* Logo */}
          <div
            className="flex items-center justify-center mb-5"
            style={{
              width: 88, height: 88, borderRadius: 28,
              background: "#ffffff",
              boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
            }}
          >
            <Logo size="md" />
          </div>

          {/* Hero text */}
          <h1 style={{ fontSize: 30, fontWeight: 800, color: "#fff", textAlign: "center", lineHeight: 1.2, marginBottom: 8, letterSpacing: -0.5, padding: "0 24px" }}>
            Eat Smart,<br />Live Better
          </h1>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.8)", textAlign: "center", lineHeight: 1.5, padding: "0 32px" }}>
            Personalized nutrition & meal plans<br />tailored to your health goals
          </p>
        </div>

        {/* ── Bottom card ── */}
        <div
          className="flex flex-col flex-1 overflow-y-auto"
          style={{
            background: "#fff",
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
            marginTop: -28,
            zIndex: 10,
            padding: "32px 24px 28px",
          }}
        >
          {/* Feature highlights */}
          <div className="flex flex-col gap-3 mb-8">
            {[
              { icon: "🎯", title: "Personalized Plans", desc: "Calorie & macro targets built for your body" },
              { icon: "🍽️", title: "50+ Restaurant Partners", desc: "Order healthy meals delivered to your door" },
              { icon: "📈", title: "Track Your Progress", desc: "Charts, streaks & insights to keep you on track" },
            ].map((f) => (
              <div
                key={f.title}
                className="flex items-center gap-3"
                style={{
                  background: "#f8fdf0",
                  border: "1px solid #e8f5c8",
                  borderRadius: 14,
                  padding: "10px 14px",
                }}
              >
                <span style={{ fontSize: 22, flexShrink: 0 }}>{f.icon}</span>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a", marginBottom: 1 }}>{f.title}</p>
                  <p style={{ fontSize: 11.5, color: "#6b7280", lineHeight: 1.4 }}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Buttons */}
          <div className="flex flex-col gap-3 mt-auto">
            <Button
              variant="gradient"
              className="w-full rounded-2xl font-bold"
              style={{ height: 54, fontSize: 16 }}
              onClick={() => setView("signup")}
            >
              Create Free Account
            </Button>
            <button
              type="button"
              onClick={() => setView("signin")}
              className="w-full rounded-2xl font-semibold transition-colors hover:bg-gray-100 active:bg-gray-200"
              style={{ height: 54, fontSize: 15, background: "#f5f5f5", border: "none", cursor: "pointer", color: "#374151" }}
            >
              Sign In
            </button>
          </div>

          {/* Footer */}
          <p className="mt-5 text-xs text-gray-400 text-center">
            <Link to="/privacy" className="hover:text-gray-600 transition-colors">Privacy Policy</Link>
            {" · "}
            <Link to="/terms" className="hover:text-gray-600 transition-colors">Terms of Service</Link>
          </p>
        </div>
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
        <div className="flex-1 overflow-y-auto px-6 pt-12 pb-32">
          {/* Back arrow */}
          <button
            type="button"
            onClick={() => setView("welcome")}
            className="mb-8 flex items-center justify-center hover:opacity-70 transition-opacity"
          >
            <ArrowLeft className="w-6 h-6 text-gray-800" />
          </button>

          {/* Logo */}
          <div className="flex justify-center mb-8">
            <Logo size="lg" />
          </div>

          {/* Title */}
          <h1 className="text-[26px] font-extrabold text-gray-900 leading-tight mb-2">
            Join Nutrio Today
          </h1>
          <p className="text-sm text-gray-400 leading-relaxed mb-8">
            Create a Nutrio account to track your meals, stay active, and achieve your health goals.
          </p>

          {/* Form */}
          <form id="signup-form" onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="su-email" className="text-sm font-semibold text-gray-800">Email</Label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="su-email" type="email" placeholder="Email" value={email}
                  onChange={(e) => { setEmail(e.target.value); if (errors.email) setErrors({ ...errors, email: undefined }); }}
                  className={`h-14 pl-11 rounded-2xl border-0 bg-gray-100 text-gray-800 placeholder:text-gray-400 focus-visible:ring-1 focus-visible:ring-primary ${errors.email ? "ring-1 ring-destructive" : ""}`}
                  required disabled={loading}
                />
              </div>
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <Label htmlFor="su-password" className="text-sm font-semibold text-gray-800">Password</Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="su-password" type={showPassword ? "text" : "password"} placeholder="Password" value={password}
                  onChange={(e) => { setPassword(e.target.value); if (errors.password) setErrors({ ...errors, password: undefined }); }}
                  className={`h-14 pl-11 pr-12 rounded-2xl border-0 bg-gray-100 text-gray-800 placeholder:text-gray-400 focus-visible:ring-1 focus-visible:ring-primary ${errors.password ? "ring-1 ring-destructive" : ""}`}
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
                I agree to Nutrio{" "}
                <Link to="/terms" className="font-semibold" style={{ color: "#7DC200" }}>
                  Terms & Conditions
                </Link>
                .
              </span>
            </label>

            {/* Already have account */}
            <p className="text-sm text-gray-500 text-center">
              Already have an account?{" "}
              <button type="button" onClick={() => setView("signin")} className="font-semibold hover:underline" style={{ color: "#7DC200" }} disabled={loading}>
                Sign in
              </button>
            </p>
          </form>
        </div>

        {/* Fixed bottom Sign up button */}
        <div className="px-6 pb-10 pt-4 bg-white border-t border-gray-100">
          <Button
            type="submit"
            form="signup-form"
            variant="gradient"
            className="w-full rounded-2xl font-bold"
            style={{ height: 56, fontSize: 16 }}
            disabled={loading || !agreedToTerms}
          >
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Creating account...</> : "Sign up"}
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
        <div className="flex-1 px-6 pt-12 pb-4">
          {/* Back arrow */}
          <button
            type="button"
            onClick={() => { setView("forgot"); setForgotSent(false); if (countdownRef.current) clearInterval(countdownRef.current); }}
            className="mb-8 flex items-center justify-center hover:opacity-70 transition-opacity"
          >
            <ArrowLeft className="w-6 h-6 text-gray-800" />
          </button>

          {/* Title */}
          <h1 className="text-[26px] font-extrabold text-gray-900 leading-tight mb-2">
            Enter OTP Code 🔓
          </h1>
          <p className="text-sm text-gray-400 leading-relaxed mb-10">
            We've sent a 4-digit OTP code to your email address. Please enter it below to verify and continue with password reset.
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
                You can resend the code in{" "}
                <span className="font-semibold" style={{ color: "#7DC200" }}>{otpCountdown}</span>
                {" "}seconds
              </p>
            ) : (
              <button
                type="button"
                onClick={handleResendOtp}
                className="text-sm font-semibold"
                style={{ color: "#7DC200" }}
              >
                Resend code
              </button>
            )}
            {otpCountdown > 0 && (
              <button
                type="button"
                disabled
                className="block mx-auto mt-1 text-sm text-gray-300 cursor-not-allowed"
              >
                Resend code
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
              {otpLoading ? <><Loader2 className="w-4 h-4 animate-spin" />Verifying...</> : "Verify OTP"}
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
        <div className="flex-1 overflow-y-auto px-6 pt-12 pb-36">
          {/* Back arrow */}
          <button
            type="button"
            onClick={() => { setView("signin"); setForgotEmail(""); setForgotSent(false); setForgotError(""); }}
            className="mb-8 flex items-center justify-center hover:opacity-70 transition-opacity"
          >
            <ArrowLeft className="w-6 h-6 text-gray-800" />
          </button>

          {/* Title */}
          <h1 className="text-[26px] font-extrabold text-gray-900 leading-tight mb-2">
            Forgot Password? 🔑
          </h1>
          <p className="text-sm text-gray-400 leading-relaxed mb-8">
            Please enter your registered email address below. We'll send you a One-Time Password (OTP) to reset your password securely.
          </p>

          {/* Form */}
          <form id="forgot-form" onSubmit={handleForgotSubmit} className="flex flex-col gap-5">
            <div className="space-y-1.5">
              <Label htmlFor="forgot-email" className="text-sm font-semibold text-gray-800">
                Registered Email Address
              </Label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="forgot-email"
                  type="email"
                  placeholder="your@email.com"
                  value={forgotEmail}
                  onChange={(e) => { setForgotEmail(e.target.value); setForgotError(""); }}
                  className={`h-14 pl-11 rounded-2xl border-0 bg-gray-100 text-gray-800 placeholder:text-gray-400 focus-visible:ring-1 focus-visible:ring-primary ${forgotError ? "ring-1 ring-destructive" : ""}`}
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
        <div className="px-6 pb-10 pt-4 bg-white border-t border-gray-100">
          <Button
            type="submit"
            form="forgot-form"
            variant="gradient"
            className="w-full rounded-2xl font-bold"
            style={{ height: 56, fontSize: 16 }}
            disabled={forgotLoading}
          >
            {forgotLoading ? <><Loader2 className="w-4 h-4 animate-spin" />Sending...</> : "Send OTP Code"}
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
      <div className="flex-1 overflow-y-auto px-6 pt-12 pb-36">

        {/* Back arrow */}
        <button
          type="button"
          onClick={() => setView("welcome")}
          className="mb-6 flex items-center justify-center hover:opacity-70 transition-opacity"
        >
          <ArrowLeft className="w-6 h-6 text-gray-800" />
        </button>

        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Logo size="xl" />
        </div>

        {/* Title */}
        <h1 className="text-[26px] font-extrabold text-gray-900 leading-tight mb-2">
          Welcome Back!
        </h1>
        <p className="text-sm text-gray-400 leading-relaxed mb-8">
          Sign in to continue your journey towards a healthier you.
        </p>

        {/* Biometric (native only) */}
        {biometricAvailable && (
          <div className="mb-6">
            <Button type="button" variant="outline" className="w-full h-12 rounded-2xl gap-2" onClick={handleBiometricLogin} disabled={biometricLoading}>
              {biometricLoading
                ? <><Loader2 className="w-5 h-5 animate-spin" />Authenticating...</>
                : <><Fingerprint className="w-5 h-5" />Sign in with {biometricType}</>}
            </Button>
            <div className="flex items-center mt-4 mb-2">
              <div className="h-px bg-gray-200 flex-1" />
              <span className="px-3 text-xs text-gray-400 uppercase">or</span>
              <div className="h-px bg-gray-200 flex-1" />
            </div>
          </div>
        )}

        {/* Form */}
        <form id="signin-form" onSubmit={handleSubmit} className="flex flex-col gap-5">

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="si-email" className="text-sm font-semibold text-gray-800">Email</Label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="si-email" type="email" placeholder="Email" value={email}
                onChange={(e) => { setEmail(e.target.value); if (errors.email) setErrors({ ...errors, email: undefined }); }}
                className={`h-14 pl-11 rounded-2xl border-0 bg-gray-100 text-gray-800 placeholder:text-gray-400 focus-visible:ring-1 focus-visible:ring-primary ${errors.email ? "ring-1 ring-destructive" : ""}`}
                required disabled={loading}
              />
            </div>
            {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <Label htmlFor="si-password" className="text-sm font-semibold text-gray-800">Password</Label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="si-password" type={showPassword ? "text" : "password"} placeholder="Password" value={password}
                onChange={(e) => { setPassword(e.target.value); if (errors.password) setErrors({ ...errors, password: undefined }); }}
                className={`h-14 pl-11 pr-12 rounded-2xl border-0 bg-gray-100 text-gray-800 placeholder:text-gray-400 focus-visible:ring-1 focus-visible:ring-primary ${errors.password ? "ring-1 ring-destructive" : ""}`}
                required disabled={loading}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors" disabled={loading}>
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
          </div>

          {/* Remember me + Forgot password — same row */}
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              {/* Custom green checkbox */}
              <div
                className="w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors"
                style={{ borderColor: "#7DC200", background: rememberMe ? "#7DC200" : "transparent" }}
                onClick={() => setRememberMe(!rememberMe)}
              >
                {rememberMe && (
                  <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                    <path d="M1 4L4 7L10 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <span className="text-sm text-gray-700">Remember me</span>
            </label>
            <button
              type="button"
              onClick={() => setView("forgot")}
              className="text-sm font-semibold hover:underline"
              style={{ color: "#7DC200" }}
            >
              Forgot Password?
            </button>
          </div>

          {/* Biometric enable (native only) */}
          {biometricAvailable && (
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={enableBiometric} onChange={(e) => setEnableBiometric(e.target.checked)} className="w-4 h-4 rounded accent-primary" disabled={loading} />
              <span className="text-sm text-gray-600">Enable {biometricType} for faster login</span>
            </label>
          )}

          {/* Don't have an account */}
          <p className="text-sm text-gray-500 text-center pt-1">
            Don't have an account?{" "}
            <button type="button" onClick={() => setView("signup")} className="font-semibold hover:underline" style={{ color: "#7DC200" }} disabled={loading}>
              Sign up
            </button>
          </p>
        </form>
      </div>

      {/* Fixed bottom Sign in button */}
      <div className="px-6 pb-10 pt-4 bg-white border-t border-gray-100">
        <Button
          type="submit"
          form="signin-form"
          variant="gradient"
          className="w-full rounded-2xl font-bold"
          style={{ height: 56, fontSize: 16 }}
          disabled={loading}
        >
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Signing in...</> : "Sign in"}
        </Button>
      </div>
    </div>
  );
};

export default Auth;
