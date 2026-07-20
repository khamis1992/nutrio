-- Agent 4: wearable data platform foundation.
-- Stores event-level wearable metric samples, sync state, source provenance,
-- replay dedupe, and rebuildable daily aggregates.

create table if not exists public.wearable_sync_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in (
    'apple_health',
    'google_fit',
    'sporthub',
    'file_import',
    'body_scale',
    'nutrio_activity',
    'manual'
  )),
  status text not null default 'connected' check (status in (
    'connected',
    'syncing',
    'synced',
    'stale',
    'error',
    'revoked'
  )),
  capabilities text[] not null default '{}',
  sync_cursor jsonb not null default '{}'::jsonb,
  source_precedence integer not null default 0,
  connected_at timestamptz not null default now(),
  last_success_at timestamptz,
  last_error_at timestamptz,
  last_error_message text,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wearable_sync_sources_user_provider_unique unique (user_id, provider)
);

create table if not exists public.wearable_metric_samples (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in (
    'apple_health',
    'google_fit',
    'sporthub',
    'file_import',
    'body_scale',
    'nutrio_activity',
    'manual'
  )),
  metric_type text not null check (metric_type in (
    'steps',
    'workouts_count',
    'active_calories',
    'average_heart_rate',
    'resting_heart_rate',
    'hrv',
    'sleep_minutes',
    'deep_sleep_minutes',
    'rem_sleep_minutes',
    'respiratory_rate',
    'spo2',
    'skin_temperature',
    'body_weight_kg',
    'body_fat_percent'
  )),
  metric_date date not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  value numeric not null check (value >= 0),
  unit text not null,
  external_id text,
  dedupe_key text not null,
  checksum text not null,
  source_app text,
  device_id text,
  sync_status text not null default 'synced' check (sync_status in (
    'pending',
    'synced',
    'duplicate',
    'error',
    'revoked'
  )),
  raw jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wearable_metric_samples_user_dedupe_unique unique (user_id, dedupe_key),
  constraint wearable_metric_samples_time_order check (end_at >= start_at)
);

create index if not exists idx_wearable_metric_samples_user_date
  on public.wearable_metric_samples (user_id, metric_date desc, metric_type);

create index if not exists idx_wearable_metric_samples_rebuild
  on public.wearable_metric_samples (user_id, metric_date, metric_type, provider)
  where deleted_at is null and sync_status = 'synced';

create index if not exists idx_wearable_sync_sources_user_status
  on public.wearable_sync_sources (user_id, status, updated_at desc);

alter table public.wearable_sync_sources enable row level security;
alter table public.wearable_metric_samples enable row level security;

drop policy if exists "Users can view own wearable sync sources" on public.wearable_sync_sources;
create policy "Users can view own wearable sync sources"
  on public.wearable_sync_sources
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can manage own wearable sync sources" on public.wearable_sync_sources;
create policy "Users can manage own wearable sync sources"
  on public.wearable_sync_sources
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can view own wearable samples" on public.wearable_metric_samples;
create policy "Users can view own wearable samples"
  on public.wearable_metric_samples
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can manage own wearable samples" on public.wearable_metric_samples;
create policy "Users can manage own wearable samples"
  on public.wearable_metric_samples
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.wearable_provider_precedence(p_provider text)
returns integer
language sql
immutable
as $$
  select case p_provider
    when 'body_scale' then 100
    when 'apple_health' then 90
    when 'google_fit' then 80
    when 'sporthub' then 70
    when 'file_import' then 50
    when 'nutrio_activity' then 30
    when 'manual' then 20
    else 0
  end
$$;

