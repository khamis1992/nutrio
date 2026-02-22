-- Create function to send commission notification via edge function
CREATE OR REPLACE FUNCTION public.notify_affiliate_commission()
RETURNS TRIGGER AS $$
DECLARE
  supabase_url TEXT;
  service_role_key TEXT;
BEGIN
  -- Only send notification for new pending commissions
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    -- Call the edge function using pg_net
    PERFORM net.http_post(
      url := 'https://loepcagitrijlfksawfm.supabase.co/functions/v1/send-commission-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpbWhucGlucHN3bGh6aWZjZm52Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1NTU1MTYsImV4cCI6MjA4MzEzMTUxNn0.LLYu3z6Mc2-_rdSDrnlo3PVJHnuCjuec0sxlOKmz6fk'
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to send notification after commission is inserted
DROP TRIGGER IF EXISTS notify_affiliate_commission_trigger ON public.affiliate_commissions;
CREATE TRIGGER notify_affiliate_commission_trigger
  AFTER INSERT ON public.affiliate_commissions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_affiliate_commission();