// Map components - re-export Leaflet by default for backward compatibility
// Mapbox components are available in ./mapbox for new code

// Re-export Leaflet components (existing)
export { MapContainer } from "./MapContainer";
export { DriverMarker } from "./DriverMarker";
export { RoutePolyline, SpeedCodedPolyline } from "./RoutePolyline";
export { RestaurantMarker, CustomerMarker, GenericMarker } from "./Markers";

// Mapbox components - for new code or migration
export { MapContainer as MapboxMapContainer, useMap, useMapEvents } from "./mapbox/MapboxMap";
export type { MapContainerProps as MapboxMapContainerProps, LatLngExpression } from "./mapbox/MapboxMap";

export { Marker as MapboxMarker } from "./mapbox/Marker";
export { Polyline as MapboxPolyline } from "./mapbox/Polyline";
export { RoutePolyline as MapboxRoutePolyline } from "./mapbox/RoutePolyline";
