import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

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
  UtensilsCrossed,
  Building2,
  Camera,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

// Available cuisine types
const CUISINE_TYPES = [
  "Qatari",
  "Arabic",
  "Mediterranean",
  "Indian",
  "Asian",
  "Italian",
  "American",
  "Healthy",
  "Organic",
  "Fusion",
  "Other",
];

// Available dietary tags
const DIETARY_TAGS = [
  "Keto",
  "Vegan",
  "Vegetarian",
  "Gluten-Free",
  "Dairy-Free",
  "Low-Carb",
  "High-Protein",
  "Paleo",
  "Halal",
];

// Days of the week
const DAYS_OF_WEEK = [
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" },
];

interface OperatingHours {
  is_open: boolean;
  open: string;
  close: string;
}

interface RestaurantData {
  // Step 1: Restaurant Info
  name: string;
  description: string;
  cuisine_types: string[];
  dietary_tags: string[];

  // Step 2: Contact & Location
  address: string;
  phone: string;
  email: string;
  website: string;
  operating_hours: Record<string, OperatingHours>;

  // Step 3: Branding
  logoFile: File | null;
  logoPreview: string | null;
  photos: File[];
  photoPreviews: string[];

  // Step 4: Operations
  avg_prep_time_minutes: number;
  max_meals_per_day: number;
  bank_name: string;
  bank_account_name: string;
  bank_account_number: string;
  bank_iban: string;

  // Step 5: Terms
  terms_accepted: boolean;
}

const steps = [
  { id: 1, title: "Restaurant Info", description: "Basic details and cuisine type" },
  { id: 2, title: "Contact & Hours", description: "Location and operating hours" },
  { id: 3, title: "Branding", description: "Logo and photos" },
  { id: 4, title: "Operations", description: "Prep time, capacity & banking" },
  { id: 5, title: "Review & Submit", description: "Confirm and accept terms" },
];

const defaultOperatingHours: Record<string, OperatingHours> = {
  monday: { is_open: true, open: "09:00", close: "22:00" },
  tuesday: { is_open: true, open: "09:00", close: "22:00" },
  wednesday: { is_open: true, open: "09:00", close: "22:00" },
  thursday: { is_open: true, open: "09:00", close: "22:00" },
  friday: { is_open: true, open: "09:00", close: "22:00" },
  saturday: { is_open: true, open: "09:00", close: "22:00" },
  sunday: { is_open: true, open: "09:00", close: "22:00" },
};

