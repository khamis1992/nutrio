-- Create meal_allergens junction table linking meals to structured allergen tags
CREATE TABLE IF NOT EXISTS meal_allergens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_id UUID NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  allergen_id UUID NOT NULL REFERENCES allergen_tags(id) ON DELETE CASCADE,
  severity TEXT CHECK (severity IN ('mild', 'moderate', 'severe')) DEFAULT 'moderate',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(meal_id, allergen_id)
);

-- Create index for fast meal-to-allergen lookups
CREATE INDEX IF NOT EXISTS idx_meal_allergens_meal_id ON meal_allergens(meal_id);
CREATE INDEX IF NOT EXISTS idx_meal_allergens_allergen_id ON meal_allergens(allergen_id);

-- Enable RLS
ALTER TABLE meal_allergens ENABLE ROW LEVEL SECURITY;

-- Public read access for allergens (users need to see allergens on meals)
CREATE POLICY "Meal allergens are publicly readable"
  ON meal_allergens FOR SELECT
  USING (true);

-- Partners/admins manage allergen mappings
CREATE POLICY "Authenticated users can manage meal allergens"
  ON meal_allergens FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update meal allergens"
  ON meal_allergens FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete meal allergens"
  ON meal_allergens FOR DELETE
  USING (auth.role() = 'authenticated');

-- Seed common allergen tags if the table is empty
INSERT INTO allergen_tags (name, name_ar, severity, description)
SELECT * FROM (VALUES
  ('Dairy', 'ألبان', 'moderate', 'Milk, cheese, yogurt, and other dairy products'),
  ('Eggs', 'بيض', 'moderate', 'Eggs and egg-containing products'),
  ('Fish', 'سمك', 'severe', 'All types of fish and fish products'),
  ('Shellfish', 'محار', 'severe', 'Shrimp, crab, lobster, and other shellfish'),
  ('Tree Nuts', 'مكسرات', 'severe', 'Almonds, walnuts, cashews, and other tree nuts'),
  ('Peanuts', 'فول سوداني', 'severe', 'Peanuts and peanut-containing products'),
  ('Wheat', 'قمح', 'moderate', 'Wheat and wheat-based products including bread and pasta'),
  ('Soy', 'صويا', 'moderate', 'Soybeans, tofu, soy sauce, and soy-based products'),
  ('Gluten', 'جلوتين', 'moderate', 'Gluten found in wheat, barley, and rye')
) AS v(name, name_ar, severity, description)
WHERE NOT EXISTS (SELECT 1 FROM allergen_tags LIMIT 1);
