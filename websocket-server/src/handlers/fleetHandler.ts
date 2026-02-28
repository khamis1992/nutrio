/**
 * Fleet Handler
 * Manages fleet manager connections, city subscriptions, and access control
 */

import type { Socket } from 'socket.io';
import type { 
  SocketUserData, 
  SubscribeCityPayload, 
  RequestLocationHistoryPayload,
  CitySubscribedPayload,
  LocationHistoryResponse
} from '../types/events';
import { SocketEvents, RoomNames } from '../types/events';
import { getCityStats, getOnlineDriversInCity } from '../services/redisService';
import { getDriverLocationHistory, getCityDriverCount } from './dbHelper';
import { z } from 'zod';

// Validation schemas
const subscribeCitySchema = z.object({
  cityId: z.string().uuid(),
});

const requestHistorySchema = z.object({
  driverId: z.string().uuid(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
});

// Maximum location history points per request
const MAX_HISTORY_POINTS = parseInt(process.env.MAX_LOCATION_HISTORY_POINTS || '1000', 10);

/**
 * Initialize fleet manager connection
 */
export async function initializeFleetConnection(
  socket: Socket,
  userData: SocketUserData
): Promise<void> {
  const managerId = userData.managerId!;
  const assignedCities = userData.assignedCities;
  const role = userData.role;
  
  // Join appropriate rooms based on role
  if (role === 'super_admin') {
    // Super admin can see all cities
    socket.join(RoomNames.fleetAll());
    console.log(`[Fleet] Super admin connected: ${managerId} (All cities)`);
  } else {
    // Fleet manager joins only their assigned cities
    for (const cityId of assignedCities) {
      socket.join(RoomNames.fleetCity(cityId));
    }
    console.log(`[Fleet] Manager connected: ${managerId} (Cities: ${assignedCities.join(', ')})`);
  }
  
  // Set up event handlers
  setupFleetEventHandlers(socket, userData);
  
  // Send initial stats for subscribed cities
  await sendInitialStats(socket, assignedCities, role);
}

/**
 * Set up event handlers for fleet manager
 */
function setupFleetEventHandlers(socket: Socket, userData: SocketUserData): void {
  // City subscription handler
  socket.on(SocketEvents.SUBSCRIBE_CITY, async (payload: SubscribeCityPayload) => {
    await handleSubscribeCity(socket, userData, payload);
  });
  
  // Location history request handler
  socket.on(SocketEvents.REQUEST_HISTORY, async (payload: RequestLocationHistoryPayload) => {
    await handleRequestHistory(socket, userData, payload);
  });
  
  // Disconnect handler
  socket.on(SocketEvents.DISCONNECT, (reason: string) => {
    handleFleetDisconnect(userData.managerId!, reason);
  });
}

/**
 * Handle city subscription request
 */
async function handleSubscribeCity(
  socket: Socket,
  userData: SocketUserData,
  payload: SubscribeCityPayload
): Promise<void> {
  try {
    // Validate payload
    const validation = subscribeCitySchema.safeParse(payload);
    
    if (!validation.success) {
      socket.emit(SocketEvents.ERROR, {
        code: 'VALIDATION_ERROR',
        message: 'Invalid city subscription data',
        details: validation.error.errors,
      });
      return;
    }
    
    const { cityId } = payload;
    const { role, assignedCities, managerId } = userData;
    
    // Validate access
    if (role !== 'super_admin' && !assignedCities.includes(cityId)) {
      socket.emit(SocketEvents.ERROR, {
        code: 'UNAUTHORIZED_CITY_ACCESS',
        message: 'You do not have access to this city',
      });
      console.warn(`[Fleet] Unauthorized city access attempt by ${managerId}: ${cityId}`);
      return;
    }
    
    // Join city room
    socket.join(RoomNames.fleetCity(cityId));
    
    // Get city stats
    const driverCount = await getCityDriverCount(cityId);
    
    const response: CitySubscribedPayload = {
      cityId,
      driverCount: driverCount.online,
    };
    
    socket.emit(SocketEvents.CITY_SUBSCRIBED, response);
    
    console.log(`[Fleet] Manager ${managerId} subscribed to city: ${cityId}`);
    
  } catch (error) {
    console.error('[Fleet] City subscription error:', error);
    socket.emit(SocketEvents.ERROR, {
      code: 'INTERNAL_ERROR',
      message: 'Failed to subscribe to city',
    });
  }
}

/**
 * Handle location history request
 */
async function handleRequestHistory(
  socket: Socket,
  userData: SocketUserData,
  payload: RequestLocationHistoryPayload
): Promise<void> {
  try {
    // Validate payload
    const validation = requestHistorySchema.safeParse(payload);
    
    if (!validation.success) {
      socket.emit(SocketEvents.ERROR, {
        code: 'VALIDATION_ERROR',
        message: 'Invalid history request data',
        details: validation.error.errors,
      });
      return;
    }
    
    const { driverId, startTime, endTime } = payload;
    const { role, assignedCities, managerId } = userData;
    
    // Get driver's city from database
    const { getDriverData } = await import('./dbHelper');
    const driverData = await getDriverData(driverId);
    
    if (!driverData) {
      socket.emit(SocketEvents.ERROR, {
        code: 'DRIVER_NOT_FOUND',
        message: 'Driver not found',
      });
      return;
    }
    
    // Validate manager has access to this driver's city
    if (role !== 'super_admin' && !assignedCities.includes(driverData.city_id)) {
      socket.emit(SocketEvents.ERROR, {
        code: 'UNAUTHORIZED_DRIVER_ACCESS',
        message: 'You do not have access to this driver\'s data',
      });
      console.warn(`[Fleet] Unauthorized driver access attempt by ${managerId}: ${driverId}`);
      return;
    }
    
    // Fetch location history
    const history = await getDriverLocationHistory(
      driverId,
      startTime,
      endTime,
      MAX_HISTORY_POINTS
    );
    
    const response: LocationHistoryResponse = {
      driverId,
      locations: history,
    };
    
    socket.emit(SocketEvents.LOCATION_HISTORY, response);
    
    console.log(`[Fleet] Manager ${managerId} requested history for driver ${driverId}: ${history.length} points`);
    
  } catch (error) {
    console.error('[Fleet] History request error:', error);
    socket.emit(SocketEvents.ERROR, {
      code: 'INTERNAL_ERROR',
      message: 'Failed to fetch location history',
    });
  }
}

/**
 * Handle fleet manager disconnection
 */
function handleFleetDisconnect(managerId: string, reason: string): void {
  console.log(`[Fleet] Manager disconnected: ${managerId} (Reason: ${reason})`);
}

/**
 * Send initial stats for subscribed cities
 */
async function sendInitialStats(
  socket: Socket,
  assignedCities: string[],
  role: string
): Promise<void> {
  try {
    const citiesToFetch = role === 'super_admin' ? [] : assignedCities;
    
    for (const cityId of citiesToFetch) {
      const stats = await getCityStats(cityId);
      
      socket.emit(SocketEvents.STATS_UPDATE, {
        cityId,
        totalDrivers: stats.totalDrivers,
        onlineDrivers: stats.onlineDrivers,
        activeOrders: 0, // Would need to query from orders table
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error('[Fleet] Error sending initial stats:', error);
  }
}
