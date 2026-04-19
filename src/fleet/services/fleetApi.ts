import { supabase } from '@/integrations/supabase/client';
import type { 
  FleetLoginRequest, 
  FleetLoginResponse,
  Driver,
  Vehicle,
  DriverPayout,
  City,
  Zone,
  CreateDriverRequest,
  UpdateDriverRequest,
  CreateVehicleRequest,
  CreatePayoutRequest,
  ProcessPayoutRequest,
  BulkPayoutRequest,
  DriverFilters,
  VehicleFilters,
  PayoutFilters,
  PaginatedResponse,
  DashboardStats,
  DriverLocation,
  DriverLocationHistory,
  DriverPerformance,
  DriverDocument,
  FleetActivityLog,
  PayoutSummary
} from '@/fleet/types/fleet';

const API_BASE_URL = import.meta.env.VITE_FLEET_API_URL || '/api/fleet';

// ==========================================
// AUTHENTICATION
// ==========================================

export async function loginFleetManager(credentials: FleetLoginRequest): Promise<FleetLoginResponse> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: credentials.email,
    password: credentials.password,
  });

  if (error) throw error;
  if (!data.user) throw new Error('Login failed');

  // Check if user is a fleet manager
  const { data: managerData, error: managerError } = await supabase
    .from('fleet_managers')
    .select('*')
    .eq('auth_user_id', data.user.id)
    .eq('is_active', true)
    .single();

  if (managerError || !managerData) {
    await supabase.auth.signOut();
    throw new Error('Access denied: Not a fleet manager');
  }

  // Get session for token
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  const refreshToken = sessionData.session?.refresh_token;

  if (!token) throw new Error('Failed to get access token');

  return {
    token,
    refreshToken: refreshToken || '',
    user: {
      id: managerData.id,
      email: managerData.email,
      fullName: managerData.full_name,
      role: managerData.role,
      assignedCities: managerData.assigned_city_ids || [],
    },
  };
}

export async function logoutFleetManager(): Promise<void> {
  await supabase.auth.signOut();
}

export async function refreshFleetToken(refreshToken: string): Promise<{ token: string; refreshToken: string }> {
  const { data, error } = await supabase.auth.refreshSession({
    refresh_token: refreshToken,
  });

  if (error) throw error;
  if (!data.session) throw new Error('Failed to refresh token');

  return {
    token: data.session.access_token,
    refreshToken: data.session.refresh_token || '',
  };
}

// ==========================================
// DASHBOARD
// ==========================================

export async function getDashboardStats(cityId?: string): Promise<DashboardStats> {
  let query = supabase
    .from('drivers')
    .select('*', { count: 'exact' });

  if (cityId) {
    query = query.eq('city_id', cityId);
  }

  const { data: drivers, error, count } = await query;

  if (error) throw error;

  const activeDrivers = drivers?.filter(d => d.status === 'active').length || 0;
  const onlineDrivers = drivers?.filter(d => d.is_online).length || 0;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  const ordersQuery = supabase
    .from('orders')
    .select('status, delivered_at, created_at, delivery_time_minutes', { count: 'exact' })
    .gte('created_at', todayStart);

  if (cityId) {
    const { data: cityDrivers } = await supabase
      .from('drivers')
      .select('id')
      .eq('city_id', cityId);
    const driverIds = cityDrivers?.map(d => d.id) || [];
    if (driverIds.length > 0) {
      ordersQuery.in('driver_id', driverIds);
    }
  }

  const { data: orders, count: ordersCount } = await ordersQuery;

  const ordersInProgress = orders?.filter(o =>
    ['confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery'].includes(o.status)
  ).length || 0;

  const todayDeliveries = orders?.filter(o =>
    o.status === 'delivered'
  ).length || 0;

  const deliveryTimes = orders
    ?.filter((o: any) => o.delivery_time_minutes)
    .map((o: any) => o.delivery_time_minutes as number) || [];
  const averageDeliveryTime = deliveryTimes.length > 0
    ? Math.round(deliveryTimes.reduce((a: number, b: number) => a + b, 0) / deliveryTimes.length)
    : 0;

  return {
    totalDrivers: count || 0,
    activeDrivers,
    onlineDrivers,
    ordersInProgress,
    todayDeliveries,
    averageDeliveryTime,
  };
}

