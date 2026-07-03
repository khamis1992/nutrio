import { useEffect, useState } from "react";
import {
  Building,
  Mail,
  MapPin,
  Navigation,
  Phone,
  Save,
  Store,
  User,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { LogoUpload } from "@/components/LogoUpload";
import { PartnerLayout } from "@/components/PartnerLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface RestaurantProfile {
  id: string;
  name: string;
  description: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  logo_url: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface PartnerUserProfile {
  full_name: string | null;
  avatar_url: string | null;
}

const inputClass =
  "min-h-11 rounded-2xl border-[#E5EAF1] bg-[#F6F8FB] font-bold text-[#020617] placeholder:text-[#94A3B8]";

const labelClass =
  "text-xs font-black uppercase tracking-[0.12em] text-[#94A3B8]";

const PartnerProfile = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [profile, setProfile] = useState<PartnerUserProfile>({
    full_name: null,
    avatar_url: null,
  });
  const [restaurant, setRestaurant] = useState<RestaurantProfile | null>(null);

  useEffect(() => {
    if (user) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchData = async () => {
    if (!user) return;

    const { data: profileData } = await supabase
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("user_id", user.id)
      .maybeSingle();
    if (profileData) setProfile(profileData);

    const { data: restaurantData } = await supabase
      .from("restaurants")
      .select("*")
      .eq("owner_id", user.id)
      .maybeSingle();
    if (restaurantData) setRestaurant(restaurantData);

    setLoading(false);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    await supabase
      .from("profiles")
      .update({ full_name: profile.full_name })
      .eq("user_id", user.id);

    if (restaurant) {
      await supabase
        .from("restaurants")
        .update({
          name: restaurant.name,
          description: restaurant.description,
          address: restaurant.address,
          phone: restaurant.phone,
          email: restaurant.email,
          logo_url: restaurant.logo_url,
          latitude: restaurant.latitude ?? null,
          longitude: restaurant.longitude ?? null,
        })
        .eq("id", restaurant.id);
    }

    toast({ title: "Profile updated successfully" });
    setSaving(false);
  };

  const handleLogoChange = (url: string | null) => {
    setRestaurant((prev) => (prev ? { ...prev, logo_url: url } : prev));
  };

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      toast({
        title: "Geolocation not supported",
        description: "Your browser does not support location detection.",
        variant: "destructive",
      });
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setRestaurant((prev) =>
          prev
            ? {
                ...prev,
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
              }
            : prev,
        );
        setLocating(false);
        toast({
          title: "Location detected",
          description: "Coordinates have been filled in. Save to confirm.",
        });
      },
      () => {
        setLocating(false);
        toast({
          title: "Location access denied",
          description:
            "Please allow location access or enter coordinates manually.",
          variant: "destructive",
        });
      },
    );
  };

  if (loading) {
    return (
      <PartnerLayout
        title="Profile"
        subtitle="Manage your personal and restaurant details"
      >
        <div className="-m-6 min-h-screen bg-[#F6F8FB] p-4 sm:p-6">
          <div className="mx-auto max-w-5xl space-y-4">
            <Skeleton className="h-52 rounded-[30px] bg-white" />
            <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
              <Skeleton className="h-80 rounded-[28px] bg-white" />
              <Skeleton className="h-80 rounded-[28px] bg-white" />
            </div>
          </div>
        </div>
      </PartnerLayout>
    );
  }

  const profileName = profile.full_name || "Partner";
  const hasLocation = restaurant?.latitude && restaurant?.longitude;

  return (
    <PartnerLayout
      title="Profile"
      subtitle="Manage your personal and restaurant details"
    >
      <div className="-m-6 min-h-screen bg-[#F6F8FB] p-4 text-[#020617] sm:p-6">
        <div className="mx-auto max-w-5xl space-y-4">
          <section className="overflow-hidden rounded-[30px] border border-[#E5EAF1] bg-white shadow-sm">
            <div className="grid gap-0 lg:grid-cols-[1.08fr_0.92fr]">
              <div className="space-y-5 p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-[#7C83F6]/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-[#7C83F6]">
                      <Store className="h-3.5 w-3.5" />
                      Partner profile
                    </div>
                    <h1 className="mt-3 text-2xl font-black tracking-tight text-[#020617] sm:text-3xl">
                      {restaurant?.name || "Restaurant profile"}
                    </h1>
                    <p className="mt-2 max-w-xl text-sm font-medium leading-6 text-[#64748B]">
                      Keep owner identity, restaurant details, and driver pickup
                      location accurate for customer orders and operations.
                    </p>
                  </div>
                  <Button
                    className="min-h-11 rounded-2xl bg-[#020617] px-5 font-black text-white hover:bg-[#020617]/90"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {saving ? "Saving..." : "Save"}
                  </Button>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-[#E5EAF1] bg-[#F6F8FB] p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                      Owner
                    </p>
                    <p className="mt-1 truncate text-sm font-black text-[#020617]">
                      {profileName}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[#22C7A1]/20 bg-[#22C7A1]/10 p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#0B9B7E]">
                      Status
                    </p>
                    <p className="mt-1 text-sm font-black text-[#020617]">
                      Active
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[#38BDF8]/20 bg-[#38BDF8]/10 p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#0284C7]">
                      Location
                    </p>
                    <p className="mt-1 text-sm font-black text-[#020617]">
                      {hasLocation ? "Ready" : "Needed"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-[#020617] p-5 text-white sm:p-6">
                <div className="flex h-full flex-col justify-between gap-6 rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-20 w-20 border-4 border-white/10">
                      <AvatarImage src={profile.avatar_url || undefined} />
                      <AvatarFallback className="bg-white text-2xl font-black text-[#020617]">
                        {profile.full_name?.charAt(0) ||
                          user?.email?.charAt(0) ||
                          "P"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-2xl font-black">
                        {profileName}
                      </p>
                      <p className="mt-1 truncate text-sm font-semibold text-white/55">
                        {user?.email}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-2xl bg-white/10 p-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/45">
                        Phone
                      </p>
                      <p className="mt-1 truncate text-sm font-black text-white">
                        {restaurant?.phone || "Not set"}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white/10 p-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/45">
                        Email
                      </p>
                      <p className="mt-1 truncate text-sm font-black text-white">
                        {restaurant?.email || "Not set"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-[0.82fr_1.18fr]">
            <div className="space-y-4">
              <div className="rounded-[28px] border border-[#E5EAF1] bg-white p-5 shadow-sm">
                <div className="mb-5 flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#7C83F6]/10 text-[#7C83F6]">
                    <User className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-[#7C83F6]">
                      Personal
                    </p>
                    <h2 className="mt-1 text-xl font-black tracking-tight text-[#020617]">
                      Owner information
                    </h2>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className={labelClass}>Full Name</Label>
                    <Input
                      value={profile.full_name || ""}
                      onChange={(e) =>
                        setProfile({ ...profile, full_name: e.target.value })
                      }
                      placeholder="Your full name"
                      className={inputClass}
                    />
                  </div>
                  <div className="rounded-2xl border border-[#E5EAF1] bg-[#F6F8FB] p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                      Login email
                    </p>
                    <p className="mt-1 truncate text-sm font-black text-[#020617]">
                      {user?.email}
                    </p>
                  </div>
                </div>
              </div>

              {restaurant && (
                <div className="rounded-[28px] border border-[#E5EAF1] bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-[#7C83F6]">
                        Logo
                      </p>
                      <h2 className="mt-1 text-xl font-black tracking-tight text-[#020617]">
                        Brand image
                      </h2>
                    </div>
                    <Badge className="rounded-full bg-[#22C7A1]/10 font-black text-[#0B9B7E] hover:bg-[#22C7A1]/10">
                      Public
                    </Badge>
                  </div>
                  <LogoUpload
                    currentLogoUrl={restaurant.logo_url}
                    onLogoChange={handleLogoChange}
                    restaurantId={restaurant.id}
                  />
                </div>
              )}
            </div>

            {restaurant && (
              <div className="space-y-4">
                <div className="rounded-[28px] border border-[#E5EAF1] bg-white p-5 shadow-sm">
                  <div className="mb-5 flex items-start gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#22C7A1]/10 text-[#0B9B7E]">
                      <Store className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-[#7C83F6]">
                        Restaurant
                      </p>
                      <h2 className="mt-1 text-xl font-black tracking-tight text-[#020617]">
                        Business details
                      </h2>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label className={labelClass}>Restaurant Name</Label>
                      <Input
                        value={restaurant.name}
                        onChange={(e) =>
                          setRestaurant({
                            ...restaurant,
                            name: e.target.value,
                          })
                        }
                        placeholder="Restaurant name"
                        className={inputClass}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className={labelClass}>Description</Label>
                      <Textarea
                        value={restaurant.description || ""}
                        onChange={(e) =>
                          setRestaurant({
                            ...restaurant,
                            description: e.target.value,
                          })
                        }
                        rows={4}
                        placeholder="Describe your restaurant, cuisine, specialties..."
                        className="min-h-[120px] rounded-2xl border-[#E5EAF1] bg-[#F6F8FB] font-bold text-[#020617] placeholder:text-[#94A3B8]"
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-[28px] border border-[#E5EAF1] bg-white p-5 shadow-sm">
                  <div className="mb-5 flex items-start gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#38BDF8]/10 text-[#0284C7]">
                      <Building className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-[#7C83F6]">
                        Contact
                      </p>
                      <h2 className="mt-1 text-xl font-black tracking-tight text-[#020617]">
                        Customer-facing details
                      </h2>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label className={labelClass}>Address</Label>
                      <div className="relative">
                        <MapPin className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
                        <Input
                          value={restaurant.address || ""}
                          onChange={(e) =>
                            setRestaurant({
                              ...restaurant,
                              address: e.target.value,
                            })
                          }
                          className={`${inputClass} pl-11`}
                          placeholder="Full address"
                        />
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className={labelClass}>Phone</Label>
                        <div className="relative">
                          <Phone className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
                          <Input
                            type="tel"
                            inputMode="tel"
                            value={restaurant.phone || ""}
                            onChange={(e) =>
                              setRestaurant({
                                ...restaurant,
                                phone: e.target.value,
                              })
                            }
                            className={`${inputClass} pl-11`}
                            placeholder="+974 0000 0000"
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className={labelClass}>Email</Label>
                        <div className="relative">
                          <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
                          <Input
                            type="email"
                            inputMode="email"
                            value={restaurant.email || ""}
                            onChange={(e) =>
                              setRestaurant({
                                ...restaurant,
                                email: e.target.value,
                              })
                            }
                            className={`${inputClass} pl-11`}
                            placeholder="restaurant@example.com"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-[28px] border border-[#E5EAF1] bg-white p-5 shadow-sm">
                  <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F97316]/10 text-[#F97316]">
                        <Navigation className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#7C83F6]">
                          Pickup
                        </p>
                        <h2 className="mt-1 text-xl font-black tracking-tight text-[#020617]">
                          Driver location
                        </h2>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11 rounded-2xl border-[#E5EAF1] bg-white font-black text-[#020617] hover:bg-[#F6F8FB]"
                      onClick={handleDetectLocation}
                      disabled={locating}
                    >
                      <Navigation className="mr-2 h-4 w-4" />
                      {locating ? "Detecting..." : "Use current location"}
                    </Button>
                  </div>

                  <p className="mb-4 text-sm font-medium leading-6 text-[#64748B]">
                    Coordinates are shared with drivers for pickup navigation.
                  </p>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className={labelClass}>Latitude</Label>
                      <Input
                        type="number"
                        inputMode="decimal"
                        value={restaurant.latitude ?? ""}
                        onChange={(e) =>
                          setRestaurant({
                            ...restaurant,
                            latitude: e.target.value
                              ? parseFloat(e.target.value)
                              : null,
                          })
                        }
                        className={inputClass}
                        placeholder="e.g. 25.2854"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className={labelClass}>Longitude</Label>
                      <Input
                        type="number"
                        inputMode="decimal"
                        value={restaurant.longitude ?? ""}
                        onChange={(e) =>
                          setRestaurant({
                            ...restaurant,
                            longitude: e.target.value
                              ? parseFloat(e.target.value)
                              : null,
                          })
                        }
                        className={inputClass}
                        placeholder="e.g. 51.5310"
                      />
                    </div>
                  </div>

                  {hasLocation && (
                    <a
                      href={`https://www.google.com/maps?q=${restaurant.latitude},${restaurant.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-2xl border border-[#38BDF8]/25 bg-[#38BDF8]/10 px-4 text-sm font-black text-[#0284C7]"
                    >
                      <MapPin className="h-4 w-4" />
                      View on Google Maps
                    </a>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </PartnerLayout>
  );
};

export default PartnerProfile;
