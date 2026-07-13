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
DROP POLICY IF EXISTS "Meal allergens are publicly readable" ON meal_allergens;
CREATE POLICY "Meal allergens are publicly readable"
  ON meal_allergens FOR SELECT
  USING (true);

-- Partners/admins manage allergen mappings
DROP POLICY IF EXISTS "Authenticated users can manage meal allergens" ON meal_allergens;
CREATE POLICY "Authenticated users can manage meal allergens"
  ON meal_allergens FOR INSERT
  WITH CHECK (
    public.has_role((SELECT auth.uid()), 'admin')
    OR EXISTS (
      SELECT 1
      FROM public.meals m
      JOIN public.restaurants r ON r.id = m.restaurant_id
      WHERE m.id = meal_allergens.meal_id
        AND r.owner_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Authenticated users can update meal allergens" ON meal_allergens;
CREATE POLICY "Authenticated users can update meal allergens"
  ON meal_allergens FOR UPDATE
  USING (
    public.has_role((SELECT auth.uid()), 'admin')
    OR EXISTS (
      SELECT 1
      FROM public.meals m
      JOIN public.restaurants r ON r.id = m.restaurant_id
      WHERE m.id = meal_allergens.meal_id
        AND r.owner_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    public.has_role((SELECT auth.uid()), 'admin')
    OR EXISTS (
      SELECT 1
      FROM public.meals m
      JOIN public.restaurants r ON r.id = m.restaurant_id
      WHERE m.id = meal_allergens.meal_id
        AND r.owner_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Authenticated users can delete meal allergens" ON meal_allergens;
CREATE POLICY "Authenticated users can delete meal allergens"
  ON meal_allergens FOR DELETE
  USING (
    public.has_role((SELECT auth.uid()), 'admin')
    OR EXISTS (
      SELECT 1
      FROM public.meals m
      JOIN public.restaurants r ON r.id = m.restaurant_id
      WHERE m.id = meal_allergens.meal_id
        AND r.owner_id = (SELECT auth.uid())
    )
  );

-- Seed common allergen tags if the table is empty
INSERT INTO allergen_tags (name, name_ar, severity, description)
SELECT * FROM (VALUES
  ('Dairy', 'ألبان', 'medium', 'Milk, cheese, yogurt, and other dairy products'),
  ('Eggs', 'بيض', 'medium', 'Eggs and egg-containing products'),
  ('Fish', 'سمك', 'high', 'All types of fish and fish products'),
  ('Shellfish', 'محار', 'high', 'Shrimp, crab, lobster, and other shellfish'),
  ('Tree Nuts', 'مكسرات', 'high', 'Almonds, walnuts, cashews, and other tree nuts'),
  ('Peanuts', 'فول سوداني', 'high', 'Peanuts and peanut-containing products'),
  ('Wheat', 'قمح', 'medium', 'Wheat and wheat-based products including bread and pasta'),
  ('Soy', 'صويا', 'medium', 'Soybeans, tofu, soy sauce, and soy-based products'),
  ('Gluten', 'جلوتين', 'medium', 'Gluten found in wheat, barley, and rye')
) AS v(name, name_ar, severity, description)
WHERE NOT EXISTS (SELECT 1 FROM allergen_tags LIMIT 1);
