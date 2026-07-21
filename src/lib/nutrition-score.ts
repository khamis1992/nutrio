/**
 * Single source of truth for the daily nutrition score.
 *
 * Used by BOTH the Dashboard "today" tab and the Progress page so the user
 * sees one identical number everywhere. Do not inline this formula again.
 *
 * Weights (today): calories 38% · protein 32% · hydration 20% · weekly consistency 10%
 * Weights (past days, no consistency signal): calories 45% · protein 35% · hydration 20%
 */
export interface NutritionScoreInput {
  /** Calorie intake as % of daily target, clamped 0-100. */
  caloriePct: number;
  /** Protein intake as % of daily target, clamped 0-100. */
  proteinPct: number;
  /** Hydration intake as % of daily goal, clamped 0-100. */
  hydrationPct: number;
  /** Weekly logging consistency 0-100. Pass only when scoring *today*. */
  weeklyConsistencyPct?: number;
}

export function computeNutritionScore({
  caloriePct,
  proteinPct,
  hydrationPct,
  weeklyConsistencyPct,
}: NutritionScoreInput): number {
  if (weeklyConsistencyPct != null) {
    return Math.round(
      caloriePct * 0.38 + proteinPct * 0.32 + hydrationPct * 0.2 + weeklyConsistencyPct * 0.1,
    );
  }
  return Math.round(caloriePct * 0.45 + proteinPct * 0.35 + hydrationPct * 0.2);
}
