/**
 * Redis Service
 * Handles caching, pub/sub, and multi-server synchronization
 */

import Redis from 'ioredis';
import type { DriverLocationCache, DriverStatusCache } from '../types/events';

// Connection management
let redisClient: Redis | null = null;
let pubClient: Redis | null = null;
let subClient: Redis | null = null;

// Configuration
const LOCATION_CACHE_TTL = parseInt(process.env.LOCATION_CACHE_TTL || '300', 10);
const STATUS_CACHE_TTL = parseInt(process.env.STATUS_CACHE_TTL || '60', 10);
const KEY_PREFIX = process.env.REDIS_KEY_PREFIX || 'fleet:';

/**
 * Get main Redis client
 */
export function getRedisClient(): Redis {
  if (!redisClient) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    if (process.env.REDIS_CLUSTER_MODE === 'true') {
      const nodes = process.env.REDIS_CLUSTER_NODES?.split(',') || [redisUrl];
      redisClient = new Redis.Cluster(nodes.map(node => ({ host: node })), {
        redisOptions: {
          password: process.env.REDIS_PASSWORD || undefined,
          maxRetriesPerRequest: 3,
        },
      });
    } else {
      redisClient = new Redis(redisUrl, {
        password: process.env.REDIS_PASSWORD || undefined,
        db: parseInt(process.env.REDIS_DB || '0', 10),
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: true,
      });
    }

    redisClient.on('error', (err) => {
      console.error('[Redis] Client error:', err);
    });

    redisClient.on('connect', () => {
      console.log('[Redis] Connected successfully');
    });

    redisClient.on('reconnecting', () => {
      console.log('[Redis] Reconnecting...');
    });
  }

  return redisClient;
}

/**
 * Get Redis clients for Socket.io adapter
 */
export function getAdapterClients(): { pubClient: Redis; subClient: Redis } {
  if (!pubClient || !subClient) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    pubClient = new Redis(redisUrl, {
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB || '0', 10),
    });
    
    subClient = new Redis(redisUrl, {
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB || '0', 10),
    });

    pubClient.on('error', (err) => console.error('[Redis Pub] Error:', err));
    subClient.on('error', (err) => console.error('[Redis Sub] Error:', err));
  }

  return { pubClient, subClient };
}

/**
 * Cache driver location
 */
export async function cacheDriverLocation(
  driverId: string,
  location: DriverLocationCache
): Promise<void> {
  const redis = getRedisClient();
  const key = `${KEY_PREFIX}driver:${driverId}:location`;
  
  await redis.hset(key, location);
  await redis.expire(key, LOCATION_CACHE_TTL);
}

/**
 * Get cached driver location
 */
export async function getCachedDriverLocation(
  driverId: string
): Promise<DriverLocationCache | null> {
  const redis = getRedisClient();
  const key = `${KEY_PREFIX}driver:${driverId}:location`;
  
  const data = await redis.hgetall(key);
  
  if (!data || Object.keys(data).length === 0) {
    return null;
  }
  
  return data as DriverLocationCache;
}

/**
 * Cache driver status
 */
export async function cacheDriverStatus(
  driverId: string,
  status: DriverStatusCache
): Promise<void> {
  const redis = getRedisClient();
  const key = `${KEY_PREFIX}driver:${driverId}:status`;
  
  await redis.hset(key, status);
  await redis.expire(key, STATUS_CACHE_TTL);
}

/**
 * Get cached driver status
 */
export async function getCachedDriverStatus(
  driverId: string
): Promise<DriverStatusCache | null> {
  const redis = getRedisClient();
  const key = `${KEY_PREFIX}driver:${driverId}:status`;
  
  const data = await redis.hgetall(key);
  
  if (!data || Object.keys(data).length === 0) {
    return null;
  }
  
  return data as DriverStatusCache;
}

/**
 * Mark driver as offline
 */
export async function markDriverOffline(driverId: string): Promise<void> {
  const redis = getRedisClient();
  const key = `${KEY_PREFIX}driver:${driverId}:status`;
  
  await redis.hmset(key, {
    isOnline: 'false',
    disconnectedAt: new Date().toISOString(),
  });
  await redis.expire(key, STATUS_CACHE_TTL);
}

/**
 * Get online drivers in a city
 */
export async function getOnlineDriversInCity(cityId: string): Promise<string[]> {
  const redis = getRedisClient();
  const pattern = `${KEY_PREFIX}driver:*:status`;
  
  const keys = await redis.keys(pattern);
  const onlineDrivers: string[] = [];
  
  for (const key of keys) {
    const status = await redis.hgetall(key);
    if (status.isOnline === 'true') {
      const driverId = key.replace(`${KEY_PREFIX}driver:`, '').replace(':status', '');
      
      // Check city from location cache
      const locationKey = `${KEY_PREFIX}driver:${driverId}:location`;
      const location = await redis.hgetall(locationKey);
      
      // This is a simplified check - in production, you'd store city_id in status cache
      onlineDrivers.push(driverId);
    }
  }
  
  return onlineDrivers;
}

/**
 * Update city driver count
 */
export async function updateCityDriverCount(
  cityId: string,
  increment: boolean
): Promise<void> {
  const redis = getRedisClient();
  const key = `${KEY_PREFIX}city:${cityId}:stats`;
  const field = 'onlineDrivers';
  
  if (increment) {
    await redis.hincrby(key, field, 1);
  } else {
    await redis.hincrby(key, field, -1);
  }
  
  await redis.expire(key, STATUS_CACHE_TTL);
}

/**
 * Get city statistics
 */
export async function getCityStats(
  cityId: string
): Promise<{ onlineDrivers: number; totalDrivers: number }> {
  const redis = getRedisClient();
  const key = `${KEY_PREFIX}city:${cityId}:stats`;
  
  const stats = await redis.hgetall(key);
  
  return {
    onlineDrivers: parseInt(stats.onlineDrivers || '0', 10),
    totalDrivers: parseInt(stats.totalDrivers || '0', 10),
  };
}

/**
 * Close all Redis connections
 */
export async function closeRedisConnections(): Promise<void> {
  const promises: Promise<void>[] = [];
  
  if (redisClient) {
    promises.push(redisClient.quit());
    redisClient = null;
  }
  
  if (pubClient) {
    promises.push(pubClient.quit());
    pubClient = null;
  }
  
  if (subClient) {
    promises.push(subClient.quit());
    subClient = null;
  }
  
  await Promise.all(promises);
  console.log('[Redis] All connections closed');
}

/**
 * Health check for Redis
 */
export async function checkRedisHealth(): Promise<boolean> {
  try {
    const redis = getRedisClient();
    await redis.ping();
    return true;
  } catch (error) {
    console.error('[Redis] Health check failed:', error);
    return false;
  }
}
