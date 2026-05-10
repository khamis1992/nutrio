/**
 * useFleetRealtimeDrivers - Supabase realtime subscription for all driver locations
 * Color codes: green=available, blue=busy, gray=offline
 */

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type DriversRow = Database["public"]["Tables"]["drivers"]["Row"];
type DriverProfilesRow = Database["public"]["Tables"]["driver_profiles"]["Row"];

interface DriverLocationPayload {
  driver_id: string;
  location: string;
  recorded_at?: string | null;
}

interface DriverUpdatePayload {
  id: string;
  full_name?: string | null;
  is_online?: boolean | null;
  current_order_id?: string | null;
}

export interface FleetDriverLocation {
  id: string;
  driver_id: string;
  driver_name: string;
  vehicle_type?: string;
  rating?: number;
  lat: number;
  lng: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  status: "available" | "busy" | "offline";
  current_order_id?: string;
  last_seen: string;
}

const OFFLINE_THRESHOLD_MS = 5 * 60 * 1000;

export function useFleetRealtimeDrivers() {
  const [drivers, setDrivers] = useState<FleetDriverLocation[]>([]);
  const [connected, setConnected] = useState(false);

  // Parse PostGIS point
  const parsePoint = (location: string): { lat: number; lng: number } | null => {
    const match = location.match(/POINT\(([-\d.]+)\s+([-\d.]+)\)/);
    if (match) return { lat: parseFloat(match[2]), lng: parseFloat(match[1]) };
    return null;
  };

  // Fetch initial drivers
  const fetchDrivers = useCallback(async () => {
    const { data: locations } = await supabase
      .from("driver_locations")
      .select("driver_id, location, accuracy, recorded_at")
      .order("recorded_at", { ascending: false });

    if (!locations?.length) return;

    // Get unique driver IDs
    const driverIds = [...new Set(locations.map((l: { driver_id: string }) => l.driver_id))];
    const latestByDriver = new Map<string, { driver_id: string; location: string; accuracy?: number; recorded_at: string }>();
    for (const loc of locations) {
      if (!latestByDriver.has(loc.driver_id)) latestByDriver.set(loc.driver_id, loc);
    }

    // Batch fetch driver profiles
    const { data: profiles } = await supabase
      .from("driver_profiles")
      .select("id, driver_id, current_location, updated_at")
      .in("driver_id", driverIds);

    const { data: driversData } = await supabase
      .from("drivers")
      .select("id, full_name, vehicle_type, rating, is_online, current_order_id")
      .in("id", driverIds);

    const driverMap: Record<string, DriversRow> = {};
    driversData?.forEach((d: DriversRow) => { driverMap[d.id] = d; });

    const now = Date.now();
    const result: FleetDriverLocation[] = [];

    // Use driver_profiles.current_location as primary source
    profiles?.forEach((p: DriverProfilesRow) => {
      const d = driverMap[p.driver_id];
      if (!d) return;

      const point = parsePoint(p.current_location);
      if (!point) return;

      const lastSeen = p.updated_at || new Date().toISOString();
      const isOffline = now - new Date(lastSeen).getTime() > OFFLINE_THRESHOLD_MS;

      result.push({
        id: p.id,
        driver_id: p.driver_id,
        driver_name: d.full_name || "Unknown",
        vehicle_type: d.vehicle_type,
        rating: d.rating,
        lat: point.lat,
        lng: point.lng,
        accuracy: undefined,
        speed: undefined,
        heading: undefined,
        status: isOffline ? "offline" : d.current_order_id ? "busy" : "available",
        current_order_id: d.current_order_id,
        last_seen: lastSeen,
      });
    });

    setDrivers(result);
  }, []);

  useEffect(() => {
    fetchDrivers();

    const channel = supabase
      .channel("fleet-driver-locations")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "driver_locations" }, (payload) => {
        const loc = payload.new as { driver_id: string; location: string; recorded_at?: string };
        const point = parsePoint(loc.location);
        if (!point) return;

        // Quick update without fetching full profile (for performance)
        setDrivers((prev) => {
          const idx = prev.findIndex((d) => d.driver_id === loc.driver_id);
          if (idx >= 0) {
            const existing = prev[idx];
            const newTimestamp = new Date(loc.recorded_at || Date.now()).getTime();
            const existingTimestamp = new Date(existing.last_seen).getTime();
            
            // Ignore stale updates - only update if newer
            if (newTimestamp < existingTimestamp) {
              return prev;
            }
            
            const updated = [...prev];
            updated[idx] = { 
              ...updated[idx], 
              lat: point.lat, 
              lng: point.lng, 
              last_seen: loc.recorded_at || new Date().toISOString(), 
              status: "available" 
            };
            return updated;
          }
          return prev;
        });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "drivers" }, (payload) => {
        const d = payload.new as DriverUpdatePayload;
        setDrivers((prev) =>
          prev.map((driver) =>
            driver.driver_id === d.id
              ? { ...driver, driver_name: d.full_name || driver.driver_name, status: !d.is_online ? "offline" : d.current_order_id ? "busy" : "available" }
              : driver
          )
        );
      })
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED");
      });

    // Refresh every 30s to catch status changes
    const interval = setInterval(fetchDrivers, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [fetchDrivers]);

  return { drivers, connected };
}
