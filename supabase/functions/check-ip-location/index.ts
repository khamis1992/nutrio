import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_COUNTRY = 'QA' // Qatar
const IP_API_URL = 'http://ip-api.com/json/'

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    // Get client IP from headers
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0].trim() 
                   || req.headers.get('x-real-ip') 
                   || 'unknown'

    // Check if IP is blocked in database
    const { data: blockedData } = await supabaseClient
      .rpc('is_ip_blocked', { p_ip: clientIP })

    if (blockedData) {
      return new Response(JSON.stringify({
        allowed: false,
        blocked: true,
        reason: 'IP is blocked',
        ip: clientIP
      }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Get geolocation from ip-api.com
    const geoResponse = await fetch(`${IP_API_URL}${clientIP}?fields=status,countryCode,country,city`)
    const geoData = await geoResponse.json()

    if (geoData.status !== 'success') {
      // If geo lookup fails, deny access (fail closed)
      return new Response(JSON.stringify({
        allowed: false,
        blocked: false,
        reason: 'Unable to verify location',
        ip: clientIP
      }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const isQatar = geoData.countryCode === ALLOWED_COUNTRY

    return new Response(JSON.stringify({
      allowed: isQatar,
      blocked: false,
      ip: clientIP,
      countryCode: geoData.countryCode,
      country: geoData.country,
      city: geoData.city
    }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })

  } catch (error) {
    return new Response(JSON.stringify({
      allowed: false,
      blocked: false,
      reason: 'Server error',
      error: (error as Error).message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})