import { useEffect, useState } from "react";
import { MapContainer as LeafletMap, TileLayer, useMap } from "react-leaflet";
import type { LatLngExpression } from "leaflet";
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

// Patch Leaflet to survive React 18 StrictMode's double-invoke of effects.
// react-leaflet v4's mapRef callback captures context=null via useCallback([]),
// so it tries to initialize a new Leaflet map every time the ref fires — even
// on the same DOM node — causing "Map container is already initialized" crashes.
// We also patch remove() to tolerate the "being reused" mismatch that follows.
interface LeafletProto {
  _reactStrictModePatched?: boolean;
  _initContainer: (id: HTMLElement | string) => void;
  remove: () => void;
  _container?: HTMLElement;
}
const proto = L.Map.prototype as unknown as LeafletProto;
if (!proto._reactStrictModePatched) {
  const origInit = proto._initContainer;
  proto._initContainer = function (id: HTMLElement | string) {
    const el = typeof id === "string" ? document.getElementById(id) : id;
    if (el && (el as HTMLElement & { _leaflet_id?: number })._leaflet_id) {
      delete (el as HTMLElement & { _leaflet_id?: number })._leaflet_id;
    }
    return origInit.call(this, id);
  };

  const origRemove = proto.remove;
  proto.remove = function () {
    try {
      return origRemove.call(this);
    } catch {
      // Swallow "Map container is being reused by another instance" that
      // occurs when StrictMode re-initialises the map on the same node.
    }
  };

  proto._reactStrictModePatched = true;
}

interface MapContainerProps {
  center: LatLngExpression;
  zoom?: number;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  scrollWheelZoom?: boolean;
}

// Component to handle map view updates without triggering a full remount
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
  // React 18 StrictMode + react-leaflet 4 fix:
  // "Map container is already initialized" happens because StrictMode double-invokes
  // effects and Leaflet sets _leaflet_id on the container DOM node.
  // Fix: gate rendering with a ready flag (lets react-leaflet's cleanup run first),
  // and use a unique key so each remount gets a fresh DOM node.
  const [mapKey, setMapKey] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setMapKey(k => k + 1);
    setReady(true);
    return () => setReady(false);
  }, []);

  // key on the outer div forces React to create a completely new DOM subtree,
  // eliminating any stale _leaflet_id on the container node.
  return (
    <div key={mapKey} className={`rounded-xl overflow-hidden ${className}`} style={style}>
      {ready && (
        <LeafletMap
          center={center}
          zoom={zoom}
          scrollWheelZoom={scrollWheelZoom}
          className="z-0"
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapUpdater center={center} />
          {children}
        </LeafletMap>
      )}
    </div>
  );
}

export default MapContainer;