const PartnerOnboarding = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState<RestaurantData>({
    name: "",
    description: "",
    cuisine_types: [],
    dietary_tags: [],
    address: "",
    phone: "",
    email: user?.email || "",
    website: "",
    operating_hours: defaultOperatingHours,
    logoFile: null,
    logoPreview: null,
    photos: [],
    photoPreviews: [],
    avg_prep_time_minutes: 30,
    max_meals_per_day: 50,
    bank_name: "",
    bank_account_name: "",
    bank_account_number: "",
    bank_iban: "",
    terms_accepted: false,
  });

  const updateData = (field: keyof RestaurantData, value: string | boolean | string[] | Record<string, unknown>) => {
    setData((prev) => ({ ...prev, [field]: value }));
  };

  const toggleCuisineType = (type: string) => {
    setData((prev) => ({
      ...prev,
      cuisine_types: prev.cuisine_types.includes(type)
        ? prev.cuisine_types.filter((t) => t !== type)
        : [...prev.cuisine_types, type],
    }));
  };

  const toggleDietaryTag = (tag: string) => {
    setData((prev) => ({
      ...prev,
      dietary_tags: prev.dietary_tags.includes(tag)
        ? prev.dietary_tags.filter((t) => t !== tag)
        : [...prev.dietary_tags, tag],
    }));
  };

  const updateOperatingHours = (day: string, field: keyof OperatingHours, value: string | boolean) => {
    setData((prev) => ({
      ...prev,
      operating_hours: {
        ...prev.operating_hours,
        [day]: {
          ...prev.operating_hours[day],
          [field]: value,
        },
      },
    }));
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

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter((file) => {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: `${file.name} must be less than 5MB`,
          variant: "destructive",
        });
        return false;
      }
      return true;
    });

    const newPreviews = validFiles.map((file) => URL.createObjectURL(file));
    updateData("photos", [...data.photos, ...validFiles]);
    updateData("photoPreviews", [...data.photoPreviews, ...newPreviews]);
  };

  const removePhoto = (index: number) => {
    updateData(
      "photos",
      data.photos.filter((_, i) => i !== index)
    );
    updateData(
      "photoPreviews",
      data.photoPreviews.filter((_, i) => i !== index)
    );
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return (
          data.name.trim().length >= 2 &&
          data.description.trim().length >= 10 &&
          data.cuisine_types.length > 0
        );
      case 2:
        return data.address.trim().length >= 5 && data.phone.trim().length >= 5;
      case 3:
        return true; // Logo and photos are optional
      case 4:
        return (
          data.avg_prep_time_minutes > 0 &&
          data.max_meals_per_day > 0 &&
          data.bank_name.trim().length > 0 &&
          data.bank_account_name.trim().length > 0 &&
          data.bank_account_number.trim().length > 0
        );
      case 5:
        return data.terms_accepted;
      default:
        return false;
    }
  };

  const handleSubmit = async () => {
    if (!user) return;

    try {
      setSubmitting(true);

      let logoUrl: string | null = null;
      const photoUrls: string[] = [];

      // Upload logo if provided
      if (data.logoFile) {
        const fileExt = data.logoFile.name.split(".").pop();
        const fileName = `${user.id}-logo-${Date.now()}.${fileExt}`;
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

      // Upload photos
      for (const photo of data.photos) {
        const fileExt = photo.name.split(".").pop();
        const fileName = `${user.id}-photo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
        const filePath = `photos/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("restaurant-photos")
          .upload(filePath, photo);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("restaurant-photos")
          .getPublicUrl(filePath);

        photoUrls.push(urlData.publicUrl);
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
          cuisine_types: data.cuisine_types,
          operating_hours: data.operating_hours,
          avg_prep_time_minutes: data.avg_prep_time_minutes,
          max_meals_per_day: data.max_meals_per_day,
        })
        .select()
        .single();

      if (restaurantError) throw restaurantError;

      // Create restaurant details
      const { error: detailsError } = await supabase
        .from("restaurant_details")
        .insert({
          restaurant_id: restaurant.id,
          cuisine_type: data.cuisine_types,
          dietary_tags: data.dietary_tags,
          website_url: data.website,
          operating_hours: data.operating_hours,
          avg_prep_time_minutes: data.avg_prep_time_minutes,
          max_meals_per_day: data.max_meals_per_day,
          bank_name: data.bank_name,
          bank_account_name: data.bank_account_name,
          bank_account_number: data.bank_account_number,
          bank_iban: data.bank_iban,
          onboarding_completed: true,
          terms_accepted: true,
          terms_accepted_at: new Date().toISOString(),
        });

      if (detailsError) throw detailsError;

      // Add partner role if not already present
      const { data: existingRole } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", user.id)
        .eq("role", "restaurant")
        .maybeSingle();

      if (!existingRole) {
        await supabase.from("user_roles").insert({
          user_id: user.id,
          role: "restaurant",
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
      <div className="container max-w-2xl mx-auto px-4 py-6 sm:py-8">
        {/* Header */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Store className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Register Your Restaurant</h1>
          <p className="text-muted-foreground mt-2">
            Join our platform and start receiving orders
          </p>
        </div>

        {/* Progress */}
        <div className="mb-6 sm:mb-8">
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between mt-3 sm:mt-4">
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
                <span className="text-xs sm:text-sm mt-1 text-center max-w-[80px]">{step.title}</span>
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
          <CardContent className="space-y-4 sm:space-y-6">
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
                      className="h-12 sm:h-10 min-h-[44px] pl-10"
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
                    className="min-h-[100px] sm:min-h-[120px]"
                  />
                  <p className="text-xs text-muted-foreground">
                    Minimum 10 characters ({data.description.length}/10)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Cuisine Types *</Label>
                  <div className="flex flex-wrap gap-2">
                    {CUISINE_TYPES.map((type) => (
                      <Badge
                        key={type}
                        variant={data.cuisine_types.includes(type) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => toggleCuisineType(type)}
                      >
                        {type}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Dietary Tags (Optional)</Label>
                  <div className="flex flex-wrap gap-2">
                    {DIETARY_TAGS.map((tag) => (
                      <Badge
                        key={tag}
                        variant={data.dietary_tags.includes(tag) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => toggleDietaryTag(tag)}
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
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
                      className="h-12 sm:h-10 min-h-[44px] pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number *</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="phone"
                      type="tel"
                      inputMode="tel"
                      value={data.phone}
                      onChange={(e) => updateData("phone", e.target.value)}
                      placeholder="+974 1234 5678"
                      className="h-12 sm:h-10 min-h-[44px] pl-10"
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
                      inputMode="email"
                      value={data.email}
                      onChange={(e) => updateData("email", e.target.value)}
                      placeholder="contact@restaurant.com"
                      className="h-12 sm:h-10 min-h-[44px] pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="website">Website (Optional)</Label>
                  <Input
                    id="website"
                    value={data.website}
                    onChange={(e) => updateData("website", e.target.value)}
                    placeholder="https://your-restaurant.com"
                  />
                </div>

                <div className="space-y-3">
                  <Label>Operating Hours</Label>
                  {DAYS_OF_WEEK.map(({ key, label }) => (
                    <div key={key} className="flex items-center gap-3">
                      <Checkbox
                        checked={data.operating_hours[key]?.is_open}
                        onCheckedChange={(checked) =>
                          updateOperatingHours(key, "is_open", checked)
                        }
                      />
                      <span className="w-24 text-sm">{label}</span>
                      {data.operating_hours[key]?.is_open ? (
                        <div className="flex items-center gap-2 flex-1">
                          <Input
                            type="time"
                            value={data.operating_hours[key]?.open}
                            onChange={(e) =>
                              updateOperatingHours(key, "open", e.target.value)
                            }
                            className="w-24"
                          />
                          <span className="text-muted-foreground">to</span>
                          <Input
                            type="time"
                            value={data.operating_hours[key]?.close}
                            onChange={(e) =>
                              updateOperatingHours(key, "close", e.target.value)
                            }
                            className="w-24"
                          />
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">Closed</span>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            {currentStep === 3 && (
              <div className="space-y-6">
                {/* Logo Upload */}
                <div className="space-y-2">
                  <Label>Restaurant Logo</Label>
                  <div className="border-2 border-dashed border-muted-foreground/25 rounded-xl p-6 sm:p-8 text-center">
                    {data.logoPreview ? (
                      <div className="space-y-4">
                        <img
                          src={data.logoPreview}
                          alt="Logo preview"
                          className="w-24 sm:w-32 h-24 sm:h-32 object-cover rounded-xl mx-auto"
                        />
                        <Button
                          variant="outline"
                          onClick={() => {
                            updateData("logoFile", null);
                            updateData("logoPreview", null);
                          }}
                          className="min-h-[44px]"
                        >
                          Remove Logo
                        </Button>
                      </div>
                    ) : (
                      <label className="cursor-pointer block">
                        <div className="w-16 sm:w-20 h-16 sm:h-20 rounded-xl bg-muted flex items-center justify-center mx-auto mb-4">
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
                </div>

                {/* Photos Upload */}
                <div className="space-y-2">
                  <Label>Restaurant Photos</Label>
                  <div className="border-2 border-dashed border-muted-foreground/25 rounded-xl p-6 text-center">
                    <label className="cursor-pointer block">
                      <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center mx-auto mb-4">
                        <Camera className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <p className="font-medium">Upload photos</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Show your kitchen, dishes, or dining area
                      </p>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handlePhotoUpload}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {/* Photo Previews */}
                  {data.photoPreviews.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 mt-4">
                      {data.photoPreviews.map((preview, index) => (
                        <div key={index} className="relative">
                          <img
                            src={preview}
                            alt={`Photo ${index + 1}`}
                            className="w-full h-24 object-cover rounded-lg"
                          />
                          <button
                            onClick={() => removePhoto(index)}
                            className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-white rounded-full text-xs"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {currentStep === 4 && (
              <>
                <div className="space-y-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <UtensilsCrossed className="h-5 w-5" />
                    Operations
                  </h3>

                  <div className="space-y-2">
                    <Label htmlFor="prep_time">Average Prep Time (minutes) *</Label>
                    <Input
                      id="prep_time"
                      type="number"
                      min={5}
                      max={180}
                      value={data.avg_prep_time_minutes}
                      onChange={(e) =>
                        updateData("avg_prep_time_minutes", parseInt(e.target.value) || 30)
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="capacity">Max Meals Per Day *</Label>
                    <Input
                      id="capacity"
                      type="number"
                      min={1}
                      max={1000}
                      value={data.max_meals_per_day}
                      onChange={(e) =>
                        updateData("max_meals_per_day", parseInt(e.target.value) || 50)
                      }
                    />
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Banking Information
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Required for receiving weekly payouts
                  </p>

                  <div className="space-y-2">
                    <Label htmlFor="bank_name">Bank Name *</Label>
                    <Input
                      id="bank_name"
                      value={data.bank_name}
                      onChange={(e) => updateData("bank_name", e.target.value)}
                      placeholder="e.g., Qatar National Bank"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="account_name">Account Holder Name *</Label>
                    <Input
                      id="account_name"
                      value={data.bank_account_name}
                      onChange={(e) => updateData("bank_account_name", e.target.value)}
                      placeholder="Full name as on bank account"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="account_number">Account Number *</Label>
                    <Input
                      id="account_number"
                      value={data.bank_account_number}
                      onChange={(e) => updateData("bank_account_number", e.target.value)}
                      placeholder="Bank account number"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="iban">IBAN (Optional)</Label>
                    <Input
                      id="iban"
                      value={data.bank_iban}
                      onChange={(e) => updateData("bank_iban", e.target.value)}
                      placeholder="QA00XXXXXXXXXXXXXXXXXXXXXXXX"
                    />
                  </div>
                </div>
              </>
            )}

            {currentStep === 5 && (
              <div className="space-y-4 sm:space-y-6">
                <div className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-muted/50 rounded-xl">
                  {data.logoPreview ? (
                    <img
                      src={data.logoPreview}
                      alt="Logo"
                      className="w-14 sm:w-16 h-14 sm:h-16 object-cover rounded-xl shrink-0"
                    />
                  ) : (
                    <div className="w-14 sm:w-16 h-14 sm:h-16 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Store className="h-8 w-8 text-primary" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-base sm:text-lg">{data.name}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {data.description}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="break-all">{data.address}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span>{data.phone}</span>
                  </div>
                  {data.email && (
                    <div className="flex items-center gap-3 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="break-all">{data.email}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Cuisine Types:</p>
                  <div className="flex flex-wrap gap-1">
                    {data.cuisine_types.map((type) => (
                      <Badge key={type} variant="secondary" className="text-xs">
                        {type}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Operations:</p>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>• Average prep time: {data.avg_prep_time_minutes} minutes</p>
                    <p>• Max meals per day: {data.max_meals_per_day}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Bank Account:</p>
                  <p className="text-sm text-muted-foreground">
                    {data.bank_name} - {data.bank_account_name}
                  </p>
                </div>

                <div className="p-3 sm:p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                  <p className="text-sm text-amber-600">
                    <strong>Note:</strong> Your restaurant will be reviewed by our team before
                    appearing on the platform. This usually takes 1-2 business days.
                  </p>
                </div>

                <div className="flex items-start gap-3 p-4 border rounded-lg">
                  <Checkbox
                    id="terms"
                    checked={data.terms_accepted}
                    onCheckedChange={(checked) =>
                      updateData("terms_accepted", checked === true)
                    }
                    className="mt-1"
                  />
                  <div>
                    <Label htmlFor="terms" className="cursor-pointer">
                      I agree to the terms and conditions *
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      By submitting, you agree to our partner terms, commission structure,
                      and platform policies.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex flex-col sm:flex-row justify-between gap-2 sm:gap-4 pt-4">
              <Button
                variant="outline"
                onClick={() => setCurrentStep((prev) => prev - 1)}
                disabled={currentStep === 1}
                className="w-full sm:w-auto min-h-[44px]"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>

              {currentStep < 5 ? (
                <Button
                  onClick={() => setCurrentStep((prev) => prev + 1)}
                  disabled={!canProceed()}
                  className="w-full sm:w-auto min-h-[44px]"
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={submitting} className="w-full sm:w-auto min-h-[44px]">
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
