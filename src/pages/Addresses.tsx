import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Plus, Edit2, Trash2, Check, Home, Briefcase, Star, Phone } from "lucide-react";
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

  useEffect(() => {
    if (user) {
      fetchAddresses();
    }
  }, [user]);

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
    setDialogOpen(true);
  };

  const openEditDialog = (address: Address) => {
    setEditingAddress(address);
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
          </DialogHeader>
          
          <div className="space-y-4 py-4">
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
