-- Fix function to set search_path for security
CREATE OR REPLACE FUNCTION public.notify_affiliate_commission()
RETURNS TRIGGER AS $$
BEGIN
  -- Only send notification for new pending commissions
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    -- Call the edge function using pg_net
    PERFORM net.http_post(
      url := 'https://loepcagitrijlfksawfm.supabase.co/functions/v1/send-commission-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'user_id', NEW.user_id,
        'commission_amount', NEW.commission_amount,
        'tier', NEW.tier,
        'order_amount', NEW.order_amount
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;