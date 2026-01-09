-- Create function to notify partner when restaurant status changes
CREATE OR REPLACE FUNCTION public.notify_partner_on_restaurant_status()
RETURNS TRIGGER AS $$
DECLARE
  notification_title TEXT;
  notification_message TEXT;
BEGIN
  -- Only trigger on status change
  IF OLD.approval_status IS DISTINCT FROM NEW.approval_status THEN
    IF NEW.approval_status = 'approved' THEN
      notification_title := 'Restaurant Approved!';
      notification_message := 'Great news! Your restaurant "' || NEW.name || '" has been approved and is now live on the platform.';
    ELSIF NEW.approval_status = 'rejected' THEN
      notification_title := 'Restaurant Not Approved';
      notification_message := 'Unfortunately, your restaurant "' || NEW.name || '" was not approved. Please contact support for more information.';
    ELSE
      RETURN NEW;
    END IF;

    -- Create notification for partner
    IF NEW.owner_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, message, metadata)
      VALUES (
        NEW.owner_id,
        'restaurant_status',
        notification_title,
        notification_message,
        jsonb_build_object('restaurant_id', NEW.id, 'status', NEW.approval_status)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger
DROP TRIGGER IF EXISTS on_restaurant_status_change ON public.restaurants;
CREATE TRIGGER on_restaurant_status_change
  AFTER UPDATE ON public.restaurants
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_partner_on_restaurant_status();