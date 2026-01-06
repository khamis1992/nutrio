import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Save, User, Mail, Phone, MapPin, Store, Building } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { PartnerLayout } from "@/components/PartnerLayout";
import { LogoUpload } from "@/components/LogoUpload";

const PartnerProfile = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<{ full_name: string | null; avatar_url: string | null }>({ full_name: null, avatar_url: null });
  const [restaurant, setRestaurant] = useState<any>(null);

  useEffect(() => { if (user) fetchData(); }, [user]);

  const fetchData = async () => {
    if (!user) return;
    const { data: profileData } = await supabase.from("profiles").select("full_name, avatar_url").eq("user_id", user.id).maybeSingle();
    if (profileData) setProfile(profileData);
    const { data: restaurantData } = await supabase.from("restaurants").select("*").eq("owner_id", user.id).maybeSingle();
    if (restaurantData) setRestaurant(restaurantData);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    await supabase.from("profiles").update({ full_name: profile.full_name }).eq("user_id", user.id);
    if (restaurant) {
      await supabase.from("restaurants").update({
        name: restaurant.name,
        description: restaurant.description,
        address: restaurant.address,
        phone: restaurant.phone,
        email: restaurant.email,
        logo_url: restaurant.logo_url,
      }).eq("id", restaurant.id);
    }
    toast({ title: "Profile updated successfully" });
    setSaving(false);
  };

  const handleLogoChange = (url: string | null) => {
    setRestaurant((prev: any) => prev ? { ...prev, logo_url: url } : prev);
  };

  if (loading) return <PartnerLayout title="Profile"><Skeleton className="h-64 w-full" /></PartnerLayout>;

  return (
    <PartnerLayout title="Profile" subtitle="Manage your personal and restaurant details">
      <div className="space-y-6 max-w-2xl">
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />{saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>

        {/* Personal Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="h-5 w-5" />Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={profile.avatar_url || undefined} />
                <AvatarFallback className="text-xl">{profile.full_name?.charAt(0) || user?.email?.charAt(0) || "P"}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{profile.full_name || "Partner"}</p>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={profile.full_name || ""} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} placeholder="Your full name" />
            </div>
          </CardContent>
        </Card>

        {/* Restaurant Information */}
        {restaurant && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Store className="h-5 w-5" />Restaurant Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Logo Upload */}
              <LogoUpload
                currentLogoUrl={restaurant.logo_url}
                onLogoChange={handleLogoChange}
                restaurantId={restaurant.id}
              />

              {/* Basic Details */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Restaurant Name</Label>
                  <Input value={restaurant.name} onChange={(e) => setRestaurant({ ...restaurant, name: e.target.value })} placeholder="Restaurant name" />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea 
                    value={restaurant.description || ""} 
                    onChange={(e) => setRestaurant({ ...restaurant, description: e.target.value })} 
                    rows={4} 
                    placeholder="Describe your restaurant, cuisine, specialties..."
                  />
                </div>
              </div>

              {/* Contact Details */}
              <div className="space-y-4 pt-4 border-t">
                <h4 className="font-medium flex items-center gap-2 text-sm">
                  <Building className="h-4 w-4" />Contact Details
                </h4>
                <div className="space-y-2">
                  <Label>Address</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input value={restaurant.address || ""} onChange={(e) => setRestaurant({ ...restaurant, address: e.target.value })} className="pl-10" placeholder="Full address" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input value={restaurant.phone || ""} onChange={(e) => setRestaurant({ ...restaurant, phone: e.target.value })} className="pl-10" placeholder="+1 (555) 000-0000" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input type="email" value={restaurant.email || ""} onChange={(e) => setRestaurant({ ...restaurant, email: e.target.value })} className="pl-10" placeholder="restaurant@example.com" />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </PartnerLayout>
  );
};

export default PartnerProfile;
