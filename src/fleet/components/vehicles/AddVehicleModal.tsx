import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { uploadSensitiveFile, validatePrivateStorageFile } from "@/lib/private-storage";
import { Upload, Car } from "lucide-react";
import type { VehicleType } from "@/fleet/types/fleet";

interface AddVehicleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  cityId?: string;
}

export function AddVehicleModal({ isOpen, onClose, onSuccess, cityId }: AddVehicleModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    type: "car" as VehicleType,
    make: "",
    model: "",
    year: new Date().getFullYear(),
    color: "",
    plateNumber: "",
    insuranceExpiry: "",
  });
  const [vehiclePhoto, setVehiclePhoto] = useState<File | null>(null);
  const [registrationDoc, setRegistrationDoc] = useState<File | null>(null);
  const [cities, setCities] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedCityId, setSelectedCityId] = useState(cityId || "");

  useEffect(() => {
    setSelectedCityId(cityId || "");
    if (!isOpen || cityId) return;

    void supabase
      .from("cities")
      .select("id, name")
      .eq("is_active", true)
      .order("name")
      .then(({ data, error }) => {
        if (error) {
          console.error("Error loading fleet cities:", error);
          return;
        }
        setCities(data || []);
      });
  }, [cityId, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const uploadedPaths: string[] = [];

    try {
      if (!selectedCityId) throw new Error("Select a city before adding a vehicle");
      const vehicleId = crypto.randomUUID();
      let vehiclePhotoUrl = null;
      let registrationDocUrl = null;

      // Upload vehicle photo if provided
      if (vehiclePhoto) {
        const fileExt = validatePrivateStorageFile(
          vehiclePhoto,
          ["image/jpeg", "image/png", "image/webp"],
          10 * 1024 * 1024,
        );
        const fileName = `cities/${selectedCityId}/vehicles/${vehicleId}/${crypto.randomUUID()}_photo.${fileExt}`;
        await uploadSensitiveFile("fleet-documents", fileName, vehiclePhoto);
        
        uploadedPaths.push(fileName);
        vehiclePhotoUrl = fileName;
      }

      // Upload registration document if provided
      if (registrationDoc) {
        const fileExt = validatePrivateStorageFile(
          registrationDoc,
          ["application/pdf", "image/jpeg", "image/png", "image/webp"],
          10 * 1024 * 1024,
        );
        const fileName = `cities/${selectedCityId}/vehicles/${vehicleId}/${crypto.randomUUID()}_registration.${fileExt}`;
        await uploadSensitiveFile("fleet-documents", fileName, registrationDoc);
        
        uploadedPaths.push(fileName);
        registrationDocUrl = fileName;
      }

      // Create vehicle record
      const insertData = {
        id: vehicleId,
        type: formData.type,
        make: formData.make || null,
        model: formData.model || null,
        year: formData.year || null,
        color: formData.color || null,
        plate_number: formData.plateNumber,
        insurance_expiry: formData.insuranceExpiry || null,
        vehicle_photo_url: vehiclePhotoUrl,
        registration_document_url: registrationDocUrl,
        status: 'available',
        city_id: selectedCityId,
      };
      
      const { error } = await supabase.from('vehicles').insert(insertData);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Vehicle added successfully",
      });

      onSuccess();
      onClose();
      resetForm();
    } catch (error) {
      if (uploadedPaths.length > 0) {
        const { error: cleanupError } = await supabase.storage.from("fleet-documents").remove(uploadedPaths);
        if (cleanupError) console.error("Failed to remove orphaned vehicle files:", cleanupError);
      }
      console.error("Error adding vehicle:", error);
      toast({
        title: "Error",
        description: "Failed to add vehicle. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      type: "car",
      make: "",
      model: "",
      year: new Date().getFullYear(),
      color: "",
      plateNumber: "",
      insuranceExpiry: "",
    });
    setVehiclePhoto(null);
    setRegistrationDoc(null);
    setSelectedCityId(cityId || "");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Car className="h-5 w-5" />
            Add New Vehicle
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {!cityId && (
            <div className="space-y-2">
              <Label htmlFor="city">City *</Label>
              <Select value={selectedCityId} onValueChange={setSelectedCityId}>
                <SelectTrigger id="city">
                  <SelectValue placeholder="Select city" />
                </SelectTrigger>
                <SelectContent>
                  {cities.map((city) => (
                    <SelectItem key={city.id} value={city.id}>{city.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Vehicle Type */}
          <div className="space-y-2">
            <Label htmlFor="type">Vehicle Type *</Label>
            <Select
              value={formData.type}
              onValueChange={(value: VehicleType) => setFormData({ ...formData, type: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select vehicle type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="motorcycle">Motorcycle</SelectItem>
                <SelectItem value="car">Car</SelectItem>
                <SelectItem value="bicycle">Bicycle</SelectItem>
                <SelectItem value="van">Van</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Make & Model */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="make">Make</Label>
              <Input
                id="make"
                value={formData.make}
                onChange={(e) => setFormData({ ...formData, make: e.target.value })}
                placeholder="e.g., Toyota"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <Input
                id="model"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                placeholder="e.g., Corolla"
              />
            </div>
          </div>

          {/* Year & Color */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="year">Year</Label>
              <Input
                id="year"
                type="number"
                value={formData.year}
                onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) || new Date().getFullYear() })}
                min={1990}
                max={new Date().getFullYear() + 1}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="color">Color</Label>
              <Input
                id="color"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                placeholder="e.g., White"
              />
            </div>
          </div>

          {/* Plate Number */}
          <div className="space-y-2">
            <Label htmlFor="plateNumber">License Plate Number *</Label>
            <Input
              id="plateNumber"
              value={formData.plateNumber}
              onChange={(e) => setFormData({ ...formData, plateNumber: e.target.value })}
              placeholder="e.g., 12345"
              required
            />
          </div>

          {/* Insurance Expiry */}
          <div className="space-y-2">
            <Label htmlFor="insuranceExpiry">Insurance Expiry Date</Label>
            <Input
              id="insuranceExpiry"
              type="date"
              value={formData.insuranceExpiry}
              onChange={(e) => setFormData({ ...formData, insuranceExpiry: e.target.value })}
            />
          </div>

          {/* Document Uploads */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Vehicle Photo</Label>
              <div className="border-2 border-dashed border-border rounded-lg p-4">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setVehiclePhoto(e.target.files?.[0] || null)}
                  className="hidden"
                  id="vehicle-photo"
                />
                <label htmlFor="vehicle-photo" className="cursor-pointer block text-center">
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {vehiclePhoto ? vehiclePhoto.name : "Click to upload vehicle photo"}
                  </span>
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Registration Document</Label>
              <div className="border-2 border-dashed border-border rounded-lg p-4">
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setRegistrationDoc(e.target.files?.[0] || null)}
                  className="hidden"
                  id="registration-doc"
                />
                <label htmlFor="registration-doc" className="cursor-pointer block text-center">
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {registrationDoc ? registrationDoc.name : "Click to upload registration document"}
                  </span>
                </label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !formData.plateNumber}>
              {isLoading ? "Adding..." : "Add Vehicle"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
