/**
 * Fleet driver tracking through the AAL2, city-scoped dispatch projection.
 * The projection is polled so raw driver and location rows are never streamed
 * to the browser.
 */

import { useCallback, useEffect, useState } from "react";

import { getDispatchDrivers } from "@/fleet/services/orderDispatch";

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
const REFRESH_INTERVAL_MS = 30 * 1000;

export function useFleetRealtimeDrivers() {
  const [drivers, setDrivers] = useState<FleetDriverLocation[]>([]);
  const [connected, setConnected] = useState(false);

  const fetchDrivers = useCallback(async () => {
    try {
      const projectedDrivers = await getDispatchDrivers();
      const now = Date.now();
      const result = projectedDrivers.flatMap<FleetDriverLocation>((driver) => {
        if (driver.currentLat === null || driver.currentLng === null) return [];

        const lastSeen = driver.locationUpdatedAt || new Date(0).toISOString();
        const isStale = now - new Date(lastSeen).getTime() > OFFLINE_THRESHOLD_MS;
        const activeJob = driver.activeJobs[0];

        return [{
          id: driver.id,
          driver_id: driver.id,
          driver_name: driver.fullName,
          // City membership is enforced server-side and intentionally omitted
          // from the narrow browser projection.
          city_id: "",
          rating: driver.rating ?? undefined,
          lat: driver.currentLat,
          lng: driver.currentLng,
          status: !driver.isOnline || isStale
            ? "offline"
            : activeJob
              ? "busy"
              : "available",
          current_order_id: activeJob?.id,
          last_seen: lastSeen,
        }];
      });

      setDrivers(result);
      setConnected(true);
    } catch (error) {
      setConnected(false);
      throw error;
    }
  }, []);

  useEffect(() => {
    void fetchDrivers().catch((error) => {
      console.error("Failed to load fleet driver locations:", error);
    });

    const interval = window.setInterval(() => {
      void fetchDrivers().catch((error) => {
        console.error("Failed to refresh fleet driver locations:", error);
      });
    }, REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [fetchDrivers]);

  return { drivers, connected, refetch: fetchDrivers };
}
