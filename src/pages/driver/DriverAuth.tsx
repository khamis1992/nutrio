import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Eye, EyeOff, Loader2, Truck, ArrowLeft } from "lucide-react";
import { z } from "zod";
import { ForgotPasswordDialog } from "@/components/ForgotPasswordDialog";

const signUpSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  fullName: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().min(10, "Please enter a valid phone number"),
});

const signInSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export default function DriverAuth() {
  const [isLogin, setIsLogin] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    fullName: "",
    phone: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const checkDriverSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: driver } = await supabase
          .from("drivers")
          .select("id, approval_status")
          .eq("user_id", session.user.id)
          .maybeSingle();

        if (driver) {
          if (driver.approval_status === "pending") {
            navigate("/driver/onboarding");
          } else if (driver.approval_status === "approved") {
            navigate("/driver");
          }
        }
      }
    };
    checkDriverSession();
  }, [navigate]);

  const validateForm = () => {
    try {
      if (isLogin) {
        signInSchema.parse({ email: formData.email, password: formData.password });
      } else {
        signUpSchema.parse(formData);
      }
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });

        if (error) throw error;

        const { data: driver } = await supabase
          .from("drivers")
          .select("id, approval_status")
          .eq("user_id", data.user.id)
          .maybeSingle();

        if (!driver) {
          await supabase.auth.signOut();
          throw new Error("No driver account found. Please sign up as a driver.");
        }

        toast({
          title: "Welcome back!",
          description: "You've successfully signed in to your driver account.",
        });

        if (driver.approval_status === "pending") {
          navigate("/driver/onboarding");
        } else {
          navigate("/driver");
        }
      } else {
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            emailRedirectTo: `${window.location.origin}/driver`,
            data: {
              full_name: formData.fullName,
            },
          },
        });

        if (authError) throw authError;
        if (!authData.user) throw new Error("Failed to create account");

        const { error: profileError } = await supabase
          .from("profiles")
          .insert({
            user_id: authData.user.id,
            full_name: formData.fullName,
          });

        if (profileError && !profileError.message.includes("duplicate")) {
          console.error("Profile creation error:", profileError);
        }

        const { error: roleError } = await supabase
          .from("user_roles")
          .insert({
            user_id: authData.user.id,
            role: "driver",
          });

        if (roleError) {
          console.error("Role creation error:", roleError);
        }

        const { error: driverError } = await supabase
          .from("drivers")
          .insert({
            user_id: authData.user.id,
            vehicle_type: "bike",
            approval_status: "pending",
            is_online: false,
            total_deliveries: 0,
            wallet_balance: 0,
          });

        if (driverError) throw driverError;

        toast({
          title: "Driver account created!",
          description: "Please complete your vehicle information to get started.",
        });
        navigate("/driver/onboarding");
      }
    } catch (error) {
      console.error("Auth error:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-500/5 via-background to-emerald-500/10 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg border-border/50 shadow-xl">
        <CardHeader className="text-center space-y-4">
          <Link to="/" className="absolute top-4 left-4 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="mx-auto w-16 h-16 bg-green-500/10 rounded-2xl flex items-center justify-center">
            <Truck className="h-8 w-8 text-green-600" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">
              {isLogin ? "Driver Sign In" : "Become a Driver"}
            </CardTitle>
            <CardDescription className="mt-2">
              {isLogin
                ? "Sign in to start delivering"
                : "Register as a driver and start earning"}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    placeholder="John Doe"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className={errors.fullName ? "border-destructive" : ""}
                  />
                  {errors.fullName && (
                    <p className="text-sm text-destructive">{errors.fullName}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+1 234 567 8900"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className={errors.phone ? "border-destructive" : ""}
                  />
                  {errors.phone && (
                    <p className="text-sm text-destructive">{errors.phone}</p>
                  )}
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="driver@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className={errors.email ? "border-destructive" : ""}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className={errors.password ? "border-destructive" : ""}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password}</p>
              )}
              {isLogin && (
                <div className="flex justify-end mt-1">
                  <ForgotPasswordDialog redirectTo={`${window.location.origin}/reset-password`} />
                </div>
              )}
            </div>

            <Button type="submit" className="w-full bg-green-600 hover:bg-green-700" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLogin ? "Sign In" : "Create Driver Account"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setErrors({});
              }}
              className="text-sm text-muted-foreground hover:text-green-600 transition-colors"
            >
              {isLogin ? "Don't have a driver account? " : "Already a driver? "}
              <span className="font-medium text-green-600">
                {isLogin ? "Register now" : "Sign in"}
              </span>
            </button>
          </div>

          <div className="mt-4 text-center">
            <Link to="/auth" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              Looking to order food? <span className="font-medium text-primary">Customer sign in</span>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
