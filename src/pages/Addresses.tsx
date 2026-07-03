import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Plus, Edit2, Trash2, Check, Home, Briefcase, Star, Phone, Locate, Navigation } from "lucide-react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Circle, useMapEvents, useMap } from "react-leaflet";

// Fix Leaflet's default broken icon URLs when bundled with Vite
delete (L.Icon.Default.prototype as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

interface Address {
  id: string;
  user_id: string;
  label: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string | null;
  postal_code: string;
  country: string;
  phone: string | null;
  is_default: boolean;
  delivery_instructions: string | null;
  created_at: string;
}

const addressSchema = z.object({
  label: z.string().min(1, "Label is required").max(50, "Label must be less than 50 characters"),
  address_line1: z.string().min(1, "Address is required").max(200, "Address must be less than 200 characters"),
  address_line2: z.string().max(200, "Address must be less than 200 characters").optional(),
  city: z.string().min(1, "City is required").max(100, "City must be less than 100 characters"),
  state: z.string().max(100, "State must be less than 100 characters").optional(),
  postal_code: z.string().min(1, "Postal code is required").max(20, "Postal code must be less than 20 characters"),
  country: z.string().min(1, "Country is required").max(100, "Country must be less than 100 characters"),
  phone: z.string().max(20, "Phone must be less than 20 characters").optional(),
  delivery_instructions: z.string().max(500, "Instructions must be less than 500 characters").optional(),
  is_default: z.boolean().optional()
});

type AddressFormData = z.infer<typeof addressSchema>;

const emptyForm: AddressFormData = {
  label: "Home",
  address_line1: "",
  address_line2: "",
  city: "",
  state: "",
  postal_code: "",
  country: "United States",
  phone: "",
  delivery_instructions: "",
  is_default: false
};

// ── Map sub-components ────────────────────────────────────────────────────

// Imperatively moves the map view whenever `position` changes
const SetMapView = ({ position, zoom = 16 }: { position: [number, number]; zoom?: number }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(position, zoom, { animate: true });
    // Invalidate size after dialog animation settles
    setTimeout(() => map.invalidateSize(), 300);
  }, [map, position, zoom]);
  return null;
};

