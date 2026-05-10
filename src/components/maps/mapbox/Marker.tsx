import { useEffect, useRef, ReactNode } from "react";
import mapboxgl from "mapbox-gl";
import { LatLngExpression, useMap } from "./MapboxMap";

export interface MarkerProps {
  position: LatLngExpression;
  children?: ReactNode;
  icon?: ReactNode;
  draggable?: boolean;
  onClick?: () => void;
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

export function Marker({
  position,
  children,
  draggable = false,
  onClick,
}: MarkerProps) {
  const map = useMap();
  const markerRef = useRef<mapboxgl.Marker | null>(null);

  useEffect(() => {
    if (!map) return;

    // Create marker element
    const el = document.createElement('div');
    el.className = 'mapbox-marker';
    
    if (children) {
      el.innerHTML = typeof children === 'string' ? children : '';
    } else {
      // Default green marker
      el.innerHTML = `
        <div style="
          width: 30px;
          height: 30px;
          background: #16a34a;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        "></div>
      `;
    }

    const [lng, lat] = parseLatLng(position);

    const marker = new mapboxgl.Marker({
      element: el,
      draggable,
    })
      .setLngLat([lng, lat])
      .addTo(map);

    if (onClick) {
      el.addEventListener('click', onClick);
    }

    markerRef.current = marker;

    return () => {
      marker.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, draggable, onClick]);

  // Update position when it changes
  useEffect(() => {
    if (markerRef.current) {
      const [lng, lat] = parseLatLng(position);
      markerRef.current.setLngLat([lng, lat]);
    }
  }, [position]);

  return null;
}

export default Marker;
