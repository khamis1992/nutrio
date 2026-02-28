/**
 * Database Helper Functions
 * Handles PostgreSQL/Supabase database operations
 */

import { Pool, type PoolClient } from 'pg';
import type { DriverData, PersistLocationData } from '../types/events';

// Database pool
let pool: Pool | null = null;

/**
 * Get database pool
 */
function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: parseInt(process.env.DATABASE_POOL_SIZE || '20', 10),
      ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
    });
    
    pool.on('error', (err) => {
      console.error('[DB] Pool error:', err);
    });
  }
  
  return pool;
}

/**
 * Get driver data by ID
 */
export async function getDriverData(driverId: string): Promise<DriverData | null> {
  const pool = getPool();
  const client = await pool.connect();
  
  try {
    const result = await client.query<DriverData>(
      `SELECT id, full_name, city_id, status, is_online, current_latitude, current_longitude
       FROM drivers 
       WHERE id = $1`,
      [driverId]
    );
    
    return result.rows[0] || null;
  } catch (error) {
    console.error(`[DB] Error fetching driver ${driverId}:`, error);
    return null;
  } finally {
    client.release();
  }
}

/**
 * Update driver's online status
 */
export async function updateDriverOnlineStatus(
  driverId: string, 
  isOnline: boolean
): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  
  try {
    await client.query(
      `UPDATE drivers 
       SET is_online = $1, location_updated_at = NOW()
       WHERE id = $2`,
      [isOnline, driverId]
    );
  } catch (error) {
    console.error(`[DB] Error updating driver ${driverId} status:`, error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Persist location update to database
 */
export async function persistLocationToDatabase(data: PersistLocationData): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Insert location history
    await client.query(
      `INSERT INTO driver_locations 
       (driver_id, latitude, longitude, accuracy, speed, heading, battery_level, recorded_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        data.driverId,
        data.latitude,
        data.longitude,
        data.accuracy,
        data.speed || 0,
        data.heading || 0,
        data.batteryLevel || 0,
        data.timestamp,
      ]
    );
    
    // Update driver's current location
    await client.query(
      `UPDATE drivers 
       SET current_latitude = $1, 
           current_longitude = $2, 
           location_updated_at = $3
       WHERE id = $4`,
      [data.latitude, data.longitude, data.timestamp, data.driverId]
    );
    
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`[DB] Error persisting location for ${data.driverId}:`, error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get driver location history
 */
export async function getDriverLocationHistory(
  driverId: string,
  startTime: string,
  endTime: string,
  maxPoints: number = 1000
): Promise<Array<{ latitude: number; longitude: number; speed: number; recordedAt: string }>> {
  const pool = getPool();
  const client = await pool.connect();
  
  try {
    const result = await client.query(
      `SELECT latitude, longitude, speed, recorded_at
       FROM driver_locations 
       WHERE driver_id = $1 
         AND recorded_at >= $2 
         AND recorded_at <= $3
       ORDER BY recorded_at DESC
       LIMIT $4`,
      [driverId, startTime, endTime, maxPoints]
    );
    
    return result.rows.map(row => ({
      latitude: parseFloat(row.latitude),
      longitude: parseFloat(row.longitude),
      speed: parseFloat(row.speed) || 0,
      recordedAt: row.recorded_at.toISOString(),
    }));
  } catch (error) {
    console.error(`[DB] Error fetching location history for ${driverId}:`, error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get city driver count
 */
export async function getCityDriverCount(cityId: string): Promise<{ total: number; online: number }> {
  const pool = getPool();
  const client = await pool.connect();
  
  try {
    const result = await client.query(
      `SELECT 
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE is_online = true) as online
       FROM drivers 
       WHERE city_id = $1 AND status = 'active'`,
      [cityId]
    );
    
    return {
      total: parseInt(result.rows[0].total, 10),
      online: parseInt(result.rows[0].online, 10),
    };
  } catch (error) {
    console.error(`[DB] Error fetching driver count for city ${cityId}:`, error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Close database pool
 */
export async function closeDatabasePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('[DB] Pool closed');
  }
}
