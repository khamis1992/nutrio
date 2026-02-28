// Fleet Management Portal - Payout Management Edge Function
// Handles driver payout processing with idempotency support

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { jwtVerify } from 'https://esm.sh/jose@5.2.0';

const JWT_SECRET = new TextEncoder().encode(Deno.env.get('FLEET_JWT_SECRET') || '');

// Rate limiting: 50 requests per minute per manager for payout operations
// TODO: Implement Redis-based rate limiting for production

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

// GET /fleet/payouts - List payouts with filters
async function handleListPayouts(req: Request, supabase: any, user: any) {
  try {
    const url = new URL(req.url);
    const cityId = url.searchParams.get('cityId');
    const driverId = url.searchParams.get('driverId');
    const status = url.searchParams.get('status');
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
    
    const allowedCityIds = getAllowedCityIds(user, cityId);
    
    // Build query
    let query = supabase
      .from('driver_payouts')
      .select(`
        *,
        drivers(id, full_name, phone, email),
        cities(name, name_ar)
      `, { count: 'exact' });
    
    // Apply city filter
    if (allowedCityIds.length > 0) {
      query = query.in('city_id', allowedCityIds);
    }
    
    // Apply filters
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
    
    // Apply pagination
    const from = (page - 1) * limit;
    query = query.range(from, from + limit - 1).order('created_at', { ascending: false });
    
    const { data, error, count } = await query;
    
    if (error) {
      console.error('List payouts error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch payouts' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Calculate summary
    let totalAmount = 0;
    let pendingAmount = 0;
    let paidAmount = 0;
    const driverIds = new Set<string>();
    
    data?.forEach((payout: any) => {
      const amount = payout.total_amount || 0;
      totalAmount += amount;
      driverIds.add(payout.driver_id);
      
      if (payout.status === 'pending') {
        pendingAmount += amount;
      } else if (payout.status === 'paid') {
        paidAmount += amount;
      }
    });
    
    // Transform response
    const payouts = data?.map((payout: any) => ({
      id: payout.id,
      driverId: payout.driver_id,
      driverName: payout.drivers?.full_name,
      cityId: payout.city_id,
      cityName: payout.cities?.name,
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
      createdAt: payout.created_at,
    })) || [];
    
    return new Response(
      JSON.stringify({
        data: payouts,
        summary: {
          totalAmount,
          pendingAmount,
          paidAmount,
          driverCount: driverIds.size,
        },
        pagination: {
          page,
          limit,
          total: count,
          totalPages: Math.ceil((count || 0) / limit),
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('List payouts error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    const status = message.includes('Unauthorized') ? 403 : 500;
    return new Response(
      JSON.stringify({ error: message }),
      { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

// POST /fleet/payouts - Process payout with idempotency
async function handleCreatePayout(req: Request, supabase: any, user: any) {
  try {
    const body = await req.json();
    const {
      driverId,
      periodStart,
      periodEnd,
      baseEarnings,
      bonusAmount = 0,
      penaltyAmount = 0,
      totalAmount,
      notes,
      idempotencyKey,
    } = body;
    
    // Validate required fields
    if (!driverId || !periodStart || !periodEnd || !totalAmount) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: driverId, periodStart, periodEnd, totalAmount' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Get driver info and check city access
    const { data: driver, error: driverError } = await supabase
      .from('drivers')
      .select('city_id, full_name, current_balance')
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
    
    // Check for duplicate with idempotency key
    if (idempotencyKey) {
      const { data: existingPayout } = await supabase
        .from('driver_payouts')
        .select('id, status')
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();
      
      if (existingPayout) {
        if (['pending', 'processing', 'paid'].includes(existingPayout.status)) {
          return new Response(
            JSON.stringify({ error: 'Duplicate payout detected', payoutId: existingPayout.id }),
            { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }
    
    // Create payout record
    const { data: payout, error } = await supabase
      .from('driver_payouts')
      .insert({
        driver_id: driverId,
        city_id: driver.city_id,
        period_start: periodStart,
        period_end: periodEnd,
        base_earnings: baseEarnings || totalAmount,
        bonus_amount: bonusAmount,
        penalty_amount: penaltyAmount,
        total_amount: totalAmount,
        status: 'pending',
        notes,
        idempotency_key: idempotencyKey || null,
        processed_by: user.managerId,
        processed_at: new Date().toISOString(),
      })
      .select()
      .single();
    
    if (error) {
      console.error('Create payout error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to create payout' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Log activity
    await supabase.from('fleet_activity_logs').insert({
      manager_id: user.managerId,
      city_id: driver.city_id,
      action: 'create_payout',
      entity_type: 'payout',
      entity_id: payout.id,
      new_values: { driverId, periodStart, periodEnd, totalAmount, idempotencyKey },
      ip_address: req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown',
      user_agent: req.headers.get('user-agent') || 'unknown',
    });
    
    return new Response(
      JSON.stringify({
        id: payout.id,
        driverId: payout.driver_id,
        driverName: driver.full_name,
        periodStart: payout.period_start,
        periodEnd: payout.period_end,
        baseEarnings: payout.base_earnings,
        bonusAmount: payout.bonus_amount,
        penaltyAmount: payout.penalty_amount,
        totalAmount: payout.total_amount,
        status: payout.status,
        notes: payout.notes,
        createdAt: payout.created_at,
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Create payout error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

// POST /fleet/payouts/:id/process - Mark payout as paid
async function handleProcessPayout(req: Request, supabase: any, user: any, payoutId: string) {
  try {
    const body = await req.json();
    const { paymentMethod, paymentReference, notes } = body;
    
    // Get payout
    const { data: payout, error: payoutError } = await supabase
      .from('driver_payouts')
      .select('city_id, driver_id, status, total_amount, base_earnings, bonus_amount, penalty_amount')
      .eq('id', payoutId)
      .single();
    
    if (payoutError || !payout) {
      return new Response(
        JSON.stringify({ error: 'Payout not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Check city access
    if (!hasCityAccess(user, payout.city_id)) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized city access' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Check if already processed
    if (payout.status === 'paid') {
      return new Response(
        JSON.stringify({ error: 'Payout already marked as paid' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Update payout status
    const updates: any = {
      status: 'paid',
      paid_by: user.managerId,
      paid_at: new Date().toISOString(),
    };
    
    if (paymentMethod) updates.payment_method = paymentMethod;
    if (paymentReference) updates.payment_reference = paymentReference;
    if (notes) updates.notes = notes;
    
    const { data: updatedPayout, error } = await supabase
      .from('driver_payouts')
      .update(updates)
      .eq('id', payoutId)
      .select()
      .single();
    
    if (error) {
      console.error('Process payout error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to process payout' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Update driver balance
    const { data: driver } = await supabase
      .from('drivers')
      .select('current_balance, total_earnings')
      .eq('id', payout.driver_id)
      .single();
    
    if (driver) {
      await supabase
        .from('drivers')
        .update({
          current_balance: Math.max(0, (driver.current_balance || 0) - payout.total_amount),
          total_earnings: (driver.total_earnings || 0) + payout.total_amount,
        })
        .eq('id', payout.driver_id);
    }
    
    // Log activity
    await supabase.from('fleet_activity_logs').insert({
      manager_id: user.managerId,
      city_id: payout.city_id,
      action: 'process_payout',
      entity_type: 'payout',
      entity_id: payoutId,
      old_values: { status: payout.status },
      new_values: { status: 'paid', paymentMethod, paymentReference },
      ip_address: req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown',
      user_agent: req.headers.get('user-agent') || 'unknown',
    });
    
    return new Response(
      JSON.stringify({
        id: updatedPayout.id,
        status: updatedPayout.status,
        paymentMethod: updatedPayout.payment_method,
        paymentReference: updatedPayout.payment_reference,
        paidAt: updatedPayout.paid_at,
        paidBy: updatedPayout.paid_by,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Process payout error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

// POST /fleet/payouts/bulk - Process bulk payouts
async function handleBulkPayouts(req: Request, supabase: any, user: any) {
  try {
    const body = await req.json();
    const { cityId, periodStart, periodEnd, driverIds } = body;
    
    // Validate required fields
    if (!cityId || !periodStart || !periodEnd) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: cityId, periodStart, periodEnd' }),
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
    
    // Get eligible drivers
    let driverQuery = supabase
      .from('drivers')
      .select('id, full_name, current_balance')
      .eq('city_id', cityId)
      .eq('status', 'active')
      .gt('current_balance', 0);
    
    if (driverIds && driverIds.length > 0) {
      driverQuery = driverQuery.in('id', driverIds);
    }
    
    const { data: drivers, error: driverError } = await driverQuery;
    
    if (driverError) {
      console.error('Bulk payout driver error:', driverError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch drivers' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const processed: any[] = [];
    const failed: any[] = [];
    
    // Process each driver
    for (const driver of drivers || []) {
      try {
        const idempotencyKey = `${driver.id}-${periodStart}-${periodEnd}`;
        
        // Check for existing payout
        const { data: existing } = await supabase
          .from('driver_payouts')
          .select('id')
          .eq('idempotency_key', idempotencyKey)
          .in('status', ['pending', 'processing', 'paid'])
          .maybeSingle();
        
        if (existing) {
          failed.push({ driverId: driver.id, reason: 'Duplicate payout' });
          continue;
        }
        
        // Create payout
        const { data: payout, error } = await supabase
          .from('driver_payouts')
          .insert({
            driver_id: driver.id,
            city_id: cityId,
            period_start: periodStart,
            period_end: periodEnd,
            base_earnings: driver.current_balance,
            bonus_amount: 0,
            penalty_amount: 0,
            total_amount: driver.current_balance,
            status: 'pending',
            idempotency_key: idempotencyKey,
            processed_by: user.managerId,
            processed_at: new Date().toISOString(),
          })
          .select()
          .single();
        
        if (error) {
          failed.push({ driverId: driver.id, reason: error.message });
        } else {
          processed.push({
            id: payout.id,
            driverId: driver.id,
            driverName: driver.full_name,
            totalAmount: payout.total_amount,
          });
        }
      } catch (err) {
        failed.push({ driverId: driver.id, reason: (err as Error).message });
      }
    }
    
    // Log bulk activity
    await supabase.from('fleet_activity_logs').insert({
      manager_id: user.managerId,
      city_id: cityId,
      action: 'bulk_create_payouts',
      entity_type: 'payout',
      new_values: { processed: processed.length, failed: failed.length, periodStart, periodEnd },
      ip_address: req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown',
      user_agent: req.headers.get('user-agent') || 'unknown',
    });
    
    return new Response(
      JSON.stringify({
        processed: processed.length,
        failed: failed.length,
        payouts: processed,
        failures: failed,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Bulk payout error:', error);
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
  const pathParts = url.pathname.replace('/fleet-payouts', '').replace('/fleet/payouts', '').split('/').filter(Boolean);
  
  // Route handling
  if (pathParts.length === 0) {
    // /fleet/payouts
    if (req.method === 'GET') {
      return await handleListPayouts(req, supabase, user);
    }
    if (req.method === 'POST') {
      return await handleCreatePayout(req, supabase, user);
    }
  } else if (pathParts.length === 1) {
    const payoutId = pathParts[0];
    // /fleet/payouts/:id/process
    if (req.method === 'POST') {
      return await handleProcessPayout(req, supabase, user, payoutId);
    }
  } else if (pathParts.length === 1 && pathParts[0] === 'bulk') {
    // /fleet/payouts/bulk
    if (req.method === 'POST') {
      return await handleBulkPayouts(req, supabase, user);
    }
  }
  
  return new Response(
    JSON.stringify({ error: 'Not found' }),
    { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
