-- Create barcode_products table for caching Open Food Facts lookups
CREATE TABLE IF NOT EXISTS public.barcode_products (
  barcode TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  brand TEXT,
  calories_per_100g NUMERIC(6,1) DEFAULT 0,
  protein_per_100g NUMERIC(5,1) DEFAULT 0,
  carbs_per_100g NUMERIC(5,1) DEFAULT 0,
  fat_per_100g NUMERIC(5,1) DEFAULT 0,
  fiber_per_100g NUMERIC(5,1) DEFAULT 0,
  image_url TEXT,
  raw_response JSONB,
  last_fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_barcode_products_last_fetched ON public.barcode_products(last_fetched_at);

ALTER TABLE public.barcode_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read barcode cache"
  ON public.barcode_products;
CREATE POLICY "Authenticated users can read barcode cache"
  ON public.barcode_products FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Service role can insert barcode cache"
  ON public.barcode_products;
CREATE POLICY "Service role can insert barcode cache"
  ON public.barcode_products FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can update barcode cache"
  ON public.barcode_products;
CREATE POLICY "Service role can update barcode cache"
  ON public.barcode_products FOR UPDATE
  USING (auth.role() = 'service_role');
