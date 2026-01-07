-- Update notifications_type_check constraint to include 'new_order'
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check 
CHECK (type = ANY (ARRAY['order_update'::text, 'meal_reminder'::text, 'subscription_alert'::text, 'general'::text, 'new_order'::text]));