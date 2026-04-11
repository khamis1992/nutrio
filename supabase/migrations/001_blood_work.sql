-- Blood Work Integration Migration

-- Main records table
CREATE TABLE IF NOT EXISTS blood_work_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lab_name TEXT,
  test_date DATE NOT NULL,
  fasting BOOLEAN DEFAULT TRUE,
  report_url TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'analyzed', 'error')),
  ai_analysis TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Individual marker results
CREATE TABLE IF NOT EXISTS blood_markers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  record_id UUID NOT NULL REFERENCES blood_work_records(id) ON DELETE CASCADE,
  marker_name TEXT NOT NULL,
  marker_name_ar TEXT,
  value DECIMAL(10,2) NOT NULL,
  unit TEXT NOT NULL,
  normal_min DECIMAL(10,2),
  normal_max DECIMAL(10,2),
  status TEXT DEFAULT 'normal' CHECK (status IN ('low', 'normal', 'high', 'critical')),
  category TEXT DEFAULT 'metabolic' CHECK (category IN ('metabolic', 'lipid', 'liver', 'kidney', 'thyroid', 'vitamins', 'hormones', 'blood', 'inflammation')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reference table of common blood markers with normal ranges
CREATE TABLE IF NOT EXISTS blood_marker_definitions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  marker_name TEXT NOT NULL UNIQUE,
  marker_name_ar TEXT,
  unit TEXT NOT NULL,
  normal_min DECIMAL(10,2),
  normal_max DECIMAL(10,2),
  category TEXT NOT NULL CHECK (category IN ('metabolic', 'lipid', 'liver', 'kidney', 'thyroid', 'vitamins', 'hormones', 'blood', 'inflammation')),
  description TEXT,
  description_ar TEXT
);

