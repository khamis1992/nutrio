import { Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { Car, Navigation } from "lucide-react";
import { renderToString } from "react-dom/server";

interface DriverMarkerProps {
  position: { lat: number; lng: number };
  heading?: number;
  speed?: number;
  driverName?: string;
  eta?: string;
}

// Create custom driver icon with rotation
function createDriverIcon(heading: number = 0) {
  const iconHtml = renderToString(
    <div
      style={{
        transform: `rotate(${heading}deg)`,
        transition: "transform 0.3s ease-out",
      }}
    >
      <Car className="w-8 h-8 text-primary fill-primary" />
    </div>
  );

  return L.divIcon({
    html: iconHtml,
    className: "custom-driver-marker",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
}

// Create pulse effect icon
function createPulseIcon(heading: number = 0) {
  const iconHtml = `
    <div class="relative">
      <div class="absolute inset-0 bg-primary/30 rounded-full animate-ping"></div>
      <div class="absolute inset-2 bg-primary/50 rounded-full animate-pulse"></div>
      <div class="relative z-10" style="transform: rotate(${heading}deg); transition: transform 0.3s ease-out;">
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-primary fill-primary">
          <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/>
          <circle cx="7" cy="17" r="2"/>
          <circle cx="17" cy="17" r="2"/>
        </svg>
      </div>
    </div>
  `;

  return L.divIcon({
    html: iconHtml,
    className: "custom-pulse-marker",
    iconSize: [48, 48],
    iconAnchor: [24, 24],
    popupAnchor: [0, -24],
  });
}

export function DriverMarker({
  position,
  heading = 0,
  speed = 0,
  driverName = "Driver",
  eta,
}: DriverMarkerProps) {
  const isMoving = speed > 0;

  return (
    <Marker
      position={[position.lat, position.lng]}
      icon={isMoving ? createPulseIcon(heading) : createDriverIcon(heading)}
    >
      <Popup>
        <div className="text-sm">
          <div className="font-semibold flex items-center gap-2">
            <Navigation className="w-4 h-4" />
            {driverName}
          </div>
          {speed > 0 && (
            <div className="text-muted-foreground">
              Speed: {Math.round(speed)} km/h
            </div>
          )}
          {eta && (
            <div className="text-primary font-medium">
              ETA: {eta}
            </div>
          )}
        </div>
      </Popup>
    </Marker>
  );
}

export default DriverMarker;
