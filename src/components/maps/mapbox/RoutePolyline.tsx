// Mapbox RoutePolyline - replaces Leaflet version
import { useEffect, useRef } from "react";
import { useMap } from "./MapboxMap";

interface RoutePolylineProps {
  positions: [number, number][];
  color?: string;
  weight?: number;
  opacity?: number;
  dashed?: boolean;
  className?: string;
}

// Inject CSS animation once
const ROUTE_STYLE_ID = "nutrio-route-anim";
function injectRouteStyles() {
  if (document.getElementById(ROUTE_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = ROUTE_STYLE_ID;
  style.textContent = `
    @keyframes routeFlow {
      from { stroke-dashoffset: 400; }
      to   { stroke-dashoffset: 0; }
    }
    @keyframes routeGlow {
      0%,100% { filter: drop-shadow(0 0 3px #4ade80) drop-shadow(0 0 6px #16a34a); }
      50%      { filter: drop-shadow(0 0 8px #86efac) drop-shadow(0 0 16px #22c55e); }
    }
    .route-glow path {
      animation: routeGlow 2s ease-in-out infinite;
    }
    .route-flow path {
      stroke-dasharray: 16 12;
      animation: routeFlow 1.4s linear infinite;
    }
  `;
  document.head.appendChild(style);
}

export function RoutePolyline({
  positions,
  color = "#16a34a",
  weight = 5,
  opacity = 1,
  dashed = false,
}: RoutePolylineProps) {
  const map = useMap();
  const layerRef = useRef<string | null>(null);

  useEffect(() => {
    injectRouteStyles();
  }, []);

  useEffect(() => {
    if (!map || positions.length < 2) return;

    // Mapbox uses [lng, lat] format
    const coordinates = positions.map(([lat, lng]) => [lng, lat] as [number, number]);
    const sourceId = `route-source-${Math.random().toString(36).substr(2, 9)}`;
    const layerId = `route-layer-${Math.random().toString(36).substr(2, 9)}`;

    map.addSource(sourceId, {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates,
        },
      },
    });

    map.addLayer({
      id: layerId,
      type: 'line',
      source: sourceId,
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
      paint: {
        'line-color': color,
        'line-width': weight,
        'line-opacity': opacity,
        ...(dashed ? { 'line-dasharray': [10, 10] } : {}),
      },
    });

    layerRef.current = layerId;

    return () => {
      if (map.getLayer(layerId)) map.removeLayer(layerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    };
  }, [map, positions, color, weight, opacity, dashed]);

  return null;
}

export default RoutePolyline;