// Listens for map clicks and moves the pin
const ClickHandler = ({ onPick }: { onPick: (lat: number, lng: number) => void }) => {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

// ── Addresses page ────────────────────────────────────────────────────────

const Addresses = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { t } = useLanguage();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [addressToDelete, setAddressToDelete] = useState<Address | null>(null);
  const [formData, setFormData] = useState<AddressFormData>(emptyForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Map / location state
  const [pinPosition, setPinPosition] = useState<[number, number] | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null); // metres
  const watchIdRef = useRef<number | null>(null);
  
  const labelOptions = [t("label_home"), t("label_work"), t("label_office"), t("label_other")];

  // Forward-geocode with fallback chain using Nominatim
  const forwardGeocode = useCallback(async (queries: string[]) => {
    // Skip geocoding on localhost due to CORS restrictions
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      // Set a default position for Doha, Qatar in development
      setPinPosition([25.2854, 51.5310]);
      return;
    }

    for (const query of queries) {
      if (!query.trim()) continue;
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=qa`,
          { headers: { "Accept-Language": "en" } }
        );
        const data = await res.json();
        if (data && data.length > 0) {
          const lat = parseFloat(data[0].lat);
          const lng = parseFloat(data[0].lon);
          setPinPosition([lat, lng]);
          return; // stop at first successful result
        }
      } catch {
        // try next query
      }
    }
  }, []);

  // Reverse-geocode with Nominatim and fill form fields
  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    try {
      // Check if running on localhost (CORS issues with Nominatim)
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        // In development, just set coordinates without reverse geocoding
        setFormData(prev => ({
          ...prev,
          address_line1: prev.address_line1 || `Location at ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
          city: prev.city || 'Doha',
          country: prev.country || 'Qatar',
        }));
        return;
      }

      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
        { headers: { "Accept-Language": "en" } }
      );
      const data = await res.json();
      const a = data.address || {};
      setFormData(prev => ({
        ...prev,
        address_line1: [a.road, a.house_number].filter(Boolean).join(" ") || data.display_name?.split(",")[0] || prev.address_line1,
        address_line2: [a.suburb, a.neighbourhood].filter(Boolean).join(", ") || prev.address_line2 || "",
        city: a.city || a.town || a.village || a.county || prev.city,
        state: a.state || prev.state || "",
        postal_code: a.postcode || prev.postal_code,
        country: a.country || prev.country,
      }));
    } catch {
      // silently ignore — user can still fill manually
      // Set default values for Qatar
      setFormData(prev => ({
        ...prev,
        city: prev.city || 'Doha',
        country: prev.country || 'Qatar',
      }));
    }
  }, []);

  const handleMapPick = useCallback((lat: number, lng: number) => {
    setPinPosition([lat, lng]);
    reverseGeocode(lat, lng);
  }, [reverseGeocode]);

  // Stop any active GPS watch
  const stopWatch = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const detectLocation = useCallback((onDone?: () => void) => {
    if (!navigator.geolocation) return;
    stopWatch();
    setGpsLoading(true);
    setGpsAccuracy(null);

    // Keep track of best accuracy seen so far
    let bestAccuracy = Infinity;
    let geocodeFired = false;

    // Hard timeout — accept whatever we have after 15 s
    const timeoutId = setTimeout(() => {
      stopWatch();
      setGpsLoading(false);
      onDone?.();
    }, 15000);

    watchIdRef.current = navigator.geolocation.watchPosition(
      ({ coords }) => {
        const { latitude, longitude, accuracy } = coords;

        // Always move the pin to the latest reading so the user sees it refine
        setPinPosition([latitude, longitude]);
        setGpsAccuracy(Math.round(accuracy));

        // Reverse-geocode once we have a good enough fix (< 60 m)
        if (accuracy < 60 && !geocodeFired) {
          geocodeFired = true;
          reverseGeocode(latitude, longitude);
        }

        // Stop watching when accuracy is good enough (< 30 m) or clearly better
        if (accuracy < 30 || (accuracy < 60 && accuracy < bestAccuracy * 0.6)) {
          clearTimeout(timeoutId);
          stopWatch();
          if (!geocodeFired) reverseGeocode(latitude, longitude);
          setGpsLoading(false);
          onDone?.();
        }

        bestAccuracy = Math.min(bestAccuracy, accuracy);
      },
      () => {
        clearTimeout(timeoutId);
        stopWatch();
        setGpsLoading(false);
        onDone?.();
        toast({
          title: t("location_denied"),
          description: t("location_denied_desc"),
          variant: "destructive",
        });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reverseGeocode, stopWatch, t]);

  // Clean up watch on unmount
  useEffect(() => () => stopWatch(), [stopWatch]);

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: t("gps_not_supported"), description: t("gps_not_supported_desc"), variant: "destructive" });
      return;
    }
    detectLocation();
  };

  useEffect(() => {
    if (user) {
      fetchAddresses();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // After dialog opens, wait 500ms for MapContainer to mount then geocode / GPS
  useEffect(() => {
    if (!dialogOpen) return;

    const timer = setTimeout(() => {
      if (editingAddress) {
        // Build a fallback query chain: specific → city only → postal code only
        const city = editingAddress.city?.trim();
        const street = editingAddress.address_line1?.trim();
        const postal = editingAddress.postal_code?.trim();

        const queries = [
          // 1. Street + city + Qatar
          street && city ? `${street}, ${city}, Qatar` : "",
          // 2. City + Qatar (most reliable for Nominatim)
          city ? `${city}, Qatar` : "",
          // 3. Postal code + Qatar
          postal && postal.length > 2 ? `${postal}, Qatar` : "",
          // 4. Just city
          city || "",
        ];
        forwardGeocode(queries);
      } else {
        // Add mode: auto-detect GPS
        detectLocation();
      }
    }, 500);

    return () => clearTimeout(timer);
     
  }, [dialogOpen, editingAddress, forwardGeocode, detectLocation]);

  const fetchAddresses = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("user_addresses")
        .select("*")
        .eq("user_id", user.id)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAddresses(data || []);
    } catch (error) {
      console.error("Error fetching addresses:", error);
      toast({
        title: t("error"),
        description: t("failed_load_addresses"),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const openAddDialog = () => {
    setEditingAddress(null);
    setFormData(emptyForm);
    setFormErrors({});
    setPinPosition(null);
    setDialogOpen(true);
    // GPS detection is triggered by the useEffect after 400ms (map mount delay)
  };

  const openEditDialog = (address: Address) => {
    setEditingAddress(address);
    setPinPosition(null);
    setFormData({
      label: address.label,
      address_line1: address.address_line1,
      address_line2: address.address_line2 || "",
      city: address.city,
      state: address.state || "",
      postal_code: address.postal_code,
      country: address.country,
      phone: address.phone || "",
      delivery_instructions: address.delivery_instructions || "",
      is_default: address.is_default
    });
    setFormErrors({});
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!user) return;

    // Validate form
    const result = addressSchema.safeParse(formData);
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.errors.forEach(err => {
        if (err.path[0]) {
          errors[err.path[0].toString()] = err.message;
        }
      });
      setFormErrors(errors);
      return;
    }

    try {
      setSaving(true);
      
      const addressData = {
        user_id: user.id,
        label: formData.label.trim(),
        address_line1: formData.address_line1.trim(),
        address_line2: formData.address_line2?.trim() || null,
        city: formData.city.trim(),
        state: formData.state?.trim() || null,
        postal_code: formData.postal_code.trim(),
        country: formData.country.trim(),
        phone: formData.phone?.trim() || null,
        delivery_instructions: formData.delivery_instructions?.trim() || null,
        is_default: formData.is_default || false
      };

      if (editingAddress) {
        const { error } = await supabase
          .from("user_addresses")
          .update(addressData)
          .eq("id", editingAddress.id);

        if (error) throw error;
        toast({ title: t("address_updated") });
      } else {
        const { error } = await supabase
          .from("user_addresses")
          .insert(addressData);

        if (error) throw error;
        toast({ title: t("address_added") });
      }

      setDialogOpen(false);
      fetchAddresses();
    } catch (error) {
      console.error("Error saving address:", error);
      toast({
        title: t("error"),
        description: t("error_saving_profile"), // Closest generic error
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (address: Address) => {
    setAddressToDelete(address);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!addressToDelete) return;

    try {
      const { error } = await supabase
        .from("user_addresses")
        .delete()
        .eq("id", addressToDelete.id);

      if (error) throw error;
      
      toast({ title: t("address_deleted") });
      setDeleteDialogOpen(false);
      setAddressToDelete(null);
      fetchAddresses();
    } catch (error) {
      console.error("Error deleting address:", error);
      toast({
        title: t("error"),
        description: t("failed_delete_address"),
        variant: "destructive"
      });
    }
  };

  const setAsDefault = async (address: Address) => {
    try {
      const { error } = await supabase
        .from("user_addresses")
        .update({ is_default: true })
        .eq("id", address.id);

      if (error) throw error;
      
      toast({ title: t("default_address_updated") });
      fetchAddresses();
    } catch (error) {
      console.error("Error setting default:", error);
      toast({
        title: t("error"),
        description: t("failed_update_default_address"),
        variant: "destructive"
      });
    }
  };

  const getLabelIcon = (label: string) => {
    const lowerLabel = label.toLowerCase();
    if (lowerLabel.includes("home") || lowerLabel.includes("المنزل")) {
      return <Home className="h-4 w-4" />;
    } else if (lowerLabel.includes("work") || lowerLabel.includes("العمل") || lowerLabel.includes("office") || lowerLabel.includes("المكتب")) {
      return <Briefcase className="h-4 w-4" />;
    } else {
      return <MapPin className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="container max-w-2xl mx-auto px-4 py-6 space-y-4">
          <Skeleton className="h-12 w-full rounded-3xl" />
          <Skeleton className="h-36 w-full rounded-[28px]" />
          <Skeleton className="h-28 w-full rounded-[28px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-24 text-slate-950">
      <header className="sticky top-0 z-20 border-b border-slate-100 bg-white/90 pt-safe backdrop-blur-xl">
        <div className="container mx-auto max-w-2xl px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <Button
              variant="ghost"
              size="icon"
              data-testid="addresses-back-btn"
              onClick={() => navigate(-1)}
              className="h-11 w-11 rounded-full bg-white shadow-sm ring-1 ring-slate-200"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-0 flex-1 text-center">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-400">Saved places</p>
              <h1 className="truncate text-lg font-extrabold">{t("delivery_addresses_title")}</h1>
            </div>
            <Button
              size="icon"
              data-testid="addresses-add-btn"
              onClick={openAddDialog}
              className="h-11 w-11 rounded-full bg-slate-950 text-white shadow-lg shadow-slate-200 hover:bg-slate-800"
              aria-label={t("add_btn")}
            >
              <Plus className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto max-w-2xl px-4 py-5">
        <section className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-white p-5 text-slate-950">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-slate-400">Address book</p>
                <h2 className="mt-2 text-3xl font-black leading-none">{addresses.length}</h2>
                <p className="mt-2 text-sm font-semibold text-slate-500">
                  {addresses.length === 1 ? "delivery place saved" : "delivery places saved"}
                </p>
              </div>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-500">
                <MapPin className="h-7 w-7" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 p-4">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-400">Default</p>
              <p className="mt-1 truncate text-base font-black">
                {addresses.find((address) => address.is_default)?.label || "Not set"}
              </p>
            </div>
            <button
              type="button"
              onClick={openAddDialog}
              className="flex min-h-20 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-3 text-sm font-extrabold text-white shadow-lg shadow-slate-200 transition active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" />
              {t("add_btn")}
            </button>
          </div>
        </section>
      </div>

      <main className="container mx-auto max-w-2xl px-4 space-y-3">
        {addresses.length === 0 ? (
          <section className="rounded-[30px] border border-dashed border-slate-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-50 text-slate-700">
              <MapPin className="h-8 w-8" />
            </div>
            <p className="mb-5 text-sm font-semibold text-slate-500">{t("no_addresses_saved")}</p>
            <Button
              onClick={openAddDialog}
              className="h-12 rounded-full bg-slate-950 px-6 font-extrabold text-white shadow-lg shadow-slate-200 hover:bg-slate-800"
            >
              <Plus className="mr-2 h-4 w-4" />
                {t("add_first_address")}
            </Button>
          </section>
        ) : (
          addresses.map((address) => (
            <article
              key={address.id}
              className={`rounded-[28px] border bg-white p-4 shadow-sm transition ${
                address.is_default ? "border-rose-200 ring-4 ring-rose-50" : "border-slate-100"
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                    address.is_default ? "bg-rose-500 text-white" : "bg-slate-50 text-slate-700"
                  }`}
                >
                  {getLabelIcon(address.label)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-base font-black">{address.label}</h3>
                    {address.is_default && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-rose-600">
                        <Check className="h-3 w-3" />
                        {t("default_badge")}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 space-y-1 text-sm font-medium leading-5 text-slate-500">
                    <p>
                      {address.address_line1}
                      {address.address_line2 && `, ${address.address_line2}`}
                    </p>
                    <p>
                      {address.city}{address.state && `, ${address.state}`} {address.postal_code}
                    </p>
                    <p>{address.country}</p>
                    
                    {address.phone && (
                      <p className="mt-2 flex items-center gap-1.5 text-slate-600">
                        <Phone className="h-3.5 w-3.5 text-slate-400" />
                        {address.phone}
                      </p>
                    )}
                    
                    {address.delivery_instructions && (
                      <p className="mt-3 rounded-2xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
                        "{address.delivery_instructions}"
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3">
                <Button
                  variant="ghost"
                  onClick={() => openEditDialog(address)}
                  className="h-11 rounded-2xl bg-slate-50 text-slate-700 hover:bg-slate-100"
                >
                  <Edit2 className="mr-1.5 h-4 w-4" />
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setAsDefault(address)}
                  disabled={address.is_default}
                  title={t("set_as_default")}
                  className="h-11 rounded-2xl bg-slate-50 text-slate-700 hover:bg-slate-100 disabled:opacity-100"
                >
                  <Star className="mr-1.5 h-4 w-4" />
                  {address.is_default ? "Set" : "Default"}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => confirmDelete(address)}
                  className="h-11 rounded-2xl bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700"
                >
                  <Trash2 className="mr-1.5 h-4 w-4" />
                  Delete
                </Button>
              </div>
            </article>
          ))
        )}
      </main>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto rounded-[30px] border-slate-200 bg-white p-0">
          <DialogHeader className="border-b border-slate-100 bg-white px-5 py-5 text-left">
            <DialogTitle className="text-xl font-black">
              {editingAddress ? t("edit_address_title") : t("add_address_title")}
            </DialogTitle>
            <DialogDescription className="text-sm font-medium text-slate-500">
              {editingAddress ? t("edit_address_desc") : t("add_address_desc")}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-5 px-5 py-5">
            {/* ── Location Picker ── */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-extrabold">{t("pin_location")}</Label>
                <button
                  type="button"
                  onClick={handleUseMyLocation}
                  disabled={gpsLoading}
                  className="flex min-h-9 items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-extrabold text-slate-700 transition-all hover:bg-slate-200 active:scale-95 disabled:opacity-50"
                >
                  {gpsLoading ? (
                    <>
                      <Navigation className="h-3.5 w-3.5 animate-spin" />
                      {gpsAccuracy !== null ? `±${gpsAccuracy}m…` : t("locating")}
                    </>
                  ) : (
                    <><Locate className="h-3.5 w-3.5" />{t("use_my_location")}</>
                  )}
                </button>
              </div>
              <p className="text-xs font-medium text-slate-500">{t("tap_map_hint")} - address fields fill automatically.</p>
              <div className="relative overflow-hidden rounded-[26px] border border-slate-200 shadow-sm" style={{ height: 240 }}>
                {/* GPS loading overlay */}
                {gpsLoading && (
                  <div className="absolute inset-0 z-[1000] flex flex-col items-center justify-center gap-2 bg-white/80 backdrop-blur-sm">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100">
                      <Navigation className="h-5 w-5 animate-pulse text-slate-700" />
                    </div>
                    <p className="text-xs font-extrabold text-slate-900">{t("detecting_location")}</p>
                  </div>
                )}
                {/* No-pin hint */}
                {!pinPosition && !gpsLoading && (
                  <div className="absolute inset-0 z-[999] flex items-end justify-center pb-3 pointer-events-none">
                    <span className="rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-xs font-bold text-slate-500 shadow-sm">
                      {t("tap_map_hint")}
                    </span>
                  </div>
                )}
                <MapContainer
                  center={[25.2854, 51.5310]}
                  zoom={12}
                  style={{ height: "100%", width: "100%" }}
                  scrollWheelZoom
                  zoomControl
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <ClickHandler onPick={handleMapPick} />
                  {pinPosition && (
                    <>
                      <SetMapView position={pinPosition} />
                      {/* Accuracy radius circle — shrinks as GPS improves */}
                      {gpsLoading && gpsAccuracy !== null && gpsAccuracy > 30 && (
                        <Circle
                          center={pinPosition}
                          radius={gpsAccuracy}
                          pathOptions={{
                            color: "#e11d48",
                            fillColor: "#e11d48",
                            fillOpacity: 0.08,
                            weight: 1.5,
                            opacity: 0.5,
                            dashArray: "4 4",
                          }}
                        />
                      )}
                      <Marker
                        position={pinPosition}
                        draggable
                        eventHandlers={{
                          dragend(e) {
                            const m = e.target;
                            const { lat, lng } = m.getLatLng();
                            handleMapPick(lat, lng);
                          },
                        }}
                      />
                    </>
                  )}
                </MapContainer>
              </div>
              {pinPosition && (
                <p className="flex flex-wrap items-center gap-1 text-xs font-bold text-rose-600">
                  <MapPin className="h-3 w-3 shrink-0" />
                  {pinPosition[0].toFixed(5)}, {pinPosition[1].toFixed(5)}
                  {gpsAccuracy !== null && !gpsLoading && (
                    <span className="font-medium text-slate-500">- +/-{gpsAccuracy}m {t("accuracy")}</span>
                  )}
                  {!gpsLoading && (
                    <span className="font-medium text-slate-500">- {t("drag_map_hint")}</span>
                  )}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="font-extrabold">Label</Label>
              <Select
                value={formData.label}
                onValueChange={(value) => setFormData({ ...formData, label: value })}
              >
                <SelectTrigger className="h-12 rounded-2xl border-slate-200 bg-white font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {labelOptions.map(label => (
                    <SelectItem key={label} value={label}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="font-extrabold">{t("address_line1_label")} *</Label>
              <Input
                placeholder={t("street_address_placeholder")}
                value={formData.address_line1}
                onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })}
                className={`h-12 rounded-2xl bg-white font-semibold ${formErrors.address_line1 ? "border-destructive" : "border-slate-200"}`}
              />
              {formErrors.address_line1 && (
                <p className="text-sm text-destructive">{formErrors.address_line1}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="font-extrabold">{t("address_line2_label")}</Label>
              <Input
                placeholder={t("apartment_placeholder")}
                value={formData.address_line2}
                onChange={(e) => setFormData({ ...formData, address_line2: e.target.value })}
                className="h-12 rounded-2xl border-slate-200 bg-white font-semibold"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-extrabold">{t("city_label")} *</Label>
                <Input
                  placeholder={t("city_placeholder")}
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className={`h-12 rounded-2xl bg-white font-semibold ${formErrors.city ? "border-destructive" : "border-slate-200"}`}
                />
                {formErrors.city && (
                  <p className="text-sm text-destructive">{formErrors.city}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label className="font-extrabold">{t("state_label")}</Label>
                <Input
                  placeholder={t("state_placeholder")}
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  className="h-12 rounded-2xl border-slate-200 bg-white font-semibold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-extrabold">{t("postal_code_label")} *</Label>
                <Input
                  placeholder={t("zip_code_placeholder")}
                  value={formData.postal_code}
                  onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                  className={`h-12 rounded-2xl bg-white font-semibold ${formErrors.postal_code ? "border-destructive" : "border-slate-200"}`}
                />
                {formErrors.postal_code && (
                  <p className="text-sm text-destructive">{formErrors.postal_code}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label className="font-extrabold">{t("country_label")} *</Label>
                <Input
                  placeholder={t("country_placeholder")}
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  className={`h-12 rounded-2xl bg-white font-semibold ${formErrors.country ? "border-destructive" : "border-slate-200"}`}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="font-extrabold">{t("phone_number_label")}</Label>
              <Input
                placeholder={t("phone_placeholder")}
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="h-12 rounded-2xl border-slate-200 bg-white font-semibold"
              />
            </div>

            <div className="space-y-2">
              <Label className="font-extrabold">{t("delivery_instructions_label")}</Label>
              <Textarea
                placeholder={t("instructions_placeholder")}
                value={formData.delivery_instructions}
                onChange={(e) => setFormData({ ...formData, delivery_instructions: e.target.value })}
                rows={2}
                className="rounded-2xl border-slate-200 bg-white font-semibold"
              />
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <Label htmlFor="default" className="font-extrabold">{t("set_default_label")}</Label>
              <Switch
                id="default"
                checked={formData.is_default}
                onCheckedChange={(checked) => setFormData({ ...formData, is_default: checked })}
              />
            </div>
          </div>

          <DialogFooter className="sticky bottom-0 gap-2 border-t border-slate-100 bg-white p-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="h-12 rounded-full border-slate-200 px-6 font-extrabold">
              {t("cancel")}
            </Button>
            <Button onClick={handleSubmit} disabled={saving} className="h-12 rounded-full bg-slate-950 px-6 font-extrabold text-white shadow-lg shadow-slate-200 hover:bg-slate-800">
              {saving ? t("saving") : editingAddress ? t("update") : t("add_address")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("delete_address_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("delete_address_confirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
};

export default Addresses;
