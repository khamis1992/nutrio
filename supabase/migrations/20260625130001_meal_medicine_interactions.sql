-- Meal-to-Medicine Interaction Check
-- Tracks user medications + known food-drug interactions, checks meals against them.

-- 1. User medications
create table if not exists public.user_medications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  medication_name text not null,
  active_ingredient text not null,
  dosage text,
  frequency text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_medications_user on public.user_medications (user_id);

alter table public.user_medications enable row level security;

drop policy if exists "Users manage own medications" on public.user_medications;
create policy "Users manage own medications" on public.user_medications
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 2. Reference: known food–medicine interactions (seeded once, read-only for users)
create table if not exists public.food_medicine_interactions (
  id uuid primary key default gen_random_uuid(),
  active_ingredient text not null,
  food_ingredient text not null,
  severity text not null check (severity in ('mild', 'moderate', 'severe')),
  description text not null,
  recommendation text not null,
  category text not null default 'other' check (category in ('fruit', 'vegetable', 'dairy', 'grain', 'beverage', 'herb', 'protein', 'other')),
  created_at timestamptz not null default now(),
  unique (active_ingredient, food_ingredient)
);

alter table public.food_medicine_interactions enable row level security;

drop policy if exists "Interactions readable by all authenticated" on public.food_medicine_interactions;
create policy "Interactions readable by all authenticated" on public.food_medicine_interactions
  for select using (auth.role() = 'authenticated');

