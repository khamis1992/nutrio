-- Create platform settings table
CREATE TABLE public.platform_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT '{}',
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can view settings
CREATE POLICY "Admins can view platform settings"
ON public.platform_settings
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can update settings
CREATE POLICY "Admins can update platform settings"
ON public.platform_settings
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can insert settings
CREATE POLICY "Admins can insert platform settings"
ON public.platform_settings
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Add trigger for updated_at
CREATE TRIGGER update_platform_settings_updated_at
BEFORE UPDATE ON public.platform_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default settings
INSERT INTO public.platform_settings (key, value, description) VALUES
('commission_rates', '{"restaurant": 15, "delivery": 5}', 'Commission rates in percentage'),
('features', '{"referral_program": true, "meal_scheduling": true, "subscription_pause": true, "delivery_tracking": true}', 'Feature toggles'),
('subscription_plans', '{"basic_price": 49.99, "premium_price": 99.99, "family_price": 149.99}', 'Subscription plan pricing'),
('notifications', '{"email_enabled": true, "push_enabled": true, "sms_enabled": false}', 'Notification settings');