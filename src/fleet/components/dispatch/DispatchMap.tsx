import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// Fix Leaflet default icon (same pattern as LiveTracking.tsx)
const DefaultIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

const DOHA_CENTER: [number, number] = [25.2854, 51.1839];

function makeColoredPin(color: string): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<div style="
      width:14px;height:14px;border-radius:50%;
      background:${color};border:2px solid white;
      box-shadow:0 1px 4px rgba(0,0,0,.4);
    "></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

function makeHighlightedPin(color: string): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<div style="
      width:18px;height:18px;border-radius:50%;
      background:${color};border:3px solid white;
      box-shadow:0 0 0 3px ${color}55, 0 2px 6px rgba(0,0,0,.4);
    "></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

function makeSquarePin(color: string, label: string): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<div style="
      background:${color};color:white;font-size:10px;font-weight:600;
      padding:2px 5px;border-radius:4px;white-space:nowrap;
      box-shadow:0 1px 4px rgba(0,0,0,.35);
    ">${label}</div>`,
    iconAnchor: [0, 0],
  });
}

export interface DispatchMapDriver {
  id: string;
  name: string;
  lat: number;
  lng: number;
  isTop: boolean;
}

interface DispatchMapProps {
  pickupLat: number | null;
  pickupLng: number | null;
  dropoffLat: number | null;
  dropoffLng: number | null;
  drivers: DispatchMapDriver[];
  selectedDriverId: string | null;
  onDriverClick: (driverId: string) => void;
  className?: string;
}

export function DispatchMap({
  pickupLat,
  pickupLng,
  dropoffLat,
  dropoffLng,
  drivers,
  selectedDriverId,
  onDriverClick,
  className = "",
}: DispatchMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const driverMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const pickupMarkerRef = useRef<L.Marker | null>(null);
  const dropoffMarkerRef = useRef<L.Marker | null>(null);

  // Initialise map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    mapRef.current = L.map(containerRef.current, {
      center: DOHA_CENTER,
      zoom: 13,
      zoomControl: true,
      attributionControl: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(mapRef.current);

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Update pickup marker
  useEffect(() => {
    if (!mapRef.current) return;

    pickupMarkerRef.current?.remove();
    pickupMarkerRef.current = null;

    if (pickupLat != null && pickupLng != null) {
      pickupMarkerRef.current = L.marker([pickupLat, pickupLng], {
        icon: makeSquarePin("#f97316", "Pickup"),
        zIndexOffset: 100,
      })
        .addTo(mapRef.current)
        .bindTooltip("Pickup point");
    }
  }, [pickupLat, pickupLng]);

  // Update dropoff marker
  useEffect(() => {
    if (!mapRef.current) return;

    dropoffMarkerRef.current?.remove();
    dropoffMarkerRef.current = null;

    if (dropoffLat != null && dropoffLng != null) {
      dropoffMarkerRef.current = L.marker([dropoffLat, dropoffLng], {
        icon: makeSquarePin("#3b82f6", "Dropoff"),
        zIndexOffset: 100,
      })
        .addTo(mapRef.current)
        .bindTooltip("Customer location");
    }
  }, [dropoffLat, dropoffLng]);

  // Update driver markers
  useEffect(() => {
    if (!mapRef.current) return;

    // Remove markers no longer in list
    const currentIds = new Set(drivers.map((d) => d.id));
    driverMarkersRef.current.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        marker.remove();
        driverMarkersRef.current.delete(id);
      }
    });

    // Add / update driver markers
    drivers.forEach((driver) => {
      const isSelected = driver.id === selectedDriverId;
      const icon = isSelected
        ? makeHighlightedPin("#7c3aed")
        : driver.isTop
          ? makeHighlightedPin("#16a34a")
          : makeColoredPin("#6b7280");

      const existing = driverMarkersRef.current.get(driver.id);
      if (existing) {
        existing.setLatLng([driver.lat, driver.lng]);
        existing.setIcon(icon);
      } else {
        const marker = L.marker([driver.lat, driver.lng], { icon })
          .addTo(mapRef.current!)
          .bindTooltip(driver.name)
          .on("click", () => onDriverClick(driver.id));
        driverMarkersRef.current.set(driver.id, marker);
      }
    });

    // Fit bounds to all visible pins
    const points: L.LatLngExpression[] = [];
    if (pickupLat != null && pickupLng != null) points.push([pickupLat, pickupLng]);
    if (dropoffLat != null && dropoffLng != null) points.push([dropoffLat, dropoffLng]);
    drivers.forEach((d) => points.push([d.lat, d.lng]));

    if (points.length > 0 && mapRef.current) {
      mapRef.current.fitBounds(L.latLngBounds(points), { padding: [32, 32], maxZoom: 15 });
    }
  }, [drivers, selectedDriverId, onDriverClick, pickupLat, pickupLng, dropoffLat, dropoffLng]);

  return (
    <div
      ref={containerRef}
      className={`rounded-lg border overflow-hidden ${className}`}
      style={{ minHeight: 220 }}
    />
  );
}