// ==========================================
// CITIES
// ==========================================

export async function getCities(): Promise<City[]> {
  const { data, error } = await supabase
    .from('cities')
    .select('*')
    .eq('is_active', true)
    .order('name');

  if (error) throw error;

  return (data || []).map(city => ({
    id: city.id,
    name: city.name,
    nameAr: city.name_ar,
    country: city.country,
    latitude: city.latitude,
    longitude: city.longitude,
    timezone: city.timezone,
    isActive: city.is_active,
    createdAt: city.created_at,
    updatedAt: city.updated_at,
  }));
}

export async function getCityZones(cityId: string): Promise<Zone[]> {
  const { data, error } = await supabase
    .from('zones')
    .select('*')
    .eq('city_id', cityId)
    .eq('is_active', true)
    .order('name');

  if (error) throw error;

  return (data || []).map(zone => ({
    id: zone.id,
    cityId: zone.city_id,
    name: zone.name,
    nameAr: zone.name_ar,
    polygon: zone.polygon,
    isActive: zone.is_active,
    createdAt: zone.created_at,
    updatedAt: zone.updated_at,
  }));
}

// ==========================================
// DRIVERS
// ==========================================

export async function getDrivers(
  filters: DriverFilters & { page?: number; limit?: number }
): Promise<PaginatedResponse<Driver>> {
  const { cityId, status, zoneId, isOnline, search, page = 1, limit = 20 } = filters;

  let query = supabase
    .from('drivers')
    .select('*', { count: 'exact' });

  if (cityId) {
    query = query.eq('city_id', cityId);
  }

  if (status) {
    query = query.eq('status', status);
  }

  if (isOnline !== undefined) {
    query = query.eq('is_online', isOnline);
  }

  if (search) {
    query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
  }

  // Calculate range for pagination
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  query = query.range(from, to).order('created_at', { ascending: false });

  const { data, error, count } = await query;

  if (error) throw error;

  // Filter by zone if specified
  let filteredData = data || [];
  if (zoneId) {
    filteredData = filteredData.filter(driver => 
      driver.assigned_zone_ids?.includes(zoneId)
    );
  }

  const drivers: Driver[] = filteredData.map(driver => ({
    id: driver.id,
    authUserId: driver.auth_user_id,
    email: driver.email,
    phone: driver.phone,
    fullName: driver.full_name,
    cityId: driver.city_id,
    assignedZoneIds: driver.assigned_zone_ids || [],
    status: driver.status,
    isOnline: driver.is_online,
    currentLatitude: driver.current_latitude,
    currentLongitude: driver.current_longitude,
    locationUpdatedAt: driver.location_updated_at,
    totalDeliveries: driver.total_deliveries,
    rating: driver.rating,
    cancellationRate: driver.cancellation_rate,
    currentBalance: driver.current_balance,
    totalEarnings: driver.total_earnings,
    assignedVehicleId: driver.assigned_vehicle_id,
    profilePhotoUrl: driver.profile_photo_url,
    idDocumentUrl: driver.id_document_url,
    licenseDocumentUrl: driver.license_document_url,
    createdAt: driver.created_at,
    updatedAt: driver.updated_at,
  }));

  return {
    data: drivers,
    pagination: {
      page,
      limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit),
    },
  };
}

