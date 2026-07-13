/**
 * useFleetRealtimeDrivers - Supabase realtime subscription for all driver locations
 * Color codes: green=available, blue=busy, gray=offline
 */

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type DriverLocationRow = Database["public"]["Tables"]["driver_locations"]["Row"];
type DriverLocationSnapshot = Pick<
  DriverLocationRow,
  "driver_id" | "location" | "accuracy_meters" | "speed_kmh" | "heading" | "timestamp"
>;

interface DriverUpdatePayload {
  id: string;
  full_name?: string | null;
  is_online?: boolean | null;
  current_job_id?: string | null;
}

export interface FleetDriverLocation {
  id: string;
  driver_id: string;
  driver_name: string;
  city_id: string;
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
  const parsePoint = (location: unknown): { lat: number; lng: number } | null => {
    if (typeof location === "string") {
      const match = location.match(/POINT\(([-\d.]+)\s+([-\d.]+)\)/);
      if (match) return { lat: parseFloat(match[2]), lng: parseFloat(match[1]) };
    }
    if (location && typeof location === "object" && "coordinates" in location) {
      const coordinates = (location as { coordinates?: unknown }).coordinates;
      if (
        Array.isArray(coordinates) &&
        typeof coordinates[0] === "number" &&
        typeof coordinates[1] === "number"
      ) {
        return { lat: coordinates[1], lng: coordinates[0] };
      }
    }
    return null;
  };

  // Fetch initial drivers
  const fetchDrivers = useCallback(async () => {
    const { data: driversData, error: driversError } = await supabase
      .from("drivers")
      .select("id, full_name, city_id, vehicle_type, rating, is_online, current_job_id, current_lat, current_lng, last_location_at");

    if (driversError) throw driversError;
    if (!driversData?.length) {
      setDrivers([]);
      return;
    }

    const driverIds = driversData.map((driver) => driver.id);
    const { data: locations, error: locationsError } = await supabase
      .from("driver_locations")
      .select("driver_id, location, accuracy_meters, speed_kmh, heading, timestamp")
      .in("driver_id", driverIds)
      .order("timestamp", { ascending: false });

    if (locationsError) throw locationsError;

    const latestByDriver = new Map<string, DriverLocationSnapshot>();
    for (const location of locations ?? []) {
      if (!latestByDriver.has(location.driver_id)) latestByDriver.set(location.driver_id, location);
    }

    const now = Date.now();
    const result: FleetDriverLocation[] = [];

    driversData.forEach((driver) => {
      const location = latestByDriver.get(driver.id);
      const point = location
        ? parsePoint(location.location)
        : driver.current_lat !== null && driver.current_lng !== null
          ? { lat: driver.current_lat, lng: driver.current_lng }
          : null;
      if (!point) return;

      const lastSeen = location?.timestamp ?? driver.last_location_at ?? new Date(0).toISOString();
      const isOffline = now - new Date(lastSeen).getTime() > OFFLINE_THRESHOLD_MS;

      result.push({
        id: driver.id,
        driver_id: driver.id,
        driver_name: driver.full_name || "Unknown",
        city_id: driver.city_id || "",
        vehicle_type: driver.vehicle_type ?? undefined,
        rating: driver.rating ?? undefined,
        lat: point.lat,
        lng: point.lng,
        accuracy: location?.accuracy_meters ?? undefined,
        speed: location?.speed_kmh ?? undefined,
        heading: location?.heading ?? undefined,
        status: isOffline || !driver.is_online ? "offline" : driver.current_job_id ? "busy" : "available",
        current_order_id: driver.current_job_id ?? undefined,
        last_seen: lastSeen,
      });
    });

    setDrivers(result);
  }, []);

  useEffect(() => {
    fetchDrivers().catch((error) => {
      console.error("Failed to load fleet driver locations:", error);
    });

    const channel = supabase
      .channel("fleet-driver-locations")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "driver_locations" }, (payload) => {
        const loc = payload.new as DriverLocationRow;
        const point = parsePoint(loc.location);
        if (!point) return;

        // Quick update without fetching full profile (for performance)
        setDrivers((prev) => {
          const idx = prev.findIndex((d) => d.driver_id === loc.driver_id);
          if (idx >= 0) {
            const existing = prev[idx];
            const newTimestamp = new Date(loc.timestamp || Date.now()).getTime();
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
              accuracy: loc.accuracy_meters ?? existing.accuracy,
              speed: loc.speed_kmh ?? existing.speed,
              heading: loc.heading ?? existing.heading,
              last_seen: loc.timestamp || new Date().toISOString(), 
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
              ? {
                  ...driver,
                  driver_name: d.full_name || driver.driver_name,
                  status: !d.is_online ? "offline" : d.current_job_id ? "busy" : "available",
                  current_order_id: d.current_job_id ?? undefined,
                }
              : driver
          )
        );
      })
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED");
      });

    // Refresh every 30s to catch status changes
    const interval = setInterval(() => {
      fetchDrivers().catch((error) => {
        console.error("Failed to refresh fleet driver locations:", error);
      });
    }, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [fetchDrivers]);

  return { drivers, connected, refetch: fetchDrivers };
}
