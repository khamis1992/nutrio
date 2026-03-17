import { calculateDistance } from "@/lib/distance";
import { computeReliabilityScore, type ReliabilityTier } from "./reliabilityScore";

export interface DispatchOrderLocation {
  id: string;
  status: string;
  pickupAddress: string | null;
  pickupLat: number | null;
  pickupLng: number | null;
}

export interface DispatchDriverJob {
  id: string;
  status: string;
  deliveryLat: number | null;
  deliveryLng: number | null;
  deliveryAddress: string | null;
}

export interface DispatchDriverCandidate {
  id: string;
  fullName: string;
  phone: string | null;
  rating: number | null;
  totalDeliveries: number | null;
  isOnline: boolean;
  isActive: boolean;
  currentLat: number | null;
  currentLng: number | null;
  locationUpdatedAt: string | null;
  activeJobs: DispatchDriverJob[];
}

export interface DispatchRecommendation {
  driverId: string;
  score: number;
  distanceKm: number | null;
  routeCompatibilityKm: number | null;
  activeJobsCount: number;
  locationAgeMinutes: number | null;
  type: "idle_nearest" | "route_compatible" | "busy_fallback" | "availability_fallback";
  reason: string;
  warnings: string[];
  estimatedPickupMinutes: number | null;
  isOverloaded: boolean;
  reliabilityScore: number;
  reliabilityTier: ReliabilityTier;
  reliabilityLabel: string;
}

const MAX_ROUTE_COMPATIBILITY_KM = 3;
const STALE_LOCATION_MINUTES = 10;
const OVERLOAD_THRESHOLD = 3;
// Average city speed in Qatar (km/min ≈ 24 km/h)
const AVG_SPEED_KM_PER_MIN = 0.4;

function getMinutesSince(timestamp: string | null): number | null {
  if (!timestamp) return null;

  const diffMs = Date.now() - new Date(timestamp).getTime();
  if (Number.isNaN(diffMs)) return null;

  return Math.max(0, Math.round(diffMs / 60000));
}

export function getDispatchRecommendations(
  order: DispatchOrderLocation,
  drivers: DispatchDriverCandidate[]
): DispatchRecommendation[] {
  return drivers
    .filter((driver) => driver.isOnline && driver.isActive && driver.currentLat != null && driver.currentLng != null)
    .map((driver) => {
      const activeJobsCount = driver.activeJobs.length;
      const locationAgeMinutes = getMinutesSince(driver.locationUpdatedAt);
      const warnings: string[] = [];

      let distanceKm: number | null = null;
      if (order.pickupLat != null && order.pickupLng != null) {
        distanceKm = calculateDistance(
          driver.currentLat as number,
          driver.currentLng as number,
          order.pickupLat,
          order.pickupLng
        );
      }

      let routeCompatibilityKm: number | null = null;
      const activeJob = driver.activeJobs[0];
      if (
        activeJob &&
        order.pickupLat != null &&
        order.pickupLng != null &&
        activeJob.deliveryLat != null &&
        activeJob.deliveryLng != null
      ) {
        routeCompatibilityKm = calculateDistance(
          activeJob.deliveryLat,
          activeJob.deliveryLng,
          order.pickupLat,
          order.pickupLng
        );
      }

      let score = 0;
      let type: DispatchRecommendation["type"] = "availability_fallback";
      let reason = "Available driver";

      if (distanceKm != null) {
        score += Math.max(0, 60 - distanceKm * 8);
      }

      if (activeJobsCount === 0) {
        score += 35;
        type = "idle_nearest";
        reason =
          distanceKm != null
            ? `Nearest idle driver at ${distanceKm.toFixed(1)} km`
            : "Idle driver with live location";
      } else if (activeJobsCount === 1) {
        score -= 10;

        if (routeCompatibilityKm != null && routeCompatibilityKm <= MAX_ROUTE_COMPATIBILITY_KM) {
          score += 25;
          type = "route_compatible";
          reason = `Current route ends ${routeCompatibilityKm.toFixed(1)} km from this pickup`;
        } else {
          score -= 15;
          type = "busy_fallback";
          reason = "Available, but already handling another order";
        }
      } else {
        score -= 35;
        type = "busy_fallback";
        reason = `Has ${activeJobsCount} active orders`;
      }

      // Reliability score replaces raw rating/delivery fragments
      const reliability = computeReliabilityScore({
        locationAgeMinutes,
        activeJobsCount,
        rating: driver.rating,
        totalDeliveries: driver.totalDeliveries,
      });
      score += reliability.score * 0.3;

      if (locationAgeMinutes != null && locationAgeMinutes > STALE_LOCATION_MINUTES) {
        score -= 20;
        warnings.push(`GPS update is ${locationAgeMinutes} min old`);
      }

      if (distanceKm != null && distanceKm > 8) {
        warnings.push("Driver is far from the pickup");
      }

      const isOverloaded = activeJobsCount >= OVERLOAD_THRESHOLD;
      if (isOverloaded) {
        warnings.push(`Driver has ${activeJobsCount} active orders — overloaded`);
      } else if (activeJobsCount > 1) {
        warnings.push("Driver already has multiple active jobs");
      }

      const estimatedPickupMinutes =
        distanceKm != null ? Math.ceil(distanceKm / AVG_SPEED_KM_PER_MIN) : null;

      return {
        driverId: driver.id,
        score,
        distanceKm,
        routeCompatibilityKm,
        activeJobsCount,
        locationAgeMinutes,
        type,
        reason,
        warnings,
        estimatedPickupMinutes,
        isOverloaded,
        reliabilityScore: reliability.score,
        reliabilityTier: reliability.tier,
        reliabilityLabel: reliability.label,
      };
    })
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      if (left.distanceKm != null && right.distanceKm != null && left.distanceKm !== right.distanceKm) {
        return left.distanceKm - right.distanceKm;
      }

      return left.activeJobsCount - right.activeJobsCount;
    });
}