-- 3. Seed common food–drug interactions
insert into public.food_medicine_interactions (active_ingredient, food_ingredient, severity, description, recommendation, category) values
  ('atorvastatin', 'grapefruit', 'severe', 'Grapefruit can significantly increase statin levels in your blood, raising the risk of muscle damage and liver toxicity.', 'Avoid grapefruit and grapefruit juice while taking this medication.'),
  ('simvastatin', 'grapefruit', 'severe', 'Grapefruit can significantly increase statin levels in your blood, raising the risk of muscle damage and liver toxicity.', 'Avoid grapefruit and grapefruit juice while taking this medication.'),
  ('amlodipine', 'grapefruit', 'moderate', 'Grapefruit may increase the blood concentration of amlodipine, potentially causing dizziness, headache, and swelling.', 'Limit or avoid grapefruit consumption. Discuss with your doctor if symptoms appear.'),
  ('nifedipine', 'grapefruit', 'moderate', 'Grapefruit can increase nifedipine levels, potentially causing dangerously low blood pressure.', 'Avoid grapefruit and grapefruit juice while taking this medication.'),
  ('warfarin', 'kale', 'moderate', 'Vitamin K-rich foods can reduce the effectiveness of warfarin, increasing blood clot risk.', 'Maintain consistent vitamin K intake. Do not drastically increase or decrease leafy greens.'),
  ('warfarin', 'spinach', 'moderate', 'Vitamin K-rich foods can reduce the effectiveness of warfarin, increasing blood clot risk.', 'Maintain consistent vitamin K intake. Do not drastically increase or decrease leafy greens.'),
  ('warfarin', 'broccoli', 'moderate', 'Vitamin K-rich foods can reduce the effectiveness of warfarin, increasing blood clot risk.', 'Maintain consistent vitamin K intake. Do not drastically increase or decrease leafy greens.'),
  ('warfarin', 'brussels sprouts', 'moderate', 'Vitamin K-rich foods can reduce the effectiveness of warfarin, increasing blood clot risk.', 'Maintain consistent vitamin K intake. Do not drastically increase or decrease leafy greens.'),
  ('warfarin', 'cranberry', 'moderate', 'Cranberry may enhance the effect of warfarin, increasing bleeding risk.', 'Limit cranberry juice consumption and monitor for signs of bleeding.'),
  ('phenelzine', 'aged cheese', 'severe', 'Tyramine in aged cheese with MAOIs can cause a sudden, dangerous spike in blood pressure.', 'Avoid aged, cured, or fermented foods while taking this medication.'),
  ('phenelzine', 'cured meats', 'severe', 'Tyramine in cured meats with MAOIs can cause a sudden, dangerous spike in blood pressure.', 'Avoid aged, cured, or fermented foods while taking this medication.'),
  ('phenelzine', 'soy sauce', 'severe', 'Tyramine in fermented soy products with MAOIs can cause a hypertensive crisis.', 'Avoid fermented soy products like soy sauce, miso, and tofu.'),
  ('levothyroxine', 'high-fiber bread', 'moderate', 'High-fiber foods can reduce absorption of thyroid medication.', 'Take levothyroxine on an empty stomach and wait at least 60 minutes before eating high-fiber foods.'),
  ('levothyroxine', 'walnuts', 'moderate', 'Walnuts can interfere with thyroid medication absorption.', 'Separate walnut consumption from medication by at least 4 hours.'),
  ('levothyroxine', 'soy milk', 'moderate', 'Soy products may reduce levothyroxine absorption.', 'Take medication on an empty stomach and wait 60 minutes before consuming soy products.'),
  ('tetracycline', 'milk', 'moderate', 'Calcium in dairy binds to tetracycline antibiotics, significantly reducing absorption.', 'Take tetracycline 2 hours before or 4 hours after consuming dairy products.'),
  ('ciprofloxacin', 'milk', 'moderate', 'Calcium in dairy binds to ciprofloxacin, reducing antibiotic effectiveness.', 'Avoid dairy products within 2 hours of taking this medication.'),
  ('metronidazole', 'alcohol', 'severe', 'Combining metronidazole with alcohol causes severe nausea, vomiting, and rapid heartbeat.', 'Avoid all alcohol during treatment and for 48 hours after the last dose.'),
  ('lisinopril', 'potassium-rich foods', 'moderate', 'ACE inhibitors can increase potassium levels; high-potassium foods may cause dangerous hyperkalemia.', 'Monitor potassium intake. Avoid potassium supplements and salt substitutes.'),
  ('enalapril', 'potassium-rich foods', 'moderate', 'ACE inhibitors can increase potassium levels; high-potassium foods may cause dangerous hyperkalemia.', 'Monitor potassium intake. Avoid potassium supplements and salt substitutes.'),
  ('metformin', 'alcohol', 'moderate', 'Alcohol can increase the risk of lactic acidosis, a rare but serious side effect of metformin.', 'Limit alcohol consumption and never drink on an empty stomach.'),
  ('clopidogrel', 'garlic', 'mild', 'Garlic supplements may increase the blood-thinning effect of clopidogrel, raising bleeding risk.', 'Moderate garlic consumption in food is fine. Avoid high-dose garlic supplements.'),
  ('clopidogrel', 'ginger', 'mild', 'Ginger may enhance the antiplatelet effect of clopidogrel.', 'Moderate ginger in cooking is fine. Avoid high-dose ginger supplements.'),
  ('digoxin', 'licorice', 'moderate', 'Licorice can increase digoxin toxicity risk by lowering potassium levels.', 'Avoid black licorice and licorice supplements while taking digoxin.'),
  ('furosemide', 'licorice', 'mild', 'Licorice can worsen potassium loss caused by diuretics.', 'Avoid excessive licorice consumption. Monitor potassium levels.'),
  ('fluoxetine', 'alcohol', 'moderate', 'Alcohol can worsen CNS depression and increase side effects of SSRIs like dizziness and drowsiness.', 'Limit or avoid alcohol while taking this medication.'),
  ('sertraline', 'alcohol', 'moderate', 'Alcohol can worsen CNS depression and increase side effects of SSRIs like dizziness and drowsiness.', 'Limit or avoid alcohol while taking this medication.'),
  ('prednisone', 'high-sodium foods', 'moderate', 'Corticosteroids cause fluid retention; high-sodium foods can worsen bloating and blood pressure.', 'Limit salty foods and monitor sodium intake while on corticosteroids.'),
  ('prednisone', 'high-sugar foods', 'mild', 'Corticosteroids can raise blood sugar; high-sugar foods may amplify this effect.', 'Limit sugary foods and monitor blood sugar levels while on corticosteroids.'),
  ('omeprazole', 'high-protein foods', 'mild', 'High-protein meals may slightly reduce omeprazole absorption, but clinical impact is minimal.', 'Take omeprazole before meals for best results. No need to avoid protein.', 'protein'),
  ('losartan', 'potassium-rich foods', 'moderate', 'ARBs can increase potassium levels; high-potassium foods may cause hyperkalemia.', 'Monitor potassium intake and avoid potassium supplements.'),
  ('insulin', 'high-sugar foods', 'severe', 'High-sugar meals can cause dangerous blood sugar spikes in insulin-dependent diabetics.', 'Monitor carbohydrate intake closely and adjust insulin according to your meal plan.'),
  ('insulin', 'alcohol', 'severe', 'Alcohol can cause delayed hypoglycemia (low blood sugar) hours after consumption.', 'Never drink alcohol on an empty stomach. Monitor blood sugar closely.'),
  ('methotrexate', 'alcohol', 'severe', 'Alcohol combined with methotrexate significantly increases liver toxicity risk.', 'Avoid alcohol completely while taking methotrexate.')
