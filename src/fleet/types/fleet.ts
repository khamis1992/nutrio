// Fleet Management TypeScript Types
// Based on the Fleet Management Portal Design Document

// ==========================================
// ENUMS
// ==========================================

export type DriverStatus = 
  | 'pending_verification' 
  | 'active' 
  | 'suspended' 
  | 'inactive';

export type VehicleStatus = 
  | 'available' 
  | 'assigned' 
  | 'maintenance' 
  | 'retired';

export type VehicleType = 
  | 'motorcycle' 
  | 'car' 
  | 'bicycle' 
  | 'van';

export type PayoutStatus = 
  | 'pending' 
  | 'processing' 
  | 'paid' 
  | 'failed';

export type DocumentType = 
  | 'id_card' 
  | 'driving_license' 
  | 'vehicle_registration' 
  | 'insurance' 
  | 'background_check' 
  | 'contract';

export type DocumentVerificationStatus = 
  | 'pending' 
  | 'approved' 
  | 'rejected' 
  | 'expired';

export type FleetManagerRole = 
  | 'super_admin' 
  | 'fleet_manager';

export type DriverActivityType = 
  | 'login' 
  | 'logout' 
  | 'status_change' 
  | 'order_assigned' 
  | 'order_accepted' 
  | 'order_completed' 
  | 'location_update'
  | 'document_uploaded' 
  | 'verification_status_change';

// ==========================================
// BASE ENTITIES
// ==========================================

