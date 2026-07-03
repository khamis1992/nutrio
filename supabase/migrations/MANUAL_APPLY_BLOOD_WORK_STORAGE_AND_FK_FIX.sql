-- Apply this file manually in the Supabase SQL Editor for project loepcagitrijlfksawfm.
-- It creates the missing blood-work tables, marker definitions, RLS policies, and
-- the PDF-only blood-reports storage bucket used by the app.

CREATE TABLE IF NOT EXISTS public.blood_work_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lab_name TEXT,
  test_date DATE NOT NULL,
  fasting BOOLEAN DEFAULT true,
  report_url TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'analyzed', 'error')),
  ai_analysis TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.blood_markers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL REFERENCES public.blood_work_records(id) ON DELETE CASCADE,
  marker_name TEXT NOT NULL,
  marker_name_ar TEXT,
  value NUMERIC(10, 2) NOT NULL,
  unit TEXT NOT NULL,
  normal_min NUMERIC(10, 2),
  normal_max NUMERIC(10, 2),
  status TEXT DEFAULT 'normal' CHECK (status IN ('low', 'normal', 'high', 'critical')),
  category TEXT DEFAULT 'metabolic' CHECK (
    category IN ('metabolic', 'lipid', 'liver', 'kidney', 'thyroid', 'vitamins', 'hormones', 'blood', 'inflammation')
  ),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.blood_marker_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  marker_name TEXT NOT NULL UNIQUE,
  marker_name_ar TEXT,
  unit TEXT NOT NULL,
  normal_min NUMERIC(10, 2),
  normal_max NUMERIC(10, 2),
  category TEXT NOT NULL CHECK (
    category IN ('metabolic', 'lipid', 'liver', 'kidney', 'thyroid', 'vitamins', 'hormones', 'blood', 'inflammation')
  ),
  description TEXT,
  description_ar TEXT
);

DO $$
DECLARE
  v_constraint_name TEXT;
  v_referenced_table TEXT;
BEGIN
  SELECT con.conname, referenced_nsp.nspname || '.' || referenced_rel.relname
  INTO v_constraint_name, v_referenced_table
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  JOIN pg_class referenced_rel ON referenced_rel.oid = con.confrelid
  JOIN pg_namespace referenced_nsp ON referenced_nsp.oid = referenced_rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'blood_work_records'
    AND con.contype = 'f'
    AND con.conkey = ARRAY[
      (
        SELECT attnum
        FROM pg_attribute
        WHERE attrelid = rel.oid
          AND attname = 'user_id'
      )
    ];

  IF v_constraint_name IS NOT NULL AND v_referenced_table <> 'auth.users' THEN
    EXECUTE format('ALTER TABLE public.blood_work_records DROP CONSTRAINT %I', v_constraint_name);
    v_constraint_name := NULL;
  END IF;

  IF v_constraint_name IS NULL THEN
    ALTER TABLE public.blood_work_records
      ADD CONSTRAINT blood_work_records_user_id_fkey
      FOREIGN KEY (user_id)
      REFERENCES auth.users(id)
      ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_blood_work_records_user
  ON public.blood_work_records(user_id, test_date DESC);
CREATE INDEX IF NOT EXISTS idx_blood_markers_record
  ON public.blood_markers(record_id);
CREATE INDEX IF NOT EXISTS idx_blood_markers_category
  ON public.blood_markers(record_id, category);

ALTER TABLE public.blood_work_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blood_markers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blood_marker_definitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own blood work records" ON public.blood_work_records;
CREATE POLICY "Users can view own blood work records"
  ON public.blood_work_records FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own blood work records" ON public.blood_work_records;
CREATE POLICY "Users can insert own blood work records"
  ON public.blood_work_records FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own blood work records" ON public.blood_work_records;
CREATE POLICY "Users can update own blood work records"
  ON public.blood_work_records FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own blood work records" ON public.blood_work_records;
