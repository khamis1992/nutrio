alter table public.meals
  add column if not exists supports_large boolean not null default false,
  add column if not exists large_calories_increase integer not null default 0,
  add column if not exists large_protein_increase numeric not null default 0,
  add column if not exists large_price_adjustment numeric not null default 0,
  add column if not exists supports_high_protein boolean not null default false,
  add column if not exists high_protein_calories_increase integer not null default 0,
  add column if not exists high_protein_protein_increase numeric not null default 0,
  add column if not exists high_protein_price_adjustment numeric not null default 0;

alter table public.meal_schedules
  add column if not exists customization_data jsonb not null default '{}'::jsonb;

comment on column public.meals.supports_large is
  'Whether this meal supports a partner-defined large portion upgrade.';

comment on column public.meals.supports_high_protein is
  'Whether this meal supports a partner-defined high-protein upgrade.';

comment on column public.meal_schedules.customization_data is
  'Customer-selected meal customization metadata at schedule time.';
