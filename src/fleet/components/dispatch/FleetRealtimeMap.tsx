/**
 * FleetRealtimeMap - Shows all active drivers on a map in real-time
 * Color coded: green=available, blue=busy, gray=offline
 * Click driver to see details and assign orders
 */

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useFleetRealtimeDrivers, type FleetDriverLocation } from "@/fleet/hooks/useFleetRealtimeDrivers";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Phone, Star, Package, Navigation, Wifi, WifiOff, Loader2 } from "lucide-react";

const DOHA_CENTER: [number, number] = [25.2854, 51.1839];

function makeDriverPin(color: string, label: string): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<div style="
      background:${color};color:white;font-size:11px;font-weight:700;
      padding:3px 8px;border-radius:20px;white-space:nowrap;
      box-shadow:0 2px 8px rgba(0,0,0,.35);border:2px solid white;
    ">${label}</div>`,
    iconAnchor: [20, 15],
  });
}

export function FleetRealtimeMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const { drivers, connected } = useFleetRealtimeDrivers();
  const [selectedDriver, setSelectedDriver] = useState<FleetDriverLocation | null>(null);

  // Init map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    mapRef.current = L.map(containerRef.current, {
      center: DOHA_CENTER,
      zoom: 12,
      attributionControl: false,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(mapRef.current);
    return () => { mapRef.current?.remove(); mapRef.current = null; };
  }, []);

  // Update markers
  useEffect(() => {
    if (!mapRef.current) return;
    const currentIds = new Set(drivers.map((d) => d.driver_id));

    markersRef.current.forEach((m, id) => {
      if (!currentIds.has(id)) { m.remove(); markersRef.current.delete(id); }
    });

    drivers.forEach((d) => {
      const color = d.status === "available" ? "#16a34a" : d.status === "busy" ? "#2563eb" : "#9ca3af";
      const label = (d.driver_name || "Driver").split(" ")[0];
      const icon = makeDriverPin(color, label);
      const existing = markersRef.current.get(d.driver_id);

      if (existing) {
        existing.setLatLng([d.lat, d.lng]);
        existing.setIcon(icon);
      } else {
        const marker = L.marker([d.lat, d.lng], { icon })
          .addTo(mapRef.current!)
          .bindTooltip(`${d.driver_name || "Driver"} — ${d.status}`)
          .on("click", () => setSelectedDriver(d));
        markersRef.current.set(d.driver_id, marker);
      }
    });

    if (drivers.length > 0) {
      const bounds = L.latLngBounds(drivers.map((d) => [d.lat, d.lng]));
      mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  }, [drivers]);

  const available = drivers.filter((d) => d.status === "available").length;
  const busy = drivers.filter((d) => d.status === "busy").length;
  const offline = drivers.filter((d) => d.status === "offline").length;

  return (
    <div className="space-y-3">
      {/* Status bar */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-3 text-sm">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-green-600" /> {available} Available
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600" /> {busy} Busy
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-gray-400" /> {offline} Offline
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs">
          {connected ? <Wifi className="w-3 h-3 text-green-500" /> : <WifiOff className="w-3 h-3 text-red-400" />}
          <span className={connected ? "text-green-600" : "text-red-500"}>{connected ? "Live" : "Reconnecting"}</span>
        </div>
      </div>

      {/* Map */}
      <div ref={containerRef} className="rounded-xl border overflow-hidden" style={{ minHeight: 350 }} />

      {/* Driver detail popup */}
      {selectedDriver && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="py-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-gray-900">{selectedDriver.driver_name}</p>
                  <Badge variant={selectedDriver.status === "available" ? "default" : "secondary"} className={
                    selectedDriver.status === "available" ? "bg-green-100 text-green-700" :
                    selectedDriver.status === "busy" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"
                  }>
                    {selectedDriver.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-500">
                  {selectedDriver.vehicle_type && <span className="capitalize">{selectedDriver.vehicle_type}</span>}
                  {selectedDriver.rating && (
                    <span className="flex items-center gap-1"><Star className="w-3 h-3 fill-amber-400 text-amber-400" /> {selectedDriver.rating.toFixed(1)}</span>
                  )}
                  {selectedDriver.current_order_id && (
                    <span className="flex items-center gap-1"><Package className="w-3 h-3" /> On delivery</span>
                  )}
                </div>
                <p className="text-xs text-gray-400">
                  Last seen: {new Date(selectedDriver.last_seen).toLocaleTimeString()}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedDriver(null)}>✕</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
