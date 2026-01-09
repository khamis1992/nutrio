-- Function to create notifications for order events
CREATE OR REPLACE FUNCTION public.notify_order_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  notification_title TEXT;
  notification_message TEXT;
  notification_type TEXT := 'order_update';
BEGIN
  -- Handle new order creation
  IF TG_OP = 'INSERT' THEN
    notification_title := 'Order Placed Successfully';
    notification_message := 'Your order #' || LEFT(NEW.id::text, 8) || ' has been placed and is being processed.';
    
    INSERT INTO public.notifications (user_id, type, title, message, metadata)
    VALUES (
      NEW.user_id,
      notification_type,
      notification_title,
      notification_message,
      jsonb_build_object('order_id', NEW.id, 'status', NEW.status)
    );
    
    RETURN NEW;
  END IF;
  
  -- Handle order status updates
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    CASE NEW.status
      WHEN 'confirmed' THEN
        notification_title := 'Order Confirmed';
        notification_message := 'Great news! Your order #' || LEFT(NEW.id::text, 8) || ' has been confirmed by the restaurant.';
      WHEN 'preparing' THEN
        notification_title := 'Order Being Prepared';
        notification_message := 'Your order #' || LEFT(NEW.id::text, 8) || ' is now being prepared.';
      WHEN 'delivered' THEN
        notification_title := 'Order Delivered';
        notification_message := 'Your order #' || LEFT(NEW.id::text, 8) || ' has been delivered. Enjoy your meal!';
      WHEN 'cancelled' THEN
        notification_title := 'Order Cancelled';
        notification_message := 'Your order #' || LEFT(NEW.id::text, 8) || ' has been cancelled.';
      ELSE
        notification_title := 'Order Update';
        notification_message := 'Your order #' || LEFT(NEW.id::text, 8) || ' status has been updated to ' || NEW.status || '.';
    END CASE;
    
    INSERT INTO public.notifications (user_id, type, title, message, metadata)
    VALUES (
      NEW.user_id,
      notification_type,
      notification_title,
      notification_message,
      jsonb_build_object('order_id', NEW.id, 'old_status', OLD.status, 'new_status', NEW.status)
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for order insert
CREATE TRIGGER on_order_created
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.notify_order_event();

-- Create trigger for order update
CREATE TRIGGER on_order_updated
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.notify_order_event();

-- Function to create notifications for subscription events
CREATE OR REPLACE FUNCTION public.notify_subscription_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  notification_title TEXT;
  notification_message TEXT;
  notification_type TEXT := 'subscription_alert';
BEGIN
  -- Handle new subscription
  IF TG_OP = 'INSERT' THEN
    notification_title := 'Subscription Activated';
    notification_message := 'Welcome! Your ' || NEW.plan || ' subscription is now active. Enjoy your healthy meals!';
    
    INSERT INTO public.notifications (user_id, type, title, message, metadata)
    VALUES (
      NEW.user_id,
      notification_type,
      notification_title,
      notification_message,
      jsonb_build_object('subscription_id', NEW.id, 'plan', NEW.plan, 'status', NEW.status)
    );
    
    RETURN NEW;
  END IF;
  
  -- Handle subscription status changes
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    CASE NEW.status
      WHEN 'active' THEN
        notification_title := 'Subscription Renewed';
        notification_message := 'Your ' || NEW.plan || ' subscription has been renewed successfully.';
      WHEN 'cancelled' THEN
        notification_title := 'Subscription Cancelled';
        notification_message := 'Your subscription has been cancelled. You can still use the service until ' || NEW.end_date || '.';
      WHEN 'expired' THEN
        notification_title := 'Subscription Expired';
        notification_message := 'Your subscription has expired. Renew now to continue enjoying our services!';
      ELSE
        notification_title := 'Subscription Update';
        notification_message := 'Your subscription status has been updated.';
    END CASE;
    
    INSERT INTO public.notifications (user_id, type, title, message, metadata)
    VALUES (
      NEW.user_id,
      notification_type,
      notification_title,
      notification_message,
      jsonb_build_object('subscription_id', NEW.id, 'plan', NEW.plan, 'old_status', OLD.status, 'new_status', NEW.status)
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for subscription insert
CREATE TRIGGER on_subscription_created
AFTER INSERT ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.notify_subscription_event();

-- Create trigger for subscription update
CREATE TRIGGER on_subscription_updated
AFTER UPDATE ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.notify_subscription_event();