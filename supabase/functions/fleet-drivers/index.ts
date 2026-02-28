// Fleet Management Portal - Driver Management Edge Function
// Handles driver CRUD operations with city-based access control

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { jwtVerify } from 'https://esm.sh/jose@5.2.0';

const JWT_SECRET = new TextEncoder().encode(Deno.env.get('FLEET_JWT_SECRET') || '');

// Rate limiting: 100 requests per minute per manager
// TODO: Implement Redis-based rate limiting for production

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// JWT validation middleware
async function validateToken(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  
  const token = authHeader.substring(7);
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.type !== 'fleet_access') {
      throw new Error('Invalid token type');
    }
    return payload;
  } catch {
    return null;
  }
}

// Check if user has access to a specific city
function hasCityAccess(user: any, cityId: string): boolean {
  if (user.role === 'super_admin') return true;
  return user.assignedCities?.includes(cityId) || false;
}

// Get allowed city IDs for user
function getAllowedCityIds(user: any, requestedCityId?: string | null): string[] {
  if (user.role === 'super_admin') {
    return requestedCityId ? [requestedCityId] : [];
  }
  const allowedCities = user.assignedCities || [];
  if (requestedCityId && !allowedCities.includes(requestedCityId)) {
    throw new Error('Unauthorized city access');
  }
  return requestedCityId ? [requestedCityId] : allowedCities;
}

