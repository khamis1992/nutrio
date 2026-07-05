export type SportHubRecoveryInput = {
  sportType?: string | null;
  bookingTime?: string | null;
  durationMinutes?: number | null;
};

export type SportHubRecoveryRecommendation = {
  title: string;
  detail: string;
  mealFocus: string;
  hydrationFocus: string;
};

const normalize = (value?: string | null) => (value || "").trim().toLowerCase();

export function getSportHubRecoveryRecommendation({
  sportType,
  bookingTime,
  durationMinutes,
}: SportHubRecoveryInput): SportHubRecoveryRecommendation {
  const sport = normalize(sportType);
  const hour = bookingTime ? Number(bookingTime.split(":")[0]) : null;
  const isLate = typeof hour === "number" && !Number.isNaN(hour) && hour >= 20;
  const isMorning = typeof hour === "number" && !Number.isNaN(hour) && hour < 11;
  const isLongSession = (durationMinutes ?? 0) >= 60;

  if (sport.includes("swim")) {
    return {
      title: "Hydration recovery",
      detail: "Swimming day: choose a light recovery meal and close the water gap.",
      mealFocus: "Light protein",
      hydrationFocus: isLongSession ? "Add electrolytes" : "Water first",
    };
  }

  if (sport.includes("weight") || sport.includes("strength") || sport.includes("bodyweight")) {
    return {
      title: "High-protein recovery",
      detail: "Strength day: prioritize protein and keep carbs moderate.",
      mealFocus: "High protein",
      hydrationFocus: "Steady water",
    };
  }

  if (sport.includes("football") || sport.includes("basketball") || sport.includes("padel") || sport.includes("run") || sport.includes("hiit")) {
    return {
      title: isLate ? "Light late recovery" : "Performance recovery",
      detail: isLate
        ? "Late activity: keep the meal lighter, with protein and easy carbs."
        : "Sport session: pair protein with moderate carbs for recovery.",
      mealFocus: "Protein + carbs",
      hydrationFocus: isLongSession ? "Hydrate deeply" : "Close water ring",
    };
  }

  if (isMorning) {
    return {
      title: "Breakfast fuel",
      detail: "Morning activity: pick a breakfast that supports steady energy.",
      mealFocus: "Balanced breakfast",
      hydrationFocus: "Start with water",
    };
  }

  return {
    title: "Recovery meal fit",
    detail: "Match your next SportHub session with a meal that keeps targets on track.",
    mealFocus: "Balanced meal",
    hydrationFocus: "Hydration check",
  };
}
