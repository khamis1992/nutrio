import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  LocateFixed,
  MapPin,
  Navigation,
  RefreshCw,
  Search,
  Star,
  Truck,
  Wifi,
  WifiOff,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useFleetRealtimeDrivers } from "@/fleet/hooks/useFleetRealtimeDrivers";
import { supabase } from "@/integrations/supabase/client";
import type { Driver } from "@/fleet/types";

import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

const DefaultIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

const DOHA_CENTER: [number, number] = [25.2854, 51.1839];

const C = {
  ink: "#020617",
  muted: "#94A3B8",
  panel: "#F6F8FB",
  protein: "#7C83F6",
  progress: "#22C7A1",
  water: "#38BDF8",
  fat: "#FB6B7A",
};

function makeDriverIcon(driver: Driver) {
  const color = driver.isOnline ? C.progress : "#CBD5E1";
  const label = driver.fullName.charAt(0).toUpperCase();

  return L.divIcon({
    className: "nutrio-driver-marker",
    html: `
      <div style="
        width: 36px;
        height: 36px;
        border-radius: 14px;
        background: ${color};
        color: ${driver.isOnline ? "#ffffff" : C.ink};
        border: 3px solid white;
        box-shadow: 0 14px 26px rgba(2, 6, 23, 0.22);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 13px;
        font-weight: 900;
        font-family: inherit;
      ">${label}</div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

function locationAgeLabel(updatedAt?: string) {
  if (!updatedAt) return "No recent ping";
  const minutes = Math.max(0, Math.round((Date.now() - new Date(updatedAt).getTime()) / 60000));
  if (minutes < 1) return "Just now";
  if (minutes === 1) return "1 min ago";
  return `${minutes} min ago`;
}

export default function LiveTracking() {
  const { toast } = useToast();
  const { drivers: liveDrivers, connected: isConnected, refetch: refetchLocations } = useFleetRealtimeDrivers();
  const [search, setSearch] = useState("");
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markerLayer = useRef<L.LayerGroup | null>(null);
  const markers = useRef<Record<string, L.Marker>>({});

  useEffect(() => {
    if (!mapContainer.current) return;

    try {
      map.current = L.map(mapContainer.current, {
        center: DOHA_CENTER,
        zoom: 12,
        zoomControl: false,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(map.current);

      L.control.zoom({ position: "bottomleft" }).addTo(map.current);
      markerLayer.current = L.layerGroup().addTo(map.current);
    } catch (error) {
      console.error("[LiveTracking] Error initializing map:", error);
      setMapError("Failed to initialize map");
    }

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  const fetchDrivers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("drivers")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const transformedDrivers: Driver[] = (data || []).map((driver) => ({
        id: driver.id,
        authUserId: driver.user_id,
        email: driver.email || "",
        phone: driver.phone_number || "",
        fullName: driver.full_name || `Driver ${driver.phone_number?.slice(-4) || driver.id.slice(0, 8)}`,
        cityId: driver.city_id || "",
        assignedZoneIds: driver.assigned_zone_ids || [],
        status: driver.approval_status === "approved" && driver.is_active
          ? "active"
          : driver.approval_status === "pending"
            ? "pending_verification"
            : "inactive",
        currentLatitude: driver.current_lat || undefined,
        currentLongitude: driver.current_lng || undefined,
        locationUpdatedAt: driver.last_location_update || undefined,
        isOnline: driver.is_online || false,
        totalDeliveries: driver.total_deliveries || 0,
        rating: driver.rating || 5.0,
        cancellationRate: driver.cancellation_rate || 0,
        currentBalance: driver.wallet_balance || 0,
        totalEarnings: driver.total_earnings || 0,
        assignedVehicleId: undefined,
        createdAt: driver.created_at || new Date().toISOString(),
      }));

      setDrivers(transformedDrivers);
    } catch (error) {
      console.error("Error fetching drivers:", error);
      toast({
        title: "Error",
        description: "Failed to load drivers",
        variant: "destructive",
      });
    }
  }, [toast]);

  useEffect(() => {
    fetchDrivers();
  }, [fetchDrivers]);

  useEffect(() => {
    const liveById = new Map(liveDrivers.map((driver) => [driver.driver_id, driver]));
    setDrivers((currentDrivers) =>
      currentDrivers.map((driver) => {
        const live = liveById.get(driver.id);
        return live
          ? {
              ...driver,
              currentLatitude: live.lat,
              currentLongitude: live.lng,
              locationUpdatedAt: live.last_seen,
              isOnline: live.status !== "offline",
            }
          : driver;
      }),
    );
  }, [liveDrivers]);

  const filteredDrivers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return drivers;

    return drivers.filter((driver) =>
      driver.fullName.toLowerCase().includes(query) ||
      driver.phone.includes(query)
    );
  }, [drivers, search]);

  const driversWithLocation = filteredDrivers.filter((driver) => driver.currentLatitude && driver.currentLongitude);
  const onlineDrivers = filteredDrivers.filter((driver) => driver.isOnline);

  useEffect(() => {
    if (!map.current || !markerLayer.current) return;

    markerLayer.current.clearLayers();
    markers.current = {};

    filteredDrivers.forEach((driver) => {
      if (!driver.currentLatitude || !driver.currentLongitude) return;

      const popupContent = `
        <div style="min-width: 170px; padding: 8px; color: ${C.ink};">
          <div style="font-weight: 900; font-size: 14px;">${driver.fullName}</div>
          <div style="font-size: 12px; color: ${C.muted}; margin-top: 2px;">${driver.phone}</div>
          <div style="margin-top: 8px; display: flex; gap: 6px; align-items: center;">
            <span style="width: 8px; height: 8px; border-radius: 999px; background: ${driver.isOnline ? C.progress : "#CBD5E1"};"></span>
            <span style="font-size: 12px; font-weight: 800;">${driver.isOnline ? "Online" : "Offline"}</span>
          </div>
          <div style="font-size: 12px; color: ${C.muted}; margin-top: 6px;">${driver.totalDeliveries} deliveries / ${driver.rating.toFixed(1)} rating</div>
        </div>
      `;

      const marker = L.marker([driver.currentLatitude, driver.currentLongitude], {
        icon: makeDriverIcon(driver),
      })
        .bindPopup(popupContent)
        .on("click", () => setSelectedDriver(driver));

      marker.addTo(markerLayer.current!);
      markers.current[driver.id] = marker;
    });

    if (driversWithLocation.length > 0) {
      const bounds = L.latLngBounds(
        driversWithLocation.map((driver) => [driver.currentLatitude!, driver.currentLongitude!])
      );
      map.current.fitBounds(bounds, { padding: [44, 44], maxZoom: 15 });
    }
  }, [driversWithLocation, filteredDrivers]);

  const refreshDrivers = useCallback(async () => {
    await Promise.all([fetchDrivers(), refetchLocations()]);
  }, [fetchDrivers, refetchLocations]);

  const centerDriver = (driver: Driver) => {
    setSelectedDriver(driver);
    if (driver.currentLatitude && driver.currentLongitude) {
      markers.current[driver.id]?.openPopup();
      map.current?.setView([driver.currentLatitude, driver.currentLongitude], 15);
    }
  };

  if (mapError) {
    return (
      <div className="rounded-[28px] bg-white p-10 text-center text-[#020617] ring-1 ring-[#E5EAF1]">
        <Navigation className="mx-auto mb-4 h-14 w-14 text-[#7C83F6]" />
        <p className="font-black">{mapError}</p>
        <Button onClick={() => window.location.reload()} variant="outline" className="mt-4 rounded-full border-[#E5EAF1] bg-white font-black text-[#020617]">
          Reload Page
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5 bg-[#F6F8FB] px-1 pb-8 text-[#020617] sm:px-0">
      <div className="overflow-hidden rounded-[28px] bg-white p-5 ring-1 ring-[#E5EAF1]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[#F6F8FB] px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-[#38BDF8]">
              <span className="h-2 w-2 rounded-full bg-[#22C7A1]" />
              Live tracking
            </div>
            <h1 className="mt-3 text-[27px] font-black leading-tight text-[#020617]">Driver map</h1>
            <p className="mt-1 max-w-[34rem] text-sm font-semibold leading-6 text-[#64748B]">
              Monitor driver locations, online status, and recent movement across active coverage areas in real time.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge className={isConnected ? "border border-[#22C7A1]/25 bg-[#22C7A1]/10 text-[#047857]" : "border border-[#FB6B7A]/25 bg-[#FB6B7A]/10 text-[#BE123C]"}>
              {isConnected ? <Wifi className="mr-1 h-3 w-3" /> : <WifiOff className="mr-1 h-3 w-3" />}
              {isConnected ? "Connected" : "Disconnected"}
            </Badge>
            <Button variant="outline" size="sm" onClick={() => void refreshDrivers()} className="min-h-10 rounded-full border-[#E5EAF1] bg-white font-black text-[#020617] shadow-none">
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Online", value: onlineDrivers.length, icon: Wifi, color: C.progress },
          { label: "Tracked", value: driversWithLocation.length, icon: MapPin, color: C.water },
          { label: "Total", value: filteredDrivers.length, icon: Truck, color: C.protein },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-[24px] bg-white p-4 ring-1 ring-[#E5EAF1]">
            <Icon className="mb-3 h-5 w-5" style={{ color }} />
            <p className="text-2xl font-black leading-none text-[#020617]">{value}</p>
            <p className="mt-1 text-xs font-bold text-[#94A3B8]">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid min-h-[680px] grid-cols-1 gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="flex min-h-[520px] flex-col rounded-[28px] border-0 bg-white shadow-none ring-1 ring-[#E5EAF1]">
          <CardContent className="flex min-h-0 flex-1 flex-col p-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
              <Input
                placeholder="Search drivers..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="min-h-12 rounded-2xl border-[#E5EAF1] bg-[#F6F8FB] pl-11 font-semibold text-[#020617] placeholder:text-[#94A3B8]"
              />
            </div>

            <div className="mt-4 min-h-0 flex-1 space-y-2 overflow-auto pr-1">
              {filteredDrivers.map((driver) => {
                const selected = selectedDriver?.id === driver.id;
                const hasLocation = Boolean(driver.currentLatitude && driver.currentLongitude);

                return (
                  <button
                    key={driver.id}
                    type="button"
                    className={`w-full rounded-2xl border p-3 text-left transition-colors ${
                      selected ? "border-[#020617] bg-[#F6F8FB]" : "border-[#E5EAF1] bg-white hover:bg-[#F6F8FB]"
                    }`}
                    onClick={() => centerDriver(driver)}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-black"
                        style={{
                          backgroundColor: driver.isOnline ? `${C.progress}18` : C.panel,
                          color: driver.isOnline ? C.progress : C.muted,
                        }}
                      >
                        {driver.fullName.charAt(0).toUpperCase()}
                        <span
                          className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full border-2 border-white"
                          style={{ backgroundColor: driver.isOnline ? C.progress : "#CBD5E1" }}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-black text-[#020617]">{driver.fullName}</p>
                        <p className="truncate text-xs font-semibold text-[#94A3B8]">{driver.phone}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2 text-xs font-bold">
                      <span className={hasLocation ? "text-[#38BDF8]" : "text-[#94A3B8]"}>
                        {hasLocation ? "Location available" : "No location data"}
                      </span>
                      <span className="text-[#94A3B8]">{locationAgeLabel(driver.locationUpdatedAt)}</span>
                    </div>
                  </button>
                );
              })}

              {filteredDrivers.length === 0 && (
                <div className="rounded-2xl border border-dashed border-[#CBD5E1] bg-[#F6F8FB] py-10 text-center text-[#94A3B8]">
                  <Search className="mx-auto mb-2 h-8 w-8" />
                  <p className="text-sm font-black">No drivers found</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="relative min-h-[620px] overflow-hidden rounded-[28px] border-0 bg-white shadow-none ring-1 ring-[#E5EAF1]">
          <CardContent className="h-full p-0">
            <div ref={mapContainer} className="absolute inset-0" />

            <div className="absolute bottom-4 right-4 z-10 rounded-[22px] bg-white/95 p-3 ring-1 ring-[#E5EAF1] backdrop-blur">
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="rounded-2xl bg-[#F6F8FB] px-4 py-3">
                  <p className="text-2xl font-black text-[#22C7A1]">{onlineDrivers.length}</p>
                  <p className="text-[10px] font-black uppercase text-[#94A3B8]">Online</p>
                </div>
                <div className="rounded-2xl bg-[#F6F8FB] px-4 py-3">
                  <p className="text-2xl font-black text-[#7C83F6]">{filteredDrivers.length}</p>
                  <p className="text-[10px] font-black uppercase text-[#94A3B8]">Total</p>
                </div>
              </div>
            </div>

            {selectedDriver && (
              <div className="absolute left-4 top-4 z-10 w-[min(320px,calc(100%-2rem))] rounded-[24px] bg-white/95 p-4 ring-1 ring-[#E5EAF1] backdrop-blur">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-base font-black"
                    style={{
                      backgroundColor: selectedDriver.isOnline ? `${C.progress}18` : C.panel,
                      color: selectedDriver.isOnline ? C.progress : C.muted,
                    }}
                  >
                    {selectedDriver.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-black text-[#020617]">{selectedDriver.fullName}</p>
                    <p className="truncate text-xs font-semibold text-[#94A3B8]">{selectedDriver.phone}</p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="rounded-2xl bg-[#F6F8FB] p-3">
                    <Navigation className="mb-2 h-4 w-4 text-[#22C7A1]" />
                    <p className="text-xs font-black text-[#020617]">{selectedDriver.isOnline ? "Online" : "Offline"}</p>
                  </div>
                  <div className="rounded-2xl bg-[#F6F8FB] p-3">
                    <Truck className="mb-2 h-4 w-4 text-[#38BDF8]" />
                    <p className="text-xs font-black text-[#020617]">{selectedDriver.totalDeliveries}</p>
                  </div>
                  <div className="rounded-2xl bg-[#F6F8FB] p-3">
                    <Star className="mb-2 h-4 w-4 fill-[#FB6B7A] text-[#FB6B7A]" />
                    <p className="text-xs font-black text-[#020617]">{selectedDriver.rating.toFixed(1)}</p>
                  </div>
                </div>

                <Button
                  className="mt-4 min-h-11 w-full rounded-full bg-[#020617] font-black text-white shadow-none hover:bg-[#020617]/90"
                  size="sm"
                  onClick={() => {
                    if (selectedDriver.currentLatitude && selectedDriver.currentLongitude) {
                      map.current?.setView([selectedDriver.currentLatitude, selectedDriver.currentLongitude], 16);
                    }
                  }}
                >
                  <LocateFixed className="mr-2 h-4 w-4" />
                  Center on Map
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
