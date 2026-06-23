-- health_sync_data: stores raw health data snapshots synced from Apple Health / Google Fit.
-- This table is written to by useHealthKitIntegration and useHealthIntegration hooks
-- after each successful sync cycle.

create table if not exists public.health_sync_data (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('apple_health', 'google_fit', 'none')),
  data jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Index for fast user lookups ordered by sync time
create index if not exists idx_health_sync_data_user_synced
  on public.health_sync_data (user_id, synced_at desc);

-- Row Level Security
alter table public.health_sync_data enable row level security;

drop policy if exists "Users can view own health sync data" on public.health_sync_data;
create policy "Users can view own health sync data"
  on public.health_sync_data
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own health sync data" on public.health_sync_data;
create policy "Users can insert own health sync data"
  on public.health_sync_data
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own health sync data" on public.health_sync_data;
create policy "Users can update own health sync data"
  on public.health_sync_data
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own health sync data" on public.health_sync_data;
create policy "Users can delete own health sync data"
  on public.health_sync_data
  for delete
  using (auth.uid() = user_id);
