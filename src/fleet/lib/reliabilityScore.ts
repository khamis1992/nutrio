export type ReliabilityTier = "green" | "amber" | "red";

export interface ReliabilityScore {
  score: number;       // 0–100
  tier: ReliabilityTier;
  label: string;
  breakdown: {
    gpsFreshness: number;   // 0–30
    jobLoad: number;        // 0–20
    starRating: number;     // 0–30
    deliveryVolume: number; // 0–20
  };
}

interface ScoringInput {
  locationAgeMinutes: number | null;
  activeJobsCount: number;
  rating: number | null;
  totalDeliveries: number | null;
}

export function computeReliabilityScore(input: ScoringInput): ReliabilityScore {
  // GPS freshness — 30 pts: full if < 3 min, zero at ≥ 15 min
  const ageMin = input.locationAgeMinutes ?? 15;
  const gpsFreshness = Math.round(Math.max(0, 30 - (ageMin / 15) * 30));

  // Job load — 20 pts: 20 idle, 10 one active, 0 two+
  const jobLoad =
    input.activeJobsCount === 0 ? 20 : input.activeJobsCount === 1 ? 10 : 0;

  // Star rating — 30 pts
  const starRating = Math.round((Math.min(input.rating ?? 0, 5) / 5) * 30);

  // Delivery volume — 20 pts: full at 100+ deliveries
  const deliveryVolume = Math.round(
    Math.min((input.totalDeliveries ?? 0) / 100, 1) * 20
  );

  const score = gpsFreshness + jobLoad + starRating + deliveryVolume;

  const tier: ReliabilityTier =
    score >= 70 ? "green" : score >= 45 ? "amber" : "red";

  const label =
    tier === "green" ? "Reliable" : tier === "amber" ? "Moderate" : "Low reliability";

  return { score, tier, label, breakdown: { gpsFreshness, jobLoad, starRating, deliveryVolume } };
}
