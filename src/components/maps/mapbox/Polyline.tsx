import { useEffect, useRef } from "react";
import { LatLngExpression, useMap } from "./MapboxMap";

export interface PolylineProps {
  positions: LatLngExpression[];
  color?: string;
  weight?: number;
  opacity?: number;
  dashed?: boolean;
}

function parseLatLng(expr: LatLngExpression): [number, number] {
  if (Array.isArray(expr)) {
    return [expr[0], expr[1]];
  }
  if ('lng' in expr) {
    return [expr.lng, expr.lat];
  }
  return [expr.longitude, expr.latitude];
}

export function Polyline({
  positions,
  color = "#3388ff",
  weight = 3,
  opacity = 1,
  dashed = false,
}: PolylineProps) {
  const map = useMap();
  const layerRef = useRef<string | null>(null);

  useEffect(() => {
    if (!map || positions.length < 2) return;

    const coordinates = positions.map(parseLatLng);
    const sourceId = `polyline-source-${Math.random().toString(36).substr(2, 9)}`;
    const layerId = `polyline-layer-${Math.random().toString(36).substr(2, 9)}`;

    // Add source
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

    // Add layer
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
        ...(dashed ? { 'line-dasharray': [2, 2] } : {}),
      },
    });

    layerRef.current = layerId;

    return () => {
      if (map.getLayer(layerId)) {
        map.removeLayer(layerId);
      }
      if (map.getSource(sourceId)) {
        map.removeSource(sourceId);
      }
    };
  }, [map, positions, color, weight, opacity, dashed]);

  // Update positions when they change
  useEffect(() => {
    if (!map || !layerRef.current || positions.length < 2) return;

    const sourceId = layerRef.current.replace('polyline-layer', 'polyline-source');
    const source = map.getSource(sourceId) as mapboxgl.GeoJSONSource;
    
    if (source) {
      const coordinates = positions.map(parseLatLng);
      (source as mapboxgl.GeoJSONSource).setData({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates,
        },
      });
    }
  }, [positions, map]);

  return null;
}

export default Polyline;
