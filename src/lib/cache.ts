import { supabase } from "@/integrations/supabase/client";

const memoryCache = new Map<string, { value: unknown; expiry: number }>();

const DEFAULT_TTL = 300;

class CacheManager {
  async get<T>(key: string): Promise<T | null> {
    try {
      const cached = memoryCache.get(key);
      if (cached && cached.expiry > Date.now()) {
        return cached.value as T;
      }
      memoryCache.delete(key);
      return null;
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number = DEFAULT_TTL): Promise<void> {
    try {
      memoryCache.set(key, { value, expiry: Date.now() + ttlSeconds * 1000 });
    } catch {
      // silently fail — caching is not critical
    }
  }

  async delete(key: string): Promise<void> {
    try {
      memoryCache.delete(key);
    } catch {
      // ignore errors
    }
  }

  async invalidatePattern(pattern: string): Promise<void> {
    try {
      const prefix = pattern.replace("*", "");
      for (const key of memoryCache.keys()) {
        if (key.includes(prefix)) {
          memoryCache.delete(key);
        }
      }
    } catch {
      // ignore errors
    }
  }

  clear(): void {
    memoryCache.clear();
  }
}

const cache = new CacheManager();

export const cacheKeys = {
  restaurant: (id: string) => `restaurant:${id}`,
  restaurantList: (filters: string) => `restaurants:${filters}`,
  meal: (id: string) => `meal:${id}`,
  mealReviews: (id: string) => `meal:reviews:${id}`,
  userProfile: (id: string) => `profile:${id}`,
  subscription: (userId: string) => `subscription:${userId}`,
  challenges: () => `challenges:active`,
  leaderboard: (challengeId: string) => `leaderboard:${challengeId}`,
};

export async function getCachedRestaurant(id: string) {
  const key = cacheKeys.restaurant(id);
  let data = await cache.get(key);

  if (!data) {
    const { data: restaurant } = await supabase
      .from("restaurants")
      .select("*")
      .eq("id", id)
      .single();

    data = restaurant;
    if (data) {
      await cache.set(key, data, 600);
    }
  }

  return data;
}

export async function getCachedMeal(id: string) {
  const key = cacheKeys.meal(id);
  let data = await cache.get(key);

  if (!data) {
    const { data: meal } = await supabase
      .from("meals")
      .select("*, restaurants(name, logo_url)")
      .eq("id", id)
      .single();

    data = meal;
    if (data) {
      await cache.set(key, data, 600);
    }
  }

  return data;
}

export async function getCachedChallenges() {
  const key = cacheKeys.challenges();
  let data = await cache.get(key);

  if (!data) {
    const { data: challenges } = await supabase.rpc("get_active_challenges");
    data = challenges;
    if (data) {
      await cache.set(key, data, 300);
    }
  }

  return data;
}

export async function invalidateRestaurantCache(id?: string) {
  if (id) {
    await cache.delete(cacheKeys.restaurant(id));
  } else {
    await cache.invalidatePattern("restaurants:*");
  }
}

export async function invalidateMealCache(id?: string) {
  if (id) {
    await cache.delete(cacheKeys.meal(id));
    await cache.delete(cacheKeys.mealReviews(id));
  } else {
    await cache.invalidatePattern("meal:*");
  }
}

export { cache };
export default cache;
