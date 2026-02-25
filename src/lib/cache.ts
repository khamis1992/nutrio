/**
 * P3-007: Caching Layer Implementation
 * Redis-based caching for frequent queries
 */

import { supabase } from "@/integrations/supabase/client";

// In-memory cache fallback when Redis is not available
const memoryCache = new Map<string, { value: any; expiry: number }>();

interface CacheConfig {
  ttl: number; // Time to live in seconds
  key: string;
}

class CacheManager {
  private redis: any = null;
  private isRedisAvailable = false;

  constructor() {
    this.initRedis();
  }

  private async initRedis() {
    try {
      // In production, this would connect to Redis
      // For now, we use in-memory fallback
      // this.redis = new Redis(process.env.REDIS_URL);
      // this.isRedisAvailable = true;
      this.isRedisAvailable = false;
    } catch {
      console.log("Redis not available, using in-memory cache");
      this.isRedisAvailable = false;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      // Try Redis first
      if (this.isRedisAvailable && this.redis) {
        const value = await this.redis.get(key);
        if (value) return JSON.parse(value);
      }
      
      // Fallback to memory cache
      const cached = memoryCache.get(key);
      if (cached && cached.expiry > Date.now()) {
        return cached.value;
      }
      
      // Expired or not found
      memoryCache.delete(key);
      return null;
    } catch {
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds: number = 300): Promise<void> {
    try {
      // Try Redis first
      if (this.isRedisAvailable && this.redis) {
        await this.redis.setex(key, ttlSeconds, JSON.stringify(value));
        return;
      }
      
      // Fallback to memory cache
      memoryCache.set(key, {
        value,
        expiry: Date.now() + ttlSeconds * 1000,
      });
    } catch {
      // Silently fail - caching is not critical
    }
  }

  async delete(key: string): Promise<void> {
    try {
      if (this.isRedisAvailable && this.redis) {
        await this.redis.del(key);
      }
      memoryCache.delete(key);
    } catch {
      // Ignore errors
    }
  }

  async invalidatePattern(pattern: string): Promise<void> {
    try {
      if (this.isRedisAvailable && this.redis) {
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      }
      
      // Memory cache pattern matching
      for (const key of memoryCache.keys()) {
        if (key.includes(pattern.replace('*', ''))) {
          memoryCache.delete(key);
        }
      }
    } catch {
      // Ignore errors
    }
  }
}

const cache = new CacheManager();

// Cache keys generators
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

// Cached data fetchers
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
      await cache.set(key, data, 600); // 10 minutes
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
    const { data: challenges } = await (supabase.rpc as any)("get_active_challenges");
    data = challenges;
    if (data) {
      await cache.set(key, data, 300); // 5 minutes
    }
  }
  
  return data;
}

// Invalidate cache helpers
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
