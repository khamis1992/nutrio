-- Allow anyone to view subscription pricing (for frontend display)
CREATE POLICY "Anyone can view subscription pricing" 
ON public.platform_settings 
FOR SELECT 
USING (key = 'subscription_plans');