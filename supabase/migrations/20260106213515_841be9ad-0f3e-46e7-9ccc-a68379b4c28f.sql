-- Create function to send welcome email when a user gets a referral code
CREATE OR REPLACE FUNCTION public.send_affiliate_welcome_email()
RETURNS TRIGGER AS $$
BEGIN
  -- Send welcome email when referral_code is first set
  IF (OLD.referral_code IS NULL OR OLD.referral_code = '') AND NEW.referral_code IS NOT NULL AND NEW.referral_code != '' THEN
    PERFORM net.http_post(
      url := 'https://loepcagitrijlfksawfm.supabase.co/functions/v1/send-affiliate-welcome',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpbWhucGlucHN3bGh6aWZjZm52Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1NTU1MTYsImV4cCI6MjA4MzEzMTUxNn0.LLYu3z6Mc2-_rdSDrnlo3PVJHnuCjuec0sxlOKmz6fk'
      ),
      body := jsonb_build_object(
        'user_id', NEW.user_id,
        'referral_code', NEW.referral_code
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to send welcome email after referral_code is set
DROP TRIGGER IF EXISTS send_affiliate_welcome_email_trigger ON public.profiles;
CREATE TRIGGER send_affiliate_welcome_email_trigger
  AFTER INSERT OR UPDATE OF referral_code ON public.profiles
  FOR EACH ROW
  WHEN (NEW.referral_code IS NOT NULL AND NEW.referral_code != '')
  EXECUTE FUNCTION public.send_affiliate_welcome_email();