on conflict (active_ingredient, food_ingredient) do nothing;

-- 4. RPC: check a meal against the user's medications
create or replace function check_meal_interactions(p_user_id uuid, p_meal_id uuid)
returns table(
  interaction_id uuid,
  active_ingredient text,
  medication_name text,
  food_ingredient text,
  severity text,
  description text,
  recommendation text
)
language plpgsql
security definer
stable
as $$
begin
  return query
  select distinct
    fmi.id,
    fmi.active_ingredient,
    um.medication_name,
    fmi.food_ingredient,
    fmi.severity,
    fmi.description,
    fmi.recommendation
  from user_medications um
  join food_medicine_interactions fmi
    on lower(fmi.active_ingredient) = lower(um.active_ingredient)
  join meal_ingredients mi
    on lower(mi.name) like '%' || lower(fmi.food_ingredient) || '%'
      or lower(fmi.food_ingredient) like '%' || lower(mi.name) || '%'
  where um.user_id = p_user_id
    and mi.meal_id = p_meal_id
  order by
    case fmi.severity
      when 'severe' then 1
      when 'moderate' then 2
      when 'mild' then 3
    end;
end;
$$;

grant execute on function check_meal_interactions to authenticated;

-- 5. RPC: also check a list of ingredient names (for schedule/recommendation pages)
create or replace function check_ingredient_interactions(
  p_user_id uuid,
  p_ingredient_names text[]
)
returns table(
  interaction_id uuid,
  active_ingredient text,
  medication_name text,
  food_ingredient text,
  severity text,
  description text,
  recommendation text
)
language plpgsql
security definer
stable
as $$
begin
  return query
  select distinct
    fmi.id,
    fmi.active_ingredient,
    um.medication_name,
    fmi.food_ingredient,
    fmi.severity,
    fmi.description,
    fmi.recommendation
  from user_medications um
  join food_medicine_interactions fmi
    on lower(fmi.active_ingredient) = lower(um.active_ingredient)
  join unnest(p_ingredient_names) ing(name)
    on lower(ing.name) like '%' || lower(fmi.food_ingredient) || '%'
      or lower(fmi.food_ingredient) like '%' || lower(ing.name) || '%'
  where um.user_id = p_user_id
  order by
    case fmi.severity
      when 'severe' then 1
      when 'moderate' then 2
      when 'mild' then 3
    end;
end;
$$;

grant execute on function check_ingredient_interactions to authenticated;
