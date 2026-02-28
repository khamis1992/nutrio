/**
 * Driver Handler
 * Manages driver connections, location updates, and status changes
 */

import type { Socket } from 'socket.io';
import type { 
  SocketUserData, 
  LocationUpdatePayload, 
  StatusUpdatePayload,
  DriverLocationBroadcast,
  DriverStatusCache,
  PersistLocationData
} from '../types/events';
import { SocketEvents, RoomNames } from '../types/events';
import { 
  cacheDriverLocation, 
  cacheDriverStatus, 
  markDriverOffline 
} from '../services/redisService';
import { persistLocationToDatabase, updateDriverOnlineStatus, getDriverData } from './dbHelper';
import { z } from 'zod';

// Rate limiting map (in production, use Redis)
const lastLocationUpdate = new Map<string, number>();
const MIN_UPDATE_INTERVAL = parseInt(process.env.LOCATION_UPDATE_INTERVAL || '5000', 10);

// Validation schema for location updates
const locationUpdateSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(1000),
  speed: z.number().min(0).optional(),
  heading: z.number().min(0).max(360).optional(),
  batteryLevel: z.number().min(0).max(100).optional(),
  timestamp: z.string().datetime(),
});

// Validation schema for status updates
const statusUpdateSchema = z.object({
  isOnline: z.boolean(),
  reason: z.enum(['user_action', 'app_background', 'timeout', 'order_complete']).optional(),
});

/**
 * Initialize driver connection
 */
export async function initializeDriverConnection(
  socket: Socket,
  userData: SocketUserData
): Promise<void> {
  const driverId = userData.driverId!;
  
  // Join driver-specific room
  socket.join(RoomNames.driver(driverId));
  
  // Cache driver status as online
  const status: DriverStatusCache = {
    isOnline: 'true',
    socketId: socket.id,
    connectedAt: new Date().toISOString(),
  };
  
  await cacheDriverStatus(driverId, status);
  
  // Update database online status
  await updateDriverOnlineStatus(driverId, true);
  
  // Acknowledge connection with recommended update interval
  socket.emit(SocketEvents.CONNECTION_ACK, {
    driverId,
    connectedAt: new Date().toISOString(),
    updateInterval: 5, // 5 seconds
  });
  
  // Set up event handlers
  setupDriverEventHandlers(socket, driverId);
  
  console.log(`[Driver] Connected: ${driverId} (Socket: ${socket.id})`);
}

/**
 * Set up event handlers for driver
 */
function setupDriverEventHandlers(socket: Socket, driverId: string): void {
  // Location update handler
  socket.on(SocketEvents.LOCATION_UPDATE, async (payload: LocationUpdatePayload) => {
    await handleLocationUpdate(socket, driverId, payload);
  });
  
  // Status update handler
  socket.on(SocketEvents.STATUS_UPDATE, async (payload: StatusUpdatePayload) => {
    await handleStatusUpdate(socket, driverId, payload);
  });
  
  // Disconnect handler
  socket.on(SocketEvents.DISCONNECT, async (reason: string) => {
    await handleDriverDisconnect(driverId, socket.id, reason);
  });
}

/**
 * Handle location update from driver
 */
