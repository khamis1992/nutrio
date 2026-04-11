/**
 * Distance calculation utilities for restaurant branch selection
 * Implements Haversine formula for calculating distance between two GPS coordinates
 */

/**
 * Calculate distance between two points using Haversine formula
 * @param lat1 Latitude of point 1
 * @param lon1 Longitude of point 1
 * @param lat2 Latitude of point 2
 * @param lon2 Longitude of point 2
 * @returns Distance in kilometers
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return Math.round(distance * 100) / 100; // Round to 2 decimal places
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Calculate distance in meters (for more precise local calculations)
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  return calculateDistance(lat1, lon1, lat2, lon2) * 1000;
}

/**
 * Format distance for display
 * @param km Distance in kilometers
 * @returns Formatted string (e.g., "1.5 km" or "500 m")
 */
export function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)} m`;
  }
  return `${km.toFixed(1)} km`;
}

/**
 * Find the nearest branch from a list of branches
 * @param userLat User's latitude
 * @param userLon User's longitude
 * @param branches Array of branches with lat/lng coordinates
 * @returns The nearest branch and its distance
 */
export interface BranchLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address?: string;
  phone_number?: string;
}

export interface NearestBranchResult {
  branch: BranchLocation;
  distance: number; // in km
}

export function findNearestBranch(
  userLat: number,
  userLon: number,
  branches: BranchLocation[]
): NearestBranchResult | null {
  if (!branches || branches.length === 0) {
    return null;
  }

  let nearestBranch: BranchLocation | null = null;
  let minDistance = Infinity;

  for (const branch of branches) {
    if (!branch.latitude || !branch.longitude) continue;
    
    const distance = calculateDistance(
      userLat,
      userLon,
      branch.latitude,
      branch.longitude
    );

    if (distance < minDistance) {
      minDistance = distance;
      nearestBranch = branch;
    }
  }

  if (!nearestBranch) {
    return null;
  }

  return {
    branch: nearestBranch,
    distance: minDistance,
  };
}

/**
 * Check if a branch is within delivery range
 * @param distance Distance in km
 * @param maxDistance Maximum delivery distance in km (default: 10 km)
 * @returns boolean
 */
export function isWithinDeliveryRange(
  distance: number,
  maxDistance: number = 10
): boolean {
  return distance <= maxDistance;
}

/**
 * Estimate delivery time based on distance
 * @param distance Distance in km
 * @returns Estimated minutes
 */
export function estimateDeliveryTime(distance: number): number {
  // Assume average speed of 30 km/h in Doha + 5 min preparation
  const drivingTime = (distance / 30) * 60;
  const prepTime = 10; // Restaurant preparation time
  return Math.round(drivingTime + prepTime);
}

/**
 * Format estimated delivery time for display
 */
export function formatDeliveryTime(distance: number): string {
  const minutes = estimateDeliveryTime(distance);
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
}

// ── GPS Tracking ETA Utilities ──────────────────────────────────────────────

/**
 * Calculate ETA in minutes from driver to destination
 * Uses actual speed if available, otherwise falls back to average city speed
 */
export function calculateETA(
  driverLat: number,
  driverLng: number,
  destLat: number,
  destLng: number,
  speedKmh?: number
): number {
  const distKm = calculateDistance(driverLat, driverLng, destLat, destLng);
  const speed = speedKmh && speedKmh > 3 ? speedKmh : 25; // city average
  return Math.max(1, Math.round((distKm / speed) * 60));
}

/**
 * Format ETA for display
 */
export function formatETA(minutes: number): string {
  if (minutes < 1) return "Less than 1 min";
  if (minutes === 1) return "1 min";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

/**
 * Check if driver is "nearby" (within 500m)
 */
export function isNearby(
  driverLat: number,
  driverLng: number,
  destLat: number,
  destLng: number,
  thresholdMeters = 500
): boolean {
  return calculateDistanceMeters(driverLat, driverLng, destLat, destLng) <= thresholdMeters;
}

/**
 * Calculate bearing from driver to destination (for heading display)
 */
export function calculateBearing(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): number {
  const dLng = ((toLng - fromLng) * Math.PI) / 180;
  const lat1 = (fromLat * Math.PI) / 180;
  const lat2 = (toLat * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}