export interface City {
  id: string;
  name: string;
  nameAr?: string;
  country: string;
  latitude: number;
  longitude: number;
  timezone: string;
  isActive: boolean;
  driverCount?: number;
  activeDriverCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Zone {
  id: string;
  cityId: string;
  name: string;
  nameAr?: string;
  polygon?: GeoJSON.Polygon;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// DRIVER ENTITIES
// ==========================================

export interface Driver {
  id: string;
  authUserId?: string;
  email: string;
  phone: string;
  fullName: string;
  cityId: string;
  cityName?: string;
  assignedZoneIds: string[];
  
  // Status
  status: DriverStatus;
  isOnline: boolean;
  
  // Location tracking
  currentLatitude?: number;
  currentLongitude?: number;
  locationUpdatedAt?: string;
  
  // Performance metrics
  totalDeliveries: number;
  rating: number;
  cancellationRate: number;
  
  // Financial
  currentBalance: number;
  totalEarnings: number;
  
  // Vehicle assignment
  assignedVehicleId?: string;
  
  // Documents
  profilePhotoUrl?: string;
  idDocumentUrl?: string;
  licenseDocumentUrl?: string;
  
  createdAt: string;
  updatedAt: string;
}

export interface DriverLocation {
  driverId: string;
  driverName: string;
  cityId: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  batteryLevel?: number;
  isOnline: boolean;
  currentOrderId?: string;
  timestamp: string;
}

export interface DriverLocationHistory {
  id: string;
  driverId: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  batteryLevel?: number;
  recordedAt: string;
}

export interface DriverActivityLog {
  id: string;
  driverId: string;
  activityType: DriverActivityType;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

export interface DriverPerformance {
  totalDeliveries: number;
  completedDeliveries: number;
  cancelledDeliveries: number;
  averageRating: number;
  averageDeliveryTime: number;
  onTimeRate: number;
  earnings: number;
}

// ==========================================
// VEHICLE ENTITIES
// ==========================================

export interface Vehicle {
  id: string;
  cityId: string;
  
  // Vehicle details
  type: VehicleType;
  make?: string;
  model?: string;
  year?: number;
  color?: string;
  
  // Registration
  plateNumber: string;
  registrationNumber?: string;
  
  // Insurance
  insuranceProvider?: string;
  insuranceExpiry?: string;
  insuranceDocumentUrl?: string;
  daysUntilInsuranceExpiry?: number;
  
  // Status
  status: VehicleStatus;
  assignedDriverId?: string;
  assignedDriverName?: string;
  
  // Documents
  vehiclePhotoUrl?: string;
  registrationDocumentUrl?: string;
  
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// DOCUMENT ENTITIES
// ==========================================

export interface DriverDocument {
  id: string;
  driverId: string;
  documentType: DocumentType;
  documentUrl: string;
  verificationStatus: DocumentVerificationStatus;
  rejectionReason?: string;
  expiryDate?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  uploadedAt: string;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// PAYOUT ENTITIES
// ==========================================

export interface DriverPayout {
  id: string;
  driverId: string;
  driverName?: string;
  cityId: string;
  
  // Payout period
  periodStart: string;
  periodEnd: string;
  
  // Amounts
  baseEarnings: number;
  bonusAmount: number;
  penaltyAmount: number;
  totalAmount: number;
  
  // Status
  status: PayoutStatus;
  
  // Payment details
  paymentMethod?: string;
  paymentReference?: string;
  paidAt?: string;
  paidBy?: string;
  
  // Metadata
  notes?: string;
  processedAt?: string;
  processedBy?: string;
  idempotencyKey?: string;
  
  createdAt: string;
  updatedAt: string;
}

export interface PayoutSummary {
  totalAmount: number;
  pendingAmount: number;
  paidAmount: number;
  driverCount: number;
}

// ==========================================
// FLEET MANAGER ENTITIES
// ==========================================

export interface FleetManager {
  id: string;
  authUserId: string;
  email: string;
  fullName: string;
  phone?: string;
  role: FleetManagerRole;
  assignedCityIds: string[];
  country?: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FleetActivityLog {
  id: string;
  managerId: string;
  cityId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

// ==========================================
// DASHBOARD & ANALYTICS
// ==========================================

export interface DashboardStats {
  totalDrivers: number;
  activeDrivers: number;
  onlineDrivers: number;
  ordersInProgress: number;
  todayDeliveries: number;
  averageDeliveryTime: number;
}

export interface DriverStatusCounts {
  pending_verification: number;
  active: number;
  suspended: number;
  inactive: number;
}

export interface CityFilter {
  id: string;
  name: string;
  nameAr?: string;
  driverCount: number;
  activeDriverCount: number;
}

// ==========================================
// REQUEST/RESPONSE TYPES
// ==========================================

export interface CreateDriverRequest {
  email: string;
  phone: string;
  fullName: string;
  cityId: string;
  zoneIds?: string[];
}

export interface UpdateDriverRequest {
  fullName?: string;
  phone?: string;
  cityId?: string;
  zoneIds?: string[];
  assignedVehicleId?: string;
}

export interface UpdateDriverStatusRequest {
  status: DriverStatus;
  reason?: string;
}

export interface CreateVehicleRequest {
  cityId: string;
  type: VehicleType;
  make?: string;
  model?: string;
  year?: number;
  color?: string;
  plateNumber: string;
  insuranceExpiry?: string;
}

export interface CreatePayoutRequest {
  driverId: string;
  periodStart: string;
  periodEnd: string;
  baseEarnings: number;
  bonusAmount?: number;
  penaltyAmount?: number;
  totalAmount: number;
  notes?: string;
  idempotencyKey?: string;
}

export interface ProcessPayoutRequest {
  paymentMethod?: string;
  paymentReference?: string;
  notes?: string;
}

export interface BulkPayoutRequest {
  cityId: string;
  periodStart: string;
  periodEnd: string;
  driverIds?: string[];
}

// ==========================================
// FILTER & PAGINATION TYPES
// ==========================================

export interface DriverFilters {
  cityId?: string;
  status?: DriverStatus;
  zoneId?: string;
  isOnline?: boolean;
  search?: string;
}

export interface VehicleFilters {
  cityId?: string;
  status?: VehicleStatus;
  type?: VehicleType;
}

export interface PayoutFilters {
  cityId?: string;
  driverId?: string;
  status?: PayoutStatus;
  startDate?: string;
  endDate?: string;
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ==========================================
// WEBSOCKET TYPES
// ==========================================

export interface WebSocketDriverLocationEvent {
  event: 'fleet:driver_location';
  data: DriverLocation;
}

export interface WebSocketDriverStatusEvent {
  event: 'fleet:driver_status';
  data: {
    driverId: string;
    driverName: string;
    previousStatus: string;
    currentStatus: string;
    cityId: string;
    timestamp: string;
  };
}

export interface WebSocketFleetStatsEvent {
  event: 'fleet:stats_update';
  data: {
    cityId: string;
    totalDrivers: number;
    onlineDrivers: number;
    activeOrders: number;
    timestamp: string;
  };
}

export type WebSocketEvent = 
  | WebSocketDriverLocationEvent 
  | WebSocketDriverStatusEvent 
  | WebSocketFleetStatsEvent;

// ==========================================
// AUTH TYPES
// ==========================================

export interface FleetLoginRequest {
  email: string;
  password: string;
}

export interface FleetLoginResponse {
  token: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    role: FleetManagerRole;
    assignedCities: string[];
  };
}

export interface FleetAuthState {
  user: FleetLoginResponse['user'] | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
