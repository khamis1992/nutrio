-- Create function to send payout notification via edge function
CREATE OR REPLACE FUNCTION public.notify_affiliate_payout_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Only send notification when status changes to approved or rejected
  IF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND (NEW.status = 'approved' OR NEW.status = 'rejected') THEN
    -- Call the edge function using pg_net
    PERFORM net.http_post(
      url := 'https://fimhnpinpswlhzifcfnv.supabase.co/functions/v1/send-payout-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpbWhucGlucHN3bGh6aWZjZm52Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1NTU1MTYsImV4cCI6MjA4MzEzMTUxNn0.LLYu3z6Mc2-_rdSDrnlo3PVJHnuCjuec0sxlOKmz6fk'
      ),
      body := jsonb_build_object(
        'user_id', NEW.user_id,
        'amount', NEW.amount,
        'status', NEW.status,
        'payout_method', NEW.payout_method,
        'notes', NEW.notes
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to send notification after payout status is updated
DROP TRIGGER IF EXISTS notify_affiliate_payout_status_trigger ON public.affiliate_payouts;
CREATE TRIGGER notify_affiliate_payout_status_trigger
  AFTER UPDATE OF status ON public.affiliate_payouts
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_affiliate_payout_status();