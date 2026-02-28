// Fleet Management Portal - Location Tracking Edge Function
// Handles driver location updates and tracking queries

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { jwtVerify } from 'https://esm.sh/jose@5.2.0';

const JWT_SECRET = new TextEncoder().encode(Deno.env.get('FLEET_JWT_SECRET') || '');
const DRIVER_JWT_SECRET = new TextEncoder().encode(Deno.env.get('SUPABASE_JWT_SECRET') || '');

// Rate limiting:
// - Driver location updates: 1 request per 5 seconds per driver
// - Fleet tracking queries: 100 requests per minute per manager
// TODO: Implement Redis-based rate limiting for production

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// JWT validation middleware - supports both fleet and driver tokens
async function validateToken(req: Request, allowDriver: boolean = false) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  
  const token = authHeader.substring(7);
  
  try {
    // Try fleet token first
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.type === 'fleet_access') {
      return { ...payload, type: 'fleet' };
    }
  } catch {
    // Not a fleet token
  }
  
  if (allowDriver) {
    try {
      // Try driver token (Supabase auth token)
      const { payload } = await jwtVerify(token, DRIVER_JWT_SECRET);
      return { ...payload, type: 'driver' };
    } catch {
      // Not a driver token either
    }
  }
  
  return null;
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

// POST /drivers/location/update - Driver mobile app endpoint
async function handleLocationUpdate(req: Request, supabase: any) {
  try {
    const body = await req.json();
    const {
      driverId,
      latitude,
      longitude,
      accuracy,
      speed,
      heading,
      batteryLevel,
      timestamp,
    } = body;
    
    // Validate required fields
    if (!driverId || latitude === undefined || longitude === undefined) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: driverId, latitude, longitude' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Validate coordinates
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return new Response(
        JSON.stringify({ error: 'Invalid coordinates' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Get driver info
    const { data: driver, error: driverError } = await supabase
      .from('drivers')
      .select('id, city_id, is_online, status')
      .eq('id', driverId)
      .single();
    
    if (driverError || !driver) {
      return new Response(
        JSON.stringify({ error: 'Driver not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Only active and online drivers can update location
    if (driver.status !== 'active') {
      return new Response(
        JSON.stringify({ error: 'Driver is not active' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const now = new Date();
    
    // Update driver current location
    const { error: updateError } = await supabase
      .from('drivers')
      .update({
        current_latitude: latitude,
        current_longitude: longitude,
        location_updated_at: timestamp || now.toISOString(),
        is_online: true,
      })
      .eq('id', driverId);
    
    if (updateError) {
      console.error('Location update error:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update location' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Store location history
    await supabase.from('driver_locations').insert({
      driver_id: driverId,
      latitude,
      longitude,
      accuracy: accuracy || null,
      speed: speed || null,
      heading: heading || null,
      battery_level: batteryLevel || null,
      recorded_at: timestamp || now.toISOString(),
    });
    
    // Determine adaptive update interval based on activity
    // - Moving: 5 seconds
    // - Stationary: 30 seconds
    // - Low battery: 60 seconds
    let nextUpdateInterval = 5;
    
    if (speed !== undefined && speed < 1) {
      nextUpdateInterval = 30; // Stationary
    }
    
    if (batteryLevel !== undefined && batteryLevel < 20) {
      nextUpdateInterval = 60; // Low battery
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        serverTime: now.toISOString(),
        nextUpdateInterval,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Location update error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

// GET /fleet/tracking/drivers - Get online driver locations
async function handleGetTrackingDrivers(req: Request, supabase: any, user: any) {
  try {
    const url = new URL(req.url);
    const cityId = url.searchParams.get('cityId');
    
    const allowedCityIds = getAllowedCityIds(user, cityId);
    
    // Build query for online drivers
    let query = supabase
      .from('drivers')
      .select(`
        id,
        full_name,
        city_id,
        current_latitude,
        current_longitude,
        location_updated_at,
        is_online,
        assigned_vehicle_id,
        vehicles(plate_number, type)
      `)
      .eq('is_online', true)
      .eq('status', 'active')
      .not('current_latitude', 'is', null)
      .not('current_longitude', 'is', null);
    
    // Apply city filter
    if (allowedCityIds.length > 0) {
      query = query.in('city_id', allowedCityIds);
    }
    
    // Only get recent locations (within last 10 minutes)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    query = query.gte('location_updated_at', tenMinutesAgo);
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Get tracking drivers error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch driver locations' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Transform response
    const drivers = data?.map((driver: any) => ({
      driverId: driver.id,
      driverName: driver.full_name,
      cityId: driver.city_id,
      latitude: driver.current_latitude,
      longitude: driver.current_longitude,
      isOnline: driver.is_online,
      lastUpdated: driver.location_updated_at,
      vehicleId: driver.assigned_vehicle_id,
      vehiclePlate: driver.vehicles?.plate_number,
      vehicleType: driver.vehicles?.type,
    })) || [];
    
    return new Response(
      JSON.stringify(drivers),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Get tracking drivers error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    const status = message.includes('Unauthorized') ? 403 : 500;
    return new Response(
      JSON.stringify({ error: message }),
      { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

// GET /fleet/tracking/drivers/:id/history - Get driver location history
async function handleGetLocationHistory(req: Request, supabase: any, user: any, driverId: string) {
  try {
    const url = new URL(req.url);
    const startTime = url.searchParams.get('startTime');
    const endTime = url.searchParams.get('endTime');
    
    // Validate required parameters
    if (!startTime || !endTime) {
      return new Response(
        JSON.stringify({ error: 'startTime and endTime are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Validate time range
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return new Response(
        JSON.stringify({ error: 'Invalid time format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Limit to 24 hours max
    const maxDuration = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    if (end.getTime() - start.getTime() > maxDuration) {
      return new Response(
        JSON.stringify({ error: 'Time range cannot exceed 24 hours' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Get driver info and check city access
    const { data: driver, error: driverError } = await supabase
      .from('drivers')
      .select('city_id, full_name')
      .eq('id', driverId)
      .single();
    
    if (driverError || !driver) {
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
    
    // Get location history with sampling for large datasets
    // Return max 1000 points, sampling if necessary
    const { data: locations, error } = await supabase
      .from('driver_locations')
      .select('*')
      .eq('driver_id', driverId)
      .gte('recorded_at', startTime)
      .lte('recorded_at', endTime)
      .order('recorded_at', { ascending: true })
      .limit(1000);
    
    if (error) {
      console.error('Get location history error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch location history' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Transform response
    const history = locations?.map((loc: any) => ({
      latitude: loc.latitude,
      longitude: loc.longitude,
      accuracy: loc.accuracy,
      speed: loc.speed,
      heading: loc.heading,
      batteryLevel: loc.battery_level,
      recordedAt: loc.recorded_at,
    })) || [];
    
    return new Response(
      JSON.stringify({
        driverId,
        driverName: driver.full_name,
        startTime,
        endTime,
        totalPoints: history.length,
        locations: history,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Get location history error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

// POST /drivers/heartbeat - Driver heartbeat to maintain online status
async function handleDriverHeartbeat(req: Request, supabase: any) {
  try {
    const body = await req.json();
    const { driverId, isOnline } = body;
    
    if (!driverId) {
      return new Response(
        JSON.stringify({ error: 'driverId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Update online status
    const { error } = await supabase
      .from('drivers')
      .update({
        is_online: isOnline !== false, // Default to true
        location_updated_at: new Date().toISOString(),
      })
      .eq('id', driverId);
    
    if (error) {
      console.error('Heartbeat error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to update status' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Log activity if going offline
    if (isOnline === false) {
      await supabase.from('driver_activity_logs').insert({
        driver_id: driverId,
        activity_type: 'logout',
        details: { reason: 'heartbeat_timeout' },
      });
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Heartbeat error:', error);
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
  
  const url = new URL(req.url);
  const pathParts = url.pathname.replace('/fleet-tracking', '').split('/').filter(Boolean);
  
  // Route handling
  
  // Driver mobile app endpoints
  if (pathParts.length >= 2 && pathParts[0] === 'drivers' && pathParts[1] === 'location') {
    if (req.method === 'POST' && pathParts[2] === 'update') {
      // Allow driver tokens for location updates
      const user = await validateToken(req, true);
      if (!user) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return await handleLocationUpdate(req, supabase);
    }
  }
  
  if (pathParts.length >= 2 && pathParts[0] === 'drivers' && pathParts[1] === 'heartbeat') {
    if (req.method === 'POST') {
      const user = await validateToken(req, true);
      if (!user) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return await handleDriverHeartbeat(req, supabase);
    }
  }
  
  // Fleet manager endpoints - require fleet token
  const user = await validateToken(req, false);
  if (!user || user.type !== 'fleet') {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  
  // Fleet tracking endpoints
  if (pathParts.length >= 2 && pathParts[0] === 'fleet' && pathParts[1] === 'tracking') {
    // /fleet/tracking/drivers
    if (pathParts.length === 3 && pathParts[2] === 'drivers' && req.method === 'GET') {
      return await handleGetTrackingDrivers(req, supabase, user);
    }
    
    // /fleet/tracking/drivers/:id/history
    if (pathParts.length === 4 && pathParts[2] === 'drivers' && pathParts[3] === 'history') {
      const driverId = pathParts[3];
      if (req.method === 'GET') {
        return await handleGetLocationHistory(req, supabase, user, driverId);
      }
    }
  }
  
  return new Response(
    JSON.stringify({ error: 'Not found' }),
    { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
