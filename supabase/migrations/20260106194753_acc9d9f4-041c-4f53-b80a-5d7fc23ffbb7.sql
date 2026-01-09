-- Add subscription tier column to subscriptions table
ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'standard';

-- Add VIP settings to platform_settings
INSERT INTO public.platform_settings (key, value, description)
VALUES (
  'vip_settings',
  '{
    "vip_price": 199.99,
    "vip_benefits": {
      "priority_delivery": true,
      "exclusive_meals": true,
      "personal_coaching": true,
      "free_delivery": true,
      "early_access": true,
      "dedicated_support": true
    }
  }'::jsonb,
  'VIP subscription tier settings and benefits'
)
ON CONFLICT (key) DO NOTHING;