-- Insert common marker definitions
INSERT INTO blood_marker_definitions (marker_name, marker_name_ar, unit, normal_min, normal_max, category, description) VALUES
  -- Metabolic
  ('Glucose', 'الجلوكوز', 'mg/dL', 70, 100, 'metabolic', 'Blood sugar level'),
  ('HbA1c', 'السكري التراكمي', '%', NULL, 5.7, 'metabolic', 'Glycated hemoglobin - average blood sugar over 3 months'),
  ('Insulin', 'الأنسولين', 'µIU/mL', 2.6, 24.9, 'metabolic', 'Fasting insulin level'),
  ('Fasting Glucose', 'الجلوكوز الصائم', 'mg/dL', 70, 100, 'metabolic', 'Fasting blood glucose'),
  -- Lipid
  ('Total Cholesterol', 'الكوليسترول الكلي', 'mg/dL', NULL, 200, 'lipid', 'Total blood cholesterol'),
  ('LDL', 'الكوليسترول الضار', 'mg/dL', NULL, 100, 'lipid', 'Low-density lipoprotein cholesterol'),
  ('HDL', 'الكوليسترول النافع', 'mg/dL', 40, NULL, 'lipid', 'High-density lipoprotein cholesterol'),
  ('Triglycerides', 'الدهون الثلاثية', 'mg/dL', NULL, 150, 'lipid', 'Blood triglycerides'),
  ('VLDL', 'البروتين الدهني منخفض الكثافة', 'mg/dL', 2, 38, 'lipid', 'Very low-density lipoprotein'),
  -- Liver
  ('ALT', 'إنزيم الكبد ALT', 'U/L', 7, 56, 'liver', 'Alanine aminotransferase'),
  ('AST', 'إنزيم الكبد AST', 'U/L', 10, 40, 'liver', 'Aspartate aminotransferase'),
  ('Albumin', 'الألبومين', 'g/dL', 3.5, 5.5, 'liver', 'Blood albumin protein'),
  ('Bilirubin Total', 'البيليروبين الكلي', 'mg/dL', 0.1, 1.2, 'liver', 'Total bilirubin'),
  ('GGT', 'إنزيم GGT', 'U/L', 9, 48, 'liver', 'Gamma-glutamyl transferase'),
  ('ALP', 'إنزيم الفوسفاتاز القلوي', 'U/L', 44, 147, 'liver', 'Alkaline phosphatase'),
  -- Kidney
  ('Creatinine', 'الكرياتينين', 'mg/dL', 0.7, 1.3, 'kidney', 'Blood creatinine'),
  ('BUN', 'اليوريا في الدم', 'mg/dL', 7, 20, 'kidney', 'Blood urea nitrogen'),
  ('eGFR', 'معدل الترشيح الكبيبي', 'mL/min', 60, NULL, 'kidney', 'Estimated glomerular filtration rate'),
  ('Uric Acid', 'حمض اليوريك', 'mg/dL', 2.5, 7.0, 'kidney', 'Blood uric acid'),
  -- Thyroid
  ('TSH', 'الهرمون المنبه للدرقية', 'mIU/L', 0.4, 4.0, 'thyroid', 'Thyroid stimulating hormone'),
  ('T3', 'ثلاثي يودوثيرونين', 'ng/dL', 80, 200, 'thyroid', 'Triiodothyronine'),
  ('T4', 'ثيروكسين', 'µg/dL', 5.0, 12.0, 'thyroid', 'Thyroxine'),
  ('Free T4', 'ثيروكسين حر', 'ng/dL', 0.8, 1.8, 'thyroid', 'Free thyroxine'),
  -- Vitamins
  ('Vitamin D', 'فيتامين د', 'ng/mL', 30, 100, 'vitamins', '25-hydroxyvitamin D'),
  ('Vitamin B12', 'فيتامين ب12', 'pg/mL', 200, 900, 'vitamins', 'Vitamin B12 level'),
  ('Iron', 'الحديد', 'µg/dL', 60, 170, 'vitamins', 'Serum iron'),
  ('Ferritin', 'الفيريتين', 'ng/mL', 12, 150, 'vitamins', 'Iron storage protein'),
  ('Folate', 'الحمض الفولي', 'ng/mL', 3.0, 17.0, 'vitamins', 'Folic acid / Vitamin B9'),
  -- Hormones
  ('Testosterone', 'التستوستيرون', 'ng/dL', 300, 1000, 'hormones', 'Total testosterone'),
  ('Cortisol', 'الكورتيزول', 'µg/dL', 6.0, 23.0, 'hormones', 'Morning cortisol level'),
  ('DHEA-S', 'DHEA-S', 'µg/dL', 35, 430, 'hormones', 'Dehydroepiandrosterone sulfate'),
  ('Prolactin', 'البرولاكتين', 'ng/mL', 2, 18, 'hormones', 'Prolactin hormone'),
  -- Blood
  ('Hemoglobin', 'الهيموجلوبين', 'g/dL', 13.5, 17.5, 'blood', 'Blood hemoglobin'),
  ('WBC', 'خلايا الدم البيضاء', '×10³/µL', 4.5, 11.0, 'blood', 'White blood cell count'),
  ('RBC', 'خلايا الدم الحمراء', '×10⁶/µL', 4.5, 5.9, 'blood', 'Red blood cell count'),
  ('Platelets', 'الصفائح الدموية', '×10³/µL', 150, 450, 'blood', 'Platelet count'),
  ('Hematocrit', 'الهيماتوكريت', '%', 41, 50, 'blood', 'Hematocrit / packed cell volume'),
  ('MCV', 'متوسط حجم الكرية', 'fL', 80, 100, 'blood', 'Mean corpuscular volume'),
  -- Inflammation
  ('CRP', 'البروتين التفاعلي C', 'mg/L', NULL, 3.0, 'inflammation', 'C-reactive protein'),
  ('ESR', 'سرعة ترسب الدم', 'mm/hr', 0, 20, 'inflammation', 'Erythrocyte sedimentation rate'),
  ('Fibrinogen', 'الفايبرينوجين', 'mg/dL', 200, 400, 'inflammation', 'Blood fibrinogen')
ON CONFLICT (marker_name) DO NOTHING;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_blood_work_records_user ON blood_work_records(user_id, test_date DESC);
CREATE INDEX IF NOT EXISTS idx_blood_markers_record ON blood_markers(record_id);
CREATE INDEX IF NOT EXISTS idx_blood_markers_category ON blood_markers(record_id, category);

-- RLS
ALTER TABLE blood_work_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE blood_markers ENABLE ROW LEVEL SECURITY;
ALTER TABLE blood_marker_definitions ENABLE ROW LEVEL SECURITY;

-- Policies: users can only see their own data
CREATE POLICY "Users can view own blood work records" ON blood_work_records
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own blood work records" ON blood_work_records
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own blood work records" ON blood_work_records
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own blood work records" ON blood_work_records
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own blood markers" ON blood_markers
  FOR SELECT USING (
    record_id IN (SELECT id FROM blood_work_records WHERE user_id = auth.uid())
  );
CREATE POLICY "Users can insert own blood markers" ON blood_markers
  FOR INSERT WITH CHECK (
    record_id IN (SELECT id FROM blood_work_records WHERE user_id = auth.uid())
  );
CREATE POLICY "Users can update own blood markers" ON blood_markers
  FOR UPDATE USING (
    record_id IN (SELECT id FROM blood_work_records WHERE user_id = auth.uid())
  );
CREATE POLICY "Users can delete own blood markers" ON blood_markers
  FOR DELETE USING (
    record_id IN (SELECT id FROM blood_work_records WHERE user_id = auth.uid())
  );

-- Marker definitions are public read
CREATE POLICY "Anyone can read marker definitions" ON blood_marker_definitions
  FOR SELECT USING (true);
