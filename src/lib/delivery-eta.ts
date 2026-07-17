import { calculateDistance } from "@/lib/distance";

export interface EtaLocation {
  lat: number;
  lng: number;
  updated_at?: string | null;
  speed_kmh?: number | null;
}

export interface EtaDestination {
  lat: number;
  lng: number;
}

export interface EtaPrediction {
  minutes: number;
  distanceKm: number | null;
  confidence: "live" | "estimated" | "stale";
  source: "gps" | "distance";
  gpsAgeMinutes: number | null;
}

const MIN_CITY_SPEED_KMH = 12;
const DEFAULT_CITY_SPEED_KMH = 28;
const MAX_REASONABLE_SPEED_KMH = 75;
const ROUTE_FACTOR = 1.22;
const STOP_BUFFER_MINUTES = 2;
const STALE_GPS_MINUTES = 5;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function getGpsAgeMinutes(updatedAt?: string | null, now = new Date()): number | null {
  if (!updatedAt) return null;
  const timestamp = new Date(updatedAt).getTime();
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, Math.round((now.getTime() - timestamp) / 60000));
}

function normalizeSpeed(speedKmh?: number | null, gpsAgeMinutes?: number | null): number {
  if (!speedKmh || speedKmh < 3) return DEFAULT_CITY_SPEED_KMH;
  const stalePenalty = gpsAgeMinutes != null && gpsAgeMinutes > STALE_GPS_MINUTES ? 0.8 : 1;
  return clamp(speedKmh * stalePenalty, MIN_CITY_SPEED_KMH, MAX_REASONABLE_SPEED_KMH);
}

export function predictEtaFromGps(
  driver: EtaLocation,
  destination: EtaDestination,
  now = new Date(),
): EtaPrediction {
  const straightDistanceKm = calculateDistance(driver.lat, driver.lng, destination.lat, destination.lng);
  const distanceKm = Math.max(0.05, straightDistanceKm * ROUTE_FACTOR);
  const gpsAgeMinutes = getGpsAgeMinutes(driver.updated_at, now);
  const speedKmh = normalizeSpeed(driver.speed_kmh, gpsAgeMinutes);
  const minutes = Math.max(1, Math.ceil((distanceKm / speedKmh) * 60 + STOP_BUFFER_MINUTES));

  return {
    minutes,
    distanceKm,
    confidence: gpsAgeMinutes != null && gpsAgeMinutes > STALE_GPS_MINUTES ? "stale" : "live",
    source: "gps",
    gpsAgeMinutes,
  };
}

export function predictEtaFromDeliveryDistance(params: {
  estimatedDistanceKm?: number | null;
  pickedUpAt?: string | null;
  now?: Date;
}): EtaPrediction | null {
  const estimatedDistanceKm = Number(params.estimatedDistanceKm || 0);
  if (!Number.isFinite(estimatedDistanceKm) || estimatedDistanceKm <= 0) return null;

  const now = params.now || new Date();
  const routeDistanceKm = Math.max(0.05, estimatedDistanceKm);
  const totalMinutes = Math.ceil((routeDistanceKm / DEFAULT_CITY_SPEED_KMH) * 60 + STOP_BUFFER_MINUTES);
  const elapsedMinutes = params.pickedUpAt
    ? Math.max(0, (now.getTime() - new Date(params.pickedUpAt).getTime()) / 60000)
    : 0;

  return {
    minutes: Math.max(1, Math.ceil(totalMinutes - elapsedMinutes)),
    distanceKm: routeDistanceKm,
    confidence: "estimated",
    source: "distance",
    gpsAgeMinutes: null,
  };
}

export function formatEtaMinutes(minutes: number): string {
  if (minutes <= 1) return "1 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `${hours}h ${rest}m` : `${hours}h`;
}
