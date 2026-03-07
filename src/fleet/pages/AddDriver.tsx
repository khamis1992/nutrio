import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { 
  ArrowLeft, 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  Upload,
  Car,
  AlertCircle,
  CheckCircle
} from "lucide-react";
import type { City, Vehicle } from "@/fleet/types";

export default function AddDriver() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [cities, setCities] = useState<City[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedCity, setSelectedCity] = useState<string>("");
  
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    cityId: "",
    zoneIds: [] as string[],
    vehicleId: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    address: "",
  });

  const [documents, setDocuments] = useState({
    license: null as File | null,
    idCard: null as File | null,
    vehicleReg: null as File | null,
  });

  useEffect(() => {
    fetchCities();
    fetchVehicles();
  }, []);

  useEffect(() => {
    if (selectedCity) {
      fetchZones(selectedCity);
    }
  }, [selectedCity]);

  const fetchCities = async () => {
    try {
      const { data, error } = await supabase
        .from('cities')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      const transformedCities: City[] = (data || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        nameAr: c.name_ar,
        country: c.country,
        latitude: c.latitude,
        longitude: c.longitude,
        timezone: c.timezone,
        isActive: c.is_active,
      }));

      setCities(transformedCities);
    } catch (error) {
      console.error("Error fetching cities:", error);
    }
  };

  const fetchZones = async (cityId: string) => {
    try {
      const { data, error } = await supabase
        .from('zones')
        .select('*')
        .eq('city_id', cityId)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setZones(data || []);
    } catch (error) {
      console.error("Error fetching zones:", error);
    }
  };

  const fetchVehicles = async () => {
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('status', 'available')
        .order('plate_number');

      if (error) throw error;

      const transformedVehicles: Vehicle[] = (data || []).map((v: any) => ({
        id: v.id,
        cityId: v.city_id || '',
        type: v.type,
        make: v.make,
        model: v.model,
        year: v.year,
        color: v.color,
        plateNumber: v.plate_number,
        status: v.status,
        createdAt: v.created_at,
      }));

      setVehicles(transformedVehicles);
    } catch (error) {
      console.error("Error fetching vehicles:", error);
    }
  };

  const toggleZone = (zoneId: string) => {
    setFormData(prev => ({
      ...prev,
      zoneIds: prev.zoneIds.includes(zoneId)
        ? prev.zoneIds.filter(id => id !== zoneId)
        : [...prev.zoneIds, zoneId]
    }));
  };

  const uploadDocument = async (file: File, prefix: string): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `drivers/${Date.now()}_${prefix}.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage
      .from('fleet-documents')
      .upload(fileName, file);
    
    if (uploadError) throw uploadError;
    
    const { data: { publicUrl } } = supabase.storage
      .from('fleet-documents')
      .getPublicUrl(fileName);
    
    return publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Validate required fields
      if (!formData.fullName || !formData.phone) {
        toast({
          title: "Error",
          description: "Full name and phone are required",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Upload documents
      let licenseUrl = null;
      let idCardUrl = null;
      let vehicleRegUrl = null;

      if (documents.license) {
        licenseUrl = await uploadDocument(documents.license, 'license');
      }
      if (documents.idCard) {
        idCardUrl = await uploadDocument(documents.idCard, 'id');
      }
      if (documents.vehicleReg) {
        vehicleRegUrl = await uploadDocument(documents.vehicleReg, 'reg');
      }

      // Create driver
      const { data: driverData, error: driverError } = await supabase
        .from('drivers')
        .insert({
          full_name: formData.fullName,
          email: formData.email || null,
          phone_number: formData.phone,
          city_id: formData.cityId || null,
          assigned_zone_ids: formData.zoneIds,
          approval_status: 'pending',
          is_active: true,
          is_online: false,
          total_deliveries: 0,
          rating: 5.0,
          wallet_balance: 0,
          total_earnings: 0,
        })
        .select()
        .single();

      if (driverError) throw driverError;

      // Create document records
      const documentRecords = [];
      if (licenseUrl) {
        documentRecords.push({
          driver_id: driverData.id,
          document_type: 'driving_license',
          document_url: licenseUrl,
          verification_status: 'pending',
        });
      }
      if (idCardUrl) {
        documentRecords.push({
          driver_id: driverData.id,
          document_type: 'id_card',
          document_url: idCardUrl,
          verification_status: 'pending',
        });
      }
      if (vehicleRegUrl) {
        documentRecords.push({
          driver_id: driverData.id,
          document_type: 'vehicle_registration',
          document_url: vehicleRegUrl,
          verification_status: 'pending',
        });
      }

      if (documentRecords.length > 0) {
        const { error: docError } = await supabase
          .from('driver_documents')
          .insert(documentRecords);
        
        if (docError) throw docError;
      }

      // Assign vehicle if selected
      if (formData.vehicleId) {
        await supabase
          .from('vehicles')
          .update({ 
            assigned_driver_id: driverData.id,
            status: 'assigned'
          })
          .eq('id', formData.vehicleId);
      }

      toast({
        title: "Success",
        description: "Driver added successfully",
      });

      navigate('/fleet/drivers');
    } catch (error) {
      console.error("Error adding driver:", error);
      toast({
        title: "Error",
        description: "Failed to add driver. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 rtl:flex-row-reverse">
        <Button variant="outline" size="icon" onClick={() => navigate('/fleet/drivers')}>
          <ArrowLeft className="h-4 w-4 rtl-flip-back" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Add New Driver</h1>
          <p className="text-muted-foreground">Create a new driver profile</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Personal Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="h-5 w-5" />
              Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name *</Label>
                <Input
                  id="fullName"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  placeholder="e.g., Ahmed Mohammed"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number *</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="e.g., +974 1234 5678"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="e.g., driver@example.com"
              />
            </div>
          </CardContent>
        </Card>

        {/* Location & Assignment */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Location & Assignment
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Select
                value={formData.cityId}
                onValueChange={(value) => {
                  setFormData({ ...formData, cityId: value, zoneIds: [] });
                  setSelectedCity(value);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select city" />
                </SelectTrigger>
                <SelectContent>
                  {cities.map((city) => (
                    <SelectItem key={city.id} value={city.id}>
                      {city.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {zones.length > 0 && (
              <div className="space-y-2">
                <Label>Assigned Zones</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {zones.map((zone) => (
                    <div key={zone.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={zone.id}
                        checked={formData.zoneIds.includes(zone.id)}
                        onCheckedChange={() => toggleZone(zone.id)}
                      />
                      <Label htmlFor={zone.id} className="text-sm cursor-pointer">
                        {zone.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="vehicle" className="flex items-center gap-2">
                <Car className="h-4 w-4" />
                Assign Vehicle
              </Label>
              <Select
                value={formData.vehicleId}
                onValueChange={(value) => setFormData({ ...formData, vehicleId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select vehicle (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map((vehicle) => (
                    <SelectItem key={vehicle.id} value={vehicle.id}>
                      {vehicle.plateNumber} - {vehicle.make} {vehicle.model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Documents */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Documents
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Driver's License</Label>
              <div className="border-2 border-dashed border-border rounded-lg p-4">
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setDocuments({ ...documents, license: e.target.files?.[0] || null })}
                  className="hidden"
                  id="license-doc"
                />
                <label htmlFor="license-doc" className="cursor-pointer block text-center">
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {documents.license ? documents.license.name : "Click to upload driver's license"}
                  </span>
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <Label>ID / Passport</Label>
              <div className="border-2 border-dashed border-border rounded-lg p-4">
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setDocuments({ ...documents, idCard: e.target.files?.[0] || null })}
                  className="hidden"
                  id="id-doc"
                />
                <label htmlFor="id-doc" className="cursor-pointer block text-center">
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {documents.idCard ? documents.idCard.name : "Click to upload ID or passport"}
                  </span>
                </label>
              </div>
            </div>

            {formData.vehicleId && (
              <div className="space-y-2">
                <Label>Vehicle Registration</Label>
                <div className="border-2 border-dashed border-border rounded-lg p-4">
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setDocuments({ ...documents, vehicleReg: e.target.files?.[0] || null })}
                    className="hidden"
                    id="vehicle-reg"
                  />
                  <label htmlFor="vehicle-reg" className="cursor-pointer block text-center">
                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {documents.vehicleReg ? documents.vehicleReg.name : "Click to upload vehicle registration"}
                    </span>
                  </label>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Emergency Contact */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Emergency Contact
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="emergencyName">Contact Name</Label>
                <Input
                  id="emergencyName"
                  value={formData.emergencyContactName}
                  onChange={(e) => setFormData({ ...formData, emergencyContactName: e.target.value })}
                  placeholder="Emergency contact name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emergencyPhone" className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Contact Phone
                </Label>
                <Input
                  id="emergencyPhone"
                  type="tel"
                  value={formData.emergencyContactPhone}
                  onChange={(e) => setFormData({ ...formData, emergencyContactPhone: e.target.value })}
                  placeholder="Emergency contact phone"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Address */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Address</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="address">Full Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Enter driver's address"
              />
            </div>
          </CardContent>
        </Card>

        {/* Submit Buttons */}
        <div className="flex gap-4">
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => navigate('/fleet/drivers')}
            disabled={isLoading}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={isLoading || !formData.fullName || !formData.phone}
            className="flex-1"
          >
            {isLoading ? (
              <>
                <div className="animate-spin mr-2 h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                Creating...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Add Driver
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
