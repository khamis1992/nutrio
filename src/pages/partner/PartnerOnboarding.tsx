import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Store,
  MapPin,
  Phone,
  Mail,
  Upload,
  ChevronRight,
  ChevronLeft,
  Check,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface RestaurantData {
  name: string;
  description: string;
  address: string;
  phone: string;
  email: string;
  logoFile: File | null;
  logoPreview: string | null;
}

const steps = [
  { id: 1, title: "Restaurant Info", description: "Basic details about your restaurant" },
  { id: 2, title: "Contact & Location", description: "How customers can reach you" },
  { id: 3, title: "Logo Upload", description: "Add your restaurant's branding" },
  { id: 4, title: "Review & Submit", description: "Confirm your information" },
];

const PartnerOnboarding = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState<RestaurantData>({
    name: "",
    description: "",
    address: "",
    phone: "",
    email: user?.email || "",
    logoFile: null,
    logoPreview: null,
  });

  const updateData = (field: keyof RestaurantData, value: any) => {
    setData((prev) => ({ ...prev, [field]: value }));
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Logo must be less than 5MB",
          variant: "destructive",
        });
        return;
      }
      updateData("logoFile", file);
      updateData("logoPreview", URL.createObjectURL(file));
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return data.name.trim().length >= 2 && data.description.trim().length >= 10;
      case 2:
        return data.address.trim().length >= 5 && data.phone.trim().length >= 5;
      case 3:
        return true; // Logo is optional
      case 4:
        return true;
      default:
        return false;
    }
  };

  const handleSubmit = async () => {
    if (!user) return;

    try {
      setSubmitting(true);

      let logoUrl: string | null = null;

      // Upload logo if provided
      if (data.logoFile) {
        const fileExt = data.logoFile.name.split(".").pop();
        const fileName = `${user.id}-${Date.now()}.${fileExt}`;
        const filePath = `logos/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("restaurant-logos")
          .upload(filePath, data.logoFile);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("restaurant-logos")
          .getPublicUrl(filePath);

        logoUrl = urlData.publicUrl;
      }

      // Create restaurant
      const { data: restaurant, error: restaurantError } = await supabase
        .from("restaurants")
        .insert({
          owner_id: user.id,
          name: data.name,
          description: data.description,
          address: data.address,
          phone: data.phone,
          email: data.email,
          logo_url: logoUrl,
          approval_status: "pending",
        })
        .select()
        .single();

      if (restaurantError) throw restaurantError;

      // Add partner role if not already present
      const { data: existingRole } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", user.id)
        .eq("role", "partner")
        .maybeSingle();

      if (!existingRole) {
        await supabase.from("user_roles").insert({
          user_id: user.id,
          role: "partner",
        });
      }

      toast({
        title: "Restaurant registered!",
        description: "Your restaurant is pending approval. We'll notify you once it's approved.",
      });

      navigate("/partner");
    } catch (error) {
      console.error("Error creating restaurant:", error);
      toast({
        title: "Error",
        description: "Failed to register restaurant. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const progress = (currentStep / steps.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30">
      <div className="container max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Store className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Register Your Restaurant</h1>
          <p className="text-muted-foreground mt-2">
            Join our platform and start receiving orders
          </p>
        </div>

        {/* Progress */}
        <div className="mb-8">
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between mt-4">
            {steps.map((step) => (
              <div
                key={step.id}
                className={`flex flex-col items-center ${
                  step.id <= currentStep ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    step.id < currentStep
                      ? "bg-primary text-primary-foreground"
                      : step.id === currentStep
                      ? "bg-primary/20 text-primary border-2 border-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {step.id < currentStep ? <Check className="h-4 w-4" /> : step.id}
                </div>
                <span className="text-xs mt-1 hidden sm:block">{step.title}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <Card>
          <CardHeader>
            <CardTitle>{steps[currentStep - 1].title}</CardTitle>
            <CardDescription>{steps[currentStep - 1].description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {currentStep === 1 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="name">Restaurant Name *</Label>
                  <div className="relative">
                    <Store className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="name"
                      value={data.name}
                      onChange={(e) => updateData("name", e.target.value)}
                      placeholder="Your restaurant name"
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    id="description"
                    value={data.description}
                    onChange={(e) => updateData("description", e.target.value)}
                    placeholder="Tell customers about your restaurant, cuisine type, specialties..."
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground">
                    Minimum 10 characters ({data.description.length}/10)
                  </p>
                </div>
              </>
            )}

            {currentStep === 2 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="address">Address *</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="address"
                      value={data.address}
                      onChange={(e) => updateData("address", e.target.value)}
                      placeholder="Full restaurant address"
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number *</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="phone"
                      value={data.phone}
                      onChange={(e) => updateData("phone", e.target.value)}
                      placeholder="+1234567890"
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Contact Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      value={data.email}
                      onChange={(e) => updateData("email", e.target.value)}
                      placeholder="contact@restaurant.com"
                      className="pl-10"
                    />
                  </div>
                </div>
              </>
            )}

            {currentStep === 3 && (
              <div className="space-y-4">
                <div className="border-2 border-dashed border-muted-foreground/25 rounded-xl p-8 text-center">
                  {data.logoPreview ? (
                    <div className="space-y-4">
                      <img
                        src={data.logoPreview}
                        alt="Logo preview"
                        className="w-32 h-32 object-cover rounded-xl mx-auto"
                      />
                      <Button
                        variant="outline"
                        onClick={() => {
                          updateData("logoFile", null);
                          updateData("logoPreview", null);
                        }}
                      >
                        Remove Logo
                      </Button>
                    </div>
                  ) : (
                    <label className="cursor-pointer block">
                      <div className="w-20 h-20 rounded-xl bg-muted flex items-center justify-center mx-auto mb-4">
                        <Upload className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <p className="font-medium">Upload your logo</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        PNG, JPG up to 5MB
                      </p>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoChange}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  Logo is optional but helps customers recognize your restaurant
                </p>
              </div>
            )}

            {currentStep === 4 && (
              <div className="space-y-6">
                <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-xl">
                  {data.logoPreview ? (
                    <img
                      src={data.logoPreview}
                      alt="Logo"
                      className="w-16 h-16 object-cover rounded-xl"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Store className="h-8 w-8 text-primary" />
                    </div>
                  )}
                  <div>
                    <h3 className="font-semibold text-lg">{data.name}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {data.description}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{data.address}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{data.phone}</span>
                  </div>
                  {data.email && (
                    <div className="flex items-center gap-3 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{data.email}</span>
                    </div>
                  )}
                </div>

                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                  <p className="text-sm text-amber-600">
                    <strong>Note:</strong> Your restaurant will be reviewed by our team before
                    appearing on the platform. This usually takes 1-2 business days.
                  </p>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between pt-4">
              <Button
                variant="outline"
                onClick={() => setCurrentStep((prev) => prev - 1)}
                disabled={currentStep === 1}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>

              {currentStep < 4 ? (
                <Button
                  onClick={() => setCurrentStep((prev) => prev + 1)}
                  disabled={!canProceed()}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Submit Registration
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Skip for now */}
        <p className="text-center text-sm text-muted-foreground mt-6">
          Already have a restaurant?{" "}
          <Button variant="link" className="p-0 h-auto" onClick={() => navigate("/partner")}>
            Go to Dashboard
          </Button>
        </p>
      </div>
    </div>
  );
};

export default PartnerOnboarding;