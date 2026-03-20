import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { trackingSocket } from "@/fleet/services/trackingSocket";
import { useFleetAuth } from "@/fleet/hooks/useFleetAuth";
import { 
  MapPin, 
  Navigation,
  Wifi,
  WifiOff,
  Search,
  RefreshCw,
  LocateFixed
} from "lucide-react";
import type { Driver } from "@/fleet/types";
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default marker icon issue in webpack/vite
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Doha, Qatar coordinates
const DOHA_CENTER: [number, number] = [25.2854, 51.1839];

export default function LiveTracking() {
  const { user, token } = useFleetAuth();
  const [search, setSearch] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [filteredDrivers, setFilteredDrivers] = useState<Driver[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markers = useRef<Record<string, L.Marker>>({});
  const markerLayer = useRef<L.LayerGroup | null>(null);

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapContainer.current) return;

    try {
      map.current = L.map(mapContainer.current, {
        center: DOHA_CENTER,
        zoom: 12,
      });

      // Add OpenStreetMap tile layer (free, no API key needed)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map.current);

      // Add layer group for markers
      markerLayer.current = L.layerGroup().addTo(map.current);

      console.log('[LiveTracking] Map loaded successfully');
    } catch (error) {
      console.error('[LiveTracking] Error initializing map:', error);
      setMapError('Failed to initialize map');
    }

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Fetch drivers
  const fetchDrivers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const transformedDrivers: Driver[] = (data || []).map((d: any) => ({
        id: d.id,
        authUserId: d.user_id,
        email: d.email || "",
        phone: d.phone_number || "",
        fullName: d.full_name || `Driver ${d.phone_number?.slice(-4) || d.id.slice(0, 8)}`,
        cityId: d.city_id || "doha",
        assignedZoneIds: d.assigned_zone_ids || [],
        status: d.approval_status === "approved" && d.is_active 
          ? "active" 
          : d.approval_status === "pending" 
            ? "pending_verification" 
            : "inactive",
        currentLatitude: d.current_lat || undefined,
        currentLongitude: d.current_lng || undefined,
        locationUpdatedAt: d.last_location_update || undefined,
        isOnline: d.is_online || false,
        totalDeliveries: d.total_deliveries || 0,
        rating: d.rating || 5.0,
        cancellationRate: d.cancellation_rate || 0,
        currentBalance: d.wallet_balance || 0,
        totalEarnings: d.total_earnings || 0,
        assignedVehicleId: undefined,
        createdAt: d.created_at || new Date().toISOString(),
      }));

      setDrivers(transformedDrivers);
    } catch (error) {
      console.error('Error fetching drivers:', error);
      toast({
        title: 'Error',
        description: 'Failed to load drivers',
        variant: 'destructive',
      });
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchDrivers();
  }, [fetchDrivers]);

  // Filter drivers based on search
  useEffect(() => {
    if (!search.trim()) {
      setFilteredDrivers(drivers);
    } else {
      const filtered = drivers.filter(driver =>
        driver.fullName.toLowerCase().includes(search.toLowerCase()) ||
        driver.phone.includes(search)
      );
      setFilteredDrivers(filtered);
    }
  }, [drivers, search]);

  // Update markers when filtered drivers change
  useEffect(() => {
    if (!map.current || !markerLayer.current) return;

    // Clear existing markers
    markerLayer.current.clearLayers();
    markers.current = {};

    // Add new markers
    filteredDrivers.forEach(driver => {
      if (!driver.currentLatitude || !driver.currentLongitude) return;

      // Create custom marker icon
      const iconHtml = `
        <div style="
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: ${driver.isOnline ? '#22c55e' : '#6b7280'};
          border: 3px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        "></div>
      `;

      const customIcon = L.divIcon({
        html: iconHtml,
        className: 'custom-driver-marker',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      const popupContent = `
        <div style="padding: 8px; min-width: 150px;">
          <strong>${driver.fullName}</strong><br/>
          <span style="font-size: 12px; color: #666;">${driver.phone}</span><br/>
          <span style="font-size: 12px; color: ${driver.isOnline ? '#22c55e' : '#6b7280'};">
            ${driver.isOnline ? '🟢 Online' : '⚪ Offline'}
          </span><br/>
          <span style="font-size: 12px; color: #666;">
            ${driver.totalDeliveries} deliveries
          </span><br/>
          <span style="font-size: 12px; color: #f59e0b;">
            ★ ${driver.rating.toFixed(1)}
          </span>
        </div>
      `;

      const marker = L.marker(
        [driver.currentLatitude, driver.currentLongitude],
        { icon: customIcon }
      )
        .bindPopup(popupContent)
        .on('click', () => {
          setSelectedDriver(driver);
        });

      if (markerLayer.current) {
        marker.addTo(markerLayer.current);
      }
      markers.current[driver.id] = marker;
    });

    // Fit map to show all markers if there are any
    if (filteredDrivers.length > 0 && filteredDrivers.some(d => d.currentLatitude && d.currentLongitude)) {
      const bounds = L.latLngBounds(
        filteredDrivers
          .filter(d => d.currentLatitude && d.currentLongitude)
          .map(d => [d.currentLatitude!, d.currentLongitude!])
      );
      map.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [filteredDrivers]);

  // WebSocket connection
  useEffect(() => {
    if (!user) return;

    trackingSocket.connect({
      token: token || '',
      userRole: 'fleet_manager',
      onConnect: () => {
        console.log('[LiveTracking] WebSocket connected');
        setIsConnected(true);
      },
      onDisconnect: () => {
        console.log('[LiveTracking] WebSocket disconnected');
        setIsConnected(false);
      },
      onDriverLocation: (location) => {
        console.log('[LiveTracking] Driver location update:', location);
        setDrivers(prev => prev.map(d =>
          d.id === location.driverId
            ? { ...d, currentLatitude: location.latitude, currentLongitude: location.longitude }
            : d
        ));
      },
      onError: (error) => {
        console.error('[LiveTracking] WebSocket error:', error);
      }
    });

    return () => {
      trackingSocket.disconnect();
    };
  }, [user, token]);

  const onlineDrivers = filteredDrivers.filter(d => d.isOnline);

  if (mapError) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <Navigation className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
          <p className="text-muted-foreground">{mapError}</p>
          <Button onClick={() => window.location.reload()} variant="outline" className="mt-4">
            Reload Page
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 h-[calc(100vh-6rem)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Live Tracking</h1>
          <p className="text-muted-foreground">Track drivers in real-time</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={isConnected ? "default" : "secondary"}>
            {isConnected ? (
              <><Wifi className="h-3 w-3 mr-1" /> Connected</>
            ) : (
              <><WifiOff className="h-3 w-3 mr-1" /> Disconnected</>
            )}
          </Badge>
          <Button variant="outline" size="sm" onClick={fetchDrivers}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex gap-4 h-[calc(100%-5rem)]">
        {/* Drivers List */}
        <Card className="w-80 flex flex-col">
          <CardHeader>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search drivers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto">
            <div className="space-y-2">
              {filteredDrivers.map((driver) => (
                <div
                  key={driver.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedDriver?.id === driver.id
                      ? 'border-primary bg-primary/5'
                      : 'hover:bg-muted'
                  }`}
                  onClick={() => {
                    setSelectedDriver(driver);
                    if (driver.currentLatitude && driver.currentLongitude && markers.current[driver.id]) {
                      markers.current[driver.id].openPopup();
                      map.current?.setView([driver.currentLatitude, driver.currentLongitude], 15);
                    }
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${driver.isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{driver.fullName}</p>
                      <p className="text-xs text-muted-foreground truncate">{driver.phone}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    <span>
                      {driver.currentLatitude && driver.currentLongitude
                        ? 'Location available'
                        : 'No location data'}
                    </span>
                  </div>
                </div>
              ))}
              
              {filteredDrivers.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No drivers found</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Map Area */}
        <Card className="flex-1 relative">
          <CardContent className="p-0 h-full">
            <div ref={mapContainer} className="absolute inset-0 rounded-lg" />
            
            {/* Stats Overlay */}
            <div className="absolute bottom-4 right-4 z-10">
              <div className="bg-white rounded-lg shadow-lg px-4 py-3">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold">{onlineDrivers.length}</p>
                    <p className="text-xs text-muted-foreground">Online</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{filteredDrivers.length}</p>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Selected Driver Info Overlay */}
            {selectedDriver && (
              <div className="absolute top-4 left-4 z-10">
                <div className="bg-white rounded-lg shadow-lg p-4 min-w-[200px]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="font-semibold text-primary">
                        {selectedDriver.fullName.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium">{selectedDriver.fullName}</p>
                      <p className="text-xs text-muted-foreground">{selectedDriver.phone}</p>
                    </div>
                  </div>
                  <div className="mt-3 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status</span>
                      <Badge variant={selectedDriver.isOnline ? "default" : "secondary"}>
                        {selectedDriver.isOnline ? 'Online' : 'Offline'}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Deliveries</span>
                      <span>{selectedDriver.totalDeliveries}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Rating</span>
                      <span>★ {selectedDriver.rating.toFixed(1)}</span>
                    </div>
                  </div>
                  <Button 
                    className="w-full mt-3" 
                    size="sm"
                    onClick={() => {
                      if (selectedDriver.currentLatitude && selectedDriver.currentLongitude) {
                        map.current?.setView([selectedDriver.currentLatitude, selectedDriver.currentLongitude], 16);
                      }
                    }}
                  >
                    <LocateFixed className="h-4 w-4 mr-2" />
                    Center on Map
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
