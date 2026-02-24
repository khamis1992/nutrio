import { Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { Utensils, Home, Store } from "lucide-react";
import { renderToString } from "react-dom/server";

interface LocationMarkerProps {
  position: { lat: number; lng: number };
  title: string;
  address?: string;
  phone?: string;
}

// Restaurant marker icon
function createRestaurantIcon() {
  const iconHtml = renderToString(
    <div className="bg-amber-500 rounded-full p-2 shadow-lg border-2 border-white">
      <Utensils className="w-5 h-5 text-white" />
    </div>
  );

  return L.divIcon({
    html: iconHtml,
    className: "custom-restaurant-marker",
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  });
}

// Customer marker icon
function createCustomerIcon() {
  const iconHtml = renderToString(
    <div className="bg-emerald-500 rounded-full p-2 shadow-lg border-2 border-white">
      <Home className="w-5 h-5 text-white" />
    </div>
  );

  return L.divIcon({
    html: iconHtml,
    className: "custom-customer-marker",
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  });
}

// Generic location marker icon
function createLocationIcon(color: string = "#3b82f6") {
  const iconHtml = renderToString(
    <div
      className="rounded-full p-2 shadow-lg border-2 border-white"
      style={{ backgroundColor: color }}
    >
      <Store className="w-5 h-5 text-white" />
    </div>
  );

  return L.divIcon({
    html: iconHtml,
    className: "custom-location-marker",
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  });
}

export function RestaurantMarker({
  position,
  title,
  address,
  phone,
}: LocationMarkerProps) {
  return (
    <Marker
      position={[position.lat, position.lng]}
      icon={createRestaurantIcon()}
    >
      <Popup>
        <div className="text-sm">
          <div className="font-semibold text-amber-600 flex items-center gap-2">
            <Utensils className="w-4 h-4" />
            {title}
          </div>
          {address && (
            <div className="text-muted-foreground mt-1">{address}</div>
          )}
          {phone && (
            <div className="text-primary mt-1">
              <a href={`tel:${phone}`} className="hover:underline">
                {phone}
              </a>
            </div>
          )}
        </div>
      </Popup>
    </Marker>
  );
}

export function CustomerMarker({
  position,
  title,
  address,
  phone,
}: LocationMarkerProps) {
  return (
    <Marker
      position={[position.lat, position.lng]}
      icon={createCustomerIcon()}
    >
      <Popup>
        <div className="text-sm">
          <div className="font-semibold text-emerald-600 flex items-center gap-2">
            <Home className="w-4 h-4" />
            {title}
          </div>
          {address && (
            <div className="text-muted-foreground mt-1">{address}</div>
          )}
          {phone && (
            <div className="text-primary mt-1">
              <a href={`tel:${phone}`} className="hover:underline">
                {phone}
              </a>
            </div>
          )}
        </div>
      </Popup>
    </Marker>
  );
}

interface GenericMarkerProps extends LocationMarkerProps {
  color?: string;
  icon?: React.ReactNode;
}

export function GenericMarker({
  position,
  title,
  address,
  phone,
  color = "#3b82f6",
}: GenericMarkerProps) {
  return (
    <Marker
      position={[position.lat, position.lng]}
      icon={createLocationIcon(color)}
    >
      <Popup>
        <div className="text-sm">
          <div className="font-semibold" style={{ color }}>
            {title}
          </div>
          {address && (
            <div className="text-muted-foreground mt-1">{address}</div>
          )}
          {phone && (
            <div className="text-primary mt-1">
              <a href={`tel:${phone}`} className="hover:underline">
                {phone}
              </a>
            </div>
          )}
        </div>
      </Popup>
    </Marker>
  );
}

export default { RestaurantMarker, CustomerMarker, GenericMarker };
