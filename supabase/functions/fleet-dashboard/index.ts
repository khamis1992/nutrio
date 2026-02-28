// Fleet Management Portal - Dashboard Edge Function
// Provides aggregated statistics for fleet managers

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { jwtVerify } from 'https://esm.sh/jose@5.2.0';

const JWT_SECRET = new TextEncoder().encode(Deno.env.get('FLEET_JWT_SECRET') || '');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// JWT validation middleware
async function validateToken(token: string) {
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

// Check city access permissions
function hasCityAccess(user: any, cityId: string | null): boolean {
  if (user.role === 'super_admin') return true;
  if (!cityId) return true; // No specific city requested
  return user.assignedCities?.includes(cityId) || false;
}

// Build city filter for queries
function buildCityFilter(user: any, requestedCityId?: string): { cityIds: string[], filterQuery: string } {
  let cityIds: string[] = [];
  
  if (user.role === 'super_admin') {
    // Super admin: use requested city or all cities
    cityIds = requestedCityId ? [requestedCityId] : [];
  } else {
    // Fleet manager: only their assigned cities
    cityIds = user.assignedCities || [];
    if (requestedCityId && !cityIds.includes(requestedCityId)) {
      throw new Error('Unauthorized city access');
    }
    if (requestedCityId) {
      cityIds = [requestedCityId];
    }
  }
  
  const filterQuery = cityIds.length > 0 ? `city_id = ANY($1)` : '1=1';
  return { cityIds, filterQuery };
}

// GET /fleet/dashboard
async function handleGetDashboard(req: Request, supabase: any) {
  try {
    // Verify authorization
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const token = authHeader.substring(7);
    const payload = await validateToken(token);
    
    if (!payload) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Parse query parameters
    const url = new URL(req.url);
    const requestedCityId = url.searchParams.get('cityId');
    
    // Check city access
    if (!hasCityAccess(payload, requestedCityId)) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized city access' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const { cityIds, filterQuery } = buildCityFilter(payload, requestedCityId || undefined);
    
    // Get today's date boundaries
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Build queries based on city filter
    const cityFilter = cityIds.length > 0 ? cityIds : null;
    
    // Get total drivers count
    let totalDriversQuery = supabase
      .from('drivers')
      .select('id', { count: 'exact', head: true });
    
    if (cityIds.length > 0) {
      totalDriversQuery = totalDriversQuery.in('city_id', cityIds);
    }
    
    const { count: totalDrivers, error: totalError } = await totalDriversQuery;
    
    // Get active (verified) drivers count
    let activeDriversQuery = supabase
      .from('drivers')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active');
    
    if (cityIds.length > 0) {
      activeDriversQuery = activeDriversQuery.in('city_id', cityIds);
    }
    
    const { count: activeDrivers, error: activeError } = await activeDriversQuery;
    
    // Get online drivers count
    let onlineDriversQuery = supabase
      .from('drivers')
      .select('id', { count: 'exact', head: true })
      .eq('is_online', true);
    
    if (cityIds.length > 0) {
      onlineDriversQuery = onlineDriversQuery.in('city_id', cityIds);
    }
    
    const { count: onlineDrivers, error: onlineError } = await onlineDriversQuery;
    
    // Get orders in progress (assigned to drivers)
    let ordersInProgressQuery = supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'out_for_delivery');
    
    if (cityIds.length > 0) {
      ordersInProgressQuery = ordersInProgressQuery.in('city_id', cityIds);
    }
    
    const { count: ordersInProgress, error: ordersError } = await ordersInProgressQuery;
    
    // Get today's completed deliveries
    let todayDeliveriesQuery = supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'delivered')
      .gte('delivered_at', today.toISOString())
      .lt('delivered_at', tomorrow.toISOString());
    
    if (cityIds.length > 0) {
      todayDeliveriesQuery = todayDeliveriesQuery.in('city_id', cityIds);
    }
    
    const { count: todayDeliveries, error: deliveriesError } = await todayDeliveriesQuery;
    
    // Get average delivery time (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    let avgDeliveryQuery = supabase
      .from('orders')
      .select('delivery_time_minutes')
      .eq('status', 'delivered')
      .gte('delivered_at', sevenDaysAgo.toISOString())
      .not('delivery_time_minutes', 'is', null);
    
    if (cityIds.length > 0) {
      avgDeliveryQuery = avgDeliveryQuery.in('city_id', cityIds);
    }
    
    const { data: deliveryTimes, error: avgError } = await avgDeliveryQuery;
    
    const averageDeliveryTime = deliveryTimes && deliveryTimes.length > 0
      ? Math.round(deliveryTimes.reduce((sum: number, o: any) => sum + (o.delivery_time_minutes || 0), 0) / deliveryTimes.length)
      : 0;
    
    // Get city breakdown for super admins or when no specific city requested
    let cityFilterData: any[] = [];
    if (payload.role === 'super_admin' && !requestedCityId) {
      const { data: cities, error: citiesError } = await supabase
        .from('cities')
        .select('id, name, name_ar')
        .eq('is_active', true);
      
      if (!citiesError && cities) {
        cityFilterData = await Promise.all(
          cities.map(async (city: any) => {
            const { count } = await supabase
              .from('drivers')
              .select('id', { count: 'exact', head: true })
              .eq('city_id', city.id);
            
            const { count: activeCount } = await supabase
              .from('drivers')
              .select('id', { count: 'exact', head: true })
              .eq('city_id', city.id)
              .eq('status', 'active');
            
            return {
              id: city.id,
              name: city.name,
              nameAr: city.name_ar,
              driverCount: count || 0,
              activeDriverCount: activeCount || 0,
            };
          })
        );
      }
    } else if (cityIds.length > 0) {
      // Get details for requested/allowed cities
      const { data: cities, error: citiesError } = await supabase
        .from('cities')
        .select('id, name, name_ar')
        .in('id', cityIds)
        .eq('is_active', true);
      
      if (!citiesError && cities) {
        cityFilterData = await Promise.all(
          cities.map(async (city: any) => {
            const { count } = await supabase
              .from('drivers')
              .select('id', { count: 'exact', head: true })
              .eq('city_id', city.id);
            
            const { count: activeCount } = await supabase
              .from('drivers')
              .select('id', { count: 'exact', head: true })
              .eq('city_id', city.id)
              .eq('status', 'active');
            
            return {
              id: city.id,
              name: city.name,
              nameAr: city.name_ar,
              driverCount: count || 0,
              activeDriverCount: activeCount || 0,
            };
          })
        );
      }
    }
    
    // Check for any errors
    if (totalError || activeError || onlineError || ordersError || deliveriesError) {
      console.error('Dashboard query errors:', { totalError, activeError, onlineError, ordersError, deliveriesError });
      return new Response(
        JSON.stringify({ error: 'Failed to fetch dashboard data' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(
      JSON.stringify({
        totalDrivers: totalDrivers || 0,
        activeDrivers: activeDrivers || 0,
        onlineDrivers: onlineDrivers || 0,
        ordersInProgress: ordersInProgress || 0,
        todayDeliveries: todayDeliveries || 0,
        averageDeliveryTime,
        cityFilter: cityFilterData,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Dashboard error:', error);
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
  const path = url.pathname.replace('/fleet-dashboard', '').replace('/fleet', '');
  
  // Route handling
  if (req.method === 'GET' && (path === '/dashboard' || path === '')) {
    return await handleGetDashboard(req, supabase);
  }
  
  return new Response(
    JSON.stringify({ error: 'Not found' }),
    { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
