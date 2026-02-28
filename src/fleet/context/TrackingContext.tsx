import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { trackingSocket } from '@/fleet/services/trackingSocket';
import { useFleetAuth } from './FleetAuthContext';
import type { DriverLocation } from '@/fleet/types/fleet';

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

const DRIVER_OFFLINE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

export function TrackingProvider({ children }: { children: ReactNode }) {
  const [drivers, setDrivers] = useState<DriverWithTracking[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const { token, user, isAuthenticated } = useFleetAuth();

  // Handle driver location updates
  const handleDriverLocation = useCallback((data: DriverLocation) => {
    setDrivers(prev => {
      const index = prev.findIndex(d => d.driverId === data.driverId);
      const now = Date.now();
      
      if (index >= 0) {
        // Update existing driver
        const updated = [...prev];
        updated[index] = {
          ...data,
          lastUpdate: now,
        };
        return updated;
      }
      
      // Add new driver
      return [...prev, { ...data, lastUpdate: now }];
    });
    
    setLastUpdate(Date.now());
  }, []);

  // Handle driver status changes
  const handleDriverStatusChange = useCallback((data: { driverId: string; currentStatus: string }) => {
    if (data.currentStatus === 'offline') {
      setDrivers(prev => prev.filter(d => d.driverId !== data.driverId));
    }
  }, []);

  // Connect to WebSocket
  useEffect(() => {
    if (!isAuthenticated || !token || !user) {
      return;
    }

    trackingSocket.connect({
      token,
      userRole: user.role,
      assignedCities: user.assignedCities,
      onConnect: () => setIsConnected(true),
      onDisconnect: () => setIsConnected(false),
      onDriverLocation: handleDriverLocation,
      onDriverStatusChange: handleDriverStatusChange,
      onError: (error) => {
        console.error('Tracking socket error:', error);
      },
    });

    return () => {
      trackingSocket.disconnect();
    };
  }, [isAuthenticated, token, user, handleDriverLocation, handleDriverStatusChange]);

  // Clean up stale drivers periodically
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      setDrivers(prev => 
        prev.filter(d => now - d.lastUpdate < DRIVER_OFFLINE_TIMEOUT || d.isOnline)
      );
    }, 60000); // Check every minute

    return () => clearInterval(cleanupInterval);
  }, []);

  const reconnect = useCallback(() => {
    if (token && user) {
      trackingSocket.disconnect();
      trackingSocket.connect({
        token,
        userRole: user.role,
        assignedCities: user.assignedCities,
        onConnect: () => setIsConnected(true),
        onDisconnect: () => setIsConnected(false),
        onDriverLocation: handleDriverLocation,
        onDriverStatusChange: handleDriverStatusChange,
      });
    }
  }, [token, user, handleDriverLocation, handleDriverStatusChange]);

  const onlineCount = drivers.filter(d => d.isOnline).length;

  const value: TrackingContextType = {
    drivers,
    isConnected,
    selectedDriver,
    setSelectedDriver,
    onlineCount,
    lastUpdate,
    reconnect,
  };

  return (
    <TrackingContext.Provider value={value}>
      {children}
    </TrackingContext.Provider>
  );
}

export function useTracking() {
  const context = useContext(TrackingContext);
  if (context === undefined) {
    throw new Error('useTracking must be used within a TrackingProvider');
  }
  return context;
}

// Hook for getting a specific driver's location
export function useDriverLocation(driverId: string | null) {
  const { drivers } = useTracking();
  
  return driverId ? drivers.find(d => d.driverId === driverId) : null;
}

// Hook for getting drivers by city
export function useDriversByCity(cityId: string) {
  const { drivers } = useTracking();
  
  return drivers.filter(d => d.cityId === cityId);
}
