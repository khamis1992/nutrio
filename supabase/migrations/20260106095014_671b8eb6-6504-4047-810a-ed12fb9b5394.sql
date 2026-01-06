-- Allow anyone to read features settings (for feature toggles on frontend)
CREATE POLICY "Anyone can view features settings"
ON public.platform_settings
FOR SELECT
USING (key = 'features');