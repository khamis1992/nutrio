import type { MealRankingRun } from "@/lib/mealRanking";

const CACHE_VERSION = 2;
const MAX_CACHE_AGE_MS = 24 * 60 * 60 * 1000;

interface CachedRanking {
  version: number;
  cachedAt: string;
  run: MealRankingRun;
}

const cacheKey = (userId: string) => `nutrio:meal-ranking:v${CACHE_VERSION}:${userId}`;

export function saveMealRankingCache(userId: string, run: MealRankingRun) {
  if (typeof localStorage === "undefined") return;
  const payload: CachedRanking = {
    version: CACHE_VERSION,
    cachedAt: new Date().toISOString(),
    run,
  };
  try {
    localStorage.setItem(cacheKey(userId), JSON.stringify(payload));
  } catch (error) {
    console.warn("Unable to cache meal ranking", error);
  }
}

export function loadMealRankingCache(userId: string, now = new Date()): MealRankingRun | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(cacheKey(userId));
    if (!raw) return null;
    const cached = JSON.parse(raw) as CachedRanking;
    const age = now.getTime() - new Date(cached.cachedAt).getTime();
    if (cached.version !== CACHE_VERSION || !Number.isFinite(age) || age < 0 || age > MAX_CACHE_AGE_MS) {
      localStorage.removeItem(cacheKey(userId));
      return null;
    }
    return {
      ...cached.run,
      offline: true,
      inputFreshness: Object.fromEntries(
        Object.entries(cached.run.inputFreshness).map(([key, value]) => [
          key,
          value === "missing" ? "missing" : "stale",
        ]),
      ),
      ranked: cached.run.ranked.map((meal) => ({
        ...meal,
        inputFreshness: Object.fromEntries(
          Object.entries(meal.inputFreshness).map(([key, value]) => [
            key,
            value === "missing" ? "missing" : "stale",
          ]),
        ),
      })),
    };
  } catch (error) {
    console.warn("Unable to restore meal ranking", error);
    return null;
  }
}
