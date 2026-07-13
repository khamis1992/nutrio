import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Clock,
  DollarSign,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Save,
  Settings,
  Store,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { LogoUpload } from "@/components/LogoUpload";
import { PartnerLayout } from "@/components/PartnerLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Restaurant {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  payout_rate: number;
  commission_rate: number;
  operating_hours: Record<
    string,
    { open: string; close: string; closed: boolean }
  > | null;
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

const inputClass =
  "min-h-11 rounded-2xl border-[#E5EAF1] bg-[#F6F8FB] font-bold text-[#020617] placeholder:text-[#94A3B8]";

const labelClass =
  "text-xs font-black uppercase tracking-[0.12em] text-[#94A3B8]";

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
  const [operatingHours, setOperatingHours] = useState<
    Record<string, { open: string; close: string; closed: boolean }>
  >(() => Object.fromEntries(DAYS.map((d) => [d.key, { ...DEFAULT_HOURS }])));

  useEffect(() => {
    if (user) {
      fetchRestaurant();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      setRestaurant({
        id: data.id,
        name: data.name,
        description: data.description,
        logo_url: data.logo_url,
        address: data.address,
        phone: data.phone,
        email: data.email,
        is_active: data.is_active ?? false,
        payout_rate: data.payout_rate || 0,
        commission_rate: data.commission_rate || 0,
        operating_hours: data.operating_hours as Restaurant["operating_hours"],
      });
      setFormData({
        name: data.name || "",
        description: data.description || "",
        logo_url: data.logo_url || "",
        address: data.address || "",
        phone: data.phone || "",
        email: data.email || "",
        is_active: data.is_active ?? false,
      });

      if (data.operating_hours) {
        const savedHours = data.operating_hours as Record<
          string,
          { open?: string; close?: string; closed?: boolean }
        >;
        setOperatingHours(
          Object.fromEntries(
            DAYS.map((d) => [
              d.key,
              {
                ...DEFAULT_HOURS,
                ...(savedHours[d.key] ?? {}),
              },
            ]),
          ),
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
      <PartnerLayout title="Settings" subtitle="Restaurant settings">
        <div className="-m-6 min-h-screen bg-[#F6F8FB] p-4 sm:p-6">
          <div className="mx-auto max-w-6xl space-y-4">
            <Skeleton className="h-52 rounded-[30px] bg-white" />
            <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
              <Skeleton className="h-80 rounded-[28px] bg-white" />
              <Skeleton className="h-80 rounded-[28px] bg-white" />
            </div>
          </div>
        </div>
      </PartnerLayout>
    );
  }

  const commissionRate = restaurant?.commission_rate ?? 18;
  const payoutRate = restaurant?.payout_rate ?? 0;
  const netPerMeal = payoutRate * (1 - commissionRate / 100);
  const activeDays = DAYS.filter(
    (day) => !operatingHours[day.key]?.closed,
  ).length;

  return (
    <PartnerLayout title="Settings" subtitle="Restaurant settings">
      <div className="-m-6 min-h-screen bg-[#F6F8FB] p-4 text-[#020617] sm:p-6">
        <div className="mx-auto max-w-6xl space-y-4">
          <section className="overflow-hidden rounded-[30px] border border-[#E5EAF1] bg-white shadow-sm">
            <div className="grid gap-0 lg:grid-cols-[1.08fr_0.92fr]">
              <div className="space-y-5 p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-[#7C83F6]/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-[#7C83F6]">
                      <Settings className="h-3.5 w-3.5" />
                      Restaurant controls
                    </div>
                    <h1 className="mt-3 text-2xl font-black tracking-tight text-[#020617] sm:text-3xl">
                      Partner settings
                    </h1>
                    <p className="mt-2 max-w-xl text-sm font-medium leading-6 text-[#64748B]">
                      Manage public restaurant details, visibility, platform
                      commission, and kitchen operating hours.
                    </p>
                  </div>
                  <Button
                    className="min-h-11 rounded-2xl bg-[#020617] px-5 font-black text-white hover:bg-[#020617]/90"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Save
                  </Button>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-[#22C7A1]/20 bg-[#22C7A1]/10 p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#0B9B7E]">
                      Visibility
                    </p>
                    <p className="mt-1 text-sm font-black text-[#020617]">
                      {formData.is_active ? "Active" : "Hidden"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[#38BDF8]/20 bg-[#38BDF8]/10 p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#0284C7]">
                      Open days
                    </p>
                    <p className="mt-1 text-sm font-black text-[#020617]">
                      {activeDays}/7
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[#F97316]/20 bg-[#F97316]/10 p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#F97316]">
                      Commission
                    </p>
                    <p className="mt-1 text-sm font-black text-[#020617]">
                      {commissionRate}%
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-[#020617] p-5 text-white sm:p-6">
                <div className="flex h-full flex-col justify-between gap-6 rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/55">
                      Revenue structure
                    </p>
                    <p className="mt-3 text-4xl font-black tracking-tight">
                      {netPerMeal > 0 ? netPerMeal.toFixed(2) : "-"} QAR
                    </p>
                    <p className="mt-3 text-sm font-semibold leading-6 text-white/65">
                      Estimated net per meal after platform commission. Gross
                      meal rate and commission are managed by admin.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-2xl bg-white/10 p-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/45">
                        Gross / meal
                      </p>
                      <p className="mt-1 text-lg font-black text-white">
                        {payoutRate > 0 ? payoutRate.toFixed(2) : "-"}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white/10 p-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/45">
                        Fee
                      </p>
                      <p className="mt-1 text-lg font-black text-white">
                        {commissionRate}%
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-4">
              <div className="rounded-[28px] border border-[#E5EAF1] bg-white p-5 shadow-sm">
                <div className="mb-5 flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#22C7A1]/10 text-[#0B9B7E]">
                    <Store className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-[#7C83F6]">
                      Public profile
                    </p>
                    <h2 className="mt-1 text-xl font-black tracking-tight text-[#020617]">
                      Basic information
                    </h2>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className={labelClass}>Restaurant Name *</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      placeholder="Your Restaurant Name"
                      className={inputClass}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className={labelClass}>Description</Label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          description: e.target.value,
                        })
                      }
                      placeholder="Describe your restaurant and cuisine..."
                      rows={4}
                      className="min-h-[120px] rounded-2xl border-[#E5EAF1] bg-[#F6F8FB] font-bold text-[#020617] placeholder:text-[#94A3B8]"
                    />
                  </div>
                  <LogoUpload
                    currentLogoUrl={formData.logo_url}
                    onLogoChange={(url) =>
                      setFormData({ ...formData, logo_url: url || "" })
                    }
                    restaurantId={restaurant?.id}
                  />
                </div>
              </div>

              <div className="rounded-[28px] border border-[#E5EAF1] bg-white p-5 shadow-sm">
                <div className="mb-5 flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F97316]/10 text-[#F97316]">
                    <DollarSign className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-[#7C83F6]">
                      Platform
                    </p>
                    <h2 className="mt-1 text-xl font-black tracking-tight text-[#020617]">
                      Commission
                    </h2>
                  </div>
                </div>

                <div className="rounded-[24px] border border-[#F97316]/20 bg-[#F97316]/10 p-4">
                  <p className="text-4xl font-black text-[#020617]">
                    {commissionRate}%
                  </p>
                  <p className="mt-2 text-sm font-medium leading-6 text-[#64748B]">
                    Nutrio takes this percentage from each meal sold. Contact
                    admin to adjust the restaurant commission structure.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-[28px] border border-[#E5EAF1] bg-white p-5 shadow-sm">
                <div className="mb-5 flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#38BDF8]/10 text-[#0284C7]">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-[#7C83F6]">
                      Contact
                    </p>
                    <h2 className="mt-1 text-xl font-black tracking-tight text-[#020617]">
                      Customer details
                    </h2>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className={labelClass}>Address</Label>
                    <div className="relative">
                      <MapPin className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
                      <Input
                        value={formData.address}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            address: e.target.value,
                          })
                        }
                        placeholder="123 Main St, Doha"
                        className={`${inputClass} pl-11`}
                      />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className={labelClass}>Phone Number</Label>
                      <div className="relative">
                        <Phone className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
                        <Input
                          value={formData.phone}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              phone: e.target.value,
                            })
                          }
                          placeholder="+974 0000 0000"
                          className={`${inputClass} pl-11`}
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className={labelClass}>Email Address</Label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
                        <Input
                          type="email"
                          value={formData.email}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              email: e.target.value,
                            })
                          }
                          placeholder="contact@restaurant.com"
                          className={`${inputClass} pl-11`}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-[#E5EAF1] bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#22C7A1]/10 text-[#0B9B7E]">
                      <Store className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-[#7C83F6]">
                        Availability
                      </p>
                      <h2 className="mt-1 text-xl font-black tracking-tight text-[#020617]">
                        Restaurant active
                      </h2>
                      <p className="mt-1 text-sm font-medium text-[#64748B]">
                        When disabled, your restaurant will not appear in
                        customer search results.
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, is_active: checked })
                    }
                  />
                </div>
              </div>

              <div className="rounded-[28px] border border-[#E5EAF1] bg-white p-5 shadow-sm">
                <div className="mb-5 flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#7C83F6]/10 text-[#7C83F6]">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-[#7C83F6]">
                      Schedule
                    </p>
                    <h2 className="mt-1 text-xl font-black tracking-tight text-[#020617]">
                      Operating hours
                    </h2>
                  </div>
                </div>

                <div className="space-y-3">
                  {DAYS.map((day) => {
                    const hours = operatingHours[day.key] ?? DEFAULT_HOURS;
                    return (
                      <div
                        key={day.key}
                        className="rounded-[22px] border border-[#E5EAF1] bg-[#F6F8FB] p-3"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                          <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                            <span className="text-sm font-black text-[#020617]">
                              {day.label}
                            </span>
                            <Switch
                              checked={!hours.closed}
                              onCheckedChange={(open) =>
                                setOperatingHours((prev) => ({
                                  ...prev,
                                  [day.key]: {
                                    ...prev[day.key],
                                    closed: !open,
                                  },
                                }))
                              }
                            />
                          </div>

                          {hours.closed ? (
                            <span className="rounded-full bg-[#FB6B7A]/10 px-3 py-2 text-xs font-black text-[#FB6B7A]">
                              Closed
                            </span>
                          ) : (
                            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:w-[270px]">
                              <Input
                                type="time"
                                value={hours.open}
                                className={inputClass}
                                onChange={(e) =>
                                  setOperatingHours((prev) => ({
                                    ...prev,
                                    [day.key]: {
                                      ...prev[day.key],
                                      open: e.target.value,
                                    },
                                  }))
                                }
                              />
                              <span className="text-xs font-black text-[#94A3B8]">
                                to
                              </span>
                              <Input
                                type="time"
                                value={hours.close}
                                className={inputClass}
                                onChange={(e) =>
                                  setOperatingHours((prev) => ({
                                    ...prev,
                                    [day.key]: {
                                      ...prev[day.key],
                                      close: e.target.value,
                                    },
                                  }))
                                }
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </PartnerLayout>
  );
};

export default PartnerSettings;
