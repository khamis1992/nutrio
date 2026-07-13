import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Eye,
  EyeOff,
  Image,
  Loader2,
  ShieldCheck,
  Store,
  TrendingUp,
  Upload,
  X,
} from "lucide-react";
import { z } from "zod";
import { Link } from "react-router-dom";
import { ForgotPasswordDialog } from "@/components/ForgotPasswordDialog";

const signUpSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  fullName: z.string().min(2, "Name must be at least 2 characters"),
  restaurantName: z
    .string()
    .min(2, "Restaurant name must be at least 2 characters"),
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
      const {
        data: { session },
      } = await supabase.auth.getSession();
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
        signInSchema.parse({
          email: formData.email,
          password: formData.password,
        });
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

    const {
      data: { publicUrl },
    } = supabase.storage.from("restaurant-logos").getPublicUrl(filePath);

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
          .select("id, approval_status")
          .eq("owner_id", data.user.id)
          .single();

        if (!restaurant) {
          await supabase.auth.signOut();
          throw new Error(
            "No restaurant found for this account. Please sign up as a partner.",
          );
        }

        // Check approval status
        if (restaurant.approval_status === "rejected") {
          await supabase.auth.signOut();
          throw new Error(
            "Your partner application has been rejected. Please contact support.",
          );
        }

        if (restaurant.approval_status === "pending") {
          toast({
            title: "Application Pending",
            description:
              "Your restaurant is still under review. You'll be notified once approved.",
          });
          navigate("/partner/pending-approval");
          return;
        }

        toast({
          title: "Welcome back!",
          description: "You've successfully signed in to your partner account.",
        });
        navigate("/partner");
      } else {
        // Sign up new partner
        const { data: authData, error: authError } = await supabase.auth.signUp(
          {
            email: formData.email,
            password: formData.password,
            options: {
              emailRedirectTo: `${window.location.origin}/partner`,
              data: {
                full_name: formData.fullName,
                account_type: "partner",
                restaurant_name: formData.restaurantName,
                restaurant_description: formData.restaurantDescription || null,
                restaurant_phone: formData.phone || null,
                restaurant_address: formData.address || null,
              },
            },
          },
        );

        if (authError) throw authError;
        if (!authData.user) throw new Error("Failed to create account");

        if (authData.session && logoFile) {
          const logoUrl = await uploadLogo(authData.user.id);
          if (logoUrl) {
            const { error: logoUpdateError } = await supabase
              .from("restaurants")
              .update({ logo_url: logoUrl })
              .eq("owner_id", authData.user.id);
            if (logoUpdateError) throw logoUpdateError;
          }
        }

        toast({
          title: "Partner account created!",
          description: authData.session
            ? "Your restaurant application is pending approval."
            : "Check your email to verify the account, then sign in to track approval.",
        });
        if (authData.session) {
          navigate("/partner/pending-approval");
        } else {
          setIsLogin(true);
        }
      }
    } catch (error: unknown) {
      console.error("Auth error:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F8FB] px-4 py-5 text-[#020617] sm:px-6 lg:flex lg:items-center lg:justify-center lg:py-10">
      <Card className="relative mx-auto w-full max-w-xl overflow-hidden rounded-[32px] border-[#E5EAF1] bg-white shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
        <div className="absolute inset-x-0 top-0 h-2 bg-[#020617]" />
        <CardHeader className="space-y-5 px-5 pb-4 pt-8 text-center sm:px-7">
          <Link
            to="/"
            className="absolute left-4 top-5 grid h-11 w-11 place-items-center rounded-2xl border border-[#E5EAF1] bg-[#F6F8FB] text-[#020617] transition hover:bg-white"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[28px] border border-[#22C7A1]/25 bg-[#22C7A1]/10">
            <Store className="h-9 w-9 text-[#22C7A1]" />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#22C7A1]">
              Nutrio partner portal
            </p>
            <CardTitle className="mt-2 text-3xl font-black tracking-tight text-[#020617]">
              {isLogin ? "Partner Sign In" : "Become a Partner"}
            </CardTitle>
            <CardDescription className="mx-auto mt-2 max-w-sm text-sm font-semibold leading-6 text-[#64748B]">
              {isLogin
                ? "Sign in to manage your restaurant"
                : "Register your restaurant and start receiving orders"}
            </CardDescription>
          </div>
          <div className="grid grid-cols-3 gap-2 text-left">
            {[
              { icon: Clock3, label: "Orders", color: "#38BDF8" },
              { icon: TrendingUp, label: "Earnings", color: "#22C7A1" },
              { icon: ShieldCheck, label: "Review", color: "#7C83F6" },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-[#E5EAF1] bg-[#F6F8FB] p-3"
              >
                <item.icon
                  className="mb-2 h-4 w-4"
                  style={{ color: item.color }}
                />
                <p className="text-xs font-black text-[#020617]">
                  {item.label}
                </p>
              </div>
            ))}
          </div>
        </CardHeader>

        <CardContent className="px-5 pb-6 sm:px-7">
          <div className="mb-5 grid grid-cols-2 rounded-[24px] border border-[#E5EAF1] bg-[#F6F8FB] p-1">
            <button
              type="button"
              onClick={() => {
                setIsLogin(true);
                setErrors({});
              }}
              className={`h-11 rounded-[20px] text-sm font-black transition ${
                isLogin
                  ? "bg-[#020617] text-white shadow-lg shadow-slate-950/10"
                  : "text-[#94A3B8]"
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => {
                setIsLogin(false);
                setErrors({});
              }}
              className={`h-11 rounded-[20px] text-sm font-black transition ${
                !isLogin
                  ? "bg-[#020617] text-white shadow-lg shadow-slate-950/10"
                  : "text-[#94A3B8]"
              }`}
            >
              Apply
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <>
                <div className="space-y-2">
                  <Label
                    htmlFor="fullName"
                    className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]"
                  >
                    Your Full Name
                  </Label>
                  <Input
                    id="fullName"
                    placeholder="John Doe"
                    value={formData.fullName}
                    onChange={(e) =>
                      setFormData({ ...formData, fullName: e.target.value })
                    }
                    className={`h-12 rounded-2xl border-[#E5EAF1] bg-[#F6F8FB] font-semibold text-[#020617] placeholder:text-[#94A3B8] focus-visible:ring-[#22C7A1] ${errors.fullName ? "border-[#FB6B7A]" : ""}`}
                  />
                  {errors.fullName && (
                    <p className="text-sm font-semibold text-[#FB6B7A]">
                      {errors.fullName}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="restaurantName"
                    className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]"
                  >
                    Restaurant Name
                  </Label>
                  <Input
                    id="restaurantName"
                    placeholder="Your Restaurant"
                    value={formData.restaurantName}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        restaurantName: e.target.value,
                      })
                    }
                    className={`h-12 rounded-2xl border-[#E5EAF1] bg-[#F6F8FB] font-semibold text-[#020617] placeholder:text-[#94A3B8] focus-visible:ring-[#22C7A1] ${errors.restaurantName ? "border-[#FB6B7A]" : ""}`}
                  />
                  {errors.restaurantName && (
                    <p className="text-sm font-semibold text-[#FB6B7A]">
                      {errors.restaurantName}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="restaurantDescription"
                    className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]"
                  >
                    Restaurant Description
                  </Label>
                  <Textarea
                    id="restaurantDescription"
                    placeholder="Tell customers about your restaurant..."
                    value={formData.restaurantDescription}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        restaurantDescription: e.target.value,
                      })
                    }
                    rows={3}
                    className="rounded-2xl border-[#E5EAF1] bg-[#F6F8FB] font-semibold text-[#020617] placeholder:text-[#94A3B8] focus-visible:ring-[#22C7A1]"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label
                      htmlFor="phone"
                      className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]"
                    >
                      Phone Number
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+974 0000 0000"
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData({ ...formData, phone: e.target.value })
                      }
                      className="h-12 rounded-2xl border-[#E5EAF1] bg-[#F6F8FB] font-semibold text-[#020617] placeholder:text-[#94A3B8] focus-visible:ring-[#22C7A1]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="address"
                      className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]"
                    >
                      Address
                    </Label>
                    <Input
                      id="address"
                      placeholder="123 Main St"
                      value={formData.address}
                      onChange={(e) =>
                        setFormData({ ...formData, address: e.target.value })
                      }
                      className="h-12 rounded-2xl border-[#E5EAF1] bg-[#F6F8FB] font-semibold text-[#020617] placeholder:text-[#94A3B8] focus-visible:ring-[#22C7A1]"
                    />
                  </div>
                </div>

                {/* Logo Upload */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                    <Image className="h-4 w-4 text-[#38BDF8]" />
                    Restaurant Logo (optional)
                  </Label>
                  <div className="flex items-center gap-4 rounded-3xl border border-dashed border-[#E5EAF1] bg-[#F6F8FB] p-3">
                    <div className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-3xl border border-[#E5EAF1] bg-white">
                      {logoPreview ? (
                        <>
                          <img
                            src={logoPreview}
                            alt="Logo preview"
                            className="h-full w-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={removeLogo}
                            className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-[#FB6B7A] text-white"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </>
                      ) : (
                        <Image className="h-7 w-7 text-[#94A3B8]" />
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
                        className="h-11 gap-2 rounded-2xl border-[#E5EAF1] bg-white px-4 font-black text-[#020617] hover:bg-white"
                      >
                        <Upload className="h-4 w-4 text-[#7C83F6]" />
                        Upload
                      </Button>
                      <p className="mt-1 text-xs font-semibold text-[#94A3B8]">
                        Max 5MB
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label
                htmlFor="email"
                className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]"
              >
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="partner@restaurant.com"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                className={`h-12 rounded-2xl border-[#E5EAF1] bg-[#F6F8FB] font-semibold text-[#020617] placeholder:text-[#94A3B8] focus-visible:ring-[#22C7A1] ${errors.email ? "border-[#FB6B7A]" : ""}`}
              />
              {errors.email && (
                <p className="text-sm font-semibold text-[#FB6B7A]">
                  {errors.email}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="password"
                className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]"
              >
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  className={`h-12 rounded-2xl border-[#E5EAF1] bg-[#F6F8FB] pr-12 font-semibold text-[#020617] placeholder:text-[#94A3B8] focus-visible:ring-[#22C7A1] ${errors.password ? "border-[#FB6B7A]" : ""}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-xl text-[#94A3B8] transition hover:bg-white hover:text-[#020617]"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-sm font-semibold text-[#FB6B7A]">
                  {errors.password}
                </p>
              )}
              {isLogin && (
                <div className="flex justify-end mt-1">
                  <ForgotPasswordDialog
                    redirectTo={`${window.location.origin}/reset-password`}
                  />
                </div>
              )}
            </div>

            <Button
              type="submit"
              className="h-[52px] w-full rounded-2xl bg-[#020617] text-sm font-black text-white shadow-xl shadow-slate-950/15 hover:bg-[#020617]/95"
              disabled={loading}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLogin ? "Sign in to partner portal" : "Submit application"}
            </Button>
          </form>

          <div className="mt-5 rounded-3xl bg-[#F6F8FB] p-4 text-center">
            <div className="mb-3 flex items-center justify-center gap-2 text-sm font-black text-[#020617]">
              <CheckCircle2 className="h-5 w-5 text-[#22C7A1]" />
              {isLogin
                ? "Approved partners enter operations directly."
                : "Applications are reviewed before launch."}
            </div>
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setErrors({});
              }}
              className="text-sm font-bold text-[#64748B] transition-colors hover:text-[#020617]"
            >
              {isLogin
                ? "Don't have a partner account? "
                : "Already a partner? "}
              <span className="font-black text-[#22C7A1]">
                {isLogin ? "Register your restaurant" : "Sign in"}
              </span>
            </button>
          </div>

          <div className="mt-4 text-center">
            <Link
              to="/auth"
              className="text-sm font-bold text-[#94A3B8] transition-colors hover:text-[#020617]"
            >
              Looking to order food?{" "}
              <span className="font-black text-[#7C83F6]">
                Customer sign in
              </span>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