async function handleLocationUpdate(
  socket: Socket,
  driverId: string,
  payload: LocationUpdatePayload
): Promise<void> {
  try {
    // Rate limiting check
    const now = Date.now();
    const lastUpdate = lastLocationUpdate.get(driverId) || 0;
    
    if (now - lastUpdate < MIN_UPDATE_INTERVAL) {
      socket.emit(SocketEvents.ERROR, {
        code: 'RATE_LIMIT',
        message: 'Location updates too frequent',
      });
      return;
    }
    
    lastLocationUpdate.set(driverId, now);
    
    // Validate payload
    const validation = locationUpdateSchema.safeParse(payload);
    
    if (!validation.success) {
      socket.emit(SocketEvents.ERROR, {
        code: 'VALIDATION_ERROR',
        message: 'Invalid location data',
        details: validation.error.errors,
      });
      return;
    }
    
    // Get driver data for city and name
    const driverData = await getDriverData(driverId);
    
    if (!driverData) {
      socket.emit(SocketEvents.ERROR, {
        code: 'DRIVER_NOT_FOUND',
        message: 'Driver not found in database',
      });
      return;
    }
    
    // Cache location in Redis
    await cacheDriverLocation(driverId, {
      latitude: payload.latitude.toString(),
      longitude: payload.longitude.toString(),
      accuracy: payload.accuracy.toString(),
      speed: (payload.speed || 0).toString(),
      heading: (payload.heading || 0).toString(),
      batteryLevel: (payload.batteryLevel || 0).toString(),
      timestamp: payload.timestamp,
    });
    
    // Prepare broadcast data
    const broadcastData: DriverLocationBroadcast = {
      driverId,
      driverName: driverData.full_name,
      cityId: driverData.city_id,
      latitude: payload.latitude,
      longitude: payload.longitude,
      speed: payload.speed || 0,
      heading: payload.heading || 0,
      isOnline: true,
      timestamp: payload.timestamp,
    };
    
    // Broadcast to fleet managers in the same city
    socket.to(RoomNames.fleetCity(driverData.city_id)).emit(
      SocketEvents.DRIVER_LOCATION,
      broadcastData
    );
    
    // Also broadcast to super admins (all cities)
    socket.to(RoomNames.fleetAll()).emit(
      SocketEvents.DRIVER_LOCATION,
      broadcastData
    );
    
    // Persist to database asynchronously (don't await)
    const persistData: PersistLocationData = {
      driverId,
      latitude: payload.latitude,
      longitude: payload.longitude,
      accuracy: payload.accuracy,
      speed: payload.speed,
      heading: payload.heading,
      batteryLevel: payload.batteryLevel,
      timestamp: payload.timestamp,
    };
    
    persistLocationToDatabase(persistData).catch((error) => {
      console.error(`[Driver] Failed to persist location for ${driverId}:`, error);
    });
    
  } catch (error) {
    console.error(`[Driver] Location update error for ${driverId}:`, error);
    socket.emit(SocketEvents.ERROR, {
      code: 'INTERNAL_ERROR',
      message: 'Failed to process location update',
    });
  }
}

/**
 * Handle status update from driver
 */
async function handleStatusUpdate(
  socket: Socket,
  driverId: string,
  payload: StatusUpdatePayload
): Promise<void> {
  try {
    // Validate payload
    const validation = statusUpdateSchema.safeParse(payload);
    
    if (!validation.success) {
      socket.emit(SocketEvents.ERROR, {
        code: 'VALIDATION_ERROR',
        message: 'Invalid status data',
        details: validation.error.errors,
      });
      return;
    }
    
    // Update Redis status
    const status: DriverStatusCache = {
      isOnline: payload.isOnline.toString(),
      socketId: socket.id,
      connectedAt: new Date().toISOString(),
      status: payload.reason || 'user_action',
    };
    
    await cacheDriverStatus(driverId, status);
    
    // Update database status
    await updateDriverOnlineStatus(driverId, payload.isOnline);
    
    // Get driver data for broadcasting
    const driverData = await getDriverData(driverId);
    
    if (driverData) {
      // Notify fleet managers of status change
      const statusBroadcast = {
        driverId,
        driverName: driverData.full_name,
        previousStatus: payload.isOnline ? 'offline' : 'online',
        currentStatus: payload.isOnline ? 'online' : 'offline',
        cityId: driverData.city_id,
        timestamp: new Date().toISOString(),
      };
      
      socket.to(RoomNames.fleetCity(driverData.city_id)).emit(
        SocketEvents.DRIVER_STATUS,
        statusBroadcast
      );
      
      socket.to(RoomNames.fleetAll()).emit(
        SocketEvents.DRIVER_STATUS,
        statusBroadcast
      );
    }
    
  } catch (error) {
    console.error(`[Driver] Status update error for ${driverId}:`, error);
    socket.emit(SocketEvents.ERROR, {
      code: 'INTERNAL_ERROR',
      message: 'Failed to process status update',
    });
  }
}

/**
 * Handle driver disconnection
 */
async function handleDriverDisconnect(
  driverId: string,
  socketId: string,
  reason: string
): Promise<void> {
  try {
    console.log(`[Driver] Disconnected: ${driverId} (Socket: ${socketId}, Reason: ${reason})`);
    
    // Mark as offline in Redis
    await markDriverOffline(driverId);
    
    // Update database status
    await updateDriverOnlineStatus(driverId, false);
    
    // Get driver data for final broadcast
    const driverData = await getDriverData(driverId);
    
    if (driverData) {
      // Notify fleet managers that driver is offline
      const statusBroadcast = {
        driverId,
        driverName: driverData.full_name,
        previousStatus: 'online',
        currentStatus: 'offline',
        cityId: driverData.city_id,
        timestamp: new Date().toISOString(),
      };
      
      // We need the io instance to broadcast - this is handled by the main server
      // The disconnect event is emitted on the socket which has access to the io instance
      // But since we're not in the context of a socket handler here, we skip this broadcast
      // The fleet managers will notice the driver hasn't updated and mark them as offline
    }
    
  } catch (error) {
    console.error(`[Driver] Disconnect handler error for ${driverId}:`, error);
  }
}
