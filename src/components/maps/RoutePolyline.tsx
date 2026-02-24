import { Polyline } from "react-leaflet";
import type { LatLngExpression } from "leaflet";

interface RoutePolylineProps {
  positions: Array<{ lat: number; lng: number }>;
  color?: string;
  weight?: number;
  opacity?: number;
  dashed?: boolean;
}

export function RoutePolyline({
  positions,
  color = "#22c55e",
  weight = 4,
  opacity = 0.8,
  dashed = false,
}: RoutePolylineProps) {
  if (positions.length < 2) return null;

  const latLngs: LatLngExpression[] = positions.map((pos) => [pos.lat, pos.lng]);

  return (
    <Polyline
      positions={latLngs}
      pathOptions={{
        color,
        weight,
        opacity,
        dashArray: dashed ? "10, 10" : undefined,
        lineCap: "round",
        lineJoin: "round",
      }}
    />
  );
}

// Color-coded polyline based on speed
interface SpeedCodedPolylineProps {
  positions: Array<{ lat: number; lng: number; speed?: number }>;
}

export function SpeedCodedPolyline({ positions }: SpeedCodedPolylineProps) {
  if (positions.length < 2) return null;

  const segments: Array<{
    positions: LatLngExpression[];
    color: string;
  }> = [];

  for (let i = 0; i < positions.length - 1; i++) {
    const current = positions[i];
    const next = positions[i + 1];
    const speed = current.speed || 0;

    // Color based on speed
    let color = "#22c55e"; // green - slow/stopped
    if (speed > 60) color = "#ef4444"; // red - fast
    else if (speed > 30) color = "#f59e0b"; // orange - moderate
    else if (speed > 10) color = "#3b82f6"; // blue - moving

    segments.push({
      positions: [
        [current.lat, current.lng],
        [next.lat, next.lng],
      ],
      color,
    });
  }

  return (
    <>
      {segments.map((segment, index) => (
        <Polyline
          key={index}
          positions={segment.positions}
          pathOptions={{
            color: segment.color,
            weight: 4,
            opacity: 0.8,
            lineCap: "round",
            lineJoin: "round",
          }}
        />
      ))}
    </>
  );
}

export default RoutePolyline;
