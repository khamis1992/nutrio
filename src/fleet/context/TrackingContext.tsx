/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useMemo, useState, ReactNode } from "react";

import { useFleetRealtimeDrivers } from "@/fleet/hooks/useFleetRealtimeDrivers";
import type { DriverLocation } from "@/fleet/types/fleet";

interface DriverWithTracking extends DriverLocation {
  lastUpdate: number;
}

interface TrackingContextType {
  drivers: DriverWithTracking[];
  isConnected: boolean;
  selectedDriver: string | null;
  setSelectedDriver: (id: string | null) => void;
  onlineCount: number;
  lastUpdate: number | null;
  reconnect: () => void;
}

const TrackingContext = createContext<TrackingContextType | undefined>(undefined);

export function TrackingProvider({ children }: { children: ReactNode }) {
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);
  const { drivers: realtimeDrivers, connected, refetch } = useFleetRealtimeDrivers();

  const drivers = useMemo<DriverWithTracking[]>(
    () =>
      realtimeDrivers.map((driver) => ({
        driverId: driver.driver_id,
        driverName: driver.driver_name,
        cityId: driver.city_id,
        latitude: driver.lat,
        longitude: driver.lng,
        accuracy: driver.accuracy,
        speed: driver.speed,
        heading: driver.heading,
        isOnline: driver.status !== "offline",
        currentOrderId: driver.current_order_id,
        timestamp: driver.last_seen,
        lastUpdate: new Date(driver.last_seen).getTime(),
      })),
    [realtimeDrivers],
  );

  const reconnect = useCallback(() => {
    refetch().catch((error) => {
      console.error("Failed to reconnect fleet tracking:", error);
    });
  }, [refetch]);

  const lastUpdate = drivers.length
    ? Math.max(...drivers.map((driver) => driver.lastUpdate))
    : null;

  const value: TrackingContextType = {
    drivers,
    isConnected: connected,
    selectedDriver,
    setSelectedDriver,
    onlineCount: drivers.filter((driver) => driver.isOnline).length,
    lastUpdate,
    reconnect,
  };

  return <TrackingContext.Provider value={value}>{children}</TrackingContext.Provider>;
}

export function useTracking() {
  const context = useContext(TrackingContext);
  if (context === undefined) {
    throw new Error("useTracking must be used within a TrackingProvider");
  }
  return context;
}

export function useDriverLocation(driverId: string | null) {
  const { drivers } = useTracking();
  return driverId ? drivers.find((driver) => driver.driverId === driverId) : null;
}

export function useDriversByCity(cityId: string) {
  const { drivers } = useTracking();
  return drivers.filter((driver) => driver.cityId === cityId);
}
