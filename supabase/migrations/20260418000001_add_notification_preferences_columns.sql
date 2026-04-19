ALTER TABLE public.notification_preferences
ADD COLUMN IF NOT EXISTS order_updates BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS promotional_emails BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS weekly_summary BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS reminder_time TIME DEFAULT '08:00';