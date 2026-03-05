-- Water entries for granular water tracking (mL per drink)
CREATE TABLE IF NOT EXISTS public.water_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  amount_ml INTEGER NOT NULL CHECK (amount_ml > 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_water_entries_user_date ON public.water_entries(user_id, log_date DESC);

ALTER TABLE public.water_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own water entries"
  ON public.water_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own water entries"
  ON public.water_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own water entries"
  ON public.water_entries FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.water_entries IS 'Individual water intake entries in mL for detailed tracking';
