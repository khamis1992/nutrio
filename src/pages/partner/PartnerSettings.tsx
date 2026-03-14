import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { LogoUpload } from "@/components/LogoUpload";
import { Save, Mail, Phone, MapPin, Loader2, DollarSign, Clock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { PartnerLayout } from "@/components/PartnerLayout";
import { useNavigate } from "react-router-dom";

interface Restaurant {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  payout_rate: number;     // Gross per-meal price the restaurant charges
  commission_rate: number; // % platform takes (set by admin)
  operating_hours: Record<string, { open: string; close: string; closed: boolean }> | null;
}

const DAYS = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
];

const DEFAULT_HOURS = { open: "09:00", close: "21:00", closed: false };

const PartnerSettings = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    logo_url: "",
    address: "",
    phone: "",
    email: "",
    is_active: true,
  });
  const [operatingHours, setOperatingHours] = useState<Record<string, { open: string; close: string; closed: boolean }>>(
    () => Object.fromEntries(DAYS.map((d) => [d.key, { ...DEFAULT_HOURS }]))
  );

  useEffect(() => {
    if (user) {
      fetchRestaurant();
    }
  }, [user]);

  const fetchRestaurant = async () => {
    if (!user) return;

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("restaurants")
        .select("*")
        .eq("owner_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        navigate("/partner");
        return;
      }

      setRestaurant(data);
      setFormData({
        name: data.name || "",
        description: data.description || "",
        logo_url: data.logo_url || "",
        address: data.address || "",
        phone: data.phone || "",
        email: data.email || "",
        is_active: data.is_active,
      });
      if (data.operating_hours) {
        setOperatingHours(
          Object.fromEntries(
            DAYS.map((d) => [
              d.key,
              (data.operating_hours as any)?.[d.key] ?? { ...DEFAULT_HOURS },
            ])
          )
        );
      }
    } catch (error) {
      console.error("Error fetching restaurant:", error);
      toast({
        title: "Error",
        description: "Failed to load settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!restaurant) return;

    try {
      setSaving(true);

      const { error } = await supabase
        .from("restaurants")
        .update({
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          logo_url: formData.logo_url.trim() || null,
          address: formData.address.trim() || null,
          phone: formData.phone.trim() || null,
          email: formData.email.trim() || null,
          is_active: formData.is_active,
          operating_hours: operatingHours,
        })
        .eq("id", restaurant.id);

      if (error) throw error;

      toast({ title: "Settings saved" });
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({
        title: "Error",
        description: "Failed to save settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <PartnerLayout title="Settings">
        <div className="space-y-4">
          <Skeleton className="h-64 w-full" />
        </div>
      </PartnerLayout>
    );
  }

  return (
    <PartnerLayout title="Settings" subtitle="Restaurant settings">
      <div className="space-y-6 max-w-2xl">
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>Your restaurant's public profile</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Restaurant Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Your Restaurant Name"
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe your restaurant and cuisine..."
                rows={3}
              />
            </div>

            <LogoUpload
              currentLogoUrl={formData.logo_url}
              onLogoChange={(url) => setFormData({ ...formData, logo_url: url || "" })}
              restaurantId={restaurant?.id}
            />
          </CardContent>
        </Card>

        {/* Payout Rate Information - Subscription Model */}
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Platform Commission
            </CardTitle>
            <CardDescription>
              Set by the platform admin. Applied to each meal order you fulfil.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 rounded-xl bg-amber-50 border border-amber-200 p-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-100">
                <DollarSign className="h-6 w-6 text-amber-700" />
              </div>
              <div>
                <p className="text-3xl font-black text-amber-700">
                  {restaurant?.commission_rate ?? 18}%
                </p>
                <p className="text-sm text-amber-600">
                  Nutrio takes this percentage from each meal you sell. Contact admin to adjust.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
            <CardDescription>How customers can reach you</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><MapPin className="h-4 w-4" />Address</Label>
              <Input
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="123 Main St, City, State"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Phone className="h-4 w-4" />Phone Number</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+1 (555) 123-4567"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Mail className="h-4 w-4" />Email Address</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="contact@restaurant.com"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Availability</CardTitle>
            <CardDescription>Control your restaurant's visibility</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <Label>Restaurant Active</Label>
                <p className="text-sm text-muted-foreground">When disabled, your restaurant won't appear in search results</p>
              </div>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Operating Hours
            </CardTitle>
            <CardDescription>Set your kitchen's open and close times for each day</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {DAYS.map((day) => {
              const hours = operatingHours[day.key];
              return (
                <div key={day.key} className="flex items-center gap-3">
                  <div className="w-24 shrink-0">
                    <span className="text-sm font-medium">{day.label}</span>
                  </div>
                  <Switch
                    checked={!hours.closed}
                    onCheckedChange={(open) =>
                      setOperatingHours((prev) => ({
                        ...prev,
                        [day.key]: { ...prev[day.key], closed: !open },
                      }))
                    }
                  />
                  {hours.closed ? (
                    <span className="text-sm text-muted-foreground">Closed</span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Input
                        type="time"
                        value={hours.open}
                        className="w-32"
                        onChange={(e) =>
                          setOperatingHours((prev) => ({
                            ...prev,
                            [day.key]: { ...prev[day.key], open: e.target.value },
                          }))
                        }
                      />
                      <span className="text-sm text-muted-foreground">to</span>
                      <Input
                        type="time"
                        value={hours.close}
                        className="w-32"
                        onChange={(e) =>
                          setOperatingHours((prev) => ({
                            ...prev,
                            [day.key]: { ...prev[day.key], close: e.target.value },
                          }))
                        }
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </PartnerLayout>
  );
};

export default PartnerSettings;