create or replace function public.rebuild_health_daily_metrics_from_wearables(
  p_user_id uuid,
  p_metric_date date
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_steps integer := 0;
  v_workouts_count integer := 0;
  v_active_calories integer := 0;
  v_resting_heart_rate numeric;
  v_average_heart_rate numeric;
  v_hrv numeric;
  v_sleep_minutes integer;
  v_deep_sleep_minutes integer;
  v_rem_sleep_minutes integer;
  v_respiratory_rate numeric;
  v_spo2 numeric;
  v_skin_temperature numeric;
  v_source text := 'manual';
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  with provider_metric as (
    select
      metric_type,
      provider,
      public.wearable_provider_precedence(provider) as precedence,
      max(synced_at) as latest_synced_at,
      case
        when metric_type in ('steps', 'workouts_count', 'active_calories', 'sleep_minutes', 'deep_sleep_minutes', 'rem_sleep_minutes')
          then sum(value)
        else avg(value)
      end as metric_value
    from public.wearable_metric_samples
    where user_id = p_user_id
      and metric_date = p_metric_date
      and deleted_at is null
      and sync_status = 'synced'
    group by metric_type, provider
  ),
  selected_metric as (
    select distinct on (metric_type)
      metric_type,
      provider,
      metric_value
    from provider_metric
    order by metric_type, precedence desc, latest_synced_at desc, provider
  )
  select
    coalesce(max(metric_value) filter (where metric_type = 'steps'), 0)::integer,
    coalesce(max(metric_value) filter (where metric_type = 'workouts_count'), 0)::integer,
    coalesce(max(metric_value) filter (where metric_type = 'active_calories'), 0)::integer,
    max(metric_value) filter (where metric_type = 'resting_heart_rate'),
    max(metric_value) filter (where metric_type = 'average_heart_rate'),
    max(metric_value) filter (where metric_type = 'hrv'),
    max(metric_value) filter (where metric_type = 'sleep_minutes')::integer,
    max(metric_value) filter (where metric_type = 'deep_sleep_minutes')::integer,
    max(metric_value) filter (where metric_type = 'rem_sleep_minutes')::integer,
    max(metric_value) filter (where metric_type = 'respiratory_rate'),
    max(metric_value) filter (where metric_type = 'spo2'),
    max(metric_value) filter (where metric_type = 'skin_temperature'),
    coalesce(string_agg(distinct provider, '+' order by provider), 'manual')
  into
    v_steps,
    v_workouts_count,
    v_active_calories,
    v_resting_heart_rate,
    v_average_heart_rate,
    v_hrv,
    v_sleep_minutes,
    v_deep_sleep_minutes,
    v_rem_sleep_minutes,
    v_respiratory_rate,
    v_spo2,
    v_skin_temperature,
    v_source
  from selected_metric;

  insert into public.health_daily_metrics (
    user_id,
    metric_date,
    steps,
    workouts_count,
    active_calories,
    resting_heart_rate,
    average_heart_rate,
    hrv,
    sleep_minutes,
    deep_sleep_minutes,
    rem_sleep_minutes,
    respiratory_rate,
    spo2,
    skin_temperature,
    source,
    synced_at,
    updated_at
  )
  values (
    p_user_id,
    p_metric_date,
    v_steps,
    v_workouts_count,
    v_active_calories,
    v_resting_heart_rate,
    v_average_heart_rate,
    v_hrv,
    v_sleep_minutes,
    v_deep_sleep_minutes,
    v_rem_sleep_minutes,
    v_respiratory_rate,
    v_spo2,
    v_skin_temperature,
    v_source,
    now(),
    now()
  )
  on conflict (user_id, metric_date)
  do update set
    steps = excluded.steps,
    workouts_count = excluded.workouts_count,
    active_calories = excluded.active_calories,
    resting_heart_rate = excluded.resting_heart_rate,
    average_heart_rate = excluded.average_heart_rate,
    hrv = excluded.hrv,
    sleep_minutes = excluded.sleep_minutes,
    deep_sleep_minutes = excluded.deep_sleep_minutes,
    rem_sleep_minutes = excluded.rem_sleep_minutes,
    respiratory_rate = excluded.respiratory_rate,
    spo2 = excluded.spo2,
    skin_temperature = excluded.skin_temperature,
    source = excluded.source,
    synced_at = excluded.synced_at,
    updated_at = now();
end;
$$;

create or replace function public.ingest_wearable_metric_samples(p_samples jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_sample jsonb;
  v_metric_date date;
  v_changed integer;
  v_changed_count integer := 0;
  v_unchanged_count integer := 0;
  v_rejected_count integer := 0;
  v_dates date[] := '{}';
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  if jsonb_typeof(p_samples) <> 'array' then
    raise exception 'SAMPLES_MUST_BE_ARRAY';
  end if;

  if jsonb_array_length(p_samples) > 500 then
    raise exception 'TOO_MANY_SAMPLES';
  end if;

  for v_sample in select value from jsonb_array_elements(p_samples)
  loop
    begin
      v_metric_date := (v_sample ->> 'metric_date')::date;

      insert into public.wearable_metric_samples (
        user_id,
        provider,
        metric_type,
        metric_date,
        start_at,
        end_at,
        value,
        unit,
        external_id,
        dedupe_key,
        checksum,
        source_app,
        device_id,
        sync_status,
        raw,
        synced_at,
        deleted_at,
        updated_at
      )
      values (
        v_user_id,
        v_sample ->> 'provider',
        v_sample ->> 'metric_type',
        v_metric_date,
        (v_sample ->> 'start_at')::timestamptz,
        (v_sample ->> 'end_at')::timestamptz,
        (v_sample ->> 'value')::numeric,
        v_sample ->> 'unit',
        nullif(v_sample ->> 'external_id', ''),
        v_sample ->> 'dedupe_key',
        v_sample ->> 'checksum',
        nullif(v_sample ->> 'source_app', ''),
        nullif(v_sample ->> 'device_id', ''),
        coalesce(nullif(v_sample ->> 'sync_status', ''), 'synced'),
        coalesce(v_sample -> 'raw', '{}'::jsonb),
        now(),
        null,
        now()
      )
      on conflict (user_id, dedupe_key)
      do update set
        provider = excluded.provider,
        metric_type = excluded.metric_type,
        metric_date = excluded.metric_date,
        start_at = excluded.start_at,
        end_at = excluded.end_at,
        value = excluded.value,
        unit = excluded.unit,
        external_id = excluded.external_id,
        checksum = excluded.checksum,
        source_app = excluded.source_app,
        device_id = excluded.device_id,
        sync_status = excluded.sync_status,
        raw = excluded.raw,
        synced_at = excluded.synced_at,
        deleted_at = null,
        updated_at = now()
      where public.wearable_metric_samples.checksum is distinct from excluded.checksum
         or public.wearable_metric_samples.deleted_at is not null
         or public.wearable_metric_samples.sync_status is distinct from excluded.sync_status;

      get diagnostics v_changed = row_count;
      if v_changed = 0 then
        v_unchanged_count := v_unchanged_count + 1;
      else
        v_changed_count := v_changed_count + 1;
      end if;

      v_dates := array_append(v_dates, v_metric_date);
    exception
      when others then
        v_rejected_count := v_rejected_count + 1;
    end;
  end loop;

  for v_metric_date in select distinct unnest(v_dates)
  loop
    perform public.rebuild_health_daily_metrics_from_wearables(v_user_id, v_metric_date);
  end loop;

  return jsonb_build_object(
    'ok', true,
    'inserted_or_updated', v_changed_count,
    'unchanged', v_unchanged_count,
    'rejected', v_rejected_count
  );
end;
$$;

create or replace function public.upsert_wearable_sync_state(
  p_provider text,
  p_status text,
  p_cursor jsonb default '{}'::jsonb,
  p_error_message text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  insert into public.wearable_sync_sources (
    user_id,
    provider,
    status,
    sync_cursor,
    source_precedence,
    last_success_at,
    last_error_at,
    last_error_message,
    updated_at
  )
  values (
    v_user_id,
    p_provider,
    p_status,
    coalesce(p_cursor, '{}'::jsonb),
    public.wearable_provider_precedence(p_provider),
    case when p_status = 'synced' then now() else null end,
    case when p_status = 'error' then now() else null end,
    p_error_message,
    now()
  )
  on conflict (user_id, provider)
  do update set
    status = excluded.status,
    sync_cursor = excluded.sync_cursor,
    source_precedence = excluded.source_precedence,
    last_success_at = coalesce(excluded.last_success_at, public.wearable_sync_sources.last_success_at),
    last_error_at = coalesce(excluded.last_error_at, public.wearable_sync_sources.last_error_at),
    last_error_message = excluded.last_error_message,
    revoked_at = case when excluded.status = 'revoked' then now() else public.wearable_sync_sources.revoked_at end,
    updated_at = now();
end;
$$;

create or replace function public.revoke_wearable_provider(p_provider text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_dates date[];
  v_metric_date date;
  v_deleted integer := 0;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select coalesce(array_agg(distinct metric_date), '{}')
  into v_dates
  from public.wearable_metric_samples
  where user_id = v_user_id
    and provider = p_provider
    and deleted_at is null;

  update public.wearable_metric_samples
  set deleted_at = now(),
      sync_status = 'revoked',
      updated_at = now()
  where user_id = v_user_id
    and provider = p_provider
    and deleted_at is null;

  get diagnostics v_deleted = row_count;

  perform public.upsert_wearable_sync_state(
    p_provider,
    'revoked',
    jsonb_build_object('revokedAt', now()),
    null
  );

  for v_metric_date in select unnest(v_dates)
  loop
    perform public.rebuild_health_daily_metrics_from_wearables(v_user_id, v_metric_date);
  end loop;

  return jsonb_build_object('ok', true, 'revoked_samples', v_deleted);
end;
$$;

revoke all on function public.ingest_wearable_metric_samples(jsonb) from public;
revoke all on function public.upsert_wearable_sync_state(text, text, jsonb, text) from public;
revoke all on function public.revoke_wearable_provider(text) from public;
revoke all on function public.rebuild_health_daily_metrics_from_wearables(uuid, date) from public;

grant execute on function public.ingest_wearable_metric_samples(jsonb) to authenticated;
grant execute on function public.upsert_wearable_sync_state(text, text, jsonb, text) to authenticated;
grant execute on function public.revoke_wearable_provider(text) to authenticated;