// GET /fleet/drivers - List drivers with filtering
async function handleListDrivers(req: Request, supabase: any, user: any) {
  try {
    const url = new URL(req.url);
    const cityId = url.searchParams.get('cityId');
    const status = url.searchParams.get('status');
    const zoneId = url.searchParams.get('zoneId');
    const isOnline = url.searchParams.get('isOnline');
    const search = url.searchParams.get('search');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
    
    const allowedCityIds = getAllowedCityIds(user, cityId);
    
    // Build query
    let query = supabase
      .from('drivers')
      .select(`
        *,
        cities(name, name_ar),
        vehicles(id, type, plate_number)
      `, { count: 'exact' });
    
    // Apply city filter
    if (allowedCityIds.length > 0) {
      query = query.in('city_id', allowedCityIds);
    }
    
    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }
    
    if (isOnline !== null) {
      query = query.eq('is_online', isOnline === 'true');
    }
    
    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
    }
    
    if (zoneId) {
      // Filter drivers assigned to specific zone
      const { data: driverIds } = await supabase
        .from('driver_zones')
        .select('driver_id')
        .eq('zone_id', zoneId);
      
      if (driverIds && driverIds.length > 0) {
        query = query.in('id', driverIds.map((d: any) => d.driver_id));
      }
    }
    
    // Apply pagination
    const from = (page - 1) * limit;
    query = query.range(from, from + limit - 1).order('created_at', { ascending: false });
    
    const { data, error, count } = await query;
    
    if (error) {
      console.error('List drivers error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch drivers' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Transform response
    const drivers = data.map((driver: any) => ({
      id: driver.id,
      email: driver.email,
      phone: driver.phone,
      fullName: driver.full_name,
      cityId: driver.city_id,
      cityName: driver.cities?.name,
      status: driver.status,
      isOnline: driver.is_online,
      currentLatitude: driver.current_latitude,
      currentLongitude: driver.current_longitude,
      locationUpdatedAt: driver.location_updated_at,
      totalDeliveries: driver.total_deliveries,
      rating: driver.rating,
      currentBalance: driver.current_balance,
      totalEarnings: driver.total_earnings,
      assignedVehicleId: driver.assigned_vehicle_id,
      vehicle: driver.vehicles ? {
        id: driver.vehicles.id,
        type: driver.vehicles.type,
        plateNumber: driver.vehicles.plate_number,
      } : null,
      createdAt: driver.created_at,
    }));
    
    const totalPages = Math.ceil((count || 0) / limit);
    
    return new Response(
      JSON.stringify({
        data: drivers,
        pagination: {
          page,
          limit,
          total: count,
          totalPages,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('List drivers error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    const status = message.includes('Unauthorized') ? 403 : 500;
    return new Response(
      JSON.stringify({ error: message }),
      { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

// POST /fleet/drivers - Create driver
async function handleCreateDriver(req: Request, supabase: any, user: any) {
  try {
    const body = await req.json();
    const { email, phone, fullName, cityId, zoneIds = [] } = body;
    
    // Validate required fields
    if (!email || !phone || !fullName || !cityId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, phone, fullName, cityId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Check city access
    if (!hasCityAccess(user, cityId)) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized city access' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Create auth user first
    const tempPassword = Math.random().toString(36).slice(-10);
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
    });
    
    if (authError) {
      console.error('Auth creation error:', authError);
      return new Response(
        JSON.stringify({ error: 'Failed to create auth user: ' + authError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Create driver record
    const { data: driver, error: driverError } = await supabase
      .from('drivers')
      .insert({
        auth_user_id: authData.user.id,
        email,
        phone,
        full_name: fullName,
        city_id: cityId,
        status: 'pending_verification',
      })
      .select()
      .single();
    
    if (driverError) {
      // Rollback auth user creation
      await supabase.auth.admin.deleteUser(authData.user.id);
      console.error('Driver creation error:', driverError);
      return new Response(
        JSON.stringify({ error: 'Failed to create driver' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Assign zones if provided
    if (zoneIds.length > 0) {
      const zoneAssignments = zoneIds.map((zoneId: string, index: number) => ({
        driver_id: driver.id,
        zone_id: zoneId,
        priority: index + 1,
        is_primary: index === 0,
      }));
      
      await supabase.from('driver_zones').insert(zoneAssignments);
    }
    
    // Log activity
    await supabase.from('fleet_activity_logs').insert({
      manager_id: user.managerId,
      city_id: cityId,
      action: 'create_driver',
      entity_type: 'driver',
      entity_id: driver.id,
      new_values: { email, phone, fullName, cityId },
      ip_address: req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown',
      user_agent: req.headers.get('user-agent') || 'unknown',
    });
    
    return new Response(
      JSON.stringify({
        id: driver.id,
        email: driver.email,
        phone: driver.phone,
        fullName: driver.full_name,
        cityId: driver.city_id,
        status: driver.status,
        createdAt: driver.created_at,
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Create driver error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

// GET /fleet/drivers/:id - Get driver details
async function handleGetDriver(req: Request, supabase: any, user: any, driverId: string) {
  try {
    const { data: driver, error } = await supabase
      .from('drivers')
      .select(`
        *,
        cities(name, name_ar),
        vehicles(*),
        driver_documents(*),
        driver_zones(zone_id, priority, is_primary, zones(name, name_ar))
      `)
      .eq('id', driverId)
      .single();
    
    if (error || !driver) {
      return new Response(
        JSON.stringify({ error: 'Driver not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Check city access
    if (!hasCityAccess(user, driver.city_id)) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized city access' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Get recent activity logs
    const { data: activityLogs } = await supabase
      .from('driver_activity_logs')
      .select('*')
      .eq('driver_id', driverId)
      .order('created_at', { ascending: false })
      .limit(10);
    
    // Get earnings summary
    const { data: payouts } = await supabase
      .from('driver_payouts')
      .select('total_amount, status')
      .eq('driver_id', driverId);
    
    const totalEarnings = payouts?.reduce((sum, p) => sum + (p.total_amount || 0), 0) || 0;
    const pendingPayout = payouts
      ?.filter(p => p.status === 'pending')
      .reduce((sum, p) => sum + (p.total_amount || 0), 0) || 0;
    
    return new Response(
      JSON.stringify({
        id: driver.id,
        email: driver.email,
        phone: driver.phone,
        fullName: driver.full_name,
        cityId: driver.city_id,
        cityName: driver.cities?.name,
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
        vehicle: driver.vehicles,
        documents: driver.driver_documents || [],
        zones: driver.driver_zones || [],
        recentActivity: activityLogs || [],
        earnings: {
          total: totalEarnings,
          pendingPayout,
        },
        createdAt: driver.created_at,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Get driver error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

// PUT /fleet/drivers/:id - Update driver
async function handleUpdateDriver(req: Request, supabase: any, user: any, driverId: string) {
  try {
    // Check driver exists and manager has access
    const { data: existingDriver, error: checkError } = await supabase
      .from('drivers')
      .select('city_id, full_name, phone')
      .eq('id', driverId)
      .single();
    
    if (checkError || !existingDriver) {
      return new Response(
        JSON.stringify({ error: 'Driver not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!hasCityAccess(user, existingDriver.city_id)) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized city access' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const body = await req.json();
    const { fullName, phone, cityId, zoneIds, assignedVehicleId } = body;
    
    // If changing city, check access
    if (cityId && cityId !== existingDriver.city_id && !hasCityAccess(user, cityId)) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized city access for new city' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Build update object
    const updates: any = {};
    if (fullName !== undefined) updates.full_name = fullName;
    if (phone !== undefined) updates.phone = phone;
    if (cityId !== undefined) updates.city_id = cityId;
    if (assignedVehicleId !== undefined) updates.assigned_vehicle_id = assignedVehicleId;
    
    const { data: driver, error } = await supabase
      .from('drivers')
      .update(updates)
      .eq('id', driverId)
      .select()
      .single();
    
    if (error) {
      console.error('Update driver error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to update driver' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Update zones if provided
    if (zoneIds !== undefined) {
      // Remove existing zone assignments
      await supabase.from('driver_zones').delete().eq('driver_id', driverId);
      
      // Add new zone assignments
      if (zoneIds.length > 0) {
        const zoneAssignments = zoneIds.map((zoneId: string, index: number) => ({
          driver_id: driverId,
          zone_id: zoneId,
          priority: index + 1,
          is_primary: index === 0,
        }));
        
        await supabase.from('driver_zones').insert(zoneAssignments);
      }
    }
    
    // Log activity
    await supabase.from('fleet_activity_logs').insert({
      manager_id: user.managerId,
      city_id: driver.city_id,
      action: 'update_driver',
      entity_type: 'driver',
      entity_id: driverId,
      old_values: { fullName: existingDriver.full_name, phone: existingDriver.phone },
      new_values: updates,
      ip_address: req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown',
      user_agent: req.headers.get('user-agent') || 'unknown',
    });
    
    return new Response(
      JSON.stringify({
        id: driver.id,
        email: driver.email,
        phone: driver.phone,
        fullName: driver.full_name,
        cityId: driver.city_id,
        status: driver.status,
        assignedVehicleId: driver.assigned_vehicle_id,
        updatedAt: driver.updated_at,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Update driver error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

// PATCH /fleet/drivers/:id/status - Update driver status
async function handleUpdateStatus(req: Request, supabase: any, user: any, driverId: string) {
  try {
    const body = await req.json();
    const { status, reason } = body;
    
    if (!status) {
      return new Response(
        JSON.stringify({ error: 'Status is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const validStatuses = ['pending_verification', 'active', 'suspended', 'inactive'];
    if (!validStatuses.includes(status)) {
      return new Response(
        JSON.stringify({ error: 'Invalid status' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Check driver exists and manager has access
    const { data: existingDriver, error: checkError } = await supabase
      .from('drivers')
      .select('city_id, status')
      .eq('id', driverId)
      .single();
    
    if (checkError || !existingDriver) {
      return new Response(
        JSON.stringify({ error: 'Driver not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!hasCityAccess(user, existingDriver.city_id)) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized city access' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const { data: driver, error } = await supabase
      .from('drivers')
      .update({ status })
      .eq('id', driverId)
      .select()
      .single();
    
    if (error) {
      console.error('Update status error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to update status' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Log activity
    await supabase.from('driver_activity_logs').insert({
      driver_id: driverId,
      activity_type: 'status_change',
      details: { previousStatus: existingDriver.status, newStatus: status, reason },
      created_at: new Date().toISOString(),
    });
    
    await supabase.from('fleet_activity_logs').insert({
      manager_id: user.managerId,
      city_id: driver.city_id,
      action: 'update_driver_status',
      entity_type: 'driver',
      entity_id: driverId,
      old_values: { status: existingDriver.status },
      new_values: { status, reason },
      ip_address: req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown',
      user_agent: req.headers.get('user-agent') || 'unknown',
    });
    
    return new Response(
      JSON.stringify({
        id: driver.id,
        status: driver.status,
        updatedAt: driver.updated_at,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Update status error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

// GET /fleet/drivers/:id/location - Get driver location
async function handleGetLocation(req: Request, supabase: any, user: any, driverId: string) {
  try {
    const { data: driver, error } = await supabase
      .from('drivers')
      .select('city_id, current_latitude, current_longitude, location_updated_at, is_online')
      .eq('id', driverId)
      .single();
    
    if (error || !driver) {
      return new Response(
        JSON.stringify({ error: 'Driver not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!hasCityAccess(user, driver.city_id)) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized city access' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(
      JSON.stringify({
        latitude: driver.current_latitude,
        longitude: driver.current_longitude,
        lastUpdated: driver.location_updated_at,
        isOnline: driver.is_online,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Get location error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

// GET /fleet/drivers/:id/performance - Get driver performance metrics
async function handleGetPerformance(req: Request, supabase: any, user: any, driverId: string) {
  try {
    const url = new URL(req.url);
    const period = url.searchParams.get('period') || '30d';
    
    // Parse period
    const days = parseInt(period.replace('d', '')) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const { data: driver, error } = await supabase
      .from('drivers')
      .select('city_id, total_deliveries, rating, cancellation_rate, total_earnings')
      .eq('id', driverId)
      .single();
    
    if (error || !driver) {
      return new Response(
        JSON.stringify({ error: 'Driver not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!hasCityAccess(user, driver.city_id)) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized city access' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Get orders in period
    const { data: orders } = await supabase
      .from('orders')
      .select('status, delivered_at, created_at, delivery_time_minutes, rating')
      .eq('driver_id', driverId)
      .gte('created_at', startDate.toISOString());
    
    const completedDeliveries = orders?.filter(o => o.status === 'delivered').length || 0;
    const cancelledDeliveries = orders?.filter(o => o.status === 'cancelled').length || 0;
    
    // Calculate average delivery time
    const deliveryTimes = orders
      ?.filter(o => o.delivery_time_minutes)
      .map(o => o.delivery_time_minutes) || [];
    
    const averageDeliveryTime = deliveryTimes.length > 0
      ? Math.round(deliveryTimes.reduce((a, b) => a + b, 0) / deliveryTimes.length)
      : 0;
    
    // Calculate on-time rate (deliveries within 45 minutes)
    const onTimeDeliveries = orders?.filter(o => 
      o.status === 'delivered' && o.delivery_time_minutes && o.delivery_time_minutes <= 45
    ).length || 0;
    
    const onTimeRate = completedDeliveries > 0
      ? Math.round((onTimeDeliveries / completedDeliveries) * 100)
      : 100;
    
    // Get earnings for period
    const { data: payouts } = await supabase
      .from('driver_payouts')
      .select('total_amount')
      .eq('driver_id', driverId)
      .gte('period_start', startDate.toISOString().split('T')[0]);
    
    const periodEarnings = payouts?.reduce((sum, p) => sum + (p.total_amount || 0), 0) || 0;
    
    return new Response(
      JSON.stringify({
        period,
        totalDeliveries: orders?.length || 0,
        completedDeliveries,
        cancelledDeliveries,
        averageRating: driver.rating,
        averageDeliveryTime,
        onTimeRate,
        cancellationRate: driver.cancellation_rate,
        earnings: periodEarnings,
        totalEarnings: driver.total_earnings,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Get performance error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

// POST /fleet/drivers/:id/documents - Upload document
async function handleUploadDocument(req: Request, supabase: any, user: any, driverId: string) {
  try {
    const body = await req.json();
    const { documentType, documentUrl, expiryDate } = body;
    
    if (!documentType || !documentUrl) {
      return new Response(
        JSON.stringify({ error: 'documentType and documentUrl are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const validTypes = ['id_card', 'driving_license', 'vehicle_registration', 'insurance', 'background_check', 'contract'];
    if (!validTypes.includes(documentType)) {
      return new Response(
        JSON.stringify({ error: 'Invalid document type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Check driver exists and manager has access
    const { data: driver, error: checkError } = await supabase
      .from('drivers')
      .select('city_id, id')
      .eq('id', driverId)
      .single();
    
    if (checkError || !driver) {
      return new Response(
        JSON.stringify({ error: 'Driver not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!hasCityAccess(user, driver.city_id)) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized city access' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const { data: document, error } = await supabase
      .from('driver_documents')
      .insert({
        driver_id: driverId,
        document_type: documentType,
        document_url: documentUrl,
        expiry_date: expiryDate || null,
        verification_status: 'pending',
      })
      .select()
      .single();
    
    if (error) {
      console.error('Upload document error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to upload document' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Log activity
    await supabase.from('driver_activity_logs').insert({
      driver_id: driverId,
      activity_type: 'document_uploaded',
      details: { documentType, documentId: document.id },
    });
    
    return new Response(
      JSON.stringify({
        id: document.id,
        documentType: document.document_type,
        documentUrl: document.document_url,
        verificationStatus: document.verification_status,
        expiryDate: document.expiry_date,
        uploadedAt: document.uploaded_at,
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Upload document error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
  
  // Validate JWT
  const user = await validateToken(req);
  if (!user) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  
  const url = new URL(req.url);
  const pathParts = url.pathname.replace('/fleet-drivers', '').replace('/fleet/drivers', '').split('/').filter(Boolean);
  
  // Route handling
  if (pathParts.length === 0) {
    // /fleet/drivers
    if (req.method === 'GET') {
      return await handleListDrivers(req, supabase, user);
    }
    if (req.method === 'POST') {
      return await handleCreateDriver(req, supabase, user);
    }
  } else if (pathParts.length === 1) {
    // /fleet/drivers/:id
    const driverId = pathParts[0];
    if (req.method === 'GET') {
      return await handleGetDriver(req, supabase, user, driverId);
    }
    if (req.method === 'PUT') {
      return await handleUpdateDriver(req, supabase, user, driverId);
    }
  } else if (pathParts.length === 2) {
    const driverId = pathParts[0];
    const action = pathParts[1];
    
    if (action === 'status' && req.method === 'PATCH') {
      return await handleUpdateStatus(req, supabase, user, driverId);
    }
    
    if (action === 'location' && req.method === 'GET') {
      return await handleGetLocation(req, supabase, user, driverId);
    }
    
    if (action === 'performance' && req.method === 'GET') {
      return await handleGetPerformance(req, supabase, user, driverId);
    }
    
    if (action === 'documents' && req.method === 'POST') {
      return await handleUploadDocument(req, supabase, user, driverId);
    }
  }
  
  return new Response(
    JSON.stringify({ error: 'Not found' }),
    { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