export async function getDriverById(driverId: string): Promise<Driver> {
  const { data, error } = await supabase
    .from('drivers')
    .select('*')
    .eq('id', driverId)
    .single();

  if (error) throw error;
  if (!data) throw new Error('Driver not found');

  return {
    id: data.id,
    authUserId: data.auth_user_id,
    email: data.email,
    phone: data.phone,
    fullName: data.full_name,
    cityId: data.city_id,
    assignedZoneIds: data.assigned_zone_ids || [],
    status: data.status,
    isOnline: data.is_online,
    currentLatitude: data.current_latitude,
    currentLongitude: data.current_longitude,
    locationUpdatedAt: data.location_updated_at,
    totalDeliveries: data.total_deliveries,
    rating: data.rating,
    cancellationRate: data.cancellation_rate,
    currentBalance: data.current_balance,
    totalEarnings: data.total_earnings,
    assignedVehicleId: data.assigned_vehicle_id,
    profilePhotoUrl: data.profile_photo_url,
    idDocumentUrl: data.id_document_url,
    licenseDocumentUrl: data.license_document_url,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function createDriver(request: CreateDriverRequest): Promise<Driver> {
  const { data, error } = await supabase
    .from('drivers')
    .insert({
      email: request.email,
      phone: request.phone,
      full_name: request.fullName,
      city_id: request.cityId,
      assigned_zone_ids: request.zoneIds || [],
      status: 'pending_verification',
      is_online: false,
      total_deliveries: 0,
      rating: 5.0,
      cancellation_rate: 0,
      current_balance: 0,
      total_earnings: 0,
    })
    .select()
    .single();

  if (error) throw error;

  return getDriverById(data.id);
}

export async function updateDriver(driverId: string, request: UpdateDriverRequest): Promise<Driver> {
  const updateData: Record<string, unknown> = {};

  if (request.fullName !== undefined) updateData.full_name = request.fullName;
  if (request.phone !== undefined) updateData.phone = request.phone;
  if (request.cityId !== undefined) updateData.city_id = request.cityId;
  if (request.zoneIds !== undefined) updateData.assigned_zone_ids = request.zoneIds;
  if (request.assignedVehicleId !== undefined) updateData.assigned_vehicle_id = request.assignedVehicleId;

  const { error } = await supabase
    .from('drivers')
    .update(updateData)
    .eq('id', driverId);

  if (error) throw error;

  return getDriverById(driverId);
}

export async function updateDriverStatus(
  driverId: string, 
  status: string, 
  reason?: string
): Promise<Driver> {
  const { error } = await supabase
    .from('drivers')
    .update({ status })
    .eq('id', driverId);

  if (error) throw error;

  // Log activity
  await supabase.from('driver_activity_logs').insert({
    driver_id: driverId,
    activity_type: 'status_change',
    details: { newStatus: status, reason },
  });

  return getDriverById(driverId);
}

export async function deleteDriver(driverId: string): Promise<void> {
  const { error } = await supabase
    .from('drivers')
    .delete()
    .eq('id', driverId);

  if (error) throw error;
}

export async function getDriverLocation(driverId: string): Promise<DriverLocation | null> {
  const { data, error } = await supabase
    .from('drivers')
    .select('id, full_name, city_id, current_latitude, current_longitude, is_online, location_updated_at')
    .eq('id', driverId)
    .single();

  if (error || !data) return null;

  if (!data.current_latitude || !data.current_longitude) {
    return null;
  }

  return {
    driverId: data.id,
    driverName: data.full_name,
    cityId: data.city_id,
    latitude: data.current_latitude,
    longitude: data.current_longitude,
    isOnline: data.is_online,
    timestamp: data.location_updated_at,
  };
}

export async function getDriverLocationHistory(
  driverId: string, 
  startTime: string, 
  endTime: string
): Promise<DriverLocationHistory[]> {
  const { data, error } = await supabase
    .from('driver_locations')
    .select('*')
    .eq('driver_id', driverId)
    .gte('recorded_at', startTime)
    .lte('recorded_at', endTime)
    .order('recorded_at', { ascending: true });

  if (error) throw error;

  return (data || []).map(loc => ({
    id: loc.id,
    driverId: loc.driver_id,
    latitude: loc.latitude,
    longitude: loc.longitude,
    accuracy: loc.accuracy,
    speed: loc.speed,
    heading: loc.heading,
    batteryLevel: loc.battery_level,
    recordedAt: loc.recorded_at,
  }));
}

export async function getDriverPerformance(
  driverId: string, 
  period: '7d' | '30d' | '90d' = '30d'
): Promise<DriverPerformance> {
  const days = parseInt(period);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // This is a placeholder - implement with actual delivery data
  const { data: driver } = await supabase
    .from('drivers')
    .select('total_deliveries, rating')
    .eq('id', driverId)
    .single();

  return {
    totalDeliveries: driver?.total_deliveries || 0,
    completedDeliveries: driver?.total_deliveries || 0,
    cancelledDeliveries: 0,
    averageRating: driver?.rating || 5.0,
    averageDeliveryTime: 0,
    onTimeRate: 0,
    earnings: 0,
  };
}

// ==========================================
// DRIVER DOCUMENTS
// ==========================================

export async function getDriverDocuments(driverId: string): Promise<DriverDocument[]> {
  const { data, error } = await supabase
    .from('driver_documents')
    .select('*')
    .eq('driver_id', driverId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).map(doc => ({
    id: doc.id,
    driverId: doc.driver_id,
    documentType: doc.document_type,
    documentUrl: doc.document_url,
    verificationStatus: doc.verification_status,
    rejectionReason: doc.rejection_reason,
    expiryDate: doc.expiry_date,
    verifiedBy: doc.verified_by,
    verifiedAt: doc.verified_at,
    uploadedAt: doc.uploaded_at,
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
  }));
}

export async function uploadDriverDocument(
  driverId: string,
  documentType: string,
  file: File,
  expiryDate?: string
): Promise<DriverDocument> {
  // Upload file to storage
  const fileExt = file.name.split('.').pop();
  const fileName = `${driverId}/${documentType}_${Date.now()}.${fileExt}`;
  const filePath = `driver-documents/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('fleet-documents')
    .upload(filePath, file);

  if (uploadError) throw uploadError;

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('fleet-documents')
    .getPublicUrl(filePath);

  // Create document record
  const { data, error } = await supabase
    .from('driver_documents')
    .insert({
      driver_id: driverId,
      document_type: documentType,
      document_url: publicUrl,
      verification_status: 'pending',
      expiry_date: expiryDate,
    })
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    driverId: data.driver_id,
    documentType: data.document_type,
    documentUrl: data.document_url,
    verificationStatus: data.verification_status,
    rejectionReason: data.rejection_reason,
    expiryDate: data.expiry_date,
    verifiedBy: data.verified_by,
    verifiedAt: data.verified_at,
    uploadedAt: data.uploaded_at,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

// ==========================================
// VEHICLES
// ==========================================

export async function getVehicles(
  filters: VehicleFilters & { page?: number; limit?: number }
): Promise<PaginatedResponse<Vehicle>> {
  const { cityId, status, type, page = 1, limit = 20 } = filters;

  let query = supabase
    .from('vehicles')
    .select('*', { count: 'exact' });

  if (cityId) {
    query = query.eq('city_id', cityId);
  }

  if (status) {
    query = query.eq('status', status);
  }

  if (type) {
    query = query.eq('type', type);
  }

  const from = (page - 1) * limit;
  const to = from + limit - 1;

  query = query.range(from, to).order('created_at', { ascending: false });

  const { data, error, count } = await query;

  if (error) throw error;

  const vehicles: Vehicle[] = (data || []).map(vehicle => ({
    id: vehicle.id,
    cityId: vehicle.city_id,
    type: vehicle.type,
    make: vehicle.make,
    model: vehicle.model,
    year: vehicle.year,
    color: vehicle.color,
    plateNumber: vehicle.plate_number,
    registrationNumber: vehicle.registration_number,
    insuranceProvider: vehicle.insurance_provider,
    insuranceExpiry: vehicle.insurance_expiry,
    insuranceDocumentUrl: vehicle.insurance_document_url,
    status: vehicle.status,
    assignedDriverId: vehicle.assigned_driver_id,
    vehiclePhotoUrl: vehicle.vehicle_photo_url,
    registrationDocumentUrl: vehicle.registration_document_url,
    createdAt: vehicle.created_at,
    updatedAt: vehicle.updated_at,
  }));

  return {
    data: vehicles,
    pagination: {
      page,
      limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit),
    },
  };
}

export async function createVehicle(request: CreateVehicleRequest): Promise<Vehicle> {
  const { data, error } = await supabase
    .from('vehicles')
    .insert({
      city_id: request.cityId,
      type: request.type,
      make: request.make,
      model: request.model,
      year: request.year,
      color: request.color,
      plate_number: request.plateNumber,
      insurance_expiry: request.insuranceExpiry,
      status: 'available',
    })
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    cityId: data.city_id,
    type: data.type,
    make: data.make,
    model: data.model,
    year: data.year,
    color: data.color,
    plateNumber: data.plate_number,
    registrationNumber: data.registration_number,
    insuranceProvider: data.insurance_provider,
    insuranceExpiry: data.insurance_expiry,
    insuranceDocumentUrl: data.insurance_document_url,
    status: data.status,
    assignedDriverId: data.assigned_driver_id,
    vehiclePhotoUrl: data.vehicle_photo_url,
    registrationDocumentUrl: data.registration_document_url,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

// ==========================================
// PAYOUTS
// ==========================================

export async function getPayouts(
  filters: PayoutFilters & { page?: number; limit?: number }
): Promise<{ data: DriverPayout[]; summary: PayoutSummary }> {
  const { cityId, driverId, status, startDate, endDate, page = 1, limit = 20 } = filters;

  let query = supabase
    .from('driver_payouts')
    .select('*', { count: 'exact' });

  if (cityId) {
    query = query.eq('city_id', cityId);
  }

  if (driverId) {
    query = query.eq('driver_id', driverId);
  }

  if (status) {
    query = query.eq('status', status);
  }

  if (startDate) {
    query = query.gte('period_start', startDate);
  }

  if (endDate) {
    query = query.lte('period_end', endDate);
  }

  const from = (page - 1) * limit;
  const to = from + limit - 1;

  query = query.range(from, to).order('created_at', { ascending: false });

  const { data, error, count } = await query;

  if (error) throw error;

  // Calculate summary
  const summary: PayoutSummary = {
    totalAmount: data?.reduce((sum, p) => sum + p.total_amount, 0) || 0,
    pendingAmount: data?.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.total_amount, 0) || 0,
    paidAmount: data?.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.total_amount, 0) || 0,
    driverCount: new Set(data?.map(p => p.driver_id)).size || 0,
  };

  const payouts: DriverPayout[] = (data || []).map(payout => ({
    id: payout.id,
    driverId: payout.driver_id,
    cityId: payout.city_id,
    periodStart: payout.period_start,
    periodEnd: payout.period_end,
    baseEarnings: payout.base_earnings,
    bonusAmount: payout.bonus_amount,
    penaltyAmount: payout.penalty_amount,
    totalAmount: payout.total_amount,
    status: payout.status,
    paymentMethod: payout.payment_method,
    paymentReference: payout.payment_reference,
    paidAt: payout.paid_at,
    paidBy: payout.paid_by,
    notes: payout.notes,
    processedAt: payout.processed_at,
    processedBy: payout.processed_by,
    idempotencyKey: payout.idempotency_key,
    createdAt: payout.created_at,
    updatedAt: payout.updated_at,
  }));

  return {
    data: payouts,
    summary,
  };
}

export async function createPayout(request: CreatePayoutRequest): Promise<DriverPayout> {
  const { data, error } = await supabase
    .from('driver_payouts')
    .insert({
      driver_id: request.driverId,
      period_start: request.periodStart,
      period_end: request.periodEnd,
      base_earnings: request.baseEarnings,
      bonus_amount: request.bonusAmount || 0,
      penalty_amount: request.penaltyAmount || 0,
      total_amount: request.totalAmount,
      status: 'pending',
      notes: request.notes,
      idempotency_key: request.idempotencyKey || `${request.driverId}_${Date.now()}`,
    })
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    driverId: data.driver_id,
    cityId: data.city_id,
    periodStart: data.period_start,
    periodEnd: data.period_end,
    baseEarnings: data.base_earnings,
    bonusAmount: data.bonus_amount,
    penaltyAmount: data.penalty_amount,
    totalAmount: data.total_amount,
    status: data.status,
    paymentMethod: data.payment_method,
    paymentReference: data.payment_reference,
    paidAt: data.paid_at,
    paidBy: data.paid_by,
    notes: data.notes,
    processedAt: data.processed_at,
    processedBy: data.processed_by,
    idempotencyKey: data.idempotency_key,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function processPayout(
  payoutId: string, 
  request: ProcessPayoutRequest
): Promise<DriverPayout> {
  const { error } = await supabase
    .from('driver_payouts')
    .update({
      status: 'paid',
      payment_method: request.paymentMethod,
      payment_reference: request.paymentReference,
      paid_at: new Date().toISOString(),
      notes: request.notes,
    })
    .eq('id', payoutId);

  if (error) throw error;

  const { data } = await supabase
    .from('driver_payouts')
    .select('*')
    .eq('id', payoutId)
    .single();

  return {
    id: data.id,
    driverId: data.driver_id,
    cityId: data.city_id,
    periodStart: data.period_start,
    periodEnd: data.period_end,
    baseEarnings: data.base_earnings,
    bonusAmount: data.bonus_amount,
    penaltyAmount: data.penalty_amount,
    totalAmount: data.total_amount,
    status: data.status,
    paymentMethod: data.payment_method,
    paymentReference: data.payment_reference,
    paidAt: data.paid_at,
    paidBy: data.paid_by,
    notes: data.notes,
    processedAt: data.processed_at,
    processedBy: data.processed_by,
    idempotencyKey: data.idempotency_key,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

// ==========================================
// TRACKING
// ==========================================

export async function getOnlineDrivers(cityId?: string): Promise<DriverLocation[]> {
  let query = supabase
    .from('drivers')
    .select('id, full_name, city_id, current_latitude, current_longitude, is_online, location_updated_at')
    .eq('is_online', true)
    .not('current_latitude', 'is', null)
    .not('current_longitude', 'is', null);

  if (cityId) {
    query = query.eq('city_id', cityId);
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data || []).map(driver => ({
    driverId: driver.id,
    driverName: driver.full_name,
    cityId: driver.city_id,
    latitude: driver.current_latitude!,
    longitude: driver.current_longitude!,
    isOnline: driver.is_online,
    timestamp: driver.location_updated_at,
  }));
}

// ==========================================
// ACTIVITY LOGS
// ==========================================

export async function getFleetActivityLogs(
  managerId?: string,
  cityId?: string,
  limit = 50
): Promise<FleetActivityLog[]> {
  let query = supabase
    .from('fleet_activity_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (managerId) {
    query = query.eq('manager_id', managerId);
  }

  if (cityId) {
    query = query.eq('city_id', cityId);
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data || []).map(log => ({
    id: log.id,
    managerId: log.manager_id,
    cityId: log.city_id,
    action: log.action,
    entityType: log.entity_type,
    entityId: log.entity_id,
    oldValues: log.old_values,
    newValues: log.new_values,
    ipAddress: log.ip_address,
    userAgent: log.user_agent,
    createdAt: log.created_at,
  }));
}
