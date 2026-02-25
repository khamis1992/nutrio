import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { 
      user_id, 
      amount, 
      order_id, 
      payment_method, 
      simulation_mode = true 
    } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Create payment record
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        user_id,
        payment_type: 'wallet_topup',
        amount,
        currency: 'QAR',
        status: 'pending',
        payment_method,
        gateway: simulation_mode ? 'simulation' : 'sadad',
      })
      .select()
      .single();

    if (paymentError) throw paymentError;

    // In simulation mode, randomly succeed or fail after delay
    if (simulation_mode) {
      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 95% success rate
      const success = Math.random() > 0.05;
      
      if (success) {
        // Update payment as completed
        await supabase
          .from('payments')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            gateway_reference: `SIM-${Date.now()}`,
          })
          .eq('id', payment.id);

        // Credit wallet
        await supabase.rpc('credit_wallet', {
          p_user_id: user_id,
          p_amount: amount,
          p_type: 'credit',
          p_reference_type: 'wallet_topup',
          p_reference_id: payment.id,
          p_description: 'Simulated wallet top-up',
        });

        return new Response(
          JSON.stringify({ 
            success: true, 
            payment_id: payment.id,
            transaction_id: `TXN-${Date.now()}`,
            message: 'Payment completed (simulation)'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        // Simulate failure
        await supabase
          .from('payments')
          .update({
            status: 'failed',
            gateway_response: { error: 'Simulated failure' },
          })
          .eq('id', payment.id);

        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Payment declined by bank (simulation)'
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(
      JSON.stringify({ 
        payment_id: payment.id,
        status: 'pending',
        message: 'Payment initiated'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
