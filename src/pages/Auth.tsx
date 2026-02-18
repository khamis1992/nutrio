import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Salad, Mail, Lock, ArrowRight, Eye, EyeOff, User, Loader2, Fingerprint } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ForgotPasswordDialog } from "@/components/ForgotPasswordDialog";
import { biometricAuth, isNative } from "@/lib/capacitor";
import { z } from "zod";

const emailSchema = z.string().email("Please enter a valid email address");
const passwordSchema = z.string().min(8, "Password must be at least 8 characters");

const Auth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signIn, signUp, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingRole, setCheckingRole] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState("");
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [enableBiometric, setEnableBiometric] = useState(false);

  // Check for biometric availability
  useEffect(() => {
    const checkBiometric = async () => {
      if (!isNative) return;

      const available = await biometricAuth.isAvailable();
      if (available) {
        setBiometricAvailable(true);
        const type = await biometricAuth.getBiometricType();
        setBiometricType(type);
        // Check if credentials are already stored
        const hasCreds = await biometricAuth.hasCredentials();
        setEnableBiometric(hasCreds);
      }
    };

    checkBiometric();
  }, []);

  // Redirect if already authenticated - check for partner/driver role
  useEffect(() => {
    const checkUserRole = async () => {
      if (!user) return;

      setCheckingRole(true);
      try {
        // Check if user is an admin
        const { data: adminRole } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle();

        if (adminRole) {
          navigate("/admin", { replace: true });
          return;
        }

        // Check if user is a driver
        const { data: driver } = await supabase
          .from("drivers")
          .select("id, approval_status")
          .eq("user_id", user.id)
          .maybeSingle();

        if (driver) {
          if (driver.approval_status === "approved") {
            navigate("/driver", { replace: true });
          } else {
            navigate("/driver/onboarding", { replace: true });
          }
          return;
        }

        // Check if user has a restaurant (is a partner)
        const { data: restaurant } = await supabase
          .from("restaurants")
          .select("id")
          .eq("owner_id", user.id)
          .maybeSingle();

        if (restaurant) {
          navigate("/partner", { replace: true });
        } else {
          const from = (location.state as { from?: Location })?.from?.pathname || "/dashboard";
          navigate(from, { replace: true });
        }
      } catch (error) {
        console.error("Error checking user role:", error);
        navigate("/dashboard", { replace: true });
      } finally {
        setCheckingRole(false);
      }
    };

    checkUserRole();
  }, [user, navigate, location]);

  const validateForm = () => {
    const newErrors: { email?: string; password?: string } = {};

    try {
      emailSchema.parse(email);
    } catch (err) {
      if (err instanceof z.ZodError) {
        newErrors.email = err.errors[0].message;
      }
    }

    try {
      passwordSchema.parse(password);
    } catch (err) {
      if (err instanceof z.ZodError) {
        newErrors.password = err.errors[0].message;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleBiometricLogin = async () => {
    setBiometricLoading(true);

    try {
      // First check if credentials are stored
      const credentials = await biometricAuth.getCredentials();

      if (!credentials) {
        toast({
          title: "No saved credentials",
          description: "Please sign in with your email and password first.",
          variant: "destructive",
        });
        setBiometricLoading(false);
        return;
      }

      // Authenticate with biometrics
      const authenticated = await biometricAuth.authenticate();

      if (!authenticated) {
        toast({
          title: "Authentication failed",
          description: "Biometric authentication was canceled or failed.",
          variant: "destructive",
        });
        setBiometricLoading(false);
        return;
      }

      // Sign in with stored credentials
      const { error } = await signIn(credentials.username, credentials.password);

      if (error) {
        let message = error.message;
        if (message.includes("Invalid login credentials")) {
          message = "Invalid credentials. Please sign in again.";
        }
        toast({
          title: "Sign in failed",
          description: message,
          variant: "destructive",
        });

        // Clear invalid credentials
        await biometricAuth.deleteCredentials();
        setEnableBiometric(false);
      } else {
        toast({
          title: "Welcome back!",
          description: `You have successfully signed in with ${biometricType}.`,
        });
      }
    } catch (err) {
      toast({
        title: "Biometric login failed",
        description: "An error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setBiometricLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          let message = error.message;
          if (message.includes("Invalid login credentials")) {
            message = "Invalid email or password. Please try again.";
          }
          toast({
            title: "Sign in failed",
            description: message,
            variant: "destructive",
          });
        } else {
          // Store credentials for biometric login if enabled
          if (enableBiometric) {
            await biometricAuth.setCredentials(email, password);
          }

          toast({
            title: "Welcome back!",
            description: "You have successfully signed in.",
          });
        }
      } else {
        const { error } = await signUp(email, password, name);
        if (error) {
          let message = error.message;
          if (message.includes("User already registered")) {
            message = "An account with this email already exists. Please sign in instead.";
          }
          toast({
            title: "Sign up failed",
            description: message,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Account created!",
            description: "Welcome to NUTRIO. Let's set up your profile.",
          });
          navigate("/onboarding");
        }
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || checkingRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-hero flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <Link to="/" className="flex items-center justify-center gap-2 mb-8">
          <div className="w-12 h-12 gradient-primary rounded-2xl flex items-center justify-center shadow-glow">
            <Salad className="w-6 h-6 text-primary-foreground" />
          </div>
          <span className="text-2xl font-bold">NUTRIO</span>
        </Link>

        {/* Auth Card */}
        <Card variant="elevated" className="animate-scale-in">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl">
              {isLogin ? "Welcome back" : "Create account"}
            </CardTitle>
            <CardDescription>
              {isLogin 
                ? "Sign in to continue your health journey" 
                : "Start your personalized nutrition journey"}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            {/* Biometric Login Button */}
            {isLogin && biometricAvailable && (
              <div className="mb-4">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-12 gap-2"
                  onClick={handleBiometricLogin}
                  disabled={biometricLoading}
                >
                  {biometricLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Authenticating...
                    </>
                  ) : (
                    <>
                      <Fingerprint className="w-5 h-5" />
                      Sign in with {biometricType}
                    </>
                  )}
                </Button>
                <div className="flex items-center justify-center mt-3">
                  <div className="h-px bg-border flex-1" />
                  <span className="px-3 text-xs text-muted-foreground uppercase">or</span>
                  <div className="h-px bg-border flex-1" />
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="name"
                      type="text"
                      placeholder="John Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="h-12 pl-10"
                      required={!isLogin}
                      disabled={loading}
                    />
                  </div>
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errors.email) setErrors({ ...errors, email: undefined });
                    }}
                    className={`h-12 pl-10 ${errors.email ? "border-destructive" : ""}`}
                    required
                    disabled={loading}
                  />
                </div>
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errors.password) setErrors({ ...errors, password: undefined });
                    }}
                    className={`h-12 pl-10 pr-10 ${errors.password ? "border-destructive" : ""}`}
                    required
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    disabled={loading}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-sm text-destructive">{errors.password}</p>
                )}
              </div>

              {/* Enable Biometric Checkbox */}
              {isLogin && biometricAvailable && (
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="enable-biometric"
                    checked={enableBiometric}
                    onChange={(e) => setEnableBiometric(e.target.checked)}
                    className="w-4 h-4 rounded border-input text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    disabled={loading}
                  />
                  <Label
                    htmlFor="enable-biometric"
                    className="text-sm font-normal cursor-pointer select-none"
                  >
                    Enable {biometricType} login for faster access
                  </Label>
                </div>
              )}

              {isLogin && (
                <div className="flex justify-end">
                  <ForgotPasswordDialog />
                </div>
              )}

              <Button 
                type="submit" 
                variant="gradient" 
                className="w-full h-12"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {isLogin ? "Signing in..." : "Creating account..."}
                  </>
                ) : (
                  <>
                    {isLogin ? "Sign In" : "Create Account"}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                {isLogin ? "Don't have an account?" : "Already have an account?"}
                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setErrors({});
                  }}
                  className="ml-1 text-primary font-semibold hover:underline"
                  disabled={loading}
                >
                  {isLogin ? "Sign up" : "Sign in"}
                </button>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Terms */}
        <p className="mt-6 text-center text-xs text-muted-foreground">
          By continuing, you agree to our{" "}
          <a href="#" className="underline hover:text-foreground">Terms of Service</a>
          {" "}and{" "}
          <a href="#" className="underline hover:text-foreground">Privacy Policy</a>
        </p>
      </div>
    </div>
  );
};

export default Auth;
