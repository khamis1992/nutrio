export interface MacroValues {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface MacroImpact {
  current: number;
  addition: number;
  projected: number;
  target: number;
  remaining: number;
  exceededBy: number;
  currentPercent: number;
  additionPercent: number;
  projectedPercent: number;
}

export type MealImpactPreview = Record<keyof MacroValues, MacroImpact>;

const normalize = (value: number) => (
  Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0
);

export function calculateMealImpact(
  current: MacroValues,
  addition: MacroValues,
  targets: MacroValues,
): MealImpactPreview {
  return (Object.keys(targets) as Array<keyof MacroValues>).reduce((result, key) => {
    const normalizedCurrent = normalize(current[key]);
    const normalizedAddition = normalize(addition[key]);
    const target = normalize(targets[key]);
    const projected = normalizedCurrent + normalizedAddition;
    const percent = (value: number) => target > 0 ? Math.min(100, (value / target) * 100) : 0;

    result[key] = {
      current: normalizedCurrent,
      addition: normalizedAddition,
      projected,
      target,
      remaining: Math.max(0, target - projected),
      exceededBy: Math.max(0, projected - target),
      currentPercent: percent(normalizedCurrent),
      additionPercent: target > 0
        ? Math.min(Math.max(0, 100 - percent(normalizedCurrent)), (normalizedAddition / target) * 100)
        : 0,
      projectedPercent: percent(projected),
    };

    return result;
  }, {} as MealImpactPreview);
}
