INSERT INTO public.platform_settings (key, value, description)
VALUES (
  'contact_settings',
  '{
    "support_email": "support@nutrio.me",
    "phone": "+974 4000 0000",
    "address_en": "Doha, Qatar",
    "address_ar": "الدوحة، قطر",
    "map_url": "https://maps.google.com/?q=Doha,Qatar",
    "hours_en": "Support Hours: 8AM - 10PM (Qatar)",
    "hours_ar": "ساعات الدعم: 8 صباحاً - 10 مساءً (قطر)"
  }'::jsonb,
  'Public contact page details managed by administrators'
)
ON CONFLICT (key) DO NOTHING;

DROP POLICY IF EXISTS "Public can view contact settings" ON public.platform_settings;
CREATE POLICY "Public can view contact settings"
ON public.platform_settings
FOR SELECT
TO anon, authenticated
USING (key = 'contact_settings');
