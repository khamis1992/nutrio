export type FoodColor = "green" | "yellow" | "red";

export interface ClassifiedMeal {
  color: FoodColor;
  reason: string;
}

export function classifyFood(calories: number, protein_g: number, fat_g: number): ClassifiedMeal {
  if (calories <= 0) return { color: "green", reason: "Zero calories" };

  const proteinRatio = (protein_g * 4) / calories;
  const fatRatio = (fat_g * 9) / calories;

  if (proteinRatio > 0.30 && fatRatio < 0.35 && calories < 400) {
    return { color: "green", reason: "High protein, low fat" };
  }

  if (fatRatio > 0.45 || (calories > 700 && proteinRatio < 0.20)) {
    return { color: "red", reason: "High calorie density" };
  }

  return { color: "yellow", reason: "Moderate" };
}

export function getColorDot(color: FoodColor): string {
  return { green: "🟢", yellow: "🟡", red: "🔴" }[color];
}

export function getColorBg(color: FoodColor): string {
  return {
    green: "bg-emerald-100 text-emerald-700",
    yellow: "bg-amber-100 text-amber-700",
    red: "bg-rose-100 text-rose-700",
  }[color];
}

export function getColorBar(color: FoodColor): string {
  return {
    green: "bg-emerald-400",
    yellow: "bg-amber-400",
    red: "bg-rose-400",
  }[color];
}
