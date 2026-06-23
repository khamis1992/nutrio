-- Daily performance snapshots: stores Nutrio's combined nutrition + activity score.

create table if not exists public.daily_performance_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  snapshot_date date not null,
  nutrition_score integer not null default 0 check (nutrition_score between 0 and 100),
  readiness_score integer check (readiness_score between 0 and 100),
  body_load integer not null default 0 check (body_load >= 0),
  calories_consumed integer not null default 0,
  calorie_target integer not null default 0,
  protein_consumed_g integer not null default 0,
  protein_target_g integer not null default 0,
  water_percent integer not null default 0 check (water_percent between 0 and 200),
  meals_logged integer not null default 0,
  recommended_meal_id uuid references public.meals(id) on delete set null,
  primary_reason text,
  reasons jsonb not null default '[]'::jsonb,
  awards jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_performance_snapshots_user_date_unique unique (user_id, snapshot_date)
);

create index if not exists idx_daily_performance_snapshots_user_date
  on public.daily_performance_snapshots (user_id, snapshot_date desc);

alter table public.daily_performance_snapshots enable row level security;

drop policy if exists "Users can view own daily performance snapshots" on public.daily_performance_snapshots;
create policy "Users can view own daily performance snapshots"
  on public.daily_performance_snapshots
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own daily performance snapshots" on public.daily_performance_snapshots;
create policy "Users can insert own daily performance snapshots"
  on public.daily_performance_snapshots
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own daily performance snapshots" on public.daily_performance_snapshots;
create policy "Users can update own daily performance snapshots"
  on public.daily_performance_snapshots
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
