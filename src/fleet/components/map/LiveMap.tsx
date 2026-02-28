import { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { useTracking } from '@/fleet/context/TrackingContext';
import { useCity } from '@/fleet/context/CityContext';
import { Button } from '@/components/ui/button';
import { 
  ZoomIn, 
  ZoomOut, 
  Navigation, 
  Layers,
  Wifi,
  WifiOff,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Mapbox GL JS types (will work when package is installed)
interface MapboxMap {
  remove(): void;
  flyTo(options: { center: [number, number]; zoom?: number }): void;
  getZoom(): number;
  setZoom(zoom: number): void;
  addControl(control: unknown): void;
}

interface MapboxMarker {
  setLngLat(lngLat: [number, number]): void;
  addTo(map: MapboxMap): void;
  remove(): void;
}

export function LiveMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<MapboxMap | null>(null);
  const markersRef = useRef<Map<string, MapboxMarker>>(new Map());
  const [isMapboxLoaded, setIsMapboxLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  
  const { drivers, isConnected, onlineCount, reconnect } = useTracking();
  const { selectedCity } = useCity();

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const initMap = async () => {
      try {
        // Dynamic import of mapbox-gl to avoid SSR issues
        const mapboxgl = await import('mapbox-gl');
        
        const token = import.meta.env.VITE_MAPBOX_TOKEN;
        if (!token) {
          setMapError('Mapbox token not configured');
          return;
        }

        mapboxgl.default.accessToken = token;

        const defaultCenter: [number, number] = selectedCity 
          ? [selectedCity.longitude, selectedCity.latitude]
          : [51.5074, 25.2854]; // Doha default

        const newMap = new mapboxgl.default.Map({
          container: mapContainer.current!,
          style: 'mapbox://styles/mapbox/streets-v12',
          center: defaultCenter,
          zoom: 12,
        });

        newMap.addControl(new mapboxgl.default.NavigationControl(), 'top-right');
        newMap.addControl(new mapboxgl.default.FullscreenControl(), 'top-right');

        map.current = newMap as unknown as MapboxMap;
        setIsMapboxLoaded(true);

        return () => {
          map.current?.remove();
          map.current = null;
        };
      } catch (error) {
        console.error('Failed to initialize map:', error);
        setMapError('Failed to load map. Please check your connection.');
      }
    };

    initMap();
  }, [selectedCity]);

  // Update map center when selected city changes
  useEffect(() => {
    if (map.current && selectedCity) {
      map.current.flyTo({
        center: [selectedCity.longitude, selectedCity.latitude],
        zoom: 12,
      });
    }
  }, [selectedCity]);

  // Update markers when drivers change
  useEffect(() => {
    if (!map.current || !isMapboxLoaded) return;

    const updateMarkers = async () => {
      const mapboxgl = await import('mapbox-gl');

      drivers.forEach((driver) => {
        const markerId = driver.driverId;
        const existingMarker = markersRef.current.get(markerId);

        if (existingMarker) {
          // Update existing marker position
          existingMarker.setLngLat([driver.longitude, driver.latitude]);
        } else {
          // Create new marker
          const el = document.createElement('div');
          el.className = 'driver-marker';
          el.innerHTML = `
            <div class="w-8 h-8 rounded-full flex items-center justify-center shadow-lg border-2 ${
              driver.isOnline 
                ? 'bg-green-500 border-white' 
                : 'bg-gray-400 border-white'
            }">
              <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          `;

          const popup = new mapboxgl.default.Popup({ offset: 25 }).setHTML(`
            <div class="p-2 min-w-[150px]">
              <h3 class="font-semibold text-sm">${driver.driverName}</h3>
              <p class="text-xs ${driver.isOnline ? 'text-green-600' : 'text-gray-500'}">
                ${driver.isOnline ? '● Online' : '● Offline'}
              </p>
              ${driver.speed ? `<p class="text-xs text-muted-foreground">${Math.round(driver.speed)} km/h</p>` : ''}
              ${driver.currentOrderId ? `<p class="text-xs text-blue-600">On Delivery</p>` : ''}
            </div>
          `);

          const marker = new mapboxgl.default.Marker(el)
            .setLngLat([driver.longitude, driver.latitude])
            .setPopup(popup)
            .addTo(map.current as unknown as mapboxgl.Map);

          markersRef.current.set(markerId, marker as unknown as MapboxMarker);
        }
      });

      // Remove markers for drivers that are no longer tracked
      markersRef.current.forEach((marker, driverId) => {
        const driver = drivers.find((d) => d.driverId === driverId);
        if (!driver || !driver.isOnline) {
          marker.remove();
          markersRef.current.delete(driverId);
        }
      });
    };

    updateMarkers();
  }, [drivers, isMapboxLoaded]);

  const handleZoomIn = () => {
    if (map.current) {
      const currentZoom = map.current.getZoom();
      map.current.setZoom(currentZoom + 1);
    }
  };

  const handleZoomOut = () => {
    if (map.current) {
      const currentZoom = map.current.getZoom();
      map.current.setZoom(currentZoom - 1);
    }
  };

  const handleCenterOnCity = () => {
    if (map.current && selectedCity) {
      map.current.flyTo({
        center: [selectedCity.longitude, selectedCity.latitude],
        zoom: 12,
      });
    }
  };

  if (mapError) {
    return (
      <Card className="w-full h-[400px] flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-2">{mapError}</p>
          <Button onClick={() => window.location.reload()} variant="outline">
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="relative w-full h-[400px] lg:h-[600px] rounded-lg overflow-hidden border">
      <div ref={mapContainer} className="w-full h-full" />

      {/* Connection Status */}
      <div className="absolute top-4 right-4 z-10">
        <div className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg text-sm font-medium",
          isConnected 
            ? "bg-green-500 text-white" 
            : "bg-red-500 text-white"
        )}>
          {isConnected ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
          <span>{isConnected ? 'Live' : 'Disconnected'}</span>
          {!isConnected && (
            <Button 
              size="icon" 
              variant="ghost" 
              className="h-6 w-6 ml-1 hover:bg-white/20"
              onClick={reconnect}
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Driver Count Overlay */}
      <div className="absolute bottom-4 left-4 z-10">
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg px-4 py-3">
          <p className="text-xs text-muted-foreground">Online Drivers</p>
          <p className="text-2xl font-bold">{onlineCount}</p>
        </div>
      </div>

      {/* Map Controls */}
      <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-2">
        <Button
          variant="secondary"
          size="icon"
          onClick={handleCenterOnCity}
          className="shadow-lg"
          title="Center on city"
        >
          <Navigation className="h-4 w-4" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          onClick={handleZoomIn}
          className="shadow-lg"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          onClick={handleZoomOut}
          className="shadow-lg"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
      </div>

      {/* Loading State */}
      {!isMapboxLoaded && (
        <div className="absolute inset-0 bg-muted flex items-center justify-center">
          <p className="text-muted-foreground">Loading map...</p>
        </div>
      )}
    </div>
  );
}
