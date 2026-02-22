import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  try {
    const { action, userId } = await req.json()
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0].trim() 
                   || req.headers.get('x-real-ip') 
                   || 'unknown'
    
    const userAgent = req.headers.get('user-agent') || 'unknown'

    // Get geo info
    const geoResponse = await fetch(`http://ip-api.com/json/${clientIP}?fields=countryCode,country,city`)
    const geoData = await geoResponse.json()

    // Log the IP
    const { error } = await supabaseClient
      .from('user_ip_logs')
      .insert({
        user_id: userId,
        ip_address: clientIP,
        country_code: geoData.countryCode || null,
        country_name: geoData.country || null,
        city: geoData.city || null,
        action: action,
        user_agent: userAgent
      })

    if (error) throw error

    return new Response(JSON.stringify({ success: true }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })

  } catch (error) {
    return new Response(JSON.stringify({ 
      success: false, 
      error: (error as Error).message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})