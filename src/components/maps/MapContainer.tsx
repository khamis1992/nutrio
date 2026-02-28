import { useEffect, useRef, useCallback } from "react";
import { MapContainer as LeafletMap, TileLayer, useMap } from "react-leaflet";
import type { LatLngExpression, Map } from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet default icon issue with webpack/vite
import L from "leaflet";
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

interface MapContainerProps {
  center: LatLngExpression;
  zoom?: number;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  scrollWheelZoom?: boolean;
}

// Component to handle map view updates
function MapUpdater({ center }: { center: LatLngExpression }) {
  const map = useMap();

  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);

  return null;
}

export function MapContainer({
  center,
  zoom = 13,
  children,
  className = "",
  style = { height: "400px", width: "100%" },
  scrollWheelZoom = false,
}: MapContainerProps) {
  const mapRef = useRef<Map | null>(null);

  const handleCreated = useCallback((map: Map) => {
    mapRef.current = map;
  }, []);

  useEffect(() => {
    return () => {
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch (e) {
          // Ignore
        }
        mapRef.current = null;
      }
    };
  }, []);

  return (
    <div className={`rounded-xl overflow-hidden ${className}`} style={style}>
      <LeafletMap
        center={center}
        zoom={zoom}
        scrollWheelZoom={scrollWheelZoom}
        className="z-0"
        style={{ height: "100%", width: "100%" }}
        whenCreated={handleCreated}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapUpdater center={center} />
        {children}
      </LeafletMap>
    </div>
  );
}

export default MapContainer;
