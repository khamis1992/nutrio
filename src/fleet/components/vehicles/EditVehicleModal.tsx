import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Upload, Car, User } from "lucide-react";
import type { Vehicle, VehicleType, VehicleStatus, Driver } from "@/fleet/types/fleet";

interface EditVehicleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  vehicle: Vehicle | null;
  availableDrivers: Driver[];
}

export function EditVehicleModal({ isOpen, onClose, onSuccess, vehicle, availableDrivers }: EditVehicleModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    type: "car" as VehicleType,
    make: "",
    model: "",
    year: new Date().getFullYear(),
    color: "",
    plateNumber: "",
    insuranceExpiry: "",
    status: "available" as VehicleStatus,
    assignedDriverId: "",
  });
  const [vehiclePhoto, setVehiclePhoto] = useState<File | null>(null);
  const [registrationDoc, setRegistrationDoc] = useState<File | null>(null);

  useEffect(() => {
    if (vehicle) {
      setFormData({
        type: vehicle.type,
        make: vehicle.make || "",
        model: vehicle.model || "",
        year: vehicle.year || new Date().getFullYear(),
        color: vehicle.color || "",
        plateNumber: vehicle.plateNumber,
        insuranceExpiry: vehicle.insuranceExpiry || "",
        status: vehicle.status,
        assignedDriverId: vehicle.assignedDriverId || "",
      });
    }
  }, [vehicle]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicle) return;

    setIsLoading(true);

    try {
      let vehiclePhotoUrl = vehicle.vehiclePhotoUrl;
      let registrationDocUrl = vehicle.registrationDocumentUrl;

      // Upload new vehicle photo if provided
      if (vehiclePhoto) {
        const fileExt = vehiclePhoto.name.split('.').pop();
        const fileName = `vehicles/${Date.now()}_photo.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('fleet-documents')
          .upload(fileName, vehiclePhoto);
        
        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabase.storage
          .from('fleet-documents')
          .getPublicUrl(fileName);
        vehiclePhotoUrl = publicUrl;
      }

      // Upload new registration document if provided
      if (registrationDoc) {
        const fileExt = registrationDoc.name.split('.').pop();
        const fileName = `vehicles/${Date.now()}_reg.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('fleet-documents')
          .upload(fileName, registrationDoc);
        
        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabase.storage
          .from('fleet-documents')
          .getPublicUrl(fileName);
        registrationDocUrl = publicUrl;
      }

      // Update vehicle record
      const { error } = await supabase
        .from('vehicles')
        .update({
          type: formData.type,
          make: formData.make || null,
          model: formData.model || null,
          year: formData.year || null,
          color: formData.color || null,
          plate_number: formData.plateNumber,
          insurance_expiry: formData.insuranceExpiry || null,
          status: formData.status,
          assigned_driver_id: formData.assignedDriverId || null,
          vehicle_photo_url: vehiclePhotoUrl,
          registration_document_url: registrationDocUrl,
        })
        .eq('id', vehicle.id);

      if (error) throw error;

      // Update driver's assigned vehicle if changed
      if (formData.assignedDriverId && formData.assignedDriverId !== vehicle.assignedDriverId) {
        await supabase
          .from('drivers')
          .update({ assigned_vehicle_id: vehicle.id })
          .eq('id', formData.assignedDriverId);
      }

      // Remove vehicle from old driver if unassigned
      if (!formData.assignedDriverId && vehicle.assignedDriverId) {
        await supabase
          .from('drivers')
          .update({ assigned_vehicle_id: null })
          .eq('id', vehicle.assignedDriverId);
      }

      toast({
        title: "Success",
        description: "Vehicle updated successfully",
      });

      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error updating vehicle:", error);
      toast({
        title: "Error",
        description: "Failed to update vehicle. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: VehicleStatus) => {
    if (!vehicle) return;

    try {
      const { error } = await supabase
        .from('vehicles')
        .update({ status: newStatus })
        .eq('id', vehicle.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Vehicle status changed to ${newStatus}`,
      });

      onSuccess();
    } catch (error) {
      console.error("Error changing status:", error);
      toast({
        title: "Error",
        description: "Failed to change status",
        variant: "destructive",
      });
    }
  };

  if (!vehicle) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Car className="h-5 w-5" />
            Edit Vehicle - {vehicle.plateNumber}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Status Change */}
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value: VehicleStatus) => {
                setFormData({ ...formData, status: value });
                handleStatusChange(value);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="assigned">Assigned</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="retired">Retired</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Assign Driver */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Assign Driver
            </Label>
            <Select
              value={formData.assignedDriverId || "unassigned"}
              onValueChange={(value) => setFormData({ ...formData, assignedDriverId: value === "unassigned" ? "" : value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select driver" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {availableDrivers.map((driver) => (
                  <SelectItem key={driver.id} value={driver.id}>
                    {driver.fullName} - {driver.phone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Vehicle Type */}
          <div className="space-y-2">
            <Label htmlFor="type">Vehicle Type</Label>
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
            <Label htmlFor="plateNumber">License Plate Number</Label>
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
              {vehicle.vehiclePhotoUrl && (
                <div className="mb-2">
                  <img 
                    src={vehicle.vehiclePhotoUrl} 
                    alt="Current vehicle" 
                    className="h-32 w-auto rounded-lg object-cover"
                  />
                </div>
              )}
              <div className="border-2 border-dashed border-border rounded-lg p-4">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setVehiclePhoto(e.target.files?.[0] || null)}
                  className="hidden"
                  id="edit-vehicle-photo"
                />
                <label htmlFor="edit-vehicle-photo" className="cursor-pointer block text-center">
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {vehiclePhoto ? vehiclePhoto.name : "Click to upload new photo"}
                  </span>
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Registration Document</Label>
              {vehicle.registrationDocumentUrl && (
                <div className="mb-2">
                  <a 
                    href={vehicle.registrationDocumentUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline text-sm"
                  >
                    View current document
                  </a>
                </div>
              )}
              <div className="border-2 border-dashed border-border rounded-lg p-4">
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setRegistrationDoc(e.target.files?.[0] || null)}
                  className="hidden"
                  id="edit-registration-doc"
                />
                <label htmlFor="edit-registration-doc" className="cursor-pointer block text-center">
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {registrationDoc ? registrationDoc.name : "Click to upload new document"}
                  </span>
                </label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
