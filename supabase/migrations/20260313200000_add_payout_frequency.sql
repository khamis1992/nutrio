ALTER TABLE public.restaurant_details
ADD COLUMN IF NOT EXISTS payout_frequency TEXT DEFAULT 'weekly'
  CHECK (payout_frequency IN ('weekly', 'biweekly', 'monthly'));
