-- Create function to send milestone notification via edge function
CREATE OR REPLACE FUNCTION public.notify_milestone_achievement()
RETURNS TRIGGER AS $$
DECLARE
  milestone_data RECORD;
BEGIN
  -- Get milestone details
  SELECT name, description, bonus_amount, referral_count
  INTO milestone_data
  FROM referral_milestones
  WHERE id = NEW.milestone_id;
  
  -- Call the edge function using pg_net
  PERFORM net.http_post(
    url := 'https://loepcagitrijlfksawfm.supabase.co/functions/v1/send-milestone-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpbWhucGlucHN3bGh6aWZjZm52Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1NTU1MTYsImV4cCI6MjA4MzEzMTUxNn0.LLYu3z6Mc2-_rdSDrnlo3PVJHnuCjuec0sxlOKmz6fk'
    ),
    body := jsonb_build_object(
      'user_id', NEW.user_id,
      'milestone_name', milestone_data.name,
      'milestone_description', COALESCE(milestone_data.description, ''),
      'bonus_amount', milestone_data.bonus_amount,
      'referral_count', milestone_data.referral_count
    )
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to send notification after milestone achievement is inserted
DROP TRIGGER IF EXISTS notify_milestone_achievement_trigger ON public.user_milestone_achievements;
CREATE TRIGGER notify_milestone_achievement_trigger
  AFTER INSERT ON public.user_milestone_achievements
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_milestone_achievement();