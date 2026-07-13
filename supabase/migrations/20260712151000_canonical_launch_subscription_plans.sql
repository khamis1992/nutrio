-- Canonical Qatar launch catalog. public.subscription_plans is the single
-- source of truth used by checkout, wallet upgrades, admin, and customer UI.
ALTER TABLE public.subscription_plans
  DROP CONSTRAINT IF EXISTS subscription_plans_tier_check,
  DROP CONSTRAINT IF EXISTS subscription_plans_billing_interval_check;

ALTER TABLE public.subscription_plans
  ADD CONSTRAINT subscription_plans_tier_check
    CHECK (tier IN ('weekly', 'fresh', 'healthy', 'elite', 'basic', 'standard', 'premium', 'vip')),
  ADD CONSTRAINT subscription_plans_billing_interval_check
    CHECK (billing_interval IN ('weekly', 'monthly', 'annual'));

ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_billing_interval_check;
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_billing_interval_check
    CHECK (billing_interval IN ('weekly', 'monthly', 'annual'));

UPDATE public.subscription_plans
SET is_active = false,
    updated_at = now()
WHERE tier NOT IN ('weekly', 'fresh', 'healthy', 'elite')
   OR billing_interval NOT IN ('weekly', 'monthly');

INSERT INTO public.subscription_plans (
  tier, billing_interval, price_qar, meals_per_month, meals_per_week,
  snacks_per_month, daily_meals, daily_snacks, discount_percent, features,
  name_ar, description, description_en, short_description,
  short_description_ar, is_active, updated_at
) VALUES
  ('weekly', 'weekly', 450, 5, 5, 10, 1, 2, 0,
   '["5 meals", "10 snacks", "Flexible weekly renewal", "Nutrition tracking"]'::jsonb,
   'دفعة أسبوعية', 'خطة أسبوعية مرنة للبدء', 'A flexible one-week plan to get started',
   '5 meals and 10 snacks each week', '5 وجبات و10 وجبات خفيفة أسبوعياً', true, now()),
  ('fresh', 'monthly', 1800, 20, 5, 40, 1, 2, 0,
   '["20 meals", "40 snacks", "Nutrition tracking", "Flexible scheduling"]'::jsonb,
   'بداية منعشة', 'خطة شهرية خفيفة لبناء عادات صحية', 'A lighter monthly plan for building healthy habits',
   '20 meals and 40 snacks per month', '20 وجبة و40 وجبة خفيفة شهرياً', true, now()),
  ('healthy', 'monthly', 2800, 40, 10, 40, 2, 2, 0,
   '["40 meals", "40 snacks", "AI recommendations", "Weekly planning", "Priority support"]'::jsonb,
   'توازن صحي', 'توازن يومي بين الوجبات والتغذية الذكية', 'Daily balance with smart nutrition guidance',
   '40 meals and 40 snacks per month', '40 وجبة و40 وجبة خفيفة شهرياً', true, now()),
  ('elite', 'monthly', 3800, 60, 15, 40, 2, 2, 0,
   '["60 meals", "40 snacks", "Premium meal selection", "Priority delivery", "Personalized support"]'::jsonb,
   'نخبة نوتريو', 'الخطة الشهرية الأكثر شمولاً', 'The most complete Nutrio monthly plan',
   '60 meals and 40 snacks per month', '60 وجبة و40 وجبة خفيفة شهرياً', true, now())
ON CONFLICT (tier, billing_interval) DO UPDATE SET
  price_qar = EXCLUDED.price_qar,
  meals_per_month = EXCLUDED.meals_per_month,
  meals_per_week = EXCLUDED.meals_per_week,
  snacks_per_month = EXCLUDED.snacks_per_month,
  daily_meals = EXCLUDED.daily_meals,
  daily_snacks = EXCLUDED.daily_snacks,
  discount_percent = EXCLUDED.discount_percent,
  features = EXCLUDED.features,
  name_ar = EXCLUDED.name_ar,
  description = EXCLUDED.description,
  description_en = EXCLUDED.description_en,
  short_description = EXCLUDED.short_description,
  short_description_ar = EXCLUDED.short_description_ar,
  is_active = true,
  updated_at = now();
