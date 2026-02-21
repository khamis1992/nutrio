import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Eye, EyeOff, Loader2, Store, ArrowLeft, Upload, X, Image } from "lucide-react";
import { z } from "zod";
import { Link } from "react-router-dom";
import { ForgotPasswordDialog } from "@/components/ForgotPasswordDialog";

const signUpSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  fullName: z.string().min(2, "Name must be at least 2 characters"),
  restaurantName: z.string().min(2, "Restaurant name must be at least 2 characters"),
  restaurantDescription: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
});

const signInSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export default function PartnerAuth() {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    fullName: "",
    restaurantName: "",
    restaurantDescription: "",
    phone: "",
    address: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const checkPartnerSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Check if user has a restaurant
        const { data: restaurant } = await supabase
          .from("restaurants")
          .select("id")
          .eq("owner_id", session.user.id)
          .single();
        
        if (restaurant) {
          navigate("/partner");
        }
      }
    };
    checkPartnerSession();
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

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image under 5MB",
        variant: "destructive",
      });
      return;
    }

    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const removeLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const uploadLogo = async (userId: string): Promise<string | null> => {
    if (!logoFile) return null;

    const fileExt = logoFile.name.split(".").pop();
    const fileName = `${userId}-${Date.now()}.${fileExt}`;
    const filePath = `logos/${fileName}`;

    const { error } = await supabase.storage
      .from("restaurant-logos")
      .upload(filePath, logoFile);

    if (error) {
      console.error("Logo upload error:", error);
      return null;
    }

    const { data: { publicUrl } } = supabase.storage
      .from("restaurant-logos")
      .getPublicUrl(filePath);

    return publicUrl;
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

        // Check if user has a restaurant
        const { data: restaurant } = await supabase
          .from("restaurants")
          .select("id")
          .eq("owner_id", data.user.id)
          .single();

        if (!restaurant) {
          await supabase.auth.signOut();
          throw new Error("No restaurant found for this account. Please sign up as a partner.");
        }

        toast({
          title: "Welcome back!",
          description: "You've successfully signed in to your partner account.",
        });
        navigate("/partner");
      } else {
        // Sign up new partner
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            emailRedirectTo: `${window.location.origin}/partner`,
            data: {
              full_name: formData.fullName,
            },
          },
        });

        if (authError) throw authError;
        if (!authData.user) throw new Error("Failed to create account");

        // Upload logo if provided
        const logoUrl = await uploadLogo(authData.user.id);

        // Create restaurant
        const { error: restaurantError } = await supabase
          .from("restaurants")
          .insert({
            owner_id: authData.user.id,
            name: formData.restaurantName,
            description: formData.restaurantDescription || null,
            phone: formData.phone || null,
            address: formData.address || null,
            email: formData.email,
            logo_url: logoUrl,
            approval_status: "pending",
            is_active: true,
          });

        if (restaurantError) throw restaurantError;

        // Create partner role
        const { error: roleError } = await supabase
          .from("user_roles")
          .insert({
            user_id: authData.user.id,
            role: "partner",
          });

        if (roleError) {
          console.error("Role creation error:", roleError);
        }

        // Create profile
        const { error: profileError } = await supabase
          .from("profiles")
          .insert({
            user_id: authData.user.id,
            full_name: formData.fullName,
          });

        if (profileError) {
          console.error("Profile creation error:", profileError);
        }

        toast({
          title: "Partner account created!",
          description: "Your restaurant is pending approval. You can start setting up your menu.",
        });
        navigate("/partner");
      }
    } catch (error: any) {
      console.error("Auth error:", error);
      toast({
        title: "Error",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/10 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg border-border/50 shadow-xl">
        <CardHeader className="text-center space-y-4">
          <Link to="/" className="absolute top-4 left-4 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center">
            <Store className="h-8 w-8 text-primary" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">
              {isLogin ? "Partner Sign In" : "Become a Partner"}
            </CardTitle>
            <CardDescription className="mt-2">
              {isLogin 
                ? "Sign in to manage your restaurant" 
                : "Register your restaurant and start receiving orders"}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="fullName">Your Full Name</Label>
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
                  <Label htmlFor="restaurantName">Restaurant Name</Label>
                  <Input
                    id="restaurantName"
                    placeholder="Your Restaurant"
                    value={formData.restaurantName}
                    onChange={(e) => setFormData({ ...formData, restaurantName: e.target.value })}
                    className={errors.restaurantName ? "border-destructive" : ""}
                  />
                  {errors.restaurantName && (
                    <p className="text-sm text-destructive">{errors.restaurantName}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="restaurantDescription">Restaurant Description</Label>
                  <Textarea
                    id="restaurantDescription"
                    placeholder="Tell customers about your restaurant..."
                    value={formData.restaurantDescription}
                    onChange={(e) => setFormData({ ...formData, restaurantDescription: e.target.value })}
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+1 234 567 8900"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address">Address</Label>
                    <Input
                      id="address"
                      placeholder="123 Main St"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    />
                  </div>
                </div>

                {/* Logo Upload */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Image className="h-4 w-4" />
                    Restaurant Logo (optional)
                  </Label>
                  <div className="flex items-center gap-4">
                    <div className="relative w-20 h-20 rounded-xl border-2 border-dashed border-border bg-muted/50 flex items-center justify-center overflow-hidden">
                      {logoPreview ? (
                        <>
                          <img
                            src={logoPreview}
                            alt="Logo preview"
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={removeLogo}
                            className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </>
                      ) : (
                        <Image className="w-6 h-6 text-muted-foreground/50" />
                      )}
                    </div>
                    <div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleLogoSelect}
                        className="hidden"
                        id="logo-upload"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        className="gap-2"
                      >
                        <Upload className="h-4 w-4" />
                        Upload
                      </Button>
                      <p className="text-xs text-muted-foreground mt-1">Max 5MB</p>
                    </div>
                  </div>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="partner@restaurant.com"
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

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLogin ? "Sign In" : "Create Partner Account"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setErrors({});
              }}
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              {isLogin ? "Don't have a partner account? " : "Already a partner? "}
              <span className="font-medium text-primary">
                {isLogin ? "Register your restaurant" : "Sign in"}
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
