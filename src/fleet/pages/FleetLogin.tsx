import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Eye, EyeOff, Loader2, Truck, ArrowLeft } from "lucide-react";
import { z } from "zod";
import { Link } from "react-router-dom";
import { ForgotPasswordDialog } from "@/components/ForgotPasswordDialog";

const signInSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export default function FleetLogin() {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Check if user is a fleet manager
        const { data: fleetManager } = await supabase
          .from("fleet_managers")
          .select("id, is_active, country, role")
          .eq("auth_user_id", session.user.id)
          .maybeSingle();
        
        if (fleetManager?.is_active) {
          navigate("/fleet");
        }
      }
    };
    checkSession();
  }, [navigate]);

  const validateForm = () => {
    try {
      signInSchema.parse(formData);
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
      const { data, error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (error) throw error;

      // Check if user is a fleet manager
      const { data: fleetManager, error: fleetError } = await supabase
        .from("fleet_managers")
        .select("id, full_name, role, is_active, assigned_city_ids, country")
        .eq("auth_user_id", data.user.id)
        .maybeSingle();

      if (fleetError || !fleetManager) {
        await supabase.auth.signOut();
        throw new Error("You don't have fleet manager access. Please contact your administrator.");
      }

      if (!fleetManager.is_active) {
        await supabase.auth.signOut();
        throw new Error("Your fleet manager account has been deactivated.");
      }

      // Update last login
      await supabase
        .from("fleet_managers")
        .update({ last_login_at: new Date().toISOString() })
        .eq("id", fleetManager.id);

      // Store remember me preference
      if (rememberMe) {
        localStorage.setItem("fleetRememberMe", "true");
      } else {
        localStorage.removeItem("fleetRememberMe");
      }

      toast({
        title: "Welcome back!",
        description: `Signed in as ${fleetManager.full_name}`,
      });

      // Small delay to ensure auth context updates before navigation
      setTimeout(() => {
        navigate("/fleet", { replace: true });
      }, 100);
    } catch (error: any) {
      console.error("Fleet login error:", error);
      toast({
        title: "Error",
        description: error.message || "Invalid email or password",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/10 flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-border/50 shadow-xl">
        <CardHeader className="text-center space-y-4">
          <Link to="/" className="absolute top-4 left-4 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-5 w-5 rtl-flip-back" />
          </Link>
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center">
            <Truck className="h-8 w-8 text-primary" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">
              Fleet Manager Login
            </CardTitle>
            <CardDescription className="mt-2">
              Sign in to manage drivers, vehicles, and deliveries
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="fleet@nutriofuel.com"
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
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="remember"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                />
                <Label htmlFor="remember" className="text-sm font-normal cursor-pointer">
                  Remember me
                </Label>
              </div>
              <ForgotPasswordDialog redirectTo={`${window.location.origin}/reset-password`} />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign In
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Link to="/auth" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              Looking for customer login? <span className="font-medium text-primary">Sign in here</span>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
