/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useRef, useState, ReactNode, useImperativeHandle, forwardRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

// Get token from environment
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || "";

if (!MAPBOX_TOKEN && import.meta.env.MODE !== 'production') {
  console.warn("Mapbox token not configured. Set VITE_MAPBOX_TOKEN in your .env file.");
}

mapboxgl.accessToken = MAPBOX_TOKEN;

// Types - support multiple input formats
export type LatLngExpression = 
  | [number, number]           // [lng, lat] for Mapbox
  | { lat: number; lng: number }
  | { latitude: number; longitude: number }
  | { lat: number; lng: number; alt?: number };

export interface MapContainerProps {
  center: LatLngExpression;
  zoom?: number;
  children?: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  scrollWheelZoom?: boolean;
  zoomControl?: boolean;
  whenReady?: (map: mapboxgl.Map) => void;
}

export interface MapRef {
  flyTo: (center: LatLngExpression, zoom?: number) => void;
  setZoom: (zoom: number) => void;
  getZoom: () => number;
  getCenter: () => { lng: number; lat: number };
}

// Create context for child components
const MapContext = createContext<mapboxgl.Map | null>(null);

export const useMap = () => {
  const map = useContext(MapContext);
  if (!map) {
    throw new Error("useMap must be used within a MapContainer");
  }
  return map;
};

export const useMapEvents = (handlers: {
  click?: (e: { lngLat: { lng: number; lat: number } }) => void;
  moveend?: () => void;
  zoomend?: () => void;
}) => {
  const map = useContext(MapContext);
  
  useEffect(() => {
    if (!map) return;
    
    if (handlers.click) {
      map.on("click", handlers.click);
    }
    if (handlers.moveend) {
      map.on("moveend", handlers.moveend);
    }
    if (handlers.zoomend) {
      map.on("zoomend", handlers.zoomend);
    }
    
    return () => {
      if (handlers.click) map.off("click", handlers.click);
      if (handlers.moveend) map.off("moveend", handlers.moveend);
      if (handlers.zoomend) map.off("zoomend", handlers.zoomend);
    };
  }, [map, handlers]);
};

function parseLatLng(expr: LatLngExpression): [number, number] {
  if (Array.isArray(expr)) {
    return [expr[0], expr[1]];
  }
  if ('lng' in expr) {
    return [expr.lng, expr.lat];
  }
  return [expr.longitude, expr.latitude];
}

export const MapContainer = forwardRef<MapRef, MapContainerProps>(function MapContainer({
  center,
  zoom = 13,
  children,
  className = "",
  style = { height: "400px", width: "100%" },
  scrollWheelZoom = false,
  zoomControl = true,
  whenReady,
}, ref) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Expose map methods via ref
  useImperativeHandle(ref, () => ({
    flyTo: (center: LatLngExpression, zoom?: number) => {
      const [lng, lat] = parseLatLng(center);
      mapRef.current?.flyTo({ center: [lng, lat], zoom });
    },
    setZoom: (zoom: number) => {
      mapRef.current?.zoomTo(zoom);
    },
    getZoom: () => mapRef.current?.getZoom() ?? 13,
    getCenter: () => {
      const c = mapRef.current?.getCenter();
      return c ? { lng: c.lng, lat: c.lat } : { lng: 0, lat: 0 };
    },
  }));

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const [lng, lat] = parseLatLng(center);

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [lng, lat],
      zoom,
      scrollZoom: scrollWheelZoom,
    });

    // Add navigation control
    if (zoomControl) {
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    }

    map.on("load", () => {
      setIsLoaded(true);
      whenReady?.(map);
    });

    // Expose map instance globally for child components
    (mapContainerRef.current as HTMLDivElement).__map__ = map;
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update center when it changes
  useEffect(() => {
    if (!mapRef.current || !isLoaded) return;

    const [lng, lat] = parseLatLng(center);
    mapRef.current.flyTo({ center: [lng, lat], zoom: mapRef.current.getZoom() });
  }, [center, isLoaded]);

  return (
    <div
      ref={mapContainerRef}
      className={`mapbox-map-container rounded-xl overflow-hidden ${className}`}
      style={style}
    >
      <MapContext.Provider value={mapRef.current}>
        {isLoaded && children}
      </MapContext.Provider>
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <span className="text-muted-foreground">Loading map...</span>
        </div>
      )}
    </div>
  );
});

export default MapContainer;
