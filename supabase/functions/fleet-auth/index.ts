// Fleet Management Portal - Authentication Edge Function
// Handles fleet manager login, token refresh, and logout

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { jwtVerify, jwtSign } from 'https://esm.sh/jose@5.2.0';

// JWT configuration
const JWT_SECRET = new TextEncoder().encode(Deno.env.get('FLEET_JWT_SECRET') || '');
const JWT_REFRESH_SECRET = new TextEncoder().encode(Deno.env.get('FLEET_REFRESH_SECRET') || '');
const ACCESS_TOKEN_EXPIRY = 15 * 60; // 15 minutes
const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60; // 7 days

// Rate limiting: 5 login attempts per minute per IP
// TODO: Implement Redis-based rate limiting for production

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FleetManager {
  id: string;
  auth_user_id: string;
  email: string;
  full_name: string;
  role: 'super_admin' | 'fleet_manager';
  assigned_city_ids: string[];
  is_active: boolean;
}

// Generate JWT tokens with role and city claims
async function generateTokens(manager: FleetManager) {
  const now = Math.floor(Date.now() / 1000);
  
  const accessToken = await jwtSign(
    {
      sub: manager.auth_user_id,
      managerId: manager.id,
      email: manager.email,
      role: manager.role,
      assignedCities: manager.assigned_city_ids,
      type: 'fleet_access',
      iat: now,
      exp: now + ACCESS_TOKEN_EXPIRY,
    },
    JWT_SECRET
  );
  
  const refreshToken = await jwtSign(
    {
      sub: manager.auth_user_id,
      managerId: manager.id,
      type: 'fleet_refresh',
      iat: now,
      exp: now + REFRESH_TOKEN_EXPIRY,
    },
    JWT_REFRESH_SECRET
  );
  
  return { accessToken, refreshToken, expiresIn: ACCESS_TOKEN_EXPIRY };
}

// JWT validation middleware
async function validateAccessToken(token: string) {
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

async function validateRefreshToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, JWT_REFRESH_SECRET);
    if (payload.type !== 'fleet_refresh') {
      throw new Error('Invalid token type');
    }
    return payload;
  } catch {
    return null;
  }
}

// POST /fleet/login
async function handleLogin(req: Request, supabase: any) {
  try {
    const { email, password } = await req.json();
    
    // Validate input
    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Email and password are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Authenticate with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (authError || !authData.user) {
      return new Response(
        JSON.stringify({ error: 'Invalid credentials' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Check if user is a fleet manager
    const { data: manager, error: managerError } = await supabase
      .from('fleet_managers')
      .select('*')
      .eq('auth_user_id', authData.user.id)
      .eq('is_active', true)
      .single();
    
    if (managerError || !manager) {
      return new Response(
        JSON.stringify({ error: 'Not authorized as fleet manager' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Generate fleet-specific JWT tokens
    const tokens = await generateTokens(manager);
    
    // Update last login
    await supabase
      .from('fleet_managers')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', manager.id);
    
    // Log activity
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
    await supabase.from('fleet_activity_logs').insert({
      manager_id: manager.id,
      action: 'login',
      entity_type: 'manager',
      entity_id: manager.id,
      ip_address: clientIP,
      user_agent: req.headers.get('user-agent') || 'unknown',
    });
    
    return new Response(
      JSON.stringify({
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
        user: {
          id: manager.id,
          email: manager.email,
          fullName: manager.full_name,
          role: manager.role,
          assignedCities: manager.assigned_city_ids,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Login error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

// POST /fleet/refresh
async function handleRefresh(req: Request, supabase: any) {
  try {
    const { refreshToken } = await req.json();
    
    if (!refreshToken) {
      return new Response(
        JSON.stringify({ error: 'Refresh token is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const payload = await validateRefreshToken(refreshToken);
    if (!payload) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired refresh token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Get manager details
    const { data: manager, error } = await supabase
      .from('fleet_managers')
      .select('*')
      .eq('id', payload.managerId)
      .eq('is_active', true)
      .single();
    
    if (error || !manager) {
      return new Response(
        JSON.stringify({ error: 'Manager not found or inactive' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Generate new tokens
    const tokens = await generateTokens(manager);
    
    return new Response(
      JSON.stringify({
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Refresh error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

// POST /fleet/logout
async function handleLogout(req: Request, supabase: any) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const token = authHeader.substring(7);
    const payload = await validateAccessToken(token);
    
    if (payload?.managerId) {
      // Log logout activity
      const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
      await supabase.from('fleet_activity_logs').insert({
        manager_id: payload.managerId as string,
        action: 'logout',
        entity_type: 'manager',
        entity_id: payload.managerId as string,
        ip_address: clientIP,
        user_agent: req.headers.get('user-agent') || 'unknown',
      });
    }
    
    // TODO: Add token to revocation list (Redis) for immediate invalidation
    
    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Logout error:', error);
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
  const path = url.pathname.replace('/fleet-auth', '').replace('/fleet', '');
  
  // Route handling
  if (req.method === 'POST' && path === '/login') {
    return await handleLogin(req, supabase);
  }
  
  if (req.method === 'POST' && path === '/refresh') {
    return await handleRefresh(req, supabase);
  }
  
  if (req.method === 'POST' && path === '/logout') {
    return await handleLogout(req, supabase);
  }
  
  return new Response(
    JSON.stringify({ error: 'Not found' }),
    { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
