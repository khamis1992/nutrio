import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Plus, Edit2, Trash2, Check, Home, Briefcase, Star, Phone, Locate, Navigation } from "lucide-react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Circle, useMapEvents, useMap } from "react-leaflet";

// Fix Leaflet's default broken icon URLs when bundled with Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

const labelOptions = ["Home", "Work", "Office", "Other"];

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
          title: "Location denied",
          description: "Please allow location access and try again.",
          variant: "destructive",
        });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, [reverseGeocode, stopWatch]);

  // Clean up watch on unmount
  useEffect(() => () => stopWatch(), [stopWatch]);

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: "GPS not supported", description: "Your browser doesn't support location.", variant: "destructive" });
      return;
    }
    detectLocation();
  };

  useEffect(() => {
    if (user) {
      fetchAddresses();
    }
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
        title: "Error",
        description: "Failed to load addresses",
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
        toast({ title: "Address updated" });
      } else {
        const { error } = await supabase
          .from("user_addresses")
          .insert(addressData);

        if (error) throw error;
        toast({ title: "Address added" });
      }

      setDialogOpen(false);
      fetchAddresses();
    } catch (error) {
      console.error("Error saving address:", error);
      toast({
        title: "Error",
        description: "Failed to save address",
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
      
      toast({ title: "Address deleted" });
      setDeleteDialogOpen(false);
      setAddressToDelete(null);
      fetchAddresses();
    } catch (error) {
      console.error("Error deleting address:", error);
      toast({
        title: "Error",
        description: "Failed to delete address",
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
      
      toast({ title: "Default address updated" });
      fetchAddresses();
    } catch (error) {
      console.error("Error setting default:", error);
      toast({
        title: "Error",
        description: "Failed to update default address",
        variant: "destructive"
      });
    }
  };

  const getLabelIcon = (label: string) => {
    switch (label.toLowerCase()) {
      case "home":
        return <Home className="h-4 w-4" />;
      case "work":
      case "office":
        return <Briefcase className="h-4 w-4" />;
      default:
        return <MapPin className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container max-w-2xl mx-auto px-4 py-6 space-y-4">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="container max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => navigate(-1)}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-xl font-semibold">Delivery Addresses</h1>
            </div>
            <Button size="sm" onClick={openAddDialog}>
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>
        </div>
      </header>

      <div className="container max-w-2xl mx-auto px-4 py-6 space-y-4">
        {addresses.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <MapPin className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-muted-foreground mb-4">No addresses saved yet</p>
              <Button onClick={openAddDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Address
              </Button>
            </CardContent>
          </Card>
        ) : (
          addresses.map((address) => (
            <Card key={address.id} className={address.is_default ? "border-primary/50" : ""}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {getLabelIcon(address.label)}
                      <span className="font-medium">{address.label}</span>
                      {address.is_default && (
                        <Badge variant="secondary" className="text-xs">
                          <Star className="h-3 w-3 mr-1" />
                          Default
                        </Badge>
                      )}
                    </div>
                    
                    <p className="text-sm text-muted-foreground">
                      {address.address_line1}
                      {address.address_line2 && `, ${address.address_line2}`}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {address.city}{address.state && `, ${address.state}`} {address.postal_code}
                    </p>
                    <p className="text-sm text-muted-foreground">{address.country}</p>
                    
                    {address.phone && (
                      <p className="text-sm text-muted-foreground mt-2 flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {address.phone}
                      </p>
                    )}
                    
                    {address.delivery_instructions && (
                      <p className="text-sm text-muted-foreground mt-2 italic">
                        "{address.delivery_instructions}"
                      </p>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-1">
                    {!address.is_default && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setAsDefault(address)}
                        title="Set as default"
                      >
                        <Star className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(address)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => confirmDelete(address)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingAddress ? "Edit Address" : "Add New Address"}
            </DialogTitle>
            <DialogDescription>
              {editingAddress ? "Update your address details." : "Add a new delivery address to your account."}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* ── Location Picker ── */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Pin Your Location</Label>
                <button
                  type="button"
                  onClick={handleUseMyLocation}
                  disabled={gpsLoading}
                  className="flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/15 active:scale-95 transition-all px-3 py-1.5 rounded-full disabled:opacity-50"
                >
                  {gpsLoading ? (
                    <>
                      <Navigation className="h-3.5 w-3.5 animate-spin" />
                      {gpsAccuracy !== null ? `±${gpsAccuracy}m…` : "Locating…"}
                    </>
                  ) : (
                    <><Locate className="h-3.5 w-3.5" />Use My Location</>
                  )}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">Tap the map or use GPS to pin your location — address fields fill automatically.</p>
              <div className="relative rounded-2xl overflow-hidden border border-border/70 shadow-sm" style={{ height: 240 }}>
                {/* GPS loading overlay */}
                {gpsLoading && (
                  <div className="absolute inset-0 z-[1000] bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center gap-2">
                    <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                      <Navigation className="h-5 w-5 text-primary animate-pulse" />
                    </div>
                    <p className="text-xs font-semibold text-foreground">Detecting your location…</p>
                  </div>
                )}
                {/* No-pin hint */}
                {!pinPosition && !gpsLoading && (
                  <div className="absolute inset-0 z-[999] flex items-end justify-center pb-3 pointer-events-none">
                    <span className="text-xs bg-background/90 text-muted-foreground px-3 py-1.5 rounded-full border border-border/60 shadow-sm">
                      Tap the map to drop a pin
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
                            color: "#16a34a",
                            fillColor: "#16a34a",
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
                <p className="text-xs text-primary font-medium flex items-center gap-1 flex-wrap">
                  <MapPin className="h-3 w-3 shrink-0" />
                  {pinPosition[0].toFixed(5)}, {pinPosition[1].toFixed(5)}
                  {gpsAccuracy !== null && !gpsLoading && (
                    <span className="text-muted-foreground font-normal">· ±{gpsAccuracy}m accuracy</span>
                  )}
                  {!gpsLoading && (
                    <span className="text-muted-foreground font-normal">· drag or tap to adjust</span>
                  )}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Label</Label>
              <Select
                value={formData.label}
                onValueChange={(value) => setFormData({ ...formData, label: value })}
              >
                <SelectTrigger>
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
              <Label>Address Line 1 *</Label>
              <Input
                placeholder="Street address"
                value={formData.address_line1}
                onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })}
                className={formErrors.address_line1 ? "border-destructive" : ""}
              />
              {formErrors.address_line1 && (
                <p className="text-sm text-destructive">{formErrors.address_line1}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Address Line 2</Label>
              <Input
                placeholder="Apartment, suite, etc. (optional)"
                value={formData.address_line2}
                onChange={(e) => setFormData({ ...formData, address_line2: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>City *</Label>
                <Input
                  placeholder="City"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className={formErrors.city ? "border-destructive" : ""}
                />
                {formErrors.city && (
                  <p className="text-sm text-destructive">{formErrors.city}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>State</Label>
                <Input
                  placeholder="State"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Postal Code *</Label>
                <Input
                  placeholder="Zip code"
                  value={formData.postal_code}
                  onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                  className={formErrors.postal_code ? "border-destructive" : ""}
                />
                {formErrors.postal_code && (
                  <p className="text-sm text-destructive">{formErrors.postal_code}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Country *</Label>
                <Input
                  placeholder="Country"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  className={formErrors.country ? "border-destructive" : ""}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Phone Number</Label>
              <Input
                placeholder="Contact phone (optional)"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Delivery Instructions</Label>
              <Textarea
                placeholder="Gate code, building instructions, etc."
                value={formData.delivery_instructions}
                onChange={(e) => setFormData({ ...formData, delivery_instructions: e.target.value })}
                rows={2}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="default">Set as default address</Label>
              <Switch
                id="default"
                checked={formData.is_default}
                onCheckedChange={(checked) => setFormData({ ...formData, is_default: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? "Saving..." : editingAddress ? "Update" : "Add Address"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Address</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this address? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border">
        <div className="container max-w-2xl mx-auto px-4">
          <div className="flex justify-around py-2">
            <Button variant="ghost" className="flex-col h-auto py-2" onClick={() => navigate("/dashboard")}>
              <Home className="h-5 w-5" />
              <span className="text-xs mt-1">Home</span>
            </Button>
            <Button variant="ghost" className="flex-col h-auto py-2" onClick={() => navigate("/meals")}>
              <MapPin className="h-5 w-5" />
              <span className="text-xs mt-1">Meals</span>
            </Button>
            <Button variant="ghost" className="flex-col h-auto py-2 text-primary" onClick={() => navigate("/addresses")}>
              <MapPin className="h-5 w-5" />
              <span className="text-xs mt-1">Addresses</span>
            </Button>
            <Button variant="ghost" className="flex-col h-auto py-2" onClick={() => navigate("/profile")}>
              <Home className="h-5 w-5" />
              <span className="text-xs mt-1">Profile</span>
            </Button>
          </div>
        </div>
      </nav>
    </div>
  );
};

export default Addresses;
