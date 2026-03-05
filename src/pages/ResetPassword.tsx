import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Lock, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { z } from "zod";
import { Logo } from "@/components/Logo";

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Must contain at least one uppercase letter")
  .regex(/[a-z]/, "Must contain at least one lowercase letter")
  .regex(/[0-9]/, "Must contain at least one number");

const ResetPassword = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [validSession, setValidSession] = useState<boolean | null>(null);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setValidSession(!!session);
    };
    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setValidSession(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const validateForm = () => {
    const newErrors: { password?: string; confirm?: string } = {};
    try {
      passwordSchema.parse(password);
    } catch (err) {
      if (err instanceof z.ZodError) newErrors.password = err.errors[0].message;
    }
    if (password !== confirmPassword) newErrors.confirm = "Passwords do not match";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setSuccess(true);
      toast({ title: "Password updated!", description: "Your password has been successfully reset." });
      await supabase.auth.signOut();
      setTimeout(() => navigate("/auth"), 3000);
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to update password", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  /* ── Loading ── */
  if (validSession === null) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  /* ── Invalid / expired link ── */
  if (!validSession) {
    return (
      <div
        className="fixed inset-0 flex flex-col items-center justify-center bg-white px-6"
        style={{ maxWidth: 430, margin: "0 auto" }}
      >
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
          style={{ background: "rgba(239,68,68,0.1)" }}
        >
          <Lock className="w-9 h-9 text-destructive" />
        </div>
        <h2 className="text-[22px] font-extrabold text-gray-900 mb-2 text-center">Invalid or Expired Link</h2>
        <p className="text-sm text-gray-400 text-center leading-relaxed mb-8">
          This password reset link is invalid or has expired. Please request a new one.
        </p>
        <Button asChild variant="gradient" className="w-full rounded-2xl font-bold" style={{ height: 56, fontSize: 16 }}>
          <Link to="/auth">Back to Sign In</Link>
        </Button>
      </div>
    );
  }

  /* ── Success (Figma: node 50429:117966) ── */
  if (success) {
    return (
      <div
        className="fixed inset-0 flex flex-col bg-white"
        style={{ maxWidth: 430, margin: "0 auto" }}
      >
        {/* Centered illustration + text */}
        <div className="flex-1 flex flex-col items-center justify-center px-8">
          {/* Phone on green circle illustration */}
          <div className="relative mb-8" style={{ width: 160, height: 160 }}>
            {/* Green circle background */}
            <div
              className="absolute inset-0 rounded-full"
              style={{ background: "linear-gradient(135deg, hsl(90, 65%, 60%) 0%, hsl(90, 65%, 50%) 100%)" }}
            />
            {/* Phone SVG */}
            <svg
              viewBox="0 0 160 160"
              fill="none"
              className="absolute inset-0 w-full h-full"
            >
              {/* Phone body */}
              <rect x="52" y="28" width="64" height="108" rx="14" fill="white" />
              {/* Dynamic island */}
              <rect x="70" y="36" width="28" height="8" rx="4" fill="#1a1a1a" />
              {/* User circle icon */}
              <circle cx="84" cy="88" r="20" fill="hsl(90, 65%, 55%)" />
              <circle cx="84" cy="82" r="8" fill="white" />
              <ellipse cx="84" cy="100" rx="13" ry="8" fill="white" />
            </svg>
          </div>

          <h1 className="text-[28px] font-extrabold text-gray-900 text-center mb-3">
            You're All Set!
          </h1>
          <p className="text-sm text-gray-400 text-center leading-relaxed">
            You've successfully changed your password.
          </p>
        </div>

        {/* Fixed bottom Sign in button */}
        <div className="px-6 pb-10 pt-4">
          <Button
            asChild
            variant="gradient"
            className="w-full rounded-2xl font-bold"
            style={{ height: 56, fontSize: 16 }}
          >
            <Link to="/auth">Sign in</Link>
          </Button>
        </div>
      </div>
    );
  }

  /* ── Main form (Figma: node 50429:118060) ── */
  return (
    <div
      className="fixed inset-0 flex flex-col bg-white"
      style={{ maxWidth: 430, margin: "0 auto" }}
    >
      <div className="flex-1 overflow-y-auto px-6 pt-12 pb-36">
        {/* Back arrow */}
        <button
          type="button"
          onClick={() => navigate("/auth")}
          className="mb-8 flex items-center justify-center hover:opacity-70 transition-opacity"
        >
          <ArrowLeft className="w-6 h-6 text-gray-800" />
        </button>

        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Logo size="xl" />
        </div>

        {/* Title */}
        <h1 className="text-[26px] font-extrabold text-gray-900 leading-tight mb-2">
          Secure Your Account 🔒
        </h1>
        <p className="text-sm text-gray-400 leading-relaxed mb-8">
          Your account security is our top priority. Please create a new password using a mix of letters, numbers, and symbols.
        </p>

        <form id="reset-form" onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* New password */}
          <div className="space-y-1.5">
            <Label htmlFor="rp-password" className="text-sm font-semibold text-gray-800">
              Create new password
            </Label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="rp-password"
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setErrors({ ...errors, password: undefined }); }}
                className={`h-14 pl-11 pr-12 rounded-2xl border-0 bg-gray-100 text-gray-800 placeholder:text-gray-400 focus-visible:ring-1 focus-visible:ring-primary ${errors.password ? "ring-1 ring-destructive" : ""}`}
                required
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                disabled={loading}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
          </div>

          {/* Confirm password */}
          <div className="space-y-1.5">
            <Label htmlFor="rp-confirm" className="text-sm font-semibold text-gray-800">
              Confirm new password
            </Label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="rp-confirm"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setErrors({ ...errors, confirm: undefined }); }}
                className={`h-14 pl-11 pr-12 rounded-2xl border-0 bg-gray-100 text-gray-800 placeholder:text-gray-400 focus-visible:ring-1 focus-visible:ring-primary ${errors.confirm ? "ring-1 ring-destructive" : ""}`}
                required
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                disabled={loading}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.confirm && <p className="text-xs text-destructive">{errors.confirm}</p>}
          </div>
        </form>
      </div>

      {/* Fixed bottom button */}
      <div className="px-6 pb-10 pt-4 bg-white border-t border-gray-100">
        <Button
          type="submit"
          form="reset-form"
          variant="gradient"
          className="w-full rounded-2xl font-bold"
          style={{ height: 56, fontSize: 16 }}
          disabled={loading}
        >
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Saving...</> : "Save New Password"}
        </Button>
      </div>
    </div>
  );
};

export default ResetPassword;
