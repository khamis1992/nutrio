/**
 * WebSocket Event Types
 * Fleet Management Portal - Real-time Tracking
 */

// ==================== USER TYPES ====================

export type UserType = 'driver' | 'fleet';
export type UserRole = 'driver' | 'fleet_manager' | 'super_admin';
export type DriverStatus = 'online' | 'offline' | 'busy';
export type StatusReason = 'user_action' | 'app_background' | 'timeout' | 'order_complete';

// ==================== SOCKET DATA ====================

export interface SocketUserData {
  type: UserType;
  userId: string;
  role: UserRole;
  driverId?: string;
  managerId?: string;
  assignedCities: string[];
  cityId?: string;
}

// ==================== LOCATION EVENTS ====================

export interface LocationUpdatePayload {
  latitude: number;
  longitude: number;
  accuracy: number;
  speed?: number;
  heading?: number;
  batteryLevel?: number;
  timestamp: string;
}

export interface DriverLocationBroadcast {
  driverId: string;
  driverName: string;
  cityId: string;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  isOnline: boolean;
  currentOrderId?: string;
  timestamp: string;
}

// ==================== STATUS EVENTS ====================

export interface StatusUpdatePayload {
  isOnline: boolean;
  reason?: StatusReason;
}

export interface DriverStatusBroadcast {
  driverId: string;
  driverName: string;
  previousStatus: string;
  currentStatus: string;
  cityId: string;
  timestamp: string;
}

// ==================== ORDER EVENTS ====================

export interface LocationInfo {
  latitude: number;
  longitude: number;
  address: string;
}

export interface OrderAssignedPayload {
  orderId: string;
  pickupLocation: LocationInfo;
  deliveryLocation: LocationInfo;
  estimatedEarnings: number;
  expiresAt: string;
}

// ==================== CONNECTION EVENTS ====================

export interface ConnectionAckPayload {
  driverId: string;
  connectedAt: string;
  updateInterval: number;
}

// ==================== FLEET EVENTS ====================

export interface SubscribeCityPayload {
  cityId: string;
}

export interface CitySubscribedPayload {
  cityId: string;
  driverCount: number;
}

export interface RequestLocationHistoryPayload {
  driverId: string;
  startTime: string;
  endTime: string;
}

export interface LocationHistoryItem {
  latitude: number;
  longitude: number;
  speed: number;
  recordedAt: string;
}

export interface LocationHistoryResponse {
  driverId: string;
  locations: LocationHistoryItem[];
}

export interface FleetStatsPayload {
  cityId: string;
  totalDrivers: number;
  onlineDrivers: number;
  activeOrders: number;
  timestamp: string;
}

// ==================== ERROR EVENTS ====================

export interface ErrorPayload {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// ==================== REDIS CACHE STRUCTURES ====================

export interface DriverLocationCache {
  latitude: string;
  longitude: string;
  accuracy: string;
  speed: string;
  heading: string;
  batteryLevel: string;
  timestamp: string;
}

export interface DriverStatusCache {
  isOnline: string;
  socketId: string;
  connectedAt: string;
  status?: string;
  disconnectedAt?: string;
}

// ==================== SOCKET EVENT NAMES ====================

export const SocketEvents = {
  // Client → Server
  LOCATION_UPDATE: 'location:update',
  STATUS_UPDATE: 'driver:status',
  SUBSCRIBE_CITY: 'fleet:subscribe_city',
  REQUEST_HISTORY: 'fleet:request_history',
  
  // Server → Client
  CONNECTION_ACK: 'connection:ack',
  ORDER_ASSIGNED: 'order:assigned',
  DRIVER_LOCATION: 'fleet:driver_location',
  DRIVER_STATUS: 'fleet:driver_status',
  STATS_UPDATE: 'fleet:stats_update',
  CITY_SUBSCRIBED: 'fleet:subscribed',
  LOCATION_HISTORY: 'fleet:location_history',
  ERROR: 'error',
  
  // Built-in
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  CONNECT_ERROR: 'connect_error',
} as const;

// ==================== ROOM NAMES ====================

export const RoomNames = {
  fleetAll: () => 'fleet:all' as const,
  fleetCity: (cityId: string) => `fleet:${cityId}` as const,
  driver: (driverId: string) => `driver:${driverId}` as const,
};

// ==================== DATABASE TYPES ====================

export interface DriverData {
  id: string;
  full_name: string;
  city_id: string;
  status: string;
  is_online: boolean;
  current_latitude: number | null;
  current_longitude: number | null;
}

export interface PersistLocationData {
  driverId: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  speed?: number;
  heading?: number;
  batteryLevel?: number;
  timestamp: string;
}