CREATE POLICY "Users can delete own blood work records"
  ON public.blood_work_records FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own blood markers" ON public.blood_markers;
CREATE POLICY "Users can view own blood markers"
  ON public.blood_markers FOR SELECT
  TO authenticated
  USING (
    record_id IN (
      SELECT id FROM public.blood_work_records WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert own blood markers" ON public.blood_markers;
CREATE POLICY "Users can insert own blood markers"
  ON public.blood_markers FOR INSERT
  TO authenticated
  WITH CHECK (
    record_id IN (
      SELECT id FROM public.blood_work_records WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update own blood markers" ON public.blood_markers;
CREATE POLICY "Users can update own blood markers"
  ON public.blood_markers FOR UPDATE
  TO authenticated
  USING (
    record_id IN (
      SELECT id FROM public.blood_work_records WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    record_id IN (
      SELECT id FROM public.blood_work_records WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete own blood markers" ON public.blood_markers;
CREATE POLICY "Users can delete own blood markers"
  ON public.blood_markers FOR DELETE
  TO authenticated
  USING (
    record_id IN (
      SELECT id FROM public.blood_work_records WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Anyone can read marker definitions" ON public.blood_marker_definitions;
CREATE POLICY "Anyone can read marker definitions"
  ON public.blood_marker_definitions FOR SELECT
  TO authenticated, anon
  USING (true);

INSERT INTO public.blood_marker_definitions
  (marker_name, marker_name_ar, unit, normal_min, normal_max, category, description)
VALUES
  ('Glucose', 'Glucose', 'mg/dL', 70, 100, 'metabolic', 'Blood sugar level'),
  ('HbA1c', 'HbA1c', '%', NULL, 5.7, 'metabolic', 'Average blood sugar over 3 months'),
  ('Insulin', 'Insulin', 'uIU/mL', 2.6, 24.9, 'metabolic', 'Fasting insulin level'),
  ('Fasting Glucose', 'Fasting Glucose', 'mg/dL', 70, 100, 'metabolic', 'Fasting blood glucose'),
  ('Total Cholesterol', 'Total Cholesterol', 'mg/dL', NULL, 200, 'lipid', 'Total blood cholesterol'),
  ('LDL', 'LDL', 'mg/dL', NULL, 100, 'lipid', 'Low-density lipoprotein cholesterol'),
  ('HDL', 'HDL', 'mg/dL', 40, NULL, 'lipid', 'High-density lipoprotein cholesterol'),
  ('Triglycerides', 'Triglycerides', 'mg/dL', NULL, 150, 'lipid', 'Blood triglycerides'),
  ('VLDL', 'VLDL', 'mg/dL', 2, 38, 'lipid', 'Very low-density lipoprotein'),
  ('ALT', 'ALT', 'U/L', 7, 56, 'liver', 'Alanine aminotransferase'),
  ('AST', 'AST', 'U/L', 10, 40, 'liver', 'Aspartate aminotransferase'),
  ('Albumin', 'Albumin', 'g/dL', 3.5, 5.5, 'liver', 'Blood albumin protein'),
  ('Bilirubin Total', 'Bilirubin Total', 'mg/dL', 0.1, 1.2, 'liver', 'Total bilirubin'),
  ('GGT', 'GGT', 'U/L', 9, 48, 'liver', 'Gamma-glutamyl transferase'),
  ('ALP', 'ALP', 'U/L', 44, 147, 'liver', 'Alkaline phosphatase'),
  ('Creatinine', 'Creatinine', 'mg/dL', 0.7, 1.3, 'kidney', 'Blood creatinine'),
  ('BUN', 'BUN', 'mg/dL', 7, 20, 'kidney', 'Blood urea nitrogen'),
  ('eGFR', 'eGFR', 'mL/min', 60, NULL, 'kidney', 'Estimated glomerular filtration rate'),
  ('Uric Acid', 'Uric Acid', 'mg/dL', 2.5, 7.0, 'kidney', 'Blood uric acid'),
  ('TSH', 'TSH', 'mIU/L', 0.4, 4.0, 'thyroid', 'Thyroid stimulating hormone'),
  ('T3', 'T3', 'ng/dL', 80, 200, 'thyroid', 'Triiodothyronine'),
  ('T4', 'T4', 'ug/dL', 5.0, 12.0, 'thyroid', 'Thyroxine'),
  ('Free T4', 'Free T4', 'ng/dL', 0.8, 1.8, 'thyroid', 'Free thyroxine'),
  ('Vitamin D', 'Vitamin D', 'ng/mL', 30, 100, 'vitamins', '25-hydroxyvitamin D'),
  ('Vitamin B12', 'Vitamin B12', 'pg/mL', 200, 900, 'vitamins', 'Vitamin B12 level'),
  ('Iron', 'Iron', 'ug/dL', 60, 170, 'vitamins', 'Serum iron'),
  ('Ferritin', 'Ferritin', 'ng/mL', 12, 150, 'vitamins', 'Iron storage protein'),
  ('Folate', 'Folate', 'ng/mL', 3.0, 17.0, 'vitamins', 'Folic acid / Vitamin B9'),
  ('Testosterone', 'Testosterone', 'ng/dL', 300, 1000, 'hormones', 'Total testosterone'),
  ('Cortisol', 'Cortisol', 'ug/dL', 6.0, 23.0, 'hormones', 'Morning cortisol level'),
  ('DHEA-S', 'DHEA-S', 'ug/dL', 35, 430, 'hormones', 'Dehydroepiandrosterone sulfate'),
  ('Prolactin', 'Prolactin', 'ng/mL', 2, 18, 'hormones', 'Prolactin hormone'),
  ('Hemoglobin', 'Hemoglobin', 'g/dL', 13.5, 17.5, 'blood', 'Blood hemoglobin'),
  ('WBC', 'WBC', 'x10^3/uL', 4.5, 11.0, 'blood', 'White blood cell count'),
  ('RBC', 'RBC', 'x10^6/uL', 4.5, 5.9, 'blood', 'Red blood cell count'),
  ('Platelets', 'Platelets', 'x10^3/uL', 150, 450, 'blood', 'Platelet count'),
  ('Hematocrit', 'Hematocrit', '%', 41, 50, 'blood', 'Hematocrit / packed cell volume'),
  ('MCV', 'MCV', 'fL', 80, 100, 'blood', 'Mean corpuscular volume'),
  ('CRP', 'CRP', 'mg/L', NULL, 3.0, 'inflammation', 'C-reactive protein'),
  ('ESR', 'ESR', 'mm/hr', 0, 20, 'inflammation', 'Erythrocyte sedimentation rate'),
  ('Fibrinogen', 'Fibrinogen', 'mg/dL', 200, 400, 'inflammation', 'Blood fibrinogen')
ON CONFLICT (marker_name) DO UPDATE SET
  marker_name_ar = EXCLUDED.marker_name_ar,
  unit = EXCLUDED.unit,
  normal_min = EXCLUDED.normal_min,
  normal_max = EXCLUDED.normal_max,
  category = EXCLUDED.category,
  description = EXCLUDED.description;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'blood-reports',
  'blood-reports',
  true,
  10485760,
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['application/pdf'];

DROP POLICY IF EXISTS "Users can upload their own blood reports" ON storage.objects;
CREATE POLICY "Users can upload their own blood reports"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'blood-reports'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can read their own blood reports" ON storage.objects;
CREATE POLICY "Users can read their own blood reports"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'blood-reports'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can update their own blood reports" ON storage.objects;
CREATE POLICY "Users can update their own blood reports"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'blood-reports'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'blood-reports'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can delete their own blood reports" ON storage.objects;
CREATE POLICY "Users can delete their own blood reports"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'blood-reports'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Public read access for blood reports" ON storage.objects;
CREATE POLICY "Public read access for blood reports"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'blood-reports');
