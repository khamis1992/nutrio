-- Health daily metrics: normalized wearable/app data used for readiness and body-load insights.

create table if not exists public.health_daily_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  metric_date date not null,
  steps integer not null default 0,
  workouts_count integer not null default 0,
  active_calories integer not null default 0,
  resting_heart_rate numeric,
  average_heart_rate numeric,
  hrv numeric,
  sleep_minutes integer,
  deep_sleep_minutes integer,
  rem_sleep_minutes integer,
  respiratory_rate numeric,
  spo2 numeric,
  skin_temperature numeric,
  source text not null default 'manual',
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint health_daily_metrics_user_date_unique unique (user_id, metric_date)
);

create index if not exists idx_health_daily_metrics_user_date
  on public.health_daily_metrics (user_id, metric_date desc);

alter table public.health_daily_metrics enable row level security;

drop policy if exists "Users can view own health daily metrics" on public.health_daily_metrics;
create policy "Users can view own health daily metrics"
  on public.health_daily_metrics
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own health daily metrics" on public.health_daily_metrics;
create policy "Users can insert own health daily metrics"
  on public.health_daily_metrics
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own health daily metrics" on public.health_daily_metrics;
create policy "Users can update own health daily metrics"
  on public.health_daily_metrics
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own health daily metrics" on public.health_daily_metrics;
create policy "Users can delete own health daily metrics"
  on public.health_daily_metrics
  for delete
  using (auth.uid() = user_id);
