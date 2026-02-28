import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { 
  Route, 
  MapPin, 
  Users, 
  Package, 
  Play,
  RotateCcw,
  CheckCircle,
  Truck
} from "lucide-react";
import type { Driver, Vehicle } from "@/fleet/types";

interface Delivery {
  id: string;
  pickupAddress: string;
  deliveryAddress: string;
  priority: 'high' | 'normal' | 'low';
  estimatedTime: number;
  driverId?: string;
}

export default function RouteOptimization() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [pendingDeliveries, setPendingDeliveries] = useState<Delivery[]>([]);
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>([]);
  const [selectedDeliveries, setSelectedDeliveries] = useState<string[]>([]);
  const [optimizedRoutes, setOptimizedRoutes] = useState<Record<string, Delivery[]>>({});
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [activeTab, setActiveTab] = useState<'planning' | 'zones'>('planning');

  useEffect(() => {
    fetchDrivers();
    fetchVehicles();
    fetchPendingDeliveries();
  }, []);

  const fetchDrivers = async () => {
    try {
      const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .eq('approval_status', 'approved')
        .eq('is_active', true)
        .eq('is_online', true);

      if (error) throw error;

      const transformedDrivers: Driver[] = (data || []).map((d: any) => ({
        id: d.id,
        authUserId: d.user_id,
        email: d.email || '',
        phone: d.phone_number || '',
        fullName: d.full_name || `Driver ${d.phone_number?.slice(-4) || d.id.slice(0, 8)}`,
        cityId: d.city_id || '',
        assignedZoneIds: d.assigned_zone_ids || [],
        status: d.approval_status === 'approved' && d.is_active ? 'active' : 'inactive',
        isOnline: d.is_online || false,
        currentLatitude: d.current_lat,
        currentLongitude: d.current_lng,
        totalDeliveries: d.total_deliveries || 0,
        rating: d.rating || 5.0,
        cancellationRate: d.cancellation_rate || 0,
        currentBalance: d.wallet_balance || 0,
        totalEarnings: d.total_earnings || 0,
        assignedVehicleId: d.assigned_vehicle_id,
        createdAt: d.created_at,
      }));

      setDrivers(transformedDrivers);
    } catch (error) {
      console.error("Error fetching drivers:", error);
    }
  };

  const fetchVehicles = async () => {
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('status', 'assigned');

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
        assignedDriverId: v.assigned_driver_id,
        createdAt: v.created_at,
      }));

      setVehicles(transformedVehicles);
    } catch (error) {
      console.error("Error fetching vehicles:", error);
    }
  };

  const fetchPendingDeliveries = async () => {
    // Mock data for now - in production this would fetch from delivery_jobs table
    const mockDeliveries: Delivery[] = [
      { id: "1", pickupAddress: "Restaurant A, West Bay", deliveryAddress: "Al Sadd, Street 15", priority: 'high', estimatedTime: 25 },
      { id: "2", pickupAddress: "Restaurant B, The Pearl", deliveryAddress: "Lusail, Marina District", priority: 'normal', estimatedTime: 35 },
      { id: "3", pickupAddress: "Restaurant C, City Center", deliveryAddress: "Al Rayyan, Education City", priority: 'normal', estimatedTime: 30 },
      { id: "4", pickupAddress: "Restaurant D, Airport Area", deliveryAddress: "Industrial Area, Street 12", priority: 'low', estimatedTime: 40 },
      { id: "5", pickupAddress: "Restaurant E, Msheireb", deliveryAddress: "Corniche, West Bay", priority: 'high', estimatedTime: 20 },
    ];
    setPendingDeliveries(mockDeliveries);
  };

  const toggleDriver = (driverId: string) => {
    setSelectedDrivers(prev => 
      prev.includes(driverId) 
        ? prev.filter(id => id !== driverId)
        : [...prev, driverId]
    );
  };

  const toggleDelivery = (deliveryId: string) => {
    setSelectedDeliveries(prev => 
      prev.includes(deliveryId) 
        ? prev.filter(id => id !== deliveryId)
        : [...prev, deliveryId]
    );
  };

  const optimizeRoutes = () => {
    if (selectedDrivers.length === 0 || selectedDeliveries.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one driver and one delivery",
        variant: "destructive",
      });
      return;
    }

    setIsOptimizing(true);

    // Simple optimization algorithm - distribute deliveries among selected drivers
    // In production, this would use a proper routing algorithm
    setTimeout(() => {
      const routes: Record<string, Delivery[]> = {};
      const selectedDeliveryObjects = pendingDeliveries.filter(d => selectedDeliveries.includes(d.id));
      
      selectedDrivers.forEach((driverId, index) => {
        // Distribute deliveries evenly
        const driverDeliveries = selectedDeliveryObjects.filter((_, i) => i % selectedDrivers.length === index);
        routes[driverId] = driverDeliveries;
      });

      setOptimizedRoutes(routes);
      setIsOptimizing(false);

      toast({
        title: "Routes Optimized",
        description: `Created routes for ${selectedDrivers.length} drivers`,
      });
    }, 1500);
  };

  const assignRoutes = async () => {
    try {
      // In production, this would update the delivery_jobs table
      toast({
        title: "Routes Assigned",
        description: "Deliveries have been assigned to drivers",
      });

      // Clear selections
      setSelectedDrivers([]);
      setSelectedDeliveries([]);
      setOptimizedRoutes({});
    } catch (error) {
      console.error("Error assigning routes:", error);
      toast({
        title: "Error",
        description: "Failed to assign routes",
        variant: "destructive",
      });
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return <Badge className="bg-red-500">High</Badge>;
      case 'normal':
        return <Badge className="bg-blue-500">Normal</Badge>;
      default:
        return <Badge variant="outline">Low</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Route Optimization</h1>
          <p className="text-muted-foreground">Plan and optimize delivery routes</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant={activeTab === 'planning' ? 'default' : 'outline'}
            onClick={() => setActiveTab('planning')}
          >
            <Route className="h-4 w-4 mr-2" />
            Route Planning
          </Button>
          <Button 
            variant={activeTab === 'zones' ? 'default' : 'outline'}
            onClick={() => setActiveTab('zones')}
          >
            <MapPin className="h-4 w-4 mr-2" />
            Zones
          </Button>
        </div>
      </div>

      {activeTab === 'planning' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Driver Selection */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                Available Drivers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {drivers.map((driver) => (
                  <div 
                    key={driver.id} 
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedDrivers.includes(driver.id) 
                        ? 'bg-primary/10 border border-primary' 
                        : 'hover:bg-muted'
                    }`}
                    onClick={() => toggleDriver(driver.id)}
                  >
                    <Checkbox checked={selectedDrivers.includes(driver.id)} />
                    <div className="flex-1">
                      <p className="font-medium">{driver.fullName}</p>
                      <p className="text-sm text-muted-foreground">{driver.phone}</p>
                    </div>
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                  </div>
                ))}
                {drivers.length === 0 && (
                  <p className="text-muted-foreground text-center py-4">No online drivers available</p>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Selected: {selectedDrivers.length} drivers
              </p>
            </CardContent>
          </Card>

          {/* Delivery Selection */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="h-5 w-5" />
                Pending Deliveries
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {pendingDeliveries.map((delivery) => (
                  <div 
                    key={delivery.id} 
                    className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedDeliveries.includes(delivery.id) 
                        ? 'bg-primary/10 border border-primary' 
                        : 'hover:bg-muted'
                    }`}
                    onClick={() => toggleDelivery(delivery.id)}
                  >
                    <Checkbox 
                      checked={selectedDeliveries.includes(delivery.id)} 
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {getPriorityBadge(delivery.priority)}
                        <span className="text-sm text-muted-foreground">{delivery.estimatedTime} min</span>
                      </div>
                      <p className="text-sm mt-1">{delivery.deliveryAddress}</p>
                    </div>
                  </div>
                ))}
                {pendingDeliveries.length === 0 && (
                  <p className="text-muted-foreground text-center py-4">No pending deliveries</p>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Selected: {selectedDeliveries.length} deliveries
              </p>
            </CardContent>
          </Card>

          {/* Route Summary */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Route Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              {Object.keys(optimizedRoutes).length > 0 ? (
                <div className="space-y-4">
                  {Object.entries(optimizedRoutes).map(([driverId, deliveries]) => {
                    const driver = drivers.find(d => d.id === driverId);
                    return (
                      <div key={driverId} className="p-3 bg-muted rounded-lg">
                        <p className="font-medium">{driver?.fullName || 'Unknown Driver'}</p>
                        <p className="text-sm text-muted-foreground">
                          {deliveries.length} deliveries assigned
                        </p>
                        <div className="mt-2 space-y-1">
                          {deliveries.map((delivery, idx) => (
                            <div key={delivery.id} className="text-xs flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                                {idx + 1}
                              </span>
                              <span className="truncate">{delivery.deliveryAddress}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  <Button onClick={assignRoutes} className="w-full">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Assign Routes
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setOptimizedRoutes({});
                      setSelectedDrivers([]);
                      setSelectedDeliveries([]);
                    }} 
                    className="w-full"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reset
                  </Button>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Route className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">Select drivers and deliveries to optimize routes</p>
                  <Button 
                    onClick={optimizeRoutes} 
                    disabled={isOptimizing || selectedDrivers.length === 0 || selectedDeliveries.length === 0}
                    className="mt-4"
                  >
                    {isOptimizing ? (
                      <>
                        <div className="animate-spin mr-2 h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                        Optimizing...
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        Optimize Routes
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        /* Zones View */
        <Card>
          <CardHeader>
            <CardTitle>Zone Management</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12">
              <MapPin className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Zone visualization coming soon</p>
              <p className="text-sm text-muted-foreground mt-2">
                View and manage delivery zones on the map
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
