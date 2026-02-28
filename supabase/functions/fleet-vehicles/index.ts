// Fleet Management Portal - Vehicle Management Edge Function
// Handles vehicle CRUD operations and driver assignments

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { jwtVerify } from 'https://esm.sh/jose@5.2.0';

const JWT_SECRET = new TextEncoder().encode(Deno.env.get('FLEET_JWT_SECRET') || '');

// Rate limiting: 100 requests per minute per manager
// TODO: Implement Redis-based rate limiting for production

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
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

// GET /fleet/vehicles - List vehicles
async function handleListVehicles(req: Request, supabase: any, user: any) {
  try {
    const url = new URL(req.url);
    const cityId = url.searchParams.get('cityId');
    const status = url.searchParams.get('status');
    const type = url.searchParams.get('type');
    
    const allowedCityIds = getAllowedCityIds(user, cityId);
    
    // Build query
    let query = supabase
      .from('vehicles')
      .select(`
        *,
        cities(name, name_ar),
        drivers(id, full_name, phone)
      `);
    
    // Apply city filter
    if (allowedCityIds.length > 0) {
      query = query.in('city_id', allowedCityIds);
    }
    
    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }
    
    if (type) {
      query = query.eq('type', type);
    }
    
    query = query.order('created_at', { ascending: false });
    
    const { data, error } = await query;
    
    if (error) {
      console.error('List vehicles error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch vehicles' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Transform response
    const vehicles = data.map((vehicle: any) => ({
      id: vehicle.id,
      type: vehicle.type,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      color: vehicle.color,
      plateNumber: vehicle.plate_number,
      registrationNumber: vehicle.registration_number,
      insuranceProvider: vehicle.insurance_provider,
      insuranceExpiry: vehicle.insurance_expiry,
      status: vehicle.status,
      cityId: vehicle.city_id,
      cityName: vehicle.cities?.name,
      assignedDriverId: vehicle.assigned_driver_id,
      assignedDriverName: vehicle.drivers?.full_name,
      vehiclePhotoUrl: vehicle.vehicle_photo_url,
      registrationDocumentUrl: vehicle.registration_document_url,
      insuranceDocumentUrl: vehicle.insurance_document_url,
      daysUntilInsuranceExpiry: vehicle.insurance_expiry 
        ? Math.ceil((new Date(vehicle.insurance_expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : null,
      createdAt: vehicle.created_at,
    }));
    
    return new Response(
      JSON.stringify(vehicles),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('List vehicles error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    const status = message.includes('Unauthorized') ? 403 : 500;
    return new Response(
      JSON.stringify({ error: message }),
      { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

// POST /fleet/vehicles - Create vehicle
async function handleCreateVehicle(req: Request, supabase: any, user: any) {
  try {
    const body = await req.json();
    const {
      cityId,
      type,
      make,
      model,
      year,
      color,
      plateNumber,
      registrationNumber,
      insuranceExpiry,
    } = body;
    
    // Validate required fields
    if (!cityId || !type || !plateNumber) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: cityId, type, plateNumber' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Validate vehicle type
    const validTypes = ['motorcycle', 'car', 'bicycle', 'van'];
    if (!validTypes.includes(type)) {
      return new Response(
        JSON.stringify({ error: 'Invalid vehicle type' }),
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
    
    // Check if plate number already exists
    const { data: existingVehicle } = await supabase
      .from('vehicles')
      .select('id')
      .eq('plate_number', plateNumber)
      .maybeSingle();
    
    if (existingVehicle) {
      return new Response(
        JSON.stringify({ error: 'Vehicle with this plate number already exists' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const { data: vehicle, error } = await supabase
      .from('vehicles')
      .insert({
        city_id: cityId,
        type,
        make,
        model,
        year,
        color,
        plate_number: plateNumber,
        registration_number: registrationNumber,
        insurance_expiry: insuranceExpiry,
        status: 'available',
      })
      .select()
      .single();
    
    if (error) {
      console.error('Create vehicle error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to create vehicle' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Log activity
    await supabase.from('fleet_activity_logs').insert({
      manager_id: user.managerId,
      city_id: cityId,
      action: 'create_vehicle',
      entity_type: 'vehicle',
      entity_id: vehicle.id,
      new_values: { type, make, model, plateNumber },
      ip_address: req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown',
      user_agent: req.headers.get('user-agent') || 'unknown',
    });
    
    return new Response(
      JSON.stringify({
        id: vehicle.id,
        type: vehicle.type,
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        color: vehicle.color,
        plateNumber: vehicle.plate_number,
        status: vehicle.status,
        cityId: vehicle.city_id,
        createdAt: vehicle.created_at,
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Create vehicle error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

// GET /fleet/vehicles/:id - Get vehicle details
async function handleGetVehicle(req: Request, supabase: any, user: any, vehicleId: string) {
  try {
    const { data: vehicle, error } = await supabase
      .from('vehicles')
      .select(`
        *,
        cities(name, name_ar),
        drivers(id, full_name, phone, email, status)
      `)
      .eq('id', vehicleId)
      .single();
    
    if (error || !vehicle) {
      return new Response(
        JSON.stringify({ error: 'Vehicle not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Check city access
    if (!hasCityAccess(user, vehicle.city_id)) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized city access' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(
      JSON.stringify({
        id: vehicle.id,
        type: vehicle.type,
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        color: vehicle.color,
        plateNumber: vehicle.plate_number,
        registrationNumber: vehicle.registration_number,
        insuranceProvider: vehicle.insurance_provider,
        insuranceExpiry: vehicle.insurance_expiry,
        status: vehicle.status,
        cityId: vehicle.city_id,
        cityName: vehicle.cities?.name,
        assignedDriverId: vehicle.assigned_driver_id,
        assignedDriver: vehicle.drivers ? {
          id: vehicle.drivers.id,
          fullName: vehicle.drivers.full_name,
          phone: vehicle.drivers.phone,
          email: vehicle.drivers.email,
          status: vehicle.drivers.status,
        } : null,
        vehiclePhotoUrl: vehicle.vehicle_photo_url,
        registrationDocumentUrl: vehicle.registration_document_url,
        insuranceDocumentUrl: vehicle.insurance_document_url,
        daysUntilInsuranceExpiry: vehicle.insurance_expiry 
          ? Math.ceil((new Date(vehicle.insurance_expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          : null,
        createdAt: vehicle.created_at,
        updatedAt: vehicle.updated_at,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Get vehicle error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

// PUT /fleet/vehicles/:id - Update vehicle
async function handleUpdateVehicle(req: Request, supabase: any, user: any, vehicleId: string) {
  try {
    // Check vehicle exists and manager has access
    const { data: existingVehicle, error: checkError } = await supabase
      .from('vehicles')
      .select('city_id, plate_number, assigned_driver_id')
      .eq('id', vehicleId)
      .single();
    
    if (checkError || !existingVehicle) {
      return new Response(
        JSON.stringify({ error: 'Vehicle not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!hasCityAccess(user, existingVehicle.city_id)) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized city access' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const body = await req.json();
    const {
      make,
      model,
      year,
      color,
      status,
      assignedDriverId,
      insuranceExpiry,
      insuranceProvider,
    } = body;
    
    // Validate status if provided
    const validStatuses = ['available', 'assigned', 'maintenance', 'retired'];
    if (status && !validStatuses.includes(status)) {
      return new Response(
        JSON.stringify({ error: 'Invalid status' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // If assigning driver, verify driver belongs to same city
    if (assignedDriverId !== undefined && assignedDriverId !== existingVehicle.assigned_driver_id) {
      if (assignedDriverId) {
        const { data: driver, error: driverError } = await supabase
          .from('drivers')
          .select('city_id, assigned_vehicle_id')
          .eq('id', assignedDriverId)
          .single();
        
        if (driverError || !driver) {
          return new Response(
            JSON.stringify({ error: 'Driver not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        if (driver.city_id !== existingVehicle.city_id) {
          return new Response(
            JSON.stringify({ error: 'Driver belongs to different city' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Unassign from previous driver if any
        if (existingVehicle.assigned_driver_id) {
          await supabase
            .from('drivers')
            .update({ assigned_vehicle_id: null })
            .eq('id', existingVehicle.assigned_driver_id);
        }
        
        // Update driver with new vehicle
        await supabase
          .from('drivers')
          .update({ assigned_vehicle_id: vehicleId })
          .eq('id', assignedDriverId);
      } else {
        // Unassigning vehicle
        if (existingVehicle.assigned_driver_id) {
          await supabase
            .from('drivers')
            .update({ assigned_vehicle_id: null })
            .eq('id', existingVehicle.assigned_driver_id);
        }
      }
    }
    
    // Build update object
    const updates: any = {};
    if (make !== undefined) updates.make = make;
    if (model !== undefined) updates.model = model;
    if (year !== undefined) updates.year = year;
    if (color !== undefined) updates.color = color;
    if (status !== undefined) updates.status = status;
    if (assignedDriverId !== undefined) updates.assigned_driver_id = assignedDriverId;
    if (insuranceExpiry !== undefined) updates.insurance_expiry = insuranceExpiry;
    if (insuranceProvider !== undefined) updates.insurance_provider = insuranceProvider;
    
    const { data: vehicle, error } = await supabase
      .from('vehicles')
      .update(updates)
      .eq('id', vehicleId)
      .select()
      .single();
    
    if (error) {
      console.error('Update vehicle error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to update vehicle' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Log activity
    await supabase.from('fleet_activity_logs').insert({
      manager_id: user.managerId,
      city_id: existingVehicle.city_id,
      action: 'update_vehicle',
      entity_type: 'vehicle',
      entity_id: vehicleId,
      old_values: { 
        status: existingVehicle.status,
        assignedDriverId: existingVehicle.assigned_driver_id 
      },
      new_values: updates,
      ip_address: req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown',
      user_agent: req.headers.get('user-agent') || 'unknown',
    });
    
    return new Response(
      JSON.stringify({
        id: vehicle.id,
        type: vehicle.type,
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        color: vehicle.color,
        plateNumber: vehicle.plate_number,
        status: vehicle.status,
        assignedDriverId: vehicle.assigned_driver_id,
        insuranceExpiry: vehicle.insurance_expiry,
        updatedAt: vehicle.updated_at,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Update vehicle error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

// POST /fleet/vehicles/:id/assign - Assign vehicle to driver
async function handleAssignVehicle(req: Request, supabase: any, user: any, vehicleId: string) {
  try {
    const body = await req.json();
    const { driverId } = body;
    
    if (!driverId) {
      return new Response(
        JSON.stringify({ error: 'driverId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Get vehicle
    const { data: vehicle, error: vehicleError } = await supabase
      .from('vehicles')
      .select('city_id, status, assigned_driver_id')
      .eq('id', vehicleId)
      .single();
    
    if (vehicleError || !vehicle) {
      return new Response(
        JSON.stringify({ error: 'Vehicle not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Check city access
    if (!hasCityAccess(user, vehicle.city_id)) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized city access' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Get driver
    const { data: driver, error: driverError } = await supabase
      .from('drivers')
      .select('city_id, assigned_vehicle_id, full_name')
      .eq('id', driverId)
      .single();
    
    if (driverError || !driver) {
      return new Response(
        JSON.stringify({ error: 'Driver not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Verify same city
    if (driver.city_id !== vehicle.city_id) {
      return new Response(
        JSON.stringify({ error: 'Driver and vehicle must be in the same city' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Unassign previous vehicle from driver if any
    if (driver.assigned_vehicle_id) {
      await supabase
        .from('vehicles')
        .update({ assigned_driver_id: null, status: 'available' })
        .eq('id', driver.assigned_vehicle_id);
    }
    
    // Unassign previous driver from vehicle if any
    if (vehicle.assigned_driver_id) {
      await supabase
        .from('drivers')
        .update({ assigned_vehicle_id: null })
        .eq('id', vehicle.assigned_driver_id);
    }
    
    // Assign vehicle to driver
    const { error: updateError } = await supabase
      .from('vehicles')
      .update({ assigned_driver_id: driverId, status: 'assigned' })
      .eq('id', vehicleId);
    
    if (updateError) {
      console.error('Assign vehicle error:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to assign vehicle' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Update driver
    await supabase
      .from('drivers')
      .update({ assigned_vehicle_id: vehicleId })
      .eq('id', driverId);
    
    // Log activity
    await supabase.from('fleet_activity_logs').insert({
      manager_id: user.managerId,
      city_id: vehicle.city_id,
      action: 'assign_vehicle',
      entity_type: 'vehicle',
      entity_id: vehicleId,
      new_values: { driverId, driverName: driver.full_name },
      ip_address: req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown',
      user_agent: req.headers.get('user-agent') || 'unknown',
    });
    
    return new Response(
      JSON.stringify({
        success: true,
        vehicleId,
        driverId,
        message: 'Vehicle assigned successfully',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Assign vehicle error:', error);
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
  const pathParts = url.pathname.replace('/fleet-vehicles', '').replace('/fleet/vehicles', '').split('/').filter(Boolean);
  
  // Route handling
  if (pathParts.length === 0) {
    // /fleet/vehicles
    if (req.method === 'GET') {
      return await handleListVehicles(req, supabase, user);
    }
    if (req.method === 'POST') {
      return await handleCreateVehicle(req, supabase, user);
    }
  } else if (pathParts.length === 1) {
    // /fleet/vehicles/:id
    const vehicleId = pathParts[0];
    if (req.method === 'GET') {
      return await handleGetVehicle(req, supabase, user, vehicleId);
    }
    if (req.method === 'PUT') {
      return await handleUpdateVehicle(req, supabase, user, vehicleId);
    }
  } else if (pathParts.length === 2) {
    const vehicleId = pathParts[0];
    const action = pathParts[1];
    
    if (action === 'assign' && req.method === 'POST') {
      return await handleAssignVehicle(req, supabase, user, vehicleId);
    }
  }
  
  return new Response(
    JSON.stringify({ error: 'Not found' }),
    { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
