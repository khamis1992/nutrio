// Fleet Management Types
// Based on design document section 2.1

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
}

export interface FleetManager {
  id: string;
  authUserId: string;
  email: string;
  fullName: string;
  phone?: string;
  role: 'super_admin' | 'fleet_manager';
  assignedCityIds: string[];
  isActive: boolean;
  lastLoginAt?: string;
}

export interface Driver {
  id: string;
  authUserId?: string;
  email: string;
  phone: string;
  fullName: string;
  cityId: string;
  cityName?: string;
  assignedZoneIds: string[];
  status: 'pending_verification' | 'active' | 'suspended' | 'inactive';
  currentLatitude?: number;
  currentLongitude?: number;
  locationUpdatedAt?: string;
  isOnline: boolean;
  totalDeliveries: number;
  rating: number;
  cancellationRate: number;
  currentBalance: number;
  totalEarnings: number;
  assignedVehicleId?: string;
  vehiclePlate?: string;
  profilePhotoUrl?: string;
  idDocumentUrl?: string;
  licenseDocumentUrl?: string;
  createdAt: string;
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

export interface Vehicle {
  id: string;
  cityId: string;
  type: 'motorcycle' | 'car' | 'bicycle' | 'van';
  make?: string;
  model?: string;
  year?: number;
  color?: string;
  plateNumber: string;
  registrationNumber?: string;
  insuranceProvider?: string;
  insuranceExpiry?: string;
  insuranceDocumentUrl?: string;
  status: 'available' | 'assigned' | 'maintenance' | 'retired';
  assignedDriverId?: string;
  assignedDriverName?: string;
  vehiclePhotoUrl?: string;
  registrationDocumentUrl?: string;
  daysUntilInsuranceExpiry?: number;
}

export interface DriverDocument {
  id: string;
  driverId: string;
  documentType: 'id_card' | 'driving_license' | 'vehicle_registration' | 'insurance' | 'background_check' | 'contract';
  documentUrl: string;
  verificationStatus: 'pending' | 'approved' | 'rejected' | 'expired';
  rejectionReason?: string;
  expiryDate?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  uploadedAt: string;
}

export interface DriverPayout {
  id: string;
  driverId: string;
  driverName?: string;
  cityId: string;
  periodStart: string;
  periodEnd: string;
  baseEarnings: number;
  bonusAmount: number;
  penaltyAmount: number;
  totalAmount: number;
  status: 'pending' | 'processing' | 'paid' | 'failed';
  paymentMethod?: string;
  paymentReference?: string;
  paidAt?: string;
  paidBy?: string;
  notes?: string;
  processedAt?: string;
  processedBy?: string;
}

export interface DriverActivity {
  id: string;
  driverId: string;
  activityType: 'login' | 'logout' | 'status_change' | 'order_assigned' | 'order_accepted' | 'order_completed' | 'location_update' | 'document_uploaded' | 'verification_status_change';
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

export interface FleetDashboardStats {
  totalDrivers: number;
  activeDrivers: number;
  onlineDrivers: number;
  ordersInProgress: number;
  todayDeliveries: number;
  averageDeliveryTime: number;
  cities: City[];
}

export interface DriverPerformance {
  driverId: string;
  totalDeliveries: number;
  completedDeliveries: number;
  cancelledDeliveries: number;
  averageRating: number;
  averageDeliveryTime: number;
  onTimeRate: number;
  earnings: number;
}

export interface PayoutSummary {
  totalAmount: number;
  pendingAmount: number;
  paidAmount: number;
  failedAmount: number;
  driverCount: number;
}

// Filter types
export interface DriverFilters {
  cityId?: string;
  status?: Driver['status'] | 'all';
  zoneId?: string;
  isOnline?: boolean;
  search?: string;
}

export interface VehicleFilters {
  cityId?: string;
  status?: Vehicle['status'] | 'all';
  type?: Vehicle['type'] | 'all';
  search?: string;
}

export interface PayoutFilters {
  cityId?: string;
  driverId?: string;
  status?: DriverPayout['status'] | 'all';
  startDate?: string;
  endDate?: string;
}
