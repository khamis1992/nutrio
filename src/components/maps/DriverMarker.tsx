import { Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { Navigation } from "lucide-react";

interface DriverMarkerProps {
  position: { lat: number; lng: number };
  heading?: number;
  speed?: number;
  driverName?: string;
  eta?: string;
}

// Delivery scooter SVG — clean top-down view
const SCOOTER_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="36" height="36">
  <!-- Body -->
  <rect x="22" y="18" width="20" height="28" rx="6" fill="#16a34a"/>
  <!-- Windshield -->
  <rect x="26" y="20" width="12" height="8" rx="3" fill="#bbf7d0" opacity="0.9"/>
  <!-- Front wheel -->
  <ellipse cx="32" cy="10" rx="5" ry="7" fill="#15803d"/>
  <ellipse cx="32" cy="10" rx="2.5" ry="4" fill="#4ade80"/>
  <!-- Rear wheel -->
  <ellipse cx="32" cy="54" rx="5" ry="7" fill="#15803d"/>
  <ellipse cx="32" cy="54" rx="2.5" ry="4" fill="#4ade80"/>
  <!-- Handlebars -->
  <rect x="16" y="14" width="10" height="3" rx="1.5" fill="#15803d"/>
  <rect x="38" y="14" width="10" height="3" rx="1.5" fill="#15803d"/>
  <!-- Headlight -->
  <ellipse cx="32" cy="6" rx="3" ry="2" fill="#fef08a" opacity="0.95"/>
  <!-- Bag/box on back -->
  <rect x="24" y="36" width="16" height="10" rx="3" fill="#166534"/>
  <rect x="26" y="38" width="12" height="6" rx="2" fill="#4ade80" opacity="0.5"/>
</svg>`;

function createDriverIcon(heading: number = 0) {
  const html = `
    <div style="
      position:relative;
      width:52px; height:52px;
      display:flex; align-items:center; justify-content:center;
    ">
      <!-- Outer glow ring -->
      <div style="
        position:absolute; inset:0;
        background:rgba(22,163,74,0.18);
        border-radius:50%;
        border:2px solid rgba(22,163,74,0.35);
      "></div>
      <!-- White pill badge -->
      <div style="
        position:relative; z-index:1;
        background:#fff;
        border-radius:50%;
        width:40px; height:40px;
        display:flex; align-items:center; justify-content:center;
        box-shadow:0 3px 12px rgba(0,0,0,0.22), 0 0 0 2px #16a34a;
        transform:rotate(${heading}deg);
        transition:transform 0.3s ease-out;
      ">
        ${SCOOTER_SVG}
      </div>
    </div>`;

  return L.divIcon({
    html,
    className: "",
    iconSize: [52, 52],
    iconAnchor: [26, 26],
    popupAnchor: [0, -28],
  });
}

function createPulseIcon(heading: number = 0) {
  const html = `
    <style>
      @keyframes drv-ping {
        0%   { transform:scale(1);   opacity:.6; }
        70%  { transform:scale(1.8); opacity:0; }
        100% { transform:scale(1.8); opacity:0; }
      }
      .drv-ping { animation: drv-ping 1.6s ease-out infinite; }
    </style>
    <div style="position:relative; width:60px; height:60px; display:flex; align-items:center; justify-content:center;">
      <!-- Animated ping ring -->
      <div class="drv-ping" style="
        position:absolute; inset:0;
        background:rgba(74,222,128,0.4);
        border-radius:50%;
      "></div>
      <!-- Static halo -->
      <div style="
        position:absolute; inset:4px;
        background:rgba(22,163,74,0.15);
        border-radius:50%;
        border:2px solid rgba(22,163,74,0.4);
      "></div>
      <!-- White badge -->
      <div style="
        position:relative; z-index:1;
        background:#fff;
        border-radius:50%;
        width:44px; height:44px;
        display:flex; align-items:center; justify-content:center;
        box-shadow:0 4px 16px rgba(0,0,0,0.25), 0 0 0 2.5px #16a34a;
        transform:rotate(${heading}deg);
        transition:transform 0.3s ease-out;
      ">
        ${SCOOTER_SVG}
      </div>
    </div>`;

  return L.divIcon({
    html,
    className: "",
    iconSize: [60, 60],
    iconAnchor: [30, 30],
    popupAnchor: [0, -32],
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
