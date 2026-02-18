-- WhatsApp Notification Triggers for Driver App Integration
-- This adds WhatsApp notifications using Ultramsg API

-- Create function to send WhatsApp notification via HTTP
CREATE OR REPLACE FUNCTION send_whatsapp_notification(
  p_phone TEXT,
  p_message TEXT,
  p_template TEXT DEFAULT 'custom'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_instance_id TEXT;
  v_api_token TEXT;
  v_api_url TEXT;
BEGIN
  -- Get Ultramsg credentials from environment (set via Supabase secrets)
  -- In production, these should be stored as encrypted secrets
  v_instance_id := current_setting('app.ultramsg_instance_id', true);
  v_api_token := current_setting('app.ultramsg_api_token', true);
  
  -- Skip if credentials not configured
  IF v_instance_id IS NULL OR v_api_token IS NULL THEN
    RAISE NOTICE 'WhatsApp credentials not configured, skipping notification';
    RETURN;
  END IF;
  
  -- Construct API URL
  v_api_url := format(
    'https://api.ultramsg.com/%s/messages/chat',
    v_instance_id
  );
  
  -- Note: Actual HTTP call would be made via Supabase Edge Function
  -- This function serves as a trigger handler that queues the notification
  
  -- Insert into notification queue for async processing
  INSERT INTO notification_queue (
    phone,
    message,
    template,
    status,
    created_at
  ) VALUES (
    p_phone,
    p_message,
    p_template,
    'pending',
    NOW()
  );
  
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error queueing WhatsApp notification: %', SQLERRM;
END;
$$;

-- Create notification queue table if not exists
CREATE TABLE IF NOT EXISTS notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  message TEXT NOT NULL,
  template TEXT DEFAULT 'custom',
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on notification queue
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;

-- Drop existing policy first
DROP POLICY IF EXISTS "Service role can manage notification queue" ON notification_queue;

-- Only allow service role to access notification queue
CREATE POLICY "Service role can manage notification queue"
  ON notification_queue
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create index for pending notifications
CREATE INDEX IF NOT EXISTS idx_notification_queue_pending 
  ON notification_queue (status, created_at) 
  WHERE status = 'pending';

-- Function to handle delivery status changes and send notifications
CREATE OR REPLACE FUNCTION handle_delivery_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_customer_phone TEXT;
  v_customer_name TEXT;
  v_driver_name TEXT;
  v_restaurant_name TEXT;
  v_meal_name TEXT;
  v_message TEXT;
  v_delivery_address TEXT;
BEGIN
  -- Get customer information from meal_schedule
  SELECT 
    ua.phone,
    COALESCE(p.full_name, 'Customer'),
    ms.meal_name
  INTO v_customer_phone, v_customer_name, v_meal_name
  FROM meal_schedules ms
  LEFT JOIN profiles p ON p.user_id = ms.user_id
  LEFT JOIN user_addresses ua ON ua.user_id = ms.user_id AND ua.is_default = true
  WHERE ms.id = NEW.schedule_id;
  
  -- Get restaurant name
  SELECT r.name INTO v_restaurant_name
  FROM restaurants r
  WHERE r.id = NEW.restaurant_id;
  
  -- Get driver name if assigned
  SELECT p.full_name INTO v_driver_name
  FROM drivers d
  LEFT JOIN profiles p ON p.user_id = d.user_id
  WHERE d.id = NEW.driver_id;
  
  -- Handle different status changes
  CASE NEW.status
    WHEN 'pending' THEN
      -- New delivery created - notify customer
      IF v_customer_phone IS NOT NULL THEN
        v_message := format(
          'Hello %s! Your meal "%s" from %s is being prepared. We will notify you when a driver is assigned.',
          v_customer_name,
          v_meal_name,
          v_restaurant_name
        );
        PERFORM send_whatsapp_notification(v_customer_phone, v_message, 'order_preparing');
      END IF;
      
    WHEN 'claimed' THEN
      -- Driver claimed - notify customer
      IF v_customer_phone IS NOT NULL AND v_driver_name IS NOT NULL THEN
        v_message := format(
          'Great news %s! Driver %s has been assigned to deliver your "%s" from %s. You will receive another notification when they are on the way.',
          v_customer_name,
          v_driver_name,
          v_meal_name,
          v_restaurant_name
        );
        PERFORM send_whatsapp_notification(v_customer_phone, v_message, 'driver_assigned');
      END IF;
      
    WHEN 'picked_up' THEN
      -- Driver picked up - notify customer
      IF v_customer_phone IS NOT NULL THEN
        v_message := format(
          'Hi %s! Your "%s" has been picked up from %s and is on the way to you. Estimated delivery: 20-30 minutes.',
          v_customer_name,
          v_meal_name,
          v_restaurant_name
        );
        PERFORM send_whatsapp_notification(v_customer_phone, v_message, 'order_picked_up');
      END IF;
      
    WHEN 'on_the_way' THEN
      -- Driver on the way - notify customer
      IF v_customer_phone IS NOT NULL THEN
        v_message := format(
          'Your %s from %s is almost there! The driver is on the way to your location.',
          v_meal_name,
          v_restaurant_name
        );
        PERFORM send_whatsapp_notification(v_customer_phone, v_message, 'driver_nearby');
      END IF;
      
    WHEN 'delivered' THEN
      -- Delivery complete - notify customer
      IF v_customer_phone IS NOT NULL THEN
        v_message := format(
          'Hello %s! Your "%s" from %s has been delivered. Enjoy your meal! Thank you for using NutrioFuel.',
          v_customer_name,
          v_meal_name,
          v_restaurant_name
        );
        PERFORM send_whatsapp_notification(v_customer_phone, v_message, 'order_delivered');
      END IF;
      
    WHEN 'cancelled' THEN
      -- Delivery cancelled - notify customer
      IF v_customer_phone IS NOT NULL THEN
        v_message := format(
          'We apologize %s. Your delivery for "%s" from %s has been cancelled. Please contact support for assistance.',
          v_customer_name,
          v_meal_name,
          v_restaurant_name
        );
        PERFORM send_whatsapp_notification(v_customer_phone, v_message, 'order_cancelled');
      END IF;
  END CASE;
  
  RETURN NEW;
END;
$$;

-- Create trigger for delivery status changes
DROP TRIGGER IF EXISTS tr_delivery_status_notification ON deliveries;
CREATE TRIGGER tr_delivery_status_notification
  AFTER UPDATE OF status ON deliveries
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION handle_delivery_status_change();

-- Create trigger for new delivery creation
DROP TRIGGER IF EXISTS tr_delivery_created_notification ON deliveries;
CREATE TRIGGER tr_delivery_created_notification
  AFTER INSERT ON deliveries
  FOR EACH ROW
  EXECUTE FUNCTION handle_delivery_status_change();

-- Function to notify driver when new delivery is available
CREATE OR REPLACE FUNCTION notify_drivers_new_delivery()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_driver RECORD;
  v_restaurant_name TEXT;
  v_delivery_area TEXT;
BEGIN
  -- Only notify for pending deliveries
  IF NEW.status != 'pending' THEN
    RETURN NEW;
  END IF;
  
  -- Get restaurant info
  SELECT r.name INTO v_restaurant_name
  FROM restaurants r
  WHERE r.id = NEW.restaurant_id;
  
  -- Get delivery area (city from address)
  v_delivery_area := split_part(NEW.delivery_address, ',', 2);
  
  -- Notify all online drivers
  FOR v_driver IN
    SELECT d.id, d.user_id, p.full_name, p.phone
    FROM drivers d
    LEFT JOIN profiles p ON p.user_id = d.user_id
    WHERE d.is_online = true
      AND d.approval_status = 'approved'
  LOOP
    IF v_driver.phone IS NOT NULL THEN
      PERFORM send_whatsapp_notification(
        v_driver.phone,
        format(
          'New delivery opportunity! Pickup from %s, delivery to %s. Delivery fee: QAR %s. Open the app to claim.',
          v_restaurant_name,
          trim(v_delivery_area),
          NEW.delivery_fee
        ),
        'new_delivery_available'
      );
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Create trigger for new delivery notifications to drivers
DROP TRIGGER IF EXISTS tr_notify_drivers_new_delivery ON deliveries;
CREATE TRIGGER tr_notify_drivers_new_delivery
  AFTER INSERT ON deliveries
  FOR EACH ROW
  EXECUTE FUNCTION notify_drivers_new_delivery();

-- Function to notify partner when delivery is claimed
CREATE OR REPLACE FUNCTION notify_partner_delivery_claimed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_partner_phone TEXT;
  v_partner_name TEXT;
  v_driver_name TEXT;
  v_meal_name TEXT;
BEGIN
  -- Only proceed if driver was just assigned
  IF OLD.driver_id IS NOT NULL OR NEW.driver_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Get partner info from restaurant
  SELECT 
    r.phone,
    r.name,
    ms.meal_name
  INTO v_partner_phone, v_partner_name, v_meal_name
  FROM restaurants r
  JOIN meal_schedules ms ON ms.restaurant_id = r.id
  WHERE ms.id = NEW.schedule_id;
  
  -- Get driver name
  SELECT p.full_name INTO v_driver_name
  FROM drivers d
  LEFT JOIN profiles p ON p.user_id = d.user_id
  WHERE d.id = NEW.driver_id;
  
  -- Notify partner
  IF v_partner_phone IS NOT NULL THEN
    PERFORM send_whatsapp_notification(
      v_partner_phone,
      format(
        'Driver %s has been assigned to deliver "%s". Please prepare the order for pickup.',
        COALESCE(v_driver_name, 'A driver'),
        v_meal_name
      ),
      'driver_assigned_partner'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to notify partner when driver claims delivery
DROP TRIGGER IF EXISTS tr_notify_partner_delivery_claimed ON deliveries;
CREATE TRIGGER tr_notify_partner_delivery_claimed
  AFTER UPDATE OF driver_id ON deliveries
  FOR EACH ROW
  WHEN (OLD.driver_id IS DISTINCT FROM NEW.driver_id)
  EXECUTE FUNCTION notify_partner_delivery_claimed();

-- Add comment explaining configuration
COMMENT ON FUNCTION send_whatsapp_notification IS 
'Queues WhatsApp notifications. Requires Ultramsg credentials to be set via:
ALTER SYSTEM SET app.ultramsg_instance_id = ''your_instance_id'';
ALTER SYSTEM SET app.ultramsg_api_token = ''your_api_token'';
Or via Supabase Vault/Edge Function in production.';
